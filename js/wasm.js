// ─────────────────────────────────────────────────────────────
//  WASM 계산 커널 (Rust 소스: wasm/src · 빌드: wasm/build.sh)
//  픽셀 계산(동굴 · 주상절리 · 나무 · 회오리)과 파티클 · 숨비 이동 물리를 맡김
//  JS와 픽셀 하나까지 같은 값이 나오게 옮김 (sin · exp 같은 함수는 브라우저 Math를 빌려 씀)
//  못 불러오면(file:// 등) WK는 null로 남고 원래 JS로 계산 · 주소에 ?js를 붙이면 일부러 끔
// ─────────────────────────────────────────────────────────────
'use strict';

let WK = null;
const WK_READY = (async () => {
  if (/[?&]js\b/.test(location.search)) return;
  const url = 'wasm/jeju.wasm?v=271', imports = { m: { jsin: Math.sin, jcos: Math.cos, jasin: Math.asin, jexp: Math.exp, jpow: Math.pow, jhypot2: Math.hypot, jhypot3: Math.hypot } };
  try {
    let inst;
    try { inst = (await WebAssembly.instantiateStreaming(fetch(url), imports)).instance; }
    catch (e) { inst = (await WebAssembly.instantiate(await (await fetch(url)).arrayBuffer(), imports)).instance; }   // wasm MIME을 안 주는 서버
    WK = wkApi(inst.exports);
  } catch (e) { console.warn('WASM 없이 JS로 계산', e); }
})();

const FX_KIND = { px: 1, chunk: 2, petal: 3, rain: 4 };
function wkApi(ex) {
  const u8 = (p, n) => new Uint8Array(ex.memory.buffer, p, n);   // 메모리가 늘면 예전 뷰는 못 쓰므로 그때그때 새로
  const rgbs = cols => { const a = new Uint8Array(cols.length * 3); cols.forEach((c, i) => a.set(rgb(c), i * 3)); return a; };
  // 한 번 부르는 동안만 쓰는 칸들: [크기 또는 넣을 배열] → 포인터 · 끝나면 돌려줌
  const run = (bufs, f) => {
    const ps = bufs.map(b => { const n = typeof b === 'number' ? b : b.byteLength, p = ex.alloc(n); if (typeof b !== 'number') u8(p, n).set(new Uint8Array(b.buffer, b.byteOffset, n)); return [p, n]; });
    try { return f(...ps.map(q => q[0])); }
    finally { for (const [p, n] of ps) ex.dealloc(p, n); }
  };
  const guard = f => (...a) => { try { f(...a); return true; } catch (e) { console.warn('WASM 커널 실패 → JS로', e); WK = null; return false; } };   // 커널이 터지면 그 뒤로는 JS로만
  let cvcSet = false;
  const cvc = () => {   // cvC 색표 (밝기 11단계 × 온도 7단계)
    if (cvcSet) return; cvcSet = true;
    const t = new Uint8Array(231); for (let i = 0; i <= 10; i++) for (let r = -3; r <= 3; r++) t.set(rgb(cvC(i / 10, r / 3)), (i * 7 + r + 3) * 3);
    run([t], p => ex.set_cvc(p));
  };
  let palSet = false;
  const pal = () => { if (palSet) return; palSet = true; [Vortex.PAL, Vortex.DUST, Vortex.CLOUD].forEach((c, k) => run([rgbs(c)], p => ex.set_pal(k, p, c.length))); };
  const cave = (fn, ...a) => d => run([d], p => { ex[fn](p, ...a); d.set(u8(p, d.length)); });   // 안 칠하는 칸은 원래 내용 그대로
  return {
    caveWall: guard((d, w, day) => { cvc(); cave('cave_wall', w, day)(d); }),
    caveColumn: guard((d, lw, sh) => { cvc(); cave('cave_column', lw, sh)(d); }),
    caveNear: guard((d, lw, sh) => { cvc(); cave('cave_near', lw, sh)(d); }),
    caveGround: guard((d, lw, h) => { cvc(); cave('cave_ground', lw, h)(d); }),
    basaltWall: guard((md, d, w, h, x0, x1, yTop, yBot, seed, wx, ramp, rag, moss, mossCols) => {
      const a = new Uint8Array(w * h); for (let i = 0; i < a.length; i++) a[i] = md[i * 4 + 3];
      const wv = new Float64Array(x1 - x0 + 1); for (let i = x0; i <= x1; i++) wv[i - x0] = wx(i);
      run([a, d, wv, rgbs(ramp), rgbs(mossCols)], (pm, pd, pw, pr, pc) => { ex.basalt_wall(pm, pd, w, h, x0, x1, yTop, yBot, seed, pw, pr, ramp.length, rag, moss, pc); d.set(u8(pd, d.length)); });
    }),
    treeImg(size, blobs, cx, cy, r, fl, ramp) {   // 나무 한 그루 캔버스 (못 하면 null)
      let out = null;
      guard(() => {
        const c = mk(size, size), x = c.getContext('2d'), id = x.createImageData(size, size), b = new Float64Array(blobs.length * 3); blobs.forEach((q, i) => b.set(q, i * 3));
        run([id.data.length, b, rgbs(ramp)], (pd, pbl, pr) => { ex.tree_blobs(pd, size, pbl, blobs.length, Math.round(cx), Math.round(cy), r, fl, pr, ramp.length); id.data.set(u8(pd, id.data.length)); });
        x.putImageData(id, 0, 0); out = { c, a: id.data };
      })();
      return out;
    },
    caveCeil: guard((d, lw, sh, edge, day, night, cols) => { cvc(); run([d, Float64Array.from(edge), rgbs(cols)], (pd, pe, pc) => { ex.cave_ceil(pd, lw, sh, pe, day, night ? 1 : 0, pc); d.set(u8(pd, d.length)); }); }),
    caveShaft: guard((d, lw, sh, lc, a0) => { const c = rgb(lc); run([d], p => { ex.cave_shaft(p, lw, sh, c[0], c[1], c[2], a0); d.set(u8(p, d.length)); }); }),
    // 파티클: 한 칸 8개 [x, y, vx, vy, life, grav, drag, 종류]로 묶어 한 번에 · 땅에 닿은 빗방울(종류 5)은 JS가 물방울을 튀김
    //  튄 물방울도 같은 스텝에 한 번 움직임 (원래 for-of가 새로 넣은 것까지 도는 것과 같게)
    fxStep: guard((list, dt, t) => {
      for (let from = 0; from < list.length;) {
        const n = list.length - from, b = new Float64Array(n * 8);
        for (let i = 0; i < n; i++) { const p = list[from + i], o = i * 8; b[o] = p.x; b[o + 1] = p.y; b[o + 2] = p.vx; b[o + 3] = p.vy; b[o + 4] = p.life; b[o + 5] = p.grav; b[o + 6] = p.drag; b[o + 7] = FX_KIND[p.kind] || 0; }
        run([b], pb => { ex.fx_step(pb, n, dt, t); b.set(new Float64Array(ex.memory.buffer, pb, n * 8)); });
        const end = list.length;
        for (let i = 0; i < n; i++) { const p = list[from + i], o = i * 8; p.x = b[o]; p.y = b[o + 1]; p.vx = b[o + 2]; p.vy = b[o + 3]; p.life = b[o + 4]; if (b[o + 7] === 5) rainSplash(p); }
        from = end;
      }
    }),
    // 숨비 이동: 걷기는 값 하나, 낙하는 고정 칸(PLAYER)에 넣고 부름
    walk: (vx, dir, onGround, up, dt) => ex.player_walk(vx, dir, onGround ? 1 : 0, up, dt),
    fall: guard((P, dt, wind, al, ar, hold) => {
      const s = new Float64Array(ex.memory.buffer, ex.player_buf(), 12);
      s.set([P.x, P.y, P.vx, P.vy, dt, wind, P.rollT, al, ar, P.pound ? 1 : 0, hold ? 1 : 0, P.onGround ? 1 : 0]);
      ex.player_fall(); P.x = s[0]; P.y = s[1]; P.vy = s[3];
    }),
    funnel: guard((d, cw, chh, ox, oy, x, t, sp, dir, big, form, low, full) => { pal(); run([d.length], p => { ex.funnel(p, cw, chh, ox, oy, x, t, sp, dir, big ? 1 : 0, form, low, full); d.set(u8(p, d.length)); }); }),
  };
}
