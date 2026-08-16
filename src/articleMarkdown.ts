export function rewriteArticleImages(markdown: string, origin: string): string {
  const base = origin.replace(/\/$/, "");
  return markdown.replace(
    /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?((?:\s+(?:"[^"]*"|'[^']*'))?)\s*\)/g,
    (all, alt: string, src: string, title: string) => {
      const dest = src.trim();
      if (/^(https?:|data:|file:)/i.test(dest)) return all;
      const rel = dest.replace(/^\.\//, "").replace(/^\/+/, "");
      return `![${alt}](${base}/${rel}${title})`;
    },
  );
}
