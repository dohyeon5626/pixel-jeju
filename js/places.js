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

