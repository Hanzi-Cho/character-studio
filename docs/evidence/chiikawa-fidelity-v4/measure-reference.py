"""Reproduce approximate horizontal contour readings; no training or texture asset.
Run: python docs/evidence/chiikawa-fidelity-v4/measure-reference.py <normal.jpg>
The source image stays in ignored local research storage.
"""
import hashlib
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image

path = Path(sys.argv[1])
gray = np.asarray(Image.open(path).convert("L"))
assert gray.shape == (800, 800)
bbox600 = [30, 100, 565, 519]  # existing manually measured head, excluding ears
scale = 800 / 600
width = (bbox600[2] - bbox600[0]) * scale
rows = []
for v in [.10, .17, .25, .30, .45, .60, .75, .85, .90, .95]:
    y = round((100 + 419 * v) * scale)
    estimates = []
    for threshold in [240, 245, 250]:
        supported = np.where(np.convolve((gray[y] < threshold).astype(int), np.ones(3,dtype=int), mode="valid") == 3)[0]
        left, right = int(supported[0]), int(supported[-1] + 2)
        estimates.append({"threshold":threshold,"left":left,"right":right,"widthOverHead":(right-left)/width})
    rows.append({"v":v,"y":y,"estimates":estimates,"useForContour":v>=.17})
print(json.dumps({
    "source":"https://kitan.jp/wp-content/uploads/2024/12/normal.jpg",
    "sha256":hashlib.sha256(path.read_bytes()).hexdigest(),
    "sourceSize":[800,800],"manualBBoxIn600Frame":bbox600,
    "method":"PIL luminance < threshold, three consecutive pixels; horizontal range, normalized by manual head width; not semantic segmentation",
    "uncertainty":"White product/background boundary and ears are ambiguous. v=.10 excluded. Threshold sweep is sensitivity, not a statistical confidence interval. Manual bbox remains roughly +/-5px in 600-frame.",
    "rows":rows,
},indent=2))
