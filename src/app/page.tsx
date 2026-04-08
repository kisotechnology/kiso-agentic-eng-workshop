"use client";

import { useState, useEffect } from "react";

type Reviewer = {
  slug: string;
  name: string;
  description: string;
  avatar: string;
};

type FeedbackItem = {
  quote: string;
  comment: string;
};

type LlmStats = {
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  reasoning_tokens: number | null;
  latency_ms: number;
  ttft_ms: number | null;
  tokens_per_second: number | null;
  cost: number | null;
};

type ReviewerResult = {
  feedback: FeedbackItem[];
  stats: LlmStats | null;
};

function parseJsonPermissive(raw: string): FeedbackItem[] {
  // Try strict parse first
  try {
    return JSON.parse(raw);
  } catch {
    // ignore, try repairs
  }

  // Fix unescaped quotes inside JSON string values by re-extracting objects
  // via a regex that captures quote/comment pairs
  const items: FeedbackItem[] = [];
  const objectPattern = /"quote"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"comment"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let match;
  while ((match = objectPattern.exec(raw)) !== null) {
    items.push({
      quote: match[1].replace(/\\"/g, '"').replace(/\\n/g, "\n"),
      comment: match[2].replace(/\\"/g, '"').replace(/\\n/g, "\n"),
    });
  }

  if (items.length > 0) return items;

  // Last resort: try fixing trailing commas and truncated arrays
  let repaired = raw.replace(/,\s*([}\]])/g, "$1");
  // Close unclosed array
  if (!repaired.trimEnd().endsWith("]")) repaired = repaired.trimEnd() + "]";
  return JSON.parse(repaired);
}

export default function Home() {
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [selectedReviewers, setSelectedReviewers] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [results, setResults] = useState<Map<string, ReviewerResult>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/reviewers")
      .then((res) => res.json())
      .then((data: Reviewer[]) => {
        setReviewers(data);
        if (data.length === 1) setSelectedReviewers(new Set([data[0].slug]));
      });
  }, []);

  function toggleReviewer(slug: string) {
    setSelectedReviewers((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function toggleAll() {
    setSelectedReviewers((prev) =>
      prev.size === reviewers.length
        ? new Set()
        : new Set(reviewers.map((r) => r.slug))
    );
  }

  async function handleSubmit() {
    if (!text.trim() || selectedReviewers.size === 0) return;

    setLoading(true);
    setError("");
    setResults(new Map());

    const slugs = Array.from(selectedReviewers);
    const errors: string[] = [];

    async function fetchOne(slug: string) {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, reviewer: slug }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || `Failed for ${slug}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
      }

      let content = accumulated;
      let stats: LlmStats | null = null;
      const statsMarker = "\n__STATS__";
      const statsIdx = content.lastIndexOf(statsMarker);
      if (statsIdx !== -1) {
        try {
          stats = JSON.parse(content.slice(statsIdx + statsMarker.length));
        } catch {
          // stats parsing failed, not critical
        }
        content = content.slice(0, statsIdx);
      }

      const json = content.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "").trim();
      const feedback = parseJsonPermissive(json);

      // Progressive rendering: update results as each reviewer finishes
      setResults((prev) => new Map(prev).set(slug, { feedback, stats }));
    }

    const settled = await Promise.allSettled(slugs.map(fetchOne));
    for (const result of settled) {
      if (result.status === "rejected") {
        errors.push(result.reason?.message || "Unknown error");
      }
    }

    if (errors.length > 0) setError(errors.join("; "));
    setLoading(false);
  }

  // Aggregate stats for combined summary
  const allStats = Array.from(results.values())
    .map((r) => r.stats)
    .filter(Boolean) as LlmStats[];

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans">
      <main className="w-full max-w-2xl px-6 py-12">
        <h1 className="text-xl font-semibold text-zinc-900">
          Writing Feedback Studio
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Paste your writing, pick reviewers, get feedback.
        </p>

        {/* Reviewer selector */}
        <div className="mt-8">
          <div className="flex items-baseline justify-between mb-2">
            <label className="block text-sm font-medium text-zinc-600">
              Reviewers
              {selectedReviewers.size > 0 && (
                <span className="ml-1 text-zinc-400 font-normal">
                  ({selectedReviewers.size} selected)
                </span>
              )}
            </label>
            {reviewers.length > 1 && (
              <button
                onClick={toggleAll}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
              >
                {selectedReviewers.size === reviewers.length ? "Deselect all" : "Select all"}
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {reviewers.map((r) => (
              <button
                key={r.slug}
                onClick={() => toggleReviewer(r.slug)}
                className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors focus:outline-none ${
                  selectedReviewers.has(r.slug)
                    ? "border-zinc-900 bg-white ring-1 ring-zinc-900"
                    : "border-zinc-200 bg-white hover:border-zinc-300"
                }`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
                  {r.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-zinc-900">
                    {r.name}
                  </div>
                  <div className="text-xs text-zinc-500 truncate">{r.description}</div>
                </div>
                {selectedReviewers.has(r.slug) && (
                  <svg className="h-5 w-5 shrink-0 text-zinc-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Text area */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-zinc-600 mb-2">
            Your writing
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your text here..."
            rows={8}
            className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
          />
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={loading || !text.trim() || selectedReviewers.size === 0}
          className="mt-4 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading
            ? `Reviewing (${selectedReviewers.size})...`
            : selectedReviewers.size > 1
              ? `Get Feedback from ${selectedReviewers.size} Reviewers`
              : "Get Feedback"}
        </button>

        {/* Error display */}
        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Feedback display — grouped by reviewer */}
        {results.size > 0 && (
          <div className="mt-8 border-t border-zinc-200 pt-6">
            <h2 className="text-base font-semibold text-zinc-900 mb-6">
              Feedback
            </h2>
            <div className="flex flex-col gap-8">
              {Array.from(results.entries()).map(([slug, { feedback, stats }]) => {
                const reviewer = reviewers.find((r) => r.slug === slug);
                if (!reviewer) return null;
                return (
                  <section key={slug}>
                    {/* Reviewer header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
                        {reviewer.avatar}
                      </div>
                      <div className="text-sm font-semibold text-zinc-900">
                        {reviewer.name}
                      </div>
                    </div>

                    {/* Feedback items */}
                    <div className="flex flex-col gap-4">
                      {feedback.map((item, i) => (
                        <div key={i} className="border-l-2 border-zinc-900 pl-4">
                          <div className="rounded bg-zinc-100 px-3 py-2 text-sm italic text-zinc-500">
                            &ldquo;{item.quote}&rdquo;
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-zinc-700">
                            {item.comment}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Per-reviewer stats */}
                    {stats && (
                      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-500">
                          <span title="Model">
                            <span className="font-medium text-zinc-600">Model</span>{" "}
                            {stats.model}
                          </span>
                          {stats.input_tokens != null && (
                            <span title="Input tokens">
                              <span className="font-medium text-zinc-600">In</span>{" "}
                              {stats.input_tokens.toLocaleString()} tok
                            </span>
                          )}
                          {stats.output_tokens != null && (
                            <span title="Output tokens">
                              <span className="font-medium text-zinc-600">Out</span>{" "}
                              {stats.output_tokens.toLocaleString()} tok
                            </span>
                          )}
                          {stats.reasoning_tokens != null && (
                            <span title="Reasoning tokens (hidden chain-of-thought)">
                              <span className="font-medium text-zinc-600">Reasoning</span>{" "}
                              {stats.reasoning_tokens.toLocaleString()} tok
                            </span>
                          )}
                          <span title="Total latency">
                            <span className="font-medium text-zinc-600">Latency</span>{" "}
                            {(stats.latency_ms / 1000).toFixed(1)}s
                          </span>
                          {stats.ttft_ms != null && (
                            <span title="Time to first token">
                              <span className="font-medium text-zinc-600">TTFT</span>{" "}
                              {stats.ttft_ms}ms
                            </span>
                          )}
                          {stats.tokens_per_second != null && (
                            <span title="Total tokens per second (including reasoning)">
                              <span className="font-medium text-zinc-600">Speed</span>{" "}
                              {stats.tokens_per_second} tok/s
                            </span>
                          )}
                          {stats.cost != null && (
                            <span title="Cost">
                              <span className="font-medium text-zinc-600">Cost</span>{" "}
                              ${stats.cost < 0.01 ? stats.cost.toFixed(4) : stats.cost.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>

            {/* Combined stats summary */}
            {allStats.length > 1 && (
              <div className="mt-6 rounded-lg border border-zinc-300 bg-white px-4 py-3">
                <div className="text-xs font-medium text-zinc-600 mb-1">Combined</div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-500">
                  <span>
                    <span className="font-medium text-zinc-600">Total In</span>{" "}
                    {allStats.reduce((s, st) => s + (st.input_tokens ?? 0), 0).toLocaleString()} tok
                  </span>
                  <span>
                    <span className="font-medium text-zinc-600">Total Out</span>{" "}
                    {allStats.reduce((s, st) => s + (st.output_tokens ?? 0), 0).toLocaleString()} tok
                  </span>
                  <span>
                    <span className="font-medium text-zinc-600">Max Latency</span>{" "}
                    {(Math.max(...allStats.map((s) => s.latency_ms)) / 1000).toFixed(1)}s
                  </span>
                  {allStats.some((s) => s.cost != null) && (
                    <span>
                      <span className="font-medium text-zinc-600">Total Cost</span>{" "}
                      ${(() => {
                        const total = allStats.reduce((s, st) => s + (st.cost ?? 0), 0);
                        return total < 0.01 ? total.toFixed(4) : total.toFixed(2);
                      })()}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
