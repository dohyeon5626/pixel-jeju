// 픽셀 제주 WASM 커널 — js/wasm.js가 부름
//  JS와 같은 그림이 나와야 해서 식 순서까지 원래 JS 그대로 옮김 (바꿀 땐 양쪽 다)
mod basalt;
mod cave;
mod funnel;
mod js;
mod noise;
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
