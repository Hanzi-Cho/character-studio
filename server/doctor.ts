import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveCodexLaunch } from "./codexRuntime.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
function check(ok: boolean, message: string) {
  console.log(`${ok ? "PASS" : "FAIL"} ${message}`);
  if (!ok) failures++;
}
check(
  Number(process.versions.node.split(".")[0]) >= 24,
  `Node.js ${process.versions.node} (24 이상 필요)`,
);
check(
  existsSync(resolve(root, "dist/index.html")) &&
    existsSync(resolve(root, "dist/app.js")),
  "화면 빌드 — 없으면 pnpm build 실행",
);
if (process.env.CHARACTER_CHAT_MODE === "local") {
  console.log("INFO 로컬 규칙 모드: AI 채팅 점검은 생략했습니다.");
} else {
  try {
    const launch = resolveCodexLaunch();
    const run = (args: string[]) =>
      spawnSync(launch.command, [...launch.args, ...args], {
        encoding: "utf8",
        windowsHide: true,
        shell: false,
        timeout: 15000,
      });
    const version = run(["--version"]);
    check(
      version.status === 0,
      `Codex CLI 실행 ${version.stdout?.trim() || "실패 — CLI 설치와 CHARACTER_CODEX_PATH 확인"}`,
    );
    const help = run(["exec", "--help"]);
    check(
      help.status === 0 &&
        ["--ignore-user-config", "--ephemeral", "--output-schema"].every(
          (flag) => help.stdout.includes(flag),
        ),
      "구조화 편집에 필요한 CLI 옵션 — 실패하면 CLI 업데이트",
    );
    const auth = run(["login", "status"]);
    check(
      auth.status === 0 &&
        /Logged in using ChatGPT/i.test(auth.stdout + auth.stderr),
      "ChatGPT 로그인 — 실패하면 codex login 실행 (API 키 로그인은 사용하지 않음)",
    );
    console.log(
      `INFO 편집 모델: ${process.env.CHARACTER_CODEX_MODEL ?? "gpt-6.1-sol"}`,
    );
    console.log(
      "INFO 모델 요청은 보내지 않았습니다. 모델 접근 권한과 잔여 한도는 앱에서 첫 채팅으로 확인하세요.",
    );
  } catch (error) {
    check(
      false,
      error instanceof Error ? error.message : "Codex 실행 경로 확인 필요",
    );
  }
}
process.exitCode = failures ? 1 : 0;
