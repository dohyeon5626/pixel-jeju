// ─────────────────────────────────────────────────────────────
//  픽셀 제주 — 캐릭터 · 적 · 소품 스프라이트
//  그림은 Rust(wasm/src/spr.rs)가 굽고, 여기서는 팔레트를 더하고 받아 둠
//  주인공 숨비 · 조랑말 · 돼지는 "리그"(머리 · 몸통은 손으로 찍은 모양, 팔다리는 각도)로 포즈를 만들어 프레임을 구움
// ─────────────────────────────────────────────────────────────
'use strict';

// 캐릭터용 팔레트 (Rust도 이 C를 그대로 받아 씀)
C.peach = muteAll(['#a8503e', '#d9806a', '#f4b49a', '#ffdcc8']);
C.hide = muteAll(['#33191e', '#5a2e22', '#8a4a2c', '#b86e3c', '#dc9a60']);   // 조랑말
C.tan = muteAll(['#6a3030', '#a85a46', '#d48a66', '#efb48e']);
C.mint = muteAll(['#24585a', '#3f8a80', '#7cc4a8', '#c4ecd4']);
C.straw = muteAll(['#4a2a1e', '#7a4a2a', '#b07a42', '#dcae6a']);
C.teal = muteAll(['#173c4a', '#22636e', '#33938f', '#62c4b0', '#b4ecd8']);
C.hair = muteAll(['#2e1620', '#4e2626', '#7a3e2e', '#a86040']);
C.cream = muteAll(['#7a5a42', '#b8946c', '#e2c79a', '#fff0d0']);
C.suit = muteAll(['#12141c', '#1c2030', '#2a3048', '#435074', '#6c7ca8']);   // 숨비 고무 잠수복

// 고정 스프라이트 전부 (캐릭터 · 소품은 여기, 적 · 아이템은 game.js · boss.js에서 꺼내 씀)
//  좌우 한 쌍은 { r, l } · 프레임 캔버스에는 기준점 ax · ay (숨비는 목 자리 neck도)
const SPR = WK.sprites();
const { GYUL, HAREUBANG, MINI, PONY, TANGERINE, HALLABONG, HEART, HEART_EMPTY, METEOR, PEBBLE, PEBBLES, TEWAK, PUFFS, SMOKE, SPARK, TEWAK_BACK, SUITCASES, PIG, GULL, RENTCAR } = SPR;

// ── 말 글자 탄환: 말풍선 없이 글자 자체가 날아옴 (두꺼운 테두리 + 아래 그림자) ──
const wordCache = new Map();
function wordSprite(str, kind) {
  const key = str + '|' + kind;
  if (wordCache.has(key)) return wordCache.get(key);
  const col = kind === 'rap' ? C.yel[3] : kind === 'big' ? C.red[3] : kind === 'kind' ? mute('#b8e08a') : mute('#f6ecdc');
  const edge = INK;   // 화면 위 글자는 모두 1px 먹선 (UI 키트와 같은 규칙)
  const t = textSprite(str, { font: 'b', color: col, outline: null });
  const w = t.width, h = t.height, src = t.getContext('2d').getImageData(0, 0, w, h).data;
  const c = WK.wordSprite(src, w, h, [edge, mix(edge, '#000000', 0.4), col, mix(col, edge, 0.2)]);   // 두꺼운 먹선 · 아래 그림자 · 아래 두 줄은 먹빛 (wasm/src/text.rs)
  c.bodyH = c.height;
  wordCache.set(key, c);
  return c;
}
