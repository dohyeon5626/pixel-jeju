// ─────────────────────────────────────────────────────────────
//  픽셀 제주 — 아트 코어
//  · 모든 그림은 아래 한 벌의 팔레트에서만 색을 고른다 (통일감)
//  · 외곽선은 검정이 아니라 맞닿은 색을 어둡게 한 "셀아웃"
//  · 노이즈 점 대신 덩어리(클러스터)로 질감을 낸다
// ─────────────────────────────────────────────────────────────
'use strict';

// 화면 426×240 (데스크톱에서 픽셀이 덜 커 보이게). 세계는 높이 180 좌표 그대로 VOFF만큼 내려 그림
const W = 426, H = 240, VIEW_H = 180, VOFF = H - VIEW_H, GROUND = 156, WORLD_W = 470;

// ── 팔레트 ───────────────────────────────────────────────────
const C = {
  ink: '#201614', line: '#3b2420',
  skin: ['#8a4248', '#c47058', '#f2a982', '#ffd5b0'],
  org: ['#8a2e1e', '#c4501c', '#f57d1f', '#ffb43c', '#ffe08a'],
  leaf: ['#1a4236', '#26683f', '#3f9a45', '#7cc44a', '#c8ea6a'],
  grass: ['#173a33', '#25573a', '#3a7d38', '#5fae3e', '#9bd655'],
  cloth: ['#7a7268', '#b0a89c', '#e2dccf', '#fffaf0'],
  blue: ['#1a2a5a', '#21418a', '#2b6bc4', '#4aa3ec', '#8fd8ff'],
  red: ['#6a1e36', '#a82a3e', '#e8454a', '#ff8a7a'],
  purp: ['#3e2846', '#62406a', '#8e6690', '#bc9ab8'],
  pink: ['#7a2a52', '#b8466e', '#f07898', '#ffc0d0'],
  stone: ['#2e2826', '#4a423e', '#6c625c', '#9a908a', '#c9c0b8'],
  soil: ['#33191e', '#522c26', '#7a4530', '#a8683f', '#d49a6a'],
  yel: ['#b06a20', '#e8a82a', '#ffd84a', '#fff5a0'],
  sky: ['#3d86d6', '#5fb2f0', '#8fd3ff', '#bfefff', '#e8f8ff'],
  wood: ['#3b2027', '#5e3428', '#8a5232', '#b8784a'],
};
const INK = C.ink;

// 담백한 톤: 채도를 눌러주고 아주 살짝 따뜻하게 (전체 팔레트 공통 그레이딩)
// 이벤트 초상(픽셀 사진)과 같은 결: 채도는 자연스럽게 살리고, 그늘은 보라 대신 따뜻한 갈색 쪽으로
function mute(h, sat = 0.86) {
  const n = parseInt(h.slice(1, 7), 16), r = n >> 16 & 255, gg = n >> 8 & 255, b = n & 255;
  const L = r * 0.3 + gg * 0.59 + b * 0.11;
  const f = (c, w) => Math.max(0, Math.min(255, Math.round((L + (c - L) * sat) * 0.95 + w)));
  return '#' + ((1 << 24) | (f(r, 11) << 16) | (f(gg, 6) << 8) | f(b, 0)).toString(16).slice(1);
}
const muteAll = a => a.map(c => mute(c));
for (const k in C) if (Array.isArray(C[k])) C[k] = muteAll(C[k]);

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
// 픽셀을 다시 읽어 오는 캔버스: CPU 메모리에 두어 GPU에서 읽어 오느라 멈칫하지 않게 (그리는 속도는 같음)
const mkR = (w, h) => { const c = mk(w, h); c.getContext('2d', { willReadFrequently: true }); return c; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

function rng(seed) {
  return () => {
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash2(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s = 0) => vnoise(x, y, s) * 0.6 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.1;

// ── 색 계산 ──────────────────────────────────────────────────
const _rgb = new Map();
function rgb(h) {
  let v = _rgb.get(h);
  if (!v) { const n = parseInt(h.slice(1, 7), 16); v = [n >> 16 & 255, n >> 8 & 255, n & 255]; _rgb.set(h, v); }
  return v;
}
const hex = (r, g, b) => '#' + ((1 << 24) | (clamp(Math.round(r), 0, 255) << 16) | (clamp(Math.round(g), 0, 255) << 8) | clamp(Math.round(b), 0, 255)).toString(16).slice(1);
const _mixC = new Map();
function mix(a, b, t) {
  const k = a + b + t; let v = _mixC.get(k); if (v) return v;
  const A = rgb(a), B = rgb(b); v = hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  if (_mixC.size > 6000) _mixC.clear(); _mixC.set(k, v); return v;
}

// 램프에서 값 v(0..1)에 맞는 색. dither=0이면 경계를 딱 끊는다(덩어리감)
function rampPick(r, v, x, y, dither = 1) {
  const f = clamp(v, 0, 0.9999) * (r.length - 1), i = Math.floor(f), fr = f - i;
  const t = 0.5;   // 베이어 디더는 바둑판처럼 보여서 쓰지 않음
  return r[Math.min(r.length - 1, i + (fr > t ? 1 : 0))];
}

// ── 픽셀 버퍼 ────────────────────────────────────────────────
class PB {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Array(w * h).fill(null); }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  set(x, y, c) { x = Math.round(x); y = Math.round(y); if (c && this.in(x, y)) this.d[y * this.w + x] = c; }
  get(x, y) { x = Math.round(x); y = Math.round(y); return this.in(x, y) ? this.d[y * this.w + x] : null; }
  del(x, y) { if (this.in(x, y)) this.d[y * this.w + x] = null; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  // 팔다리: 두께 있는 선분. col은 색 또는 (t)=>색
  limb(x0, y0, x1, y1, size, col) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 1.5));
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      const c = typeof col === 'function' ? col(t) : col;
      const o = (size - 1) / 2;
      for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) this.set(Math.round(x - o + i), Math.round(y - o + j), c);
    }
  }
  // 채워진 타원 + 셰이딩 함수 (nx, ny는 -1..1)
  ellipse(cx, cy, rx, ry, shade) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) this.set(x, y, shade(nx, ny, x, y));
    }
  }
  canvas() {
    const c = mk(this.w, this.h), x = c.getContext('2d'), img = x.createImageData(this.w, this.h);
    for (let i = 0; i < this.d.length; i++) {
      const v = this.d[i]; if (!v) continue;
      const [r, g, b] = rgb(v);
      img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  }
}
// 셀아웃 외곽선: 맞닿은 색을 진하게 어둡게. 빛 받는 위쪽은 살짝 덜 어둡게.
// 톤 밴드 + 중간 톤을 섞어 부드럽게 (한 칸짜리 잡음 없이)
const _bandMix = new Map();
function band(ramp, v, x, y, spread = 0.7) {
  const n = ramp.length, f = clamp(v, 0, 0.999) * (n - 1), i = Math.floor(f), t = Math.round((f - i) * 3) / 3;
  if (t === 0 || i >= n - 1) return ramp[i];
  if (t === 1) return ramp[i + 1];
  const key = ramp[i] + ramp[i + 1] + t; let c = _bandMix.get(key);
  if (!c) { c = mix(ramp[i], ramp[i + 1], t); _bandMix.set(key, c); }
  return c;
}
// 2px 칸으로 다시 굽기: 칸 안에서 가장 많은 색을 고름 (평균내면 흐려지므로) + 대비 곡선으로 또렷하게
const CONTRAST = new Uint8ClampedArray(256);
for (let v = 0; v < 256; v++) { const t = v / 255, c = t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t); CONTRAST[v] = Math.round((t * 0.62 + c * 0.38) * 255); }
// 칸은 그대로 두고 대비만 올려 또렷하게
let _ctC = null;
function contrastPass(c) {
  // 0.62·t + 0.38·overlay(t,t) — 픽셀을 읽어 오지 않고 합성으로 (저사양 폰에서 가장 무거웠던 부분)
  const x = c.getContext('2d'); _ctC = _ctC || mk(c.width, c.height); const s = _ctC.getContext('2d');
  s.globalCompositeOperation = 'copy'; s.drawImage(c, 0, 0);
  x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'overlay'; x.globalAlpha = 0.38; x.drawImage(_ctC, 0, 0); x.restore();
}
function chunk2(c, contrast = true) {
  const w = c.width, h = c.height, x = c.getContext('2d'), id = x.getImageData(0, 0, w, h), d = id.data, u = new Uint32Array(d.buffer);
  const k = [0, 0, 0, 0];
  for (let y = 0; y < h; y += 2) for (let i = 0; i < w; i += 2) {
    const o0 = y * w + i, o1 = o0 + (i + 1 < w ? 1 : 0), o2 = y + 1 < h ? o0 + w : o0, o3 = y + 1 < h ? o1 + w : o1;
    k[0] = u[o0]; k[1] = u[o1]; k[2] = u[o2]; k[3] = u[o3];
    let n = 0; for (let q = 0; q < 4; q++) if ((k[q] >>> 24) > 0) n++;
    let best = 0, bc = -1;
    if (n >= 2) for (let q = 0; q < 4; q++) {
      if ((k[q] >>> 24) === 0) continue;
      let cnt = 0; for (let r = 0; r < 4; r++) if (k[r] === k[q]) cnt++;
      // 같으면 더 어두운 색 (윤곽 · 그늘이 살아 있게)
      if (cnt > bc || (cnt === bc && (k[q] & 0xff) + ((k[q] >> 8) & 0xff) < (best & 0xff) + ((best >> 8) & 0xff))) { bc = cnt; best = k[q]; }
    }
    let v = 0;
    if (n >= 2) {
      if (contrast) { const r = CONTRAST[best & 0xff], gg = CONTRAST[(best >> 8) & 0xff], b = CONTRAST[(best >> 16) & 0xff]; v = ((best >>> 24) << 24 | b << 16 | gg << 8 | r) >>> 0; }
      else v = best;
    }
    u[o0] = v; u[o1] = v; u[o2] = v; u[o3] = v;
  }
  x.putImageData(id, 0, 0);
  return c;
}
// 외곽선: 검은 테두리 대신 자기 색을 한 단계 어둡게만 (배경처럼 선 없는 그림체)
const OUTLINE = 0.42;
function selOut(pb, k = 0.72) {
  k *= OUTLINE;
  const o = new PB(pb.w, pb.h); o.d = pb.d.slice();
  for (let y = 0; y < pb.h; y++) for (let x = 0; x < pb.w; x++) {
    if (pb.get(x, y)) continue;
    const b = pb.get(x, y + 1), a = pb.get(x, y - 1), l = pb.get(x - 1, y), r = pb.get(x + 1, y);
    const nb = a || r || l || b;
    if (!nb) continue;
    o.d[y * pb.w + x] = mix(nb, INK, (b && !a) ? k - 0.1 : k);
  }
  return o;
}
function flipC(c) { const f = mk(c.width, c.height), x = f.getContext('2d'); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0); return f; }
function silhouette(c, col = '#ffffff') {
  const o = mk(c.width, c.height), x = o.getContext('2d');
  x.drawImage(c, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
  return o;
}
// 좌/우 프레임 쌍. ax, ay = 발밑 중앙 기준점
function framePair(pb, ax, ay) {
  const r = pb.canvas(), l = flipC(r);
  r.ax = ax; r.ay = ay; l.ax = pb.w - 1 - ax; l.ay = ay;
  return { r, l };
}

// 빛: 왼쪽 위 앞에서
const LIGHT = (() => { const v = [-0.5, -0.7, 0.5], m = Math.hypot(...v); return v.map(a => a / m); })();
function sphereLight(nx, ny) {
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  return clamp((nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) * 0.55 + 0.45, 0, 1);
}

// ── 픽셀 텍스트 (갈무리를 원래 크기로 찍고 이진화) ───────────────
const FONTS = { s: { css: '10px Galmuri9', h: 10 }, m: { css: '12px Galmuri11', h: 12 }, b: { css: 'bold 12px Galmuri11', h: 12 } };
const textCache = new Map();
let _probe = null; const PROBE = () => _probe || (_probe = mk(1, 1).getContext('2d'));   // 글자 폭 재기 (캔버스 하나를 계속 씀)
// 옛한글(아래아 ᆞ): 폰트에 없어 자모로 풀리므로 직접 합성 — 같은 받침의 'ㅡ' 글자(흔)를 그린 뒤 ㅡ 획을 지우고 그 자리에 점을 찍음
//  ㅡ 획 위치는 'ㅗ' 글자(혼)와 비교해 찾음 (ㅗ의 짧은 꼭지 바로 아래 줄)
const _graph = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('ko', { granularity: 'grapheme' }) : null;
const graphemes = str => _graph ? [..._graph.segment(str)].map(s => s.segment) : [...str];
const hasOldHangul = str => /[\u1100-\u11FF]/.test(str);
const araeCache = new Map();
function araeGlyph(seg, css, h) {
  const key = seg + css; if (araeCache.has(key)) return araeCache.get(key);
  const L = seg.charCodeAt(0) - 0x1100, T = seg.length > 2 ? seg.charCodeAt(2) - 0x11A7 : 0;
  if (L < 0 || L > 18 || seg.charCodeAt(1) !== 0x119E) { araeCache.set(key, null); return null; }
  const syl = V => String.fromCharCode(0xAC00 + (L * 21 + V) * 28 + Math.max(0, T));
  const probe = PROBE(); probe.font = css; const w = Math.ceil(probe.measureText(syl(18)).width) + 2, H = h + 4;
  const draw = V => { const c = mkR(w, H), x = c.getContext('2d'); x.font = css; x.textBaseline = 'top'; x.fillStyle = '#000'; x.fillText(syl(V), 1, 1); const d = x.getImageData(0, 0, w, H).data, m = new Uint8Array(w * H); for (let i = 0; i < w * H; i++) m[i] = d[i * 4 + 3] > 110 ? 1 : 0; return m; };
  const A = draw(18), Bm = draw(8);
  let tb = -1, sx = 0, n = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < w; i++) if (Bm[j * w + i] && !A[j * w + i]) { tb = Math.max(tb, j); sx += i; n++; }
  const out = mk(w, H), ox = out.getContext('2d'); ox.fillStyle = '#000';
  if (tb >= 0) {
    const cx = Math.round(sx / n), rows = [];
    for (let j = tb + 1; j < Math.min(H, tb + 4); j++) { let run = 0; for (let i = cx - 2; i <= cx + 2; i++) run += A[j * w + i] || 0; if (run >= 4) rows.push(j); else if (rows.length) break; }
    for (const j of rows) { let a = cx, b = cx; while (a > 0 && A[j * w + a - 1]) a--; while (b < w - 1 && A[j * w + b + 1]) b++; for (let i = a; i <= b; i++) A[j * w + i] = 0; }
    const t = Math.max(1, rows.length); for (const j of rows) for (let i = cx - Math.floor(t / 2); i < cx - Math.floor(t / 2) + t; i++) A[j * w + i] = 1;   // 점(ᆞ)
  }
  for (let j = 0; j < H; j++) for (let i = 0; i < w; i++) if (A[j * w + i]) ox.fillRect(i, j, 1, 1);
  out.adv = w - 2; araeCache.set(key, out); return out;
}
// 옛한글이 섞인 줄: 글자 묶음(grapheme)마다 그리기 · 너비
function textJ(ctx, str, x, y, css, h, drawIt) {
  let px = x;
  for (const g of graphemes(str)) {
    const a = hasOldHangul(g) ? araeGlyph(g, css, h) : null;
    if (a) { if (drawIt) ctx.drawImage(a, Math.round(px) - 1, y - 1); px += a.adv; }
    else { if (drawIt) ctx.fillText(g, px, y); px += ctx.measureText(g).width; }
  }
  return px - x;
}
function textSprite(str, { font = 'm', color = '#ffffff', outline = INK, shadow = false, trim = true } = {}) {
  const key = [str, font, color, outline, shadow, trim].join('|');
  if (textCache.has(key)) return textCache.get(key);
  if (textCache.size > 700) textCache.clear();
  const f = FONTS[font];
  const probe = PROBE(); probe.font = f.css;
  const oldH = hasOldHangul(str), tw = Math.ceil(oldH ? textJ(probe, str, 0, 0, f.css, f.h, false) : probe.measureText(str).width) + 2;
  const raw = mkR(tw, f.h + 4), rx = raw.getContext('2d');   // 글자 캔버스는 다시 읽으므로 CPU에 (GPU에서 읽어 오면 처음 그릴 때 멈칫)
  rx.font = f.css; rx.textBaseline = 'top'; rx.fillStyle = '#000'; if (oldH) textJ(rx, str, 1, 1, f.css, f.h, true); else rx.fillText(str, 1, 1);
  const src = rx.getImageData(0, 0, raw.width, raw.height).data;
  const pad = outline ? 1 : 0, sh = shadow ? 1 : 0;
  const out = mkR(raw.width + pad * 2, raw.height + pad * 2 + sh), ox = out.getContext('2d');
  const on = (i, j) => i >= 0 && j >= 0 && i < raw.width && j < raw.height && src[(j * raw.width + i) * 4 + 3] > 110;
  if (outline) {
    ox.fillStyle = outline;
    for (let j = -1; j <= raw.height; j++) for (let i = -1; i <= raw.width; i++) {
      if (!on(i, j) && (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1) || (shadow && (on(i, j - 2) || on(i - 1, j - 2) || on(i + 1, j - 2))))) ox.fillRect(i + pad, j + pad, 1, 1);
    }
  }
  ox.fillStyle = color;
  for (let j = 0; j < raw.height; j++) for (let i = 0; i < raw.width; i++) if (on(i, j)) ox.fillRect(i + pad, j + pad, 1, 1);
  let res = out;
  if (trim) {
    const d = ox.getImageData(0, 0, out.width, out.height).data;
    let x0 = out.width, y0 = out.height, x1 = -1, y1 = -1;
    for (let j = 0; j < out.height; j++) for (let i = 0; i < out.width; i++) if (d[(j * out.width + i) * 4 + 3]) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j); }
    if (x1 >= 0) { res = mkR(x1 - x0 + 1, y1 - y0 + 1); res.getContext('2d').drawImage(out, -x0, -y0); }
  }
  textCache.set(key, res);
  return res;
}
const glyphCache = new Map();
function glyph(ch, font, color, outline) {
  const key = [ch, font, color, outline].join('|');
  let c = glyphCache.get(key); if (c) return c;
  const probe = PROBE(); probe.font = FONTS[font].css;
  c = textSprite(ch, { font, color, outline, trim: false });
  c.adv = Math.round(hasOldHangul(ch) ? textJ(probe, ch, 0, 0, FONTS[font].css, FONTS[font].h, false) : probe.measureText(ch).width); c.ox = outline ? 2 : 1;   // 옛한글(아래아)은 합친 한 글자 폭
  glyphCache.set(key, c);
  return c;
}

// 로고: 글자를 정수배로 키우고 세로 그라데이션 + 위 하이라이트 + 두꺼운 테두리 + 아래로 깊은 그림자
const logoCache = new Map();
function logoText(str, scale, ramp, edge = INK) {
  const key = [str, scale, ramp.join(), edge].join('|');
  if (logoCache.has(key)) return logoCache.get(key);
  const out = buildLogo(str, scale, ramp, edge);
  logoCache.set(key, out);
  return out;
}
function buildLogo(str, scale, ramp, edge) {
  const t = textSprite(str, { font: 'b', color: '#ffffff', outline: null });
  const w = t.width, h = t.height, src = t.getContext('2d').getImageData(0, 0, w, h).data;
  const on = (i, j) => i >= 0 && j >= 0 && i < w && j < h && src[(j * w + i) * 4 + 3] > 0;
  const P = 3, pb = new PB((w + P * 2) * scale, (h + P * 2 + 3) * scale);
  const near = (i, j, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.abs(dx) + Math.abs(dy) <= r && on(i + dx, j + dy)) return true; return false; };
  for (let j = -P; j < h + P + 3; j++) for (let i = -P; i < w + P; i++) {
    let col = null;
    if (near(i, j, 1)) col = edge;
    else { for (let d = 1; d <= 1 && !col; d++) if (near(i, j - d, 1)) col = mix(edge, '#000000', 0.25); }
    if (col) pb.rect((i + P) * scale, (j + P) * scale, scale, scale, col);
  }
  const H2 = h * scale;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (on(i, j)) {
    for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
      const py = j * scale + sy;
      let c = rampPick(ramp, 1 - py / H2, i * scale + sx, py, 0.6);
      if (!on(i, j - 1) && sy === 0) c = ramp[ramp.length - 1];
      if (!on(i, j + 1) && sy === scale - 1) c = mix(ramp[0], INK, 0.3);
      pb.set((i + P) * scale + sx, (j + P) * scale + sy, c);
    }
  }
  return pb.canvas();
}

