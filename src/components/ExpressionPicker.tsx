import { EXPRESSIONS, type Expression } from "../domain/character.js";

export const expressionLabels: Record<Expression, string> = {
  gentle: "기본",
  happy: "웃음",
  sad: "슬픔",
  angry: "화남",
  surprised: "놀람",
  sleepy: "졸림",
};

/** Small vector studies keep six previews lightweight: only the stage owns WebGL. */
function FaceStudy({ expression }: { expression: Expression }) {
  const closed = expression === "happy" || expression === "sleepy";
  return (
    <svg viewBox="0 0 64 44" aria-hidden="true" focusable="false">
      <path
        d="M13 13 C8 4 18 2 21 9 C28 7 36 7 43 9 C47 2 56 5 51 14 C63 34 48 42 32 42 C15 42 1 33 13 13Z"
        fill="#fffdf7"
        stroke="#c4c2b9"
        strokeWidth="1"
      />
      <g fill="#efafbc">
        <ellipse cx="16" cy="29" rx="6" ry="3.3" />
        <ellipse cx="48" cy="29" rx="6" ry="3.3" />
      </g>
      <g stroke="#423f3d" strokeWidth="1.6" strokeLinecap="round" fill="none">
        {closed ? (
          <path
            d={
              expression === "happy"
                ? "M19 24 Q23 18 27 24 M37 24 Q41 18 45 24"
                : "M19 23 Q23 27 27 23 M37 23 Q41 27 45 23"
            }
          />
        ) : (
          <>
            <ellipse cx="23" cy="23" rx="3.2" ry="3.8" fill="#423f3d" />
            <ellipse cx="41" cy="23" rx="3.2" ry="3.8" fill="#423f3d" />
            <path d="M22 21h2 M40 21h2" stroke="#fffdf7" strokeWidth="1.4" />
          </>
        )}
        <path
          d={
            expression === "angry"
              ? "M19 15 L27 19 M37 19 L45 15"
              : expression === "sad"
                ? "M19 18 Q23 18 27 14 M37 14 Q41 18 45 18"
                : "M20 15 Q23 14 26 15 M38 15 Q41 14 44 15"
          }
        />
        {expression === "surprised" || expression === "sleepy" ? (
          <ellipse
            cx="32"
            cy="31"
            rx={expression === "sleepy" ? 1.8 : 3}
            ry="3.5"
            fill="#423f3d"
          />
        ) : expression === "sad" || expression === "angry" ? (
          <path d="M29 33 Q32 29 35 33" />
        ) : (
          <>
            <path d="M27 29 Q27 34 32 30 Q37 34 37 29" />
            {expression === "happy" ? (
              <path d="M29 33 Q32 40 35 33Z" fill="#423f3d" />
            ) : (
              <path d="M30 34 Q32 37 34 34" />
            )}
          </>
        )}
      </g>
      {expression === "sad" && (
        <g fill="#9bcbdc">
          <ellipse cx="22" cy="30" rx="1.8" ry="4" />
          <ellipse cx="42" cy="30" rx="1.8" ry="4" />
        </g>
      )}
    </svg>
  );
}

export function ExpressionPicker({
  value,
  disabled,
  onSelect,
}: {
  value?: Expression;
  disabled: boolean;
  onSelect: (expression: Expression) => void;
}) {
  return (
    <div className="expression-picker" role="group" aria-label="표정 선택">
      <div className="expression-heading">
        <span>표정</span>
        <small>마음에 드는 얼굴을 골라보세요</small>
      </div>
      <div className="expression-options">
        {EXPRESSIONS.map((expression) => (
          <button
            type="button"
            key={expression}
            disabled={disabled}
            aria-label={`${expressionLabels[expression]} 표정`}
            aria-pressed={value === expression}
            onClick={() => onSelect(expression)}
          >
            <FaceStudy expression={expression} />
            <span>{expressionLabels[expression]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
