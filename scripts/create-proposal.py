"""Build a concise two-page proposal from actual product screenshots."""
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
EVIDENCE = ROOT / "docs/evidence/codex-chat-v1"
OUT.parent.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont("Malgun", "C:/Windows/Fonts/malgun.ttf"))
pdfmetrics.registerFont(TTFont("MalgunBold", "C:/Windows/Fonts/malgunbd.ttf"))
W, H, M = 595.276, 841.89, 42
CW = W - 2 * M
INK, MUTED, GREEN, PAPER, LINE = map(HexColor,
    ["#25362D", "#647268", "#3F654C", "#FBFCF8", "#DCE4D9"])
c = canvas.Canvas(str(OUT), pagesize=(W, H), pageCompression=1)
c.setTitle("Character Studio | AI Platform Build Challenge 제안서")
c.setAuthor("Character Studio")
c.setSubject("대화로 3D 캐릭터를 개인화하는 서비스 제안")
copy_log = ["# Character Studio 제안서 문안", "2026-10-25 · 2쪽 간결본"]

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
    c.drawString(M, H - 32, "CHARACTER / STUDIO")
    c.setFillColor(MUTED)
    c.setFont("Malgun", 8)
    c.drawRightString(W - M, H - 32, "AI PLATFORM BUILD CHALLENGE")
    c.setStrokeColor(LINE)
    c.line(M, H - 45, W - M, H - 45)
    c.setFont("Malgun", 8)
    c.drawString(M, 26, "2026.10.25  |  예선 서비스 제안서")
    c.drawRightString(W - M, 26, f"{number} / 2")

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
    bottom = para(label, x, top, width, size, color=GREEN, log=False)
    c.linkURL(url, (x, bottom, x + width, top), relative=0, thickness=0)
    copy_log.append(f"[{label}]({url})")
    return bottom

page(1)
top = para("대화로 만드는\n나만의 3D 캐릭터", M, H - 72, CW, 28, True, leading=37) - 12
top = para("SNS 프로필과 GitHub·커뮤니티에서 나를 표현할 캐릭터를\n채팅으로 꾸미고, 원하는 모습으로 계속 수정하는 서비스입니다.",
           M, top, CW, 11.5, color=MUTED, leading=18) - 24
top = para("01  해결하려는 문제와 주요 사용자", M, top, CW, 13, True) - 8
top = para("주요 사용자는 자신만의 캐릭터로 프로필을 꾸미고 싶은 3D 비전문가입니다. "
           "옷이나 표정만 바꾸려 해도 전문 모델링 도구와 용어를 배워야 하는 부담을 줄이고, "
           "원하는 부분을 말로 고치며 같은 캐릭터를 여러 모습으로 활용하도록 돕습니다.",
           M, top, CW, 11) - 22
top = para("02  핵심 기능과 이용 흐름", M, top, CW, 13, True) - 12
gap = 16
image_width = (CW - gap) / 2
image_bottom = shot("01-base.png", M, top, image_width)
shot("03-generated-sprout.png", M + image_width + gap, top, image_width)
para("기본 캐릭터", M, image_bottom - 7, image_width, 9, color=MUTED)
para("셔츠·날개·새싹·웃음 적용", M + image_width + gap, image_bottom - 7,
     image_width, 9, color=MUTED)
top = image_bottom - 34
top = para("실제 Codex 채팅 편집 화면. 색상·옷·장식·표정을 바꾸고, 다른 부위는 유지합니다.",
           M, top, CW, 9.5, color=MUTED) - 16
for title, body in [
    ("채팅으로 세부 수정하기", "“하늘색 셔츠와 작은 날개를 달고 웃는 표정으로.” 색·옷·장식을 부분 수정합니다."),
    ("3D를 여러 시점에서 보기", "드래그·확대로 정면·옆·뒤·위를 확인합니다. 변경은 되돌리거나 초기화할 수 있습니다."),
    ("이미지·JSON 다운로드", "PNG 이미지를 프로필에 쓰고, 캐릭터 설정 JSON을 내려받아 다시 불러와 편집합니다."),
]:
    top = para(title, M, top, 140, 10.5, True) - 2
    top = para(body, M, top, CW, 10.5) - 11
para("현재 체험: 웹 데모에서 치이카와 1종과 41개 예문을 바로 체험합니다. 자유로운 AI 채팅은 PC에서 실행합니다.",
     M, top - 1, CW, 9, color=MUTED)
c.showPage()

page(2)
top = para("대화가 3D에 반영되는 과정", M, H - 72, CW, 23, True, leading=32) - 16
top = para("03  AI 적용 방식·데이터·기술", M, top, CW, 13, True) - 7
top = para("자연어를 정해진 편집 명령으로 바꾸고, 검증된 설정만 3D에 반영합니다. "
           "아래는 n8n처럼 노드로 표현한 실제 앱 흐름입니다(n8n 실행 엔진은 사용하지 않음).",
           M, top, CW, 9.6, leading=14) - 12

flow_gap, box_height = 24, 48
box_width = (CW - flow_gap * 2) / 3
flow = [
    (0, 0, "01  채팅 입력", "문장 + 현재 캐릭터 설정"),
    (1, 0, "02  Codex 직렬화", "JSON Schema에 맞춘 명령 출력"),
    (2, 0, "03  JSON 파싱", "JSON.parse → 명령 객체"),
    (2, 1, "04  ENUM·값 검증", "Zod: 허용 명령·값·한도 검사"),
    (1, 1, "05  설정 변경·저장", "compilePlan → patch → 저장"),
    (0, 1, "06  Three.js 반영", "변경된 부위 갱신 → 화면 렌더"),
]
for col, row, title, body in flow:
    x = M + col * (box_width + flow_gap)
    y = top - row * 66
    c.setFillColor(HexColor("#EAF0E5"))
    c.roundRect(x, y - box_height, box_width, box_height, 8, fill=1, stroke=0)
    para(title, x + 10, y - 8, box_width - 20, 10, True, log=False)
    para(body, x + 10, y - 27, box_width - 20, 8.1, color=MUTED, log=False)
    copy_log.append(f"{title}: {body}")

def arrow(x1, y1, x2, y2):
    from math import atan2, cos, sin, pi
    c.setStrokeColor(GREEN)
    c.setLineWidth(1)
    c.line(x1, y1, x2, y2)
    angle = atan2(y2 - y1, x2 - x1)
    for delta in [-.55, .55]:
        c.line(x2, y2, x2 - 4 * cos(angle + delta), y2 - 4 * sin(angle + delta))

for col in range(2):
    x = M + col * (box_width + flow_gap) + box_width
    arrow(x + 3, top - 24, x + flow_gap - 3, top - 24)
    arrow(x + flow_gap - 3, top - 90, x + 3, top - 90)
x = M + 2 * (box_width + flow_gap) + box_width / 2
arrow(x, top - 51, x, top - 63)
top -= 128
top = para('예: “웃는 표정으로” → {"action":"edit", "message":"웃는 표정을 적용했어요",\n'
           '"operations":[{"op":"set", "key":"expression", "value":"happy"}]}',
           M, top, CW, 9.2, leading=14) - 9
top = para("명령은 set(속성), upsert_part(부위 추가·수정), remove_part(삭제), clear_parts(장식 정리)로 제한합니다. "
           "표정은 gentle / happy / sad / angry / surprised / sleepy 중 선택합니다. 오류·충돌이면 전체 변경을 취소합니다.",
           M, top, CW, 9.3, leading=14) - 9
top = para("빠른 이유: 전체 3D 모델을 다시 생성하지 않고 색·표정·변경된 부위만 갱신합니다. "
           "유지되는 메시를 재사용하고 화면도 필요할 때만 그립니다. 41개 예문은 AI 호출을 생략합니다. "
           "자유 채팅의 AI 응답 대기 시간은 별도입니다.", M, top, CW, 9.3, leading=14) - 9
top = para("현재 Codex CLI의 ChatGPT 로그인 사용. 데이터는 텍스트·캐릭터 JSON·직접 작성한 도형 정의이며 학습은 하지 않습니다. "
           "React·TypeScript / Three.js / Node.js / Zod / HTTP·SSE·MCP로 구성합니다.",
           M, top, CW, 8.8, leading=13, color=MUTED) - 16
top = para("04  구현 계획·역할 분담·기대 효과", M, top, CW, 13, True) - 7
top = para("현재: 로컬 Codex 채팅 편집·저장·복구와 설치 없는 예문 웹 데모. "
           "다음: 모델 API와 사용자별 저장을 연결해 브라우저에서 자유로운 AI 채팅 제공. "
           "이후: Blender + CLI-Anything으로 메시·의상·표정의 세부 수정을 연동하고, 다른 캐릭터 기본 모델을 추가합니다.",
           M, top, CW, 10, leading=15) - 9
top = para("1인으로 기획·구현·자료 조사·제출 자료를 담당하며 Codex를 활용합니다. "
           "3D 도구의 학습 부담을 줄이고, SNS·GitHub·커뮤니티에서 나만의 캐릭터로 표현하도록 돕습니다.",
           M, top, CW, 9.8, leading=15) - 16
top = para("05  외부 자료·오픈소스·AI 도구 출처", M, top, CW, 13, True) - 10
refs = [
    ("Codex: 코드 구현·편집 명령 해석", "https://learn.chatgpt.com/docs/cli"),
    ("React·Three.js·Zod 등: 앱 구성", "https://github.com/Hanzi-Cho/character-studio/blob/main/package.json"),
    ("Human Atlas: 렌더링·구조 참고", "https://github.com/ashemag/human-atlas"),
    ("Humanizer: 제안서 문장 교정", "https://github.com/blader/humanizer"),
    ("Blender: 정밀 모델링 연동 예정", "https://www.blender.org/"),
    ("CLI-Anything: 에이전트 도구 연동 예정", "https://github.com/HKUDS/CLI-Anything"),
]
ref_width = (CW - 14) / 2
for i in range(0, len(refs), 2):
    link(*refs[i], M, top, ref_width)
    link(*refs[i + 1], M + ref_width + 14, top, ref_width)
    top -= 18
top -= 1
top = para("화면의 치이카와는 원작을 참고해 코드로 만든 비공식 3D 스터디입니다. "
           "공식 모델 파일은 사용하지 않았으며, 공개 서비스용 자산은 자체 제작 또는 이용 허락을 받은 캐릭터로 준비할 계획입니다.",
           M, top, CW, 8.8, color=MUTED) - 12
top = link("웹 데모  hanzi-cho.github.io/character-studio/",
     "https://hanzi-cho.github.io/character-studio/", M, top, CW, 9.2) - 5
link("공개 코드·AI 실행 안내  github.com/Hanzi-Cho/character-studio",
     "https://github.com/Hanzi-Cho/character-studio", M, top, CW, 9.2)
c.showPage()
c.save()
(ROOT / "docs/hackathon-proposal-copy.md").write_text("\n\n".join(copy_log) + "\n", encoding="utf-8")
assert OUT.stat().st_size < 20_000_000
print(f"{OUT}\n{OUT.stat().st_size:,} bytes / 2 pages")
