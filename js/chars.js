// ─────────────────────────────────────────────────────────────
//  픽셀 제주 — 캐릭터 · 적 · 소품 스프라이트
//  주인공/할망/조랑말은 "리그"(머리·몸통은 손으로 찍은 모양, 팔다리는 각도)로
//  포즈를 만들어 프레임을 굽는다 → 달리기 8프레임 같은 부드러운 애니메이션.
// ─────────────────────────────────────────────────────────────
'use strict';

const D2R = Math.PI / 180;
const limbEnd = (x, y, len, deg) => [x + Math.sin(deg * D2R) * len, y + Math.cos(deg * D2R) * len];
C.peach = muteAll(['#a8503e', '#d9806a', '#f4b49a', '#ffdcc8']);
C.hide = muteAll(['#33191e', '#5a2e22', '#8a4a2c', '#b86e3c', '#dc9a60']);
C.tan = muteAll(['#6a3030', '#a85a46', '#d48a66', '#efb48e']);
C.mint = muteAll(['#24585a', '#3f8a80', '#7cc4a8', '#c4ecd4']);
C.straw = muteAll(['#4a2a1e', '#7a4a2a', '#b07a42', '#dcae6a']);

// ═════════════════════════════════════════════════════════════
//  주인공 "숨비" — 새내기 해녀 (잠수복 두건 · 왕눈 물안경 · 등에 테왁)
// ═════════════════════════════════════════════════════════════
C.teal = muteAll(['#173c4a', '#22636e', '#33938f', '#62c4b0', '#b4ecd8']);
C.hair = muteAll(['#2e1620', '#4e2626', '#7a3e2e', '#a86040']);
C.cream = muteAll(['#7a5a42', '#b8946c', '#e2c79a', '#fff0d0']);
const PW = 36, PH = 50, PAX = 18, PAY = 47;

// ── 숨비: 고무 잠수복 두건 + 이마에 올린 왕눈 물안경 ──
C.suit = muteAll(['#12141c', '#1c2030', '#2a3048', '#435074', '#6c7ca8']);
function drawGyulHead(pb, ox, oy, o) {
  const S = C.skin, U = C.suit;
  // 두건 (구 셰이딩, 실제 비율에 가깝게 작게)
  pb.ellipse(ox + 7, oy + 6.6, 6.4, 6.6, (nx, ny) => { const v = sphereLight(nx, ny); return U[v < 0.3 ? 0 : v < 0.5 ? 1 : v < 0.72 ? 2 : 3]; });
  // 얼굴 구멍
  pb.ellipse(ox + 8.4, oy + 8.6, 4.3, 4.1, (nx, ny) => (nx < -0.5 ? S[2] : nx > 0.55 || ny > 0.55 ? S[1] : S[2]));
  for (let x = 4; x <= 12; x++) { const c = pb.get(ox + x, oy + 12); if (c && U.includes(c)) pb.set(ox + x, oy + 12, C.org[1]); }
  // 눈 · 눈썹 · 입: 점 하나씩, 표정은 절제
  const E = C.ink;
  const eye = (ex) => {
    if (o.eyes === 'x') { pb.set(ox + ex, oy + 8, E); pb.set(ox + ex + 1, oy + 9, E); return; }
    if (o.eyes === 'blink' || o.eyes === 'squint' || o.eyes === 'happy') { pb.set(ox + ex, oy + 9, E); pb.set(ox + ex + 1, oy + 9, S[0]); return; }
    pb.set(ox + ex, oy + 8, S[0]); pb.set(ox + ex, oy + 9, E);
  };
  eye(7); eye(10);
  if (o.mouth === 'o' || o.mouth === 'grit') pb.set(ox + 9, oy + 11, C.red[0]);
  else { pb.set(ox + 8, oy + 11, S[0]); pb.set(ox + 9, oy + 11, S[0]); }
  // 이마에 올린 물안경 (작고 무광)
  for (let x = 1; x <= 13; x++) if (pb.get(ox + x, oy + 4)) pb.set(ox + x, oy + 4, U[0]);
  pb.ellipse(ox + 8, oy + 3.4, 3.6, 2.4, (nx, ny) => Math.hypot(nx, ny) > 0.7 ? C.stone[2] : (nx + ny < -0.6 ? C.stone[3] : C.blue[1]));
  const t = o.leaf || 0;
  pb.set(ox + 4 - t, oy, U[2]);
}

function drawGyulTorso(pb, x, y) {
  const U = C.suit, O = C.org;
  for (let j = 0; j < 9; j++) for (let i = 0; i < 10; i++) {
    if ((j === 0 && (i === 0 || i === 9)) || (j > 5 && (i === 0 || i === 9))) continue;
    let c = i <= 1 ? U[3] : i >= 8 ? U[1] : U[2];
    if (i === 2 && j > 0) c = O[2];                       // 옆선 주황
    if (j === 0) c = i >= 7 ? U[2] : U[3];
    pb.set(x + i, y + j, c);
  }
  // 납 허리띠 (해녀의 연철)
  for (let i = 0; i < 10; i++) pb.set(x + i, y + 8, i === 3 || i === 4 ? C.stone[3] : C.stone[1]);
  for (let j = 9; j < 12; j++) for (let i = 0; i < 10; i++) {
    if (j === 11 && (i === 4 || i === 5)) continue;
    pb.set(x + i, y + j, i >= 8 ? U[0] : i <= 1 ? U[3] : U[1]);
  }
}

function drawGyulArm(pb, sx, sy, up, fore, back) {
  const U = C.suit;
  const [ex, ey] = limbEnd(sx, sy, 4, up);
  const [hx, hy] = limbEnd(ex, ey, 4, up + fore);
  pb.limb(sx, sy, ex, ey, 3, back ? U[1] : U[3]);
  pb.limb(ex, ey, hx, hy, 2, back ? U[0] : U[2]);
  pb.rect(Math.round(hx - 1), Math.round(hy - 1), 3, 3, back ? C.cloth[1] : C.cloth[3]);   // 흰 면장갑
  if (!back) pb.set(Math.round(hx + 1), Math.round(hy + 1), C.cloth[2]);
}

function drawGyulLeg(pb, hx, hy, thigh, shin, back) {
  const U = C.suit;
  const [kx, ky] = limbEnd(hx, hy, 4, thigh);
  const [fx, fy] = limbEnd(kx, ky, 5, shin);
  pb.limb(hx, hy, kx, ky, 3, back ? U[0] : U[2]);
  pb.limb(kx, ky, fx, fy, 2, back ? U[0] : U[2]);
  const sx = Math.round(fx) - 1, sy = Math.round(fy) + 1;
  pb.rect(sx, sy - 1, 3, 1, back ? U[1] : U[3]);
  pb.rect(sx, sy, 5, 1, back ? U[0] : U[2]);
  pb.rect(sx, sy + 1, 5, 1, back ? C.org[0] : C.org[2]);       // 주황 고무 밑창
}

function gyulPose(p) {
  const pb = new PB(PW, PH);
  const crouch = p.crouch || 0, bob = p.bob || 0, lean = p.lean || 0;
  const hipY = 35 + crouch + bob;
  const tx = 13 + lean, ty = hipY - 11;
  drawGyulArm(pb, tx + 2, ty + 2, p.armB[0], p.armB[1], true);
  drawGyulLeg(pb, tx + 3, hipY, p.legB[0], p.legB[1], true);
  drawGyulTorso(pb, tx, ty);
  drawGyulLeg(pb, tx + 6, hipY, p.legF[0], p.legF[1], false);
  drawGyulHead(pb, tx - 2 + (p.headX || 0), ty - 12 + (p.headY || 0), p);
  drawGyulArm(pb, tx + 8, ty + 2, p.armF[0], p.armF[1], false);
  const out = framePair(selOut(pb), PAX, PAY);
  out.r.neck = [tx + 3 - PAX, ty + 1 - PAY]; out.l.neck = [-(tx + 3 - PAX), ty + 1 - PAY];
  return out;
}

// 구르기 · 공중제비: 몸을 만 공을 각도별로 직접 렌더
function gyulBall(theta) {
  const pb = new PB(PW, PH), cx = 18, cy = PAY - 9, r = 8.2;
  for (let y = cy - 10; y <= cy + 10; y++) for (let x = 8; x <= 28; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
    if (d > r) continue;
    const v = sphereLight(dx / r, dy / r);
    const u = dx * Math.cos(theta) + dy * Math.sin(theta), q = -dx * Math.sin(theta) + dy * Math.cos(theta);
    const face = ((u - 4.7) / 2.8) ** 2 + ((q - 1) / 3.3) ** 2 < 1, sole = ((u + 1) / 4) ** 2 + ((q - 5) / 1.6) ** 2 < 1;
    const c = face ? C.skin[v < 0.5 ? 1 : 2] : sole ? C.org[1] : C.suit[v < 0.35 ? 0 : v < 0.6 ? 1 : v < 0.8 ? 2 : 3];
    pb.set(x, y, c);
  }
  const ex = cx + Math.cos(theta + 0.25) * 4.6, ey = cy + Math.sin(theta + 0.25) * 4.6;
  pb.set(ex, ey, C.ink); pb.set(ex + Math.cos(theta + 1.8), ey + Math.sin(theta + 1.8), C.ink);
  const lx = cx + Math.cos(theta - 0.55) * 6.2, ly = cy + Math.sin(theta - 0.55) * 6.2;
  pb.set(lx, ly, C.stone[3]); pb.set(lx + Math.cos(theta + Math.PI / 2), ly + Math.sin(theta + Math.PI / 2), C.blue[1]);
  return framePair(selOut(pb), PAX, PAY);
}

const GYUL = (() => {
  const base = { armF: [10, -20], armB: [-10, -20], legF: [6, 0], legB: [-6, 0], eyes: 'open', leaf: 0 };
  const P = o => gyulPose({ ...base, ...o });
  const idle = [0, 0, 1, 1].map((b, i) => P({ headY: b, armF: [8 + b * 4, -15], armB: [-8 - b * 4, -15], leaf: i < 2 ? 0 : 1 }));
  const run = [], throwRun = [[], []];
  for (let i = 0; i < 8; i++) {
    const t = i / 8 * Math.PI * 2;
    const leg = q => { const th = 40 * Math.sin(q); const bend = 75 * Math.max(0, Math.cos(q)); return [th, th - bend]; };
    const pose = { lean: 1, bob: (i % 4 === 1 || i % 4 === 2) ? -1 : 0, leaf: -1, legF: leg(t), legB: leg(t + Math.PI), armF: [-55 * Math.sin(t), 80], armB: [55 * Math.sin(t), 80] };
    run.push(P(pose));
    for (let j = 0; j < 2; j++) throwRun[j].push(P({ ...pose, armF: j ? [95, 0] : [-150, -30], armB: j ? [-60, 20] : [40, -20] }));
  }
  return {
    idle, run, throwRun,
    blink: P({ eyes: 'blink' }),
    up: P({ legF: [55, -10], legB: [-15, -55], armF: [160, 10], armB: [-150, -10], leaf: -1, mouth: 'grin' }),
    apex: P({ legF: [35, -30], legB: [10, -50], armF: [100, 20], armB: [-100, -20], leaf: 1 }),
    fall: P({ legF: [18, 5], legB: [-12, 0], armF: [135, 0], armB: [-135, 0], leaf: 1, mouth: 'o' }),
    land: P({ crouch: 2, legF: [40, -25], legB: [-25, 15], armF: [45, -30], armB: [-45, 30], leaf: 1, eyes: 'squint' }),
    skid: P({ lean: -1, legF: [35, 35], legB: [-25, -10], armF: [-30, 60], armB: [-70, 40], eyes: 'squint', mouth: 'grit' }),
    throw: [P({ lean: -1, armF: [-150, -30], armB: [40, -20], legF: [20, 0], legB: [-20, 0], eyes: 'squint', mouth: 'grit' }),
            P({ lean: 2, armF: [95, 0], armB: [-60, 20], legF: [25, -5], legB: [-25, 5], mouth: 'grin' })],
    hurt: P({ headX: -1, legF: [25, -10], legB: [-35, -20], armF: [150, 20], armB: [-160, -20], eyes: 'x', mouth: 'o', leaf: 1 }),
    win: P({ armF: [170, 0], armB: [-170, 0], eyes: 'happy', mouth: 'grin', leaf: 1 }),
    roll: Array.from({ length: 8 }, (_, i) => gyulBall(i / 8 * Math.PI * 2)),
  };
})();

// ═════════════════════════════════════════════════════════════
//  돌하르방 — 원통 셰이딩 + 숭숭 뚫린 현무암 질감
// ═════════════════════════════════════════════════════════════
// 사양(spec)으로 실루엣·이목구비 위치를 정하고, 원통 셰이딩은 디더 없이 딱 끊는다
function buildHareubang(sp) {
  const Ww = sp.w + 4, Hh = sp.h + 3, pb = new PB(Ww, Hh), cx = Ww / 2;
  const St = C.stone;
  const hw = y => {
    if (y < sp.brim[0]) { const t = (sp.brim[0] - y) / (sp.brim[0] + 0.8); return sp.domeW * Math.sqrt(Math.max(0, 1 - t * t)); }
    if (y <= sp.brim[1]) return sp.brimW;
    if (y <= sp.head[1]) return sp.headW + (y > sp.head[0] + 4 && y < sp.head[1] - 2 ? 0.5 : 0);
    if (y < sp.body[0]) return sp.headW - 1;
    return sp.bodyW + (y - sp.body[0]) / (sp.h - sp.body[0]) * 1.5;
  };
  const tone = (v) => v < 0.28 ? 0 : v < 0.45 ? 1 : v < 0.62 ? 2 : v < 0.8 ? 3 : 4;
  const T = [];
  for (let y = 0; y < sp.h; y++) {
    const w = hw(y); T[y] = [];
    for (let x = Math.floor(cx - w); x < Math.ceil(cx + w); x++) {
      const nx = (x + 0.5 - cx) / w; if (Math.abs(nx) > 1) continue;
      let ny = -0.1;
      if (y < sp.brim[0]) ny = -(sp.brim[0] - y) / (sp.brim[0] + 1) * 0.9;
      let v = sphereLight(nx * 0.97, ny) - 0.1;
      if (y === sp.brim[0]) v += 0.15;
      if (y === sp.brim[1]) v -= 0.35;
      if (y > sp.brim[1] && y <= sp.brim[1] + 2) v -= 0.22;         // 챙 그늘
      if (y >= sp.body[0] - 1 && y <= sp.body[0]) v -= 0.18;       // 턱 밑 그늘
      pb.set(x, y + 1, St[tone(v)]);
    }
  }
  const P = (fx, fy) => [Math.round(cx + fx - 0.5), fy + 1];
  const get = (fx, fy) => pb.get(...P(fx, fy));
  const put = (fx, fy, k) => { const [x, y] = P(fx, fy); if (pb.get(x, y)) pb.set(x, y, St[k]); };
  const shift = (fx, fy, d) => { const c = get(fx, fy); if (c) put(fx, fy, clamp(St.indexOf(c) + d, 0, 4)); };
  // 현무암 구멍: 2픽셀 덩어리 + 아래 밝은 테
  const R = rng(sp.seed);
  for (let k = 0; k < sp.pits; k++) {
    const fy = Math.floor(R() * (sp.h - 2)), fx = Math.floor((R() - 0.5) * hw(fy) * 1.7);
    if (!get(fx, fy) || !get(fx + 1, fy) || (fy >= sp.eyeY - 1 && fy <= sp.mouthY + 1)) continue;
    shift(fx, fy, -1); shift(fx + 1, fy, -1);
  }
  // 눈: 툭 튀어나온 만화 눈 대신 깊게 판 홈 (실제 돌하르방처럼)
  for (const sx of [-sp.eyeDX, sp.eyeDX]) for (let dx = -2; dx <= 2; dx++) { put(sx + dx, sp.eyeY - 1, 2); put(sx + dx, sp.eyeY, 1); }
  // 코: 크고 넓적한 주먹코
  for (let fy = sp.nose[0]; fy <= sp.nose[1]; fy++) {
    const t = (fy - sp.nose[0]) / (sp.nose[1] - sp.nose[0]);
    const half = Math.round(sp.noseW[0] + (sp.noseW[1] - sp.noseW[0]) * t * t);
    for (let dx = -half; dx <= half; dx++) put(dx, fy, dx < -half / 2 ? 4 : dx <= 0 ? 3 : dx < half ? 2 : 1);
  }
  const nb = sp.nose[1];
  put(-sp.noseW[1] + 1, nb, 0); put(sp.noseW[1] - 1, nb, 0);
  for (let dx = -sp.noseW[1]; dx <= sp.noseW[1]; dx++) put(dx, nb + 1, 1);
  // 입: 꾹 다문 일자
  for (let dx = -sp.mouthW; dx <= sp.mouthW; dx++) put(dx, sp.mouthY, 0);
  put(-sp.mouthW - 1, sp.mouthY - 1, 0); put(sp.mouthW + 1, sp.mouthY - 1, 0);
  // 손 (띠 모양 + 손가락 홈)
  for (const [fy, x0, x1, th] of sp.hands) {
    for (let fx = x0; fx <= x1; fx++) {
      if (!get(fx, fy)) continue;
      put(fx, fy - 1, 1);
      for (let k = 0; k < th; k++) put(fx, fy + k, k === 0 ? 4 : fx > sp.bodyW * 0.5 ? 2 : 3);
      put(fx, fy + th, 0);
    }
    const tip = x1 > 0 ? x1 : x0;
    for (let k = 1; k <= 3; k++) { const fx = tip - Math.sign(tip) * k * 2; for (let j = 1; j < th; j++) put(fx, fy + j, 1); }
  }
  // 받침 그림자
  for (let fx = -sp.bodyW - 2; fx <= sp.bodyW + 2; fx++) put(fx, sp.h - 1, 0);
  return selOut(pb, 0.7).canvas();
}
const HAREUBANG = buildHareubang({
  w: 22, h: 52, seed: 7, domeW: 8.2, brimW: 9.6, headW: 8.4, bodyW: 9,
  brim: [9, 10], head: [11, 29], body: [31, 52],
  eyeY: 16, eyeDX: 4, eyeR: 2.4, nose: [15, 26], noseW: [1, 3], mouthY: 28, mouthW: 3,
  hands: [[35, -9, 3, 3], [42, -3, 10, 3]], pits: 24,
});
const MINI = (() => {
  const c = buildHareubang({
    w: 14, h: 26, seed: 3, domeW: 5.2, brimW: 6.4, headW: 6, bodyW: 6.2,
    brim: [4, 5], head: [6, 15], body: [17, 26],
    eyeY: 9, eyeDX: 3, eyeR: 1.6, nose: [9, 14], noseW: [0, 2], mouthY: 15, mouthW: 2,
    hands: [[19, -6, 2, 2]], pits: 18, angry: true,
  });
  return { r: c, l: flipC(c) };
})();

// ═════════════════════════════════════════════════════════════
//  제주 조랑말 — 몸통 타원 셰이딩 + 각도 다리 6프레임 질주
// ═════════════════════════════════════════════════════════════
const PONW = 44, PONH = 32, PONAX = 20, PONAY = 30;
function ponyPose(t) {
  const pb = new PB(PONW, PONH), Hd = C.hide;
  const bob = Math.round(Math.sin(t * 2) * 1);
  const bx = 18, by = 16 + bob;
  const legs = [
    { x: bx + 7, ph: 0, front: true, back: true }, { x: bx + 5, ph: 0.35, front: true, back: false },
    { x: bx - 6, ph: 0.55, front: false, back: true }, { x: bx - 8, ph: 0.9, front: false, back: false },
  ];
  const drawLeg = (L, pass) => {
    if (L.back !== pass) return;
    const q = t + L.ph * Math.PI * 2;
    const th = 42 * Math.sin(q), bend = (L.front ? -1 : 1) * 60 * Math.max(0, Math.cos(q));
    const [kx, ky] = limbEnd(L.x, by + 4, 5, th);
    const [fx, fy] = limbEnd(kx, ky, 5, th + bend);
    pb.limb(L.x, by + 3, kx, ky, 3, L.back ? Hd[1] : Hd[2]);
    pb.limb(kx, ky, fx, fy, 2, L.back ? Hd[1] : Hd[2]);
    pb.rect(Math.round(fx) - 1, Math.round(fy), 3, 2, L.back ? C.ink : C.line);
  };
  legs.forEach(L => drawLeg(L, true));
  // 꼬리 (펄럭임)
  for (let k = 0; k < 9; k++) {
    const tx = bx - 10 - k, ty = by - 2 + k * 0.5 + Math.sin(t * 2 + k * 0.6) * (k * 0.35);
    pb.rect(Math.round(tx), Math.round(ty), 2, 2, k < 3 ? Hd[0] : '#2a1418');
  }
  // 몸통
  pb.ellipse(bx, by, 11.5, 5.6, (nx, ny, x, y) => rampPick(Hd.slice(1), sphereLight(nx, ny) * 0.95, x, y, 0.4));
  // 배 밝은 부분
  for (let x = bx - 6; x <= bx + 6; x++) if (pb.get(x, by + 5)) pb.set(x, by + 5, Hd[1]);
  // 목 + 머리
  pb.limb(bx + 8, by - 1, bx + 13, by - 8, 6, (k) => k < 0.5 ? Hd[2] : Hd[3]);
  pb.ellipse(bx + 16, by - 9, 4.6, 3.2, (nx, ny, x, y) => rampPick(Hd.slice(1), sphereLight(nx, ny), x, y, 0.4));
  pb.rect(bx + 19, by - 9, 3, 3, Hd[4]); pb.set(bx + 21, by - 8, Hd[3]);  // 주둥이
  pb.set(bx + 21, by - 7, C.ink);                                     // 콧구멍
  pb.set(bx + 16, by - 10, C.ink); pb.set(bx + 16, by - 11, Hd[3]);   // 눈
  pb.set(bx + 13, by - 13, Hd[2]); pb.set(bx + 14, by - 13, Hd[1]); pb.set(bx + 13, by - 14, Hd[1]); // 귀
  // 갈기 (흩날림)
  for (let k = 0; k < 7; k++) {
    const mx = bx + 13 - k * 0.9, my = by - 12 + k * 1.3;
    pb.rect(Math.round(mx - 1 - Math.sin(t * 2 + k) * 0.8), Math.round(my), 2, 2, k % 2 ? '#2a1418' : Hd[0]);
  }
  legs.forEach(L => drawLeg(L, false));
  return framePair(selOut(pb), PONAX, PONAY);
}
function litPair(make) { const r = make().r; LIGHT[0] *= -1; try { return { r, l: make().l }; } finally { LIGHT[0] *= -1; } }
const PONY = Array.from({ length: 6 }, (_, i) => litPair(() => ponyPose(i / 6 * Math.PI * 2)));

// ═════════════════════════════════════════════════════════════
//  소품 · 이펙트 스프라이트
// ═════════════════════════════════════════════════════════════
function fruit(rx, ry, bumps) {
  const w = Math.ceil(rx * 2) + 4, h = Math.ceil(ry * 2) + 6, pb = new PB(w, h), cx = w / 2, cy = h - ry - 2;
  pb.ellipse(cx, cy, rx, ry, (nx, ny, x, y) => {
    let c = rampPick(C.org.slice(1), sphereLight(nx, ny), x, y, 0.4);
    return c;
  });
  if (bumps) pb.ellipse(cx, cy - ry - 0.5, 2.4, 1.8, (nx, ny, x, y) => rampPick(C.org.slice(1), sphereLight(nx, ny) * 0.9, x, y, 0.4));
  const top = Math.round(cy - ry - (bumps ? 2 : 0));
  pb.set(cx, top, C.wood[1]);
  pb.set(cx + 1, top - 1, C.leaf[3]); pb.set(cx + 2, top - 1, C.leaf[3]); pb.set(cx + 2, top - 2, C.leaf[4]); pb.set(cx + 1, top, C.leaf[2]);
  pb.set(Math.round(cx - rx * 0.45), Math.round(cy - ry * 0.45), C.org[4]);
  return selOut(pb).canvas();
}
const TANGERINE = fruit(4.2, 3.8, false);
const HALLABONG = fruit(5, 4.6, true);

function heartSprite(full) {
  const rows = ['.xx...xx.', 'xxxx.xxxx', 'xxxxxxxxx', 'xxxxxxxxx', '.xxxxxxx.', '..xxxxx..', '...xxx...', '....x....'];
  const pb = new PB(11, 10);
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch !== 'x') return;
    const v = 1 - (y / 8) * 0.8 - (x / 9) * 0.3;
    pb.set(x + 1, y + 1, full ? rampPick([C.red[0], C.red[1], C.red[2], C.red[3]], v + 0.2, x, y, 0.3) : (v > 0.6 ? '#5a4060' : '#3e2a48'));
  }));
  if (full) { pb.set(2, 2, C.red[3]); pb.set(3, 2, C.red[3]); }
  return selOut(pb, 0.85).canvas();
}
const HEART = heartSprite(true), HEART_EMPTY = heartSprite(false);

const METEOR = (() => {
  const pb = new PB(14, 14);
  pb.ellipse(7, 7, 5.6, 5.4, (nx, ny, x, y) => {
    const v = sphereLight(nx, ny);
    const crack = (x === 6 + Math.floor((y - 2) / 3) && y >= 3 && y <= 10) || (y === 7 && x >= 7 && x <= 10);
    if (crack) return v > 0.5 ? C.yel[3] : C.org[3];
    return rampPick(['#2a1a24', '#4a2a2e', '#6a3a34'], v, x, y, 0.4);
  });
  return selOut(pb, 0.7).canvas();
})();

const PEBBLE = (() => {
  const pb = new PB(8, 7);
  pb.ellipse(4, 3.6, 3, 2.6, (nx, ny, x, y) => rampPick([C.stone[2], C.stone[3], C.stone[4], '#ffffff'], sphereLight(nx, ny), x, y, 0.3));
  return selOut(pb).canvas();
})();

// 돌 여러 모양: 다각형 윤곽(모서리 수 · 길쭉함 제각각) + 면마다 다른 밝기(왼쪽 위에서 빛) + 현무암 숨구멍
//  rot: 윤곽과 면을 돌려서 다시 그림 (빛은 그대로) → 날아가며 데굴데굴 구르는 칸
function stoneSprite(seed, size, pal, rot = 0, opt = {}) {
  const R = rng(seed), n = (opt.sides || 6) + Math.floor(R() * 3), el = 0.7 + R() * 0.45;
  const pts = []; for (let k = 0; k < n; k++) { const a = k / n * 6.283 + (R() - 0.5) * 0.3, rr = 0.8 + R() * 0.2; pts.push([Math.cos(a) * rr, Math.sin(a) * rr * el]); }   // 뾰족한 별 모양이 되지 않게 고르게
  const fac = Array.from({ length: 4 }, () => { const a = R() * 6.283, d = R() * 0.5; return [Math.cos(a) * d, Math.sin(a) * d * el, (R() - 0.5) * 1.3, (R() - 0.5) * 1.3]; });   // 면: 중심 · 기울기
  const pores = Array.from({ length: opt.pores || 0 }, () => [(R() - 0.5) * 1.1, (R() - 0.5) * 1.1 * el]);
  const ca = Math.cos(rot), sa = Math.sin(rot), rp = ([x, y]) => [x * ca - y * sa, x * sa + y * ca];
  const P = pts.map(rp), F = fac.map(([x, y, nx, ny]) => [...rp([x, y]), ...rp([nx, ny])]), PO = pores.map(rp);
  const pb = new PB(size + 2, size + 2), c0 = (size + 2) / 2, sc = size / 2;
  for (let yy = 0; yy < size + 2; yy++) for (let xx = 0; xx < size + 2; xx++) {
    const x = (xx + 0.5 - c0) / sc, y = (yy + 0.5 - c0) / sc;
    let ins = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; }
    if (!ins) continue;
    let b1 = 9, b2 = 9, f = F[0]; for (const q of F) { const d = (x - q[0]) ** 2 + (y - q[1]) ** 2; if (d < b1) { b2 = b1; b1 = d; f = q; } else if (d < b2) b2 = d; }
    const nz = Math.sqrt(Math.max(0.1, 1 - f[2] * f[2] - f[3] * f[3]));
    let v = clamp((-0.55 * f[2] - 0.65 * f[3] + 0.5 * nz) * 0.75 + 0.42, 0, 1) - Math.hypot(x, y) * 0.12;
    if (Math.sqrt(b2) - Math.sqrt(b1) < 0.12) v -= 0.12;   // 면 사이 모서리
    if (PO.some(([px, py]) => Math.abs(x - px) * sc < 0.55 && Math.abs(y - py) * sc < 0.55)) v = 0.02;   // 숨구멍
    pb.set(xx, yy, pal[clamp(Math.floor(v * pal.length), 0, pal.length - 1)]);
  }
  return selOut(pb, opt.out ?? 0.72).canvas();
}
const STONE_PAL = {
  basalt: ['#24201e', '#3a3532', '#55504a', '#77706a', '#9a938a'].map(c => mute(c)),
  scoria: ['#3a1e1a', '#5a2c24', '#7e3e30', '#a05a44', '#c07a5a'].map(c => mute(c)),   // 붉은 송이
  pale: ['#4a4642', '#68625c', '#8a837a', '#ada69c', '#d0c9be'].map(c => mute(c)),
};
// 삼다도 바람에 날리는 돌: 크기 · 모양 · 색이 제각각인 8가지 × 구르는 4칸
const PEBBLES = [['basalt', 8, 2], ['basalt', 7, 1], ['scoria', 7, 0], ['pale', 6, 0], ['basalt', 9, 3], ['scoria', 8, 1], ['basalt', 6, 1], ['pale', 8, 0]]
  .map(([pal, size, pores], i) => [0, 1, 2, 3].map(r => stoneSprite(301 + i * 17, size, STONE_PAL[pal], r * Math.PI / 2, { pores })));

const TEWAK = [0, 1, 2, 3].map(k => {
  const pb = new PB(12, 12);
  pb.ellipse(6, 6, 4.8, 4.8, (nx, ny, x, y) => {
    const a = Math.atan2(ny, nx) + k * Math.PI / 4;
    const band = Math.abs(Math.sin(a)) < 0.25;
    return band ? rampPick([C.cloth[1], C.cloth[2], C.cloth[3]], sphereLight(nx, ny), x, y, 0.3) : rampPick(C.org.slice(1), sphereLight(nx, ny), x, y, 0.4);
  });
  return selOut(pb).canvas();
});

// 먼지 뭉게 (크기별) — 점 하나가 아니라 셰이딩된 덩어리
const PUFFS = [1.2, 1.8, 2.5, 3.2, 4].map(r => {
  const n = Math.ceil(r * 2) + 2, pb = new PB(n, n);
  pb.ellipse(n / 2, n / 2, r, r, (nx, ny, x, y) => rampPick(['#b89a80', '#dcc4a8', '#f4e8d6'], sphereLight(nx, ny), x, y, 0.3));
  return pb.canvas();
});
const SMOKE = [1.5, 2.5, 3.5, 4.5, 6].map(r => {
  const n = Math.ceil(r * 2) + 2, pb = new PB(n, n);
  pb.ellipse(n / 2, n / 2, r, r, (nx, ny, x, y) => rampPick(['#3a2a36', '#5a4652', '#7a6670'], sphereLight(nx, ny), x, y, 0.35));
  return pb.canvas();
});
// 반짝이 (십자 별)
const SPARK = [0, 1, 2].map(k => {
  const pb = new PB(7, 7), c = ['#ffffff', C.yel[3], C.yel[2]][k];
  const r = 3 - k;
  for (let i = -r; i <= r; i++) { pb.set(3 + i, 3, c); pb.set(3, 3 + i, c); }
  if (k === 0) { pb.set(2, 2, c); pb.set(4, 4, c); pb.set(2, 4, c); pb.set(4, 2, c); }
  return pb.canvas();
});

const TEWAK_BACK = (() => {
  // 실제 테왁처럼: 큰 주황 공 + 흰 밧줄 띠 (그물 무늬 대신)
  const pb = new PB(18, 18);
  pb.ellipse(9, 9, 7.6, 7.2, (nx, ny) => {
    const v = sphereLight(nx, ny);
    let c = v < 0.36 ? C.org[0] : v < 0.56 ? C.org[1] : v < 0.8 ? C.org[2] : C.org[3];
    const rope = Math.abs(nx + 0.22 * ny) < 0.10 || Math.abs(ny - 0.16 * nx) < 0.08;
    if (rope) c = v > 0.5 ? '#f4f0e6' : '#bcb8b0';
    return c;
  });
  return selOut(pb).canvas();
})();

// ── 관광객 캐리어 (혼저옵서예~) ──
function suitcaseSprite(col, big) {
  const w = big ? 18 : 14, h = big ? 22 : 17, pb = new PB(w + 2, h + 6);
  const R = muteAll([mix(col, '#000000', 0.45), mix(col, '#000000', 0.2), col, mix(col, '#ffffff', 0.35)]);
  // 손잡이
  pb.rect(4, 0, w - 6, 1, '#4a4a56'); pb.rect(4, 0, 1, 4, '#4a4a56'); pb.rect(w - 3, 0, 1, 4, '#4a4a56');
  for (let y = 4; y < h + 2; y++) for (let x = 1; x <= w; x++) {
    if ((y === 4 || y === h + 1) && (x === 1 || x === w)) continue;
    let c = x <= 2 ? R[3] : x >= w - 1 ? R[1] : R[2];
    if ((x - 1) % 4 === 0 && x > 2 && x < w - 1) c = R[1];            // 세로 골
    if (y === 4) c = R[3];
    pb.set(x, y, c);
  }
  // 수하물 태그 + 바퀴
  pb.rect(w - 4, 7, 3, 4, '#f4f0e0'); pb.set(w - 3, 8, '#e8403a');
  pb.rect(2, h + 2, 3, 2, '#2a2a32'); pb.rect(w - 4, h + 2, 3, 2, '#2a2a32');
  return selOut(pb).canvas();
}
const SUITCASES = [['#756754', false], ['#59675e', false], ['#8b7451', true], ['#665b54', false], ['#b2a58c', true]].map(([c, b]) => { const s = suitcaseSprite(c, b); return { r: s, l: flipC(s), big: b }; });

// ── 제주 흑돼지 (똥돼지) ──
function pigPose(t) {
  const pb = new PB(30, 20), K = muteAll(['#25211f', '#39332e', '#51483e', '#716351']);
  const bob = [0, -1, 0, -1][Math.round(t / (Math.PI / 2)) % 4];
  const legs = [[19, 0], [16, 0.5], [9, 0.25], [6, 0.75]];
  for (const [lx, ph] of legs) { const a = Math.sin(t + ph * 6.28) * 30; const [fx, fy] = limbEnd(lx, 12 + bob, 5, a); pb.limb(lx, 12 + bob, fx, fy, 2, K[1]); pb.rect(Math.round(fx) - 1, Math.round(fy), 3, 1, K[0]); }
  pb.ellipse(13, 9 + bob, 10, 5.4, (nx, ny) => { const v = sphereLight(nx, ny); return v < 0.35 ? K[0] : v < 0.6 ? K[1] : v < 0.85 ? K[2] : K[3]; });
  pb.ellipse(23, 8 + bob, 4.6, 3.2, (nx, ny) => { const v = sphereLight(nx, ny); return v < 0.4 ? K[1] : v < 0.75 ? K[2] : K[3]; });
  pb.rect(26, 8 + bob, 3, 3, K[2]); pb.set(27, 9 + bob, '#5a2a2a'); pb.set(28, 9 + bob, '#5a2a2a');   // 코
  pb.set(24, 7 + bob, K[0]);                                                      // 눈
  pb.set(21, 3 + bob, K[2]); pb.set(22, 4 + bob, K[3]);                                                          // 귀
  pb.set(3, 6 + bob, K[2]); pb.set(2, 5 + bob, K[2]); pb.set(2, 4 + bob, K[3]);                                  // 꼬리
  for (let y = 0; y < pb.h; y++) for (let x = 0; x < pb.w; x++) if (pb.get(x, y) && !pb.get(x, y - 1)) pb.set(x, y, mix(pb.get(x, y), C.cloth[2], 0.35));   // 등선 하이라이트
  return framePair(selOut(pb, 0.7), 15, 18);
}
const PIG = Array.from({ length: 4 }, (_, i) => litPair(() => pigPose(i / 4 * Math.PI * 2)));

// ── 갈매기 (새우깡 노리는 우도 갈매기) ──
function gullPose(up) {
  const pb = new PB(18, 12), Wh = muteAll(['#8a90a0', '#c8ccd6', '#eef0f4', '#ffffff']);
  pb.ellipse(9, 7, 4.6, 2.6, (nx, ny) => { const v = sphereLight(nx, ny); return v < 0.4 ? Wh[1] : v < 0.75 ? Wh[2] : Wh[3]; });
  pb.ellipse(13, 6, 2, 1.6, (nx, ny) => sphereLight(nx, ny) < 0.5 ? Wh[2] : Wh[3]);
  pb.rect(15, 6, 2, 1, mute('#f2b43a')); pb.set(14, 5, INK);
  pb.rect(3, 7, 3, 1, Wh[1]); pb.set(2, 6, Wh[0]);
  const wy = up ? -1 : 1;
  for (let i = 0; i < 7; i++) { const x = 6 + i, y = 6 + wy * Math.round((i < 3 ? i : 6 - i) * (up ? 1.3 : 0.6)); pb.set(x, y + (up ? -1 : 1), i > 4 ? Wh[0] : Wh[1]); pb.set(x, y + (up ? 0 : 2), Wh[1]); }
  return framePair(selOut(pb, 0.7), 9, 8);
}
const GULL = [gullPose(true), gullPose(false)];

// ── 렌터카 ('허' 번호판의 하얀 소형차) ──
const RENTCAR = (() => {
  const pb = new PB(32, 18), Wc = muteAll(['#8a90a0', '#c8ccd6', '#e8eaf0', '#ffffff']);
  for (let y = 7; y < 14; y++) for (let x = 1; x < 31; x++) { if ((y === 7 && (x < 3 || x > 28))) continue; pb.set(x, y, y < 9 ? Wc[3] : y > 12 ? Wc[0] : x > 27 ? Wc[1] : Wc[2]); }
  for (let y = 2; y < 8; y++) for (let x = 8 + (7 - y); x < 24 - Math.max(0, 4 - y); x++) pb.set(x, y, y === 2 ? Wc[2] : Wc[3]);
  for (let y = 3; y < 7; y++) { for (let x = 11 + (6 - y); x < 16; x++) pb.set(x, y, mute('#5a8ac8')); for (let x = 17; x < 22 - Math.max(0, 4 - y); x++) pb.set(x, y, mute('#4a7ab8')); }
  pb.rect(28, 9, 2, 2, mute('#fff0a0')); pb.rect(1, 9, 2, 2, mute('#e8403a'));
  pb.rect(13, 11, 6, 2, '#ffffff'); pb.set(14, 11, INK); pb.set(15, 12, INK); pb.set(17, 11, INK);   // '허' 번호판 흉내
  for (const wx of [7, 24]) pb.ellipse(wx, 14, 3, 3, (nx, ny) => Math.hypot(nx, ny) < 0.45 ? '#9aa0ac' : '#22222a');
  const c = selOut(pb, 0.7).canvas();
  return { r: c, l: flipC(c) };
})();

// ── 말 글자 탄환: 말풍선 없이 글자 자체가 날아옴 (두꺼운 테두리 + 아래 그림자) ──
const wordCache = new Map();
function wordSprite(str, kind) {
  const key = str + '|' + kind;
  if (wordCache.has(key)) return wordCache.get(key);
  const col = kind === 'rap' ? C.yel[3] : kind === 'big' ? C.red[3] : kind === 'kind' ? mute('#b8e08a') : mute('#f6ecdc');
  const edge = INK;   // 화면 위 글자는 모두 1px 먹선 (UI 키트와 같은 규칙)
  const t = textSprite(str, { font: 'b', color: col, outline: null });
  const w = t.width, h = t.height, src = t.getContext('2d').getImageData(0, 0, w, h).data;
  const on = (i, j) => i >= 0 && j >= 0 && i < w && j < h && src[(j * w + i) * 4 + 3] > 0;
  const pb = new PB(w + 4, h + 6);
  for (let j = -2; j < h + 4; j++) for (let i = -2; i < w + 2; i++) {
    let ring = false, sh = false;
    for (let dy = -1; dy <= 1 && !ring; dy++) for (let dx = -1; dx <= 1; dx++) if (Math.abs(dx) + Math.abs(dy) <= 1 && on(i + dx, j + dy)) { ring = true; break; }
    if (!ring) for (let dx = 0; dx <= 0; dx++) if (on(i + dx, j - 2)) sh = true;
    if (ring) pb.set(i + 2, j + 2, edge); else if (sh) pb.set(i + 2, j + 2, mix(edge, '#000000', 0.4));
  }
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (on(i, j)) pb.set(i + 2, j + 2, j > h - 3 ? mix(col, edge, 0.2) : col);
  const c = pb.canvas(); c.bodyH = c.height;
  wordCache.set(key, c);
  return c;
}
