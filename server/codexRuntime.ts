import { existsSync } from "node:fs";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";

/** Resolve npm's Windows shim without passing prompts or paths through a shell. */
export function resolveCodexLaunch(
  executable = process.env.CHARACTER_CODEX_PATH ?? "codex",
  options: { platform?: NodeJS.Platform; path?: string } = {},
): { command: string; args: string[] } {
  const platform = options.platform ?? process.platform;
  let target = executable;
  if (platform === "win32" && !isAbsolute(target) && !/[\\/]/.test(target)) {
    const names = /\.(exe|cmd|ps1)$/i.test(target)
      ? [target]
      : [`${target}.exe`, `${target}.cmd`, `${target}.ps1`];
    const dirs = (options.path ?? process.env.PATH ?? "")
      .split(delimiter)
      .map((dir) => dir.replace(/^"|"$/g, ""))
      .filter(Boolean);
    target =
      dirs
        .flatMap((dir) => names.map((name) => join(dir, name)))
        .find((candidate) => existsSync(candidate)) ?? target;
  }
  if (/\.(cmd|ps1)$/i.test(target)) {
    const entry = join(
      dirname(resolve(target)),
      "node_modules/@openai/codex/bin/codex.js",
    );
    if (!existsSync(entry)) {
      throw new Error(
        "Codex npm 실행 파일을 찾지 못했어요. CLI를 다시 설치하거나 CHARACTER_CODEX_PATH에 codex.exe 절대 경로를 지정해 주세요.",
      );
    }
    return { command: process.execPath, args: [entry] };
  }
  if (/\.(mjs|js)$/i.test(target)) {
    return { command: process.execPath, args: [resolve(target)] };
  }
  return { command: target, args: [] };
}
