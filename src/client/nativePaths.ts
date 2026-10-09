import type { ClientRemote } from "@deepseek-ai/dsh-api-remotes/client";

/** Use the official Host opener for both files and directories. */
export async function openNativePath(
  session: Pick<ClientRemote["session"], "openWorkspacePath">,
  path: string,
): Promise<void> {
  const result = await session.openWorkspacePath({ path });
  if (!result.ok) throw new Error(result.error.message);
}
