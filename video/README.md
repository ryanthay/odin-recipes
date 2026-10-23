# Long-form video pipeline: script → your voice → PNG avatar video

```
scripts/kh1.txt ──voice.py──▶ build/kh1/lines/*.wav + timeline.json ──render.py──▶ build/kh1/kh1.mp4
  (you write)      (Chatterbox, your GPU)                                (anywhere)      + voiceover.wav
                                                                                         + captions.srt
                                                                                         + chapters.txt
```

## One-time setup (Windows, Git Bash)
The voice clone's venv already has torch and Chatterbox. Add Pillow for the renderer:
```bash
PY="/c/Users/Ryan/Downloads/Ryntashi tiktok comeback/voice-clone/.venv/Scripts/python.exe"
~/.local/bin/uv pip install --python "$PY" pillow numpy
```
You also need `ffmpeg` on your PATH, which you already use.

## Making a video
1. **Write the script** in `video/scripts/<name>.txt`. The header of `kh1.txt` documents the format:
   ```
   ## Chapter title
   [excited] One idea per line, one or two sentences.
   [sad seed=12] Change the seed to re-roll a take you don't like.
   ```
2. **Generate the voice** (from the repo folder):
   ```bash
   "$PY" video/voice.py video/scripts/kh1.txt --voice B      # or --voice A
   ```
3. **Listen and fix the lines you don't like.** Add `seed=` or `exag=` to those lines and run step 2 again. Only the changed lines get regenerated, and a long script still takes seconds to update.
4. **Render.** Run a quick preview first, then the whole video:
   ```bash
   "$PY" video/render.py video/build/kh1/timeline.json --preview 30
   "$PY" video/render.py video/build/kh1/timeline.json
   ```
5. **Finish in your editor** (DaVinci Resolve is free, or CapCut):
   - Put gameplay footage or screenshots over the chapter panel. It's 1080×608 at x=70, y=90. Or drop an image at `video/broll/03.png` and re-render, and chapter 3 uses it.
   - Add music under the voice. `voiceover.wav` is the voice on its own, so you can duck the music against it.
   - Upload `captions.srt` to YouTube as subtitles, and paste `chapters.txt` into the description.
6. **Disclose the AI voice.** When you upload, tick YouTube's "altered or synthetic content" box. The video shows an "AI-generated voice" label, which `--no-ai-label` hides.

## What the renderer does
- **Face:** follows each line's `[expression]` and does a little hop whenever the expression changes.
- **Mouth:** opens on the voice's syllable peaks and closes in the dips, so it flaps naturally. It isn't lip-sync, so it can't look uncanny.
- **Motion and blinks:** a gentle bob with the voice, slow breathing, and random blinks on the neutral face.
- **Chapters:** each chapter gets a title card, a color, and a YouTube timestamp. Captions are paged to fit.

## Writing tips for long form
- **Pace your faces.** Change the expression every one or two lines, and save the big faces (`shocked`, `furious`, `crying`) for the beats that earn them.
- **Short lines sound better.** Chatterbox stays closer to your voice on short sentences, and the captions read better too.
- **Pronunciation:** if a name comes out wrong, use `@say Name = spoken` (applies everywhere) or `{Name|spoken}` (one spot). The captions still show the real spelling.
- **Pauses:** use `pause=1.0` after a punchline or a chapter's last line to give it a beat.
- **Length:** a 10-minute video is about 1,400–1,600 words, roughly 150 lines.
