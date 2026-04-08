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

type ReviewerResult = {
  reviewer: Reviewer;
  feedback: FeedbackItem[];
  stats: LlmStats | null;
  error: string | null;
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
  const [results, setResults] = useState<ReviewerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const MAX_REVIEWERS = 2;

  function toggleReviewer(slug: string) {
    setSelectedReviewers((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else if (next.size < MAX_REVIEWERS) {
        next.add(slug);
      }
      return next;
    });
  }

  useEffect(() => {
    fetch("/api/reviewers")
      .then((res) => res.json())
      .then((data: Reviewer[]) => {
        setReviewers(data);
        if (data.length === 1) setSelectedReviewers(new Set([data[0].slug]));
      });
  }, []);

  async function fetchOneReviewer(reviewer: Reviewer): Promise<ReviewerResult> {
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, reviewer: reviewer.slug }),
      });

      if (!response.ok) {
        const err = await response.json();
        return { reviewer, feedback: [], stats: null, error: err.error || "Something went wrong" };
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
        const statsJson = content.slice(statsIdx + statsMarker.length);
        content = content.slice(0, statsIdx);
        try {
          stats = JSON.parse(statsJson);
        } catch {
          // stats parsing failed, not critical
        }
      }

      const json = content.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "").trim();
      const feedback = parseJsonPermissive(json);
      return { reviewer, feedback, stats, error: null };
    } catch (e) {
      return { reviewer, feedback: [], stats: null, error: e instanceof Error ? e.message : "Failed to get feedback" };
    }
  }

  async function handleSubmit() {
    if (!text.trim() || selectedReviewers.size === 0) return;

    setLoading(true);
    setError("");
    setResults([]);

    const selected = reviewers.filter((r) => selectedReviewers.has(r.slug));
    const settled = await Promise.all(selected.map(fetchOneReviewer));
    setResults(settled);
    setLoading(false);
  }

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans">
      <main className="w-full max-w-2xl px-6 py-12">
        <h1 className="text-xl font-semibold text-zinc-900">
          Writing Feedback Studio
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Paste your writing, pick a reviewer, get feedback.
        </p>

        {/* Reviewer selector */}
        <div className="mt-8">
          <label className="block text-sm font-medium text-zinc-600 mb-2">
            Reviewers{" "}
            <span className="font-normal text-zinc-400">
              (pick up to {MAX_REVIEWERS})
            </span>
          </label>
          <div className="flex flex-col gap-2">
            {reviewers.map((r) => {
              const isSelected = selectedReviewers.has(r.slug);
              const isDisabled = !isSelected && selectedReviewers.size >= MAX_REVIEWERS;
              return (
                <button
                  key={r.slug}
                  onClick={() => toggleReviewer(r.slug)}
                  disabled={isDisabled}
                  className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors focus:outline-none ${
                    isSelected
                      ? "border-zinc-900 bg-white ring-1 ring-zinc-900"
                      : isDisabled
                        ? "border-zinc-100 bg-zinc-50 opacity-50 cursor-not-allowed"
                        : "border-zinc-200 bg-white hover:border-zinc-300"
                  }`}
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
                    isSelected ? "bg-zinc-900" : "bg-zinc-400"
                  }`}>
                    {r.avatar}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-900">
                      {r.name}
                    </div>
                    <div className="text-xs text-zinc-500 truncate">{r.description}</div>
                  </div>
                </button>
              );
            })}
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
          {loading ? "Reviewing..." : "Get Feedback"}
        </button>

        {/* Error display */}
        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Feedback display — grouped by reviewer */}
        {results.map((result) => (
          <div key={result.reviewer.slug} className="mt-8 border-t border-zinc-200 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
                {result.reviewer.avatar}
              </div>
              <h2 className="text-base font-semibold text-zinc-900">
                {result.reviewer.name}
              </h2>
            </div>

            {result.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {result.error}
              </div>
            )}

            {result.feedback.length > 0 && (
              <div className="flex flex-col gap-4">
                {result.feedback.map((item, i) => (
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
            )}

            {result.stats && (
              <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-500">
                  <span title="Model">
                    <span className="font-medium text-zinc-600">Model</span>{" "}
                    {result.stats.model}
                  </span>
                  {result.stats.input_tokens != null && (
                    <span title="Input tokens">
                      <span className="font-medium text-zinc-600">In</span>{" "}
                      {result.stats.input_tokens.toLocaleString()} tok
                    </span>
                  )}
                  {result.stats.output_tokens != null && (
                    <span title="Output tokens">
                      <span className="font-medium text-zinc-600">Out</span>{" "}
                      {result.stats.output_tokens.toLocaleString()} tok
                    </span>
                  )}
                  {result.stats.reasoning_tokens != null && (
                    <span title="Reasoning tokens">
                      <span className="font-medium text-zinc-600">Reasoning</span>{" "}
                      {result.stats.reasoning_tokens.toLocaleString()} tok
                    </span>
                  )}
                  <span title="Total latency">
                    <span className="font-medium text-zinc-600">Latency</span>{" "}
                    {(result.stats.latency_ms / 1000).toFixed(1)}s
                  </span>
                  {result.stats.ttft_ms != null && (
                    <span title="Time to first token">
                      <span className="font-medium text-zinc-600">TTFT</span>{" "}
                      {result.stats.ttft_ms}ms
                    </span>
                  )}
                  {result.stats.tokens_per_second != null && (
                    <span title="Tokens per second">
                      <span className="font-medium text-zinc-600">Speed</span>{" "}
                      {result.stats.tokens_per_second} tok/s
                    </span>
                  )}
                  {result.stats.cost != null && (
                    <span title="Cost">
                      <span className="font-medium text-zinc-600">Cost</span>{" "}
                      ${result.stats.cost < 0.01 ? result.stats.cost.toFixed(4) : result.stats.cost.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
