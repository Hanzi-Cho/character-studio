import { useEffect, useRef } from "react";
import { Icon } from "./Icon.js";
export function HelpDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
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
            ["장식", "리본 달아줘 / 별 달아줘 / 장식 제거"],
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
          되돌리기도 가능해요. 현재는 정해진 속성을 해석하는 로컬 편집기예요.
          외부 AI 대화·음성·이미지로 모델 생성은 아직 연결되지 않았어요.
          지원하지 않는 요청은 변경하지 않고 안내합니다.
        </p>
        <p className="help-fineprint">
          모습과 최근 50회 변경은 이 PC에 저장됩니다. 채팅 문장은 현재 탭에만
          남습니다. + 버튼은 캐릭터 JSON 불러오기입니다. 비공식 치이카와 절차적
          3D 스터디이며 원본 모델 파일을 사용하지 않습니다.
        </p>
        <button className="help-done" onClick={() => onClose()}>
          만들어 볼게요 <span>↗</span>
        </button>
      </div>
    </dialog>
  );
}
