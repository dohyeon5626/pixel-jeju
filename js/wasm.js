// ─────────────────────────────────────────────────────────────
//  WASM 엔진 (Rust 소스: wasm/src · 빌드: wasm/build.sh)
//  배경 장면 굽기 · 회오리 깔때기 · 파티클 · 숨비 이동 물리 · 글자 스프라이트를 맡김
//  JS 쪽은 브라우저 일(캔버스 · 입력 · 소리 · 화면)과 게임 규칙만 — 여기서는 둘 사이에 값을 주고받음
//  sin · exp 같은 함수는 브라우저 Math를 빌려 써서 원래 JS와 같은 값이 나옴
// ─────────────────────────────────────────────────────────────
'use strict';

let WK = null;
const WK_READY = (async () => {
  const url = 'wasm/jeju.wasm?v=274', imports = { m: { jsin: Math.sin, jcos: Math.cos, jasin: Math.asin, jexp: Math.exp, jpow: Math.pow, jhypot2: Math.hypot, jhypot3: Math.hypot } };
  try {
    let inst;
    try { inst = (await WebAssembly.instantiateStreaming(fetch(url), imports)).instance; }
    catch (e) { inst = (await WebAssembly.instantiate(await (await fetch(url)).arrayBuffer(), imports)).instance; }   // wasm MIME을 안 주는 서버
    WK = wkApi(inst.exports);
  } catch (e) { console.error('WASM을 불러오지 못함', e); }
})();
// WASM 없이는 배경 · 물리가 없어 시작할 수 없음 (file://로 열었거나 아주 오래된 브라우저)
function wasmMissing() {
  const d = document.createElement('div');
  d.textContent = '게임 엔진(WebAssembly)을 불러오지 못했어요. 웹 서버로 열거나 새로 고침해 주세요.';
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
  let sceneSet = false;
  const sceneInit = () => {   // 화면 폭 · 시간대 · 팔레트를 한 번 넘김
    if (sceneSet) return; sceneSet = true;
    const j = new TextEncoder().encode(JSON.stringify({ phases: PHASES, pal: { leaf: C.leaf, grass: C.grass, org: C.org, yel: C.yel, soil: C.soil, stone: C.stone } }));
    run([j], p => ex.scene_init(W, p, j.length));
  };
  const layers = jp => {   // 층 목록(JSON) → { 이름: 캔버스 }
    const list = JSON.parse(new TextDecoder().decode(u8(jp, ex.scene_json_len()))), out = {};
    for (const L of list) {
      const c = mk(L.w, L.h), x = c.getContext('2d');
      if (L.w && L.h) { const id = x.createImageData(L.w, L.h); id.data.set(u8(L.p, L.w * L.h * 4)); x.putImageData(id, 0, 0); }
      Object.assign(c, L.m); if (L.m.foamMask) c.foamMask = Uint8Array.from(L.m.foamMask);
      out[L.n] = c;
    }
    ex.scene_free();
    return out;
  };
  let palSet = false;
  const pal = () => { if (palSet) return; palSet = true; [Vortex.PAL, Vortex.DUST, Vortex.CLOUD].forEach((c, k) => run([rgbs(c)], p => ex.set_pal(k, p, c.length))); };
  return {
    // 배경 장면 (테마 한 시간대): { sky, halla, oreum, field, near, ground, front } — 덧붙는 값(oy · cx · falls · foamMask 등)은 캔버스에 붙어 옴
    scene(kind, pi) { sceneInit(); return layers(ex.scene_build(SCENE_KIND.indexOf(kind), pi)); },
    cloud(w, h, seed, pal) { sceneInit(); return run([rgbs(pal)], p => layers(ex.scene_cloud(w, h, seed, p, pal.length))).cloud; },
    vignette() { sceneInit(); return layers(ex.scene_vignette()).vignette; },
    // 회오리 깔때기 한 장 (초당 30번)
    funnel(d, cw, chh, ox, oy, x, t, sp, dir, big, form, low, full) { pal(); run([d.length], p => { ex.funnel(p, cw, chh, ox, oy, x, t, sp, dir, big ? 1 : 0, form, low, full); d.set(u8(p, d.length)); }); },
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
