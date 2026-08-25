import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, relative } from "node:path";

export async function validateCreatedContentPath(libraryRoot: string, folderPath: string): Promise<void> {
  const root = await realpath(libraryRoot);
  const info = await lstat(folderPath);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("created content path is not a real directory");
  const folder = await realpath(folderPath);
  const inside = relative(root, folder);
  if (inside === "" || inside === ".." || inside.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(inside)) {
    throw new Error("created content path escaped the library root");
  }
}
