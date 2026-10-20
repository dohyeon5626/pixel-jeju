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

// 배경 그림은 Rust(wasm/src/scene.rs · scn_theme.rs · scn_place.rs · scn_cave.rs)가 RGBA로 굽고, 여기서는 캔버스로 받아 테마 · 시간대별로 모아 둠
//  층: sky · halla · oreum · field · near · ground · front (덧붙는 값 — oy · cx · falls · foamMask 등 — 은 캔버스에 그대로 붙어 옴)

// 한라산 능선 높이 (화산 연기 · 용암이 능선을 따라 흐르게 게임에서도 씀 · Rust scn_theme.rs halla_top과 같은 식)
function hallaTop(x, cx) {
  const d = Math.abs(x - cx);
  if (d < 9) return 60 + (d < 6 ? 2 : 1);   // 백록담
  if (d < 16) return 59 + (d > 13 ? 1 : 0);
  const t = d - 16;
  return Math.round(59 + t * 0.2 + t * t * 0.0017);
}

// 구름 · 태풍 먹구름 조각
const cloudSprite = (w, h, seed, pal) => WK.cloud(w, h, seed, pal);

let SCENES = null, CLOUDS = null, VIGNETTE = null;
const THEMES = {}, PLACE_PART = {};
let THEME = 'field';
// 기본 테마(밭 · 성산 · 협재)는 네 시간대를 한 번에, 명소는 시간대마다 처음 그릴 때 구움 (나머지는 쉬는 화면에서 미리)
function buildTheme(kind) {
  if (THEMES[kind]) return THEMES[kind];
  if (['field', 'coast', 'beach'].includes(kind)) return (THEMES[kind] = PHASES.map((ph, pi) => WK.scene(kind, pi)));
  const part = PLACE_PART[kind] = PLACE_PART[kind] || [], arr = [];
  PHASES.forEach((ph, pi) => Object.defineProperty(arr, pi, { get: () => part[pi] || (part[pi] = WK.scene(kind, pi)), enumerable: true }));
  return (THEMES[kind] = arr);
}
function useTheme(kind) { THEME = kind; SCENES = buildTheme(kind); }
function buildScenes() {
  useTheme('field');
  CLOUDS = PHASES.map((ph, i) => [
    cloudSprite(84, 30, 11 + i * 0, ph.cloud), cloudSprite(56, 22, 23, ph.cloud), cloudSprite(110, 34, 37, ph.cloud), cloudSprite(40, 16, 51, ph.cloud),
  ]);
  VIGNETTE = WK.vignette();
}
// [테마, 시간대] 하나씩, canRun()일 때만 (아닐 땐 쉬었다가 이어서) · 처음 보는 곳은 아이리스 한가운데(화면이 가려진 순간)에 구움
function prebuildPlaces(q, idle, canRun) {
  const step = () => {
    if (!q.length) return;
    if (!canRun()) { setTimeout(() => idle(step), 1500); return; }
    const [k, pi] = q.shift();
    if (pi == null) buildTheme(k);   // 기본 테마(성산 · 협재)는 네 시간대를 한 번에
    else { const part = PLACE_PART[k] = PLACE_PART[k] || []; if (!part[pi]) part[pi] = WK.scene(k, pi); }
    idle(step);
  };
  idle(step);
}
