import { readdir, readFile } from "fs/promises";
import path from "path";

export type Reviewer = {
  slug: string;
  name: string;
  description: string;
  avatar: string;
};

export type ReviewerWithContent = Reviewer & {
  content: string;
};

const REVIEWERS_DIR = path.join(process.cwd(), "reviewers");

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

export async function listReviewers(): Promise<Reviewer[]> {
  const files = await readdir(REVIEWERS_DIR);
  const reviewers: Reviewer[] = [];

  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const raw = await readFile(path.join(REVIEWERS_DIR, file), "utf-8");
    const { attributes } = parseFrontmatter(raw);
    reviewers.push({
      slug: file.replace(/\.md$/, ""),
      name: attributes.name || file.replace(/\.md$/, ""),
      description: attributes.description || "",
      avatar: attributes.avatar || attributes.name?.slice(0, 2).toUpperCase() || "??",
    });
  }

  return reviewers;
}

export async function getReviewer(
  slug: string
): Promise<ReviewerWithContent | null> {
  const filePath = path.resolve(REVIEWERS_DIR, `${slug}.md`);
  const reviewersRoot = `${REVIEWERS_DIR}${path.sep}`;

  if (!filePath.startsWith(reviewersRoot)) {
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
