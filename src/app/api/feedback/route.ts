import { getReviewer } from "@/lib/reviewers";

export async function POST(request: Request) {
  // Workshop key (expires 2026-04-08) — override via OPENROUTER_API_KEY in .env.local
  const apiKey = process.env.OPENROUTER_API_KEY || "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";

  const { text, reviewer: reviewerSlug } = await request.json();

  if (!text || !reviewerSlug) {
    return Response.json(
      { error: "Missing text or reviewer" },
      { status: 400 }
    );
  }

  const reviewer = await getReviewer(reviewerSlug);
  if (!reviewer) {
    return Response.json({ error: "Reviewer not found" }, { status: 404 });
  }

  const systemPrompt = `You are ${reviewer.name}. You are reviewing someone's writing and giving feedback exactly the way you would in real life.

Here is your personality and review style:

${reviewer.content}

Review the writing below. Return a JSON array of feedback items. Each item has:
- "quote": the exact passage you're commenting on (copy it verbatim from the text)
- "comment": your feedback on that passage, written in your voice

Return ONLY the JSON array, no other text. Example format:
[{"quote": "exact text from their writing", "comment": "your feedback here"}]`;

  const startTime = Date.now();
  const model = "z-ai/glm-4.7:nitro";

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        provider: { order: ["Cerebras", "DeepInfra", "Nebius"] },
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    return Response.json(
      { error: `OpenRouter error: ${errorText}` },
      { status: response.status }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = "";
      let usage: Record<string, unknown> = {};
      let responseModel = model;
      let firstTokenTime: number | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.model) responseModel = parsed.model;
            if (parsed.usage) usage = parsed.usage;
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              if (!firstTokenTime) firstTokenTime = Date.now();
              controller.enqueue(encoder.encode(content));
            }
          } catch {
            // skip malformed chunks
          }
        }
      }

      const latencyMs = Date.now() - startTime;
      const ttftMs = firstTokenTime ? firstTokenTime - startTime : null;
      const completionTokens = (usage.completion_tokens as number) ?? 0;
      const reasoningTokens = ((usage.completion_tokens_details as Record<string, unknown>)?.reasoning_tokens as number) ?? 0;
      const outputTokens = completionTokens - reasoningTokens;
      const cost = (usage.cost as number) ?? null;
      const tps = latencyMs > 0 && completionTokens > 0 ? (completionTokens / latencyMs) * 1000 : null;

      const stats = JSON.stringify({
        model: responseModel,
        input_tokens: (usage.prompt_tokens as number) ?? null,
        output_tokens: outputTokens || null,
        reasoning_tokens: reasoningTokens || null,
        latency_ms: latencyMs,
        ttft_ms: ttftMs,
        tokens_per_second: tps ? Math.round(tps * 10) / 10 : null,
        cost,
      });

      controller.enqueue(encoder.encode(`\n__STATS__${stats}`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
