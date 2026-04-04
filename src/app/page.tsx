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

export default function Home() {
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [selectedReviewer, setSelectedReviewer] = useState<string>("");
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/reviewers")
      .then((res) => res.json())
      .then((data: Reviewer[]) => {
        setReviewers(data);
        if (data.length === 1) setSelectedReviewer(data[0].slug);
      });
  }, []);

  async function handleSubmit() {
    if (!text.trim() || !selectedReviewer) return;

    setLoading(true);
    setError("");
    setFeedback([]);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, reviewer: selectedReviewer }),
      });

      if (!response.ok) {
        const err = await response.json();
        setError(err.error || "Something went wrong");
        setLoading(false);
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
      }

      const parsed: FeedbackItem[] = JSON.parse(accumulated);
      setFeedback(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get feedback");
    } finally {
      setLoading(false);
    }
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
            Reviewer
          </label>
          <div className="flex flex-wrap gap-3">
            {reviewers.map((r) => (
              <button
                key={r.slug}
                onClick={() => setSelectedReviewer(r.slug)}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                  selectedReviewer === r.slug
                    ? "border-zinc-900 bg-white"
                    : "border-zinc-200 bg-white hover:border-zinc-300"
                }`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
                  {r.avatar}
                </div>
                <div>
                  <div className="text-sm font-medium text-zinc-900">
                    {r.name}
                  </div>
                  <div className="text-xs text-zinc-500">{r.description}</div>
                </div>
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
          disabled={loading || !text.trim() || !selectedReviewer}
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

        {/* Feedback display */}
        {feedback.length > 0 && (
          <div className="mt-8 border-t border-zinc-200 pt-6">
            <h2 className="text-base font-semibold text-zinc-900 mb-4">
              Feedback
            </h2>
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
          </div>
        )}
      </main>
    </div>
  );
}
