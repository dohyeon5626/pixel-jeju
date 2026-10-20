// 픽셀 제주 WASM 커널 — js/wasm.js가 부름
//  JS와 같은 그림이 나와야 해서 식 순서까지 원래 JS 그대로 옮김 (바꿀 땐 양쪽 다)
mod basalt;
mod cave;
mod cliff;
mod funnel;
mod fx;
mod js;
mod noise;
mod player;
mod text;
mod tree;

use std::slice::{from_raw_parts, from_raw_parts_mut};

// JS가 쓰는 메모리 칸 (8바이트 정렬 · Float64Array로도 읽게)
#[no_mangle]
pub extern "C" fn alloc(n: usize) -> *mut u8 {
    let mut v = Vec::<u64>::with_capacity(n.div_ceil(8).max(1));
    let p = v.as_mut_ptr() as *mut u8;
    std::mem::forget(v);
    p
}
#[no_mangle]
pub unsafe extern "C" fn dealloc(p: *mut u8, n: usize) { drop(Vec::from_raw_parts(p as *mut u64, 0, n.div_ceil(8).max(1))); }

#[no_mangle] pub extern "C" fn hash2(x: f64, y: f64, s: f64) -> f64 { noise::hash2(x, y, s) }
#[no_mangle] pub extern "C" fn vnoise(x: f64, y: f64, s: f64) -> f64 { noise::vnoise(x, y, s) }

#[no_mangle] pub unsafe extern "C" fn set_cvc(p: *const u8) { cave::set_cvc(from_raw_parts(p, 231)); }
#[no_mangle] pub unsafe extern "C" fn set_pal(slot: usize, p: *const u8, n: usize) { funnel::set_pal(slot, from_raw_parts(p, n * 3)); }

#[no_mangle] pub unsafe extern "C" fn cave_wall(d: *mut u8, w: usize, day: f64) { cave::wall(from_raw_parts_mut(d, w * 200 * 4), w, day); }
#[no_mangle] pub unsafe extern "C" fn cave_column(d: *mut u8, lw: i32, sh: f64) { cave::column(from_raw_parts_mut(d, lw as usize * 200 * 4), lw, sh); }
#[no_mangle] pub unsafe extern "C" fn cave_near(d: *mut u8, lw: i32, sh: f64) { cave::near(from_raw_parts_mut(d, lw as usize * 160 * 4), lw, sh); }
#[no_mangle] pub unsafe extern "C" fn cave_ground(d: *mut u8, lw: i32, h: i32) { cave::ground(from_raw_parts_mut(d, (lw * h * 4) as usize), lw, h); }

// md: 마스크 알파 (w * h) · d: RGBA (제자리) · wx: x0..=x1의 휜 좌표 · ramp/moss: RGB 묶음
#[no_mangle]
#[allow(clippy::too_many_arguments)]
pub unsafe extern "C" fn basalt_wall(md: *const u8, d: *mut u8, w: i32, h: i32, x0: i32, x1: i32, y_top: f64, y_bot: f64, seed: f64, wx: *const f64, ramp: *const u8, ramp_n: usize, rag: f64, moss: f64, moss_cols: *const u8) {
    let n = (w * h) as usize;
    let o = basalt::Opt { ramp: from_raw_parts(ramp, ramp_n * 3), rag, moss, moss_cols: from_raw_parts(moss_cols, 6) };
    basalt::wall(from_raw_parts(md, n), from_raw_parts_mut(d, n * 4), w, h, x0, x1, y_top, y_bot, seed, from_raw_parts(wx, (x1 - x0 + 1) as usize), &o);
}

#[no_mangle]
#[allow(clippy::too_many_arguments)]
pub unsafe extern "C" fn funnel(d: *mut u8, cw: i32, chh: i32, ox: f64, oy: f64, x: f64, t: f64, sp: f64, dir: f64, big: i32, form: f64, low: f64, full: f64) {
    let a = funnel::Args { cw, chh, ox, oy, x, t, sp, dir, big: big != 0, form, low, full };
    funnel::draw(from_raw_parts_mut(d, (cw * chh * 4) as usize), &a);
}

// d: RGBA (size * size) · blobs: [x, y, r] 묶음 · ramp: RGB 묶음
#[no_mangle]
#[allow(clippy::too_many_arguments)]
pub unsafe extern "C" fn tree_blobs(d: *mut u8, size: i32, blobs: *const f64, n: usize, rcx: f64, rcy: f64, r: f64, fl: f64, ramp: *const u8, ramp_n: usize) {
    tree::blobs(from_raw_parts_mut(d, (size * size * 4) as usize), size, from_raw_parts(blobs, n * 3), rcx, rcy, r, fl, from_raw_parts(ramp, ramp_n * 3));
}

// 동굴 천장: edge는 열마다 천장 아래 끝 · cols: RGB 묶음 [하늘 위, 하늘 아래, 풀 3단, 흙, 바위]
#[no_mangle]
pub unsafe extern "C" fn cave_ceil(d: *mut u8, lw: i32, sh: f64, edge: *const f64, day: f64, night: i32, cols: *const u8) {
    let c = from_raw_parts(cols, 21); let rgb = |k: usize| [c[k * 3], c[k * 3 + 1], c[k * 3 + 2]];
    let o = cave::Ceil { edge: from_raw_parts(edge, lw as usize), day, night: night != 0, sky_t: rgb(0), sky_b: rgb(1), gr: [rgb(2), rgb(3), rgb(4)], dirt: rgb(5), rock: rgb(6) };
    cave::ceil(from_raw_parts_mut(d, lw as usize * 200 * 4), lw, sh, &o);
}
#[no_mangle]
pub unsafe extern "C" fn cave_shaft(d: *mut u8, lw: i32, sh: f64, r: u8, g: u8, b: u8, a0: f64) { cave::shaft(from_raw_parts_mut(d, lw as usize * 200 * 4), lw, sh, [r, g, b], a0); }

// 파티클: 한 칸 8개씩 n칸 (fx.rs)
#[no_mangle] pub unsafe extern "C" fn fx_step(b: *mut f64, n: usize, dt: f64, t: f64) { fx::step(from_raw_parts_mut(b, n * 8), dt, t); }

// 숨비: 걷기는 새 vx를 돌려주고, 낙하는 PLAYER 칸(12개)을 고쳐 씀
static mut PLAYER: [f64; 12] = [0.0; 12];
#[no_mangle] pub extern "C" fn player_buf() -> *mut f64 { unsafe { std::ptr::addr_of_mut!(PLAYER) as *mut f64 } }
#[no_mangle] pub extern "C" fn player_walk(vx: f64, dir: f64, on_ground: i32, speed_up: f64, dt: f64) -> f64 { player::walk(vx, dir, on_ground != 0, speed_up, dt) }
#[no_mangle] pub unsafe extern "C" fn player_fall() { player::fall(&mut *std::ptr::addr_of_mut!(PLAYER)); }

// 동굴 갈래 굴: d는 굴 둘레를 잘라 온 RGBA (w × h는 JS와 같은 식)
#[no_mangle] pub unsafe extern "C" fn cave_passage(d: *mut u8, n: usize, scr_w: f64) { cave::passage(from_raw_parts_mut(d, n), scr_w); }

// 천지연 절벽 밝기: 열 ia부터 n개 (f · y0 · y1)
#[no_mangle]
#[allow(clippy::too_many_arguments)]
pub unsafe extern "C" fn cliff_shade(d: *mut u8, lw: i32, h: i32, ia: i32, n: usize, f: *const f64, y0: *const f64, y1: *const f64, cxa: f64) {
    cliff::shade(from_raw_parts_mut(d, (lw * h * 4) as usize), lw, ia, from_raw_parts(f, n), from_raw_parts(y0, n), from_raw_parts(y1, n), cxa);
}

// 글자: a는 알파 (w × h) · cols는 RGB 묶음 · bb는 경계 상자 4칸
#[no_mangle]
#[allow(clippy::too_many_arguments)]
pub unsafe extern "C" fn text_sprite(a: *const u8, w: i32, h: i32, d: *mut u8, ow: i32, oh: i32, outline: i32, shadow: i32, cols: *const u8, bb: *mut i32) {
    let c = from_raw_parts(cols, 6);
    text::sprite(from_raw_parts(a, (w * h) as usize), w, h, from_raw_parts_mut(d, (ow * oh * 4) as usize), ow, if outline != 0 { Some([c[0], c[1], c[2]]) } else { None }, shadow != 0, [c[3], c[4], c[5]], from_raw_parts_mut(bb, 4));
}
#[no_mangle]
pub unsafe extern "C" fn word_sprite(a: *const u8, w: i32, h: i32, d: *mut u8, cols: *const u8) {
    let c = from_raw_parts(cols, 12); let rgb = |k: usize| [c[k * 3], c[k * 3 + 1], c[k * 3 + 2]];
    text::word(from_raw_parts(a, (w * h) as usize), w, h, from_raw_parts_mut(d, ((w + 4) * (h + 6) * 4) as usize), rgb(0), rgb(1), rgb(2), rgb(3));
}
#[no_mangle] pub unsafe extern "C" fn alpha_mask(d: *const u8, n: usize, thr: u8, m: *mut u8) { text::mask(from_raw_parts(d, n * 4), thr, from_raw_parts_mut(m, n)); }
#[no_mangle] pub unsafe extern "C" fn mask_paint(m: *const u8, n: usize, r: u8, g: u8, b: u8, d: *mut u8) { text::paint(from_raw_parts(m, n), [r, g, b], from_raw_parts_mut(d, n * 4)); }
