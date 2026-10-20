// ─────────────────────────────────────────────────────────────
//  픽셀 제주 — 명소 배경: 이호테우 해변 · 서귀포 귤밭 · 만장굴 · 정방폭포 · 천지연폭포
//  scenery.js의 레이어 규칙(먼 레이어일수록 연무에 묻힘 · 시간대 팔레트)을 그대로 따름
// ─────────────────────────────────────────────────────────────
'use strict';

// 테마별 성격: 바다 반짝임 · 파도 거품 · 화산(한라산) · 풍력발전기 · 실내(하늘 장식 없음) · 음악
const THEME_CFG = {
  field: { sea: 0, foam: 0, volcano: 1, mills: 1, song: 'field', ban: ['dolphin'] },
  coast: { sea: 1, foam: 1, volcano: 0, mills: 1, song: 'coast' },
  beach: { sea: 1, foam: 1, volcano: 1, mills: 0, song: 'beach' },
  grove: { sea: 0, foam: 0, volcano: 1, mills: 0, song: 'grove', ban: ['dolphin'] },
  iho: { sea: 1, foam: 1, volcano: 0, mills: 0, song: 'iho', ban: ['harvest', 'meteor'] },
  // 동굴: 하늘 · 바다 · 밭 것은 안 나옴 (까마귀는 박쥐로, 화산탄은 낙석으로 바뀜)
  cave: { sea: 0, foam: 0, volcano: 0, mills: 0, indoor: 1, song: 'cave', ban: ['gull', 'plane', 'glider', 'dolphin', 'bee', 'wind', 'typhoon', 'car', 'pony', 'pig', 'parcel', 'harvest'] },
  jeongbang: { sea: 0, foam: 0, volcano: 0, mills: 0, song: 'falls', ban: ['car', 'harvest', 'pig', 'pony', 'meteor'] },
  cheonji: { sea: 0, foam: 0, volcano: 0, mills: 0, song: 'falls', ban: ['dolphin', 'car', 'harvest', 'plane', 'meteor', 'gull'] },
};
const themeCfg = () => THEME_CFG[THEME] || THEME_CFG.field;

const px1 = (x, c, X, Y, w = 1, h = 1) => { x.fillStyle = c; x.fillRect(X, Y, w, h); };

// 바다 바탕 (수평선 top부터 아래로 짙어지는 그러데이션 + 잔물결)
function seaBase(x, lw, ph, top, cols0, seed) {
  const cols = cols0.map(k => atmo(k, ph, 0.12)), R = rng(seed);
  for (let y = top; y < 140; y++) for (let i = 0; i < lw; i++) {
    const f = (y - top + (vnoise(i * 0.045, y * 0.08, seed) - 0.5) * 3) / (140 - top);
    px1(x, band(cols, clamp(1 - f * 1.1, 0, 0.999), i, y), i, y);
  }
  x.fillStyle = atmo('#ffffff', ph, 0.1);
  for (let k = 0; k < 60; k++) { const yy = top + 2 + Math.floor(Math.pow(R(), 1.6) * (138 - top)); x.fillRect(Math.floor(R() * lw), yy, 2 + Math.floor(R() * 4), 1); }
}

// 테트라포드(방파제 콘크리트 블록): 네 다리 중심에서 뻗은 굵은 선 · 왼쪽 위에서 빛
function tetrapod(s, seed, cols) {
  const n = Math.round(9 * s) + 4, pb = new PB(n, n), c = n / 2, r = Math.max(1.1, 1.5 * s), L = 3.6 * s;
  const rot = hash2(seed, 1, 5) * 6.28;
  const legs = [[0, -1], [0.87, 0.5], [-0.87, 0.5]].map(([a, b]) => { const ca = Math.cos(rot * 0.3), sa = Math.sin(rot * 0.3); return [a * ca - b * sa, a * sa + b * ca]; });
  const segD = (pxx, pyy, ax, ay, bx, by) => { const vx = bx - ax, vy = by - ay, t = clamp(((pxx - ax) * vx + (pyy - ay) * vy) / (vx * vx + vy * vy), 0, 1); return Math.hypot(pxx - ax - vx * t, pyy - ay - vy * t); };
  for (let y = 0; y < n; y++) for (let i = 0; i < n; i++) {
    const X = i + 0.5, Y = y + 0.5; let hit = Math.hypot(X - c, Y - c) < r * 1.25;
    for (const [dx, dy] of legs) if (segD(X, Y, c, c, c + dx * L, c + dy * L) < r * (1 - 0.15)) hit = true;
    if (!hit) continue;
    const v = 0.62 - (X - c) / n * 0.7 - (Y - c) / n * 0.8 + (hash2(i + seed, y, 7) - 0.5) * 0.12;
    pb.set(i, y, band(cols, clamp(v, 0, 0.999), i, y, 0.5));
  }
  return selOut(pb, 0.55).canvas();
}
// 테트라포드 더미 (삼각형으로 쌓임)
function tetraPile(x, cx, base, w, s, ph, seed, cover) {
  const cols = ['#6e6a62', '#8e8a80', '#b0aa9e', '#cec8bc', '#e6e0d4'].map(k => atmo(k, ph, 0.06));
  const R = rng(seed), rows = Math.max(1, Math.round(w / (9 * s) / 1.6));
  for (let rr = 0; rr < rows; rr++) {
    const cnt = Math.max(1, Math.round((w / (8 * s)) * (1 - rr / (rows + 0.5)))), rw = cnt * 7 * s;
    for (let k = 0; k < cnt; k++) {
      const img = tetrapod(s * (0.85 + R() * 0.3), seed + rr * 31 + k, cols);
      x.drawImage(img, Math.round(cx - rw / 2 + k * 7 * s + (R() - 0.5) * 3 * s), Math.round(base - img.height - rr * 5 * s + (R() - 0.5) * 2));
    }
  }
  if (cover) cover(Math.round(cx - w / 2), w);
}

// 말 모양 등대 (이호테우): 원래 크기로 찍음 (늘려 그리면 픽셀이 뭉개짐)
//  받침 기단 → 앞다리를 들고 선 말 몸통 → 목과 머리(바다 쪽) → 머리 위 등롱
function horseLight(x, bx, base, red, ph, face = 1) {
  const A = k => atmo(k, ph, 0.12);
  const B = (red ? ['#7a1e1a', '#b8322a', '#de5244', '#f2846e'] : ['#9a9aa6', '#c8c8cc', '#ececea', '#ffffff']).map(A), dark = A(red ? '#4a1410' : '#6a6a78'), glass = A('#ffe9a0');
  const pb = new PB(22, 40), sh = (i, l, r) => i <= l + 1 ? B[3] : i >= r - 1 ? B[0] : B[2];
  // 기단 (2단)
  for (let y = 34; y < 40; y++) for (let i = 3; i < 19; i++) pb.set(i, y, y === 34 ? B[3] : y > 37 ? B[0] : sh(i, 3, 18));
  for (let y = 31; y < 34; y++) for (let i = 5; i < 17; i++) pb.set(i, y, y === 31 ? B[3] : sh(i, 5, 16));
  // 몸통: 아래는 두 다리(가운데 틈), 위로 갈수록 가슴이 앞으로 나옴
  for (let y = 14; y < 31; y++) {
    const t = (y - 14) / 17, l = Math.round(7 - (1 - t) * 1), r = Math.round(14 + (1 - t) * 2);
    for (let i = l; i <= r; i++) { if (y > 25 && i >= 10 && i <= 11) continue; pb.set(i, y, sh(i, l, r)); }
  }
  // 목: 오른쪽 위로 굵게
  for (let k = 0; k < 8; k++) { const y = 14 - k, l = 9 + Math.round(k * 0.6), r = l + 5; for (let i = l; i <= r; i++) pb.set(i, y, sh(i, l, r)); }
  // 머리: 길쭉한 주둥이가 앞으로
  for (let y = 3; y < 9; y++) for (let i = 13; i < 21; i++) { if ((i > 18 && y < 5) || (i === 20 && y > 7)) continue; pb.set(i, y, y === 3 ? B[3] : y === 8 ? B[0] : B[2]); }
  pb.set(14, 2, B[2]); pb.set(14, 1, B[1]); pb.set(16, 2, B[1]);   // 귀
  pb.set(17, 5, dark); pb.set(20, 6, dark);                        // 눈 · 콧구멍
  for (let y = 6; y < 16; y++) pb.set(9 + Math.round((15 - y) * 0.5), y, dark);   // 갈기
  // 머리 위 등롱 + 난간
  for (let i = 12; i < 18; i++) pb.set(i, 0, dark);
  let img = selOut(pb, 0.6).canvas(); if (face < 0) img = flipC(img);
  x.drawImage(img, bx - 11, base - 40);
  px1(x, glass, face > 0 ? bx + 3 : bx - 5, base - 40, 2, 1);
}
// 방파제: 콘크리트 둑 (윗면 · 옆면 · 계단)
function jetty(x, x0, x1, y, ph, steps) {
  const A = k => atmo(k, ph, 0.12);
  for (let i = x0; i < x1; i++) { px1(x, A('#d0cabe'), i, y); px1(x, A('#a8a296'), i, y + 1, 1, 3); px1(x, A('#6a665e'), i, y + 4); px1(x, A('#3e4a52'), i, y + 5); }
  if (steps) for (let k = 0; k < 5; k++) px1(x, A(k % 2 ? '#b8b2a6' : '#8a857c'), steps + k * 2, y - k, 2, k + 1);
}

// ═════════════════ 이호테우 해변 ═════════════════
function buildIhoFar(ph) {
  // 수평선 왼쪽 멀리 제주 시내 · 오른쪽은 탁 트인 바다
  const lw = layerW(LAYER_P.hall), c = mk(lw, 140), x = c.getContext('2d'), R = rng(301);
  const city = atmo('#a4acb6', ph, 0.6), city2 = atmo('#bcc2c8', ph, 0.65), hill = atmo('#9aa8ac', ph, 0.65);
  for (let i = 0; i < lw * 0.4; i++) { const t = Math.round(2 + vnoise(i * 0.03, 0.4, 302) * 5 * (1 - i / (lw * 0.4))); px1(x, hill, i, 103 - t, 1, t + 1); }
  for (let i = 0; i < lw * 0.3;) { const w = 2 + Math.floor(R() * 4), h = 1 + Math.floor(R() * 4); px1(x, R() < 0.5 ? city : city2, i, 103 - h, w, h + 1); i += w + Math.floor(R() * 3); }
  return c;
}
function buildIhoSea(ph) {
  // 사진처럼: 맑은 옥빛 바다 가운데로 항구 입구 · 왼쪽 방파제 끝 빨간 말 등대 · 오른쪽 테트라포드 무더기 위 하얀 말 등대
  const lw = layerW(LAYER_P.field), c = mk(lw, 140), x = c.getContext('2d'), top = 104;
  seaBase(x, lw, ph, top, ['#1e6e96', '#2a8cb0', '#3aa8c4', '#6cc8d4', '#a8e2e4'], 311);
  const lx = Math.round(lw * 0.2), rx = Math.round(lw * 0.74);
  // 왼쪽 방파제 + 계단 + 끝의 테트라포드
  jetty(x, 0, lx + 16, top + 8, ph, lx - 30);
  tetraPile(x, lx + 18, top + 15, 40, 0.8, ph, 312);
  horseLight(x, lx + 2, top + 8, true, ph, 1);
  // 오른쪽: 큰 테트라포드 무더기 + 뒤로 이어지는 방파제 벽과 난간
  jetty(x, rx + 10, lw, top + 6, ph);
  const rail = atmo('#e8e4dc', ph, 0.12); for (let i = rx + 14; i < lw; i++) { px1(x, rail, i, top + 3); if (i % 5 === 0) px1(x, rail, i, top + 3, 1, 3); }
  tetraPile(x, rx - 2, top + 14, 76, 0.9, ph, 313);
  horseLight(x, rx + 4, top + 1, false, ph, -1);
  // 항로 표지 (노랑 · 검정 기둥)
  const bx = Math.round(lw * 0.5); px1(x, atmo('#2a2a30', ph, 0.1), bx, top - 2, 1, 7); px1(x, atmo('#e8c43a', ph, 0.1), bx, top - 1, 1, 3);
  return c;
}
function buildIhoNear(ph) {
  const lw = layerW(LAYER_P.near), c = mk(lw, 160), x = c.getContext('2d'), R = rng(321), A = k => atmo(k, ph, 0.05);
  const mask = new Uint8Array(lw), cover = (x0, w) => { for (let k = Math.max(0, x0); k < Math.min(lw, x0 + w); k++) mask[k] = 1; };
  for (let i = 0; i < lw; i++) { const y = 138 + Math.round((vnoise(i * 0.09, 0.5, 322) - 0.5) * 4); px1(x, A('#e8f6ff'), i, y, 1, 2); px1(x, A('#9ad0ec'), i, y + 2); }
  // 이호테우 모래: 회갈색 고운 모래 · 젖은 띠
  const S = ['#a49884', '#bcb09a', '#8e8270'].map(A);
  px1(x, S[0], 0, 141, lw, 20); px1(x, A('#8a8070'), 0, 141, lw, 2);
  for (let k = 0; k < 240; k++) px1(x, S[1 + (k % 2)], Math.floor(R() * lw), 143 + Math.floor(R() * 14), 2, 1);
  // 왼쪽 앞 테트라포드 (사진 왼쪽 아래처럼 가까이 · 크게) · 오른쪽 끝 작은 무더기
  tetraPile(x, 22, 146, 70, 1.4, ph, 323, cover); tetraPile(x, lw - 20, 145, 46, 1.2, ph, 324, cover);
  c.foamMask = mask;
  return c;
}

// ═════════════════ 서귀포 귤밭 ═════════════════
function buildGroveFields(ph) {
  // 먼 귤밭: 짙은 귤나무 줄 + 점점이 귤 · 삼나무 방풍림 · 비닐하우스
  const lw = layerW(LAYER_P.field), c = mk(lw, 140), x = c.getContext('2d'), R = rng(401), d = 0.2;
  const T = ['#1e4a30', '#2a5e38', '#3a7444'].map(k => atmo(mute(k, 0.8), ph, d)), O = atmo('#ff9a2a', ph, d), wall = atmo('#3a3646', ph, d), gr = atmo('#5a8a46', ph, d);
  px1(x, gr, 0, 110, lw, 30);
  for (const [y, s] of [[112, 2], [117, 3], [123, 4], [130, 5]]) {
    for (let i = 0; i < lw; i++) px1(x, wall, i, y + s + 1);   // 밭담 줄
    for (let i = Math.floor(R() * 4); i < lw; i += s + 2) {
      for (let yy = 0; yy <= s; yy++) for (let xx = 0; xx <= s; xx++) if (Math.hypot(xx - s / 2, yy - s / 2) <= s / 2 + 0.3) px1(x, T[xx + yy < s ? 2 : xx + yy > s * 1.4 ? 0 : 1], i + xx, y + yy);
      if (R() < 0.6) px1(x, O, i + Math.floor(R() * s), y + Math.floor(R() * s));
    }
  }
  // 삼나무 방풍림: 귤밭을 감싸는 짙은 세로 줄
  const ced = atmo('#1a3a2a', ph, d), cedL = atmo('#2a5038', ph, d);
  for (const [y, n] of [[112, 5], [118, 4], [125, 3]]) for (let k = 0; k < n; k++) {
    const sx = Math.floor(R() * lw), len = 16 + Math.floor(R() * 30);
    for (let t = 0; t < len; t += 2) { const h = 5 + (hash2(sx + t, y, 3) < 0.5 ? 1 : 0); px1(x, ced, sx + t, y - h, 2, h); px1(x, cedL, sx + t, y - h, 1, 1); }
  }
  // 비닐하우스 (반원 지붕이 줄지어)
  const vh = atmo('#dfe6e8', ph, d), vhS = atmo('#a8b4b8', ph, d);
  for (let k = 0; k < 3; k++) {
    const hx = Math.floor(lw * (0.15 + k * 0.3) + R() * 30), hy = 121 + k % 2 * 5;
    for (let n = 0; n < 4; n++) for (let i = 0; i < 7; i++) { const h = Math.round(Math.sin((i + 0.5) / 7 * Math.PI) * 3); px1(x, i > 4 ? vhS : vh, hx + n * 7 + i, hy - h, 1, h + 2); }
  }
  return c;
}
function buildGroveNear(ph) {
  // 사진처럼: 현무암 돌담 위로 귤이 주렁주렁 달린 귤나무 덤불이 길게 이어지고, 나무 전봇대와 전깃줄
  const lw = layerW(LAYER_P.near), c = mk(lw, 160), x = c.getContext('2d'), R = rng(411), A = k => atmo(k, ph, 0.05);
  const L = ['#163a20', '#22502a', '#326a34', '#4a8a40', '#6aa84c'].map(A), O = C.org.map(A), St = ['#1e1c24', '#2e2c36', '#46434e', '#625e6a', '#837e8a'].map(A);
  // 덤불 윤곽: 둥근 수관이 겹쳐 이어진 위쪽 테두리
  const top = new Array(lw);
  for (let i = 0; i < lw; i++) top[i] = Math.round(112 - vnoise(i * 0.05, 0.3, 412) * 12 - Math.abs(Math.sin(i * 0.11 + vnoise(i * 0.02, 1, 413) * 3)) * 6);
  for (let i = 0; i < lw; i++) for (let y = top[i]; y < 140; y++) {
    const d2 = y - top[i], v = 0.75 - d2 / 34 + (vnoise(i * 0.25, y * 0.25, 414) - 0.5) * 0.5 + (d2 < 2 ? 0.2 : 0);
    px1(x, band(L, clamp(v, 0, 0.999), i, y, 0.6), i, y);
  }
  // 잎 덩어리 결: 밝은 잎 뭉치를 흩뿌림
  for (let k = 0; k < lw * 0.5; k++) { const i = Math.floor(R() * lw), y = top[i] + 2 + Math.floor(R() * 20); px1(x, L[3], i, y, 2, 1); px1(x, L[4], i, y - 1); }
  // 귤: 주렁주렁 (2~3px, 빛 받는 점)
  for (let k = 0; k < lw * 0.42; k++) {
    const i = Math.floor(R() * lw), y = top[i] + 3 + Math.floor(Math.pow(R(), 0.8) * (138 - top[i] - 6)), big = R() < 0.35;
    px1(x, O[1], i, y, big ? 3 : 2, big ? 3 : 2); px1(x, O[2], i, y, big ? 2 : 1, big ? 2 : 1); px1(x, O[3], i, y);
  }
  // 돌담: 굵은 현무암 돌을 쌓음 (구멍 숭숭)
  px1(x, St[0], 0, 138, lw, 14);
  const stone = (sx, sy, w, h) => {
    const pb = new PB(w + 2, h + 2);
    for (let yy = 1; yy <= h; yy++) for (let xx = 1; xx <= w; xx++) {
      const nx = (xx - (w + 1) / 2) / (w / 2), ny = (yy - (h + 1) / 2) / (h / 2);
      if (Math.abs(nx) ** 2.2 + Math.abs(ny) ** 2.2 > 0.95 + 0.2 * vnoise(xx * 0.4, yy * 0.4, sx + 9)) continue;
      const v = sphereLight(clamp(nx, -1, 1), clamp(ny, -1, 1)); pb.set(xx, yy, St[v < 0.35 ? 1 : v < 0.6 ? 2 : v < 0.85 ? 3 : 4]);
    }
    for (let k = 0; k < w * h / 12; k++) { const a = 1 + Math.floor(R() * w), b = 1 + Math.floor(R() * h); if (pb.get(a, b)) pb.set(a, b, St[0]); }
    x.drawImage(selOut(pb, 0.6).canvas(), sx - 1, sy - 1);
  };
  for (const [y, off, hh] of [[146, 0, 8], [139, 5, 8], [133, 2, 6]]) { let i = -off; while (i < lw) { const w = 8 + Math.floor(R() * 8), h = hh - Math.floor(R() * 2); stone(i, y + Math.floor(R() * 2), w, h); i += w - 1; } }
  // 전봇대 + 전깃줄 (사진 오른쪽처럼 길가에)
  const poles = [Math.round(lw * 0.18), Math.round(lw * 0.63)];
  for (const p of poles) {
    px1(x, A('#7a6a52'), p, 52, 3, 90); px1(x, A('#a8967a'), p, 52, 1, 90); px1(x, A('#4e4232'), p + 2, 52, 1, 90);
    px1(x, A('#5a4c3a'), p - 8, 58, 19, 2); px1(x, A('#5a4c3a'), p - 6, 66, 15, 2);
    for (const ox of [-7, -2, 4, 9]) px1(x, A('#d8d4c8'), p + ox, 56, 1, 2);
  }
  x.fillStyle = A('#2a2a30');
  for (const yo of [57, 65]) for (let i = 0; i < lw; i++) {
    const seg = i < poles[0] ? [poles[0] - 260, poles[0]] : i < poles[1] ? poles : [poles[1], poles[1] + (poles[1] - poles[0])];
    const t = (i - seg[0]) / (seg[1] - seg[0]); x.fillRect(i, Math.round(yo + Math.sin(t * Math.PI) * 6), 1, 1);
  }
  return c;
}

const CAVE_PH = { haze: '#0c0b12', tint: null };

// 땅: 명소별 바닥 (자갈 · 동굴 바위 · 귤밭 흙)
function buildGroundPlace(ph, kind) {
  if (kind === 'grove') return buildGround(ph);
  if (kind === 'iho') return buildGroundTheme(ph, 'beach');
  const c = buildGround(kind === 'cave' ? CAVE_PH : ph), x = c.getContext('2d'), R = rng(901);
  const A = k => kind === 'cave' ? atmo(k, CAVE_PH, 0) : atmo(k, ph, 0);
  const tint = kind === 'cave' ? ['#2a2630', '#3a3442', '#1e1a24', '#141118'] : kind === 'cheonji' ? ['#4a5048', '#5e6a58', '#3a3e38', '#2a2e2a'] : ['#6a645c', '#8a8278', '#54504a', '#3e3a36'];
  for (let y = 0; y < c.height; y++) for (let i = 0; i < c.width; i++) {
    const yy = y + (vnoise(i * 0.06, y * 0.1, 902) - 0.5) * 5, k = y < 2 ? 1 : yy < 10 ? 0 : yy < 18 ? 2 : 3;
    px1(x, A(tint[k]), i, y);
  }
  // 자갈 · 돌멩이
  const pebbles = kind === 'cave' ? 30 : 140;
  for (let k = 0; k < pebbles; k++) {
    const w = 2 + Math.floor(R() * 4), h = 1 + Math.floor(R() * 2), sx = Math.floor(R() * c.width), sy = 3 + Math.floor(R() * (c.height - 6));
    px1(x, A(tint[Math.floor(R() * 2)]), sx, sy, w, h); px1(x, A(kind === 'cave' ? '#4a4452' : '#b0a898'), sx, sy, Math.max(1, w - 1), 1);
  }
  if (kind === 'cheonji') for (let i = 0; i < c.width; i++) if (vnoise(i * 0.1, 0.5, 903) > 0.45) px1(x, A(vnoise(i * 0.3, 1, 904) > 0.6 ? '#7a9a4a' : '#4e6a34'), i, 0, 1, 2);   // 이끼
  if (kind === 'cave') for (let i = 0; i < c.width; i++) px1(x, A('#4a4452'), i, 0);   // 바닥 윤곽만 은은하게
  return c;
}

// buildTheme 확장: 명소 테마는 여기서 굽고, 기존 세 테마는 원래대로
//  시간대 하나씩 따로 구울 수 있게 나눔 → 일시정지 · 결과 · 강화 고르기 화면에서 미리 구워 두고, 처음 쓸 때는 화면이 가려진 아이리스 한가운데에서 (게임 중에 멈칫하지 않게)
const _buildThemeBase = buildTheme, PLACE_PART = {};
function buildPlacePhase(kind, pi) {
  const ph = PHASES[pi], empty = p => { const c = mk(layerW(p), 140); c.empty = true; return c; };   // 빈 층 (그리기에서 건너뜀)
  if (kind === 'cave') return buildCaveSet(ph);
  const set = { sky: buildSky(ph), front: buildFront(ph), ground: buildGroundPlace(ph, kind) };
  if (kind === 'iho') Object.assign(set, { halla: buildIhoFar(ph), oreum: empty(LAYER_P.oreum), field: buildIhoSea(ph), near: buildIhoNear(ph) });
  if (kind === 'grove') Object.assign(set, { halla: buildHalla(ph), oreum: buildOreum(ph), field: buildGroveFields(ph), near: buildGroveNear(ph) });
  if (kind === 'jeongbang') Object.assign(set, { halla: empty(LAYER_P.hall), oreum: empty(LAYER_P.oreum), field: jbField4(ph), near: jbNear4(ph) });
  if (kind === 'cheonji') Object.assign(set, { halla: cjFar(ph), oreum: cjMid4(ph), field: cjField4(ph), near: cjNear4(ph) });
  return set;
}
buildTheme = function (kind) {
  if (['field', 'coast', 'beach'].includes(kind)) return _buildThemeBase(kind);
  if (THEMES[kind]) return THEMES[kind];
  const part = PLACE_PART[kind] = PLACE_PART[kind] || [], arr = [];
  PHASES.forEach((ph, pi) => Object.defineProperty(arr, pi, { get: () => part[pi] || (part[pi] = buildPlacePhase(kind, pi)), enumerable: true }));   // 시간대는 처음 그릴 때 구움 (나머지는 쉬는 화면에서 미리)
  return (THEMES[kind] = arr);
};
function prebuildPlaces(q, idle, canRun) {   // [테마, 시간대] 하나씩, canRun()일 때만 (아닐 땐 쉬었다가 이어서)
  const step = () => {
    if (!q.length) return;
    if (!canRun()) { setTimeout(() => idle(step), 1500); return; }
    const [k, pi] = q.shift();
    if (pi == null) { buildTheme(k); idle(step); return; }   // 기본 테마(성산 · 협재)는 네 시간대를 한 번에
    const part = PLACE_PART[k] = PLACE_PART[k] || []; if (!part[pi]) part[pi] = buildPlacePhase(k, pi);
    idle(step);
  };
  idle(step);
}

// 다각형 채우기: 현무암 벽 · 동굴 가림 칸의 윤곽을 칠할 때
const P_ = {
  poly(x, pts, col, a = 1) { x.globalAlpha = a; x.fillStyle = col; x.beginPath(); pts.forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py)); x.closePath(); x.fill(); x.globalAlpha = 1; },
};

// ═════════════════════════════════════════════════════════════
//  폭포 명소 공통: 갯바위 · 먼 숲 언덕 (먼 풍경 → 오름 층 → 들판(바다 · 못) 층 → 가까운 층, 멀수록 연무)
// ═════════════════════════════════════════════════════════════
function basaltRock(x, rx, ry, w, h, St, R, moss) {   // 해안 갯바위와 같은 방식 (구 음영 + 숨구멍 + 윗면 이끼)
  const pb = new PB(w + 2, h + 2);
  for (let yy = 1; yy <= h; yy++) for (let xx = 1; xx <= w; xx++) { const nx = (xx - (w + 1) / 2) / (w / 2), ny = (yy - (h + 1) / 2) / (h / 2); if (Math.abs(nx) ** 1.7 + Math.abs(ny) ** 1.5 > 0.84 + 0.22 * vnoise(xx * 0.35, yy * 0.35, rx + 71)) continue; const v = sphereLight(clamp(nx, -1, 1), clamp(ny, -1, 1)); pb.set(xx, yy, St[v < 0.32 ? 0 : v < 0.5 ? 1 : v < 0.72 ? 2 : v < 0.88 ? 3 : 4]); }
  for (let k = 0; k < w * h / 14; k++) { const a = 1 + Math.floor(R() * w), b = 1 + Math.floor(R() * h); if (pb.get(a, b) && pb.get(a, b + 1)) { pb.set(a, b, St[0]); pb.set(a, b + 1, St[3]); } }
  if (moss) for (let yy = 0; yy < h + 2; yy++) for (let xx = 0; xx < w + 2; xx++) if (pb.get(xx, yy) && !pb.get(xx, yy - 1) && hash2(xx + rx, yy, 41) < 0.7) pb.set(xx, yy, moss[xx < (w + 2) * 0.6 ? 1 : 0]);
  x.drawImage(selOut(pb, 0.5).canvas(), rx, ry);
}

// ── 천지연폭포 ──
function cjFar(ph) {   // 먼 숲 언덕 (연무에 묻힌 둥근 능선)
  const lw = layerW(LAYER_P.hall), c = mk(lw, 140), x = c.getContext('2d'), FL = ['#4e7a6a', '#5e8a76', '#709a82', '#86ac92'].map(k => atmo(k, ph, 0.45));
  for (let i = 0; i < lw; i++) { const t = Math.round(84 - Math.sin(i * 0.012 + 1) * 14 - vnoise(i * 0.05, 1, 1601) * 8); for (let y = t; y < 140; y++) px1(x, band(FL, clamp(0.75 - (y - t) / 50 + (vnoise(i * 0.3, y * 0.3, 1602) - 0.5) * 0.3 + (y - t < 2 ? 0.2 : 0), 0, 0.999), i, y, 0.6), i, y); }
  return c;
}

// ═════════════════════════════════════════════════════════════
//  제주 식생 · 현무암 주상절리
// ═════════════════════════════════════════════════════════════
// 현무암 주상절리 (픽셀마다): 폭이 제각각인 기둥 · 기둥마다 빛 받는 면 / 그늘 면으로 꺾임 · 기둥마다 다른 높이의 마디 · 거친 표면 · 아래는 젖어 어둡게
function basaltWall(c, maskPts, x0, x1, yTop, yBot, seed, opt = {}) {
  // 현무암 주상절리 (픽셀마다): 기둥이 살짝 휘고 · 폭이 제각각 · 빛 받는 면 → 그늘 면으로 부드럽게 꺾임 · 마디는 기울고 굽음 · 모서리는 풍화돼 둥글게 · 꼭대기 높이 들쭉날쭉
  const w = c.width, h = c.height, m = mkR(w, h), mx = m.getContext('2d'); P_.poly(mx, maskPts, '#fff');
  const md = mx.getImageData(0, 0, w, h).data, x = c.getContext('2d'), id = x.getImageData(0, 0, w, h), d = id.data;
  const ramp = opt.ramp || ['#18171a', '#25232a', '#34313a', '#46424a', '#5c5760', '#76707a', '#928c92'], wx = opt.warp || (i => i), mc = opt.mossCols || ['#3a6430', '#4e7c3a'];   /* mossCols: 시간대 색을 입힌 이끼 */
  if (!(WK && WK.basaltWall(md, d, w, h, x0, x1, yTop, yBot, seed, wx, ramp, opt.rag ?? 7, opt.moss || 0, mc))) basaltWallPx(md, d, w, h, x0, x1, yTop, yBot, seed, opt, ramp.map(rgb), wx, mc);
  x.putImageData(id, 0, 0);
}
function basaltWallPx(md, d, w, h, x0, x1, yTop, yBot, seed, opt, ramp, wx, mc) {   // 픽셀 (WASM: wasm/src/basalt.rs)
  const R = rng(seed), wx0 = Math.floor(Math.min(wx(x0), wx(x1))), wx1 = Math.ceil(Math.max(wx(x0), wx(x1)));   // warp: 휘어 들어간 벽 (옆으로 돌아간 면은 기둥이 좁아 보임)
  const cols = []; for (let i = wx0 - 30; i < wx1 + 30;) { const cw = 6 + Math.floor(R() * 10); cols.push({ x: i, w: cw, ridge: 0.3 + R() * 0.35, tone: (R() - 0.5) * 0.1, seg: Array.from({ length: 14 }, () => 8 + R() * 18), off: R() * 20, slant: (R() - 0.5) * 5, topOff: Math.floor(R() * (opt.rag ?? 7)) }); i += cw; }
  const topY = new Int16Array(w).fill(9999); for (let i = 0; i < w; i++) for (let y = 0; y < h; y++) if (md[(y * w + i) * 4 + 3] > 127) { topY[i] = y; break; }
  for (let y = 0; y < h; y++) for (let i = x0; i < x1; i++) {
    const p = (y * w + i) * 4; if (md[p + 3] < 128) continue;
    const iw = wx(i) + (vnoise(i * 0.05, y * 0.025, seed + 7) - 0.5) * 8 + Math.sin(y * 0.035 + i * 0.02) * 1.5;   // 기둥이 살짝 휨
    let ci = 0; while (ci < cols.length - 1 && iw >= cols[ci].x + cols[ci].w) ci++;
    const col = cols[ci], u = clamp((iw - col.x) / col.w, 0, 0.999);
    if (y < topY[i] + col.topOff * (0.4 + 0.6 * (1 - Math.sin(u * Math.PI))) + (1 - Math.sin(u * Math.PI)) * 2) continue;   // 둥글고 들쭉날쭉한 기둥 꼭대기
    let yy = y + col.off + (u - 0.5) * col.slant + Math.sin(u * Math.PI) * 1.6, si = 0; while (si < 13 && yy > col.seg[si]) { yy -= col.seg[si]; si++; }   // 기울고 굽은 마디
    const segT = yy / col.seg[si], segTone = (hash2(col.x, si, seed) - 0.5) * 0.12;
    const rr = col.ridge, face = u < rr - 0.06 ? 0.62 - u * 0.14 : u > rr + 0.06 ? 0.36 - (u - rr) * 0.22 : 0.5 - (u - rr) * 1.1;   // 면이 부드럽게 꺾임
    let v = face + col.tone + segTone + (vnoise(i * 0.3, y * 0.3, seed + 1) - 0.5) * 0.2 + (hash2(i, y, seed + 2) - 0.5) * 0.06;
    v -= clamp((y - yTop) / (yBot - yTop), 0, 1) * 0.18;
    const edgeU = Math.min(u, 1 - u), edgeS = Math.min(segT, 1 - segT) * col.seg[si];
    if (edgeU * col.w < 0.8) v = 0.1 + vnoise(i, y * 0.2, seed + 8) * 0.08;                     // 기둥 사이 틈 (휘어서 이어짐)
    else if (edgeS < 0.9) v = 0.12;                                                                // 마디 금
    else { const cr = Math.hypot(Math.max(0, 2.5 - edgeU * col.w), Math.max(0, 2.5 - edgeS)); if (cr > 0) v -= cr * 0.07; if (segT < 0.2 && u < rr) v += 0.08; }   // 모서리 풍화(둥글게 어두움) · 마디 아래 빛
    if (hash2(col.x, si, seed + 3) < 0.06) v -= 0.18;
    if (opt.moss && vnoise(i * 0.09, y * 0.035, seed + 4) > opt.moss && hash2(i >> 1, y >> 1, seed + 9) < 0.8) { const g2 = rgb(hash2(i, y, seed + 5) < 0.5 ? mc[0] : mc[1]); d[p] = g2[0]; d[p + 1] = g2[1]; d[p + 2] = g2[2]; d[p + 3] = 255; continue; }
    const k = clamp(v, 0, 0.999) * (ramp.length - 1), a = Math.floor(k), t = k - a, c0 = ramp[a], c1 = ramp[Math.min(ramp.length - 1, a + 1)], mixv = t > 0.66 ? 1 : t > 0.33 ? (hash2(i >> 1, y, seed + 6) < 0.5 ? 1 : 0) : 0;
    d[p] = mixv ? c1[0] : c0[0]; d[p + 1] = mixv ? c1[1] : c0[1]; d[p + 2] = mixv ? c1[2] : c0[2]; d[p + 3] = 255;
  }
}
function overlay(base, top) { base.getContext('2d').drawImage(top, 0, 0); return base; }

// ═════════════════════════════════════════════════════════════
//  정방폭포 · 천지연폭포: 다른 명소와 같은 픽셀 문법 — 1px 정확 · 4~5톤 램프 · 거리별 연무(atmo) · 원근 층
//  (붓질 그림을 줄여 쓰지 않음: 경계가 뭉개져 다른 배경과 이질감이 생김)
// ═════════════════════════════════════════════════════════════
// 픽셀 수관: 작은 잎 덩이 여러 개가 겹침 — 덩이마다 구 음영 · 아랫단 그늘 테로 덩이가 갈라져 보임 · 잎 끝이 삐죽한 윤곽 · 반짝이는 잎 점
function pixTree(x, cx, cy, r, ramp, R, opt = {}) {
  const fl = opt.flat || 0.82, size = Math.ceil(r * 2.8) + 8, pb = new PB(size, size), c0 = size / 2, n = opt.blobs || Math.max(5, Math.round(r * 0.9));
  const blobs = [[c0, c0 - r * 0.08, r * 0.58]];
  for (let k = 0; k < n; k++) { const a = R() * 6.283, d = Math.sqrt(R()) * r * (opt.spread || 0.6); blobs.push([c0 + Math.cos(a) * d, c0 + Math.sin(a) * d * fl, r * (0.32 + R() * 0.26)]); }
  blobs.sort((p, q) => p[1] - q[1]);
  for (const [bx, by, br] of blobs) for (let yy = Math.floor(by - br - 1); yy <= Math.ceil(by + br + 1); yy++) for (let xx = Math.floor(bx - br - 1); xx <= Math.ceil(bx + br + 1); xx++) {
    const nx = (xx + 0.5 - bx) / br, ny = (yy + 0.5 - by) / (br * fl), dd = nx * nx + ny * ny;
    if (dd > 1 + (hash2(xx + Math.round(cx) * 7, yy + Math.round(cy) * 3, 71) - 0.5) * 0.4) continue;
    let v = sphereLight(clamp(nx, -1, 1), clamp(ny, -1, 1)) * 0.7 + (0.5 - (xx - c0) / r * 0.2 - (yy - c0) / r * 0.3) * 0.3;
    if (dd > 0.66 && ny > 0.2) v -= 0.2;                                                                 // 덩이 아랫단 그늘 테
    const hh = hash2(xx + Math.round(cx) * 5, yy + Math.round(cy), 72); if (hh < 0.06) v += 0.24; else if (hh > 0.95) v -= 0.22;   // 반짝 잎 · 잎 사이 틈
    pb.set(xx, yy, ramp[clamp(Math.floor(v * ramp.length), 0, ramp.length - 1)]);
  }
  if (opt.trunk) { const [td, tl] = opt.trunk, th = opt.trunkH || r * 1.6, tw = Math.max(2, Math.round(r * 0.22)); px1(x, td, Math.round(cx - tw / 2), Math.round(cy + r * 0.3), tw, Math.round(th)); px1(x, tl, Math.round(cx - tw / 2), Math.round(cy + r * 0.3), 1, Math.round(th)); }
  x.drawImage(pb.canvas(), Math.round(cx - c0), Math.round(cy - c0));
  if (opt.flowers) for (let k = 0; k < r * 1.3; k++) { const a = R() * 6.283, d = Math.sqrt(R()) * r * 0.75, fx = Math.round(cx + Math.cos(a) * d), fy = Math.round(cy + Math.sin(a) * d * fl); if (pb.get(Math.round(fx - cx + c0), Math.round(fy - cy + c0))) { px1(x, opt.flowers[0], fx, fy, 2, 1); px1(x, opt.flowers[1], fx, fy); } }
}
// 픽셀 곰솔: 바닷바람에 굽은 줄기(아래는 굵게) · 옆으로 뻗은 가지 · 가지 끝 납작한 솔잎 덩이
function pixPine(x, cx, base, h, ramp, trunk, R, lean) {
  const pts = []; let px = cx, py = base;
  for (let k = 0; k <= 10; k++) { pts.push([px, py]); py -= h * 0.08; px += lean * h * 0.045 + (R() - 0.5) * 1.1; }
  for (let k = 0; k < 10; k++) { const [x1, y1] = pts[k], [x2, y2] = pts[k + 1], st = Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 1.5), w = k < 4 ? 2 : 1; for (let q = 0; q <= st; q++) { const tx = Math.round(x1 + (x2 - x1) * q / st), ty = Math.round(y1 + (y2 - y1) * q / st); px1(x, trunk[0], tx, ty, w, 1); if (w > 1) px1(x, trunk[1], tx, ty); } }
  for (let k = 0; k < 5; k++) {
    const p = pts[Math.min(10, 5 + k)], side = k % 2 ? 1 : -1, reach = k === 4 ? 0 : h * (0.12 + R() * 0.16), ex = Math.round(p[0] + side * reach), ey = Math.round(p[1] - 1);
    for (let q = 0; q <= reach; q++) px1(x, trunk[0], Math.round(p[0] + side * q), Math.round(p[1] - q * 0.15));
    pixTree(x, ex, ey, h * (0.15 + R() * 0.06) * (k === 4 ? 1.15 : 1), ramp, R, { flat: 0.42, blobs: 5, spread: 0.95 });
  }
}
// 픽셀 폭포: 아래로 조금 퍼짐 · 세로 물결 줄(노이즈) · 가장자리는 짙은 물빛, 가운데는 희게 · 오른쪽 그늘 · 벼랑 끝 흰 물마루와 바위 턱
function pixFall(x, x0, w, y0, y1, ph, seed, opt = {}) {
  const Wr = ['#4a6e90', '#6a92b2', '#92b6cc', '#bcd6e2', '#e2eef4', '#ffffff'].map(k => atmo(k, ph, opt.d ?? 0.12));
  for (let y = y0; y < y1; y++) {
    const t = (y - y0) / Math.max(1, y1 - y0), ww = w * (1 + t * (opt.spread ?? 0.3)), lip = y - y0 < 5 ? Math.round((1 - (y - y0) / 5) * 2) : 0, cxm = x0 + w / 2 + Math.sin(t * 2.4) * (opt.bow ?? 1) - lip;   // 벼랑 끝에서 앞으로 굽었다 떨어짐
    const L = Math.round(cxm - ww / 2 + (vnoise(y * 0.22, 1, seed) - 0.5) * 2), Rr = Math.round(cxm + ww / 2 + (vnoise(y * 0.22, 2, seed) - 0.5) * 2);
    for (let i = L; i <= Rr; i++) {
      const u = (i - L) / Math.max(1, Rr - L), st = vnoise(i * 0.55 + seed, y * 0.03 - t * 2, seed + 3), edge = Math.min(u, 1 - u);
      let v = 0.32 + (st > 0.6 ? 0.56 : st > 0.42 ? 0.32 : 0.08) + edge * 0.35 - (u > 0.68 ? (u - 0.68) * 1.1 : 0);   // 흰 줄기 · 물빛 줄기 · 오른쪽 그늘
      if (i === L || i === Rr) v = 0.2;   // 또렷한 가장자리
      if (y - y0 < 3) v = 0.99; else if (hash2(i >> 1, y, seed + 4) < 0.04) v += 0.3;   // 벼랑 끝 흰 물마루 · 부서지는 물
      px1(x, Wr[clamp(Math.floor(v * Wr.length), 0, Wr.length - 1)], i, y);
    }
  }
  px1(x, atmo('#2a2622', ph, opt.d ?? 0.12), Math.round(x0 - 3), y0 - 1, Math.round(w + 4), 1);
}
// 픽셀 물보라: 노이즈로 몽글몽글한 흰 거품 덩이 · 위로 튀는 물방울 · 물 위로 퍼지는 거품 줄 · 둘레 물안개(바둑판으로 성기게)
function pixFoam(x, cx, cy, w, ph, seed, water) {
  const F = ['#6a9cbc', '#9cc4dc', '#cde4f0', '#ecf6fa', '#ffffff'].map(k => atmo(k, ph, 0.1)), R = rng(seed);
  for (let k = 0; k < w * 5; k++) { const a = Math.PI + R() * Math.PI, d = w * (0.5 + R() * 1.0); if (R() < 0.6) px1(x, F[2], Math.round(cx + Math.cos(a) * d * 1.3), Math.round(cy - 2 + Math.sin(a) * d * 0.9)); }   // 물안개
  const pw = Math.ceil(w * 2.8) + 8, phh = Math.ceil(w * 1.2) + 10, pb = new PB(pw, phh), ox = pw / 2, base = phh - 5;
  const puffs = []; for (let k = 0; k < Math.round(w * 0.9); k++) { const t = R() * 2 - 1, pr = w * (0.16 + R() * 0.14) * (1.25 - Math.abs(t) * 0.55); puffs.push([ox + t * w * 1.05, base - (1 - t * t) * w * (0.25 + R() * 0.3) - pr * 0.3, pr]); }
  puffs.sort((p, q) => p[1] - q[1]);
  for (const [px, py, pr] of puffs) for (let yy = Math.floor(py - pr); yy <= py + pr; yy++) for (let xx = Math.floor(px - pr); xx <= px + pr; xx++) {
    const nx = (xx + 0.5 - px) / pr, ny = (yy + 0.5 - py) / pr, d2 = nx * nx + ny * ny; if (d2 > 1 || yy > base + Math.round(Math.sin(xx * 0.7) * 1.5)) continue;
    const v = sphereLight(clamp(nx, -1, 1), clamp(ny, -1, 1));
    pb.set(xx, yy, d2 > 0.76 && ny > 0.25 ? F[1] : v > 0.78 ? F[4] : v > 0.55 ? F[3] : F[2]);   // 덩이 아랫단은 옅은 물빛 테 → 덩이가 갈라져 보임
  }
  x.drawImage(selOut(pb, 0.3).canvas(), Math.round(cx - ox), Math.round(cy - base));
  for (let k = 0; k < w * 3; k++) { const a = Math.PI + 0.15 + R() * (Math.PI - 0.3), d = w * (0.75 + R() * 0.9), sz = R() < 0.25 ? 2 : 1; px1(x, F[4], Math.round(cx + Math.cos(a) * d * 1.2), Math.round(cy - w * 0.25 + Math.sin(a) * d * 0.85), sz, sz); }   // 튀어 오르는 물방울
  if (water) for (let k = 0; k < w * 2.2; k++) { const ox2 = (R() - 0.5) * w * 3.8, ln = 2 + Math.floor(R() * 6) - Math.floor(Math.abs(ox2) / w); if (ln > 0) px1(x, F[3 + (k % 2)], Math.round(cx + ox2), Math.round(cy + 1 + R() * 10), ln, 1); }   // 물 위로 퍼지는 거품 줄
}
function pixVines(x, x0, y0, len, ramp, seed) { for (let y = 0; y < len; y++) { const ox = Math.round(Math.sin((y + seed) * 0.5) * 1.2); px1(x, ramp[(y + seed) % 3 === 0 ? 3 : 1], x0 + ox, y0 + y); if (hash2(x0, y + seed, 81) < 0.35) px1(x, ramp[2], x0 + ox + (hash2(y, x0, 82) < 0.5 ? -1 : 1), y0 + y); } }

// ── 정방폭포: 왼쪽 바다와 섶섬 · 오른쪽 주상절리 절벽(위는 빽빽한 상록 숲과 곰솔) · 넓은 폭포가 바다로 · 발치 바위 (들판 층) / 앞 풀밭 · 유채 · 덤불 (가까운 층) ──
function jbField4(ph) {
  const lw = layerW(LAYER_P.field), c = mkR(lw, 200), x = c.getContext('2d'), R = rng(4101), A = (k, d = 0.14) => atmo(k, ph, d), top = 104;
  x.translate(0, 60); c.oy = -60;   // 오른쪽 절벽 · 나무 꼭대기가 층 위에서 잘리지 않게 화면 위(-60)부터
  seaBase(x, lw, ph, top, ['#1e5a9a', '#2a72b8', '#3c8ed2', '#62ace2', '#a0d2ee'], 4102);
  // 섶섬: 둥근 숲 섬 (위는 수관 덩이로 울퉁불퉁)
  const sx = Math.round(lw * 0.16), FL = ['#2e5440', '#3a644a', '#4c7a58', '#64926a'].map(k => A(k, 0.4));
  for (let i = -22; i <= 22; i++) { const t = i / 22, h = Math.round(12 * Math.pow(1 - t * t, 0.6) + (hash2(i, 1, 4103) < 0.3 ? 1 : 0)); for (let y = top - h; y <= top; y++) px1(x, y > top - 2 ? A('#3e4a48', 0.4) : FL[y < top - h + 2 ? (i < 2 ? 3 : 2) : i < 0 ? 1 : 0], sx + i, y); }
  for (let k = 0; k < 9; k++) { const i = -18 + k * 4.5 + (R() - 0.5) * 2, t = i / 22, h = 12 * Math.pow(Math.max(0, 1 - t * t), 0.6); pixTree(x, sx + i, top - h + 2, 2.6 + R() * 1.4, [FL[0], FL[1], FL[2], FL[3], FL[3]], R, { blobs: 3 }); }   // 섬을 덮은 숲 질감
  // 절벽 윤곽: 왼쪽 끝은 기둥이 들쭉날쭉 튀어나온 수직 절벽
  const x0 = Math.round(lw * 0.47), ct = i => Math.round(46 - Math.pow(clamp((i - x0) / (lw - x0), 0, 1), 1.3) * 26 + (vnoise(i * 0.08, 0.5, 4104) - 0.5) * 4);   // 오른쪽으로 갈수록 높아지는 절벽
  const topL = ct(x0 + 6), leftX = y => { const t = (118 - y) / (118 - topL); return x0 - 4 * Math.max(0, 1 - t * 4) + 6 * Math.pow(t, 2.4) + Math.sin(t * 6.5) * 1.2; };
  const mask = [[x0 - 4, 118]]; for (let y = 116; y > topL + 1; y -= 2) mask.push([leftX(y), y]); for (let i = x0 + 6; i <= lw + 2; i += 2) mask.push([i, ct(i)]); mask.push([lw + 2, 118]);   // 톱니 없이: 아래는 기슭이 살짝 넓고, 위는 둥근 어깨
  basaltWall(c, mask.map(([a, b]) => [a, b + 60]), x0 - 12, lw, 18 + 60, 118 + 60, 4105,   /* 픽셀을 직접 쓰는 함수라 층 이동(60px)을 직접 맞춤 */ { rag: 3, ramp: ['#201c1a', '#2e2a26', '#403a34', '#544d45', '#6c645a', '#887e70', '#a69a8a'].map(k => A(k, 0.12)) });
  // 폭포 뒤 젖은 오목면
  const fx = Math.round(lw * 0.77), fw = 30, WET = A('#1a1816');
  for (let y = ct(fx) + 2; y < 114; y++) for (let i = fx - 8; i < fx + fw + 8; i++) { const k = 1 - Math.hypot((i - fx - fw / 2) / (fw / 2 + 8), (y - 80) / 40); if (k > 0.15 || (k > 0 && (i + y) % 2)) px1(x, WET, i, y); }
  // 절벽 면 풀 덤불 · 늘어진 덩굴
  const GR = ['#22402a', '#2e5634', '#406e3e', '#5a8a4a', '#7aa25a'].map(k => A(k)), EV = ['#1a4428', '#285c30', '#3a763a', '#56924a', '#7aae5a'].map(k => A(k));
  for (let k = 0; k < 36; k++) { const vx = x0 + 8 + Math.floor(R() * (lw - x0 - 10)), vy = ct(vx) + 10 + Math.floor(R() * 70); if (Math.abs(vx - fx - fw / 2) < 16) continue; pixTree(x, vx, vy, 2 + R() * 2.5, GR, R, { blobs: 3 }); }
  for (let k = 0; k < 22; k++) { const vx = x0 + 6 + Math.floor(R() * (lw - x0 - 8)); if (Math.abs(vx - fx - fw / 2) < 14) continue; pixVines(x, vx, ct(vx) + 2, 5 + Math.floor(R() * 16), GR, k * 7); }
  // 절벽 위: 상록 숲 두 겹 + 바다 쪽으로 기운 곰솔
  const EVd = ['#123220', '#1c4628', '#2a5e32', '#3e783e', '#58924c'].map(k => A(k));
  for (let i = x0 - 2; i < lw + 6; i += 5) pixTree(x, i, ct(Math.max(x0, i)) - 12 - Math.floor(R() * 4), 6 + R() * 3, EVd, R);   // 맨 뒤 숲 (짙게 → 앞 덤불과 깊이 차이)
  for (let i = x0 - 2; i < lw + 6; i += 5) pixTree(x, i + 2, ct(Math.max(x0, i)) - 5, 5 + R() * 3, EV, R);
  const PN = ['#1a3a2a', '#284e36', '#3a6844', '#548652', '#74a262'].map(k => A(k)), TR = ['#3a2418', '#6a4a34'].map(k => A(k));
  for (let k = 0; k < 15; k++) { const px = x0 + 6 + k * 14 + Math.floor((R() - 0.5) * 8); if (px > lw + 4) break; pixPine(x, px, ct(Math.min(lw, Math.max(x0, px))) - 3, 24 + R() * 14, PN, TR, R, -0.3 - R() * 0.6); }
  for (let i = x0 - 4; i < lw + 6; i += 5) pixTree(x, i, ct(Math.max(x0, i)) + 1, 3.5 + R() * 2, EV, R, { blobs: 4 });
  // 넓은 폭포 · 발치 바위 · 물보라와 거품 줄
  pixFall(x, fx, fw, ct(fx) + 1, 112, ph, 4106);
  const St = ['#1e1b18', '#2e2a26', '#433d37', '#5c554c', '#7a7266'].map(k => A(k, 0.12));
  for (let k = 0; k < 18; k++) { const bw = 7 + Math.floor(R() * 10), bx = x0 - 34 + Math.floor(R() * (lw - x0 + 30)); if (Math.abs(bx + bw / 2 - fx - fw / 2) < 12) continue; basaltRock(x, bx, 104 + Math.floor(R() * 8), bw, 5 + Math.floor(R() * 5), St, R); }
  const BG = ['#24201c', '#38332d', '#4e4840', '#686056', '#867c6e'].map(k => A(k, 0.1));   // 절벽 발치 큰 둥근 바위
  for (const [bx, bw, bh] of [[x0 - 34, 22, 12], [x0 - 14, 28, 16], [x0 + 14, 20, 12], [fx - 26, 18, 11], [fx + fw + 6, 26, 15], [fx + fw + 30, 20, 12], [lw - 26, 28, 16]]) basaltRock(x, bx, 115 - bh, bw, bh, BG, R);
  for (let i = x0 - 40; i < lw; i++) if (hash2(i, 9, 4108) < 0.55 && Math.abs(i - fx - fw / 2) > 18) px1(x, A(hash2(i, 4, 4109) < 0.5 ? '#ffffff' : '#d4ecf6', 0.1), i, 114 + Math.round(Math.sin(i * 0.31) * 1.2), 1 + (hash2(i, 5, 4110) < 0.3 ? 1 : 0), 1);   // 바위 · 절벽 발치 흰 물거품
  pixFoam(x, fx + fw / 2, 113, 25, ph, 4107, true);
  c.falls = [{ x: fx, y0: ct(fx) + 2, y1: 108, w: fw, a: 0.3, foam: { x: fx + fw / 2, y: 113, w: 25, water: true } }];
  return c;
}
function jbNear4(ph) {   // 앞쪽 풀밭 · 유채 · 하얀 들꽃 · 양옆 덤불 (나무 울타리 없음)
  const lw = layerW(LAYER_P.near), c = mk(lw, 160), x = c.getContext('2d'), R = rng(2111), A = k => atmo(k, ph, 0.04), G = C.grass.map(A), Y = C.yel.map(A), WH = A('#f4f0e4');
  const EV = ['#1a4428', '#285c30', '#3a763a', '#56924a', '#7aae5a'].map(A);
  for (let i = 0; i < lw; i++) { const t = 142 + Math.round(vnoise(i * 0.08, 1, 2112) * 3); px1(x, G[1], i, t, 1, 160 - t); px1(x, G[3], i, t); if (hash2(i, 1, 2113) < 0.3) px1(x, G[4], i, t - 1); if (hash2(i, 3, 2115) < 0.12) { px1(x, G[2], i, t - 2, 1, 2); px1(x, G[4], i, t - 3); } }   // 풀밭 · 삐죽한 풀잎
  for (let k = 0; k < lw * 0.5; k++) { const i = Math.floor(R() * lw), y = 146 + Math.floor(R() * 12); px1(x, G[0], i, y, 1, 2); px1(x, G[2], i + 1, y); }   // 풀 결
  for (let i = 0; i < lw; i += 3 + Math.floor(R() * 5)) { if (vnoise(i * 0.02, 0, 2114) < 0.35) continue; const by = 152 + Math.floor(R() * 4); for (let k = 0; k < 3 + Math.floor(R() * 3); k++) { const fx = i + Math.floor(R() * 6) - 3, fy = by - 4 - Math.floor(R() * 10); px1(x, G[1], fx + 1, fy + 2, 1, by - fy); px1(x, Y[1], fx, fy, 3, 1); px1(x, Y[1], fx + 1, fy - 1, 1, 3); px1(x, Y[3], fx + 1, fy); } }   // 유채
  for (let k = 0; k < lw * 0.06; k++) { const fx = Math.floor(R() * lw), fy = 146 + Math.floor(R() * 10); px1(x, WH, fx - 1, fy); px1(x, WH, fx + 1, fy); px1(x, WH, fx, fy - 1); px1(x, WH, fx, fy + 1); px1(x, Y[2], fx, fy); }   // 하얀 들꽃
  for (let k = 0; k < 4; k++) pixTree(x, 4 + k * 12, 137 + (k % 2) * 4, 9 + R() * 3, EV, R);   // 왼쪽 앞 덤불
  for (let k = 0; k < 3; k++) pixTree(x, lw - 8 - k * 9, 124 + k * 6, 9 + R() * 3, EV, R);
  return c;
}

// ── 천지연폭포: 먼 숲 언덕(먼 층) · 골짜기 숲 비탈과 이끼 낀 주상절리 절벽 · 폭포가 둥글게 패인 골짜기(오름 층) · 앞으로 트이는 옥빛 못과 물가 숲(들판 층) · 자갈 기슭과 꽃 덤불(가까운 층) ──
const CJ = (() => { const lw = layerW(LAYER_P.oreum); return { cx: Math.round(lw * 0.56), hw: Math.round(lw * 0.3), PM: 1.2, mouth: Math.round(lw * 0.3 * 0.74) }; })();   // 천지연 말발굽 절벽: 가운데 · 반폭 · 휘는 정도 · 못 입구 반폭
function cjMid4(ph) {
  const lw = layerW(LAYER_P.oreum), c = mkR(lw, 140), x = c.getContext('2d'), R = rng(4201), A = (k, d = 0.2) => atmo(k, ph, d);
  const FAR = ['#2e5c44', '#3c6e4e', '#4e845c', '#66986c', '#84b080'].map(k => A(k, 0.2)), EV = ['#163a24', '#22522c', '#326c36', '#4c8a44', '#70a858'].map(k => A(k, 0.08)), VN = ['#2e5a26', '#447a30', '#62a03c', '#88c050', '#a8d468'].map(k => A(k, 0.1)), GR = ['#22402a', '#2e5634', '#406e3e', '#5a8a4a', '#7aa25a'].map(k => A(k, 0.12));
  for (let i = 0; i < lw; i++) px1(x, FAR[1], i, 57 + Math.round(Math.sin(i * 0.05) * 3), 1, 70);   // 숲 밑을 수관 가운데 높이부터 채워 나무 사이로 하늘이 비치지 않게
  for (let i = -6; i < lw + 8; i += 6) pixTree(x, i, 56 + Math.round(Math.sin(i * 0.05) * 3) - Math.floor(R() * 4), 7 + R() * 3, FAR, R);   // 절벽 뒤 숲 (뒷줄)
  for (let i = -3; i < lw + 8; i += 6) pixTree(x, i, 64 + Math.round(Math.sin(i * 0.07 + 1) * 3) - Math.floor(R() * 3), 7 + R() * 3, FAR, R);   // 앞줄
  for (let y = 72; y < 124; y += 8) for (let i = -4 + (y % 16 ? 3 : 0); i < lw + 8; i += 7) pixTree(x, i + (R() - 0.5) * 3, y + (R() - 0.5) * 3, 7 + R() * 3, FAR, R);   // 골짜기 아래로 이어지는 숲 (절벽에 가려지고 양옆 틈만 보임)
  const { cx: cxA, hw: halfW, PM } = CJ, sPM = Math.sin(PM), cPM = Math.cos(PM), x0 = cxA - halfW, x1 = cxA + halfW;
  const phi = i => Math.asin(clamp((i - cxA) / halfW, -1, 1) * sPM), dep = i => (Math.cos(phi(i)) - cPM) / (1 - cPM);   // dep: 0(양끝 · 앞) ~ 1(폭포 · 가장 안쪽)
  const base = i => Math.round(126 - dep(i) * 16), ct = i => Math.round(62 + dep(i) * 13 + (vnoise(i * 0.06, 0.5, 4202) - 0.5) * 4);
  for (let i = x0; i <= x1; i++) { const b0 = base(i); for (let y = b0 - 1; y < 126; y++) { const k = clamp((y - 110) / 16, 0, 1) * 0.55 + (1 - dep(i)) * 0.45; px1(x, band(['#0e4a5c', '#145e74', '#1e7890', '#3a98ae'].map(q => A(q, 0.14)), clamp(k, 0, 0.999), i, y), i, y); } }   // 안쪽 못: 절벽 그늘에 짙고, 입구 쪽으로 밝아짐
  const mask = []; for (let i = x0; i <= x1; i += 2) mask.push([i, ct(i)]); for (let i = x1; i >= x0; i -= 2) mask.push([i, base(i) + 1]);
  basaltWall(c, mask, x0 - 4, x1 + 4, 62, 128, 4203, { ramp: ['#16181a', '#22252a', '#30343a', '#40454a', '#545a5e', '#6c7276', '#888e90'].map(k => A(k, 0.18)), moss: 0.7, mossCols: ['#3a6430', '#4e7c3a'].map(k => A(k, 0.18)), warp: i => cxA + phi(i) / sPM * halfW });
  { const id = x.getImageData(0, 0, lw, 140), d = id.data;   // 휘어 든 면의 밝기: 해를 보는 오른쪽 벽은 밝게, 왼쪽 벽 · 가장 안쪽은 그늘 · 폭포 둘레는 물안개
    for (let i = Math.max(0, x0); i < Math.min(lw, x1 + 1); i++) { const f = 1 + 0.26 * phi(i) / PM - 0.1 * dep(i); for (let y = ct(i) - 2; y <= base(i) + 1; y++) { const q = (y * lw + i) * 4; if (!d[q + 3]) continue; const mist = Math.max(0, 1 - Math.abs(i - cxA) / 34) * clamp((y - 86) / 26, 0, 1) * 0.3; for (let k = 0; k < 3; k++) d[q + k] = clamp(d[q + k] * f + (226 - d[q + k] * f) * mist, 0, 255); } }
    x.putImageData(id, 0, 0); }
  for (let i = x0; i <= x1; i++) { const b0 = base(i), t0 = b0 - 14 + Math.round(Math.sin(i * 0.04) * 2); for (let y = t0; y < b0; y++) { const k = (y - t0) / 14; if (k > 0.3 || (i + y) % 2) px1(x, A(k > 0.65 ? '#101214' : '#181a1e', 0.18), i, y); } }   // 물가 아래쪽 패인 그늘
  for (let k = 0; k < 16; k++) { const vx = x0 + 8 + Math.floor(R() * (x1 - x0 - 16)), vy = ct(vx) + 8 + Math.floor(R() * Math.max(4, base(vx) - ct(vx) - 22)); pixTree(x, vx, vy, 2 + R() * 2, GR, R, { blobs: 3 }); }
  const fw = 20, fx = cxA - 10;
  for (let k = 0; k < 44; k++) { const vx = x0 + 4 + Math.floor(R() * (x1 - x0 - 8)); if (Math.abs(vx - cxA) < 17) continue; pixVines(x, vx, ct(vx) + 1, Math.min(6 + Math.floor(R() * 24), base(vx) - ct(vx) - 6), k % 2 ? VN : GR, k * 5); }   // 늘어진 덩굴 (밝은 잎 · 짙은 잎)
  for (let i = x0 - 2; i < x1 + 4; i += 5) pixTree(x, i, ct(i) - 2, 4 + R() * 2, EV, R, { blobs: 4 });
  // 폭포: 가장 안쪽 벽에서 떨어지는 한 줄기 + 오른쪽 가는 갈래 · 발치 물보라
  const fb = base(fx + fw / 2);
  pixFall(x, fx, fw, ct(fx) + 1, fb, ph, 4204, { d: 0.22 }); pixFall(x, fx + fw + 4, 3, ct(fx + fw + 4) + 3, fb, ph, 4206, { d: 0.22, spread: 0.2 });
  pixFoam(x, fx + fw / 2, fb, 17, ph, 4207, false);
  // 양옆 숲: 산처럼 솟지 않고 뒤 숲과 한 덩이로 이어진 숲 지붕 (가장자리로 갈수록 살짝만 높아지고, 폭포 쪽으로 내려와 절벽 끝을 덮음)
  const MID = FAR.map((k, i) => mix(k, EV[i], 0.5)), sideTop = [[-8, x0 + 18, i => 47 + Math.pow(clamp((i + 8) / (x0 + 26), 0, 1), 1.4) * 19], [x1 - 18, lw + 8, i => 47 + Math.pow(clamp((lw + 8 - i) / (lw - x1 + 26), 0, 1), 1.4) * 19]];
  for (const [sx0, sx1, f] of sideTop) for (let i = Math.max(0, sx0); i < Math.min(lw, sx1); i++) { const t = Math.round(f(i) + 4 + (vnoise(i * 0.2, 3, 4208) - 0.5) * 3); px1(x, t < 70 ? MID[1] : EV[1], i, t, 1, 124 - t); }   // 숲 밑 채우기
  const crowns = []; for (let y = 40; y < 124; y += 6) sideTop.forEach(([sx0, sx1, f], sd) => { const jag = Math.round((vnoise(y * 0.15, 2 + sd, 4210) - 0.5) * 22);   /* 절벽 끝을 덮는 숲 가장자리는 줄마다 들쭉날쭉 */ for (let i = sx0 + (sd ? -jag : 0); i < sx1 + (sd ? 0 : jag); i += 7) { const top = f(i) + (vnoise(i * 0.09, 1, 4209) - 0.5) * 6; if (y >= top) crowns.push([i + (R() - 0.5) * 4, y + (R() - 0.5) * 3, 7 + R() * 3]); } });
  crowns.sort((p, q) => p[1] - q[1]).forEach(([cx, cy, r]) => pixTree(x, cx, cy, r, cy < 66 ? MID : EV, R));   // 위(먼 쪽)는 뒤 숲 색에 가깝게, 아래(가까운 쪽)는 짙게
  c.falls = [{ x: fx, y0: ct(fx) + 2, y1: fb - 2, w: fw, a: 0.3, foam: { x: fx + fw / 2, y: fb, w: 17, water: true } }];
  return c;
}
function cjField4(ph) {   // 옥빛 못: 폭포 쪽 좁은 입구에서 앞으로 나올수록 넓게 트임 · 양옆 물가는 비스듬히 벌어지는 바위 · 덤불
  const lw = layerW(LAYER_P.field), c = mk(lw, 140), x = c.getContext('2d'), R = rng(4211), A = (k, d = 0.1) => atmo(k, ph, d), top = 118;
  seaBase(x, lw, ph, top, ['#145e78', '#1e7a96', '#2c98b4', '#4cb6cc', '#8ad6e2'], 4212);
  const mc = CJ.cx + 3, mh = CJ.mouth, shoreY = i => i < mc - mh ? top + Math.pow((mc - mh - i) / (mc - mh), 0.8) * 17 : i > mc + mh ? top + Math.pow((i - mc - mh) / (lw - mc - mh), 0.8) * 17 : top;
  x.fillStyle = A('#0e4a5e');   // 입구 바로 앞은 절벽 그늘이 이어져 짙게
  for (let y = top; y < top + 7; y++) for (let i = mc - mh; i < mc + mh; i++) { const k = Math.round((1 - (y - top) / 7) * (1 - Math.pow(Math.abs(i - mc) / mh, 2)) * 3) / 3 * 0.5; if (k > 0) { x.globalAlpha = k; x.fillRect(i, y, 1, 1); } }
  x.globalAlpha = 1;
  for (let y = top; y < top + 12; y++) for (let i = mc - 8; i < mc + 8; i++) if (hash2(i, y >> 1, 4213) < (1 - Math.abs(i - mc) / 8) * (1 - (y - top) / 12) * 0.6) px1(x, A('#c8e8ec'), i, y);   // 폭포가 비친 옅은 빛
  const St = ['#2a2c2c', '#40444a', '#5c6064', '#7c8084', '#9ea2a2'].map(k => A(k, 0.12)), MO = ['#3a6a30', '#5a8a3a'].map(k => A(k, 0.12));
  const BU = ['#1c4a26', '#2a6430', '#3e823a', '#5ca04a', '#80bc5c'].map(k => A(k, 0.12));
  const FO = ['#163a24', '#22522c', '#326c36', '#4c8a44', '#70a858'].map(k => A(k, 0.08));   // 뒤 숲 비탈(cjMid4)과 같은 숲 색
  for (let i = 0; i < lw; i++) { const sy = Math.round(shoreY(i)); if (sy > top) px1(x, FO[0], i, top, 1, sy - top); }   // 숲 밑 그늘 (나무 사이 틈으로만 보임)
  for (let y = top - 3; y < top + 18; y += 5) for (let i = -4; i < lw + 4; i += 6) { if (shoreY(i) < y + 5) continue; pixTree(x, i + (R() - 0.5) * 3, y + (R() - 0.5) * 2, 6 + R() * 3, FO, R); }   // 양옆 물가까지 내려온 숲 (빈 초록 면 없이 나무로 채움)
  for (let bx = 2; bx < lw; bx += 7 + Math.floor(R() * 5)) { if (Math.abs(bx - mc) < mh - 4) continue; pixTree(x, bx, Math.round(shoreY(bx)) - 6, 5 + R() * 2.5, BU, R, { blobs: 4 }); }   // 물가 덤불
  for (let bx = 0; bx < lw;) { const bw = 9 + Math.floor(R() * 8), bh = 5 + Math.floor(R() * 4), cxr = bx + bw / 2; if (Math.abs(cxr - mc) < mh - 6) { bx = Math.abs(cxr - mc) < mh - 6 && cxr < mc ? mc + mh - 6 : bx + bw; continue; } basaltRock(x, bx, Math.round(shoreY(cxr)) + 2 - bh, bw, bh, St, R, MO); bx += bw - 2 + Math.floor(R() * 5); }   // 비스듬히 벌어지는 물가 바위
  for (let k = 0; k < 60; k++) { const y = top + 3 + Math.floor(Math.pow(R(), 1.2) * 19), px = Math.floor(R() * lw); if (y > shoreY(px) + 1) px1(x, A(R() < 0.5 ? '#ffffff' : '#c8eef4'), px, y, 2 + Math.floor(R() * 5), 1); }   // 잔물결
  return c;
}
function cjNear4(ph) {   // 앞쪽: 못가 자갈 기슭 · 주황 꽃 덤불 · 이끼 바위 (양옆 큰 나무는 화면을 가려서 뺌)
  const lw = layerW(LAYER_P.near), c = mk(lw, 160), x = c.getContext('2d'), R = rng(4221), A = k => atmo(k, ph, 0.05);
  for (let i = 0; i < lw; i++) { const t = 143 + Math.round(vnoise(i * 0.12, 1, 4222) * 3 - 1); px1(x, A('#3a3c38'), i, t, 1, 160 - t); if (hash2(i, 2, 4223) < 0.5) px1(x, A('#4e504a'), i, t); }
  for (let k = 0; k < 140; k++) px1(x, A(pick2(R, ['#5a5c56', '#6e706a', '#4a4c48'])), Math.floor(R() * lw), 144 + Math.floor(R() * 12), 2 + Math.floor(R() * 3), 1);
  const BL = ['#1c4426', '#2a5e2e', '#3e7e38', '#5c9e46', '#86c05a'].map(A), FLW = ['#e0782a', '#ffb050'].map(A), St = ['#2e302e', '#464844', '#62645e', '#80827a', '#a0a298'].map(A), MO = ['#3a6a30', '#5a8a3a'].map(A);
  for (let k = 0; k < 6; k++) pixTree(x, 14 + k * 15 + Math.floor(R() * 6), 133 + Math.floor(R() * 6), 8 + R() * 3, BL, R, { flowers: FLW });
  for (let k = 0; k < 3; k++) pixTree(x, lw - 12 - k * 16, 136 + Math.floor(R() * 4), 7 + R() * 3, BL, R);
  for (const [rx, w2] of [[4, 22], [lw - 34, 24], [Math.round(lw * 0.5), 12]]) basaltRock(x, rx, 136, w2, 10, St, R, MO);
  return c;
}

// ═════════════════════════════════════════════════════════════
//  만장굴 — 옆에서 본 용암동굴 (다른 명소처럼 층층이 겹치고, 카메라가 움직이면 층마다 다르게 밀림)
//   먼 벽: 가로로 흐르는 용암 흐름선 · 두툼한 용암선반 · 벽 밑 등불이 벽을 따뜻하게 비춤 · 오른쪽 끝 이어지는 굴
//   용암석주(왼쪽): 천장에서 흘러내린 용암이 쌓여 굳은 모래시계 모양 기둥 — 만장굴의 상징, 발치 조명에 금빛
//   천장: 금 간 현무암 판 · 짧고 뭉툭한 용암종유 · 무너진 천장 구멍(하늘 · 덩굴) → 비스듬한 빛줄기 → 이끼 바닥
//   놀이 영역 뒤(박쥐 · 낙석이 지나가는 곳)는 중간 밝기로 두고, 가장 어두운 곳은 천장 · 화면 가장자리
// ═════════════════════════════════════════════════════════════
const CVR = {   // 같은 밝기 단계끼리 짝: 낮빛 쪽(서늘한 회청) · 가운데(보랏빛 회색) · 등불 쪽(따뜻한 황갈)
  cool: ['#0b0a0f', '#121219', '#1a1a22', '#22242d', '#2c2f39', '#373b45', '#454a53', '#565c64', '#6b7279', '#868d92', '#a5adb0'],
  neut: ['#0c0a0d', '#141215', '#1d1a1e', '#262227', '#302b31', '#3c363b', '#4a4347', '#5a5255', '#6c6365', '#827877', '#9c908c'],
  warm: ['#0e0b0a', '#18120f', '#231a15', '#30231b', '#3e2c21', '#4e3828', '#61452f', '#765438', '#8d6542', '#a6784d', '#c08c58'],
};
function cvC(v, w) {   // v: 밝기 0~1 · w: -1 낮빛(서늘) ~ 0 ~ 1 등불(따뜻)
  const i = clamp(Math.round(v * 10), 0, 10), q = Math.round(clamp(w, -1, 1) * 3) / 3;
  return q < 0 ? mix(CVR.neut[i], CVR.cool[i], -q) : q > 0 ? mix(CVR.neut[i], CVR.warm[i], q) : CVR.neut[i];
}
// 화면 좌표(카메라가 가운데일 때) · y는 캔버스 기준(월드 + 60)
const CV = {
  wallLamps: [[150, 182, 1], [346, 182, 0.85]],   // 먼 벽 밑 등불 (x · y · 세기)
  col: 80, colLamps: [[50, 190], [110, 190]],     // 용암석주 가운데 · 발치 조명
  hole: [284, 338],                               // 무너진 천장 구멍
  shaft: { t: [292, 330, 44], b: [252, 314, 192] },   // 빛줄기 위 (왼 · 오 · y) → 아래
  passage: { cx: 404, hw: 28, top: 118, bot: 183 },   // 오른쪽 끝 이어지는 굴
};
function cvLight(sx, sy, colK = 1) {   // 화면 좌표 → [등불빛, 낮빛] · colK: 석주 조명이 미치는 정도 (먼 벽은 덜 받게 해서 석주가 도드라지게)
  let L = 0;
  for (const [lx, ly, s] of CV.wallLamps) { const dx = (sx - lx) / 44, dy = (sy - ly) / (sy < ly ? 80 : 12); L += s * Math.exp(-dx * dx - dy * dy); }
  for (const [lx, ly] of CV.colLamps) { const dx = (sx - lx) / 30, dy = (sy - ly) / (sy < ly ? 150 : 10); L += 0.75 * colK * Math.exp(-dx * dx - dy * dy); }
  const dx = (sx - 290) / 58, dy = (sy - 104) / 110;
  return [L, 0.5 * Math.exp(-dx * dx - dy * dy)];
}
function cvPut(d, w, i, y, col) { if (i < 0 || i >= w || y < 0) return; const p = (y * w + i) * 4; if (p >= d.length) return; const c = rgb(col); d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255; }
function cvBlend(d, w, i, y, col, a) {   // 이미 그린 칸 위에 반투명하게 (빛줄기)
  if (i < 0 || i >= w || y < 0) return; const p = (y * w + i) * 4; if (p >= d.length) return;
  const c = rgb(col), a0 = d[p + 3] / 255, ao = a + a0 * (1 - a); if (ao <= 0) return;
  for (let k = 0; k < 3; k++) d[p + k] = (c[k] * a + d[p + k] * a0 * (1 - a)) / ao;
  d[p + 3] = ao * 255;
}
function cvCell(u, v, seed) {   // 보로노이: [가장자리까지 거리, 칸 번호] — 금 간 천장 판
  let d1 = 9, d2 = 9, hid = 0; const gu = Math.floor(u), gv = Math.floor(v);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const cu = gu + a + hash2(gu + a, gv + b, seed), cv = gv + b + hash2(gu + a, gv + b, seed + 1), dd = Math.hypot(u - cu, v - cv); if (dd < d1) { d2 = d1; d1 = dd; hid = hash2(gu + a, gv + b, seed + 2); } else if (dd < d2) d2 = dd; }
  return [d2 - d1, hid];
}
function cvMask(w, h, pts) {   // 다각형 윤곽 → 칸 가림 (경계 반투명은 버림)
  const c = mkR(w, h), x = c.getContext('2d'); P_.poly(x, pts, '#fff'); const d = x.getImageData(0, 0, w, h).data, m = new Uint8Array(w * h);
  for (let q = 0; q < w * h; q++) m[q] = d[q * 4 + 3] > 120 ? 1 : 0;
  return m;
}
// 각진 현무암 덩이: 다각형 윤곽 + 면마다 다른 밝기 (빛 받는 면 · 그늘 면) · 면 사이 금 · 셀아웃 테
//  X: 층 안의 왼쪽 · Y: 바닥 · sh: 층이 쉬는 화면에서 밀리는 만큼(빛 계산용) · opt.moss: 윗면 이끼 · opt.day: 낮빛 세기
function cvRock(x, X, Y, w, h, R, sh, opt = {}) {
  const pw = w + 2, phh = h + 2, n = 7 + Math.floor(R() * 3), pts = [];
  for (let k = 0; k < n; k++) { const a = Math.PI + (k / (n - 1)) * Math.PI, rr = 0.82 + R() * 0.22; pts.push([1 + w / 2 + Math.cos(a) * w / 2 * rr, 1 + h + Math.sin(a) * h * rr]); }
  pts[0][1] = pts[n - 1][1] = h + 1;
  const m = cvMask(pw, phh, pts), pb = new PB(pw, phh);
  const fc = Array.from({ length: 3 + Math.floor(R() * 3) }, () => { const fx = 1 + R() * w, fy = 1 + R() * h, side = (fx - 1 - w / 2) / (w / 2), up = 1 - (fy - 1) / h; return [fx, fy, side * 0.8 + (R() - 0.5) * 0.4, -0.25 - up * 0.75 + (R() - 0.5) * 0.3]; });
  const [L, D0] = cvLight(X - sh + w / 2, Y - h * 0.6), D = D0 * (opt.day ?? 1), wm = clamp((L * 1.4 - D * 1.2) / (0.25 + L + D), -1, 1);
  const lx = D > L ? 0.45 : -0.55, ly = -0.75, lz = 0.5, ln = Math.hypot(lx, ly, lz);
  for (let yy = 0; yy < phh; yy++) for (let xx = 0; xx < pw; xx++) {
    if (!m[yy * pw + xx]) continue;
    let b1 = 1e9, b2 = 1e9, f = fc[0]; for (const q of fc) { const dd = (xx - q[0]) ** 2 + ((yy - q[1]) * 1.4) ** 2; if (dd < b1) { b2 = b1; b1 = dd; f = q; } else if (dd < b2) b2 = dd; }
    const nz = Math.sqrt(Math.max(0.05, 1 - f[2] * f[2] - f[3] * f[3])), lam = Math.max(0, (f[2] * lx + f[3] * ly + nz * lz) / ln);
    let v = (0.16 + lam * 0.5) * (0.6 + L * 0.8 + D * 0.7) + (vnoise(xx * 0.5 + X, yy * 0.5, 7601) - 0.5) * 0.05;
    if (Math.sqrt(b2) - Math.sqrt(b1) < 1.1) v *= 0.78;   // 면 사이 모서리 금
    if (yy >= h) v *= 0.7;   // 바닥에 닿는 아랫단 그늘
    let col = cvC(clamp(v, 0, 1), wm);
    if (opt.moss && f[3] < -0.6 && vnoise(xx * 0.4 + X, yy * 0.6, 7602) > 0.45) col = mix(['#22362a', '#30482e', '#425e36', '#587840', '#70904a'][clamp(Math.round(v * 6), 0, 4)], CVR.neut[2], 1 - (opt.day ?? 1) * 0.85);   // 윗면 이끼 (드문드문)
    pb.set(xx, yy, col);
  }
  x.drawImage(selOut(pb, 0.55).canvas(), Math.round(X - 1), Math.round(Y - h - 1));
}
function cvGlow(x, cx, cy, rx, ry, col, a) {   // 등불 번짐: 둥근 판 3겹 (픽셀 단위로 끊어지게)
  x.fillStyle = col;
  for (const k of [1, 0.66, 0.36]) {
    x.globalAlpha = a / 3; const ax = rx * k, ay = ry * k;
    for (let y = -Math.floor(ay); y <= Math.floor(ay); y++) { const hw = Math.round(ax * Math.sqrt(Math.max(0, 1 - (y / ay) ** 2))); if (hw > 0) x.fillRect(Math.round(cx) - hw, Math.round(cy) + y, hw * 2, 1); }
  }
  x.globalAlpha = 1;
}
function cvLamp(x, X, Y, big) {   // 돌받침 등불: 낮은 현무암 받침 위 네모난 등 (나무 난간 없음) · X,Y: 받침 아래 가운데
  cvGlow(x, X, Y - 7, big ? 12 : 9, big ? 9 : 7, '#ffc070', 0.32);
  const w = big ? 9 : 7;
  px1(x, '#16110e', X - (w >> 1) - 1, Y - 5, w + 2, 5); px1(x, '#4a3424', X - (w >> 1), Y - 5, w, 1); px1(x, '#2e2219', X - (w >> 1), Y - 4, w, 3); px1(x, '#5c4430', X - (w >> 1), Y - 4, 1, 3);   // 받침
  px1(x, '#2a1c12', X - 2, Y - 10, 5, 5); px1(x, '#ffcf7a', X - 1, Y - 9, 3, 3); px1(x, '#fff3cf', X - 1, Y - 9, 1, 2); px1(x, '#e09040', X + 1, Y - 7, 1, 1);   // 등
  px1(x, '#3a2a1c', X - 3, Y - 11, 7, 1);   // 지붕
}

// 먼 벽 (하늘 층 · 움직이지 않음 → 화면 좌표 그대로)
function caveWall(day) {
  const H2 = 140 + VOFF, c = mkR(W, H2), x = c.getContext('2d'), id = x.createImageData(W, H2), d = id.data;
  if (!(WK && WK.caveWall(d, W, day))) caveWallPx(d, day);
  x.putImageData(id, 0, 0);
  cavePassage(x, day);
  return c;
}
function caveWallPx(d, day) {   // 픽셀 (WASM: wasm/src/cave.rs wall)
  const H2 = 140 + VOFF, F = caveWallData();
  for (let q = 0; q < W * H2; q++) { const L = F.L[q], D = F.D[q] * day; cvPut(d, W, q % W, (q / W) | 0, cvC(F.a[q] * (F.amb[q] + L * 0.66 + D * 0.6) + F.hl[q] * (0.4 + L), (L * 1.5 - D * 1.2) / (0.2 + L + D))); }
}
function caveWallData() {   // 먼 벽의 결(흐름선 · 선반 · 금 · 숨구멍)과 등불 · 낮빛 세기 — 시간대와 상관없어 한 번만 계산
  if (caveWallData.v) return caveWallData.v;
  const H2 = 140 + VOFF, n = W * H2, F = { a: new Float32Array(n), hl: new Float32Array(n), L: new Float32Array(n), D: new Float32Array(n), amb: new Float32Array(n) }, R = rng(7001);
  const base = []; for (let y = 36; y < 188; y += 3 + Math.floor(Math.pow(R(), 1.5) * 10)) base.push(y);
  const S = base.map((b, k) => ({ b, alb: 1 + (hash2(k, 1, 7003) - 0.5) * 0.2, pits: hash2(k, 2, 7004) < 0.2, s: 0.55 + hash2(k, 3, 7005) * 0.45 }));
  const U = i => Math.sin(i * 0.011 + 0.7) * 3 + (vnoise(i * 0.018, 0.5, 7002) - 0.5) * 5;
  const SH = [{ y: 100, s: 7010 }, { y: 152, s: 7020 }];
  const crack = new Set(); for (const cx0 of [124, 232, 306, 366]) { let cx = cx0, dir = 0; for (let y = 34; y < 92 + (cx0 % 3) * 6; y++) { if (R() < 0.35) dir = Math.round((R() - 0.5) * 2); if (R() < 0.6) cx += dir; crack.add(cx + ',' + y); } }
  for (let i = 0; i < W; i++) {
    const u = U(i), bs = S.map((o, k) => o.b + u * (0.4 + 0.6 * o.b / 190) + (vnoise(i * 0.035, k * 1.7, 7006) - 0.5) * 2.4), wb = 183 + Math.round((vnoise(i * 0.04, 4.5, 7011) - 0.5) * 5);
    const shv = SH.map(o => {
      const pr = vnoise(i * 0.012 + o.s, 0.5, o.s + 1), top = Math.round(o.y + u * 0.8 + (vnoise(i * 0.03, 1, o.s + 2) - 0.5) * 4);
      let th = pr < 0.36 ? 0 : Math.round((2 + vnoise(i * 0.06, 2, o.s + 3) * 5) * clamp((pr - 0.36) / 0.12, 0, 1));
      if (th && vnoise(i * 0.35, 5, o.s + 5) > 0.84) th += 1 + Math.round(vnoise(i * 0.9, 6, o.s + 6));   // 선반 끝에서 흘러내리다 굳은 방울
      return { top, th, sd: Math.round(3 + vnoise(i * 0.05, 3, o.s + 4) * 4) };
    });
    let k = 0;
    for (let y = 0; y < H2; y++) {
      while (k < bs.length - 1 && y >= bs[k + 1]) k++;
      const mot = (fbm(i * 0.016, y * 0.07, 7007) - 0.5) * 0.2;
      let a = 0.76 + mot, hl = 0;
      if (y >= bs[0] && y < wb - 2) {
        const o = S[k], dy = y - Math.floor(bs[k]), on = vnoise(i * 0.022, k * 3.1, 7008) > 0.33;
        a *= o.alb;
        if (on && dy === 0) a *= 1 - 0.34 * o.s; else if (on && dy === 1) hl = 0.06 * o.s;   // 흐름선: 골 + 바로 아래 빛 받는 턱
        if (o.pits && hash2(i, y, 7009) < 0.025) a *= 0.62;   // 숨구멍 많은 지층
      }
      for (const s of shv) if (s.th) {
        const r = y - s.top;
        if (r === -1) hl = 0.2;
        else if (r >= 0 && r < s.th) { a = (0.92 - r / s.th * 0.14) * (1 + mot * 0.5); hl = r === 0 ? 0.1 : 0; }
        else if (r >= s.th && r < s.th + s.sd) { a *= 0.42 + 0.4 * (r - s.th) / s.sd; hl = 0; }
        else if (r >= s.th + s.sd && r < s.th + s.sd + 4) a *= 0.9;
      }
      if (crack.has(i + ',' + y)) { a *= 0.42; hl = 0; } else if (crack.has((i + 1) + ',' + y)) hl = 0.08;
      if (y >= wb - 3 && y < wb) a *= 0.55 + (wb - 1 - y) * 0.08;   // 벽과 바닥이 만나는 그늘
      if (y >= wb) a = 0.95 + (vnoise(i * 0.1, y * 0.3, 7012) - 0.5) * 0.2;   // 바닥 (위를 향해 밝음)
      const [L, D0] = cvLight(i, y, 0.4), vig = 1 - Math.pow(Math.abs(i - W / 2) / (W / 2), 3) * 0.4, q = y * W + i;
      F.a[q] = a; F.hl[q] = hl; F.L[q] = L; F.D[q] = D0; F.amb[q] = (y < 40 ? 0.2 + y / 40 * 0.1 : 0.3) * vig + (y >= wb ? 0.06 : 0);
    }
  }
  return (caveWallData.v = F);
}
// 오른쪽 끝: 벽 속으로 이어지는 갈래 굴 — 안으로 갈수록 작아지며 어두워지는 아치 몇 겹 · 바닥 등불 · 굽이 너머 희미한 빛
function cavePassage(x, day) {
  const { cx, hw, top, bot } = CV.passage, vx = cx - 6, vy = bot - 26, ay = top + hw;
  const ox = cx - hw - 5, oy = top - 5, w = Math.min(W - ox, hw * 2 + 10), h = bot - top + 6, id = x.getImageData(ox, oy, w, h), d = id.data;
  const inside = (i, y) => { const dx = (i - cx) / hw; return Math.abs(dx) <= 1 && y < bot && y >= ay - Math.sqrt(1 - dx * dx) * (ay - top); };
  const SC = [1, 0.7, 0.48, 0.32, 0.2], inK = (i, y, k) => inside(vx + (i - vx) / SC[k], vy + (y - vy) / SC[k]);
  for (let yy = 0; yy < h; yy++) for (let ii = 0; ii < w; ii++) {
    const i = ox + ii, y = oy + yy;
    if (!inside(i, y)) {   // 입구 테두리: 벽이 두껍게 보이도록 (왼쪽은 등불빛, 오른쪽은 그늘)
      if ([[-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0], [0, -2]].some(([a, b]) => inside(i + a, y + b))) { const [L] = cvLight(i, y); cvPut(d, w, ii, yy, cvC(i < cx ? 0.36 + L * 0.4 : 0.16, i < cx ? clamp(L * 1.6, 0, 1) : 0)); }
      continue;
    }
    let k = 0; while (k < SC.length - 1 && inK(i, y, k + 1)) k++;
    const edgeL = !inK(i - 1, y, k) || !inK(i - 2, y, k), edgeT = !inK(i, y - 1, k), fl = y > vy + (bot - vy) * SC[k] - 3;
    let v = [0.27, 0.2, 0.14, 0.09, 0.06][k] + (vnoise(i * 0.2, y * 0.2, 7051) - 0.5) * 0.04;
    if (fl) v += 0.06;   // 각 겹의 바닥
    if (edgeL && i > vx - 2) v -= 0.05; else if (edgeL || edgeT) v += 0.07 * (1 - k * 0.18);   // 겹마다 왼쪽 · 위 테는 빛, 오른쪽 안벽은 그늘
    const ed = Math.hypot((i - vx) / (hw * 0.32), (y - vy - 6) / (hw * 0.28)), end = ed < 1 ? (ed < 0.5 ? 0.16 : 0.09) : 0;   // 굽이 너머에서 새어 드는 빛 (두 단계)
    cvPut(d, w, ii, yy, cvC(clamp(v + end, 0, 1), clamp(0.45 - k * 0.08 + end * 4, 0, 1)));
  }
  x.putImageData(id, ox, oy);
}

// 용암석주 (오름 층 · 0.16배) — 천장 구멍에서 흘러내린 용암이 겹겹이 쌓여 굳은 기둥
//  둥근 몸통 위에 흘러내린 방울 덩이를 얹은 높이 지도 → 면 기울기로 음영 (덩이 사이 골은 부드럽게 어둡고, 바닥 조명을 향한 아랫면은 금빛)
function caveColumn() {
  const p = LAYER_P.oreum, lw = layerW(p), sh = Math.round(20 * p), H2 = 200, c = mk(lw, H2), x = c.getContext('2d'), id = x.createImageData(lw, H2), d = id.data;
  if (!(WK && WK.caveColumn(d, lw, sh))) caveColumnPx(d, lw, sh);
  x.putImageData(id, 0, 0);
  for (const [lx, ly] of CV.colLamps) {   // 바닥 조명: 석주를 올려 비추는 낮은 등
    const X = lx + sh; cvGlow(x, X, ly - 5, 12, 8, '#ffc070', 0.35);
    px1(x, '#16110e', X - 4, ly - 4, 9, 4); px1(x, '#3e2c20', X - 3, ly - 4, 7, 1); px1(x, '#ffd890', X - 2, ly - 6, 5, 2); px1(x, '#fff3cf', X - 1, ly - 6, 2, 1);
  }
  c.oy = -VOFF;
  return c;
}
function caveColumnPx(d, lw, sh) {   // 픽셀 (WASM: wasm/src/cave.rs column)
  const R = rng(7310), H2 = 200, cx = CV.col + sh, top = 10, bot = 192;
  const prof = y => {
    const t = clamp((y - top) / (bot - top), 0, 1);
    const waist = tt => 9 + Math.sin((tt - 0.2) * 14) * 1.5 + (tt - 0.2) * 7, w = t < 0.2 ? 9 + Math.pow(1 - t / 0.2, 2) * 22 : t < 0.56 ? waist(t) : waist(0.56) + Math.pow((t - 0.56) / 0.44, 1.35) * 34;   // 이음매 없이 이어지게
    return w + (vnoise(y * 0.07, 0.5, 7301) - 0.5) * 4;
  };
  const lean = y => Math.sin(clamp((y - top) / (bot - top), 0, 1) * 2.6 + 0.2) * 3;
  const blobs = [];
  for (let y = top + 6; y < bot - 3; y += 4 + R() * 4) {
    const hw = prof(y), m = cx + lean(y), base = y > bot - 56, n = Math.max(2, Math.round(hw / (base ? 8 : 6)));
    for (let k = 0; k < n; k++) { const u = (k / (n - 1) - 0.5) * 2 * 0.75 + (R() - 0.5) * 0.3, rx = hw * (0.24 + R() * 0.18) + 2, ry = rx * (base ? 0.7 + R() * 0.4 : 1.6 + R() * 1.2); blobs.push([m + u * (hw - rx * 0.4), Math.min(bot - ry * 0.6, y + ry * 0.5), rx, ry]); }
  }
  const x0 = cx - 60, x1 = cx + 60, gw = x1 - x0 + 1, Hm = new Float32Array(gw * H2);
  for (let y = 0; y < bot; y++) { const hw = prof(Math.max(top, y)) + (y < top ? (top - y) * 1.3 : 0), m = cx + lean(Math.max(top, y)); for (let i = x0; i <= x1; i++) { const dx = (i + 0.5 - m) / hw; Hm[y * gw + i - x0] = Math.abs(dx) < 1 ? Math.sqrt(1 - dx * dx) * hw * 0.75 : 0; } }
  for (const [bx, by, rx, ry] of blobs) for (let yy = Math.max(0, Math.floor(by - ry)); yy <= Math.min(bot - 1, Math.ceil(by + ry)); yy++) for (let i = Math.max(x0, Math.floor(bx - rx)); i <= Math.min(x1, Math.ceil(bx + rx)); i++) {
    const nx = (i + 0.5 - bx) / rx, ny = (yy + 0.5 - by) / ry, dd = nx * nx + ny * ny; if (dd >= 1) continue;
    const q = yy * gw + i - x0, hb = Math.sqrt(1 - dd) * rx * 0.55, m = cx + lean(yy), hw = prof(yy), dx = (bx - m) / hw, base = Math.abs(dx) < 1 ? Math.sqrt(1 - dx * dx) * hw * 0.75 : 0;
    Hm[q] = Math.max(Hm[q], base * 0.92 * Math.pow(1 - dd, 0.35) + hb);   // 덩이 가장자리는 몸통 면으로 부드럽게 내려앉음
  }
  const Hat = (i, y) => (i < x0 || i > x1 || y < 0 || y >= bot) ? 0 : Hm[y * gw + i - x0];
  const ln = Math.hypot(0, 0.55, 0.83);
  for (let y = 0; y < bot; y++) for (let i = x0; i <= x1; i++) {
    const h0 = Hat(i, y); if (h0 <= 0) continue;
    const gx = (Hat(i + 1, y) - Hat(i - 1, y)) / 2, gy = (Hat(i, y + 1) - Hat(i, y - 1)) / 2, nl = Math.hypot(gx, gy, 1), nx = -gx / nl, ny = -gy / nl, nz = 1 / nl;
    const [L] = cvLight(i - sh, y), lam = Math.max(0, (ny * 0.55 + nz * 0.83) / ln), side = Math.max(0, -nx * 0.6 + nz * 0.5);   // 바닥 조명(앞 · 아래) · 왼쪽 위 은은한 빛
    let v = (0.86 + (vnoise(i * 0.3, y * 0.08, 7304) - 0.5) * 0.16) * (0.1 + side * 0.08 + lam * (0.14 + L * 1.3));
    if (y < top + 16) v *= 0.55 + Math.max(0, y - top) / 36;   // 천장에 붙은 위쪽은 그늘
    cvPut(d, lw, i, y, cvC(clamp(v, 0, 1), clamp(0.3 + L * 1.5, 0, 1)));
  }
}

// 천장 · 구멍 · 빛줄기 · 벽 밑 바위 더미 · 벽 등불 (밭 층 · 0.3배)
function caveCeil(ph, day) {
  const p = LAYER_P.field, lw = layerW(p), sh = Math.round(20 * p), H2 = 200, c = mkR(lw, H2), x = c.getContext('2d'), R = rng(7101);
  let id = x.createImageData(lw, H2), d = id.data;
  const hx0 = CV.hole[0] + sh, hx1 = CV.hole[1] + sh, hc = (hx0 + hx1) / 2, hw = (hx1 - hx0) / 2;
  const edge = []; for (let i = 0; i < lw; i++) { let e = 24 + Math.pow(Math.abs(i - lw / 2) / (lw / 2), 2.2) * 24 + Math.sin(i * 0.016 + 0.4) * 3 + (vnoise(i * 0.045, 0.5, 7102) - 0.5) * 9 + (vnoise(i * 0.17, 1.5, 7103) - 0.5) * 3; for (const [lx, lwid, lh] of [[60, 14, 7], [196, 11, 6], [392, 16, 8]]) { const u = (i - lx - sh) / lwid; if (Math.abs(u) < 1) e += Math.cos(u * Math.PI / 2) ** 2 * lh; } const u = (i - hc) / (hw + 26); if (Math.abs(u) < 1) e += Math.pow(1 - u * u, 1.5) * 21; edge.push(Math.round(e)); }   // 화면 가장자리로 갈수록 두꺼운 아치 · 흘러내린 용암 덩이 · 구멍 둘레는 무너진 테두리   // 구멍 둘레는 무너진 테두리라 두툼
  const holeBot = i => edge[clamp(i, 0, lw - 1)] - 5, inHole = (i, y) => { const hd = holeBot(i); return y < hd && Math.abs(i - hc) / hw < Math.sqrt(Math.max(0, 1 - Math.pow(y / hd, 3))) * (1 + (vnoise(y * 0.35, i > hc ? 1 : 2, 7107) - 0.5) * 0.22); };
  const sky = ph.sky, night = PHASES.indexOf(ph) === 3, skyT = night ? sky[0] : sky[1], skyB = night ? sky[1] : sky[3], /* 구멍으로 올려다본 머리 위 하늘 · 밤엔 별 */ GR = ['#1e3624', '#2e5230', '#46723a', '#669846', '#8cbc58'].map(k => mix(k, '#141a20', (1 - day) * 0.75)), GF = GR.map(k => mix(k, '#1c2219', 0.3));   // GF: 굴 바닥 식물 (빛줄기 속이라도 조금 가라앉게)
  for (let i = 0; i < lw; i++) {
    const [L] = cvLight(i - sh, edge[i] + 8);
    for (let y = 0; y <= edge[i]; y++) {
      if (inHole(i, y)) {   // 구멍 너머: 하늘 → 맞은편 구멍 테두리(풀 · 흙 · 낮빛 받은 바위)
        const fr = holeBot(i) - y, gl = 7 + Math.round(vnoise(i * 0.25, 0.5, 7108) * 3);
        const col = fr > gl ? (night && hash2(i, y, 7112) < 0.012 ? '#e8e0f0' : mix(skyT, skyB, clamp(y / holeBot(i) * 1.2, 0, 1))) : fr > gl - 2 ? GR[3 + (hash2(i, y, 7109) < 0.3 ? 1 : 0)] : fr > gl - 4 ? GR[2] : fr > 2 ? mix('#5a4a3a', '#141a20', (1 - day) * 0.7) : mix('#7a7a70', '#141a20', (1 - day) * 0.7);
        cvPut(d, lw, i, y, col); if (fr === gl + 1 && hash2(i, 3, 7110) < 0.45) cvPut(d, lw, i, y - Math.floor(hash2(i, 4, 7111) * 3), GR[3]);   // 풀잎이 하늘로 삐죽
        continue;
      }
      const [cr, hid] = cvCell(i * 0.085, y * 0.16, 7104);
      let v = 0.11 + hid * 0.09 + (vnoise(i * 0.2, y * 0.3, 7105) - 0.5) * 0.04;
      if (cr < 0.06) v *= 0.45; else if (cr < 0.12) v += 0.035;   // 금 · 판 가장자리
      const rim = Math.pow(clamp(1 - (edge[i] - y) / 10, 0, 1), 1.5), nh = Math.exp(-Math.max(0, Math.abs(i - hc) - hw) / 5) * day * (y < holeBot(i) + 3 ? 1 : 0.4);
      v += rim * (0.15 + L * 0.5) + nh * 0.32;
      cvPut(d, lw, i, y, cvC(clamp(v, 0, 1), clamp(rim * L * 2 - nh * 1.6, -1, 1)));
    }
  }
  x.putImageData(id, 0, 0);
  // 구멍 가장자리 풀 · 덩굴 (하늘을 등지고 짙게, 아래로 늘어진 덩굴은 낮빛에 밝게)
  for (const [bx, by, r] of [[hx0 + 2, holeBot(hx0) - 9, 6], [hx0 + 9, holeBot(hx0 + 9) - 4, 4], [hx1 - 3, holeBot(hx1) - 8, 6], [hx1 - 11, holeBot(hx1 - 11) - 3, 4]]) pixTree(x, bx, by, r, GR, R, { blobs: 6 });
  for (let k = 0; k < 16; k++) { const vx = Math.round(hx0 - 4 + R() * (hx1 - hx0 + 8)); if (Math.abs(vx - hc) < hw * 0.45) continue; pixVines(x, vx, Math.max(holeBot(vx), edge[clamp(vx, 0, lw - 1)] - 2) - 1, 5 + Math.floor(Math.pow(R(), 1.6) * 36), GR, k * 7 + 3); }   // 길고 짧은 덩굴
  for (let k = 0; k < 5; k++) { let rx = hx0 + 4 + Math.floor(R() * (hx1 - hx0 - 8)), ry = holeBot(rx) - 1; const len = 6 + Math.floor(R() * 12); for (let q = 0; q < len; q++) { px1(x, mix('#4a3a2c', '#141a20', (1 - day) * 0.7), rx, ry + q); if (R() < 0.3) rx += R() < 0.5 ? -1 : 1; } }   // 늘어진 뿌리
  for (let k = 0; k < 16; k++) { const gx = Math.round(hx0 - 6 + R() * (hx1 - hx0 + 12)), gy = holeBot(gx); if (Math.abs(gx - hc) < hw * 0.7) continue; px1(x, GR[2 + (k % 2)], gx, gy - 2, 1, 3); }   // 가장자리 풀잎
  // 용암종유: 짧고 뭉툭한 방울 모양 (석회 동굴처럼 길고 뾰족하지 않게)
  const drips = [];
  for (let i = 2; i < lw - 2; i += 3 + Math.floor(R() * 5)) {
    if (Math.abs(i - hc) < hw + 4) continue;
    const e = edge[i], len = 2 + Math.floor(Math.pow(R(), 2.2) * 10), w0 = len > 7 ? 3 : len > 3 ? 2 : 1, [L] = cvLight(i - sh, e + 10), wm = clamp(L * 2, 0, 1);
    for (let j = 0; j < len; j++) {
      const t = j / len, ww = Math.max(1, Math.round(w0 * (1 - t * 0.55) + (j === len - 2 && len > 4 ? 0.6 : 0)));   // 끝에 맺힌 방울
      px1(x, cvC(0.2 + t * 0.08 + L * 0.35, wm), i - (ww >> 1), e + j, ww, 1);
      if (ww > 1) px1(x, cvC(0.32 + L * 0.5, wm), i - (ww >> 1), e + j, 1, 1);   // 빛 받는 왼쪽
    }
    if (len > 4) { px1(x, cvC(0.55 + L * 0.4, wm), i, e + len - 1, 1, 1); if (drips.length < 6 && R() < 0.3) drips.push([i, e + len - VOFF, R() * 3, 128 + Math.floor(R() * 6)]); }   // 젖은 끝 반짝 · 물방울 떨어질 자리
  }
  // 벽 밑 바위 더미 (빛줄기가 닿는 곳은 이끼 · 고사리)
  const sx0 = CV.shaft.b[0] + sh, sx1 = CV.shaft.b[1] + sh;
  for (let i = -6; i < lw; i += 9 + Math.floor(R() * 14)) {
    const inLight = i > sx0 - 6 && i < sx1, w = 9 + Math.floor(R() * 14), h = 5 + Math.floor(R() * 7);
    if (i > CV.col + sh - 40 && i < CV.col + sh + 30) continue;   // 석주 발치는 비움
    cvRock(x, i, 190 + Math.floor(R() * 5), w, h, R, sh, { moss: inLight, day });
  }
  for (let k = 0; k < 5; k++) { const fx = sx0 + 6 + Math.floor((k + R() * 0.6) / 5 * (sx1 - sx0 - 12)), fy = 189 + Math.floor(R() * 4); for (const sd of [-1, 1, -0.45, 0.45]) { const len = 5 + Math.floor(R() * 4); for (let q = 0; q < len; q++) { const px = Math.round(fx + sd * q * 0.9), py = Math.round(fy - q * 1.15 + q * q / (len * 1.1)); px1(x, GF[q < 2 ? 1 : 2], px, py); if (q % 2 && q < len - 1) px1(x, GF[3], px, py - 1); } } }   // 고사리 몇 포기: 활처럼 휜 잎
  for (const [lx, ly] of CV.wallLamps) cvLamp(x, lx + sh, ly + 5, false);
  // 빛줄기: 구멍에서 이끼 바닥까지 비스듬히 (가장자리는 옅게, 결 따라 밝고 어두운 줄)
  id = x.getImageData(0, 0, lw, H2); d = id.data;
  const { t: T, b: B } = CV.shaft, lc = ['#f4faea', '#fff0d2', '#ffd0a0', '#b8c8f0'][PHASES.indexOf(ph)] || '#f4faea', A0 = 0.07 + day * 0.13;
  for (let y = T[2]; y < B[2]; y++) {
    const k = (y - T[2]) / (B[2] - T[2]), l = T[0] + (B[0] - T[0]) * k + sh, r = T[1] + (B[1] - T[1]) * k + sh;
    for (let i = Math.floor(l); i <= Math.ceil(r); i++) {
      const uu = (i - l) / (r - l), e = clamp(Math.min(uu, 1 - uu) / 0.18, 0, 1), st = vnoise(uu * 6.5 - k * 1.2, k * 2.2, 7106);
      const a = Math.round(A0 * e * (0.5 + 0.5 * st) * (1 - k * 0.3) / (A0 / 4)) * (A0 / 4);   // 4단계로 끊어서
      if (a > 0) cvBlend(d, lw, i, y, lc, a);
    }
  }
  x.putImageData(id, 0, 0);
  c.oy = -VOFF; c.drips = drips; c.shaftCol = lc;
  c.shaft = { y0: T[2] - VOFF, y1: B[2] - VOFF, l0: T[0] + sh, r0: T[1] + sh, l1: B[0] + sh, r1: B[1] + sh };
  return c;
}

// 앞쪽 바닥 (가까운 층 · 0.6배): 새끼줄 용암 바닥 · 등불 비친 물웅덩이 · 양옆 바위 더미 · 길가 돌받침 등불
function caveNear() {
  const p = LAYER_P.near, lw = layerW(p), sh = Math.round(20 * p), c = mk(lw, 160), x = c.getContext('2d'), R = rng(7401), id = x.createImageData(lw, 160), d = id.data;
  const lamps = [32, 198, 372].map(s => s + sh);
  if (!(WK && WK.caveNear(d, lw, sh))) caveNearPx(d, lw, sh, lamps);
  x.putImageData(id, 0, 0);
  for (let k = 0; k < 6; k++) { const px = Math.floor(R() * lw), py = 141 + Math.floor(R() * 12), w = 8 + Math.floor(R() * 14); px1(x, cvC(0.12, -0.3), px, py, w, 1); px1(x, cvC(0.16, -0.2), px + 1, py + 1, w - 2, 1); px1(x, cvC(0.55, 0.7), px + 2 + Math.floor(R() * (w - 4)), py, 2, 1); }   // 물웅덩이 (등불 비침)
  for (let k = 0; k < 50; k++) { const px = Math.floor(R() * lw), py = 138 + Math.floor(R() * 19); px1(x, cvC(0.16, 0), px, py, 2, 1); px1(x, cvC(0.4, 0.5), px, py - 1, 1, 1); }   // 자갈
  // 양옆 바위 더미 (가장자리일수록 크게) · 가운데는 드문드문 작게
  const rocks = [];
  for (let i = -10; i < lw; i += 7 + Math.floor(R() * 10)) { const e = Math.min(i, lw - i) / lw; if (e > 0.16 && R() < 0.78) continue; const w = Math.round(8 + R() * 12 + Math.max(0, 0.16 - e) * 90), h = Math.round(w * (0.42 + R() * 0.2)); rocks.push([i, 153 + Math.floor(R() * 4), w, h]); }
  for (let k = 0; k < 34; k++) rocks.push([Math.floor(R() * lw), 140 + Math.floor(R() * 16), 3 + Math.floor(R() * 6), 2 + Math.floor(R() * 3)]);   // 바닥 곳곳 잔돌
  rocks.sort((a, b) => a[1] - b[1]).forEach(([rx, ry, w, h]) => cvRock(x, rx, ry, w, h, R, sh));
  for (const lx of lamps) cvLamp(x, lx, 152, true);
  c.lamps = lamps;
  return c;
}
function caveNearPx(d, lw, sh, lamps) {   // 픽셀 (WASM: wasm/src/cave.rs near)
  for (let i = 0; i < lw; i++) {
    const fb = 134 + Math.round((vnoise(i * 0.05, 0.5, 7402) - 0.5) * 4);
    for (let y = fb; y < 160; y++) {
      const t = (y - fb) / (160 - fb), ry = (y - fb) * 1.6, rope = Math.abs(Math.sin((i * 0.16 + Math.sqrt(ry + 1) * 2.2 + vnoise(i * 0.02, ry * 0.05, 7403) * 4) * Math.PI)) < 0.16 && vnoise(i * 0.018, 3, 7404) > 0.42;   // 새끼줄 용암: 흐름 방향으로 휜 주름
      let L = 0; for (const lx of lamps) { const dx = (i - lx) / (26 + vnoise(i * 0.1, y * 0.3, 7406) * 10), dy = (y - 150) / 9; L += Math.exp(-dx * dx - dy * dy); }   // 등불빛 (가장자리는 울퉁불퉁)
      const [L0, D0] = cvLight(i - sh, 186 + t * 10);
      let v = (0.33 + (vnoise(i * 0.06, y * 0.3, 7405) - 0.5) * 0.12) * (0.8 + L * 0.8 + L0 * 0.5 + D0 * 0.5) - t * 0.06 + (rope ? 0.09 : 0);
      if (y === fb) v += 0.1; else if (y === fb + 1) v += 0.04;   // 바닥 뒤쪽 테 (빛 받는 모서리)
      cvPut(d, lw, i, y, cvC(clamp(v, 0, 1), clamp((L + L0) * 1.4 - D0, -1, 1)));
    }
  }
}
// 발밑 길 (땅 층): 어두운 현무암 바닥 · 등불빛 받은 위 가장자리 · 새끼줄 주름
function caveGround() {
  const lw = WORLD_W + 8, h = VIEW_H - GROUND + 4, c = mk(lw, h), x = c.getContext('2d'), id = x.createImageData(lw, h), d = id.data, R = rng(7451);
  if (!(WK && WK.caveGround(d, lw, h))) caveGroundPx(d, lw, h);
  x.putImageData(id, 0, 0);
  for (let k = 0; k < 70; k++) { const px = Math.floor(R() * lw), py = 6 + Math.floor(R() * (h - 8)), w = 2 + Math.floor(R() * 3); px1(x, cvC(0.16, 0), px, py, w, 1); px1(x, cvC(0.4, 0.5), px, py - 1, Math.max(1, w - 1), 1); }   // 박힌 돌 조각
  return c;
}
function caveGroundPx(d, lw, h) {   // 픽셀 (WASM: wasm/src/cave.rs ground)
  for (let i = 0; i < lw; i++) for (let y = 2; y < h; y++) {
    const top = y < 4, rope = Math.sin((i + Math.sin(y * 0.8 + i * 0.05) * 4) * 0.42 + vnoise(i * 0.04, y * 0.15, 7452) * 5) > 0.75 && vnoise(i * 0.03, 7, 7453) > 0.4;
    let v = top ? (y === 2 ? 0.58 : 0.47) : 0.34 - (y - 4) * 0.008 + (vnoise(i * 0.07, y * 0.2, 7454) - 0.5) * 0.1 + (rope ? 0.07 : 0);
    if (y === 2 && vnoise(i * 0.3, 1, 7455) < 0.3) continue;   // 위 가장자리는 들쭉날쭉
    cvPut(d, lw, i, y, cvC(clamp(v, 0, 1), top ? 0.6 : 0.3));
  }
}
// 가장 앞 (1.3배): 화면 아래를 감싸는 아주 어두운 바위 실루엣 · 위 가장자리에만 등불빛 테
function caveFront() {
  const lw = layerW(LAYER_P.front), c = mk(lw, 30), x = c.getContext('2d'), R = rng(7501);
  const top = new Array(lw).fill(99);
  const bump = (cx, w, h) => { for (let i = Math.floor(cx - w); i <= Math.ceil(cx + w); i++) { if (i < 0 || i >= lw) continue; const t = (i - cx) / w; if (Math.abs(t) > 1) continue; const y = Math.round(30 - h * Math.pow(1 - t * t, 0.6) - (vnoise(i * 0.3, cx, 7502) - 0.5) * 2); top[i] = Math.min(top[i], y); } };
  for (let i = -10; i < lw; i += 8 + Math.floor(R() * 12)) { const e = Math.min(i, lw - i); bump(i, 6 + R() * 10, e < 50 ? 12 + R() * 14 : 2 + R() * 5); }
  for (let i = 0; i < lw; i++) if (top[i] < 30) { px1(x, '#0b090c', i, top[i], 1, 30 - top[i]); px1(x, '#3a2a22', i, top[i], 1, 1); if (hash2(i, 1, 7503) < 0.3) px1(x, '#1c1514', i, top[i] + 1, 1, 1); }
  return c;
}
function buildCaveSet(ph) {
  const day = [1, 0.85, 0.6, 0.3][PHASES.indexOf(ph)] ?? 1;
  if (!buildCaveSet.shared) buildCaveSet.shared = { halla: Object.assign(mk(layerW(LAYER_P.hall), 140), { empty: true }), oreum: caveColumn(), near: caveNear(), ground: caveGround(), front: caveFront() };
  return Object.assign({ sky: caveWall(day), field: caveCeil(ph, day) }, buildCaveSet.shared);
}

