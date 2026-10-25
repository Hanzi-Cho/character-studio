import { randomBytes, randomUUID, createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { OpenAiInterpreter } from "../src/adapters/OpenAiInterpreter.js";
import type { CharacterDocument } from "../src/domain/character.js";
import type { ReferenceImage } from "../src/domain/referenceImages.js";
import type { AiConnection } from "../src/application/aiConnection.js";

const AUTH = "https://auth.openai.com";
const RESOURCE = "https://api.openai.com/v1";
const TOKEN = `${AUTH}/api/accounts/oauth/token`;
type Registration = { clientId: string; subject: string; email: string };
type Session = Registration & {
  access: string;
  refresh: string;
  expires: number;
};
type Attempt = {
  state: string;
  nonce: string;
  verifier: string;
  redirect: string;
  clientId: string;
  subject?: string;
  expires: number;
};
/** Credentials live only in this local process; disk contains host/account registration metadata only. */
export class ChatGptConnection implements AiConnection {
  private hostId: string;
  private registrations: Registration[] = [];
  private pending?: Attempt;
  private session?: Session;
  private refreshing?: Promise<void>;
  private epoch = 0;
  constructor(
    readonly interpreter: OpenAiInterpreter,
    private metadataPath: string,
  ) {
    try {
      const saved = JSON.parse(readFileSync(metadataPath, "utf8"));
      if (
        typeof saved.hostId !== "string" ||
        !Array.isArray(saved.registrations)
      )
        throw new Error();
      this.hostId = saved.hostId;
      this.registrations = saved.registrations;
    } catch (error: any) {
      if (error.code !== "ENOENT")
        throw new Error(
          "AI 연결 등록 파일을 읽지 못했어요. 기존 파일을 보존했어요.",
        );
      this.hostId = `urn:uuid:${randomUUID()}`;
      this.saveMetadata();
    }
  }
  private saveMetadata() {
    mkdirSync(dirname(this.metadataPath), { recursive: true });
    const temp = this.metadataPath + ".tmp";
    writeFileSync(
      temp,
      JSON.stringify({
        hostId: this.hostId,
        registrations: this.registrations,
      }),
      { mode: 0o600 },
    );
    renameSync(temp, this.metadataPath);
  }
  async status() {
    return {
      ...(await this.interpreter.status()),
      canSignIn: true,
      registrations: this.registrations.map((r) => ({
        clientId: r.clientId,
        label: r.email,
      })),
    };
  }
  async connectKey(key: string) {
    this.epoch++;
    this.pending = undefined;
    await this.interpreter.disconnect();
    await this.clearSession();
    await this.interpreter.connectKey(key);
    return this.status();
  }
  async selectModel(model: string) {
    await this.interpreter.selectModel(model);
    return this.status();
  }
  async signIn(clientId?: string, port = 4317) {
    const registration = clientId
      ? this.registrations.find((r) => r.clientId === clientId)
      : undefined;
    if (clientId && !registration)
      throw new Error("저장된 계정 등록을 찾지 못했어요.");
    this.epoch++;
    const random = () => randomBytes(32).toString("base64url");
    this.pending = {
      state: random(),
      nonce: random(),
      verifier: random(),
      redirect: `http://127.0.0.1:${port}/auth/callback`,
      clientId: registration?.clientId ?? "dynamic_agent_client",
      subject: registration?.subject,
      expires: Date.now() + 300000,
    };
    const p = this.pending;
    const params = new URLSearchParams({
      client_id: p.clientId,
      ext_agent_host_id: this.hostId,
      response_type: "code",
      redirect_uri: p.redirect,
      scope:
        "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct",
      resource: RESOURCE,
      state: p.state,
      nonce: p.nonce,
      code_challenge_method: "S256",
      code_challenge: createHash("sha256")
        .update(p.verifier)
        .digest("base64url"),
    });
    if (!registration) params.set("agent_name_hint", "Character Studio");
    return `${AUTH}/api/accounts/authorize?${params}`;
  }
  private async tokenRequest(body: Record<string, string>) {
    const response = await fetch(TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...body, resource: RESOURCE }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok)
      throw new Error(
        "ChatGPT 연결을 완료하지 못했어요. 다시 로그인해 주세요.",
      );
    return response.json();
  }
  async callback(params: URLSearchParams) {
    const p = this.pending;
    if (!p || p.expires < Date.now() || params.get("state") !== p.state)
      throw new Error("로그인 요청이 만료되었거나 일치하지 않아요.");
    this.pending = undefined;
    if (params.has("error"))
      throw new Error("ChatGPT 연결이 취소되었어요. 기존 작업은 유지됩니다.");
    const issued =
      params.get("client_id") ??
      (p.clientId !== "dynamic_agent_client" ? p.clientId : "");
    if (
      !issued ||
      issued === "dynamic_agent_client" ||
      !params.get("code") ||
      (p.clientId !== "dynamic_agent_client" && p.clientId !== issued)
    )
      throw new Error("앱 등록 응답이 올바르지 않아요.");
    const epoch = this.epoch;
    const tokens = await this.tokenRequest({
      grant_type: "authorization_code",
      client_id: issued,
      code: params.get("code")!,
      code_verifier: p.verifier,
      redirect_uri: p.redirect,
    });
    const config = await (
      await fetch(`${AUTH}/.well-known/openid-configuration`, {
        signal: AbortSignal.timeout(15000),
      })
    ).json();
    const jwksUrl = new URL(config.jwks_uri);
    if (jwksUrl.origin !== AUTH)
      throw new Error("인증 서명 주소가 올바르지 않아요.");
    const { payload } = await jwtVerify(
      tokens.id_token,
      createRemoteJWKSet(jwksUrl),
      { issuer: AUTH, audience: issued, algorithms: ["RS256"] },
    );
    if (
      payload.nonce !== p.nonce ||
      !payload.sub ||
      (p.subject && payload.sub !== p.subject)
    )
      throw new Error("선택한 계정과 로그인 결과가 일치하지 않아요.");
    if (!String(tokens.scope).split(" ").includes("chatgpt.tokens.use.direct"))
      throw new Error(
        "ChatGPT 플랜 사용 권한에 동의해야 AI를 연결할 수 있어요.",
      );
    if (epoch !== this.epoch) throw new Error("로그인이 취소되었어요.");
    const registration = {
      clientId: issued,
      subject: payload.sub,
      email: typeof payload.email === "string" ? payload.email : "ChatGPT 계정",
    };
    this.registrations = [
      ...this.registrations.filter((r) => r.clientId !== issued),
      registration,
    ];
    this.saveMetadata();
    await this.interpreter.connectToken(
      tokens.access_token,
      "chatgpt",
      registration.email,
    );
    if (epoch !== this.epoch) {
      await this.interpreter.disconnect();
      throw new Error("로그인이 취소되었어요.");
    }
    this.session = {
      ...registration,
      access: tokens.access_token,
      refresh: tokens.refresh_token,
      expires: Date.now() + tokens.expires_in * 1000,
    };
  }
  private async refresh() {
    const s = this.session;
    if (!s || s.expires > Date.now() + 60000) return;
    if (!this.refreshing)
      this.refreshing = (async () => {
        const epoch = this.epoch;
        const tokens = await this.tokenRequest({
          grant_type: "refresh_token",
          client_id: s.clientId,
          refresh_token: s.refresh,
        });
        if (epoch !== this.epoch) throw new Error("연결이 해제되었어요.");
        if (
          !String(tokens.scope).split(" ").includes("chatgpt.tokens.use.direct")
        )
          throw new Error("모델 사용 권한이 만료되었어요. 다시 연결해 주세요.");
        this.session = {
          ...s,
          access: tokens.access_token,
          refresh: tokens.refresh_token,
          expires: Date.now() + tokens.expires_in * 1000,
        };
        this.interpreter.replaceToken(tokens.access_token);
      })().finally(() => {
        this.refreshing = undefined;
      });
    await this.refreshing;
  }
  async interpret(
    text: string,
    document: CharacterDocument,
    images: ReferenceImage[] = [],
  ) {
    await this.refresh();
    return this.interpreter.interpret(text, document, images);
  }
  private async clearSession() {
    const session = this.session;
    this.session = undefined;
    if (!session?.refresh) return;
    try {
      const config = await (
        await fetch(`${AUTH}/.well-known/openid-configuration`, {
          signal: AbortSignal.timeout(10000),
        })
      ).json();
      if (new URL(config.revocation_endpoint).origin !== AUTH)
        throw new Error();
      const res = await fetch(config.revocation_endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token: session.refresh,
          token_type_hint: "refresh_token",
          client_id: session.clientId,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error();
    } catch {
      throw new Error(
        "기기 연결은 해제했지만 원격 철회는 확인하지 못했어요. ChatGPT 설정에서 앱 연결을 해제해 주세요.",
      );
    }
  }
  async disconnect() {
    this.epoch++;
    this.pending = undefined;
    await this.interpreter.disconnect();
    await this.clearSession();
    return this.status();
  }
}
