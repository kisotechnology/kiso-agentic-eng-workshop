import { getAssistant } from "@/lib/assistants";

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY || "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";

  const { text, assistant: assistantSlug, pdf } = await request.json();

  if ((!text && !pdf) || !assistantSlug) {
    return Response.json(
      { error: "Missing text or assistant" },
      { status: 400 }
    );
  }

  const assistant = await getAssistant(assistantSlug);
  if (!assistant) {
    return Response.json({ error: "Assistant not found" }, { status: 404 });
  }

  const systemPrompt = `You are ${assistant.name}. You process incoming information and transform it for your supported role.

Here is your role and response style:

${assistant.content}

Process the input below according to your role. Respond naturally in plain text — do NOT return JSON.`;

  // Build user message content — either plain text or a document content block for PDFs
  type ContentPart =
    | { type: "text"; text: string }
    | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

  let userContent: string | ContentPart[];
  if (pdf) {
    const parts: ContentPart[] = [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: pdf.data,
        },
      },
    ];
    if (text) {
      parts.push({ type: "text", text });
    } else {
      parts.push({ type: "text", text: `Process this PDF document (${pdf.name}) according to your role.` });
    }
    userContent = parts;
  } else {
    userContent = text;
  }

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
        provider: { order: ["Cerebras", "DeepInfra", "Nebius"] },
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
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
