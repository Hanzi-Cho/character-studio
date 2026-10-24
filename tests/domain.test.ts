import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyPatch, DEFAULT_CHARACTER } from "../src/domain/character.js";
import { LocalCommandInterpreter } from "../src/adapters/LocalCommandInterpreter.js";
import { CharacterStore, ConflictError } from "../server/store.js";
const interpreter = new LocalCommandInterpreter();

test("six expression commands preserve every customized non-expression field", () => {
  const custom = {
    ...DEFAULT_CHARACTER,
    name: "모찌",
    bodyColor: "#b7dfcf",
    earSize: 1.3,
    bodyWidth: 1.1,
    accessory: "star" as const,
  };
  for (const [text, expression] of [
    ["기본 표정", "gentle"],
    ["웃는 표정으로", "happy"],
    ["슬픈 표정으로 바꿔줘", "sad"],
    ["화난 표정으로", "angry"],
    ["놀란 표정으로", "surprised"],
    ["졸린 표정으로", "sleepy"],
    ["화남 표정", "angry"],
    ["sad", "sad"],
  ]) {
    const command = interpreter.interpret(text, custom);
    assert.equal(command.type, "patch");
    if (command.type === "patch") {
      assert.deepEqual(command.patch, { expression });
      assert.deepEqual(applyPatch(custom, command.patch), {
        ...custom,
        expression,
      });
    }
  }
  assert.throws(() => interpreter.interpret("슬픈 표정으로 하지마", custom));
  assert.throws(() =>
    interpreter.interpret("화난 표정으로, 졸린 표정으로", custom),
  );
});
test("domain rejects unknown, infinite, invalid and out-of-bound patches", () => {
  for (const patch of [
    { camera: 3 },
    { bodyWidth: Infinity },
    { bodyColor: "red" },
    { earSize: 2 },
    {},
  ])
    assert.throws(() => applyPatch(DEFAULT_CHARACTER, patch));
  assert.equal(
    applyPatch(DEFAULT_CHARACTER, { bodyColor: "#ABCDEF" }).bodyColor,
    "#abcdef",
  );
});
test("multiple Korean clauses become one validated edit", () => {
  const command = interpreter.interpret(
    "몸을 민트색으로, 귀를 크게, 리본 달아줘",
    DEFAULT_CHARACTER,
  );
  assert.equal(command.type, "patch");
  if (command.type === "patch")
    assert.deepEqual(command.patch, {
      bodyColor: "#b7dfcf",
      earSize: 1.15,
      accessory: "bow",
    });
});
test("unsupported or contradictory clauses never partially succeed", () => {
  for (const text of [
    "분홍색으로, 날개 달아줘",
    "귀를 크게 작게",
    "파란색과 분홍색으로",
    "날개 달아줘",
  ])
    assert.throws(() => interpreter.interpret(text, DEFAULT_CHARACTER));
});
test("rename, expression and limits", () => {
  assert.deepEqual(interpreter.interpret("이름을 모찌로", DEFAULT_CHARACTER), {
    type: "patch",
    patch: { name: "모찌" },
    summary: "새로운 모습을 적용했어요.",
  });
  assert.throws(() =>
    interpreter.interpret("귀를 크게", { ...DEFAULT_CHARACTER, earSize: 1.8 }),
  );
});
test("negation and unknown trailing intent do not produce partial edits", () => {
  for (const text of [
    "분홍색으로 하지마",
    "웃지 마",
    "분홍색으로 날개 달아줘",
    "귀를 크게, 귀를 작게",
    "리본 말고 별 달아줘",
  ])
    assert.throws(() => interpreter.interpret(text, DEFAULT_CHARACTER));
  for (const text of [
    "귀를 조금 크게",
    "몸을 통통하게",
    "웃는 표정으로",
    "기본 표정",
    "별 달아줘",
    "장식 제거",
    "볼을 분홍색으로",
  ])
    assert.equal(interpreter.interpret(text, DEFAULT_CHARACTER).type, "patch");
});
test("durable revision, conflict, undo and redo share one store", () => {
  const dir = mkdtempSync(join(tmpdir(), "softform-test-"));
  try {
    const path = join(dir, "character.json");
    const store = new CharacterStore(path);
    const a = store.execute(
      interpreter.interpret("분홍색으로", DEFAULT_CHARACTER),
      0,
    );
    assert.equal(a.revision, 1);
    assert.throws(
      () => store.execute({ type: "reset", summary: "" }, 0),
      ConflictError,
    );
    assert.equal(store.snapshot().revision, 1);
    const reloaded = new CharacterStore(path);
    assert.equal(reloaded.snapshot().document.bodyColor, "#f4b5c5");
    assert.equal(
      reloaded.execute({ type: "undo", summary: "" }, 1).document.bodyColor,
      DEFAULT_CHARACTER.bodyColor,
    );
    assert.equal(
      reloaded.execute({ type: "redo", summary: "" }, 2).document.bodyColor,
      "#f4b5c5",
    );
    assert.equal(JSON.parse(readFileSync(`${path}.bak`, "utf8")).revision, 2);
    assert.equal(
      reloaded.execute({ type: "reset", summary: "" }, 3).canUndo,
      true,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("corrupted saved state fails closed without erasing the file", () => {
  const dir = mkdtempSync(join(tmpdir(), "softform-corrupt-"));
  try {
    const path = join(dir, "character.json");
    writeFileSync(path, "broken");
    assert.throws(() => new CharacterStore(path));
    assert.equal(readFileSync(path, "utf8"), "broken");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
