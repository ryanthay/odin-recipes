# PNG avatar expression set

A chibi-style avatar with 19 expressions for faceless, voiceover-style videos. Each expression comes as an idle frame and a talking frame (mouth open).

- `out/png/` holds 1024×1024 transparent PNGs: `<expression>.png` and `<expression>_talk.png`
- `out/svg/` holds the same images as SVGs, which scale to any size
- `out/contact-sheet.png` shows every frame on one page

Expressions: neutral, blink, happy, laugh, excited, love, smug, thinking, confused, angry, furious, annoyed, sad, crying, shocked, nervous, embarrassed, defeated, sleepy.

## Using it in a video
1. Generate the voiceover (see the voice clone handoff).
2. In your editor, place the expression PNG that fits each line of the script.
3. While you're talking, alternate `X.png` and `X_talk.png` every 2–4 frames. Use the idle frame during pauses.
4. A small bounce or a squash keyframe on expression changes makes it feel alive.

For a live or hotkey workflow, the PNGs load directly into veadotube mini or PNGTuber Plus.

## Changing the look
Edit `PALETTE` (hair, eyes, skin and hoodie colors) or `EXPRESSIONS` at the top of `generate.js`, then run:

```bash
node avatar/generate.js   # needs Node and Playwright (npm i playwright; npx playwright install chromium)
```
