// PNG avatar expression set generator.
// Builds every expression as an SVG, then renders each one to a transparent PNG with Playwright.
//   node avatar/generate.js
// Change the colors in PALETTE, or add or remove expressions in EXPRESSIONS, then re-run.

const fs = require('fs');
const path = require('path');

const PALETTE = {
  outline: '#2a1f24',
  skin: '#ffe2cf',
  skinShade: '#f3c2a6',
  hair: '#3a2b45',
  hairHi: '#5d4870',
  eye: '#4d86d9',
  eyeDark: '#1f3d80',
  hoodie: '#6f8fc2',
  hoodieShade: '#53709f',
  mouth: '#8a2d3b',
  tongue: '#e8737f',
  blush: '#ff8fa3',
};

const SIZE = 1024;
const EYE_Y = 505;
const EYES = { L: 410, R: 614 };
const C = PALETTE;
const OL = `stroke="${C.outline}" stroke-linejoin="round" stroke-linecap="round"`;

// ---------- Base character ----------

const HEAD = 'M262 430 C262 262 380 190 512 190 C644 190 762 262 762 430 C762 602 650 722 512 722 C374 722 262 602 262 430 Z';
const BANGS = 'M246 450 C232 262 368 156 512 156 C656 156 792 262 778 450 L742 352 L706 392 L668 318 L612 378 L566 300 L512 362 L462 296 L414 374 L364 318 L320 392 L284 350 Z';

function backHair() {
  return `<path d="M214 480 C196 226 360 128 512 128 C664 128 828 226 810 480 C806 610 778 690 744 712 L280 712 C246 690 218 610 214 480 Z" fill="${C.hair}" ${OL} stroke-width="7"/>`;
}

function body() {
  return `
  <path d="M150 1024 C160 880 290 790 512 790 C734 790 864 880 874 1024 Z" fill="${C.hoodie}" ${OL} stroke-width="7"/>
  <path d="M450 670 L450 820 Q512 848 574 820 L574 670 Z" fill="${C.skinShade}" ${OL} stroke-width="6"/>
  <path d="M352 800 Q512 912 672 800 L646 786 Q512 868 378 786 Z" fill="${C.hoodieShade}" ${OL} stroke-width="6"/>
  <path d="M470 858 L462 958 M554 858 L562 958" stroke="#f4f1ea" stroke-width="9" stroke-linecap="round"/>
  <circle cx="462" cy="962" r="9" fill="#f4f1ea" ${OL} stroke-width="4"/>
  <circle cx="562" cy="962" r="9" fill="#f4f1ea" ${OL} stroke-width="4"/>`;
}

function ears() {
  return [262, 762].map(x => `<ellipse cx="${x}" cy="485" rx="32" ry="46" fill="${C.skin}" ${OL} stroke-width="6"/>`).join('');
}

function head() {
  return `<path d="${HEAD}" fill="${C.skin}" ${OL} stroke-width="7"/>
  <g clip-path="url(#headClip)"><path d="${BANGS}" transform="translate(0 22)" fill="${C.skinShade}"/></g>`;
}

function frontHair() {
  return `<path d="${BANGS}" fill="${C.hair}" ${OL} stroke-width="7"/>
  <g clip-path="url(#bangsClip)"><path d="M338 238 Q512 176 686 238" fill="none" stroke="${C.hairHi}" stroke-width="16" stroke-linecap="round" opacity="0.8"/></g>
  <path d="M512 160 C522 104 586 92 606 70 C596 124 556 148 532 164 Z" fill="${C.hair}" ${OL} stroke-width="6"/>`;
}

// ---------- Eyes ----------

function eyeOpen(cx, cy, { look = [0, 0], clip = null, teary = false, irisScale = 1 } = {}) {
  const [lx, ly] = look;
  const ix = cx + lx, iy = cy + ly;
  const id = `sc${cx}`;
  const clipAttr = clip ? ` clip-path="url(#${clip})"` : '';
  return `
  <clipPath id="${id}"><ellipse cx="${cx}" cy="${cy}" rx="44" ry="54"/></clipPath>
  <g${clipAttr}>
    <ellipse cx="${cx}" cy="${cy}" rx="44" ry="54" fill="#fff" ${OL} stroke-width="5"/>
    <g clip-path="url(#${id})">
      <ellipse cx="${ix}" cy="${iy + 4}" rx="${34 * irisScale}" ry="${46 * irisScale}" fill="url(#iris)" ${OL} stroke-width="4"/>
      <ellipse cx="${ix}" cy="${iy + 8}" rx="${15 * irisScale}" ry="${21 * irisScale}" fill="${C.outline}"/>
      <circle cx="${ix - 12}" cy="${iy - 16}" r="${teary ? 15 : 11}" fill="#fff"/>
      <circle cx="${ix + 13}" cy="${iy + 18}" r="${teary ? 8 : 5}" fill="#fff"/>
      ${teary ? `<ellipse cx="${cx}" cy="${cy + 50}" rx="44" ry="16" fill="#bfe6ff" opacity="0.85"/>` : ''}
    </g>
  </g>`;
}

function eye(type, side, opts = {}) {
  const cx = EYES[side], cy = EYE_Y;
  const s = side === 'L' ? 1 : -1; // +1 points toward the face center
  const lash = d => `<path d="${d}" fill="none" ${OL} stroke-width="11"/>`;
  switch (type) {
    case 'open':
    case 'teary':
      return eyeOpen(cx, cy, { ...opts, teary: type === 'teary' }) +
        lash(`M${cx - 50} ${cy - 26} Q${cx} ${cy - 76} ${cx + 50} ${cy - 26}`) +
        lash(`M${cx - s * 48} ${cy - 30} L${cx - s * 62} ${cy - 40}`);
    case 'wide':
      return eyeOpen(cx, cy, { ...opts, irisScale: 0.5 }) +
        lash(`M${cx - 48} ${cy - 40} Q${cx} ${cy - 84} ${cx + 48} ${cy - 40}`);
    case 'angry': {
      const outer = [cx - s * 60, cy - 46], inner = [cx + s * 60, cy - 6];
      const id = `ang${side}`;
      return `<clipPath id="${id}"><polygon points="${outer} ${inner} ${cx + s * 60},${cy + 80} ${cx - s * 60},${cy + 80}"/></clipPath>` +
        eyeOpen(cx, cy, { ...opts, clip: id }) +
        lash(`M${cx - s * 46} ${cy - 40} L${cx + s * 46} ${cy - 12}`);
    }
    case 'half': {
      const id = `half${side}`;
      const y = cy + (opts.lid ?? -4);
      return `<clipPath id="${id}"><rect x="${cx - 60}" y="${y}" width="120" height="100"/></clipPath>` +
        eyeOpen(cx, cy, { ...opts, clip: id }) +
        lash(`M${cx - 46} ${y + 2} Q${cx} ${y - 6} ${cx + 46} ${y + 2}`);
    }
    case 'happy':
      return lash(`M${cx - 42} ${cy + 14} Q${cx} ${cy - 40} ${cx + 42} ${cy + 14}`);
    case 'closed':
      return lash(`M${cx - 42} ${cy} Q${cx} ${cy + 30} ${cx + 42} ${cy}`) +
        lash(`M${cx - s * 40} ${cy + 2} L${cx - s * 54} ${cy - 8}`);
    case 'squeeze': // > <
      return lash(`M${cx - s * 34} ${cy - 32} L${cx + s * 30} ${cy} L${cx - s * 34} ${cy + 32}`);
    case 'dot':
      return `<ellipse cx="${cx}" cy="${cy}" rx="11" ry="14" fill="${C.outline}"/>`;
    case 'star': {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 20 : 50, a = -Math.PI / 2 + i * Math.PI / 5;
        pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
      }
      return `<polygon points="${pts.join(' ')}" fill="#ffd54a" ${OL} stroke-width="6"/>
        <circle cx="${cx - 8}" cy="${cy - 10}" r="7" fill="#fff"/>`;
    }
    case 'heart':
      return `<path d="${heartPath(cx, cy + 4, 1.25)}" fill="#ef4766" ${OL} stroke-width="6"/>
        <circle cx="${cx - 16}" cy="${cy - 12}" r="7" fill="#fff"/>`;
  }
  throw new Error(`unknown eye ${type}`);
}

// ---------- Brows ----------

function brow(type, side) {
  const cx = EYES[side];
  const s = side === 'L' ? 1 : -1;
  const o = cx - s * 42, i = cx + s * 40;
  const d = {
    neutral: `M${o} 428 Q${cx} 410 ${i} 426`,
    raised: `M${o} 408 Q${cx} 388 ${i} 406`,
    angry: `M${o} 404 Q${cx} 414 ${i} 440`,
    sad: `M${o} 436 Q${cx} 420 ${i} 402`,
    flat: `M${o} 428 L${i} 428`,
  }[type];
  if (!d) throw new Error(`unknown brow ${type}`);
  return `<path d="${d}" fill="none" stroke="${C.hair}" stroke-width="12" stroke-linecap="round"/>`;
}

// ---------- Mouths ----------

const filledMouth = (d, { tongue = true, teeth = false } = {}) => `
  <clipPath id="mouthClip"><path d="${d}"/></clipPath>
  <path d="${d}" fill="${C.mouth}"/>
  <g clip-path="url(#mouthClip)">
    ${teeth ? `<rect x="400" y="560" width="224" height="${teeth}" fill="#fff"/>` : ''}
    ${tongue ? `<ellipse cx="512" cy="${tongue === true ? 700 : tongue}" rx="46" ry="34" fill="${C.tongue}"/>` : ''}
  </g>
  <path d="${d}" fill="none" ${OL} stroke-width="6"/>`;
const line = d => `<path d="${d}" fill="none" ${OL} stroke-width="7"/>`;

const MOUTHS = {
  smile_small: () => line('M482 620 Q512 642 542 620'),
  smile: () => line('M464 612 Q512 658 560 612'),
  talk: () => filledMouth('M482 612 Q512 604 542 612 Q546 656 512 660 Q478 656 482 612 Z', { tongue: 676 }),
  open_smile: () => filledMouth('M458 606 Q512 618 566 606 Q562 678 512 680 Q462 678 458 606 Z'),
  laugh: () => filledMouth('M442 598 Q512 612 582 598 Q580 702 512 704 Q444 702 442 598 Z', { tongue: 718, teeth: 50 }),
  frown: () => line('M476 642 Q512 612 548 642'),
  frown_open: () => filledMouth('M466 654 Q512 592 558 654 Q512 642 466 654 Z', { tongue: 676 }),
  wobble: () => line('M462 634 q12.5 -12 25 0 t25 0 t25 0 t25 0'),
  wobble_open: () => filledMouth('M462 616 q12.5 -11 25 0 t25 0 t25 0 t25 0 Q560 666 512 668 Q464 666 462 616 Z', { tongue: 690 }),
  gritted: () => `<rect x="460" y="604" width="104" height="44" rx="14" fill="#fff" ${OL} stroke-width="6"/>
    <path d="M462 626 L562 626 M486 606 L486 646 M512 606 L512 646 M538 606 L538 646" ${OL} stroke-width="4"/>`,
  shout: () => filledMouth('M446 596 Q512 586 578 596 Q576 708 512 710 Q448 708 446 596 Z', { tongue: 724, teeth: 52 }),
  o: () => `<ellipse cx="512" cy="634" rx="20" ry="25" fill="${C.mouth}" ${OL} stroke-width="6"/>`,
  o_big: () => filledMouth('M512 600 C550 600 548 690 512 690 C476 690 474 600 512 600 Z', { tongue: 700 }),
  small_open: () => `<ellipse cx="512" cy="632" rx="15" ry="13" fill="${C.mouth}" ${OL} stroke-width="6"/>`,
  flat: () => line('M484 630 L540 630'),
  pout: () => line('M494 632 Q512 622 530 632'),
  smirk: () => line('M472 630 Q520 640 558 604'),
  smirk_talk: () => filledMouth('M472 626 Q520 620 560 600 Q560 652 512 656 Q478 652 472 626 Z', { tongue: 676 }),
  cat: () => line('M474 620 Q493 644 512 622 Q531 644 550 620'),
  cat_open: () => filledMouth('M474 616 Q493 638 512 618 Q531 638 550 616 Q548 670 512 672 Q476 670 474 616 Z', { tongue: 690 }),
};

// ---------- Extras ----------

function heartPath(x, y, k = 1) {
  const p = (dx, dy) => `${(x + dx * k).toFixed(1)} ${(y + dy * k).toFixed(1)}`;
  return `M${p(0, 30)} C${p(-46, 0)} ${p(-34, -38)} ${p(0, -18)} C${p(34, -38)} ${p(46, 0)} ${p(0, 30)} Z`;
}

function sparkle(x, y, r, fill = '#ffe066') {
  const q = r * 0.28;
  return `<path d="M${x} ${y - r} Q${x + q} ${y - q} ${x + r} ${y} Q${x + q} ${y + q} ${x} ${y + r} Q${x - q} ${y + q} ${x - r} ${y} Q${x - q} ${y - q} ${x} ${y - r} Z" fill="${fill}" ${OL} stroke-width="5"/>`;
}

function drop(x, y, k = 1) {
  return `<path d="M${x} ${y - 40 * k} Q${x + 24 * k} ${y - 4 * k} ${x + 21 * k} ${y + 10 * k} A${21 * k} ${21 * k} 0 1 1 ${x - 21 * k} ${y + 10 * k} Q${x - 24 * k} ${y - 4 * k} ${x} ${y - 40 * k} Z" fill="#a8dcff" ${OL} stroke-width="5"/>
    <ellipse cx="${x - 7 * k}" cy="${y + 8 * k}" rx="${5 * k}" ry="${9 * k}" fill="#fff"/>`;
}

const symbol = (txt, x, y, size, fill, rot = 0) =>
  `<text x="${x}" y="${y}" font-family="Inter, Arial, sans-serif" font-weight="900" font-size="${size}" fill="${fill}" stroke="${C.outline}" stroke-width="8" stroke-linejoin="round" paint-order="stroke" text-anchor="middle" transform="rotate(${rot} ${x} ${y})">${txt}</text>`;

const EXTRAS = {
  blush: () => [355, 669].map(x => `<ellipse cx="${x}" cy="602" rx="46" ry="22" fill="${C.blush}" opacity="0.55"/>`).join(''),
  blush_strong: () => [355, 669].map(x => `<ellipse cx="${x}" cy="600" rx="56" ry="28" fill="${C.blush}" opacity="0.8"/>
    <path d="M${x - 26} 610 l14 -20 M${x - 4} 610 l14 -20 M${x + 18} 610 l14 -20" stroke="#e85b78" stroke-width="5" stroke-linecap="round"/>`).join(''),
  vein: () => {
    const x = 704, y = 300, a = 9, b = 34;
    return `<g stroke="#e0313d" stroke-width="11" fill="none" stroke-linecap="round">
      <path d="M${x - b} ${y - a} Q${x - a} ${y - a} ${x - a} ${y - b}"/>
      <path d="M${x + a} ${y - b} Q${x + a} ${y - a} ${x + b} ${y - a}"/>
      <path d="M${x + b} ${y + a} Q${x + a} ${y + a} ${x + a} ${y + b}"/>
      <path d="M${x - a} ${y + b} Q${x - a} ${y + a} ${x - b} ${y + a}"/></g>`;
  },
  sweat: () => drop(752, 392),
  sweats: () => drop(752, 392) + drop(238, 360, 0.7) + drop(800, 470, 0.55),
  tears: () => ['L', 'R'].map(side => {
    const x = EYES[side] + (side === 'L' ? -6 : 6);
    return `<path d="M${x} 548 Q${x - 8} 640 ${x + 4} 760" fill="none" stroke="#8fd3ff" stroke-width="26" stroke-linecap="round" opacity="0.9"/>
      <path d="M${x} 548 Q${x - 8} 640 ${x + 4} 760" fill="none" stroke="#e8f7ff" stroke-width="7" stroke-linecap="round"/>`;
  }).join(''),
  tear_joy: () => drop(472, 468, 0.45),
  question: () => symbol('?', 850, 290, 190, '#ffd45c', 12) + symbol('?', 180, 250, 110, '#ffd45c', -14),
  exclaim: () => symbol('!', 860, 280, 200, '#ff5d5d', 10) +
    `<g stroke="${C.outline}" stroke-width="9" stroke-linecap="round">
      <path d="M218 270 L170 228 M250 214 L222 160 M202 336 L144 320"/>
      <path d="M806 214 L834 160 M774 170 L782 110"/></g>`,
  thought: () => `<circle cx="770" cy="292" r="13" fill="#fff" ${OL} stroke-width="5"/>
    <circle cx="812" cy="238" r="20" fill="#fff" ${OL} stroke-width="5"/>
    <path d="M806 176 C786 120 852 84 884 112 C910 66 990 88 978 138 C1012 160 996 216 952 210 C934 242 868 238 860 210 C818 220 800 196 806 176 Z" fill="#fff" ${OL} stroke-width="6"/>
    <circle cx="862" cy="160" r="9" fill="${C.outline}"/><circle cx="896" cy="160" r="9" fill="${C.outline}"/><circle cx="930" cy="160" r="9" fill="${C.outline}"/>`,
  hand_chin: () => `<path d="M520 1024 C540 930 562 860 582 806 L684 818 C694 890 704 960 722 1024 Z" fill="${C.hoodie}" ${OL} stroke-width="7"/>
    <path d="M574 760 C566 724 600 700 636 708 C676 716 690 756 670 790 C650 816 590 812 578 790 Z" fill="${C.skin}" ${OL} stroke-width="6"/>
    <path d="M582 742 C572 714 576 680 592 676 C608 672 612 700 610 728" fill="${C.skin}" ${OL} stroke-width="6"/>
    <path d="M612 744 Q640 740 660 752 M604 770 Q632 768 652 780" fill="none" ${OL} stroke-width="4"/>`,
  sparkles: () => sparkle(196, 300, 34) + sparkle(838, 380, 24) + sparkle(808, 186, 30) + sparkle(232, 520, 18),
  hearts: () => [[196, 290, 0.9], [834, 220, 1.1], [858, 420, 0.7], [232, 500, 0.55]]
    .map(([x, y, k]) => `<path d="${heartPath(x, y, k)}" fill="#ff6b8b" ${OL} stroke-width="5"/>`).join(''),
  zzz: () => symbol('z', 770, 320, 70, '#b8c6ff', -10) + symbol('z', 828, 250, 100, '#b8c6ff', -10) + symbol('Z', 900, 160, 140, '#b8c6ff', -10),
  gloom: () => `<g clip-path="url(#topClip)">
      <rect x="0" y="0" width="${SIZE}" height="560" fill="url(#gloomGrad)"/>
      <path d="M408 240 L408 400 M452 218 L452 372 M496 210 L496 352 M540 214 L540 360 M584 226 L584 390" stroke="#5b4a8c" stroke-width="8" stroke-linecap="round" opacity="0.75"/>
    </g>`,
  anger_marks: () => `<g stroke="#e0313d" stroke-width="10" stroke-linecap="round">
      <path d="M176 230 L214 270 M148 296 L198 306 M840 230 L802 270 M870 296 L820 306"/></g>`,
};

// ---------- Expressions ----------
// eyes: [left, right] or one type for both. talk: the mouth for the talking frame.

const EXPRESSIONS = {
  neutral:     { eyes: 'open', brows: 'neutral', mouth: 'smile_small', talk: 'talk' },
  blink:       { eyes: 'closed', brows: 'neutral', mouth: 'smile_small', talk: 'talk' },
  happy:       { eyes: 'happy', brows: 'raised', mouth: 'smile', talk: 'open_smile', extras: ['blush'] },
  laugh:       { eyes: 'squeeze', brows: 'raised', mouth: 'laugh', talk: 'laugh', extras: ['blush', 'tear_joy'] },
  excited:     { eyes: 'star', brows: 'raised', mouth: 'open_smile', talk: 'laugh', extras: ['blush', 'sparkles'] },
  love:        { eyes: 'heart', brows: 'raised', mouth: 'cat', talk: 'cat_open', extras: ['blush_strong', 'hearts'] },
  smug:        { eyes: 'half', eyeOpts: { look: [8, 0] }, brows: ['raised', 'flat'], mouth: 'smirk', talk: 'smirk_talk', extras: ['blush'] },
  thinking:    { eyes: 'open', eyeOpts: { look: [12, -14] }, brows: ['flat', 'raised'], mouth: 'pout', talk: 'small_open', extras: ['hand_chin', 'thought'] },
  confused:    { eyes: 'open', brows: ['raised', 'sad'], mouth: 'wobble', talk: 'wobble_open', extras: ['question'] },
  angry:       { eyes: 'angry', brows: 'angry', mouth: 'gritted', talk: 'shout', extras: ['vein'] },
  furious:     { eyes: 'angry', eyeOpts: { irisScale: 0.6 }, brows: 'angry', mouth: 'shout', talk: 'shout', extras: ['vein', 'anger_marks'] },
  annoyed:     { eyes: 'half', eyeOpts: { lid: 6 }, brows: 'flat', mouth: 'flat', talk: 'small_open', extras: ['vein'] },
  sad:         { eyes: 'teary', eyeOpts: { look: [0, 6] }, brows: 'sad', mouth: 'frown', talk: 'frown_open' },
  crying:      { eyes: 'squeeze', brows: 'sad', mouth: 'wobble_open', talk: 'frown_open', extras: ['tears'] },
  shocked:     { eyes: 'wide', brows: 'raised', mouth: 'o', talk: 'o_big', extras: ['exclaim'] },
  nervous:     { eyes: 'wide', brows: 'sad', mouth: 'wobble', talk: 'wobble_open', extras: ['sweats'] },
  embarrassed: { eyes: 'squeeze', brows: 'sad', mouth: 'wobble', talk: 'wobble_open', extras: ['blush_strong', 'sweat'] },
  defeated:    { eyes: 'dot', brows: 'sad', mouth: 'flat', talk: 'small_open', extras: ['gloom'] },
  sleepy:      { eyes: 'closed', brows: 'sad', mouth: 'small_open', talk: 'o', extras: ['zzz'] },
};

const BACK_EXTRAS = new Set(['thought', 'question', 'exclaim', 'sparkles', 'hearts', 'zzz', 'anger_marks']);

function render(expr, talking) {
  const both = v => (Array.isArray(v) ? v : [v, v]);
  const [eL, eR] = both(expr.eyes);
  const [bL, bR] = both(expr.brows);
  const extras = expr.extras || [];
  const back = extras.filter(e => BACK_EXTRAS.has(e)).map(e => EXTRAS[e]()).join('');
  const front = extras.filter(e => !BACK_EXTRAS.has(e)).map(e => EXTRAS[e]()).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
<defs>
  <clipPath id="headClip"><path d="${HEAD}"/></clipPath>
  <clipPath id="bangsClip"><path d="${BANGS}"/></clipPath>
  <clipPath id="topClip"><path d="${HEAD}"/><path d="${BANGS}"/></clipPath>
  <linearGradient id="iris" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${C.eyeDark}"/><stop offset="0.65" stop-color="${C.eye}"/><stop offset="1" stop-color="#9cc6ff"/>
  </linearGradient>
  <linearGradient id="gloomGrad" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#3a2a6a" stop-opacity="0.55"/><stop offset="1" stop-color="#3a2a6a" stop-opacity="0"/>
  </linearGradient>
</defs>
${back}
${backHair()}
${body()}
${ears()}
${head()}
${eye(eL, 'L', expr.eyeOpts)}
${eye(eR, 'R', expr.eyeOpts)}
${MOUTHS[talking ? expr.talk : expr.mouth]()}
${frontHair()}
${brow(bL, 'L')}
${brow(bR, 'R')}
${front}
</svg>`;
}

async function main() {
  const outDir = path.join(__dirname, 'out');
  const pngDir = path.join(outDir, 'png');
  const svgDir = path.join(outDir, 'svg');
  for (const d of [pngDir, svgDir]) fs.mkdirSync(d, { recursive: true });

  const frames = [];
  for (const [name, expr] of Object.entries(EXPRESSIONS)) {
    for (const talking of [false, true]) {
      const file = talking ? `${name}_talk` : name;
      const svg = render(expr, talking);
      fs.writeFileSync(path.join(svgDir, `${file}.svg`), svg);
      frames.push({ file, svg });
    }
  }

  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
  for (const { file, svg } of frames) {
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await page.locator('svg').screenshot({ path: path.join(pngDir, `${file}.png`), omitBackground: true });
  }

  // Contact sheet: every expression, idle and talking side by side.
  const names = Object.keys(EXPRESSIONS);
  const cell = 240, cols = 6;
  const sheet = `<html><body style="margin:0;background:#f3efe8;font-family:Inter,sans-serif">
    <div style="display:grid;grid-template-columns:repeat(${cols},${cell}px);gap:12px;padding:20px">
    ${names.flatMap(n => [n, `${n}_talk`]).map(f => `<div style="background:#fff;border-radius:14px;text-align:center;padding-bottom:8px">
      <img src="data:image/png;base64,${fs.readFileSync(path.join(pngDir, `${f}.png`)).toString('base64')}" width="${cell}" height="${cell}">
      <div style="font-size:18px;font-weight:600;color:#2a1f24">${f}</div></div>`).join('')}
    </div></body></html>`;
  const rows = Math.ceil((names.length * 2) / cols);
  await page.setViewportSize({ width: cols * cell + (cols - 1) * 12 + 40, height: rows * (cell + 40) + (rows - 1) * 12 + 40 });
  await page.setContent(sheet);
  await page.screenshot({ path: path.join(outDir, 'contact-sheet.png'), fullPage: true });
  await browser.close();
  console.log(`Rendered ${frames.length} PNGs to ${pngDir}`);
}

main().catch(err => { console.error(err); process.exit(1); });
