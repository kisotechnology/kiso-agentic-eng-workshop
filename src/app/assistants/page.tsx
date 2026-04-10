"use client";

import { useState, useEffect } from "react";
import Markdown from "react-markdown";

type Assistant = {
  slug: string;
  name: string;
  description: string;
  avatar: string;
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

export default function AssistantsPage() {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [selectedAssistant, setSelectedAssistant] = useState<string>("");
  const [text, setText] = useState("");
  const [response, setResponse] = useState("");
  const [stats, setStats] = useState<LlmStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/assistants")
      .then((res) => res.json())
      .then((data: Assistant[]) => {
        setAssistants(data);
        if (data.length === 1) setSelectedAssistant(data[0].slug);
      });
  }, []);

  async function handleSubmit() {
    if (!text.trim() || !selectedAssistant) return;

    setLoading(true);
    setError("");
    setResponse("");
    setStats(null);

    try {
      const res = await fetch("/api/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, assistant: selectedAssistant }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Something went wrong");
        setLoading(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
      }

      // Extract stats from end of stream
      let content = accumulated;
      const statsMarker = "\n__STATS__";
      const statsIdx = content.lastIndexOf(statsMarker);
      if (statsIdx !== -1) {
        const statsJson = content.slice(statsIdx + statsMarker.length);
        content = content.slice(0, statsIdx);
        try {
          setStats(JSON.parse(statsJson));
        } catch {
          // stats parsing failed, not critical
        }
      }

      setResponse(content.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get response");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans">
      <main className="w-full max-w-2xl px-6 py-12">
        <h1 className="text-xl font-semibold text-zinc-900">
          HP Org Assistants
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Select an assistant, paste your input, get a tailored response.
        </p>

        {/* Assistant selector */}
        <div className="mt-8">
          <label className="block text-sm font-medium text-zinc-600 mb-2">
            Assistant
          </label>
          <div className="flex flex-col gap-2">
            {assistants.map((a) => (
              <button
                key={a.slug}
                onClick={() => setSelectedAssistant(a.slug)}
                className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors focus:outline-none ${
                  selectedAssistant === a.slug
                    ? "border-zinc-900 bg-white ring-1 ring-zinc-900"
                    : "border-zinc-200 bg-white hover:border-zinc-300"
                }`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
                  {a.avatar}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-zinc-900">
                    {a.name}
                  </div>
                  <div className="text-xs text-zinc-500 truncate">{a.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Text area */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-zinc-600 mb-2">
            Input
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste text, data, questions, or documents here..."
            rows={8}
            className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
          />
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={loading || !text.trim() || !selectedAssistant}
          className="mt-4 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Processing..." : "Process"}
        </button>

        {/* Error display */}
        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Response display */}
        {response && (
          <div className="mt-8 border-t border-zinc-200 pt-6">
            <h2 className="text-base font-semibold text-zinc-900 mb-4">
              Response
            </h2>
            <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4 text-sm leading-relaxed text-zinc-700 prose prose-sm prose-zinc max-w-none">
              <Markdown>{response}</Markdown>
            </div>
          </div>
        )}

        {/* LLM stats */}
        {stats && (
          <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
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
      </main>
    </div>
  );
}
