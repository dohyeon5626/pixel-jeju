// ─────────────────────────────────────────────────────────────
//  WASM 계산 커널 (Rust 소스: wasm/src · 빌드: wasm/build.sh)
//  픽셀을 많이 계산하는 곳(동굴 층 · 주상절리 벽 · 회오리 깔때기)만 맡김
//  JS와 픽셀 하나까지 같은 그림이 나오게 옮김 (hypot만 브라우저 Math를 빌려 씀)
//  못 불러오면(file:// 등) WK는 null로 남고 원래 JS로 계산 · 주소에 ?js를 붙이면 일부러 끔
// ─────────────────────────────────────────────────────────────
'use strict';

let WK = null;
const WK_READY = (async () => {
  if (/[?&]js\b/.test(location.search)) return;
  const url = 'wasm/jeju.wasm?v=270', imports = { m: { jhypot2: Math.hypot, jhypot3: Math.hypot } };
  try {
    let inst;
    try { inst = (await WebAssembly.instantiateStreaming(fetch(url), imports)).instance; }
    catch (e) { inst = (await WebAssembly.instantiate(await (await fetch(url)).arrayBuffer(), imports)).instance; }   // wasm MIME을 안 주는 서버
    WK = wkApi(inst.exports);
  } catch (e) { console.warn('WASM 없이 JS로 계산', e); }
})();

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
    funnel: guard((d, cw, chh, ox, oy, x, t, sp, dir, big, form, low, full) => { pal(); run([d.length], p => { ex.funnel(p, cw, chh, ox, oy, x, t, sp, dir, big ? 1 : 0, form, low, full); d.set(u8(p, d.length)); }); }),
  };
}
