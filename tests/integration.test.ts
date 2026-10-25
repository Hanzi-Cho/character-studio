import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { CharacterService } from "../src/application/CharacterService.js";
import { LocalCommandInterpreter } from "../src/adapters/LocalCommandInterpreter.js";
import { CharacterStore } from "../server/store.js";
import { createStudioServer } from "../server/http.js";
import { EXPRESSIONS } from "../src/domain/character.js";

test("HTTP + real stdio MCP: reads, changes, conflicts, persistence and origin boundary", async () => {
  const dir = mkdtempSync(join(tmpdir(), "softform-http-"));
  const path = join(dir, "character.json");
  const service = new CharacterService(
    new CharacterStore(path),
    new LocalCommandInterpreter(),
  );
  const server = createStudioServer(service, resolve("dist"));
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
    assert.equal(tools.tools.length, 5);
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
    // The same expression-only operation is used by the picker and MCP.
    let saved = await (
      await fetch(`${base}/api/patch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision: 2,
          patch: {
            bodyColor: "#b7dfcf",
            bodyWidth: 1.2,
            accessory: "bow",
            name: "모찌",
          },
        }),
      })
    ).json();
    const custom = saved.document;
    for (const expression of EXPRESSIONS) {
      const result = await client.callTool({
        name: "update_character",
        arguments: { revision: saved.revision, patch: { expression } },
      });
      assert.equal(result.isError, undefined);
      saved = result.structuredContent;
      assert.deepEqual(saved.document, { ...custom, expression });
      assert.deepEqual(
        new CharacterStore(path).snapshot().document,
        saved.document,
      );
    }
    const restored = await client.callTool({
      name: "edit_character",
      arguments: { revision: saved.revision, text: "되돌리기" },
    });
    assert.deepEqual((restored.structuredContent as any).document, {
      ...custom,
      expression: "surprised",
    });
    const reset = await fetch(`${base}/api/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reset",
        revision: (restored.structuredContent as any).revision,
      }),
    });
    assert.equal(reset.status, 200);
    assert.equal((await reset.json()).document.accessory, "none");
    const beforePlan = service.read();
    const part = {
      id: "demo-shirt",
      label: "하늘색 셔츠",
      kind: "shirt",
      anchor: "body",
      color: "#87ceeb",
      accentColor: "#ffffff",
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      components: [],
    };
    const plan = {
      action: "edit",
      message: "셔츠와 웃는 표정을 적용했어요.",
      operations: [
        { op: "upsert_part", part },
        { op: "set", key: "expression", value: "happy" },
      ],
    };
    const multi = await client.callTool({
      name: "apply_edit_plan",
      arguments: { revision: beforePlan.revision, plan },
    });
    assert.equal(multi.isError, undefined);
    const afterPlan = multi.structuredContent as any;
    assert.equal(afterPlan.revision, beforePlan.revision + 1);
    assert.equal(afterPlan.document.parts[0].id, "demo-shirt");
    assert.equal(afterPlan.document.expression, "happy");
    assert.deepEqual(
      new CharacterStore(path).snapshot().document,
      afterPlan.document,
    );
    const stalePlan = await client.callTool({
      name: "apply_edit_plan",
      arguments: { revision: beforePlan.revision, plan },
    });
    assert.equal(stalePlan.isError, true);
    const invalidPlan = await client.callTool({
      name: "apply_edit_plan",
      arguments: {
        revision: afterPlan.revision,
        plan: {
          ...plan,
          operations: [
            ...plan.operations,
            { op: "set", key: "bodyWidth", value: 50 },
          ],
        },
      },
    });
    assert.equal(invalidPlan.isError, true);
    assert.deepEqual(service.read().document, afterPlan.document);
    assert.equal(service.read().revision, afterPlan.revision);
    const undoPlan = await client.callTool({
      name: "apply_edit_plan",
      arguments: {
        revision: afterPlan.revision,
        plan: { action: "undo", message: "되돌렸어요.", operations: [] },
      },
    });
    assert.deepEqual(
      (undoPlan.structuredContent as any).document,
      beforePlan.document,
    );
    const abort = new AbortController();
    const stream = await fetch(`${base}/api/events`, { signal: abort.signal });
    const reader = stream.body!.getReader();
    await reader.read(); // initial snapshot
    const baseline = service.read();
    service.patch({ name: "direct application edit" }, baseline.revision);
    const event = await reader.read();
    assert.match(
      new TextDecoder().decode(event.value),
      /direct application edit/,
    );
    abort.abort();
    await reader.cancel().catch(() => {});
  } finally {
    await client?.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(dir, { recursive: true, force: true });
  }
});
