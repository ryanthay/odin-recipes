"""Turn a tagged script into one voice clip per line, plus a timeline for render.py.

  # Your voice (on the PC with the RTX 3070, using the voice-clone venv):
  python video/voice.py video/scripts/kh1.txt --engine chatterbox --voice B

  # Robotic placeholder voice, no GPU needed (for testing the pipeline):
  python video/voice.py video/scripts/kh1.txt --engine espeak

Clips are cached by their text and settings, so after editing the script only the
changed lines are regenerated. See video/scripts/kh1.txt for the script format.
"""

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SAMPLE_RATE = 48000
DEFAULT_VOICE_DIR = os.environ.get(
    'VOICE_CLONE_DIR', r'C:\Users\Ryan\Downloads\Ryntashi tiktok comeback\voice-clone')
VOICE_REFS = {'A': 'samples/ref-main.wav', 'B': 'samples/ref-alt.wav'}

# Delivery that fits each face: (exaggeration, cfg). Lower cfg keeps energetic lines from rushing.
DELIVERY = {
    'neutral': (0.5, 0.45), 'blink': (0.5, 0.45), 'thinking': (0.45, 0.45),
    'happy': (0.6, 0.45), 'love': (0.6, 0.45), 'smug': (0.55, 0.45),
    'confused': (0.55, 0.45), 'nervous': (0.55, 0.4), 'embarrassed': (0.6, 0.4),
    'laugh': (0.75, 0.35), 'excited': (0.75, 0.35), 'shocked': (0.75, 0.35),
    'angry': (0.75, 0.35), 'furious': (0.85, 0.3), 'annoyed': (0.5, 0.45),
    'sad': (0.4, 0.5), 'crying': (0.5, 0.45), 'defeated': (0.35, 0.5), 'sleepy': (0.3, 0.5),
}
LINE_RE = re.compile(r'^\[(\w+)([^\]]*)\]\s*(.+)$')
INLINE_RE = re.compile(r'\{([^|}]+)\|([^}]+)\}')


def parse_script(path, known_exprs):
    items, say = [], {}
    for n, raw in enumerate(Path(path).read_text(encoding='utf-8').splitlines(), 1):
        line = raw.strip()
        if not line:
            continue
        if line.startswith('##'):
            items.append({'type': 'chapter', 'title': line.lstrip('#').strip()})
        elif line.startswith('#'):
            continue
        elif line.startswith('@say'):
            word, _, spoken = line[4:].partition('=')
            say[word.strip()] = spoken.strip()
        else:
            m = LINE_RE.match(line)
            if not m:
                sys.exit(f'{path}:{n}: expected "[expression] text", got: {raw}')
            expr, opts, text = m.groups()
            if known_exprs and expr not in known_exprs:
                sys.exit(f'{path}:{n}: unknown expression "{expr}". Known: {" ".join(sorted(known_exprs))}')
            item = {'type': 'line', 'line_no': n, 'expr': expr,
                    'text': INLINE_RE.sub(r'\1', text), 'spoken': INLINE_RE.sub(r'\2', text)}
            for opt in opts.split():
                key, _, val = opt.partition('=')
                if key not in ('exag', 'cfg', 'seed', 'pause'):
                    sys.exit(f'{path}:{n}: unknown option "{key}"')
                item[key] = int(val) if key == 'seed' else float(val)
            items.append(item)
    for item in items:
        if item['type'] == 'line':
            for word, spoken in say.items():
                item['spoken'] = re.sub(rf'\b{re.escape(word)}\b', spoken, item['spoken'], flags=re.I)
    return items


def sentences(text):
    return [s for s in re.split(r'(?<=[.!?])\s+', text.strip()) if s]


def trim(audio, sr, threshold=0.01, pad=0.04):
    loud = np.flatnonzero(np.abs(audio) > threshold)
    if not len(loud):
        return audio
    p = int(pad * sr)
    return audio[max(loud[0] - p, 0):loud[-1] + p]


def read_wav(path):
    with wave.open(str(path)) as w:
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
        if w.getnchannels() > 1:
            data = data.reshape(-1, w.getnchannels()).mean(axis=1)
        return data, w.getframerate()


def write_wav(path, audio, sr):
    pcm = (np.clip(audio, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


class Chatterbox:
    def __init__(self, ref, device):
        import torch
        from chatterbox.tts import ChatterboxTTS
        device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        print(f'Loading Chatterbox on {device}...')
        self.torch, self.ref = torch, str(ref)
        self.model = ChatterboxTTS.from_pretrained(device=device)
        self.sr = self.model.sr

    def say(self, text, exag, cfg, seed):
        self.torch.manual_seed(seed)
        wav = self.model.generate(text, audio_prompt_path=self.ref, exaggeration=exag, cfg_weight=cfg)
        return wav.squeeze(0).cpu().numpy()


class Espeak:
    sr = 22050

    def __init__(self):
        self.exe = shutil.which('espeak-ng') or shutil.which('espeak')
        if not self.exe:
            sys.exit('espeak-ng is not installed (it is only the placeholder engine; use --engine chatterbox)')

    def say(self, text, exag, cfg, seed):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / 'a.wav'
            speed, pitch = int(150 + 60 * exag), int(35 + 40 * exag)
            subprocess.run([self.exe, '-v', 'en-us', '-s', str(speed), '-p', str(pitch), '-w', str(out), text], check=True)
            audio, self.sr = read_wav(out)
            return audio


def to_48k(audio, sr, dest):
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / 'in.wav'
        write_wav(src, audio, sr)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(src), '-ar', str(SAMPLE_RATE),
                        '-ac', '1', '-sample_fmt', 's16', str(dest)], check=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('script')
    ap.add_argument('--engine', choices=['chatterbox', 'espeak'], default='chatterbox')
    ap.add_argument('--voice', choices=['A', 'B'], default='B', help='reference voice from the voice-clone folder')
    ap.add_argument('--ref', help='any other reference clip (overrides --voice)')
    ap.add_argument('--voice-dir', default=DEFAULT_VOICE_DIR, help='the voice-clone folder (or set VOICE_CLONE_DIR)')
    ap.add_argument('--seed', type=int, default=7)
    ap.add_argument('--sentence-pause', type=float, default=0.18)
    ap.add_argument('--device', help='cuda or cpu (default: cuda if available)')
    ap.add_argument('--out', help='build folder (default: video/build/<script name>)')
    args = ap.parse_args()

    png_dir = ROOT / 'avatar' / 'out' / 'png'
    known = {p.stem for p in png_dir.glob('*.png') if not p.stem.endswith('_talk')}
    items = parse_script(args.script, known)
    out = Path(args.out or ROOT / 'video' / 'build' / Path(args.script).stem)
    (out / 'lines').mkdir(parents=True, exist_ok=True)

    if args.engine == 'chatterbox':
        ref = Path(args.ref or Path(args.voice_dir) / VOICE_REFS[args.voice])
        if not ref.exists():
            sys.exit(f'Reference clip not found: {ref}\nPass --voice-dir or --ref.')
        st = ref.stat()
        voice_id = f'{ref.resolve()}:{st.st_size}:{int(st.st_mtime)}'
    else:
        ref, voice_id = None, 'espeak'

    engine = None
    lines = [i for i in items if i['type'] == 'line']
    for k, item in enumerate(lines, 1):
        exag0, cfg0 = DELIVERY.get(item['expr'], (0.55, 0.45))
        exag, cfg, seed = item.get('exag', exag0), item.get('cfg', cfg0), item.get('seed', args.seed)
        key = json.dumps([args.engine, voice_id, item['spoken'], exag, cfg, seed, args.sentence_pause])
        wav = out / 'lines' / f'{hashlib.sha1(key.encode()).hexdigest()[:16]}.wav'
        if not wav.exists():
            if engine is None:
                engine = Chatterbox(ref, args.device) if args.engine == 'chatterbox' else Espeak()
            print(f'[{k}/{len(lines)}] {item["expr"]}: {item["spoken"]}')
            parts = []
            for s in sentences(item['spoken']):
                parts += [trim(engine.say(s, exag, cfg, seed), engine.sr), np.zeros(int(args.sentence_pause * engine.sr))]
            to_48k(np.concatenate(parts[:-1]), engine.sr, wav)
        audio, _ = read_wav(wav)
        item.update(wav=f'lines/{wav.name}', duration=len(audio) / SAMPLE_RATE)
        item.pop('spoken')

    timeline = {'script': str(Path(args.script)), 'engine': args.engine,
                'voice': args.voice if args.engine == 'chatterbox' else None,
                'sample_rate': SAMPLE_RATE, 'items': items}
    (out / 'timeline.json').write_text(json.dumps(timeline, indent=1), encoding='utf-8')
    total = sum(i['duration'] for i in lines)
    print(f'{len(lines)} lines, {total / 60:.1f} min of speech -> {out / "timeline.json"}')


if __name__ == '__main__':
    main()
