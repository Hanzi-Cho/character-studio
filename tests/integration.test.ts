import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { CharacterStore } from "../server/store.js";
import { createStudioServer } from "../server/http.js";

test("HTTP + real stdio MCP: reads, changes, conflicts, persistence and origin boundary", async () => {
  const dir = mkdtempSync(join(tmpdir(), "softform-http-"));
  const path = join(dir, "character.json");
  const server = createStudioServer(new CharacterStore(path), resolve("dist"));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const port = address.port;
  const base = `http://127.0.0.1:${port}`;
  let client: Client | undefined;
  try {
    const initial = await (await fetch(`${base}/api/state`)).json();
    assert.equal(initial.revision, 0);
    const badOrigin = await fetch(`${base}/api/command`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://untrusted.example",
      },
      body: JSON.stringify({ text: "분홍색으로", revision: 0 }),
    });
    assert.equal(badOrigin.status, 403);
    assert.equal(
      (await fetch(`${base}/api/command`, { method: "POST", body: "{}" }))
        .status,
      415,
    );
    client = new Client({ name: "softform-test-client", version: "1.0.0" });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["--import", "tsx", resolve("server/mcp.ts")],
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(
            (entry): entry is [string, string] => entry[1] !== undefined,
          ),
        ),
        SOFTFORM_PORT: String(port),
      },
      stderr: "pipe",
    });
    await client.connect(transport);
    const tools = await client.listTools();
    assert.equal(tools.tools.length, 3);
    const read = await client.callTool({
      name: "get_character",
      arguments: {},
    });
    assert.equal((read.structuredContent as any).revision, 0);
    const edit = await client.callTool({
      name: "update_character",
      arguments: {
        revision: 0,
        patch: { bodyColor: "#b7dfcf", accessory: "star" },
      },
    });
    assert.equal(edit.isError, undefined);
    assert.equal((edit.structuredContent as any).revision, 1);
    const state = await (await fetch(`${base}/api/state`)).json();
    assert.equal(state.document.bodyColor, "#b7dfcf");
    assert.equal(state.document.accessory, "star");
    const conflict = await client.callTool({
      name: "update_character",
      arguments: { revision: 0, patch: { bodyColor: "#ffffff" } },
    });
    assert.equal(conflict.isError, true);
    const undo = await client.callTool({
      name: "edit_character",
      arguments: { revision: 1, text: "되돌리기" },
    });
    assert.equal((undo.structuredContent as any).revision, 2);
    assert.equal(
      new CharacterStore(path).snapshot().document.accessory,
      "none",
    );
    const unknown = await fetch(`${base}/api/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "날개 달아줘", revision: 2 }),
    });
    assert.equal(unknown.status, 400);
    assert.equal(new CharacterStore(path).snapshot().revision, 2);
  } finally {
    await client?.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(dir, { recursive: true, force: true });
  }
});
