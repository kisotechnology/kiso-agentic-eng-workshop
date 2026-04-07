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

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-opus-4-6",
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
      let buffer = "";

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
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              controller.enqueue(new TextEncoder().encode(content));
            }
          } catch {
            // skip malformed chunks
          }
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
