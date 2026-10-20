// ─────────────────────────────────────────────────────────────
//  픽셀 제주 — ᄒᆞᆫ저 피ᄒᆞᆸ서!
//  제주 밈 피하기: 끝없이 쏟아지는 밈 패턴 · 점수가 오르면 배속 · WOW · 등급
//  조작: 이동 · 점프(3단, 공중제비) · 구르기(앞부분 무적) · 귤 던지기 · 밟기
// ─────────────────────────────────────────────────────────────
'use strict';

const cv = document.getElementById('game'); cv.width = W;
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
const GRAV = 860, JUMP_V = 410, DJUMP_V = 300, JUMP_CUT = 0.52;   // 첫 점프 꼭대기 약 100px, 3단은 천장 근처 (중력 · 낙하 한계 · 걷기 가속은 wasm/src/player.rs에도)
const SPEED = 94;
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
const DARK_TEX = SPR.DARK_TEX;
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
function press(k, src = 'x') { const s = holders[k] || (holders[k] = new Set()); if (!s.has(src)) pressed[k] = true; s.add(src); held[k] = true; }   // 같은 동작의 다른 키(Shift 누른 채 X)도 새 입력
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
  if (!e.repeat && holders[k]) holders[k].delete(e.code);   // 반복 아닌 keydown = 손을 뗐다 다시 누름 (⌘ 조합 등으로 keyup을 놓쳐도 다음 입력이 씹히지 않게)
  if (!e.repeat || (!held[k] && (k === 'left' || k === 'right'))) press(k, e.code);
});
window.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) release(k, e.code); });
window.addEventListener('blur', () => { releaseAll(); if (state === 'play' && !P.dead) setPause(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { releaseAll(); if (state === 'play' && !P.dead) setPause(true); Sound.stopMusic(); Sound.ambience('rain', 0); Sound.suspend(); } else Sound.resume(); });
for (const ev of ['keydown', 'pointerdown', 'mousedown', 'pointerup', 'touchend', 'click']) window.addEventListener(ev, () => Sound.init(), { capture: true, passive: true });   // 아무 키 · 터치든 첫 입력에 소리 잠금 풀기 (iOS는 touchend)
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
    t: 0, mode: 'intro', modeT: 0, diff: 0, arenaR: W - 8 - EDGE, arenaL: 8 + EDGE, up: {},
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
  update(dt) { return WK.hzUpdate(this, 'rise', dt); }   // 움직임 · 판정 · 맞았을 때는 wasm/src/hz_ground.rs
  boxes() { return WK.hzBoxes(this, 'rise'); }
  drawDecal() { WK.hzDraw(this, 'rise', 1); }
  draw() { WK.hzDraw(this, 'rise', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
  onShot(s) { return WK.hzOn(this, 'rise', 'shot', s.x, s.y); }
}

class Hopper { // 꼬마 하르방: 밟거나 맞히면 부서짐
  constructor(dir, x) {
    this.dir = dir; this.y = GROUND; this.t = 0;
    this.vx = dir * rand(52, 74) * (1 + G.diff * 0.06); this.x = x ?? (dir > 0 ? -10 - Math.abs(this.vx) * 0.6 * G.speed : W + 10 + Math.abs(this.vx) * 0.6 * G.speed); this.hop = G.diff >= 1 ? rand(220, 300) : rand(170, 250); this.vy = -this.hop * 0.6;   // 0.6초 동안 화면 끝 흙이 들썩이며 예고
    this.sq = 0; this.dodged = false; this.stompable = true;
  }
  update(dt) { return WK.hzUpdate(this, 'hopper', dt); }   // 움직임 · 판정 · 맞았을 때는 wasm/src/hz_ground.rs
  boxes() { return WK.hzBoxes(this, 'hopper'); }
  kill(by) { WK.hzOn(this, 'hopper', by === 'stomp' ? 'stomp' : 'shot'); }
  onShot() { return WK.hzOn(this, 'hopper', 'shot'); }
  draw() { WK.hzDraw(this, 'hopper', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
}

// 동굴 낙석: 천장에서 떨어진 뾰족한 현무암 덩이
// 만장굴 낙석: 천장에서 떨어지는 각진 현무암 덩이 6가지 (크기 · 모서리 · 색이 제각각, 등불빛 받은 것도) × 구르는 4칸
const FALLROCKS = SPR.FALLROCKS;
class Meteor { // 한라산 화산탄 (동굴에서는 천장에서 떨어지는 낙석)
  constructor(tx, fall) {
    this.tx = Math.round(clamp(tx, 10, W - 10)); this.rock = !!themeCfg().indoor; const hl = (SCENES[Math.floor(G.phase)] || SCENES[0] || {}).halla, hcx = (hl && Number.isFinite(hl.cx) ? hl.cx : W * 0.62) - Math.round((20 + amb.camX) * LAYER_P.hall); this.sx = this.rock ? this.tx + rand(-4, 4) : lerp(hcx, this.tx, 0.3) + rand(-15, 15); this.sy = this.rock ? -VOFF + 2 : -VOFF - 20;
    this.fall = fall; this.t = 0; this.phase = 'fall'; this.dodged = false; this.x = this.sx; this.y = this.sy;
  }
  update(dt) { return WK.hzUpdate(this, 'meteor', dt); }   // 움직임 · 판정 · 맞았을 때는 wasm/src/hz_ground.rs
  boxes() { return WK.hzBoxes(this, 'meteor'); }
  drawDecal() { WK.hzDraw(this, 'meteor', 1); }
  draw() { WK.hzDraw(this, 'meteor', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
}

class Pony { // 조랑말 떼: 밟으면 튕겨 오름
  constructor(dir, off) { this.dir = dir; this.x = dir > 0 ? -18 - off : W + 18 + off; this.speed = (rand(140, 160) + G.diff * 8) * Math.min(1, 1.6 / G.speed); this.anim = Math.random() * 6; this.dodged = false; this.bouncy = true; }
  update(dt) { return WK.hzUpdate(this, 'pony', dt); }   // 움직임 · 판정 · 맞았을 때는 wasm/src/hz_ground.rs
  boxes() { return WK.hzBoxes(this, 'pony'); }
  draw() { WK.hzDraw(this, 'pony', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
  onShot(s) { return WK.hzOn(this, 'pony', 'shot', s.x, s.y); }
}

class Pebble {
  constructor(dir) {
    this.dir = dir; const b = Math.random();
    this.y = GROUND - (b < 0.4 ? rand(3, 9) : b < 0.75 ? rand(13, 19) : rand(28, 38));   /* 높은 돌은 서 있는 머리에 스치지 않게 */
    this.vx = dir * rand(170, 235) * Math.min(1, 1.6 / G.speed); this.x = dir > 0 ? -6 - Math.abs(this.vx) * 0.6 * G.speed : W + 6 + Math.abs(this.vx) * 0.6 * G.speed;   /* 화면 끝 예고 0.6초 */ this.ph = rand(0, 6); this.t = 0; this.dodged = false;   // 0.4초 동안 화면 끝 꺾쇠로 예고
    this.spr = pick(PEBBLES); this.spin = rand(9, 15);   // 돌마다 모양 · 크기 · 색이 다르고, 날아가며 데굴데굴
  }
  update(dt) { return WK.hzUpdate(this, 'pebble', dt); }   // 움직임 · 판정 · 맞았을 때는 wasm/src/hz_ground.rs
  boxes() { return WK.hzBoxes(this, 'pebble'); }
  onShot() { return WK.hzOn(this, 'pebble', 'shot'); }
  draw() { WK.hzDraw(this, 'pebble', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
}
class Tewak {
  constructor(dir) { this.dir = dir; this.y = GROUND - 20; this.vx = dir * rand(110, 140) * Math.min(1, 1.6 / G.speed); this.x = dir > 0 ? -8 - Math.abs(this.vx) * 0.6 * G.speed : W + 8 + Math.abs(this.vx) * 0.6 * G.speed; this.t = 0; this.vy = 0; this.dodged = false; this.bouncy = true; }
  update(dt) { return WK.hzUpdate(this, 'tewak', dt); }   // 움직임 · 판정 · 맞았을 때는 wasm/src/hz_ground.rs
  boxes() { return WK.hzBoxes(this, 'tewak'); }
  onShot() { return WK.hzOn(this, 'tewak', 'shot'); }
  draw() { WK.hzDraw(this, 'tewak', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
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
  update(dt) { return WK.hzUpdate(this, 'bubble', dt); }   // 움직임 · 판정 · 맞았을 때는 wasm/src/hz_air.rs
  boxes() { return WK.hzBoxes(this, 'bubble'); }
  onShot() { return WK.hzOn(this, 'bubble', 'shot'); }
  draw() { WK.hzDraw(this, 'bubble', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
}

class Rotten { // 썩은 귤
  constructor(x, y, vx, vy) { this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.life = 4; this.dodged = false; this.stompable = true; }
  update(dt) { return WK.hzUpdate(this, 'rotten', dt); }   // 움직임 · 판정 · 맞았을 때는 wasm/src/hz_air.rs
  kill(by) { WK.hzOn(this, 'rotten', by === 'stomp' ? 'stomp' : 'shot'); }
  boxes() { return WK.hzBoxes(this, 'rotten'); }
  onShot() { return WK.hzOn(this, 'rotten', 'shot'); }
  draw() { WK.hzDraw(this, 'rotten', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
}

// ── 줍는 것 ──────────────────────────────────────────────────
// 떨어지는 귤: 빙글 도는 8프레임(꼭지가 돌아감, 빛은 늘 왼쪽 위) + 착지 찌그러짐 프레임
const PICK_TANG = SPR.PICK_TANG;
// 삼다수: 투명한 물병 + 파란 뚜껑 + 띠 라벨 (공중에 떠서 반짝임)
const SAMDA = SPR.SAMDA;
const DROP = SPR.DROP;   // { on, off }
// 삼다수 세 병 → 삼다수 파도: 화면을 쓸며 지금 떠 있는 위험을 씻어 냄
function samdaWave() {
  G.water = 0; G.wave = { t: 0 }; P.inv = Math.max(P.inv, 1.2); Sound.sfx.wave(); Sound.sfx.level(); shake(0.3); flashFx(0.06, '#d8f0ff', true);
  banner('삼다수 파도', '전방 소탕', mute('#6aa8d8'));
  let n = 0; for (const h of G.hz) { if (h.ambient) continue; h.dead = true; n++; burst(h.x ?? W / 2, (h.y ?? GROUND) - 6, 6, WATER.slice(1), 90, 0.5, 300); }
  G.hz = G.hz.filter(h => h.ambient); G.spawnQ.length = 0; G.warnings = [];
  addScore(200 + n * 30, P.x, P.y - 40);
}
// ── 새 아이템: 귤 망사리(귤 +5) · 오메기떡(6초 점수 2배) · 바람개비(8초 동안 귤을 끌어당김) ──
const BASKET = SPR.BASKET;
const OMEGI = SPR.OMEGI;   // 흰 접시에 오메기떡 세 알 (썩은 귤과 헷갈리지 않게)
const PINWHEEL = SPR.PINWHEEL;
const ITEM_KINDS = ['basket', 'omegi', 'pinwheel', 'water', 'shield', 'bong'];
class Pickup {
  constructor(kind, x, y, vx = 0, vy = 0) { Object.assign(this, { kind, x, y, vx, vy, life: 8, grounded: false, t: 0, phase: rand(0, 6.28), spin: rand(0, 1), sq: 0 }); }
  update(dt) { return WK.hzUpdate(this, 'pickup', dt); }   // 움직임는 wasm/src/hz_item.rs
  box() { return { x: this.x - 6, y: this.y - 10, w: 12, h: 11 }; }
  // 귤로 맞힐 때: 아이템은 감싼 금빛 테 전체 (그리는 22×22 테두리와 같은 자리) · 그냥 귤 · 함정은 몸통만
  shotBox() { return ITEM_KINDS.includes(this.kind) ? { x: Math.round(this.x - 10) - 1, y: Math.round(this.y - 21) - 1, w: 22, h: 22 } : this.box(); }
  draw() { WK.hzDraw(this, 'pickup', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
}

// ── 플레이어의 귤 ────────────────────────────────────────────
class Shot {
  constructor(x, y, dir) { this.x = x; this.y = y; this.vx = dir * 250 + P.vx * 0.25; this.vy = -40; this.rot = 0; this.trail = []; }
  update(dt) { const alive = WK.hzUpdate(this, 'shot', dt); this.trail.push([this.x, this.y]); if (this.trail.length > 5) this.trail.shift(); return alive; }   // 움직임는 wasm/src/hz_item.rs
  box() { return { x: this.x - 4, y: this.y - 4, w: 8, h: 8 }; }
  draw() { WK.hzDraw(this, 'shot', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
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
    G.arenaR = on && atR ? Math.min(W - 8 - EDGE, this.x + 10) : W - 8 - EDGE;
    G.arenaL = on && atL ? Math.max(8 + EDGE, this.x + this.img.width - 10) : 8 + EDGE;
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
    this.spr = spr; this.sprH = spr.height; this.metal = !!spr.metal; this.t = 0; this.aim = 0.5 * G.speed; this.dodged = false;
  }
  update(dt) { return WK.hzUpdate(this, 'zap', dt); }   // 움직임 · 판정 · 맞았을 때는 wasm/src/hz_air.rs
  boxes() { return WK.hzBoxes(this, 'zap'); }
  onShot() { return WK.hzOn(this, 'zap', 'shot'); }
  draw() { WK.hzDraw(this, 'zap', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
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
  constructor(text, x, ok) { this.text = text; this.x = x; this.y = GROUND - 50; this.ok = ok; this.t = 0; this.spr = uiSprite(text, UI.gold); }
  update(dt) { return WK.hzUpdate(this, 'answer', dt); }   // 움직임는 wasm/src/hz_item.rs
  box() { const s = this.spr; return { x: this.x - s.width / 2, y: this.y, w: s.width, h: s.bodyH }; }
  draw() { WK.hzDraw(this, 'answer', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
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
  constructor(dir, off) { this.dir = dir; this.k = randi(0, SUITCASES.length - 1); this.big = SUITCASES[this.k].big; this.sw = SUITCASES[this.k].r.width; this.sh = SUITCASES[this.k].r.height; this.x = dir > 0 ? -14 - off : W + 14 + off; this.y = GROUND; this.vy = 0; this.stompable = true; this.speed = rand(115, 150) + G.diff * 10; this.hop = Math.random() < 0.35; this.dodged = false; this.bouncy = true; this.rot = 0; }
  update(dt) { return WK.hzUpdate(this, 'suitcase', dt); }   // 움직임 · 판정 · 맞았을 때는 wasm/src/hz_ground.rs
  boxes() { return WK.hzBoxes(this, 'suitcase'); }
  // 밟으면 뚜껑이 열리며 짐이 와르르 (밟기 보상)
  kill(by) { WK.hzOn(this, 'suitcase', by === 'stomp' ? 'stomp' : 'shot'); }
  onShot() { return WK.hzOn(this, 'suitcase', 'shot'); }
  draw() { WK.hzDraw(this, 'suitcase', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
}
// ── 똥돼지 질주 ──
class Pig {
  constructor(dir, off) { this.dir = dir; this.x = dir > 0 ? -16 - off : W + 16 + off; this.y = GROUND; this.vy = 0; this.bouncy = true; this.speed = (rand(175, 215) + G.diff * 12) * Math.min(1, 1.35 / G.speed); this.anim = Math.random() * 4; this.leap = Math.random() < 0.3 + G.diff * 0.08; this.leaped = false; this.dodged = false; }
  update(dt) { return WK.hzUpdate(this, 'pig', dt); }   // 움직임 · 판정 · 맞았을 때는 wasm/src/hz_ground.rs
  boxes() { return WK.hzBoxes(this, 'pig'); }
  draw() { WK.hzDraw(this, 'pig', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
  onBounce() { return WK.hzOn(this, 'pig', 'bounce'); }   // 밟으면 꿀꿀 · 등을 디딤돌 삼아 튀어 오름
  onShot(s) { return WK.hzOn(this, 'pig', 'shot', s.x, s.y); }
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
  update(dt) { return WK.hzUpdate(this, 'splitZap', dt); }   // 움직임 · 맞았을 때는 wasm/src/hz_air.rs
  // 뜻풀이 글자로 갈라짐 (Rust가 갈라지는 순간 부름)
  split() {
    popup('해석!', this.x, this.y - 12, C.yel[3], 's');
    const chars = graphemes(this.meaning.replace(/[\s!?,.]/g, '')).slice(0, 3), base = Math.atan2(this.vy, this.vx), sp = Math.hypot(this.vx, this.vy) * 1.1;
    chars.forEach((ch, i) => {
      const a = base + (i - (chars.length - 1) / 2) * 0.42, z = new Zap(this.x, this.y, this.x + Math.cos(a) * 100, this.y + Math.sin(a) * 100, wordSprite(ch, 'n'), sp);
      z.aim = 0.3 * G.speed; z.isText = true; z.pat = this.pat; spawnHz(z);   /* 갈라진 글자도 잠깐 조준선 */
    });
  }
  onShot() { return WK.hzOn(this, 'splitZap', 'shot'); }
}
// ── 할망 시그니처 1: 이퀄라이저 비트 바 — 랩 박자에 맞춰 땅에서 막대가 솟음 (한 박 전에 바닥이 깜빡) ──
// 주상절리 기둥: 윗면은 육각 · 오각 다각형(살짝 내려다본 모양), 앞으로 보이는 면 2~3개, 면을 따라 휘는 가로 마디 · 숨구멍
//  모양 4종을 미리 굽고, 기둥마다 높이를 달리해 실제 주상절리처럼 들쭉날쭉하게
const BASALTS = SPR.BASALTS;
// 사투리 할머니의 한마디: 이 문장 글자가 한 자씩 땅에서 솟아오름 (공백 자리는 비어 있어 숨을 곳)
const HALMANG_LINE = '쾅 ᄒᆞ는 소리 헨, "아이고, 베락 털어졈신가?" 영 걷어진 쥥은 몰르곡 경헨, 나왕 보고들랑 영헤연, 바...ᄇᆞᆰ도록 ᄌᆞᆷ ᄒᆞᆫᄌᆞᆷ들 안 잣수다, 이 셋동네 사름들.';
const LINE_G = graphemes(HALMANG_LINE).filter(ch => !/[",.?…]/.test(ch));   // 글자와 띄어쓰기만 (문장부호는 빼고)
const letterSpr = ch => logoText(ch, 2, ['#5a4632', '#8a6a44', '#b8905a', '#e0bc7a', '#fff0c8']);
class BeatBar { // 할망 비트에 맞춰 땅에서 솟는 주상절리 기둥 (ch가 있으면 그 글자가 솟음)
  constructor(x, beatAt, clock, tall = false, ch = null) {
    this.ch = ch; this.letter = !!ch; if (ch) { this.spr = letterSpr(ch); this.H = this.spr.height - 18; } else { this.H = (tall ? 50 : 33) + randi(-5, 5); this.spr = pick(BASALTS); } this.sprH = this.spr.height; this.x = x; this.beatAt = beatAt; this.b0 = clock(); this.clock = clock; this.h = 0; this.t = 0; this.dodged = false; this.up = false; this.done = false; this.lastB = Math.floor(clock());
    this.crack = []; for (const s of [-1, 1]) { let cx = 0, cy = 0; for (let i = 0; i < 7; i++) { cx += s * randi(1, 2); if (Math.random() < 0.5) cy = clamp(cy + randi(-1, 1), 0, 2); this.crack.push([cx, cy]); } }
  }
  get b() { return this.clock(); }
  update(dt) { this.bNow = this.b; return WK.hzUpdate(this, 'beatBar', dt); }   // 움직임 · 판정은 wasm/src/hz_event.rs
  boxes() { return WK.hzBoxes(this, 'beatBar'); }
  draw() { this.bNow = this.b; WK.hzDraw(this, 'beatBar', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
}
// ── 할망 시그니처 2: 태풍 마이삭 — 땅을 기어 오는 소용돌이, 플레이어를 끌어당김 ──
class Vortex { // 태풍 마이삭: 땅에서 말려 올라가 깔때기가 된 뒤 기어 옴
  constructor(x, speed, dir = -1) { this.x = x; this.speed = speed; this.dir = dir; this.t = 0; this.dodged = false; this.spin = 0; this.formT = 0.6 * G.speed; Sound.sfx.whoosh(); }
  update(dt) { return WK.hzUpdate(this, 'vortex', dt); }   // 움직임 · 판정은 wasm/src/hz_event.rs
  boxes() { return WK.hzBoxes(this, 'vortex'); }
  // 번개 모양 (Rust가 번개 칠 때 부름): 내려올수록 깔때기 쪽으로 모여 끝이 옆으로 꺾이지 않게
  makeBolt() { this.boltPts = []; let bx = this.x + rand(-30, 30); for (let y = -VOFF; y < GROUND - 60; y += 6) { const u = (y + VOFF) / (GROUND - 60 + VOFF); bx += rand(-5, 5) + (this.x - bx) * u * 0.4; this.boltPts.push([Math.round(bx), y]); } this.boltPts.push([Math.round(this.x), GROUND - 60]); }
  // 깔때기 그림 (매 프레임 픽셀로): 먹구름 바닥에서 내려온 깔때기 — 아래는 가는 밧줄, 위로 갈수록 넓은 쐐기 · 가장자리는 반투명하게 흩어지고
  //  나선 줄무늬가 위로 감겨 올라감 · 아래쪽은 들려 올라간 흙빛 · 땅엔 회오리치는 흙먼지 구름 · 꼭대기는 천천히 도는 먹구름 덩이
  funnelImg(form) {
    const top = -VOFF + (this.big ? 24 : 40), full = GROUND - top, cw = 136, chh = full + 26, ox = Math.round(this.x - cw / 2), oy = top - 14;
    if (!this.cv) { this.cv = mk(cw, chh); this.cx2 = this.cv.getContext('2d'); this.id = this.cx2.createImageData(cw, chh); }
    if (this.imgT != null && this.t >= this.imgT && this.t - this.imgT < G.speed / 30) return [this.cv, ox, oy];   // 초당 30번만 새로 그림 (멈춤 화면에선 그대로)
    this.imgT = this.t;
    WK.funnel(this.id.data, cw, chh, ox, oy, this.x, this.t, this.spin, this.dir, this.big, form, full * (1 - easeOut(form)), full);   // 픽셀은 wasm/src/funnel.rs
    this.cx2.putImageData(this.id, 0, 0);
    return [this.cv, ox, oy];
  }
  draw() { WK.hzDraw(this, 'vortex', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
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
  constructor(x, label) { this.x = x; this.spr = subButton(label); this.sprW = this.spr.width; this.sprH = this.spr.height; this.y = -VOFF - 20; this.t = 0; this.warn = 0.55 * G.speed; this.state = 'warn'; this.dodged = false; this.label = label; }
  update(dt) { return WK.hzUpdate(this, 'subSlam', dt); }   // 움직임 · 판정은 wasm/src/hz_event.rs
  boxes() { return WK.hzBoxes(this, 'subSlam'); }
  draw() { WK.hzDraw(this, 'subSlam', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
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
function crateSprite() { return CRATE || (CRATE = WK.crate()); }
class AreaSmash {
  constructor(x0, x1, delay) { this.x0 = x0; this.x1 = x1; this.delay = delay; this.t = 0; this.dodged = false; this.hitT = -1; this.y = -VOFF - 24; this.hy = -VOFF + 14; }   // hy: 매달린 높이 (Rust가 매 프레임 계산)
  update(dt) { return WK.hzUpdate(this, 'areaSmash', dt); }   // 움직임 · 판정은 wasm/src/hz_event.rs
  boxes() { return WK.hzBoxes(this, 'areaSmash'); }
  draw() { WK.hzDraw(this, 'areaSmash', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
}
// ── 뭐랭하멘 [해석 레이저]: 가는 빨간 선으로 예고 → 화면을 가로지르는 광선 ──
class Laser {
  constructor(y, delay, x1, x0 = 0) { this.y = y; this.delay = delay; this.x1 = x1; this.x0 = x0; this.from = x0 > 0 ? x0 : x1; this.t = 0; this.dodged = false; }
  update(dt) { return WK.hzUpdate(this, 'laser', dt); }   // 움직임 · 판정은 wasm/src/hz_event.rs
  boxes() { return WK.hzBoxes(this, 'laser'); }
  draw() { WK.hzDraw(this, 'laser', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
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
  end() { P.confuseT = 0; G.dark = 0; if (!P.dead) { daily('event'); if (G.hp < G.maxHp) { G.hp++; popup('+♥', P.x, P.y - 30, '#ff8fa0', 'b'); Sound.sfx.heal(); } } /* 보스를 넘기면 체력 1 회복 */ if (!P.dead) B = null; G.arenaR = W - 8 - EDGE; G.arenaL = 8 + EDGE; G.rapSub = null; G.windTarget = 0; G.rest = Math.max(G.rest, 1.1); if (this.music && !P.dead) playMusic({ style: 'chip', song: runSong(), tempo: 138 * G.speed }); }
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
      const next = Math.max(Math.ceil(this.beat()) + 1, Math.ceil(this.lineEnd ?? 0)), clock = () => this.beat();   // 다음 줄은 앞 줄이 끝난 바로 다음 정박에 이어서 (바닥 표시는 1박 이상 먼저)
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
        this.lineEnd = last + 0.25;
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
  update(dt) { return WK.hzUpdate(this, 'gull', dt); }   // 움직임 · 판정 · 맞았을 때는 wasm/src/hz_air.rs
  boxes() { return WK.hzBoxes(this, 'gull'); }
  drawDecal() { WK.hzDraw(this, 'gull', 1); }
  onShot() { return WK.hzOn(this, 'gull', 'shot'); }
  draw() { WK.hzDraw(this, 'gull', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
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
  update(dt) { return WK.hzUpdate(this, 'rentcar', dt); }   // 움직임 · 판정 · 맞았을 때는 wasm/src/hz_ground.rs
  boxes() { return WK.hzBoxes(this, 'rentcar'); }
  onShot(s) { return WK.hzOn(this, 'rentcar', 'shot', s.x, s.y); }
  draw() { WK.hzDraw(this, 'rentcar', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
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
const BEE = SPR.BEE;
class Bee {
  constructor(dir, i, speed, ph) { this.dir = dir; this.i = i; this.x = dir > 0 ? -10 - i * 12 : W + 10 + i * 12; this.ph = ph; this.y = this.path(); this.speed = speed; this.t = 0; this.dodged = false; this.stompable = false; }
  path() { return GROUND - 24 + Math.sin(this.x * 0.045 + this.ph) * 14; }
  update(dt) { return WK.hzUpdate(this, 'bee', dt); }   // 움직임 · 판정 · 맞았을 때는 wasm/src/hz_air.rs
  boxes() { return WK.hzBoxes(this, 'bee'); }
  onShot() { return WK.hzOn(this, 'bee', 'shot'); }
  draw() { WK.hzDraw(this, 'bee', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
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
const SPARROW = SPR.SPARROW;
class Plane {   // 참새 무리 (낮게 2마리 · 높게 3마리 — 판정 폭은 예전 비행기와 같음)
  constructor(dir, low, speed) { this.dir = dir; this.low = low; this.y = low ? GROUND - 20 : GROUND - 44; this.x = dir > 0 ? -24 : W + 24; this.speed = speed; this.t = 0; this.warn = 0.7 * G.speed; this.dodged = false; this.birds = (low ? [[-7, 2], [7, -2]] : [[-13, 2], [0, -3], [13, 1]]).map(([ox, oy], i) => ({ ox, oy, ph: i * 1.3 + rand(0, 1) })); }
  update(dt) { return WK.hzUpdate(this, 'plane', dt); }   // 움직임 · 판정 · 맞았을 때는 wasm/src/hz_air.rs
  boxes() { return WK.hzBoxes(this, 'plane'); }
  onShot(s) { return WK.hzOn(this, 'plane', 'shot', s.x, s.y); }
  draw() { WK.hzDraw(this, 'plane', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
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
const PARCEL = SPR.PARCEL;
class Parcel {
  constructor(x, delay) { this.x = x; this.y = -VOFF - 16; this.t = 0; this.warn = delay; this.state = 'warn'; this.dodged = false; this.stompable = true; }
  update(dt) { return WK.hzUpdate(this, 'parcel', dt); }   // 움직임 · 판정 · 맞았을 때는 wasm/src/hz_air.rs
  kill() { WK.hzOn(this, 'parcel', 'stomp'); }
  boxes() { return WK.hzBoxes(this, 'parcel'); }
  onShot() { return WK.hzOn(this, 'parcel', 'shot'); }
  draw() { WK.hzDraw(this, 'parcel', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
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
const GLIDER = SPR.GLIDER;
class Glider {
  constructor(dir, high, speed) { this.dir = dir; this.y0 = high ? GROUND - 140 : GROUND - 96; this.y = this.y0; this.x = dir > 0 ? -16 : W + 16; this.speed = speed; this.t = rand(0, 6); this.safe = true; this.bouncy = true; this.ambient = true; this.dodged = true; this.life = 10; }
  update(dt) { return WK.hzUpdate(this, 'glider', dt); }   // 움직임 · 판정 · 맞았을 때는 wasm/src/hz_air.rs
  boxes() { return WK.hzBoxes(this, 'glider'); }
  onBounce() { return WK.hzOn(this, 'glider', 'bounce'); }
  draw() { WK.hzDraw(this, 'glider', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
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
  for (const off of [0, 6]) { const x = dir > 0 ? 3 + EDGE + off : W - 4 - EDGE - off; for (const [c, o] of [[INK, 1], [off ? mix(col, INK, 0.3) : col, 0]]) { g.fillStyle = c; for (let i = 0; i < 4; i++) g.fillRect(x + dir * i - o, yy - 3 + i - o, 2 + 2 * o, 7 - 2 * i + 2 * o); } }
}
// ── 남방큰돌고래: 바다에서 솟아 포물선으로 넘어감 · 지나갈 길을 점선으로, 들어가고 나올 자리엔 물보라 고리 ──
const { DOLPHIN, DOLPHIN_L } = SPR;   // 기울기 세 가지 (오른쪽 · 왼쪽)
function splashFx(x, big = 1) {
  Sound.sfx.splash();
  fx({ x, y: GROUND - 1, kind: 'ring', life: 0.3, col: '#cfe4ec' });
  for (let i = 0; i < 10 * big; i++) fx({ x: x + rand(-5, 5), y: GROUND - 2, vx: rand(-60, 60), vy: -rand(80, 180), grav: 520, life: rand(0.35, 0.6), kind: 'px', size: randi(1, 2), col: pick(['#cfe4ec', '#9ec2d4', '#fff4e0']) });
}
class Dolphin {
  constructor(x0, x1, peak, T, warn) { Object.assign(this, { x0, x1, peak, T, warn, t: 0, dodged: false, s: -1 }); this.dir = Math.sign(x1 - x0); this.x = x0; this.y = GROUND + 10; }
  update(dt) { return WK.hzUpdate(this, 'dolphin', dt); }   // 움직임 · 판정 · 맞았을 때는 wasm/src/hz_air.rs
  boxes() { return WK.hzBoxes(this, 'dolphin'); }
  onShot(sh) { return WK.hzOn(this, 'dolphin', 'shot', sh.x, sh.y); }
  drawDecal() { WK.hzDraw(this, 'dolphin', 1); }
  draw() { WK.hzDraw(this, 'dolphin', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
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
const CROW = SPR.CROW;
// 만장굴의 박쥐 (동굴에서는 까마귀 대신): 막 날개를 펄럭이며 같은 방식으로 내리꽂음
const BAT = SPR.BAT;
class Crow {
  constructor(x, delay) { this.px = x; this.py = -VOFF + 50 + rand(-6, 6); this.x = x + rand(-40, 40); this.sx = this.x; this.y = -VOFF - 16; this.t = 0; this.delay = delay; this.state = 'in'; this.dodged = false; this.anim = rand(0, 6); this.face = 1; this.bat = !!themeCfg().indoor; }
  update(dt) { return WK.hzUpdate(this, 'crow', dt); }   // 움직임 · 판정 · 맞았을 때는 wasm/src/hz_air.rs
  boxes() { return WK.hzBoxes(this, 'crow'); }
  onShot() { return WK.hzOn(this, 'crow', 'shot'); }
  drawDecal() { WK.hzDraw(this, 'crow', 1); }
  draw() { WK.hzDraw(this, 'crow', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
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
  update(dt) { return WK.hzUpdate(this, 'dialect', dt); }   // 움직임 · 판정 · 맞았을 때는 wasm/src/hz_air.rs
  boxes() { return WK.hzBoxes(this, 'dialect'); }
  onShot(sh) { return WK.hzOn(this, 'dialect', 'shot', sh.x, sh.y); }
  drawDecal() { WK.hzDraw(this, 'dialect', 1); }
  draw() { WK.hzDraw(this, 'dialect', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
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
function slashSprite(hh) { return SLASH_SPR[hh] || (SLASH_SPR[hh] = WK.slash(hh)); }
// 칼바람 베기: 지나갈 높이에 점선이 깔린 뒤 초승달 칼바람이 날아옴 (낮으면 뛰고, 높으면 구르기)
class SlashWave {
  constructor(x, high, speed, warn, dir = -1) { this.dir = dir; this.x = x; this.high = high; this.y = high ? GROUND - 28 : GROUND - 8; this.speed = speed; this.warn = warn; this.t = 0; this.dodged = false; }
  update(dt) { return WK.hzUpdate(this, 'slashWave', dt); }   // 움직임 · 판정은 wasm/src/hz_event.rs
  boxes() { return WK.hzBoxes(this, 'slashWave'); }
  draw() { WK.hzDraw(this, 'slashWave', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
}
// 난도질: 땅에 칼자국이 번쩍인 뒤 커다란 칼이 꽂힘
const BIG_KNIFE = SPR.BIG_KNIFE;
class KnifeDrop {   // 도마 난도질: 예고 → 하늘에서 칼날이 번뜩 → 확 빨라지며 내리꽂힘 → 콱! (멈칫 · 섬광 · 땅 갈라짐 · 흙먼지) → 꽂힌 칼이 부르르 떪
  constructor(x, delay) { this.x = Math.round(x); this.delay = delay; this.t = 0; this.y = -VOFF - 34; this.vy = 380; this.st = 'warn'; this.dodged = false; this.cracks = Array.from({ length: 6 }, (_, i) => { const s = i < 3 ? -1 : 1, pts = []; let cx = 0, cy = 0; for (let k = 0; k < 4 + (i % 3); k++) { cx += s * randi(1, 3); cy = clamp(cy + randi(-1, 1), 0, 3); pts.push([cx, cy]); } return pts; }); }
  update(dt) { return WK.hzUpdate(this, 'knifeDrop', dt); }   // 움직임 · 판정은 wasm/src/hz_event.rs
  boxes() { return WK.hzBoxes(this, 'knifeDrop'); }
  drawDecal() { WK.hzDraw(this, 'knifeDrop', 1); }
  draw() { WK.hzDraw(this, 'knifeDrop', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
}
const SMALL_KNIFE = SPR.SMALL_KNIFE;   // 뒤집은 그림은 .flip

// 폭포 내리기: 하늘에서 물방울이 떨어지며 자리를 알리고 → 물줄기가 쏟아져 → 양옆으로 낮은 물결이 퍼짐 (뛰어넘기)
const WATER = ['#2e5a7a', '#4a86a8', '#7ab4cc', '#bfe0ea', '#f2fbff'].map(c => mute(c));
// 폭포 물줄기 결: 세로로 흐르는 물살 무늬 (스크롤해서 흐르게) · 양 가장자리는 진한 물빛 테
const FALL_TILE = SPR.FALL_TILE;
class WaterFall {
  constructor(x, delay) { this.x = Math.round(x); this.delay = delay; this.t = 0; this.dodged = false; this.dur = 0.32 * G.speed; }
  update(dt) { return WK.hzUpdate(this, 'waterFall', dt); }   // 움직임 · 판정은 wasm/src/hz_event.rs
  boxes() { return WK.hzBoxes(this, 'waterFall'); }
  drawDecal() { WK.hzDraw(this, 'waterFall', 1); }
  draw() { WK.hzDraw(this, 'waterFall', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
}
class Ripple { // 땅을 타고 퍼지는 낮은 물결 (높이 10)
  constructor(x, dir, speed) { this.x = x; this.dir = dir; this.speed = speed; this.t = 0; this.dodged = false; }
  update(dt) { return WK.hzUpdate(this, 'ripple', dt); }   // 움직임 · 판정은 wasm/src/hz_event.rs
  boxes() { return WK.hzBoxes(this, 'ripple'); }
  draw() { WK.hzDraw(this, 'ripple', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
}
// 오름 스프라이트: 배경 오름과 같은 풀빛 팔레트 · 왼쪽 위 빛 · 비스듬한 풀 결 · 밑동 흙 · 큰 것은 꼭대기 분화구 (셀아웃 외곽선)
const OREUM_SPR = {};
function oreumSprite(H) { return OREUM_SPR[H] || (OREUM_SPR[H] = WK.oreum(H)); }
// 오름 솟기: 땅이 부풀고 갈라진 뒤 풀 덮인 오름이 불쑥 솟았다 가라앉음
class OreumRise {
  constructor(x, delay, H) { this.x = Math.round(x); this.delay = delay; this.H = H; this.t = 0; this.h = 0; this.dodged = false; this.w = 14; }
  update(dt) { return WK.hzUpdate(this, 'oreumRise', dt); }   // 움직임 · 판정은 wasm/src/hz_event.rs
  boxes() { return WK.hzBoxes(this, 'oreumRise'); }
  drawDecal() { WK.hzDraw(this, 'oreumRise', 1); }
  draw() { WK.hzDraw(this, 'oreumRise', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
}
// 설문대 파도: 치마폭에서 일어난 큰 물결이 굴러옴 (낮으면 뛰어넘기, 높으면 구르기로 밑을 빠져나감 — 높은 파도는 바닥이 비어 있음)
class TideWave {
  constructor(x, dir, speed, high, warn) { this.x = x; this.dir = dir; this.speed = speed; this.high = high; this.warn = warn; this.t = 0; this.dodged = false; }
  update(dt) { return WK.hzUpdate(this, 'tideWave', dt); }   // 움직임 · 판정은 wasm/src/hz_event.rs
  boxes() { return WK.hzBoxes(this, 'tideWave'); }
  draw() { WK.hzDraw(this, 'tideWave', 0); }   // 그리기도 wasm/src/hz_*.rs (명령만 받아 찍음)
}
// 설문대 파도 그림 (구워 둔 칸 몇 장): 완만한 뒤 비탈 → 물마루 → 나선처럼 가늘어지며 앞으로 말려 내려오는 입술
//  안쪽 관은 입술과 중심이 어긋난 짙은 타원 · 몸통 색은 수면을 따라 층이 지고(빛이 위에서 스며듦) 비탈엔 결 따라 흰 줄
//  거품은 물마루 · 입술 바깥 · 입술 끝(갈퀴처럼 갈라짐) · 낮은 파도 앞발치(부서지는 흰 물)에만 덩어리지게
//  높은 파도는 아래 16px이 비어 굴러서 지나갈 수 있음 (판정과 같게)
const TIDE_FR = 6, TIDE_SPR = {};
function tideSprite(hi, f, dir) {
  const key = (hi ? 'h' : 'l') + f + (dir < 0 ? 'L' : 'R'); if (TIDE_SPR[key]) return TIDE_SPR[key];
  if (dir < 0) { const r = tideSprite(hi, f, 1), l = flipC(r); l.ax = r.width - 1 - r.ax; l.geo = r.geo; return (TIDE_SPR[key] = l); }
  return (TIDE_SPR[key] = WK.tide(hi, f));   // 오른쪽으로 가는 파도 (기준점 ax · 모양 geo가 붙어 옴)
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
  update(dt) { return WK.hzUpdate(this, 'hopLand', dt); }   // 움직임 · 판정은 wasm/src/hz_event.rs
  boxes() { return WK.hzBoxes(this, 'hopLand'); }
  drawDecal() { WK.hzDraw(this, 'hopLand', 1); }
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

// ═════════════════════════════════════════════════════════════
//  스테이지 흐름
// ═════════════════════════════════════════════════════════════
function setMode(m) { G.mode = m; G.modeT = 0; }
// ── 밈 런: 점수가 오를수록 빨라지고, 배경도 제주 곳곳으로 바뀜 ──
// 단계마다 명소 몇 곳을 돌아다님 (패턴 4개마다 원형 전환으로 다음 명소) — 난이도는 단계 기준 그대로
const TIERS = [
  { score: 0, speed: 1.0, theme: 'field', phase: 0, name: '구좌 밭담길', spots: [['field', '구좌 밭담길'], ['grove', '서귀포 귤밭']] },
  { score: 2500, speed: 1.15, theme: 'coast', phase: 1, name: '성산 일출봉 앞바다', spots: [['coast', '성산 일출봉 앞바다'], ['iho', '이호테우 해변'], ['cheonji', '천지연폭포']] },
  { score: 6000, speed: 1.3, theme: 'beach', phase: 2, name: '노을 지는 협재', spots: [['beach', '노을 지는 협재'], ['jeongbang', '정방폭포'], ['grove', '노을 귤밭']] },
  { score: 11000, speed: 1.45, theme: 'field', phase: 3, name: '한라산 불의 밤', spots: [['field', '한라산 불의 밤'], ['grove', '한라산 밤 귤밭']] },
  { score: 18000, speed: 1.6, theme: 'coast', phase: 3, name: '성산의 밤바다', spots: [['coast', '성산의 밤바다'], ['iho', '이호테우 밤바다']] },
  { score: 28000, speed: 1.8, theme: 'beach', phase: 3, name: '협재 별밤', spots: [['beach', '협재 별밤'], ['jeongbang', '정방폭포 달밤'], ['cheonji', '천지연 밤 숲']] },
  { score: 42000, speed: 2.0, theme: 'field', phase: 3, name: '탐라 대혼돈', spots: [['field', '탐라 대혼돈'], ['iho', '이호테우'], ['jeongbang', '정방폭포'], ['grove', '귤밭'], ['cheonji', '천지연'], ['coast', '성산'], ['beach', '협재']] },
];
const GRADES = [[0, 'D', '관광객'], [600, 'C', '한달살이'], [1800, 'B', '제주 이주민'], [4000, 'A', '제주 도민'], [8000, 'S', '제주 삼춘'], [15000, 'SS', '해녀 대장'], [28000, 'MASTER', '돌하르방'], [45000, 'LEGEND', '한라산 신령']];
function gradeOf(sc) { let r = GRADES[0]; for (const gq of GRADES) if (sc >= gq[0]) r = gq; return r; }
function applyTier(i, instant) {
  const T = TIERS[i]; G.tier = i; Sound.setKey([0, 2, 0, 5, 3, 7, 5][i] || 0, i >= 2); if (!B) Sound.setSong(T.phase >= 3 ? (NIGHT_SONG[T.theme] || 'night') : (THEME_CFG[T.theme] || {}).song || T.theme); G.speed = T.speed;
  if (i >= 2 && state === 'play') daily('tier');
  useTheme(T.theme); if (G.cave) G.caveCD = G.patCount + 12; G.cave = null; G.spot = 0; G.spotAt = 0; G.spotName = T.name; G.phaseTarget = T.phase; if (instant) G.phase = T.phase;
}
// 같은 단계 안에서 다음 명소로: 배경 · 음악 · 이름표 · 그 장소 이야기
// 화면이 가려진 틈(아이리스 한가운데)에 지금 · 다음 시간대 배경을 미리 구워 둠 → 게임 도중 처음 보는 배경을 굽느라 끊기지 않게
function warmScenes() { if (!SCENES) return; for (const p of new Set([G.phase, G.phaseTarget].flatMap(v => [Math.floor(v), Math.min(PHASES.length - 1, Math.ceil(v))]))) void SCENES[p]; }
function setSpot(i) { const sp = TIERS[G.tier].spots; G.spot = i; const [th, nm] = sp[i]; useTheme(th); G.spotName = nm; if (!B) Sound.setSong(runSong()); banner(nm, placeFact(th), C.teal[3]); }
function beginStage() {
  applyTier(0, true); G.patterns = []; G.rest = 1.0; B = null; clearInputs();
  G.usedEvents = {}; G.answers = null; G.cutin = null; G.patCount = 0; G.wow = 0;
  setMode('intro');
}
function updateFlow(dt) {
  G.modeT += dt;
  const last = G.tier >= TIERS.length - 1;   // 마지막 단계 뒤로도 계속 어려워짐 (언젠가는 쓰러지게)
  G.diff = Math.min(last ? 7 : 4.5, Math.max(G.diffFloor || 0, G.tier * 0.7 + Math.min(1.2, G.patInTier * 0.15) + (last ? G.patInTier * 0.1 : 0)));
  if (G.mode === 'intro') { if (G.modeT > 1.8) { setMode('run'); if (best.score > 0) G.rest = Math.max(G.rest, 1.2); } return; }
  if (G.mode !== 'run') return;
  G.score += dt * 12 * (todayWx().mult || 1) * ((G.omegiT || 0) > 0 ? 2 : 1);
  if (G.route && G.route.mod) G.route.mod.tick();   // 구간 변형 규칙
  if (!noDaily() && !DAILY.wxDone && G.score >= 5000) { DAILY.wxDone = true; G.wxPulse = 1.2; DAILY.pearl = (DAILY.pearl || 0) + 1; saveDaily(); banner(`${todayWx().t} 돌파!`, '진주 +1', UI.gold); Sound.sfx.level(); }
  if (!G.scoreDaily && G.score >= 3000) { G.scoreDaily = true; daily('score'); }
  if (!noRecord() && (DAILY.best | 0) > 0 && !G.beatDay && G.score > DAILY.best && G.score <= best.score) { G.beatDay = true; fx({ x: P.x, y: P.y - 12, kind: 'ring', big: true, life: 0.45, col: C.teal[4] }); Sound.sfx.pickup(); G.ammoPulse = 0.25; }
  if (!noRecord() && best.score > 0 && !G.beatBest && G.score > best.score) { G.beatBest = true; banner('신기록', `이전 최고 ${best.score}점`, UI.gold); Sound.sfx.level(); flashFx(0.03, '#fff2d8'); }
  if (G.card) { G.card.t += dt / G.speed; if (G.card.t > 1.1) G.card = null; }
  G.patWait = Math.max(0, (G.patWait || 0) - dt);
  if (G.pendingPat) { G.pendingPat.t -= dt; if (G.pendingPat.t <= 0) { if (G.patterns.length && !G.patterns.some(p => PATTERNS[p.kind].silent)) startPattern(G.pendingPat.kind), G.patterns[G.patterns.length - 1].paired = true; G.pendingPat = null; } }
  for (const p of G.patterns) {
    if (p.wait > 0) { p.wait -= dt; continue; }
    G.curPat = p; const nw = G.warnings.length;
    p.update(dt);
    for (let i = nw; i < G.warnings.length; i++) G.warnings[i].pat = p;
    G.curPat = null;
    if (p.done) { p.end(); G.ended.push(p); }
  }
  G.patterns = G.patterns.filter(p => !p.done);
  G.ended = G.ended.filter(e => {
    const live = G.hz.some(h => h.pat === e) || G.spawnQ.some(h => h.pat === e) || G.warnings.some(w => w.pat === e);
    if (live) return true;
    finishPattern(e); return false;
  });
  // 삼다수: 16~24초마다 높은 곳에 한 병 (2단 점프로 닿는 높이) — 세 병 모이면 파도
  G.nextWater = (G.nextWater ?? 12) - dt / G.speed;
  if (G.nextWater <= 0 && G.mode === 'run' && !P.dead) { G.nextWater = rand(24, 34); const p = new Pickup('water', rand(G.arenaL + 24, G.arenaR - 24), 0); p.float = true; p.y0 = p.y = GROUND - rand(90, 125); p.life = 9; spawnArcFx(p.x, p.y); G.pickups.push(p); }
  // 공중 귤 줄: 9~14초마다 머리 위에 아치로 (이벤트 중엔 쉼)
  G.nextArc = (G.nextArc ?? 6) - dt / G.speed;
  if (G.nextArc <= 0 && !B && G.mode === 'run' && (G.warnings.length || G.patterns.some(p => ['plane', 'bee', 'gull', 'meteor', 'parcel', 'harvest', 'typhoon', 'glider', 'dolphin', 'crow', 'dialect'].includes(p.kind)))) G.nextArc = 1.5;
  if (G.nextArc <= 0 && !B && G.mode === 'run') {
    G.nextArc = rand(9, 14); const cx = rand(60, W - 60), id = (G.arcId = (G.arcId || 0) + 1);
    for (let i = 0; i < 5; i++) { const t = i / 4, p = new Pickup('tang', cx + (t - 0.5) * 70, 0); p.float = true; p.arc = id; p.y0 = p.y = GROUND - 62 - Math.sin(t * Math.PI) * 74; p.life = 6; p.vy = 0; spawnArcFx(p.x, p.y); G.pickups.push(p); }
  }
  G.nextTang -= dt;
  if (G.nextTang <= 0) {
    const r = Math.random(), r2 = Math.random(), extra = G.hp <= 1 ? null : r2 < 0.03 ? (G.ammo < G.ammoMax / 3 ? 'basket' : null) : r2 < 0.05 && G.tier >= 1 ? 'omegi' : r2 < 0.07 && G.tier >= 1 ? 'pinwheel' : null;
    const kind = extra || (G.hp < G.maxHp && r < 0.08 ? 'bong' : (G.tier >= 2 && r < 0.16 ? 'fake' : (G.tier >= 1 && !P.shield && r > 0.97 ? 'shield' : 'tang')));
    G.pickups.push(new Pickup(kind, rand(20, W - 20), -VOFF - 10, rand(-20, 20), 0)); G.nextTang = rand(2.4, 4.2) / (todayWx().tang || 1);
  }
  if (!G.patterns.length) {
    // 다음 단계(배속)로 넘어갈 때: 화면을 비운 뒤 원형 전환
    const nt = !G.practice && !G.route && G.tier + 1 < TIERS.length && G.score >= TIERS[G.tier + 1].score;
    if (nt) { G.tierWait = (G.tierWait || 0) + dt; if (G.tierWait > 2 && G.hz.some(h => !h.ambient) && !B) { for (const h of G.hz) dust(h.x || W / 2, GROUND, 3, 0, 1); G.hz = []; G.spawnQ.length = 0; G.warnings = []; } }
    if (nt && !G.hz.some(h => !h.ambient) && !G.spawnQ.length && !G.warnings.length && !G.iris && !B && G.choseTier !== G.tier + 1) { if (!G.choice) offerUpgrade(); return; }
    if (nt && !G.hz.some(h => !h.ambient) && !G.spawnQ.length && !G.warnings.length && !G.iris && !B) {
      G.tierWait = 0; G.patInTier = 0;
      const ni = G.tier + 1;
      G.iris = { t: 0, dur: 0.9, mid: () => { applyTier(ni, true); fx({ x: P.x, y: P.y - 14, kind: 'flare', size: 16, life: 0.35, col: C.yel[3] }); for (let i = 0; i < 18; i++) fx({ x: W + rand(0, 40), y: rand(-VOFF + 20, GROUND - 6), vx: -rand(380, 520), life: 0.5, kind: 'streak', len: randi(10, 24), col: 'rgba(255,244,224,0.55)' }); G.hz = []; G.interp = null; G.music = { style: 'chip', song: runSong(), tempo: 138 * G.speed }; Sound.setTempo(138 * G.speed); banner(`속도 UP ×${TIERS[ni].speed.toFixed(2)}`, TIERS[ni].name, C.yel[2]); Sound.sfx.level(); } };
      G.rest = 1.6; return;
    }
    if (nt) return;
    if (G.hz.some(h => !h.ambient) || G.spawnQ.length || G.warnings.length) return;
    if (G.route && G.route.slot >= 4 && !G.iris) {   // 구간의 보스까지 넘음
      if (!G.route.offered) { G.route.offered = true; giveAmmo(5); offerUpgrade(); return; }
      if (G.choice) return;
      const nl = (G.route.leg + 1) % G.route.legs.length;   // 한라산 다음은 다시 구좌 (다음 바퀴 · 더 빠르게)
      G.iris = { t: 0, dur: 0.9, mid: () => { if (nl === 0) G.route.lap = (G.route.lap || 0) + 1; G.route.leg = nl; G.route.slot = 0; G.route.offered = false; G.route.plan = shuffled(G.route.legs[nl].pool).slice(0, 3); G.hz = []; G.patInTier = 0; G.interp = null; routeLegSetup(); routeMod(); banner(`${G.route.lap ? G.route.lap + 1 + '바퀴 · ' : ''}${nl + 1}구간 · ${G.route.legs[nl].name}`, `${G.route.mod ? G.route.mod.t + ' · ' : ''}보스 ${EVENTS[G.route.legs[nl].boss].name}`, C.yel[2]); Sound.sfx.level(); } };
      G.rest = 1.6; return;
    }
    G.rest -= dt / G.speed;
    if (G.rest <= 0 && !G.iris) {
      // 만장굴: 아주 가끔 짧게 들어가는 특별 구간 — 박쥐 · 낙석 · 관광객 · 사투리만, 보스 없음
      if (G.cave && G.cave.left <= 0) { const bk = G.cave.back; G.cave = null; G.caveCD = G.patCount + randi(16, 24); G.iris = { t: 0, dur: 0.9, mid: () => { useTheme(bk[0]); G.spotName = bk[1]; if (!B) Sound.setSong(runSong()); banner('굴 밖으로', '다시 ' + bk[1], C.teal[3]); } }; G.rest = 1.0; return; }
      if (!G.cave && !G.route && !G.practice && !B && G.tier >= 1 && G.patCount >= (G.caveCD || 12) && Math.random() < 0.1) { G.cave = { left: randi(2, 3), back: [THEME, G.spotName] }; G.iris = { t: 0, dur: 0.9, mid: () => { useTheme('cave'); G.spotName = '만장굴'; Sound.setSong(runSong()); banner('만장굴 탐험', placeFact('cave'), C.teal[3]); } }; G.rest = 1.0; return; }
      const sp = TIERS[G.tier].spots;   // 패턴 4개마다 다음 명소로 (화면이 빈 틈에)
      if (!G.cave && !G.route && !G.practice && !B && sp && sp.length > 1 && G.patInTier > 0 && G.patInTier % 4 === 0 && G.spotAt !== G.patInTier) { G.spotAt = G.patInTier; const ni = (G.spot + 1) % sp.length; G.iris = { t: 0, dur: 0.9, mid: () => setSpot(ni) }; G.rest = 1.2; return; }
      G.patCount++; G.patInTier++;
      let first;
      if (G.cave) { first = pick(['crow', 'meteor', 'suitcase', 'dialect'].filter(k => k !== G.lastKind)); G.cave.left--; }
      else if (G.route) { const L = G.route.legs[G.route.leg]; first = G.route.slot < 3 ? G.route.plan[G.route.slot] : L.boss; G.route.slot++; }
      else if (G.practice) first = G.practice;
      else if (G.patCount <= (best.score < 1800 ? 4 : 1)) first = best.score < 1800 ? ['rise', 'hop', 'suitcase', 'harvest'][G.patCount - 1] : pick(['rise', 'hop', 'suitcase', 'harvest', 'parcel']);
      else if (G.patCount >= (G.evAt || (best.score < 1800 ? 6 : 5))) {
        let last = ''; try { last = localStorage.getItem('jeju.lastEv') || ''; } catch (e) { /* 무시 */ }
        const EVQ = ['halmang', 'murang', 'knife', 'seolmun']; first = G.nextEvent || EVQ[(EVQ.indexOf(last) + 1) % EVQ.length]; let after = first; if (first === 'seolmun' && G.tier < 1) { first = G.nextEvent === 'seolmun' && last === 'knife' ? 'murang' : pick(['knife', 'murang']); after = 'seolmun'; } G.nextEvent = EVQ[(EVQ.indexOf(after) + 1) % EVQ.length];
        try { localStorage.setItem('jeju.lastEv', after); } catch (e) { /* 무시 */ }   // 대체로 나온 이벤트가 아니라 순서상 자리를 저장 (순환이 굳지 않게)
        G.evAt = G.patCount + Math.round(randi(4, 6) * Math.max(1, G.speed / 1.3));   // 고배속엔 공격이 짧아지니 이벤트 사이 공격 수를 늘림
      }
      else if (best.score >= 1800 && G.patCount === 2 && todayWx().w) { const w = todayWx().w, ks = Object.keys(w).filter(k => PATTERNS[k]); first = ks.filter(k => !(themeCfg().ban || []).includes(k)).sort((a, b) => w[b] - w[a])[0] || 'rise'; }
      else {
        const wx0 = todayWx(), pool = Object.keys(PATTERNS).filter(k => (PATTERNS[k].tier <= G.tier + (best.score >= 1800 && wx0.w && wx0.w[k] ? 1 : 0) || (G.tier === 0 && G.patCount >= 6 && ['gull', 'plane', 'glider', 'meteor', 'dialect'].includes(k))) && !(themeCfg().ban || []).includes(k) && k !== G.lastKind && !PATTERNS[k].big && !(PATTERNS[k].silent && !PATTERNS[k].repeat && G.usedEvents[k]) && !(k === 'meteor' && THEME === 'coast') && !(k === 'dolphin' && THEME === 'field'));
        const fresh = pool.filter(k => !(G.recent || []).includes(k)), wx = todayWx(), cand = fresh.length ? fresh : pool, wOf = k => ((wx.w && wx.w[k]) || 1) * patWeight(k, G.tier);
        let r = Math.random() * cand.reduce((a, k) => a + wOf(k), 0); first = cand[cand.length - 1];
        for (const k of cand) { r -= wOf(k); if (r <= 0) { first = k; break; } }
      }
      if (!G.route && !G.practice && G.tier >= TIERS.length - 1) { G.speed = Math.min(2.7, G.speed + 0.03); Sound.setTempo(138 * G.speed); if (G.music) G.music.tempo = 138 * G.speed; }   // 마지막 단계: 패턴마다 조금씩 더 빨라짐
      startPattern(first);
      // 함께 나와도 피할 길이 남는 가벼운 패턴끼리만 겹침
      const pairable = ['hop', 'suitcase', 'harvest', 'gull'], REMIX = { wind: 'gull', plane: 'hop', bee: 'gull', car: 'harvest', pony: 'gull' };
      if (!G.practice && !G.route && !G.cave && G.tier >= (first === 'pony' || first === 'car' ? 1 : 3) && REMIX[first] && !(themeCfg().ban || []).includes(REMIX[first]) && Math.random() < 0.3 && !G.pendingPat) G.pendingPat = { kind: REMIX[first], t: 2.4 };
      const dual = pairable.includes(first) ? (G.tier >= 4 ? 0.25 : G.tier >= 2 ? 0.1 : 0) : 0;
      if (!G.practice && !G.route && !G.cave && !PATTERNS[first].silent && Math.random() < dual) { const s2 = pick(pairable.filter(k => k !== first && !(themeCfg().ban || []).includes(k) && PATTERNS[k].tier <= G.tier && !(G.recent || []).includes(k))); if (s2) G.pendingPat = { kind: s2, t: 2.0 }; }
      G.lastKind = first; G.rest = Math.max(0.9, 1.8 - G.tier * 0.15);
      if (PATTERNS[first].silent && !PATTERNS[first].event) G.usedEvents[first] = true;
      if (PATTERNS[first].event) G.usedEvents = {};
    }
  }
}
function finishPattern(p) {
  if (PATTERNS[p.kind].silent && !PATTERNS[p.kind].event) return;
  if (p.paired) { if (!p.hit && !P.dead) giveStar(p.kind); return; }   // 겹쳐 나온 패턴은 WOW를 따로 주지 않음
  if (!p.hit && !P.dead) {
    const streak = G.wowStreak = (G.wowStreak || 0) + 1, bonus = Math.round((150 + Math.min(500, Math.floor(G.score * 0.03)) + Math.min(5, streak - 1) * 50) * (todayWx().mult || 1) * (PATTERNS[p.kind].event ? 2 : 1));   // 보스(이벤트)를 안 맞고 넘기면 2배
    G.score += bonus; G.wow++; G.bestWowStreak = Math.max(G.bestWowStreak || 0, streak); daily('wow3', streak, true);
    G.wowFx = { t: 0, bonus, streak }; giveStar(p.kind);
    fx({ x: P.x, y: P.y - 12, kind: 'ring', big: G.tier < 5, life: 0.45, col: UI.gold }); for (let i = 0; i < (G.tier >= 5 ? 6 : 10); i++) fx({ x: P.x, y: P.y - 14, vx: rand(-60, 60), vy: rand(-160, -80), grav: 260, life: rand(0.5, 0.8), kind: 'ember' });
    Sound.sfx.wow();
  }
}

// ═════════════════════════════════════════════════════════════
//  주인공
// ═════════════════════════════════════════════════════════════
function playerBox() { return P.rollT > 0 || P.flipT > 0 || P.pound ? { x: P.x - 6, y: P.y - 13, w: 12, h: 12 } : { x: P.x - 4, y: P.y - 24, w: 8, h: 23 }; }

function updatePlayer(dt) {
  P.prevY = P.y;
  if (P.dead) { P.vy += GRAV * dt; P.x += P.vx * dt; P.y += P.vy * dt; P.spin += dt * 14; return; }
  const ctrl = !G.cut && !G.choice;
  P.inv = Math.max(0, P.inv - dt); P.hurtT = Math.max(0, P.hurtT - dt); P.rollCD -= dt; P.throwCD -= dt; P.throwT -= dt; P.flipT -= dt; P.landT -= dt; P.skidT -= dt;
  P.blinkT -= dt; if (P.blinkT < -0.12) P.blinkT = rand(1.5, 4);
  P.confuseT = Math.max(0, (P.confuseT || 0) - dt);
  const dir = (ctrl ? (held.right ? 1 : 0) - (held.left ? 1 : 0) : 0) * (P.confuseT > 0 ? -1 : 1);   // 사투리 혼란: 좌우 반전
  if (pressed.jump) { P.buffer = BUFFER; pressed.jump = false; } else P.buffer -= dt;
  // 쿨다운 끝나기 직전(0.3초 안)에 누른 구르기 · 던지기는 버리지 않고 풀리는 순간 나감
  const rollBuf = () => Math.max(BUFFER, Math.min(0.3, (P.rollT > 0 ? P.rollT + ROLL_CD : 0) + Math.max(0, P.rollCD) + 0.05));
  if (pressed.roll) { P.rollBuf = rollBuf(); pressed.roll = false; } else P.rollBuf = (P.rollBuf || 0) - dt;
  // ↓/S: 공중이면 내려찍기, 땅이면 구르기
  if (pressed.down) { pressed.down = false; if (!P.onGround && GROUND - P.y > 20) P.poundBuf = BUFFER; else P.rollBuf = rollBuf(); } else P.poundBuf = (P.poundBuf || 0) - dt;
  if (pressed.throw) { P.throwBuf = Math.max(BUFFER, Math.min(0.3, Math.max(0, P.throwCD, P.rollT) + 0.05)); pressed.throw = false; } else P.throwBuf = (P.throwBuf || 0) - dt;
  if (held.throw && ctrl) P.throwBuf = Math.max(P.throwBuf, 0.02);
  if (!ctrl) { P.buffer = 0; P.rollBuf = 0; P.throwBuf = 0; }
  P.coyote = P.onGround ? COYOTE : P.coyote - dt;

  if (P.flipT > 0) { P.ghostT -= dt; if (P.ghostT <= 0) { G.ghosts.push({ img: curFrame(), x: P.x, y: P.y, life: 0.18, col: P.airJumps === 0 && P.flipMax - P.flipT < 0.12 ? C.yel[3] : C.cloth[2] }); P.ghostT = 0.05; } }
  if (P.hurtT > 0) P.vx = approach(P.vx, 0, 200 * dt);
  else if (P.rollT > 0) {
    P.rollT -= dt;
    P.vx = P.face * ROLL_V * (0.5 + 0.5 * (P.rollT / ROLL_T));
    P.ghostT -= dt; if (P.ghostT <= 0) { G.ghosts.push({ img: curFrame(), x: P.x, y: P.y, life: 0.22, col: C.org[3] }); P.ghostT = 0.035; }
    P.dustT -= dt; if (P.onGround && P.dustT <= 0) { dust(P.x - P.face * 5, GROUND, 1, -P.face); P.dustT = 0.04; }
    if (P.rollT <= 0) endRoll(ROLL_CD);
  } else {
    if (dir) {
      if (P.onGround && Math.sign(P.vx) === -dir && Math.abs(P.vx) > 50) { P.skidT = 0.12; if (Math.random() < 0.5) dust(P.x + dir * 4, GROUND, 1, dir); }
      P.vx = WK.walk(P.vx, dir, P.onGround, G.up.speed || 0, dt); P.face = dir;   // 가속 · 마찰은 wasm/src/player.rs
    } else P.vx = WK.walk(P.vx, 0, P.onGround, 0, dt);
  }

  if (P.poundBuf > 0 && P.hurtT <= 0 && !P.pound && !P.onGround) {
    // 내려찍기: 곧장 내리꽂혀 착지 충격파로 주변 하르방 · 썩은 귤을 부숨
    P.poundBuf = 0; P.pound = true; P.flipT = 0; P.rollT = 0; P.vx = 0; P.vy = 0; P.poundT = 0.08;
    Sound.sfx.whoosh(); P.sx = 0.8; P.sy = 1.25; fx({ x: P.x, y: P.y - 12, kind: 'flare', size: 7, life: 0.15, col: C.yel[3] });
  }
  if (P.rollBuf > 0) {
    if (P.hurtT <= 0 && P.rollT <= 0 && P.rollCD <= 0 && !P.pound) {
      P.rollBuf = 0;
      if (dir) P.face = dir;
      P.rollT = ROLL_T; P.flipT = 0;
      if (onBeatAct(P.x, P.y - 8, false)) { G.slow = Math.max(G.slow, 0.08); for (let k = 1; k <= 3; k++) G.ghosts.push({ img: curFrame(), x: P.x - P.face * k * 5, y: P.y, life: 0.2, col: C.teal[3] }); }   // 박자 구르기
      if (!P.onGround) P.vy = Math.min(P.vy, 0) * 0.3;
      Sound.sfx.roll(); dust(P.x, GROUND, 4, -P.face);
      P.sx = 1.25; P.sy = 0.8;
    }
  }
  if (P.buffer > 0 && P.hurtT <= 0) {
    if (P.coyote > 0) {
      P.vy = -JUMP_V; P.onGround = false; P.coyote = 0; P.buffer = 0; P.jumpCut = false;
      if (P.rollT > 0) { endRoll(ROLL_CD * 0.4); P.vx = P.face * SPEED * 1.25; }
      P.sx = 0.75; P.sy = 1.3; Sound.sfx.jump(); dust(P.x - 3, GROUND, 3, -1); dust(P.x + 3, GROUND, 3, 1); onBeatAct(P.x, GROUND - 4, false);
      fx({ x: P.x, y: GROUND - 1, kind: 'ring', life: 0.22, col: C.cloth[2] });
      for (const s of [-1, 1]) fx({ x: P.x + s * 5, y: GROUND - 3, vx: s * 10, vy: -70, life: 0.14, kind: 'trail', col: C.cloth[2] });
    } else if (P.airJumps > 0) {
      P.airJumps--;
      const third = P.airJumps === 0;
      P.vy = third ? -DJUMP_V * 0.92 : -DJUMP_V; P.buffer = 0; P.jumpCut = false; P.flipT = third ? 0.42 : 0.32; P.flipMax = P.flipT;
      if (P.rollT > 0) endRoll(ROLL_CD * 0.6);
      P.sx = 0.8; P.sy = 1.25; Sound.sfx.djump();
      fx({ x: P.x, y: P.y - 2, kind: 'ring', life: 0.25, col: third ? C.yel[3] : C.cloth[3] });
      fx({ x: P.x, y: P.y - 4, kind: 'flare', size: third ? 9 : 5, life: 0.18, col: third ? C.yel[3] : C.cloth[3] });
      for (let i = -2; i <= 2; i++) fx({ x: P.x + i * 2, y: P.y, vx: i * 25, vy: 90, life: 0.2, kind: 'trail', col: third ? C.yel[2] : C.cloth[2] });
      if (third) { Sound.sfx.dodge(); light(P.x, P.y - 10, 26, C.yel[3], 0.8); for (let i = 0; i < 8; i++) fx({ x: P.x + rand(-8, 8), y: P.y - rand(0, 16), vx: rand(-30, 30), vy: rand(-40, 10), life: 0.4, kind: 'spark' }); }
      for (let i = 0; i < 6; i++) fx({ x: P.x + rand(-6, 6), y: P.y, vx: rand(-40, 40), vy: rand(20, 60), life: 0.3, kind: 'puff', size: 1 });
    }
  }
  if (!held.jump && P.vy < 0 && !P.jumpCut) { P.vy *= JUMP_CUT; P.jumpCut = true; }

  if (P.throwBuf > 0) {
    if (P.throwCD <= 0 && P.hurtT <= 0 && P.rollT <= 0) {
      P.throwBuf = 0;
      if (G.ammo > 0) {
        G.ammo--; P.throwCD = THROW_CD; P.throwT = 0.2;
        G.shots.push(new Shot(P.x + P.face * 7, P.y - 18, P.face));
        Sound.sfx.throw(); P.sx = 1.12; P.sy = 0.92;
        fx({ x: P.x + P.face * 9, y: P.y - 18, kind: 'flare', size: 4, life: 0.1, col: C.org[3] }); fx({ x: P.x + P.face * 8, y: P.y - 18, vx: P.face * 20, vy: -10, life: 0.2, kind: 'puff', size: 0 });
      } else { Sound.sfx.empty(); popup('귤 없음', P.x, P.y - 34, C.org[3]); P.throwCD = 0.4; }
    }
  }

  P.poundSafe = Math.max(0, (P.poundSafe || 0) - dt);
  if (P.pound) {
    P.vx = 0; P.poundT -= dt;
    if (P.poundT > 0) P.vy = 0; else P.vy = 620;
    P.ghostT2 = (P.ghostT2 || 0) - dt; if (P.ghostT2 <= 0 && P.poundT <= 0) { P.ghostT2 = 0.03; G.ghosts.push({ img: curFrame(), x: P.x, y: P.y, life: 0.16, col: C.yel[3] }); }
  }
  WK.fall(P, dt, G.wind, G.arenaL || 8 + EDGE, G.arenaR, held.jump);   // 중력 · 바람 · 양옆 벽 · 부드러운 천장 (wasm/src/player.rs)
  if (!P.onGround) P.peakY = Math.min(P.peakY ?? P.y, P.y);

  if (P.y >= GROUND) {
    if (!P.onGround && P.pound) poundLand();
    if (!P.onGround) {
      const hard = P.vy > 220;
      dust(P.x - 4, GROUND, hard ? 4 : 2, -1); dust(P.x + 4, GROUND, hard ? 4 : 2, 1);
      if (P.vy > 150) Sound.sfx.land();
      P.flipT = 0; P.landT = hard ? 0.1 : 0.05;
      const fall = GROUND - (P.peakY ?? GROUND); P.peakY = undefined;
      if (fall > 150) { light(P.x, GROUND - 4, 22, C.yel[3], 0.6); fx({ x: P.x, y: GROUND - 1, kind: 'ring', life: 0.3, col: C.yel[3] }); }
      if (fall > 110) { fx({ x: P.x, y: GROUND - 1, kind: 'ring', big: true, life: 0.25, col: C.cloth[2] }); shake(0.08); for (let i = 0; i < 6; i++) fx({ x: P.x, y: GROUND - 1, vx: rand(-90, 90), vy: rand(-60, -20), grav: 300, life: rand(0.25, 0.4), kind: 'chunk', size: 1, col: C.soil[3] }); }
    }
    P.y = GROUND; P.vy = 0; P.onGround = true; P.airJumps = AIR_JUMPS;
  } else P.onGround = false;

  if (P.onGround && Math.abs(P.vx) > 10 && P.rollT <= 0) {
    P.anim += dt * (Math.abs(P.vx) / SPEED) * 15;
    P.dustT -= dt; if (P.dustT <= 0) { dust(P.x - P.face * 5, GROUND, 1, -P.face); P.dustT = 0.16; }
  } else if (P.rollT <= 0) P.anim = 0;

  P.sx = approach(P.sx, 1, dt * 5); P.sy = approach(P.sy, 1, dt * 5);
  updateScarf();
}

function clearInputs() {
  for (const k of GAME_KEYS) pressed[k] = false;
  pressed.left = pressed.right = pressed.start = false;
  if (P) { P.buffer = 0; P.rollBuf = 0; P.throwBuf = 0; P.poundBuf = 0; }
}
function rollInv() { return P.rollT > ROLL_T - 0.24 || (P.pound && P.poundT <= 0) || (P.poundSafe || 0) > 0; }
// 내려찍기 착지: 충격파 · 화면 울림 · 근처의 밟을 수 있는 것들을 한꺼번에 부숨
function poundLand() {
  P.pound = false; P.poundSafe = 0.12; P.rollCD = ROLL_CD; P.landT = 0.16; P.sx = 1.35; P.sy = 0.7;
  Sound.sfx.boom(); Sound.duck(0.3); shake(0.2); kick(0, 3); hitstop(0.065);
  fx({ x: P.x, y: GROUND - 1, kind: 'ring', big: true, life: 0.35, col: C.yel[3] }); fx({ x: P.x, y: GROUND - 1, kind: 'ring', life: 0.25, col: '#fff4e0' });
  dust(P.x - 6, GROUND, 5, -1, 2); dust(P.x + 6, GROUND, 5, 1, 2); light(P.x, GROUND - 6, 34, C.yel[3], 0.9);
  for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) fx({ x: P.x + sd * (6 + i * 6), y: GROUND - 2, vx: sd * rand(30, 70), vy: -rand(60, 140), grav: 420, life: rand(0.3, 0.5), kind: 'chunk', size: randi(1, 2), col: pick([C.soil[3], C.stone[3]]) });
  onBeatAct(P.x, GROUND - 4);
  let n = 0;
  for (const h of G.hz) { if (h.dead || !h.stompable || !h.kill) continue; const bs = h.boxes(); if (bs.some(b => Math.abs(b.x + b.w / 2 - P.x) < 46 + 16 * (G.up.pound || 0) && b.y + b.h > GROUND - 30)) { h.kill('stomp'); n++; G.stomps++; daily('stomp'); } }
  if (n > 1) addScore(80 * n, P.x, P.y - 44);   // 여럿을 한 번에: 충격파 보너스 (처치마다 보상 · 콤보는 처치 쪽에서)
}
function endRoll(cd) { P.rollT = 0; P.rollCD = cd; P.rollCDMax = cd; }

function curFrame() {
  const side = P.face > 0 ? 'r' : 'l';
  let f;
  if (P.dead || P.hurtT > 0) f = GYUL.hurt;
  else if (P.pound) f = GYUL.roll[Math.floor(amb.t * 40) % 8];
  else if (P.rollT > 0) f = GYUL.roll[Math.floor((1 - P.rollT / ROLL_T) * 10) % 8];
  else if (P.flipT > 0) f = GYUL.roll[Math.floor((1 - P.flipT / (P.flipMax || 0.32)) * (P.flipMax > 0.4 ? 16 : 8)) % 8];
  else if (P.throwT > 0) f = P.onGround && Math.abs(P.vx) > 10 ? GYUL.throwRun[P.throwT > 0.14 ? 0 : 1][Math.floor(P.anim) % 8] : GYUL.throw[P.throwT > 0.14 ? 0 : 1];
  else if (!P.onGround) f = P.vy < -60 ? GYUL.up : P.vy < 60 ? GYUL.apex : GYUL.fall;
  else if (P.landT > 0) f = GYUL.land;
  else if (P.skidT > 0) f = GYUL.skid;
  else if (Math.abs(P.vx) > 10) f = GYUL.run[Math.floor(P.anim) % 8];
  else f = P.blinkT < 0 ? GYUL.blink : GYUL.idle[Math.floor(amb.t * 3) % 4];
  return f[side];
}

// 목도리: 짧은 사슬 물리 (머리카락처럼 뒤로 휘날림)
function updateScarf() {
  const f = curFrame(), neck = f.neck || [0, -20];
  const ball = P.rollT > 0 || P.flipT > 0;
  // 등의 테왁: 스프링으로 한 박자 늦게 출렁
  const tw = P.tw || (P.tw = { x: P.x, y: P.y - 18, vx: 0, vy: 0 });
  const tx = P.x + (ball ? 0 : neck[0] - P.face * 4), ty = P.y + (ball ? -14 : neck[1] + 6);
  tw.vx += ((tx - tw.x) * 260 - tw.vx * 18) * STEP * 2; tw.vy += ((ty - tw.y) * 260 - tw.vy * 18) * STEP * 2;
  tw.x += tw.vx * STEP * 2; tw.y += tw.vy * STEP * 2;
  const ax = ball ? P.x : tw.x, ay = ball ? P.y - 14 : tw.y + 6;
  const pts = P.scarf;
  pts[0].x = ax; pts[0].y = ay; pts[0].px = ax; pts[0].py = ay;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i], vx = (p.x - p.px) * 0.86, vy = (p.y - p.py) * 0.86;
    p.px = p.x; p.py = p.y;
    p.x += vx - P.face * 0.18 + G.wind * 0.004 - P.vx * 0.0015; p.y += vy + 0.22;
  }
  for (let it = 0; it < 3; it++) for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, L = 2.4;
    b.x = a.x + dx / d * L; b.y = a.y + dy / d * L;
    if (b.y > GROUND - 1) b.y = GROUND - 1;
  }
}
// 진주로 여는 스카프 색 (진주는 쓰지 않고 모은 개수로 열림)
const SCARVES = [{ n: '바다', c: '#3aa88a', cost: 0 }, { n: '감귤', c: '#e08a3a', cost: 3 }, { n: '유채', c: '#d8c04a', cost: 6 }, { n: '동백', c: '#c04a4a', cost: 10 }, { n: '현무암', c: '#6a6a72', cost: 15 }];
const _scarfCols = {};
function scarfCols() { const i = clamp(DAILY.scarf | 0, 0, SCARVES.length - 1); if (_scarfCols[i]) return _scarfCols[i]; const b = mute(SCARVES[i].c); return (_scarfCols[i] = [b, mix(b, INK, 0.15), b, mix(b, INK, 0.25), mix(b, INK, 0.15), mix(b, INK, 0.35), mix(b, INK, 0.45)]); }
function cycleScarf(d) {
  ensureDaily(); const n = SCARVES.length; let i = DAILY.scarf | 0;
  for (let k = 0; k < n; k++) { i = (i + d + n) % n; if ((DAILY.pearl || 0) >= SCARVES[i].cost) break; }
  if (i === (DAILY.scarf | 0)) { Sound.sfx.tink(); return; }
  DAILY.scarf = i; saveDaily(); Sound.sfx.select();
}
function drawScarf() {
  const pts = P.scarf, cols = scarfCols();
  for (const pass of [0, 1]) for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], s = i < 4 ? 2 : 1;
    for (let k = 0; k <= 2; k++) {
      const x = Math.round(lerp(a.x, b.x, k / 2)), y = Math.round(lerp(a.y, b.y, k / 2));
      if (pass === 0) { g.fillStyle = mix(cols[i], INK, 0.7); g.fillRect(x - 1, y - 1, s + 2, s + 2); }
      else { g.fillStyle = cols[i]; g.fillRect(x, y, s, s); }
    }
  }
}

function hurt(src) {
  if (godMode) { if (src && src.pat) src.pat.hit = true; G.combo = 0; G.wowStreak = 0; P.inv = 0.6; flashFx(0.015, '#fff4e0'); Sound.sfx.tink(); return; }
  // 테왁 방패: 한 번은 막아 줌 (피격으로는 쳐서 WOW는 끊김)
  if (P.shield) {
    P.shield = 0; P.inv = 1.0; G.combo = 0; G.wowStreak = 0;
    if (src && src.pat) src.pat.hit = true;
    fx({ x: P.x, y: P.y - 12, kind: 'ring', big: true, life: 0.35, col: C.org[3] }); fx({ x: P.x, y: P.y - 14, kind: 'flare', size: 10, life: 0.2, col: C.yel[3] }); burst(P.x, P.y - 12, 12, [C.org[1], C.org[2], C.org[3]], 110, 0.6, 360, 'chunk'); light(P.x, P.y - 12, 30, C.org[3], 0.9); popup('방어', P.x, P.y - 34, C.org[3], 'b'); Sound.sfx.block(); shake(0.25); hitstop(0.04);
    return;
  }
  G.hp--; G.hitsTaken++; if (G.hp === 1 && !G.practice) setTimeout(() => Sound.sfx.lowhp(), 380);   // 체력 1: 경고음
  if (src && src.pat) src.pat.hit = true; else for (const pt of [...G.patterns, ...G.ended]) pt.hit = true; G.stageHits++; G.combo = G.up.combo ? Math.floor(G.combo / 2) : 0; G.wowStreak = 0; G.beatCombo = 0;
  P.inv = 1.8; P.hurtT = 0.38; P.rollT = 0; P.flipT = 0; P.pound = false;
  P.vx = -P.face * 90; P.vy = -180; P.onGround = false;
  hitstop(0.06); flashFx(0.03, '#ffd8c8', true); shake(0.3); kick(-P.face * 3, -1); Sound.duck(0.35);
  Sound.sfx.hurt();
  burst(P.x, P.y - 12, 14, [C.red[2], C.red[3], C.org[3]], 90, 0.5);
  if (G.practice && G.hp <= 0) { G.hp = G.maxHp; G.pracFails = (G.pracFails || 0) + 1; banner('연습', `실패 ${G.pracFails}회 · 체력 회복`, UI.sub); }
  if (G.hp <= 0) { G.killer = src && src.pat ? (themeCfg().indoor && src.pat.kind === 'crow' ? '박쥐 떼' : themeCfg().indoor && src.pat.kind === 'meteor' ? '천장 낙석' : DEX_NAME[src.pat.kind] || '') : src === 'trap' ? '함정 한라봉' : ''; die(); }   // 동굴에선 동굴 이름으로
}
function die() {
  G.choice = null;
  P.dead = true;
  G.news = null; G.interp = null;
  for (const pt of G.patterns) pt.end(); G.patterns = [];
  G.dark = 0; G.storm = 0; G.boltFx = null; G.windTarget = 0; G.cut = null; G.cutin = null; G.card = null; G.rapSub = null; G.answers = null; G.skill = null; P.confuseT = 0;
  if (B) { B.say = null; B.leave(); }
  G.hz = []; G.spawnQ = []; G.warnings = []; G.pendingPat = null; if (G.volcano) G.volcano.erupt = 0;
  P.dead = true; P.vy = -260; P.vx = -P.face * 50;
  impact(P.x, P.y - 12, C.red[3], 0.8, true); burst(P.x, P.y - 12, 16, [C.org[2], C.org[3], C.red[2], C.wood[2]], 120, 0.7, 380, 'chunk'); flashFx(0.05, '#ffd8c8', true); light(P.x, P.y - 12, 44, C.red[3], 1);
  hitstop(0.3); G.slow = 1.3; G.overT = 1.9; shake(0.8);
  Sound.stopMusic();
}
function dodge() {
  onBeatAct(P.x, P.y - 14);
  G.dodges++; Sound.sfx.dodge(); reward('dodge', P.x, P.y - 28);
  for (let i = 0; i < 5; i++) fx({ x: P.x + rand(-6, 6), y: P.y - rand(2, 14), vy: -30, life: 0.3, kind: 'spark' });
}

function checkHits() {
  if (P.dead || G.iris) return;
  const pb = playerBox(), feetPrev = P.prevY ?? P.y;
  for (const h of G.hz) {
    if (h.dead) continue;
    for (const b of h.boxes()) {
      if (!overlap(pb, b)) continue;
      if ((h.stompable || h.bouncy) && P.vy > 40 && feetPrev <= b.y + 6 && P.rollT <= 0) {
        P.vy = -270; P.y = Math.min(P.y, b.y); P.inv = Math.max(P.inv, 0.15); P.airJumps = AIR_JUMPS; P.jumpCut = true; P.sx = 0.8; P.sy = 1.25; P.flipT = 0; P.pound = false;
        Sound.sfx.stomp(); spark(P.x, b.y); hitstop(0.035); kick(0, 2); onBeatAct(P.x, b.y); fx({ x: P.x, y: b.y, kind: 'ring', life: 0.22, col: '#fff4e0' }); fx({ x: P.x, y: b.y, kind: 'flare', size: 7, life: 0.16, col: C.yel[3] }); dust(P.x, b.y, 3);
        if (h.stompable && h.kill) { h.kill('stomp'); daily('stomp'); }
        else { if (!h.onBounce || h.onBounce()) { addScore(80, P.x, b.y - 10); comboUp(P.x, b.y - 10); }  }
        G.stomps++;
        break;
      }
      if (h.safe) break;
      if (!h.solid && (rollInv() || (P.airJumps === 0 && P.flipMax - P.flipT < 0.12))) { if (!h.dodged) { h.dodged = true; dodge(); } }
      else if (P.inv <= 0) { hurt(h); if (P.dead) return; }
      break;
    }
  }
  for (const h of G.hz) {
    if (h.dead || h.nearDone || h.safe || h.solid || h instanceof Rise || h instanceof Meteor) continue;
    const nb = { x: pb.x - 6, y: pb.y - 6, w: pb.w + 12, h: pb.h + 9 };
    const bs = h.boxes();
    if (bs.some(b => overlap(pb, b))) { h.nearTouched = true; continue; }
    const inNear = bs.some(b => overlap(nb, b));
    if (inNear) h.nearArm = true;
    else if (h.nearArm) {
      h.nearDone = true;
      if (!h.nearTouched && P.inv <= 0 && (G.nearCD || 0) < amb.t) { G.nearCD = amb.t + 0.4; fx({ x: P.x, y: P.y - 14, kind: 'flare', size: 6, life: 0.15, col: C.teal[4] }); for (let i = 0; i < 2; i++) fx({ x: P.x - P.face * 3, y: P.y - rand(4, 22), vx: -P.face * 40, life: 0.12, kind: 'trail', col: C.teal[4] }); G.score += 50 * ((G.omegiT || 0) > 0 ? 2 : 1); G.nears = (G.nears || 0) + 1; popup('아슬!', P.x, P.y - 32, C.teal[4], 's'); daily('near'); if (amb.t > (G.nearSlowAt || 0) && !G.hz.some(h => h.chain)) { G.slow = Math.max(G.slow || 0, 0.09); G.nearSlowAt = amb.t + 2; } Sound.sfx.dodge(); }
    }
  }
  for (const s of G.shots) {
    if (s.dead) continue;
    const sb = s.box();
    for (const h of G.hz) {
      if (h.dead || !h.onShot) continue;
      if (h.boxes().some(b => overlap(sb, b))) { fx({ x: s.x, y: s.y, kind: 'flare', size: 5, life: 0.12, col: C.org[3] }); if (h.onShot(s)) { s.dead = true; juice(s.x, s.y, 5); if (h.dead) hitstop(0.015); } break; }
    }
  }
  for (const s of G.shots) {   // 던진 귤로 아이템 · 귤을 맞히면 그 자리에서 먹음
    if (s.dead) continue;
    const sb = s.box(), p = G.pickups.find(q => !q.dead && overlap(sb, q.shotBox()));
    if (!p) continue;
    if (p.kind !== 'tang') s.dead = true;   /* 그냥 귤은 줍고 계속 날아감 (싸우는 중에 귤이 가로막지 않게) */ fx({ x: p.x, y: p.y - 8, kind: 'flare', size: 7, life: 0.15, col: '#fff4e0' }); for (let i = 0; i < 5; i++) fx({ x: p.x, y: p.y - 8, vx: (P.x - p.x) * rand(1.5, 2.5), vy: (P.y - 14 - p.y) * rand(1.5, 2.5) - 40, life: 0.35, kind: 'px', col: C.yel[3] });   // 먹은 빛이 숨비 쪽으로 튐
    if (collectPickup(p, true) === 'dead') return;
  }
  for (const p of G.pickups) {
    if (p.dead || !overlap(pb, p.box())) continue;
    if (collectPickup(p) === 'dead') return;
  }
}
// 줍기: 몸으로 닿거나, 던진 귤로 맞혀도 똑같이 먹음 (함정은 귤로 맞히면 다치지 않고 터짐)
function collectPickup(p, byShot) {
  p.dead = true;
  if (p.kind === 'fake') { burst(p.x, p.y - 6, 14, ['#5e6e34', '#8a9a48'], 90, 0.5, 300); Sound.sfx.splat(); if (byShot) { popup('펑!', p.x, p.y - 20, C.teal[3], 'b'); return; } popup('함정', p.x, p.y - 20, C.red[3], 'b'); if (P.inv <= 0) { hurt('trap'); if (P.dead) return 'dead'; } return; }   // 던진 귤로 맞히면 다치지 않고 터뜨림
  if (p.kind === 'bong') { G.hp = Math.min(G.maxHp, G.hp + 1); Sound.sfx.heal(); popup('+♥', p.x, p.y - 16, '#ff8fa0', 'b'); }
  else if (p.kind === 'water') { G.water = (G.water || 0) + 1; G.waterSeen = true; G.waterPulse = 0.4; Sound.sfx.pickup(); splashFx(p.x, 0.6); popup(G.water >= 3 ? '삼다수 충전' : `삼다수 ${G.water}/3`, p.x, p.y - 22, mute('#8ac4e4'), 's'); if (G.water >= 3) samdaWave(); return; }
  else if (p.kind === 'basket') { giveAmmo(5); G.ammoPulse = 0.4; Sound.sfx.bag(); popup('귤 망사리 · 귤 +5', p.x, p.y - 16, C.org[3], 'b'); burst(p.x, p.y - 4, 12, [C.org[2], C.org[3], C.yel[3]], 90, 0.5, 300); return; }
  else if (p.kind === 'omegi') { G.omegiT = 6; Sound.sfx.level(); popup('오메기떡 · 6초 점수 ×2', p.x, p.y - 16, C.yel[2], 'b'); fx({ x: p.x, y: p.y - 6, kind: 'ring', big: true, life: 0.35, col: C.yel[3] }); return; }
  else if (p.kind === 'pinwheel') { G.magnetT = 8; Sound.sfx.gust(); popup('바람개비 · 8초 귤 끌어당김', p.x, p.y - 16, C.teal[3], 'b'); for (let i = 0; i < 10; i++) fx({ x: p.x, y: p.y - 6, vx: rand(-120, 120), vy: rand(-60, 20), life: 0.4, kind: 'streak', len: randi(4, 8), col: 'rgba(255,244,224,0.5)' }); return; }
  else if (p.kind === 'shield') { P.shield = 1; Sound.sfx.equip(); popup('방패', p.x, p.y - 16, C.org[3], 'b'); }
  else { giveAmmo(1); G.score += 10 * ((G.omegiT || 0) > 0 ? 2 : 1); daily('tang');
    if (p.arc) { G.arcGot = G.arcGot || {}; G.arcGot[p.arc] = (G.arcGot[p.arc] || 0) + 1; if (G.arcGot[p.arc] === 5) { addScore(150, p.x, p.y - 34); fx({ x: p.x, y: p.y - 6, kind: 'ring', big: true, life: 0.4, col: C.yel[3] }); popup('아치 완성', p.x, p.y - 26, C.yel[2], 'b', true); for (let i = 0; i < 8; i++) fx({ x: p.x, y: p.y - 6, vx: rand(-70, 70), vy: rand(-120, -40), grav: 260, life: rand(0.4, 0.7), kind: 'ember' }); light(p.x, p.y - 6, 30, C.yel[3], 0.8); Sound.sfx.level(); } else popup(G.arcGot[p.arc] + '/5', p.x, p.y - 22, C.yel[3]); } fx({ x: p.x, y: p.y - 4, kind: 'ring', life: 0.25, col: C.org[3] }); fx({ x: p.x, y: p.y - 4, kind: 'flare', size: 5, life: 0.15, col: '#fff4e0' }); G.ammoPulse = 0.25; Sound.sfx.pickup(); if (!p.arc) popup('+1', p.x, p.y - 14, C.org[3]); }
  burst(p.x, p.y - 4, 8, [C.org[3], C.org[2], C.yel[3]], 50, 0.4, 100);
}

// ═════════════════════════════════════════════════════════════
//  업데이트
// ═════════════════════════════════════════════════════════════
function updateAmbient(dt) {
  amb.t += dt;
  Sound.setSpace(THEME === 'cave' ? 'cave' : 'open'); Sound.ambience('rain', state === 'play' ? (G && G.storm || 0) * 0.13 : 0);
  Sound.ambience('surf', state === 'play' && ['coast', 'beach', 'iho'].includes(THEME) ? 0.05 : 0); Sound.ambience('falls', state === 'play' && ['jeongbang', 'cheonji'].includes(THEME) ? 0.045 : 0);   // 바닷가 파도 · 폭포 물소리   // 만장굴은 크게 울림 · 태풍엔 빗소리
  if (THEME === 'cave' && state !== 'loading' && state !== 'pause' && Math.random() < dt * 0.45) Sound.sfx.drip();   // 동굴 물방울
  for (const c of amb.clouds) { c.x += (c.v * (G && G.wx && G.wx.id === 'typhoon' ? 3 : 1) + (G ? G.wind * 0.12 : 0)) * dt; if (c.x > W + 20) { c.x = -120; c.y = rand(-VOFF + 18, 50); } }
  if (P) amb.camX = lerp(amb.camX, clamp((P.x - W / 2) * 0.12, -20, 20), 1 - Math.pow(0.02, dt));
}

function updateWorld(dt) {
  // 생존 시간은 tick()에서 실제 시간으로 잼
  if (!P.dead) updateFlow(dt);
  if (G.choice) return;   // 강화 선택이 열리면 그 즉시 멈춤
  updatePlayer(G.mode === 'run' ? dt / G.speed : dt);
  G.wind = approach(G.wind, G.windTarget, 110 * dt);
  G.hz = G.hz.filter(h => h.update(dt) !== false);
  G.shots = G.shots.filter(s => s.update(dt) !== false);
  G.pickups = G.pickups.filter(p => p.update(dt) !== false);
  if (B) { G.curPat = B.pat || null; B.update(G.mode === 'run' ? dt / G.speed : dt); G.curPat = null; }
  if (G.spawnQ.length) {   // 공격은 8분음표 박자에 맞춰 나옴 (최대 0.3초까지만 기다림)
    G.spawnHold = (G.spawnHold || 0) + dt;
    const f8 = (beatNow() * 2) % 1;
    if (f8 < 0.2 || G.spawnHold > 0.3 || P.dead) { for (const h of G.spawnQ) G.hz.push(h); G.spawnQ.length = 0; G.spawnHold = 0; }
  }
  for (const w of G.warnings) { w.t += dt; if (w.t >= w.dur && !w.fired) { w.fired = true; G.curPat = w.pat; w.spawn(); G.curPat = null; } }
  G.warnings = G.warnings.filter(w => !w.fired);
  for (const d of G.decals) d.t += dt;
  G.decals = G.decals.filter(d => d.t < d.life);
  updateVolcano(dt);
  updateFxList(dt);
  const uiDt = G.mode === 'run' ? dt / G.speed : dt;
  for (const p of G.pops) p.t += uiDt;
  G.pops = G.pops.filter(p => p.t < 1);
  for (const gh of G.ghosts) gh.life -= dt;
  G.ghosts = G.ghosts.filter(gh => gh.life > 0);
  G.comboT -= uiDt; if (G.comboT <= 0) G.combo = 0;
  if (G.hint > 0 && G.mode === 'run') G.hint -= dt / G.speed;
  if (pressed.jump || pressed.roll) G.hint = Math.min(G.hint, 1.5);
  G.phase = approach(G.phase, G.phaseTarget, dt * 0.4);
  G.trauma = Math.max(0, G.trauma - dt * 1.6);
  if (G.kick) { const d = Math.exp(-dt * 18); G.kick.x *= d; G.kick.y *= d; }
  G.flash = Math.max(0, G.flash - dt);
  G.lightning = Math.max(0, (G.lightning || 0) - dt); if (G.boltFx) { G.boltFx.t -= dt; if (G.boltFx.t <= 0) G.boltFx = null; }
  if ((G.stormHold || 0) > 0) G.stormHold -= dt; else if (G.storm > 0 && !G.patterns.some(p => p.kind === 'typhoon')) G.storm = Math.max(0, G.storm - dt * 1.2);   // 마이삭이 지나가면 하늘이 서서히 갬
  if (G.wowFx) { G.wowFx.t += uiDt; if (G.wowFx.t > 1.6) G.wowFx = null; }
  G.ammoPulse = Math.max(0, (G.ammoPulse || 0) - uiDt); if (G.mode === 'run') { G.omegiT = Math.max(0, (G.omegiT || 0) - uiDt); G.magnetT = Math.max(0, (G.magnetT || 0) - uiDt); } G.beatComboT = (G.beatComboT || 0) - uiDt; if (G.beatComboT <= 0) G.beatCombo = 0; Sound.setAccent((G.beatCombo || 0) >= 8);
  { const bi = Math.floor(beatNow()); if (bi !== G.lastBeatI) { G.lastBeatI = bi; G.beatPulse = 1; } G.beatPulse = Math.max(0, (G.beatPulse || 0) - uiDt * 4); } G.waterPulse = Math.max(0, (G.waterPulse || 0) - uiDt); if (G.wave) { G.wave.t += uiDt; if (G.wave.t > 0.7) G.wave = null; } G.wxPulse = Math.max(0, (G.wxPulse || 0) - uiDt);
  if (G.rapSub) G.rapSub.t += dt;
  if (G.skill) { G.skill.t += uiDt; if (G.skill.t > (G.skill.hint ? 2.6 : 1.5)) G.skill = null; }
  if (G.interp) { G.interp.t += uiDt; if (G.interp.t > 2.1) G.interp = null; }
  checkHits();
}
function updateVolcano(dt) {
  const v = G.volcano;
  v.erupt = Math.max(0, v.erupt - dt);
  v.glow = approach(v.glow, v.erupt > 0 ? 1 : G.phase >= 2.5 ? 0.45 : 0, dt * 0.8);
  if (Math.random() < dt * (v.erupt > 0 ? 14 : 2.5 + v.glow * 4)) G.bgfx.push({ x: rand(-4, 4), y: 0, vx: rand(2, 8) + G.wind * 0.1, vy: rand(-14, -8), life: rand(2.2, 3.5), max: 3, r: v.erupt > 0 ? randi(2, 3) : 1.5, gr: v.erupt > 0 ? rand(1.5, 3) : rand(0.6, 1.1), dark: v.erupt > 0, kind: 'smoke' });
  if (v.erupt > 0 && Math.random() < dt * 9) { G.bgfx.push({ x: rand(-4, 4), y: 1, vx: rand(-25, 25), vy: rand(-110, -60), grav: 60, life: 1.6, max: 1.6, kind: 'bomb' }); Sound.sfx.launch(); }
  for (const p of G.bgfx) { p.life -= dt; p.vy += (p.grav || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.kind === 'smoke') p.r += p.gr * dt; }
  G.bgfx = G.bgfx.filter(p => p.life > 0);
}
// 땅에 닿은 빗방울이 톡
function rainSplash(p) { if (p.near && Math.random() < 0.5) for (const sd of [-1, 1]) fx({ x: p.x, y: GROUND - 2, vx: sd * rand(15, 35) + p.vx * 0.1, vy: -rand(30, 60), grav: 320, life: 0.18, kind: 'px', col: 'rgba(215,228,250,0.85)' }); }
function updateFxList(dt) {
  WK.fxStep(G.fx, dt, amb.t);   // 모두 한 번에 (wasm/src/fx.rs)
  G.fx = G.fx.filter(p => p.life > 0);
  if (G.fx.length > 600) G.fx.splice(0, G.fx.length - 600);
}

function tick(dt) {
  updateAmbient(dt);
  let stepped = false;
  if (state === 'play') {
    if (!P.dead && !G.choice && !G.iris) G.t += dt;
    if (G.banners.length && !(bannerWait() && G.banners[0].t === 0)) { G.banners[0].t += dt; if (G.banners[0].t >= G.banners[0].dur) G.banners.shift(); }
    if (G.iris) {
      G.iris.t += dt;
      if (!G.iris.done && G.iris.t >= G.iris.dur / 2) { G.iris.done = true; if (G.iris.mid) G.iris.mid(); warmScenes(); }
      if (G.iris.t >= G.iris.dur) G.iris = null;
    }
    if (pressed.pause && !P.dead) setPause(true);
    else if (G.choice) {   // 강화 고르는 동안 세상은 멈춤 (점수 · 생성 · 충돌 없음)
      G.choice.t += dt; acc = 0; P.poundBuf = 0;
      if ((pressed.left && G.choice.sel !== 0) || (pressed.right && G.choice.sel !== 1)) Sound.sfx.select(); if (pressed.left) G.choice.sel = 0; if (pressed.right) G.choice.sel = 1;
      if (pressed.jump || pressed.start || pressed.throw) pickUpgrade(G.choice.sel);
      for (const k of ['left', 'right', 'jump', 'start', 'throw', 'roll', 'down']) pressed[k] = false;
      G.fx = G.fx.filter(p => (p.life -= dt) > 0);
    }
    else if (G.hitstop > 0) { G.hitstop -= dt; acc = 0; }
    else {
      let d = dt * (G.mode === 'run' ? G.speed : 1);
      if (G.slow > 0) { G.slow -= dt; d *= 0.35; }
      acc += d;
      if (G.cut) acc = 0;
      let steps = 0;
      while (acc >= STEP && state === 'play' && !G.choice && steps++ < 14) {
        G.lights.length = 0;
        updateWorld(STEP); acc -= STEP; stepped = true;
        if (G.hitstop > 0) { acc = 0; break; }
      }
      if (acc > STEP) acc = STEP;   // 느린 기기: 밀린 시간은 버림 (몰아서 돌다 더 느려지지 않게)
    }
    if (P.dead) { G.overT -= dt; if (G.overT <= 0) gameOver(); }
  } else if (state === 'title') {
    titleT += dt; titleWorld(dt);
    if (!G.go && !howto && !dexView && (pressed.left || pressed.right)) { cycleScarf(pressed.left ? -1 : 1); pressed.left = pressed.right = false; }
    if (titleT > 0.3 && !G.go && !Sound.playing && !document.hidden) Sound.startMusic({ calm: true, tempo: 100 });
    if (G.go) { G.go += dt; P.vy += GRAV * dt; P.y = Math.min(GROUND, P.y + P.vy * dt); G.iris = { t: Math.min(0.45, G.go), dur: 0.9, done: true }; if (G.go >= 0.45) { G.iris = null; startGame(); } if (pressed.mute) toggleMute(); for (const k in pressed) pressed[k] = false; return; }
    if (dexView) {   // 도감: 고르고 연습
      const n = Object.keys(PATTERNS).length;
      if (pressed.left) { dexSel = (dexSel + n - 1) % n; pressed.left = false; Sound.sfx.select(); }
      if (pressed.right) { dexSel = (dexSel + 1) % n; pressed.right = false; Sound.sfx.select(); }
      if (pressed.down) { dexSel = (dexSel + 5) % n; pressed.down = false; Sound.sfx.select(); }
      if (pressed.pause) { pressed.pause = false; dexView = false; Sound.sfx.select(); }
    }
    if (mapView) { mapView.t += dt; for (const k in pressed) pressed[k] = false; }
    if (pressed.start || pressed.jump || pressed.throw) {
      Sound.init();
      if (dexView && SEEN[Object.keys(PATTERNS)[dexSel]] && !G.go) { practiceKind = Object.keys(PATTERNS)[dexSel]; dexView = false; G.go = 0.001; P.vy = -JUMP_V; Sound.sfx.start(); }
      else if (howto === 1) { howto = 2; Sound.sfx.select(); }   // 조작법 → 게임 요소
      else if (howto || dexView) { howto = 0; dexView = false; Sound.sfx.select(); }
      else if (menuSel === 2) { howto = 1; Sound.sfx.select(); }
      else if (menuSel === 3) { dexView = true; Sound.sfx.select(); }
      else if (menuSel === 4) mapOpen();
      else if (menuSel === 5) toggleGod();
      else if (!G.go) { routeStart = menuSel === 1; G.go = 0.001; P.vy = -JUMP_V; Sound.sfx.start(); }
    }
  } else if (state === 'over') {
    G.overAge += dt; titleWorld(dt);
    if (G.overAge > 1.4 && !Sound.playing && !document.hidden && !G.go) Sound.startMusic({ calm: true, tempo: 110 });
    if (G.banners.length) { G.banners[0].t += dt; if (G.banners[0].t >= G.banners[0].dur) G.banners.shift(); }
    shareBtn.hidden = G.overAge <= 1 || !!G.go;
    if (G.go) { G.go += dt; G.iris = { t: Math.min(0.45, G.go), dur: 0.9, done: true, cx: Math.round(W / 2), cy: Math.round(H / 2) }; if (G.go >= 0.45) { G.iris = null; startGame(); } if (pressed.mute) toggleMute(); for (const k in pressed) pressed[k] = false; return; }
    if (G.overAge > 1 && !pressed.pause && (pressed.start || pressed.retry || (pressed.jump && !TOUCH.matches))) { routeStart = !!G.route; G.go = 0.001; Sound.sfx.start(); for (const k in pressed) pressed[k] = false; return; }
    if (G.overAge > 1 && pressed.pause) { releaseAll(); clearInputs(); menuSel = 0; howto = false; dexView = false; setupTitle(); }
  } else if (state === 'pause') {
    if (pressed.quit) { state = 'play'; Sound.stopMusic(); releaseAll(); clearInputs(); menuSel = 0; setupTitle(); return; }   // 처음 화면으로
    if (pressed.retry) { routeStart = !!G.route; practiceKind = G.practice || null; Sound.stopMusic(); Sound.sfx.start(); releaseAll(); clearInputs(); startGame(); return; }   // 같은 모드로 다시 하기
    if (pressed.pause || pressed.start || pressed.jump) { setPause(false); for (const k in pressed) pressed[k] = false; return; }
  }
  if (pressed.mute) toggleMute();
  // 게임 입력은 시뮬레이션 스텝이 소비할 때까지 남겨둔다 (히트스톱 · 고주사율 대응)
  for (const k in pressed) if (!(state === 'play' && GAME_KEYS.includes(k) && !stepped)) pressed[k] = false;
}

function titleWorld(dt) {
  G.trauma = Math.max(0, G.trauma - dt * 2);
  if (state === 'title' && titleT >= 0.6 && titleT - dt < 0.6) { shake(0.3); Sound.sfx.stomp(); }
  P.blinkT -= dt; if (P.blinkT < -0.12) P.blinkT = rand(1.5, 4);
  updateScarf();
  G.lights = [];
  updateVolcano(dt);
  G.fx = G.fx.filter(p => p.kind !== 'puff');
  for (const p of G.fx) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt; }
  G.fx = G.fx.filter(p => p.life > 0);
}

function setupTitle() {
  Sound.setAccent(false);
  shareBtn.hidden = true;
  useTheme('field');
  G = newWorld(); P = newPlayer(); P.x = 168; G.arenaR = W - 8 - EDGE; G.arenaL = 8 + EDGE;
  B = null;
  state = 'title'; titleT = 0;
  clearInputs();
}
function startGame() {
  Sound.init(); shareBtn.hidden = true;
  Sound.setAccent(false);
  G = newWorld(); P = newPlayer(); acc = 0; B = null; G.practice = practiceKind; practiceKind = null; if (routeStart && !G.practice) { G.route = { leg: 0, lap: 0, slot: 0, legs: ROUTE, plan: shuffled(ROUTE[0].pool).slice(0, 3) }; routeMod(); } routeStart = false;
  releaseAll(); document.querySelectorAll('.lr [data-key]').forEach(b => b._pids && b._pids.forEach(id => press(b.dataset.key, 'p' + id))); clearInputs();
  state = 'play';
  beginStage();
  G.iris = { t: 0.45, dur: 0.9, done: true };
  Sound.stopMusic(); playMusic({ style: 'chip', song: 'field', tempo: 138 });
  if (G.route) routeLegSetup();   // 일주: 구간 테마 · 속도 · 음악 맞추기
  if (G.practice && (themeCfg().ban || []).includes(G.practice)) { const th = ['coast', 'beach', 'iho', 'grove'].find(k => !((THEME_CFG[k] || {}).ban || []).includes(G.practice)); if (th) useTheme(th); }   // 연습: 그 밈이 나오는 배경으로
  G.hint = best.score < 300 ? 14 : 0;
  firstRun = false;
  ensureDaily(); G.wx = WEATHER.find(x => x.id === DAILY.wx) || WEATHER[0]; G.wxPulse = 1.2;
  if (!noDaily() && DAILY.played !== DAILY.d && !DAILY.wxDone) banner(`오늘 ${G.wx.t}`, `${G.wx.d} · 5000점이면 진주`, UI.warnHi);   // 오늘 첫 판: 날씨 효과 안내
}
function gameOver() {
  Sound.setAccent(false);
  state = 'over'; G.overAge = 0; G.banners.length = 0;
  const sc = Math.floor(G.score), newBest = !noRecord() && sc > best.score, prevBest = best.score;
  if (newBest) { best = { score: sc }; try { localStorage.setItem('jeju.best2', JSON.stringify(best)); } catch (e) { /* 무시 */ } }
  const gr = gradeOf(sc);
  // 오늘 첫 판을 끝냈을 때 연속 기록 갱신 (3 · 7 · 이후 7일마다 진주)
  ensureDaily(); let streakMsg = '';
  if (!noDaily() && DAILY.played !== DAILY.d) {
    const [yy, mm, dd] = DAILY.d.split('-').map(Number), yd = new Date(yy, mm - 1, dd - 1), yk = `${yd.getFullYear()}-${yd.getMonth() + 1}-${yd.getDate()}`;   // 판을 시작한 날 기준 어제
    DAILY.streak = DAILY.played === yk ? (DAILY.streak | 0) + 1 : 1; DAILY.played = DAILY.d;
    const bonus = DAILY.streak === 3 || DAILY.streak === 7 || (DAILY.streak > 7 && DAILY.streak % 7 === 0);
    if (bonus) DAILY.pearl = (DAILY.pearl || 0) + 1;
    streakMsg = `${DAILY.streak}일째 물질!${bonus ? ' 진주 +1' : ''}`;
  }
  if (!noRecord()) DAILY.best = Math.max(DAILY.best | 0, sc); saveDaily();
  if (G.route && !godMode) { const prog = (G.route.lap || 0) * G.route.legs.length + G.route.leg + 1; G.route.prog = prog; if (prog > routeRec.best) { G.route.newRec = true; routeRec = { best: prog }; try { localStorage.setItem('jeju.route.v3', JSON.stringify(routeRec)); } catch (e) { /* 무시 */ } } }
  G.info = { score: sc, newBest, streakMsg, killer: G.killer, rank: [0, gr[2], '#ffd84a'], grade: gr[1], phrase: pick(PHRASES), fact: jejuFact(), time: G.t, found: G.newFound || 0, prevBest };
  Sound.sfx.over();
  setTimeout(() => { if (state === 'over' && !document.hidden) Sound.startMusic({ calm: true, tempo: 110 }); }, 1400);
}
// 결과 화면을 그대로 카드로: 워터마크를 얹고 3배로 키워 공유 (안 되면 PNG 저장)
async function shareResult() {
  if (state !== 'over' || G.overAge <= 1 || G.go || !G.info || shareResult.busy) return;
  const run = G; shareResult.busy = true;
  try {
    const bs = G.banners; G.banners = []; G.shareShot = true; try { render(); } finally { G.shareShot = false; G.banners = bs; }
    const c = mk(W * 3, H * 3), x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(cv, 0, 0, W * 3, H * 3);
    const tag = mk(W, 14), g0 = g;
    try { g = tag.getContext('2d'); uiBox(0, 0, W, 14, UI.gold); uiText('제주 · ' + (location.host || 'JEJU'), W / 2, 2, { align: 'center', color: UI.sub }); } finally { g = g0; }
    x.drawImage(tag, 0, (H - 14) * 3, W * 3, 42);
    // 동기 인코딩: 탭 직후의 사용자 제스처 안에서 공유 창을 열기 위해
    const blob = new Blob([Uint8Array.from(atob(c.toDataURL('image/png').split(',')[1]), ch => ch.charCodeAt(0))], { type: 'image/png' });
    let data;
    try { const file = new File([blob], 'jeju-game.png', { type: 'image/png' }); if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) data = { files: [file], title: '제주', text: `${run.route ? `제주 일주 ${(run.route.lap || 0) + 1}바퀴 ${run.route.leg + 1}구간까지` : `${run.info.score}점 · ${run.info.grade}!`} 나보다 잘 피할 수 있수과? ${location.href.split('#')[0]}` }; } catch (_) { /* 공유 불가 → 저장 */ }
    if (data && !run.downloadOnly) {
      try { await navigator.share(data); return; }
      catch (e) { if (e?.name === 'AbortError') return; run.downloadOnly = true; if (G === run && state === 'over') banner('공유가 안 됐수다', TOUCH.matches ? '공유 버튼을 한 번 더 누르면 저장' : 'S를 한 번 더 누르면 이미지로 저장', UI.warnHi); return; }
    }
    if (G !== run || state !== 'over') return;
    const a = document.createElement('a'), url = URL.createObjectURL(blob); a.href = url; a.download = 'jeju-game.png'; document.body.appendChild(a);
    try { a.click(); banner('이미지 저장!', 'jeju-game.png', UI.gold); } finally { a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
  } catch (_) { if (state === 'over') banner('저장 실패', '다시 시도해 주세요', UI.warnHi); }
  finally { shareResult.busy = false; }
}
const shareBtn = document.getElementById('shareBtn');
shareBtn.addEventListener('click', () => { shareBtn.blur(); shareResult(); });
function setPause(on) {
  if (on && G) G.pauseFact = jejuFact();
  clearInputs();
  if (on && state === 'play') { Sound.sfx.select(); state = 'pause'; G.pauseBars = [...G.hz, ...G.spawnQ].filter(h => h instanceof BeatBar && !h.up).map(h => [h, h.beatAt - h.b]); G.pauseBeat = Sound.beat(); Sound.stopMusic(); Sound.ambience('rain', 0); }
  else if (!on && state === 'pause') {
    state = 'play'; if (G.music && !(G.cut && !G.cut.subbed)) Sound.startMusic(Object.assign({}, G.music, { fromBeat: G.pauseBeat > 0 ? G.pauseBeat : 0 }));
    // 음악은 멈춘 박에서 이어지지만, 소리가 꺼져 박자 시계가 바뀌었을 수도 있으니 아직 안 솟은 비트 막대의 박자를 맞춰 줌
    for (const [h, left] of G.pauseBars || []) if (!h.up) { const nb = h.b + left; h.b0 += nb - h.beatAt; h.beatAt = nb; }
    G.pauseBars = null;
  }
}

// ═════════════════════════════════════════════════════════════
//  그리기
// ═════════════════════════════════════════════════════════════
function disc(ctx, cx, cy, r, col) {
  ctx.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) { const dx = Math.floor(Math.sqrt(r * r - dy * dy)); ctx.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1); }
}
function drawShadow(x, w) {
  w = Math.max(3, Math.round(w));
  g.fillStyle = 'rgba(30,10,20,0.3)';
  g.fillRect(Math.round(x - w / 2), GROUND, w, 1);
  g.fillRect(Math.round(x - w / 2) + 1, GROUND + 1, w - 2, 1);
}
const _strC = new Map();
function drawStr(str, x, y, { font = 's', color = '#ffffff', outline = INK, align = 'left' } = {}) {
  const k = str + '\u0001' + font + color + outline; let e = _strC.get(k);
  if (!e) { if (_strC.size > 800) _strC.clear(); const gl = graphemes(str).map(ch => glyph(ch, font, color, outline));   /* 옛한글(아래아)은 자모 여러 개가 한 글자 */ e = { gl, total: gl.reduce((s, c) => s + c.adv, 0) }; _strC.set(k, e); }
  let cx = Math.round(align === 'right' ? x - e.total : align === 'center' ? x - e.total / 2 : x);
  for (const c of e.gl) { g.drawImage(c, cx - c.ox, Math.round(y) - c.ox); cx += c.adv; }
  return e.total;
}
// ═════════════════════════════════════════════════════════════
//  픽셀 UI 키트 — 모든 글자 · 알림이 같은 판 · 같은 글꼴 · 같은 색
//  판: 1px 먹선(모서리 깎음) + 따뜻한 짙은 바탕 + 윗줄 하이라이트 + 왼쪽 강조 띠
//  글자: 판 위 = 외곽선 없음 / 화면 위에 떠 있는 글자 = 1px 먹선
// ═════════════════════════════════════════════════════════════
const UI = {
  panel: mute('#2a2024'), hi: mute('#4a3a36'), lo: mute('#17110f'),
  text: mute('#f6ecdc'), sub: mute('#c8bcaa'), gold: C.yel[3], warn: C.red[2], warnHi: C.red[3],
  title: [C.org[0], C.org[1], C.yel[1], C.yel[2], C.yel[3]],
};
function uiBox(x, y, w, h, accent = null, stripes = null) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  g.fillStyle = INK; g.fillRect(x + 1, y, w - 2, h); g.fillRect(x, y + 1, w, h - 2);
  g.fillStyle = UI.panel; g.fillRect(x + 1, y + 1, w - 2, h - 2);
  g.fillStyle = UI.hi; g.fillRect(x + 2, y + 1, w - 4, 1);
  g.fillStyle = UI.lo; g.fillRect(x + 2, y + h - 2, w - 4, 1);
  if (h >= 28 && w >= 100) { for (let yy = y + 5; yy < y + h - 4; yy += 2) { g.fillStyle = mix(UI.panel, UI.lo, (yy - y) / h * 0.25); g.fillRect(x + 2, yy, w - 4, 2); } g.fillStyle = mix(UI.panel, UI.hi, 0.35); g.fillRect(x + 2, y + 2, w - 4, 1); g.fillStyle = mix(UI.panel, UI.hi, 0.15); g.fillRect(x + 2, y + 3, w - 4, 2); g.fillStyle = mix(UI.panel, UI.lo, 0.4); g.fillRect(x + 2, y + h - 4, w - 4, 2); }
  if (accent) { g.fillStyle = accent; g.fillRect(x + 1, y + 2, 2, h - 4); }
  if (stripes) { g.fillStyle = stripes; for (let i = x + 3; i < x + w - 3; i += 6) { g.fillRect(i, y + 1, 3, 1); g.fillRect(i + 3, y + h - 2, 3, 1); } }
}
const textW = (s, f = 's') => graphemes(s).reduce((a, ch) => a + glyph(ch, f, '#ffffff', null).adv, 0);
function uiText(str, x, y, { font = 's', color = UI.text, align = 'left' } = {}) { return drawStr(str, x, y, { font, color, outline: null, align }); }
// 큰 제목: 2배 픽셀 로고체, 늘이지 않고 위치로만 움직임
function uiTitle(str, cx, cy, ramp = UI.title) { const lg = logoText(str, 2, ramp); g.drawImage(lg, Math.round(cx - lg.width / 2), Math.round(cy - lg.height / 2)); return lg; }

function plate(x, y, w, h) { uiBox(x, y, w, h); }
// UI 키트 판에 글자를 얹은 스프라이트 (퀴즈 답 등 화면 속 물체용)
const _uiSpr = {};
function uiSprite(text, accent = UI.gold, font = 'b') {
  const key = text + accent + font; if (_uiSpr[key]) return _uiSpr[key];
  const w = textW(text, font) + 14, h = font === 'b' ? 16 : 13, c = mk(w, h), g0 = g;
  g = c.getContext('2d'); uiBox(0, 0, w, h, accent); uiText(text, w / 2 + 1, font === 'b' ? 2 : 2, { font, align: 'center' }); g = g0;
  c.bodyH = h; return (_uiSpr[key] = c);
}
function drawBanner() {
  if (G.choice || state === 'pause') return;   // 일시정지 화면 글자와 겹치지 않게 (다시 시작하면 이어서)
  const b = G.banners[0]; if (!b) return;
  if (bannerWait() && b.t === 0 && state !== 'over') return;
  const w = Math.max(textW(b.title, 'b'), b.sub ? textW(b.sub) : 0) + 22 + (b.isNew ? 20 : 0), h = b.sub ? 30 : 18;
  const k = easeBack(Math.min(1, b.t / 0.25)), out = b.t > b.dur - 0.22 ? easeOut((b.t - (b.dur - 0.22)) / 0.22) : 0;
  if (b.y == null) b.y = state === 'over' ? H - 54 : B ? 68 : 38;   // 이벤트 중엔 스킬 이름 · 피하는 법 상자 아래로
  const x = Math.round(W / 2 - w / 2 + (1 - k) * W - out * W), y = b.y;
  uiBox(x, y, w, h, b.col);
  uiText(b.title, x + w / 2 + 1, y + 3, { font: 'b', color: b.col, align: 'center' });
  if (b.sub) uiText(b.sub, x + w / 2 + 1, y + 17, { color: UI.sub, align: 'center' });
  if (b.isNew) { uiBox(x + w - 20, y - 6, 24, 12, UI.warnHi); uiText('NEW', x + w - 8, y - 5, { color: UI.warnHi, align: 'center' }); }
}
function drawMemeCard() {
  const c = G.card; if (!c) return;
  const t = c.t, k = easeBack(Math.min(1, t / 0.18)), out = t > 0.85 ? easeOut((t - 0.85) / 0.25) : 0;
  const lg = logoText(c.title, 2, UI.title), w = lg.width + 24, cy = 58 - Math.round((1 - k) * 14) - Math.round(out * 20);
  g.save(); g.globalAlpha = 1 - out;
  uiBox(Math.round(W / 2 - w / 2), cy - 12, w, lg.height + 8);
  g.drawImage(lg, Math.round(W / 2 - lg.width / 2), cy - 8);
  if (c.isNew && t > 0.15) { const nx = Math.round(W / 2 + w / 2 - 10); uiBox(nx, cy - 18, 24, 12, UI.warnHi); uiText('NEW', nx + 12, cy - 17, { color: UI.warnHi, align: 'center' }); }
  g.restore();
}
function drawWow() {
  if (G.choice) return;
  const f = G.wowFx; if (!f) return;
  const k = easeBack(Math.min(1, f.t / 0.2)), out = f.t > 1.2 ? easeOut((f.t - 1.2) / 0.4) : 0, y = 92 - Math.round((1 - k) * 10) - Math.round(out * 20);
  g.save(); g.globalAlpha = 1 - out;
  uiTitle(f.streak > 1 ? `WOW ×${f.streak}!` : 'WOW!', W / 2, y);
  drawStr(`+${f.bonus}`, W / 2, y + 14, { font: 's', color: UI.gold, align: 'center' });
  if (f.star) drawStr(`★ 도감: ${f.star}`, W / 2, y + 26, { font: 's', color: UI.gold, align: 'center' });
  g.restore();
}
// 쇼츠식 자막: 사투리(화면 위 글자) + 해석(판)
function drawRapSub() {
  const r = G.rapSub; if (!r) return;
  const dy = r.t < 0.1 ? 2 : 0;
  drawStr(r.line, W / 2, 92 + dy, { font: 'b', color: UI.text, align: 'center' });
  const s = `해석: ${r.sub}`, w = textW(s) + 12;
  uiBox(W / 2 - w / 2, 108, w, 13, UI.gold);
  uiText(s, W / 2 + 1, 110, { color: UI.sub, align: 'center' });
}
function drawInterp() {
  const I = G.interp; if (!I) return;
  const t = I.t, k = t < 0.25 ? easeOut(t / 0.25) : t > 1.8 ? 1 - easeOut((t - 1.8) / 0.25) : 1;
  const a = `"${I.text}"`, b = `= ${I.sub}`, w = Math.max(textW(a), textW(b, 'b')) + 32, h = 38, x = Math.round(6 - (1 - k) * (w + 10)), y = (G.omegiT > 0 || G.magnetT > 0) ? 56 : 36;
  uiBox(x, y, w, h, UI.warn);
  g.fillStyle = UI.sub; g.fillRect(x + 8, y + 10, 5, 9); g.fillRect(x + 7, y + 19, 7, 1); g.fillRect(x + 10, y + 20, 1, 4); g.fillRect(x + 7, y + 24, 7, 1);
  uiText('제주어 해석', x + 20, y + 3, { color: UI.sub });
  uiText(a, x + 20, y + 14, { color: UI.gold });
  uiText(b, x + 20, y + 24, { font: 'b' });
}
function drawBossSay() {
  if (!B || !B.say) return;
  const S = B.say, big = S.kind === 'big', font = big ? 'b' : 's', w = textW(S.text, font) + 14, h = big ? 17 : 14, [hx, hy] = B.headPos();
  const R = B.side < 0, pop = S.t < 0.1 ? 2 : 0, x = clamp(Math.round(R ? hx + 4 : hx - w - 4), 2, W - w - 2), y = Math.round(hy - 6 + pop);
  uiBox(x, y, w, h, big ? UI.warn : UI.gold);
  // 말꼬리: 초상 쪽으로
  if (R) { g.fillStyle = INK; g.fillRect(x - 3, y + 5, 3, 5); g.fillStyle = UI.panel; g.fillRect(x - 2, y + 6, 3, 3); }
  else { g.fillStyle = INK; g.fillRect(x + w, y + 5, 3, 5); g.fillStyle = UI.panel; g.fillRect(x + w - 1, y + 6, 3, 3); }
  uiText(S.text, x + w / 2 + 1, y + (big ? 3 : 2), { font, color: big ? UI.gold : UI.text, align: 'center' });
}
function drawStageCard() {
  if (G.mode !== 'intro' || state === 'pause') return;
  const t = G.modeT, k = easeBack(Math.min(1, t / 0.3)), out = t > 1.4 ? easeOut((t - 1.4) / 0.35) : 0;
  g.save(); g.globalAlpha = 1 - out; uiTitle(t < 0.9 ? 'READY?' : 'ᄒᆞᆫ저 피ᄒᆞᆸ서!', W / 2, 64 - Math.round((1 - k) * 14)); g.restore();
}
function drawSkillName() {
  const S = G.skill; if (!S) return;
  const t = S.t, end = S.hint ? 2.35 : 1.25, k = t < 0.15 ? easeOut(t / 0.15) : t > end ? Math.max(0, 1 - (t - end) / 0.2) : 1;
  if (k <= 0) return;
  const w = textW(S.who) + textW(S.name, 'b') + 26, x = Math.round(W / 2 - w / 2), y = Math.round(32 - (1 - k) * 8);
  g.save(); g.globalAlpha = k;
  uiBox(x, y, w, 17, UI.warn);
  const ww = uiText(S.who, x + 7, y + 4, { color: UI.sub });
  g.fillStyle = UI.hi; g.fillRect(x + 11 + ww, y + 4, 1, 9);
  uiText(S.name, x + 16 + ww, y + 3, { font: 'b', color: UI.gold });
  if (S.hint) { const hw = textW(S.hint) + 16, hx = Math.round(W / 2 - hw / 2); uiBox(hx, y + 19, hw, 14, UI.gold); uiText(S.hint, W / 2 + 1, y + 21, { color: UI.text, align: 'center' }); }   // 피하는 법
  g.restore();
}
// 삼다수 파도: 왼쪽에서 오른쪽으로 화면을 쓸고 지나가는 맑은 물 커튼
function drawChoice() {
  const c = G.choice; if (!c) return;
  const k = easeOut(Math.min(1, c.t / 0.3)), cw = 150, ch = 58, y = Math.round(78 - (1 - k) * 20);
  g.fillStyle = `rgba(23,17,15,${0.5 * k})`; g.fillRect(0, 0, W, H);
  uiText('구간 돌파 · 강화 하나 골라 봅서', W / 2, y - 18, { font: 'b', color: UI.gold, align: 'center' });
  c.opts.forEach((u, i) => {
    const x = Math.round(W / 2 + (i ? 8 : -8 - cw)), on = c.sel === i;
    uiBox(x, y + (on ? -2 : 0), cw, ch, on ? UI.gold : UI.hi);
    uiText(u.name, x + cw / 2, y + 12 + (on ? -2 : 0), { font: 'b', color: on ? UI.gold : UI.text, align: 'center' });
    uiText(u.desc, x + cw / 2, y + 32 + (on ? -2 : 0), { color: UI.sub, align: 'center' });
  });
  if (Math.floor(c.t * 2) % 2) uiText(TOUCH.matches ? '카드를 터치' : '← → 고르고 Z / Space', W / 2, y + ch + 10, { color: UI.sub, align: 'center' });
}
function drawSamdaWave() {
  if (!G.wave) return;
  const k = G.wave.t / 0.7, fx0 = Math.round(-60 + k * (W + 120));
  g.save(); g.translate(0, VOFF);
  for (let x = Math.max(0, fx0 - 70); x < Math.min(W, fx0 + 6); x++) {
    const d = fx0 - x, top = Math.round(GROUND - 150 + Math.sin(x * 0.12 + k * 10) * 4 + d * 0.6);
    g.globalAlpha = clamp(1 - d / 70, 0, 1) * 0.55;
    g.fillStyle = d < 3 ? WATER[4] : d < 10 ? WATER[3] : WATER[2]; g.fillRect(x, Math.max(-VOFF, top), 1, GROUND - Math.max(-VOFF, top));
    if (d < 4) { g.globalAlpha = 0.9; g.fillStyle = WATER[4]; g.fillRect(x, Math.max(-VOFF, top) - 2, 1, 2); }
  }
  g.restore();
}
function drawEventWarn() {
  if (!B || B.state !== 'warn') return;
  const t = B.stT, k = easeOut(Math.min(1, t / 0.18)), on = Math.floor(t * 8) % 2 === 0;
  const w = 104, x = Math.round(B.side > 0 ? W - k * (w + 6) : -w + k * (w + 6)), y = 60;
  uiBox(x, y, w, 32, on ? UI.warnHi : UI.warn, C.yel[2]);
  uiText('이벤트 발생!', x + w / 2 + 1, y + 5, { font: 'b', color: on ? UI.gold : UI.text, align: 'center' });
  uiText(EVENTS[B.key].name, x + w / 2 + 1, y + 18, { color: UI.sub, align: 'center' });
}
function layer(name, p, y = 0) {
  const ph = G.phase, a = Math.floor(ph), t = ph - a, x = -Math.round(20 * p + amb.camX * p), im = SCENES[a][name];
  if (!im.empty) g.drawImage(im, x, y + (im.oy || 0));   // oy: 하늘 위쪽까지 그린 층 (예: 화면 위를 감싸는 큰 나무) · empty: 완전히 빈 층은 건너뜀
  if (t > 0.01 && a < 3) { const im2 = SCENES[a + 1][name]; if (!im2.empty) { g.globalAlpha = t; g.drawImage(im2, x, y + (im2.oy || 0)); g.globalAlpha = 1; } }
}
function drawBackground() {
  const ph = G.phase, a = Math.floor(ph), t = ph - a;
  g.drawImage(SCENES[a].sky, 0, -VOFF);
  if (t > 0.01 && a < 3) { g.globalAlpha = t; g.drawImage(SCENES[a + 1].sky, 0, -VOFF); g.globalAlpha = 1; }
  const cfg = themeCfg(), indoor = !!cfg.indoor;
  if (ph > 2.2 && !indoor) for (let i = 0; i < 40; i++) if (Math.sin(amb.t * 2 + i) > -0.2 && !(cfg.starBox && ((i * 97) % W < cfg.starBox[0] || (i * 97) % W > cfg.starBox[1] || (i * 53) % (70 + VOFF) - VOFF > cfg.starBox[2]))) {   /* 그림 배경은 트인 하늘에만 별 */ g.fillStyle = `rgba(255,240,220,${clamp((ph - 2.2) / 0.8, 0, 1)})`; g.fillRect((i * 97) % W, (i * 53) % (70 + VOFF) - VOFF, 1, 1); }
  // 새떼 (가끔 하늘을 가로지름)
  const bt = (amb.t * 0.06) % 1.6;
  if (bt < 1 && ph < 2.6 && !indoor) for (let i = 0; i < 5; i++) {
    const bx = Math.round(-30 + bt * (W + 60) + (i % 2) * 6 + i * 7), by = Math.round(30 + Math.abs(i - 2) * 3 + Math.sin(amb.t * 2 + i) * 1.5), up = Math.floor(amb.t * 6 + i) % 2;
    g.fillStyle = ph > 1.5 ? '#3a2a40' : '#5a6070'; g.fillRect(bx - 2, by - up, 2, 1); g.fillRect(bx + 1, by - up, 2, 1); g.fillRect(bx, by, 1, 1);
  }
  const ci = Math.round(ph);
  if (!indoor) {
    const wid = G && G.wx && G.wx.id;
    if (wid === 'bloom') for (let i = 0; i < 16; i++) { const px = Math.round((i * 73 + amb.t * (20 + i % 5 * 4)) % (W + 20)) - 10, py = Math.round(((i * 41 + amb.t * (14 + i % 3 * 3)) % 190) - VOFF + Math.sin(amb.t * 2 + i) * 4); g.fillStyle = i % 3 ? C.yel[2] : C.yel[3]; g.fillRect(px, py, 2, 1); }
    if (wid === 'harvest') for (let i = 0; i < 6; i++) { const px = Math.round((i * 97 + amb.t * 16) % (W + 20)) - 10, py = Math.round(((i * 53 + amb.t * 22) % 190) - VOFF); g.fillStyle = i % 2 ? C.leaf[2] : C.org[2]; g.fillRect(px, py, 2, 1); }
    if (wid === 'flight') { const ft = (amb.t % 14) / 14, hz = PHASES[Math.round(G.phase)].haze; for (let i = 0; i < 4; i++) { const fxp = Math.round(-20 + ft * (W + 40) - i * 9), fyp = -VOFF + 30 + (i % 2) * 4 + Math.round(Math.sin(amb.t * 3 + i) * 1.5), up = Math.floor(amb.t * 10 + i) % 2; g.fillStyle = mix('#6a4a38', hz, 0.45); g.fillRect(fxp, fyp, 2, 1); g.fillRect(fxp - 1, fyp - up, 1, 1); g.fillRect(fxp + 2, fyp - up, 1, 1); } }   // 멀리 날아가는 참새 떼
  }
  if (!indoor && !cfg.noClouds) for (const c of amb.clouds) g.drawImage(CLOUDS[ci][c.k], Math.round(c.x - amb.camX * 0.04), Math.round(c.y));
  layer('halla', LAYER_P.hall);
  drawVolcano();
  layer('oreum', LAYER_P.oreum);
  // 행원 풍력발전기 (오름 능선 위에서 천천히 회전)
  if (cfg.mills) {
    const off = -Math.round(20 * LAYER_P.oreum + amb.camX * LAYER_P.oreum);
    // 실제 풍력단지(구좌 행원 · 성산읍 등)처럼 해안가 낮은 오름 · 들판에만 (한라산 · 일출봉 위에는 없음)
    const MILLS = THEME === 'coast' ? [[18, 101, 0.8], [40, 103, 0.7], [62, 104, 0.6]] : [[34, 97, 0.9], [56, 100, 0.75], [356, 94, 0.9], [382, 93, 0.8]];
    for (const [tx, ty, sz] of MILLS) {
      const x0 = tx + off, h = Math.round(16 * sz), hz = PHASES[Math.round(G.phase)].haze, col = G.phase > 2.5 ? '#5a5268' : mix(mix('#d8dade', actorTint(), 0.6), hz, 0.45), shade = G.phase > 2.5 ? '#3e3850' : mix(mix('#a8acb6', actorTint(), 0.6), hz, 0.45);   // 먼 거리 연무에 묻히게
      g.fillStyle = shade; g.fillRect(x0, ty - h, 1, h); g.fillStyle = col; g.fillRect(x0 - 1, ty - h, 1, h);
      const a0 = amb.t * 0.9 + tx;
      for (let b = 0; b < 3; b++) { const a = a0 + b * 2.094, L = 7 * sz; for (let k = 1; k <= L; k++) { g.fillStyle = col; g.fillRect(Math.round(x0 + Math.cos(a) * k), Math.round(ty - h + Math.sin(a) * k), 1, 1); } }
      g.fillStyle = shade; g.fillRect(x0 - 1, ty - h - 1, 2, 2);
    }
  }
  drawFalls('sky', 0);
  drawFalls('oreum', LAYER_P.oreum);
  layer('field', LAYER_P.field);
  drawFalls('field', LAYER_P.field);
  if (THEME === 'cave') drawCaveFx();
  if (cfg.sea) for (let i = 0; i < 14; i++) { const sx = (i * 53) % W, sy = 106 + (i * 11) % 30; if (Math.sin(amb.t * 4 + i * 1.7) > 0.6) { g.fillStyle = FOAM(); g.globalAlpha = 0.8; g.fillRect(sx, sy, 2, 1); g.globalAlpha = 1; } }
  layer('near', LAYER_P.near);
  // 해안: 밀려왔다 쓸려가는 파도 거품
  if (cfg.foam) {
    const nx = -Math.round(20 * LAYER_P.near + amb.camX * LAYER_P.near), wv = Math.sin(amb.t * 1.3) * 3;
    for (let i = 0; i < W + 20; i += 2) {
      const y = 137 + Math.round(Math.sin((i + amb.t * 18) * 0.12) * 1.2 + wv * 0.3);
      const fm = SCENES[Math.floor(G.phase)].near.foamMask; const fi = i + (nx % 2) - nx; if (fm && (fm[fi % fm.length] || fm[(fi + 1) % fm.length])) continue;
      if (Math.sin(i * 0.31 + amb.t * 2) > -0.2) { g.fillStyle = FOAM(); g.globalAlpha = 0.85; g.fillRect(i + (nx % 2), y, 2, 1); g.globalAlpha = 1; }
    }
  }
  drawStorm();   // 태풍: 먹구름 · 어두운 색조 · 번개 (등장물 아래)
}
// 폭포: 구워 둔 물줄기 위로 흘러내리는 물결 · 아래 물보라를 덧그림
function drawFalls(name, p) {
  const fl = SCENES[Math.floor(G.phase)][name].falls; if (!fl) return;
  const off = -Math.round(20 * p + amb.camX * p);
  for (const f of fl) {
    if (f.w) {
      const x0 = f.x + off, len = f.y1 - f.y0; g.globalAlpha = f.a ?? 1;
      for (let k = 0; k < f.w * 1.2; k++) {
        const lane = (k * 7) % f.w, sp = 60 + (k % 5) * 14, y = f.y0 + ((amb.t * sp + k * 37) % len), l = 3 + (k % 3) * 2;
        g.fillStyle = k % 3 ? 'rgba(255,255,255,0.75)' : 'rgba(200,226,236,0.7)'; g.fillRect(x0 + lane, Math.round(y), 1, Math.min(l, f.y1 - y));
      }
      g.globalAlpha = 1;
    }
    if (f.foam) drawFoamFx(f.foam, off);
  }
}
// 폭포 발치 물거품: 숨 쉬듯 부푸는 거품 덩이 · 포물선으로 튀는 물방울 · 물 위로 퍼져 나가는 거품 줄 (시간대 색에 맞춤)
function drawFoamFx(fo, off) {
  const cx = fo.x + off, cy = fo.y, w = fo.w, t = amb.t, hi = FOAM(), lo = mix(FOAM(), '#8cb4cc', 0.45);
  for (let k = 0; k < 7; k++) {
    const u = k / 6 * 2 - 1, ph = t * 3.2 + k * 1.7, r = Math.max(2, Math.round(w * (0.15 + 0.045 * Math.sin(ph)) * (1.15 - Math.abs(u) * 0.45)));
    const px = Math.round(cx + u * w * 0.9 + Math.sin(ph * 0.6) * 1.5), py = Math.round(cy - (1 - u * u) * w * 0.28 - r * 0.4 - (Math.sin(ph * 1.3) + 1) * 1.2);
    for (let dy = -r; dy <= r; dy++) { const hw = Math.round(Math.sqrt(r * r - dy * dy)); if (hw <= 0) continue; g.fillStyle = dy > r * 0.45 ? lo : hi; g.fillRect(px - hw, py + dy, hw * 2 + 1, 1); }
  }
  g.fillStyle = hi;
  for (let k = 0; k < 16; k++) { const P = 0.75 + (k % 5) * 0.12, tt = ((t + k * 0.29) % P) / P, ang = -Math.PI / 2 + ((k * 0.618) % 1 - 0.5) * 2.4, sp = w * (1.1 + (k % 3) * 0.35), sz = k % 4 ? 1 : 2; g.fillRect(Math.round(cx + Math.cos(ang) * sp * tt), Math.round(cy - w * 0.15 + Math.sin(ang) * sp * 1.3 * tt + tt * tt * w * 1.6), sz, sz); }
  if (fo.water) for (let k = 0; k < 12; k++) { const tt = (t * 0.35 + k / 12) % 1, side = k % 2 ? 1 : -1, len = Math.max(1, Math.round((1 - tt) * 5)); g.globalAlpha = 1 - tt; g.fillRect(Math.round(cx + side * (w * 0.6 + tt * w * 1.9)) - (side < 0 ? len : 0), Math.round(cy + 2 + (k % 4) * 2 + tt * 2), len, 1); }
  g.globalAlpha = 1;
}
// 만장굴: 천장 구멍 빛줄기 속을 떠도는 먼지 · 용암 종유에서 떨어지는 물방울
function drawCaveFx() {
  const fl = SCENES[Math.floor(G.phase)].field, sh = fl.shaft; if (!sh) return;
  const off = -Math.round(20 * LAYER_P.field + amb.camX * LAYER_P.field), t = amb.t;
  g.fillStyle = fl.shaftCol || '#eef6ea';
  for (let k = 0; k < 24; k++) { const s2 = (t * (0.012 + (k % 3) * 0.006) + k * 0.137) % 1, y = sh.y0 + (sh.y1 - sh.y0) * s2, L = sh.l0 + (sh.l1 - sh.l0) * s2, Rr = sh.r0 + (sh.r1 - sh.r0) * s2, u = 0.15 + ((k * 0.618) % 1) * 0.7 + Math.sin(t * 0.6 + k) * 0.05; g.globalAlpha = 0.35 + 0.5 * Math.sin(t * 1.6 + k * 1.7) ** 2; g.fillRect(Math.round(L + (Rr - L) * u + off), Math.round(y), 1, 1); }
  g.globalAlpha = 1;
  for (const [dx, dy, ph, land] of fl.drips || []) {
    const tt = (t + ph) % 3.1, fall = Math.sqrt(2 * (land - dy) / 240);
    if (tt < fall) { g.fillStyle = '#a8c4d4'; g.fillRect(Math.round(dx + off), Math.round(dy + 120 * tt * tt), 1, 2); }
    else if (tt < fall + 0.14) { const k = (tt - fall) / 0.14; g.fillStyle = '#c8dce4'; g.fillRect(Math.round(dx + off - 1 - k * 2), Math.round(land - k * 2), 1, 1); g.fillRect(Math.round(dx + off + 1 + k * 2), Math.round(land - k * 2), 1, 1); }
  }
}
function drawVolcano() {
  if (!themeCfg().volcano) return;
  const hl = (SCENES[Math.floor(G.phase)] || SCENES[0]).halla; if (!hl || !Number.isFinite(hl.cx)) return; const vx = -Math.round(20 * LAYER_P.hall + amb.camX * LAYER_P.hall) + hl.cx, vy = 60;
  for (const p of G.bgfx) {
    const x = Math.round(vx + p.x), y = Math.round(vy + p.y);
    if (p.kind === 'smoke') {
      const k = p.life / p.max, r = Math.max(2, Math.round(p.r * (1.6 - k * 0.6)));
      const hz = PHASES[Math.round(G.phase)].haze, base = p.dark ? '#4a3a44' : mix(mix('#c8ccd4', actorTint(), 0.6), hz, 0.35);
      g.save(); g.globalAlpha = (p.dark ? 0.75 : 0.5) * Math.min(1, k * 2.5);
      disc(g, x, y, r, base);
      if (r >= 3) disc(g, x - 1, y - 1, r - 2, mix(base, '#ffffff', 0.18));
      g.restore();
    } else { g.fillStyle = C.yel[3]; g.fillRect(x, y, 1, 2); g.fillStyle = C.org[2]; g.fillRect(x, y + 2, 1, 1); light(x, y, 6, '#ff9040', 0.6); }
  }
  const glow = G.volcano.glow;
  if (glow <= 0.02) return;
  const flick = Math.floor(amb.t * 10) % 2;
  g.fillStyle = '#ff4a1a'; g.fillRect(vx - 6, vy + 1, 13, 1);
  g.fillStyle = flick ? C.yel[3] : C.org[3]; g.fillRect(vx - 4, vy + 1, 9, 1);
  light(vx, vy, 30 + glow * 20, '#ff6020', glow);
  // 용암: 산 위쪽 곳곳에서 여러 줄기가 산비탈을 타고 아래로 흘러내림 (능선만 따라 옆으로 번지지 않게)
  //  · 시작점은 분화구 둘레와 윗비탈에 흩어져 있고, 줄기는 아래로 내려가며 바깥쪽으로 살짝 휨 · 머리는 노랗게, 꼬리는 식어 검붉게
  const LAVA = [[-6, -0.1, 1.0, 0], [6, 0.1, 1.0, 1.1], [-18, -0.22, 0.9, 2.2], [17, 0.2, 0.95, 3.3], [-32, -0.3, 0.85, 4.1], [30, 0.3, 0.85, 5.2], [-48, -0.35, 0.75, 0.7], [46, 0.36, 0.8, 1.9], [-2, -0.05, 1.1, 2.9], [24, 0.15, 1.05, 3.8]];
  for (const [ox, drift, len, ph] of LAVA) {
    const L = Math.round((26 + 30 * len) * glow * (0.7 + 0.3 * Math.sin(ph * 2.3)));
    const x0 = hl.cx + ox, y0 = hallaTop(x0, hl.cx) + 1;
    for (let k = 0; k < L; k++) {
      const dx = Math.round(ox + drift * k + Math.sin(k * 0.27 + ph) * 1.4), yy = Math.max(hallaTop(hl.cx + dx, hl.cx) + 1, y0 + k), heat = k / Math.max(1, L);
      g.fillStyle = heat < 0.2 ? C.yel[3] : heat < 0.55 ? C.org[3] : heat < 0.85 ? '#c83a18' : '#5a2418'; g.fillRect(vx + dx, yy, 1, 1);
      if (heat < 0.7) { g.fillStyle = heat < 0.35 ? C.org[3] : '#a83218'; g.fillRect(vx + dx + 1, yy, 1, 1); }
      if (k % 9 === 0 && heat < 0.6) light(vx + dx, yy, 8, '#ff6020', 0.35 * glow);
    }
    if (L > 4 && Math.floor(amb.t * 5 + ph) % 2) { const k = L - 1, dx = Math.round(ox + drift * k + Math.sin(k * 0.27 + ph) * 1.4), yy = Math.max(hallaTop(hl.cx + dx, hl.cx) + 1, y0 + k); g.fillStyle = C.yel[3]; g.fillRect(vx + dx, yy, 2, 1); }   // 흘러내리는 머리가 깜빡
  }
  light(vx, vy + 20, 60 * glow, '#ff5020', 0.45 * glow);   // 산 전체가 붉게 달아오름
}

function drawPlayer() {
  if (P.inv > 0 && !P.dead && P.hurtT <= 0 && Math.floor(P.inv * 16) % 2) return;
  const f = curFrame(), ball = P.rollT > 0 || P.flipT > 0;
  if (!P.dead) drawShadow(P.x, clamp(13 - (GROUND - P.y) / 6, 4, 13));
  if (P.shield && !P.dead) { for (let a = 0; a < 6.28; a += 0.45) { const ax = Math.round(P.x + Math.cos(a + amb.t * 2) * 12), ay = Math.round(P.y - 12 + Math.sin(a + amb.t * 2) * 14); g.fillStyle = (Math.round(a / 0.45) % 2) ? C.org[3] : C.org[2]; g.fillRect(ax, ay, 1, 1); } }
  if (!ball && !P.dead) { drawScarf(); if (P.tw) g.drawImage(TEWAK_BACK, Math.round(P.tw.x - 9), Math.round(P.tw.y - 10)); }
  const img = P.hurtT > 0.3 ? silOf(f) : f;
  if (P.dead) {
    g.save(); g.translate(Math.round(P.x), Math.round(P.y - 16)); g.rotate(Math.round(P.spin / (Math.PI / 2)) * (Math.PI / 2));
    g.drawImage(img, -f.ax, -f.ay + 16); g.restore(); return;
  }
  g.drawImage(img, Math.round(P.x - f.ax), Math.round(P.y - f.ay));
}

function drawFx() {
  for (const p of G.fx) {
    const x = Math.round(p.x), y = Math.round(p.y), k = p.life / p.max;
    switch (p.kind) {
      case 'streak': g.fillStyle = p.col; if (p.rain) g.fillRect(x, y, 1, 4); else g.fillRect(x, y, p.len, 1); break;
      case 'rain': { const m = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / m, uy = p.vy / m; g.fillStyle = p.col; for (let i = 0; i < p.len; i++) g.fillRect(Math.round(p.x - ux * i), Math.round(p.y - uy * i), 1, 1); break; }   // 바람 따라 비스듬한 빗줄기
      case 'ring': {
        const r = Math.round((p.big ? 8 : 3) + (1 - k) * (p.big ? 50 : 18)), n = 12 + r * 2;
        g.fillStyle = p.col;
        for (let a = 0; a < n; a++) { const t = a / n * Math.PI * 2; g.fillRect(x + Math.round(Math.cos(t) * r), y + Math.round(Math.sin(t) * r * 0.5), 1, 1); }
        break;
      }
      case 'puff': { const s = PUFFS[clamp(Math.round(k * 3) + p.size - 1, 0, 4)]; g.save(); g.globalAlpha *= Math.min(1, k * 4); g.drawImage(s, x - (s.width >> 1), y - (s.height >> 1)); g.restore(); break; }
      case 'smoke': { const s = SMOKE[clamp(Math.round((1 - k) * 3) + p.size, 0, 4)]; g.drawImage(s, x - (s.width >> 1), y - (s.height >> 1)); break; }
      case 'spark': { const s = SPARK[clamp(2 - Math.floor(k * 3), 0, 2)]; g.drawImage(s, x - 3, y - 3); break; }
      case 'chunk': g.fillStyle = p.col; g.fillRect(x, y, p.size + 1, p.size); break;
      case 'flare': { const L = Math.max(1, Math.round(p.size * k)); g.fillStyle = p.col; g.fillRect(x - L, y, L * 2 + 1, 1); g.fillRect(x, y - L, 1, L * 2 + 1); if (L > 2) { g.fillStyle = '#fff4e0'; g.fillRect(x - 1, y - 1, 3, 3); } break; }
      case 'trail': { const m = Math.hypot(p.vx, p.vy) || 1, ux = -p.vx / m, uy = -p.vy / m; for (let i = 0; i < 4; i++) { g.fillStyle = i < 2 ? p.col : p.col2; g.fillRect(Math.round(x + ux * i), Math.round(y + uy * i), 1, 1); } break; }
      case 'ember': { g.fillStyle = k > 0.66 ? C.yel[3] : k > 0.33 ? C.org[3] : C.wood[2]; g.fillRect(x, y, 1, 1); break; }
      case 'glyph': { const s = textSprite(p.ch, { font: 'b', color: '#2a1a2a', outline: '#ffffff' }); if (k > 0.3 || Math.floor(p.life * 20) % 2) g.drawImage(s, x, y); break; }
      default: g.fillStyle = p.col; g.fillRect(x, y, p.size, p.size);
    }
  }
}

const _lightTex = {};
function lightTex(col) {
  if (_lightTex[col]) return _lightTex[col];
  const c = mk(64, 64), x = c.getContext('2d'), [r, gg, b] = rgb(col), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${r},${gg},${b},0.55)`); gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  return (_lightTex[col] = c);
}
function drawLights() {
  if (!G.lights.length) return;
  const night = clamp(G.phase / 3, 0, 1);
  lg.clearRect(0, 0, W, H);
  lg.globalCompositeOperation = 'lighter';
  for (const L of G.lights) {
    if (L.r <= 0) continue;
    lg.globalAlpha = clamp(L.a, 0, 1);
    lg.drawImage(lightTex(L.col), Math.round(L.x - L.r), Math.round(L.y - L.r + VOFF), Math.round(L.r * 2), Math.round(L.r * 2));
  }
  lg.globalAlpha = 1;
  lg.globalCompositeOperation = 'source-over';
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.35 + night * 0.6;
  g.drawImage(lightCv, 0, -VOFF);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
}

const _panelCache = {};
const panelOf = (w, h) => _panelCache[`${w}x${h}`] || (_panelCache[`${w}x${h}`] = (() => { const c = mk(w, h), g0 = g; g = c.getContext('2d'); uiBox(0, 0, w, h); g = g0; return c; })());

function drawWarnings() {
  { const b = G.hz.find(h => h instanceof Bee); if (b) { g.globalAlpha = 0.4; for (let x = 2; x < W; x += 6) { const y = Math.round(GROUND - 24 + Math.sin(x * 0.045 + b.ph) * 14); g.fillStyle = C.red[3]; g.fillRect(x, y, 3, 1); } g.globalAlpha = 1; } }
  for (const w of G.warnings) {
    // 무엇이 오는지 땅에 미리: 렌터카는 헤드라이트 빛 띠, 캐리어는 바퀴 자국, 흑돼지는 흙먼지 발자국
    { const k = clamp(w.t / w.dur, 0, 1), d = w.side < 0 ? 1 : -1, ex = w.side < 0 ? 0 : W, reach = Math.round(30 + 110 * k);
      // 공통: 땅 위로 밀려오는 굵은 경고 점선 (먹 받침 + 붉은/노란 깜빡) — 멀리서도 잘 보이게
      if (w.ph === undefined) { const on = Math.floor(w.t * 12) % 2; for (let i = 0; i < reach; i += 6) { const xx = d > 0 ? ex + i : ex - i - 4; g.fillStyle = INK; g.fillRect(xx - 1, GROUND - 2, 6, 4); g.fillStyle = on ? C.yel[3] : C.red[3]; g.fillRect(xx, GROUND - 1, 4, 2); } }
      if (w.kind === 'car') { g.save(); g.globalAlpha = 0.25 + 0.35 * k; g.fillStyle = C.yel[3]; for (const yy of [GROUND - 6, GROUND - 3]) g.fillRect(d > 0 ? ex : ex - reach, yy, reach, 1); g.restore(); light(ex + d * 20, GROUND - 5, 26 + 20 * k, '#fff0b0', 0.5 * k); }
      else if (w.kind === 'case') { g.fillStyle = INK; for (let i = 0; i < reach; i += 6) { const xx = ex + d * i; g.fillRect(xx, GROUND + 1, 2, 1); g.fillRect(xx + d * 3, GROUND - 0, 1, 1); } }
      else if (w.kind === 'pig') { if (Math.random() < 0.3) fx({ x: ex + d * rand(2, 20), y: GROUND - 1, vx: d * rand(10, 40), vy: -rand(10, 30), drag: 2, life: 0.4, kind: 'puff', size: randi(0, 1) }); g.fillStyle = C.soil[1]; for (let i = 10; i < reach; i += 9) { const xx = ex + d * i; g.fillRect(xx, GROUND + 1 + ((i / 9) % 2), 2, 1); } } }
    // 벌떼가 지나갈 물결길 미리보기 (노란 꽃에 묻히지 않게 어두운 받침 + 빨간 점선)
    if (w.ph !== undefined) for (let x = 2; x < W; x += 6) { const y = Math.round(GROUND - 24 + Math.sin(x * 0.045 + w.ph) * 14); g.fillStyle = INK; g.fillRect(x - 1, y - 1, 5, 3); g.fillStyle = C.red[3]; g.fillRect(x, y, 3, 1); }
    { const k = w.t / w.dur, d = w.side < 0 ? 1 : -1, bx = w.side < 0 ? 22 : W - 23; for (let i = 0; i < 3; i++) { const lit = k > i / 3, cx = bx + d * i * 5, cy = GROUND - 19; g.fillStyle = INK; for (let j = 0; j < 3; j++) g.fillRect(cx + d * j - 1, cy - 2 + j - 1, 3, 5 - 2 * j + 2); g.fillStyle = lit ? (k > 0.66 && Math.floor(w.t * 16) % 2 ? C.yel[3] : C.red[3]) : UI.lo; for (let j = 0; j < 3; j++) g.fillRect(cx + d * j, cy - 2 + j, 1, 5 - 2 * j); } }
    if (Math.floor(w.t * 10) % 2) continue;
    const x = w.side < 0 ? 4 : W - 18, y = GROUND - 36;
    g.drawImage(panelOf(14, 14, 'dark'), x, y);
    const t = textSprite('!', { font: 'b', color: UI.warnHi, outline: null });
    g.drawImage(t, x + 7 - (t.width >> 1), y + 2);
  }
}

// 반투명 HUD 판 (모서리 깎은 사각형 + 윗선 하이라이트)

function bar(x, y, w, h, k, lag, col, hi, back = UI.lo) {
  g.fillStyle = INK; g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = back; g.fillRect(x, y, w, h);
  if (lag > k) { g.fillStyle = '#ffffff'; g.fillRect(x, y, Math.round(w * lag), h); }
  g.fillStyle = col; g.fillRect(x, y, Math.round(w * k), h);
  g.fillStyle = hi; g.fillRect(x, y, Math.round(w * k), 1);
  g.fillStyle = UI.lo; g.fillRect(x, y + h - 1, Math.round(w * k), 1);
}

// 특보 아이콘 10x10: 태풍 소용돌이 · 귤 · 참새 · 캐리어 · 유채꽃
const WX_ICON = {};
function wxIcon(id) { return WX_ICON[id] || (WX_ICON[id] = WK.wx(id)); }
function drawHUD() {
  // 높이 뛴 숨비가 점수판 밑에 오면 점수판을 살짝 비침
  const hudFade = P && !P.dead && P.y + VOFF - 26 < 36 ? 0.45 : 1; g.save(); g.globalAlpha = hudFade;
  drawHUDInner();
  g.restore();
}
function drawHUDInner() {
  // 왼쪽 위: 체력 · 귤
  plate(3, 3, 12 + G.maxHp * 11, 29);
  if (godMode) { let gx = 3 + 12 + G.maxHp * 11 + 3, gy = 3; if (gx > 118) { gx = 22; gy = 34; } uiBox(gx, gy, 30, 14, UI.gold); uiText('무적', gx + 16, gy + 2, { color: UI.gold, align: 'center' }); }
  for (let i = 0; i < G.maxHp; i++) {
    const beat = G.hp === 1 && i === 0 && Math.floor(amb.t * 4) % 2;
    g.drawImage(i < G.hp ? HEART : HEART_EMPTY, 6 + i * 11, 5 - (beat ? 1 : 0));
  }
  g.drawImage(TANGERINE, 6, 17 - (G.ammoPulse > 0.12 ? 1 : 0));
  if (P.shield) { let sx = 3 + 12 + G.maxHp * 11 + 3 + (godMode ? 33 : 0), sy = 3; if (sx > 133) { sx = 3; sy = 34; } uiBox(sx, sy, 16, 16); g.drawImage(TEWAK[0], sx + 2, sy + 2); }   // 하트가 많으면 아래 줄로
  if (G.waterSeen) for (let i = 0; i < 3; i++) g.drawImage(i < (G.water || 0) ? DROP.on : DROP.off, 51 + i * 6, 19 - (G.waterPulse > 0 && i === G.water - 1 ? 1 : 0));
  const full = G.ammo >= G.ammoMax, empty = G.ammo === 0;
  uiText(`${G.ammo}/${G.ammoMax}`, 17, 18, { color: empty ? UI.warnHi : full ? UI.gold : UI.text });
  // 구르기 게이지 (실제 쿨타임 기준)
  if (P.rollCD > 0 || P.rollT > 0) {
    const max = P.rollCDMax || ROLL_CD, k = P.rollT > 0 ? 0 : 1 - clamp(P.rollCD / max, 0, 1);
    bar(6, 29, 40, 1, k, 0, C.teal[3], C.teal[4]);
  }
  // 오른쪽 위: 점수 · 콤보 (화면 위에 겹친 소리 · 전체화면 단추만큼 왼쪽으로)
  g.save(); g.translate(-HUD_R, 0);
  const sc = String(Math.floor(G.score)).padStart(7, '0');
  if (G.wx) { const ic = wxIcon(G.wx.id), py = 5 - (G.wxPulse > 0 && Math.floor(G.wxPulse * 10) % 2 ? 1 : 0); uiBox(W - 100, 3, 14, 14, DAILY.wxDone ? UI.gold : UI.warnHi); g.drawImage(ic, W - 97, py); }
  const tall = false;   // 점수판은 한 줄로 (위쪽을 덜 붐비게)
  plate(W - 84, 3, 81, tall ? 26 : 16);
  uiText('SCORE', W - 80, 6, { color: UI.sub });
  uiText(G.score >= 1e6 ? String(Math.floor(G.score)) : sc.slice(-6), W - 6, 5, { align: 'right' });   // 100만 점이 넘으면 다 보이게
  if (G.combo >= 2) {
    const s = 1;
    const t = textSprite(`${G.combo} COMBO`, { font: 'b', color: G.combo >= 10 ? C.red[3] : C.yel[2], shadow: true });
    const cy = tall ? 31 : 22;
    g.drawImage(t, Math.round(W - 5 - t.width * s), cy, Math.round(t.width * s), Math.round(t.height * s));
    const k = clamp(G.comboT / 2.6, 0, 1);
    g.fillStyle = UI.gold; g.fillRect(Math.round(W - 5 - t.width * k), cy + t.height * s + 1, Math.round(t.width * k), 1);
  }
  g.restore();
  const pauseIcon = () => { if (TOUCH.matches) { const px = Math.max(W / 2 + 80, (G.plateR || 0) + 9);   /* 가운데 판(지역 이름) 바로 오른쪽 빈자리 — 이름과 겹치지 않게 */ uiBox(px - 7, 3, 14, 14); g.fillStyle = UI.text; g.fillRect(px - 3, 7, 2, 6); g.fillRect(px + 1, 7, 2, 6); } };
  // 박자 표시: 한 마디 네 칸, 지금 박이 깜빡
  drawMetronome = () => { const bi = Math.floor(beatNow()) % 4; for (let i = 0; i < 4; i++) { const on = i === bi, x0 = W / 2 - 17 + i * 9; g.fillStyle = INK; g.fillRect(x0, 24, 8, 4); g.fillStyle = on ? (i === 0 ? C.yel[3] : C.teal[3]) : UI.hi; g.fillRect(x0 + 1, 25, 6, 2); if (on && G.beatPulse > 0.5) { g.fillStyle = '#fff4e0'; g.fillRect(x0 + 1, 25, 6, 1); } } }
  // 가운데: 배속 · 지역 · 다음 단계까지
  if (G.mode === 'run' || G.mode === 'intro') {
    const T = TIERS[G.tier], N = TIERS[G.tier + 1], spd = `×${G.speed.toFixed(2)}`, nm = G.practice ? '연습 · ' + (DEX_NAME[G.practice] || G.practice) : G.route ? `${G.route.legs[G.route.leg].name} ${Math.min(4, G.route.slot)}/4` : (G.spotName || T.name);
    const bw = clamp(textW(spd) + textW(nm) + 10, 112, 150), x = Math.round(W / 2 - bw / 2), y = 14; G.plateR = x + bw + 8;   // 이름이 길면 판이 넓어짐 (일시정지 단추는 그 오른쪽)
    plate(x - 8, 3, bw + 16, 18);
    drawStr(spd, x - 4, 4, { font: 's', color: C.yel[2], outline: null });
    drawStr(fitText(nm, bw + 3 - textW(spd)), x + bw + 4, 4, { font: 's', color: G.practice ? UI.gold : '#ffffff', align: 'right', outline: null });
    const k = N ? clamp((G.score - T.score) / (N.score - T.score), 0, 1) : 1;
    bar(x, y + 1, bw, 2, k, 0, C.org[2], C.org[4]);
  }
  pauseIcon();   // 가운데 판보다 위에
  // 켜져 있는 아이템 효과: 아이콘 + 남은 시간 막대
  { let ix = godMode && 3 + 12 + G.maxHp * 11 + 3 > 118 ? 56 : 40; for (const [t, max, img] of [[G.omegiT, 6, OMEGI], [G.magnetT, 8, PINWHEEL[Math.floor(amb.t * 10) % 2]]]) { if (!(t > 0)) continue; uiBox(ix, 34, 18, 18); g.drawImage(img, Math.round(ix + 9 - img.width / 2), Math.round(43 - img.height / 2)); g.fillStyle = UI.gold; g.fillRect(ix + 2, 50, Math.round(14 * t / max), 1); ix += 20; } }
}

// 칸보다 긴 글은 끝을 줄임표로 (자주 그리는 글이라 결과를 기억)
const FIT_MEMO = new Map();
function fitText(s, maxW, f = 's') {
  const key = s + '|' + maxW + '|' + f; let r = FIT_MEMO.get(key); if (r != null) return r;
  r = s; if (textW(s, f) > maxW) { const gs = graphemes(s); while (gs.length > 1 && textW(gs.join('') + '…', f) > maxW) gs.pop(); r = gs.join('') + '…'; }
  if (FIT_MEMO.size > 300) FIT_MEMO.clear(); FIT_MEMO.set(key, r); return r;
}
// ── 보스 등장 컷신: 밈처럼 "훅" 들어왔다 빠지는 2초짜리 정지 화면 ─────

// 쇼츠식 자막: 사투리 + (해석) — 뭐랭하맨 해석 쇼츠 오마주

// 제주어 해석 쇼츠 (얼굴 없는 해설 카드)

function drawMapView() {   // 명소 구경: 배경만 보이게 · 아래에 장소 이름 · 시간대 · 이야기
  const m = mapView, [, nm] = PLACES[m.i], k = easeOut(clamp(m.t / 0.3, 0, 1));
  uiBox(W / 2 - 150, 6 - Math.round((1 - k) * 20), 300, 20, UI.gold);
  uiText(`◀  ${nm}  ·  ${PHASE_NAME[m.ph]}  ▶`, W / 2, 10 - Math.round((1 - k) * 20), { font: 'b', color: UI.gold, align: 'center' });
  uiBox(W / 2 - 170, H - 38, 340, 32);
  uiText(m.fact || "", W / 2, H - 34, { color: UI.text, align: 'center' });
  uiText(TOUCH.matches ? '좌우 끝 터치: 장소 · 가운데: 시간대 · 위아래: 나가기' : '◀▶ 장소 바꾸기 · ▲▼ 시간대 · Esc 나가기', W / 2, H - 20, { color: UI.sub, align: 'center' });
}
let menuW = 112;
const MENU_DESC = [() => '단계마다 빨라지는 기본 모드 · 최고 점수 도전', () => '명소 8구간 · 구간마다 이벤트와 강화 · 기록 따로', () => '조작 · 게임 요소 설명', () => '만난 밈 모아 보기 · 골라서 연습', () => '배경만 천천히 둘러보기', () => godMode ? '무적: 안 죽지만 기록 · 물질이 안 남아요' : '켜면 안 죽지만 기록 · 물질이 안 남아요'];
function drawTitle() {
  if (mapView) { drawMapView(); return; }
  // 위쪽 어둡게 (로고 가독성)
  const gr = g.createLinearGradient(0, 0, 0, 110);
  gr.addColorStop(0, 'rgba(23,17,15,0.55)'); gr.addColorStop(1, 'rgba(23,17,15,0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, 110);
  const bob = Math.round(Math.sin(titleT * 1.6) * 1.5), k = easeBack(titleT / 0.6);
  const logo = logoText('제주', 3, [C.org[0], C.org[1], C.org[2], C.org[3], C.yel[3]]);
  const lx = Math.round(98 - logo.width / 2), ly = 18 + bob - Math.round((1 - k) * 60);
  g.drawImage(logo, lx, ly);
  g.drawImage(TANGERINE, lx + logo.width - 16, ly + 4 + Math.round(Math.sin(titleT * 3) * 2));
  // 부제: 리본 대신 얇은 금줄 사이 한 줄
  const ry = ly + logo.height - 2, sub = '섬 끝까지, 버텨 봅서', sw = textW(sub, 's'), ga = clamp((titleT - 0.35) / 0.4, 0, 1);
  g.save(); g.globalAlpha = ga;
  for (const sd of [-1, 1]) { const x0 = 98 + sd * (sw / 2 + 5), len = 22; g.fillStyle = INK; g.fillRect(sd < 0 ? x0 - len : x0, ry + 6, len, 1); g.fillStyle = C.yel[2]; g.fillRect(sd < 0 ? x0 - len : x0, ry + 5, len, 1); g.fillRect(x0 + sd * (len + 2) - 1, ry + 4, 3, 3); g.fillStyle = C.yel[3]; g.fillRect(x0 + sd * (len + 2), ry + 5, 1, 1); }
  drawStr(sub, 99, ry + 1, { font: 's', color: INK, align: 'center' }); drawStr(sub, 98, ry, { font: 's', color: '#f4ecdc', align: 'center' });
  g.restore();
  // 메뉴
  if (!howto && !dexView) {
    const items = ['게임 시작', `제주 일주${routeRec.best ? ' · ' + routeRec.best + '구간' : ''}`, '조작법', '용어 도감', '명소 구경', `무적 ${godMode ? 'ON' : 'OFF'}`];
    const mw = menuW = Math.max(112, 20 + Math.max(...items.map(it => textW('▶ ' + it, 'b'))));
    items.forEach((it, i) => {
      if (titleT < 0.6 + i * 0.08) return;
      const y = 106 + i * 14, sel = i === menuSel;
      if (sel) uiBox(50, y - 3, mw, 16, UI.gold);
      drawStr((sel ? '▶ ' : '   ') + it, 62 + (sel ? Math.floor(titleT * 4) % 2 : 0), y, { font: 'b', color: sel ? UI.gold : UI.text });
    });
    {
      // 오늘의 물질 판 (타이틀 오른쪽)
      ensureDaily(); const pin = easeOut(clamp((titleT - 0.7) / 0.35, 0, 1)), bx = W - 158 + Math.round((1 - pin) * 170), by = 64, wx = todayWx();
      uiBox(bx, by - 18, 152, 16, UI.warnHi); if (Math.floor(titleT / 3) % 2 && wx.d) uiText(fitText(wx.d, 138), bx + 8, by - 15, { color: UI.text });   /* 날씨 효과 설명과 번갈아 */ else { const stk = DAILY.streak > 0 ? `연속 ${DAILY.streak}일` : ''; uiText(fitText(`오늘 ${wx.t}${DAILY.wxDone ? ' ✓' : ''}`, 132 - (stk ? textW(stk) + 6 : 0)), bx + 8, by - 15, { color: UI.gold }); if (stk) uiText(stk, bx + 146, by - 15, { color: UI.text, align: 'right' }); }
      uiBox(bx, by, 152, 76, UI.gold);
      uiText('오늘의 물질', bx + 8, by + 3, { font: 'b', color: UI.gold }); uiText(`진주 ${DAILY.pearl || 0}`, bx + 146, by + 5, { color: UI.text, align: 'right' });   // 오늘 최고 점수는 왼쪽 아래 BEST 판으로 (길어지면 제목과 겹쳐서)
      DAILY.m.forEach((mid, i) => {
        const M = MISSIONS.find(q => q.id === mid); if (!M) return; const y = by + 20 + i * 13, done = DAILY.p[i] >= M.n;
        uiText((done ? '✓ ' : '· ') + M.t, bx + 8, y, { color: done ? UI.sub : UI.text });
        uiText(`${DAILY.p[i]}/${M.n}`, bx + 146, y, { color: done ? UI.gold : UI.sub, align: 'right' });
      });
      // 스카프: ←→ 또는 이 줄을 눌러 바꾸기, 다음 색까지 남은 진주
      const sc = SCARVES[clamp(DAILY.scarf | 0, 0, SCARVES.length - 1)], nx = SCARVES.find(q => q.cost > (DAILY.pearl || 0));
      g.fillStyle = UI.hi; g.fillRect(bx + 6, by + 60, 140, 1);
      g.fillStyle = mute(sc.c); g.fillRect(bx + 8, by + 64, 6, 6);
      const scL = SCARVES.filter(q => q.cost <= (DAILY.pearl || 0)).length > 1 ? `◀ ${sc.n} ▶` : sc.n;
      uiText(scL, bx + 18, by + 62, { color: UI.text });
      uiText(nx ? fitText(`${nx.n}까지 진주 ${nx.cost - (DAILY.pearl || 0)}`, 146 - 24 - textW(scL)) : '스카프 모두 열림!', bx + 146, by + 62, { color: UI.sub, align: 'right' });   // 다음 스카프까지 남은 진주
    }
    if (titleT > 0.9) {
      const lines = [best.score > 0 && [`BEST ${best.score}`, UI.gold], DAILY.best > 0 && [`오늘 ${DAILY.best}`, UI.text], [`도감 ${dexCount()}/${Object.keys(PATTERNS).length} · ★${starCount()}`, UI.text]].filter(Boolean);
      uiBox(50, 190, 96, 4 + lines.length * 12);
      lines.forEach(([t, c], i) => uiText(t, 98, 193 + i * 12, { color: c, align: 'center' }));
    }
  }
  if ((Sound.running || Sound.muted) && titleT > 0.9 && !howto && !dexView && MENU_DESC[menuSel]) drawStr(MENU_DESC[menuSel](), 300, H - 14, { font: 's', color: UI.sub, align: 'center' });   // 고른 메뉴 설명
  // 브라우저가 첫 입력 전까지 소리를 막음 → 소리가 켜지는 방법을 알려 줌
  if (!Sound.running && !Sound.muted && titleT > 0.8 && !howto && !dexView) drawStr(TOUCH.matches ? '화면을 누르면 소리가 켜져요' : '아무 키나 누르면 소리가 켜져요', 300, H - 14, { font: 's', color: Math.floor(titleT * 1.5) % 2 ? UI.text : UI.sub, align: 'center' });
  if (howto) drawHowto();
  if (dexView) drawDex();
}
// 도감 칸에 들어가는 짧은 이름
const DEX_NAME = { rise: '돌하르방', hop: '꼬마 하르방', suitcase: '캐리어', harvest: '감귤 따기', gull: '갈매기', car: '렌터카', pony: '조랑말', pig: '흑돼지', meteor: '화산탄', wind: '삼다도 바람', typhoon: '태풍', quiz: '제주어 퀴즈', halmang: '사투리 할머니', murang: '뭐랭하멘', plane: '참새 떼', parcel: '귤 택배', bee: '유채꽃 벌떼', glider: '패러글라이딩', dolphin: '남방큰돌고래', crow: '까마귀 떼', dialect: '제주어 비', seolmun: '설문대할망', knife: '칼 든 하르방' };
// 도감 아래 설명 줄: 이름 — 피하는 법 (이벤트 · 퀴즈는 어떤 공격이 나오는지)
const DEX_INFO = { quiz: '제주어 퀴즈 — 뜻이 맞는 쪽으로 걸어가면 정답', halmang: '사투리 할머니 — 솟는 글자 · 귤밭 폭격 · 태풍 마이삭', murang: '뭐랭하멘 — 조작 반전 · 구독 폭격 · 해석 레이저', seolmun: '설문대할망 — 폭포 · 오름 · 주상절리 · 치마폭 파도', knife: '칼 든 하르방 — 칼바람 · 난도질 · 칼 던지기' };
const dexInfo = k => DEX_INFO[k] || `${PATTERNS[k].title} — ${PATTERNS[k].sub}`;
// 용어 도감: 만난 밈은 이름, 맞지 않고 통과한 밈은 금테 + ★
function drawDex() {
  g.fillStyle = 'rgba(23,17,15,0.75)'; g.fillRect(0, 0, W, H);
  const keys = Object.keys(PATTERNS), total = keys.length;
  uiBox(6, 6, W - 12, H - 12);
  uiText(`용어 도감  ${dexCount()}/${total}   ★ ${starCount()}/${total}`, W / 2, 12, { font: 'b', color: UI.gold, align: 'center' });
  keys.forEach((k, i) => {
    const c = i % 5, r = Math.floor(i / 5), x = 13 + c * 80, y = 26 + r * 36, seen = SEEN[k], star = SEEN[k] === 2;
    uiBox(x, y, 77, 33, i === dexSel ? UI.gold : star ? UI.gold : seen ? UI.hi : null);
    if (i === dexSel) { g.fillStyle = Math.floor(titleT * 4) % 2 ? UI.gold : UI.warnHi; g.fillRect(x - 1, y - 1, 79, 1); g.fillRect(x - 1, y + 33, 79, 1); g.fillRect(x - 1, y, 1, 33); g.fillRect(x + 77, y, 1, 33); }   // 고른 칸: 금테
    const def = PATTERNS[k], name = seen ? (DEX_NAME[k] || (def.title || '').replace(/[!~]/g, '')) : '???';
    uiText(name, x + 39, y + 5, { color: seen ? UI.text : UI.sub, align: 'center' });
    uiText(star ? (k === 'quiz' ? '★ 정답' : '★ 무피격') : seen ? '☆ 도전!' : '아직 못 만남', x + 39, y + 18, { color: star ? UI.gold : UI.sub, align: 'center' });
  });
  const next = Math.floor(starCount() / 5) * 5 + 5, sk = keys[dexSel];
  uiText(fitText(SEEN[sk] ? dexInfo(sk) : `아직 못 만남 · 별 ${next}개 모으면 진주 +1`, W - 28), W / 2, H - 31, { color: SEEN[sk] ? UI.text : UI.sub, align: 'center' });   // 고른 칸: 이름 — 피하는 법
  uiText(SEEN[sk] ? (TOUCH.matches ? '한 번 더 누르면 연습 · 맨 아래를 누르면 닫기' : '← → ↑ ↓ 고르기 · Space 연습 · Esc 닫기') : (TOUCH.matches ? '만난 용어만 연습 · 맨 아래를 누르면 닫기' : '만난 용어만 연습할 수 있음 · Esc 닫기'), W / 2, H - 19, { color: UI.sub, align: 'center' });
}
function drawHowto() {
  g.fillStyle = 'rgba(23,17,15,0.7)'; g.fillRect(0, 0, W, H);
  const pw = 394, ph = 152, px = Math.round(W / 2 - pw / 2), py = 22, p2 = howto === 2;
  uiBox(px, py, pw, ph, UI.gold);
  drawStr(p2 ? '게임 요소 (2/2)' : '조작법 (1/2)', W / 2, py + 8, { font: 'b', color: C.yel[2], align: 'center' });
  const touch = TOUCH.matches;
  const rows = p2 ? HOWTO2 : touch
    ? [['◀ ▶', '이동'], ['▲ 점프', '공중에서 두 번 더 (3단)'], ['↻ 구르기', '무적 회피 (몸통 통과) · 공중에서도'], ['▼', '공중에서 내려찍기 · 땅에선 구르기'], ['귤 던지기', '꾹 누르면 연사 · 아이템 맞히면 먹음'], ['밟기', '하르방 · 썩은 귤 머리를 밟아 와장창'], ['위쪽 터치', '일시정지']]
    : [['← →', '이동'], ['Z / Space', '점프 · 공중에서 두 번 더 (3단)'], ['X / Shift', '구르기 (무적, 몸통 통과)'], ['↓ / S', '공중에서 내려찍기 (충격파)'], ['C', '귤 던지기 (꾹 = 연사 · 아이템 맞히면 먹음)'], ['밟기', '하르방 · 썩은 귤 머리를 밟아 와장창'], ['P', '일시정지']];
  rows.forEach(([a, b], i) => {
    const y = py + 26 + i * 16;
    uiText(a, px + 14, y, { font: 'b', color: UI.gold });
    uiText(b, px + 86, y + 1, { color: UI.text });
  });
  if (Math.floor(titleT * 2) % 2) drawStr(p2 ? (touch ? '터치해서 돌아가기' : '스페이스로 돌아가기') : (touch ? '터치하면 다음 쪽 (게임 요소)' : '스페이스: 다음 쪽 (게임 요소)'), W / 2, py + ph - 14, { font: 's', color: C.yel[3], align: 'center' });
}
const HOWTO2 = [['체력 ♥', '맞으면 -1 · 단계를 넘거나 이벤트를 버티면 +1'], ['귤', '던질 귤 수 · 떨어지는 귤을 주워서 채워요'], ['물방울', '삼다수 3병을 모으면 삼다수 파도가 앞을 쓸어요'], ['WOW', '한 패턴을 안 맞고 넘기면 보너스 · 이어지면 더 커요'], ['아슬', '스치듯 아슬아슬 피하면 +50점'], ['박자', '박자에 맞춰 점프 · 구르기 · 밟기 = 박자 콤보'], ['진주', '물질 · 별 5개 · 특보 5000점으로 모아 스카프']];

function drawOver() {
  const k = clamp(G.overAge / 0.4, 0, 1);
  g.fillStyle = `rgba(23,17,15,${0.6 * k})`; g.fillRect(0, 0, W, H);
  if (G.overAge < 0.15) return;
  const I = G.info, pw = 280, ph = 112, px = Math.round(W / 2 - pw / 2), py = 52 + Math.round((1 - easeOut(G.overAge / 0.4)) * 30);
  g.drawImage(panelOf(pw, ph, 'paper'), px, py);
  const logo = logoText('폭싹 속았수다!', 2, [C.red[1], C.red[2], C.org[2], C.org[3], C.yel[3]]);
  g.drawImage(logo, Math.round(W / 2 - logo.width / 2), py - 42);
  const ink = { font: 's', color: UI.text, outline: null };
  if (G.route) { const base = `제주 일주 ${(G.route.lap || 0) + 1}바퀴 ${G.route.leg + 1}구간 ${G.route.legs[G.route.leg].name}까지${G.route.newRec ? ' · 신기록' : ''}`, full = I.killer ? base + ' · ' + I.killer : base; drawStr(fitText(textW(full) <= pw - 16 ? full : base, pw - 16), W / 2, py + 7, { ...ink, color: G.route.newRec ? UI.gold : UI.warnHi, align: 'center' }); }   // 길면 마지막 공격은 빼고
  else if (I.killer) drawStr(`마지막 공격: ${I.killer}`, W / 2, py + 7, { ...ink, color: I.killer ? UI.warnHi : UI.sub, align: 'center' });
  const gl = logoText(I.grade, I.grade.length > 2 ? 1 : 2, [C.red[1], C.red[2], C.org[2], C.yel[2], C.yel[3]]);
  const gk = easeBack(clamp((G.overAge - 0.4) / 0.3, 0, 1)), gcx = px + 36, gcy = py + 36;
  if (gk > 0.5) g.drawImage(gl, Math.round(gcx - gl.width / 2), Math.round(gcy - gl.height / 2 - (1 - gk) * 8));
  drawStr('SCORE', px + 70, py + 19, { font: 's', color: UI.sub, outline: null });
  drawStr(String(I.score), px + 104, py + 18, { font: 'b', color: UI.gold, outline: null });
  if (I.newBest) { const w = textW('NEW BEST!') + 12, bx = px + pw - w - 8; uiBox(bx, py - 7, w, 13, UI.warnHi); uiText('NEW BEST!', bx + w / 2 + 1, py - 5, { color: Math.floor(G.overAge * 3) % 2 ? UI.gold : UI.text, align: 'center' }); }
  drawStr(fitText([`${Math.floor(I.time)}초`, G.wow ? `WOW ${G.wow}${(G.bestWowStreak || 0) > 1 ? `(연속 ×${G.bestWowStreak})` : ''}` : '', G.nears ? `아슬 ${G.nears}` : '', `×${G.speed.toFixed(2)}`].filter(Boolean).join(' · '), pw - 78), px + 70, py + 34, { ...ink, color: UI.sub });   // 0인 기록은 빼고
  const lab = textSprite('칭호', ink), rx = Math.round(px + 70);
  g.drawImage(lab, rx, py + 53);
  { const cw = textW(I.rank[1], 'b') + 12; uiBox(rx + lab.width + 5, py + 48, cw, 16, UI.gold); uiText(I.rank[1], rx + lab.width + 5 + cw / 2 + 1, py + 50, { font: 'b', color: UI.gold, align: 'center' }); }
  g.fillStyle = UI.lo; g.fillRect(px + 8, py + 70, pw - 16, 26);
  drawStr('제주 한 줄', px + 12, py + 72, { font: 's', color: UI.sub, outline: null });
  drawStr(I.found ? `새 용어 +${I.found} · 도감 ${dexCount()}/${Object.keys(PATTERNS).length}` : `도감 ${dexCount()}/${Object.keys(PATTERNS).length}`, px + pw - 10, py + 72, { font: 's', color: I.found ? UI.gold : UI.sub, outline: null, align: 'right' });
  { const next = GRADES.find(q => q[0] > I.score), close = !I.newBest && I.prevBest > 0 && I.score >= I.prevBest * 0.85;
    const mi = DAILY.m.map((id, i) => ({ M: MISSIONS.find(q => q.id === id), p: DAILY.p[i] })).filter(o => o.M && o.p < o.M.n && o.p > 0).sort((a, b) => b.p / b.M.n - a.p / a.M.n)[0];
    drawStr(close ? `아깝수다! 최고까지 ${I.prevBest - I.score}점 모자람` : mi ? `${mi.M.t} ${mi.p}/${mi.M.n} · 진주까지 조금!` : next ? `다음 등급 「${next[2]}」까지 ${next[0] - I.score}점!` : '최고 등급! 이제 최고점 도전', W / 2, py + ph + 6, { font: 's', color: UI.gold, align: 'center' }); }
  drawStr(I.fact, W / 2, py + 84, { ...ink, align: 'center' });
  if (G.overAge > 1 && !G.shareShot) {
    const touch = TOUCH.matches;
    drawStr(touch ? '터치해서 다시 하기' : 'R · 스페이스로 다시 하기', W / 2, py + ph - 13, { ...ink, color: Math.floor(G.overAge * 2) % 2 ? UI.gold : UI.text, align: 'center' });
    drawStr(touch ? '여기를 터치하면 제목으로 · 오른쪽 위 버튼으로 공유' : 'Esc · 제목으로   S · 결과 공유', W / 2, H - 13, { font: 's', color: UI.sub, align: 'center' });
    { const tw = tomorrowWx(), left = DAILY.m.filter((m, i) => DAILY.p[i] < (MISSIONS.find(q => q.id === m) || { n: 0 }).n).length;
      uiBox(4, H - 60, 150, 40, UI.gold);
      uiText(left ? `오늘의 물질 ${3 - left}/3 · 진주 ${DAILY.pearl | 0}` : `물질 완료! · 진주 ${DAILY.pearl | 0}`, 10, H - 57);
      uiText(I.streakMsg || `연속 ${DAILY.streak | 0}일 · 오늘 최고 ${DAILY.best | 0}`, 10, H - 45, { color: I.streakMsg && Math.floor(G.overAge * 3) % 2 ? UI.gold : UI.text });
      if (tw) uiText(`내일 날씨: ${tw.t}`, 10, H - 33, { color: UI.gold }); }
  }
}

function drawIris() {
  const I = G.iris; if (!I || state === 'pause') return;
  const half = I.dur / 2, k = I.t < half ? 1 - I.t / half : (I.t - half) / half;
  const cx = I.cx != null ? I.cx : Math.round(P.x), cy = I.cy != null ? I.cy : Math.round(P.y - 14 + VOFF), r = Math.ceil((Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + 2) * Math.max(0, easeOut(k)));
  g.fillStyle = INK;
  for (let y = 0; y < H; y++) {
    const d = y - cy; if (Math.abs(d) >= r) { g.fillRect(0, y, W, 1); continue; }
    const q = Math.floor(Math.sqrt(r * r - d * d)), l = clamp(cx - q, 0, W), rr = clamp(cx + q + 1, 0, W);
    g.fillRect(0, y, l, 1); g.fillRect(rr, y, W - rr, 1);
  }
}

function render() {
  g = MAIN_G; g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.setTransform(1, 0, 0, 1, 0, 0);
  if (state === 'loading') {
    g.fillStyle = INK; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 3; i++) { g.fillStyle = Math.floor(amb.t * 6) % 3 === i ? C.org[3] : C.org[1]; g.fillRect(W / 2 - 10 + i * 8, H / 2, 4, 4); }
    return;
  }
  const lightsBase = G.lights.length;
  // 흔들림도 2px 칸 단위로 (이벤트 초상 · 배경과 같은 격자)
  const tr = state === 'pause' ? 0 : G.trauma * G.trauma, kx = state === 'pause' || !G.kick ? 0 : G.kick.x, ky = state === 'pause' || !G.kick ? 0 : G.kick.y, ox = Math.round(rand(-1, 1) * tr * 3 + kx), oy = Math.round(rand(-1, 1) * tr * 2 + ky);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = INK; g.fillRect(0, 0, W, H);
  g.setTransform(1, 0, 0, 1, ox, oy + VOFF);
  drawBackground();
  layer('ground', 1, GROUND - 3);
  for (const d of G.decals) {
    const a = 1 - d.t / d.life;
    if (d.mark) { if (Math.floor(d.t * 12) % 2) { g.fillStyle = '#9aaa58'; g.fillRect(d.x - 5, GROUND, 11, 1); g.fillRect(d.x - 3, GROUND + 1, 7, 1); } continue; }
    g.fillStyle = `rgba(30,12,12,${0.55 * a})`; g.fillRect(d.x - 12, GROUND, 25, 2); g.fillRect(d.x - 9, GROUND - 1, 19, 1);
  }
  for (const h of G.hz) if (h.drawDecal) h.drawDecal();
  // 세상 전체를 이벤트 픽셀 사진과 같은 2px 칸으로 (글자 · HUD는 읽히도록 1px 유지)
  if (PIXEL2.bg) chunk2(cv, false);
  const front = h => h instanceof Gull || h instanceof Bubble || h instanceof Meteor || h instanceof Pebble;
  const isText = h => h instanceof Bubble || h.isText;
  ACT_G.setTransform(1, 0, 0, 1, 0, 0); ACT_G.clearRect(0, 0, W, H); ACT_G.setTransform(1, 0, 0, 1, ox, oy + VOFF);
  ACT_G.imageSmoothingEnabled = false; g = ACT_G;
  if (B) B.draw();
  for (const h of G.hz) if (!front(h) && !isText(h)) h.draw();
  for (const p of G.pickups) p.draw();
  for (const gh of G.ghosts) { g.globalAlpha = gh.life / 0.22 * 0.5; g.drawImage(silOf(gh.img, gh.col), Math.round(gh.x - gh.img.ax), Math.round(gh.y - gh.img.ay)); g.globalAlpha = 1; }
  drawPlayer();
  for (const s of G.shots) s.draw();
  for (const h of G.hz) if (front(h) && !isText(h)) h.draw();
  if (PIXEL2.act) chunk2(ACT_C);
  if (B && B.drawOverlay) B.drawOverlay();
  for (const h of G.hz) if (isText(h)) h.draw();
  if (G.answers) for (const a of G.answers) if (!a.dead) a.draw();
  drawFx();
  drawBossSay();
  g = MAIN_G;
  const tint = actorTint();
  if (tint !== '#ffffff') {
    ACT_MG.globalCompositeOperation = 'copy'; ACT_MG.drawImage(ACT_C, 0, 0); ACT_MG.globalCompositeOperation = 'source-over';
    ACT_G.setTransform(1, 0, 0, 1, 0, 0);
    ACT_G.globalCompositeOperation = 'multiply'; ACT_G.fillStyle = tint; ACT_G.fillRect(0, 0, W, H);
    ACT_G.globalCompositeOperation = 'destination-in'; ACT_G.drawImage(ACT_M, 0, 0);
    ACT_G.globalCompositeOperation = 'source-over';
  }
  if (themeCfg().indoor) {   // 동굴: 어두운 벽에서도 박쥐 · 낙석 · 짐가방이 보이게 모든 등장물 둘레에 등불빛 테 (1px)
    RIM_G.globalCompositeOperation = 'copy'; RIM_G.drawImage(ACT_C, 0, 0); RIM_G.globalCompositeOperation = 'source-in'; RIM_G.fillStyle = '#e8cfa6'; RIM_G.fillRect(0, 0, W, H); RIM_G.globalCompositeOperation = 'source-over';
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 0.5; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.drawImage(RIM_C, dx, dy); g.restore();
  }
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(ACT_C, 0, 0); g.restore();
  for (const p of G.pops) {
    if (p.t > 0.75) continue;
    drawStr(p.str, p.x, p.y - easeOut(Math.min(1, p.t / 0.5)) * (p.big ? 16 : 10), { font: p.font, color: p.col, align: 'center' });
  }
  if (P.confuseT > 0 && Math.floor(P.confuseT * 6) % 2 === 0) drawStr('?', P.x, P.y - 34, { font: 'b', color: C.yel[3], align: 'center' });
  drawLights();
  G.lights.length = lightsBase;
  layer('front', LAYER_P.front, VIEW_H - 30);
  contrastPass(cv);
  if (G.dark > 0 && G.lightning <= 0) {
    g.globalAlpha = G.dark; g.drawImage(DARK_TEX, Math.round(P.x - DARK_TEX.width / 2), Math.round(P.y - 14 - DARK_TEX.height / 2)); g.globalAlpha = 1;
  } else if (G.lightning > 0) { g.fillStyle = 'rgba(220,230,255,0.25)'; g.fillRect(-10, -VOFF - 10, W + 20, H + 20); }
  { const lb = G.lights.length; drawWarnings(); G.lights.length = lb; }   // 태풍 어둠 위에 (여기서 생긴 빛은 쌓이지 않게 버림)
  if (G.edgeQ && G.edgeQ.length) { edgeChev.flush = true; for (const [d, y, c] of G.edgeQ) edgeChev(d, y, c); edgeChev.flush = false; G.edgeQ.length = 0; }

  g.setTransform(1, 0, 0, 1, 0, 0);
  // 사진 같은 색감: 중간 톤을 따뜻하게 한 번 물들여 배경 · 인물 · 이벤트 초상을 한 장의 그림으로
  g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.28; g.fillStyle = '#d8a478'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  g.drawImage(VIGNETTE, 0, 0);
  if (G.flash > 0) { g.fillStyle = G.flashCol; g.globalAlpha = Math.min(0.45, G.flash * 6); g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  if (state === 'play' || state === 'pause') {
    drawSamdaWave(); drawHUD(); drawBanner(); drawChoice(); drawStageCard(); drawMemeCard(); drawWow(); drawRapSub(); drawInterp(); drawEventWarn(); drawSkillName(); if (state === 'play' && !G.choice && !G.cut && !G.iris) { g.save(); g.globalAlpha = P && !P.dead && P.y + VOFF - 26 < 36 ? 0.45 : 1; drawMetronome(); g.restore(); }
    if (G.hint > 0 && state === 'play' && G.mode === 'run' && !G.cut) {
      const touch = TOUCH.matches;
      drawStr((touch ? '◀▶ 이동 · ▲ 점프(3단) · ↻ 구르기 · 귤 던지기' : '←→ 이동 · Z 점프(3단) · X 구르기 · C 귤'), W / 2, H - 14, { font: 's', align: 'center' });
    }
  }
  if (state === 'title') drawTitle();
  if (state === 'over') { drawOver(); drawBanner(); }
  if (state === 'pause') {
    g.fillStyle = 'rgba(23,17,15,0.55)'; g.fillRect(0, 0, W, H);
    const t = logoText('일시정지', 2, [C.teal[1], C.teal[2], C.teal[3], C.teal[4], '#ffffff']);
    g.drawImage(t, Math.round(W / 2 - t.width / 2), 56);
    { const hx = Math.round(W / 2), hy = H - 30; uiBox(hx - 11, hy - 9, 22, 20); g.fillStyle = UI.text; for (let k = 0; k < 5; k++) g.fillRect(hx - k, hy - 4 + k, k * 2 + 1, 1); g.fillRect(hx - 4, hy + 1, 9, 5); g.fillStyle = UI.panel; g.fillRect(hx - 1, hy + 3, 3, 3); }   // 집: 제목으로 (R 키 또는 터치)
    if (Math.floor(amb.t * 2) % 2) drawStr('▶', W / 2, 106, { font: 'b', color: C.yel[3], align: 'center' });
    { G.pauseFact = G.pauseFact || jejuFact(); const w = textW(G.pauseFact) + 16; uiBox(Math.round(W / 2 - w / 2), 124, w, 28, UI.gold); uiText('제주 한 줄', W / 2, 127, { color: UI.gold, align: 'center' }); uiText(G.pauseFact, W / 2, 139, { align: 'center' }); }
    drawStr(TOUCH.matches ? '화면을 누르면 계속 · 아래 집 = 처음 화면 (이번 판 끝)' : 'P · Space 계속 · R 다시 하기 · Q 처음 화면', W / 2, 162, { font: 's', color: UI.sub, align: 'center' });
  }
  drawIris();
}

// ═════════════════════════════════════════════════════════════
//  화면 맞춤 · UI
// ═════════════════════════════════════════════════════════════
function fit() {
  const box = document.getElementById('stageBox');
  const cs = getComputedStyle(box), padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight), padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const fixedH = cs.flexGrow === '0', mainH = document.getElementById('main').clientHeight - (document.querySelector('.pad').offsetHeight || 0) - 28;
  const bw = box.clientWidth - padX, bh = (fixedH ? mainH : box.clientHeight) - padY;
  // 꽉 채움: 폭을 창 비율에 맞춰 뒀으니 남는 건 짝수 맞춤 오차뿐 → 그만큼은 넘치게 (안 보이게 잘림) · 비율이 크게 다르면(세로 화면 · 판 도중 창 변경) 맞춤
  const fitS = Math.min(bw / W, bh / H), coverS = Math.max(bw / W, bh / H), s = coverS / fitS < 1.04 ? coverS : fitS;
  cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px';
  // 터치 가로: 화면 위에 겹친 양옆 버튼 묶음이 가리는 폭 (게임 칸 단위)
  let edge = 0;
  if (TOUCH.matches && innerWidth > innerHeight) {
    const c = cv.getBoundingClientRect(), l = document.querySelector('.pad-l').getBoundingClientRect(), r = document.querySelector('.pad-r').getBoundingClientRect();
    edge = Math.max(0, Math.ceil(Math.max(l.right - c.left, c.right - r.left) / s));
  }
  // 소리 · 전체화면 단추가 겹치는 오른쪽 위 폭 (점수판을 그만큼 비켜 그림)
  const sb = document.querySelector('.sysbar').getBoundingClientRect(), cr = cv.getBoundingClientRect();
  HUD_R = sb.width && sb.top < cr.top + 20 * s ? Math.max(0, Math.ceil((cr.right - sb.left) / s) + 1) : 0;
  if (edge !== EDGE) { EDGE = edge; if (G && !B) { G.arenaL = 8 + EDGE; G.arenaR = W - 8 - EDGE; } }
  // 처음 화면에서 창 비율이 바뀌면 폭을 다시 정하려고 새로 고침 (판 도중엔 그대로)
  clearTimeout(fit.re); if (viewW() !== W && (state === 'title' || state === 'loading') && !(G && G.go)) fit.re = setTimeout(() => {
    if (viewW() === W || state !== 'title') return;
    let last = 0; try { last = +sessionStorage.getItem('jeju.refit') || 0; sessionStorage.setItem('jeju.refit', Date.now()); } catch (_) { /* 저장소 사용 불가 */ }
    if (Date.now() - last > 5000) location.reload();   // 연달아 새로 고침되지 않게
  }, 600);
}
let EDGE = 0, HUD_R = 0;
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', () => { if (state === 'play' && P && !P.dead) setPause(true); setTimeout(fit, 200); });
if (window.ResizeObserver) new ResizeObserver(fit).observe(document.getElementById('stageBox'));

const muteBtn = document.getElementById('muteBtn');
function syncMute() { muteBtn.setAttribute('aria-pressed', String(!Sound.muted)); }
function toggleMute() { Sound.setMuted(!Sound.muted); syncMute(); }
muteBtn.addEventListener('click', () => { Sound.init(); toggleMute(); muteBtn.blur(); });
const fsBtn = document.getElementById('fsBtn'), appEl = document.getElementById('app');
if (!(appEl.requestFullscreen || appEl.webkitRequestFullscreen)) fsBtn.hidden = true;
fsBtn.addEventListener('click', async () => {
  fsBtn.blur();
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else { await (appEl.requestFullscreen || appEl.webkitRequestFullscreen).call(appEl); if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); }
  } catch (e) { /* 전체화면 불가 */ }
  setTimeout(fit, 150);
});
document.addEventListener('fullscreenchange', () => setTimeout(fit, 100));

let last = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
  requestAnimationFrame(frame);
  try { if (state === 'loading') amb.t += dt; else tick(dt); render(); frame.err = 0; }
  catch (e) {
    const L = window.__errs = window.__errs || []; if (L.length < 50) L.push(String(e && e.stack || e)); console.error(e);
    if ((frame.err = (frame.err || 0) + 1) > 30) { frame.err = 0; try { g = MAIN_G; releaseAll(); clearInputs(); setupTitle(); } catch (_) { /* 무시 */ } }
  }
}
(async function boot() {
  fit(); syncMute(); Sound.init();   // 소리 장치는 로딩 중에 미리 (브라우저가 막으면 첫 입력 때 깨어남)
  requestAnimationFrame(frame);
  const fonts = Promise.all(['12px Galmuri11', 'bold 12px Galmuri11', '10px Galmuri9'].map(f => document.fonts.load(f, '가A1')));
  await Promise.race([fonts.catch(() => {}), new Promise(r => setTimeout(r, 4000))]);
  fonts.then(() => { textCache.clear(); glyphCache.clear(); logoCache.clear(); _strC.clear(); araeCache.clear(); wordCache.clear(); FIT_MEMO.clear(); for (const k in _uiSpr) delete _uiSpr[k]; for (const k in SUB_BTN) delete SUB_BTN[k]; }).catch(() => {});
  buildScenes();
  loadPortraits();
  setupTitle();
  // 다른 테마는 한가할 때 미리 구워서 첫 배속 전환 때 끊기지 않게
  const idle = window.requestIdleCallback || (f => setTimeout(f, 300));
  const order = [['grove', 0], ['coast'], ['iho', 1], ['cheonji', 1], ['cave', 1], ['beach'], ['jeongbang', 2], ['grove', 2], ['cave', 2], ['grove', 3], ['iho', 3], ['jeongbang', 3], ['cheonji', 3], ['cave', 3]];   // 판에서 나오는 순서
  const rest = ['grove', 'iho', 'cheonji', 'jeongbang', 'cave'].flatMap(k => [0, 1, 2, 3].map(pi => [k, pi])).filter(([k, pi]) => !order.some(o => o[0] === k && o[1] === pi));
  prebuildPlaces([...order, ...rest], idle, () => state === 'pause' || state === 'over' || (state === 'play' && G.choice && G.choice.t > 0.6));   // 처음 보는 곳은 아이리스 한가운데(화면이 가려진 순간)에 구움
})();
