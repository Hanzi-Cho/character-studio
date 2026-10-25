"""Build a six-page proposal from product screenshots and recorded AI evidence."""
from pathlib import Path
import json
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
LIBRARY_EVIDENCE = ROOT / "docs/evidence/character-library-v1"
PROPOSAL_EVIDENCE = ROOT / "docs/evidence/proposal-v2"
SIZES = json.loads((LIBRARY_EVIDENCE / "storage-sizes.json").read_text(encoding="utf-8"))["samples"]
BASE_BYTES, OUTFIT_BYTES = SIZES[0]["utf8JsonBytes"], SIZES[2]["utf8JsonBytes"]
OUT.parent.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont("Malgun", "C:/Windows/Fonts/malgun.ttf"))
pdfmetrics.registerFont(TTFont("MalgunBold", "C:/Windows/Fonts/malgunbd.ttf"))
W, H, M = 595.276, 841.89, 42
CW = W - 2 * M
INK, MUTED, GREEN, PAPER, LINE = map(HexColor,
    ["#25362D", "#647268", "#3F654C", "#FBFCF8", "#DCE4D9"])
LINK = HexColor("#1C58A6")
DEMO_URL = "https://hanzi-cho.github.io/character-studio/"
PAGE_COUNT = 6
c = canvas.Canvas(str(OUT), pagesize=(W, H), pageCompression=1)
c.setTitle("Character Studio | AI Platform Build Challenge 제안서")
c.setAuthor("조재현 · 캐릭터스튜디오")
c.setSubject("대화로 3D 캐릭터를 개인화하는 서비스 제안")
copy_log = ["# Character Studio 제안서 문안", "2026-10-25 · 표지 포함 6쪽"]

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

def shot(name, x, top, width, source=EVIDENCE):
    image = ImageReader(str(source / name))
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

def crop_shot(name, x, top, width, box, source=PROPOSAL_EVIDENCE):
    """Crop only the PDF viewport; retain the unmodified source screenshot."""
    reader = ImageReader(str(source / name))
    iw, ih = reader.getSize()
    left, upper, right, lower = box
    assert 0 <= left < right <= iw and 0 <= upper < lower <= ih
    scale = width / (right - left)
    height = (lower - upper) * scale
    c.saveState()
    clip = c.beginPath()
    clip.rect(x, top - height, width, height)
    c.clipPath(clip, stroke=0, fill=0)
    c.drawImage(reader, x - left * scale, top - (ih - upper) * scale,
                iw * scale, ih * scale, mask="auto")
    c.restoreState()
    c.setStrokeColor(LINE)
    c.setLineWidth(.6)
    c.rect(x, top - height, width, height, fill=0, stroke=1)
    return top - height

def panel(title, body, x, top, width, height, size=10):
    c.setFillColor(HexColor("#EAF0E5"))
    c.roundRect(x, top - height, width, height, 8, fill=1, stroke=0)
    bottom = para(title, x + 14, top - 12, width - 28, 12, True, leading=18) - 7
    bottom = para(body, x + 14, bottom, width - 28, size, leading=size * 1.5)
    if bottom < top - height + 9:
        raise ValueError(f"Panel overflow: {title}")
    return top - height

page(1)
para("대화로 만드는 나만의 3D 캐릭터", M, H - 80, CW, 18, True, color=GREEN)
para("Character Studio", M, H - 121, CW, 40, True, leading=50)
para("내 캐릭터를 저장해 두고 표정·옷·장식을 바꾸며 여러 모습으로 꺼내 쓰는 웹 스튜디오",
     M, H - 186, CW, 11.2, leading=18)
top = H - 239
top = para("누가, 왜 쓰나요?", M, top, CW, 15, True) - 10
top = para("나노바나나·Sora로 이미지나 영상을 만들어 본 일반 사용자. "
           "3D 편집 경험은 없지만, SNS·GitHub·커뮤니티에서 쓸 자기 캐릭터를 직접 꾸미고 싶은 사람을 첫 사용자로 삼습니다.",
           M, top, CW, 11, leading=18) - 15
top = para("프로필을 바꿀 때마다 내 캐릭터를 처음부터 만들 필요가 없도록, 마음에 드는 모습을 보관함에 남깁니다. "
           "다음에도 불러와 계절·기분·활동에 맞는 표정과 장식으로 다듬고 원하는 각도로 꺼내 씁니다.",
           M, top, CW, 11, leading=18) - 26
c.setFillColor(HexColor("#EAF0E5"))
c.roundRect(M, top - 111, CW, 111, 10, fill=1, stroke=0)
para("지금 바로 사용해 볼 수 있는 웹 데모", M + 18, top - 14, CW - 36, 14, True)
link("웹 데모 열기  →  hanzi-cho.github.io/character-studio/", DEMO_URL,
     M + 18, top - 44, CW - 36, 11)
para("설치·로그인 없이 41개 예문·3D 회전·내 캐릭터 보관함을 체험하세요.\n"
     "자유 채팅은 본인 API 키로 연결합니다. ChatGPT 계정 연결은 로컬에서 지원합니다.",
     M + 18, top - 72, CW - 36, 9.5, leading=15)
top -= 145
top = para("불러오기 → 부분 수정 → 회전 확인 → 보관함 → 다음에도 편집", M, top, CW, 12, True) - 14
para("기본 모델: 치이카와·우사기 선택과 여러 참고 이미지로 만드는 편집 가능한 3D 초안. "
     "이미지는 색·비율·귀·얼굴 특징을 추정하는 참고로 사용하며, 정밀 메시 복원은 후속 범위입니다.",
     M, top, CW, 10, color=MUTED, leading=16)
c.setStrokeColor(LINE)
c.line(M, 141, W - M, 141)
para("개인 참여 · 조재현", M, 121, CW, 13, True)
para("팀명 · 캐릭터스튜디오   |   기획·구현·자료 조사", M, 94, CW, 10, color=MUTED)
c.showPage()

page(2)
top = para("그대로 둘 곳은 지키고, 꽃만 더하기", M, H - 70, CW, 25, True, leading=34) - 12
top = para("실제 AI 편집 사례 · 기존 응답을 현재 화면에서 재현", M, top, CW, 10, color=GREEN) - 16
top = panel("편집 요청 요약", "“얼굴과 몸 비율, 민트색 날개와 노란 목도리는 그대로 두고, 머리 위에 작은 연분홍 꽃을 달아줘.”",
            M, top, CW, 82, 11) - 19
image_width = (CW - 16) / 2
before, after = "before-full.png", "after-full.png"
assert ImageReader(str(PROPOSAL_EVIDENCE / before)).getSize() == ImageReader(str(PROPOSAL_EVIDENCE / after)).getSize()
image_bottom = crop_shot(before, M, top, image_width, (420, 47, 840, 374))
crop_shot(after, M + image_width + 16, top, image_width, (420, 47, 840, 374))
para("편집 전 · 날개와 목도리를 꾸민 모습", M, image_bottom - 7, image_width, 9, color=MUTED)
para("편집 후 · 분홍 꽃잎 5장과 노란 꽃술", M + image_width + 16,
     image_bottom - 7, image_width, 9, color=MUTED)
top = image_bottom - 35
panel("유지된 설정", "기본 모델·얼굴·몸 비율·표정·날개·목도리. 기존 값·장식이 유지됐는지 전후 JSON으로 확인했습니다.",
      M, top, image_width, 108, 10)
panel("추가된 설정", "AI가 새 장식 pink_flower를 구성했습니다. 꽃잎과 꽃술은 위치·회전·크기를 가진 도형 6개입니다.",
      M + image_width + 16, top, image_width, 108, 10)
top -= 128
top = section("색을 바꾸는 명령을 넘어, 새 부품의 구성을 제안", "꽃 모양을 고정된 메뉴에서 고르는 대신, AI가 기본 도형의 배치와 크기를 정해 편집 명령으로 돌려줍니다. "
              "현재는 제한된 도형 조합으로 만든 장식이며, 임의의 정밀 3D 메시를 생성하는 기능은 아닙니다.", top, 10.3)
top = para("공식 ChatGPT 연결 기록: gpt-6.1-sol, 응답 14.8초(단일 사례). 평균 속도·성공률은 아직 측정하지 않았습니다. "
           "위 이미지는 같은 AI 응답을 별도 데모 설정에 적용해 동일한 카메라 배율로 촬영한 화면입니다.",
           M, top, CW, 8.8, color=MUTED, leading=14) - 8
link("실제 AI 응답 JSON과 편집 전후 설정 확인 ↗", "https://github.com/Hanzi-Cho/character-studio/tree/main/docs/evidence/proposal-v2", M, top, CW, 9)
c.showPage()

page(3)
top = para("한 번 만든 캐릭터, 다음에도 이어서", M, H - 70, CW, 25, True, leading=34) - 13
top = para("첫 사용자는 이미지·영상 AI를 써 봤지만 3D 편집 도구는 낯선 사람입니다. "
           "결과물을 다시 만드는 부담을 줄이고, 마음에 든 캐릭터의 일부만 바꾸는 흐름에 집중합니다.",
           M, top, CW, 10.7, leading=17) - 17
for title, body in [
    ("프로필을 바꿀 때", "얼굴은 유지하고 표정·옷·장식을 바꿔 SNS나 GitHub 프로필용 PNG를 저장합니다."),
    ("커뮤니티에서 활동할 때", "같은 캐릭터에 계절이나 활동에 맞는 소품을 더해 여러 모습으로 사용합니다."),
    ("다시 편집할 때", "보관함에서 불러와 이어서 수정합니다. 원본을 남기고 새 버전으로 저장할 수도 있습니다."),
]:
    left_bottom = para(title, M, top, 125, 10.5, True, leading=16)
    right_bottom = para(body, M + 139, top, CW - 139, 10.2, leading=16)
    top = min(left_bottom, right_bottom) - 12
top -= 4
image_bottom = crop_shot("library-desktop.png", M, top, 260, (315, 16, 965, 705), LIBRARY_EVIDENCE)
x, width = M + 280, CW - 280
right_top = para("내 캐릭터 보관함", x, top, width, 14, True, leading=21) - 10
right_top = para("이름 붙여 최대 50개 저장\n불러오기 → 수정 → 변경 저장\n새 버전은 ‘새 캐릭터로 저장’\nJSON 백업·가져오기·삭제", x, right_top, width, 10.3, leading=18) - 20
right_top = para("작게 저장하고 다시 3D로", x, right_top, width, 12, True, leading=18) - 7
right_top = para(f"{BASE_BYTES} B  기본 캐릭터\n{OUTFIT_BYTES} B  셔츠·날개·웃음 적용본", x, right_top, width, 15, True, color=GREEN, leading=25) - 12
right_top = para("색·비율·표정·부품의 설정을 저장하고, 불러올 때 렌더러가 다시 그립니다. "
                 "PNG는 공유용 이미지, JSON은 이어서 편집하기 위한 파일입니다.", x, right_top, width, 10, leading=16)
top = min(image_bottom, right_top) - 15
top = para("위 용량은 공백 없는 UTF-8 캐릭터 JSON의 실측입니다. 보관함 메타데이터·편집 이력·렌더러·이미지는 제외하며, "
           "모든 3D 모델이 이 용량으로 저장된다는 뜻은 아닙니다. 보관함은 현재 브라우저에만 저장되므로 JSON 파일을 백업하세요.",
           M, top, CW, 8.8, color=MUTED, leading=14) - 17
section("확인할 수요 가설", "완성 이미지 한 장보다, 정체성을 유지한 채 반복 편집할 수 있는 캐릭터가 다시 방문할 이유가 될 것으로 봅니다. "
        "이 수요는 아직 사용자 조사로 입증되지 않았으며, 저장 후 재편집 과업으로 확인할 계획입니다.", top, 10.2)
c.showPage()

page(4)
top = para("연결해서 대화하고, 예문으로 먼저 체험", M, H - 68, CW, 22, True, leading=31) - 12
top = para("상단의 ‘내 AI 연결’에서 사용할 방식을 선택합니다. 아래는 실제 웹 데모의 연결 창입니다.",
           M, top, CW, 10, leading=16) - 15
image_top = top
image_bottom = shot("ai-connection-web.png", M, image_top, 260, LIBRARY_EVIDENCE)
x, width = M + 278, CW - 278
right_top = para("웹 데모 · 본인 API 키", x, image_top, width, 12, True, leading=18) - 8
right_top = para("1. ‘내 AI 연결’을 엽니다.\n2. 본인 OpenAI API 키를 입력합니다.\n3. 전송·사용료 동의 후 ‘API 키 연결’.\n4. 사용 모델을 고르고 창을 닫습니다.",
                 x, right_top, width, 10, leading=17) - 12
right_top = para("로컬 실행 · ChatGPT 계정", x, right_top, width, 12, True, leading=18) - 7
right_top = para("같은 창에서 ‘Continue with ChatGPT’를 누릅니다. 공식 화면의 로그인·권한 동의를 마치고 돌아와 모델을 선택합니다. 지원 플랜과 이용 한도가 적용됩니다.",
                 x, right_top, width, 9.8, leading=16) - 10
right_top = link("로컬 실행 방법 보기 ↗", "https://github.com/Hanzi-Cho/character-studio#내려받아-체험하기--codex-불필요", x, right_top, width, 9) - 12
right_top = para("연결 후 하단 채팅에 요청", x, right_top, width, 11, True, leading=17) - 6
right_top = para("“얼굴과 옷은 그대로, 머리에 작은 분홍 꽃을 달아줘.”\n결과를 돌려 보고, 마음에 들면 보관함에 저장합니다. + 버튼으로 참고 이미지도 첨부할 수 있습니다.",
                 x, right_top, width, 9.6, leading=15)
top = min(image_bottom, right_top) - 13
top = para("API 이용료는 본인 계정 부담이며 ChatGPT 구독과 별도입니다. 키·토큰은 실행 중인 메모리에만 유지합니다. "
           "웹 새로고침·로컬 서버 재시작 시 해당 연결을 다시 해야 합니다. 채팅·현재 설정·선택한 이미지가 AI로 전송됩니다.",
           M, top, CW, 8.5, color=MUTED, leading=13) - 17
top = para("AI 없이도 바로 체험", M, top, CW, 13, True, leading=20) - 6
top = para("추천 문장 옆 새로고침 → ‘바로 적용’. 또는 아래 예문을 채팅에 그대로 입력하세요.",
           M, top, CW, 10, leading=16) - 8
c.setFillColor(HexColor("#EAF0E5"))
c.roundRect(M, top - 40, CW, 40, 7, fill=1, stroke=0)
para("하늘색 셔츠와 작은 하얀 날개를 달고 웃는 표정으로", M + 13, top - 10, CW - 26, 11, True, leading=17)
top -= 50
top = para("41개 예문은 미리 저장한 편집 명령을 적용하므로 로그인·API 키·모델 호출이 필요 없습니다. "
           "색·옷·장식·표정 변경, 회전, 되돌리기와 보관함을 체험할 수 있습니다. 예문을 벗어난 자유 채팅과 이미지 초안은 AI를 연결해 사용합니다.",
           M, top, CW, 9.6, leading=15) - 14
top = para("다음에도 같은 모습에서 시작", M, top, CW, 12, True, leading=18) - 5
para("‘내 캐릭터 보관함’ → 이름 입력 → 저장. 다음 접속 때 ‘불러오기’로 이어서 수정합니다. "
     "보관본의 JSON은 백업용으로 내려받고 + 버튼으로 다시 가져올 수 있습니다. PNG에는 편집 설정이 포함되지 않습니다.",
     M, top, CW, 9.6, leading=15)
c.showPage()

page(5)
top = para("말 한마디가 3D 편집이 되기까지", M, H - 68, CW, 24, True, leading=33) - 12
top = para("AI는 변경안을 제안하고, 서비스는 허용된 명령만 실행합니다. 아래는 현재 코드의 처리 흐름입니다.",
           M, top, CW, 10.3, leading=17) - 18
steps = [
    ("01  입력", "문장·현재 설정·선택 이미지", "“꽃만 달아줘”와 현재 부품 정보를 함께 전달합니다. 기존 설정은 유지할 대상이 됩니다."),
    ("02  AI 해석", "의도 → JSON 편집안", "꽃잎의 색·위치·크기를 정하고 upsert_part 명령을 만듭니다. 여러 수정을 하나의 계획에 담을 수 있습니다."),
    ("03  파싱", "JSON.parse", "응답 문자열을 구조화된 데이터로 읽습니다. 실행 코드나 임의 스크립트를 실행하지 않습니다."),
    ("04  검증", "ENUM·범위·버전 검사", "명령·표정·도형 종류는 허용 목록에서 선택합니다. 크기·색·부품 수와 현재 문서 버전을 확인합니다."),
    ("05  상태 반영", "검증한 계획을 한 번에 적용", "set / upsert_part / remove_part 등으로 설정을 갱신합니다. 오류·충돌이면 기존 상태를 보존합니다."),
    ("06  렌더링", "변경 부위 갱신·되돌리기", "Three.js가 설정을 3D 화면으로 반영합니다. 사용자가 회전해 확인하고 PNG·JSON·보관함으로 남깁니다."),
]
for i, (title, subtitle, body) in enumerate(steps):
    c.setFillColor(HexColor("#EAF0E5"))
    c.roundRect(M, top - 58, 157, 58, 8, fill=1, stroke=0)
    para(title, M + 12, top - 8, 133, 11, True, leading=17)
    para(subtitle, M + 12, top - 32, 133, 8.2, color=MUTED, leading=13)
    para(body, M + 176, top - 7, CW - 176, 10, leading=16)
    if i < len(steps) - 1:
        c.setStrokeColor(GREEN)
        c.line(M + 78, top - 58, M + 78, top - 69)
        c.line(M + 74, top - 65, M + 78, top - 69)
        c.line(M + 82, top - 65, M + 78, top - 69)
    top -= 73
top -= 3
top = section("왜 변경이 빠르게 보이나요?", "전체 메시를 다시 생성하지 않고 장면과 기본 도형을 재사용해 달라진 속성·부품을 갱신합니다. "
              "AI 해석 대기와 화면 반영은 다른 단계입니다. 41개 예문은 저장된 명령을 사용하므로 AI 대기가 없습니다.", top, 10)
top = section("모델과 렌더러를 교체할 수 있는 구조", "React UI → 편집 서비스·명령 스키마 → AI·저장·렌더링 어댑터로 나눴습니다. "
              "Meta 모델 API와 Blender는 같은 편집 흐름에 연결할 후속 대상이며, 현재 연동 완료 기능은 아닙니다.", top, 10)
link("명령 계약·검증·실제 AI 연동 문서 ↗", "https://github.com/Hanzi-Cho/character-studio/blob/main/docs/features/codex-character-editing.md", M, top + 1, CW, 9)
c.showPage()

page(6)
top = para("동작하는 데모에서, 다시 쓰는 서비스로", M, H - 68, CW, 23, True, leading=32) - 13
top = para("현재 확인한 구현과 다음 검증", M, top, CW, 13, True, leading=20) - 7
top = para("공개 웹 데모, Codex의 참고 이미지 → 3D 초안, 공식 ChatGPT 연결 → 새 장식 생성, "
           "보관함 재열기·수정·JSON 복구를 확인했습니다. 자동 시험은 44개가 통과한 상태입니다. "
           "API 키의 유료 정상 호출, 폭넓은 자유 명령 성공률, 일반 사용자 수요, 모바일 실기기는 추가 검증이 필요합니다.",
           M, top, CW, 10, leading=16) - 17
top = para("본선까지 확인할 세 가지 목표", M, top, CW, 13, True, leading=20) - 8
for title, body in [
    ("편집 정확도", "자유 문장 30개로 요청 수행·유지 조건·실패 이유·응답 시간을 기록합니다. 목표는 두 조건을 모두 만족하는 27/30건 이상입니다."),
    ("실패와 복구", "오류·충돌 등 10개 시나리오에서 원본을 보존하고, 저장·내보내기·재가져오기로 같은 설정을 복원하는지 확인합니다."),
    ("비개발자 사용성", "5명에게 불러오기 → 수정 → 저장 → 다시 편집 과업을 맡깁니다. 목표는 4명 이상이 도움 없이 완료하는 것입니다."),
]:
    para(title, M, top, 95, 10.3, True, leading=16)
    top = para(body, M + 110, top, CW - 110, 9.7, leading=15.5) - 9
top = para("위 숫자는 앞으로 확인할 수용 목표이며 조사·평가 결과가 아닙니다. 예문 적용 성공은 AI 성공률에 포함하지 않습니다.",
           M, top, CW, 8.5, color=MUTED, leading=13) - 16
top = para("개선 순서 · 1인 개발 범위에 맞춰 단계적으로", M, top, CW, 13, True, leading=20) - 8
for title, body in [
    ("1  출시 준비", "자체 디자인·허가 자산 확보와 코드·이미지·모델 이용 조건 점검. AI 연결 안내, 백업·삭제, 접근성·모바일·오류 복구 검증."),
    ("2  반복 편집 품질", "얼굴·체형 등 유지할 속성과 변경할 부위를 명시. AI가 여러 시점의 렌더를 확인하고 어색한 부품을 수정하는 검증 루프 개발."),
    ("3  모델링 범위 확장", "Blender 세부 수정, 다른 기본 캐릭터와 3D 파일 내보내기. Meta 모델 API는 접근 승인 후 평가·연결."),
]:
    top = para(title, M, top, CW, 10.2, True, leading=16) - 3
    top = para(body, M, top, CW, 9.5, leading=15) - 8
top = para("11/1까지 AI 연결·사용자 과업을 검증하고 11/25까지 제출용 서비스·시연을 정리하는 것이 목표입니다. "
           "운영자 제공 AI 체험은 지원 크레딧·사용량 한도·호출당 비용을 확인한 후 도입을 검토합니다.",
           M, top, CW, 9, leading=14) - 15
top = para("출처·도구·사용 범위  ·  아래 파란 밑줄은 클릭 가능한 링크입니다", M, top, CW, 10.5, True, leading=16) - 7
link("코드·검증 기록 · GitHub ↗", "https://github.com/Hanzi-Cho/character-studio", M, top, 250, 8.7)
link("시각화 구조 참고 · Human Atlas ↗", "https://github.com/ashemag/human-atlas", M + 266, top, CW - 266, 8.7)
top -= 20
link("AI 개발·연동 · OpenAI Codex ↗", "https://github.com/Hanzi-Cho/character-studio/blob/main/docs/features/codex-character-editing.md", M, top, 250, 8.7)
link("문장 교정 스킬 · Humanizer ↗", "https://github.com/blader/humanizer", M + 266, top, CW - 266, 8.7)
top -= 22
top = para("현재 캐릭터는 치이카와를 참고해 코드로 만든 비공식 스터디이며, 캐릭터 이용 허락을 확보한 상태는 아닙니다. "
           "공개 대표 자산은 자체·허가 자산으로 교체할 계획입니다. Blender·cli-anything은 후속 기술 검토 대상입니다.",
           M, top, CW, 8.3, color=MUTED, leading=13) - 13
link("지금 바로 웹 데모 체험  →  hanzi-cho.github.io/character-studio/", DEMO_URL, M, top, CW, 10)
c.showPage()
c.save()
(ROOT / "docs/hackathon-proposal-copy.md").write_text("\n\n".join(copy_log) + "\n", encoding="utf-8")
assert OUT.stat().st_size < 20_000_000
print(f"{OUT}\n{OUT.stat().st_size:,} bytes / {PAGE_COUNT} pages")
