import { CodexCommandInterpreter } from "../server/CodexCommandInterpreter.js";
import { DEFAULT_CHARACTER } from "../src/domain/character.js";
import { resolve } from "node:path";
const interpreter = new CodexCommandInterpreter({
  executable: process.env.CHARACTER_CODEX_PATH ?? "codex",
  model: "gpt-6.1-sol",
  runtimeDirectory: resolve(".data/ai-runtime"),
});
const result = await interpreter.interpret(
  "하늘색 셔츠를 입히고 작은 하얀 날개를 달아줘. 웃는 표정으로 해줘.",
  DEFAULT_CHARACTER,
);
console.log(JSON.stringify(result, null, 2));
