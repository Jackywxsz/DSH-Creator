import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

function safeName(value: string): string {
  const normalized = value.normalize("NFKC").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").replace(/\.{2,}/g, ".").trim();
  return normalized.slice(0, 100) || "untitled";
}

export async function writeKnowledgeMarkdown(
  dataDir: string,
  kind: "reviews" | "rules" | "templates",
  id: string,
  title: string,
  body: string,
): Promise<string> {
  const directory = join(dataDir, "knowledge", kind);
  await mkdir(directory, { recursive: true });
  const path = join(directory, `${safeName(title)}-${safeName(id)}.md`);
  const text = `# ${title.trim()}\n\n${body.trim()}\n`;
  try {
    await writeFile(path, text, { encoding: "utf8", flag: "wx", mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    if (await readFile(path, "utf8") !== text) {
      throw new Error(`knowledge file already exists with different content: ${path}`);
    }
  }
  return path;
}
