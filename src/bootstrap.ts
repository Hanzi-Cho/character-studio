import { OpenAiInterpreter } from "./adapters/OpenAiInterpreter.js";
import { BrowserCharacterLibrary } from "./adapters/BrowserCharacterLibrary.js";
import { LocalCommandInterpreter } from "./adapters/LocalCommandInterpreter.js";
import { HttpAiConnection } from "./adapters/HttpAiConnection.js";
import { ChiikawaModel } from "./adapters/ChiikawaModel.js";
import { ThreeCharacterRenderer } from "./adapters/ThreeCharacterRenderer.js";
import { HttpStudioGateway } from "./adapters/HttpStudioGateway.js";
import { BrowserStudioGateway } from "./adapters/BrowserStudioGateway.js";
import { ChatDock } from "./components/ChatDock.js";
import type { StudioRuntime } from "./presentation/ports.js";

/** The only browser composition root choosing concrete transport, model and chat UI. */
export function createStudioRuntime(): StudioRuntime {
  const ai = new OpenAiInterpreter(new LocalCommandInterpreter());
  return {
    library: new BrowserCharacterLibrary(),
    storage: __WEB_DEMO__ ? "browser" : "local",
    ai: __WEB_DEMO__ ? ai : new HttpAiConnection(),
    gateway: __WEB_DEMO__
      ? new BrowserStudioGateway(window, ai, async () =>
          (await ai.status()).mode === "api" ? "api" : "browser",
        )
      : new HttpStudioGateway(),
    createRenderer: (host, onError) => {
      const model = new ChiikawaModel();
      try {
        return new ThreeCharacterRenderer(host, onError, model);
      } catch (error) {
        model.dispose();
        throw error;
      }
    },
    ChatPanel: ChatDock,
  };
}
