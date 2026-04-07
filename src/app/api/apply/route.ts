export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Set OPENROUTER_API_KEY in .env.local" },
      { status: 500 }
    );
  }

  const { text, quote, comment } = await request.json();

  if (!text || !quote || !comment) {
    return Response.json(
      { error: "Missing text, quote, or comment" },
      { status: 400 }
    );
  }

  const systemPrompt = `You are a writing assistant. You will receive a piece of text and a specific editing suggestion.

The suggestion references this passage: "${quote}"
The feedback is: "${comment}"

Rewrite the FULL text, incorporating the suggestion into the relevant section.
Rules:
- Only modify the section related to the quoted passage and suggestion
- Preserve all other content exactly as-is
- Do not add commentary — return only the rewritten text
- Maintain the original formatting, tone, and style`;

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
