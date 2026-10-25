import type { ReferenceImage } from "../domain/referenceImages.js";
import type {
  CharacterRepository,
  CommandInterpreter,
  StudioGateway,
} from "../application/ports.js";
import { CharacterService } from "../application/CharacterService.js";
import type { CharacterPatch, Command, Snapshot } from "../domain/character.js";
import {
  advanceHistory,
  HistorySchema,
  historySnapshot,
  initialHistory,
} from "../domain/characterHistory.js";
import { ExampleCommandInterpreter } from "./ExampleCommandInterpreter.js";
import { LocalCommandInterpreter } from "./LocalCommandInterpreter.js";

export const BROWSER_STORAGE_KEY = "character-studio:web-demo:v1";
type StoragePort = Pick<Storage, "getItem" | "setItem">;
export class BrowserCharacterRepository implements CharacterRepository {
  private readonly initial = initialHistory();
  constructor(private readonly storage: () => StoragePort) {}
  private load() {
    let raw: string | null;
    try {
      raw = this.storage().getItem(BROWSER_STORAGE_KEY);
    } catch {
      throw new Error(
        "브라우저 저장 공간에 접근할 수 없어요. 사이트 저장 권한을 확인해 주세요.",
      );
    }
    if (raw === null) return this.initial;
    try {
      return HistorySchema.parse(JSON.parse(raw));
    } catch {
      throw new Error(
        "저장된 캐릭터를 읽지 못했어요. 기존 데이터는 보존했어요. 다른 브라우저에서 체험하거나 백업 JSON을 확인해 주세요.",
      );
    }
  }
  snapshot() {
    return historySnapshot(this.load());
  }
  execute(command: Command, revision: number) {
    const current = this.load();
    const next = advanceHistory(current, command, revision);
    if (next !== current) {
      try {
        this.storage().setItem(BROWSER_STORAGE_KEY, JSON.stringify(next));
      } catch {
        throw new Error(
          "브라우저에 저장하지 못해 변경을 적용하지 않았어요. 저장 공간과 사이트 권한을 확인해 주세요.",
        );
      }
    }
    return historySnapshot(next);
  }
}

/** Entirely in-browser demo: never requests a backend, AI endpoint or credentials. */
export class BrowserStudioGateway implements StudioGateway {
  private readonly service: CharacterService;
  constructor(
    private readonly host: Window = window,
    interpreter: CommandInterpreter = new LocalCommandInterpreter(),
    private mode: () => Promise<string> = async () => "browser",
  ) {
    this.service = new CharacterService(
      new BrowserCharacterRepository(() => host.localStorage),
      new ExampleCommandInterpreter(interpreter),
    );
  }
  async capabilities() {
    return { chatMode: await this.mode(), model: "" };
  }
  async read() {
    return this.service.read();
  }
  private async mutate<T>(operation: () => T | Promise<T>): Promise<T> {
    // Serialize writers across same-origin tabs. Read/revision checks still reject stale edits.
    if (!this.host.navigator.locks)
      throw new Error(
        "이 브라우저에서는 안전한 저장을 지원하지 않아요. 최신 Chrome, Edge, Safari 또는 Firefox로 열어 주세요.",
      );
    return this.host.navigator.locks.request(BROWSER_STORAGE_KEY, operation);
  }
  async patch(patch: CharacterPatch, revision: number) {
    return this.mutate(() => this.service.patch(patch, revision));
  }
  async command(text: string, revision: number, images: ReferenceImage[] = []) {
    return this.mutate(() => this.service.command(text, revision, images));
  }
  async action(action: "undo" | "redo" | "reset", revision: number) {
    return this.mutate(() => this.service.action(action, revision));
  }
  subscribe(
    listener: (snapshot: Snapshot) => void,
    onConnection: (connected: boolean) => void,
  ) {
    const unsubscribe = this.service.subscribe(listener);
    const sync = () => {
      try {
        listener(this.service.read());
        onConnection(true);
      } catch {
        onConnection(false);
      }
    };
    const changed = (event: StorageEvent) => {
      if (event.key === BROWSER_STORAGE_KEY || event.key === null) sync();
    };
    this.host.addEventListener("storage", changed);
    sync();
    return () => {
      unsubscribe();
      this.host.removeEventListener("storage", changed);
    };
  }
}
