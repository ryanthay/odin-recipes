"""Render a voice timeline (from voice.py) into a PNGtuber-style video.

  python video/render.py video/build/kh1/timeline.json
  python video/render.py video/build/kh1/timeline.json --preview 30   # first 30 s only

Writes, next to the timeline: <name>.mp4, voiceover.wav, captions.srt and chapters.txt
(paste chapters.txt into the YouTube description for chapter markers).

The mouth flaps with the loudness of the voice, the face follows the [expression] tags,
and the avatar hops a little whenever the expression changes. Each chapter gets a 16:9
panel on the left: put an image at video/broll/<chapter number>.png (e.g. 03.png) to fill
it, or leave it as a title card and drop your footage over it in your editor.
"""

import argparse
import json
import math
import random
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
W, H = 1920, 1080
PANEL = (70, 90, 1080, 608)          # x, y, w, h  (16:9)
CAPTION_TOP, CAPTION_W = 735, 1080
AVATAR = 860
ACCENTS = ['#7aa2ff', '#ffb347', '#ff7aa8', '#6fe3b4', '#c39bff', '#ffd166', '#5ad1ff', '#ff8a65']
FONTS = ['C:/Windows/Fonts/segoeuib.ttf', 'C:/Windows/Fonts/arialbd.ttf',
         '/usr/share/fonts/opentype/inter/Inter-Bold.otf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
         '/System/Library/Fonts/Supplemental/Arial Bold.ttf']


def font(size, path=None):
    for p in [path] + FONTS:
        if p and Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default(size)


def wrap(draw, text, fnt, width):
    rows, row = [], ''
    for word in text.split():
        test = f'{row} {word}'.strip()
        if row and draw.textlength(test, font=fnt) > width:
            rows.append(row)
            row = word
        else:
            row = test
    return rows + [row] if row else rows


def schedule(timeline, line_gap, chapter_gap):
    """Place every line on the clock. Returns lines, chapters and total length in seconds."""
    t, lines, chapters = 0.0, [], []
    for item in timeline['items']:
        if item['type'] == 'chapter':
            # The gap belongs to the new chapter, so its title card shows before the first line.
            chapters.append({'title': item['title'], 'start': t, 'n': len(chapters) + 1})
            t += chapter_gap
        else:
            if not chapters:
                chapters.append({'title': '', 'start': 0.0, 'n': 1})
            lines.append({**item, 'start': t, 'end': t + item['duration'], 'chapter': len(chapters) - 1})
            t += item['duration'] + item.get('pause', line_gap)
    return lines, chapters, t + 0.6


def caption_pages(draw, fnt, line, rows_per_page=2):
    """Split a line's caption into pages that fit, timed by their share of the characters."""
    rows = wrap(draw, line['text'], fnt, CAPTION_W)
    pages = [rows[i:i + rows_per_page] for i in range(0, len(rows), rows_per_page)]
    total = sum(len(' '.join(p)) for p in pages)
    t, out = line['start'], []
    for p in pages:
        dur = (line['end'] - line['start']) * len(' '.join(p)) / total
        out.append({'rows': p, 'start': t, 'end': t + dur})
        t += dur
    return out


def mouth_track(audio, sr, fps, n_frames):
    """Per-frame loudness (0..1) and whether the mouth is open on that frame."""
    hop = sr / fps
    env = np.zeros(n_frames)
    for f in range(n_frames):
        seg = audio[int(f * hop):int((f + 1) * hop)]
        env[f] = np.sqrt(np.mean(seg ** 2)) if len(seg) else 0
    voiced = env[env > 0.005]
    env = np.clip(env / (np.percentile(voiced, 95) if len(voiced) else 1), 0, 1)
    local = np.convolve(env, np.ones(5) / 5, mode='same')
    is_open = (env > 0.12) & (env > 0.8 * local)
    # Keep each open or closed run at least 2 frames so the flap reads clearly.
    for f in range(1, n_frames - 1):
        if is_open[f] != is_open[f - 1] and is_open[f] != is_open[f + 1]:
            is_open[f] = is_open[f - 1]
    return env, is_open


def background(accent):
    y = np.linspace(0, 1, H)[:, None, None]
    top, bottom = np.array([24, 22, 42]), np.array([58, 38, 78])
    img = (top * (1 - y) + bottom * y) * np.ones((1, W, 1))
    xs, ys = np.meshgrid(np.arange(W), np.arange(H))
    img += ((xs + ys) // 60 % 2 == 0)[..., None] * 5      # subtle diagonal stripes
    bg = Image.fromarray(img.clip(0, 255).astype(np.uint8))
    d = ImageDraw.Draw(bg)
    x, y0, w, h = PANEL
    d.rounded_rectangle([x - 8, y0 - 8, x + w + 8, y0 + h + 8], 30, fill=accent)
    return bg


def panel(chapter, accent, broll_dir, fnt_path):
    x, y, w, h = PANEL
    img = None
    for ext in ('png', 'jpg', 'jpeg'):
        p = broll_dir / f'{chapter["n"]:02d}.{ext}'
        if p.exists():
            src = Image.open(p).convert('RGB')
            k = max(w / src.width, h / src.height)
            src = src.resize((math.ceil(src.width * k), math.ceil(src.height * k)), Image.LANCZOS)
            img = src.crop(((src.width - w) // 2, (src.height - h) // 2, (src.width - w) // 2 + w, (src.height - h) // 2 + h))
    if img is None:
        img = Image.new('RGB', (w, h), '#141221')
        d = ImageDraw.Draw(img)
        d.text((w // 2, h // 2 - 70), f'CHAPTER {chapter["n"]}', font=font(40, fnt_path), fill=accent, anchor='mm')
        title_font = font(84, fnt_path)
        for i, row in enumerate(wrap(d, chapter['title'], title_font, w - 120)):
            d.text((w // 2, h // 2 + 20 + i * 96), row, font=title_font, fill='white', anchor='mm')
        d.text((w // 2, h - 40), 'b-roll / gameplay goes here', font=font(26, fnt_path), fill='#55507a', anchor='mm')
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], 24, fill=255)
    return img, mask


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('timeline')
    ap.add_argument('--avatar-dir', default=str(ROOT / 'avatar' / 'out' / 'png'))
    ap.add_argument('--broll-dir', default=str(ROOT / 'video' / 'broll'))
    ap.add_argument('--out', help='output .mp4 (default: next to the timeline)')
    ap.add_argument('--fps', type=int, default=30)
    ap.add_argument('--line-gap', type=float, default=0.35, help='seconds between lines')
    ap.add_argument('--chapter-gap', type=float, default=1.5, help='extra seconds before each chapter')
    ap.add_argument('--preview', type=float, help='only render the first N seconds')
    ap.add_argument('--font', help='path to a .ttf/.otf font for captions and titles')
    ap.add_argument('--channel', default='RynTashi', help='channel name in the top corner ("" to hide)')
    ap.add_argument('--no-ai-label', action='store_true', help='hide the "AI-generated voice" label')
    args = ap.parse_args()

    tl_path = Path(args.timeline)
    build = tl_path.parent
    timeline = json.loads(tl_path.read_text(encoding='utf-8'))
    sr, fps = timeline['sample_rate'], args.fps
    lines, chapters, total = schedule(timeline, args.line_gap, args.chapter_gap)
    if args.preview:
        total = min(total, args.preview)
    n_frames = int(total * fps)

    # Voiceover track.
    audio = np.zeros(int(total * sr) + sr, dtype=np.float32)
    for ln in lines:
        with wave.open(str(build / ln['wav'])) as w:
            clip = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
        s = int(ln['start'] * sr)
        clip = clip[:max(len(audio) - s, 0)]
        audio[s:s + len(clip)] += clip
    audio = audio[:int(total * sr)]
    vo_path = build / 'voiceover.wav'
    with wave.open(str(vo_path), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((np.clip(audio, -1, 1) * 32767).astype(np.int16).tobytes())

    env, is_open = mouth_track(audio, sr, fps, n_frames)

    # Avatar frames, scaled once.
    faces = {}
    for p in Path(args.avatar_dir).glob('*.png'):
        faces[p.stem] = Image.open(p).convert('RGBA').resize((AVATAR, AVATAR), Image.LANCZOS)
    missing = {ln['expr'] for ln in lines} - faces.keys()
    if missing:
        sys.exit(f'No avatar PNG for: {", ".join(sorted(missing))}')

    # Captions, chapters and SRT.
    probe = ImageDraw.Draw(Image.new('RGB', (1, 1)))
    cap_font = font(46, args.font)
    pages = []
    for i, ln in enumerate(lines):
        for pg in caption_pages(probe, cap_font, ln):
            pages.append({**pg, 'line': i})
    stamp = lambda t: f'{int(t // 3600):02d}:{int(t % 3600 // 60):02d}:{int(t % 60):02d},{int(t * 1000 % 1000):03d}'
    (build / 'captions.srt').write_text(''.join(
        f'{k}\n{stamp(p["start"])} --> {stamp(p["end"])}\n{chr(10).join(p["rows"])}\n\n' for k, p in enumerate(pages, 1)),
        encoding='utf-8')
    yt = lambda t: f'{int(t // 3600)}:{int(t % 3600 // 60):02d}:{int(t % 60):02d}' if t >= 3600 else f'{int(t // 60)}:{int(t % 60):02d}'
    (build / 'chapters.txt').write_text(
        ''.join(f'{yt(c["start"])} {c["title"]}\n' for c in chapters if c['title']), encoding='utf-8')

    # Static layers, built once per chapter.
    chapter_bg = []
    for c in chapters:
        accent = ACCENTS[(c['n'] - 1) % len(ACCENTS)]
        bg = background(accent)
        img, mask = panel(c, accent, Path(args.broll_dir), args.font)
        bg.paste(img, PANEL[:2], mask)
        d = ImageDraw.Draw(bg)
        if args.channel:
            d.text((W - 60, 50), args.channel.upper(), font=font(40, args.font), fill='#ffffff', anchor='ra')
        if not args.no_ai_label:
            d.text((PANEL[0], 40), 'AI-generated voice', font=font(24, args.font), fill='#8c86b8', anchor='lm')
        chapter_bg.append(bg)

    # Per-frame state: which line, expression and caption page.
    line_at = np.full(n_frames, -1)
    for i, ln in enumerate(lines):
        line_at[int(ln['start'] * fps):int(ln['end'] * fps) + 1] = i
    page_at = np.full(n_frames, -1)
    for k, pg in enumerate(pages):
        page_at[int(pg['start'] * fps):int(pg['end'] * fps) + 1] = k
    chapter_at = np.zeros(n_frames, dtype=int)
    for k, c in enumerate(chapters):
        chapter_at[int(c['start'] * fps):] = k

    out = Path(args.out or build / f'{tl_path.parent.name}.mp4')
    ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
                           '-s', f'{W}x{H}', '-r', str(fps), '-i', '-', '-i', str(vo_path),
                           '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
                           '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', str(out)],
                          stdin=subprocess.PIPE)

    rng = random.Random(1)
    expr, last_line, changed_at, next_blink = 'neutral', -1, -100, fps * 3
    base_key, base = None, None
    smooth = 0.0
    for f in range(n_frames):
        li = line_at[f]
        if li >= 0 and li != last_line:
            last_line = li
            if lines[li]['expr'] != expr:
                expr, changed_at = lines[li]['expr'], f
        if li < 0 and last_line >= 0 and lines[last_line]['chapter'] != chapter_at[f] and expr != 'neutral':
            expr, changed_at = 'neutral', f

        talking = li >= 0 and is_open[f]
        face = expr
        if expr == 'neutral' and not talking:
            if f >= next_blink:
                face = 'blink'
                if f >= next_blink + 3:
                    next_blink = f + rng.randint(int(fps * 2.5), int(fps * 5))
        if talking and f'{face}_talk' in faces:
            face = f'{face}_talk'
        img = faces[face]

        # Motion: a hop on expression change, a bob with the voice, slow breathing.
        k = f - changed_at
        hop = math.sin(math.pi * k / 9) if 0 <= k <= 9 else 0
        smooth = 0.6 * smooth + 0.4 * (env[f] if li >= 0 else 0)
        dy = -30 * hop - 10 * smooth + 4 * math.sin(2 * math.pi * f / (fps * 3.5))
        if hop:
            sx, sy = 1 - 0.03 * hop, 1 + 0.04 * hop
            img = img.resize((int(AVATAR * sx), int(AVATAR * sy)), Image.BILINEAR)
        x = W - AVATAR - 20 + (AVATAR - img.width) // 2
        y = int(H - img.height + 40 + dy)

        key = (chapter_at[f], page_at[f])
        if key != base_key:
            base_key, base = key, chapter_bg[chapter_at[f]].copy()
            if page_at[f] >= 0:
                d = ImageDraw.Draw(base)
                for r, row in enumerate(pages[page_at[f]]['rows']):
                    d.text((PANEL[0], CAPTION_TOP + r * 62), row, font=cap_font, fill='white',
                           stroke_width=5, stroke_fill='#120f1f')
        frame = base.copy()
        frame.paste(img, (x, y), img)
        ff.stdin.write(frame.tobytes())
        if f % (fps * 30) == 0:
            print(f'  {f / fps / 60:4.1f} / {total / 60:.1f} min', flush=True)

    ff.stdin.close()
    if ff.wait():
        sys.exit('ffmpeg failed')
    print(f'Wrote {out}\n      {build / "captions.srt"}\n      {build / "chapters.txt"}')


if __name__ == '__main__':
    main()
