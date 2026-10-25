import { z } from "zod";
import data from "./command-examples.json" with { type: "json" };
import { EditPlanSchema } from "./editPlan.js";

const ExampleSchema = z
  .object({
    id: z.string().min(1),
    category: z.string().min(1),
    text: z.string().min(1).max(1000),
    plan: EditPlanSchema,
  })
  .strict();
export const COMMAND_EXAMPLES = z.array(ExampleSchema).min(30).parse(data);
export const normalizeExampleText = (text: string) =>
  text.normalize("NFC").trim().replace(/\s+/g, " ");
const byText = new Map(
  COMMAND_EXAMPLES.map((item) => [normalizeExampleText(item.text), item]),
);
if (
  byText.size !== COMMAND_EXAMPLES.length ||
  new Set(COMMAND_EXAMPLES.map((item) => item.id)).size !==
    COMMAND_EXAMPLES.length
)
  throw new Error("예문 ID와 텍스트는 중복될 수 없습니다.");
export const findCommandExample = (text: string) =>
  byText.get(normalizeExampleText(text));

/** Uniform random suggestion, excluding the currently visible example. */
export function randomExampleIndex(
  previous = -1,
  random = Math.random,
): number {
  const count = COMMAND_EXAMPLES.length;
  const exclude = previous >= 0 && previous < count;
  const candidate = Math.floor(random() * (count - (exclude ? 1 : 0)));
  return exclude && candidate >= previous ? candidate + 1 : candidate;
}
