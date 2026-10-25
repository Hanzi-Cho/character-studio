import type { CommandInterpreter } from "../application/ports.js";
import type { AiConnection, AiStatus } from "../application/aiConnection.js";
import type { CharacterDocument } from "../domain/character.js";
import {
  ReferenceImagesSchema,
  type ReferenceImage,
} from "../domain/referenceImages.js";
import { compilePlan, EditPlanSchema } from "../domain/editPlan.js";
import {
  EDITOR_INSTRUCTIONS,
  outputSchema,
} from "../application/editorPrompt.js";

const API = "https://api.openai.com/v1";
export function providerError(status: number): Error {
  return new Error(
    status === 401
      ? "AI 인증이 만료되었거나 키가 올바르지 않아요. 다시 연결해 주세요."
      : status === 429
        ? "모델 사용 한도에 도달했어요. 계정 사용량·한도를 확인해 주세요."
        : status === 403
          ? "이 계정에 모델 사용 권한이 없어요. 다른 모델을 선택해 주세요."
          : "AI 요청을 완료하지 못했어요. 모델 지원 기능과 연결을 확인해 주세요. 모습은 보존했어요.",
  );
}
/** SSE is committed only on response.completed; partial output never becomes an edit. */
export async function readResponseStream(response: Response): Promise<string> {
  if (!response.body) throw new Error("AI 응답이 비어 있어요.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "",
    size = 0;
  let streamedText = "",
    finishedText = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4_000_000)
        throw new Error("AI 응답이 너무 커서 적용하지 않았어요.");
      pending += decoder.decode(value, { stream: true }).replace(/\r/g, "");
      let boundary: number;
      while ((boundary = pending.indexOf("\n\n")) >= 0) {
        const block = pending.slice(0, boundary);
        pending = pending.slice(boundary + 2);
        const data = block
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trim())
          .join("\n");
        if (!data || data === "[DONE]") continue;
        const event = JSON.parse(data);
        if (
          event.type === "response.output_text.delta" &&
          typeof event.delta === "string"
        )
          streamedText += event.delta;
        if (
          event.type === "response.output_text.done" &&
          typeof event.text === "string"
        )
          finishedText += event.text;
        if (
          ["response.failed", "response.incomplete", "error"].includes(
            event.type,
          )
        )
          throw new Error("AI가 편집안을 완성하지 못했어요. 다시 보내주세요.");
        if (event.type === "response.completed") {
          if (event.response?.status !== "completed")
            throw new Error("AI 응답이 완성되지 않았어요.");
          const finalText = (event.response.output ?? [])
            .flatMap((item: any) =>
              item.type === "message" ? (item.content ?? []) : [],
            )
            .filter((item: any) => item.type === "output_text")
            .map((item: any) => item.text)
            .join("");
          const text = finalText || finishedText || streamedText;
          if (!text.trim())
            throw new Error(
              "AI가 편집 명령을 반환하지 않았어요. 다른 모델을 선택하거나 다시 보내주세요.",
            );
          return text;
        }
      }
    }
    throw new Error("AI 연결이 중단됐어요. 모습은 바뀌지 않았습니다.");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export class OpenAiInterpreter implements CommandInterpreter, AiConnection {
  private key = "";
  private generation = 0;
  private info: AiStatus = {
    mode: "none",
    model: "",
    models: [],
    canSignIn: false,
  };
  constructor(
    private fallback: CommandInterpreter,
    private fetcher: typeof fetch = (...args) => fetch(...args),
    private fallbackImages = false,
  ) {}
  async status() {
    return structuredClone(this.info);
  }
  async connectKey(key: string) {
    if (!/^sk-[A-Za-z0-9_-]{16,500}$/.test(key.trim()))
      throw new Error("OpenAI API 키 형식을 확인해 주세요.");
    return this.connectToken(key.trim(), "api");
  }
  async connectToken(token: string, mode: "api" | "chatgpt", account?: string) {
    const generation = ++this.generation;
    const response = await this.fetcher(`${API}/models`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw providerError(response.status);
    const data = await response.json();
    const models: AiStatus["models"] =
      mode === "chatgpt"
        ? (data.models ?? [])
            .filter((m: any) => m.visibility === "list")
            .map((m: any) => ({ id: m.slug, label: m.display_name }))
        : (data.data ?? [])
            .filter(
              (m: any) =>
                /^(gpt-|o[134])/.test(m.id) &&
                !/audio|realtime|image|transcribe|tts|search/.test(m.id),
            )
            .map((m: any) => ({ id: m.id, label: m.id }));
    if (!models.length)
      throw new Error("이 계정에서 사용할 모델을 찾지 못했어요.");
    if (generation !== this.generation) throw new Error("연결이 취소되었어요.");
    this.key = token;
    this.info = {
      mode,
      account,
      model: models.find((m) => m.id === "gpt-6.1-sol")?.id ?? models[0].id,
      models,
      canSignIn: false,
    };
    return this.status();
  }
  replaceToken(token: string) {
    this.key = token;
  }
  async selectModel(model: string) {
    if (!this.info.models.some((m) => m.id === model))
      throw new Error("이 계정의 모델 목록에서 선택해 주세요.");
    this.info.model = model;
    this.generation++;
    return this.status();
  }
  async disconnect() {
    this.generation++;
    this.key = "";
    this.info = { mode: "none", model: "", models: [], canSignIn: false };
    return this.status();
  }
  async interpret(
    text: string,
    document: CharacterDocument,
    images: ReferenceImage[] = [],
  ) {
    const references = ReferenceImagesSchema.parse(images);
    if (!this.key) {
      if (references.length && !this.fallbackImages)
        throw new Error(
          "참고 이미지로 초안을 만들려면 먼저 AI를 연결해 주세요.",
        );
      return this.fallback.interpret(text, document, references);
    }
    const generation = this.generation;
    const started = Date.now();
    const response = await this.fetcher(`${API}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.key}`,
      },
      signal: AbortSignal.timeout(150000),
      body: JSON.stringify({
        model: this.info.model,
        instructions: EDITOR_INSTRUCTIONS,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Current character JSON:\n${JSON.stringify(document)}\nUser request JSON:\n${JSON.stringify(text)}`,
              },
              ...references.map((image) => ({
                type: "input_image",
                image_url: image.dataUrl,
                detail: "auto",
              })),
            ],
          },
        ],
        store: false,
        stream: true,
        text: {
          format: {
            type: "json_schema",
            name: "character_edit",
            strict: true,
            schema: outputSchema(),
          },
        },
      }),
    });
    if (!response.ok) throw providerError(response.status);
    const plan = EditPlanSchema.parse(
      JSON.parse(await readResponseStream(response)),
    );
    if (generation !== this.generation)
      throw new Error(
        "AI 연결 또는 모델이 바뀌어 이전 응답을 적용하지 않았어요.",
      );
    return {
      ...compilePlan(plan, document),
      audit: {
        provider: this.info.mode,
        model: this.info.model,
        durationMs: Date.now() - started,
        plan,
      },
    };
  }
}
