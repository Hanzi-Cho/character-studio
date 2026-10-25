import {
  LIBRARY_LIMIT,
  LibrarySchema,
  LibraryEntrySchema,
  type CharacterLibrary,
  type LibraryEntry,
} from "../application/characterLibrary.js";
import {
  CharacterImportSchema,
  type CharacterDocument,
} from "../domain/character.js";

export const LIBRARY_STORAGE_KEY = "character-studio:library:v1";
type Host = Pick<
  Window,
  "localStorage" | "navigator" | "addEventListener" | "removeEventListener"
>;

/** Separate from working-document autosave. Writes re-read under a cross-tab lock. */
export class BrowserCharacterLibrary implements CharacterLibrary {
  constructor(private readonly host: Host = window) {}
  private read() {
    let raw: string | null;
    try {
      raw = this.host.localStorage.getItem(LIBRARY_STORAGE_KEY);
    } catch {
      throw new Error(
        "보관함에 접근하지 못했어요. 브라우저의 사이트 저장 권한을 확인해 주세요.",
      );
    }
    if (raw === null) return LibrarySchema.parse({ version: 1, entries: [] });
    try {
      return LibrarySchema.parse(JSON.parse(raw));
    } catch {
      throw new Error(
        "보관함을 읽지 못했어요. 기존 데이터는 보존했어요. 현재 모습은 JSON으로 내려받아 보관하세요.",
      );
    }
  }
  async list() {
    return this.read().entries.sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }
  private async write<T>(change: (entries: LibraryEntry[]) => T): Promise<T> {
    if (!this.host.navigator.locks)
      throw new Error(
        "이 브라우저에서는 안전한 보관함 저장을 지원하지 않아요. 최신 브라우저를 사용해 주세요.",
      );
    return this.host.navigator.locks.request(LIBRARY_STORAGE_KEY, () => {
      const data = this.read();
      const result = change(data.entries);
      const next = LibrarySchema.parse(data);
      try {
        this.host.localStorage.setItem(
          LIBRARY_STORAGE_KEY,
          JSON.stringify(next),
        );
      } catch {
        throw new Error(
          "저장 공간이 부족하거나 저장이 차단됐어요. 기존 보관함은 유지했어요. JSON으로 내려받아 주세요.",
        );
      }
      return result;
    });
  }
  async save(
    document: CharacterDocument,
    name: string,
    previous?: Pick<LibraryEntry, "id" | "revision">,
  ) {
    // Validate before waiting for the lock; the caller's document is captured now.
    const captured = CharacterImportSchema.parse(document);
    return this.write((entries) => {
      const index = previous
        ? entries.findIndex((entry) => entry.id === previous.id)
        : -1;
      if (
        previous &&
        (index < 0 || entries[index].revision !== previous.revision)
      )
        throw new Error(
          "다른 탭에서 이 캐릭터가 바뀌었어요. 최신 보관본을 다시 불러온 뒤 저장해 주세요.",
        );
      if (!previous && entries.length >= LIBRARY_LIMIT)
        throw new Error(
          `보관함은 최대 ${LIBRARY_LIMIT}개예요. JSON으로 백업한 뒤 필요 없는 보관본을 삭제해 주세요.`,
        );
      const entry = LibraryEntrySchema.parse({
        id: previous?.id ?? crypto.randomUUID(),
        name,
        revision: (previous?.revision ?? 0) + 1,
        updatedAt: new Date().toISOString(),
        document: captured,
      });
      if (previous) entries[index] = entry;
      else entries.push(entry);
      return entry;
    });
  }
  async remove(id: string, revision: number) {
    await this.write((entries) => {
      const index = entries.findIndex((entry) => entry.id === id);
      if (index < 0 || entries[index].revision !== revision)
        throw new Error(
          "보관본이 변경되었어요. 목록을 확인하고 다시 삭제해 주세요.",
        );
      entries.splice(index, 1);
    });
  }
  subscribe(listener: () => void) {
    const changed = (event: StorageEvent) => {
      if (event.key === LIBRARY_STORAGE_KEY || event.key === null) listener();
    };
    this.host.addEventListener("storage", changed);
    return () => this.host.removeEventListener("storage", changed);
  }
}
