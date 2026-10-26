# HANZI profile character

`profile.html` is a standalone, read-only Three.js view of the public GitHub avatar.
The existing editor and saved characters are separate from this page.

## Presentation

- Warm background, softly blurred directional floor shadow, no grid or axes.
- Tall Usagi ears, pink heart sunglasses, open smile, raised hands.
- Orange jersey with `HANZI`, `Hanwha`, and stylized `Eagles` lettering.
- Orange/white cheering bat and Pink Bean wand, following the avatar illustration.
- Drag, wheel/pinch, arrow keys, and reset; rendering stops when idle.
- Device pixel ratio is capped at 2. Shared primitive buffers and one small generated
  lettering texture avoid storing a large model or external reference photographs.
- The profile README uses a compressed WebP still linked to this page. GitHub's
  built-in STL renderer cannot reproduce this colored presentation or hide its grid.

Build with `pnpm build:web`. The output is `dist-web/profile.html` plus a minified,
content-hashed JavaScript entry. The editor bundle is not loaded by this page.

## Reference decisions

The public avatar is authoritative for the particular outfit and accessories:
https://avatars.githubusercontent.com/u/273769743?v=4

The supplied Character Studio screenshot is the reference for floor shadow and
background treatment. This is a fan interpretation, not an official character model.
The original image is cropped at the torso, so the feet, back, and hidden surfaces
are inferred. The lettering is a legible interpretation, not an exact licensed logo.

Additional reference research:

- Usagi: https://toy.bandai.co.jp/ja/series/chiikawa/
- Hanwha official merchandise links: https://linktr.ee/hanwhaeagles_soori
- Orange uniform: https://eaglesshop.kr/product/이글스-오렌지-레플리카-유니폼/663/
- Cheering bats: https://eaglesshop.kr/category/응원용품/72/
- MapleStory collaboration merchandise: https://peak.nexon.com/post/1467
- KT official merchandise: https://ktwizstore.co.kr/category/메이플/130/

The avatar's Pink Bean-headed wand is preserved even though current shop imagery
also shows a different bat design. Reference images are not bundled in this page.
