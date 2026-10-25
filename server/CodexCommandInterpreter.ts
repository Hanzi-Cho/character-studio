import { spawn } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import type { CommandInterpreter } from "../src/application/ports.js";
import type { CharacterDocument } from "../src/domain/character.js";
import { compilePlan, EditPlanSchema } from "../src/domain/editPlan.js";
import { resolveCodexLaunch } from "./codexRuntime.js";

import {
  EDITOR_INSTRUCTIONS,
  outputSchema,
} from "../src/application/editorPrompt.js";
import {
  ReferenceImagesSchema,
  type ReferenceImage,
} from "../src/domain/referenceImages.js";
export { EDITOR_INSTRUCTIONS } from "../src/application/editorPrompt.js";

export class CodexCommandInterpreter implements CommandInterpreter {
  private inFlight = false;
  constructor(
    private options: {
      executable: string;
      model: string;
      runtimeDirectory: string;
      timeoutMs?: number;
    },
  ) {}
  async interpret(
    text: string,
    document: CharacterDocument,
    images: ReferenceImage[] = [],
  ) {
    if (this.inFlight)
      throw new Error("앞선 AI 편집이 끝난 뒤 다시 보내주세요.");
    this.inFlight = true;
    let dir: string | undefined;
    const started = Date.now();
    try {
      mkdirSync(this.options.runtimeDirectory, { recursive: true });
      dir = mkdtempSync(join(this.options.runtimeDirectory, "edit-"));
      const schemaPath = join(dir, "schema.json"),
        resultPath = join(dir, "result.json");
      const workingDirectory = resolve(dir);
      writeFileSync(schemaPath, JSON.stringify(outputSchema()), "utf8");
      const prompt = `${EDITOR_INSTRUCTIONS}\nCurrent character JSON:\n${JSON.stringify(document)}\nUser request JSON:\n${JSON.stringify(text)}`;
      const imagePaths = ReferenceImagesSchema.parse(images).map(
        (image, index) => {
          const path = join(
            dir!,
            `reference-${index}.${image.dataUrl.startsWith("data:image/png") ? "png" : "jpg"}`,
          );
          writeFileSync(
            path,
            Buffer.from(image.dataUrl.split(",")[1], "base64"),
          );
          return path;
        },
      );
      const launch = resolveCodexLaunch(this.options.executable);
      await new Promise<void>((resolvePromise, reject) => {
        const child = spawn(
          launch.command,
          [
            ...launch.args,
            "exec",
            "--ignore-user-config",
            "--ephemeral",
            "--skip-git-repo-check",
            "--sandbox",
            "read-only",
            "--model",
            this.options.model,
            "-c",
            'approval_policy="never"',
            "-c",
            'forced_login_method="chatgpt"',
            "-c",
            'model_reasoning_effort="low"',
            "-c",
            "project_doc_max_bytes=0",
            "-c",
            "features.shell_tool=false",
            "-c",
            "features.unified_exec=false",
            "-c",
            "features.apps=false",
            "-c",
            "features.multi_agent=false",
            "-c",
            'web_search="disabled"',
            "--output-schema",
            schemaPath,
            "--output-last-message",
            resultPath,
            ...imagePaths.flatMap((path) => ["--image", path]),
            "--color",
            "never",
            "-",
          ],
          {
            cwd: workingDirectory,
            windowsHide: true,
            shell: false,
            stdio: ["pipe", "pipe", "pipe"],
          },
        );
        let diagnostics = "";
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          child.kill();
        }, this.options.timeoutMs ?? 150000);
        child.stdout.on("data", () => {});
        child.stderr.on("data", (b) => {
          diagnostics = (diagnostics + String(b)).slice(-6000);
        });
        child.on("error", () => {
          clearTimeout(timer);
          reject(
            new Error(
              "Codex를 실행하지 못했어요. 설치 경로와 로그인을 확인해 주세요.",
            ),
          );
        });
        child.on("close", (code) => {
          clearTimeout(timer);
          if (timedOut)
            return reject(
              new Error(
                "AI 응답 시간이 초과됐어요. 모습은 바뀌지 않았습니다. 다시 보내주세요.",
              ),
            );
          if (code !== 0) {
            const errors = diagnostics
              .split("\n")
              .filter((line) => /^ERROR:/.test(line))
              .join("\n");
            if (process.env.CHARACTER_AI_DEBUG === "1")
              console.error(
                errors.replace(/Bearer\s+\S+|sk-[A-Za-z0-9_-]+/g, "[redacted]"),
              );
            const reason = /rate.limit|quota|429/i.test(errors)
              ? "Codex 사용 한도에 도달했어요."
              : /authentication|unauthorized|login|401/i.test(errors)
                ? "Codex 로그인을 확인해 주세요."
                : "Codex 응답을 받지 못했어요. 연결을 확인하고 다시 보내주세요.";
            return reject(new Error(reason));
          }
          resolvePromise();
        });
        child.stdin.on("error", () => {});
        child.stdin.end(prompt, "utf8");
      });
      const plan = EditPlanSchema.parse(
        JSON.parse(readFileSync(resultPath, "utf8")),
      );
      const command = compilePlan(plan, document);
      return {
        ...command,
        audit: {
          provider: "codex",
          model: this.options.model,
          durationMs: Date.now() - started,
          plan,
        },
      };
    } finally {
      this.inFlight = false;
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  }
}
