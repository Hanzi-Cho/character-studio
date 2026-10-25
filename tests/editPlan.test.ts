import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compilePlan } from "../src/domain/editPlan.js";
import {
  DEFAULT_CHARACTER,
  applyPatch,
  CharacterImportSchema,
} from "../src/domain/character.js";
import { CharacterStore } from "../server/store.js";
import { CharacterService } from "../src/application/CharacterService.js";
import { LocalCommandInterpreter } from "../src/adapters/LocalCommandInterpreter.js";
import { ChiikawaModel } from "../src/adapters/ChiikawaModel.js";
import { PartSchema } from "../src/domain/parts.js";
const part = PartSchema.parse({
  id: "wings",
  label: "작은 날개",
  kind: "wings",
  anchor: "back",
  color: "#ffffff",
  accentColor: "#dfeafa",
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [0.7, 0.7, 0.7],
  components: [],
});
test("several edits commit once, part-only changes preserve body, undo/reset restore durable state", () => {
  const dir = mkdtempSync(join(tmpdir(), "character-plan-"));
  try {
    const path = join(dir, "state.json"),
      service = new CharacterService(
        new CharacterStore(path),
        new LocalCommandInterpreter(),
      );
    const plan = {
      action: "edit" as const,
      message: "날개와 웃음을 더했어요.",
      operations: [
        { op: "set" as const, key: "expression" as const, value: "happy" },
        { op: "upsert_part" as const, part },
      ],
    };
    const first = service.applyPlan(plan, 0);
    assert.equal(first.revision, 1);
    assert.equal(first.document.parts.length, 1);
    assert.equal(first.document.bodyColor, DEFAULT_CHARACTER.bodyColor);
    assert.deepEqual(new CharacterStore(path).snapshot(), service.read());
    const smaller = service.applyPlan(
      {
        action: "edit",
        message: "줄였어요.",
        operations: [
          { op: "upsert_part", part: { ...part, scale: [0.4, 0.4, 0.4] } },
        ],
      },
      1,
    );
    assert.equal(smaller.document.parts.length, 1);
    assert.equal(smaller.document.expression, "happy");
    service.action("undo", 2);
    assert.deepEqual(service.read().document, first.document);
    service.action("reset", 3);
    assert.deepEqual(service.read().document, DEFAULT_CHARACTER);
    service.action("undo", 4);
    assert.deepEqual(service.read().document, first.document);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("invalid last operation, executable shape, duplicate ids and stale requests do not partially write", () => {
  const dir = mkdtempSync(join(tmpdir(), "character-invalid-"));
  try {
    const service = new CharacterService(
      new CharacterStore(join(dir, "state.json")),
      new LocalCommandInterpreter(),
    );
    assert.throws(() =>
      service.applyPlan(
        {
          action: "edit",
          message: "x",
          operations: [
            { op: "set", key: "bodyColor", value: "#abcdef" },
            { op: "set", key: "eyeSize", value: 99 },
          ],
        },
        0,
      ),
    );
    assert.deepEqual(service.read().document, DEFAULT_CHARACTER);
    assert.equal(service.read().revision, 0);
    assert.throws(() =>
      compilePlan(
        { action: "reset", message: "x", operations: [{ op: "clear_parts" }] },
        DEFAULT_CHARACTER,
      ),
    );
    assert.throws(() => applyPatch(DEFAULT_CHARACTER, { parts: [part, part] }));
    assert.throws(() =>
      applyPatch(DEFAULT_CHARACTER, {
        parts: [
          {
            ...part,
            kind: "custom",
            components: [{ shape: "eval", code: "delete" }],
          },
        ],
      }),
    );
    assert.throws(() =>
      service.applyPlan(
        { action: "edit", message: "x", operations: [{ op: "clear_parts" }] },
        99,
      ),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("v1 document and its undo history migrate together and remain reversible", () => {
  const { parts, base, ...legacy } = DEFAULT_CHARACTER;
  const old = { ...legacy, schemaVersion: 1 };
  assert.deepEqual(CharacterImportSchema.parse(old), DEFAULT_CHARACTER);
  const dir = mkdtempSync(join(tmpdir(), "character-migration-"));
  try {
    const path = join(dir, "state.json");
    writeFileSync(
      path,
      JSON.stringify({
        document: { ...old, name: "old" },
        revision: 4,
        updatedAt: new Date().toISOString(),
        past: [old],
        future: [],
      }),
    );
    const store = new CharacterStore(path);
    assert.equal(store.snapshot().document.schemaVersion, 3);
    assert.deepEqual(
      store.execute({ type: "undo", summary: "" }, 4).document,
      DEFAULT_CHARACTER,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("new parts reuse geometry on unrelated edits and dispose when removed", () => {
  const model = new ChiikawaModel();
  try {
    const doc = { ...DEFAULT_CHARACTER, parts: [part] };
    model.update(doc);
    const ids = model.getGeometryIds();
    assert.ok(model.root.getObjectByName("part:wings"));
    model.update({ ...doc, expression: "happy", bodyColor: "#aabbcc" });
    assert.deepEqual(model.getGeometryIds(), ids);
    model.update(DEFAULT_CHARACTER);
    assert.equal(model.root.getObjectByName("part:wings"), undefined);
    assert.ok(model.getGeometryIds().length < ids.length);
  } finally {
    model.dispose();
  }
});
