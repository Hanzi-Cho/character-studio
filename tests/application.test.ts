import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CharacterService } from "../src/application/CharacterService.js";
import { CharacterStore } from "../server/store.js";
import { ConflictError } from "../src/domain/errors.js";
import { DEFAULT_CHARACTER, type Command } from "../src/domain/character.js";
import type { CommandInterpreter } from "../src/application/ports.js";

test("swapped asynchronous interpreter receives current document; concurrent changes never get overwritten", async () => {
  const dir = mkdtempSync(join(tmpdir(), "softform-service-"));
  try {
    let finish!: (command: Command) => void;
    const interpreter: CommandInterpreter = {
      interpret(text, document) {
        assert.equal(text, "provider-specific request");
        assert.equal(document.name, "현재 이름");
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    };
    const service = new CharacterService(
      new CharacterStore(join(dir, "character.json")),
      interpreter,
    );
    service.patch({ name: "현재 이름" }, 0);
    const pending = service.command("provider-specific request", 1);
    service.patch({ bodyColor: "#123456" }, 1);
    finish({ type: "patch", patch: { name: "늦은 응답" }, summary: "done" });
    await assert.rejects(pending, ConflictError);
    assert.equal(service.read().revision, 2);
    assert.equal(service.read().document.name, "현재 이름");
    assert.equal(service.read().document.bodyColor, "#123456");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("typed actions and committed events work independently of the chat provider", () => {
  const dir = mkdtempSync(join(tmpdir(), "softform-actions-"));
  try {
    const service = new CharacterService(
      new CharacterStore(join(dir, "character.json")),
      {
        interpret() {
          throw new Error("provider unavailable");
        },
      },
    );
    const revisions: number[] = [];
    service.subscribe(() => {
      throw new Error("disconnected view");
    });
    const unsubscribe = service.subscribe((value) => {
      revisions.push(value.revision);
      value.document.name = "observer mutation";
    });
    service.patch({ name: "saved" }, 0);
    assert.equal(service.read().document.name, "saved");
    assert.equal(
      service.action("undo", 1).document.name,
      DEFAULT_CHARACTER.name,
    );
    assert.equal(service.action("redo", 2).document.name, "saved");
    assert.deepEqual(service.action("reset", 3).document, DEFAULT_CHARACTER);
    service.action("reset", 4); // no-op: do not emit a second committed event
    assert.deepEqual(revisions, [1, 2, 3, 4]);
    unsubscribe();
    service.patch({ expression: "happy" }, 4);
    assert.deepEqual(revisions, [1, 2, 3, 4]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
