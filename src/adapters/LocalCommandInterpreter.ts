import {
  applyPatch,
  type CharacterDocument,
  type CharacterPatch,
  type Command,
  type Expression,
} from "../domain/character.js";
import type { CommandInterpreter } from "../application/ports.js";
const colors: Record<string, string> = {
  분홍: "#f4b5c5",
  핑크: "#f4b5c5",
  pink: "#f4b5c5",
  보라: "#c8b5ed",
  purple: "#c8b5ed",
  라벤더: "#c8b5ed",
  하늘: "#b3d8ed",
  sky: "#b3d8ed",
  파랑: "#9fbee9",
  파란: "#9fbee9",
  blue: "#9fbee9",
  민트: "#b7dfcf",
  mint: "#b7dfcf",
  초록: "#b1d199",
  green: "#b1d199",
  노랑: "#f5dc91",
  노란: "#f5dc91",
  yellow: "#f5dc91",
  하양: "#fffdf7",
  하얀: "#fffdf7",
  흰색: "#fffdf7",
  white: "#fffdf7",
  검정: "#49494d",
  검은: "#49494d",
  black: "#49494d",
  빨강: "#e9908f",
  빨간: "#e9908f",
  red: "#e9908f",
  주황: "#f1b788",
  orange: "#f1b788",
};
const suffix = String.raw`(?:\s*(?:으로|로|하게)?\s*(?:바꿔(?:줘)?|변경(?:해줘)?|만들어(?:줘)?|해\s?줘|해\s?주세요|해|줘)?)?`;
const colorRule = new RegExp(
  String.raw`^(?:(몸통|몸|전체|캐릭터|볼|귀|body|cheeks?|ears?)(?:의)?(?:\s*색상|\s*색)?(?:을|를|은|는)?\s*)?(#[a-f\d]{6}|` +
    Object.keys(colors).join("|") +
    String.raw`)(?:색)?` +
    suffix +
    "$",
  "i",
);
const sizeRule = new RegExp(
  String.raw`^(귀|눈|몸|키|ears?|eyes?|body)(?:를|을)?\s*(조금|좀|많이|훨씬)?\s*(크게|작게|길게|짧게|키워|줄여|늘려|bigger|smaller|larger|longer|shorter)` +
    suffix +
    "$",
  "i",
);
const widthRule = new RegExp(
  String.raw`^(?:(?:몸|캐릭터)(?:을|를)?\s*)?(통통|날씬|chubby|slim)(?:하게)?` +
    suffix +
    "$",
  "i",
);
const expressionRule = new RegExp(
  String.raw`^(웃는|웃음|행복한|슬픈|슬픔|우는|화난|화남|화가 난|놀란|놀람|졸린|졸림|잠자는|차분한|순한|기본)\s*표정` +
    suffix +
    "$",
);
const expressions: Record<string, Expression> = {
  웃는: "happy",
  웃음: "happy",
  행복한: "happy",
  happy: "happy",
  smile: "happy",
  슬픈: "sad",
  슬픔: "sad",
  우는: "sad",
  sad: "sad",
  화난: "angry",
  화남: "angry",
  "화가 난": "angry",
  angry: "angry",
  놀란: "surprised",
  놀람: "surprised",
  surprised: "surprised",
  졸린: "sleepy",
  졸림: "sleepy",
  잠자는: "sleepy",
  sleepy: "sleepy",
  차분한: "gentle",
  순한: "gentle",
  기본: "gentle",
  gentle: "gentle",
  neutral: "gentle",
};
const help =
  "색상, 귀·눈 크기, 체형, 표정, 리본·별을 바꿀 수 있어요. 예: “분홍색으로”, “귀를 크게”, “웃는 표정으로”.";
export class LocalCommandInterpreter implements CommandInterpreter {
  interpret(input: string, document: CharacterDocument): Command {
    const text = input.trim();
    if (!text || text.length > 1000)
      throw new Error("1~1,000자의 편집 명령을 입력해 주세요.");
    if (/^(되돌리기|취소|undo|이전으로)$/i.test(text))
      return { type: "undo", summary: "이전 모습으로 되돌렸어요." };
    if (/^(다시 실행|다시실행|redo)$/i.test(text))
      return { type: "redo", summary: "변경을 다시 적용했어요." };
    if (/^(초기화|처음으로|reset)$/i.test(text))
      return { type: "reset", summary: "처음의 치이카와로 돌아왔어요." };
    const patch: CharacterPatch = {};
    const assign = (addition: CharacterPatch) => {
      for (const key of Object.keys(addition) as (keyof CharacterPatch)[]) {
        if (key in patch)
          throw new Error(
            "같은 속성에 여러 요청이 있어요. 한 가지로 정리해 주세요.",
          );
      }
      Object.assign(patch, addition);
    };
    // Match complete clauses: negation or unsupported trailing requests must never silently become partial edits.
    for (const raw of text
      .split(/[,，;\n]|그리고|\s+and\s+/i)
      .map((v) => v.trim())
      .filter(Boolean)) {
      const clause = raw.replace(/[.!?]+$/, "");
      const color = colorRule.exec(clause),
        size = sizeRule.exec(clause),
        width = widthRule.exec(clause),
        expression = expressionRule.exec(clause);
      const accessory =
        /^(리본|별|장식)\s*(달아(?:줘)?|추가(?:해줘)?|제거(?:해줘)?|없애(?:줘)?|빼(?:줘)?)$/.exec(
          clause,
        );
      const rename =
        /^이름(?:을|은)?\s*["“']?(.+?)["”']?(?:으로|로)(?:\s*(?:바꿔(?:줘)?|변경|해줘|해 줘|해))?$/.exec(
          clause,
        );
      if (rename) {
        assign({ name: rename[1].trim() });
      } else if (color) {
        const part = (color[1] ?? "몸").toLowerCase();
        const word = color[2].toLowerCase();
        const value = colors[word] ?? word;
        assign({
          [/볼|cheek/.test(part)
            ? "cheekColor"
            : /귀|ear/.test(part)
              ? "earColor"
              : "bodyColor"]: value,
        });
      } else if (size) {
        const up = /크게|길게|키워|늘려|bigger|larger|longer/i.test(size[3]);
        const delta =
          (up ? 1 : -1) * (/많이|훨씬/.test(size[2] ?? "") ? 0.3 : 0.15);
        const key = /귀|ear/i.test(size[1])
          ? "earSize"
          : /눈|eye/i.test(size[1])
            ? "eyeSize"
            : "bodyHeight";
        assign({ [key]: document[key] + delta });
      } else if (width) {
        assign({
          bodyWidth:
            document.bodyWidth + (/통통|chubby/i.test(width[1]) ? 0.1 : -0.1),
        });
      } else if (expression) {
        assign({ expression: expressions[expression[1]] });
      } else if (
        /^(happy|smile|sad|angry|surprised|sleepy|gentle|neutral)$/i.test(
          clause,
        )
      ) {
        assign({ expression: expressions[clause.toLowerCase()] });
      } else if (accessory) {
        const remove = /제거|없애|빼/.test(accessory[2]);
        if (accessory[1] === "장식" && !remove)
          throw new Error("리본 또는 별을 골라 주세요.");
        assign({
          accessory: remove ? "none" : accessory[1] === "리본" ? "bow" : "star",
        });
      } else throw new Error("“" + raw + "”는 아직 지원하지 않아요. " + help);
    }
    try {
      applyPatch(document, patch);
    } catch {
      throw new Error(
        "조절 가능한 범위에 도달했거나 값이 올바르지 않아요. 반대 방향으로 바꾸거나 “초기화”해 주세요.",
      );
    }
    return { type: "patch", patch, summary: "새로운 모습을 적용했어요." };
  }
}
