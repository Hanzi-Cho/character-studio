import { z } from "zod";
import { PartSchema } from "./parts.js";
import {
  applyPatch,
  type CharacterDocument,
  type Command,
} from "./character.js";

export const EditOperationSchema = z.discriminatedUnion("op", [
  z
    .object({
      op: z.literal("set"),
      key: z.enum([
        "name",
        "bodyColor",
        "cheekColor",
        "earColor",
        "bodyWidth",
        "bodyHeight",
        "earSize",
        "eyeSize",
        "expression",
        "accessory",
      ]),
      value: z.union([z.string(), z.number()]),
    })
    .strict(),
  z.object({ op: z.literal("upsert_part"), part: PartSchema }).strict(),
  z
    .object({ op: z.literal("remove_part"), id: z.string().min(1).max(32) })
    .strict(),
  z.object({ op: z.literal("clear_parts") }).strict(),
]);
export const EditPlanSchema = z
  .object({
    action: z.enum(["edit", "undo", "redo", "reset", "clarify"]),
    message: z.string().min(1).max(300),
    operations: z.array(EditOperationSchema).max(24),
  })
  .strict();
export type EditPlan = z.infer<typeof EditPlanSchema>;

/** Validate the whole transaction before the store sees a single write. */
export function compilePlan(
  input: unknown,
  current: CharacterDocument,
): Command {
  const plan = EditPlanSchema.parse(input);
  if (plan.action !== "edit") {
    if (plan.operations.length)
      throw new Error("복구 또는 질문에 편집 작업을 함께 적용할 수 없어요.");
    if (plan.action === "clarify") throw new Error(plan.message);
    return { type: plan.action, summary: plan.message };
  }
  if (!plan.operations.length)
    throw new Error("변경할 내용이 없어요. 원하는 모습을 조금 더 알려주세요.");
  let next = structuredClone(current);
  for (const operation of plan.operations) {
    if (operation.op === "set")
      next = applyPatch(next, { [operation.key]: operation.value });
    else if (operation.op === "upsert_part") {
      const parts = next.parts.filter((p) => p.id !== operation.part.id);
      parts.push(operation.part);
      next = applyPatch(next, { parts });
    } else if (operation.op === "remove_part") {
      if (!next.parts.some((p) => p.id === operation.id))
        throw new Error("지울 장식을 찾지 못했어요.");
      next = applyPatch(next, {
        parts: next.parts.filter((p) => p.id !== operation.id),
      });
    } else next = applyPatch(next, { parts: [] });
  }
  const { schemaVersion, ...patch } = next;
  return { type: "patch", patch, summary: plan.message };
}
