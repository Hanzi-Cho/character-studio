import { useEffect, useRef } from "react";
import { Icon } from "./Icon.js";
export function HelpDialog({
  open,
  onClose,
  storage,
}: {
  open: boolean;
  onClose: () => void;
  chatMode: string;
  storage: "browser" | "local";
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="help-dialog"
      onCancel={() => onClose()}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="help-content">
        <button
          className="icon-button dialog-close"
          onClick={() => onClose()}
          aria-label="도움말 닫기"
        >
          <Icon name="close" />
        </button>
        <span className="eyebrow">MAKE IT YOURS</span>
        <h2>말로 다듬는 작은 세계</h2>
        <p>
          마우스로 드래그하거나 방향키로 캐릭터를 돌려보세요. 터치 화면에서는 한
          손가락으로 회전하고 두 손가락으로 확대할 수 있어요.
        </p>
        <div className="help-examples">
          {[
            ["색상", "몸을 민트색으로, 볼을 분홍색으로"],
            ["크기", "귀를 크게 / 눈을 작게 / 몸을 통통하게"],
            ["표정", "기본 / 웃는 / 슬픈 / 화난 / 놀란 / 졸린 표정으로"],
            [
              "장식·옷",
              "하늘색 셔츠를 입혀줘 / 작은 날개와 금색 왕관을 달아줘",
            ],
            [
              "부분 수정",
              "날개만 반으로 줄여줘 / 안경만 지워줘 / 모자에 별을 붙여줘",
            ],
            ["이름·복구", "이름을 모찌로 / 되돌리기 / 다시 실행 / 초기화"],
          ].map(([label, text]) => (
            <div key={label}>
              <strong>{label}</strong>
              <span>{text}</span>
            </div>
          ))}
        </div>
        <p className="help-limitation">
          표정 시안을 누르면 얼굴 표정만 바뀌어요. 색상·체형·장식은 유지되며
          되돌리기도 가능해요. AI 연결 후에는 자연어를 여러 편집 명령으로 바꿔
          한 번에 적용합니다. 옷·날개 등의 제작 방식과 기본 도형 조합으로 새
          장식을 만들 수 있어요. Blender 조형·물리·음성은 후속입니다. 추천 예문
          41개는 모델 연결 없이 저장된 명령으로 적용돼요. 새로고침으로 예문을
          바꾸고 바로 적용을 누르세요. 같은 문장을 채팅에 입력해도 AI를 호출하지
          않아요. 문장을 바꾸면 AI 연결 시 모델에 전송되며, 미연결 상태에서는
          지원하는 속성 명령만 처리합니다.
        </p>
        <p className="help-fineprint">
          {storage === "browser"
            ? "웹에서는 내 AI 연결에서 본인 OpenAI API 키를 연결할 수 있으며 모습과 최근 50회 변경을 이 브라우저에 저장합니다. 사이트 데이터를 삭제하면 작업도 사라지므로 JSON으로 내보내 보관하세요. ChatGPT 계정 로그인은 로컬 실행에서 지원합니다."
            : "모습과 최근 50회 변경은 이 PC에 저장됩니다."}{" "}
          채팅 문장은 현재 탭에만 남습니다. AI 모드의 자유 입력은 채팅과 현재
          캐릭터 설정을 연결한 AI로 보냅니다. + 버튼으로 캐릭터 JSON 또는
          참고 이미지 최대 4장을 불러옵니다. 참고 이미지는 1024px 이하로 줄여
          AI로 전송하고, 색·비율·귀·얼굴 특징을 단순 3D 초안에 반영합니다. 정밀
          3D 복원은 지원하지 않습니다. 비공식 치이카와 절차적 3D 스터디이며 원본
          모델 파일을 사용하지 않습니다.
        </p>
        <button className="help-done" onClick={() => onClose()}>
          만들어 볼게요 <span>↗</span>
        </button>
      </div>
    </dialog>
  );
}
