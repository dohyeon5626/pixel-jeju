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
// 뭐랭하멘 "해석 폭탄": 사투리 단어가 날아가다 해석되며 표준어 글자로 세 갈래 산개 (중력 없음)
class SplitZap extends Zap {
  constructor(x, y, tx, ty, word, meaning, speed) {
    super(x, y, tx, ty, wordSprite(word, 'kind'), speed); this.meaning = meaning; this.splitT = this.aim + 0.55; this.isText = true;
  }
  update(dt) {
    if (!super.update(dt)) return false;
    if (this.t >= this.splitT) {
      this.dead = true; Sound.sfx.pop(); shake(0.12); fx({ x: this.x, y: this.y, kind: 'ring', life: 0.3, col: C.yel[3] }); fx({ x: this.x, y: this.y, kind: 'flare', size: 10, life: 0.2, col: C.yel[3] });
      popup('해석!', this.x, this.y - 12, C.yel[3], 's');
      const chars = graphemes(this.meaning.replace(/[\s!?,.]/g, '')).slice(0, 3), base = Math.atan2(this.vy, this.vx), sp = Math.hypot(this.vx, this.vy) * 1.1;
      chars.forEach((ch, i) => {
        const a = base + (i - (chars.length - 1) / 2) * 0.42, z = new Zap(this.x, this.y, this.x + Math.cos(a) * 100, this.y + Math.sin(a) * 100, wordSprite(ch, 'n'), sp);
        z.aim = 0.3 * G.speed; z.isText = true; z.pat = this.pat; spawnHz(z);   /* 갈라진 글자도 잠깐 조준선 */
      });
      return false;
    }
    return true;
  }
  onShot() { this.dead = true; popup('격파', this.x, this.y - 12, '#ffffff', 's'); reward('shatter', this.x, this.y - 8); Sound.sfx.tink(); return true; }
}
// ── 할망 시그니처 1: 이퀄라이저 비트 바 — 랩 박자에 맞춰 땅에서 막대가 솟음 (한 박 전에 바닥이 깜빡) ──
// 주상절리 기둥: 윗면은 육각 · 오각 다각형(살짝 내려다본 모양), 앞으로 보이는 면 2~3개, 면을 따라 휘는 가로 마디 · 숨구멍
//  모양 4종을 미리 굽고, 기둥마다 높이를 달리해 실제 주상절리처럼 들쭉날쭉하게
const BASALT_TOPS = [
  [[1, 3], [4, 0], [10, 0], [13, 3], [10, 6], [4, 6]],          // 정육각
  [[1, 2], [7, 0], [13, 2], [11, 6], [3, 6]],                    // 오각
  [[1, 4], [3, 1], [9, 0], [13, 2], [12, 5], [6, 7]],            // 찌그러진 육각
  [[1, 2], [5, 0], [12, 1], [13, 5], [8, 7], [2, 6]],            // 비스듬한 육각
];
const BASALTS = BASALT_TOPS.map((poly, vi) => {
  const w = 15, h = 66, pb = new PB(w, h), S = C.stone;
  const inPoly = (px, py) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c; } return c; };
  // 아랫 윤곽: 다각형에서 화면 쪽(아래)으로 보이는 꼭짓점 사슬 → 왼쪽 끝 ~ 오른쪽 끝
  const minX = Math.min(...poly.map(p => p[0])), maxX = Math.max(...poly.map(p => p[0]));
  const iL = poly.findIndex(p => p[0] === minX), iR = poly.findIndex(p => p[0] === maxX), chain = [];
  for (let i = iL; ; i = (i - 1 + poly.length) % poly.length) { chain.push(poly[i]); if (i === iR) break; }
  if (chain.reduce((a, p) => a + p[1], 0) / chain.length < 3) { chain.length = 0; for (let i = iL; ; i = (i + 1) % poly.length) { chain.push(poly[i]); if (i === iR) break; } }
  const segOf = x => { for (let k = 0; k < chain.length - 1; k++) if (x <= chain[k + 1][0]) return k; return chain.length - 2; };
  const lowY = x => { const k = segOf(x), [x0, y0] = chain[k], [x1, y1] = chain[k + 1]; return y0 + (y1 - y0) * (x1 === x0 ? 0 : (x - x0) / (x1 - x0)); };
  const nSeg = chain.length - 1, faceCol = k => { const sl = (chain[k + 1][1] - chain[k][1]) / Math.max(1, chain[k + 1][0] - chain[k][0]); return sl > 0.4 ? mix(S[3], S[4], 0.35) : sl < -0.4 ? S[1] : S[2]; };   // 왼쪽으로 기운 면이 빛을 받음
  const joints = []; for (let y = 9 + vi * 2; y < h - 4; y += 7 + ((y * 7 + vi * 3) % 5)) joints.push(y);
  // 옆면
  for (let x = minX; x <= maxX; x++) {
    const ly = lowY(x), k = segOf(x), edge = chain.slice(1, -1).some(p => Math.abs(p[0] - x) < 0.5);
    for (let y = Math.round(ly); y < h; y++) {
      const d = y - ly; let c = faceCol(k);
      if (edge) c = mix(S[0], S[1], 0.4);                                          // 면과 면 사이 모서리 (진하게 → 각이 보이게)
      if (x === minX || x === maxX) c = S[0];
      if (joints.some(j => Math.round(d) === j)) c = S[0];                          // 마디: 면 윤곽을 따라 휘어짐
      else if (joints.some(j => Math.round(d) === j + 1) && !edge) c = mix(c, S[4], 0.4);
      else if (hash2(x, y, 6 + vi) < 0.12) c = mix(c, S[0], 0.55);                 // 숨구멍
      if (y > h - 9 && hash2(x, y, 8) < 0.35) c = mix(c, C.leaf[1], 0.5);         // 밑동 이끼
      pb.set(x, y, c);
    }
  }
  // 윗면: 밝은 다각형 + 진한 테두리로 육각 · 오각 모양이 또렷하게
  for (let y = 0; y < 9; y++) for (let x = minX; x <= maxX; x++) {
    if (!inPoly(x + 0.5, y + 0.5)) continue;
    const rim = !inPoly(x - 0.5, y + 0.5) || !inPoly(x + 1.5, y + 0.5) || !inPoly(x + 0.5, y - 0.5) || !inPoly(x + 0.5, y + 1.5);
    const lit = (x - minX) / (maxX - minX) < 0.5 && y < 3;
    pb.set(x, y, rim ? S[0] : lit ? mix(S[4], '#ffffff', 0.2) : hash2(x, y, 4 + vi) < 0.15 ? S[3] : S[4]);
  }
  return selOut(pb).canvas();
});
// 사투리 할머니의 한마디: 이 문장 글자가 한 자씩 땅에서 솟아오름 (공백 자리는 비어 있어 숨을 곳)
const HALMANG_LINE = '쾅 ᄒᆞ는 소리 헨, "아이고, 베락 털어졈신가?" 영 걷어진 쥥은 몰르곡 경헨, 나왕 보고들랑 영헤연, 바...ᄇᆞᆰ도록 ᄌᆞᆷ ᄒᆞᆫᄌᆞᆷ들 안 잣수다, 이 셋동네 사름들.';
const LINE_G = graphemes(HALMANG_LINE).filter(ch => !/[",.?…]/.test(ch));   // 글자와 띄어쓰기만 (문장부호는 빼고)
const letterSpr = ch => logoText(ch, 2, ['#5a4632', '#8a6a44', '#b8905a', '#e0bc7a', '#fff0c8']);
class BeatBar { // 할망 비트에 맞춰 땅에서 솟는 주상절리 기둥 (ch가 있으면 그 글자가 솟음)
  constructor(x, beatAt, clock, tall = false, ch = null) {
    this.ch = ch; if (ch) { this.spr = letterSpr(ch); this.H = this.spr.height - 18; } else { this.H = (tall ? 50 : 33) + randi(-5, 5); this.spr = pick(BASALTS); } this.x = x; this.beatAt = beatAt; this.b0 = clock(); this.clock = clock; this.h = 0; this.t = 0; this.dodged = false; this.up = false; this.done = false; this.lastB = Math.floor(clock());
    this.crack = []; for (const s of [-1, 1]) { let cx = 0, cy = 0; for (let i = 0; i < 7; i++) { cx += s * randi(1, 2); if (Math.random() < 0.5) cy = clamp(cy + randi(-1, 1), 0, 2); this.crack.push([cx, cy]); } }
  }
  get b() { return this.clock(); }
  update(dt) {
    this.t += dt;
    const b = this.b;
    // 박자마다 그 자리 흙알갱이가 톡톡 튐 (언제 솟을지 몸으로 느끼게)
    if (!this.up && Math.floor(b) > this.lastB) { this.lastB = Math.floor(b); const last = this.beatAt - b < 1.05; for (let i = 0; i < (last ? 4 : 2); i++) fx({ x: this.x + rand(-5, 5), y: GROUND - 1, vx: rand(-15, 15), vy: -rand(40, last ? 110 : 70), grav: 420, life: 0.35, kind: 'chunk', size: 1, col: pick([C.soil[3], C.stone[3]]) }); }
    if (!this.up && (b >= this.beatAt || this.t > ((this.beatAt - this.b0) * 60 / (Sound.tempo || 92) + 1) * G.speed)) {   // 박자 시계가 멈춰도 결국은 솟음
      this.up = true; this.upT = 0; shake(this.acc ? 0.07 : 0.03); Sound.sfx.burst(this.acc); if (this.ch) Sound.sfx.letter(this.j || 0, this.acc);   /* 땅을 뚫는 쿵 (+ 글자는 음계 소리) */
      for (const sd of [-1, 1]) fx({ x: this.x + sd * 6, y: GROUND - 1, vx: sd * 40, vy: -10, drag: 3, life: 0.3, kind: 'puff', size: 0 });
      fx({ x: this.x, y: GROUND - 1, kind: 'ring', big: !!this.acc, life: this.acc ? 0.3 : 0.22, col: C.yel[3] });
      if (this.acc) { fx({ x: this.x, y: GROUND - this.H / 2, kind: 'flare', size: 9, life: 0.12, col: '#fff4d8' }); for (let i = 0; i < 4; i++) fx({ x: this.x + rand(-8, 8), y: GROUND - 1, vx: rand(-90, 90), vy: -rand(90, 170), grav: 420, life: rand(0.4, 0.6), kind: 'chunk', size: 2, col: pick([C.stone[2], C.soil[3]]) }); }
      for (let i = 0; i < 5; i++) fx({ x: this.x + rand(-6, 6), y: GROUND - rand(4, 20), vx: rand(-60, 60), vy: -rand(60, 140), grav: 420, life: rand(0.35, 0.6), kind: 'chunk', size: randi(1, 2), col: pick([C.stone[2], C.stone[3], C.soil[3]]) });
    }
    if (this.up) {
      const was = this.upT; this.upT += dt / G.speed;
      if (this.ch) {   // 글자: 땅을 뚫고 솟구침 → 살짝 내려앉아 땅 위에 뜬 채 살랑 → 다시 땅속으로
        // 높이(gap) = 글자 아랫단과 땅 사이: 땅속에서 확 뛰어오름 → 떨어지듯 내려와 살짝 튕기며 멈춤 → 뜬 채 살랑 → 다시 땅속으로
        const u = this.upT, S = this.spr.height, base = GROUND - S + 10, peak = this.acc ? 22 : 16, hov = 7;
        const gap = u < 0.09 ? -S + (peak + S) * easeOut(u / 0.09) : u < 0.17 ? peak - (peak - hov + 2) * Math.pow((u - 0.09) / 0.08, 2) : u < 0.2 ? hov - 2 + 2 * Math.sin((u - 0.17) / 0.03 * Math.PI / 2) : u < 0.26 ? hov + Math.sin((u - 0.2) * 30) * 0.8 : hov - (hov + S) * Math.pow(clamp((u - 0.26) / 0.07, 0, 1), 1.5);
        this.top = Math.round(base - gap); this.gap = gap; this.lifted = clamp(gap / 6, 0, 1);
        this.boxY = this.top + 4; this.h = Math.max(0, Math.min(GROUND, this.top + S - 10) - this.boxY);   // 판정은 글자 몸통만 (높이 뛴 순간엔 밑이 빔)
        if (was < 0.17 && u >= 0.17) for (const sd of [-1, 1]) fx({ x: this.x + sd * 5, y: GROUND - 1, vx: sd * 35, vy: -8, drag: 4, life: 0.25, kind: 'puff', size: 0 });   // 내려앉을 때 밑에서 흙먼지
        if (was < 0.26 && u >= 0.26) for (let i = 0; i < 4; i++) fx({ x: this.x + rand(-5, 5), y: GROUND - 2, vx: rand(-25, 25), vy: -rand(20, 50), grav: 380, life: 0.35, kind: 'chunk', size: 1, col: pick([C.soil[3], C.stone[2]]) });   // 들어갈 때 흙이 튐
        return !this.dead && !(this.upT > 0.34);
      }
      const ov = this.acc ? 1.15 : 1;   // 기둥 강세: 높이 솟았다가 내려앉음
      this.h = this.upT < 0.045 ? Math.round(this.H * ov * this.upT / 0.045) : this.upT < 0.09 ? Math.round(this.H * (ov - (ov - 1) * (this.upT - 0.045) / 0.045)) : this.upT < 0.24 ? this.H : Math.round(this.H * Math.max(0, 1 - (this.upT - 0.24) / 0.07));
      if (was < 0.24 && this.upT >= 0.24) for (let i = 0; i < 4; i++) fx({ x: this.x + rand(-5, 5), y: GROUND - rand(10, 30), vx: rand(-25, 25), vy: rand(-30, 0), grav: 380, life: 0.4, kind: 'chunk', size: 1, col: C.stone[2] });
    }
    return !this.dead && !(this.up && this.upT > 0.32);
  }
  boxes() { return this.h > 8 ? [this.ch ? { x: this.x - 8, y: this.boxY ?? GROUND - this.h, w: 16, h: this.h } : { x: this.x - 5, y: GROUND - this.h, w: 10, h: this.h }] : NONE; }
  draw() {
    const x = Math.round(this.x);
    if (!this.up) {
      // 예고: 땅에 육각 테두리 + 박자마다 금빛으로 뛰는 테 + 솟기 직전 벌어지는 금
      const left = this.beatAt - this.b, f = ((this.b % 1) + 1) % 1, last = left < 1, beat = f < 0.22;
      const k = clamp(1 - left / 2, 0, 1), rim = last ? (Math.floor(this.t * 20) % 2 ? C.org[3] : C.yel[3]) : beat ? C.yel[2] : mix(C.yel[0], C.soil[2], 0.4);
      g.fillStyle = 'rgba(30,16,14,0.35)'; g.fillRect(x - 5, GROUND, 11, 2);
      g.fillStyle = INK; g.fillRect(x - 5, GROUND - 1, 11, 1); g.fillRect(x - 5, GROUND + 2, 11, 1); g.fillRect(x - 7, GROUND, 2, 2); g.fillRect(x + 6, GROUND, 2, 2);
      g.fillStyle = rim; g.fillRect(x - 4, GROUND - 1, 9, 1); g.fillRect(x - 4, GROUND + 2, 9, 1); g.fillRect(x - 6, GROUND, 1, 2); g.fillRect(x + 6, GROUND, 1, 2);
      g.fillStyle = INK; const n = Math.ceil(this.crack.length / 2 * k);
      for (let s = 0; s < 2; s++) for (let i = 0; i < n; i++) { const [cx, cy] = this.crack[s * 7 + i]; g.fillRect(x + (cx > 0 ? 6 : -6) + cx, GROUND + cy, 1, 1); }
      if (left < 0.5) { const jy = Math.floor(this.t * 30) % 2; if (this.ch) g.drawImage(this.spr, 0, 6, this.spr.width, 4, Math.round(x - this.spr.width / 2) + jy, GROUND - 3, this.spr.width, 4); else g.drawImage(this.spr, 0, 0, this.spr.width, 4, x - 7 + jy, GROUND - 3, this.spr.width, 4); }
      return;
    }
    if (this.h <= 0) return;
    if (this.ch) {   // 글자: 땅 선 아래는 가려 땅속에서 나오고 들어가는 것처럼 · 떠 있는 동안 땅에 그림자
      const sx = Math.round(x - this.spr.width / 2);
      if (this.lifted > 0) { const sw = Math.round(clamp(9 - (this.gap - 7) * 0.25, 5, 9)); g.fillStyle = `rgba(30,16,14,${0.38 * this.lifted * clamp(1.2 - this.gap / 30, 0.4, 1)})`; g.fillRect(x - sw, GROUND - 1, sw * 2 + 1, 2); g.fillRect(x - sw + 2, GROUND + 1, sw * 2 - 3, 1); }   // 그림자: 높이 뛸수록 작고 옅게
      g.save(); g.beginPath(); g.rect(sx - 2, -VOFF, this.spr.width + 4, GROUND + VOFF + 1); g.clip();
      g.drawImage(this.spr, sx, this.top);
      if (this.acc && this.upT < 0.06) { g.globalAlpha = 0.7; g.drawImage(silOf(this.spr, '#fff4d8'), sx, this.top); g.globalAlpha = 1; }   // 강세 글자: 솟는 순간 하얗게 번쩍
      g.restore();
      light(this.x, this.top + 10, 14, '#ffd890', this.upT < 0.16 ? 0.5 : 0.2);
      return;
    }
    else { const hh = Math.min(this.spr.height, this.h); g.drawImage(this.spr, 0, 0, this.spr.width, hh, x - 7, GROUND - hh, this.spr.width, hh); }
    if (this.upT < 0.16) { g.globalAlpha = 0.6; g.fillStyle = C.yel[3]; g.fillRect(x - 4, GROUND - this.h + 2, 9, 2); g.globalAlpha = 1; }   // 솟는 순간 윗면 금빛
    light(this.x, GROUND - this.h, 14, '#ffd890', this.upT < 0.16 ? 0.5 : 0.2);
  }
}
// ── 할망 시그니처 2: 태풍 마이삭 — 땅을 기어 오는 소용돌이, 플레이어를 끌어당김 ──
class Vortex { // 태풍 마이삭: 땅에서 말려 올라가 깔때기가 된 뒤 기어 옴
  constructor(x, speed, dir = -1) { this.x = x; this.speed = speed; this.dir = dir; this.t = 0; this.dodged = false; this.spin = 0; this.formT = 0.6 * G.speed; Sound.sfx.whoosh(); }
  update(dt) {
    this.t += dt; this.spin += dt * 9;
    const formed = this.t >= this.formT;
    if (formed) this.x += this.dir * this.speed * dt;
    if (Math.random() < dt * (formed ? 25 : 40)) { const a = rand(0, 6.28); fx({ x: this.x + Math.cos(a) * 14, y: GROUND - rand(4, 36), vx: -Math.sin(a) * 60 + (formed ? this.dir * this.speed : 0), vy: -rand(30, 70), life: 0.6, kind: 'chunk', size: 1, col: pick([C.leaf[2], C.leaf[3], C.wood[2]]) }); }
    if (formed && Math.random() < dt * 22) { const a = rand(0, 6.28); fx({ x: this.x + Math.cos(a) * rand(10, 22), y: GROUND - rand(1, 10), vx: -Math.sin(a) * rand(60, 110) + this.dir * this.speed * 0.5, vy: -rand(20, 70), grav: 160, life: 0.5, kind: 'chunk', size: 1, col: pick(Vortex.DUST) }); }   // 발치에서 흙 알갱이가 휘감겨 튐
    G.windTarget = Math.sign(this.x - P.x) * Math.min(52, 34 + G.tier * 4) * (formed ? 1 : 0.4);
    if (formed && Math.random() < dt * 18) { const sd = Math.random() < 0.5 ? -1 : 1; fx({ x: this.x + sd * rand(40, 90), y: GROUND - rand(1, 5), vx: -sd * rand(120, 180), vy: -rand(0, 12), life: 0.35, kind: 'streak', len: randi(3, 7), col: 'rgba(150,130,105,0.6)' }); }   // 땅을 쓸며 빨려 드는 흙먼지
    if (this.big) { G.storm = Math.min(0.7, (G.storm || 0) + dt * 1.5); G.stormHold = 0.15; G.stormDir = this.dir; }   // 마이삭: 하늘이 먹구름으로 덮이고 빗소리
    if (this.big) {   // 마이삭: 깔때기 꼭대기로 번개가 내리꽂히고, 화면 끝에서 바람이 빨려 들어감
      this.boltT = (this.boltT ?? 0.4) - dt; this.bolt = Math.max(0, (this.bolt || 0) - dt);
      if (this.boltT <= 0) { this.boltT = rand(0.9, 1.5) * G.speed; this.bolt = 0.13; G.lightning = Math.max(G.lightning || 0, 0.12); Sound.sfx.thunder(); shake(0.12); this.boltPts = []; let bx = this.x + rand(-30, 30); for (let y = -VOFF; y < GROUND - 60; y += 6) { const u = (y + VOFF) / (GROUND - 60 + VOFF); bx += rand(-5, 5) + (this.x - bx) * u * 0.4; this.boltPts.push([Math.round(bx), y]); } this.boltPts.push([Math.round(this.x), GROUND - 60]); }   // 내려올수록 깔때기 쪽으로 모여 끝이 옆으로 꺾이지 않게
      if (Math.random() < dt * 20) { const sd = Math.random() < 0.5 ? -1 : 1, sy = rand(-VOFF + 30, GROUND - 6); fx({ x: sd < 0 ? -4 : W + 4, y: sy, vx: (this.x - (sd < 0 ? 0 : W)) * 1.6, vy: (GROUND - 30 - sy) * 0.8, life: 0.6, kind: 'streak', len: randi(6, 14), col: 'rgba(220,226,240,0.45)' }); }
    }
    if (Math.random() < dt * 6) Sound.sfx.gust();
    if (Math.random() < dt * 30) fx({ x: rand(0, W), y: -VOFF - 4, vx: -60, vy: rand(260, 340), life: (GROUND + VOFF + 12) / 260, kind: 'streak', len: randi(5, 9), col: 'rgba(200,210,230,0.45)' });
    const alive = !this.dead && this.x > -40 && this.x < W + 40;
    if (!alive) G.windTarget = 0;
    return alive;
  }
  boxes() { const h = this.big ? 40 : 30; return this.t < this.formT ? NONE : [{ x: this.x - 9, y: GROUND - h, w: 18, h }]; }
  debris(front) {
    const cx = this.x;
    for (let i = 0; i < 6; i++) {
      const a = this.spin * (1.1 + i * 0.07) + i * 1.05, depth = Math.sin(a); if ((depth > 0) !== front) continue;
      const y = GROUND - 8 - i * 5, r = 6 + i * 2.2, px = Math.round(cx + Math.cos(a) * r), py = Math.round(y + depth * 2);
      if (i % 3 === 0) { g.save(); if (!front) g.globalAlpha = 0.6; g.drawImage(i % 2 ? TANGERINE : PEBBLE, px - 4, py - 4); g.restore(); }
      else { g.fillStyle = front ? (i % 2 ? C.leaf[3] : C.wood[2]) : C.leaf[1]; g.fillRect(px, py, 2, 1); g.fillRect(px + (i % 2 ? 1 : 0), py - 1, 1, 1); }
    }
  }
  // 깔때기 그림 (매 프레임 픽셀로): 먹구름 바닥에서 내려온 깔때기 — 아래는 가는 밧줄, 위로 갈수록 넓은 쐐기 · 가장자리는 반투명하게 흩어지고
  //  나선 줄무늬가 위로 감겨 올라감 · 아래쪽은 들려 올라간 흙빛 · 땅엔 회오리치는 흙먼지 구름 · 꼭대기는 천천히 도는 먹구름 덩이
  funnelImg(form) {
    const top = -VOFF + (this.big ? 24 : 40), full = GROUND - top, cw = 136, chh = full + 26, ox = Math.round(this.x - cw / 2), oy = top - 14;
    if (!this.cv) { this.cv = mk(cw, chh); this.cx2 = this.cv.getContext('2d'); this.id = this.cx2.createImageData(cw, chh); }
    if (this.imgT != null && this.t >= this.imgT && this.t - this.imgT < G.speed / 30) return [this.cv, ox, oy];   // 초당 30번만 새로 그림 (멈춤 화면에선 그대로)
    this.imgT = this.t;
    const d = this.id.data; d.fill(0);
    const hb = this.big ? 40 : 30, T = Vortex.PAL, DU = Vortex.DUST, SC = Vortex.CLOUD, sp = this.spin, t = this.t, low = full * (1 - easeOut(form));   // low: 내려오는 중인 깔때기 끝 (땅에서 위로 높이)
    const put = (x, y, col, a) => { if (x < 0 || y < 0 || x >= cw || y >= chh || a <= 0.02) return; const q = (y * cw + x) * 4, A = Math.min(1, a), c = rgb(col), a0 = d[q + 3] / 255, ao = A + a0 * (1 - A); for (let k = 0; k < 3; k++) d[q + k] = (c[k] * A + d[q + k] * a0 * (1 - A)) / ao; d[q + 3] = ao * 255; };
    const cxAt = u => this.x + Math.sin(t * 1.1 + u * 3.2) * 4 * (0.3 + u) + this.dir * u * u * 9 - ox;   // 위가 살짝 앞서 가며 밧줄처럼 휨
    for (let y = 0; y < chh; y++) {
      const v = GROUND - (oy + y); if (v < low || v > full + 2) continue;
      const u = clamp(v / full, 0, 1), cx = cxAt(u), r = 3.5 + Math.pow(u, 1.7) * 30 + (u < 0.07 ? (0.07 - u) * 60 : 0);
      for (let x = Math.floor(cx - r - 3); x <= Math.ceil(cx + r + 3); x++) {
        const s = (x + 0.5 - cx) / r, es = Math.abs(s) - (vnoise(v * 0.28 + t * 3, s * 2 + sp, 7711) - 0.5) * 0.3; if (es > 1.05) continue;
        const band = Math.sin(Math.asin(clamp(s, -1, 1)) * 2.4 + v * 0.22 - sp * 1.7);
        let lit = 0.47 - s * 0.26 + band * 0.16 + (vnoise(x * 0.3, v * 0.12 - t * 2, 7712) - 0.5) * 0.12 - u * 0.1;   // 하늘보다 짙게 (빗물 머금은 회색)
        let col = T[clamp(Math.floor(lit * T.length), 0, T.length - 1)];
        if (u < 0.28) col = mix(col, DU[clamp(Math.floor(lit * DU.length), 0, DU.length - 1)], (0.28 - u) / 0.28 * 0.7);   // 아래쪽은 들려 올라간 흙먼지 빛
        put(x, y, col, clamp(1.2 - es * 1.15, 0, 1) * (0.92 - (v < low + 6 ? (low + 6 - v) / 6 * 0.6 : 0)) * (v > hb + 4 ? 0.5 : 1));   // 맞는 높이 위쪽 깔때기는 반투명 (뛰어넘어도 되는 곳)
      }
    }
    if (low < 8) {   // 발치 흙먼지 구름: 땅을 쓰는 낮은 흙먼지 치마 + 회오리치며 피어오르는 흙먼지 덩이들 (아래는 넓고 위로 좁아지는 원뿔 · 맞는 높이 hb까지)
      const bx = cxAt(0), k = 1 - low / 8;
      for (let y = 0; y < chh; y++) { const v = GROUND - (oy + y); if (v < -1 || v > 6) continue; for (let x = Math.floor(bx - 34); x <= Math.ceil(bx + 34); x++) {   // 땅 흙먼지 치마
        const dx = x + 0.5 - bx, rr = Math.hypot(dx / (28 + 4 * Math.sin(t * 2 + dx * 0.1)), (v + 1) / 6), n = vnoise(dx * 0.18 - sp * 0.8 * Math.sign(dx || 1), v * 0.4, 7713);
        if (rr > 0.75 + n * 0.4) continue; put(x, y, DU[clamp(Math.floor((0.3 + n * 0.5) * DU.length), 0, DU.length - 1)], clamp((1.1 - rr) * 1.3, 0, 0.8) * k);
      } }
      const puffs = [];
      for (let i = 0; i < 36; i++) {   // 덩이마다 각도 · 오르는 속도 · 축에서 거리가 제각각 → 원뿔 안을 몽글몽글 채우며 피어오름
        const h1 = hash2(i, 1, 7720), h2 = hash2(i, 2, 7721), h3 = hash2(i, 3, 7722), rise = (t * (0.45 + h3 * 0.35) + h1) % 1, v = rise * (hb + 2), wv = 20 - rise * 10;
        const ang = sp * (1.05 + h2 * 0.45) + h2 * 6.283, sa = Math.sin(ang), rr = wv * (0.25 + 0.75 * Math.sqrt(h3));
        puffs.push([bx + Math.cos(ang) * rr, v + sa * 1.5, (5.4 - rise * 2.4) * (0.8 + h1 * 0.4), sa, rise]);
      }
      puffs.sort((p1, p2) => p1[3] - p2[3]);   // 뒤 덩이부터 (돌아가는 깊이)
      for (const [px, pv, pr, sa, rise] of puffs) {
        const fade = (rise > 0.82 ? (1 - rise) / 0.18 : 1) * (rise < 0.06 ? rise / 0.06 : 1);
        for (let yy = Math.floor(pv - pr - 1); yy <= Math.ceil(pv + pr + 1); yy++) for (let xx = Math.floor(px - pr - 1); xx <= Math.ceil(px + pr + 1); xx++) {
          const nx = (xx + 0.5 - px) / pr, ny = (yy + 0.5 - pv) / pr, dd = nx * nx + ny * ny, en = (vnoise((xx - px) * 0.5 + pr * 3, (yy - pv) * 0.5 - t * 3, 7714) - 0.5) * 0.5;   /* 덩이 가장자리는 몽글몽글 흩어짐 */
          if (dd > 1 + en) continue;
          const lit = 0.52 - nx * 0.15 + ny * 0.15 + sa * 0.12;   // 왼쪽 위가 밝은 둥근 덩이 · 앞쪽 덩이는 밝고 뒤쪽은 짙게 (대비는 낮게 — 먼지라서)
          put(xx, GROUND - yy - oy, DU[clamp(Math.floor(lit * DU.length), 0, DU.length - 1)], (sa < 0 ? 0.78 : 0.92) * fade * k * (dd > 0.45 ? Math.max(0.2, 1 - (dd - 0.45) * 1.3) : 1));   // 가장자리는 부드럽게 비침
        }
      }
    }
    if (this.big || form > 0.2) {   // 꼭대기 먹구름 덩이: 깔때기를 물고 천천히 돎 (위쪽 먹구름 띠와 이어짐)
      const tx = cxAt(1);
      for (let x = Math.floor(tx - 62); x <= Math.ceil(tx + 62); x++) { const dx = (x - tx) / 62; if (Math.abs(dx) > 1) continue; const bot = 22 - dx * dx * 14 + (vnoise(x * 0.12 + sp * 0.5 * this.dir, 1, 7715) - 0.5) * 6, topY = 2 + (vnoise(x * 0.08 - sp * 0.3, 2, 7716) - 0.5) * 6; for (let y = Math.max(0, Math.ceil(topY)); y < 30 && y <= bot; y++) {
        const n = vnoise((x - tx) * 0.09 + Math.cos(sp * 0.4) * 2, y * 0.18 + sp * 0.25, 7717), dep = (y - topY) / Math.max(1, bot - topY);
        put(x, y, SC[clamp(Math.floor((0.55 + n * 0.5 - dep * 0.45) * SC.length), 0, SC.length - 1)], (1 - Math.pow(Math.abs(dx), 4)) * (this.big ? 1 : 0.85));
      } }
    }
    this.cx2.putImageData(this.id, 0, 0);
    return [this.cv, ox, oy];
  }
  draw() {
    const cx = this.x, form = clamp(this.t / this.formT, 0, 1);
    if (this.bolt > 0 && this.boltPts) { for (let i = 0; i < this.boltPts.length - 1; i++) { pxLine(this.boltPts[i][0], this.boltPts[i][1], this.boltPts[i + 1][0], this.boltPts[i + 1][1], 3, '#a8b8ff'); pxLine(this.boltPts[i][0], this.boltPts[i][1], this.boltPts[i + 1][0], this.boltPts[i + 1][1], 1, '#fff4e0'); } light(cx, GROUND - 60, 30, '#c8d4ff', 0.8); }
    if (form < 1) {   // 예고: 땅에 소용돌이 고리가 말려 들어감
      g.fillStyle = INK; for (let a = 0; a < 6.28; a += 0.3) { const r = 14 * (1 - form) + 4; g.fillRect(Math.round(cx + Math.cos(a + this.spin) * r), GROUND + Math.round(Math.sin(a + this.spin) * 1.5), 1, 1); }
    }
    this.debris(false);
    const [img, ox, oy] = this.funnelImg(form); g.drawImage(img, ox, oy);
    this.debris(true);
  }
}
Vortex.PAL = ['#2c3038', '#3e434e', '#545a66', '#6c727e', '#888e96', '#a8acb0', '#c8c8c2'].map(c => mute(c));   // 깔때기 (빗물 머금은 회색)
Vortex.DUST = ['#3a2f28', '#524236', '#6c5746', '#88705a', '#a48b70', '#bea688'].map(c => mute(c));   // 들려 올라간 흙먼지 (짙은 흙빛 → 빛 받은 먼지)
Vortex.CLOUD = ['#16191f', '#1f232c', '#2a2f3a', '#363c48', '#444b58', '#545c6a'].map(c => mute(c));   // 먹구름
// ── 뭐랭하멘 시그니처: 구독 · 좋아요 · 알림설정 버튼이 위에서 쾅 (그림자 예고 후 곧게 낙하) ──
const SUB_BTN = {};
function subButton(label) {
  if (SUB_BTN[label]) return SUB_BTN[label];
  const t = textSprite(label, { font: 'b', color: '#ffffff', outline: null }), w = t.width + 12, h = 14, c = mk(w, h), x = c.getContext('2d');
  x.fillStyle = C.red[1]; x.fillRect(1, 0, w - 2, h); x.fillRect(0, 1, w, h - 2);
  x.fillStyle = C.red[2]; x.fillRect(1, 0, w - 2, h - 3); x.fillRect(0, 1, w, h - 5);
  x.fillStyle = C.red[3]; x.fillRect(2, 1, w - 4, 1);
  x.drawImage(t, Math.round((w - t.width) / 2), Math.round((h - 3 - t.height) / 2));
  return (SUB_BTN[label] = c);
}
class SubSlam {
  constructor(x, label) { this.x = x; this.spr = subButton(label); this.y = -VOFF - 20; this.t = 0; this.warn = 0.55 * G.speed; this.state = 'warn'; this.dodged = false; this.label = label; }
  update(dt) {
    this.t += dt;
    if (this.state === 'warn' && this.t >= this.warn) this.state = 'fall';
    if (this.state === 'fall') { this.vy = Math.min(1100, (this.vy || 280) + 3200 * dt / G.speed); this.y += this.vy / G.speed * dt; if (this.y >= GROUND - this.spr.height) { this.y = GROUND - this.spr.height; this.state = 'hold'; this.holdT = 0; Sound.sfx.thud(); hitstop(0.025, 0.4); shake(0.1); impact(this.x, GROUND - 2, C.red[3], 0.7); burst(this.x, GROUND - 8, 6, [C.red[2], C.red[3], '#fff4e0'], 90, 0.5, 320, 'chunk'); popup(this.label + '!', this.x, GROUND - 26, C.red[3], 's'); } }
    if (this.state === 'hold') { this.holdT += dt; if (this.holdT > 0.3) { burst(this.x, GROUND - 6, 8, [C.red[2], C.red[3]], 70, 0.4, 200); return false; } }
    return !this.dead;
  }
  boxes() { return this.state === 'warn' ? NONE : [{ x: this.x - this.spr.width / 2 + 2, y: this.y + 2, w: this.spr.width - 4, h: this.spr.height - 2 }]; }
  draw() {
    const w = this.spr.width;
    // 그림자 예고: 떨어질수록 진해짐
    const k = this.state === 'warn' ? this.t / this.warn : 1;
    g.fillStyle = `rgba(30,16,14,${0.2 + 0.4 * k})`; g.fillRect(Math.round(this.x - w / 2 * (0.5 + 0.5 * k)), GROUND, Math.round(w * (0.5 + 0.5 * k)), 2);
    if (this.state === 'warn' && Math.floor(this.t * 12) % 2 === 0) { g.fillStyle = C.red[2]; g.fillRect(Math.round(this.x - 1), GROUND - 10, 2, 6); g.fillRect(Math.round(this.x - 1), GROUND - 3, 2, 2); }
    if (this.state === 'warn') topMark(this.x, this.t);
    if (this.state !== 'warn') { const q = this.state === 'hold' ? this.holdT / G.speed : 1, dip = q < 0.05 ? 2 : q < 0.1 ? 1 : 0; g.drawImage(this.spr, Math.round(this.x - w / 2), Math.round(this.y) + dip); if (q < 0.05) { g.globalAlpha = 0.7; g.drawImage(silOf(this.spr, '#fff4e0'), Math.round(this.x - w / 2), Math.round(this.y) + dip); g.globalAlpha = 1; } }   // 쾅 박힐 때 살짝 눌렸다 올라오고 하얗게 번쩍
  }
}
// 높이 뛴 숨비에게: 위에서 떨어질 자리를 화면 위 끝에 표시
function topMark(x, t) {
  if (P.y >= GROUND - 60 || Math.floor(t * 12) % 2) return;
  const tx = Math.round(x), ty = -VOFF + 36; g.fillStyle = INK; g.fillRect(tx - 3, ty - 1, 7, 5); g.fillStyle = C.red[3]; g.fillRect(tx - 2, ty, 5, 1); g.fillRect(tx - 1, ty + 1, 3, 1); g.fillRect(tx, ty + 2, 1, 1);
}
// ── 메이플식 보스 스킬 공통: 스킬 이름 띄우기 ──
function skillName(name, hint) { const n = SKILL_SEEN[name] | 0; if (hint && n < 3) { SKILL_SEEN[name] = n + 1; try { localStorage.setItem('jeju.skills', JSON.stringify(SKILL_SEEN)); } catch (e) { /* 무시 */ } } else hint = null; G.skill = { who: EVENTS[B.key].name, name, hint, t: 0 }; Sound.sfx.card(); }   // hint: 피하는 법 (카드 아래 한 줄 · 스킬마다 처음 세 번만)
let SKILL_SEEN = {}; try { const v = JSON.parse(localStorage.getItem('jeju.skills')); if (v && typeof v === 'object') SKILL_SEEN = v; } catch (e) { /* 무시 */ }

// ── 할망 [귤밭 폭격]: 빨간 구역이 차오른 뒤 귤 상자가 그 구역을 통째로 내리찍음 ──
let CRATE = null;
function crateSprite() {
  if (CRATE) return CRATE;
  const pb = new PB(26, 20), Wd = C.wood;
  for (let y = 6; y < 20; y++) for (let x = 0; x < 26; x++) pb.set(x, y, (y - 6) % 5 === 0 ? Wd[0] : x < 2 ? Wd[3] : x > 23 ? Wd[1] : Wd[2]);
  for (const [cx, cy] of [[5, 6], [11, 5], [17, 6], [22, 6], [8, 3], [15, 2], [20, 3]]) pb.ellipse(cx, cy, 3.2, 2.8, (a, b) => C.org[sphereLight(a, b) < 0.4 ? 1 : sphereLight(a, b) < 0.75 ? 2 : 3]);
  return (CRATE = selOut(pb).canvas());
}
class AreaSmash {
  constructor(x0, x1, delay) { this.x0 = x0; this.x1 = x1; this.delay = delay; this.t = 0; this.dodged = false; this.hitT = -1; this.y = -VOFF - 24; }
  hangY() { const e = easeOut(this.t / (0.35 * G.speed)), k = clamp(this.t / this.delay, 0, 1); return Math.round(-VOFF + 14 + 22 * e - (k > 0.75 ? 3 * (k - 0.75) / 0.25 : 0)); }
  update(dt) {
    this.t += dt;
    const k = this.t / this.delay;
    // 떨어지기 직전: 상자 틈으로 흙먼지 · 귤잎이 부스스
    if (this.hitT < 0 && k > 0.6 && Math.random() < dt * 30) fx({ x: rand(this.x0 + 4, this.x1 - 4), y: this.hangY() + 20, vx: rand(-8, 8), vy: rand(20, 50), grav: 200, life: 0.6, kind: 'chunk', size: 1, col: pick([C.wood[2], C.leaf[2], C.soil[3]]) });
    if (this.t >= this.delay && this.hitT < 0) { this.hitT = 0; this.y = this.hangY(); Sound.sfx.whoosh(); }
    if (this.hitT >= 0) {
      this.hitT += dt;
      this.y = Math.min(GROUND - 20, this.y + dt * 1800);
      if (this.y >= GROUND - 20 && !this.landed) {
        this.landed = true; Sound.sfx.boom(); shake(0.18); light((this.x0 + this.x1) / 2, GROUND - 8, 40, C.org[3], 1);
        const n = Math.ceil((this.x1 - this.x0 - 12) / 26), mid = Math.floor(n / 2);
        for (let x = this.x0 + 12, i = 0; x < this.x1; x += 26, i++) {
          impact(x, GROUND - 4, C.org[3], i === mid ? 0.8 : 0.3, true); juice(x, GROUND - 10, 6);
          burst(x, GROUND - 10, 6, [C.wood[1], C.wood[2], C.wood[3]], 120, 0.6, 400, 'chunk');
          for (let j = 0; j < 3; j++) fx({ x: x + rand(-8, 8), y: GROUND - 14, vx: rand(-90, 90), vy: -rand(120, 200), grav: 520, life: rand(0.5, 0.8), kind: 'chunk', size: 2, col: pick([C.org[2], C.org[3]]) });
        }
      }
      if (this.hitT > 0.5) { for (let x = this.x0 + 8; x < this.x1; x += 26) burst(x, GROUND - 10, 5, [C.org[2], C.wood[2]], 70, 0.4, 240); return false; }
    }
    return !this.dead;
  }
  boxes() { return this.hitT >= 0 && this.hitT < 0.2 ? [{ x: this.x0, y: this.y, w: this.x1 - this.x0, h: 20 }] : NONE; }
  drawCrates(y, shakeX = 0) {
    const cs = crateSprite();
    for (let x = this.x0; x < this.x1 - 4; x += cs.width) g.drawImage(cs, Math.round(Math.min(x, this.x1 - cs.width) + shakeX), Math.round(y));
  }
  draw() {
    const w = this.x1 - this.x0;
    if (this.hitT < 0) {
      // 예고: 화면 위에 매달린 귤 상자(점점 흔들림) + 땅엔 짙어지는 그림자와 공사 띠 + 양 끝 꺾쇠
      const k = clamp(this.t / this.delay, 0, 1), fast = k > 0.7, blink = fast ? Math.floor(this.t * 16) % 2 : Math.floor(this.t * 5) % 2;
      // 구역 가장자리: 얇은 세로 점선 (높이 뛴 숨비도 경계를 보게)
      g.fillStyle = `rgba(232,150,90,${0.18 + 0.3 * k})`;
      for (let y = -VOFF + 36; y < GROUND - 8; y += 6) { g.fillRect(this.x0, y, 1, 3); g.fillRect(this.x1 - 1, y, 1, 3); }
      // 땅 그림자: 상자가 내려올수록 진하고 넓게
      const sw = Math.round(w * (0.6 + 0.4 * k)), sx = Math.round(this.x0 + (w - sw) / 2);
      g.fillStyle = `rgba(30,16,14,${0.12 + 0.4 * k})`; g.fillRect(sx, GROUND, sw, 2); g.fillRect(sx + 3, GROUND - 1, sw - 6, 1);
      // 땅속 공사 띠 (사선 줄무늬가 흐름)
      const off = Math.floor(this.t * 24);
      for (let x = this.x0 + 1; x < this.x1 - 1; x++) { g.fillStyle = (((x + off) >> 2) % 2) ? C.org[3] : INK; g.fillRect(x, GROUND + 3, 1, 2); }
      // 양 끝 꺾쇠
      for (const [ex, s] of [[this.x0, 1], [this.x1 - 1, -1]]) {
        g.fillStyle = INK; g.fillRect(ex - 1, GROUND - 9, 3, 10); g.fillRect(ex, GROUND - 10, s * 5 + (s < 0 ? 1 : 0), 3);
        g.fillStyle = blink ? C.yel[3] : C.org[3]; g.fillRect(ex, GROUND - 8, 1, 8); g.fillRect(Math.min(ex, ex + s * 4), GROUND - 9, 4, 1);
      }
      // 매달린 상자 + 밧줄
      const hy = this.hangY(), sh = fast ? (Math.floor(this.t * 30) % 2 ? 1 : -1) : 0, cs = crateSprite();
      g.fillStyle = C.wood[1];
      for (let x = this.x0; x < this.x1 - 4; x += cs.width) { const cx = Math.round(Math.min(x, this.x1 - cs.width)); g.fillRect(cx + 5 + sh, -VOFF, 1, hy + VOFF + 3); g.fillRect(cx + cs.width - 6 + sh, -VOFF, 1, hy + VOFF + 3); }
      this.drawCrates(hy, sh);
      return;
    }
    // 내리꽂힘: 위로 바람 자국
    if (!this.landed) { g.fillStyle = 'rgba(255,244,224,0.45)'; for (let x = this.x0 + 3; x < this.x1; x += 7) g.fillRect(x, Math.round(this.y - 16 - (x % 3) * 4), 1, 12); }
    this.drawCrates(this.y);
  }
}
// ── 뭐랭하멘 [해석 레이저]: 가는 빨간 선으로 예고 → 화면을 가로지르는 광선 ──
class Laser {
  constructor(y, delay, x1, x0 = 0) { this.y = y; this.delay = delay; this.x1 = x1; this.x0 = x0; this.from = x0 > 0 ? x0 : x1; this.t = 0; this.dodged = false; }
  update(dt) {
    this.t += dt;
    if (!this.fired && Math.random() < dt * 30) { const a = rand(0, 6.28), r = rand(14, 26); fx({ x: this.from + Math.cos(a) * r, y: this.y + Math.sin(a) * r, vx: -Math.cos(a) * r * 4, vy: -Math.sin(a) * r * 4, life: 0.25, kind: 'trail', col: C.red[3] }); }
    if (this.t >= this.delay && !this.fired) {
      this.fired = true; Sound.sfx.zap(); shake(0.3); flashFx(0.03, '#ffd8c8');
      fx({ x: this.from, y: this.y, kind: 'flare', size: 14, life: 0.25, col: C.red[3] });
      for (let x = this.x0 + 10; x < this.x1; x += 18) { spark(x + rand(-4, 4), this.y + rand(-3, 3)); fx({ x, y: this.y, vx: rand(-30, 30), vy: rand(-90, -30), grav: 300, life: rand(0.3, 0.6), kind: 'ember' }); }
    }
    if (this.fired && this.t > this.delay + 0.3 * G.speed && !this.after) { this.after = true; fx({ x: this.x0, y: this.y, kind: 'streak', len: Math.round(this.x1 - this.x0), life: 0.18, col: 'rgba(255,200,180,0.45)' }); }
    return !this.dead && this.t < this.delay + 0.32 * G.speed;
  }
  boxes() { return this.fired ? [{ x: this.x0, y: this.y - 4, w: this.x1 - this.x0, h: 8 }] : NONE; }
  draw() {
    if (!this.fired) {
      const k = clamp(this.t / this.delay, 0, 1), x0 = this.x0, w = this.x1 - x0, y = this.y, half = Math.round(1 + k * 3), rev = this.from === x0;
      g.save(); g.globalAlpha = 0.12 + 0.24 * k; g.fillStyle = C.red[2]; g.fillRect(x0, y - half, w, half * 2 + 1); g.restore();   // 점점 두꺼워지는 위험 띠
      g.fillStyle = mix(C.red[2], '#fff4e0', k * 0.7); g.fillRect(x0, y, w, 1);                                                    // 가운데 선
      for (let i = 0; i < 3; i++) { const d = (this.t * 220 + i * w / 3) % w, px = Math.round(rev ? x0 + d : x0 + w - d); g.fillStyle = '#fff4e0'; g.fillRect(px - 3, y, 6, 1); }   // 나아갈 방향으로 흐르는 빛
      disc(g, Math.round(this.from), y, Math.round(1 + k * 3), mix(C.red[3], '#fff4e0', k));                                           // 발사 지점에 모이는 빛
      if (this.delay - this.t < 0.12 * G.speed) { g.fillStyle = '#fff4e0'; g.fillRect(x0, y - 1, w, 3); }                         // 발사 직전 번쩍
      return;
    }
    const f = Math.floor(this.t * 30) % 2;
    const x0 = this.x0, w = this.x1 - x0;
    g.fillStyle = C.red[1]; g.fillRect(x0, this.y - 4, w, 8);
    g.fillStyle = C.red[3]; g.fillRect(x0, this.y - 3 + f, w, 6 - f * 2);
    g.fillStyle = '#fff4e0'; g.fillRect(x0, this.y - 1, w, 2);
    for (let x = x0; x < this.x1; x += 40) light(x, this.y, 20, '#ff8070', 0.5);
  }
}
// 이벤트 공격 속도 보정: 세계 시간이 G.speed배로 흐르므로, 실제 체감 속도가 ×1.3을 넘지 않게 줄임
const evK = () => Math.min(1, 1.3 / G.speed);
// ── 밈 이벤트 공통: 화면을 비우고 이벤트 컷 → 행동 큐를 실시간 박자로 실행 ──
// 이벤트 스킬 고르기: 보통 두 개, 높은 단계에선 가끔 세 개 (매번 순서와 조합이 바뀜)
function pickSkills(o) { return shuffled(Object.keys(o)).slice(0, G.tier >= 3 && Math.random() < 0.35 ? 3 : 2); }
// 같은 높이가 세 번 넘게 이어지지 않는 무작위 높이 줄
function heightSeq(n) { const a = []; for (let i = 0; i < n; i++) { let h = Math.random() < 0.5 ? 1 : 0; if (i >= 2 && a[i - 1] === a[i - 2]) h = 1 - a[i - 1]; a.push(h); } return a; }
function shuffled(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
class PatEvent extends Pattern {
  constructor(key) {
    super(99 * Math.max(1, G.speed)); G.windTarget = 0; G.dark = 0;   // 일주 변형 규칙(강풍 · 정전)은 보스전에 남기지 않음
    for (const h of G.hz) dust(h.x || W / 2, GROUND, 3, 0, 1); G.hz = []; G.spawnQ.length = 0; G.warnings = [];
    B = new EventCut(this, key); this.q = []; this.next = 0;
  }
  update(dt) {
    this.t += dt;
    if (!B || B.state === 'gone') { this.t = this.dur; return; }
    if (B.state !== 'act' || B.swap) return;
    this.next -= dt / G.speed;
    if (this.next > 0) return;
    // 박자 단어는 비트 머리에 맞춰 나감
    // 모든 보스 공격은 박 머리에 맞춰 나감 (대사 · 스킬 이름 · 이동은 바로)
    if (this.q[0] && !['say', 'skill', 'rest', 'clear', 'swap', 'hop'].includes(this.q[0].k)) { const f8 = (beatNow() * 2) % 1; if (f8 > 0.15 && f8 < 0.9) return; }   // 8분음표 칸에 맞춰 (기다림은 반 박 이하)
    if (this.q[0] && this.q[0].k === 'clear') { if (G.hz.some(h => h instanceof Vortex) || G.spawnQ.some(h => h instanceof Vortex)) return; this.q.shift(); this.next = 0.3; G.dark = 0; return; }   // 태풍이 다 지나간 뒤 다음 스킬
    const a = this.q.shift(); if (!a) { B.leave(); return; }
    this.next = a.gap; if (a.k === 'swap') { B.swapTo(); return; } this.act(a);
  }
  fireWord(w, lane, speed, kind) {
    const [mx, my] = B.mouthPos();
    spawnHz(new Bubble(w, mx - 10 * B.side, my - 8, { dir: B.dir, kind, lane, speed }));
    B.talk(); Sound.sfx.pop(); shake(0.04);
  }
  throwAt(spr) {
    const [mx, my] = B.mouthPos(), x0 = B.side > 0 ? Math.min(mx - 6, G.arenaR - 2) : Math.max(mx + 6, G.arenaL + 2);
    spawnHz(new Zap(x0, my, P.x, clamp(P.y - 8, -VOFF + 40, GROUND - 6), spr, (130 + G.tier * 6) * evK()));
    B.talk(0.3);
  }
  // 조준 방향을 가운데로 n갈래 부채꼴 (중력 없이 곧게)
  throwFan(spr, n, spread) {
    const [mx, my] = B.mouthPos(), x0 = B.side > 0 ? Math.min(mx - 6, G.arenaR - 2) : Math.max(mx + 6, G.arenaL + 2), tx = P.x, ty = clamp(P.y - 8, -VOFF + 40, GROUND - 6), base = Math.atan2(ty - my, tx - x0);
    for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * spread; spawnHz(new Zap(x0, my, x0 + Math.cos(a) * 100, my + Math.sin(a) * 100, spr, (125 + G.tier * 6) * evK())); }
    B.talk(0.3);
  }
  end() { P.confuseT = 0; G.dark = 0; if (!P.dead) { daily('event'); if (G.hp < G.maxHp) { G.hp++; popup('+♥', P.x, P.y - 30, '#ff8fa0', 'b'); Sound.sfx.heal(); } } /* 보스를 넘기면 체력 1 회복 */ if (!P.dead) B = null; G.arenaR = W - 8; G.arenaL = 8; G.rapSub = null; G.windTarget = 0; G.rest = Math.max(G.rest, 1.1); if (this.music && !P.dead) playMusic({ style: 'chip', song: runSong(), tempo: 138 * G.speed }); }
}
// ── 이벤트: 할망 — 힙합 비트에 사투리 랩, 썩은 귤을 곧게 던짐 ──
const RAP = [
  { t: '뭐랭ᄒᆞ멘 이 아이야', m: '뭐라고 하는 거니, 얘야' }, { t: '이디 왕 앚아봅서', m: '여기 와서 앉아 보세요' },
  { t: '귤밭 다 볼라불엇저', m: '귤밭을 다 밟아 버렸다' }, { t: '재게재게 돌아가라', m: '빨리빨리 돌아가거라' },
  { t: '속솜ᄒᆞ영 이시라', m: '조용히 하고 있거라' }, { t: '무사 경 햄시니', m: '왜 그렇게 하고 있니' },
  { t: 'ᄒᆞᆫ저ᄒᆞᆫ저 피해보라', m: '어서어서 피해 보거라' }, { t: '폭싹 속았수다게', m: '정말 고생 많으셨어요' },
];
class PatHalmang extends PatEvent {
  constructor() {
    super('halmang'); this.music = true; this.clockT = 0; this.bpm = 100 * Math.min(G.speed, 1.2); this.safe = -1;
    Sound.stopMusic(); playMusic({ style: 'hiphop', tempo: this.bpm });
    this.q.push({ k: 'say', text: '이디서 뭐 햄시니!', gap: 0.7 });
    const L = pick(RAP), ws = L.t.split(' ');
    const skills = {
      beat: () => { const mode = pick(['alt', 'sweep']), n = ((G.tier ? 3 : 2) + (G.tier >= 4 ? 1 : 0)) * 3;   /* 한 줄이 다 솟는 데 박자 2~3개 → 줄 수 × 3박 */ this.q.push({ k: 'skill', name: '사투리 비트', hint: '글자 사이 빈칸에 서거나, 솟을 때 점프!', gap: 0.4 }); this.gapX = clamp(P.x, 30, G.arenaR - 30); this.gapD = pick([-1, 1]); for (let i = 0; i < n; i++) this.q.push({ k: 'bars', i, L, ws, mode, gap: 60 / this.bpm }); this.q.push({ k: 'rest', gap: 2.5 * 60 / this.bpm }); },
      smash: () => { this.q.push({ k: 'skill', name: '귤밭 폭격', hint: '빨갛게 차오르는 구역을 피해 안전 구역으로!', gap: 0.3 }); const n = G.tier ? randi(2, 3) : 2, zones = Math.random() < 0.4 ? 4 : 3; for (let i = 0; i < n; i++) this.q.push({ k: 'smash', zones, gap: zones === 4 ? 1.9 : 1.75 }); },
      typhoon: () => { this.q.push({ k: 'skill', name: '태풍 마이삭', hint: '아래 흙먼지만 위험 · 뛰어넘거나 구르면 통과!', gap: 0.2 }); const v = pick(['one', 'two', 'fan']); this.q.push({ k: 'typhoon', gap: v === 'one' ? 1.8 : 1.4 }); if (v === 'two') this.q.push({ k: 'typhoon', second: true, gap: 1.6 }); if (v === 'fan' || G.tier >= 2) this.q.push({ k: 'fan', gap: 0.9 }); this.q.push({ k: 'clear', gap: 0 }); },
    };
    shuffled(['beat', ...shuffled(themeCfg().indoor ? ['smash'] : ['smash', 'typhoon']).slice(0, G.tier >= 3 && Math.random() < 0.35 ? 2 : 1)]).forEach((k, i) => { if (i > 0 && Math.random() < 0.6) this.q.push({ k: 'swap', gap: 0.5 }); skills[k](); });   // 사투리 글자 솟기는 꼭 나옴
    this.q.push({ k: 'skill', name: '비트 드랍', hint: '가장 빠른 글자 물결 · 빈칸에 서거나 점프!', gap: 0.25 });
    // 마무리 비트 드랍도 같은 글자 공격: 쾅 내리찍은 뒤 문장이 가장 빠르게 휩쓸고 지나감 (1~2줄)
    const lines = G.tier >= 2 && Math.random() < 0.5 ? 2 : 1;
    this.q.push({ k: 'dropcue', gap: 0.5 });
    for (let i = 0; i < lines * 3; i++) this.q.push({ k: 'bars', i, L, ws, mode: 'drop', gap: 60 / this.bpm });
    this.q.push({ k: 'rest', gap: 2 * 60 / this.bpm });
  }
  // 음악이 꺼져 있어도 박자가 가도록 자체 시계를 함께 씀
  nextLine(max) {   // 문장에서 다음 줄: 단어가 넘치면 거기서 끊음 (문장 끝이면 처음부터)
    this.chI = this.chI || 0; const out = [];
    while (LINE_G[this.chI % LINE_G.length] === ' ') this.chI++;
    while (out.length < max) {
      let k = this.chI, word = []; while (word.length < max && LINE_G[k % LINE_G.length] !== ' ') { word.push(LINE_G[k % LINE_G.length]); k++; if (k % LINE_G.length === 0) break; }
      if (out.length && out.length + 1 + word.length > max) break;
      if (out.length) out.push(' '); out.push(...word); this.chI = k; while (LINE_G[this.chI % LINE_G.length] === ' ') this.chI++;
      if (this.chI % LINE_G.length === 0) break;
    }
    return out;
  }
  nextCh(keepSpace) { this.chI = this.chI || 0; let ch; do { ch = LINE_G[this.chI++ % LINE_G.length]; } while (!keepSpace && !ch.trim()); return ch; }   // 문장 글자를 차례로
  beat() { const b = Sound.style === 'hiphop' && Sound.playing ? Sound.beat() : -1, c = this.clockT * this.bpm / 60; if (b >= 0) { this.bOff = b - c; return b; } return c + (this.bOff || 0); }
  update(dt) { this.clockT += dt / G.speed; super.update(dt); }
  act(a) {
    if (a.k === 'say') { B.sayIt(a.text, 'big', 0.9); shake(0.2); }
    else if (a.k === 'skill') { skillName(a.name, a.hint); B.shakeT = 0.2; }
    else if (a.k === 'smash') {
      // 세 구역 중 두 곳이 빨갛게 → 쾅. 안전 구역은 매번 바뀜
      const Z = a.zones || 3, x0 = G.arenaL - 2, A = G.arenaR - x0, zw = A / Z, pz = clamp(Math.floor((P.x - x0) / zw), 0, Z - 1);
      const opts = [pz - 1, pz + 1].filter(z => z >= 0 && z <= Z - 1 && z !== this.safe);
      const safe = opts.length ? pick(opts) : pz; this.safe = safe;
      const wait = Math.max(1.3, zw / 94 + 0.35); for (let z = 0; z < Z; z++) if (z !== safe) spawnHz(new AreaSmash(Math.round(x0 + z * zw), Math.round(x0 + (z + 1) * zw), wait * G.speed));
      B.talk(0.4); Sound.sfx.alarm(); B.move('lunge');
    }
    else if (a.k === 'bars') {
      // 다음 박에 솟는 막대 한 줄: 홀짝 줄이 16px씩 엇갈려 박자마다 자리를 옮기거나 뛰어야 함
      const next = Math.max(Math.ceil(this.beat()) + 1, Math.ceil(this.lineEnd ?? 0)), off = a.i % 2 ? 16 : 0, clock = () => this.beat();   // 다음 줄은 앞 줄이 끝난 바로 다음 정박에 이어서 (바닥 표시는 1박 이상 먼저)
      // 사투리 한 줄: 문장을 읽는 순서대로(왼쪽 → 오른쪽) 한 글자씩 차례로 솟음 — 바닥 표시가 먼저 다 깔리고, 솟는 순서가 늘 같아 미리 읽고 피할 수 있음
      //  줄은 단어 단위로 끊고(낱말이 쪼개지지 않게), 띄어쓰기 자리는 빈칸 · 앞 줄이 다 솟은 뒤에 다음 줄
      if ((this.lineEnd ?? -1) - 1 <= this.beat()) {
        // 박자: 기본은 16분음표 칸마다 한 글자(음악과 같은 스윙) · 빠른 줄은 32분음표로 몰아침 · 비트 드랍은 가장 빠르게
        //  정박(킥 · 스네어 자리)에 오는 글자는 강세: 더 높이 쾅 솟았다 내려앉고, 소리 · 흔들림도 크게
        const sp = a.mode === 'alt' ? 30 : 24, slots = this.nextLine(Math.floor((G.arenaR - G.arenaL - 22) / sp) + 1), SW = [0, 0.3, 0.61, 0.8];
        let last = next;
        Sound.sfx.rumble();   // 바닥 표시가 깔리며 땅이 울림
        slots.forEach((ch, j) => {
          const at = a.mode === 'drop' ? next + j * 0.1 : a.mode === 'sweep' ? next + j * 0.125 : next + Math.floor(j / 4) + SW[j % 4], acc = a.mode === 'sweep' ? j % 8 === 0 : a.mode === 'alt' && j % 4 === 0;
          last = at; if (ch.trim()) { const bb = new BeatBar(G.arenaL + 12 + j * sp, at, clock, false, ch); bb.acc = acc; bb.j = j; spawnHz(bb); }
        });
        this.lineEnd = last + 0.25; void off;
      }
      B.talk(0.3);
      const [mx, my] = B.mouthPos();
      fx({ x: mx - 6 * B.side, y: my - 4, kind: 'ring', life: 0.25, col: C.yel[3] });
      const wi = Math.min(a.ws.length - 1, a.i);
      G.rapSub = { line: a.ws.slice(0, wi + 1).join(' '), sub: a.L.m, t: 0 };
    } else if (a.k === 'rest') { G.rapSub = null; }
    else if (a.k === 'typhoon') {
      // 태풍 인터뷰 밈: "바람 하영 분다!" — 소용돌이가 땅을 기어 오며 끌어당김
      B.sayIt('바람 하영 분다!', 'big', 1.0); G.dark = Math.max(G.dark, 0.42); B.move('sway'); Sound.sfx.thunder(); G.lightning = Math.max(G.lightning || 0, 0.14); flashFx(0.04, '#d8e4ff');
      const v = new Vortex(B.inner() - B.side * 12, (70 + G.tier * 4) * rand(0.9, 1.12) * evK(), B.dir); v.big = true; spawnHz(v);
    } else if (a.k === 'fan') this.throwFan(ROTTEN, 3, 0.32);
    else if (a.k === 'dropcue') { B.sayIt('비트 드랍!', 'big', 0.7); B.move('slam', () => { flashFx(0.05, '#fff2d8', true); hitstop(0.04); Sound.sfx.erupt(); shake(0.25); }); }
  }
}
// ── 이벤트: 뭐랭하멘 — 사투리를 쏟아내고 물음표를 날린 뒤 해석 카드 ──
const NEWS_LINES = [
  { t: '뭐랭ᄒᆞ멘!', m: '뭐라고 하는 거니!' }, { t: '무사 경 햄시니!', m: '왜 그러고 있니!' },
  { t: '재게재게 가라!', m: '빨리빨리 가거라!' }, { t: '속솜ᄒᆞ라 게!', m: '조용히 좀 해라!' },
  { t: '이디 왕 보라!', m: '여기 와서 봐라!' }, { t: '어디 감시니!', m: '어디 가는 거니!' },
];
class PatMurang extends PatEvent {
  constructor() {
    super('murang'); this.music = true; playMusic({ style: 'chip', song: 'lofi', tempo: 92 });
    this.L = pick(NEWS_LINES);
    this.q.push({ k: 'say', text: '뭐랭ᄒᆞ멘?!', gap: 0.6 });
    if (G.tier >= 1) { this.q.push({ k: 'skill', name: '사투리 혼란', hint: '잠깐 좌우 조작이 거꾸로 바뀌어요', gap: 0.2 }); this.q.push({ k: 'confuse', gap: 0.5 }); }
    const skills = {
      words: () => { this.q.push({ k: 'skill', name: '사투리 폭격', hint: '머리 위로 떨어지는 글자 · 옆으로 비키기', gap: 0.3 }); for (let i = 0, n = G.tier ? 3 : 2; i < n; i++) this.q.push({ k: 'word', gap: 1.5 }); },
      chat: () => { this.q.push({ k: 'skill', name: '댓글 폭주', hint: '낮은 댓글은 점프, 높은 댓글은 가만히', gap: 0.3 }); heightSeq(randi(3, 4) + (G.tier >= 2 ? 1 : 0)).forEach(h => this.q.push({ k: 'chat', high: !!h, gap: rand(0.8, 1.0) })); this.q.push({ k: 'rest', gap: 0.5 }); },
      slam: () => { this.q.push({ k: 'skill', name: '구독 폭격', hint: '그림자 진 자리를 피해 빈칸으로!', gap: 0.3 }); if (Math.random() < 0.5) this.q.push({ k: 'slamwave', gap: 1.6 }); else { this.q.push({ k: 'slam', gap: 1.3 }); this.q.push({ k: 'slam', gap: 1.4 }); } },
      laser: () => { this.q.push({ k: 'skill', name: '해석 레이저', hint: '낮은 줄은 점프, 높은 줄은 가만히', gap: 0.3 }); heightSeq(randi(2, 3)).forEach(h => this.q.push({ k: 'laser', y: h ? GROUND - 30 : GROUND - 8, gap: 1.05 })); },
    };
    const ks = pickSkills(skills); if (G.tier >= 1 && ks[0] === 'slam') { if (ks.length > 1) [ks[0], ks[1]] = [ks[1], ks[0]]; else this.q.push({ k: 'rest', gap: 1.6 }); }   // 조작 반전 중에 구독 폭격(멀리 달아나기)이 바로 오지 않게
    ks.forEach((k, i) => { if (i > 0 && Math.random() < 0.6) this.q.push({ k: 'swap', gap: 0.5 }); skills[k](); });
    this.q.push({ k: 'skill', name: '해석 폭탄', hint: '날아오다 갈라져요 · 크게 비키거나 구르기', gap: 0.2 });
    this.q.push({ k: 'bomb', gap: 1.0 });
    this.q.push({ k: 'interp', gap: 0.7 });
  }
  act(a) {
    if (a.k === 'say') { B.sayIt(a.text, 'big', 0.8); shake(0.15); }
    else if (a.k === 'skill') { skillName(a.name, a.hint); B.shakeT = 0.2; }
    else if (a.k === 'confuse') { P.confuseT = 2.6; Sound.sfx.babble('뭐랭하멘', true); popup('조작 반전', P.x, P.y - 40, C.yel[3], 'b', true); }
    else if (a.k === 'laser') { B.move('lean'); spawnHz(B.side > 0 ? new Laser(a.y, 0.9 * G.speed, Math.min(W, B.x + 30)) : new Laser(a.y, 0.9 * G.speed, W, Math.max(0, B.x + B.img.width - 30))); B.talk(0.5); }
    else if (a.k === 'slamwave') {
      // 화면을 쓸고 지나가는 버튼 줄. 한 칸만 비어 있음
      const labels = ['구독', '좋아요', '알림'], xs = [];
      for (let x = G.arenaL + 16; x < G.arenaR - 14; x += 40) xs.push(x);
      const ps = xs.reduce((bi, x, i) => Math.abs(x - P.x) < Math.abs(xs[bi] - P.x) ? i : bi, 0);
      const gap = clamp(ps + randi(-1, 0), 0, xs.length - 2), dir = Math.random() < 0.5 ? 1 : -1;
      xs.forEach((x, i) => { if (i === gap || i === gap + 1) return; const s = new SubSlam(x, labels[i % 3]); s.warn += (dir > 0 ? i : xs.length - 1 - i) * 0.12 * G.speed; spawnHz(s); });
      B.sayIt('구독 좋아요 눌러줍서!', 'n', 1.0);
    }
    else if (a.k === 'word') { B.move('lean'); const [w, m] = pick(DIALECT); spawnHz(new DialectWord(w, m, P.x + rand(-16, 16), 1.0 * G.speed)); }
    else if (a.k === 'chat') { B.move('lean'); const w = pick(['ㅋㅋㅋ', '뭐랭?', '하영!', '게메', '무사?', 'ᄒᆞᆫ저!', '폭싹!']); this.fireWord(w, a.high ? GROUND - 28 : GROUND, (110 + G.tier * 5) * evK(), 'n'); }
    else if (a.k === 'slam') {
      // 구독 · 좋아요 · 알림설정: 플레이어 자리와 그 양옆으로 차례로 쾅
      B.sayIt('구독 좋아요 눌러줍서!', 'n', 1.0);
      const labels = ['구독', '좋아요', '알림설정'], xs = [P.x, clamp(P.x - 44, G.arenaL + 12, G.arenaR - 20), clamp(P.x + 44, G.arenaL + 12, G.arenaR - 20)];
      labels.forEach((lb, i) => { const s = new SubSlam(clamp(xs[i], G.arenaL + 12, G.arenaR - 20), lb); s.warn += i * 0.22 * G.speed; spawnHz(s); });
    }
    else if (a.k === 'bomb') {
      const L = pick(NEWS_LINES), [mx, my] = B.mouthPos(), x0 = B.side > 0 ? Math.min(mx - 6, G.arenaR - 2) : Math.max(mx + 6, G.arenaL + 2);
      spawnHz(new SplitZap(x0, my, P.x, clamp(P.y - 10, -VOFF + 40, GROUND - 8), L.t.split(' ')[0].replace(/!/g, ''), L.m, (110 + G.tier * 5) * evK()));
      B.sayIt('해석 들어감수다!', 'n', 0.8); B.move('lunge');
    }
    else if (a.k === 'interp') G.interp = { t: 0, text: this.L.t, sub: this.L.m };
  }
}

// ── 갈매기 새우깡: 하늘에서 내리꽂는 갈매기 ──
class Gull {
  constructor() {
    this.tx = clamp(P.x + rand(-24, 24), 16, W - 16); this.dir = Math.random() < 0.5 ? -1 : 1;
    this.x = this.tx - this.dir * 190; this.y = -VOFF - 12; this.t = 0; this.T = Math.max(1.0, 1.3 - G.diff * 0.05) * G.speed; this.dodged = false; this.anim = 0; this.sy = this.y; this.sx = this.x; this.squawk = false;
  }
  update(dt) {
    this.t += dt; this.anim += dt * 10;
    if (this.t < 0) return !this.dead;   // 편대: 차례가 올 때까지 대기 (길 미리보기는 계속 보임)
    const k = this.t / this.T;
    // 포물선으로 내리꽂았다가 다시 올라감
    this.x = lerp(this.sx, this.tx + this.dir * 190, k);
    this.y = this.sy + (GROUND - 10 - this.sy) * (1 - Math.pow(2 * k - 1, 2));
    if (!this.squawk && k > 0.25) { this.squawk = true; Sound.sfx.gull(); }
    return !this.dead && k < 1;
  }
  boxes() { return this.t < 0 ? NONE : [{ x: this.x - 6, y: this.y - 5, w: 12, h: 8 }]; }
  drawDecal() { const k = Math.max(0, this.t) / this.T;
    if (k < 0.45) { g.globalAlpha = 1 - k / 0.45; for (let s = Math.max(0.08, k); s < 0.92; s += 0.04) { const x = Math.round(lerp(this.sx, this.tx + this.dir * 190, s)), y = Math.round(this.sy + (GROUND - 10 - this.sy) * (1 - Math.pow(2 * s - 1, 2))); if (y < -VOFF + 30) continue; g.fillStyle = INK; g.fillRect(x - 1, y - 1, 3, 3); g.fillStyle = C.red[3]; g.fillRect(x, y, 1, 1); } g.globalAlpha = 1; }
    if (k < 0.7) { const a = 0.15 + Math.min(1, k / 0.4) * 0.3; g.fillStyle = `rgba(30,20,40,${a})`; g.fillRect(Math.round(this.tx - 40), GROUND, 80, 1); g.fillStyle = `rgba(200,40,40,${a})`; g.fillRect(Math.round(this.tx - 6), GROUND, 12, 1); } }
  onShot() { this.dead = true; burst(this.x, this.y, 10, ['#ffffff', '#c8ccd6'], 70, 0.5, 120); reward('shatter', this.x, this.y - 10); return true; }
  draw() { const f = GULL[[0, 0, 1, 1, 1, 0][Math.floor(this.anim) % 6]][this.dir > 0 ? 'r' : 'l']; g.drawImage(f, Math.round(this.x - f.ax), Math.round(this.y - f.ay)); }
}
class PatGull extends Pattern {
  constructor() { super(7.5); this.next = 0.4; }
  update(dt) {
    this.t += dt; this.next -= dt;
    if (this.next > 0 || this.t > this.dur - 1.3) return;
    if (G.diff >= 0.5 && !this.paired && G.patterns.length <= 1 && Math.random() < 0.4) {
      // 갈매기 편대: 같은 쪽에서 8분음표마다 한 마리씩, 내리꽂는 자리를 30px씩 밀며 줄지어 강하 → 높이 한 번 뛰면 줄줄이 넘어감
      const n = randi(3, 5), dir = pick([-1, 1]), step8 = 60 / (Sound.tempo || 138) / 2 * G.speed, base = clamp(P.x - dir * 45, 40, W - 40);
      for (let i = 0; i < n; i++) { const gl = new Gull(); gl.dir = dir; gl.tx = clamp(base + dir * i * 30, 16, W - 16); gl.sx = gl.x = gl.tx - dir * 190; gl.t = Math.min(0, -(beatLead(gl.T / 2) - gl.T / 2)) - i * step8; gl.chain = true; spawnHz(gl); }
      Sound.sfx.gull(); this.next = n * step8 + 1.6 * G.speed; return;
    }
    spawnHz(new Gull());
    if (G.diff > 1.5 && Math.random() < 0.35) spawnHz(new Gull());
    this.next = Math.max(0.5, 1.1 - G.diff * 0.1) * rand(0.8, 1.2);
  }
}
// ── 렌터카 대행진 ──
class RentCar {
  constructor(dir, off) { this.dir = dir; this.x = dir > 0 ? -24 - off : W + 24 + off; this.speed = (rand(190, 230) + G.diff * 12) * Math.min(1, 1.6 / G.speed); this.dodged = false; this.bouncy = true; this.honk = false; this.t = 0; }
  update(dt) {
    this.t += dt; this.x += this.dir * this.speed * dt;
    if (!this.honk && this.x > 12 && this.x < W - 12 && Math.abs(this.x - P.x) < 120) { this.honk = true; Sound.sfx.honk(); for (let i = 0; i < 3; i++) fx({ x: this.x + this.dir * 18, y: GROUND - 10 + (i - 1) * 3, vx: this.dir * 120, life: 0.12, kind: 'streak', len: 4, col: C.yel[3] }); }
    if (this.x > -10 && this.x < W + 10 && Math.random() < dt * 20) fx({ x: this.x - this.dir * 16, y: GROUND - 3, vx: -this.dir * 30, vy: -8, life: 0.4, kind: 'puff', size: 1 });
    return this.dir > 0 ? this.x < W + 40 : this.x > -40;
  }
  boxes() { return [{ x: this.x - 14, y: GROUND - 15, w: 28, h: 14 }]; }
  onShot(s) { spark(s.x, s.y); Sound.sfx.tink(); return true; }
  draw() { const c = RENTCAR[this.dir > 0 ? 'r' : 'l']; drawShadow(this.x, 28); g.drawImage(c, Math.round(this.x - 16), Math.round(GROUND - 17)); }
}
class PatCar extends Pattern {
  constructor() { super(7.5); this.next = 0.3; }
  update(dt) {
    this.t += dt; this.next -= dt;
    if (this.next > 0 || this.t > this.dur - 2) return;
    const dir = pick([-1, 1]), n = 1 + (G.diff > 1.2 && Math.random() < 0.5 ? 1 : 0);
    G.warnings.push({ side: -dir, kind: 'car', t: 0, dur: Math.max(0.7, 1.0 - G.diff * 0.06) * G.speed, spawn: () => { let off = 0; for (let i = 0; i < n; i++) { spawnHz(new RentCar(dir, off)); off += rand(90, 130); } } });
    this.next = Math.max(1.4, 2.4 - G.diff * 0.18);
  }
}

// ── 유채꽃 벌떼: 모두 같은 물결길을 따라 날아옴 (높이 뜬 구간 아래는 안전 · 낮은 구간은 점프 · 귤로 잡기) ──
const BEE = [0, 1].map(f => {
  const pb = new PB(8, 7), Y = C.yel, K = C.stone;
  pb.ellipse(4, 4.2, 3, 2.1, (nx, ny, x) => ((x + 1) % 3 === 0 ? K[0] : sphereLight(nx, ny) > 0.6 ? Y[3] : Y[2]));
  pb.set(7, 4, K[0]);                                   // 침
  const wy = f ? 1 : 2; pb.set(3, wy, C.cloth[2]); pb.set(4, wy, C.cloth[3]); pb.set(5, wy + (f ? 0 : 1), C.cloth[2]);
  return framePair(selOut(pb), 4, 4);
});
class Bee {
  constructor(dir, i, speed, ph) { this.dir = dir; this.i = i; this.x = dir > 0 ? -10 - i * 12 : W + 10 + i * 12; this.ph = ph; this.y = this.path(); this.speed = speed; this.t = 0; this.dodged = false; this.stompable = false; }
  path() { return GROUND - 24 + Math.sin(this.x * 0.045 + this.ph) * 14; }
  update(dt) {
    this.t += dt; this.x += this.dir * this.speed * dt;
    this.y = this.path();
    return !this.dead && (this.dir > 0 ? this.x < W + 20 : this.x > -20);
  }
  boxes() { return [{ x: this.x - 3, y: this.y - 3, w: 6, h: 5 }]; }
  onShot() { daily('bee'); this.dead = true; burst(this.x, this.y, 6, [C.yel[2], C.stone[1]], 60, 0.35, 120); reward('shatter', this.x, this.y - 8); Sound.sfx.tink(); return true; }
  draw() { const f = BEE[Math.floor(this.t * 18) % 2][this.dir > 0 ? 'r' : 'l']; g.drawImage(f, Math.round(this.x - f.ax), Math.round(this.y - f.ay)); }
}
class PatBee extends Pattern {
  constructor() { super(7.5); this.next = 0.5; this.dir = pick([-1, 1]); }
  update(dt) {
    this.t += dt; this.next -= dt;
    if (this.next > 0 || this.t > this.dur - 1.6) return;
    const dir = this.dir, ph = rand(0, 6.28), n = 4 + Math.min(3, Math.floor(G.diff)), sp = (80 + G.diff * 8) * Math.min(1, 1.35 / G.speed);
    G.warnings.push({ side: -dir, ph, t: 0, dur: 0.8 * G.speed, spawn: () => { Sound.sfx.buzz(); for (let i = 0; i < n; i++) spawnHz(new Bee(dir, i, sp, ph)); } });
    this.next = Math.max(2.2, 2.8 - G.diff * 0.15);
  }
}

// ── 참새 떼: 참새 몇 마리가 무리 지어 낮게(구르기로 밑을 통과) · 높게(가만히) 날아 지나감 ──
//  참새: 밤색 정수리 · 흰 뺨에 검은 점 · 검은 턱 · 줄무늬 갈색 등 · 흰 날개띠 · 짧은 꼬리 (날갯짓 4칸)
const SPARROW = (() => {
  const K = { d: '#4e3424', b: '#8a5a3a', l: '#b48a62', u: '#c4b49c', c: '#8c4a2c', w: '#eee6d6', k: '#241c1a', g: '#5a504c' };
  for (const k in K) K[k] = mute(K[k]);
  const poly = (pb, pts, col) => {   // 다각형 채우기 (칸 가운데 기준)
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
      let ins = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y + 0.5) !== (yj > y + 0.5) && x + 0.5 < (xj - xi) * (y + 0.5 - yi) / (yj - yi) + xi) ins = !ins; }
      if (ins) pb.set(x, y, typeof col === 'function' ? col(x, y) : col);
    }
  };
  const mkF = wing => {
    const pb = new PB(17, 13);
    poly(pb, [[5, 6.5], [0.5, 5.5], [0.5, 8], [5, 8.2]], (x, y) => y < 6.5 ? K.b : K.d);   // 짧은 꼬리
    pb.ellipse(8.2, 7.2, 4.6, 2.5, (nx, ny) => ny > 0.1 ? K.u : (nx > -0.2 && nx < 0.3 && ny < -0.4) ? K.d : K.b);   // 몸통: 등 갈색(줄무늬) · 배 회갈색
    pb.ellipse(12, 5.8, 2.4, 2.3, (nx, ny) => ny < -0.15 ? K.c : K.w);   // 머리: 밤색 정수리 · 흰 뺨
    pb.set(12, 5, K.k); pb.set(13, 7, K.k); pb.set(12, 7, K.k);   // 눈 · 검은 턱
    pb.set(14, 6, K.g); pb.set(15, 6, K.g);   // 짧고 굵은 부리
    const tip = [[3.5, 0.2], [0.8, 4.2], [3.5, 11.8]][wing === 3 ? 1 : wing];   // 날개 끝 (위 · 가운데(활공) · 아래)
    poly(pb, [[10.2, 6], [tip[0], tip[1]], [6.2, 7.2]], (x, y) => { const k = Math.hypot(x - tip[0], y - tip[1]); return k < 2.2 ? K.d : k > 5.2 ? K.l : K.b; });   // 뾰족한 날개: 끝은 짙고 어깨는 밝게
    const mx = Math.round((10.2 + tip[0]) / 2), my = Math.round((6 + tip[1]) / 2); pb.set(mx, my, K.w);   // 흰 날개띠 한 점
    return selOut(pb).canvas();
  };
  const r = [0, 1, 2, 1].map(mkF), l = r.map(flipC);
  for (const f of r) { f.ax = 8; f.ay = 7; } for (const f of l) { f.ax = 8; f.ay = 7; }
  return { r, l };
})();
class Plane {   // 참새 무리 (낮게 2마리 · 높게 3마리 — 판정 폭은 예전 비행기와 같음)
  constructor(dir, low, speed) { this.dir = dir; this.low = low; this.y = low ? GROUND - 20 : GROUND - 44; this.x = dir > 0 ? -24 : W + 24; this.speed = speed; this.t = 0; this.warn = 0.7 * G.speed; this.dodged = false; this.birds = (low ? [[-7, 2], [7, -2]] : [[-13, 2], [0, -3], [13, 1]]).map(([ox, oy], i) => ({ ox, oy, ph: i * 1.3 + rand(0, 1) })); }
  update(dt) {
    this.t += dt;
    if (this.flee) { this.x += this.dir * this.speed * 0.5 * dt; this.y -= 140 * dt; return this.y > -VOFF - 20; }   // 귤에 맞으면 놀라서 위로 흩어져 날아감
    if (this.t >= this.warn) {
      if (!this.roared) { this.roared = true; Sound.sfx.chirp(); }
      this.x += this.dir * this.speed * dt;
    }
    return !this.dead && (this.dir > 0 ? this.x < W + 30 : this.x > -30);
  }
  boxes() { return this.t < this.warn || this.flee ? NONE : this.low ? [{ x: this.x - 10, y: this.y - 4, w: 20, h: 9 }] : [{ x: this.x - 15, y: this.y - 4, w: 30, h: 9 }]; }
  onShot(s) { this.flee = true; Sound.sfx.chirp(); burst(s.x, s.y, 6, ['#8a5a3a', '#b4865c', '#e6dac2'], 50, 0.5, 80, 'chunk'); reward('shatter', this.x, this.y - 8); return true; }
  drawBirds(sil) {
    const set = SPARROW[this.dir > 0 ? 'r' : 'l'];
    for (const b of this.birds) {
      const f = set[Math.floor(this.t * 14 + b.ph * 3) % 4], bob = Math.round(Math.sin(this.t * 7 + b.ph) * 1.2) + (this.flee ? -Math.round(b.ox * 0.4) : 0);
      g.drawImage(sil ? silOf(f, C.red[2]) : f, Math.round(this.x + b.ox * this.dir - f.ax), Math.round(this.y + b.oy + bob - f.ay));
    }
  }
  draw() {
    if (this.t < this.warn) {   // 예고: 지나갈 높이에 점선 + 참새 그림자
      if (this.t < this.warn - 0.7 * G.speed) return;
      { const ly = Math.round(this.y); for (let x = 2; x < W; x += 6) { g.fillStyle = INK; g.fillRect(x - 1, ly - 1, 5, 3); g.fillStyle = C.red[3]; g.fillRect(x, ly, 3, 1); } }
      if (!(Math.floor(this.t * 10) % 2)) { const x0 = this.x; this.x = this.dir > 0 ? 20 : W - 20; g.save(); g.globalAlpha = 0.6; this.drawBirds(true); g.restore(); this.x = x0; }
      return;
    }
    if (this.low && !this.flee) drawShadow(this.x, 20);
    this.drawBirds(false);
  }
}
class PatPlane extends Pattern {
  constructor() { super(7.5); this.next = 0.4; }
  update(dt) {
    this.t += dt; this.next -= dt;
    if (this.next > 0 || this.t > this.dur - 1.8) return;
    const dir = pick([-1, 1]), low = Math.random() < 0.55, sp = (150 + G.diff * 10) * Math.min(1, 1.35 / G.speed);
    spawnHz(new Plane(dir, low, sp));
    if (G.diff > 1.6 && Math.random() < 0.35) { const p2 = new Plane(dir, !low, sp); p2.warn += 0.9 * G.speed; spawnHz(p2); }
    this.next = Math.max(1.3, 2.1 - G.diff * 0.15);
  }
}
// ── 귤 택배 왔수다: 그림자 자리에 상자가 곧게 떨어지고, 떨어진 상자는 밟거나 쏘면 귤이 쏟아짐 ──
const PARCEL = (() => {
  const pb = new PB(18, 15), K = ['#6a4a2e', '#8a6440', '#a8804e', '#c49a62'].map(c => mute(c));
  for (let y = 2; y < 14; y++) for (let x = 1; x < 17; x++) pb.set(x, y, x < 3 ? K[3] : x > 14 ? K[1] : y === 2 ? K[3] : K[2]);
  for (let x = 1; x < 17; x++) pb.set(x, 5, K[1]);                       // 뚜껑 접힌 선
  for (let y = 2; y < 14; y++) pb.set(8, y, mix(K[2], '#d8c8a0', 0.4));   // 테이프
  pb.rect(4, 8, 3, 3, C.org[2]); pb.set(5, 7, C.leaf[2]);                 // 귤 그림
  pb.rect(10, 8, 4, 1, K[0]); pb.rect(10, 10, 3, 1, K[0]);                // 글씨 자리
  return selOut(pb).canvas();
})();
class Parcel {
  constructor(x, delay) { this.x = x; this.y = -VOFF - 16; this.t = 0; this.warn = delay; this.state = 'warn'; this.dodged = false; this.stompable = true; }
  update(dt) {
    this.t += dt;
    if (this.state === 'warn' && this.t >= this.warn) this.state = 'fall';
    if (this.state === 'fall') { this.vy = Math.min(820, (this.vy || 220) + 2600 * dt); this.y += this.vy * dt; if (this.y >= GROUND - 13) { this.y = GROUND - 13; this.state = 'rest'; this.safe = true; this.restT = 0; shake(0.12); Sound.sfx.thud(); dust(this.x, GROUND, 5, 0, 1); fx({ x: this.x, y: GROUND - 1, kind: 'ring', life: 0.25, col: '#fff4e0' }); burst(this.x, GROUND - 4, 6, [C.wood[1], C.wood[2], C.soil[3]], 90, 0.45, 380, 'chunk'); } }   // 점점 빨라지며 떨어지고 쿵
    if (this.state === 'rest') { this.restT += dt; if (this.restT > 1.6 * G.speed) { this.open(false); return false; } }
    return !this.dead;
  }
  open(bonus) {
    this.dead = true; burst(this.x, GROUND - 8, 8, [C.wood[2], C.org[2]], 70, 0.4, 260);
    const n = bonus ? 3 : 1; for (let i = 0; i < n; i++) G.pickups.push(new Pickup('tang', this.x + rand(-6, 6), GROUND - 14, rand(-50, 50), rand(-160, -110)));
    if (bonus) popup('+귤', this.x, GROUND - 26, C.org[3], 's');
  }
  kill() { this.open(true); reward('shatter', this.x, GROUND - 16); }
  boxes() { return this.state === 'fall' ? [{ x: this.x - 7, y: this.y, w: 14, h: 13 }] : this.state === 'rest' ? [{ x: this.x - 7, y: this.y + 2, w: 14, h: 4 }] : NONE; }
  onShot() { this.kill(); return true; }
  draw() {
    const k = this.state === 'warn' ? this.t / this.warn : 1;
    g.fillStyle = `rgba(30,16,14,${0.2 + 0.4 * k})`; g.fillRect(Math.round(this.x - 4 - 4 * k), GROUND, Math.round(8 + 8 * k), 2);
    if (this.state === 'warn') topMark(this.x, this.t);
    if (this.state !== 'warn') { const thru = this.state === 'rest' && Math.abs(P.x - this.x) < 12 && P.y > this.y; if (thru) g.globalAlpha = 0.6; const dip = this.state === 'rest' && this.restT < 0.05 ? 2 : this.state === 'rest' && this.restT < 0.1 ? 1 : 0; g.drawImage(PARCEL, Math.round(this.x - 9), Math.round(this.y - 1) + dip); g.globalAlpha = 1; }
  }
}
class PatParcel extends Pattern {
  constructor() { super(7); this.next = 0.6; }
  update(dt) {
    this.t += dt; this.next -= dt;
    if (this.next > 0 || this.t > this.dur - 2) return;
    const n = 2 + Math.min(2, Math.floor(G.diff));
    for (let i = 0; i < n; i++) { const x = clamp(P.x + (i - (n - 1) / 2) * 34 + rand(-6, 6), 16, G.arenaR - 16); if (G.hz.some(h => h instanceof Parcel && Math.abs(h.x - x) < 14)) continue; spawnHz(new Parcel(x, (0.65 + i * 0.18) * G.speed)); }
    this.next = Math.max(1.5, 2.2 - G.diff * 0.15);
  }
}

// ── 밭담 바람구멍: 현무암 돌담이 옆에서 밀려옴 · 뚫린 구멍으로만 통과 (바닥 = 구르기, 가운데 = 점프, 위 = 2단 점프) ──
const WALL_TOP = -VOFF - 4, WALL_H = GROUND - WALL_TOP;
// ── 오름 패러글라이딩: 하늘에 뜬 낙하산은 밟으면 통통 튀는 징검다리 (밟으면 귤), 땅에는 꼬마 하르방 ──
const GLIDER = (() => {
  const pb = new PB(30, 24), A = C.teal, O = C.org;
  for (let x = 2; x < 28; x++) {
    const u = (x - 14.5) / 13, top = Math.round(2 + u * u * 5), st = Math.floor((x - 2) / 4) % 2, K = st ? A : O;
    pb.set(x, top, K[3]); pb.set(x, top + 1, K[2]); pb.set(x, top + 2, x % 4 === 1 ? K[1] : K[2]); pb.set(x, top + 3, K[1]);
  }
  const L = mix(C.stone[3], C.cloth[3], 0.5);
  for (const sx of [3, 9, 20, 26]) pb.limb(sx, 6 + (sx < 6 || sx > 23 ? 3 : 0), 14.5 + (sx < 15 ? -1 : 1), 16, 1, L);
  pb.rect(13, 15, 3, 3, C.wood[1]); pb.set(14, 15, C.wood[2]);           // 머리 · 헬멧
  pb.rect(13, 18, 3, 3, C.cloth[1]); pb.set(13, 18, C.cloth[2]);          // 몸
  pb.set(12, 21, C.cloth[0]); pb.set(16, 21, C.cloth[0]);                 // 다리
  return selOut(pb).canvas();
})();
class Glider {
  constructor(dir, high, speed) { this.dir = dir; this.y0 = high ? GROUND - 140 : GROUND - 96; this.y = this.y0; this.x = dir > 0 ? -16 : W + 16; this.speed = speed; this.t = rand(0, 6); this.safe = true; this.bouncy = true; this.ambient = true; this.dodged = true; this.life = 10; }
  update(dt) {
    this.t += dt; this.life -= dt; this.x += this.dir * this.speed * dt; this.y = this.y0 + Math.sin(this.t * 2) * 3;
    return !this.dead && this.life > 0 && (this.dir > 0 ? this.x < W + 20 : this.x > -20);
  }
  boxes() { return [{ x: this.x - 12, y: this.y - 10, w: 24, h: 6 }]; }
  onBounce() {
    this.sq = 0.15;
    if (this.paid) return false; this.paid = true;
    for (let i = 0; i < 2; i++) G.pickups.push(new Pickup('tang', this.x + rand(-6, 6), this.y - 8, rand(-50, 50), rand(-120, -80)));
    fx({ x: this.x, y: this.y - 10, kind: 'ring', big: true, life: 0.3, col: C.teal[3] }); light(this.x, this.y - 8, 24, C.teal[3], 0.7);
    return true;
  }
  draw() {
    const sq = this.sq > 0 ? 1 : 0; this.sq = Math.max(0, (this.sq || 0) - 1 / 120);
    g.save(); g.globalAlpha = this.life < 1 && Math.floor(this.life * 10) % 2 ? 0.4 : 1;
    g.drawImage(GLIDER, Math.round(this.x - 15), Math.round(this.y - 12 + sq)); g.restore();
  }
}
class PatGlider extends Pattern {
  constructor() { super(7.5); this.next = 0.2; this.gl = 0; this.dir = pick([-1, 1]); this.high = Math.random() < 0.5; }
  update(dt) {
    this.t += dt; this.next -= dt; this.gl -= dt;
    if (this.t > this.dur - 1.2) return;
    if (this.gl <= 0) { const gl = new Glider(this.dir, this.high, 52 * Math.min(1, 1.35 / G.speed)); spawnHz(gl); gl.pat = null; this.high = !this.high; this.gl = 1.5; }
    if (this.next > 0 || this.t < 1.2) return;
    spawnHz(new Hopper(-this.dir));
    if (G.diff >= 1.5 && Math.random() < 0.35) spawnHz(new Rise(clamp(P.x + rand(-8, 8), 16, W - 16), Math.max(0.65, 0.95 - G.diff * 0.06) * G.speed, 0.6));
    this.next = Math.max(0.7, 1.3 - G.diff * 0.1) * rand(0.85, 1.15);
  }
  end() { for (const h of G.hz) if (h instanceof Glider) h.life = Math.min(h.life, 1); }
}

// 들어오는 쪽 화면 끝 꺾쇠 (dir: +1 = 왼쪽에서 들어옴)
function edgeChev(dir, y, col = C.red[3]) { if (G && G.dark > 0 && !edgeChev.flush) { (G.edgeQ = G.edgeQ || []).push([dir, y, col]); return; }   // 태풍 어둠 위에 그리려고 나중으로
  const yy = Math.round(y);   // 두 겹 큰 꺾쇠 (멀리서도 보이게)
  for (const off of [0, 6]) { const x = dir > 0 ? 3 + off : W - 4 - off; for (const [c, o] of [[INK, 1], [off ? mix(col, INK, 0.3) : col, 0]]) { g.fillStyle = c; for (let i = 0; i < 4; i++) g.fillRect(x + dir * i - o, yy - 3 + i - o, 2 + 2 * o, 7 - 2 * i + 2 * o); } }
}
// ── 남방큰돌고래: 바다에서 솟아 포물선으로 넘어감 · 지나갈 길을 점선으로, 들어가고 나올 자리엔 물보라 고리 ──
const DOLPHIN = [-0.6, 0, 0.6].map(ang => {
  const w = 26, h = 18, pb = new PB(w, h), ca = Math.cos(ang), sa = Math.sin(ang), B = ['#34445a', '#506478', '#72889c', '#aebcc6'].map(c => mute(c));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = x + 0.5 - 13, dy = y + 0.5 - 9, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
    let c = null;
    const half = u > -10 && u < 9 ? 3.4 * Math.sqrt(Math.max(0, 1 - ((u + 0.5) / 9.6) ** 2)) : 0;
    if (half > 0 && Math.abs(v + 0.2) <= half) c = v > half * 0.3 ? B[3] : v < -half * 0.45 ? B[1] : B[2];
    if (u >= 8.5 && u < 11.5 && v > -0.6 && v < 1.2) c = B[2];                                        // 주둥이
    if (u > -2.5 && u < 2 && v < -2.4 && v > -2.4 - (2 - Math.abs(u + 0.5)) * 1.4) c = B[1];        // 등지느러미
    if (u <= -9.5 && u > -13 && Math.abs(v) < (-(u + 9.5)) * 1.2 + 0.5) c = B[1];                      // 꼬리
    if (u > 2 && u < 5 && v > 1.2 && v < 2.6) c = B[1];                                                // 가슴지느러미
    if (Math.round(u) === 6 && Math.round(v) === -1) c = INK;                                          // 눈
    pb.set(x, y, c);
  }
  return selOut(pb).canvas();
});
const DOLPHIN_L = DOLPHIN.map(flipC);
function splashFx(x, big = 1) {
  Sound.sfx.splash();
  fx({ x, y: GROUND - 1, kind: 'ring', life: 0.3, col: '#cfe4ec' });
  for (let i = 0; i < 10 * big; i++) fx({ x: x + rand(-5, 5), y: GROUND - 2, vx: rand(-60, 60), vy: -rand(80, 180), grav: 520, life: rand(0.35, 0.6), kind: 'px', size: randi(1, 2), col: pick(['#cfe4ec', '#9ec2d4', '#fff4e0']) });
}
class Dolphin {
  constructor(x0, x1, peak, T, warn) { Object.assign(this, { x0, x1, peak, T, warn, t: 0, dodged: false, s: -1 }); this.dir = Math.sign(x1 - x0); this.x = x0; this.y = GROUND + 10; }
  pos(s) { return [lerp(this.x0, this.x1, s), GROUND + 10 - (this.peak + 10) * 4 * s * (1 - s)]; }
  update(dt) {
    this.t += dt; const s = (this.t - this.warn) / this.T;
    if (s >= 0 && this.s < 0) splashFx(this.x0, 1);
    if (s >= 0) {
      this.s = s; [this.x, this.y] = this.pos(Math.min(1, s));
      if (Math.random() < dt * 40) fx({ x: this.x - this.dir * 8, y: this.y + rand(-2, 2), vx: -this.dir * rand(10, 30), vy: rand(-10, 20), grav: 300, life: 0.4, kind: 'px', col: pick(['#cfe4ec', '#9ec2d4']) });
      if (s >= 1) { splashFx(this.x1, 1.3); return false; }
    }
    return !this.dead;
  }
  boxes() { return this.s < 0 ? NONE : [{ x: this.x - 7, y: this.y - 4, w: 14, h: 8 }]; }
  onShot(sh) { spark(sh.x, sh.y); Sound.sfx.tink(); return true; }
  drawDecal() {
    // 지나갈 길: 처음엔 또렷한 점선, 뛰어오르면 남은 길만 옅게
    const s0 = Math.max(0, this.s), on = this.s < 0;
    if (on || s0 < 0.6) for (let s = s0; s <= 1.001; s += 0.045) {
      const [x, y] = this.pos(s); if (y > GROUND - 2) continue;
      if (on) { g.fillStyle = INK; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); }
      g.fillStyle = on ? C.red[3] : 'rgba(232,69,74,0.35)'; g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    if (on) {   // 솟을 자리 · 떨어질 자리: 물결 고리가 조여 듦
      const k = clamp(this.t / this.warn, 0, 1);
      for (const ex of [this.x0, this.x1]) { const r = Math.round(10 - 6 * k); g.fillStyle = INK; g.fillRect(Math.round(ex - r - 1), GROUND - 1, 2 * r + 3, 3); g.fillStyle = Math.floor(this.t * 12) % 2 ? '#9ec2d4' : '#cfe4ec'; g.fillRect(Math.round(ex - r), GROUND, 2 * r + 1, 1); }
    }
  }
  draw() {
    if (this.s < 0) return;
    const i = this.s < 0.38 ? 0 : this.s < 0.62 ? 1 : 2, f = (this.dir > 0 ? DOLPHIN : DOLPHIN_L)[i];
    g.save(); g.beginPath(); g.rect(-60, -VOFF - 40, W + 120, GROUND + VOFF + 40); g.clip();
    g.drawImage(f, Math.round(this.x - 13), Math.round(this.y - 9)); g.restore();
  }
}
class PatDolphin extends Pattern {
  constructor() { super(7.5); this.next = 0.3; }
  update(dt) {
    this.t += dt; this.next -= dt;
    if (this.next > 0 || this.t > this.dur - 2) return;
    const span = rand(130, 170), end = clamp(P.x + rand(-14, 14), 20, G.arenaR - 20), dir = end - span < 10 ? -1 : end + span > G.arenaR - 10 ? 1 : pick([-1, 1]);
    // 떨어질 자리가 숨비 근처 → 옆으로 비키거나 아치 밑으로 들어가기
    const x1 = end, x0 = clamp(x1 - dir * span, 10, G.arenaR - 10), peak = rand(62, 84), T = Math.max(0.8, Math.abs(x1 - x0) / 150) * G.speed;
    spawnHz(new Dolphin(x0, x1, peak, T, 0.9 * G.speed));
    if (G.diff >= 1.5 && Math.random() < 0.45) { const y0 = clamp(x1 + dir * rand(60, 90), 10, G.arenaR - 10), y1 = clamp(y0 + dir * span * 0.8, 10, G.arenaR - 10); if (Math.abs(y1 - y0) > 90) spawnHz(new Dolphin(y0, y1, peak * 0.8, Math.max(0.8, Math.abs(y1 - y0) / 150) * G.speed, 1.3 * G.speed)); }
    this.next = Math.max(1.3, 1.9 - G.diff * 0.12);
  }
}
// ── 까마귀 떼: 하늘 위에 앉아 노려보다가(조준선) 줄이 굳으면 그 길로 내리꽂음 ──
const CROW = (() => {
  const K = ['#1c1822', '#2c2634', '#40384c', '#5a5268'].map(c => mute(c));
  const mkF = (wing) => {
    const pb = new PB(18, 14);
    pb.ellipse(8.5, 7.5, 4.6, 2.5, (a, b) => b < -0.35 ? K[2] : K[1]);
    pb.ellipse(13, 6, 1.9, 1.7, (a, b) => b < -0.25 ? K[2] : K[1]);
    pb.set(15, 6, '#5e5a52'); pb.set(16, 6, '#4a463e'); pb.set(15, 7, '#3e3a34');           // 부리
    pb.set(13, 5, K[3]);                                                                    // 눈 반짝
    pb.rect(1, 7, 3, 2, K[0]); pb.set(0, 8, K[0]);                                          // 꽁지
    if (wing === 0) { pb.limb(9, 6, 5, 1, 2, K[2]); pb.limb(10, 6, 9, 0, 1, K[3]); }
    else if (wing === 1) { pb.limb(9, 7, 4, 7, 2, K[2]); pb.set(3, 7, K[3]); }
    else if (wing === 2) { pb.limb(9, 8, 6, 13, 2, K[2]); pb.set(6, 13, K[3]); }
    else { pb.limb(11, 7, 4, 8, 1, K[2]); }
    return selOut(pb).canvas();
  };
  const r = [0, 1, 2, 3].map(mkF), l = r.map(flipC);
  for (const f of [...r, ...l]) { f.ax = 9; f.ay = 7; }
  return { r, l };
})();
// 만장굴의 박쥐 (동굴에서는 까마귀 대신): 막 날개를 펄럭이며 같은 방식으로 내리꽂음
const BAT = (() => {
  const K = ['#16121c', '#2a2232', '#3e3248', '#5a4a66'].map(c => mute(c)), eye = '#e8584a';
  const mkF = (wing) => {
    const pb = new PB(18, 14), cx = 9, cy = 7;
    const span = [[-1, -5], [0, -2], [1, 3], [0, 1]][wing];   // 날개 끝 높이 (위 · 가운데 · 아래 · 접음)
    if (wing < 3) for (const sd of [-1, 1]) {
      const tipX = cx + sd * 8, tipY = cy + span[1];
      for (let k = 0; k <= 8; k++) { const t = k / 8, x = cx + sd * k, yTop = Math.round(cy - 1 + (tipY - cy + 1) * t), yBot = Math.round(cy + 2 + (tipY - cy) * t * 0.6 + Math.sin(t * Math.PI * 3) * 1.2 * t); for (let y = Math.min(yTop, yBot); y <= Math.max(yTop, yBot); y++) pb.set(x, y, y === yTop ? K[3] : K[1]); }
      pb.limb(cx + sd, cy - 1, tipX, tipY, 1, K[2]);   // 날개 뼈
    } else { pb.rect(cx - 3, cy - 1, 7, 4, K[1]); }
    pb.ellipse(cx + 0.5, cy + 1, 2.2, 2.6, (a, b) => b < -0.3 ? K[2] : K[1]);
    pb.set(cx - 1, cy - 2, K[2]); pb.set(cx + 2, cy - 2, K[2]);   // 귀
    pb.set(cx, cy, eye); pb.set(cx + 1, cy, eye);
    return selOut(pb).canvas();
  };
  const r = [0, 1, 2, 3].map(mkF), l = r.map(flipC);
  for (const f of [...r, ...l]) { f.ax = 9; f.ay = 7; }
  return { r, l };
})();
class Crow {
  constructor(x, delay) { this.px = x; this.py = -VOFF + 50 + rand(-6, 6); this.x = x + rand(-40, 40); this.sx = this.x; this.y = -VOFF - 16; this.t = 0; this.delay = delay; this.state = 'in'; this.dodged = false; this.anim = rand(0, 6); this.face = 1; this.bat = !!themeCfg().indoor; }
  update(dt) {
    this.t += dt; this.anim += dt * (this.bat ? 18 : 12);
    const sp = 210 * Math.min(1, 1.35 / G.speed);
    if (this.state === 'in') {
      const k = easeOut(this.t / (0.45 * G.speed)); this.x = lerp(this.sx, this.px, k); this.y = lerp(-VOFF - 16, this.py, k); this.face = P.x >= this.x ? 1 : -1;
      if (this.t >= this.delay) { this.state = 'aim'; this.t = 0; if (this.bat) Sound.sfx.tink(); else Sound.sfx.caw(); }
    } else if (this.state === 'aim') {
      this.y = this.py + Math.sin(this.anim * 0.4) * 1.5;
      if (!this.locked) {
        this.tx = P.x; this.ty = P.y - 10; this.face = P.x >= this.x ? 1 : -1;
        if (this.t >= 0.3 * G.speed) {
          this.locked = true; Sound.sfx.tink();
          const dx = this.tx - this.x, dy = Math.max(50, this.ty - this.y), L = Math.hypot(dx, dy); this.vx = dx / L; this.vy = dy / L;
          this.gx = this.x + this.vx / this.vy * (GROUND - 4 - this.y);
          fx({ x: this.x, y: this.y - 2, kind: 'flare', size: 5, life: 0.18, col: C.red[3] });
        }
      }
      if (this.t >= 0.9 * G.speed) { this.state = 'dive'; Sound.sfx.whoosh(); }
    } else if (this.state === 'dive') {
      this.x += this.vx * sp * dt; this.y += this.vy * sp * dt;
      this.ghT = (this.ghT || 0) - dt; if (this.ghT <= 0) { this.ghT = 0.03; G.ghosts.push({ img: this.frame(), x: this.x, y: this.y, life: 0.15, col: C.red[2] }); }
      if (this.y >= GROUND - 4) {
        this.state = 'up'; this.vy = -1; shake(0.09); dust(this.x, GROUND, 5, this.vx > 0 ? 1 : -1, 1); Sound.sfx.thud();
        fx({ x: this.x, y: GROUND - 2, kind: 'flare', size: 8, life: 0.12, col: '#fff4e0' }); fx({ x: this.x, y: GROUND - 1, kind: 'ring', life: 0.25, col: '#fff4e0' }); if (Math.abs(this.x - P.x) < 30) hitstop(0.02, 0.6);   // 땅에 꽂히는 순간 (숨비 가까이면 짧게 멈칫)
        for (let i = 0; i < 10; i++) fx({ x: this.x, y: GROUND - 4, vx: rand(-50, 50), vy: -rand(30, 90), grav: 120, drag: 2, life: rand(0.5, 0.9), kind: 'chunk', size: 1, col: pick(['#2c2634', '#40384c']) });
      }
    } else {
      this.x += this.vx * sp * 0.6 * dt; this.y -= sp * 0.55 * dt;
      if (this.y < -VOFF - 20 || this.x < -20 || this.x > W + 20) return false;
    }
    return !this.dead;
  }
  boxes() { return this.state === 'dive' ? [{ x: this.x - 5, y: this.y - 3, w: 10, h: 6 }] : NONE; }
  onShot() { this.dead = true; burst(this.x, this.y, 8, ['#2c2634', '#40384c', '#5a5268'], 60, 0.6, 120, 'chunk'); reward('shatter', this.x, this.y - 10); return true; }
  frame() {
    const S = this.bat ? BAT : CROW, set = (this.state === 'dive' ? this.vx : this.face) >= 0 ? S.r : S.l;
    if (this.state === 'dive') return set[3];
    return set[[0, 1, 2, 1][Math.floor(this.anim) % 4]];
  }
  drawDecal() {
    if (this.state !== 'aim') return;
    // 조준선: 따라다니는 동안은 옅게, 굳으면 붉은 점선이 빨라지게 깜빡 + 땅에 ×
    if (!this.locked) { g.fillStyle = 'rgba(232,69,74,0.3)'; const dx = P.x - this.x, dy = Math.max(50, P.y - 10 - this.y), n = Math.hypot(dx, dy) / 6; for (let i = 1; i < n; i++) g.fillRect(Math.round(this.x + dx * i / n), Math.round(this.y + dy * i / n), 1, 1); return; }
    const left = 0.9 * G.speed - this.t, blink = Math.floor(this.t * (left < 0.25 * G.speed ? 20 : 8)) % 2;
    const n = Math.hypot(this.gx - this.x, GROUND - 4 - this.y) / 5;
    for (let i = 1; i < n; i++) { const x = Math.round(lerp(this.x, this.gx, i / n)), y = Math.round(lerp(this.y, GROUND - 4, i / n)); g.fillStyle = INK; g.fillRect(x - 1, y - 1, 3, 3); g.fillStyle = blink ? C.yel[3] : C.red[3]; g.fillRect(x, y, 1, 1); }
    const gx = Math.round(this.gx); g.fillStyle = INK; g.fillRect(gx - 3, GROUND - 1, 7, 3); g.fillStyle = C.red[3]; g.fillRect(gx - 2, GROUND, 5, 1); g.fillRect(gx, GROUND - 1, 1, 3);
  }
  draw() { const f = this.frame(); g.drawImage(f, Math.round(this.x - 9), Math.round(this.y - 7)); }
}
class PatCrow extends Pattern {
  constructor() { super(7.5); this.next = 0.3; }
  update(dt) {
    this.t += dt; this.next -= dt;
    if (this.next > 0 || this.t > this.dur - 2.2) return;
    const n = 2 + (G.diff >= 2.5 ? 1 : 0);
    for (let i = 0; i < n; i++) spawnHz(new Crow(clamp(P.x + (i - (n - 1) / 2) * 70 + rand(-10, 10), 20, G.arenaR - 20), (0.55 + i * 0.35) * G.speed));
    this.next = Math.max(2.0, 2.6 - G.diff * 0.1);
  }
}

// ── 방언 비: 제주어 한 낱말이 글자 돌판이 되어 차례로 떨어짐 · 다 떨어지면 뜻이 살짝 ──
const DIALECT = [['ᄒᆞᆫ저옵서예', '어서 오세요'], ['하영', '많이'], ['속솜ᄒᆞ라', '조용히 해'], ['재게재게', '빨리빨리'], ['폭싹 속았수다', '수고 많았어요'], ['몽캐지 말라', '꾸물대지 마'], ['맨도롱 또똣', '알맞게 따뜻한'], ['놀멍 쉬멍', '놀면서 쉬면서'], ['게메', '글쎄'], ['요망지다', '야무지다'], ['무사', '왜'], ['고맙수다', '고맙습니다'], ['강 봅서', '가 보세요'], ['왕 봅서', '와 보세요'], ['지꺼지다', '기쁘다'], ['바당', '바다'], ['도새기', '돼지'], ['낭', '나무'], ['감저', '고구마'], ['지슬', '감자'], ['ᄂᆞᆷ삐', '무'], ['와리지 말라', '서두르지 마'], ['졸바로', '똑바로'], ['ᄆᆞᆫ딱', '모두'], ['ᄒᆞᆫ디', '함께'], ['어멍', '어머니'], ['아방', '아버지'], ['수눌음', '품앗이'], ['물애기', '갓난아기'], ['쉐', '소'], ['비바리', '처녀'], ['경ᄒᆞ난', '그러니까']];
// 한 낱말이 통째로 뭉친 큰 글자 덩어리: 그림자 · 흐린 낱말로 자리를 알리고 → 쾅 떨어져 땅을 울린 뒤 글자 조각으로 부서짐
const WORD_RAMP = () => [C.org[0], C.org[1], C.org[2], C.org[3], C.yel[2], C.yel[3]];
class DialectWord {
  constructor(word, mean, x, land) {
    this.word = word; this.mean = mean; this.spr = logoText(word, graphemes(word).length <= 3 ? 2 : 1, WORD_RAMP());
    this.w = this.spr.width; this.h = this.spr.height; const lo = G.arenaL + this.w / 2 + 2, hi = G.arenaR - this.w / 2 - 2; this.x = lo <= hi ? clamp(x, lo, hi) : (G.arenaL + G.arenaR) / 2;
    this.land = land; this.fall = 0.42 * G.speed; this.t = 0; this.y = -VOFF - this.h - 4; this.dodged = false; this.st = 'warn';
  }
  update(dt) {
    this.t += dt;
    if (this.st === 'warn' && this.t >= this.land - this.fall) { this.st = 'fall'; Sound.sfx.whoosh(); }
    if (this.st === 'fall') {
      const s = clamp((this.t - (this.land - this.fall)) / this.fall, 0, 1);
      this.y = lerp(-VOFF - this.h - 4, GROUND - this.h, s * s);
      if (Math.random() < dt * 40) fx({ x: this.x + rand(-this.w / 2, this.w / 2), y: this.y - 2, vy: -rand(20, 60), life: 0.25, kind: 'streak', len: randi(4, 8), col: 'rgba(255,244,224,0.45)' });
      if (s >= 1) {
        this.st = 'land'; this.lT = 0; Sound.sfx.boom(); Sound.duck(0.25); shake(0.3); kick(0, 3); hitstop(0.04);
        for (let k = -2; k <= 2; k++) dust(this.x + k * this.w / 5, GROUND, 3, Math.sign(k), 2);
        fx({ x: this.x, y: GROUND - 1, kind: 'ring', big: true, life: 0.35, col: C.yel[3] });
        for (let i = 0; i < 12; i++) fx({ x: this.x + rand(-this.w / 2, this.w / 2), y: GROUND - 3, vx: rand(-90, 90), vy: -rand(80, 180), grav: 480, life: rand(0.4, 0.7), kind: 'chunk', size: randi(1, 2), col: pick([C.soil[2], C.soil[3], C.stone[3]]) });
        light(this.x, GROUND - this.h / 2, this.w * 0.6, C.yel[3], 0.8);
      }
    }
    if (this.st === 'land') {
      this.lT += dt;
      if (this.lT > 0.32 * G.speed) {
        for (let i = 0; i < 14; i++) fx({ x: this.x + rand(-this.w / 2, this.w / 2), y: GROUND - rand(2, this.h), vx: rand(-80, 80), vy: -rand(60, 160), grav: 420, life: rand(0.4, 0.8), kind: 'chunk', size: randi(1, 2), col: pick(WORD_RAMP()) });
        popup('= ' + this.mean, this.x, GROUND - this.h - 12, C.yel[2], 's'); Sound.sfx.shatter();
        return false;
      }
    }
    return !this.dead;
  }
  boxes() { return this.st === 'fall' ? [{ x: this.x - this.w / 2 + 2, y: this.y + 2, w: this.w - 4, h: this.h - 3 }] : NONE; }
  onShot(sh) { spark(sh.x, sh.y); Sound.sfx.tink(); return true; }
  drawDecal() {
    if (this.st !== 'warn') return;
    const k = clamp(this.t / (this.land - this.fall), 0, 1), w = Math.round(this.w * (0.5 + 0.5 * k)), blink = Math.floor(this.t * (k > 0.7 ? 18 : 6)) % 2;
    g.fillStyle = `rgba(30,16,14,${0.15 + 0.45 * k})`; g.fillRect(Math.round(this.x - w / 2), GROUND, w, 2); g.fillRect(Math.round(this.x - w / 2) + 3, GROUND - 1, w - 6, 1);
    g.fillStyle = blink ? C.yel[3] : C.red[3]; for (const ex of [this.x - this.w / 2, this.x + this.w / 2 - 2]) g.fillRect(Math.round(ex), GROUND + 2, 2, 1);
    if (k > 0.25) { g.save(); g.globalAlpha = 0.18 + 0.2 * k; g.drawImage(silOf(this.spr, C.red[2]), Math.round(this.x - this.w / 2), GROUND - this.h); g.restore(); }   // 떨어질 자리에 낱말 그림자
    topMark(this.x - this.w / 2 + 3, this.t); topMark(this.x + this.w / 2 - 3, this.t);
  }
  draw() {
    if (this.st === 'warn') return;
    const sq = this.st === 'land' && this.lT < 0.08 ? 2 : 0, x = Math.round(this.x - this.w / 2), y = Math.round(this.y);
    if (sq) g.drawImage(this.spr, x - 2, y + sq, this.w + 4, this.h - sq);   // 쿵: 살짝 찌그러짐
    else g.drawImage(this.spr, x, y);
    if (this.st === 'land') { g.fillStyle = INK; for (let k = 0; k < this.w; k += 5) g.fillRect(x + k, GROUND - 1 - ((k / 5) % 2), 3, 1); }   // 박힌 자리 금
  }
}
class PatDialect extends Pattern {
  constructor() { super(7.5); this.next = 0.3; this.used = []; }
  update(dt) {
    this.t += dt; this.next -= dt;
    if (this.next > 0 || this.t > this.dur - 2.2) return;
    const pool = DIALECT.filter(d => !this.used.includes(d[0])), [word, mean] = pick(pool.length ? pool : DIALECT); this.used.push(word);
    spawnHz(new DialectWord(word, mean, P.x + rand(-20, 20), 1.0 * G.speed));
    // 높은 단계: 가끔 두 번째 낱말이 옆에 조금 늦게 (사이는 비워 둠)
    if (G.diff >= 1.5 && Math.random() < 0.4) { const [w2, m2] = pick(DIALECT), side = P.x < W / 2 ? 1 : -1; spawnHz(new DialectWord(w2, m2, P.x + side * 150, 1.35 * G.speed)); }
    this.next = 1.9;
  }
}

// ── 설문대할망 · 칼 든 하르방 이벤트용 공격 ──
// 번짐 없는 픽셀 선 (두께 w)
function pxLine(x0, y0, x1, y1, w, col) { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0))), o = (w - 1) >> 1; g.fillStyle = col; for (let i = 0; i <= n; i++) g.fillRect(Math.round(lerp(x0, x1, i / n)) - o, Math.round(lerp(y0, y1, i / n)) - o, w, w); }
// 칼바람 초승달: 가운데는 하얗게 달아오르고 끝으로 갈수록 금빛 · 주황, 바깥 먹선 (왼쪽으로 날아가는 모양 기준)
const SLASH_SPR = {};
function slashSprite(hh) {
  if (SLASH_SPR[hh]) return SLASH_SPR[hh];
  const w = 12, h = hh * 2 + 3, pb = new PB(w, h);
  for (let j = -hh; j <= hh; j++) { const t = j / hh, bow = 6 * (1 - t * t), th = Math.max(1, Math.round(3.2 * (1 - t * t))) + 1;
    for (let k = 0; k < th; k++) { const x = Math.round(2 + (6 - bow) + k); pb.set(x, j + hh + 1, k === 0 ? '#fff4e0' : k === 1 ? C.yel[3] : k === 2 ? C.org[3] : C.org[2]); } }
  const r = selOut(pb).canvas();
  return (SLASH_SPR[hh] = { l: r, r: flipC(r) });
}
// 칼바람 베기: 지나갈 높이에 점선이 깔린 뒤 초승달 칼바람이 날아옴 (낮으면 뛰고, 높으면 구르기)
class SlashWave {
  constructor(x, high, speed, warn, dir = -1) { this.dir = dir; this.x = x; this.high = high; this.y = high ? GROUND - 28 : GROUND - 8; this.speed = speed; this.warn = warn; this.t = 0; this.dodged = false; }
  update(dt) {
    this.t += dt;
    if (this.t >= this.warn) { if (!this.go) { this.go = true; Sound.sfx.whoosh(); } this.x += this.dir * this.speed * dt; if (Math.random() < dt * 40) fx({ x: this.x - this.dir * 6, y: this.y + rand(-8, 8), vx: -this.dir * 40, life: 0.2, kind: 'streak', len: randi(4, 8), col: 'rgba(255,244,224,0.5)' }); }
    return !this.dead && this.x > -20 && this.x < W + 20;
  }
  boxes() { return this.go ? [{ x: this.x - 5, y: this.y - (this.high ? 12 : 8), w: 10, h: this.high ? 24 : 16 }] : NONE; }
  draw() {
    if (!this.go) {
      if (Math.floor(this.t * 10) % 2) return;
      const ly = Math.round(this.y), xa = this.dir < 0 ? 4 : this.x + 10, xb = this.dir < 0 ? this.x - 10 : W - 4; for (let x = xa; x < xb; x += 6) { g.fillStyle = INK; g.fillRect(x - 1, ly - 1, 5, 3); g.fillStyle = C.red[3]; g.fillRect(x, ly, 3, 1); }
      return;
    }
    const hh = this.high ? 12 : 8, x = Math.round(this.x), y = Math.round(this.y), sp = slashSprite(hh)[this.dir < 0 ? 'l' : 'r'];
    for (let k = 1; k <= 3; k++) { g.globalAlpha = 0.35 / k; g.drawImage(sp, x - 6 - this.dir * k * 6, y - hh - 1); } g.globalAlpha = 1;   // 잔상
    g.drawImage(sp, x - 6, y - hh - 1);
    light(x, y, 16, '#fff0c0', 0.5);
  }
}
// 난도질: 땅에 칼자국이 번쩍인 뒤 커다란 칼이 꽂힘
const BIG_KNIFE = (() => {
  const pb = new PB(10, 34), BL = ['#7e8284', '#b0b4b2', '#dcdcd4', '#f2f2ea'].map(c => mute(c));
  for (let y = 0; y < 10; y++) for (let x = 3; x < 7; x++) pb.set(x, y, x === 3 ? C.wood[2] : C.wood[1]);
  pb.rect(1, 10, 8, 2, BL[0]);
  for (let y = 12; y < 34; y++) { const w = y > 29 ? 34 - y : 7; for (let x = 1; x < 1 + w; x++) pb.set(x, y, x === 1 ? BL[3] : x < 4 ? BL[2] : x < 7 ? BL[1] : BL[0]); }
  return selOut(pb).canvas();
})();
class KnifeDrop {   // 도마 난도질: 예고 → 하늘에서 칼날이 번뜩 → 확 빨라지며 내리꽂힘 → 콱! (멈칫 · 섬광 · 땅 갈라짐 · 흙먼지) → 꽂힌 칼이 부르르 떪
  constructor(x, delay) { this.x = Math.round(x); this.delay = delay; this.t = 0; this.y = -VOFF - 34; this.vy = 380; this.st = 'warn'; this.dodged = false; this.cracks = Array.from({ length: 6 }, (_, i) => { const s = i < 3 ? -1 : 1, pts = []; let cx = 0, cy = 0; for (let k = 0; k < 4 + (i % 3); k++) { cx += s * randi(1, 3); cy = clamp(cy + randi(-1, 1), 0, 3); pts.push([cx, cy]); } return pts; }); }
  update(dt) {
    this.t += dt;
    if (this.st === 'warn' && this.t >= this.delay) { this.st = 'fall'; Sound.sfx.whoosh(); }
    if (this.st === 'fall') {
      this.vy = Math.min(1600, this.vy + 7000 * dt / G.speed); this.y += this.vy / G.speed * dt;   // 확 빨라지며 내리꽂힘
      if (this.y >= GROUND - 26) {
        this.y = GROUND - 26; this.st = 'stuck'; this.sT = 0;
        Sound.sfx.stab(); shake(0.14); hitstop(0.03, 0.25);
        fx({ x: this.x, y: GROUND - 3, kind: 'flare', size: 11, life: 0.12, col: '#fff4e0' }); fx({ x: this.x, y: GROUND - 1, kind: 'ring', big: true, life: 0.28, col: '#fff4e0' });
        dust(this.x, GROUND, 4, 0, 1);
        for (let i = 0; i < 9; i++) fx({ x: this.x + rand(-3, 3), y: GROUND - 2, vx: rand(-110, 110), vy: -rand(60, 170), grav: 420, life: rand(0.35, 0.6), kind: 'chunk', size: randi(1, 2), col: pick([C.stone[2], C.stone[3], C.soil[3], C.soil[2]]) });
        for (const sd of [-1, 1]) fx({ x: this.x + sd * 4, y: GROUND - 2, vx: sd * rand(140, 190), vy: -rand(10, 30), drag: 6, life: 0.22, kind: 'streak', len: 4, col: 'rgba(255,244,224,0.8)' });   // 옆으로 튀는 충격선
        light(this.x, GROUND - 6, 22, '#fff4e0', 0.8);
      }
    }
    if (this.st === 'stuck') { this.sT += dt; if (this.sT > 0.6 * G.speed) { burst(this.x, GROUND - 14, 6, [C.stone[3], '#dcdcd4'], 60, 0.4, 300, 'chunk'); return false; } }
    return !this.dead;
  }
  boxes() { return this.st === 'fall' || (this.st === 'stuck' && this.sT < 0.1) ? [{ x: this.x - 4, y: this.st === 'fall' ? this.y : GROUND - 26, w: 8, h: this.st === 'fall' ? 34 : 26 }] : NONE; }
  drawDecal() {
    if (this.st === 'stuck') {   // 꽂힌 자리 땅 갈라짐 (칼이 사라지며 함께 옅어짐)
      const a = clamp(1 - (this.sT / G.speed - 0.35) / 0.25, 0, 1); if (a <= 0) return;
      g.globalAlpha = a; g.fillStyle = INK; for (const pts of this.cracks) for (const [cx, cy] of pts) g.fillRect(this.x + cx, GROUND + cy, 1, 1);
      g.fillStyle = 'rgba(30,16,14,0.45)'; g.fillRect(this.x - 6, GROUND, 13, 2); g.globalAlpha = 1;
      return;
    }
    if (this.st !== 'warn') return;
    const k = clamp(this.t / this.delay, 0, 1), on = Math.floor(this.t * (k > 0.7 ? 18 : 6)) % 2;
    g.fillStyle = INK; g.fillRect(this.x - 4, GROUND - 1, 9, 3); g.fillStyle = on ? '#fff4e0' : C.red[3]; g.fillRect(this.x - 3, GROUND, 7, 1);
    g.fillStyle = `rgba(232,69,74,${0.15 + 0.25 * k})`; for (let y = -VOFF + 40; y < GROUND - 4; y += 5) g.fillRect(this.x, y, 1, 2);
    topMark(this.x, this.t);
  }
  draw() {
    if (this.st === 'warn') {   // 떨어지기 직전: 화면 위에서 칼날이 번뜩
      const left = this.delay - this.t; if (left > 0.12 * G.speed) return;
      g.drawImage(BIG_KNIFE, this.x - 5, -VOFF - 20 - Math.round(left / G.speed * 30)); if (Math.floor(this.t * 30) % 2) { g.fillStyle = '#fff4e0'; g.fillRect(this.x - 2, -VOFF + 4, 3, 1); g.fillRect(this.x - 1, -VOFF + 3, 1, 3); }
      return;
    }
    if (this.st === 'fall') {   // 잔상 · 속도선
      g.save(); for (let i = 1; i <= 2; i++) { g.globalAlpha = 0.28 / i; g.drawImage(BIG_KNIFE, this.x - 5, Math.round(this.y - 8 - i * this.vy * 0.012)); } g.restore();
      g.fillStyle = 'rgba(255,244,224,0.55)'; g.fillRect(this.x - 4, Math.round(this.y - 30), 1, 18); g.fillRect(this.x + 4, Math.round(this.y - 24), 1, 12);
      g.drawImage(BIG_KNIFE, this.x - 5, Math.round(this.y - 8)); return;
    }
    const q = this.sT / G.speed, wob = q < 0.28 ? (Math.floor(this.sT * 40) % 2 ? 1 : -1) * (q < 0.14 ? 1 : 0.5) : 0, sink = q < 0.05 ? 2 : q < 0.1 ? 1 : 0;   // 꽂힌 칼이 부르르 떨다 멎음 · 꽂히는 순간 깊이 박혔다 살짝 올라옴
    g.save(); if (q > 0.4) g.globalAlpha = 0.5; g.drawImage(BIG_KNIFE, this.x - 5 + Math.round(wob), Math.round(this.y - 8 + sink)); g.restore();
    if (q < 0.06) { g.globalAlpha = 0.8; g.drawImage(silOf(BIG_KNIFE, '#fff4e0'), this.x - 5, Math.round(this.y - 8 + sink)); g.globalAlpha = 1; }   // 꽂히는 순간 칼이 하얗게 번쩍
  }
}
const SMALL_KNIFE = (() => { const pb = new PB(12, 5), BL = ['#9ea2a0', '#dcdcd4'].map(c => mute(c)); pb.rect(0, 1, 3, 2, C.wood[1]); for (let x = 3; x < 12; x++) { pb.set(x, 1, BL[1]); if (x < 11) pb.set(x, 2, BL[0]); } const c = selOut(pb).canvas(); c.flip = flipC(c); c.metal = true; return c; })();

// 폭포 내리기: 하늘에서 물방울이 떨어지며 자리를 알리고 → 물줄기가 쏟아져 → 양옆으로 낮은 물결이 퍼짐 (뛰어넘기)
const WATER = ['#2e5a7a', '#4a86a8', '#7ab4cc', '#bfe0ea', '#f2fbff'].map(c => mute(c));
// 폭포 물줄기 결: 세로로 흐르는 물살 무늬 (스크롤해서 흐르게) · 양 가장자리는 진한 물빛 테
const FALL_TILE = (() => {
  const w = 19, h = 48, pb = new PB(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const e = Math.abs(x - (w - 1) / 2) / ((w - 1) / 2), streak = vnoise(x * 0.9, y * 0.08, 91) + (hash2(x, y >> 2, 92) - 0.5) * 0.3;
    const L = 0.75 - e * 0.55 + (streak - 0.5) * 0.7;
    pb.set(x, y, e > 0.9 ? WATER[0] : L > 0.75 ? WATER[4] : L > 0.5 ? WATER[3] : L > 0.28 ? WATER[2] : WATER[1]);
  }
  return pb.canvas();
})();
class WaterFall {
  constructor(x, delay) { this.x = Math.round(x); this.delay = delay; this.t = 0; this.dodged = false; this.dur = 0.32 * G.speed; }
  update(dt) {
    this.t += dt;
    if (this.t < this.delay) { if (Math.random() < dt * (8 + 30 * this.t / this.delay)) fx({ x: this.x + rand(-4, 4), y: -VOFF + 36, vy: rand(160, 240), grav: 300, life: (GROUND + VOFF - 36) / 220, kind: 'px', col: pick([WATER[2], WATER[3]]) }); return true; }
    if (!this.poured) {
      this.poured = true; Sound.sfx.splash(); shake(0.15);
      splashFx(this.x, 1.6); fx({ x: this.x, y: GROUND - 1, kind: 'ring', big: true, life: 0.35, col: WATER[3] });
      for (const d of [-1, 1]) { const r = new Ripple(this.x + d * 10, d, (105 + G.tier * 5) * evK()); r.pat = this.pat; spawnHz(r); }
    }
    return !this.dead && this.t < this.delay + this.dur;
  }
  boxes() { if (!this.poured) return NONE; const k = (this.t - this.delay) / this.dur, hw = Math.min(8, Math.max(2, Math.round(9 * (k < 0.7 ? 1 : (1 - k) / 0.3)))); return [{ x: this.x - hw, y: -VOFF + 36, w: hw * 2, h: GROUND + VOFF - 36 }]; }   // 끝날 때 가늘어지는 물줄기만큼만
  drawDecal() {
    if (this.t >= this.delay) return;
    const k = this.t / this.delay, w = Math.round(8 + 10 * k);
    g.fillStyle = `rgba(46,90,122,${0.2 + 0.4 * k})`; g.fillRect(this.x - (w >> 1), GROUND, w, 2);   // 젖어 가는 땅
    g.fillStyle = WATER[3]; if (Math.floor(this.t * 12) % 2) g.fillRect(this.x - (w >> 1), GROUND - 1, w, 1);
    topMark(this.x, this.t);
  }
  draw() {
    if (!this.poured) return;
    const k = (this.t - this.delay) / this.dur, hw = Math.max(2, Math.round(9 * (k < 0.7 ? 1 : (1 - k) / 0.3))), top = -VOFF + 36, off = Math.floor(this.t * 260) % FALL_TILE.height;
    // 물줄기: 결 무늬가 아래로 흐름 · 끝날 땐 가늘어짐 · 바깥 먹선 1px로 다른 스프라이트와 같은 결
    g.fillStyle = mix(WATER[0], INK, 0.5); g.fillRect(this.x - hw - 1, top, 1, GROUND - top); g.fillRect(this.x + hw + 1, top, 1, GROUND - top);
    for (let y = top - off; y < GROUND; y += FALL_TILE.height) {
      const y0 = Math.max(top, y), y1 = Math.min(GROUND, y + FALL_TILE.height);
      g.drawImage(FALL_TILE, 9 - hw, y0 - y, hw * 2 + 1, y1 - y0, this.x - hw, y0, hw * 2 + 1, y1 - y0);
    }
    // 위: 물이 쏟아지는 물안개, 아래: 물보라 웅덩이
    // 시작점은 물안개 구름 속에서 쏟아지게 (잘린 듯한 윗단을 가림)
    for (let i = 0; i < 7; i++) { const a = i * 0.9 + this.t * 1.5, cx = Math.round(this.x + Math.cos(a) * (hw + 4)), cy = top + Math.round(Math.sin(a * 1.3) * 2); disc(g, cx, cy, 4 + (i % 3), mix(WATER[2], INK, 0.35)); }
    for (let i = 0; i < 7; i++) { const a = i * 0.9 + this.t * 1.5, cx = Math.round(this.x + Math.cos(a) * (hw + 4)), cy = top - 1 + Math.round(Math.sin(a * 1.3) * 2); disc(g, cx, cy, 3 + (i % 3), i % 2 ? WATER[3] : WATER[4]); }
    g.fillStyle = WATER[2]; g.fillRect(this.x - hw - 6, GROUND - 2, hw * 2 + 13, 2); g.fillStyle = WATER[4]; g.fillRect(this.x - hw - 4, GROUND - 3, hw * 2 + 9, 1);
    for (let i = 0; i < 6; i++) { const a = this.t * 9 + i; g.fillStyle = WATER[4]; g.fillRect(Math.round(this.x + Math.cos(a) * (hw + 5)), GROUND - 3 - Math.round(Math.abs(Math.sin(a)) * 8), 2, 2); }
    light(this.x, GROUND - 30, 30, '#c8f0ff', 0.5);
  }
}
class Ripple { // 땅을 타고 퍼지는 낮은 물결 (높이 10)
  constructor(x, dir, speed) { this.x = x; this.dir = dir; this.speed = speed; this.t = 0; this.dodged = false; }
  update(dt) { this.t += dt; this.x += this.dir * this.speed * dt; if (Math.random() < dt * 25) fx({ x: this.x, y: GROUND - 8, vx: this.dir * 30, vy: -rand(40, 80), grav: 400, life: 0.35, kind: 'px', col: WATER[4] }); return !this.dead && this.x > -20 && this.x < W + 20; }
  boxes() { return this.t < 0.3 * G.speed ? NONE : [{ x: this.x - 5, y: GROUND - 10, w: 10, h: 10 }]; }   // 생기고 0.3초 뒤부터 (뛸 틈)
  draw() {
    for (let k = 0; k < 16; k++) {
      const hh = Math.round(k < 2 ? 10 * (k + 1) / 3 : 10 * Math.exp(-(k - 2) / 4.5)); if (hh < 1) continue;
      const xx = Math.round(this.x - this.dir * k);
      g.fillStyle = mix(WATER[0], INK, 0.5); g.fillRect(xx, GROUND - hh - 1, 1, 1); for (let j = 0; j < hh; j++) { g.fillStyle = j === 0 ? WATER[4] : j === 1 ? WATER[3] : j < hh * 0.6 ? WATER[2] : WATER[1]; g.fillRect(xx, GROUND - hh + j, 1, 1); }
    }
  }
}
// 오름 스프라이트: 배경 오름과 같은 풀빛 팔레트 · 왼쪽 위 빛 · 비스듬한 풀 결 · 밑동 흙 · 큰 것은 꼭대기 분화구 (셀아웃 외곽선)
const OREUM_SPR = {};
function oreumSprite(H) {
  if (OREUM_SPR[H]) return OREUM_SPR[H];
  const hw = 13 + Math.round(H * 0.3), w = hw * 2 + 3, pb = new PB(w, H + 4), cx = hw + 1;
  const GR = ['#284a3e', '#30584a', '#3a6852', '#4c7c5e', '#64946c'].map(c => mute(c)), SO = C.soil;
  for (let i = -hw; i <= hw; i++) {
    const t = i / hw, a = Math.abs(t);
    let top = H - H * (1 - Math.pow(a, 1.7)); if (H > 26 && a < 0.18) top += (0.18 - a) / 0.18 * 2.4;
    top = Math.round(top + (hash2(i, H, 61) - 0.5) * 1.2);
    for (let y = Math.max(0, top); y < H + 4; y++) {
      const d = y - top, ny = clamp((y / H) * 2 - 1, -1, 1);
      let L = 0.62 - t * 0.42 + (d < 2 ? 0.18 : 0) - (y > H - 4 ? 0.2 : 0) + (vnoise((cx + i) * 0.3 + y * 0.25, y * 0.12, 62) - 0.5) * 0.25;
      if ((y + Math.round(i * 0.6)) % 5 === 0 && d > 2) L -= 0.08;   // 비스듬한 풀 결
      let col = band(GR, clamp(L, 0, 0.999), cx + i, y, 0.6);
      if (y >= H) col = SO[y === H ? 3 : y === H + 1 ? 2 : 1];       // 뚫고 나온 흙
      if (d === 0 && hash2(i, H, 63) < 0.25) col = GR[4];             // 풀잎 끝 반짝
      pb.set(cx + i, y, col);
    }
  }
  return (OREUM_SPR[H] = selOut(pb).canvas());
}
// 오름 솟기: 땅이 부풀고 갈라진 뒤 풀 덮인 오름이 불쑥 솟았다 가라앉음
class OreumRise {
  constructor(x, delay, H) { this.x = Math.round(x); this.delay = delay; this.H = H; this.t = 0; this.h = 0; this.dodged = false; this.w = 14; }
  update(dt) {
    this.t += dt;
    const u = (this.t - this.delay) / G.speed;
    if (u < 0) { if (Math.random() < dt * 20) fx({ x: this.x + rand(-10, 10), y: GROUND - 1, vx: rand(-15, 15), vy: -rand(30, 70), grav: 400, life: 0.3, kind: 'chunk', size: 1, col: pick([C.soil[3], C.leaf[2]]) }); return true; }
    if (!this.up) { this.up = true; Sound.sfx.rise(); Sound.sfx.thud(); shake(0.13); dust(this.x - 12, GROUND, 4, -1, 1); dust(this.x + 12, GROUND, 4, 1, 1); burst(this.x, GROUND - 6, 14, [C.soil[2], C.soil[3], C.leaf[2], C.leaf[3]], 140, 0.6, 420, 'chunk'); fx({ x: this.x, y: GROUND - 1, kind: 'ring', big: true, life: 0.35, col: C.leaf[3] }); fx({ x: this.x, y: GROUND - 4, kind: 'flare', size: 10, life: 0.14, col: '#fff4e0' }); for (let i = 0; i < 5; i++) fx({ x: this.x + rand(-10, 10), y: GROUND - 8, vx: rand(-70, 70), vy: -rand(120, 200), grav: 480, life: rand(0.5, 0.8), kind: 'chunk', size: 2, col: pick([C.leaf[3], C.leaf[2]]) }); }   // 땅을 뚫는 순간: 쿵 · 흙과 풀 덩이가 튀고 충격 고리
    this.h = u < 0.08 ? this.H * 1.12 * u / 0.08 : u < 0.14 ? this.H * (1.12 - 0.12 * (u - 0.08) / 0.06) : u < 0.6 ? this.H : this.H * Math.max(0, 1 - (u - 0.6) / 0.3);   // 확 솟았다가 살짝 내려앉음
    return u < 0.9 && !this.dead;
  }
  boxes() { return this.h > 8 ? [{ x: this.x - 9, y: GROUND - this.h * 0.85, w: 18, h: this.h * 0.85 }] : NONE; }   // 비탈 끝에서 보이지 않는 모서리에 걸리지 않게
  drawDecal() {
    if (this.up) return;
    const k = clamp(this.t / this.delay, 0, 1), r = Math.round(6 + 8 * k);
    g.fillStyle = INK; for (let i = -r; i <= r; i += 2) g.fillRect(this.x + i, GROUND + ((i >> 1) % 2 ? 1 : 0), 1, 1);   // 갈라지는 금
    if (k > 0.5) { const bh = Math.round((k - 0.5) * 6); for (let dx = -10; dx <= 10; dx++) { const h = Math.round(bh * (1 - (dx / 10) ** 2)); if (h > 0) { g.fillStyle = C.leaf[2]; g.fillRect(this.x + dx, GROUND - h, 1, h); } } }   // 부풀어 오르는 땅
  }
  draw() {
    if (this.h < 1) return;
    // 통째로 땅을 뚫고 솟음: 스프라이트 전체가 아래에서 올라오고 땅선에서 잘림
    const spr = oreumSprite(this.H), hh = Math.round(this.h), y = GROUND - hh;
    g.save(); g.beginPath(); g.rect(this.x - spr.width, -VOFF, spr.width * 2, GROUND + VOFF); g.clip();
    g.drawImage(spr, Math.round(this.x - spr.width / 2), y); g.restore();
    if (hh < this.H) { for (let k = 0; k < 3; k++) { g.fillStyle = k % 2 ? C.soil[3] : C.soil[2]; g.fillRect(Math.round(this.x - spr.width / 2 + 4 + hash2(k, hh, 7) * (spr.width - 8)), GROUND - 1 - (k % 2), 2, 1); } }   // 솟는 동안 흙이 흘러내림
  }
}
// 설문대 파도: 치마폭에서 일어난 큰 물결이 굴러옴 (낮으면 뛰어넘기, 높으면 구르기로 밑을 빠져나감 — 높은 파도는 바닥이 비어 있음)
class TideWave {
  constructor(x, dir, speed, high, warn) { this.x = x; this.dir = dir; this.speed = speed; this.high = high; this.warn = warn; this.t = 0; this.dodged = false; }
  update(dt) { this.t += dt; if (this.t < this.warn) return true; if (!this.go) { this.go = true; Sound.sfx.wave(); } this.x += this.dir * this.speed * dt; if (Math.random() < dt * 30) fx({ x: this.x, y: (this.high ? GROUND - 34 : GROUND - 16) + rand(-3, 3), vx: this.dir * 40, vy: -rand(30, 70), grav: 300, life: 0.4, kind: 'px', col: WATER[4] }); return !this.dead && this.x > -30 && this.x < W + 30; }
  boxes() { return !this.go ? NONE : this.high ? [{ x: this.x - 6, y: GROUND - 42, w: 12, h: 26 }] : [{ x: this.x - 6, y: GROUND - 16, w: 12, h: 16 }]; }
  draw() {
    if (!this.go) {   // 예고: 지나갈 높이에 물빛 점선
      if (Math.floor(this.t * 10) % 2) return;
      const y0 = this.high ? GROUND - 30 : GROUND - 8, xa = this.dir < 0 ? 4 : this.x + 12, xb = this.dir < 0 ? this.x - 12 : W - 4;
      for (let x = xa; x < xb; x += 6) { g.fillStyle = INK; g.fillRect(x - 1, y0 - 1, 5, 3); g.fillStyle = WATER[3]; g.fillRect(x, y0, 3, 1); }
      return;
    }
    const hi = this.high, d = this.dir, x0 = Math.round(this.x), tt = this.t, T = TIDE, S = tideSprite(hi, Math.floor(tt * 12) % TIDE_FR, d), P0 = S.geo;
    // 뒤로 남는 물결 자국: 땅선 위 거품 줄이 뒤처지며 옅어짐
    for (let i = 0; i < 9; i++) { const k = ((tt * 1.6 + i / 9) % 1), ux = -P0.back - 2 - k * 46, len = Math.max(1, Math.round((1 - k) * 6)); g.globalAlpha = (1 - k) * 0.8; g.fillStyle = i % 3 ? T[5] : T[6]; g.fillRect(Math.round(x0 + d * ux) - (d < 0 ? 0 : len), GROUND - 1 - (i % 2), len, 1); }
    g.globalAlpha = 1;
    g.drawImage(S, x0 - (d > 0 ? S.ax : S.width - 1 - S.ax), GROUND - S.height + 1);
    if (hi) {   // 아치 바닥 얕은 물 · 아치 천장에서 떨어지는 물줄기
      for (let u = -12; u <= P0.uc; u++) { g.fillStyle = T[2]; g.fillRect(x0 + d * u, GROUND - 1, 1, 1); if ((u + Math.floor(tt * 14)) % 4 === 0) { g.fillStyle = T[5]; g.fillRect(x0 + d * u, GROUND - 1, 1, 1); } }
      for (let i = 0; i < 5; i++) { const ph = (tt * 2.2 + i / 5) % 1, u = -10 + i * 4.5; g.fillStyle = i % 2 ? T[5] : T[4]; g.fillRect(Math.round(x0 + d * u), Math.round(GROUND - P0.gap + ph * (P0.gap - 2)), 1, 2); }
    }
    // 입술 끝에서 떨어지는 물방울 · 물마루 물보라
    const tipX = x0 + d * P0.tip[0], tipY = GROUND - P0.tip[1];
    for (let i = 0; i < 5; i++) { const ph = (tt * 2.6 + i / 5) % 1, fall = hi ? P0.tip[1] - P0.gap : P0.tip[1]; g.fillStyle = i % 2 ? T[5] : T[6]; g.fillRect(tipX + d * Math.round(ph * 3 - 1 + (i % 3)), Math.round(tipY + ph * ph * fall), 1, 2); }
    for (let i = 0; i < 7; i++) { const a = tt * 9 + i * 1.9, r = 3 + (i % 3) * 2; g.fillStyle = i % 3 ? T[6] : T[5]; g.fillRect(x0 + d * Math.round(P0.uc - 2 + Math.cos(a) * r), GROUND - P0.H - 2 + Math.round(Math.sin(a) * 2.5) - (i % 2), 1, 1); }
    light(this.x, GROUND - P0.H / 2, 26, '#c8f0ff', 0.45);
  }
}
// 설문대 파도 그림 (구워 둔 칸 몇 장): 완만한 뒤 비탈 → 물마루 → 나선처럼 가늘어지며 앞으로 말려 내려오는 입술
//  안쪽 관은 입술과 중심이 어긋난 짙은 타원 · 몸통 색은 수면을 따라 층이 지고(빛이 위에서 스며듦) 비탈엔 결 따라 흰 줄
//  거품은 물마루 · 입술 바깥 · 입술 끝(갈퀴처럼 갈라짐) · 낮은 파도 앞발치(부서지는 흰 물)에만 덩어리지게
//  높은 파도는 아래 16px이 비어 굴러서 지나갈 수 있음 (판정과 같게)
const TIDE_FR = 6, TIDE_SPR = {};
function tideSprite(hi, f, dir) {
  const key = (hi ? 'h' : 'l') + f + (dir < 0 ? 'L' : 'R'); if (TIDE_SPR[key]) return TIDE_SPR[key];
  if (dir < 0) { const r = tideSprite(hi, f, 1), l = flipC(r); l.ax = r.width - 1 - r.ax; l.geo = r.geo; return (TIDE_SPR[key] = l); }
  const T = TIDE, H = hi ? 46 : 22, back = hi ? 32 : 22, uc = hi ? 12 : 7, gap = hi ? 16 : 0, br = Math.sin(f / TIDE_FR * 6.283);
  const R0 = (hi ? 17 : 9) + br * 0.5, vc = H - R0, PH = hi ? 3.2 : 3.45, th0 = hi ? 7.5 : 4.6;
  const rOut = q => R0 * (1 - 0.32 * q / PH), thick = q => th0 * Math.pow(Math.max(0, 1 - q / PH), 0.8) + 0.7;
  const top = u => u < -back ? 0 : hi ? H * (1 - Math.pow((uc - Math.min(u, uc)) / (uc + back), 2.2)) : H * Math.pow(Math.sin(clamp((u + back) / (uc + back), 0, 1) * Math.PI / 2), 1.25);   // 뒤 비탈: 높은 파도는 두툼한 둥근 등, 낮은 파도는 완만하게 오르다 물마루에서 수평
  const front = v => uc + Math.pow(Math.max(0, vc - v), 1.25) * (hi ? 0.28 : 0.32);   // 앞면: 아래로 갈수록 앞으로 퍼짐 (물마루 밑은 오목)
  const tcx = uc + R0 * 0.2, tcy = vc - R0 * 0.14, trx = R0 * 0.5, tryy = R0 * 0.42;   // 관: 입술과 중심이 어긋난 타원 (앞 · 아래로 치우침)
  const u0 = -back - 3, w = Math.ceil(uc + R0 + (hi ? 6 : 10) - u0), h = H + 4, ax = -u0, pb = new PB(w, h), fr = f * 3.1;
  const foam = (x, y, s) => vnoise(x * 0.45 + fr, y * 0.45, s);
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const u = px - ax, v = h - 1 - py, dx = u - uc, dy = v - vc, r = Math.hypot(dx, dy);
    let q = Math.atan2(dx, dy); if (q < -Math.PI / 2) q += 2 * Math.PI;
    const inCurl = q >= 0 && q <= PH, ro = inCurl ? rOut(q) : 0, ri = ro - (inCurl ? thick(q) : 0);
    let c = null;
    if (inCurl && r <= ro && r >= ri) {   // 입술
      const out = ro - r, up = Math.cos(q);
      if (out < (q < 1.1 ? 0.9 : 1.2 + (q - 1.1) * 0.9) + foam(u, v, 31) * 1.5 && q < PH - 0.35) c = foam(u, v, 32) < 0.62 ? T[6] : T[5];   // 바깥 테 거품: 꼭대기는 얇고, 앞으로 부서지는 쪽일수록 두꺼운 덩어리
      else c = r - ri < 1.2 ? T[2] : up > 0.2 ? T[4] : T[3];   // 아랫면(관 쪽)은 짙게 · 위쪽은 빛이 비침
    } else if (inCurl && r < ri && ((u - tcx) / trx) ** 2 + ((v - tcy) / tryy) ** 2 < 1) {   // 관 안
      const e = Math.hypot((u - tcx) / trx, (v - tcy) / tryy);
      c = e > 0.78 && (v > tcy || u < tcx) ? T[1] : T[0];
    } else if ((u <= uc && v <= top(u)) || (u > uc && u <= front(v) && v < vc) || (inCurl && r < ri)) {   // 몸통 · 앞면
      const dTop = u <= uc ? top(u) - v : vc + R0 - v, faceSide = u > uc - 2 && v < vc + R0 * 0.6;
      if (u <= uc && dTop < 1.2 + foam(u, v, 33) * 2.2 * clamp((u + back * 0.7) / (uc + back * 0.7), 0, 1)) c = foam(u, v, 34) < 0.6 ? T[6] : T[5];   // 물마루 거품 (앞쪽일수록 두껍게)
      else if (faceSide) c = v > vc + R0 * 0.25 ? T[4] : v > vc - R0 * 0.2 ? T[3] : T[2];   // 앞면: 입술 밑은 빛이 비쳐 밝고 아래는 짙게
      else { c = dTop < 4 ? T[4] : dTop < 9 ? T[3] : dTop < 16 ? T[2] : T[1]; const sl = dTop - (vnoise(u * 0.12 + fr * 0.4, 1, 38) - 0.5) * 3; if (u < uc - 3 && dTop > 3 && (Math.abs(sl - 6.5) < 0.5 || Math.abs(sl - 12.5) < 0.5) && vnoise(u * 0.22 - fr * 0.5, Math.round(sl), 39) > 0.48) c = T[5]; }   // 수면 따라 층 · 수면과 나란히 흐르다 끊기는 거품 줄
    }
    if (!hi && !c && u > uc - 3 && u < front(0) + 6 && v < 3.5 + foam(u, 0, 36) * 4 * (1 - Math.abs(u - front(0) + 2) / 11)) c = foam(u, v, 37) < 0.55 ? T[6] : T[5];   // 낮은 파도 앞발치: 부서지는 흰 물
    if (c && hi && v < gap + 2 && u > -14) { const archTop = u < 0 ? gap * Math.sqrt(Math.max(0, 1 - (u / 14) ** 2)) : gap; if (v < archTop) c = null; else if (v < archTop + 1.5 && foam(u, v, 40) < 0.5) c = T[5]; }   // 굴러서 지나갈 아치 (배 밑은 물보라 테)
    if (c) pb.set(px, py, c);
  }
  // 입술 끝 갈퀴: 거품 손가락 세 갈래 (아래 · 뒤로 휨)
  const tq = PH, tr = rOut(tq) - thick(tq) * 0.5, tu = uc + Math.sin(tq) * tr, tv = vc + Math.cos(tq) * tr;
  for (let k = 0; k < 3; k++) { const ang = tq + (k - 1) * 0.5, len = 2 + ((k + f) % 3); for (let j = 0; j <= len; j++) { const uu = Math.round(tu + Math.sin(ang) * j * 0.8), vv = Math.round(tv + Math.cos(ang) * j * 0.8); if (!hi || vv >= gap) pb.set(uu + ax, h - 1 - vv, j === len ? T[5] : T[6]); } }
  const c = selOut(pb, 0.62).canvas(); c.ax = ax;
  c.geo = { H, back, uc, gap, tip: [Math.round(tu), Math.round(tv)] };
  return (TIDE_SPR[key] = c);
}
const TIDE = ['#0e2e58', '#1a4e86', '#2a72aa', '#3e98c4', '#6cc4dc', '#c8eef4', '#ffffff'].map(c => mute(c, 0.85));

// ── 이벤트: 설문대할망 — 물을 쏟아 폭포를 내리고, 오름을 솟게 하고, 치마폭 파도를 보냄 ──
class PatSeolmun extends PatEvent {
  constructor() {
    super('seolmun'); this.music = true; playMusic({ style: 'chip', song: 'myth', tempo: 104 });
    this.q.push({ k: 'say', text: '이 섬은 나가 멩글앗저!', gap: 0.6 });
    const skills = {
      fall: () => { this.q.push({ k: 'skill', name: '물허벅 폭포', hint: '젖어 가는 자리를 피하고, 물결은 점프', gap: 0.3 }); for (let i = 0, n = G.tier ? randi(3, 4) : 3; i < n; i++) this.q.push({ k: 'fall', gap: rand(1.0, 1.2) }); this.q.push({ k: 'rest', gap: 0.5 }); },
      oreum: () => { this.q.push({ k: 'skill', name: '오름 솟기', hint: '땅이 들썩이는 자리를 피하거나 넘기', gap: 0.3 }); for (let i = 0, n = G.tier ? randi(2, 3) : 2; i < n; i++) this.q.push({ k: 'oreum', mode: pick(['wave', 'around', 'wave']), gap: 1.9 }); },
      jusang: () => { this.q.push({ k: 'skill', name: '주상절리 솟기', hint: '박자 맞춰 차례로 솟아요 · 솟기 전에 점프', gap: 0.3 }); for (let i = 0, n = G.tier ? 3 : 2; i < n; i++) this.q.push({ k: 'jusang', i, gap: 1.6 }); },
      tide: () => { this.q.push({ k: 'skill', name: '치마폭 파도', hint: '낮은 파도는 점프, 높은 파도는 구르기', gap: 0.3 }); heightSeq(G.tier ? randi(3, 4) : 3).forEach(h => this.q.push({ k: 'tide', high: h, gap: rand(1.0, 1.2) })); this.q.push({ k: 'rest', gap: 0.4 }); },
    };
    if (themeCfg().indoor) { delete skills.tide; delete skills.oreum; }   // 동굴 안: 물 쏟기 · 주상절리만
    pickSkills(skills).forEach((k, i) => { if (i > 0 && Math.random() < 0.6) this.q.push({ k: 'swap', gap: 0.5 }); skills[k](); });
    this.q.push({ k: 'skill', name: '한라산 베개', hint: '마지막 몰아치기! 앞에서 본 대로 피하기', gap: 0.3 });
    const fin = themeCfg().indoor ? 'falls' : pick(['oreumtide', 'falls', 'tides']);
    if (fin === 'oreumtide') { this.q.push({ k: 'oreum', mode: 'wave', gap: 1.0 }); this.q.push({ k: 'tide', high: 0, gap: 1.2 }); }
    else if (fin === 'falls') { this.q.push({ k: 'fall', gap: 0.7 }); this.q.push({ k: 'fall', gap: 1.2 }); }
    else { this.q.push({ k: 'tide', high: 0, gap: 0.9 }); this.q.push({ k: 'tide', high: 1, gap: 1.2 }); }
  }
  act(a) {
    if (a.k === 'say') { B.sayIt(a.text, 'big', 1.0); shake(0.25); }
    else if (a.k === 'skill') { skillName(a.name, a.hint); B.shakeT = 0.2; }
    else if (a.k === 'fall') { B.talk(0.3); B.move('sway'); spawnHz(new WaterFall(clamp(P.x + rand(-6, 6), G.arenaL + 10, G.arenaR - 10), 0.8 * G.speed)); }
    else if (a.k === 'tide') { B.talk(0.3); B.move('lunge'); spawnHz(new TideWave(B.inner(), B.dir, (125 + G.tier * 6) * evK(), !!a.high, 0.6 * G.speed)); }
    else if (a.k === 'oreum') { B.move('slam', () => this.oreum(a)); }
    else if (a.k === 'jusang') { B.move('slam'); const clock = () => beatNow(), next = Math.ceil(beatNow()) + 1, xs = []; for (let x = B.side > 0 ? G.arenaR - 10 : G.arenaL + 10; x >= G.arenaL + 6 && x <= G.arenaR - 6; x += B.dir * 15) xs.push(x); Sound.sfx.rumble(); xs.forEach((x, j) => { const bb = new BeatBar(x, next + j * 0.2, clock, a.i % 2 === 1); bb.acc = j % 4 === 0; bb.j = j; spawnHz(bb); }); }   // 할망 쪽에서부터 주상절리 기둥이 차례로 솟는 물결 (네 번째마다 강세)
  }
  oreum(a) {
    {
      Sound.sfx.erupt();
      const L = G.arenaL + 14, Rr = G.arenaR - 14;
      if (a.mode === 'wave') {   // 할망 쪽에서부터 파도처럼 차례로 솟음: 사이 틈이 있어 서 있을 수도, 하나씩 넘을 수도 있음
        const xs = []; for (let x = B.side > 0 ? Rr : L; x >= L && x <= Rr; x += B.dir * 56) xs.push(x);
        xs.forEach((x, i) => spawnHz(new OreumRise(x + rand(-4, 4), (0.75 + i * 0.2) * G.speed, randi(24, 32))));
      } else {   // 숨비 둘레에 두세 개: 하나는 발밑
        const xs = [clamp(P.x, L, Rr)]; for (let k = 0; xs.length < 3 && k < 40; k++) { const x = rand(L, Rr); if (xs.every(o => Math.abs(o - x) > 50)) xs.push(x); }
        shuffled(xs).forEach((x, i) => spawnHz(new OreumRise(x, (0.85 + i * 0.25) * G.speed, randi(28, 44))));
      }
    }
  }
}
// 칼 든 하르방이 착지할 자리: 그림자가 짙어지다가 착지 순간만 판정
class HopLand {
  constructor(x, w, T) { this.x = x; this.w = w; this.T = T; this.t = 0; this.dodged = false; }
  update(dt) { this.t += dt; return this.t < this.T + 0.12 * G.speed; }
  boxes() { return this.t >= this.T ? [{ x: this.x - this.w / 2, y: GROUND - 70, w: this.w, h: 70 }] : NONE; }
  drawDecal() { const k = clamp(this.t / this.T, 0, 1), w = Math.round(this.w * (0.4 + 0.6 * k)); g.fillStyle = `rgba(30,16,14,${0.15 + 0.45 * k})`; g.fillRect(Math.round(this.x - w / 2), GROUND, w, 2); g.fillRect(Math.round(this.x - w / 2) + 3, GROUND - 1, w - 6, 1); if (k > 0.5 && Math.floor(this.t * 16) % 2) { g.fillStyle = C.red[3]; g.fillRect(Math.round(this.x - this.w / 2), GROUND + 2, 2, 1); g.fillRect(Math.round(this.x + this.w / 2) - 2, GROUND + 2, 2, 1); } }
  draw() {}
}
// ── 이벤트: 칼 든 하르방 — 칼바람, 난도질, 칼 던지기 ──
class PatKnifeEv extends PatEvent {
  constructor() {
    super('knife'); this.music = true; playMusic({ style: 'chip', song: 'taiko', tempo: 150 });
    this.q.push({ k: 'say', text: '칼춤 한번 추카?', gap: 0.7 });
    const skills = {
      wave: () => { this.q.push({ k: 'skill', name: '칼바람 베기', hint: '낮은 칼바람은 점프, 높은 칼바람은 구르기', gap: 0.3 }); heightSeq(randi(3, 5)).forEach(h => this.q.push({ k: 'wave', high: h, gap: rand(0.85, 1.05) })); this.q.push({ k: 'rest', gap: 0.4 }); },
      chop: () => { this.q.push({ k: 'skill', name: '도마 난도질', hint: '번쩍인 자리에 칼이 차례로 꽂혀요', gap: 0.3 }); for (let i = 0, n = randi(2, 3); i < n; i++) this.q.push({ k: 'chop', gap: 1.5 }); },
      throw: () => { this.q.push({ k: 'skill', name: '칼 던지기', hint: '날아오는 칼은 옆으로 비키거나 구르기', gap: 0.3 }); for (let i = 0, n = randi(2, 4); i < n; i++) this.q.push({ k: 'throw', gap: rand(0.8, 0.95) }); },
    };
    pickSkills(skills).forEach(k => { this.q.push({ k: 'hop', gap: 0.95 }); skills[k](); });
    this.q.push({ k: 'hop', gap: 0.95 });
    const fin = pick([['십자 베기', [0, 1]], ['십자 베기', [1, 0]], ['삼연 베기', [0, 1, 0]], ['삼연 베기', [1, 0, 1]]]);
    this.q.push({ k: 'skill', name: fin[0], hint: '낮은 건 점프, 높은 건 구르기', gap: 0.3 });
    fin[1].forEach((h, i, a) => this.q.push({ k: 'wave', high: h, gap: i === a.length - 1 ? 1.1 : 0.62 }));
  }
  act(a) {
    if (!B.hop && B.x > 8 && B.x < W - B.img.width - 12) B.side = Math.sign(B.x + B.img.width / 2 - P.x) || 1;   // 가운데에 서 있으면 숨비 쪽을 보고 공격
    if (a.k === 'say') { B.sayIt(a.text, 'big', 0.9); shake(0.2); }
    else if (a.k === 'skill') { skillName(a.name, a.hint); B.shakeT = 0.2; }
    else if (a.k === 'hop') {
      // 펄쩍펄쩍: 왼쪽 끝 · 가운데 · 오른쪽 끝 중 숨비에게서 떨어진 자리로 (착지 자리는 그림자로 예고)
      const w = B.img.width, spots = [-4, Math.round(W / 2 - w / 2), W - w + 4].filter(x => Math.abs(x - B.x) > 30 && Math.abs(x + w / 2 - P.x) > w / 2 + 30);
      if (!spots.length) return;
      const nx = pick(spots), side = nx + w / 2 > P.x ? 1 : -1; B.hopTo(nx, side); B.sayIt('슈슈슉!', 'n', 0.5);
    }
    else if (a.k === 'wave') { B.talk(0.3); B.move('spin'); Sound.sfx.tink(); const x = B.inner(); fx({ x, y: a.high ? GROUND - 28 : GROUND - 8, kind: 'flare', size: 8, life: 0.2, col: '#fff4e0' }); spawnHz(new SlashWave(x, a.high, (150 + G.tier * 6) * evK(), 0.6 * G.speed, B.dir)); }
    else if (a.k === 'chop') {
      B.talk(0.4); Sound.sfx.alarm();
      const dir = Math.random() < 0.5 ? 1 : -1, n = randi(3, 5), gap = randi(28, 34), x0 = clamp(P.x - gap * randi(0, n - 1), G.arenaL + 8, G.arenaR - 16 - gap * (n - 1));
      for (let i = 0; i < n; i++) spawnHz(new KnifeDrop(clamp(x0 + (dir > 0 ? i : n - 1 - i) * gap, G.arenaL + 4, G.arenaR - 10), (0.75 + i * 0.2) * G.speed));
    } else if (a.k === 'throw') { B.move('lunge'); if (Math.random() < 0.35) this.throwAt(SMALL_KNIFE); else this.throwFan(SMALL_KNIFE, 3, rand(0.27, 0.34)); Sound.sfx.whoosh(); }
  }
}

// ── 제주 밈 목록 ──
const PATTERNS = {
  rise: { make: () => new PatRise(), tier: 0, title: '돌하르방 기립', sub: '땅이 갈라지민 피ᄒᆞᆸ서' },
  hop: { make: () => new PatHop(), tier: 0, title: '하르방 행군', sub: '머리를 밟으민 와장창' },
  suitcase: { make: () => new PatSuitcase(), tier: 0, title: '관광객 러시', sub: '캐리어가 굴러오민 뛰어넘읍서' },
  harvest: { make: () => new PatHarvest(), tier: 0, title: '감귤 수확', sub: '좋은 귤은 냠, 썩은 귤은 피ᄒᆞᆸ서' },
  gull: { make: () => new PatGull(), tier: 1, title: '갈매기 강하', sub: '그림자를 보곡 피ᄒᆞᆸ서' },
  car: { make: () => new PatCar(), tier: 1, title: '렌터카 질주', sub: '허·하·호 렌터카! 뛰어넘거나 구릅서' },
  pony: { make: () => new PatPony(), tier: 1, title: '조랑말 돌격', sub: '말 사이 빈틈에 내려앉읍서' },
  pig: { make: () => new PatPig(), tier: 1, title: '흑돼지 돌진', sub: '흑돼지가 ᄃᆞᆯ려오민 뛰어넘읍서' },
  plane: { make: () => new PatPlane(), tier: 1, title: '참새 떼', sub: '낮게 오면 구르기, 높게 오면 가만히' },
  parcel: { make: () => new PatParcel(), tier: 0, title: '택배 투하', sub: '그림자 피하고, 상자 밟으면 귤!' },
  dolphin: { make: () => new PatDolphin(), tier: 1, title: '남방큰돌고래', sub: '점선 끝이 떨어질 자리 · 옆으로 비킵서' },
  crow: { make: () => new PatCrow(), tier: 2, title: '까마귀 강습', sub: '빨간 줄이 굳으민 비켜 섭서' },
  glider: { make: () => new PatGlider(), tier: 1, title: '오름 활공', sub: '낙하산 밟으민 통통, 귤도 나와마씸' },
  bee: { make: () => new PatBee(), tier: 1, title: '유채꽃 벌떼', sub: '벌 길이 높아지는 디 밑으로 피ᄒᆞᆸ서' },
  meteor: { make: () => new PatMeteor(), tier: 1, title: '화산탄 낙하', sub: '빨간 표시를 피ᄒᆞᆸ서' },
  wind: { make: () => new PatWind(), tier: 2, title: '삼다 강풍', sub: '돌은 뛰어넘곡, 머리 위 돌은 가만히' },
  typhoon: { make: () => new PatTyphoon(), tier: 2, title: '태풍 상륙', sub: '정전! 번개 칠 때 잘 봅서' },
  quiz: { make: () => new PatQuiz(), tier: 0, title: '', sub: '', silent: true },
  halmang: { make: () => new PatHalmang(), tier: 0, title: '', sub: '', silent: true, big: true, event: true },
  murang: { make: () => new PatMurang(), tier: 0, title: '', sub: '', silent: true, big: true, event: true },
  seolmun: { make: () => new PatSeolmun(), tier: 0, title: '', sub: '', silent: true, big: true, event: true },
  knife: { make: () => new PatKnifeEv(), tier: 0, title: '', sub: '', silent: true, big: true, event: true },
  dialect: { make: () => new PatDialect(), tier: 1, title: '제주어 낙하', sub: '떨어지는 글자 돌판을 피ᄒᆞᆸ서' },
};
// 보통 공격 가중치 (단계별 · 기본 1): 제주어 낙하 2배 · 화산탄 2배(4 · 6 · 7단계는 한 번 고를 때 약 1%p 더) · 까마귀는 나오는 단계마다 약 0.8%p 더
const PAT_W = { dialect: [2, 2, 2, 2, 2, 2, 2], meteor: [2, 2, 2, 2.25, 2, 2.76, 2.54], crow: [1, 1, 1.16, 1.18, 1.16, 1.15, 1.16] };
const patWeight = (k, tier) => (PAT_W[k] ? PAT_W[k][clamp(tier, 0, 6)] : 1);
// 공격 이름 · 안내 (동굴에서는 까마귀가 박쥐로, 화산탄이 천장 낙석으로 바뀜)
function patLabel(kind) {
  const def = PATTERNS[kind];
  if (themeCfg().indoor && kind === 'crow') return ['박쥐 떼', '빨간 줄이 굳으민 비켜 섭서'];
  if (themeCfg().indoor && kind === 'meteor') return ['천장 낙석', '빨간 표시를 피ᄒᆞᆸ서'];
  return [def.title, def.sub];
}
function startPattern(kind) {
  const def = PATTERNS[kind], pat = def.make(); pat.kind = kind; G.patterns.push(pat);
  G.recent = [...(G.recent || []), kind].slice(-3);
  if (def.silent) G.usedEvents[kind] = true;
  G.seen[kind] = true;
  const isNew = !SEEN[kind];
  if (isNew) { SEEN[kind] = 1; G.newFound = (G.newFound || 0) + 1; try { localStorage.setItem('jeju.seen', JSON.stringify(SEEN)); } catch (e) { /* 무시 */ } }
  if (G.wowFx) { if (G.wowFx.star && G.wowFx.t < 0.6) banner(`★ ${G.wowFx.star}`, '도감에 별', UI.gold); G.wowFx.star = null; G.wowFx.t = Math.max(G.wowFx.t, 1.2); }
  if (!def.silent && G.banners[0] && G.banners[0].t > 0) G.banners[0].t = Math.max(G.banners[0].t, G.banners[0].dur - 0.22);   // 떠 있던 배너는 카드에 자리 비켜 줌
  if (!def.silent) pat.wait = 0.35 * G.speed;   // 제목 카드 없이 바로 진행
  if (kind === 'quiz' && G.banners[0]) G.banners[0].isNew = isNew;
  if (def.event && isNew) bannerNow(EVENTS[kind].name + ' 발견!', '용어 도감 +1', C.yel[2], true);
  else if (isNew && !def.silent && def.title) { const [t, sb] = patLabel(kind); bannerNow(t, sb || '용어 도감 +1', C.yel[2], true); }   // 처음 만난 밈은 이름과 피하는 법을 한 번 알려 줌
  pat.hits0 = G.hitsTaken; 
  // 이미 아는 첫 수업 패턴은 짧게
  if (G.patCount <= 4 && !def.silent) pat.dur = Math.min(pat.dur, isNew ? 6 : 5.5);
  else if (G.tier === 0 && def.tier === 0 && !def.silent) pat.dur = Math.min(pat.dur, 6);
}

