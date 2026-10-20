// 픽셀 제주 WASM 엔진 — js/wasm.js가 부름
//  배경 장면(scene · scn_*) · 회오리(funnel) · 파티클(fx) · 숨비 이동(player) · 글자(text)
//  원래 JS와 같은 그림이 나오게 식 순서 · 반올림 · 난수 순서까지 그대로 옮김
mod basalt;
mod cave;
mod cliff;
mod funnel;
mod fx;
mod js;
mod noise;
mod player;
mod scene;
mod scn_cave;
mod scn_place;
mod scn_theme;
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

#[no_mangle] pub unsafe extern "C" fn set_pal(slot: usize, p: *const u8, n: usize) { funnel::set_pal(slot, from_raw_parts(p, n * 3)); }

#[no_mangle]
#[allow(clippy::too_many_arguments)]
pub unsafe extern "C" fn funnel(d: *mut u8, cw: i32, chh: i32, ox: f64, oy: f64, x: f64, t: f64, sp: f64, dir: f64, big: i32, form: f64, low: f64, full: f64) {
    let a = funnel::Args { cw, chh, ox, oy, x, t, sp, dir, big: big != 0, form, low, full };
    funnel::draw(from_raw_parts_mut(d, (cw * chh * 4) as usize), &a);
}

// 파티클: 한 칸 8개씩 n칸 (fx.rs)
#[no_mangle] pub unsafe extern "C" fn fx_step(b: *mut f64, n: usize, dt: f64, t: f64) { fx::step(from_raw_parts_mut(b, n * 8), dt, t); }

// 숨비: 걷기는 새 vx를 돌려주고, 낙하는 PLAYER 칸(12개)을 고쳐 씀
static mut PLAYER: [f64; 12] = [0.0; 12];
#[no_mangle] pub extern "C" fn player_buf() -> *mut f64 { unsafe { std::ptr::addr_of_mut!(PLAYER) as *mut f64 } }
#[no_mangle] pub extern "C" fn player_walk(vx: f64, dir: f64, on_ground: i32, speed_up: f64, dt: f64) -> f64 { player::walk(vx, dir, on_ground != 0, speed_up, dt) }
#[no_mangle] pub unsafe extern "C" fn player_fall() { player::fall(&mut *std::ptr::addr_of_mut!(PLAYER)); }

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

// ── 배경 장면 (scene · scn_*) ──────────────────────────────────
// 처음 한 번: 화면 폭과 시간대 · 팔레트 (JSON)
#[no_mangle] pub unsafe extern "C" fn scene_init(w: f64, j: *const u8, n: usize) { scene::init(w, &scene::parse_json(from_raw_parts(j, n))); scn_cave::init_cvc(); }
static mut JSON_LEN: usize = 0;
fn finish() -> *const u8 { let (p, n) = scene::out_json(); unsafe { JSON_LEN = n; } p }
#[no_mangle] pub extern "C" fn scene_json_len() -> usize { unsafe { JSON_LEN } }
// 테마 한 시간대를 구워 층 목록(JSON) 위치를 돌려줌 · kind: 0 밭 · 1 성산 · 2 협재 · 3 귤밭 · 4 이호 · 5 정방 · 6 천지연 · 7 만장굴
#[no_mangle]
pub extern "C" fn scene_build(kind: i32, pi: usize) -> *const u8 {
    scene::out_clear();
    let k = ["field", "coast", "beach", "grove", "iho", "jeongbang", "cheonji", "cave"][kind.clamp(0, 7) as usize];
    if kind <= 2 { scn_theme::theme(k, pi); } else { scn_place::place(k, pi); }
    finish()
}
// 구름 하나 (pal: RGB 묶음)
#[no_mangle]
pub unsafe extern "C" fn scene_cloud(w: f64, h: f64, seed: f64, pal: *const u8, n: usize) -> *const u8 {
    scene::out_clear();
    let p: Vec<[u8; 3]> = from_raw_parts(pal, n * 3).chunks(3).map(|c| [c[0], c[1], c[2]]).collect();
    scene::out_push("cloud", scn_theme::cloud(w, h, seed, &p), String::new());
    finish()
}
#[no_mangle] pub extern "C" fn scene_vignette() -> *const u8 { scene::out_clear(); scene::out_push("vignette", scn_theme::vignette(), String::new()); finish() }
#[no_mangle] pub extern "C" fn scene_free() { scene::out_clear(); }
