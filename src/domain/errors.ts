export class ConflictError extends Error {
  constructor() {
    super(
      "다른 창에서 모습이 바뀌었어요. 최신 모습을 확인한 뒤 다시 시도해 주세요.",
    );
  }
}
