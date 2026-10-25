import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  COMMAND_EXAMPLES,
  findCommandExample,
  randomExampleIndex,
} from "../src/domain/commandExamples.js";
import { DEFAULT_CHARACTER } from "../src/domain/character.js";
import { ExampleCommandInterpreter } from "../src/adapters/ExampleCommandInterpreter.js";
import { CharacterService } from "../src/application/CharacterService.js";
import { CharacterStore } from "../server/store.js";
import { createStudioServer } from "../server/http.js";

test("all 41 serialized examples work over HTTP without invoking a model; save, undo, stale revision and unknown text", async () => {
  const dir = mkdtempSync(join(tmpdir(), "studio-examples-"));
  const path = join(dir, "character.json");
  let modelCalls = 0;
  const service = new CharacterService(
    new CharacterStore(path),
    new ExampleCommandInterpreter({
      interpret() {
        modelCalls++;
        throw new Error("no model installed");
      },
    }),
  );
  const server = createStudioServer(service, resolve("dist"));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const send = (text: string, revision: number) =>
    fetch(`${base}/api/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, revision }),
    });
  try {
    assert.ok(COMMAND_EXAMPLES.length >= 30);
    for (const example of COMMAND_EXAMPLES) {
      service.action("reset", service.read().revision);
      const before = service.read();
      const response = await send(example.text, before.revision);
      assert.equal(response.status, 200, example.id);
      const after = await response.json();
      assert.equal(after.audit.provider, "preset");
      assert.equal(after.audit.exampleId, example.id);
      assert.deepEqual(
        new CharacterStore(path).snapshot().document,
        after.document,
      );
      if (after.revision !== before.revision) {
        assert.equal(after.revision, before.revision + 1);
        service.action("undo", after.revision);
        assert.deepEqual(service.read().document, before.document);
      }
    }
    assert.equal(modelCalls, 0);
    const before = service.read();
    const combined = await (
      await send(COMMAND_EXAMPLES[0].text, before.revision)
    ).json();
    assert.deepEqual(
      combined.document.parts.map((part: { kind: string }) => part.kind),
      ["shirt", "wings"],
    );
    assert.equal(combined.document.expression, "happy");
    assert.equal(combined.document.bodyColor, DEFAULT_CHARACTER.bodyColor);
    const stale = await send(COMMAND_EXAMPLES[1].text, before.revision);
    assert.equal(stale.status, 409);
    assert.deepEqual(service.read().document, combined.document);
    const badOrigin = await fetch(`${base}/api/command`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://untrusted.example",
      },
      body: JSON.stringify({
        text: COMMAND_EXAMPLES[1].text,
        revision: combined.revision,
      }),
    });
    assert.equal(badOrigin.status, 403);
    const unknown = await send(
      COMMAND_EXAMPLES[0].text + " 하지 마",
      combined.revision,
    );
    assert.equal(unknown.status, 400);
    assert.equal(modelCalls, 1);
    assert.deepEqual(service.read().document, combined.document);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("random suggestions can reach every other example without repeating the current one", () => {
  const count = COMMAND_EXAMPLES.length;
  assert.equal(
    randomExampleIndex(-1, () => 0),
    0,
  );
  assert.equal(
    randomExampleIndex(-1, () => 0.999999),
    count - 1,
  );
  for (let previous = 0; previous < count; previous++) {
    const visited = new Set<number>();
    for (let bucket = 0; bucket < count - 1; bucket++) {
      const next = randomExampleIndex(
        previous,
        () => (bucket + 0.5) / (count - 1),
      );
      assert.notEqual(next, previous);
      assert.ok(next >= 0 && next < count);
      visited.add(next);
    }
    assert.equal(visited.size, count - 1);
  }
});

test("exact text matching tolerates whitespace only", () => {
  const example = COMMAND_EXAMPLES[0];
  assert.equal(
    findCommandExample(`  ${example.text.replaceAll(" ", "  ")}  `)?.id,
    example.id,
  );
  assert.equal(findCommandExample(example.text + " 말고"), undefined);
});
