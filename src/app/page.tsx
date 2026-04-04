"use client";

import { useState, useEffect } from "react";

type Reviewer = { slug: string; name: string };

export default function Home() {
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [selectedReviewer, setSelectedReviewer] = useState<string>("");
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/reviewers")
      .then((res) => res.json())
      .then((data: Reviewer[]) => {
        setReviewers(data);
        if (data.length > 0) setSelectedReviewer(data[0].slug);
      });
  }, []);

  async function handleSubmit() {
    if (!text.trim() || !selectedReviewer) return;

    setLoading(true);
    setFeedback("");

    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, reviewer: selectedReviewer }),
    });

    if (!response.ok) {
      const error = await response.json();
      setFeedback(`Error: ${error.error}`);
      setLoading(false);
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      setFeedback((prev) => prev + chunk);
    }

    setLoading(false);
  }

  return (
    <div className="flex flex-col flex-1 items-center bg-background font-sans">
      <main className="flex flex-1 w-full max-w-2xl flex-col gap-8 py-16 px-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            Writing Feedback Studio
          </h1>
          <p className="mt-1 text-sm text-foreground/60">
            Paste your writing, pick a reviewer, get feedback.
          </p>
        </header>

        {/* Reviewer selector */}
        <section>
          <label className="block text-sm font-medium mb-3">
            Select a reviewer
          </label>
          <div className="flex flex-wrap gap-2">
            {reviewers.map((r) => (
              <button
                key={r.slug}
                onClick={() => setSelectedReviewer(r.slug)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  selectedReviewer === r.slug
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground/20 hover:border-foreground/40"
                }`}
              >
                {r.name}
              </button>
            ))}
            {reviewers.length === 0 && (
              <p className="text-sm text-foreground/40">Loading reviewers...</p>
            )}
          </div>
        </section>

        {/* Text input */}
        <section>
          <label htmlFor="writing" className="block text-sm font-medium mb-2">
            Your writing
          </label>
          <textarea
            id="writing"
            rows={12}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the text you want feedback on..."
            className="w-full rounded-lg border border-foreground/20 bg-transparent px-4 py-3 text-sm leading-relaxed placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-y"
          />
        </section>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || !text.trim() || !selectedReviewer}
          className="self-end px-6 py-2.5 rounded-lg bg-foreground text-background text-sm font-medium transition-opacity disabled:opacity-40 hover:opacity-90"
        >
          {loading ? "Getting feedback..." : "Get Feedback"}
        </button>

        {/* Feedback display */}
        {(feedback || loading) && (
          <section>
            <label className="block text-sm font-medium mb-2">Feedback</label>
            <div className="rounded-lg border border-foreground/20 bg-foreground/[0.03] px-5 py-4 font-mono text-sm leading-relaxed whitespace-pre-wrap min-h-[120px]">
              {feedback || (
                <span className="text-foreground/30">Waiting for response...</span>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
