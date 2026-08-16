export interface ParsedPublishCopy {
  title?: string;
  body: string;
  tags: string[];
}

export function parsePublishCopy(raw: string): ParsedPublishCopy {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (text === "") return { body: "", tags: [] };

  const tags: string[] = [];
  const kept: string[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    const marks = trimmed.match(/#[^\s#]+/g);
    if (marks !== null && trimmed.replace(/#[^\s#]+/g, "").trim() === "") {
      for (const mark of marks) tags.push(mark.slice(1));
      continue;
    }
    kept.push(line);
  }

  const body = kept.join("\n").trim();
  const blocks = body.split(/\n{2,}/);
  const first = blocks[0];
  if (
    first !== undefined
    && blocks.length > 1
    && first.length <= 48
    && !first.includes("\n")
  ) {
    return { title: first, body: blocks.slice(1).join("\n\n").trim(), tags };
  }
  return { body, tags };
}
