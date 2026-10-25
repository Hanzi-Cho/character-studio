import type { CommandInterpreter } from "../application/ports.js";
import type { CharacterDocument } from "../domain/character.js";
import { findCommandExample } from "../domain/commandExamples.js";
import { compilePlan } from "../domain/editPlan.js";

/** Exact catalog matches always stay local, including in Codex mode. */
export class ExampleCommandInterpreter implements CommandInterpreter {
  constructor(private readonly fallback: CommandInterpreter) {}
  interpret(text: string, document: CharacterDocument) {
    const example = findCommandExample(text);
    if (!example) return this.fallback.interpret(text, document);
    return {
      ...compilePlan(example.plan, document),
      summary: `예문 적용 · ${example.plan.message}`,
      audit: { provider: "preset", exampleId: example.id, plan: example.plan },
    };
  }
}
