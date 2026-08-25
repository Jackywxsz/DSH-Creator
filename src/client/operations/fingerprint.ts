export async function evaluationFingerprint(topicNote: string, script: string, rubricVersion: string): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify({ topicNote, script, rubricVersion }));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
