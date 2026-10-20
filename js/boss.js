// ─────────────────────────────────────────────────────────────
//  픽셀 제주 — 이벤트 컷 초상 (밈 이벤트: 할망 · 뭐랭하멘)
//  초상은 assets/events/<key>.png 에 넣은 이미지를 읽어
//  게임 픽셀 크기와 채도에 맞춰 다시 굽는다. 없으면 실루엣 자리표시.
// ─────────────────────────────────────────────────────────────
'use strict';

// 썩은 귤 (이벤트 투척물)
const ROTTEN = SPR.ROTTEN;

const EVENT_H = 104;
const EVENTS = {
  halmang: { name: '사투리 할머니', file: 'assets/events/halmang.png' },
  murang: { name: '뭐랭하멘', file: 'assets/events/murang.png' },
  seolmun: { name: '설문대할망', file: 'assets/events/seolmun.png' },
  knife: { name: '칼 든 하르방', file: 'assets/events/knife.png' },
};
const PORTRAIT = {};
// 이미지 → 게임 픽셀: 원본 픽셀 아트의 칸 크기를 찾아 칸마다 한 점씩 다시 뽑고(번짐 없이),
// 가장자리에서 이어진 배경(투명 · 거의 검정)을 지우고, 팔레트처럼 채도를 맞춘 뒤 정수 배로 키운다
function cellSize(d, w, h) {
  const hist = new Array(64).fill(0), same = (i, j) => Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i + 2] - d[j + 2]) < 18;
  for (let y = Math.floor(h * 0.2); y < h * 0.9; y += 7) {
    let run = 1;
    for (let x = 1; x < w; x++) {
      if (same((y * w + x) * 4, (y * w + x - 1) * 4)) run++;
      else { if (run >= 3 && run < 64) hist[run]++; run = 1; }
    }
  }
  let best = 1; for (let k = 3; k < 64; k++) if (hist[k] > hist[best]) best = k;
  return best;
}
function bakePortrait(img, native = false) {
  const sw = img.width, sh = img.height, sc = mkR(sw, sh), sx = sc.getContext('2d');
  sx.drawImage(img, 0, 0);
  const sd = sx.getImageData(0, 0, sw, sh).data;
  const cell = native ? 1 : clamp(cellSize(sd, sw, sh), 1, 40);
  const w = Math.max(1, Math.round(sw / cell)), h = Math.max(1, Math.round(sh / cell));
  const c0 = mk(w, h), x0 = c0.getContext('2d'), id = x0.createImageData(w, h), d = id.data;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const px = Math.min(sw - 1, Math.floor((i + 0.5) * sw / w)), py = Math.min(sh - 1, Math.floor((j + 0.5) * sh / h)), si = (py * sw + px) * 4, o = (j * w + i) * 4;
    d[o] = sd[si]; d[o + 1] = sd[si + 1]; d[o + 2] = sd[si + 2]; d[o + 3] = sd[si + 3];
  }
  const bg = (i) => d[i * 4 + 3] < 128 || d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2] < 48;
  const seen = new Uint8Array(w * h), st = [];
  for (let i = 0; i < w; i++) st.push(i, (h - 1) * w + i);
  for (let j = 0; j < h; j++) st.push(j * w, j * w + w - 1);
  while (st.length) {
    const p = st.pop(); if (seen[p] || !bg(p)) continue;
    seen[p] = 1; d[p * 4 + 3] = 0;
    const px = p % w, py = (p / w) | 0;
    if (px > 0) st.push(p - 1); if (px < w - 1) st.push(p + 1); if (py > 0) st.push(p - w); if (py < h - 1) st.push(p + w);
  }
  // 배경 경계에 남은 어두운 찌꺼기 한 겹 정리
  const edgeBg = (p) => { const px = p % w, py = (p / w) | 0; return (px > 0 && seen[p - 1]) || (px < w - 1 && seen[p + 1]) || (py > 0 && seen[p - w]) || (py < h - 1 && seen[p + w]); };
  for (let pass = 0; pass < 2; pass++) {
    const kill = [];
    for (let p = 0; p < w * h; p++) if (!seen[p] && d[p * 4] + d[p * 4 + 1] + d[p * 4 + 2] < 110 && edgeBg(p)) {
      const px = p % w, py = (p / w) | 0; let solid = 0;
      for (const q of [p - 1, p + 1, p - w, p + w]) if (q >= 0 && q < w * h && !seen[q] && Math.abs((q % w) - px) <= 1 && Math.abs(((q / w) | 0) - py) <= 1) solid++;
      if (solid <= 2) kill.push(p);
    }
    for (const p of kill) { seen[p] = 1; d[p * 4 + 3] = 0; }
  }
  const memo = new Map();
  for (let i = 0; i < w * h; i++) {
    if (d[i * 4 + 3] < 128) { d[i * 4 + 3] = 0; continue; }
    const k = hex(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    let m = memo.get(k); if (!m) { m = rgb(mute(k, 0.9)); memo.set(k, m); }
    d[i * 4] = m[0]; d[i * 4 + 1] = m[1]; d[i * 4 + 2] = m[2]; d[i * 4 + 3] = 255;
  }
  x0.putImageData(id, 0, 0);
  const k = Math.max(1, Math.round(EVENT_H / h)), c = mkR(w * k, h * k), x = c.getContext('2d');
  x.imageSmoothingEnabled = false; x.drawImage(c0, 0, 0, w * k, h * k);
  const od = x.getImageData(0, 0, c.width, c.height), q = od.data, cw = c.width, chh = c.height, ink = rgb(INK), edge = [];
  for (let yy = 0; yy < chh; yy++) for (let xx = 0; xx < cw; xx++) {
    if (q[(yy * cw + xx) * 4 + 3]) continue;
    const on = (a, b) => a >= 0 && b >= 0 && a < cw && b < chh && q[(b * cw + a) * 4 + 3] > 0;
    if (on(xx - 1, yy) || on(xx + 1, yy) || on(xx, yy - 1) || on(xx, yy + 1)) edge.push(yy * cw + xx);
  }
  for (const p of edge) { q[p * 4] = ink[0]; q[p * 4 + 1] = ink[1]; q[p * 4 + 2] = ink[2]; q[p * 4 + 3] = 255; }
  x.putImageData(od, 0, 0);
  c.cell = k;
  return c;
}
// 이미지를 픽셀로 다시 굽지 못할 때(보안 제한 등): 실루엣 대신 원본을 정수배로 그대로
function plainPortrait(img) {
  const k = Math.max(1, Math.round(EVENT_H / img.height)), c = mk(img.width * k, img.height * k), x = c.getContext('2d');
  x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, c.width, c.height); return c;
}
function loadPortraits() {
  for (const key in EVENTS) {
    const im = new Image(); let native = typeof PORTRAIT_DATA !== 'undefined' && !!PORTRAIT_DATA[key];
    im.onload = () => { try { PORTRAIT[key] = bakePortrait(im, native); } catch (e) { console.warn('portrait bake failed, using plain image', key, e); PORTRAIT[key] = plainPortrait(im); } };
    im.onerror = () => { if (native) { native = false; im.src = EVENTS[key].file; } };
    im.src = native ? PORTRAIT_DATA[key] : EVENTS[key].file;
  }
}
// 초상이 아직 없을 때: 담백한 실루엣 + 물음표
const STAND_IN = SPR.STAND_IN;
function portraitOf(key) { return PORTRAIT[key] || STAND_IN; }
