// 픽셀 제주 WASM 엔진 — js/wasm.js가 부름
//  배경 장면(scene · scn_*) · 스프라이트(spr) · 배경음악 작곡(music) · 회오리(funnel) · 파티클(fx) · 숨비 이동(player) · 글자(text)
//  원래 JS와 같은 그림이 나오게 식 순서 · 반올림 · 난수 순서까지 그대로 옮김
// 원래 JS를 그대로 옮긴 코드라 일부러 지키는 것들
#![allow(clippy::approx_constant)] // JS 원본의 6.283 · 6.28을 그대로 씀 (TAU로 바꾸면 그림이 달라짐)
#![allow(clippy::missing_safety_doc)] // 내보낸 함수는 js/wasm.js가 넘긴 포인터 · 길이를 믿음
#![allow(clippy::too_many_arguments)] // JS 함수 모양 그대로 (그리기 인자가 많음)

mod basalt;
mod cave;
mod cliff;
mod draw;
mod funnel;
mod fx;
mod game;
mod hz;
mod hz_air;
mod hz_event;
mod hz_ground;
mod hz_item;
mod js;
mod music;
mod noise;
mod pat;
mod pat_basic;
mod player;
mod scene;
mod scn_cave;
mod scn_place;
mod scn_theme;
mod sfx;
mod spr;
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
pub unsafe extern "C" fn dealloc(p: *mut u8, n: usize) {
    drop(Vec::from_raw_parts(p as *mut u64, 0, n.div_ceil(8).max(1)));
}

#[no_mangle]
pub unsafe extern "C" fn set_pal(slot: usize, p: *const u8, n: usize) {
    funnel::set_pal(slot, from_raw_parts(p, n * 3));
}

#[no_mangle]
pub unsafe extern "C" fn funnel(
    d: *mut u8,
    cw: i32,
    chh: i32,
    ox: f64,
    oy: f64,
    x: f64,
    t: f64,
    sp: f64,
    dir: f64,
    big: i32,
    form: f64,
    low: f64,
    full: f64,
) {
    let a = funnel::Args { cw, chh, ox, oy, x, t, sp, dir, big: big != 0, form, low, full };
    funnel::draw(from_raw_parts_mut(d, (cw * chh * 4) as usize), &a);
}

// 파티클: 한 칸 8개씩 n칸 (fx.rs)
#[no_mangle]
pub unsafe extern "C" fn fx_step(b: *mut f64, n: usize, dt: f64, t: f64) {
    fx::step(from_raw_parts_mut(b, n * 8), dt, t);
}

// 숨비: 걷기는 새 vx를 돌려주고, 낙하는 PLAYER 칸(12개)을 고쳐 씀
static mut PLAYER: [f64; 12] = [0.0; 12];
#[no_mangle]
pub extern "C" fn player_buf() -> *mut f64 {
    unsafe { std::ptr::addr_of_mut!(PLAYER) as *mut f64 }
}
#[no_mangle]
pub extern "C" fn player_walk(vx: f64, dir: f64, on_ground: i32, speed_up: f64, dt: f64) -> f64 {
    player::walk(vx, dir, on_ground != 0, speed_up, dt)
}
#[no_mangle]
pub unsafe extern "C" fn player_fall() {
    player::fall(&mut *std::ptr::addr_of_mut!(PLAYER));
}

// 글자: a는 알파 (w × h) · cols는 RGB 묶음 · bb는 경계 상자 4칸
#[no_mangle]
pub unsafe extern "C" fn text_sprite(
    a: *const u8,
    w: i32,
    h: i32,
    d: *mut u8,
    ow: i32,
    oh: i32,
    outline: i32,
    shadow: i32,
    cols: *const u8,
    bb: *mut i32,
) {
    let c = from_raw_parts(cols, 6);
    text::sprite(
        from_raw_parts(a, (w * h) as usize),
        w,
        h,
        from_raw_parts_mut(d, (ow * oh * 4) as usize),
        ow,
        if outline != 0 { Some([c[0], c[1], c[2]]) } else { None },
        shadow != 0,
        [c[3], c[4], c[5]],
        from_raw_parts_mut(bb, 4),
    );
}
#[no_mangle]
pub unsafe extern "C" fn word_sprite(a: *const u8, w: i32, h: i32, d: *mut u8, cols: *const u8) {
    let c = from_raw_parts(cols, 12);
    let rgb = |k: usize| [c[k * 3], c[k * 3 + 1], c[k * 3 + 2]];
    text::word(
        from_raw_parts(a, (w * h) as usize),
        w,
        h,
        from_raw_parts_mut(d, ((w + 4) * (h + 6) * 4) as usize),
        rgb(0),
        rgb(1),
        rgb(2),
        rgb(3),
    );
}
#[no_mangle]
pub unsafe extern "C" fn alpha_mask(d: *const u8, n: usize, thr: u8, m: *mut u8) {
    text::mask(from_raw_parts(d, n * 4), thr, from_raw_parts_mut(m, n));
}
#[no_mangle]
pub unsafe extern "C" fn mask_paint(m: *const u8, n: usize, r: u8, g: u8, b: u8, d: *mut u8) {
    text::paint(from_raw_parts(m, n), [r, g, b], from_raw_parts_mut(d, n * 4));
}

// ── 배경 장면 (scene · scn_*) ──────────────────────────────────
// 처음 한 번: 화면 폭과 시간대 · 팔레트 (JSON)
#[no_mangle]
pub unsafe extern "C" fn scene_init(w: f64, j: *const u8, n: usize) {
    scene::init(w, &scene::parse_json(from_raw_parts(j, n)));
    scn_cave::init_cvc();
}
static mut JSON_LEN: usize = 0;
fn finish() -> *const u8 {
    let (p, n) = scene::out_json();
    unsafe {
        JSON_LEN = n;
    }
    p
}
#[no_mangle]
pub extern "C" fn scene_json_len() -> usize {
    unsafe { JSON_LEN }
}
// 테마 한 시간대를 구워 층 목록(JSON) 위치를 돌려줌 · kind: 0 밭 · 1 성산 · 2 협재 · 3 귤밭 · 4 이호 · 5 정방 · 6 천지연 · 7 만장굴
#[no_mangle]
pub extern "C" fn scene_build(kind: i32, pi: usize) -> *const u8 {
    scene::out_clear();
    let k = ["field", "coast", "beach", "grove", "iho", "jeongbang", "cheonji", "cave"][kind.clamp(0, 7) as usize];
    if kind <= 2 {
        scn_theme::theme(k, pi);
    } else {
        scn_place::place(k, pi);
    }
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
#[no_mangle]
pub extern "C" fn scene_vignette() -> *const u8 {
    scene::out_clear();
    scene::out_push("vignette", scn_theme::vignette(), String::new());
    finish()
}
#[no_mangle]
pub extern "C" fn scene_free() {
    scene::out_clear();
}

// ── 스프라이트 (spr) ──────────────────────────────────────────
fn tree(t: String) -> *const u8 {
    scene::set_tree(t);
    finish()
}
// 고정 스프라이트 전부 (처음 한 번) → { 이름: 트리 }
#[no_mangle]
pub extern "C" fn spr_all() -> *const u8 {
    scene::out_clear();
    tree(spr::all())
}
// 게임 중에 처음 쓸 때 굽는 것
#[no_mangle]
pub extern "C" fn spr_crate() -> *const u8 {
    scene::out_clear();
    tree(spr::crate_())
}
#[no_mangle]
pub extern "C" fn spr_slash(hh: f64) -> *const u8 {
    scene::out_clear();
    tree(spr::slash(hh))
}
#[no_mangle]
pub extern "C" fn spr_oreum(h: f64) -> *const u8 {
    scene::out_clear();
    tree(spr::oreum(h))
}
#[no_mangle]
pub extern "C" fn spr_tide(hi: i32, f: f64) -> *const u8 {
    scene::out_clear();
    tree(spr::tide(hi != 0, f))
}
#[no_mangle]
pub extern "C" fn spr_wx(id: i32) -> *const u8 {
    scene::out_clear();
    tree(spr::wx(id))
}

// ── 배경음악 작곡 (music) ─────────────────────────────────────
#[no_mangle]
pub extern "C" fn music_song(k: i32) {
    music::set_song(if k < 0 { usize::MAX } else { k as usize });
}
// 8분음표 한 칸의 음표 수 (음표는 music_buf에서 9칸씩)
#[no_mangle]
pub extern "C" fn music_step(s: f64, tempo: f64, calm: i32, hip: i32, key: f64, varied: i32, accent: i32, hip_var: i32) -> usize {
    music::step(s as i64, tempo, calm != 0, hip != 0, key, varied != 0, accent != 0, hip_var.max(0) as usize);
    music::events().len() / 9
}
#[no_mangle]
pub extern "C" fn music_buf() -> *const f64 {
    music::events().as_ptr()
}

// ── 효과음 (sfx) ──────────────────────────────────────────────
static mut SFX_NAMES: String = String::new();
// 효과음 이름 목록 (JSON) 위치 · 길이
#[no_mangle]
pub extern "C" fn sfx_names() -> *const u8 {
    unsafe {
        SFX_NAMES = sfx::names_json();
        (*std::ptr::addr_of!(SFX_NAMES)).as_ptr()
    }
}
#[no_mangle]
pub extern "C" fn sfx_names_len() -> usize {
    unsafe { (*std::ptr::addr_of!(SFX_NAMES)).len() }
}
// 효과음 하나 내기 (a · b: 효과음마다 다른 인자, now: performance.now() — 너무 잦으면 건너뜀)
#[no_mangle]
pub extern "C" fn sfx_play(id: usize, a: f64, b: f64, now: f64) {
    sfx::play(id, a, b, now)
}

// ── 시작 ─────────────────────────────────────────────────────
#[link(wasm_import_module = "g")]
extern "C" {
    fn jpanic(p: *const u8, n: usize);
}
// 패닉 메시지를 브라우저 콘솔로 (panic = "abort"라 그대로 두면 'unreachable'만 보임)
#[no_mangle]
pub extern "C" fn start() {
    std::panic::set_hook(Box::new(|info| {
        let s = info.to_string();
        unsafe { jpanic(s.as_ptr(), s.len()) }
    }));
}

// ── 게임 규칙: 장애물 (game · hz · hz_*) ──────────────────────
static mut TABLES: String = String::new();
// 이름표 · 장애물 필드 목록 (JSON) 위치 · 길이
#[no_mangle]
pub extern "C" fn hz_tables() -> *const u8 {
    unsafe {
        TABLES = hz::tables_json();
        (*std::ptr::addr_of!(TABLES)).as_ptr()
    }
}
#[no_mangle]
pub extern "C" fn hz_tables_len() -> usize {
    unsafe { (*std::ptr::addr_of!(TABLES)).len() }
}
// 지금 판의 값을 JS가 써 넣는 자리 (game::Ctx 순서로 f64 CTX_LEN칸)
#[no_mangle]
pub extern "C" fn hz_ctx() -> *mut f64 {
    game::ctx_buf()
}
// 장애물 한 스텝: f는 필드 목록대로 담은 값 (제자리에서 고침) · 살아 있으면 1
#[no_mangle]
pub unsafe extern "C" fn hz_update(kind: usize, f: *mut f64, n: usize, dt: f64) -> i32 {
    (hz::KINDS[kind].update)(from_raw_parts_mut(f, n), dt) as i32
}
// 판정 상자: out에 4칸씩 · 상자 수
#[no_mangle]
pub unsafe extern "C" fn hz_boxes(kind: usize, f: *const f64, n: usize, out: *mut f64) -> usize {
    let b = (hz::KINDS[kind].boxes)(from_raw_parts(f, n));
    let o = from_raw_parts_mut(out, b.len() * 4);
    for (i, r) in b.iter().enumerate() {
        o[i * 4..i * 4 + 4].copy_from_slice(r);
    }
    b.len()
}
// 맞았을 때 (ev: 0 귤 · 1 밟힘 · 2 밟고 튀어 오름, sx · sy: 맞은 귤 자리) · 귤이 사라지면(튀어 오르면 점수가 나면) 1
#[no_mangle]
pub unsafe extern "C" fn hz_on(kind: usize, f: *mut f64, n: usize, ev: i32, sx: f64, sy: f64) -> i32 {
    hz::KINDS[kind].on.map(|on| on(from_raw_parts_mut(f, n), ev, sx, sy) as i32).unwrap_or(0)
}
static mut DRAW_CMDS: Vec<f64> = Vec::new();
// 장애물 그리기 (which 0: 그림 · 1: 땅에 먼저 깔리는 예고): f는 그리기 필드 목록대로 · 명령 수 (명령은 hz_cmds, 짜임은 draw.rs)
#[no_mangle]
pub unsafe extern "C" fn hz_draw(kind: usize, f: *mut f64, n: usize, which: i32) -> usize {
    let k = &hz::KINDS[kind];
    let mut d = draw::Draw::new();
    if let Some(fun) = if which == 0 { k.draw } else { k.decal } {
        fun(from_raw_parts_mut(f, n), &mut d);
    }
    DRAW_CMDS = d.q;
    (*std::ptr::addr_of!(DRAW_CMDS)).len()
}
#[no_mangle]
pub extern "C" fn hz_cmds() -> *const f64 {
    unsafe { (*std::ptr::addr_of!(DRAW_CMDS)).as_ptr() }
}

// ── 게임 규칙: 패턴 (pat · pat_*) ─────────────────────────────
static mut PAT_TABLES: String = String::new();
// 패턴 필드 목록 · 이름표 (JSON) 위치 · 길이
#[no_mangle]
pub extern "C" fn pat_tables() -> *const u8 {
    unsafe {
        PAT_TABLES = pat::tables_json();
        (*std::ptr::addr_of!(PAT_TABLES)).as_ptr()
    }
}
#[no_mangle]
pub extern "C" fn pat_tables_len() -> usize {
    unsafe { (*std::ptr::addr_of!(PAT_TABLES)).len() }
}
// 패턴 한 스텝 (f는 필드 목록대로, 제자리에서 고침)
#[no_mangle]
pub unsafe extern "C" fn pat_update(kind: usize, f: *mut f64, n: usize, dt: f64) {
    (pat::PATS[kind].update)(from_raw_parts_mut(f, n), dt)
}
// 경고가 끝났을 때 남겨 둔 동작 (원래 경고의 spawn 클로저)
#[no_mangle]
pub extern "C" fn pat_action(kind: usize, act: u32, a: f64, b: f64, c: f64, d: f64) {
    if let Some(action) = pat::PATS[kind].action {
        action(act, a, b, c, d)
    }
}
