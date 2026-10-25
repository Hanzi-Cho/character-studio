"""Build a three-page proposal with a live-demo cover and product evidence."""
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "output/pdf/character-studio-proposal-draft.pdf"
EVIDENCE = ROOT / "docs/evidence/base-profiles-v1"
OUT.parent.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont("Malgun", "C:/Windows/Fonts/malgun.ttf"))
pdfmetrics.registerFont(TTFont("MalgunBold", "C:/Windows/Fonts/malgunbd.ttf"))
W, H, M = 595.276, 841.89, 42
CW = W - 2 * M
INK, MUTED, GREEN, PAPER, LINE = map(HexColor,
    ["#25362D", "#647268", "#3F654C", "#FBFCF8", "#DCE4D9"])
LINK = HexColor("#1C58A6")
DEMO_URL = "https://hanzi-cho.github.io/character-studio/"
PAGE_COUNT = 3
c = canvas.Canvas(str(OUT), pagesize=(W, H), pageCompression=1)
c.setTitle("Character Studio | AI Platform Build Challenge 제안서")
c.setAuthor("조재현 · 캐릭터스튜디오")
c.setSubject("대화로 3D 캐릭터를 개인화하는 서비스 제안")
copy_log = ["# Character Studio 제안서 문안", "2026-10-25 · 표지 포함 3쪽"]

def para(text, x, top, width, size=11, bold=False, color=INK, leading=None, log=True):
    style = ParagraphStyle("copy", fontName="MalgunBold" if bold else "Malgun",
        fontSize=size, leading=leading or size * 1.55, textColor=color, wordWrap="CJK")
    paragraph = Paragraph(escape(text).replace("\n", "<br/>"), style)
    _, height = paragraph.wrap(width, H)
    if top - height < 43:
        raise ValueError(f"Page {c.getPageNumber()} overflow: {text[:60]}")
    paragraph.drawOn(c, x, top - height)
    if log:
        copy_log.append(text)
    return top - height

def page(number):
    c.setFillColor(PAPER)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(GREEN)
    c.setFont("MalgunBold", 9)
    c.drawString(M, H - 32, "Character Studio")
    c.setFillColor(MUTED)
    c.setFont("Malgun", 8)
    c.drawRightString(W - M, H - 32, "AI PLATFORM BUILD CHALLENGE")
    c.setStrokeColor(LINE)
    c.line(M, H - 45, W - M, H - 45)
    c.setFont("Malgun", 8)
    c.drawString(M, 26, "2026.10.25  |  서비스 제안서")
    c.drawRightString(W - M, 26, f"{number} / {PAGE_COUNT}")

def section(title, body, top, size=11):
    top = para(title, M, top, CW, 13, True, leading=20) - 6
    return para(body, M, top, CW, size) - 19

def shot(name, x, top, width):
    image = ImageReader(str(EVIDENCE / name))
    iw, ih = image.getSize()
    height = width * ih / iw
    c.drawImage(image, x, top - height, width, height, mask="auto")
    c.setStrokeColor(LINE)
    c.setLineWidth(.6)
    c.rect(x, top - height, width, height, fill=0, stroke=1)
    return top - height

def link(label, url, x, top, width, size=8.8):
    style = ParagraphStyle("link", fontName="MalgunBold", fontSize=size,
        leading=size * 1.55, textColor=LINK, wordWrap="CJK")
    paragraph = Paragraph(f"<u>{escape(label)}</u>", style)
    _, height = paragraph.wrap(width, H)
    bottom = top - height
    if bottom < 43:
        raise ValueError(f"Page {c.getPageNumber()} link overflow: {label}")
    paragraph.drawOn(c, x, bottom)
    c.linkURL(url, (x, bottom, x + width, top), relative=0, thickness=0)
    copy_log.append(f"[{label}]({url})")
    return bottom

page(1)
para("대화로 만드는 나만의 3D 캐릭터", M, H - 80, CW, 18, True, color=GREEN)
para("Character Studio", M, H - 121, CW, 40, True, leading=50)
para("마음에 드는 캐릭터를 불러와, 같은 3D 자산을 내 취향대로 계속 고치는 웹 도구",
     M, H - 186, CW, 11.2, leading=18)
top = H - 239
top = para("누가, 왜 쓰나요?", M, top, CW, 15, True) - 10
top = para("나노바나나·Sora로 이미지나 영상을 만들어 본 일반 사용자. "
           "3D 편집 경험은 없지만, SNS·GitHub·커뮤니티에서 쓸 자기 캐릭터를 직접 꾸미고 싶은 사람을 첫 사용자로 삼습니다.",
           M, top, CW, 11, leading=18) - 15
top = para("한 번 만든 모습에서 옷·표정·장식만 바꾸고, 돌려 보며 확인한 뒤 저장합니다. "
           "다음에도 같은 캐릭터를 불러와 계절·기분·활동에 맞게 다시 고칠 수 있습니다.",
           M, top, CW, 11, leading=18) - 26
c.setFillColor(HexColor("#EAF0E5"))
c.roundRect(M, top - 111, CW, 111, 10, fill=1, stroke=0)
para("지금 바로 사용해 볼 수 있는 웹 데모", M + 18, top - 14, CW - 36, 14, True)
link("웹 데모 열기  →  hanzi-cho.github.io/character-studio/", DEMO_URL,
     M + 18, top - 44, CW - 36, 11)
para("설치 없이 41개 예문·표정 선택·3D 회전·PNG/JSON 저장을 체험하세요.\n"
     "자유 채팅은 본인 API 키로 연결합니다. ChatGPT 계정 연결은 로컬에서 지원합니다.",
     M + 18, top - 72, CW - 36, 9.5, leading=15)
top -= 145
top = para("불러오기 → 말로 부분 수정 → 회전 확인 → 저장·다시 편집", M, top, CW, 12, True) - 14
para("기본 모델: 치이카와·우사기 선택과 여러 참고 이미지로 만드는 편집 가능한 3D 초안. "
     "이미지는 색·비율·귀·얼굴 특징을 추정하는 참고로 사용하며, 정밀 메시 복원은 후속 범위입니다.",
     M, top, CW, 10, color=MUTED, leading=16)
c.setStrokeColor(LINE)
c.line(M, 141, W - M, 141)
para("개인 참여 · 조재현", M, 121, CW, 13, True)
para("팀명 · 캐릭터스튜디오   |   기획·구현·자료 조사", M, 94, CW, 10, color=MUTED)
c.showPage()

page(2)
top = para("내 캐릭터를 계속 고쳐 쓰는 경험", M, H - 70, CW, 25, True, leading=34) - 15
top = para("사용 동기와 대표 시나리오", M, top, CW, 13, True) - 7
top = para("프로필을 바꾸고 싶은 날, 저장한 캐릭터를 열고 “얼굴과 옷은 그대로, 머리에 작은 분홍 꽃을 달아줘”라고 말합니다. "
           "옆·뒤까지 확인하고 원하는 각도의 이미지를 저장합니다. 마음에 들지 않으면 한 번에 되돌립니다.",
           M, top, CW, 10.6, leading=17) - 20
image_width = (CW - 16) / 2
before, after = "proposal-before.png", "proposal-after.png"
assert ImageReader(str(EVIDENCE / before)).getSize() == ImageReader(str(EVIDENCE / after)).getSize(), "Recapture both screenshots at the same viewport size"
image_bottom = shot(before, M, top, image_width)
shot(after, M + image_width + 16, top, image_width)
para("편집 전 · 날개와 목도리를 꾸민 모습", M, image_bottom - 7, image_width, 9, color=MUTED)
para("편집 후 · 기존 모습에 꽃만 추가", M + image_width + 16,
     image_bottom - 7, image_width, 9, color=MUTED)
top = image_bottom - 35
top = para("실제 ChatGPT 연결 편집. 꽃은 사전 목록 선택이 아니라 꽃잎 5장·꽃술을 도형 6개로 구성한 결과입니다.",
           M, top, CW, 9.5, color=MUTED, leading=15) - 19
top = para("차별화하려는 경험", M, top, CW, 13, True) - 7
for title, body in [
    ("웹에서 가볍게 시작", "기본 모델이나 저장 파일에서 출발합니다. AI 연결 후 참고 그림 1–4장의 특징으로 단순 3D 초안을 만듭니다."),
    ("수정한 부분을 확인하고 되돌리기", "3D 설정과 장식을 구조화해 저장합니다. 요청하지 않은 속성은 유지하고 잘못된 명령은 적용하지 않습니다."),
    ("내 캐릭터를 이어서 사용", "설정 JSON을 다시 열어 같은 자산을 편집하고, PNG 이미지는 프로필·커뮤니티에 활용합니다."),
]:
    top = para(title, M, top, CW, 10.5, True, leading=16) - 3
    top = para(body, M, top, CW, 10.1, leading=16) - 11
para("웹 접근이나 이미지→3D만으로 독점적 차별성을 주장하지 않습니다. "
     "부분 수정·복구·재사용까지 이어지는 흐름이 일반 사용자에게 더 쉬운지 실제 사용 테스트로 검증합니다.",
     M, top, CW, 9, color=MUTED, leading=14)
c.showPage()

page(3)
top = para("AI가 제안하고, 검증한 변경만 반영", M, H - 68, CW, 23, True, leading=32) - 15
labels = [("말·참고 이미지", "원하는 모습 설명"), ("AI 편집 제안", "구조화된 변경 목록"),
          ("변경 검증", "허용 값·현재 상태 확인"), ("3D 반영·저장", "확인·되돌리기·재사용")]
gap = 12
bw = (CW - gap * 3) / 4
for i, (title, body) in enumerate(labels):
    x = M + i * (bw + gap)
    c.setFillColor(HexColor("#EAF0E5"))
    c.roundRect(x, top - 58, bw, 58, 7, fill=1, stroke=0)
    para(title, x + 8, top - 9, bw - 16, 10, True, leading=15)
    para(body, x + 8, top - 32, bw - 16, 8, color=MUTED, leading=12)
    if i < 3:
        c.setFillColor(GREEN)
        c.setFont("Malgun", 10)
        c.drawString(x + bw + 2, top - 33, "→")
top -= 78
top = para("AI는 실행 코드 대신 편집 목록을 제안합니다. 전체 명령을 검사한 뒤 한 번에 적용하고, "
           "검증 실패나 상태 충돌이면 기존 캐릭터를 보존합니다. 완성된 편집안만 적용하며, 기존 메시의 설정을 갱신합니다.",
           M, top, CW, 10, leading=16) - 18
top = para("현재 확인한 것 / 앞으로 검증할 것", M, top, CW, 13, True) - 8
top = para("확인: 공개 데모, 실제 Codex 이미지→3D 초안, 공식 ChatGPT 로그인→새 장식 생성, 저장·되돌리기, 자동 시험 39개. "
           "이미지 초안 1회 실행은 6.04초였으며 평균 성능은 아닙니다. "
           "미검증: API 키 과금 호출, 자유 문장 성공률·시간 분포, 일반 사용자 수요, 모바일 실기기.",
           M, top, CW, 9.5, leading=15) - 12
top = para("제품화 순서와 검증 목표", M, top, CW, 13, True) - 8
for title, body in [
    ("1  기본 자산과 시작 경험", "기본 모델·이미지 초안 흐름을 다듬고 공개 대표 자산은 자체 디자인·허가 자산으로 준비."),
    ("2  AI 연결의 진입 부담 완화", "웹 API 키·로컬 ChatGPT 연결을 제공. 계정 준비 없는 체험 경로와 사용량 한도는 비용·권한 검토 후 설계."),
    ("3  반복 편집 품질", "자유 문장 30개·실패 시나리오 10개로 변경 정확도와 지연 측정. 비개발자 5명의 불러오기→수정→저장 과업 관찰."),
    ("4  확장", "Blender 세부 수정, 여러 기본 캐릭터, 3D 파일 내보내기. MCP를 통한 다른 AI 도구 연결은 호스트별로 검증."),
]:
    top = para(title, M, top, CW, 10, True, leading=15) - 2
    top = para(body, M, top, CW, 9.3, leading=14) - 6
top = para("목표 일정: 10/25 제안서·기본 모델 확장 → 11/1까지 AI 연결·사용자 과업 검증 → "
           "11/25까지 제출용 서비스와 시연 정리. 1인 개발이며 실제 검증 결과에 따라 범위를 조정합니다. "
           "현재 AI 비용은 사용자 계정 부담이며, 운영자 제공 무료 체험·유료 저장·파츠 판매는 수요 확인 후 검토합니다.",
           M, top, CW, 9.2, leading=14) - 16
top = para("출처와 구현 상세", M, top, CW, 12, True, leading=18) - 5
top = link("코드·기술 문서·전체 도구 사용 내역  →  GitHub", "https://github.com/Hanzi-Cho/character-studio", M, top, CW, 9) - 5
link("Gemini: 이미지 편집·일관성", "https://blog.google/products-and-platforms/products/gemini/image-generation-prompting-tips/", M, top, 245, 8)
link("Meshy: 이미지→3D 대안", "https://docs.meshy.ai/en/api/multi-image-to-3d", M + 260, top, 251, 8)
top -= 19
top = para("현재 화면은 치이카와를 참고해 코드로 만든 비공식 스터디입니다. 공식 모델 파일을 사용하지 않았습니다. "
           "참고 이미지·자산 출처와 AI 도구 활용 내역은 저장소에 기록합니다.",
           M, top, CW, 8, color=MUTED, leading=12) - 10
link("지금 바로 웹 데모 체험  →  hanzi-cho.github.io/character-studio/", DEMO_URL, M, top, CW, 9)
c.showPage()
c.save()
(ROOT / "docs/hackathon-proposal-copy.md").write_text("\n\n".join(copy_log) + "\n", encoding="utf-8")
assert OUT.stat().st_size < 20_000_000
print(f"{OUT}\n{OUT.stat().st_size:,} bytes / {PAGE_COUNT} pages")
