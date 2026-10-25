import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BrowserCharacterLibrary,
  LIBRARY_STORAGE_KEY,
} from "../src/adapters/BrowserCharacterLibrary.js";
import { BrowserStudioGateway } from "../src/adapters/BrowserStudioGateway.js";
import {
  DEFAULT_CHARACTER,
  CharacterImportSchema,
} from "../src/domain/character.js";
import {
  characterBytes,
  characterJson,
  LIBRARY_LIMIT,
} from "../src/application/characterLibrary.js";

function environment() {
  const values = new Map<string, string>();
  const events = new EventTarget();
  let queue = Promise.resolve<unknown>(undefined);
  const host = {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    },
    navigator: {
      locks: {
        request: (_key: string, callback: () => unknown) => {
          const task = queue.then(callback);
          queue = task.catch(() => {});
          return task;
        },
      },
    },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  } as unknown as Window;
  return { host, values, events };
}

test("library saves independent characters, reopens, updates only the selected copy and exports a portable document", async () => {
  const { host, values } = environment();
  const library = new BrowserCharacterLibrary(host);
  const doc = structuredClone(DEFAULT_CHARACTER);
  const first = await library.save(doc, "처음 모습");
  doc.expression = "happy";
  const second = await library.save(doc, "웃는 모습");
  assert.equal(
    (await library.list()).find((e) => e.id === first.id)!.document.expression,
    "gentle",
  );
  const reopened = new BrowserCharacterLibrary(host);
  assert.equal((await reopened.list()).length, 2);
  const updated = await reopened.save(
    { ...doc, bodyColor: "#aabbcc" },
    "파란 웃음",
    second,
  );
  assert.equal(updated.id, second.id);
  assert.equal(updated.revision, 2);
  assert.equal(
    (await reopened.list()).find((e) => e.id === first.id)!.name,
    "처음 모습",
  );
  const json = characterJson(updated.document);
  assert.deepEqual(
    CharacterImportSchema.parse(JSON.parse(json)),
    updated.document,
  );
  assert.equal(characterBytes(updated.document), Buffer.byteLength(json));
  assert.ok(!values.get(LIBRARY_STORAGE_KEY)!.includes("data:image"));
  await assert.rejects(
    library.save({ ...doc, apiKey: "must-not-store" } as typeof doc, "invalid"),
  );
  assert.ok(!values.get(LIBRARY_STORAGE_KEY)!.includes("must-not-store"));
});

test("loading a library document uses normal revision and undo history; deleting it does not delete current work", async () => {
  const { host } = environment();
  const library = new BrowserCharacterLibrary(host);
  const gateway = new BrowserStudioGateway(host);
  const entry = await library.save(
    { ...DEFAULT_CHARACTER, name: "내 캐릭터", expression: "happy" },
    "내 캐릭터",
  );
  const before = await gateway.read();
  const { schemaVersion, ...patch } = entry.document;
  const loaded = await gateway.patch(patch, before.revision);
  assert.deepEqual(loaded.document, entry.document);
  assert.deepEqual(
    (await gateway.action("undo", loaded.revision)).document,
    before.document,
  );
  const restored = await gateway.action(
    "redo",
    (await gateway.read()).revision,
  );
  await library.remove(entry.id, entry.revision);
  assert.equal((await library.list()).length, 0);
  assert.deepEqual((await gateway.read()).document, restored.document);
});

test("library rejects stale update and delete across tabs and serializes simultaneous creates", async () => {
  const { host, events } = environment();
  const a = new BrowserCharacterLibrary(host),
    b = new BrowserCharacterLibrary(host);
  await Promise.all([
    a.save(DEFAULT_CHARACTER, "A"),
    b.save(DEFAULT_CHARACTER, "B"),
  ]);
  assert.equal((await a.list()).length, 2);
  const entry = (await a.list())[0];
  await b.save(entry.document, "changed", entry);
  await assert.rejects(a.save(entry.document, "stale", entry), /다른 탭/);
  await assert.rejects(a.remove(entry.id, entry.revision), /변경/);
  let notices = 0;
  const stop = a.subscribe(() => notices++);
  events.dispatchEvent(
    Object.assign(new Event("storage"), { key: LIBRARY_STORAGE_KEY }),
  );
  stop();
  events.dispatchEvent(
    Object.assign(new Event("storage"), { key: LIBRARY_STORAGE_KEY }),
  );
  assert.equal(notices, 1);
});

test("corruption, quota and permissions preserve saved data; capacity never evicts earlier characters", async () => {
  const { host, values } = environment();
  const library = new BrowserCharacterLibrary(host);
  values.set(LIBRARY_STORAGE_KEY, "broken");
  await assert.rejects(library.list(), /보존/);
  await assert.rejects(library.save(DEFAULT_CHARACTER, "new"), /보존/);
  assert.equal(values.get(LIBRARY_STORAGE_KEY), "broken");
  values.delete(LIBRARY_STORAGE_KEY);
  const entry = await library.save(DEFAULT_CHARACTER, "keep");
  const prior = values.get(LIBRARY_STORAGE_KEY);
  const setter = host.localStorage.setItem;
  host.localStorage.setItem = () => {
    throw new Error("quota");
  };
  await assert.rejects(
    library.save(DEFAULT_CHARACTER, "failed", entry),
    /기존 보관함은 유지/,
  );
  await assert.rejects(
    library.remove(entry.id, entry.revision),
    /기존 보관함은 유지/,
  );
  assert.equal(values.get(LIBRARY_STORAGE_KEY), prior);
  host.localStorage.setItem = setter;
  for (let i = 1; i < LIBRARY_LIMIT; i++)
    await library.save(DEFAULT_CHARACTER, `copy ${i}`);
  await assert.rejects(
    library.save(DEFAULT_CHARACTER, "overflow"),
    /최대 50개/,
  );
  assert.equal((await library.list()).length, LIBRARY_LIMIT);
  assert.ok((await library.list()).some((e) => e.id === entry.id));
  const blocked = new BrowserCharacterLibrary({
    ...host,
    get localStorage(): Storage {
      throw new Error("blocked");
    },
  });
  await assert.rejects(blocked.list(), /저장 권한/);
});

test("legacy saved documents migrate without changing the stored original during read", async () => {
  const { host, values } = environment();
  const library = new BrowserCharacterLibrary(host);
  const entry = await library.save(DEFAULT_CHARACTER, "legacy");
  const { base, ...v2 } = entry.document;
  const raw = JSON.stringify({
    version: 1,
    entries: [{ ...entry, document: { ...v2, schemaVersion: 2 } }],
  });
  values.set(LIBRARY_STORAGE_KEY, raw);
  assert.equal((await library.list())[0].document.schemaVersion, 3);
  assert.equal(values.get(LIBRARY_STORAGE_KEY), raw);
});
