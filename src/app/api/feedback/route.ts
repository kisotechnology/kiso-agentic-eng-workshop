import { readFile } from "fs/promises";
import { join } from "path";

const REVIEWERS_DIR = join(process.cwd(), "reviewers");

export async function POST(request: Request) {
  const { text, reviewer } = await request.json();

  if (!text || !reviewer) {
    return Response.json({ error: "text and reviewer are required" }, { status: 400 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "OPENROUTER_API_KEY is not configured" }, { status: 500 });
  }

  let brainDoc: string;
  try {
    brainDoc = await readFile(join(REVIEWERS_DIR, `${reviewer}.md`), "utf-8");
  } catch {
    return Response.json({ error: `Reviewer "${reviewer}" not found` }, { status: 404 });
  }

  const systemPrompt = `You are roleplaying as a specific writing reviewer. Here is their profile:

${brainDoc}

Review the following text as this person would. Give specific, actionable feedback in their voice and style. Reference specific parts of the text. Be constructive but honest.`;

  const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4",
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
    }),
  });

  if (!openRouterResponse.ok) {
    const error = await openRouterResponse.text();
    return Response.json({ error: `OpenRouter API error: ${error}` }, { status: 502 });
  }

  const reader = openRouterResponse.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;

          const data = trimmed.slice(6);
          if (data === "[DONE]") {
            controller.close();
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(content));
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
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
