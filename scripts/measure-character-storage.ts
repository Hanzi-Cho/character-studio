import { writeFile, mkdir } from "node:fs/promises";
import { characterBytes } from "../src/application/characterLibrary.js";
import {
  DEFAULT_CHARACTER,
  applyPatch,
  characterFromBase,
} from "../src/domain/character.js";
import { BASE_CATALOG } from "../src/domain/baseProfile.js";
import { COMMAND_EXAMPLES } from "../src/domain/commandExamples.js";
import { compilePlan } from "../src/domain/editPlan.js";

const example = COMMAND_EXAMPLES.find((value) => value.id === "sky-outfit")!;
const command = compilePlan(example.plan, DEFAULT_CHARACTER);
if (command.type !== "patch") throw new Error("Expected outfit edit");
const samples = [
  { name: "치이카와 기본", document: DEFAULT_CHARACTER },
  {
    name: "우사기 기본",
    document: characterFromBase(
      BASE_CATALOG.find((value) => value.id === "usagi")!,
    ),
  },
  {
    name: "하늘색 셔츠·작은 하얀 날개·웃음",
    document: applyPatch(DEFAULT_CHARACTER, command.patch),
  },
].map(({ name, document }) => ({
  name,
  utf8JsonBytes: characterBytes(document),
  partCount: document.parts.length,
}));
await mkdir("docs/evidence/character-library-v1", { recursive: true });
await writeFile(
  "docs/evidence/character-library-v1/storage-sizes.json",
  JSON.stringify(
    {
      measuredOn: "2026-10-25",
      encoding: "UTF-8",
      serialization: "compact JSON",
      scope:
        "Single editable CharacterDocument; excludes library metadata, history, renderer code and browser storage encoding overhead. Not mesh or PNG size.",
      samples,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify(samples));
