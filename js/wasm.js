// ─────────────────────────────────────────────────────────────
//  WASM 엔진 (Rust 소스: wasm/src · 빌드: wasm/build.sh)
//  배경 장면 · 캐릭터와 소품 스프라이트 · 회오리 깔때기 · 파티클 · 숨비 이동 물리 · 글자를 맡김
//  나머지 스크립트는 WASM이 준비된 뒤에 차례로 붙임 (스크립트를 읽는 순간 스프라이트를 굽기 때문)
//  장애물 · 패턴 규칙과 그리기 명령, 효과음 · 배경음악 작곡도 Rust — JS 쪽은 브라우저 일(캔버스 · 입력 · 소리 · 화면)과 나머지 진행, 여기서는 둘 사이에 값을 주고받음
//  sin · exp 같은 함수는 브라우저 Math를 빌려 써서 원래 JS와 같은 값이 나옴
// ─────────────────────────────────────────────────────────────
'use strict';

let WK = null, WASM_MEM = null;
const GAME_SCRIPTS = ['chars', 'portraits', 'boss', 'scenery', 'audio', 'game'];
(async () => {
  const url = 'wasm/jeju.wasm?v=290', imports = { m: { jsin: Math.sin, jcos: Math.cos, jasin: Math.asin, jexp: Math.exp, jpow: Math.pow, jatan2: Math.atan2, jhypot2: Math.hypot, jhypot3: Math.hypot }, g: gameImports() };
  imports.g.jpanic = (p, n) => console.error('Rust 패닉: ' + new TextDecoder().decode(new Uint8Array(WASM_MEM.buffer, p, n)));
  try {
    let inst;
    if (location.protocol === 'file:') {   // file://에선 fetch가 막혀서 base64 사본(wasm/jeju-wasm.js)을 스크립트로 읽음
      await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'wasm/jeju-wasm.js?v=290'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
      inst = (await WebAssembly.instantiate(Uint8Array.from(atob(window.JEJU_WASM), c => c.charCodeAt(0)), imports)).instance;
    } else {
      try { inst = (await WebAssembly.instantiateStreaming(fetch(url), imports)).instance; }
      catch (e) { inst = (await WebAssembly.instantiate(await (await fetch(url)).arrayBuffer(), imports)).instance; }   // wasm MIME을 안 주는 서버
    }
    WASM_MEM = inst.exports.memory; inst.exports.start();
    WK = wkApi(inst.exports);
  } catch (e) { console.error('WASM을 불러오지 못함', e); wasmMissing(); return; }
  for (const n of GAME_SCRIPTS) { const s = document.createElement('script'); s.src = `js/${n}.js?v=290`; s.async = false; document.body.appendChild(s); }   // async = false: 붙인 순서대로 실행
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
// 색 번호: 0 이상 0xRRGGBB (0x1000000이 붙으면 mute · 0x2000000은 채도 0.85로 mute) · -1 ~ -999 팔레트 C[이름][칸] · -1000부터 CSS 목록
const hzCol = c => c >= 0x2000000 ? mute(hex6(c), 0.85) : c >= 0x1000000 ? mute(hex6(c)) : c >= 0 ? hex6(c) : c > -1000 ? C[HZ.pals[(-c - 1) >> 4]][(-c - 1) & 15] : HZ.css[-c - 1000];
function gameImports() {
  return {
    jrand: () => Math.random(),
    jfx: (k, x, y, vx, vy, grav, drag, life, size, col, big, len, near) => { const o = { x, y, vx, vy, grav, drag, life, size, col: hzCol(col), kind: HZ.fx[k] }; if (big) o.big = true; if (len) o.len = len; if (near) o.near = true; fx(o); },
    jburst: (x, y, n, spd, life, grav, k, nc, c0, c1, c2, c3) => burst(x, y, n, [c0, c1, c2, c3].slice(0, nc).map(hzCol), spd, life, grav, HZ.fx[k]),
    jdust: (x, y, n, dir, big) => dust(x, y, n, dir, big),
    jlight: (x, y, r, col, a) => light(x, y, r, hzCol(col), a),
    jsfx: (id, a, b) => Sound.sfx[HZ.sfx[id]](a, b),
    jshake: t => shake(t),
    jspark: (x, y) => spark(x, y),
    jimpact: (x, y, col, power, quiet) => impact(x, y, hzCol(col), power, !!quiet),
    jhitstop: (t, cd) => hitstop(t, cd),
    jreward: (k, x, y) => reward(HZ.rewards[k], x, y),
    jdecal: (x, life, mark) => G.decals.push(mark ? { x, t: 0, life, mark: true } : { x, t: 0, life }),
    jhook: (id, a, b, c, d) => HZ.hook(id, a, b, c, d),
    // 그리기 (wasm/src/draw.rs): 이미지 크기 · 기준점 묻기 · 잔상 남기기
    jimg: (src, id, a, b, c, p) => HZ.imgProp(src, id, a, b, c, p),
    jghost: (src, id, a, b, c, x, y, life, col) => G.ghosts.push({ img: HZ.img(src, id, a, b, c), x, y, life, col: hzCol(col) }),
    // 패턴 (wasm/src/pat.rs): 장애물 만들기 · 필드 읽고 쓰기 · 판에 내기 · 화면 끝 경고 · 판 물어보기
    jnew: (k, a, b, c, d, e) => HZ.jnew(k, a, b, c, d, e),
    jget: (h, f) => HZ.jget(h, f),
    jset: (h, f, v) => HZ.jset(h, f, v),
    jspawn: h => HZ.jspawn(h),
    jwarn: (side, k, dur, ph, act, a, b, c, d) => HZ.jwarn(side, k, dur, ph, act, a, b, c, d),
    jquery: (q, a) => HZ.jquery(q, a),
    // 효과음 (wasm/src/sfx.rs가 소리마다 부름 · 파형 · 필터는 번호)
    jtone: (f, f2, d, w, v, at, vib, exact) => Sound.toneN(f, f2, d, w, v, at, vib, exact),
    jnoise: (d, v, ft, f, f2, q, at) => Sound.noiseN(d, v, ft, f, f2, q, at),
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
  const hzBuf = ex.alloc(2048 * 8), boxBuf = ex.alloc(64 * 8);
  const hzView = n => new Float64Array(ex.memory.buffer, hzBuf, n);
  //  목록(l, 그리기용 · 맨 뒤)은 두 칸(시작 칸 · 개수)이고, 숫자들(배열 · 객체를 펼친 것)은 고정 칸 뒤에 이어 붙임 — 읽기만 하므로 되쓰지 않음
  const slots = K => K.reduce((n, [, t]) => n + (t === 'l' ? 2 : 1), 0);
  const flat = (v, out = []) => { if (typeof v === 'number') out.push(v); else if (v) for (const x of Array.isArray(v) ? v : Object.values(v)) flat(x, out); return out; };
  const pack = (h, K) => {
    const n = slots(K), f = hzView(n), extra = []; let i = 0;
    for (const [name, t] of K) { const v = h[name]; if (t === 'l') { const a = flat(v); f[i++] = n + extra.length; f[i++] = a.length; extra.push(...a); } else f[i++] = t === 'n' ? (v ?? NaN) : t === 'b' ? (v ? 1 : 0) : t.indexOf(v); }
    if (extra.length) hzView(n + extra.length).set(extra, n);
    return n + extra.length;
  };
  const unpack = (h, K) => {
    const f = hzView(slots(K)); let i = 0;
    for (const [name, t] of K) { if (t === 'l') { i += 2; continue; } const v = f[i++]; if (t === 'n') { if (!Number.isNaN(v)) h[name] = v; } else h[name] = t === 'b' ? v !== 0 : t[v]; }
  };
  // 지금 판의 값 (game.rs Ctx 순서)
  const setCtx = () => {
    const c = new Float64Array(ex.memory.buffer, ex.hz_ctx(), 17);
    c[0] = W; c[1] = P.x; c[2] = P.y; c[3] = P.dead ? 1 : 0; c[4] = G.arenaL; c[5] = G.arenaR; c[6] = G.speed; c[7] = G.magnetT || 0; c[8] = Sound.tempo || 0;
    c[9] = G.tier; c[10] = G.storm || 0; c[11] = G.lightning || 0; c[12] = amb.t; c[13] = G.diff; c[14] = G.patterns.length; c[15] = themeCfg().indoor ? 1 : 0; c[16] = G.dark || 0;
  };
  // Rust가 부르는 JS 일 (game.rs HOOKS): 부르기 전에 지금 객체를 최신 값으로 맞춰 둠
  let cur = null;
  const HOOK = {
    daily: s => daily(HZ.strs[s]),
    popup: (s, x, y, col) => popup(HZ.strs[s], x, y, hzCol(col), 's'),
    tang: (x, y, vx, vy) => G.pickups.push(new Pickup('tang', x, y, vx, vy)),
    splash: (x, big) => splashFx(x, big),
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
    beatLead: d => beatLead(d),
  };
  const hooks = HZ.hooks.map(n => HOOK[n]);
  HZ.hook = (id, a, b, c, d) => { if (cur.h) unpack(cur.h, cur.K); return hooks[id](a, b, c, d); };
  const call = (h, kind, fn) => { const K = HZ.kinds[kind], n = pack(h, K); setCtx(); cur = { h, K }; const r = fn(kindIdx[kind], n); cur = null; unpack(h, K); return r !== 0; };
  // 패턴 (wasm/src/pat.rs): 상태는 패턴 객체에 · Rust가 만든 장애물은 fresh[번호]로 가리킴
  const PT = JSON.parse(new TextDecoder().decode(u8(ex.pat_tables(), ex.pat_tables_len())));
  const patIdx = Object.fromEntries(Object.keys(PT.kinds).map((k, i) => [k, i]));
  const opt = v => Number.isNaN(v) ? undefined : v;   // 빈 인자는 생성자 기본값으로
  const NEW = {
    Rise: (x, warn, hold, chain, idx) => new Rise(x, warn, hold, !!chain, idx),
    Hopper: (dir, x) => new Hopper(dir, opt(x)),
    Meteor: (tx, fall) => new Meteor(tx, fall),
    Pony: (dir, off) => new Pony(dir, off),
    Pebble: dir => new Pebble(dir),
    Tewak: dir => new Tewak(dir),
    Suitcase: (dir, off) => new Suitcase(dir, off),
    Pig: (dir, off) => new Pig(dir, off),
    RentCar: (dir, off) => new RentCar(dir, off),
    Bee: (dir, i, sp, ph) => new Bee(dir, i, sp, ph),
    Gull: () => new Gull(),
    Plane: (dir, low, sp) => new Plane(dir, !!low, sp),
    Parcel: (x, delay) => new Parcel(x, delay),
    Glider: (dir, high, sp) => new Glider(dir, !!high, sp),
    Dolphin: (x0, x1, peak, T, warn) => new Dolphin(x0, x1, peak, T, warn),
    Crow: (x, delay) => new Crow(x, delay),
    DialectWord: (i, x, land) => new DialectWord(DIALECT[i][0], DIALECT[i][1], x, land),
    Rotten: (x, y, vx, vy) => new Rotten(x, y, vx, vy),
  };
  let fresh = [];
  HZ.jnew = (k, a, b, c, d, e) => fresh.push(NEW[PT.new[k]](a, b, c, d, e)) - 1;
  HZ.jget = (h, f) => { const [name, t] = PT.fields[f], v = fresh[h][name]; return t === 'b' ? (v ? 1 : 0) : (v ?? NaN); };
  HZ.jset = (h, f, v) => { const [name, t] = PT.fields[f]; fresh[h][name] = name === 'pat' ? null : t === 'b' ? v !== 0 : v; };
  HZ.jspawn = h => spawnHz(fresh[h]);
  HZ.jwarn = (side, k, dur, ph, act, a, b, c, d) => {
    const w = { side }, kind = cur.kind; if (!Number.isNaN(k)) w.kind = PT.warn[k]; if (!Number.isNaN(ph)) w.ph = ph;
    w.t = 0; w.dur = dur; w.spawn = () => WK.patAction(kind, act, a, b, c, d); G.warnings.push(w);
  };
  HZ.jquery = (q, a) => {
    switch (PT.queries[q]) {
      case 'meteorLive': return G.hz.some(h => h instanceof Meteor && h.phase !== 'boom' && (h.phase === 'fall' || h.phase === 'lava')) ? 1 : 0;
      case 'parcelNear': return G.hz.some(h => h instanceof Parcel && Math.abs(h.x - a) < 14) ? 1 : 0;
      case 'dialectCount': return DIALECT.length;
    }
  };
  // 그리기 이미지: 0 이 장애물의 spr · 1 이름 있는 스프라이트 · 2 크기별로 굽는 것 — 경로 한 단계는 배열 칸 · 좌우(0 r · 1 l) · -2 flip (-1 없음)
  const geval = eval, namedV = [];
  const named = i => namedV[i] ?? (namedV[i] = geval(HZ.named[i]));
  const step = (v, k) => k === -1 ? v : k === -2 ? v.flip : Array.isArray(v) ? v[k] : k ? v.l : v.r;
  const GEN = [(hh, left) => slashSprite(hh)[left ? 'l' : 'r'], h => oreumSprite(h), (hi, f, dir) => tideSprite(!!hi, f, dir), () => crateSprite()];
  const imgOf = (src, id, a, b, c, h = cur && cur.h) => src === 2 ? GEN[id](a, b, c) : step(step(src === 0 ? h.spr : named(id), a), b);
  HZ.img = imgOf;
  HZ.imgProp = (src, id, a, b, c, p) => {
    const im = imgOf(src, id, a, b, c), k = HZ.props[p];
    if (k === 'flip') return im.flip ? 1 : 0;
    const v = k === 'geo.tip0' ? im.geo.tip[0] : k === 'geo.tip1' ? im.geo.tip[1] : k.startsWith('geo.') ? im.geo[k.slice(4)] : im[k];
    return v ?? NaN;
  };
  // 그리기 명령 실행 (번호 · 인자는 wasm/src/draw.rs Draw)
  const IMG_ARGS = { 8: 2, 9: 4, 10: 8 };
  const runDraw = (q, h) => {
    for (let i = 0; i < q.length;) {
      const op = q[i];
      switch (op) {
        case 0: g.fillRect(q[i + 1], q[i + 2], q[i + 3], q[i + 4]); i += 5; break;
        case 1: g.fillStyle = hzCol(q[i + 1]); i += 2; break;
        case 2: g.fillStyle = `rgba(${q[i + 1]},${q[i + 2]},${q[i + 3]},${q[i + 4]})`; i += 5; break;
        case 3: g.fillStyle = mix(hzCol(q[i + 1]), hzCol(q[i + 2]), q[i + 3]); i += 4; break;
        case 4: g.globalAlpha = q[i + 1]; i += 2; break;
        case 5: g.save(); i += 1; break;
        case 6: g.restore(); i += 1; break;
        case 7: g.beginPath(); g.rect(q[i + 1], q[i + 2], q[i + 3], q[i + 4]); g.clip(); i += 5; break;
        case 8: case 9: case 10: {
          let im = imgOf(q[i + 1], q[i + 2], q[i + 3], q[i + 4], q[i + 5], h); const sil = q[i + 6], n = IMG_ARGS[op];
          if (!Number.isNaN(sil)) im = silOf(im, hzCol(sil));
          g.drawImage(im, ...q.subarray(i + 7, i + 7 + n)); i += 7 + n; break;
        }
        case 11: drawShadow(q[i + 1], q[i + 2]); i += 3; break;
        case 12: topMark(q[i + 1], q[i + 2]); i += 3; break;
        case 13: edgeChev(q[i + 1], q[i + 2], hzCol(q[i + 3])); i += 4; break;
        case 14: light(q[i + 1], q[i + 2], q[i + 3], hzCol(q[i + 4]), q[i + 5]); i += 6; break;
        case 15: disc(g, q[i + 1], q[i + 2], q[i + 3], hzCol(q[i + 4])); i += 5; break;
        case 16: pxLine(q[i + 1], q[i + 2], q[i + 3], q[i + 4], q[i + 5], hzCol(q[i + 6])); i += 7; break;
        case 17: drawStr(HZ.strs[q[i + 1]], q[i + 2], q[i + 3], { color: hzCol(q[i + 4]), align: 'center' }); i += 5; break;
        case 18: { const [im, ox, oy] = h.funnelImg(q[i + 1]); g.drawImage(im, ox, oy); i += 2; break; }
        case 19: disc(g, q[i + 1], q[i + 2], q[i + 3], mix(hzCol(q[i + 4]), hzCol(q[i + 5]), q[i + 6])); i += 7; break;
        default: throw new Error('그리기 명령 번호 ' + op);
      }
    }
  };
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
    // 효과음: 이름 목록 · i번째 효과음 내기 (너무 잦으면 건너뛰도록 지금 시각을 같이 넘김)
    sfxNames() { return JSON.parse(new TextDecoder().decode(u8(ex.sfx_names(), ex.sfx_names_len()))); },
    sfx(i, a, b) { ex.sfx_play(i, a, b, performance.now()); },
    musicSong(i) { ex.music_song(i); },
    musicStep(s, tempo, calm, hip, key, varied, accent, hipVar, play) {
      const n = ex.music_step(s, tempo, calm ? 1 : 0, hip ? 1 : 0, key, varied ? 1 : 0, accent ? 1 : 0, hipVar), b = new Float64Array(ex.memory.buffer, ex.music_buf(), n * 9);
      for (let i = 0; i < n; i++) play(...b.subarray(i * 9, i * 9 + 9));
    },
    // 장애물 한 스텝 (살아 있으면 true) · 판정 상자 [{ x, y, w, h }] · 맞았을 때 (ev: 'shot' 귤 · 'stomp' 밟힘 · 'bounce' 밟고 튀어 오름)
    hzUpdate(h, kind, dt) { return call(h, kind, (k, n) => ex.hz_update(k, hzBuf, n, dt)); },
    hzBoxes(h, kind) {
      const K = HZ.kinds[kind], len = pack(h, K); setCtx(); const n = ex.hz_boxes(kindIdx[kind], hzBuf, len, boxBuf); if (!n) return NONE;
      const b = new Float64Array(ex.memory.buffer, boxBuf, n * 4), out = []; for (let i = 0; i < n; i++) out.push({ x: b[i * 4], y: b[i * 4 + 1], w: b[i * 4 + 2], h: b[i * 4 + 3] });
      return out;
    },
    hzOn(h, kind, ev, sx = 0, sy = 0) { return call(h, kind, (k, n) => ex.hz_on(k, hzBuf, n, HZ.events.indexOf(ev), sx, sy)); },
    // 패턴 한 스텝 · 경고가 끝났을 때 남겨 둔 동작
    patUpdate(h, kind, dt) { const K = PT.kinds[kind], n = pack(h, K); setCtx(); const prev = cur; cur = { h, K, kind }; fresh = []; ex.pat_update(patIdx[kind], hzBuf, n, dt); cur = prev; unpack(h, K); },
    patAction(kind, act, a, b, c, d) { setCtx(); const prev = cur; cur = { h: null, K: null, kind }; fresh = []; ex.pat_action(patIdx[kind], act, a, b, c, d); cur = prev; },
    // 그리기 (which 0: 그림 · 1: 땅에 먼저 깔리는 예고) — Rust가 명령을 쌓으면 여기서 캔버스에 찍음
    hzDraw(h, kind, which) {
      const K = HZ.dkinds[kind], n = pack(h, K); setCtx(); cur = { h, K };
      const m = ex.hz_draw(kindIdx[kind], hzBuf, n, which); cur = null; unpack(h, K);
      runDraw(new Float64Array(ex.memory.buffer, ex.hz_cmds(), m).slice(), h);
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
