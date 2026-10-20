// ─────────────────────────────────────────────────────────────
//  WASM 엔진 (Rust 소스: wasm/src · 빌드: wasm/build.sh)
//  배경 장면 · 캐릭터와 소품 스프라이트 · 회오리 깔때기 · 파티클 · 숨비 이동 물리 · 글자를 맡김
//  나머지 스크립트는 WASM이 준비된 뒤에 차례로 붙임 (스크립트를 읽는 순간 스프라이트를 굽기 때문)
//  JS 쪽은 브라우저 일(캔버스 · 입력 · 소리 · 화면)과 게임 규칙만 — 여기서는 둘 사이에 값을 주고받음
//  sin · exp 같은 함수는 브라우저 Math를 빌려 써서 원래 JS와 같은 값이 나옴
// ─────────────────────────────────────────────────────────────
'use strict';

let WK = null;
const GAME_SCRIPTS = ['chars', 'portraits', 'boss', 'scenery', 'audio', 'game'];
(async () => {
  const url = 'wasm/jeju.wasm?v=278', imports = { m: { jsin: Math.sin, jcos: Math.cos, jasin: Math.asin, jexp: Math.exp, jpow: Math.pow, jatan2: Math.atan2, jhypot2: Math.hypot, jhypot3: Math.hypot } };
  try {
    let inst;
    if (location.protocol === 'file:') {   // file://에선 fetch가 막혀서 base64 사본(wasm/jeju-wasm.js)을 스크립트로 읽음
      await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'wasm/jeju-wasm.js?v=278'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
      inst = (await WebAssembly.instantiate(Uint8Array.from(atob(window.JEJU_WASM), c => c.charCodeAt(0)), imports)).instance;
    } else {
      try { inst = (await WebAssembly.instantiateStreaming(fetch(url), imports)).instance; }
      catch (e) { inst = (await WebAssembly.instantiate(await (await fetch(url)).arrayBuffer(), imports)).instance; }   // wasm MIME을 안 주는 서버
    }
    WK = wkApi(inst.exports);
  } catch (e) { console.error('WASM을 불러오지 못함', e); wasmMissing(); return; }
  for (const n of GAME_SCRIPTS) { const s = document.createElement('script'); s.src = `js/${n}.js?v=278`; s.async = false; document.body.appendChild(s); }   // async = false: 붙인 순서대로 실행
})();
// WASM 없이는 배경 · 물리가 없어 시작할 수 없음 (아주 오래된 브라우저 등)
function wasmMissing() {
  const d = document.createElement('div');
  d.textContent = '게임 엔진(WebAssembly)을 불러오지 못했어요. 새로 고침하거나 다른 브라우저로 열어 주세요.';
  d.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;background:#201614;color:#fff5e0;font:16px Galmuri11,sans-serif;z-index:99';
  document.body.appendChild(d);
}

const SCENE_KIND = ['field', 'coast', 'beach', 'grove', 'iho', 'jeongbang', 'cheonji', 'cave'];
const FX_KIND = { px: 1, chunk: 2, petal: 3, rain: 4 };
function wkApi(ex) {
  const u8 = (p, n) => new Uint8Array(ex.memory.buffer, p, n);   // 메모리가 늘면 예전 뷰는 못 쓰므로 그때그때 새로
  const rgbs = cols => { const a = new Uint8Array(cols.length * 3); cols.forEach((c, i) => a.set(rgb(c), i * 3)); return a; };
  const alphas = (src, n) => { const a = new Uint8Array(n); for (let i = 0; i < n; i++) a[i] = src[i * 4 + 3]; return a; };
  // 한 번 부르는 동안만 쓰는 칸들: [크기 또는 넣을 배열] → 포인터 · 끝나면 돌려줌
  const run = (bufs, f) => {
    const ps = bufs.map(b => { const n = typeof b === 'number' ? b : b.byteLength, p = ex.alloc(n); if (typeof b !== 'number') u8(p, n).set(new Uint8Array(b.buffer, b.byteOffset, n)); return [p, n]; });
    try { return f(...ps.map(q => q[0])); }
    finally { for (const [p, n] of ps) ex.dealloc(p, n); }
  };
  const paint = (c, f) => { const x = c.getContext('2d'), id = x.createImageData(c.width, c.height); run([id.data.length], p => { f(p); id.data.set(u8(p, id.data.length)); }); x.putImageData(id, 0, 0); return c; };   // Rust가 RGBA를 칠한 캔버스
  const init = data => { const j = new TextEncoder().encode(JSON.stringify(data)); run([j], p => ex.scene_init(W, p, j.length)); };
  let palSet = false, phaseSet = false;
  const palInit = () => { if (!palSet) { palSet = true; init({ pal: C }); } };   // 팔레트 C 전체 (chars.js가 더한 것까지)
  const sceneInit = () => { palInit(); if (!phaseSet) { phaseSet = true; init({ phases: PHASES }); } };
  // Rust 결과 { T: 트리, L: [캔버스 정보] } → 캔버스들 + 트리 (트리 속 {"$": 번호}를 그 캔버스로 바꿈)
  const result = jp => {
    const { T, L } = JSON.parse(new TextDecoder().decode(u8(jp, ex.scene_json_len())));
    const cvs = L.map(l => {
      const c = mk(l.w, l.h), x = c.getContext('2d');
      if (l.w && l.h) { const id = x.createImageData(l.w, l.h); id.data.set(u8(l.p, l.w * l.h * 4)); x.putImageData(id, 0, 0); }
      Object.assign(c, l.m); if (l.m.foamMask) c.foamMask = Uint8Array.from(l.m.foamMask);
      return c;
    });
    ex.scene_free();
    const walk = v => Array.isArray(v) ? v.map(walk) : v && typeof v === 'object' ? ('$' in v ? Object.assign(cvs[v.$], ...Object.entries(v).filter(([k]) => k !== '$').map(([k, x]) => ({ [k]: walk(x) }))) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]))) : v;
    return { cvs, tree: walk(T), layers: Object.fromEntries(L.map((l, i) => [l.n, cvs[i]]).filter(([n]) => n)) };
  };
  const layers = jp => result(jp).layers;   // 배경 층: { 이름: 캔버스 }
  const sprite = jp => result(jp).tree;
  let vortexSet = false;
  const vortexPal = () => { if (vortexSet) return; vortexSet = true; [Vortex.PAL, Vortex.DUST, Vortex.CLOUD].forEach((c, k) => run([rgbs(c)], p => ex.set_pal(k, p, c.length))); };
  return {
    // 배경 장면 (테마 한 시간대): { sky, halla, oreum, field, near, ground, front } — 덧붙는 값(oy · cx · falls · foamMask 등)은 캔버스에 붙어 옴
    scene(kind, pi) { sceneInit(); return layers(ex.scene_build(SCENE_KIND.indexOf(kind), pi)); },
    cloud(w, h, seed, pal) { sceneInit(); return run([rgbs(pal)], p => layers(ex.scene_cloud(w, h, seed, p, pal.length))).cloud; },
    vignette() { sceneInit(); return layers(ex.scene_vignette()).vignette; },
    // 스프라이트: 고정된 것 전부 { GYUL, PONY, … } · 게임 중에 크기별로 처음 쓸 때 굽는 것
    sprites() { palInit(); return sprite(ex.spr_all()); },
    crate() { palInit(); return sprite(ex.spr_crate()); },
    slash(hh) { palInit(); return sprite(ex.spr_slash(hh)); },
    oreum(h) { palInit(); return sprite(ex.spr_oreum(h)); },
    tide(hi, f) { palInit(); return sprite(ex.spr_tide(hi ? 1 : 0, f)); },
    wx(id) { palInit(); return sprite(ex.spr_wx(['typhoon', 'harvest', 'flight', 'peak'].indexOf(id))); },
    // 배경음악: 곡 바꾸기 · 8분음표 한 칸의 음표들을 play(종류, f, f2, 길이, 파형/필터, 세기, 시작, 버스, det/q)로
    musicSong(i) { ex.music_song(i); },
    musicStep(s, tempo, calm, hip, key, varied, accent, hipVar, play) {
      const n = ex.music_step(s, tempo, calm ? 1 : 0, hip ? 1 : 0, key, varied ? 1 : 0, accent ? 1 : 0, hipVar), b = new Float64Array(ex.memory.buffer, ex.music_buf(), n * 9);
      for (let i = 0; i < n; i++) play(...b.subarray(i * 9, i * 9 + 9));
    },
    // 회오리 깔때기 한 장 (초당 30번)
    funnel(d, cw, chh, ox, oy, x, t, sp, dir, big, form, low, full) { vortexPal(); run([d.length], p => { ex.funnel(p, cw, chh, ox, oy, x, t, sp, dir, big ? 1 : 0, form, low, full); d.set(u8(p, d.length)); }); },
    // 파티클: 한 칸 8개 [x, y, vx, vy, life, grav, drag, 종류]로 묶어 한 번에 · 땅에 닿은 빗방울(종류 5)은 JS가 물방울을 튀김
    //  튄 물방울도 같은 스텝에 한 번 움직임 (for-of가 새로 넣은 것까지 도는 것과 같게)
    fxStep(list, dt, t) {
      for (let from = 0; from < list.length;) {
        const n = list.length - from, b = new Float64Array(n * 8);
        for (let i = 0; i < n; i++) { const p = list[from + i], o = i * 8; b[o] = p.x; b[o + 1] = p.y; b[o + 2] = p.vx; b[o + 3] = p.vy; b[o + 4] = p.life; b[o + 5] = p.grav; b[o + 6] = p.drag; b[o + 7] = FX_KIND[p.kind] || 0; }
        run([b], pb => { ex.fx_step(pb, n, dt, t); b.set(new Float64Array(ex.memory.buffer, pb, n * 8)); });
        const end = list.length;
        for (let i = 0; i < n; i++) { const p = list[from + i], o = i * 8; p.x = b[o]; p.y = b[o + 1]; p.vx = b[o + 2]; p.vy = b[o + 3]; p.life = b[o + 4]; if (b[o + 7] === 5) rainSplash(p); }
        from = end;
      }
    },
    // 숨비 이동: 걷기는 값 하나, 낙하는 고정 칸(PLAYER)에 넣고 부름
    walk: (vx, dir, onGround, up, dt) => ex.player_walk(vx, dir, onGround ? 1 : 0, up, dt),
    fall(P, dt, wind, al, ar, hold) {
      const s = new Float64Array(ex.memory.buffer, ex.player_buf(), 12);
      s.set([P.x, P.y, P.vx, P.vy, dt, wind, P.rollT, al, ar, P.pound ? 1 : 0, hold ? 1 : 0, P.onGround ? 1 : 0]);
      ex.player_fall(); P.x = s[0]; P.y = s[1]; P.vy = s[3];
    },
    // 글자: 알파만 넘기고 RGBA를 받아 캔버스에 한 번에 · textSprite는 다듬을 경계 상자 [x0, y0, x1, y1]를 돌려줌
    textSprite(src, w, h, out, outline, shadow, color) {
      let bb = null; const cols = new Uint8Array(6); cols.set(outline ? rgb(outline) : [0, 0, 0]); cols.set(rgb(color), 3);
      run([alphas(src, w * h), cols, 16], (pa, pc, pb) => paint(out, pd => { ex.text_sprite(pa, w, h, pd, out.width, out.height, outline ? 1 : 0, shadow ? 1 : 0, pc, pb); bb = [...new Int32Array(ex.memory.buffer, pb, 4)]; }));
      return bb;
    },
    wordSprite(src, w, h, cols) { return run([alphas(src, w * h), rgbs(cols)], (pa, pc) => paint(mk(w + 4, h + 6), pd => ex.word_sprite(pa, w, h, pd, pc))); },
    alphaMask(d, thr, m) { run([d, m.length], (pd, pm) => { ex.alpha_mask(pd, m.length, thr, pm); m.set(u8(pm, m.length)); }); },
    maskPaint(m, out, col) { const c = rgb(col); run([m], pm => paint(out, pd => ex.mask_paint(pm, m.length, c[0], c[1], c[2], pd))); },
  };
}
