import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BrowserCharacterRepository,
  BrowserStudioGateway,
  BROWSER_STORAGE_KEY,
} from "../src/adapters/BrowserStudioGateway.js";
import { CharacterService } from "../src/application/CharacterService.js";
import { ExampleCommandInterpreter } from "../src/adapters/ExampleCommandInterpreter.js";
import { LocalCommandInterpreter } from "../src/adapters/LocalCommandInterpreter.js";
import { COMMAND_EXAMPLES } from "../src/domain/commandExamples.js";
import { DEFAULT_CHARACTER } from "../src/domain/character.js";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
test("browser persistence applies all examples, survives reopen, undo/redo and reset; rejects stale writes", async () => {
  const memory = storage();
  const repository = new BrowserCharacterRepository(() => memory);
  const service = new CharacterService(
    repository,
    new ExampleCommandInterpreter(new LocalCommandInterpreter()),
  );
  for (const example of COMMAND_EXAMPLES) {
    service.action("reset", service.read().revision);
    const before = service.read();
    const after = await service.command(example.text, before.revision);
    assert.deepEqual(
      new BrowserCharacterRepository(() => memory).snapshot().document,
      after.document,
    );
    if (after.revision !== before.revision) {
      const undo = service.action("undo", after.revision);
      assert.deepEqual(undo.document, before.document);
      const redo = service.action("redo", undo.revision);
      assert.deepEqual(redo.document, after.document);
    }
  }
  const stale = service.read();
  const changed = service.patch({ name: "브라우저 캐릭터" }, stale.revision);
  const otherTab = new BrowserCharacterRepository(() => memory);
  assert.throws(
    () => otherTab.execute({ type: "reset", summary: "reset" }, stale.revision),
    /다른 곳|변경|최신/,
  );
  assert.deepEqual(otherTab.snapshot().document, changed.document);
  const beforeUnknown = service.read();
  await assert.rejects(
    service.command("아무 모양의 용을 생성해줘", beforeUnknown.revision),
  );
  assert.deepEqual(service.read(), beforeUnknown);
  service.action("reset", service.read().revision);
  assert.deepEqual(service.read().document, DEFAULT_CHARACTER);
});

test("corrupt or unavailable browser storage is never silently overwritten; failed writes preserve state", () => {
  const memory = storage();
  memory.setItem(BROWSER_STORAGE_KEY, "damaged");
  const damaged = new BrowserCharacterRepository(() => memory);
  assert.throws(() => damaged.snapshot(), /기존 데이터는 보존/);
  assert.throws(() => damaged.execute({ type: "reset", summary: "reset" }, 0));
  assert.equal(memory.getItem(BROWSER_STORAGE_KEY), "damaged");
  const unavailable = new BrowserCharacterRepository(() => {
    throw new Error("blocked");
  });
  assert.throws(() => unavailable.snapshot(), /저장 공간/);
  const full = new BrowserCharacterRepository(() => ({
    getItem: () => null,
    setItem: () => {
      throw new Error("quota");
    },
  }));
  const before = full.snapshot();
  assert.throws(
    () =>
      full.execute(
        { type: "patch", patch: { name: "new" }, summary: "edit" },
        0,
      ),
    /변경을 적용하지/,
  );
  assert.deepEqual(full.snapshot(), before);
});

test("browser gateway locks edits, reports local mode, emits changes and handles storage events without network", async () => {
  const events = new EventTarget();
  let lockCalls = 0;
  const host = {
    localStorage: storage(),
    navigator: {
      locks: {
        request: async (_name: string, action: () => unknown) => {
          lockCalls++;
          return action();
        },
      },
    },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  } as unknown as Window;
  const gateway = new BrowserStudioGateway(host);
  assert.equal((await gateway.capabilities()).chatMode, "browser");
  let revisions: number[] = [];
  const unsubscribe = gateway.subscribe(
    (value) => revisions.push(value.revision),
    (connected) => assert.equal(connected, true),
  );
  const after = await gateway.command(COMMAND_EXAMPLES[0].text, 0);
  assert.equal(lockCalls, 1);
  assert.equal(revisions.at(-1), after.revision);
  const reopened = new BrowserStudioGateway(host);
  assert.deepEqual((await reopened.read()).document, after.document);
  const changed = await reopened.patch({ name: "다른 탭" }, after.revision);
  events.dispatchEvent(
    Object.assign(new Event("storage"), { key: BROWSER_STORAGE_KEY }),
  );
  assert.equal(revisions.at(-1), changed.revision);
  unsubscribe();
  revisions = [];
  await gateway.action("reset", changed.revision);
  assert.deepEqual(revisions, []);
});
