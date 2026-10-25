import { useState } from "react";
import {
  COMMAND_EXAMPLES,
  nextExampleIndex,
} from "../domain/commandExamples.js";
import { Icon } from "./Icon.js";

export function ExampleSuggestion({
  disabled,
  onApply,
}: {
  disabled: boolean;
  onApply: (text: string) => Promise<boolean>;
}) {
  const [index, setIndex] = useState(0);
  const example = COMMAND_EXAMPLES[index];
  return (
    <section className="example-suggestion" aria-label="모델 없이 예문 체험">
      <div className="example-copy" aria-live="polite" aria-atomic="true">
        <span className="example-meta">
          AI 없이 체험 · {example.category} · {index + 1}/
          {COMMAND_EXAMPLES.length}
        </span>
        <p>{example.text}</p>
      </div>
      <button
        type="button"
        className="icon-button example-refresh"
        aria-label="추천 예문 새로고침"
        title="다음 예문"
        disabled={disabled}
        onClick={() => setIndex(nextExampleIndex)}
      >
        <Icon name="reset" size={17} />
      </button>
      <button
        type="button"
        className="example-apply"
        disabled={disabled}
        onClick={() => void onApply(example.text)}
      >
        바로 적용
      </button>
    </section>
  );
}
