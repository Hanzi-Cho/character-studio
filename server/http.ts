import type { ChatGptConnection } from "./ChatGptConnection.js";
import { ReferenceImagesSchema } from "../src/domain/referenceImages.js";
import { createServer, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { ConflictError } from "../src/domain/errors.js";
import { PatchSchema } from "../src/domain/character.js";
import type { CharacterApplication } from "../src/application/ports.js";
import { EditPlanSchema } from "../src/domain/editPlan.js";

const requestSchema = z
  .object({
    text: z.string().min(1).max(1000),
    images: ReferenceImagesSchema.optional(),
    revision: z.number().int().min(0),
  })
  .strict();
const patchRequestSchema = z
  .object({ patch: PatchSchema, revision: z.number().int().min(0) })
  .strict();
export function createStudioServer(
  service: CharacterApplication,
  staticDirectory: string,
  capabilities = { chatMode: "local", model: "" },
  ai?: ChatGptConnection,
) {
  const clients = new Set<ServerResponse>();
  const unsubscribe = service.subscribe((snapshot) => {
    for (const client of clients) {
      if (!client.destroyed)
        client.write(`data: ${JSON.stringify(snapshot)}\n\n`);
    }
  });
  const server = createServer(async (req, res) => {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const validHosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    const json = (status: number, data: unknown) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(data));
    };
    if (!validHosts.includes(req.headers.host ?? ""))
      return json(403, { error: "허용되지 않은 호스트입니다." });
    const callbackUrl = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    if (
      req.method === "GET" &&
      callbackUrl.pathname === "/auth/callback" &&
      ai
    ) {
      try {
        await ai.callback(callbackUrl.searchParams);
        res.writeHead(303, {
          Location: "/",
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        });
        res.end();
      } catch (error) {
        json(400, {
          error:
            error instanceof Error ? error.message : "로그인에 실패했어요.",
        });
      }
      return;
    }
    if (
      callbackUrl.pathname.startsWith("/api/") &&
      req.headers.origin &&
      !validHosts.some((h) => req.headers.origin === `http://${h}`)
    )
      return json(403, { error: "다른 웹사이트의 접근을 허용하지 않습니다." });
    if (
      callbackUrl.pathname.startsWith("/api/") &&
      req.headers["sec-fetch-site"] === "cross-site"
    )
      return json(403, { error: "다른 웹사이트의 접근을 허용하지 않습니다." });
    const pathname = new URL(req.url ?? "/", `http://127.0.0.1:${port}`)
      .pathname;
    if (req.method === "GET" && pathname === "/api/state")
      return json(200, service.read());
    if (req.method === "GET" && pathname === "/api/capabilities")
      return json(
        200,
        ai
          ? {
              ...capabilities,
              ...(await ai
                .status()
                .then((s) =>
                  s.mode === "none" ? {} : { chatMode: s.mode, model: s.model },
                )),
            }
          : capabilities,
      );
    if (ai && pathname.startsWith("/api/ai/")) {
      if (req.method === "GET" && pathname === "/api/ai/status")
        return json(200, await ai.status());
      if (
        req.method !== "POST" ||
        !req.headers["content-type"]?.startsWith("application/json")
      )
        return json(405, { error: "JSON POST 요청이 필요합니다." });
      try {
        let body = "";
        for await (const chunk of req) {
          body += chunk.toString();
          if (Buffer.byteLength(body) > 4096)
            return json(413, { error: "요청이 너무 큽니다." });
        }
        const data = JSON.parse(body);
        if (pathname === "/api/ai/key")
          return json(
            200,
            await ai.connectKey(
              z
                .object({ key: z.string().max(512) })
                .strict()
                .parse(data).key,
            ),
          );
        if (pathname === "/api/ai/model")
          return json(
            200,
            await ai.selectModel(
              z
                .object({ model: z.string().max(100) })
                .strict()
                .parse(data).model,
            ),
          );
        if (pathname === "/api/ai/disconnect")
          return json(200, await ai.disconnect());
        if (pathname === "/api/ai/sign-in")
          return json(200, {
            url: await ai.signIn(
              z.object({ clientId: z.string().optional() }).strict().parse(data)
                .clientId,
              port,
            ),
          });
        return json(404, { error: "연결 기능을 찾지 못했어요." });
      } catch (error) {
        return json(400, {
          error:
            error instanceof z.ZodError
              ? "연결 입력을 확인해 주세요."
              : error instanceof Error && error.message.length < 200
                ? error.message
                : "AI 연결을 완료하지 못했어요.",
        });
      }
    }
    if (req.method === "GET" && pathname === "/api/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store",
        Connection: "keep-alive",
      });
      res.write(`data: ${JSON.stringify(service.read())}\n\n`);
      clients.add(res);
      const heartbeat = setInterval(() => res.write(": keepalive\n\n"), 20000);
      req.on("close", () => {
        clients.delete(res);
        clearInterval(heartbeat);
      });
      return;
    }
    if (
      req.method === "POST" &&
      ["/api/command", "/api/patch", "/api/action", "/api/plan"].includes(
        pathname,
      )
    ) {
      if (!req.headers["content-type"]?.startsWith("application/json"))
        return json(415, { error: "JSON 요청이 필요합니다." });
      try {
        let body = "";
        for await (const chunk of req) {
          body += chunk.toString();
          if (
            Buffer.byteLength(body) >
            (pathname === "/api/command" ? 5_700_000 : 131072)
          ) {
            json(413, { error: "요청이 너무 큽니다." });
            return;
          }
        }
        const input = JSON.parse(body);
        let message = "새로운 모습을 적용했어요.";
        let snapshot;
        if (pathname === "/api/command") {
          const data = requestSchema.parse(input);
          snapshot = await service.command(
            data.text,
            data.revision,
            data.images,
          );
          message = snapshot.message;
        } else if (pathname === "/api/plan") {
          const data = z
            .object({ plan: EditPlanSchema, revision: z.number().int().min(0) })
            .strict()
            .parse(input);
          snapshot = service.applyPlan(data.plan, data.revision);
          message = snapshot.message;
        } else if (pathname === "/api/action") {
          const data = z
            .object({
              action: z.enum(["undo", "redo", "reset"]),
              revision: z.number().int().min(0),
            })
            .strict()
            .parse(input);
          snapshot = service.action(data.action, data.revision);
          message = snapshot.message;
        } else {
          const data = patchRequestSchema.parse(input);
          snapshot = service.patch(data.patch, data.revision);
        }
        return json(200, { ...snapshot, message });
      } catch (error) {
        return json(error instanceof ConflictError ? 409 : 400, {
          error:
            error instanceof z.ZodError
              ? "변경 값이나 문서 형식이 올바르지 않습니다."
              : error instanceof Error
                ? error.message
                : "요청을 처리하지 못했습니다.",
        });
      }
    }
    if (req.method === "GET") {
      const file = (
        {
          "/": "index.html",
          "/index.html": "index.html",
          "/app.js": "app.js",
          "/app.js.map": "app.js.map",
          "/app.css": "app.css",
          "/app.css.map": "app.css.map",
        } as Record<string, string>
      )[pathname];
      if (file) {
        try {
          const bytes = readFileSync(join(staticDirectory, file));
          res.writeHead(200, {
            "Content-Type": file.endsWith(".html")
              ? "text/html; charset=utf-8"
              : file.endsWith(".css")
                ? "text/css"
                : "text/javascript",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy":
              "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'self'",
            "Cache-Control": "no-cache",
          });
          res.end(bytes);
          return;
        } catch {
          return json(503, { error: "먼저 pnpm build를 실행해 주세요." });
        }
      }
    }
    json(404, { error: "찾을 수 없습니다." });
  });
  server.on("close", () => {
    unsubscribe();
    for (const client of clients) client.end();
  });
  return server;
}
