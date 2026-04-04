import { readdir, readFile } from "fs/promises";
import { join } from "path";

const REVIEWERS_DIR = join(process.cwd(), "reviewers");

export async function GET() {
  const files = await readdir(REVIEWERS_DIR);
  const mdFiles = files.filter((f) => f.endsWith(".md"));

  const reviewers = await Promise.all(
    mdFiles.map(async (file) => {
      const content = await readFile(join(REVIEWERS_DIR, file), "utf-8");
      const firstLine = content.split("\n").find((line) => line.startsWith("# "));
      const name = firstLine ? firstLine.replace("# ", "").trim() : file.replace(".md", "");
      const slug = file.replace(".md", "");
      return { slug, name };
    })
  );

  return Response.json(reviewers);
}
