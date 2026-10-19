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

