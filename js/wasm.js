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
  const url = 'wasm/jeju.wasm?v=282', imports = { m: { jsin: Math.sin, jcos: Math.cos, jasin: Math.asin, jexp: Math.exp, jpow: Math.pow, jatan2: Math.atan2, jhypot2: Math.hypot, jhypot3: Math.hypot }, g: gameImports() };
  try {
    let inst;
    if (location.protocol === 'file:') {   // file://에선 fetch가 막혀서 base64 사본(wasm/jeju-wasm.js)을 스크립트로 읽음
      await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'wasm/jeju-wasm.js?v=282'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
      inst = (await WebAssembly.instantiate(Uint8Array.from(atob(window.JEJU_WASM), c => c.charCodeAt(0)), imports)).instance;
    } else {
      try { inst = (await WebAssembly.instantiateStreaming(fetch(url), imports)).instance; }
      catch (e) { inst = (await WebAssembly.instantiate(await (await fetch(url)).arrayBuffer(), imports)).instance; }   // wasm MIME을 안 주는 서버
    }
    WK = wkApi(inst.exports);
  } catch (e) { console.error('WASM을 불러오지 못함', e); wasmMissing(); return; }
  for (const n of GAME_SCRIPTS) { const s = document.createElement('script'); s.src = `js/${n}.js?v=282`; s.async = false; document.body.appendChild(s); }   // async = false: 붙인 순서대로 실행
})();
// WASM 없이는 배경 · 물리가 없어 시작할 수 없음 (아주 오래된 브라우저 등)
function wasmMissing() {
  const d = document.createElement('div');
  d.textContent = '게임 엔진(WebAssembly)을 불러오지 못했어요. 새로 고침하거나 다른 브라우저로 열어 주세요.';
  d.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;background:#201614;color:#fff5e0;font:16px Galmuri11,sans-serif;z-index:99';
  document.body.appendChild(d);
}

// 게임 규칙(장애물)이 부르는 효과 · 난수: 게임 함수(fx · burst …)를 그 자리에서 바로 불러 원래와 같은 순서로
//  색 번호: 0 이상은 0xRRGGBB, 음수는 팔레트 C[이름][칸] (이름표는 Rust game.rs가 줌)
let HZ = null;
const hex6 = c => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
// 색 번호: 0 이상 0xRRGGBB (0x1000000이 붙으면 mute) · -1 ~ -999 팔레트 C[이름][칸] · -1000부터 CSS 목록
const hzCol = c => c >= 0x1000000 ? mute(hex6(c)) : c >= 0 ? hex6(c) : c > -1000 ? C[HZ.pals[(-c - 1) >> 4]][(-c - 1) & 15] : HZ.css[-c - 1000];
function gameImports() {
  return {
    jrand: () => Math.random(),
    jfx: (k, x, y, vx, vy, grav, drag, life, size, col, big, len) => { const o = { x, y, vx, vy, grav, drag, life, size, col: hzCol(col), kind: HZ.fx[k] }; if (big) o.big = true; if (len) o.len = len; fx(o); },
    jburst: (x, y, n, spd, life, grav, k, nc, c0, c1, c2, c3) => burst(x, y, n, [c0, c1, c2, c3].slice(0, nc).map(hzCol), spd, life, grav, HZ.fx[k]),
    jdust: (x, y, n, dir, big) => dust(x, y, n, dir, big),
    jlight: (x, y, r, col, a) => light(x, y, r, hzCol(col), a),
    jsfx: (id, a, b) => Sound.sfx[HZ.sfx[id]](a, b),
    jshake: t => shake(t),
    jspark: (x, y) => spark(x, y),
    jimpact: (x, y, col, power, quiet) => impact(x, y, hzCol(col), power, !!quiet),
    jhitstop: (t, cd) => hitstop(t, cd),
    jreward: (k, x, y) => reward(HZ.rewards[k], x, y),
    jdecal: (x, life) => G.decals.push({ x, t: 0, life }),
    jhook: (id, a, b, c, d) => HZ.hook(id, a, b, c, d),
  };
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
  // 장애물: JS 객체의 필드를 Rust 필드 목록대로 f64 칸에 담고 → 계산 → 다시 씀
  //  숫자 · 참거짓 · 이름(단계 같은 문자열은 목록 안 번호) · 아직 없는 숫자는 NaN으로 넘기고 NaN이 오면 그대로 둠
  HZ = JSON.parse(new TextDecoder().decode(u8(ex.hz_tables(), ex.hz_tables_len())));
  const kindIdx = Object.fromEntries(Object.keys(HZ.kinds).map((k, i) => [k, i]));
  const hzBuf = ex.alloc(64 * 8), boxBuf = ex.alloc(64 * 8);
  const hzView = n => new Float64Array(ex.memory.buffer, hzBuf, n);
  const pack = (h, K) => { const f = hzView(K.length); K.forEach(([n, t], i) => { const v = h[n]; f[i] = t === 'n' ? (v ?? NaN) : t === 'b' ? (v ? 1 : 0) : t.indexOf(v); }); };
  const unpack = (h, K) => { const f = hzView(K.length); K.forEach(([n, t], i) => { const v = f[i]; if (t === 'n') { if (!Number.isNaN(v)) h[n] = v; } else h[n] = t === 'b' ? v !== 0 : t[v]; }); };
  // 지금 판의 값 (game.rs Ctx 순서)
  const setCtx = () => { const c = new Float64Array(ex.memory.buffer, ex.hz_ctx(), 12); c[0] = W; c[1] = P.x; c[2] = P.y; c[3] = P.dead ? 1 : 0; c[4] = G.arenaL; c[5] = G.arenaR; c[6] = G.speed; c[7] = G.magnetT || 0; c[8] = Sound.tempo || 0; c[9] = G.tier; c[10] = G.storm || 0; c[11] = G.lightning || 0; };
  // Rust가 부르는 JS 일 (game.rs HOOKS): 부르기 전에 지금 객체를 최신 값으로 맞춰 둠
  let cur = null;
  const HOOK = {
    daily: s => daily(HZ.strs[s]),
    popup: (s, x, y, col) => popup(HZ.strs[s], x, y, hzCol(col), 's'),
    tang: (x, y, vx, vy) => G.pickups.push(new Pickup('tang', x, y, vx, vy)),
    splash: (x, big) => splashFx(x, big),
    ghost: (x, y, life, col) => G.ghosts.push({ img: cur.h.frame(), x, y, life, col: hzCol(col) }),
    glyphs: (x, y) => graphemes(cur.h.text.replace(/\s/g, '')).forEach((ch, i) => fx({ x: x + 6 + i * 9, y: y + 4, vx: rand(-60, 60), vy: rand(-140, -60), grav: 420, life: 0.8, kind: 'glyph', ch })),
    split: () => cur.h.split(),
    kick: (dx, dy) => kick(dx, dy),
    duck: t => Sound.duck(t),
    mean: (x, y) => popup('= ' + cur.h.mean, x, y, C.yel[2], 's'),
    label: (x, y, col) => popup(cur.h.label + '!', x, y, hzCol(col), 's'),
    flash: (t, col) => flashFx(t, hzCol(col)),
    bolt: () => cur.h.makeBolt(),
    ripple: (x, d) => { const r = new Ripple(x, d, (105 + G.tier * 5) * evK()); r.pat = cur.h.pat; spawnHz(r); },
    gset: (k, v) => { G[HZ.gfields[k]] = v; },
  };
  const hooks = HZ.hooks.map(n => HOOK[n]);
  HZ.hook = (id, a, b, c, d) => { unpack(cur.h, cur.K); hooks[id](a, b, c, d); };
  const call = (h, kind, fn) => { const K = HZ.kinds[kind]; pack(h, K); setCtx(); cur = { h, K }; const r = fn(kindIdx[kind], K.length); cur = null; unpack(h, K); return r !== 0; };
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
    // 장애물 한 스텝 (살아 있으면 true) · 판정 상자 [{ x, y, w, h }] · 맞았을 때 (ev: 'shot' 귤 · 'stomp' 밟힘 · 'bounce' 밟고 튀어 오름)
    hzUpdate(h, kind, dt) { return call(h, kind, (k, n) => ex.hz_update(k, hzBuf, n, dt)); },
    hzBoxes(h, kind) {
      const K = HZ.kinds[kind]; pack(h, K); setCtx(); const n = ex.hz_boxes(kindIdx[kind], hzBuf, K.length, boxBuf); if (!n) return NONE;
      const b = new Float64Array(ex.memory.buffer, boxBuf, n * 4), out = []; for (let i = 0; i < n; i++) out.push({ x: b[i * 4], y: b[i * 4 + 1], w: b[i * 4 + 2], h: b[i * 4 + 3] });
      return out;
    },
    hzOn(h, kind, ev, sx = 0, sy = 0) { return call(h, kind, (k, n) => ex.hz_on(k, hzBuf, n, HZ.events.indexOf(ev), sx, sy)); },
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
