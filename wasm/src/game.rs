// 게임 규칙을 Rust로 옮기는 다리 (장애물 hz_* 모듈이 씀)
//  - 장애물 상태는 JS 객체에 그대로 두고, 부를 때마다 정해진 필드 목록(SCHEMA)대로 f64 배열에 담아 주고받음
//  - 효과(파티클 · 소리 · 흔들림 · 점수)와 난수는 JS 함수를 그 자리에서 바로 부름 → Math.random 순서까지 원래 JS와 같음
use crate::js::*;

#[link(wasm_import_module = "g")]
extern "C" {
    fn jrand() -> f64;
    fn jfx(
        kind: f64,
        x: f64,
        y: f64,
        vx: f64,
        vy: f64,
        grav: f64,
        drag: f64,
        life: f64,
        size: f64,
        col: f64,
        big: f64,
        len: f64,
        near: f64,
    );
    fn jburst(x: f64, y: f64, n: f64, spd: f64, life: f64, grav: f64, kind: f64, ncols: f64, c0: f64, c1: f64, c2: f64, c3: f64);
    fn jdust(x: f64, y: f64, n: f64, dir: f64, big: f64);
    fn jlight(x: f64, y: f64, r: f64, col: f64, a: f64);
    fn jsfx(id: f64, a: f64, b: f64);
    fn jshake(t: f64);
    fn jspark(x: f64, y: f64);
    fn jimpact(x: f64, y: f64, col: f64, power: f64, quiet: f64);
    fn jhitstop(t: f64, cd: f64);
    fn jreward(kind: f64, x: f64, y: f64);
    fn jdecal(x: f64, life: f64, mark: f64);
    fn jhook(id: f64, a: f64, b: f64, c: f64, d: f64) -> f64;
}

pub const GROUND: f64 = 156.0;
pub const VOFF: f64 = 60.0;

// ── 이름표: JS가 처음에 받아 가서 번호 ↔ 이름을 바꿈 ──────────
pub const FX_KINDS: [&str; 12] = ["px", "chunk", "puff", "spark", "ring", "flare", "smoke", "ember", "trail", "streak", "rain", "petal"];
pub const SFX: [&str; 33] = [
    "crack", "rise", "hop", "shatter", "gallop", "tink", "boom", "hit", "splat", "throw", "chirp", "thud", "whoosh", "caw", "oink", "honk",
    "gull", "pop", "burst", "letter", "stab", "splash", "wave", "zap", "thunder", "gust", "alarm", "buzz", "erupt", "neigh", "roll",
    "rumble", "shutter",
];
pub const REWARDS: [&str; 4] = ["stompKill", "shotKill", "shatter", "bigShatter"];
pub const PALS: [&str; 10] = ["soil", "stone", "yel", "org", "red", "teal", "leaf", "cloth", "wood", "skin"];
// JS 쪽 일 (글자 · 새 객체 · 사운드 덕킹처럼 Rust가 못 하는 것): 부르기 전에 JS가 지금 장애물 객체를 최신 값으로 맞춰 둠
//  daily(글) · popup(글, x, y, 색) · tang(x, y, vx, vy) · splash(x, 크기) · glyphs(x, y) · split() · kick(dx, dy) · duck(t) · mean(x, y)
//  label(x, y, 색) · flash(t, 색) · bolt() · ripple(x, dir) · gset(G 필드, 값) · beatLead(d) → 초
pub const HOOKS: [&str; 15] =
    ["daily", "popup", "tang", "splash", "glyphs", "split", "kick", "duck", "mean", "label", "flash", "bolt", "ripple", "gset", "beatLead"];
// hook에 넘기는 글 · 팔레트에 없는 CSS 색 · gset으로 고치는 G 필드
pub const STRS: [&str; 11] = ["bee", "+귤", "격파", "×", "+♥", "방패", "귤+5", "점수×2", "귤자석", "삼다수", "+1"];
pub const CSS: [&str; 10] = [
    "rgba(255,244,224,0.45)",
    "rgba(255,244,224,0.5)",
    "rgba(255,244,224,0.8)",
    "rgba(150,130,105,0.6)",
    "rgba(220,226,240,0.45)",
    "rgba(200,210,230,0.45)",
    "rgba(255,200,180,0.45)",
    "rgba(205,220,245,0.7)",
    "rgba(165,180,215,0.35)",
    "rgba(225,232,245,0.4)",
];
pub const GFIELDS: [&str; 6] = ["windTarget", "storm", "stormHold", "stormDir", "lightning", "dark"];
pub fn idx(list: &[&str], k: &str) -> f64 {
    list.iter().position(|x| *x == k).expect("이름표에 없음") as f64
}

// ── 색: 0 이상이면 0xRRGGBB (0x1000000을 더하면 mute한 색 · 0x2000000은 채도 0.85로 mute), -1 ~ -999는 팔레트 C[이름][칸], -1000부터는 CSS 목록 ──
pub fn hexc(rgb: u32) -> f64 {
    rgb as f64
}
pub fn muted(rgb: u32) -> f64 {
    (rgb | 0x1000000) as f64
}
// mute(색, 0.85) (파도 TIDE 팔레트)
pub fn muted85(rgb: u32) -> f64 {
    (rgb | 0x2000000) as f64
}
// 먹선 (JS INK = C.ink)
pub const INK: f64 = 0x201614 as f64;
pub fn css(s: &str) -> f64 {
    -1000.0 - idx(&CSS, s)
}
pub fn pc(pal: &str, i: usize) -> f64 {
    -((idx(&PALS, pal) as usize * 16 + i) as f64) - 1.0
}

// ── 지금 판의 값 (JS가 부르기 전에 CTX_BUF에 씀) ──
//  화면 폭 · 숨비 자리 · 숨비 죽음 · 경기장 양 끝 · 속도 배율 · 귤자석 남은 시간 · 음악 템포(없으면 0) · 단계 · 먹구름 · 번개 · 화면 시간(amb.t)
//  · 난이도(G.diff) · 지금 패턴 수 · 동굴 같은 실내 테마 · 정전 어둠(G.dark)
pub struct Ctx {
    pub w: f64,
    pub px: f64,
    pub py: f64,
    pub p_dead: bool,
    pub arena_l: f64,
    pub arena_r: f64,
    pub speed: f64,
    pub magnet: f64,
    pub tempo: f64,
    pub tier: f64,
    pub storm: f64,
    pub lightning: f64,
    pub amb_t: f64,
    pub diff: f64,
    pub npat: f64,
    pub indoor: bool,
    pub dark: f64,
}
pub const CTX_LEN: usize = 17;
static mut CTX_BUF: [f64; CTX_LEN] = [426.0, 0.0, 0.0, 0.0, 0.0, 426.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
pub fn ctx_buf() -> *mut f64 {
    unsafe { std::ptr::addr_of_mut!(CTX_BUF) as *mut f64 }
}
pub fn ctx() -> Ctx {
    let b = unsafe { *std::ptr::addr_of!(CTX_BUF) };
    Ctx {
        w: b[0],
        px: b[1],
        py: b[2],
        p_dead: b[3] != 0.0,
        arena_l: b[4],
        arena_r: b[5],
        speed: b[6],
        magnet: b[7],
        tempo: b[8],
        tier: b[9],
        storm: b[10],
        lightning: b[11],
        amb_t: b[12],
        diff: b[13],
        npat: b[14],
        indoor: b[15] != 0.0,
        dark: b[16],
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
pub fn pick_index(n: usize) -> usize {
    (random() * n as f64).floor() as usize
}
pub fn pick_of<T: Copy>(a: &[T]) -> T {
    a[pick_index(a.len())]
}
pub fn pick(a: &[f64]) -> f64 {
    pick_of(a)
}
// Math.sign (0 · -0 · NaN은 그대로)
pub fn sign(v: f64) -> f64 {
    if v > 0.0 {
        1.0
    } else if v < 0.0 {
        -1.0
    } else {
        v
    }
}
pub fn lerp(a: f64, b: f64, t: f64) -> f64 {
    a + (b - a) * t
}
// 원래 JS easeOut (세제곱)
pub fn ease_out(t: f64) -> f64 {
    1.0 - pow(1.0 - clamp(t, 0.0, 1.0), 3.0)
}
// JS `v || d`: 아직 없거나(NaN) 0이면 d
pub fn or(v: f64, d: f64) -> f64 {
    if v.is_nan() || v == 0.0 {
        d
    } else {
        v
    }
}
pub fn ease_back(t: f64) -> f64 {
    let t = clamp(t, 0.0, 1.0);
    let s = 1.7;
    1.0 + (s + 1.0) * pow(t - 1.0, 3.0) + s * pow(t - 1.0, 2.0)
}

// ── 효과 (원래 JS fx · burst · dust …) ────────────────────────
// fx 하나: 빠진 값은 원래 fx()의 기본값 (vx · vy · grav · drag 0, life 0.5, size 1, 색 #fff4e0) · near: 앞쪽 층 (비)
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
    pub near: bool,
}
impl Fx {
    pub fn new(kind: &'static str, x: f64, y: f64) -> Self {
        Fx {
            kind,
            x,
            y,
            vx: 0.0,
            vy: 0.0,
            grav: 0.0,
            drag: 0.0,
            life: 0.5,
            size: 1.0,
            col: hexc(0xfff4e0),
            big: false,
            len: 0.0,
            near: false,
        }
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
                self.near as i32 as f64,
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
    sfx_args(name, 0.0, 0.0)
}
// 인자가 있는 소리 (burst(강세) · letter(번호, 강세))
pub fn sfx_args(name: &str, a: f64, b: f64) {
    unsafe { jsfx(idx(&SFX, name), a, b) }
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
// 땅에 그을린 자국 (G.decals)
pub fn scorch(x: f64, life: f64) {
    unsafe { jdecal(x, life, 0.0) }
}
// 떨어질 자리 표시 (G.decals의 mark)
pub fn mark_spot(x: f64, life: f64) {
    unsafe { jdecal(x, life, 1.0) }
}
// 귤 즙 튀김 (원래 JS juice)
pub fn juice(x: f64, y: f64, n: f64) {
    burst(x, y, n, &[pc("org", 2), pc("org", 3), pc("org", 4), pc("yel", 3)], 90.0, 0.45, 420.0, "px");
}
// JS 일 하나 (돌려주는 값이 있으면 그 값)
pub fn hook(name: &str, a: f64, b: f64, c: f64, d: f64) -> f64 {
    unsafe { jhook(idx(&HOOKS, name), a, b, c, d) }
}
pub fn str_id(s: &str) -> f64 {
    idx(&STRS, s)
}
// G의 전역 값 고치기 (바람 · 먹구름 · 번개)
pub fn gset(field: &str, v: f64) {
    hook("gset", idx(&GFIELDS, field), v, 0.0, 0.0);
}

// 맞았을 때 종류 (hz.rs EVENTS 순서: 0 귤에 맞음 · 1 밟힘 · 2 밟고 튀어 오름)
pub const EV_STOMP: i32 = 1;
pub const EV_BOUNCE: i32 = 2;

// ── 장애물 필드 ───────────────────────────────────────────────
// 필드 종류: 숫자 · 참거짓 · 이름(단계 같은 문자열, 목록 안 번호로 주고받음) · 목록(그리기용 숫자 배열, 읽기만 — draw::list로 꺼냄)
pub enum Ty {
    Num,
    Bool,
    Enum(&'static [&'static str]),
    List,
}
pub type Schema = &'static [(&'static str, Ty)];
// 판정 상자 (x · y · w · h)
pub type Boxes = Vec<[f64; 4]>;

// 이름표 · 장애물 필드 목록을 JSON으로 (JS가 처음에 한 번 읽음)
//  kinds: 움직임 · 판정에 쓰는 필드, dkinds: 그리기에 쓰는 필드 (같은 필드 뒤에 그리기 전용 필드를 붙임)
pub fn tables_json(kinds: &[(&str, Schema, Schema)]) -> String {
    let list = |v: &[&str]| format!("[{}]", v.iter().map(|s| format!("\"{}\"", s)).collect::<Vec<_>>().join(","));
    let ty = |t: &Ty| match t {
        Ty::Num => "\"n\"".to_string(),
        Ty::Bool => "\"b\"".to_string(),
        Ty::Enum(v) => list(v),
        Ty::List => "\"l\"".to_string(),
    };
    let fields = |s: &[&(&str, Ty)]| s.iter().map(|(n, t)| format!("[\"{}\",{}]", n, ty(t))).collect::<Vec<_>>().join(",");
    let map = |with_draw: bool| {
        kinds
            .iter()
            .map(|(k, s, d)| {
                let all: Vec<&(&str, Ty)> = s.iter().chain(if with_draw { d.iter() } else { [].iter() }).collect();
                format!("\"{}\":[{}]", k, fields(&all))
            })
            .collect::<Vec<_>>()
            .join(",")
    };
    format!(
        "{{\"fx\":{},\"sfx\":{},\"rewards\":{},\"pals\":{},\"hooks\":{},\"strs\":{},\"css\":{},\"gfields\":{},\"named\":{},\"props\":{},\"kinds\":{{{}}},\"dkinds\":{{{}}}}}",
        list(&FX_KINDS),
        list(&SFX),
        list(&REWARDS),
        list(&PALS),
        list(&HOOKS),
        list(&STRS),
        list(&CSS),
        list(&GFIELDS),
        list(&crate::draw::NAMED),
        list(&crate::draw::PROPS),
        map(false),
        map(true)
    )
}
