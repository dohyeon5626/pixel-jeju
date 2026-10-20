// 장애물 그리기 다리: Rust가 그리기 명령을 쌓고, JS(js/wasm.js의 runDraw)가 차례로 캔버스에 찍음
//  색은 game.rs 색 번호, 이미지는 Img(이 장애물의 spr · 이름 있는 스프라이트 · 크기별로 굽는 것) — 크기 · 기준점은 그때그때 JS에 물어봄
use crate::game::{idx, str_id};

#[link(wasm_import_module = "g")]
extern "C" {
    fn jimg(src: f64, id: f64, a: f64, b: f64, c: f64, prop: f64) -> f64;
    fn jghost(src: f64, id: f64, a: f64, b: f64, c: f64, x: f64, y: f64, life: f64, col: f64);
}

// 이름으로 찾는 스프라이트 (JS 전역 상수)
pub const NAMED: [&str; 30] = [
    "HAREUBANG",
    "MINI",
    "METEOR",
    "FALLROCKS",
    "PONY",
    "TEWAK",
    "ROTTEN",
    "BASKET",
    "OMEGI",
    "PINWHEEL",
    "SAMDA",
    "HALLABONG_FAKE",
    "HALLABONG",
    "PICK_TANG",
    "TANGERINE",
    "SUITCASES",
    "PIG",
    "GULL",
    "RENTCAR",
    "BEE",
    "SPARROW",
    "PARCEL",
    "GLIDER",
    "DOLPHIN",
    "DOLPHIN_L",
    "CROW",
    "BAT",
    "BIG_KNIFE",
    "FALL_TILE",
    "PEBBLE",
];
// JS에 물어볼 수 있는 이미지 값 (flip: 좌우 뒤집은 사본이 있으면 1 · geo.*: 파도 모양)
pub const PROPS: [&str; 13] =
    ["width", "height", "ax", "ay", "bodyH", "length", "flip", "geo.back", "geo.uc", "geo.tip0", "geo.tip1", "geo.gap", "geo.H"];

// 이미지 경로 한 단계: 배열 칸 번호 · 좌우 쌍({ r, l })은 0 r · 1 l
pub const NONE: f64 = -1.0; // 경로 없음
pub const FLIP: f64 = -2.0; // .flip (좌우 뒤집은 사본)

// 이미지 하나: src 0 이 장애물의 spr · 1 이름 있는 스프라이트(id) · 2 크기별로 굽는 것(id: 0 칼날 · 1 오름 · 2 파도 · 3 귤 상자, a~c는 크기)
#[derive(Clone, Copy)]
pub struct Img {
    src: f64,
    id: f64,
    a: f64,
    b: f64,
    c: f64,
}
pub fn own() -> Img {
    Img { src: 0.0, id: 0.0, a: NONE, b: NONE, c: 0.0 }
}
pub fn named(name: &str) -> Img {
    Img { src: 1.0, id: idx(&NAMED, name), a: NONE, b: NONE, c: 0.0 }
}
pub fn slash(hh: f64, left: bool) -> Img {
    Img { src: 2.0, id: 0.0, a: hh, b: left as i32 as f64, c: 0.0 }
}
pub fn oreum(h: f64) -> Img {
    Img { src: 2.0, id: 1.0, a: h, b: 0.0, c: 0.0 }
}
pub fn tide(hi: bool, frame: f64, dir: f64) -> Img {
    Img { src: 2.0, id: 2.0, a: hi as i32 as f64, b: frame, c: dir }
}
pub fn crate_box() -> Img {
    Img { src: 2.0, id: 3.0, a: 0.0, b: 0.0, c: 0.0 }
}
impl Img {
    // 경로 한 단계 더 (두 단계까지): 배열 칸 · 좌우(0 r · 1 l) · FLIP
    pub fn at(self, k: f64) -> Img {
        if self.a == NONE {
            Img { a: k, ..self }
        } else {
            Img { b: k, ..self }
        }
    }
    // 좌우 쌍에서 오른쪽(dir > 0)이면 r · 아니면 l
    pub fn side(self, right: bool) -> Img {
        self.at(if right { 0.0 } else { 1.0 })
    }
    fn prop(&self, p: &str) -> f64 {
        unsafe { jimg(self.src, self.id, self.a, self.b, self.c, idx(&PROPS, p)) }
    }
    pub fn w(&self) -> f64 {
        self.prop("width")
    }
    pub fn h(&self) -> f64 {
        self.prop("height")
    }
    pub fn ax(&self) -> f64 {
        self.prop("ax")
    }
    pub fn ay(&self) -> f64 {
        self.prop("ay")
    }
    pub fn body_h(&self) -> f64 {
        self.prop("bodyH")
    }
    pub fn len(&self) -> f64 {
        self.prop("length")
    }
    pub fn has_flip(&self) -> bool {
        self.prop("flip") != 0.0
    }
    // 파도 모양 (back · uc · tip0 · tip1 · gap · H)
    pub fn geo(&self, k: &str) -> f64 {
        self.prop(&format!("geo.{}", k))
    }
    fn args(&self) -> [f64; 5] {
        [self.src, self.id, self.a, self.b, self.c]
    }
}

// 그리기 명령 (번호 · 인자 수는 js/wasm.js runDraw와 같음)
pub struct Draw {
    pub q: Vec<f64>,
}
impl Draw {
    pub fn new() -> Self {
        Draw { q: Vec::new() }
    }
    fn op(&mut self, code: f64, args: &[f64]) {
        self.q.push(code);
        self.q.extend_from_slice(args);
    }
    // 0 fillRect
    pub fn rect(&mut self, x: f64, y: f64, w: f64, h: f64) {
        self.op(0.0, &[x, y, w, h]);
    }
    // 1 fillStyle = 색 번호
    pub fn style(&mut self, col: f64) {
        self.op(1.0, &[col]);
    }
    // 2 fillStyle = `rgba(r,g,b,a)`
    pub fn rgba(&mut self, r: f64, g: f64, b: f64, a: f64) {
        self.op(2.0, &[r, g, b, a]);
    }
    // 3 fillStyle = mix(색1, 색2, t) (JS mix 그대로)
    pub fn mix(&mut self, c1: f64, c2: f64, t: f64) {
        self.op(3.0, &[c1, c2, t]);
    }
    // 4 globalAlpha
    pub fn alpha(&mut self, a: f64) {
        self.op(4.0, &[a]);
    }
    // 5 save · 6 restore
    pub fn save(&mut self) {
        self.op(5.0, &[]);
    }
    pub fn restore(&mut self) {
        self.op(6.0, &[]);
    }
    // 7 이 사각형 밖은 안 그림 (beginPath · rect · clip)
    pub fn clip(&mut self, x: f64, y: f64, w: f64, h: f64) {
        self.op(7.0, &[x, y, w, h]);
    }
    // 8 drawImage(이미지, x, y) — sil: 실루엣 색 (NaN이면 그대로)
    fn image(&mut self, im: Img, sil: f64, x: f64, y: f64) {
        let a = im.args();
        self.op(8.0, &[a[0], a[1], a[2], a[3], a[4], sil, x, y]);
    }
    pub fn img(&mut self, im: Img, x: f64, y: f64) {
        self.image(im, f64::NAN, x, y);
    }
    // 실루엣 (원래 silOf(이미지, 색))
    pub fn img_sil(&mut self, im: Img, col: f64, x: f64, y: f64) {
        self.image(im, col, x, y);
    }
    // 9 drawImage(이미지, x, y, w, h)
    pub fn img_scaled(&mut self, im: Img, x: f64, y: f64, w: f64, h: f64) {
        let a = im.args();
        self.op(9.0, &[a[0], a[1], a[2], a[3], a[4], f64::NAN, x, y, w, h]);
    }
    // 10 drawImage(이미지, sx, sy, sw, sh, dx, dy, dw, dh)
    pub fn img_part(&mut self, im: Img, s: [f64; 4], d: [f64; 4]) {
        let a = im.args();
        self.op(10.0, &[a[0], a[1], a[2], a[3], a[4], f64::NAN, s[0], s[1], s[2], s[3], d[0], d[1], d[2], d[3]]);
    }
    // 11 drawShadow(x, w) · 12 topMark(x, t) · 13 edgeChev(dir, y, 색)
    pub fn shadow(&mut self, x: f64, w: f64) {
        self.op(11.0, &[x, w]);
    }
    pub fn top_mark(&mut self, x: f64, t: f64) {
        self.op(12.0, &[x, t]);
    }
    pub fn chev(&mut self, dir: f64, y: f64, col: f64) {
        self.op(13.0, &[dir, y, col]);
    }
    // 14 light(x, y, r, 색, a) · 15 disc(x, y, r, 색) · 16 pxLine(x0, y0, x1, y1, w, 색)
    pub fn light(&mut self, x: f64, y: f64, r: f64, col: f64, a: f64) {
        self.op(14.0, &[x, y, r, col, a]);
    }
    pub fn disc(&mut self, x: f64, y: f64, r: f64, col: f64) {
        self.op(15.0, &[x, y, r, col]);
    }
    // 19 disc(x, y, r, mix(색1, 색2, t))
    pub fn disc_mix(&mut self, x: f64, y: f64, r: f64, c1: f64, c2: f64, t: f64) {
        self.op(19.0, &[x, y, r, c1, c2, t]);
    }
    pub fn line(&mut self, x0: f64, y0: f64, x1: f64, y1: f64, w: f64, col: f64) {
        self.op(16.0, &[x0, y0, x1, y1, w, col]);
    }
    // 17 drawStr(글, x, y, { color, align: 'center' }) — 글은 game.rs STRS
    pub fn text(&mut self, s: &str, x: f64, y: f64, col: f64) {
        self.op(17.0, &[str_id(s), x, y, col]);
    }
    // 18 회오리 깔때기 (JS funnelImg가 굽고 찍음)
    pub fn funnel(&mut self, form: f64) {
        self.op(18.0, &[form]);
    }
}

// 숫자 셈 도우미: JS `Math.floor(v) % 2`가 참인지 · 0인지 (NaN은 둘 다 아님)
pub fn odd(v: f64) -> bool {
    let r = v.floor() % 2.0;
    r != 0.0 && !r.is_nan()
}
pub fn even(v: f64) -> bool {
    v.floor() % 2.0 == 0.0
}
// 잔상 하나 (G.ghosts): 이미지 · 자리 · 수명 · 색
pub fn ghost(im: Img, x: f64, y: f64, life: f64, col: f64) {
    let a = im.args();
    unsafe { jghost(a[0], a[1], a[2], a[3], a[4], x, y, life, col) }
}
// 그리기용 목록 필드 (Ty::List): f[at] 시작 칸 · f[at + 1] 개수
pub fn list(f: &[f64], at: usize) -> &[f64] {
    let (o, n) = (f[at] as usize, f[at + 1] as usize);
    &f[o..o + n]
}
