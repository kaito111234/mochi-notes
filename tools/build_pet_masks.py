"""Tạo mặt nạ quần áo + vị trí đầu cho từng khung hình bé Mochi (chạy lại khi đổi hình).

python tools/build_pet_masks.py <thư mục gói hình> [thư mục xem thử]

Ghi vào <gói>/masks/:
  <action>/<mood>/<phase>/<tên khung>.png  — RGB: R = áo khoác (phần vải tối), G = sơ mi/cổ áo trắng, B = cà vạt
  head.json — { "<đường dẫn khung>": [dx, dy, góc] } độ lệch đầu so với khung đứng yên đầu tiên (px khung 400, độ)
Renderer (src/pet/outfit.js) dùng mặt nạ để tô lại màu áo giữ nguyên nếp/viền, và dùng head.json để mũ kính bám theo đầu.
"""
import json
import os
import sys
from collections import deque

from PIL import Image

PACK = sys.argv[1]
PREVIEW = sys.argv[2] if len(sys.argv) > 2 else None
OUT = os.path.join(PACK, 'masks')


def lum(r, g, b):
    return 0.299 * r + 0.587 * g + 0.114 * b


def is_fill_dark(p):
    """Vải áo tối: xám trung tính, không phải viền xanh đậm."""
    r, g, b, a = p
    if a < 160:
        return False
    m = max(r, g, b)
    return m < 92 and (b - r) < 26 and lum(r, g, b) > 8


def is_outline(p):
    r, g, b, a = p
    return a >= 120 and max(r, g, b) < 110 and (b - r) >= 18


def is_white(p):
    r, g, b, a = p
    return a >= 160 and min(r, g, b) > 200 and max(r, g, b) - min(r, g, b) < 30


def is_tie(p):
    r, g, b, a = p
    return a >= 160 and b > 110 and b - r > 60 and g < 150 and r < 90


def components(w, h, px, pred):
    seen = bytearray(w * h)
    comps = []
    for y in range(h):
        for x in range(w):
            i = y * w + x
            if seen[i] or not pred(px[x, y]):
                continue
            q = deque([(x, y)])
            seen[i] = 1
            pts = []
            while q:
                cx, cy = q.popleft()
                pts.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if not seen[j] and pred(px[nx, ny]):
                            seen[j] = 1
                            q.append((nx, ny))
            comps.append(pts)
    return comps


def head_of(px, w, h):
    """Đỉnh đầu (bỏ sợi tóc dựng) + tâm ngang phần đầu."""
    rows = []
    for y in range(h):
        xs = [x for x in range(w) if px[x, y][3] > 128]
        rows.append(xs)
    top = None
    for y in range(h):
        if len(rows[y]) > 60:
            top = y
            break
    if top is None:
        return None
    sx = n = 0
    lx, rx = [], []
    for y in range(top, min(h, top + 110)):
        for x in rows[y]:
            sx += x
            n += 1
        if rows[y]:
            lx.append(min(rows[y]))
            rx.append(max(rows[y]))
    cx = sx / max(1, n)
    return cx, top


def build_mask(img, sleeping=False):
    w, h = img.size
    px = img.load()
    bb = img.getbbox()
    if not bb:
        return None
    x0, y0, x1, y1 = bb
    height = y1 - y0
    mask = Image.new('RGB', (w, h), (0, 0, 0))
    mp = mask.load()
    # áo khoác: các mảng vải tối lớn ở khoảng giữa thân (không phải nơ trên đầu, không phải tất/giày)
    jacket = set()
    for comp in components(w, h, px, is_fill_dark):
        if len(comp) < 120:
            continue
        cy = sum(p[1] for p in comp) / len(comp)
        rel = (cy - y0) / max(1, height)
        if 0.45 <= rel <= 0.80:
            # cắt phần chạm xuống tất/giày; khung ngủ ôm mèo bông đen thì chỉ lấy phần áo phía trên
            cut = 0.64 if sleeping else 0.83
            jacket.update(p for p in comp if (p[1] - y0) / max(1, height) <= cut)
    if not jacket:
        return None
    for (x, y) in jacket:
        mp[x, y] = (255, 0, 0)
    jx0 = min(p[0] for p in jacket); jx1 = max(p[0] for p in jacket)
    jy0 = min(p[1] for p in jacket); jy1 = max(p[1] for p in jacket)
    # sơ mi/cổ áo trắng + cà vạt: nằm trong hộp áo khoác, nửa trên
    for y in range(max(0, jy0 - 14), min(h, jy0 + int((jy1 - jy0) * 0.7))):
        for x in range(jx0, jx1 + 1):
            p = px[x, y]
            if (x, y) in jacket:
                continue
            if is_tie(p):
                mp[x, y] = (0, 0, 255)
            elif is_white(p):
                # chỉ nhận vùng trắng có áo khoác ở cả hai bên trên cùng hàng (cổ áo/ngực), bỏ vệt sáng tóc
                left = any((xx, y) in jacket for xx in range(max(jx0, x - 60), x))
                right = any((xx, y) in jacket for xx in range(x + 1, min(jx1 + 1, x + 60)))
                if left and right:
                    mp[x, y] = (0, 255, 0)
    return mask


def main():
    head = {}
    ref = None
    frames = []
    for root, _dirs, files in os.walk(PACK):
        if os.sep + 'masks' in root or root.endswith('masks') or os.sep + 'faces' in root or root.endswith('faces'):
            continue
        for f in sorted(files):
            if f.endswith('.png'):
                frames.append(os.path.join(root, f))
    frames.sort()
    for path in frames:
        rel = os.path.relpath(path, PACK).replace(os.sep, '/')
        img = Image.open(path).convert('RGBA')
        hp = head_of(img.load(), *img.size)
        if rel.startswith('idle/normal/loop/') and ref is None and hp:
            ref = hp
        m = build_mask(img, rel.startswith('sleep/'))
        if m is not None:
            dst = os.path.join(OUT, rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            m.save(dst, optimize=True)
        if hp:
            head[rel] = hp
    if ref is None:
        raise SystemExit('không có khung idle/normal/loop')
    out = {k: [round(v[0] - ref[0], 1), round(v[1] - ref[1], 1)] for k, v in head.items()}
    with open(os.path.join(OUT, 'head.json'), 'w', encoding='utf8') as fp:
        json.dump(out, fp, ensure_ascii=False, separators=(',', ':'))
    print('khung:', len(frames), 'mặt nạ:', sum(1 for _ in os.walk(OUT)), 'đầu tham chiếu:', ref)
    if PREVIEW:
        os.makedirs(PREVIEW, exist_ok=True)
        tiles = []
        for path in frames[::3]:
            rel = os.path.relpath(path, PACK).replace(os.sep, '/')
            mp = os.path.join(OUT, rel)
            img = Image.open(path).convert('RGBA')
            bg = Image.new('RGBA', img.size, (235, 235, 240, 255))
            bg.alpha_composite(img)
            if os.path.exists(mp):
                m = Image.open(mp).convert('RGB')
                over = Image.new('RGBA', img.size, (0, 0, 0, 0))
                op, mm = over.load(), m.load()
                for y in range(img.size[1]):
                    for x in range(img.size[0]):
                        r, g, b = mm[x, y]
                        if r or g or b:
                            op[x, y] = (255 if r else 0, 200 if g else 0, 255 if b else 0, 150)
                bg.alpha_composite(over)
            tiles.append(bg.resize((200, 200)))
        cols = 8
        sheet = Image.new('RGBA', (cols * 200, ((len(tiles) + cols - 1) // cols) * 200), (40, 40, 48, 255))
        for i, t in enumerate(tiles):
            sheet.paste(t, ((i % cols) * 200, (i // cols) * 200))
        sheet.save(os.path.join(PREVIEW, 'masks.png'))


main()
