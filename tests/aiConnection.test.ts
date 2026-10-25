import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  OpenAiInterpreter,
  readResponseStream,
} from "../src/adapters/OpenAiInterpreter.js";
import { LocalCommandInterpreter } from "../src/adapters/LocalCommandInterpreter.js";
import { ChatGptConnection } from "../server/ChatGptConnection.js";
import {
  DEFAULT_CHARACTER,
  CharacterImportSchema,
  characterFromBase,
} from "../src/domain/character.js";
import { USAGI_BASE } from "../src/domain/baseProfile.js";
import { compilePlan } from "../src/domain/editPlan.js";
import {
  advanceHistory,
  initialHistory,
  HistorySchema,
} from "../src/domain/characterHistory.js";
import { ReferenceImagesSchema } from "../src/domain/referenceImages.js";
import { ChiikawaModel } from "../src/adapters/ChiikawaModel.js";
import * as THREE from "three";

const plan = {
  action: "edit",
  message: "표정을 바꿨어요.",
  operations: [{ op: "set", key: "expression", value: "happy" }],
};
const done = (value = plan) =>
  new Response(
    `data: ${JSON.stringify({ type: "response.completed", response: { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }] } })}\n\n`,
  );
test("streamed deltas survive a compact completed event without duplicate final text", async () => {
  const stream = [
    { type: "response.output_text.delta", delta: '{"ok":' },
    { type: "response.output_text.delta", delta: "true}" },
    { type: "response.output_text.done", text: '{"ok":true}' },
    {
      type: "response.completed",
      response: { status: "completed", output: [] },
    },
  ]
    .map((event) => `data: ${JSON.stringify(event)}\n\n`)
    .join("");
  assert.equal(await readResponseStream(new Response(stream)), '{"ok":true}');
});
test("API credentials remain private, account catalog selects model, streamed edit validates, disconnect clears", async () => {
  const calls: { url: string; body: any; auth: string }[] = [];
  const fake: typeof fetch = async (input, init) => {
    calls.push({
      url: String(input),
      body: init?.body ? JSON.parse(String(init.body)) : null,
      auth: (init?.headers as any)?.Authorization,
    });
    return String(input).endsWith("/models")
      ? Response.json({ data: [{ id: "gpt-6.1-sol" }] })
      : done();
  };
  const ai = new OpenAiInterpreter(new LocalCommandInterpreter(), fake);
  await ai.connectKey("sk-test-key-never-persisted-1234");
  assert.ok(!JSON.stringify(await ai.status()).includes("sk-"));
  assert.equal(
    (await ai.interpret("활짝 웃어줘", DEFAULT_CHARACTER)).type,
    "patch",
  );
  assert.equal(calls[1].url, "https://api.openai.com/v1/responses");
  assert.equal(calls[1].body.store, false);
  assert.equal(calls[1].body.stream, true);
  assert.equal(calls[1].body.text.format.type, "json_schema");
  await ai.disconnect();
  assert.equal((await ai.status()).mode, "none");
  const count = calls.length;
  await ai.interpret("웃는 표정", DEFAULT_CHARACTER);
  assert.equal(calls.length, count);
});
test("failed/incomplete SSE and invalid final edits never return a command", async () => {
  await assert.rejects(
    () =>
      readResponseStream(
        new Response(
          'data: {"type":"response.output_text.delta","delta":"partial"}\n\n',
        ),
      ),
    /중단/,
  );
  await assert.rejects(
    () =>
      readResponseStream(
        new Response('data: {"type":"response.incomplete"}\n\n'),
      ),
    /완성/,
  );
  const ai = new OpenAiInterpreter(
    new LocalCommandInterpreter(),
    async (url) =>
      String(url).endsWith("/models")
        ? Response.json({ data: [{ id: "gpt-6.1-sol" }] })
        : done({
            ...plan,
            operations: [{ op: "set", key: "expression", value: "unknown" }],
          }),
  );
  await ai.connectKey("sk-test-key-never-persisted-1234");
  await assert.rejects(() => ai.interpret("change", DEFAULT_CHARACTER));
});
test("disconnect during inference invalidates the pending transaction", async () => {
  let finish!: (r: Response) => void;
  const ai = new OpenAiInterpreter(
    new LocalCommandInterpreter(),
    async (url) =>
      String(url).endsWith("/models")
        ? Response.json({ data: [{ id: "gpt-6.1-sol" }] })
        : new Promise((r) => {
            finish = r;
          }),
  );
  await ai.connectKey("sk-test-key-never-persisted-1234");
  const pending = ai.interpret("change", DEFAULT_CHARACTER);
  await ai.disconnect();
  finish(done());
  await assert.rejects(() => pending, /연결 또는 모델/);
});
test("reference limits and disconnected image mode fail explicitly; vision fallback receives images", async () => {
  const img = {
    name: "sample.png",
    dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
  };
  assert.throws(() => ReferenceImagesSchema.parse(Array(5).fill(img)));
  assert.throws(() =>
    ReferenceImagesSchema.parse([
      { ...img, dataUrl: "data:image/svg+xml;base64,AAAA" },
    ]),
  );
  const ai = new OpenAiInterpreter(new LocalCommandInterpreter());
  await assert.rejects(
    () => ai.interpret("초안", DEFAULT_CHARACTER, [img]),
    /먼저 AI/,
  );
  let count = 0;
  const vision = new OpenAiInterpreter(
    {
      interpret: (_t, _d, images) => {
        count = images!.length;
        return { type: "reset", summary: "" };
      },
    },
    fetch,
    true,
  );
  await vision.interpret("초안", DEFAULT_CHARACTER, [img, img]);
  assert.equal(count, 2);
});
test("v2 history migrates, base switching is undoable, reset preserves custom base", () => {
  const { base, ...v3 } = DEFAULT_CHARACTER;
  const old = { ...v3, schemaVersion: 2 };
  assert.deepEqual(CharacterImportSchema.parse(old), DEFAULT_CHARACTER);
  assert.equal(
    HistorySchema.parse({ ...initialHistory(), document: old, past: [old] })
      .past[0].base.id,
    "chiikawa",
  );
  let history = initialHistory();
  const custom = {
    ...USAGI_BASE,
    id: "custom" as const,
    name: "내 토끼",
    bodyColor: "#ccffaa",
  };
  history = advanceHistory(
    history,
    compilePlan(
      {
        action: "edit",
        message: "초안",
        operations: [{ op: "load_base", base: custom }],
      },
      history.document,
    ),
    0,
  );
  history = advanceHistory(
    history,
    { type: "patch", patch: { bodyColor: "#112233" }, summary: "" },
    1,
  );
  history = advanceHistory(history, { type: "reset", summary: "" }, 2);
  assert.deepEqual(history.document, characterFromBase(custom));
  history = advanceHistory(history, { type: "undo", summary: "" }, 3);
  assert.equal(history.document.bodyColor, "#112233");
  assert.throws(() =>
    compilePlan(
      {
        action: "edit",
        message: "",
        operations: [{ op: "clear_parts" }, { op: "load_base", base: custom }],
      },
      DEFAULT_CHARACTER,
    ),
  );
});
test("Usagi has tall close-set ears, six reusable expressions, base-aware accessory anchors", () => {
  const model = new ChiikawaModel();
  try {
    model.update(characterFromBase(USAGI_BASE));
    model.root.updateMatrixWorld(true);
    const left = model.root.getObjectByName("left-ear")!;
    const box = new THREE.Box3().setFromObject(left);
    assert.ok(box.max.y - box.min.y > 1);
    assert.ok(Math.abs(left.position.x) < 0.4);
    assert.equal(left.getObjectByName("inner-ear")!.visible, true);
    const ids = model.getGeometryIds();
    for (const expression of [
      "gentle",
      "happy",
      "sad",
      "angry",
      "surprised",
      "sleepy",
    ] as const)
      model.update({ ...characterFromBase(USAGI_BASE), expression });
    assert.deepEqual(model.getGeometryIds(), ids);
    model.update(DEFAULT_CHARACTER);
    assert.equal(left.getObjectByName("inner-ear")!.visible, false);
  } finally {
    model.dispose();
  }
});
test("OAuth uses loopback, PKCE, fresh state/nonce, stable host and single-use denial; no credentials on disk", async () => {
  const dir = mkdtempSync(join(tmpdir(), "character-oauth-"));
  try {
    const path = join(dir, "registration.json");
    const ai = new ChatGptConnection(
      new OpenAiInterpreter(new LocalCommandInterpreter()),
      path,
    );
    const first = new URL(await ai.signIn(undefined, 4322));
    assert.equal(first.origin, "https://auth.openai.com");
    assert.equal(first.searchParams.get("client_id"), "dynamic_agent_client");
    assert.equal(
      first.searchParams.get("redirect_uri"),
      "http://127.0.0.1:4322/auth/callback",
    );
    assert.equal(first.searchParams.get("code_challenge_method"), "S256");
    assert.ok(!first.searchParams.has("code_verifier"));
    await assert.rejects(
      () => ai.callback(new URLSearchParams({ state: "wrong", code: "x" })),
      /일치/,
    );
    const denied = new URLSearchParams({
      state: first.searchParams.get("state")!,
      error: "access_denied",
    });
    await assert.rejects(() => ai.callback(denied), /취소/);
    await assert.rejects(() => ai.callback(denied), /일치/);
    const second = new URL(await ai.signIn());
    assert.notEqual(
      first.searchParams.get("state"),
      second.searchParams.get("state"),
    );
    assert.equal(
      first.searchParams.get("ext_agent_host_id"),
      second.searchParams.get("ext_agent_host_id"),
    );
    assert.ok(
      !/access_token|refresh_token|code_verifier/.test(
        readFileSync(path, "utf8"),
      ),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
