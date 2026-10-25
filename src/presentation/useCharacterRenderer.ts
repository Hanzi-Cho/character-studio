import { useEffect, useRef, useState } from "react";
import type { CharacterRenderer } from "../application/ports.js";
import type { CharacterDocument } from "../domain/character.js";
import type { StudioRuntime } from "./ports.js";

declare global {
  interface Window {
    softformDiagnostics?: () => Record<string, unknown>;
  }
}
export function useCharacterRenderer(
  createRenderer: StudioRuntime["createRenderer"],
  document?: CharacterDocument,
) {
  const stage = useRef<HTMLDivElement>(null);
  const renderer = useRef<CharacterRenderer | undefined>(undefined);
  const [renderError, setRenderError] = useState("");
  useEffect(() => {
    if (!stage.current) return;
    setRenderError("");
    try {
      renderer.current = createRenderer(stage.current, setRenderError);
      window.softformDiagnostics = () => renderer.current?.getMetrics() ?? {};
    } catch {
      setRenderError(
        "이 브라우저에서 3D 화면을 시작하지 못했어요. WebGL을 지원하는 최신 Chrome 또는 Edge에서 열어 주세요.",
      );
    }
    return () => {
      renderer.current?.dispose();
      renderer.current = undefined;
      delete window.softformDiagnostics;
    };
  }, [createRenderer]);
  useEffect(() => {
    if (document) renderer.current?.update(document);
  }, [document, createRenderer]);
  return { stage, renderer, renderError };
}
