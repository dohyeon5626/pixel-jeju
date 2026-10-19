// ─────────────────────────────────────────────────────────────
//  픽셀 제주 — 배경 (패럴랙스 레이어)
//  먼 레이어일수록 밝고 흐리게(대기 원근), 가까울수록 진하고 선명하게.
//  시간대(낮·오후·노을·화산의 밤)마다 팔레트를 바꿔 미리 굽는다.
// ─────────────────────────────────────────────────────────────
'use strict';

const PHASES = [
  { sky: ['#2f7fd8', '#4f9ee8', '#78bdf2', '#a6daf8', '#d4f0fc'], haze: '#cfeaf6', tint: null, sun: { x: 252, y: 34, r: 9, core: '#fffbe6', glow: '#fff0b0' }, cloud: ['#8fb4d8', '#c6dcf0', '#eef6fc', '#ffffff'] },
  { sky: ['#3a70c8', '#6a98d8', '#a8bfe0', '#e6d6c0', '#ffe2a8'], haze: '#f2dcbc', tint: '#fff0dc', sun: { x: 268, y: 58, r: 10, core: '#fff6d0', glow: '#ffd890' }, cloud: ['#b89a9a', '#e0c4b8', '#fbe6d4', '#fff6ea'] },
  { sky: ['#2a2a6a', '#5a3a8a', '#a84a8a', '#f0706a', '#ffb060'], haze: '#f0a080', tint: '#ffc6a2', sun: { x: 276, y: 84, r: 14, core: '#fff0b0', glow: '#ff9a50' }, cloud: ['#6a3a6a', '#b0587a', '#f08a7a', '#ffc49a'] },
  { sky: ['#0c0a1e', '#1a1236', '#341a44', '#5a1e3a', '#8a2a30'], haze: '#5a2838', tint: '#7a68a8', sun: { x: 60, y: 30, r: 6, core: '#fff4e0', glow: '#8a7aa8', moon: true }, cloud: ['#1e1428', '#33203a', '#4e2c48', '#6a3a52'] },
];

for (const ph of PHASES) { ph.sky = ph.sky.map(c => mute(c, 0.8)); ph.cloud = ph.cloud.map(c => mute(c, 0.8)); ph.haze = mute(ph.haze, 0.8); if (ph.tint) ph.tint = mute(ph.tint, 0.85); }
const LAYER_P = { hall: 0.08, oreum: 0.16, field: 0.3, near: 0.6, ground: 1, front: 1.3 };
const layerW = p => Math.ceil(W + (WORLD_W - W) * p) + 4;

// 대기 원근 + 시간대 색조
function atmo(c, ph, depth) {
  let o = mix(mute(c, 0.8), ph.haze, depth);
  if (ph.tint) { const a = rgb(o), t = rgb(ph.tint); o = hex(a[0] * t[0] / 255, a[1] * t[1] / 255, a[2] * t[2] / 255); }
  return o;
}

// ── 하늘 ─────────────────────────────────────────────────────
// 시간대 하늘은 한 번만 그려 두고 쓸 때마다 복사본을 줌 (받은 쪽이 그 위에 숲 등을 그려도 원본은 그대로)
const SKY_MEMO = new WeakMap();
function buildSky(ph) {
  let s = SKY_MEMO.get(ph); if (!s) SKY_MEMO.set(ph, s = paintSky(ph));
  const c = mk(s.width, s.height); c.getContext('2d').drawImage(s, 0, 0); return c;
}
function paintSky(ph) {
  const SH = 140 + VOFF, c = mk(W, SH), x = c.getContext('2d');
  const n = ph.sky.length, bandH = SH / n;
  for (let y = 0; y < SH; y++) {
    const f = y / bandH, i = Math.min(n - 1, Math.floor(f)), fr = f - i;
    for (let xx = 0; xx < W; xx++) {
      // 줄마다 조금씩 섞인 매끈한 그러데이션 (디더 바둑판 · 계단 띠 없이)
      const t = clamp(fr * fr * (3 - 2 * fr) + (vnoise(xx * 0.02, y * 0.05, 96) - 0.5) * 0.1 + (hash2(xx, y, 97) - 0.5) * 0.04, 0, 1);   // 띠 없이 이어지게: 단계 고정 없이 아주 잘게
      x.fillStyle = mix(ph.sky[i], ph.sky[Math.min(n - 1, i + 1)], Math.round(t * 24) / 24);
      x.fillRect(xx, y, 1, 1);
    }
  }
  // 높은 하늘의 엷은 새털구름 줄기
  const RS = rng(91);
  x.fillStyle = ph.cloud[3];
  for (let k = 0; k < 10; k++) {
    const y0 = Math.floor(RS() * SH * 0.6), x0 = Math.floor(RS() * W), len = 40 + Math.floor(RS() * 90);
    for (let i = 0; i < len; i++) {
      const t = i / len, a = Math.pow(Math.sin(t * Math.PI), 1.5) * (0.06 + 0.14 * vnoise(i * 0.08, k, 92)), px = x0 + i; if (px >= W) break;   // 끝은 가늘게 사라지고 화면 끝에서 되감기지 않음
      const yy = y0 + Math.round(Math.sin(t * 3 + k) * 1.5); x.globalAlpha = a; x.fillRect(px, yy, 1, 1);
      if (t > 0.3 && t < 0.7 && vnoise(i * 0.2, k, 93) > 0.55) x.fillRect(px, yy + 1, 1, 1);
    }
  }
  // 수평선 근처 멀리 깔린 구름 띠
  const hy = SH - 40, bank = mix(ph.cloud[2], ph.haze, 0.5);
  x.fillStyle = bank;
  for (let i = 0; i < W; i++) { const hgt = Math.round(vnoise(i * 0.04, 0.5, 94) * 7 + vnoise(i * 0.15, 1.5, 95) * 3), bot = 2 + Math.round(vnoise(i * 0.07, 3.5, 98) * 4), span = hgt + bot; for (let y = hy - hgt; y < hy + bot; y++) { const u = (y - (hy - hgt)) / Math.max(1, span); x.globalAlpha = 0.24 * Math.sin(u * Math.PI) ** 0.8; x.fillRect(i, y, 1, 1); } }   // 위아래 모두 서서히 옅어짐
  x.globalAlpha = 1;
  // 해 / 달
  const s = ph.sun;
  const pb = new PB(W, 140);
  pb.ellipse(s.x, s.y, s.r, s.r, (nx, ny) => s.moon ? (nx > 0.35 && Math.hypot(nx - 0.6, ny + 0.1) < 0.75 ? null : (nx + ny < -0.5 ? mix(s.core, '#ffffff', 0.5) : s.core)) : band([s.glow, mix(s.core, s.glow, 0.5), s.core], sphereLight(nx, ny), 0, 0));
  x.globalAlpha = 0.3; x.fillStyle = s.glow; for (let a = 0; a < 6.28; a += 0.5 / (s.r + 2)) x.fillRect(Math.round(s.x + Math.cos(a) * (s.r + 2)), Math.round(s.y + Math.sin(a) * (s.r + 2)), 1, 1); x.globalAlpha = 1;
  x.drawImage(pb.canvas(), 0, 0);
  return c;
}

// 뭉게구름: 원 여러 개의 합집합을 구처럼 셰이딩, 톤은 딱 끊어서 덩어리감
function cloudSprite(w, h, seed, pal) {
  // 동글동글한 구름 대신: 노이즈로 윗면은 울퉁불퉁, 밑면은 납작하고 어두운 실제 적운
  // 여백을 두고 그려 가장자리가 캔버스에 잘려 직각으로 보이지 않게, 양 끝 밑면은 둥글게 말아 올림
  const pad = 10, pb = new PB(w + pad * 2, h + 2), base = h * 0.8 + 2, skew = (hash2(seed, 1, 5) - 0.5) * 0.4;
  for (let y = 0; y < h + 2; y++) for (let xx = 0; xx < w + pad * 2; xx++) {
    const x = xx - pad, nx = ((x + 0.5) / w * 2 - 1) - skew, edge = Math.max(0, 1 - nx * nx);
    if (edge <= 0) continue;
    const top = Math.max(1, base - h * 0.74 * Math.pow(edge, 0.7) * (0.4 + 0.6 * vnoise(x * 0.06, 0.5, seed)) - (vnoise(x * 0.2, 1.5, seed + 1) - 0.5) * 5 * edge);
    const bot = base - (1 - Math.sqrt(edge)) * 5 + (vnoise(x * 0.2, 2.5, seed + 2) - 0.5) * 2;
    if (y < top || y > bot) continue;
    const dt = (y - top) / Math.max(1, base - top);   // 0 = 윗면, 1 = 밑면
    let v = 1 - dt * 0.9 - Math.max(0, nx) * 0.25 + (vnoise(x * 0.15, y * 0.2, seed + 3) - 0.5) * 0.35;
    pb.set(xx, y, band(pal, clamp(v, 0, 0.999), x, y, 0.6));
  }
  return pb.canvas();
}

// ── 한라산 ───────────────────────────────────────────────────
function hallaTop(x, cx) {
  const d = Math.abs(x - cx);
  if (d < 9) return 60 + (d < 6 ? 2 : 1);   // 백록담
  if (d < 16) return 59 + (d > 13 ? 1 : 0);
  const t = d - 16;
  return Math.round(59 + t * 0.2 + t * t * 0.0017);
}
function buildHalla(ph) {
  const lw = layerW(LAYER_P.hall), c = mk(lw, 140), x = c.getContext('2d'), cx = Math.round(lw / 2);
  const A = (r) => r.map(k => atmo(k, ph, 0.35));
  // 고도별 램프 (그늘 → 빛): 정상 바위 · 고산 초원 · 숲
  const ROCK = A(['#56525c', '#6e6872', '#8a8288', '#a69c9c', '#c2b8b2']);
  const GRASS = A(['#4a5a52', '#5a6c5a', '#6e8064', '#869470', '#a0aa84']);
  const FOREST = A(['#2a4640', '#32544a', '#3c6252', '#4a705c', '#5c8068']);
  const tops = [];
  for (let i = 0; i < lw; i++) tops[i] = hallaTop(i, cx);
  for (let i = 0; i < lw; i++) {
    const top = tops[i], side = clamp((i - cx) / (lw * 0.42), -1, 1);
    for (let y = top; y < 140; y++) {
      const depth = y - top;
      // 정상에서 방사형으로 흘러내리는 능선 · 골짜기
      const u = (i - cx + (vnoise(y * 0.06, i * 0.01, 9) - 0.5) * 16) / (y - 44);
      const ridge = vnoise(u * 6 + 3, y * 0.02, 7) * 0.62 + vnoise(u * 15 + 9, y * 0.05, 8) * 0.38;
      let L = 0.56 - side * 0.3 + (ridge - 0.5) * 0.4 * clamp(depth / 12, 0.25, 1);
      L += (vnoise(i * 0.18, y * 0.18, 3) - 0.5) * 0.1;
      if (depth < 2) L += 0.16;   // 하늘에 닿는 능선은 한 톤 밝게
      // 식생 경계는 물결치게
      const alt = y + (vnoise(i * 0.07, 0.3, 11) - 0.5) * 9 + (ridge - 0.5) * 6;
      const ramp = depth < 5 && Math.abs(i - cx) < 32 ? ROCK : alt < 80 ? GRASS : FOREST;
      let col = band(ramp, clamp(L, 0, 0.999), i, y, 0.8);
      // 숲: 나무 꼭대기가 듬성듬성 빛을 받음
      if (ramp === FOREST && hash2(i >> 1, y >> 1, 5) < 0.07 && L > 0.45) col = band(ramp, clamp(L + 0.15, 0, 0.999), i, y);   // 나무 꼭대기 빛은 드문드문
      // 산 아래로 갈수록 연무에 묻힘
      const hz = clamp((y - 96) / 30, 0, 1);
      if (hz > 0) col = mix(col, ph.haze, hz * 0.35);
      x.fillStyle = col; x.fillRect(i, y, 1, 1);
    }
  }
  // 기슭의 작은 오름들: 왼쪽 빛, 오른쪽 그늘
  for (const [ox, ow, oh] of [[-74, 13, 6], [-44, 9, 4], [58, 11, 5], [96, 15, 6]]) {
    const ox0 = cx + ox, base = tops[clamp(ox0, 0, lw - 1)] + 13;
    for (let i = -ow; i <= ow; i++) {
      const t = i / ow, yy = base - Math.round(oh * (1 - t * t));
      // 네모난 덩어리 대신 능선 윤곽만: 빛 받는 왼쪽은 밝은 테, 오른쪽은 그늘 테 (아랫단이 잘려 보이지 않게)
      const L = 0.62 - t * 0.4;
      x.fillStyle = mix(band(FOREST, clamp(L + 0.12, 0, 0.999), ox0 + i, yy, 0.6), ph.haze, 0.12); x.fillRect(ox0 + i, yy, 1, 1);
      if (Math.abs(t) < 0.85) { x.fillStyle = mix(band(FOREST, clamp(L - 0.08, 0, 0.999), ox0 + i, yy + 1, 0.6), ph.haze, 0.12); x.fillRect(ox0 + i, yy + 1, 1, 1); }
    }
  }
  // 백록담: 정상 분화구 테두리
  for (let i = cx - 8; i <= cx + 8; i++) { x.fillStyle = i < cx ? ROCK[1] : ROCK[0]; x.fillRect(i, tops[i] + 1, 1, 1); }
  x.fillStyle = ROCK[0]; x.fillRect(cx - 5, 62, 11, 1);
  c.cx = cx; c.top = 59;
  return c;
}
function buildOreum(ph) {
  const lw = layerW(LAYER_P.oreum), c = mk(lw, 140), x = c.getContext('2d');
  const cols = ['#2a5a4c', '#336852', '#3e765a', '#508866', '#68a078'].map(k => atmo(k, ph, 0.28));
  // 오름: 둥근 원뿔 + (몇 개는) 꼭대기에 얕은 분화구
  const hill = (cx, w, h, base, crater, seed) => {
    for (let i = -Math.round(w * 1.3); i <= Math.round(w * 1.3); i++) {
      const t = clamp(i / w, -1, 1), a = Math.abs(i / w);
      let top = a <= 1 ? base - h * (1 - Math.pow(a, 1.7)) : base + (a - 1) * w * 0.35;   // 기슭이 땅으로 완만히 퍼져 세로로 잘리지 않게
      if (crater && a < 0.2) top += (0.2 - a) / 0.2 * 2.2;
      top = Math.round(top);
      for (let y = top; y < 140; y++) {
        const depth = y - top;
        let L = 0.58 - t * 0.38 + (vnoise((cx + i) * 0.12, y * 0.12, seed) - 0.5) * 0.18;
        if (depth < 2) L += 0.16;
        if (y > base - 4) L -= 0.08;   // 기슭은 살짝 어둡게
        let col = band(cols, clamp(L, 0, 0.999), cx + i, y, 0.8);
        if (hash2(Math.floor((cx + i) / 3), Math.floor(y / 2), seed) < 0.04 && depth > 2) col = cols[Math.min(4, cols.indexOf(col) + 1)];   // 풀 무더기
        x.fillStyle = col; x.fillRect(cx + i, y, 1, 1);
      }
    }
  };
  hill(40, 48, 22, 116, true, 1); hill(118, 28, 12, 117, false, 2); hill(lw - 70, 56, 26, 116, true, 3); hill(lw - 150, 24, 10, 118, false, 4);
  return c;
}

// 먼 밭 · 방풍림 · 제주 집
function buildFields(ph) {
  const lw = layerW(LAYER_P.field), c = mk(lw, 140), x = c.getContext('2d'), R = rng(17);
  const d = 0.18, A2 = (k, p, dd) => atmo(mute(k, 0.75), p, dd);   // 먼 밭은 채도를 한 번 더 눌러 멀리 보이게
  const P = {
    g1: A2('#5fa846', ph, d), g2: A2('#7cbc52', ph, d), g3: A2('#98cc5e', ph, d), y1: A2('#f2cf3c', ph, d), y2: A2('#ffe27a', ph, d),
    s1: A2('#a87a4e', ph, d), s2: A2('#c4966a', ph, d), wall: A2('#3a3646', ph, d), tree: A2('#24573c', ph, d), treeL: A2('#3a7a48', ph, d),
    roofO: A2('#e2683a', ph, d), roofB: A2('#3a6ac8', ph, d), wallW: A2('#f2ede4', ph, d), wallS: A2('#c8c0b8', ph, d), org: A2('#ff9a2a', ph, d),
  };
  const rows = [[112, 3], [115, 4], [119, 5], [124, 6]];
  const kinds = [['g1'], ['g2'], ['g3'], ['y1', 'y2'], ['s1', 's2'], ['g2'], ['g1']];
  for (const [y, h] of rows) {
    let i = -Math.floor(R() * 20), carry = 0;
    while (i < lw) {
      const w = 18 + Math.floor(R() * 30) + h * 3, kind = kinds[Math.floor(R() * kinds.length)];
      const base = P[kind[0]], alt = kind[1] ? P[kind[1]] : null, edge = mix(P.wall, base, 0.35);
      // 밭 경계는 원근대로 비스듬하고 울퉁불퉁하게 (자로 그은 네모 대신)
      const slant = carry, nextSlant = (R() - 0.5) * 1.4; carry = nextSlant;   // 이웃 밭과 경계를 공유해 틈이 없게
      for (let xx = -4; xx < w + 4; xx++) {
        const top = y + Math.round((vnoise((i + xx) * 0.05, y, 31) - 0.5) * 1.6), bot = y + h + Math.round((vnoise((i + xx) * 0.09, y + 7, 35) - 0.5) * 1.4);
        for (let yy = top; yy < bot; yy++) {
          const dy = yy - y, l = Math.round(dy * slant), r = w + Math.round(dy * nextSlant);
          if (xx < l || xx >= r) continue;
          let col = base;
          if (alt && (xx + (yy - top)) % 4 === 0) col = alt;                    // 비스듬한 작물 줄
          else if (hash2((i + xx) >> 1, yy, 33) < 0.12) col = mix(base, P.wall, 0.15);
          if ((yy === bot - 1 || xx === r - 1) && hash2(i + xx, yy, 34) < 0.7) col = edge;   // 밭담: 끊기는 돌 점
          x.fillStyle = col; x.fillRect(i + xx, yy, 1, 1);
        }
      }
      i += w;
    }
  }
  // 방풍림 줄 (삼나무)
  for (const [y, n] of [[114, 9], [118, 7], [123, 6]]) {
    for (let k = 0; k < n; k++) {
      const sx = Math.floor(R() * lw), len = 10 + Math.floor(R() * 24);
      for (let t = 0; t < len; t += 3) {
        x.fillStyle = P.tree; x.fillRect(sx + t, y - 3, 3, 4); x.fillRect(sx + t + 1, y - 4, 1, 1);
        x.fillStyle = P.treeL; x.fillRect(sx + t, y - 3, 1, 1);
        if (R() < 0.25) { x.fillStyle = P.org; x.fillRect(sx + t + 1, y - 1, 1, 1); }
      }
    }
  }
  // 집들
  for (let k = 0; k < 6; k++) {
    const hx = 20 + Math.floor(R() * (lw - 40)), hy = [116, 121, 127][k % 3], big = k % 3;
    const ww = 6 + big * 2, hh = 3 + big;
    x.fillStyle = P.wallW; x.fillRect(hx, hy - hh, ww, hh);
    x.fillStyle = P.wallS; x.fillRect(hx + ww - 2, hy - hh, 2, hh);
    x.fillStyle = k % 2 ? P.roofO : P.roofB; x.fillRect(hx - 1, hy - hh - 2, ww + 2, 2); x.fillRect(hx, hy - hh - 3, ww, 1);
    x.fillStyle = P.wall; x.fillRect(hx + 2, hy - 2, 1, 2);
  }
  return c;
}

// 가까운 레이어: 귤나무 · 야자수 · 돌담 · 유채
function buildNear(ph) {
  const lw = layerW(LAYER_P.near), c = mk(lw, 160), x = c.getContext('2d'), R = rng(5);
  const d = 0.06, A = k => atmo(k, ph, d);
  const L = C.leaf.map(A), St = ['#2a2632', '#3e3a4a', '#56526a', '#7a7590', '#a39eb6'].map(A), O = C.org.map(A), Y = C.yel.map(A), G = C.grass.map(A);
  // 풀밭 바탕
  x.fillStyle = G[2]; x.fillRect(0, 132, lw, 28);
  x.fillStyle = G[3]; x.fillRect(0, 132, lw, 2);
  // 야자수 (제주 가로수 워싱턴야자)
  const palm = (px, top) => {
    for (let y = top; y < 150; y++) {
      x.fillStyle = (y % 3 === 0) ? St[1] : (y % 3 === 1 ? A('#8a6a4e') : A('#6a4e3a'));
      x.fillRect(px, y, 3, 1);
      x.fillStyle = A('#a88a68'); if (y % 3 !== 0) x.fillRect(px, y, 1, 1);
    }
    const fr = [[-14, 4], [-11, -3], [-6, -7], [0, -9], [6, -7], [11, -3], [14, 4], [-9, 8], [9, 8]].map(([fx, fy], i) => [Math.round(fx * (0.8 + hash2(px, i, 61) * 0.4)), Math.round(fy + (hash2(px, i, 62) - 0.5) * 4)]);
    for (const [fx, fy] of fr) {
      const n = Math.max(Math.abs(fx), Math.abs(fy));
      for (let k = 0; k <= n; k++) {
        const t = k / n, xx = px + 1 + fx * t, yy = top + fy * t + (t * t) * Math.abs(fx) * 0.35;
        x.fillStyle = fy > 2 ? L[0] : (t < 0.4 ? L[1] : L[2]); x.fillRect(Math.round(xx), Math.round(yy), 2, 1);
        if (k % 2 === 0 && fy <= 2) { x.fillStyle = L[3]; x.fillRect(Math.round(xx), Math.round(yy) - 1, 1, 1); }
      }
    }
    x.fillStyle = A('#5a3e2a'); x.fillRect(px - 1, top, 5, 3);
  };
  // 귤나무 (둥근 수관 + 귤)
  const tree = (tx, ty, r) => {
    const size = Math.ceil(r * 2.6) + 6, pb = new PB(size, size);
    const blobs = [[0, 0, r], [-r * 0.55, r * 0.25, r * 0.7], [r * 0.55, r * 0.2, r * 0.75], [0, -r * 0.35, r * 0.7]].map(([bx, by, br], i) => [bx + (hash2(tx, i, 51) - 0.5) * r * 0.2, by + (hash2(tx, i, 52) - 0.5) * r * 0.2, br * (0.9 + hash2(tx, i, 53) * 0.1)]);
    for (let yy = 0; yy < pb.h; yy++) for (let xx = 0; xx < pb.w; xx++) {
      let best = null, bv = -1;
      for (const [bx, by, br] of blobs) {
        const nx = (xx + 0.5 - (pb.w / 2 + bx)) / br, ny = (yy + 0.5 - (pb.h / 2 + by)) / br;
        if (nx * nx + ny * ny <= 0.9 + 0.18 * vnoise(xx * 0.45, yy * 0.45, tx + 54)) { const v = sphereLight(clamp(nx, -1, 1), clamp(ny, -1, 1)); if (v > bv) { bv = v; best = 1; } }
      }
      if (best) pb.set(xx, yy, bv < 0.38 ? L[0] : bv < 0.58 ? L[1] : bv < 0.8 ? L[2] : L[3]);
    }
    const img = pb.canvas();
    x.fillStyle = A('#5a3e2a'); x.fillRect(tx - 1, ty, 3, 150 - ty);
    x.drawImage(img, Math.round(tx - pb.w / 2), Math.round(ty - pb.h / 2 - r * 0.4));
    for (let k = 0; k < r * 1.4; k++) {
      const a = R() * Math.PI * 2, rr = R() * r * 0.85;
      const ox = Math.round(tx + Math.cos(a) * rr), oy = Math.round(ty - r * 0.4 + Math.sin(a) * rr * 0.8);
      x.fillStyle = O[2]; x.fillRect(ox, oy, 2, 2); x.fillStyle = O[3]; x.fillRect(ox, oy, 1, 1); x.fillStyle = O[1]; x.fillRect(ox + 1, oy + 1, 1, 1);
    }
  };
  for (let i = 0; i < lw; i += 34 + Math.floor(R() * 20)) tree(i + 10, 126 + Math.floor(R() * 4), 9 + Math.floor(R() * 4));
  palm(Math.round(lw * 0.22), 88); palm(Math.round(lw * 0.71), 80);
  // 동백나무 (짙은 잎 + 붉은 꽃)
  const camellia = (cx, cy, r) => {
    const pb = new PB(r * 2 + 4, r * 2 + 4);
    pb.ellipse(r + 2, r + 2, r, r * 0.85, (nx, ny) => { const v = sphereLight(nx, ny); return v < 0.4 ? A('#163a2c') : v < 0.65 ? A('#20503a') : A('#2e6a48'); });
    x.drawImage(pb.canvas(), Math.round(cx - r - 2), Math.round(cy - r - 2));
    for (let k = 0; k < r * 1.2; k++) { const a = R() * 6.28, rr = R() * r * 0.8, fx = Math.round(cx + Math.cos(a) * rr), fy = Math.round(cy + Math.sin(a) * rr * 0.8); x.fillStyle = A('#c83a48'); x.fillRect(fx, fy, 2, 2); x.fillStyle = A('#f2d04a'); x.fillRect(fx, fy, 1, 1); }
  };
  camellia(Math.round(lw * 0.08), 128, 8); camellia(Math.round(lw * 0.93), 127, 9);
  // 초가집: 현무암 돌벽 + 둥근 초가지붕 (밧줄을 격자로 얽어맴)
  const choga = (hx, base, w) => {
    const hw = w / 2, wallH = 11;
    for (let y = base - wallH; y < base; y++) for (let i = -hw + 2; i < hw - 2; i++) {
      const bx = Math.floor((i + 40 + (Math.floor(y / 3) % 2) * 2) / 4), by = Math.floor(y / 3);
      const v = hash2(bx, by, 4);
      x.fillStyle = A(v < 0.33 ? '#2e2a36' : v < 0.66 ? '#3e3a48' : '#4e4a5a');
      if ((i + 40 + (Math.floor(y / 3) % 2) * 2) % 4 === 0 || y % 3 === 0) x.fillStyle = A('#1e1a24');
      x.fillRect(hx + i, y, 1, 1);
    }
    x.fillStyle = A('#3a2418'); x.fillRect(hx - 3, base - 8, 6, 8); x.fillStyle = A('#6a4628'); x.fillRect(hx - 2, base - 7, 4, 7);
    const rTop = base - wallH - 12;
    for (let y = rTop; y < base - wallH + 3; y++) {
      const t = (y - rTop) / 15, half = Math.round(hw * Math.sqrt(Math.min(1, t * 1.6)) + (y > base - wallH ? 2 : 0) + (vnoise(y * 0.45, hx, 64) - 0.5) * 2);
      for (let i = -half; i <= half; i++) {
        const ny = t, nx = i / (half || 1);
        let c = sphereLight(nx * 0.9, -0.6 + ny) > 0.62 ? '#c8a868' : sphereLight(nx * 0.9, -0.6 + ny) > 0.42 ? '#a88850' : '#7a6038';
        if ((Math.round(i + Math.sin(t * 2) * 2) + 70) % 9 === 0 || y === rTop + 6 || y === rTop + 11) c = '#5a4428';
        x.fillStyle = A(c); x.fillRect(Math.round(hx + i), y, 1, 1);
      }
    }
  };
  choga(Math.round(lw * 0.3), 133, 34);
  // 정낭: 구멍 뚫린 정주석 두 개 + 비스듬히 걸친 나무 세 개
  const gx = Math.round(lw * 0.42);
  for (const ox of [0, 24]) {
    x.fillStyle = A('#2e2a36'); x.fillRect(gx + ox, 112, 6, 28); x.fillStyle = A('#4e4a58'); x.fillRect(gx + ox, 112, 2, 28); x.fillStyle = A('#1e1a24'); x.fillRect(gx + ox + 5, 112, 1, 28);
    for (let k = 0; k < 3; k++) { x.fillStyle = A('#141018'); x.fillRect(gx + ox + 2, 116 + k * 6, 2, 2); }
  }
  for (let k = 0; k < 3; k++) {
    const y0 = 117 + k * 6, y1 = k === 2 ? 138 : y0;
    for (let i = 0; i <= 26; i++) { const yy = Math.round(lerp(y0, y1, i / 26)); x.fillStyle = A('#6a4628'); x.fillRect(gx + 2 + i, yy, 1, 2); x.fillStyle = A('#9a7044'); x.fillRect(gx + 2 + i, yy, 1, 1); }
  }

  // 돌담: 돌 하나하나 셰이딩, 사이 틈은 어둡게
  const stone = (sx, sy, w, h) => {
    const pb = new PB(w + 2, h + 2);
    const c1 = R() * 0.12, c2 = R() * 0.12;
    for (let yy = 1; yy <= h; yy++) for (let xx = 1; xx <= w; xx++) {
      const u = (xx - 0.5) / w, v = (yy - 0.5) / h;
      if (u + 0.7 * v < 0.16 + c1 || u - 0.4 * v > 0.87 - c2 || v - 0.25 * u > 0.87 || v + 0.3 * u < 0.17 + c2) continue;
      pb.set(xx, yy, v < 0.3 && u < 0.72 ? St[3] : u > 0.7 || v > 0.72 ? St[1] : St[2]);
    }
    if (w > 6) { const px = 2 + Math.floor(R() * (w - 3)), py = 2 + Math.floor(R() * (h - 3)); if (pb.get(px, py)) pb.set(px, py, St[1]); }
    x.drawImage(selOut(pb, 0.7).canvas(), sx - 1, sy - 1);
  };
  x.fillStyle = St[0]; x.fillRect(0, 138, lw, 12);
  for (const [y, off, hh] of [[143, 0, 7], [137, 4, 7], [131, 9, 6]]) {
    let i = -off;
    while (i < lw) {
      const w = 7 + Math.floor(R() * 7), h = hh - Math.floor(R() * 2);
      stone(i, y + Math.floor(R() * 2), w, h);
      i += w + (R() < 0.3 ? 2 : 0);
    }
  }
  // 유채꽃 덤불
  for (let i = 0; i < lw; i += 5 + Math.floor(R() * 7)) {
    if (vnoise(i * 0.018, 0, 91) < 0.42) continue;   // 꽃밭은 군데군데
    const by = 152 + Math.floor(R() * 4), n = 3 + Math.floor(R() * 4);
    for (let k = 0; k < n; k++) {
      const fx = i + Math.floor(R() * 7) - 3, fy = by - 4 - Math.floor(R() * 8);
      x.fillStyle = G[1]; x.fillRect(fx + 1, fy + 2, 1, by - fy);
      const wide = hash2(fx, fy, 67) > 0.55;
      x.fillStyle = Y[1]; x.fillRect(fx, fy, wide ? 3 : 2, 1); x.fillRect(fx + 1, fy - 1, 1, 3);
      x.fillStyle = Y[3]; x.fillRect(fx + 1, fy, 1, 1);
    }
  }
  return c;
}

// 땅 (게임 무대) — 풀 립 + 흙 띠 + 박힌 돌
function pick2(R, a) { return a[Math.floor(R() * a.length)]; }
function buildGround(ph) {
  const lw = WORLD_W + 8, c = mk(lw, VIEW_H - GROUND + 4), x = c.getContext('2d'), R = rng(23);
  const A = k => atmo(k, ph, 0);
  const G = C.grass.map(A), S = C.soil.map(A), St = C.stone.map(A);
  const top = 3;
  // 흙: 위는 밝게, 아래로 갈수록 어둡게 (경계만 디더)
  const bands = [[top, S[3]], [top + 5, S[2]], [top + 11, S[1]], [top + 19, S[0]]];
  for (let y = top; y < c.height; y++) {
    for (let i = 0; i < lw; i++) {
      const yy = y + (vnoise(i * 0.055, y * 0.08, 23) - 0.5) * 5; let j = 0; while (j < bands.length - 1 && yy >= bands[j + 1][0]) j++;
      let col = bands[j][1];
      if (hash2(i >> 1, y, 24) < 0.05) col = bands[Math.max(0, j - 1)][1];   // 흙 알갱이
      x.fillStyle = col; x.fillRect(i, y, 1, 1);
    }
  }
  // 흙 결: 가로로 긴 덩어리
  for (let k = 0; k < 60; k++) {
    const sx = Math.floor(R() * lw), sy = top + 6 + Math.floor(R() * 18), w = 3 + Math.floor(R() * 6);
    x.fillStyle = S[Math.max(0, (sy < top + 11 ? 2 : 1) - 1)]; x.fillRect(sx, sy, w, 1);
    x.fillStyle = S[Math.min(4, (sy < top + 11 ? 2 : 1) + 1)]; x.fillRect(sx + 1, sy - 1, w - 2, 1);
  }
  // 박힌 현무암
  for (let k = 0; k < 16; k++) {
    const w = 4 + Math.floor(R() * 5), h = 3 + Math.floor(R() * 2), pb = new PB(w + 2, h + 2);
    pb.ellipse((w + 2) / 2, (h + 2) / 2, w / 2, h / 2, (nx, ny) => { const v = sphereLight(nx, ny); return v < 0.4 ? St[1] : v < 0.7 ? St[2] : St[3]; });
    x.drawImage(selOut(pb, 0.6).canvas(), Math.floor(R() * lw), top + 7 + Math.floor(R() * 16));
  }
  // 들꽃 군락 · 작은 풀 덤불 (흙 위)
  for (let k = 0; k < 24; k++) {
    const fx = Math.floor(R() * lw), fy = top + 5 + Math.floor(R() * 4);
    x.fillStyle = G[2]; x.fillRect(fx, fy, 3, 1); x.fillRect(fx + 1, fy - 1, 1, 1);
    if (R() < 0.5) { x.fillStyle = atmo(pick2(R, ['#f2e8c8', '#e8c43a', '#d87aa0']), ph, 0); x.fillRect(fx + 1, fy - 2, 1, 1); }
  }
  // 풀 립: 물결 모양 아랫단 + 위로 솟은 풀잎
  for (let i = 0; i < lw; i++) {
    const depth = 3 + ((Math.sin(i * 0.45) + Math.sin(i * 0.17 + 1)) > 0.6 ? 2 : (Math.sin(i * 0.9) > 0.3 ? 1 : 0));
    for (let y = 0; y < depth; y++) { x.fillStyle = y === 0 ? G[4] : y === 1 ? G[3] : y === depth - 1 ? G[1] : G[2]; x.fillRect(i, top + y, 1, 1); }
    x.fillStyle = mix(S[3], INK, 0.35); x.fillRect(i, top + depth, 1, 1);
    const blade = hash2(i, 3, 2);
    if (blade < 0.35) { x.fillStyle = G[3]; x.fillRect(i, top - 1, 1, 1); }
    if (blade < 0.12) { x.fillStyle = G[4]; x.fillRect(i, top - 2, 1, 1); }
  }
  return c;
}

// 전경: 화면 아래를 감싸는 어두운 풀 실루엣 (가장 앞, 가장 빠르게)
function buildFront(ph) {
  const lw = layerW(LAYER_P.front), c = mk(lw, 30), x = c.getContext('2d'), R = rng(88);
  const dark = atmo('#10241e', ph, 0), mid = atmo('#1a382a', ph, 0), flw = atmo('#8a7a2a', ph, 0);
  for (let i = 0; i < lw; i += 2 + Math.floor(R() * 3)) {
    const edge = Math.min(i, lw - i) < 40;
    const h = (edge ? 12 : 4) + Math.floor(R() * (edge ? 16 : 7));
    const lean = (R() - 0.5) * 6;
    for (let k = 0; k < h; k++) {
      const t = k / h, xx = Math.round(i + lean * t * t), yy = 30 - k;
      x.fillStyle = k < h * 0.5 ? dark : mid; x.fillRect(xx, yy, k < h * 0.6 ? 2 : 1, 1);
    }
    if (R() < 0.12) { x.fillStyle = flw; x.fillRect(Math.round(i + lean) - 1, 30 - h - 1, 3, 2); }
  }
  return c;
}

// 비네트 (부드럽게 가장자리만)
function buildVignette() {
  const c = mk(W, H), x = c.getContext('2d');
  const gr = x.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.05);
  gr.addColorStop(0, 'rgba(20,8,30,0)'); gr.addColorStop(1, 'rgba(20,8,30,0.45)');
  x.fillStyle = gr; x.fillRect(0, 0, W, H);
  return c;
}

// ═════════════════════════════════════════════════════════════
//  해안 테마: 성산일출봉 · 바다 · 등대 · 현무암 갯바위 · 불턱
// ═════════════════════════════════════════════════════════════
function buildSeongsan(ph) {
  // 사진처럼: 왼쪽 낮은 땅 → 완만한 서쪽 풀 비탈 → 납작한 왕관 능선 → 오른쪽은 바다로 떨어지는 절벽 (땅과 이어져 있음)
  const lw = layerW(LAYER_P.hall), c = mk(lw, 140), x = c.getContext('2d'), A = k => atmo(k, ph, 0.28);
  const rock = ['#3a322e', '#4e443e', '#665850', '#806e62', '#9c8876'].map(A);
  const grass = ['#2c4630', '#3a5a3c', '#4c7048', '#628656', '#7e9e68'].map(A);
  const land = ['#3e4a34', '#566444', '#6e7a52'].map(A);
  const base = 105, x0 = Math.round(lw * 0.40), xs = Math.round(lw * 0.55), xr = Math.round(lw * 0.86), crown = 60;
  const tops = [];
  for (let i = 0; i <= xr; i++) {
    let y;
    if (i < x0) y = base - 5 - Math.round(vnoise(i * 0.06, 0.5, 21) * 2);
    else if (i < xs) { const t = (i - x0) / (xs - x0), e = t * t * (3 - 2 * t); y = base - 5 - (base - 5 - crown - 4) * Math.pow(e, 1.15); }
    else if (i > xr - 16) { const t = (i - (xr - 16)) / 16; y = crown + 2 + t * t * 34 + Math.round((vnoise(i * 0.5, 2.5, 22) - 0.5) * 4); }   // 오른쪽 어깨: 가파르지만 수직은 아니게
    else { const fade = clamp((i - xs) / 14, 0, 1); y = crown + Math.round(((vnoise(i * 0.35, 1.5, 22) - 0.5) * 5 + ((i * 13) % 7 === 0 ? -2 : 0)) * fade); }   // 왕관 들머리는 봉우리 들쭉날쭉을 천천히 키움
    tops[i] = Math.round(y);
  }
  // 비탈 → 왕관: 높이를 20px에 걸쳐 부드럽게 이어 직각 턱이 생기지 않게 (어깨를 둥글게)
  { const raw = tops.slice(); for (let i = Math.max(0, xs - 12); i <= Math.min(xr, xs + 10); i++) { let sum = 0, n = 0; for (let k = -6; k <= 6; k++) { const v = raw[clamp(i + k, 0, xr)]; if (v !== undefined) { sum += v; n++; } } tops[i] = Math.round(sum / n); } }
  for (let i = 0; i <= xr; i++) {
    const top = tops[i], side = (i - xs) / (xr - xs);   // 왕관 구간 0 → 1 (오른쪽일수록 그늘)
    for (let y = top; y < base + 6; y++) {
      const depth = y - top;
      let col;
      if (i < xs) {
        // 낮은 땅 → 서쪽 풀 비탈: 같은 풀 결로 이어지고, 멀리(왼쪽) 갈수록 조금씩 어두워짐 (색이 뚝 끊기지 않게)
        const far = clamp((x0 + 30 - i) / 120, 0, 1);
        const v = 0.62 - far * 0.16 + (depth < 2 ? 0.2 - far * 0.06 : 0) + (vnoise(i * 0.2, y * 0.35, 23) - 0.5) * 0.3 - (y > base - 6 ? 0.18 : 0);
        col = band(grass, clamp(v, 0, 0.999), i, y, 0.6);
        if (far > 0) col = mix(col, land[1], far * 0.35);
      } else {
        // 왕관: 위쪽 바위 봉우리 → 아래 풀과 바위가 섞임 → 오른쪽 끝은 수평 지층이 보이는 절벽
        const fr = clamp((i - xs) / 18, 0, 1);   // 왕관 들머리: 바위 · 결을 서서히 (비탈 풀빛과 이어지게)
        const rockiness = clamp((depth < 4 ? 0.9 * fr : 0) + (side - 0.45) * 1.6 + (vnoise(i * 0.15, y * 0.12, 24) - 0.5) * 0.7 * fr, 0, 1);
        // 비탈과 같은 풀 결을 그대로 이어 쓰고, 오른쪽으로 갈수록 그늘 · 세로 골짜기 결은 은은하게만
        const tex = (vnoise(i * 0.2, y * 0.35, 23) - 0.5) * 0.3, gully = (vnoise(i * 0.18, y * 0.1, 25) - 0.5) * 0.14 * fr;
        let v = 0.62 - Math.max(0, side) * 0.36 + (depth < 2 ? 0.18 : 0) + tex + gully - (y > base - 6 ? 0.18 : 0);
        if (rockiness > 0.55) {
          if ((y + Math.round(vnoise(i * 0.05, 3, 26) * 3)) % 6 === 0) v -= 0.1;   // 응회암 지층
          if (vnoise(i * 0.25, y * 0.06, 27) > 0.7) v -= 0.12;   // 굽이진 골
          col = band(rock, clamp(v, 0, 0.999), i, y, 0.5);
        } else col = band(grass, clamp(v, 0, 0.999), i, y, 0.6);
      }
      if (y >= base - 1) col = mix(col, rock[0], 0.4);   // 물가 그늘
      x.fillStyle = col; x.fillRect(i, y, 1, 1);
    }
  }
  // 분화구 테두리 안쪽의 얕은 그늘 한 줄
  x.fillStyle = rock[1]; for (let i = xs + 10; i < xr - 8; i++) if ((i * 7) % 3) x.fillRect(i, tops[i] + 2, 1, 1);
  // 절벽 발치 바위
  for (let i = xr - 2; i < xr + 10; i++) { const h = 3 - Math.abs(i - xr - 3) / 3; for (let y = base - Math.round(h); y < base + 6; y++) { x.fillStyle = rock[i < xr + 3 ? 1 : 0]; x.fillRect(i, y, 1, 1); } }
  c.cx = Math.round((xs + xr) / 2); c.top = crown;
  return c;
}
function buildSea(ph, emerald) {
  const lw = layerW(LAYER_P.field), c = mk(lw, 140), x = c.getContext('2d'), R = rng(71);
  const top = 104;
  const deep = emerald ? ['#1e7a8a', '#2a9aa0', '#4ac0b4', '#86dcc8', '#c8f4e4'] : ['#1a4a8a', '#2462a8', '#3a82c4', '#6aaedc', '#a8d8f0'];
  const cols = deep.map(k => atmo(k, ph, 0.12));
  for (let y = top; y < 140; y++) {
    const f = (y - top) / 36, k = emerald ? clamp(Math.round(f * 4.4), 0, 4) : clamp(Math.round(4 - f * 4.6), 0, 4);
    for (let i = 0; i < lw; i++) {
      // 색 경계가 자로 그은 듯하지 않게 살짝 물결
      const f2 = (y - top + (vnoise(i * 0.045, y * 0.08, 72) - 0.5) * 3) / 36;
      let col = band(cols, clamp(emerald ? f2 * 1.1 : 1 - f2 * 1.15, 0, 0.999), i, y); void k;
      x.fillStyle = col; x.fillRect(i, y, 1, 1);
    }
  }
  // 수평선 반짝임과 물결
  x.fillStyle = atmo('#ffffff', ph, 0.1);
  for (let k = 0; k < 70; k++) { const yy = top + 2 + Math.floor(Math.pow(R(), 1.6) * 32); x.fillRect(Math.floor(R() * lw), yy, 2 + Math.floor(R() * 4), 1); }
  if (emerald) {
    // 비양도: 낮고 평평한 섬 + 한쪽에 작은 봉우리
    const ix = Math.round(lw * 0.68);
    for (let i = -34; i <= 34; i++) {
      const t = i / 34, flat = Math.round(3 * Math.sqrt(Math.max(0, 1 - t * t))), cone = Math.max(0, 8 - Math.abs(i - 10) * 0.7);
      const yy = top - flat - Math.round(cone);
      x.fillStyle = atmo(i < 10 ? '#4e7a5e' : '#3e6a4e', ph, 0.35); x.fillRect(ix + i, yy, 1, top - yy + 1);
      if (cone > 1 && i < 10) { x.fillStyle = atmo('#6a9a72', ph, 0.35); x.fillRect(ix + i, yy, 1, 1); }
    }
    // 얕은 바다의 검은 현무암 암초
    for (let k = 0; k < 14; k++) {
      const rx = Math.floor(R() * lw), ry = top + 22 + Math.floor(R() * 12), rw = 4 + Math.floor(R() * 10);
      for (let i = 0; i < rw; i++) { x.fillStyle = atmo(i % 3 ? '#2a4a52' : '#1e3a44', ph, 0.1); x.fillRect(rx + i, ry + (i % 4 === 0 ? 1 : 0), 1, 1 + (i > 1 && i < rw - 2 ? 1 : 0)); }
    }
  }
  // 등대 (빨간 등대 + 방파제)
  const lx = Math.round(lw * 0.12);
  x.fillStyle = atmo('#3a3a46', ph, 0.15); x.fillRect(lx - 30, top + 9, 46, 3);
  for (let y = 0; y < 18; y++) { const cc = atmo(y % 6 < 3 ? '#e8403a' : '#f4f0e8', ph, 0.12); x.fillStyle = cc; x.fillRect(lx - 2, top + 9 - y, 5, 1); x.fillStyle = mix(cc, INK, 0.3); x.fillRect(lx + 2, top + 9 - y, 1, 1); }
  x.fillStyle = atmo('#3a3a46', ph, 0.15); x.fillRect(lx - 3, top - 10, 7, 2); x.fillStyle = atmo('#ffe9a0', ph, 0); x.fillRect(lx - 1, top - 12, 3, 2);
  // 고깃배
  const bx = Math.round(lw * 0.42);
  x.fillStyle = atmo('#f2ede4', ph, 0.15); x.fillRect(bx, top + 4, 12, 2); x.fillRect(bx + 3, top + 1, 4, 3); x.fillStyle = mix(atmo('#f2ede4', ph, 0.15), INK, 0.3); x.fillRect(bx + 11, top + 4, 1, 2); x.fillRect(bx + 6, top + 1, 1, 3);
  x.fillStyle = atmo('#3a6ac8', ph, 0.15); x.fillRect(bx, top + 6, 12, 1);
  // 물에 뜬 해녀 테왁 (주황 점) — 물질 중
  for (let k = 0; k < 5; k++) { const tx = Math.round(lw * (0.55 + k * 0.08)) + Math.floor(R() * 8), ty = top + 14 + Math.floor(R() * 12); x.fillStyle = atmo('#ff8a1a', ph, 0.05); x.fillRect(tx, ty, 2, 2); x.fillStyle = atmo('#ffffff', ph, 0.1); x.fillRect(tx - 1, ty + 2, 4, 1); }
  return c;
}
function buildCoastNear(ph, sand) {
  const lw = layerW(LAYER_P.near), c = mk(lw, 160), x = c.getContext('2d'), R = rng(9);
  const A = k => atmo(k, ph, 0.05);
  const St = ['#16141c', '#24222e', '#36343f', '#4e4b58', '#6e6a7a'].map(A), L = C.leaf.map(A);
  const MOSS = ['#2e4424', '#46652a', '#6a8a34', '#94ae48'].map(A);
  const mask = new Uint8Array(lw), cover = (x0, w) => { for (let k = Math.max(0, x0); k < Math.min(lw, x0 + w); k++) mask[k] = 1; };   // 파도 거품이 바위 위로 지나가지 않게
  // 파도 거품 띠
  for (let i = 0; i < lw; i++) { const y = 138 + Math.round((vnoise(i * 0.09, 0.5, 77) - 0.5) * 4); x.fillStyle = A('#e8f6ff'); x.fillRect(i, y, 1, 2); x.fillStyle = A('#9ad0ec'); x.fillRect(i, y + 2, 1, 1); }
  // 백사장 또는 검은 모래
  const sandCols = sand ? ['#e8d8b4', '#f6ead0', '#d8c49c'] : ['#3a3440', '#4a4452', '#2c2832'];
  x.fillStyle = A(sandCols[0]); x.fillRect(0, 141, lw, 20);
  for (let k = 0; k < 200; k++) { x.fillStyle = A(sandCols[1 + (k % 2)]); x.fillRect(Math.floor(R() * lw), 142 + Math.floor(R() * 14), 2, 1); }
  // 현무암 갯바위 덩어리
  const rock = (rx, ry, w, h) => {
    const pb = new PB(w + 2, h + 2);
    for (let yy = 1; yy <= h; yy++) for (let xx = 1; xx <= w; xx++) { const nx = (xx - (w + 1) / 2) / (w / 2), ny = (yy - (h + 1) / 2) / (h / 2); if (Math.abs(nx) ** 1.6 + Math.abs(ny) ** 1.4 > 0.82 + 0.24 * vnoise(xx * 0.35, yy * 0.35, rx + 71)) continue; const v = sphereLight(clamp(nx, -1, 1), clamp(ny, -1, 1)); pb.set(xx, yy, St[v < 0.32 ? 0 : v < 0.5 ? 1 : v < 0.72 ? 2 : v < 0.88 ? 3 : 4]); }
    for (let k = 0; k < w * h / 14; k++) { const px = 1 + Math.floor(R() * w), py = 1 + Math.floor(R() * h); if (pb.get(px, py) && pb.get(px, py + 1)) { pb.set(px, py, St[0]); pb.set(px, py + 1, St[3]); } }
    // 성산 쪽 해안: 바위 윗면에 초록 이끼
    if (!sand) for (let yy = 0; yy < h + 2; yy++) for (let xx = 0; xx < w + 2; xx++) if (pb.get(xx, yy) && (!pb.get(xx, yy - 1) || !pb.get(xx, yy - 2)) && hash2(xx + rx, yy, 41) < 0.8) pb.set(xx, yy, MOSS[!pb.get(xx, yy - 1) ? (xx < (w + 2) * 0.6 ? 3 : 2) : 1]);
    x.drawImage(selOut(pb, 0.5).canvas(), rx, ry); if (ry + h + 2 >= 136) cover(rx, w + 2);
  };
  // 광치기 해변: 이끼 덮인 평평한 암반이 결 따라 이어지고, 사이사이 하늘을 비추는 물웅덩이
  if (!sand) for (let i = 0; i < lw;) {
    const w = 30 + Math.floor(R() * 46), y0 = 133 + Math.floor(R() * 6);
    for (let xx = 0; xx < w; xx++) {
      const top = y0 + Math.round(Math.sin((i + xx) * 0.09) * 1.5) + (xx < 3 || xx > w - 4 ? 1 : 0);
      for (let yy = top; yy < 142; yy++) {
        const d = yy - top; let col = d === 0 ? MOSS[xx < w * 0.55 ? 3 : 2] : d < 3 ? MOSS[hash2(i + xx, yy, 42) < 0.3 ? 1 : 2] : d < 5 ? MOSS[0] : St[1];
        if (hash2(i + xx, yy, 43) < 0.04 && d > 0) col = St[1];   // 바위 틈
        x.fillStyle = col; x.fillRect(i + xx, yy, 1, 1);
      }
    }
    cover(i, w);
    if (R() < 0.6) { const px = i + 6 + Math.floor(R() * (w - 18)), pw = 6 + Math.floor(R() * 8), py = y0 + 2; x.fillStyle = St[0]; x.fillRect(px - 1, py, pw + 2, 2); x.fillStyle = A('#a8c8d8'); x.fillRect(px, py, pw, 1); x.fillStyle = A('#d8ecf4'); x.fillRect(px + 1, py, Math.max(1, pw >> 2), 1); }
    i += w + 4 + Math.floor(R() * 20);
  }
  for (let i = 0; i < lw; i += 26 + Math.floor(R() * 30)) rock(i, 128 + Math.floor(R() * 8), 14 + Math.floor(R() * 16), 9 + Math.floor(R() * 6));
  // 불턱 (해녀들이 불 쬐던 돌담 원형 쉼터)
  const bx = Math.round(lw * 0.55);
  // 낮게 둘러쌓은 돌담: 뒷줄은 작고 높게, 앞줄은 크고 낮게 (땅에 붙어 있게), 사이로 불씨
  for (let k = 0; k < 8; k++) rock(bx - 24 + k * 6 + (k % 2), 127 + (k === 0 || k === 7 ? 2 : 0), 7, 5);
  x.fillStyle = A('#ff9a3a'); x.fillRect(bx - 2, 130, 3, 2); x.fillStyle = A('#ffd84a'); x.fillRect(bx - 1, 129, 1, 1);
  for (let k = 0; k < 6; k++) rock(bx - 22 + k * 8 + (k % 2), 131 + (k === 0 || k === 5 ? 1 : 0), 9, 6);
  // 해송 / 야자
  const pine = (px, top) => {
    x.fillStyle = A('#5a3e2a'); x.fillRect(px, top + 10, 2, 140 - top - 10);
    for (let yy = 0; yy < 18; yy++) { const hw = Math.round((3 + yy * 0.3) * (0.65 + 0.35 * vnoise(yy * 0.45, px, 8))); for (let xx = -hw; xx <= hw; xx++) { x.fillStyle = xx < 0 && yy % 5 < 2 ? L[2] : yy % 5 === 4 ? L[0] : L[1]; x.fillRect(px + xx, top + yy, 1, 1); } }
    for (let k = 0; k < 0; k++) { const w = 14 - k * 2, y = top + k * 4; x.fillStyle = k % 2 ? L[1] : L[0]; x.fillRect(px - w / 2 + 1 + (k % 2) * 2, y, w, 4); x.fillStyle = L[2]; x.fillRect(px - w / 2 + 2, y, w - 6, 1); }
  };
  c.foamMask = mask;
  if (sand) { pine(Math.round(lw * 0.2), 96); pine(Math.round(lw * 0.82), 92); pine(Math.round(lw * 0.88), 100); }
  else { pine(Math.round(lw * 0.86), 98); }
  return c;
}
function buildGroundTheme(ph, kind) {
  if (kind === 'field') return buildGround(ph);
  const c = buildGround(ph), x = c.getContext('2d'), R = rng(5);
  const tint = kind === 'beach' ? ['#c8b48c', '#e0cca4', '#a8946c', '#8a7654'] : ['#3c3644', '#4e4858', '#2e2a36', '#24202c'];
  // 흙 대신 모래: 위쪽 풀 립은 남기고 아래만 덮음
  for (let y = 1; y < c.height; y++) for (let i = 0; i < c.width; i++) {
    const edge = y < 3 + (vnoise(i * 0.3, 0.5, 81) > 0.55 ? 1 : 0);
    if (y < 2 && vnoise(i * 0.3, 0.5, 81) < 0.45) continue;
    const yy = y + (vnoise(i * 0.06, y * 0.1, 82) - 0.5) * 5;
    const k = edge ? 1 : yy < 10 ? 0 : yy < 18 ? 2 : 3;
    x.fillStyle = atmo(tint[k], ph, 0); x.fillRect(i, y, 1, 1);
  }
  for (let k = 0; k < 120; k++) { x.fillStyle = atmo(tint[1], ph, 0); x.fillRect(Math.floor(R() * c.width), 8 + Math.floor(R() * 18), 2, 1); }
  for (let k = 0; k < 10; k++) { x.fillStyle = atmo('#f4e8d0', ph, 0); const sx = Math.floor(R() * c.width), sy = 10 + Math.floor(R() * 14); x.fillRect(sx, sy, 3, 2); x.fillStyle = atmo('#c88a6a', ph, 0); x.fillRect(sx + 1, sy, 1, 1); }   // 조개껍데기
  return c;
}

let SCENES = null, CLOUDS = null, VIGNETTE = null;
const THEMES = {};
let THEME = 'field';
function buildTheme(kind) {
  if (THEMES[kind]) return THEMES[kind];
  THEMES[kind] = PHASES.map(ph => ({
    sky: buildSky(ph),
    halla: kind === 'coast' ? buildSeongsan(ph) : buildHalla(ph),
    oreum: kind === 'coast' ? Object.assign(mk(layerW(LAYER_P.oreum), 140), { empty: true }) : buildOreum(ph),
    field: kind === 'field' ? buildFields(ph) : buildSea(ph, kind === 'beach'),
    near: kind === 'field' ? buildNear(ph) : buildCoastNear(ph, kind === 'beach'),
    ground: buildGroundTheme(ph, kind), front: buildFront(ph),
  }));
  return THEMES[kind];
}
function useTheme(kind) { THEME = kind; SCENES = buildTheme(kind); }
function buildScenes() {
  useTheme('field');
  CLOUDS = PHASES.map((ph, i) => [
    cloudSprite(84, 30, 11 + i * 0, ph.cloud), cloudSprite(56, 22, 23, ph.cloud), cloudSprite(110, 34, 37, ph.cloud), cloudSprite(40, 16, 51, ph.cloud),
  ]);
  VIGNETTE = buildVignette();
}
