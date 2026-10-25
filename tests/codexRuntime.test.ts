import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveCodexLaunch } from "../server/codexRuntime.js";

test("Windows npm Codex shims launch through Node with literal arguments and spaced paths", () => {
  const dir = mkdtempSync(join(tmpdir(), "studio npm space & "));
  try {
    const entry = join(dir, "node_modules/@openai/codex/bin/codex.js");
    mkdirSync(join(dir, "node_modules/@openai/codex/bin"), { recursive: true });
    writeFileSync(entry, "console.log(JSON.stringify(process.argv.slice(2)))");
    const literal = 'a & echo never | $(never) "한글"';
    for (const ext of ["cmd", "ps1"]) {
      const shim = join(dir, `codex.${ext}`);
      writeFileSync(shim, "must not execute this shell shim");
      const launch = resolveCodexLaunch(shim, { platform: "win32" });
      const child = spawnSync(launch.command, [...launch.args, literal], {
        encoding: "utf8",
        shell: false,
      });
      assert.equal(child.status, 0, child.stderr);
      assert.deepEqual(JSON.parse(child.stdout), [literal]);
    }
    assert.deepEqual(
      resolveCodexLaunch("codex", { platform: "win32", path: dir }),
      { command: process.execPath, args: [entry] },
    );
    assert.deepEqual(resolveCodexLaunch(entry), {
      command: process.execPath,
      args: [entry],
    });
    const binary = join(dir, "codex.exe");
    writeFileSync(binary, "fixture");
    assert.deepEqual(
      resolveCodexLaunch("codex", { platform: "win32", path: dir }),
      { command: binary, args: [] },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("missing npm entry fails explicitly instead of falling back to a shell", () => {
  const dir = mkdtempSync(join(tmpdir(), "studio-empty-"));
  try {
    assert.throws(
      () => resolveCodexLaunch(join(dir, "codex.cmd")),
      /Codex npm/,
    );
    assert.deepEqual(
      resolveCodexLaunch("codex", { platform: "linux", path: dir }),
      { command: "codex", args: [] },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
