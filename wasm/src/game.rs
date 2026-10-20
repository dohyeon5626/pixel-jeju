// 게임 규칙을 Rust로 옮기는 다리 (장애물 hz_* 모듈이 씀)
//  - 장애물 상태는 JS 객체에 그대로 두고, 부를 때마다 정해진 필드 목록(SCHEMA)대로 f64 배열에 담아 주고받음
//  - 효과(파티클 · 소리 · 흔들림 · 점수)와 난수는 JS 함수를 그 자리에서 바로 부름 → Math.random 순서까지 원래 JS와 같음
use crate::js::*;

#[link(wasm_import_module = "g")]
extern "C" {
    fn jrand() -> f64;
    fn jfx(kind: f64, x: f64, y: f64, vx: f64, vy: f64, grav: f64, drag: f64, life: f64, size: f64, col: f64, big: f64, len: f64);
    fn jburst(x: f64, y: f64, n: f64, spd: f64, life: f64, grav: f64, kind: f64, ncols: f64, c0: f64, c1: f64, c2: f64, c3: f64);
    fn jdust(x: f64, y: f64, n: f64, dir: f64, big: f64);
    fn jlight(x: f64, y: f64, r: f64, col: f64, a: f64);
    fn jsfx(id: f64, arg: f64);
    fn jshake(t: f64);
    fn jspark(x: f64, y: f64);
    fn jimpact(x: f64, y: f64, col: f64, power: f64, quiet: f64);
    fn jhitstop(t: f64, cd: f64);
    fn jreward(kind: f64, x: f64, y: f64);
    fn jdecal(x: f64, life: f64);
}

pub const GROUND: f64 = 156.0;
pub const VOFF: f64 = 60.0;

// ── 이름표: JS가 처음에 받아 가서 번호 ↔ 이름을 바꿈 ──────────
pub const FX_KINDS: [&str; 10] = ["px", "chunk", "puff", "spark", "ring", "flare", "smoke", "ember", "trail", "streak"];
pub const SFX: [&str; 7] = ["crack", "rise", "hop", "shatter", "gallop", "tink", "boom"];
pub const REWARDS: [&str; 3] = ["stompKill", "shotKill", "shatter"];
pub const PALS: [&str; 10] = ["soil", "stone", "yel", "org", "red", "teal", "leaf", "cloth", "wood", "skin"];
fn idx(list: &[&str], k: &str) -> f64 {
    list.iter().position(|x| *x == k).expect("이름표에 없음") as f64
}

// ── 색: 0 이상이면 0xRRGGBB, 음수면 팔레트 C[이름][칸] ────────
pub fn hexc(rgb: u32) -> f64 {
    rgb as f64
}
pub fn pc(pal: &str, i: usize) -> f64 {
    -((idx(&PALS, pal) as usize * 16 + i) as f64) - 1.0
}

// ── 지금 판의 값 (JS가 부를 때마다 넘김) ─────────────────────
pub struct Ctx {
    pub w: f64,
    pub px: f64,
}
static mut CTX: Ctx = Ctx { w: 426.0, px: 0.0 };
pub fn ctx() -> &'static Ctx {
    unsafe { &*std::ptr::addr_of!(CTX) }
}
pub fn set_ctx(w: f64, px: f64) {
    unsafe {
        CTX = Ctx { w, px };
    }
}

// ── 난수 (원래 JS rand · randi · pick) ────────────────────────
pub fn random() -> f64 {
    unsafe { jrand() }
}
pub fn rand(a: f64, b: f64) -> f64 {
    a + random() * (b - a)
}
pub fn randi(a: f64, b: f64) -> f64 {
    rand(a, b + 1.0).floor()
}
pub fn pick(a: &[f64]) -> f64 {
    a[(random() * a.len() as f64).floor() as usize]
}
pub fn lerp(a: f64, b: f64, t: f64) -> f64 {
    a + (b - a) * t
}
pub fn ease_back(t: f64) -> f64 {
    let t = clamp(t, 0.0, 1.0);
    let s = 1.7;
    1.0 + (s + 1.0) * pow(t - 1.0, 3.0) + s * pow(t - 1.0, 2.0)
}

// ── 효과 (원래 JS fx · burst · dust …) ────────────────────────
// fx 하나: 빠진 값은 원래 fx()의 기본값 (vx · vy · grav · drag 0, life 0.5, size 1, 색 #fff4e0)
pub struct Fx {
    pub kind: &'static str,
    pub x: f64,
    pub y: f64,
    pub vx: f64,
    pub vy: f64,
    pub grav: f64,
    pub drag: f64,
    pub life: f64,
    pub size: f64,
    pub col: f64,
    pub big: bool,
    pub len: f64,
}
impl Fx {
    pub fn new(kind: &'static str, x: f64, y: f64) -> Self {
        Fx { kind, x, y, vx: 0.0, vy: 0.0, grav: 0.0, drag: 0.0, life: 0.5, size: 1.0, col: hexc(0xfff4e0), big: false, len: 0.0 }
    }
    pub fn emit(self) {
        unsafe {
            jfx(
                idx(&FX_KINDS, self.kind),
                self.x,
                self.y,
                self.vx,
                self.vy,
                self.grav,
                self.drag,
                self.life,
                self.size,
                self.col,
                self.big as i32 as f64,
                self.len,
            )
        }
    }
}
pub fn burst(x: f64, y: f64, n: f64, cols: &[f64], spd: f64, life: f64, grav: f64, kind: &str) {
    let c = |i: usize| cols.get(i).copied().unwrap_or(0.0);
    unsafe { jburst(x, y, n, spd, life, grav, idx(&FX_KINDS, kind), cols.len() as f64, c(0), c(1), c(2), c(3)) }
}
pub fn dust(x: f64, y: f64, n: f64, dir: f64, big: f64) {
    unsafe { jdust(x, y, n, dir, big) }
}
pub fn light(x: f64, y: f64, r: f64, col: f64, a: f64) {
    unsafe { jlight(x, y, r, col, a) }
}
pub fn sfx(name: &str) {
    unsafe { jsfx(idx(&SFX, name), 0.0) }
}
pub fn shake(t: f64) {
    unsafe { jshake(t) }
}
pub fn spark(x: f64, y: f64) {
    unsafe { jspark(x, y) }
}
pub fn impact(x: f64, y: f64, col: f64, power: f64, quiet: bool) {
    unsafe { jimpact(x, y, col, power, quiet as i32 as f64) }
}
pub fn hitstop(t: f64, cd: f64) {
    unsafe { jhitstop(t, cd) }
}
pub fn reward(kind: &str, x: f64, y: f64) {
    unsafe { jreward(idx(&REWARDS, kind), x, y) }
}
pub fn decal(x: f64, life: f64) {
    unsafe { jdecal(x, life) }
}

// ── 장애물 필드 ───────────────────────────────────────────────
// 필드 종류: 숫자 · 참거짓 · 이름(단계 같은 문자열, 목록 안 번호로 주고받음)
pub enum Ty {
    Num,
    Bool,
    Enum(&'static [&'static str]),
}
pub type Schema = &'static [(&'static str, Ty)];
// 판정 상자 (x · y · w · h)
pub type Boxes = Vec<[f64; 4]>;

// 이름표 · 장애물 필드 목록을 JSON으로 (JS가 처음에 한 번 읽음)
pub fn tables_json(kinds: &[(&str, Schema)]) -> String {
    let list = |v: &[&str]| format!("[{}]", v.iter().map(|s| format!("\"{}\"", s)).collect::<Vec<_>>().join(","));
    let ty = |t: &Ty| match t {
        Ty::Num => "\"n\"".to_string(),
        Ty::Bool => "\"b\"".to_string(),
        Ty::Enum(v) => list(v),
    };
    let kinds = kinds
        .iter()
        .map(|(k, s)| format!("\"{}\":[{}]", k, s.iter().map(|(n, t)| format!("[\"{}\",{}]", n, ty(t))).collect::<Vec<_>>().join(",")))
        .collect::<Vec<_>>()
        .join(",");
    format!(
        "{{\"fx\":{},\"sfx\":{},\"rewards\":{},\"pals\":{},\"kinds\":{{{}}}}}",
        list(&FX_KINDS),
        list(&SFX),
        list(&REWARDS),
        list(&PALS),
        kinds
    )
}
