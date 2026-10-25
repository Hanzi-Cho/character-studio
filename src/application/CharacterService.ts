import type { ReferenceImage } from "../domain/referenceImages.js";
import type {
  CharacterApplication,
  CharacterRepository,
  CommandInterpreter,
} from "./ports.js";
import {
  PatchSchema,
  type CharacterPatch,
  type Command,
  type Snapshot,
} from "../domain/character.js";
import { ConflictError } from "../domain/errors.js";
import { compilePlan, type EditPlan } from "../domain/editPlan.js";

/** All mutation channels use the same revision check and committed-state event. */
export class CharacterService implements CharacterApplication {
  private readonly listeners = new Set<(snapshot: Snapshot) => void>();
  constructor(
    private readonly repository: CharacterRepository,
    private readonly interpreter: CommandInterpreter,
  ) {}
  read() {
    return this.repository.snapshot();
  }
  subscribe(listener: (snapshot: Snapshot) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private execute(command: Command, revision: number) {
    const result = this.repository.execute(command, revision);
    if (result.revision !== revision)
      for (const listener of this.listeners) {
        // A disconnected view must not turn a committed edit into an apparent failure.
        try {
          listener(structuredClone(result));
        } catch {
          /* transport owns recovery */
        }
      }
    return result;
  }
  patch(patch: CharacterPatch, revision: number) {
    return this.execute(
      {
        type: "patch",
        patch: PatchSchema.parse(patch),
        summary: "새로운 모습을 적용했어요.",
      },
      revision,
    );
  }
  async command(text: string, revision: number, images: ReferenceImage[] = []) {
    const baseline = this.read();
    if (baseline.revision !== revision) throw new ConflictError();
    const command = await this.interpreter.interpret(
      text,
      baseline.document,
      images,
    );
    // The repository checks again after async interpretation; never silently rebase.
    const audit = "audit" in command ? command.audit : undefined;
    return {
      ...this.execute(command, revision),
      message: command.summary,
      audit,
    };
  }
  applyPlan(plan: EditPlan, revision: number) {
    const baseline = this.read();
    if (baseline.revision !== revision) throw new ConflictError();
    const command = compilePlan(plan, baseline.document);
    return { ...this.execute(command, revision), message: command.summary };
  }
  action(action: "undo" | "redo" | "reset", revision: number) {
    const summary = {
      undo: "이전 모습으로 되돌렸어요.",
      redo: "변경을 다시 적용했어요.",
      reset: "처음 모습으로 돌아왔어요.",
    }[action];
    return {
      ...this.execute({ type: action, summary }, revision),
      message: summary,
    };
  }
}
