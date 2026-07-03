"""ScholarLink OG Image 생성 — 새 카피 반영 (1200x630 PNG)"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

OUT = r"D:\SC_link\client\public\og-image.png"
W, H = 1200, 630

# ── 폰트 (시스템 한국어 폰트) ──
FONT_BRAND     = r"C:\Windows\Fonts\malgunbd.ttf"   # ScholarLink (Bold)
FONT_TITLE     = r"C:\Windows\Fonts\malgunbd.ttf"   # 메인 타이틀 (ExtraBold 느낌)
FONT_SUBTITLE  = r"C:\Windows\Fonts\malgun.ttf"     # 영문 서브
FONT_KEYWORD   = r"C:\Windows\Fonts\malgunbd.ttf"   # 키워드 pill
FONT_DOMAIN    = r"C:\Windows\Fonts\consolab.ttf"   # 도메인 (모노스페이스)

# ── 그라데이션 배경 (135deg approximation) ──
def hex2rgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

C_TOP    = hex2rgb('#0b1220')   # 좌상단 (어두운 네이비)
C_MID    = hex2rgb('#0f1e3d')   # 중앙
C_BOT    = hex2rgb('#0e7490')   # 우하단 (사이안 톤)

img = Image.new('RGB', (W, H), C_TOP)
px = img.load()

# 대각선 그라데이션: 점 (x,y)에 대해 (x/W + y/H) / 2 → 0..1
# 0 → C_TOP, 0.5 → C_MID, 1 → C_BOT
def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
def grad(t):
    if t < 0.5:
        return lerp(C_TOP, C_MID, t / 0.5)
    else:
        return lerp(C_MID, C_BOT, (t - 0.5) / 0.5)

for y in range(H):
    for x in range(W):
        t = (x / W + y / H) / 2
        px[x, y] = grad(t)

# 부드럽게
img = img.filter(ImageFilter.SMOOTH)

draw = ImageDraw.Draw(img, 'RGBA')

# ── 좌측 사이드바 (사이안 그라데이션) ──
side_w = 10
for y in range(H):
    t = y / H
    c = lerp(hex2rgb('#14b8a6'), hex2rgb('#06b6d4'), t)
    draw.line([(0, y), (side_w, y)], fill=c)

# ── 우측 상단 점선 원 ──
cx, cy, r = 1080, 80, 230
# mask: 원 안쪽만 점 패턴
dot_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
dot_draw = ImageDraw.Draw(dot_layer)
dot_color = (203, 213, 225, 110)  # 연한 회색, 반투명
spacing = 10
for yy in range(cy - r - 40, cy + r + 40, spacing):
    for xx in range(cx - r - 40, cx + r + 40, spacing):
        dx, dy = xx - cx, yy - cy
        d2 = dx*dx + dy*dy
        if d2 <= r*r:
            dot_draw.ellipse([xx-1.3, yy-1.3, xx+1.3, yy+1.3], fill=dot_color)
img = Image.alpha_composite(img.convert('RGBA'), dot_layer).convert('RGB')
draw = ImageDraw.Draw(img, 'RGBA')

# ── 우측 하단 막대 그래픽 ──
bar_x = 920
bar_y = 540   # base line
bar_w = 36
bar_gap = 14
bar_heights = [70, 130, 105, 80]
for i, h in enumerate(bar_heights):
    x0 = bar_x + i * (bar_w + bar_gap)
    y0 = bar_y - h
    x1 = x0 + bar_w
    y1 = bar_y
    # 그라데이션 (위→아래 사이안→딥사이안) — 단순 두 단
    for y in range(y0, y1):
        t = (y - y0) / max(1, (y1 - y0))
        c = lerp(hex2rgb('#22d3ee'), hex2rgb('#0891b2'), t)
        draw.line([(x0, y), (x1, y)], fill=(*c, 230))
    draw.rounded_rectangle([x0, y0, x1, y1], radius=4, outline=None)
# 바닥선
draw.rectangle([bar_x - 10, bar_y, bar_x + 4 * (bar_w + bar_gap) - bar_gap + 10, bar_y + 3], fill=(6, 182, 212, 255))

# ── 텍스트: ScholarLink (브랜드) ──
f_brand = ImageFont.truetype(FONT_BRAND, 54)
brand = "ScholarLink"
draw.text((80, 70), brand, font=f_brand, fill=(45, 212, 191, 255))
# 밑줄
tb = draw.textbbox((80, 70), brand, font=f_brand)
underline_y = tb[3] + 12
draw.rectangle([80, underline_y, tb[2], underline_y + 5], fill=(45, 212, 191, 255))

# ── 메인 타이틀: "OA논문 검색 + 대학원·연구원 채용" ──
f_title = ImageFont.truetype(FONT_TITLE, 62)
title_left = "OA논문 검색"
title_plus = "+"
title_right = "대학원·연구원 채용"

def text_w(s, font):
    bb = draw.textbbox((0, 0), s, font=font)
    return bb[2] - bb[0], bb

w_left, _ = text_w(title_left, f_title)
w_plus, _ = text_w(title_plus, f_title)
w_right, _ = text_w(title_right, f_title)
total_w = w_left + 24 + w_plus + 24 + w_right
# 한 줄 가운데 정렬 (또는 좌측 정렬)
y_title = 220
x_cur = 80
draw.text((x_cur, y_title), title_left, font=f_title, fill=(255, 255, 255, 255))
x_cur += w_left + 24
# + 기호는 사이안
f_plus = ImageFont.truetype(FONT_TITLE, 56)
w_plus2, _ = text_w(title_plus, f_plus)
draw.text((x_cur, y_title + 2), title_plus, font=f_plus, fill=(45, 212, 191, 255))
x_cur += w_plus2 + 24
draw.text((x_cur, y_title), title_right, font=f_title, fill=(255, 255, 255, 255))

# ── 서브 영문 ──
f_sub = ImageFont.truetype(FONT_SUBTITLE, 40)
draw.text((80, 312), "Search OA paper & Hiring Notice", font=f_sub, fill=(103, 232, 249, 255))

# ── 키워드 pill ──
f_kw = ImageFont.truetype(FONT_KEYWORD, 22)
keywords = ["DOI", "PMID", "arXiv", "저널 URL"]
x_cur = 80
y_kw = 440
for kw in keywords:
    bb = draw.textbbox((0, 0), kw, font=f_kw)
    kw_w = bb[2] - bb[0]
    pad_x, pad_y = 16, 8
    pill_w = kw_w + pad_x * 2
    pill_h = 22 + pad_y * 2
    # outline + fill
    draw.rounded_rectangle(
        [x_cur, y_kw, x_cur + pill_w, y_kw + pill_h],
        radius=pill_h // 2,
        fill=(13, 148, 136, 40),
        outline=(94, 234, 212, 180),
        width=2,
    )
    # 텍스트 수직 중앙
    text_y = y_kw + (pill_h - (bb[3] - bb[1])) // 2 - 2
    draw.text((x_cur + pad_x, text_y), kw, font=f_kw, fill=(94, 234, 249, 255))
    x_cur += pill_w + 12

# ── 도메인 ──
try:
    f_domain = ImageFont.truetype(FONT_DOMAIN, 26)
except OSError:
    f_domain = ImageFont.truetype(r"C:\Windows\Fonts\consola.ttf", 26)
draw.text((80, 555), "wheeljah.github.io/SC_link", font=f_domain, fill=(148, 163, 184, 255))

# ── 저장 ──
img.convert('RGB').save(OUT, 'PNG', optimize=True)
print(f"OK: {OUT}  ({os.path.getsize(OUT)} bytes, {img.size})")