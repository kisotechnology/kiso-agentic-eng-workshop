import { readdir, readFile } from "fs/promises";
import path from "path";

export type Assistant = {
  slug: string;
  name: string;
  description: string;
  avatar: string;
};

export type AssistantWithContent = Assistant & {
  content: string;
};

const ASSISTANTS_DIR = path.join(process.cwd(), "assistants");

function parseFrontmatter(raw: string): {
  attributes: Record<string, string>;
  body: string;
} {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { attributes: {}, body: raw };

  const attributes: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      attributes[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return { attributes, body: match[2].trim() };
}

export async function listAssistants(): Promise<Assistant[]> {
  const files = await readdir(ASSISTANTS_DIR);
  const assistants: Assistant[] = [];

  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const raw = await readFile(path.join(ASSISTANTS_DIR, file), "utf-8");
    const { attributes } = parseFrontmatter(raw);
    if (attributes.internal === "true") continue;
    assistants.push({
      slug: file.replace(/\.md$/, ""),
      name: attributes.name || file.replace(/\.md$/, ""),
      description: attributes.description || "",
      avatar: attributes.avatar || attributes.name?.slice(0, 2).toUpperCase() || "??",
    });
  }

  return assistants;
}

export async function getAssistant(
  slug: string
): Promise<AssistantWithContent | null> {
  const filePath = path.resolve(ASSISTANTS_DIR, `${slug}.md`);
  const assistantsRoot = `${ASSISTANTS_DIR}${path.sep}`;

  if (!filePath.startsWith(assistantsRoot)) {
    return null;
  }

  try {
    const raw = await readFile(filePath, "utf-8");
    const { attributes, body } = parseFrontmatter(raw);
    return {
      slug,
      name: attributes.name || slug,
      description: attributes.description || "",
      avatar: attributes.avatar || attributes.name?.slice(0, 2).toUpperCase() || "??",
      content: body,
    };
  } catch {
    return null;
  }
}
