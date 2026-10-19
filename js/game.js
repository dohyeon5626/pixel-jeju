// ─────────────────────────────────────────────────────────────
//  픽셀 제주 — ᄒᆞᆫ저 피ᄒᆞᆸ서!
//  제주 밈 피하기: 끝없이 쏟아지는 밈 패턴 · 점수가 오르면 배속 · WOW · 등급
//  조작: 이동 · 점프(3단, 공중제비) · 구르기(앞부분 무적) · 귤 던지기 · 밟기
// ─────────────────────────────────────────────────────────────
'use strict';

const cv = document.getElementById('game');
let g = cv.getContext('2d');
const MAIN_G = g;
const PIXEL2 = { bg: false, act: false };
// 인물 · 장애물을 따로 그린 뒤 시간대 빛으로 한 번에 물들여 배경과 같은 그림이 되게
const ACT_C = mk(W, H), ACT_G = ACT_C.getContext('2d'), ACT_M = mk(W, H), ACT_MG = ACT_M.getContext('2d'), RIM_C = mk(W, H), RIM_G = RIM_C.getContext('2d');
// 바다 물보라 · 반짝임도 시간대 빛을 받게
// 뉴스 · 컷인 UI 색도 같은 채도로 (캐시)
const _mu = new Map();
function MU(c) { let v = _mu.get(c); if (!v) { v = mute(c, 0.7); _mu.set(c, v); } return v; }
let _foamK = '', _foamV = '';
function FOAM() { const t = actorTint(); if (t !== _foamK) { _foamK = t; _foamV = mix(mute('#f5faff'), t, 0.6); } return _foamV; }
function actorTint() {
  if (themeCfg().indoor) return '#fff0de';   // 동굴 안: 시간대와 상관없이 등불빛
  const ph = clamp(G.phase, 0, PHASES.length - 1), a = Math.floor(ph), b = Math.min(PHASES.length - 1, a + 1), t = ph - a;
  const ta = PHASES[a].tint || '#ffffff', tb = PHASES[b].tint || '#ffffff';
  return mix('#ffffff', mix(ta, tb, t), 0.6);
}
g.imageSmoothingEnabled = false;
const lightCv = mk(W, H), lg = lightCv.getContext('2d'); lg.imageSmoothingEnabled = false;

// ── 조작감 상수 ──────────────────────────────────────────────
const STEP = 1 / 120;
const AIR_JUMPS = 2; // 공중 점프 2번 = 3단 점프
const GRAV = 860, JUMP_V = 410, DJUMP_V = 300, JUMP_CUT = 0.52, MAX_FALL = 470;   // 첫 점프 꼭대기 약 100px, 3단은 천장 근처
const SPEED = 94, ACCEL = 1150, AIR_ACCEL = 760, FRICTION = 1500, AIR_FRICTION = 320;
const ROLL_T = 0.34, ROLL_CD = 0.36, ROLL_V = 210, COYOTE = 0.09, BUFFER = 0.13;
const THROW_CD = 0.24, AMMO_MAX = 30;
const NONE = [];

const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const approach = (v, t, d) => v < t ? Math.min(v + d, t) : Math.max(v - d, t);
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeBack = t => { t = clamp(t, 0, 1); const s = 1.7; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };
const HALLABONG_FAKE = (() => { const c = mk(HALLABONG.width, HALLABONG.height), x = c.getContext('2d'); x.drawImage(HALLABONG, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(90,120,40,0.45)'; x.fillRect(0, 0, c.width, c.height); return c; })();
const DARK_TEX = (() => {   // 정전 어둠: 숨비 둘레만 보임 · 2px 칸 6계단 고리 (픽셀 그림체와 같게)
  const c = mk(W * 2 + 40, H * 2 + 40), x = c.getContext('2d'), cw = c.width, ch = c.height, cx = cw / 2, cy = ch / 2, id = x.createImageData(cw, ch), u = new Uint32Array(id.data.buffer);
  for (let y = 0; y < ch; y += 2) for (let i = 0; i < cw; i += 2) {
    const t = clamp((Math.hypot(i + 1 - cx, y + 1 - cy) - 26) / 64, 0, 1), a = Math.round(Math.round(t * 6) / 6 * 0.88 * 255); if (!a) continue;
    const v = (a << 24 | 16 << 16 | 6 << 8 | 6) >>> 0; u[y * cw + i] = v; u[y * cw + i + 1] = v; if (y + 1 < ch) { u[(y + 1) * cw + i] = v; u[(y + 1) * cw + i + 1] = v; }
  }
  x.putImageData(id, 0, 0); return c;
})();
const TOUCH = matchMedia('(pointer: coarse)');
const silOf = (img, col = '#ffffff') => { const k = '_sil' + col; return img[k] || (img[k] = silhouette(img, col)); };

// ── 사투리 ───────────────────────────────────────────────────
const PHRASES = [
  { t: '뭐랭ᄒᆞ멘!', m: '뭐라고 하는 거니!' }, { t: '무사?!', m: '왜?!' }, { t: '게메!', m: '글쎄!' },
  { t: '속솜ᄒᆞ라!', m: '조용히 해라!' }, { t: '재게재게!', m: '빨리빨리!' }, { t: 'ᄒᆞᆫ저옵서예~', m: '어서 오세요~' },
  { t: '어디 감서?', m: '어디 가니?' }, { t: '몽캐지 말라!', m: '꾸물거리지 마라!' }, { t: '이디 와보라!', m: '여기 와 봐라!' },
  { t: '기여?', m: '그래?' }, { t: '놀멍 쉬멍', m: '놀면서 쉬면서' }, { t: '왕 봅서!', m: '와서 보세요!' },
  { t: '폭싹 속았수다!!', m: '정말 수고 많으셨습니다!' }, { t: '하영 먹읍서~', m: '많이 드세요~' }, { t: '경 ᄒᆞ지 맙서!!', m: '그렇게 하지 마세요!!' },
];

// ── 입력 ─────────────────────────────────────────────────────
const held = {}, pressed = {};
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'jump',
  ArrowDown: 'down', KeyS: 'down', ShiftLeft: 'roll', ShiftRight: 'roll', KeyX: 'roll',
  KeyC: 'throw', KeyJ: 'throw', KeyF: 'throw',
  KeyP: 'pause', Escape: 'pause', Enter: 'start', KeyM: 'mute', KeyR: 'retry', KeyQ: 'quit',
};
const holders = {};
function press(k, src = 'x') { const s = holders[k] || (holders[k] = new Set()); if (!s.size) pressed[k] = true; s.add(src); held[k] = true; }
function release(k, src = 'x') { const s = holders[k]; if (!s) return; s.delete(src); held[k] = s.size > 0; }
function releaseAll() { for (const k in holders) holders[k].clear(); for (const k in held) held[k] = false; }
function tap(k) { pressed[k] = true; }
const GAME_KEYS = ['jump', 'roll', 'throw', 'down'];
window.addEventListener('keydown', e => {
  const k = KEYMAP[e.code]; if (!k) return;
  e.preventDefault(); Sound.init();
  if (state === 'over' && e.code === 'KeyS') { if (!e.repeat) shareResult(); return; }
  if (state === 'title' && mapView) { if (!e.repeat) { if (e.code === 'ArrowLeft' || e.code === 'KeyA') mapGo(-1, 0); else if (e.code === 'ArrowRight' || e.code === 'KeyD') mapGo(1, 0); else if (e.code === 'ArrowUp' || e.code === 'KeyW') mapGo(0, -1); else if (e.code === 'ArrowDown' || e.code === 'KeyS') mapGo(0, 1); else if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyZ' || e.code === 'KeyP') mapClose(); } return; }
  if (state === 'title' && !(G && G.go) && !howto && !dexView && (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'KeyA' || e.code === 'KeyD')) { if (!e.repeat) cycleScarf(e.code === 'ArrowLeft' || e.code === 'KeyA' ? -1 : 1); return; }
  if (state === 'title' && !(G && G.go) && !e.repeat && !howto && !dexView && (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'KeyW' || e.code === 'KeyS')) { menuSel = (menuSel + (e.code === 'ArrowUp' || e.code === 'KeyW' ? 5 : 1)) % 6; Sound.sfx.select(); return; }
  // 도감 · 조작법: ↑(W)는 점프(=연습 시작)가 아니라 고르기 — 도감에선 한 줄 위로, 조작법에선 무시 (연습은 Space · Z · C · Enter)
  if (state === 'title' && !(G && G.go) && (dexView || howto) && (e.code === 'ArrowUp' || e.code === 'KeyW')) { if (dexView && !e.repeat) { const n = Object.keys(PATTERNS).length; dexSel = (dexSel + n - 5) % n; Sound.sfx.select(); } return; }
  if (!e.repeat || (!held[k] && (k === 'left' || k === 'right'))) press(k, e.code);
});
window.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) release(k, e.code); });
window.addEventListener('blur', () => { releaseAll(); if (state === 'play' && !P.dead) setPause(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { releaseAll(); if (state === 'play' && !P.dead) setPause(true); Sound.stopMusic(); Sound.ambience('rain', 0); Sound.suspend(); } else Sound.resume(); });
for (const ev of ['pointerup', 'touchend', 'click']) window.addEventListener(ev, () => Sound.init(), { capture: true, passive: true });   // iOS 소리 잠금 풀기
document.querySelectorAll('[data-key]').forEach(btn => {
  const k = btn.dataset.key;
  const oneShot = k === 'pause' || k === 'mute';
  const pids = new Set(); btn._pids = pids;
  const down = e => { e.preventDefault(); Sound.init(); if (oneShot) { tap(k); return; } try { btn.setPointerCapture(e.pointerId); } catch (_) { /* 무시 */ } pids.add(e.pointerId); press(k, 'p' + e.pointerId); btn.classList.add('on'); };
  const up = e => { if (oneShot || !pids.has(e.pointerId)) return; pids.delete(e.pointerId); release(k, 'p' + e.pointerId); if (!pids.size) btn.classList.remove('on'); };
  window.addEventListener('blur', () => { pids.clear(); btn.classList.remove('on'); });
  btn.addEventListener('pointerdown', down); btn._down = down;
  if (k === 'left' || k === 'right') btn.addEventListener('pointermove', e => {
    if (!pids.has(e.pointerId)) return;
    const el = document.elementFromPoint(e.clientX, e.clientY), o = el && el.closest('.lr [data-key]');
    if (!o || o === btn || !o._down) return;
    up(e); try { btn.releasePointerCapture(e.pointerId); } catch (_) { /* 무시 */ } o._down(e);
  });
  btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up); btn.addEventListener('lostpointercapture', up);
  btn.addEventListener('contextmenu', e => e.preventDefault());
});
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); Sound.init();
  if (state === 'title') {
    if (G && G.go) return;
    const r = cv.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W, py = (e.clientY - r.top) / r.height * H;
    if (dexView) {   // 칸을 한 번 누르면 고르기, 고른 칸을 한 번 더 누르면 연습 · 맨 아래 줄을 누르면 닫기
      const keys = Object.keys(PATTERNS), c = Math.floor((px - 13) / 80), rr = Math.floor((py - 26) / 36), i = rr * 5 + c, inTile = px - 13 - c * 80 < 77 && py - 26 - rr * 36 < 33;
      if (py > H - 26) { dexView = false; Sound.sfx.select(); return; }
      if (inTile && c >= 0 && c < 5 && rr >= 0 && i < keys.length) { if (i === dexSel && SEEN[keys[i]]) tap('start'); else { dexSel = i; Sound.sfx.select(); } }
      return;
    }
    if (mapView) { if (py < 30 || py > H - 40) mapClose(); else if (px < W * 0.3) mapGo(-1, 0); else if (px > W * 0.7) mapGo(1, 0); else mapGo(0, 1); return; }
    if (howto) { tap('start'); return; }
    if (px > W - 158 && px < W - 6 && py > 124 && py < 140) { cycleScarf(1); return; }
    const inX = px > 48 && px < 52 + menuW, row = Math.floor((py - 103) / 14);
    if (inX && row >= 0 && row < 6) { menuSel = row; tap('start'); }
  } else if (state === 'over') { const r = cv.getBoundingClientRect(); tap((e.clientY - r.top) / r.height > 0.9 ? 'pause' : 'start'); }
  else if (state === 'pause') { const r = cv.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W, py = (e.clientY - r.top) / r.height * H; tap(py > 192 && Math.abs(px - W / 2) < 30 ? 'quit' : 'pause'); }
  else if (state === 'play') {
    const r = cv.getBoundingClientRect();
    if ((e.clientY - r.top) / r.height < 0.22) { tap('pause'); return; }
    if (G && G.choice) { pickUpgrade((e.clientX - r.left) / r.width < 0.5 ? 0 : 1); return; }
  }
});
cv.addEventListener('contextmenu', e => e.preventDefault());

// ── 상태 ─────────────────────────────────────────────────────
let state = 'loading', G = null, P = null, B = null, acc = 0, titleT = 0, firstRun = true, menuSel = 0, howto = false, dexView = false, dexSel = 0, practiceKind = null, mapView = null;
// 명소 구경: 게임 배경을 장소 · 시간대별로 둘러봄
const PLACES = [['field', '구좌 밭담길'], ['grove', '서귀포 귤밭'], ['coast', '성산 일출봉'], ['iho', '이호테우 해변'], ['beach', '협재 해변'], ['jeongbang', '정방폭포'], ['cheonji', '천지연폭포'], ['cave', '만장굴']];
const PHASE_NAME = ['낮', '오후', '노을', '밤'];
function mapGo(di, dp) { const m = mapView; m.i = (m.i + di + PLACES.length) % PLACES.length; m.ph = (m.ph + dp + 4) % 4; useTheme(PLACES[m.i][0]); G.phase = G.phaseTarget = m.ph; if (di) m.fact = placeFact(PLACES[m.i][0]); Sound.sfx.select(); }
function mapOpen() { mapView = { i: 0, ph: 0, t: 0, px: P.x }; P.x = -80; mapGo(0, 0); mapView.fact = placeFact('field'); }
function mapClose() { if (mapView) P.x = mapView.px; mapView = null; useTheme('field'); G.phase = G.phaseTarget = 0; Sound.sfx.select(); }
// ── 제주 일주: 여덟 구간을 돌며 구간마다 보스를 넘음 · 한라산 다음은 다시 구좌부터 더 빠르게 ──
const ROUTE = [
  { name: '구좌', tier: 0, pool: ['rise', 'hop', 'harvest', 'parcel', 'suitcase'], boss: 'halmang' },
  { name: '서귀포 귤밭', tier: 0, theme: 'grove', pool: ['harvest', 'rise', 'pig', 'hop', 'bee'], boss: 'knife' },
  { name: '성산', tier: 1, pool: ['gull', 'dolphin', 'plane', 'dialect', 'bee'], boss: 'murang' },
  { name: '이호테우', tier: 1, theme: 'iho', pool: ['gull', 'pony', 'dialect', 'suitcase', 'dolphin'], boss: 'halmang' },
  { name: '천지연', tier: 2, theme: 'cheonji', pool: ['wind', 'rise', 'dialect', 'crow', 'bee'], boss: 'seolmun' },
  { name: '협재', tier: 2, pool: ['wind', 'pony', 'dialect', 'car', 'pig'], boss: 'knife' },
  { name: '정방폭포', tier: 2, theme: 'jeongbang', pool: ['gull', 'wind', 'typhoon', 'dialect', 'glider'], boss: 'murang' },
  { name: '한라산', tier: 3, pool: ['meteor', 'crow', 'glider', 'typhoon', 'dialect'], boss: 'halmang' },
];
let routeRec = { best: 0 };   // 일주에서 가장 멀리 간 구간 수 (바퀴 × 구간 수 + 구간)
try { const v = JSON.parse(localStorage.getItem('jeju.route.v3')); if (v && typeof v === 'object') routeRec = { best: clamp(v.best | 0, 0, 999) }; } catch (e) { /* 무시 */ }
let routeStart = false;
// 구간마다 하나씩 붙는 변형 규칙 (같은 길이라도 매번 다르게)
const ROUTE_MODS = [
  { id: 'wind', t: '강풍', tick: () => { if (!B) G.windTarget = (G.route.windDir || 1) * 30; } },
  { id: 'tang', t: '귤 풍년', tick: () => { G.nextTang -= 0.5 / 120; } },
  { id: 'dark', t: '정전', tick: () => { if (!B) G.dark = Math.max(G.dark, 0.28); } },
  { id: 'none', t: '', tick: () => {} },
];
// 구간 들어갈 때: 구간 원래 테마(단계)는 그대로, 역주행이면 속도만 더 올림
function routeLegSetup() { const L = G.route.legs[G.route.leg], lap = G.route.lap || 0; applyTier(L.tier, true); if (L.theme) useTheme(L.theme); G.spotName = L.name; if (lap) { G.speed = Math.min(2.8, G.speed + 0.3 * lap); G.diffFloor = 1.2 * lap + 0.3 * G.route.leg; } /* 바퀴를 돌수록 빨라지고 어려워짐 */ G.music = { style: 'chip', song: runSong(), tempo: 138 * G.speed }; Sound.startMusic(G.music); Sound.setTempo(G.music.tempo); }
function routeMod() { if (!G.route) return; G.windTarget = 0; G.dark = 0; G.route.mod = G.route.leg === 0 ? ROUTE_MODS[3] : pick(ROUTE_MODS.slice(0, 3)); G.route.windDir = pick([-1, 1]); }
// ── 제주 한 줄: 게임을 하며 제주를 알아 가게 (결과 · 일시정지 화면) ──
const JEJU_FACTS = [
  { th: 'field', t: '한라산은 해발 1,947m, 남한에서 가장 높은 산' },
  { th: 'field', t: '제주에는 작은 화산인 오름이 360여 개' },
  { th: 'field', t: '밭담: 현무암을 쌓은 돌담, 세계중요농업유산' },
  { th: 'field', t: '돌하르방: 옛 읍성 성문 앞을 지키던 제주의 석상' },
  { th: 'field', t: '감귤은 제주를 대표하는 과일 · 겨울이 제철' },
  { th: 'coast', t: '성산일출봉: 얕은 바다 화산 폭발로 생긴 세계자연유산' },
  { th: 'coast', t: '제주해녀문화는 유네스코 인류무형문화유산' },
  { th: 'coast', t: '남방큰돌고래는 제주 바다 가까이 사는 돌고래' },
  { th: 'coast', t: '불턱: 해녀들이 물질 뒤 불을 쬐던 돌담 쉼터' },
  { th: 'beach', t: '협재 바다 너머 보이는 섬이 비양도' },
  { th: 'beach', t: '삼다도: 돌 · 바람 · 여자가 많다는 제주의 별칭' },
  { th: 'beach', t: '제주어는 유네스코 지정 소멸위기 언어' },
  { th: 'iho', t: '이호테우 해변: 말 모양 빨간 · 하얀 등대로 유명' },
  { th: 'iho', t: '테우: 통나무를 엮어 만든 제주의 전통 뗏목' },
  { th: 'iho', t: '등대 주변 콘크리트 블록은 파도를 막는 테트라포드' },
  { th: 'grove', t: '귤밭 둘레 삼나무 방풍림이 거센 바람을 막아 줌' },
  { th: 'grove', t: '감귤은 따뜻한 서귀포 쪽 남쪽 땅에서 많이 자람' },
  { th: 'grove', t: '귤밭에도 현무암 돌담: 바람 막고 돌도 치우고' },
  { th: 'cave', t: '만장굴: 길이 약 7.4km의 용암동굴' },
  { th: 'cave', t: '만장굴 용암석주: 높이 약 7.6m, 천장에서 흘러내린 용암' },
  { th: 'cave', t: '용암동굴: 겉이 먼저 굳고 속 용암이 빠져나가 생긴 굴' },
  { th: 'jeongbang', t: '정방폭포: 물줄기가 바다로 곧장 떨어지는 폭포' },
  { th: 'jeongbang', t: '정방폭포 앞바다에 떠 있는 숲 섬이 섶섬' },
  { th: 'cheonji', t: '천지연폭포: 높이 약 22m, 서귀포의 폭포' },
  { th: 'cheonji', t: '천지연 못은 천연기념물 무태장어 서식지' },
  { th: 'any', t: '주상절리: 용암이 식으며 갈라진 육각 · 오각 기둥' },
  { th: 'any', t: '설문대할망: 치마폭 흙으로 제주를 빚었다는 거인 여신' },
  { th: 'any', t: '만장굴 · 거문오름 용암동굴계도 세계자연유산' },
  { th: 'any', t: '제주 화산섬과 용암동굴: 2007년 세계자연유산' },
];
function placeFact(th) { const pool = JEJU_FACTS.filter(f => f.th === th); return pool.length ? pick(pool).t : jejuFact(); }
function jejuFact() { const th = THEME, pool = JEJU_FACTS.filter(f => f.th === th || f.th === 'any'); return pick(pool.length ? pool : JEJU_FACTS).t; }
// 연습 · 무적 · 일주 판은 무한 모드 기록 · 일일 보상에 남기지 않음 (일주 기록은 따로)
const noRecord = () => godMode || !!(G && (G.practice || G.route));   // 최고점 · 오늘 최고
let drawMetronome = () => {};   // 박자 표시는 다른 판보다 위에 (보스 스킬 이름에 가리지 않게)
const noDaily = () => godMode || !!(G && G.practice);              // 일일 미션 · 연속 출석 · 특보 진주 (일주도 인정)
const amb = { t: 0, clouds: [], camX: 0 };
for (let i = 0; i < 6; i++) amb.clouds.push({ x: i * 80 + rand(0, 40), y: rand(-VOFF + 18, 50), k: i % 4, v: rand(2, 5) });
// 무적 모드: 맞아도 안 다침. 기록 · 과제 · 별 · 진주는 쌓이지 않음 (연습 · 구경용)
let godMode = false;
try { godMode = sessionStorage.getItem('jeju.god') === '1'; } catch (e) { /* 무시 */ }   // 세션 동안만 (켜 둔 걸 잊고 다음 날 기록이 막히지 않게)
function toggleGod() { godMode = !godMode; try { sessionStorage.setItem('jeju.god', godMode ? '1' : '0'); } catch (e) { /* 무시 */ } Sound.sfx.select(); }
let best = { score: 0 };
try { const v = JSON.parse(localStorage.getItem('jeju.best2')); if (v && Number.isFinite(v.score)) best = { score: v.score }; } catch (e) { /* 무시 */ }
// 용어 도감: 한 번이라도 만난 밈 (NEW 표시는 처음 만났을 때만)
let SEEN = {};
try { const v = JSON.parse(localStorage.getItem('jeju.seen')); SEEN = v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).filter(([, n]) => n === true || (n >= 1 && n <= 2))) : {}; } catch (e) { /* 무시 */ }
// 오늘의 물질 (일일 과제): 날짜로 3개를 고르고, 끝낼 때마다 진주 +1
const MISSIONS = [
  { id: 'bee', t: '벌 10마리 잡기', n: 10 }, { id: 'near', t: '아슬아슬 15번', n: 15 }, { id: 'wow3', t: 'WOW 3연속', n: 3 },
  { id: 'stomp', t: '머리 밟기 20번', n: 20 }, { id: 'tier', t: '×1.30 속도까지', n: 1 }, { id: 'tang', t: '귤 30개 줍기', n: 30 },
  { id: 'event', t: '이벤트 2번 버티기', n: 2 }, { id: 'score', t: '한 판 3000점', n: 1 },
];
// 제주 기상특보: 날마다 하나, 나오는 밈 · 점수 · 귤이 달라짐. 특보 아래 5000점 첫 돌파 시 진주 +1
const WEATHER = [
  { id: 'typhoon', t: '태풍 특보', d: '바람 · 태풍 2배 · 점수 ×1.2', w: { wind: 2, typhoon: 2 }, mult: 1.2 },
  { id: 'harvest', t: '감귤 풍년', d: '귤이 두 배로 떨어짐', w: { harvest: 2, parcel: 2 }, tang: 2 },
  { id: 'flight', t: '참새 떼', d: '참새 떼 3배 · 점수 ×1.1', w: { plane: 3 }, mult: 1.1 },
  { id: 'peak', t: '관광 성수기', d: '캐리어·렌터카 2배 · 점수×1.1', w: { suitcase: 2, car: 2 }, mult: 1.1 },
  { id: 'bloom', t: '유채꽃 만개', d: '벌떼 2배 · 점수 ×1.1', w: { bee: 2 }, mult: 1.1 },
];
const wxFor = k => { let h = 0; for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) | 0; return WEATHER[Math.floor(rng(Math.abs(h) + 13)() * WEATHER.length)].id; };
const todayWx = () => (G && G.wx) || WEATHER.find(x => x.id === DAILY.wx) || WEATHER[0];
const realDay = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const todayKey = () => (typeof G !== 'undefined' && G && G.mode === 'run' && G.runDay) || realDay();   // 한 판 도중 자정을 넘어도 그 판은 시작한 날로
let DAILY = { d: '', m: [], p: [0, 0, 0], pearl: 0 };
try { const v = JSON.parse(localStorage.getItem('jeju.daily')); if (v && typeof v === 'object' && Array.isArray(v.m)) DAILY = { ...DAILY, ...v }; } catch (e) { /* 무시 */ }
// 깨진 저장값 정리: 미션 · 진행도 · 숫자 범위
{ const num = (v, lo, hi) => (Number.isFinite(+v) ? clamp(Math.floor(+v), lo, hi) : lo);
  if (!Array.isArray(DAILY.m) || DAILY.m.length !== 3 || !DAILY.m.every(id => typeof id === 'string')) { DAILY.m = []; DAILY.d = ''; }
  DAILY.p = Array.isArray(DAILY.p) && DAILY.p.length === 3 ? DAILY.p.map(v => num(v, 0, 9999)) : [0, 0, 0];
  DAILY.pearl = num(DAILY.pearl, 0, 9999); DAILY.scarf = num(DAILY.scarf, 0, 99); DAILY.streak = num(DAILY.streak, 0, 9999); DAILY.starPaid = num(DAILY.starPaid, 0, 999); DAILY.best = num(DAILY.best, 0, 1e9);
  if (typeof DAILY.d !== 'string') DAILY.d = ''; if (typeof DAILY.played !== 'string') DAILY.played = ''; }
function ensureDaily() {
  const k = todayKey();
  let h = 0; for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) | 0;
  if (DAILY.d === k && DAILY.m.length === 3 && new Set(DAILY.m).size === 3 && DAILY.m.every(id => MISSIONS.some(m => m.id === id))) { if (!DAILY.wx) { DAILY.wx = wxFor(k); saveDaily(); } return; }
  const R0 = rng(Math.abs(h) + 7), pool = MISSIONS.map(m => m.id);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(R0() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  DAILY = { d: k, m: pool.slice(0, 3), p: [0, 0, 0], pearl: DAILY.pearl || 0, scarf: DAILY.scarf | 0, starPaid: DAILY.starPaid | 0, wx: wxFor(k), wxDone: false, streak: DAILY.streak | 0, played: DAILY.played || '', best: 0 }; saveDaily();
}
const tomorrowWx = () => { const t = new Date(Date.now() + 864e5); return WEATHER.find(x => x.id === wxFor(`${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`)); };
function saveDaily() { try { localStorage.setItem('jeju.daily', JSON.stringify(DAILY)); } catch (e) { /* 무시 */ } }
function daily(id, k = 1, abs = false) {
  if (noDaily()) return;
  ensureDaily();
  DAILY.m.forEach((mid, i) => {
    if (mid !== id) return; const M = MISSIONS.find(q => q.id === mid); if (!M || DAILY.p[i] >= M.n) return;
    DAILY.p[i] = Math.min(M.n, abs ? Math.max(DAILY.p[i], k) : DAILY.p[i] + k);
    if (DAILY.p[i] >= M.n) { DAILY.pearl = (DAILY.pearl || 0) + 1; banner('물질 성공', `${M.t} · 진주 +1`, UI.gold); Sound.sfx.level(); }
    saveDaily();
  });
}
const starCount = () => Object.keys(PATTERNS).filter(k => SEEN[k] === 2).length;
// 처음으로 맞지 않고 통과한 밈에 별. 별 5개마다 진주 1개
function giveStar(kind) {
  if (noDaily()) return;
  if (SEEN[kind] === 2) return;
  SEEN[kind] = 2; try { localStorage.setItem('jeju.seen', JSON.stringify(SEEN)); } catch (e) { /* 무시 */ }
  const def = PATTERNS[kind], name = ((def.title && patLabel(kind)[0]) || (EVENTS[kind] && EVENTS[kind].name) || '제주어 퀴즈').replace(/[!~]/g, '');
  if (G.wowFx && G.wowFx.t < 0.5) G.wowFx.star = name; else banner(`★ ${name}`, '도감에 별', UI.gold);
  ensureDaily(); const due = Math.floor(starCount() / 5);
  if (due > (DAILY.starPaid || 0)) { const gain = due - (DAILY.starPaid || 0); DAILY.pearl = (DAILY.pearl || 0) + gain; DAILY.starPaid = due; saveDaily(); banner(`별 ${due * 5}개 달성!`, `진주 +${gain}`, UI.gold); }
}
const dexCount = () => Object.keys(PATTERNS).filter(k => SEEN[k]).length;

function newWorld() {
  return {
    t: 0, stage: 1, mode: 'intro', modeT: 0, diff: 0, arenaR: W - 8, arenaL: 8, up: {},
    phase: 0, phaseTarget: 0, hp: 7, maxHp: 7, ammo: 15, score: 0, combo: 0, comboT: 0, bestCombo: 0,
    dodges: 0, stomps: 0, hitsTaken: 0, stageHits: 0,
    hz: [], spawnQ: [], shots: [], pickups: [], fx: [], bgfx: [], pops: [], ghosts: [], lights: [], warnings: [], decals: [],
    patterns: [], rest: 1.6, lastKind: null, pendingPat: null, seen: {},
    wind: 0, windTarget: 0, volcano: { erupt: 0, glow: 0 },
    runDay: realDay(), trauma: 0, hitstop: 0, flash: 0, flashCol: '#ffffff', slow: 0, overT: 0, overAge: 0,
    ammoMax: AMMO_MAX,
    ended: [], tier: 0, speed: 1, patCount: 0, patInTier: 0, wow: 0, dark: 0, lightning: 0, card: null, wowFx: null, rapSub: null,
    nextTang: 3, banners: [], iris: null, info: null, hint: 0,
  };
}
function newPlayer() {
  return {
    x: 70, y: GROUND, vx: 0, vy: 0, face: 1, onGround: true, airJumps: AIR_JUMPS, rollT: 0, rollCD: 0, inv: 0, hurtT: 0,
    coyote: 0, buffer: 0, jumpCut: false, anim: 0, blinkT: 2, dead: false, dustT: 0, throwT: 0, throwCD: 0,
    flipT: 0, sx: 1, sy: 1, ghostT: 0, skidT: 0, landT: 0, spin: 0,
    scarf: Array.from({ length: 7 }, () => ({ x: 70, y: GROUND - 20, px: 70, py: GROUND - 20 })),
  };
}

// ── 이펙트 ───────────────────────────────────────────────────
function spawnHz(h) { if (G.curPat && !h.pat) h.pat = G.curPat; if (h.chain) { G.hz.push(h); return; } G.spawnQ.push(h); }   // 박에 맞춘 연쇄 공격은 대기 없이 바로
function playMusic(o) { G.music = o; Sound.startMusic(o); }
const NIGHT_SONG = { coast: 'nightsea', iho: 'nightsea', beach: 'stars', jeongbang: 'stars', cheonji: 'stars' };   // 밤에도 장소마다 다른 곡 (밭 · 귤밭은 달리는 단조)
function runSong() { const T = TIERS[G.tier] || TIERS[0], cfg = themeCfg(); return cfg.indoor ? cfg.song : T.phase >= 3 ? (NIGHT_SONG[THEME] || 'night') : cfg.song; }
// 화면 번쩍임: 0.33초에 한 번까지만, 약한 번쩍임이 센 번쩍임을 끊지 않게
function flashFx(t, col, force = false) { if (!force && amb.t < (G.flashCD || 0)) return; G.flashCD = amb.t + 0.33; if (force || t >= (G.flash || 0)) G.flashCol = col; G.flash = Math.max(G.flash || 0, t); }
function fx(o) { const p = Object.assign({ vx: 0, vy: 0, grav: 0, drag: 0, life: 0.5, size: 1, col: '#fff4e0', kind: 'px' }, o); p.max = p.life; if (p.kind === 'trail') p.col2 = mix(p.col, INK, 0.4); G.fx.push(p); return p; }
function burst(x, y, n, cols, spd = 60, life = 0.5, grav = 260, kind = 'px') {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = rand(spd * 0.3, spd);
    fx({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - spd * 0.4, grav, life: rand(life * 0.5, life), col: cols[i % cols.length], size: Math.random() < 0.35 ? 2 : 1, kind });
  }
}
function dust(x, y, n = 3, dir = 0, big = 0) {
  for (let i = 0; i < n; i++) fx({ x: x + rand(-3, 3), y: y - rand(1, 3), vx: dir * rand(15, 40) + rand(-14, 14), vy: rand(-22, -6), drag: 3, life: rand(0.3, 0.5), kind: 'puff', size: randi(1, 2) + big });
}
function juice(x, y, n = 8) { burst(x, y, n, [C.org[2], C.org[3], C.org[4], C.yel[3]], 90, 0.45, 420); }
function spark(x, y) { fx({ x, y, kind: 'spark', life: 0.18 }); }
function spawnArcFx(x, y) { fx({ x, y: y - 4, kind: 'flare', size: 4, life: 0.25, col: C.yel[3] }); }
// 큰 충격: 링 · 섬광 · 불씨 · 흙먼지 · 빛 · 흔들림을 한 번에
function impact(x, y, col = C.yel[3], power = 1, quiet = false) {
  fx({ x, y, kind: 'ring', big: true, life: 0.4, col });
  fx({ x, y, kind: 'ring', life: 0.28, col: '#fff4e0' });
  fx({ x, y: y - 4, kind: 'flare', size: Math.round(8 + 8 * power), life: 0.3, col });
  for (let i = 0; i < 12 * power; i++) { const a = rand(Math.PI, Math.PI * 2); fx({ x, y: y - 2, vx: Math.cos(a) * rand(40, 140), vy: Math.sin(a) * rand(70, 190), grav: 360, life: rand(0.45, 0.9), kind: 'ember' }); }
  dust(x, GROUND, Math.round(5 * power), 0, 2);
  if (!quiet) { light(x, y, 36 * power, col, 1); shake(0.18 * power); }
}
function popup(str, x, y, col = '#fff4e0', font = 's', big = false) { y = Math.max(y, -VOFF + 44); G.pops.push({ str, x, y, col, font, t: 0, big }); }
function shake(tr) { G.trauma = Math.min(1, G.trauma + tr); }
// 방향 있는 반동: 착지는 아래로, 피격은 맞은 반대쪽으로 화면이 짧게 튀었다 돌아옴 (최대 3px)
function kick(dx, dy) { G.kick = G.kick || { x: 0, y: 0 }; G.kick.x = clamp(G.kick.x + dx, -3, 3); G.kick.y = clamp(G.kick.y + dy, -3, 3); }
function hitstop(t, cd = 0) { if (cd) { if (amb.t < (G.hitstopCD || 0)) return; G.hitstopCD = amb.t + cd; } G.hitstop = Math.max(G.hitstop, t); }   // cd: 연달아 걸리지 않게 (가까운 낙하 · 착지 같은 작은 멈칫)
function light(x, y, r, col, a = 1) { G.lights.push({ x, y, r, col, a }); }
// 밈 카드나 이벤트 스킬 이름이 떠 있는 동안 새 배너는 기다렸다가 나옴 (겹치지 않게)
const bannerWait = () => !!(G.card || (G.skill && G.skill.t < (G.skill.hint ? 2.55 : 1.45)));
function banner(title, sub, col = C.yel[2], isNew = false) { G.banners.push({ title, sub, col, isNew, t: 0, dur: 2.2 }); }
// 피하는 법 안내처럼 바로 봐야 하는 배너: 줄 맨 앞(지금 떠 있는 배너 바로 다음)에 3초
function bannerNow(title, sub, col, isNew) { G.banners.splice(G.banners[0] && G.banners[0].t > 0 ? 1 : 0, 0, { title, sub, col, isNew, t: 0, dur: 3 }); }
function addScore(n, x, y) {
  const mult = (1 + Math.min(3, Math.floor(G.combo / 5)) * 0.5) * ((G.omegiT || 0) > 0 ? 2 : 1), v = Math.round(n * mult);
  G.score += v;
  if (x !== undefined) popup('+' + v, x, y, mult > 1 ? C.yel[3] : '#fff4e0');
}
// ── 구간 강화: 속도 단계가 오를 때마다 둘 중 하나를 고름 (판마다 다른 빌드) ──
const UPGRADES = [
  { id: 'hp', name: '해녀 폐활량', desc: '최대 체력 +1', ok: () => G.maxHp < 9, apply: () => { G.maxHp++; G.hp = Math.min(G.maxHp, G.hp + 1); } },
  { id: 'pound', name: '현무암 주먹', desc: '내려찍기 범위 넓게', ok: () => (G.up.pound || 0) < 3, apply: () => { G.up.pound = (G.up.pound || 0) + 1; } },
  { id: 'water', name: '삼다수 한 병', desc: '물방울 +1', ok: () => (G.water || 0) < 2, apply: () => { G.water = Math.min(2, (G.water || 0) + 1); G.waterSeen = true; } },
  { id: 'speed', name: '오름 다리', desc: '이동 속도 +8%', ok: () => (G.up.speed || 0) < 3, apply: () => { G.up.speed = (G.up.speed || 0) + 1; } },
  { id: 'shield', name: '테왁 방패', desc: '한 번 막아 줌', ok: () => !P.shield, apply: () => { P.shield = 1; } },
  { id: 'combo', name: '숨비소리', desc: '맞아도 콤보 절반 유지', ok: () => !G.up.combo, apply: () => { G.up.combo = 1; } },
];
function offerUpgrade() { if (G.hp < G.maxHp) G.hp++; /* 구간 돌파: 체력 1 회복 */ const pool = shuffled(UPGRADES.filter(u => u.ok())); if (!pool.length) { G.choseTier = G.tier + 1; giveAmmo(5); addScore(300, P.x, P.y - 30); banner('강화 완료', '다 갖춰서 귤 +5 · 점수 +300', UI.gold); return; } /* 고를 게 없으면 빈 선택창 대신 보상 (멈춤 방지) */ G.choice = { opts: pool.slice(0, 2), sel: 0, t: 0 }; Sound.sfx.card(); }
function pickUpgrade(i) { const c = G.choice; if (!c || c.t < 0.35 || P.dead || state !== 'play') return; const u = c.opts[i]; if (!u) return; u.apply(); G.choice = null; G.choseTier = G.tier + 1; Sound.sfx.level(); banner(u.name, u.desc, UI.gold); fx({ x: P.x, y: P.y - 14, kind: 'ring', big: true, life: 0.4, col: UI.gold }); }
// 귤을 30개 모으면 귤이 아이템 하나로 바뀌어 떨어지고 귤은 0개부터 다시
function giveAmmo(n) {
  const before = G.ammo; G.ammo = Math.min(G.ammoMax, G.ammo + n);
  if (before < G.ammoMax && G.ammo >= G.ammoMax && !P.dead) {
    const pool = ['water', 'omegi', 'pinwheel']; if (G.hp < G.maxHp) pool.push('bong', 'bong'); if (!P.shield) pool.push('shield');
    const p = new Pickup(pick(pool), clamp(P.x + rand(-30, 30), G.arenaL + 16, G.arenaR - 16), -VOFF - 10, 0, 40); p.life = 10; G.pickups.push(p);
    popup('귤 30개!', P.x, P.y - 34, C.yel[2], 'b'); Sound.sfx.level(); fx({ x: P.x, y: P.y - 14, kind: 'ring', big: true, life: 0.35, col: C.yel[3] }); G.ammoPulse = 0.5;
    G.ammo = 0; burst(P.x, P.y - 16, 14, [C.org[2], C.org[3], C.yel[3]], 90, 0.5, 260);   // 귤 30개가 아이템으로 바뀜 → 다시 0개부터
  }
}
const REWARDS = { stompKill: [100, 0], shotKill: [50, 0], shatter: [40, 0], bounce: [80, 0], dodge: [30, 0], bossHit: [20, 0], bigShatter: [300, 0] };   /* 귤은 귤을 먹어야만 찬다 */
function reward(kind, x, y, mult = 1) {
  const [sc, am] = REWARDS[kind];
  addScore(sc * mult, x, y); comboUp(x, y);
  if (am) giveAmmo(am);
}
// ── 박자: 음악 박자 시계 (소리가 없으면 템포로 자체 계산) ──
function beatNow() {   // 음악이 멈춰도 마지막 박에서 이어서 셈 (판정이 튀지 않게)
  const b = Sound.beat(), t = G.t || 0;
  if (b >= 0) { G.beatLast = b; G.beatLastT = t; return b; }
  return (G.beatLast || 0) + (t - (G.beatLastT || 0)) * (Sound.tempo || 138) / 60;
}
const beatFrac = () => { const b = beatNow(); return b - Math.floor(b); };
// 지금부터 d초(월드) 뒤 이후로 가장 가까운 박 머리까지의 시간 → 솟거나 떨어지는 순간이 박에 딱 맞게
function beatLead(d) { const bt = 60 / (Sound.tempo || 138) * G.speed, toBeat = (1 - beatFrac()) * bt; let n = Math.max(0, Math.round((d - toBeat) / bt)); while (toBeat + n * bt < d) n++; return toBeat + n * bt; }   // 가장 가까운 박 (예고가 너무 짧아지지 않게)
// 박자에 맞춘 동작: 박 머리 ±0.13박 안이면 「박자」 콤보 · 점수 배율
function onBeatAct(x, y, scoring = true) {
  const f = beatFrac(), win = clamp(0.075 / (60 / (Sound.tempo || 138)), 0.1, 0.25), hit = f < win || f > 1 - win;   // 약 ±75ms (빠른 단계에서도 너무 좁지 않게)
  if (!hit) return false;
  if ((G.t || 0) - (G.lastBeatActT ?? -9) < 0.6 * 60 / (Sound.tempo || 138)) return false;   // 한 박에 한 번만
  G.lastBeatActT = G.t || 0;
  G.beatCombo = (G.beatCombo || 0) + 1; G.beatComboT = 3; G.bestBeat = Math.max(G.bestBeat || 0, G.beatCombo);
  fx({ x, y, kind: 'ring', life: 0.22, col: C.teal[3] }); fx({ x, y: y - 2, kind: 'flare', size: 4, life: 0.12, col: C.teal[4] });
  if (scoring) G.score += 5 * Math.min(10, G.beatCombo);
  if (G.beatCombo % 8 === 0) { Sound.sfx.combo(G.beatCombo); kick(0, 1); fx({ x, y, kind: 'ring', big: true, life: 0.3, col: C.teal[3] }); }
  return true;
}
function comboUp(x, y) {
  G.combo++; G.comboT = 2.6; G.bestCombo = Math.max(G.bestCombo, G.combo);
  if (G.combo >= 2) Sound.sfx.combo(G.combo);
  if (G.combo % 5 === 0) popup(`${G.combo} COMBO!`, x, y - 10, C.yel[2], 'b', true);
}

// ═════════════════════════════════════════════════════════════
//  웨이브 위험 요소
// ═════════════════════════════════════════════════════════════
class Rise { // 땅에서 솟는 돌하르방 (부술 수 없음)
  constructor(x, warn, hold, chain = false, idx = 0) {
    this.chain = chain; this.idx = idx; this.x = Math.round(x); this.warn = warn; this.hold = hold; this.t = 0; this.phase = 'warn'; this.up = 0; this.dodged = false;
    this.crack = [];
    for (const s of [-1, 1]) { let cx = 0, cy = 0; for (let i = 0; i < 10; i++) { cx += s * randi(1, 2); if (Math.random() < 0.45) cy = clamp(cy + randi(-1, 1), 0, 3); this.crack.push([cx, cy, i]); } }
  }
  update(dt) {
    this.t += dt;
    if (this.phase === 'warn') {
      if (Math.random() < dt * (this.chain ? 6 : 26)) fx({ x: this.x + rand(-8, 8), y: GROUND + 1, vx: rand(-12, 12), vy: rand(-80, -30), grav: 340, life: 0.45, col: pick([C.soil[2], C.soil[3], C.stone[2]]), size: randi(1, 2) });
      if (!this.chain && Math.random() < dt * 8) Sound.sfx.crack();
      light(this.x, GROUND, 4 + 12 * (this.t / this.warn), '#ffb040', 0.5);
      if (this.t >= this.warn) {
        this.phase = 'rise'; this.t = 0; const loud = !this.chain || this.idx % 4 === 0; Sound.sfx.rise(); if (loud) shake(this.chain ? 0.1 : 0.25);   // 행렬은 네 번째마다만 크게
        if (loud) burst(this.x, GROUND, 14, [C.soil[2], C.soil[3], C.stone[2], C.stone[3]], 110, 0.7, 360, 'chunk');
        dust(this.x - 8, GROUND, 4, -1, 1); dust(this.x + 8, GROUND, 4, 1, 1);
      }
    } else if (this.phase === 'rise') {
      this.up = Math.min(1, easeBack(this.t / 0.16));
      if (this.t >= 0.16) { this.phase = 'hold'; this.t = 0; this.up = 1; }
    } else if (this.phase === 'hold') {
      if (this.t >= this.hold) { this.phase = 'sink'; this.t = 0; }
    } else {
      this.up = Math.max(0, 1 - this.t / 0.4);
      if (Math.random() < dt * 30) dust(this.x + rand(-9, 9), GROUND, 1);
      if (this.up <= 0) return false;
    }
    return true;
  }
  boxes() {
    if (this.phase === 'warn' || (this.phase === 'sink' && this.up < 0.5)) return NONE;
    const h = 48 * this.up;
    return [{ x: this.x - 9, y: GROUND - h, w: 18, h }];
  }
  drawDecal() {
    const k = this.phase === 'warn' ? clamp(this.t / this.warn, 0, 1) : 1, n = Math.ceil(k * 10);
    const glow = this.phase === 'warn' && Math.floor(this.t * 14) % 2;
    if (this.phase === 'warn') { g.fillStyle = `rgba(255,150,60,${0.15 + 0.35 * k})`; g.fillRect(this.x - 9, GROUND - 1, 19, 2); }   // 솟을 자리 땅이 달아오름
    for (const [dx, dy, i] of this.crack) if (i < n) { g.fillStyle = this.phase === 'warn' ? (glow ? '#ffe08a' : '#ff9a3a') : '#1a0c0c'; g.fillRect(this.x + dx, GROUND + dy, 1, 2); }
  }
  draw() {
    if (this.phase === 'warn') return;
    const img = HAREUBANG;
    const over = this.phase === 'rise' ? Math.round(3 * (1 - clamp(this.t / 0.16, 0, 1))) : 0;
    g.save(); g.beginPath(); g.rect(-20, -60, W + 40, GROUND + 62); g.clip();
    g.drawImage(img, Math.round(this.x - img.width / 2), Math.round(GROUND + 2 - img.height * this.up) - over);
    g.restore();
  }
  onShot(s) { spark(s.x, s.y); Sound.sfx.tink(); return true; }
}

class Hopper { // 꼬마 하르방: 밟거나 맞히면 부서짐
  constructor(dir, x) {
    this.dir = dir; this.y = GROUND; this.t = 0;
    this.vx = dir * rand(52, 74) * (1 + G.diff * 0.06); this.x = x ?? (dir > 0 ? -10 - Math.abs(this.vx) * 0.6 * G.speed : W + 10 + Math.abs(this.vx) * 0.6 * G.speed); this.hop = G.diff >= 1 ? rand(220, 300) : rand(170, 250); this.vy = -this.hop * 0.6;   // 0.6초 동안 화면 끝 흙이 들썩이며 예고
    this.sq = 0; this.dodged = false; this.stompable = true;
  }
  update(dt) {
    this.t += dt;
    if (this.dir > 0 ? this.x < -10 : this.x > W + 10) { this.x += this.vx * dt; if (Math.random() < dt * 14) fx({ x: this.dir > 0 ? rand(2, 8) : W - rand(2, 8), y: GROUND - 1, vx: this.dir * rand(5, 20), vy: -rand(30, 70), grav: 400, life: 0.3, kind: 'chunk', size: 1, col: pick([C.soil[3], C.stone[3]]) }); return !this.dead; }
    this.vy += 760 * dt; this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.y >= GROUND) {
      this.y = GROUND; this.vy = -this.hop * rand(0.85, 1.1); this.sq = 0.12;
      if (this.x > 0 && this.x < W) { dust(this.x, GROUND, 3); Sound.sfx.hop(); }
    }
    this.sq -= dt;
    return !this.dead && (this.dir > 0 ? this.x < W + 30 : this.x > -30);
  }
  boxes() { return [{ x: this.x - 7, y: this.y - 20, w: 14, h: 19 }]; }
  kill(by) {
    this.dead = true;
    burst(this.x, this.y - 10, 16, [C.stone[1], C.stone[2], C.stone[3], C.stone[4]], 120, 0.7, 420, 'chunk');
    dust(this.x, this.y, 5, 0, 1); Sound.sfx.shatter();
    reward(by === 'stomp' ? 'stompKill' : 'shotKill', this.x, this.y - 26);
  }
  onShot() { this.kill('shot'); return true; }
  draw() {
    if (this.dir > 0 ? this.x < -10 : this.x > W + 10) { if (Math.floor(this.t * 10) % 2 === 0) edgeChev(this.dir, GROUND - 10); return; }
    const img = MINI[this.dir > 0 ? 'r' : 'l'], air = GROUND - this.y;
    drawShadow(this.x, clamp(14 - air / 5, 5, 14));
    g.drawImage(img, Math.round(this.x - img.width / 2), Math.round(this.y + 1 - img.height));
  }
}

// 동굴 낙석: 천장에서 떨어진 뾰족한 현무암 덩이
// 만장굴 낙석: 천장에서 떨어지는 각진 현무암 덩이 6가지 (크기 · 모서리 · 색이 제각각, 등불빛 받은 것도) × 구르는 4칸
const FALLROCKS = [[13, 5, 'cave', 2], [11, 5, 'cave', 1], [15, 6, 'warm', 2], [12, 4, 'cave', 0], [14, 5, 'warm', 1], [10, 5, 'cave', 1]].map(([size, sides, pal, pores], i) => [0, 1, 2, 3].map(r => stoneSprite(611 + i * 23, size, pal === 'warm' ? ['#1e1a1a', '#3a302c', '#5a4a40', '#7e6a58', '#a08a70'].map(c => mute(c)) : ['#1e1a24', '#332d3a', '#4e4656', '#6e6676', '#8e8696'].map(c => mute(c)), r * Math.PI / 2, { sides, pores })));
class Meteor { // 한라산 화산탄 (동굴에서는 천장에서 떨어지는 낙석)
  constructor(tx, fall) {
    this.tx = Math.round(clamp(tx, 10, W - 10)); this.rock = !!themeCfg().indoor; const hl = (SCENES[Math.floor(G.phase)] || SCENES[0] || {}).halla, hcx = (hl && Number.isFinite(hl.cx) ? hl.cx : W * 0.62) - Math.round((20 + amb.camX) * LAYER_P.hall); this.sx = this.rock ? this.tx + rand(-4, 4) : lerp(hcx, this.tx, 0.3) + rand(-15, 15); this.sy = this.rock ? -VOFF + 2 : -VOFF - 20;
    this.fall = fall; this.t = 0; this.phase = 'fall'; this.dodged = false; this.x = this.sx; this.y = this.sy;
  }
  update(dt) {
    this.t += dt;
    if (this.phase === 'fall') {
      const e = Math.pow(clamp(this.t / this.fall, 0, 1), 1.6);
      this.x = lerp(this.sx, this.tx, e); this.y = lerp(this.sy, GROUND - 5, e);
      if (this.rock) { if (Math.random() < 0.4) fx({ x: this.x + rand(-3, 3), y: this.y - 4, vx: rand(-8, 8), vy: rand(-10, 10), life: 0.3, kind: 'chunk', size: 1, col: pick(['#3a3440', '#5a5260']) }); }
      else {
      if (Math.random() < 0.6) fx({ x: this.x + rand(-3, 3), y: this.y + rand(-3, 3), vx: rand(-10, 10), vy: rand(-30, -8), life: rand(0.2, 0.45), col: pick([C.yel[3], C.yel[2], C.org[3], C.org[2]]), size: randi(1, 3) });
      if (Math.random() < dt * 30) fx({ x: this.x, y: this.y - 4, vx: rand(-6, 6), vy: -12, life: 0.7, kind: 'smoke', size: randi(0, 2) });
      light(this.x, this.y, 26, '#ff9040', 0.9);
      }
      if (this.t >= this.fall) {
        this.phase = 'boom'; this.t = 0; Sound.sfx.boom(); impact(this.tx, GROUND - 3, this.rock ? C.stone[3] : C.org[3], 1); if (Math.abs(this.tx - P.x) < 36 && !this.chain) hitstop(0.02, 0.6);   // 바로 옆에 떨어지면 짧게 멈칫
        if (this.rock) { burst(this.tx, GROUND - 2, 14, ['#2a2630', '#3e3846', '#5a5262', '#7a7282'], 120, 0.7, 400, 'chunk'); for (let k = 0; k < 6; k++) fx({ x: this.tx + rand(-10, 10), y: GROUND - 4, vx: rand(-30, 30), vy: rand(-20, -5), life: rand(0.5, 0.9), kind: 'puff', size: randi(1, 2) }); } else {
        burst(this.tx, GROUND - 2, 16, ['#3a2a2a', '#5a4040', C.org[3], C.yel[3]], 130, 0.8, 400, 'chunk');
        fx({ x: this.tx, y: GROUND - 2, kind: 'ring', life: 0.35, col: C.yel[3] });
        for (let k = 0; k < 6; k++) fx({ x: this.tx + rand(-8, 8), y: GROUND - 6, vx: rand(-20, 20), vy: rand(-30, -10), life: rand(0.6, 1), kind: 'smoke', size: randi(1, 3) });
        G.decals.push({ x: this.tx, t: 0, life: 6 });
        }
      }
    } else if (this.phase === 'boom') {
      if (!this.rock) light(this.tx, GROUND - 8, 60 * (1 - this.t / 0.3), '#ffc060', 1);
      if (this.t >= 0.3) { if (this.rock) return false; this.phase = 'lava'; this.t = 0; }
    } else {
      light(this.tx, GROUND, 22, '#ff6020', 0.7 * (1 - this.t / 1.5));
      if (Math.random() < dt * 6) fx({ x: this.tx + rand(-7, 7), y: GROUND - 1, vy: rand(-30, -10), grav: 60, life: 0.4, col: pick([C.yel[3], C.org[3]]) });
      if (this.t >= 1.5) return false;
    }
    return true;
  }
  boxes() {
    if (this.phase === 'fall') return this.y > -VOFF + 10 ? [{ x: this.x - 5, y: this.y - 5, w: 10, h: 10 }] : NONE;
    if (this.phase === 'boom') return this.t < 0.14 ? [{ x: this.tx - 15, y: GROUND - 18, w: 30, h: 18 }] : NONE;
    return this.t < 1.2 ? [{ x: this.tx - 10, y: GROUND - 3, w: 20, h: 3 }] : NONE;
  }
  drawDecal() {
    if (this.phase === 'fall') {
      if (this.y < -VOFF + 40) topMark(this.x, this.t);
      const k = clamp(this.t / this.fall, 0, 1), rx = 15, blink = Math.floor(this.t * (6 + k * 18)) % 2;
      if (this.rock) { g.fillStyle = INK; for (const s of [-1, 1]) g.fillRect(this.tx + s * rx - 1, GROUND - 3, 3, 7); g.fillRect(this.tx - Math.round(rx * k) - 1, GROUND - 1, Math.round(rx * k) * 2 + 3, 4); }   // 동굴: 먹 받침 (어두운 바닥에서도 보이게)
      g.fillStyle = blink ? C.red[2] : C.yel[2];
      for (const s of [-1, 1]) { g.fillRect(this.tx + s * rx, GROUND - 1, 1, 3); g.fillRect(this.tx + s * (rx - 1), GROUND - 2, 1, 1); g.fillRect(this.tx + s * (rx - 1), GROUND + 2, 1, 1); }
      g.fillStyle = this.rock ? `rgba(255,${blink ? 120 : 200},70,${0.35 + k * 0.45})` : `rgba(200,40,20,${0.15 + k * 0.35})`; g.fillRect(this.tx - Math.round(rx * k), GROUND, Math.round(rx * k) * 2 + 1, 2);
    } else if (this.phase === 'lava') {
      const cool = this.t > 1.1 ? (this.t - 1.1) / 0.4 : 0;
      g.fillStyle = cool > 0.5 ? '#4a2a28' : '#c83a18'; g.fillRect(this.tx - 11, GROUND, 23, 2); g.fillRect(this.tx - 9, GROUND - 1, 19, 1);
      g.fillStyle = cool > 0.5 ? '#6a3a30' : (Math.floor(this.t * 6) % 2 ? C.yel[2] : C.org[3]); g.fillRect(this.tx - 7, GROUND, 15, 1);
    }
  }
  draw() {
    if (this.phase === 'fall') { if (this.rock) { this.rs = this.rs || pick(FALLROCKS); const f = this.rs[Math.floor(this.t * 9 + this.tx) % 4]; g.drawImage(f, Math.round(this.x - f.width / 2), Math.round(this.y - f.height / 2)); } else g.drawImage(METEOR, Math.round(this.x - 7), Math.round(this.y - 7)); }   /* 낙석은 하나씩 다른 돌이 구르며 떨어짐 */
    else if (this.phase === 'boom' && this.rock) { const k = this.t / 0.3; g.globalAlpha = 1 - k; disc(g, this.tx, GROUND - 5, Math.round(6 + k * 12), '#5a5262'); g.globalAlpha = 1; }
    else if (this.phase === 'boom') {
      const k = this.t / 0.3, r = Math.round(5 + k * 16);
      if (k < 0.3) disc(g, this.tx, GROUND - 7, r + 2, '#fff4e0');
      disc(g, this.tx, GROUND - 7, r, k < 0.5 ? C.yel[3] : C.org[3]);
      disc(g, this.tx, GROUND - 7, Math.max(1, r - 5), k < 0.5 ? '#fff4e0' : C.yel[2]);
    }
  }
}

class Pony { // 조랑말 떼: 밟으면 튕겨 오름
  constructor(dir, off) { this.dir = dir; this.x = dir > 0 ? -18 - off : W + 18 + off; this.speed = (rand(140, 160) + G.diff * 8) * Math.min(1, 1.6 / G.speed); this.anim = Math.random() * 6; this.dodged = false; this.bouncy = true; }
  update(dt) {
    this.x += this.dir * this.speed * dt; this.anim += dt * this.speed / 11;
    if (this.x > -10 && this.x < W + 10) { if (Math.random() < dt * 16) dust(this.x - this.dir * 12, GROUND, 1, -this.dir); Sound.sfx.gallop(); }
    return this.dir > 0 ? this.x < W + 40 : this.x > -40;
  }
  boxes() { return [{ x: this.x - 12, y: GROUND - 15, w: 24, h: 14 }]; }
  draw() {
    const f = PONY[Math.floor(this.anim) % 6][this.dir > 0 ? 'r' : 'l'];
    drawShadow(this.x, 22);
    g.drawImage(f, Math.round(this.x - f.ax), Math.round(GROUND - f.ay));
  }
  onShot(s) { spark(s.x, s.y); Sound.sfx.tink(); return true; }
}

class Pebble {
  constructor(dir) {
    this.dir = dir; const b = Math.random();
    this.y = GROUND - (b < 0.4 ? rand(3, 9) : b < 0.75 ? rand(13, 19) : rand(28, 38));   /* 높은 돌은 서 있는 머리에 스치지 않게 */
    this.vx = dir * rand(170, 235) * Math.min(1, 1.6 / G.speed); this.x = dir > 0 ? -6 - Math.abs(this.vx) * 0.6 * G.speed : W + 6 + Math.abs(this.vx) * 0.6 * G.speed;   /* 화면 끝 예고 0.6초 */ this.ph = rand(0, 6); this.t = 0; this.dodged = false;   // 0.4초 동안 화면 끝 꺾쇠로 예고
    this.spr = pick(PEBBLES); this.spin = rand(9, 15);   // 돌마다 모양 · 크기 · 색이 다르고, 날아가며 데굴데굴
  }
  update(dt) { this.t += dt; this.x += this.vx * dt; this.y0 = this.y0 ?? this.y; this.y = this.y0 + Math.sin(this.t * 14 + this.ph) * 1; return !this.dead && (this.dir > 0 ? this.x < W + 10 : this.x > -10); }
  boxes() { return [{ x: this.x - 3, y: this.y - 3, w: 6, h: 5 }]; }
  onShot() { this.dead = true; burst(this.x, this.y, 6, [C.stone[3], C.stone[4]], 60, 0.4, 300, 'chunk'); reward('shatter', this.x, this.y - 8); return true; }
  draw() {
    if (this.dir > 0 ? this.x < -4 : this.x > W + 4) { if (Math.floor(this.t * 12) % 2 === 0) edgeChev(this.dir, this.y); return; }
    g.fillStyle = 'rgba(255,244,224,0.6)';
    g.fillRect(Math.round(this.x - this.dir * 10 - 3), Math.round(this.y - 1), 6, 1);
    g.fillRect(Math.round(this.x - this.dir * 17 - 2), Math.round(this.y + 1), 4, 1);
    const f = this.spr[((Math.floor(this.t * this.spin + this.ph) * this.dir) % 4 + 4) % 4]; g.drawImage(f, Math.round(this.x - f.width / 2), Math.round(this.y - f.height / 2));
  }
}
class Tewak {
  constructor(dir) { this.dir = dir; this.y = GROUND - 20; this.vx = dir * rand(110, 140) * Math.min(1, 1.6 / G.speed); this.x = dir > 0 ? -8 - Math.abs(this.vx) * 0.6 * G.speed : W + 8 + Math.abs(this.vx) * 0.6 * G.speed; this.t = 0; this.vy = 0; this.dodged = false; this.bouncy = true; }
  update(dt) {
    this.t += dt; this.x += this.vx * dt; if (this.dir > 0 ? this.x < -8 : this.x > W + 8) return !this.dead;
    this.vy += 620 * dt; this.y += this.vy * dt;
    if (this.y >= GROUND) { this.y = GROUND; this.vy = -rand(130, 180); }
    return !this.dead && (this.dir > 0 ? this.x < W + 14 : this.x > -14);
  }
  boxes() { return [{ x: this.x - 5, y: this.y - 11, w: 10, h: 10 }]; }
  onShot() { this.dead = true; burst(this.x, this.y - 6, 10, [C.org[2], C.org[3], '#ffffff'], 70, 0.4); reward('shatter', this.x, this.y - 14); return true; }
  draw() { if (this.dir > 0 ? this.x < -6 : this.x > W + 6) { if (Math.floor(this.t * 12) % 2 === 0) edgeChev(this.dir, GROUND - 14, C.org[3]); return; } drawShadow(this.x, 9); const img = TEWAK[((Math.floor(this.x / 6) * this.dir) % 4 + 4) % 4]; g.drawImage(img, Math.round(this.x - 6), Math.round(this.y - 11)); }
}

// ═════════════════════════════════════════════════════════════
//  보스 투사체
// ═════════════════════════════════════════════════════════════
class Bubble { // 사투리 말풍선 (귤로 맞히면 글자가 와르르)
  constructor(text, x, y, opt = {}) {
    this.dir = opt.dir || -1;
    this.kind = opt.kind || 'n'; this.spr = wordSprite(text, this.kind); this.text = text;
    this.w = this.spr.width; this.bodyH = this.spr.bodyH;
    this.x = this.dir < 0 ? x - this.w : x; this.y = y; this.vx = this.dir * (opt.speed || 110); this.vy = opt.vy || 0; this.grav = opt.grav || 0;
    this.laneY = opt.lane !== undefined ? opt.lane - this.bodyH : null; this.bounces = opt.bounces || 0;
    this.hp = this.kind === 'big' ? 4 : 1; this.age = 0; this.dodged = false; this.flash = 0;
  }
  update(dt) {
    this.age += dt; this.flash -= dt;
    this.x += this.vx * dt;
    if (this.laneY !== null) this.y = lerp(this.y, this.laneY, 1 - Math.pow(0.0004, dt));
    else {
      this.vy += this.grav * dt; this.y += this.vy * dt;
      if (this.y + this.bodyH >= GROUND) {
        this.y = GROUND - this.bodyH;
        if (this.bounces-- > 0) { this.vy = -Math.abs(this.vy) * 0.55; dust(this.x + this.w / 2, GROUND, 3); } else { this.vy = 0; this.grav = 0; }
      }
    }
    if (this.kind === 'big' && Math.random() < dt * 14) fx({ x: this.dir < 0 ? this.x + this.w : this.x, y: this.y + rand(2, this.bodyH - 2), vx: -this.dir * 30, life: 0.3, col: C.yel[3] });
    return !this.dead && this.x > -this.w - 10 && this.x < W + 10;
  }
  boxes() { if (this.age < 0.14 || (this.laneY !== null && Math.abs(this.y - this.laneY) > 3)) return NONE; return [{ x: this.x + 3, y: this.y + 5, w: this.w - 6, h: this.bodyH - 9 }]; }
  onShot() {
    this.hp--; this.flash = 0.08;
    if (this.hp > 0) { Sound.sfx.hit(); spark(this.x + 4, this.y + this.bodyH / 2); return true; }
    this.dead = true; Sound.sfx.shatter();
    graphemes(this.text.replace(/\s/g, '')).forEach((ch, i) => fx({ x: this.x + 6 + i * 9, y: this.y + 4, vx: rand(-60, 60), vy: rand(-140, -60), grav: 420, life: 0.8, kind: 'glyph', ch }));
    burst(this.x + this.w / 2, this.y + this.bodyH / 2, 10, ['#ffffff', '#d8e0f0'], 80, 0.4, 200);
    reward(this.kind === 'big' ? 'bigShatter' : 'shatter', this.x + this.w / 2, this.y - 4);
    return true;
  }
  draw() {
    const pop = this.age < 0.12 ? easeBack(this.age / 0.12) : 1, wob = Math.round(Math.sin(this.age * 14) * 1);
    const img = this.flash > 0 ? silOf(this.spr) : this.spr;
    if (this.y + this.bodyH > GROUND - 30) drawShadow(this.x + this.w / 2, this.w * 0.6);
    g.drawImage(img, Math.round(this.x), Math.round(this.y + wob + (1 - pop) * 6));
  }
}

class Rotten { // 썩은 귤
  constructor(x, y, vx, vy) { this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.life = 4; this.dodged = false; this.stompable = true; }
  update(dt) {
    this.life -= dt; this.vy += (this.grav || 560) * dt; this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.x < G.arenaL - 2 || this.x > G.arenaR) { this.vx *= -1; this.x = clamp(this.x, G.arenaL - 2, G.arenaR); }
    if (this.y >= GROUND && this.falling) { this.pop(); fx({ x: this.x, y: GROUND - 1, kind: 'ring', life: 0.2, col: '#8a9a48' }); return false; }   // 감귤 따기: 곧게 떨어져 철퍽 (예고 자리 그대로)
    if (this.y >= GROUND) { this.y = GROUND; this.vy = -Math.abs(this.vy) * 0.6; if (Math.abs(this.vy) < 60) this.vy = -150; this.vx *= 0.9; }
    if (this.life <= 0) { this.pop(); return false; }
    return !this.dead;
  }
  pop() { this.dead = true; burst(this.x, this.y - 4, 10, ['#5e6e34', '#8a9a48', '#3e4a2a'], 70, 0.45, 300); Sound.sfx.splat(); }
  kill(by) { this.pop(); reward(by === 'stomp' ? 'stompKill' : 'shatter', this.x, this.y - 10); }
  boxes() { return [{ x: this.x - 4, y: this.y - 8, w: 8, h: 8 }]; }
  onShot() { this.kill(); return true; }
  draw() { if (this.life < 1 && Math.floor(this.life * 10) % 2) return; drawShadow(this.x, 7); g.drawImage(ROTTEN, Math.round(this.x - 5), Math.round(this.y - 10)); }
}

// ── 줍는 것 ──────────────────────────────────────────────────
// 떨어지는 귤: 빙글 도는 8프레임(꼭지가 돌아감, 빛은 늘 왼쪽 위) + 착지 찌그러짐 프레임
const PICK_TANG = Array.from({ length: 8 }, (_, i) => [0, 1].map(q => {
  const pb = new PB(13, 14), a = i * Math.PI / 4, cy = 8.2 + q;
  pb.ellipse(6.5, cy, 4.2 + q, 3.8 - q, (nx, ny) => { const v = sphereLight(nx, ny); return C.org[v < 0.42 ? 1 : v < 0.78 ? 2 : 3]; });
  if (Math.cos(a) > -0.3) { const x = Math.round(6 + Math.sin(a) * 3), y = Math.round(cy - Math.cos(a) * (4 - q)); pb.set(x, y, C.wood[1]); pb.rect(x + 1, y - 1, 2, 1, C.leaf[2]); }
  return selOut(pb).canvas();
}));
// 삼다수: 투명한 물병 + 파란 뚜껑 + 띠 라벨 (공중에 떠서 반짝임)
const SAMDA = (() => {
  const pb = new PB(9, 16), W4 = ['#6aa0c0', '#a8d4e4', '#d8f0f6', '#f4fcff'].map(c => mute(c)), CAP = mute('#2c5aa8');
  pb.rect(3, 0, 3, 2, CAP); pb.set(3, 0, mute('#4a7ac8'));
  pb.rect(3, 2, 3, 1, W4[1]); pb.set(2, 3, W4[1]); pb.set(6, 3, W4[1]);
  for (let y = 4; y < 15; y++) for (let x = 1; x < 8; x++) pb.set(x, y, x === 1 ? W4[3] : x === 2 ? W4[2] : x === 7 ? W4[0] : W4[1]);
  for (let x = 1; x < 8; x++) { pb.set(x, 8, '#f4f0e8'); pb.set(x, 9, x % 2 ? mute('#3a72c0') : '#f4f0e8'); pb.set(x, 10, '#f4f0e8'); }
  for (let x = 2; x < 7; x++) pb.set(x, 15, W4[0]);
  return selOut(pb).canvas();
})();
const DROP = (() => { const make = (full) => { const pb = new PB(7, 8), c = full ? [mute('#3a72c0'), mute('#6aa8d8'), mute('#bfe4f2')] : [mute('#3a3236'), mute('#4a4044'), mute('#5a5054')]; pb.set(3, 0, c[1]); pb.rect(2, 1, 3, 1, c[1]); for (let y = 2; y < 7; y++) for (let x = 1; x < 6; x++) if (!((y === 6) && (x === 1 || x === 5))) pb.set(x, y, x === 2 && y < 5 ? c[2] : x === 5 || y === 6 ? c[0] : c[1]); return selOut(pb).canvas(); }; return { on: make(true), off: make(false) }; })();
// 삼다수 세 병 → 삼다수 파도: 화면을 쓸며 지금 떠 있는 위험을 씻어 냄
function samdaWave() {
  G.water = 0; G.wave = { t: 0 }; P.inv = Math.max(P.inv, 1.2); Sound.sfx.wave(); Sound.sfx.level(); shake(0.3); flashFx(0.06, '#d8f0ff', true);
  banner('삼다수 파도', '전방 소탕', mute('#6aa8d8'));
  let n = 0; for (const h of G.hz) { if (h.ambient) continue; h.dead = true; n++; burst(h.x ?? W / 2, (h.y ?? GROUND) - 6, 6, WATER.slice(1), 90, 0.5, 300); }
  G.hz = G.hz.filter(h => h.ambient); G.spawnQ.length = 0; G.warnings = [];
  addScore(200 + n * 30, P.x, P.y - 40);
}
// ── 새 아이템: 귤 망사리(귤 +5) · 오메기떡(6초 점수 2배) · 바람개비(8초 동안 귤을 끌어당김) ──
const BASKET = (() => { const pb = new PB(14, 12), W2 = ['#5a3a22', '#7a5230', '#9a6c40'].map(c => mute(c));
  for (let y = 5; y < 12; y++) for (let x = 1 + (y > 9 ? 1 : 0); x < 13 - (y > 9 ? 1 : 0); x++) pb.set(x, y, (x + y) % 3 === 0 ? W2[0] : (x + (y >> 1)) % 2 ? W2[2] : W2[1]);
  for (const [cx, cy] of [[4, 4], [7, 3], [10, 4], [5.5, 6], [8.5, 6]]) pb.ellipse(cx, cy, 2.2, 2, (a, b) => C.org[sphereLight(a, b) < 0.4 ? 1 : sphereLight(a, b) < 0.75 ? 2 : 3]);
  pb.set(7, 1, C.leaf[2]); return selOut(pb).canvas(); })();
const OMEGI = (() => { const pb = new PB(14, 11), K = ['#4a5a2e', '#6a7e40', '#8ea25a'].map(c => mute(c));   // 흰 접시에 오메기떡 세 알 (썩은 귤과 헷갈리지 않게)
  for (let x = 1; x < 13; x++) { pb.set(x, 9, '#c8c0b4'); if (x > 1 && x < 12) pb.set(x, 10, '#8a8478'); } for (let x = 2; x < 12; x++) pb.set(x, 8, '#f4ecdc');
  for (const [cx, cy] of [[4, 6], [10, 6], [7, 3.6]]) { pb.ellipse(cx, cy, 2.6, 2.2, (a, b) => K[sphereLight(a, b) < 0.4 ? 0 : sphereLight(a, b) < 0.75 ? 1 : 2]); pb.set(Math.round(cx), Math.round(cy - 1), '#f0d890'); }
  return selOut(pb).canvas(); })();
const PINWHEEL = [0, 1].map(f => { const pb = new PB(13, 16); for (let y = 7; y < 16; y++) pb.set(6, y, C.wood[1]);
  const cols = [C.red[3], C.yel[3], C.teal[3], C.org[3]];
  for (let b = 0; b < 4; b++) { const a = b * Math.PI / 2 + f * Math.PI / 4; for (let r = 1; r < 6; r++) { const x = 6 + Math.round(Math.cos(a) * r), y = 6 + Math.round(Math.sin(a) * r); pb.set(x, y, cols[b]); pb.set(x + Math.round(Math.cos(a + 1.2)), y + Math.round(Math.sin(a + 1.2)), mix(cols[b], INK, 0.3)); } }
  pb.set(6, 6, C.wood[0]); return selOut(pb).canvas(); });
const ITEM_KINDS = ['basket', 'omegi', 'pinwheel', 'water', 'shield', 'bong'];
class Pickup {
  constructor(kind, x, y, vx = 0, vy = 0) { Object.assign(this, { kind, x, y, vx, vy, life: 8, grounded: false, t: 0, phase: rand(0, 6.28), spin: rand(0, 1), sq: 0 }); }
  update(dt) {
    this.t += dt; this.sq = Math.max(0, this.sq - dt);
    if (this.float) {   // 공중에 떠 있는 귤: 살랑 · 가까이 가면 끌려옴
      this.life -= dt / G.speed; this.y = this.y0 + Math.sin(this.t * 3 + this.phase) * 1.5; this.spin += dt * 0.6;
      const ddx = P.x - this.x, ddy = P.y - 12 - this.y; if (!P.dead && Math.hypot(ddx, ddy) < 16) { this.float = false; this.grounded = false; }
      return this.life > 0 && !this.dead;
    }
    const dx = P.x - this.x, dy = P.y - 12 - this.y, d = Math.hypot(dx, dy), mag = (G.magnetT || 0) > 0 && this.kind === 'tang', pull = this.kind !== 'fake' && !P.dead && d < (mag ? 110 : 26);
    if (pull) { this.grounded = false; this.sq = 0; const k = mag ? Math.max(18, 45 * (1 - d / 110)) : 45 * (1 - d / 26); this.vx += (dx * k - this.vx * 8) * dt; this.vy += (dy * k - this.vy * 8) * dt; }
    else if (!this.grounded && this.sq === 0) {
      // 공기 저항: 끝없이 빨라지지 않고, 옆으로 살랑살랑
      this.vy = Math.min(this.vy + 520 * dt, 190);
      this.vx = (this.vx + Math.sin(this.t * 3 + this.phase) * 8 * dt) * Math.exp(-0.6 * dt);
    }
    if (!this.grounded && this.sq === 0) { this.x += this.vx * dt; this.y += this.vy * dt; this.spin += (1.2 + Math.abs(this.vx) * 0.03) * dt; }
    if (this.x < G.arenaL - 2 || this.x > G.arenaR) { this.vx *= -0.35; this.x = clamp(this.x, G.arenaL - 2, G.arenaR); }
    if (this.y >= GROUND && this.vy > 0) {
      const impact = this.vy; this.y = GROUND; this.sq = 0.07; this.vx *= 0.55;
      this.grounded = impact < 45; this.vy = this.grounded ? 0 : -impact * 0.22;
      if (this.grounded) this.vx = 0; else dust(this.x, GROUND, 1);
    }
    if (this.grounded) this.life -= dt / G.speed;   // 실제 시간으로 사라짐
    return this.life > 0 && !this.dead;
  }
  box() { return { x: this.x - 6, y: this.y - 10, w: 12, h: 11 }; }
  draw() {
    if (this.life < 1.2 && Math.floor(this.life * 6) % 2) return;
    if (ITEM_KINDS.includes(this.kind)) {   // 아이템은 금빛 테 안에 넣어 썩은 귤 · 장애물과 확실히 구분
      const pulse = Math.floor(amb.t * 6 + this.phase) % 2, bx = Math.round(this.x - 10), by = Math.round(this.y - 21);
      g.fillStyle = INK; g.fillRect(bx - 1, by - 1, 22, 22); g.fillStyle = pulse ? C.yel[3] : C.org[3]; g.fillRect(bx, by, 20, 20); g.fillStyle = UI.panel; g.fillRect(bx + 2, by + 2, 16, 16);
      for (let k = 0; k < 4; k++) { const a = amb.t * 3 + k * 1.57 + this.phase; g.fillStyle = '#fff4e0'; g.fillRect(Math.round(this.x + Math.cos(a) * 14), Math.round(this.y - 11 + Math.sin(a) * 14), 1, 1); }
      light(this.x, this.y - 11, 16, C.yel[3], 0.6);
    }
    const img = this.kind === 'basket' ? BASKET : this.kind === 'omegi' ? OMEGI : this.kind === 'pinwheel' ? PINWHEEL[Math.floor(amb.t * 10) % 2] : this.kind === 'water' ? SAMDA : this.kind === 'fake' ? HALLABONG_FAKE : this.kind === 'bong' ? HALLABONG : this.kind === 'shield' ? TEWAK[Math.floor(this.spin * 4) % 4] : PICK_TANG[Math.floor(this.spin * 8) % 8][this.sq > 0 ? 1 : 0];
    // 그림자: 땅에 가까울수록 크고 진하게
    const near = clamp(1 - (GROUND - this.y) / 100, 0, 1);
    if (near > 0.15) drawShadow(this.x, Math.round(3 + near * (img.width - 6)));
    if (this.kind === 'fake') { const a = amb.t * 9 + this.x; g.fillStyle = INK; g.fillRect(Math.round(this.x + Math.cos(a) * 7), Math.round(this.y - 12 + Math.sin(a * 1.3) * 3), 1, 1); }
    g.drawImage(img, Math.round(this.x - img.width / 2), Math.round(this.y - img.height + 1));
    if (this.kind === 'water' && Math.floor(amb.t * 6 + this.phase) % 3 === 0) { g.fillStyle = '#f4fcff'; g.fillRect(Math.round(this.x + Math.cos(amb.t * 3) * 7), Math.round(this.y - 10 + Math.sin(amb.t * 4) * 6), 1, 1); light(this.x, this.y - 8, 12, '#c8f0ff', 0.5); }
    if (this.kind === 'shield') for (let a = 0; a < 6.28; a += 0.4) { if ((Math.round(a / 0.4) + Math.floor(amb.t * 8)) % 2) continue; g.fillStyle = C.yel[3]; g.fillRect(Math.round(this.x + Math.cos(a) * 8), Math.round(this.y - img.height / 2 + Math.sin(a) * 8), 1, 1); }
    if (ITEM_KINDS.includes(this.kind) || this.kind === 'fake' || (this.grounded && Math.abs(this.x - P.x) < 60)) drawStr(this.kind === 'fake' ? '×' : this.kind === 'bong' ? '+♥' : this.kind === 'shield' ? '방패' : this.kind === 'basket' ? '귤+5' : this.kind === 'omegi' ? '점수×2' : this.kind === 'pinwheel' ? '귤자석' : this.kind === 'water' ? '삼다수' : '+1', this.x, ITEM_KINDS.includes(this.kind) ? this.y - 31 : this.y - img.height - 8, { color: this.kind === 'fake' ? C.red[3] : C.yel[3], align: 'center' });
  }
}

// ── 플레이어의 귤 ────────────────────────────────────────────
class Shot {
  constructor(x, y, dir) { this.x = x; this.y = y; this.vx = dir * 250 + P.vx * 0.25; this.vy = -40; this.rot = 0; this.trail = []; }
  update(dt) {
    this.vy += 150 * dt; this.x += this.vx * dt; this.y += this.vy * dt; this.rot += dt * 20;
    this.trail.push([this.x, this.y]); if (this.trail.length > 5) this.trail.shift();
    if (this.y >= GROUND - 2) { juice(this.x, GROUND - 2, 6); Sound.sfx.splat(); return false; }
    return !this.dead && this.x > -10 && this.x < W + 10;
  }
  box() { return { x: this.x - 4, y: this.y - 4, w: 8, h: 8 }; }
  draw() {
    this.trail.forEach(([x, y], i) => { g.fillStyle = i < 2 ? C.org[1] : C.org[2]; g.fillRect(Math.round(x), Math.round(y), 2, 2); });
    const img = TANGERINE;
    g.drawImage(img, Math.round(this.x - img.width / 2) + (Math.floor(this.rot) % 2), Math.round(this.y - img.height / 2));
  }
}

// ═════════════════════════════════════════════════════════════
//  밈 이벤트 컷: "이벤트 발생!" 경고 → 오른쪽에서 초상이 쓱 → 공격 → 쓱 퇴장
//  (때릴 수도 밟을 수도 없음. 초상은 화면 가장자리의 벽 역할)
// ═════════════════════════════════════════════════════════════
const EV_WARN = 0.7, EV_IN = 0.3, EV_OUT = 0.35;
class EventCut {
  constructor(pat, key) {
    this.pat = pat; this.key = key; this.t = 0; this.stT = 0; this.state = 'warn';
    // 오른쪽 · 왼쪽 어디서든 나옴 (왼쪽이면 초상을 좌우반전해 플레이어를 바라보게)
    this.side = Math.random() < 0.5 ? 1 : -1; this.x = this.offX(); this.face = -this.side; this.say = null; this.talkT = 0; this.shakeT = 0; this.jy = 0;
    Sound.sfx.siren();
  }
  get img() { const p = portraitOf(this.key); if (this.side > 0) return p; return p._flip || (p._flip = Object.assign(flipC(p), { cell: p.cell })); }
  get home() { return this.side > 0 ? W - this.img.width + 4 : -4; }
  offX() { return this.side > 0 ? W + 4 : -this.img.width - 4; }
  // 공격이 나가는 안쪽 가장자리 · 플레이어 쪽 방향
  inner() { return this.side > 0 ? this.x + 8 : this.x + this.img.width - 8; }
  get dir() { return -this.side; }
  get y0() { return GROUND + 6 - this.img.height + (this.sink || 0) - Math.round(this.jy || 0); }
  eyePos() { const e = EVENTS[this.key].eyes, k = this.img.cell || 2; return e ? [this.x + Math.round((e[0][0] + e[1][0]) / 2 * k), this.y0 + e[0][1] * k + 1] : this.mouthPos(); }
  mouthPos() { return [this.x + Math.round(this.img.width * (this.side > 0 ? 0.4 : 0.6)), this.y0 + Math.round(this.img.height * 0.62)]; }
  headPos() { return [this.x + Math.round(this.img.width * (this.side > 0 ? 0.2 : 0.8)), this.y0 + 14]; }
  // ── 보스 모션: 공격마다 몸을 크게 써서 박동감 있게 ──
  //  slam(웅크림→도약→쾅, onLand 콜백) · lunge(앞으로 튀어나옴) · sway(물결처럼 휘청) · lean(몸을 내밀어 클로즈업) · spin(좌우로 빙글빙글 베기)
  move(kind, onLand) { const dur = { slam: 0.78, lunge: 0.45, sway: 0.9, lean: 0.6, spin: 0.5 }[kind] || 0.5; this.motion = { kind, t: 0, dur, onLand, landed: false, side0: this.side }; if (kind === 'slam' || kind === 'lunge') Sound.sfx.whoosh(); }
  motionXf() {   // 현재 모션의 그리기 변형 { sx, sy, ox, jy, shear }
    const m = this.motion; if (!m) return null;
    const k = Math.min(1, m.t / m.dur), d = this.dir;
    if (m.kind === 'slam') {
      if (k < 0.32) { const a = k / 0.32; return { sx: 1 + 0.07 * a, sy: 1 - 0.09 * a, ox: 0, jy: 0 }; }
      if (k < 0.66) { const a = (k - 0.32) / 0.34; return { sx: 0.95, sy: 1.07, ox: 0, jy: Math.sin(a * Math.PI) * 54 }; }
      const a = (k - 0.66) / 0.34; return { sx: 1.1 - 0.1 * a, sy: 0.86 + 0.14 * a, ox: 0, jy: 0 };
    }
    if (m.kind === 'lunge') { const a = Math.sin(k * Math.PI); return { sx: 1 + 0.06 * a, sy: 1 + 0.04 * a, ox: d * 30 * a, jy: 6 * a }; }
    if (m.kind === 'lean') { const a = Math.sin(Math.min(1, k * 1.6) * Math.PI / 2) * (k > 0.75 ? (1 - k) / 0.25 : 1); return { sx: 1 + 0.14 * a, sy: 1 + 0.14 * a, ox: d * 10 * a, jy: 0 }; }
    if (m.kind === 'sway') return { sx: 1, sy: 1, ox: 0, jy: Math.sin(k * Math.PI) * 10, shear: Math.sin(m.t * 10) * 7 * (1 - k) };
    if (m.kind === 'spin') return { sx: Math.abs(Math.cos(m.t * 26)) * 0.9 + 0.1, sy: 1, ox: 0, jy: Math.sin(k * Math.PI) * 8 };
    return null;
  }
  // 자리 바꾸기 액션: 할망은 크게 뛰어넘고, 뭐랭하멘은 화면이 지직거리며 순간이동, 설문대할망은 땅속으로 잠겼다가 반대편에서 솟음
  swapTo() {
    const nside = -this.side, nx = nside > 0 ? W - this.img.width + 4 : -4;
    if (P.x > nx - 24 && P.x < nx + this.img.width + 24) return false;   // 숨비가 그 자리에 있으면 자리 바꾸기는 건너뜀 (벽에 밀려 순간이동하지 않게)
    this.swap = { t: 0, dur: this.key === 'seolmun' ? 1.5 : this.key === 'murang' ? 0.7 : 0.8, x0: this.x, x1: nx, side: nside, flipped: false };
    if (this.key === 'halmang') { Sound.sfx.whoosh(); { const hl = new HopLand(nx + this.img.width / 2, this.img.width - 30, 0.8 * G.speed); hl.chain = true; spawnHz(hl); } }
    else if (this.key === 'murang') { Sound.sfx.zap(); flashFx(0.03, '#d8f0ff'); }
    else { Sound.sfx.erupt(); shake(0.2); }
    return true;
  }
  // 칼 든 하르방: 다른 자리로 펄쩍 (착지 자리에 그림자 예고 + 착지 충격)
  hopTo(nx, side) { this.hop = { x0: this.x, x1: nx, t: 0, dur: 0.62, side }; Sound.sfx.whoosh(); { const hl = new HopLand(nx + this.img.width / 2, this.img.width - 26, 0.62 * G.speed); hl.chain = true; spawnHz(hl); } }
  setState(s) { this.state = s; this.stT = 0; if (s === 'leave') dust((this.leaveX ?? this.home) + 10, GROUND, 6, 1, 1); }
  sayIt(text, kind, dur = 1.2) { this.say = { text, kind, t: 0, dur }; this.talkT = Math.min(dur, 0.6); Sound.sfx.babble(text, kind === 'big'); }
  talk(t = 0.25) { this.talkT = t; }
  leave() {
    this.hop = null; this.jy = 0; this.swap = null; this.glitch = 0; this.motion = null;
    if (this.state === 'warn') this.setState('gone');
    else if (this.state !== 'leave' && this.state !== 'gone') { this.leaveX = this.x; this.setState('leave'); this.say = null; }
  }
  update(dt) {
    this.t += dt; this.stT += dt; this.talkT -= dt; this.shakeT -= dt;
    if (this.say) { this.say.t += dt; if (this.say.t > this.say.dur) this.say = null; }
    if (this.state === 'warn' && this.stT >= EV_WARN) { this.setState('enter'); Sound.sfx.rise2(); }
    this.glow = Math.max(0, (this.glow || 0) - dt / G.speed);
    if (this.key === 'seolmun' && this.state === 'warn') { if (Math.random() < dt * 30) fx({ x: this.home + rand(0, this.img.width), y: GROUND - 1, vx: rand(-20, 20), vy: -rand(30, 90), grav: 400, life: 0.4, kind: 'chunk', size: 1, col: pick([C.soil[3], C.stone[3]]) }); if (Math.random() < dt * 8) shake(0.05); }
    if (this.state === 'enter' && this.key === 'seolmun') {
      // 땅을 가르고 솟아오름: 흙더미가 흘러내리고 화면이 울림
      const RISE = 1.0; this.x = this.home; this.sink = Math.round(this.img.height * (1 - easeOut(Math.min(1, this.stT / RISE))));
      if (Math.random() < dt * 50) fx({ x: this.x + rand(4, this.img.width - 4), y: GROUND - rand(0, 4), vx: rand(-40, 40), vy: -rand(60, 160), grav: 420, life: rand(0.4, 0.8), kind: 'chunk', size: randi(1, 2), col: pick([C.soil[2], C.soil[3], C.leaf[2], C.stone[3]]) });
      if (Math.random() < dt * 12) { dust(this.x + rand(0, this.img.width), GROUND, 2, 0, 2); shake(0.06); }
      if (this.stT >= RISE) { this.sink = 0; this.setState('act'); shake(0.4); flashFx(0.04, '#fff2d8'); Sound.sfx.boom(); this.glow = 0.6; }
    } else if (this.state === 'enter') {
      this.x = Math.round(lerp(this.offX(), this.home, easeOut(Math.min(1, this.stT / EV_IN))));
      if (this.stT >= EV_IN) { this.setState('act'); shake(0.3); flashFx(0.03, '#fff2d8'); for (let i = 0; i < 18; i++) fx({ x: this.side > 0 ? W + rand(0, 40) : -rand(0, 40), y: rand(-VOFF + 20, GROUND - 6), vx: -this.side * rand(380, 520), life: 0.5, kind: 'streak', len: randi(10, 24), col: 'rgba(255,244,224,0.55)' }); }
    } else if (this.state === 'leave' && this.key === 'seolmun') {
      if (this.sink0 === undefined) this.sink0 = this.sink || 0;
      this.sink = Math.round(lerp(this.sink0, this.img.height, Math.min(1, this.stT / 0.9) ** 2)); if (Math.random() < dt * 20) dust(this.x + rand(0, this.img.width), GROUND, 2, 0, 1);
      if (this.stT >= 0.9) this.setState('gone');
    } else if (this.state === 'leave') {
      this.x = Math.round(lerp(this.leaveX ?? this.home, this.offX(), Math.min(1, this.stT / EV_OUT) ** 2));
      if (this.stT >= EV_OUT) this.setState('gone');
    }
    if (this.motion) {
      const m = this.motion; m.t += dt;
      if (m.kind === 'slam' && !m.landed && m.t >= m.dur * 0.66) { m.landed = true; shake(0.4); kick(0, 3); Sound.sfx.boom(); Sound.duck(0.3); dust(this.x + 12, GROUND, 6, -1, 2); dust(this.x + this.img.width - 12, GROUND, 6, 1, 2); fx({ x: this.x + this.img.width / 2, y: GROUND - 1, kind: 'ring', big: true, life: 0.4, col: C.yel[3] }); if (m.onLand) m.onLand(); }
      if (m.kind === 'spin') { const flip = Math.floor(m.t * 13) % 2; if (flip !== m.lastFlip) { m.lastFlip = flip; fx({ x: this.inner(), y: this.y0 + this.img.height * 0.4, kind: 'flare', size: 7, life: 0.12, col: '#fff4e0' }); Sound.sfx.tink(); } }
      if (m.t >= m.dur) this.motion = null;
    }
    if (this.swap && this.state === 'act') {
      const s = this.swap; s.t += dt; const k = Math.min(1, s.t / s.dur);
      if (this.key === 'halmang') { this.x = Math.round(lerp(s.x0, s.x1, k)); this.jy = Math.sin(k * Math.PI) * 90; if (Math.random() < dt * 30) fx({ x: this.x + this.img.width / 2 + rand(-30, 30), y: this.y0 + rand(10, this.img.height), vx: -Math.sign(s.x1 - s.x0) * rand(80, 160), life: 0.3, kind: 'streak', len: randi(6, 14), col: 'rgba(255,244,224,0.5)' }); }
      else if (this.key === 'murang') { this.glitch = k < 0.85 ? 1 : 0; if (k > 0.45 && !s.flipped) { this.x = s.x1; } }
      else { this.sink = Math.round(this.img.height * (k < 0.5 ? Math.min(1, k / 0.4) : Math.max(0, 1 - (k - 0.6) / 0.4))); if (k > 0.5 && !s.flipped) this.x = s.x1; if (Math.random() < dt * 30) dust(this.x + rand(0, this.img.width), GROUND, 2, 0, 1); }
      if (k > 0.5 && !s.flipped) { s.flipped = true; this.side = s.side; }
      if (k >= 1) { this.swap = null; this.jy = 0; this.sink = 0; this.glitch = 0; this.x = s.x1; shake(0.3); if (this.key === 'halmang') { Sound.sfx.boom(); dust(this.x + 10, GROUND, 6, -1, 2); dust(this.x + this.img.width - 10, GROUND, 6, 1, 2); fx({ x: this.x + this.img.width / 2, y: GROUND - 1, kind: 'ring', big: true, life: 0.35, col: C.yel[3] }); } else if (this.key === 'seolmun') { Sound.sfx.boom(); burst(this.x + this.img.width / 2, GROUND - 4, 14, [C.soil[2], C.soil[3], C.leaf[2], WATER[3]], 140, 0.6, 420, 'chunk'); } else { flashFx(0.03, '#d8f0ff'); } }
    }
    if (this.hop && this.state === 'act') {
      const h = this.hop; h.t += dt; const k = Math.min(1, h.t / h.dur);
      this.x = Math.round(lerp(h.x0, h.x1, k)); this.jy = Math.sin(k * Math.PI) * 70;
      if (k > 0.5 && h.side !== undefined) { this.side = h.side; h.side = undefined; }
      if (k >= 1) { this.hop = null; this.jy = 0; shake(0.3); kick(0, 3); if (this.key === 'knife' && Math.random() < 0.5) { const cx = this.x + this.img.width / 2, step16 = 60 / (Sound.tempo || 150) / 4 * G.speed, pside = Math.sign(P.x - cx) || 1, skipJ = clamp(Math.round((Math.abs(P.x - cx) - this.img.width / 2) / 26), 1, 6); for (let j = 1; j <= 6; j++) for (const sd of [-1, 1]) { if (sd === pside && Math.abs(j - skipJ) <= 1) continue; const xx = cx + sd * (this.img.width / 2 + j * 26); if (xx > 10 && xx < W - 10) spawnHz(new Rise(xx, 0.45 * G.speed + j * step16 * 1.5, 0.14 * G.speed, true, j)); } if (this.pat) this.pat.next = Math.max(this.pat.next, 1.9); } /* 하르방 도미노: 착지점에서 양옆으로 하르방이 차례로 솟음 */ Sound.sfx.boom(); dust(this.x + 10, GROUND, 6, -1, 2); dust(this.x + this.img.width - 10, GROUND, 6, 1, 2); burst(this.x + this.img.width / 2, GROUND - 4, 12, [C.stone[2], C.stone[3], C.soil[3]], 140, 0.6, 420, 'chunk'); fx({ x: this.x + this.img.width / 2, y: GROUND - 1, kind: 'ring', big: true, life: 0.35, col: C.yel[3] }); }
    }
    // 가장자리에 있을 때만 그쪽을 막음 (가운데로 뛰어나온 동안은 양쪽 다 열림)
    const atR = this.x > W - this.img.width - 12, atL = this.x < 8, on = (this.state === 'act' || this.state === 'enter') && !this.hop && !this.swap;
    G.arenaR = on && atR ? Math.min(W - 8, this.x + 10) : W - 8;
    G.arenaL = on && atL ? Math.max(8, this.x + this.img.width - 10) : 8;
  }
  draw() {
    if (this.state === 'warn' || this.state === 'gone') return;
    const img = this.img, talking = this.talkT > 0;
    const x = this.x + (this.shakeT > 0 ? (Math.floor(this.t * 40) % 2 ? 2 : -2) : 0);
    const y = this.y0 + (talking && Math.floor(this.t * 16) % 2 ? -2 : 0);
    g.save(); g.beginPath(); g.rect(x - 40, -VOFF, img.width + 80, GROUND + VOFF + 1); g.clip();
    const xf = this.motionXf();
    if (xf && !this.glitch) {
      const dw = Math.round(img.width * xf.sx), dh = Math.round(img.height * xf.sy), dx = Math.round(x + (img.width - dw) / 2 + xf.ox), dy = Math.round(y + img.height - dh - xf.jy);
      if (xf.shear) { for (let yy = 0; yy < img.height; yy += 4) { const off = Math.round(xf.shear * (1 - yy / img.height)); g.drawImage(img, 0, yy, img.width, 4, dx + off, dy + yy, img.width, 4); } }
      else g.drawImage(img, dx, dy, dw, dh);
    }
    else if (this.glitch) { for (let yy = 0; yy < img.height; yy += 3) { if (Math.random() < 0.35) continue; const off = Math.random() < 0.3 ? randi(-6, 6) : 0; g.drawImage(img, 0, yy, img.width, 3, x + off, y + yy, img.width, 3); } g.fillStyle = 'rgba(160,220,255,0.18)'; g.fillRect(x, y + randi(0, img.height), img.width, 2); }
    else g.drawImage(img, x, y);
    if (this.glow > 0 && EVENTS[this.key].eyes) { const k = img.cell || 2; for (const [ex, ey] of EVENTS[this.key].eyes) { const px = x + ex * k, py = y + ey * k; g.fillStyle = C.yel[3]; g.fillRect(px - 3, py, 7, 2); g.fillStyle = '#fff4e0'; g.fillRect(px - 1, py, 3, 2); if (Math.floor(this.t * 20) % 2) { g.fillStyle = 'rgba(255,208,112,0.5)'; g.fillRect(px - 6, py, 13, 1); g.fillRect(px, py - 4, 1, 9); } light(px, py, 14, '#ffd070', this.glow); } }
    if (portraitOf(this.key) === STAND_IN) drawStr('?', x + 46, y + 32, { font: 'b', color: MU('#8a84a0'), align: 'center', outline: null });
    g.restore();
  }
  // 초상 아래 장식 띠 (글자라서 2px 처리 뒤에 그림)
  drawOverlay() {
    if (this.state === 'warn' || this.state === 'gone' || (this.sink || 0) > 4 || this.hop) return;
    const img = this.img, x = this.x;
    const by = GROUND - 14, bw = img.width - 6;
    if (this.key === 'halmang') {
      uiBox(x + 2, by - 1, bw, 13, UI.warn);
      g.fillStyle = UI.warn; g.fillRect(x + 6, by + 1, 22, 9);
      uiText('LIVE', x + 17, by + 1, { color: UI.text, align: 'center' });
      uiText('태풍 특보', x + 32, by + 1);
    } else if (this.key === 'seolmun') {
      uiBox(x + 2, by - 1, bw, 13, UI.gold);
      uiText('탐라 창조 신화', x + bw / 2 + 2, by + 1, { color: UI.gold, align: 'center' });
    } else if (this.key === 'knife') {
      uiBox(x + 2, by - 1, bw, 13, UI.warn);
      uiText('칼춤 생중계', x + bw / 2 + 2, by + 1, { align: 'center' });
    } else {
      uiBox(x + 2, by - 1, bw, 13, UI.gold);
      uiText('@제주어 해석', x + 7, by + 1);
      const pr = clamp(this.stT / 5, 0, 1);
      g.fillStyle = UI.lo; g.fillRect(x + 3, by + 10, bw - 2, 1); g.fillStyle = UI.warn; g.fillRect(x + 3, by + 10, Math.round((bw - 2) * pr), 1);
    }
  }
}
// 이벤트 경고 띠: 오른쪽에서 깜빡이며 "이벤트 발생!"

// 이벤트 투척물: 중력 없이 곧게 날아감. 잠깐 조준선(예고)을 보여준 뒤 발사
class Zap {
  constructor(x, y, tx, ty, spr, speed) {
    const d = Math.hypot(tx - x, ty - y) || 1;
    this.x = this.ax = x; this.y = this.ay = y; this.vx = (tx - x) / d * speed; this.vy = (ty - y) / d * speed;
    this.spr = spr; this.t = 0; this.aim = 0.5 * G.speed; this.dodged = false;
  }
  update(dt) {
    this.t += dt;
    if (this.t < this.aim) return !this.dead;
    if (!this.launched) { this.launched = true; Sound.sfx.throw(); fx({ x: this.x, y: this.y, kind: 'flare', size: 6, life: 0.15, col: C.org[3] }); }
    if (Math.random() < dt * 40) fx({ x: this.x, y: this.y, vx: this.vx * 0.2, vy: this.vy * 0.2, life: 0.2, kind: 'trail', col: this.isText ? C.yel[3] : C.org[2] });
    this.x += this.vx * dt; this.y += this.vy * dt;
    return !this.dead && this.x > -20 && this.x < W + 20 && this.y > -VOFF - this.spr.height && this.y < GROUND + 10;
  }
  boxes() { return this.t < this.aim ? NONE : [{ x: this.x - 4, y: this.y - 4, w: 8, h: 8 }]; }
  onShot() { this.dead = true; if (this.spr.metal) { spark(this.x, this.y); Sound.sfx.tink(); reward('shatter', this.x, this.y - 8); return true; } burst(this.x, this.y, 8, ['#5e6e34', '#8a9a48'], 70, 0.4, 0); Sound.sfx.splat(); reward('shatter', this.x, this.y - 8); return true; }
  draw() {
    if (this.t < this.aim) {
      if (Math.floor(this.t * 16) % 2) return;
      const m = Math.hypot(this.vx, this.vy), ux = this.vx / m, uy = this.vy / m;
      g.fillStyle = C.red[2];
      for (let i = 1; i < 16; i++) g.fillRect(Math.round(this.ax + ux * i * 10), Math.round(this.ay + uy * i * 10), 2, 2);
      return;
    }
    const spr = this.vx < 0 && this.spr.flip ? this.spr.flip : this.spr;
    g.drawImage(spr, Math.round(this.x - spr.width / 2), Math.round(this.y - spr.height / 2));
  }
}

// ═════════════════════════════════════════════════════════════
//  웨이브 패턴
// ═════════════════════════════════════════════════════════════
class Pattern { constructor(dur) { this.t = 0; this.dur = dur; } get done() { return this.t >= this.dur; } end() {} }
class PatRise extends Pattern {
  constructor() { super(7.5); this.next = 0.3; }
  update(dt) {
    this.t += dt; this.next -= dt;
    if (this.next > 0 || this.t > this.dur - 1.2) return;
    const D = G.diff, warn = Math.max(0.6, 0.95 - D * 0.06) * G.speed;
    if (Math.random() < (D >= 0.5 ? 0.5 : 0.3) && !this.justWaved && !this.paired && G.patterns.length <= 1) {
      // 돌하르방 행렬: 땅이 갈라지며 하르방이 16분음표 박자로 쭈루루룩 차례로 솟음
      const mode = pick(D >= 1 ? ['sweep', 'converge', 'pingpong', 'gap'] : ['sweep', 'sweep', 'gap']), step16 = 60 / (Sound.tempo || 138) / 4 * G.speed;
      const lead = beatLead(warn), hold = 0.14 * G.speed, n = Math.ceil((W - 32) / 26) + 1, xs = Array.from({ length: n }, (_, i) => 16 + i * (W - 32) / (n - 1)), dir = pick([-1, 1]);
      const at = (i) => dir > 0 ? i : n - 1 - i;
      if (mode === 'sweep' || mode === 'gap') { const gap = mode === 'gap' ? randi(3, n - 5) : -9; xs.forEach((x, i) => { const j = at(i); if (Math.abs(j - gap) <= 1) return; spawnHz(new Rise(x, lead + j * step16, hold, true, j)); }); this.next = 2.4 + n * step16; }
      else if (mode === 'converge') { xs.forEach((x, i) => { if (i === n >> 1) return; spawnHz(new Rise(x, lead + Math.min(i, n - 1 - i) * step16 * 1.3, hold, true, i)); }); this.next = 2.6 + n * step16 * 0.7; }   // 만나는 가운데 한 칸은 비움
      else { xs.forEach((x, i) => { const j = at(i); spawnHz(new Rise(x, lead + j * step16, hold, true, j)); if (j < n - 3) spawnHz(new Rise(x, lead + (2 * n - 1 - j) * step16 + 2 * 60 / (Sound.tempo || 138) * G.speed, hold, true, j)); }); this.next = 3 + n * step16 * 2; }   // 되돌아올 땐 끝 세 칸은 비워 둠 (돌아서는 자리 = 안전지대)
      this.justWaved = true; Sound.sfx.alarm();
    } else {
      this.justWaved = false;
      const n = 1 + (Math.random() < 0.25 + D * 0.12 ? 1 : 0) + (D >= 3 && Math.random() < 0.35 ? 1 : 0);
      const xs = [clamp(P.x + rand(-10, 10), 16, W - 16)];
      for (let k = 0; xs.length < n && k < 40; k++) { const x = rand(16, W - 16); if (xs.every(o => Math.abs(o - x) > 40)) xs.push(x); }
      xs.forEach(x => spawnHz(new Rise(x, warn, 0.8)));
      this.next = Math.max(0.65, 1.4 - D * 0.12);
    }
  }
}
class PatHop extends Pattern {
  constructor() { super(7); this.next = 0.2; }
  update(dt) {
    this.t += dt; this.next -= dt;
    if (this.next > 0 || this.t > this.dur - 1) return;
    const dir = pick([-1, 1]); spawnHz(new Hopper(dir));
    if (G.diff >= 2 && Math.random() < 0.3) spawnHz(new Hopper(-dir));
    this.next = Math.max(0.5, 1.2 - G.diff * 0.1) * rand(0.8, 1.2);
  }
}
class PatMeteor extends Pattern {
  constructor() { super(8.5); this.next = 1.4; const cf = themeCfg(); if (cf.indoor) { Sound.sfx.rumble(); shake(0.5); } else { if (cf.volcano) G.volcano.erupt = this.dur; Sound.sfx.erupt(); shake(0.6); flashFx(0.07, '#ff9a3a'); } }   // 동굴에선 천장이 우르르 (화산 분화 효과 없음)
  update(dt) {
    this.t += dt; this.next -= dt;
    if (this.next > 0 || this.t > this.dur - 1.4) return;
    const D = G.diff, fall = Math.max(0.85, 1.2 - D * 0.05) * G.speed;
    if (D >= 1 && !this.barraged && !G.hz.some(h => h instanceof Meteor && h.phase !== 'boom' && (h.phase === 'fall' || h.phase === 'lava')) && Math.random() < 0.35) {
      // 화산탄 줄폭격: 화산 쪽에서부터 8분음표마다 한 발씩 줄지어 떨어짐 · 숨비 근처에 두 칸짜리 빈자리
      this.barraged = true; const step8 = 60 / (Sound.tempo || 138) / 2 * G.speed, xs = []; for (let x = 18; x < G.arenaR - 10; x += 40) xs.push(x);
      const near = xs.reduce((bi, x, i) => Math.abs(x - P.x) < Math.abs(xs[bi] - P.x) ? i : bi, 0), gap = clamp(near + pick([-1, 0, 1]), 0, xs.length - 2), rev = Math.random() < 0.5;
      const lead = beatLead(fall); xs.forEach((x, i) => { if (i === gap || i === gap + 1) return; const j = rev ? xs.length - 1 - i : i; const m = new Meteor(x, lead + j * step8); m.chain = true; spawnHz(m); });
      if (themeCfg().indoor) Sound.sfx.rumble(); else Sound.sfx.erupt(); shake(0.4); this.next = 2.2 + xs.length * step8; return;
    }
    const tx = Math.random() < 0.6 ? P.x + rand(-40, 40) : rand(10, W - 10);
    spawnHz(new Meteor(tx, fall));
    if (D >= 2 && Math.random() < 0.3) spawnHz(new Meteor(tx + pick([-1, 1]) * rand(40, 70), fall + 0.15));
    this.next = Math.max(0.3 * G.speed, 0.24, 0.65 - D * 0.07) * rand(0.8, 1.2);   // 고배속에서도 실제로 0.3초에 한 발 이하
  }
}
class PatPony extends Pattern {
  constructor() { super(8); this.next = 0.2; }
  update(dt) {
    this.t += dt; this.next -= dt;
    if (this.next > 0 || this.t > this.dur - 2) return;
    const dir = pick([-1, 1]), n = Math.min(4, 1 + randi(0, Math.floor(1 + G.diff)));
    G.warnings.push({ side: -dir, t: 0, dur: 1.0 * G.speed, spawn: () => {
      let off = 0;
      for (let i = 0; i < n; i++) { spawnHz(new Pony(dir, off)); off += 28 + (Math.random() < 0.5 ? rand(2, 8) : rand(76, 104)); }
      Sound.sfx.neigh();
    } });
    this.next = Math.max(1.6, 2.8 - G.diff * 0.2);
  }
}
class PatWind extends Pattern {
  constructor() { super(7.5); this.dir = pick([-1, 1]); this.next = 1.0; this.started = false; Sound.sfx.whoosh(); }
  update(dt) {
    this.t += dt; this.next -= dt;
    if (this.t > 0.8) { this.started = true; G.windTarget = this.dir * Math.min(52, 48 + G.diff * 6); }   /* 맞바람에도 움직일 수 있게 */
    if (Math.random() < dt * 30) fx({ x: this.dir > 0 ? -10 : W + 10, y: rand(20, GROUND - 2), vx: this.dir * rand(220, 320), life: 1.6, kind: 'streak', len: randi(6, 16), col: 'rgba(255,244,224,0.5)' });
    if (this.started && Math.random() < dt * 12) fx({ x: this.dir > 0 ? -4 : W + 4, y: rand(90, GROUND), vx: this.dir * rand(90, 160), vy: rand(-20, 20), life: 2.5, col: pick([C.yel[2], C.yel[3], C.leaf[3]]), kind: 'petal' });
    if (this.started && Math.random() < dt * 4) Sound.sfx.gust();
    if (!this.started || this.next > 0 || this.t > this.dur - 1) return;
    const pb = Math.random() < 0.14 ? new Tewak(this.dir) : new Pebble(this.dir);
    if (pb instanceof Pebble) { if (this.lastLow && pb.y < GROUND - 24) pb.x -= this.dir * 55; this.lastLow = pb.y > GROUND - 10; }   // 낮은 돌 뒤 높은 돌은 착지할 틈을 두고
    spawnHz(pb);
    this.next = Math.max(0.24 * G.speed, Math.max(0.22, 0.55 - G.diff * 0.06) * rand(0.7, 1.3));
  }
  end() { G.windTarget = 0; }
}
const QUIZ = [
  { q: "'하영'은 무슨 뜻?", a: '많이', b: '조금' }, { q: "'ᄒᆞᆫ저옵서예'는?", a: '어서 오세요', b: '혼자 오세요' },
  { q: "'속솜ᄒᆞ라'는?", a: '조용히 해', b: '속상하다' }, { q: "'재게재게'는?", a: '빨리빨리', b: '천천히' },
  { q: "'게메'는?", a: '글쎄', b: '게다가' }, { q: "'무사?'는?", a: '왜?', b: '무사히' },
  { q: "'폭싹 속았수다'는?", a: '수고했어요', b: '완전 속았다' }, { q: "'놀멍 쉬멍'은?", a: '놀면서 쉬면서', b: '놀고 싶다' },
  { q: "'이디'는?", a: '여기', b: '어디' }, { q: "'몽캐지 말라'는?", a: '꾸물대지 마', b: '뭉치지 마' },
  { q: "'맨도롱 또똣'은?", a: '알맞게 따뜻한', b: '시원한' }, { q: "'삼춘'은 누구?", a: '동네 어르신', b: '아빠 동생만' },
  { q: "'바당'은?", a: '바다', b: '바닥' }, { q: "'도새기'는?", a: '돼지', b: '도시락' },
  { q: "'지슬'은?", a: '감자', b: '이슬' }, { q: "'감저'는?", a: '고구마', b: '감자' },
  { q: "'ᄒᆞᆫ디'는?", a: '함께', b: '혼자' }, { q: "'와리지 말라'는?", a: '서두르지 마', b: '웃지 마' },
  { q: "'지꺼지다'는?", a: '기쁘다', b: '시끄럽다' }, { q: "'졸바로'는?", a: '똑바로', b: '졸면서' },
  { q: "'낭'은?", a: '나무', b: '낭떠러지' }, { q: "'어멍'은?", a: '어머니', b: '엄청' },
];
class Answer {
  constructor(text, x, ok) { this.text = text; this.x = x; this.y = GROUND - 50; this.ok = ok; this.t = 0; this.spr = uiSprite(text, ok === undefined ? UI.gold : UI.gold); }
  update(dt) { this.t += dt; this.y = GROUND - 50 + Math.round(Math.sin(this.t * 3) * 3); return !this.dead; }
  box() { const s = this.spr; return { x: this.x - s.width / 2, y: this.y, w: s.width, h: s.bodyH }; }
  draw() {
    const s = this.spr, k = easeBack(Math.min(1, this.t / 0.3));
    g.drawImage(s, Math.round(this.x - s.width / 2), Math.round(this.y + (1 - k) * 8));
    if (this.t > 0.4 && Math.floor(this.t * 3) % 2) { const ax = Math.round(this.x), ay = this.y + s.bodyH + 3; g.fillStyle = INK; g.fillRect(ax - 3, ay - 1, 7, 5); g.fillStyle = C.yel[3]; g.fillRect(ax, ay, 1, 3); g.fillRect(ax - 1, ay + 1, 3, 1); g.fillRect(ax - 2, ay + 2, 5, 1); }
  }
}
class PatQuiz extends Pattern {
  constructor() {
    super(7.5); const q = pick(QUIZ); this.q = q;
    const left = Math.random() < 0.5;
    this.list = [new Answer(q.a, left ? W / 2 - 76 : W / 2 + 76, true), new Answer(q.b, left ? W / 2 + 76 : W / 2 - 76, false)];
    G.answers = this.list; Sound.sfx.quiz();
    G.banners = G.banners.filter(b => !b.quiz); G.banners.splice(G.banners[0] && G.banners[0].t > 0 ? 1 : 0, 0, { title: '제주어 시험', sub: q.q, col: C.yel[2], t: 0, dur: this.dur, quiz: true });
  }
  update(dt) {
    this.t += dt;
    for (const a of this.list) a.update(dt);
    const pb = playerBox();
    for (const a of this.list) if (!a.dead && overlap(pb, a.box())) {
      this.list.forEach(o => { o.dead = true; burst(o.x, o.y + 6, 10, o.ok ? [C.yel[3], '#ffffff'] : ['#a8a0b8'], 70, 0.5, 120); });
      if (a.ok) { giveStar('quiz'); giveAmmo(3); addScore(300, a.x, a.y - 6); popup('정답! 귤 +3', a.x, a.y - 16, C.yel[2], 'b', true); Sound.sfx.clear(); }
      else { popup(`오답 · 정답은 '${this.q.a}'`, a.x, a.y - 16, '#c8c0d8', 's'); Sound.sfx.empty(); }
      this.t = Math.max(this.t, this.dur - 0.8); G.banners = G.banners.filter(b => !b.quiz);
    }
  }
  end() { G.answers = null; G.banners = G.banners.filter(b => !b.quiz); }
}
// ── ᄒᆞᆫ저옵서예~: 관광객 캐리어 ──
class Suitcase {
  constructor(dir, off) { this.dir = dir; this.k = randi(0, SUITCASES.length - 1); this.big = SUITCASES[this.k].big; this.x = dir > 0 ? -14 - off : W + 14 + off; this.y = GROUND; this.vy = 0; this.stompable = true; this.speed = rand(115, 150) + G.diff * 10; this.hop = Math.random() < 0.35; this.dodged = false; this.bouncy = true; this.rot = 0; }
  update(dt) {
    this.x += this.dir * this.speed * dt; this.rot += dt * 18;
    if (this.hop) { this.vy += 700 * dt; this.y += this.vy * dt; if (this.y >= GROUND) { this.y = GROUND; this.vy = -Math.abs(this.vy) * 0.22; if (Math.abs(this.vy) < 25) { this.vy = 0; this.hop = false; } dust(this.x, GROUND, 2); } }
    if (this.x > -10 && this.x < W + 10 && Math.random() < dt * 10) fx({ x: this.x - this.dir * 6, y: GROUND, vx: -this.dir * 20, vy: -10, life: 0.25, kind: 'puff', size: 1 });
    return !this.dead && (this.dir > 0 ? this.x < W + 30 : this.x > -30);
  }
  boxes() { const s = SUITCASES[this.k].r; return [{ x: this.x - s.width / 2 + 2, y: this.y - s.height + 6, w: s.width - 4, h: s.height - 7 }]; }
  // 밟으면 뚜껑이 열리며 짐이 와르르 (밟기 보상)
  kill(by) { this.dead = true; burst(this.x, this.y - 10, 16, ['#f4f0e0', '#e87a9a', '#4aa3ec', '#f2c84a'].map(c => mute(c)), 110, 0.6, 360, 'chunk'); Sound.sfx.shatter(); reward(by === 'stomp' ? 'stompKill' : 'shatter', this.x, this.y - 20); }
  onShot() { this.kill('shot'); return true; }
  draw() { const s = SUITCASES[this.k][this.dir > 0 ? 'l' : 'r']; drawShadow(this.x, s.width - 2); g.drawImage(s, Math.round(this.x - s.width / 2), Math.round(this.y - s.height + 3)); }
}
// ── 똥돼지 질주 ──
class Pig {
  constructor(dir, off) { this.dir = dir; this.x = dir > 0 ? -16 - off : W + 16 + off; this.y = GROUND; this.vy = 0; this.bouncy = true; this.speed = (rand(175, 215) + G.diff * 12) * Math.min(1, 1.35 / G.speed); this.anim = Math.random() * 4; this.leap = Math.random() < 0.3 + G.diff * 0.08; this.leaped = false; this.dodged = false; this.bouncy = true; }
  update(dt) {
    this.x += this.dir * this.speed * dt; this.anim += dt * this.speed / 12;
    if (this.leap && !this.leaped && Math.abs(this.x - P.x) < 130) { this.leaped = true; this.vy = -230; Sound.sfx.oink(); dust(this.x, GROUND, 4, 0, 1); fx({ x: this.x, y: GROUND - 18, kind: 'flare', size: 5, life: 0.15, col: C.yel[3] }); }
    if (this.y < GROUND || this.vy < 0) { this.vy += 760 * dt; this.y += this.vy * dt; if (this.y >= GROUND) { this.y = GROUND; this.vy = 0; dust(this.x, GROUND, 3); } }
    if (this.x > -10 && this.x < W + 10 && Math.random() < dt * 18) dust(this.x - this.dir * 10, GROUND, 1, -this.dir);
    return !this.dead && (this.dir > 0 ? this.x < W + 30 : this.x > -30);
  }
  boxes() { return [{ x: this.x - 11, y: this.y - 14, w: 22, h: 12 }]; }
  draw() { const f = PIG[Math.floor(this.anim) % 4][this.dir > 0 ? 'r' : 'l'], bob = this.leap && !this.leaped ? -Math.round(Math.abs(Math.sin(this.anim * 1.57)) * 3) : 0; drawShadow(this.x, 20); g.drawImage(f, Math.round(this.x - f.ax), Math.round(this.y - f.ay) + bob); }
  onBounce() { Sound.sfx.oink(); this.squash = 0.15; return true; }   // 밟으면 꿀꿀 · 등을 디딤돌 삼아 튀어 오름
  onShot(s) { spark(s.x, s.y); Sound.sfx.oink(); return true; }
}
class PatSuitcase extends Pattern {
  constructor() { super(7.5); this.next = 0.3; this.flash = 1.5; }
  update(dt) {
    this.t += dt; this.next -= dt; this.flash -= dt;
    if (this.flash <= 0 && this.t < this.dur - 1) { this.flash = rand(1.4, 2.4); flashFx(0.03, '#fff4e0'); Sound.sfx.shutter(); }
    if (this.next > 0 || this.t > this.dur - 2) return;
    const dir = pick([-1, 1]), n = 1 + randi(0, Math.min(3, 1 + Math.floor(G.diff)));
    G.warnings.push({ side: -dir, kind: 'case', t: 0, dur: Math.max(0.6, 0.9 - G.diff * 0.06) * G.speed, spawn: () => { let off = 0; for (let i = 0; i < n; i++) { spawnHz(new Suitcase(dir, off)); off += rand(30, 70); } Sound.sfx.roll(); } });
    this.next = Math.max(1.1, 2.0 - G.diff * 0.18);
  }
}
class PatPig extends Pattern {
  constructor() { super(7); this.next = 0.3; Sound.sfx.oink(); }
  update(dt) {
    this.t += dt; this.next -= dt;
    if (this.next > 0 || this.t > this.dur - 1.8) return;
    const dir = pick([-1, 1]), n = 1 + randi(0, Math.min(2, Math.floor(G.diff)));
    G.warnings.push({ side: -dir, kind: 'pig', t: 0, dur: Math.max(0.6, 0.9 - G.diff * 0.06) * G.speed, spawn: () => { let off = 0; for (let i = 0; i < n; i++) { spawnHz(new Pig(dir, off)); off += rand(60, 110); } Sound.sfx.oink(); } });
    this.next = Math.max(1.2, 2.1 - G.diff * 0.16);
  }
}
class PatHarvest extends Pattern {
  constructor() { super(8); this.next = 0.5; }
  update(dt) {
    this.t += dt; this.next -= dt;
    if (this.next > 0 || this.t > this.dur - 1.2) return;
    const x = rand(14, W - 14);
    if (Math.random() < 0.45 + G.diff * 0.05) { const sl = Math.max(1, G.speed / 1.5), r = new Rotten(x, -VOFF - 10, 0, 40 / sl); r.grav = 560 / (sl * sl); r.falling = true; r.life = 3.2 * sl; spawnHz(r); G.decals.push({ x, t: 0, life: 0.9 * sl, mark: true }); }   // 고배속에선 천천히 떨어져 실제 경고 시간이 0.5초 넘게
    else G.pickups.push(new Pickup('tang', x, -VOFF - 10, rand(-20, 20), 20));
    this.next = Math.max(0.12 * G.speed, 0.16, 0.42 - G.diff * 0.05) * rand(0.7, 1.3);   // 실제로 0.12초에 하나 이하
  }
}
class PatTyphoon extends Pattern {   // 태풍 상륙: 정전 → 먹구름 · 비바람 · 갈래 번개 (번개 칠 때 잠깐 보임)
  constructor() { super(9); this.next = 1.2; this.bolt = 1.4; this.dir = pick([-1, 1]); G.dark = 0.01; G.storm = 0; G.stormDir = this.dir; Sound.sfx.whoosh(); }
  update(dt) {
    this.t += dt; this.next -= dt; this.bolt -= dt;
    const out = this.t > this.dur - 0.8;
    G.dark = out ? Math.max(0, G.dark - dt * 2) : this.t < 0.75 ? (Math.floor(this.t * 12) % 3 === 1 ? 0.12 : Math.min(1, this.t * 1.6)) : Math.min(1, G.dark + dt * 2);   // 처음엔 전기가 나가듯 깜빡이며 어두워짐
    G.storm = out ? Math.max(0, G.storm - dt * 1.5) : Math.min(1, G.storm + dt * 1.2);
    G.windTarget = this.dir * Math.min(52, 30 + G.diff * 5);
    const d = this.dir, up = d > 0 ? -60 : 60;
    if (Math.random() < dt * 75) fx({ x: rand(0, W) + up, y: -VOFF - 6, vx: d * rand(80, 110), vy: rand(320, 380), life: 0.9, kind: 'rain', len: randi(5, 7), near: true, col: 'rgba(205,220,245,0.7)' });   // 앞 빗줄기
    if (Math.random() < dt * 55) fx({ x: rand(0, W) + up, y: -VOFF - 6, vx: d * 60, vy: 240, life: 1.2, kind: 'rain', len: 3, col: 'rgba(165,180,215,0.35)' });   // 먼 빗줄기
    if (Math.random() < dt * 4) fx({ x: d > 0 ? -6 : W + 6, y: rand(40, GROUND - 6), vx: d * rand(170, 250), vy: rand(-30, 20), life: 2.6, kind: 'petal', col: pick([C.leaf[2], C.leaf[3], C.org[2]]) });   // 바람에 날리는 잎
    if (Math.random() < dt * 7) fx({ x: d > 0 ? -12 : W + 12, y: rand(-VOFF + 30, GROUND - 4), vx: d * rand(300, 420), life: 1.1, kind: 'streak', len: randi(8, 18), col: 'rgba(225,232,245,0.4)' });   // 돌풍 줄
    if (this.bolt <= 0 && this.t < this.dur - 1) {
      this.bolt = rand(1.2, 2.2); this.flash2 = 0.11; G.lightning = Math.max(G.lightning || 0, 0.16); Sound.sfx.thunder(); shake(0.2);
      const pts = []; let bx = rand(30, W - 30); for (let y = -VOFF; y < GROUND - 64; y += randi(5, 9)) { bx += rand(-7, 7); pts.push([Math.round(bx), y]); }   // 하늘에서 먼 땅으로 내리꽂히는 갈래 번개
      const br = []; for (let k = 0; k < 2; k++) { const s0 = pts[randi(2, Math.max(3, pts.length - 4))]; let x2 = s0[0], y2 = s0[1]; const sd = pick([-1, 1]), seg = [[x2, y2]]; for (let j = 0; j < randi(3, 5); j++) { x2 += sd * rand(3, 8); y2 += randi(4, 8); seg.push([Math.round(x2), y2]); } br.push(seg); }
      G.boltFx = { pts, br, t: 0.22 };
    }
    if (this.flash2 > 0) { this.flash2 -= dt; if (this.flash2 <= 0) G.lightning = Math.max(G.lightning || 0, 0.07); }   // 번쩍 · 번쩍 두 번
    if (this.next > 0 || this.t > this.dur - 1.5) return;
    if (Math.random() < 0.55) spawnHz(Math.random() < 0.15 ? new Tewak(this.dir) : new Pebble(this.dir));
    else spawnHz(new Rise(clamp(P.x + rand(-30, 30), 16, W - 16), Math.max(0.7, 0.9 - G.diff * 0.05) * G.speed, 0.6));
    this.next = Math.max(0.45, 1.0 - G.diff * 0.1);
  }
  end() { G.dark = 0; G.windTarget = 0; G.storm = 0; G.boltFx = null; }
}
// 태풍 먹구름 띠: 화면 위를 덮고 바람 따라 흘러감 (아래 가장자리는 비 장막)
let STORM_CLOUDS = null;
function stormClouds() {
  if (STORM_CLOUDS) return STORM_CLOUDS;
  const c = mk(W * 2, 76), x = c.getContext('2d'), pal = ['#1a1d28', '#262a38', '#343a4c', '#454c60'].map(k => mute(k));
  x.fillStyle = pal[1]; x.fillRect(0, 0, c.width, 24);
  for (let i = -40, k = 0; i < c.width + 40; i += 46, k++) { const cs = cloudSprite(80 + (k % 3) * 22, 30 + (k % 2) * 8, 301 + k * 7, pal); x.drawImage(cs, i + 23, -6 + (k % 2) * 5); x.drawImage(cs, i, 14 + (k % 3) * 5); }
  for (let i = 0; i < c.width; i += 3) { const len = 4 + Math.floor(hash2(i, 1, 311) * 10); x.fillStyle = 'rgba(40,46,62,0.35)'; x.fillRect(i, 56 + Math.floor(hash2(i, 2, 312) * 6), 1, len); }   // 비 장막
  return (STORM_CLOUDS = c);
}
function drawStorm() {   // 배경 위 · 등장물 아래: 먹구름 · 어두운 색조 · 갈래 번개
  const k = G.storm || 0; if (k <= 0) return;
  g.fillStyle = `rgba(28,34,52,${0.44 * k})`; g.fillRect(-10, -VOFF - 10, W + 20, H + 20);
  const sc = stormClouds(), off = (((amb.t * 26 * (G.stormDir || 1)) % W) + W) % W;
  g.globalAlpha = k; g.drawImage(sc, -off, -VOFF - 4 - Math.round((1 - k) * 30)); g.drawImage(sc, W * 2 - off, -VOFF - 4 - Math.round((1 - k) * 30)); g.globalAlpha = 1;
  const b = G.boltFx; if (b && b.t > 0 && Math.floor(b.t * 26) % 2 === 0) {
    const seg = (pts, w, col) => { for (let i = 0; i < pts.length - 1; i++) pxLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, col); };
    g.globalAlpha = 0.5; seg(b.pts, 3, '#a8b8ff'); g.globalAlpha = 1; seg(b.pts, 1, '#ffffff'); for (const br of b.br) seg(br, 1, '#dce4ff');
    light(b.pts[b.pts.length - 1][0], b.pts[b.pts.length - 1][1], 40, '#c8d4ff', 0.9);
  }
}
