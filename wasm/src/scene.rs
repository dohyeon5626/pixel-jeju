// 배경 장면 굽기의 바탕: 작은 캔버스 렌더러 · 픽셀 버퍼(PB) · 색 계산 · 시간대 팔레트 · JS로 넘길 결과
//  JS 캔버스로 그리던 걸 그대로 옮김 — 불투명 칠하기 · PB 합성은 픽셀이 같고, 반투명 · 다각형 가장자리만 캔버스와 1~2 차이
use crate::js::*;
use crate::noise::Rng;

pub type Col = [u8; 3];

// ── 화면 · 층 ─────────────────────────────────────────────────
pub const H: f64 = 240.0;
pub const VIEW_H: f64 = 180.0;
pub const VOFF: f64 = 60.0;
pub const GROUND: f64 = 156.0;
pub const L_HALL: f64 = 0.08;
pub const L_OREUM: f64 = 0.16;
pub const L_FIELD: f64 = 0.3;
pub const L_NEAR: f64 = 0.6;
pub const L_FRONT: f64 = 1.3;

// ── 색 ────────────────────────────────────────────────────────
pub const fn hx(s: &str) -> Col {
    let b = s.as_bytes();
    const fn d(c: u8) -> u8 {
        match c {
            b'0'..=b'9' => c - b'0',
            b'a'..=b'f' => c - b'a' + 10,
            b'A'..=b'F' => c - b'A' + 10,
            _ => 0,
        }
    }
    [d(b[1]) * 16 + d(b[2]), d(b[3]) * 16 + d(b[4]), d(b[5]) * 16 + d(b[6])]
}
pub const INK: Col = hx("#201614"); // C.ink (팔레트 배열이 아니라 mute 안 됨)
pub const OUTLINE: f64 = 0.42;

// hex(r, g, b): 채널마다 반올림 · 0~255
pub fn hex(r: f64, g: f64, b: f64) -> Col {
    [clamp(round(r), 0.0, 255.0) as u8, clamp(round(g), 0.0, 255.0) as u8, clamp(round(b), 0.0, 255.0) as u8]
}
pub fn mute(c: Col, sat: f64) -> Col {
    let (r, g, b) = (c[0] as f64, c[1] as f64, c[2] as f64);
    let l = r * 0.3 + g * 0.59 + b * 0.11;
    let f = |c: f64, w: f64| max(0.0, min(255.0, round((l + (c - l) * sat) * 0.95 + w))) as u8;
    [f(r, 11.0), f(g, 6.0), f(b, 0.0)]
}
// 톤 밴드 + 중간 톤 (1/3 · 2/3 섞음)
pub fn band(ramp: &[Col], v: f64) -> Col {
    let n = ramp.len();
    let f = clamp(v, 0.0, 0.999) * (n - 1) as f64;
    let i = f.floor() as usize;
    let t = round((f - i as f64) * 3.0) / 3.0;
    if t == 0.0 || i >= n - 1 {
        return ramp[i];
    }
    if t == 1.0 {
        return ramp[i + 1];
    }
    mix(ramp[i], ramp[i + 1], t)
}
// litPair: 왼쪽을 보는 그림은 빛도 좌우를 뒤집어 다시 그림
static mut LIGHT_FLIP: bool = false;
pub fn light_flip(on: bool) {
    unsafe {
        LIGHT_FLIP = on;
    }
}
// rampPick: 경계를 딱 끊는 램프 고르기
pub fn ramp_pick(r: &[Col], v: f64) -> Col {
    let f = clamp(v, 0.0, 0.9999) * (r.len() - 1) as f64;
    let i = f.floor();
    let fr = f - i;
    r[(r.len() - 1).min(i as usize + if fr > 0.5 { 1 } else { 0 })]
}
pub fn sphere_light(nx: f64, ny: f64) -> f64 {
    let m = hypot3(-0.5, -0.7, 0.5);
    let lx = if unsafe { LIGHT_FLIP } { -(-0.5 / m) } else { -0.5 / m };
    let nz = max(0.0, 1.0 - nx * nx - ny * ny).sqrt();
    clamp((nx * lx + ny * (-0.7 / m) + nz * (0.5 / m)) * 0.55 + 0.45, 0.0, 1.0)
}

// ── 시간대 · 팔레트 (JS가 처음에 넘겨 줌) ─────────────────────
#[derive(Clone)]
pub struct Sun {
    pub x: f64,
    pub y: f64,
    pub r: f64,
    pub core: Col,
    pub glow: Col,
    pub moon: bool,
}
#[derive(Clone)]
pub struct Phase {
    pub sky: Vec<Col>,
    pub haze: Col,
    pub tint: Option<Col>,
    pub sun: Sun,
    pub cloud: Vec<Col>,
}
pub struct Pal {
    pub leaf: Vec<Col>,
    pub grass: Vec<Col>,
    pub org: Vec<Col>,
    pub yel: Vec<Col>,
    pub soil: Vec<Col>,
    pub stone: Vec<Col>,
    pub all: Vec<(String, Vec<Col>)>,
}
impl Pal {
    pub fn c(&self, k: &str) -> &[Col] {
        self.all.iter().find(|(n, _)| n == k).map(|(_, v)| v.as_slice()).unwrap_or(&[])
    }
}
pub struct Ctx {
    pub w: f64,
    pub phases: Vec<Phase>,
    pub pal: Pal,
}
static mut CTX: Option<Ctx> = None;
pub fn ctx() -> &'static Ctx {
    unsafe { (*std::ptr::addr_of!(CTX)).as_ref().unwrap() }
}
pub fn layer_w(p: f64) -> i32 {
    (ctx().w + 44.0 * p).ceil() as i32 + 4
}
pub fn world_w() -> f64 {
    ctx().w + 44.0
}
pub fn cave_ph() -> Phase {
    Phase {
        sky: vec![],
        haze: hx("#0c0b12"),
        tint: None,
        sun: Sun { x: 0.0, y: 0.0, r: 0.0, core: [0; 3], glow: [0; 3], moon: false },
        cloud: vec![],
    }
}

// 대기 원근 + 시간대 색조
pub fn atmo(c: Col, ph: &Phase, depth: f64) -> Col {
    let o = mix(mute(c, 0.8), ph.haze, depth);
    match ph.tint {
        Some(t) => hex(o[0] as f64 * t[0] as f64 / 255.0, o[1] as f64 * t[1] as f64 / 255.0, o[2] as f64 * t[2] as f64 / 255.0),
        None => o,
    }
}
pub fn atmos(cols: &[&str], ph: &Phase, depth: f64) -> Vec<Col> {
    cols.iter().map(|s| atmo(hx(s), ph, depth)).collect()
}

// ── 캔버스 ────────────────────────────────────────────────────
#[derive(Clone)]
pub struct Canvas {
    pub w: i32,
    pub h: i32,
    pub d: Vec<u8>,
    pub ty: f64,
}
impl Canvas {
    pub fn new(w: i32, h: i32) -> Self {
        Canvas { w, h, d: vec![0; (w.max(0) * h.max(0) * 4) as usize], ty: 0.0 }
    }
    fn blend(&mut self, i: i32, y: i32, c: Col, a: f64) {
        if i < 0 || y < 0 || i >= self.w || y >= self.h {
            return;
        }
        let p = ((y * self.w + i) * 4) as usize;
        if a >= 1.0 {
            self.d[p] = c[0];
            self.d[p + 1] = c[1];
            self.d[p + 2] = c[2];
            self.d[p + 3] = 255;
            return;
        }
        let sa = round(a * 255.0) / 255.0;
        if sa <= 0.0 {
            return;
        }
        let da = self.d[p + 3] as f64 / 255.0;
        let oa = sa + da * (1.0 - sa);
        for (k, &ck) in c.iter().enumerate() {
            self.d[p + k] = clamp(round((ck as f64 * sa + self.d[p + k] as f64 * da * (1.0 - sa)) / oa), 0.0, 255.0) as u8;
        }
        self.d[p + 3] = clamp(round(oa * 255.0), 0.0, 255.0) as u8;
    }
    // fillRect (globalAlpha a) — 칸에 걸친 만큼만 (정수 칸이면 그대로 칠함)
    pub fn fill_a(&mut self, x: f64, y: f64, w: f64, hh: f64, c: Col, a: f64) {
        let y = y + self.ty;
        let (x0, x1) = if w < 0.0 { (x + w, x) } else { (x, x + w) };
        let (y0, y1) = if hh < 0.0 { (y + hh, y) } else { (y, y + hh) };
        if x1 <= x0 || y1 <= y0 || a <= 0.0 {
            return;
        }
        let (ix0, ix1, iy0, iy1) = (
            max(0.0, x0.floor()) as i32,
            min(self.w as f64, x1.ceil()) as i32,
            max(0.0, y0.floor()) as i32,
            min(self.h as f64, y1.ceil()) as i32,
        );
        for yy in iy0..iy1 {
            let cy = min(yy as f64 + 1.0, y1) - max(yy as f64, y0);
            for xx in ix0..ix1 {
                let cx = min(xx as f64 + 1.0, x1) - max(xx as f64, x0);
                self.blend(xx, yy, c, a * cx * cy);
            }
        }
    }
    pub fn fill(&mut self, x: f64, y: f64, w: f64, hh: f64, c: Col) {
        self.fill_a(x, y, w, hh, c, 1.0);
    }
    pub fn px(&mut self, x: f64, y: f64, c: Col) {
        self.fill(x, y, 1.0, 1.0, c);
    }
    // drawImage(src, x, y): 정수 자리에 그대로 겹침
    pub fn draw(&mut self, s: &Canvas, x: f64, y: f64) {
        let (ox, oy) = (round(x) as i32, round(y + self.ty) as i32);
        for j in 0..s.h {
            for i in 0..s.w {
                let q = ((j * s.w + i) * 4) as usize;
                let a = s.d[q + 3];
                if a == 0 {
                    continue;
                }
                let c = [s.d[q], s.d[q + 1], s.d[q + 2]];
                if a == 255 {
                    let (tx, ty) = (ox + i, oy + j);
                    if tx >= 0 && ty >= 0 && tx < self.w && ty < self.h {
                        let p = ((ty * self.w + tx) * 4) as usize;
                        self.d[p..p + 3].copy_from_slice(&c);
                        self.d[p + 3] = 255;
                    }
                } else {
                    self.blend(ox + i, oy + j, c, a as f64 / 255.0);
                }
            }
        }
    }
    pub fn alpha(&self, i: i32, y: i32) -> u8 {
        if i < 0 || y < 0 || i >= self.w || y >= self.h {
            0
        } else {
            self.d[((y * self.w + i) * 4 + 3) as usize]
        }
    }
    pub fn flip(&self) -> Canvas {
        let mut o = Canvas::new(self.w, self.h);
        for y in 0..self.h {
            for i in 0..self.w {
                let (p, q) = (((y * self.w + i) * 4) as usize, ((y * self.w + self.w - 1 - i) * 4) as usize);
                o.d[q..q + 4].copy_from_slice(&self.d[p..p + 4]);
            }
        }
        o
    }
}

// 다각형 채우기의 칸별 덮인 정도 (0~255) — 칸마다 4×4 표본 (캔버스 가장자리 반투명과 거의 같음)
pub fn poly_alpha(w: i32, hh: i32, pts: &[(f64, f64)]) -> Vec<u8> {
    let mut a = vec![0u8; (w * hh) as usize];
    let n = pts.len();
    let (mut y0, mut y1) = (f64::MAX, f64::MIN);
    for p in pts {
        y0 = y0.min(p.1);
        y1 = y1.max(p.1);
    }
    let (ya, yb) = (max(0.0, y0.floor()) as i32, min(hh as f64, y1.ceil()) as i32);
    let mut cov = vec![0u16; w as usize];
    for yy in ya..yb {
        for c in cov.iter_mut() {
            *c = 0;
        }
        for s in 0..4 {
            let sy = yy as f64 + (s as f64 + 0.5) / 4.0;
            let mut xs = vec![];
            for k in 0..n {
                let (p, q) = (pts[k], pts[(k + 1) % n]);
                if (p.1 <= sy) != (q.1 <= sy) {
                    xs.push(p.0 + (sy - p.1) / (q.1 - p.1) * (q.0 - p.0));
                }
            }
            xs.sort_by(|a, b| a.partial_cmp(b).unwrap());
            for pr in xs.chunks(2) {
                if pr.len() < 2 {
                    break;
                }
                for t in 0..4 * w {
                    let sx = (t as f64 + 0.5) / 4.0;
                    if sx >= pr[0] && sx < pr[1] {
                        cov[(t / 4) as usize] += 1;
                    }
                }
            }
        }
        for i in 0..w as usize {
            a[yy as usize * w as usize + i] = min(255.0, round(cov[i] as f64 * 255.0 / 16.0)) as u8;
        }
    }
    a
}

// ── 픽셀 버퍼 (art.js PB) ─────────────────────────────────────
#[derive(Clone)]
pub struct Pb {
    pub w: i32,
    pub h: i32,
    pub d: Vec<Option<Col>>,
}
impl Pb {
    pub fn new(w: i32, h: i32) -> Self {
        Pb { w, h, d: vec![None; (w.max(0) * h.max(0)) as usize] }
    }
    pub fn in_(&self, x: f64, y: f64) -> bool {
        x >= 0.0 && y >= 0.0 && x < self.w as f64 && y < self.h as f64
    }
    pub fn set(&mut self, x: f64, y: f64, c: Col) {
        let (x, y) = (round(x), round(y));
        if self.in_(x, y) {
            self.d[(y as i32 * self.w + x as i32) as usize] = Some(c);
        }
    }
    pub fn set_o(&mut self, x: f64, y: f64, c: Option<Col>) {
        if let Some(c) = c {
            self.set(x, y, c);
        }
    }
    pub fn get(&self, x: f64, y: f64) -> Option<Col> {
        let (x, y) = (round(x), round(y));
        if self.in_(x, y) {
            self.d[(y as i32 * self.w + x as i32) as usize]
        } else {
            None
        }
    }
    pub fn ellipse(&mut self, cx: f64, cy: f64, rx: f64, ry: f64, mut shade: impl FnMut(f64, f64) -> Option<Col>) {
        let mut y = (cy - ry).floor();
        while y <= (cy + ry).ceil() {
            let mut x = (cx - rx).floor();
            while x <= (cx + rx).ceil() {
                let nx = (x + 0.5 - cx) / rx;
                let ny = (y + 0.5 - cy) / ry;
                if nx * nx + ny * ny <= 1.0 {
                    let c = shade(nx, ny);
                    self.set_o(x, y, c);
                }
                x += 1.0;
            }
            y += 1.0;
        }
    }
    // 좌표도 넘기는 타원 (art.js ellipse의 shade(nx, ny, x, y))
    pub fn ellipse4(&mut self, cx: f64, cy: f64, rx: f64, ry: f64, mut shade: impl FnMut(f64, f64, f64, f64) -> Option<Col>) {
        let mut y = (cy - ry).floor();
        while y <= (cy + ry).ceil() {
            let mut x = (cx - rx).floor();
            while x <= (cx + rx).ceil() {
                let nx = (x + 0.5 - cx) / rx;
                let ny = (y + 0.5 - cy) / ry;
                if nx * nx + ny * ny <= 1.0 {
                    let c = shade(nx, ny, x, y);
                    self.set_o(x, y, c);
                }
                x += 1.0;
            }
            y += 1.0;
        }
    }
    pub fn rect(&mut self, x: f64, y: f64, w: f64, h: f64, c: Col) {
        let mut j = 0.0;
        while j < h {
            let mut i = 0.0;
            while i < w {
                self.set(x + i, y + j, c);
                i += 1.0;
            }
            j += 1.0;
        }
    }
    // 팔다리: 두께 있는 선분 (col은 t에 따라 바뀔 수 있음)
    pub fn limb_f(&mut self, x0: f64, y0: f64, x1: f64, y1: f64, size: f64, col: impl Fn(f64) -> Col) {
        let n = max(1.0, (max((x1 - x0).abs(), (y1 - y0).abs()) * 1.5).ceil());
        let mut k = 0.0;
        while k <= n {
            let t = k / n;
            let x = x0 + (x1 - x0) * t;
            let y = y0 + (y1 - y0) * t;
            let c = col(t);
            let o = (size - 1.0) / 2.0;
            let mut j = 0.0;
            while j < size {
                let mut i = 0.0;
                while i < size {
                    self.set(round(x - o + i), round(y - o + j), c);
                    i += 1.0;
                }
                j += 1.0;
            }
            k += 1.0;
        }
    }
    pub fn limb(&mut self, x0: f64, y0: f64, x1: f64, y1: f64, size: f64, c: Col) {
        self.limb_f(x0, y0, x1, y1, size, |_| c);
    }
    pub fn canvas(&self) -> Canvas {
        let mut c = Canvas::new(self.w, self.h);
        for (i, v) in self.d.iter().enumerate() {
            if let Some(v) = v {
                c.d[i * 4..i * 4 + 3].copy_from_slice(v);
                c.d[i * 4 + 3] = 255;
            }
        }
        c
    }
    // 셀아웃 외곽선: 맞닿은 색을 어둡게 (아래만 닿으면 덜 어둡게)
    pub fn sel_out(&self, k: f64) -> Pb {
        let k = k * OUTLINE;
        let mut o = self.clone();
        for y in 0..self.h {
            for x in 0..self.w {
                let (xf, yf) = (x as f64, y as f64);
                if self.get(xf, yf).is_some() {
                    continue;
                }
                let (b, a, l, r) = (self.get(xf, yf + 1.0), self.get(xf, yf - 1.0), self.get(xf - 1.0, yf), self.get(xf + 1.0, yf));
                if let Some(nb) = a.or(r).or(l).or(b) {
                    o.d[(y * self.w + x) as usize] = Some(mix(nb, INK, if b.is_some() && a.is_none() { k - 0.1 } else { k }));
                }
            }
        }
        o
    }
}

// ── JS로 넘길 결과: 층 이름 · 픽셀 · 덧붙는 값(JSON) ──────────
pub struct Layer {
    pub name: String,
    pub c: Canvas,
    pub meta: String,
}
static mut OUT: Vec<Layer> = Vec::new();
static mut JSON_OUT: String = String::new();
pub fn out_clear() {
    unsafe {
        (*std::ptr::addr_of_mut!(OUT)).clear();
        TREE = String::new();
    }
}
pub fn out_push(name: &str, c: Canvas, meta: String) {
    unsafe {
        (*std::ptr::addr_of_mut!(OUT)).push(Layer { name: name.into(), c, meta });
    }
}
pub fn out_empty(name: &str, p: f64, hh: i32) {
    out_push(name, Canvas::new(layer_w(p), hh), "\"empty\":true".into());
}
// [{"n":이름,"w":폭,"h":높이,"p":픽셀 위치,"m":{...}}] 를 만들고 (위치, 길이)를 돌려줌
pub fn out_json() -> (*const u8, usize) {
    unsafe {
        let out = &*std::ptr::addr_of!(OUT);
        let mut s = format!("{{\"T\":{},\"L\":[", {
            let t = tree_json();
            if t.is_empty() {
                "null".to_string()
            } else {
                t
            }
        });
        for (k, l) in out.iter().enumerate() {
            if k > 0 {
                s.push(',');
            }
            s.push_str(&format!(
                "{{\"n\":\"{}\",\"w\":{},\"h\":{},\"p\":{},\"m\":{{{}}}}}",
                l.name,
                l.c.w,
                l.c.h,
                l.c.d.as_ptr() as usize,
                l.meta
            ));
        }
        s.push_str("]}");
        let j = &mut *std::ptr::addr_of_mut!(JSON_OUT);
        *j = s;
        (j.as_ptr(), j.len())
    }
}
// 스프라이트: 캔버스를 목록에 넣고 트리 안에서 {"$":번호, 덧붙는 값} 으로 가리킴
static mut TREE: String = String::new();
pub fn cv(c: Canvas, props: &str) -> String {
    unsafe {
        let out = &mut *std::ptr::addr_of_mut!(OUT);
        out.push(Layer { name: String::new(), c, meta: String::new() });
        format!("{{\"$\":{}{}{}}}", out.len() - 1, if props.is_empty() { "" } else { "," }, props)
    }
}
pub fn set_tree(t: String) {
    unsafe {
        TREE = t;
    }
}
pub fn tree_json() -> String {
    unsafe { (*std::ptr::addr_of!(TREE)).clone() }
}
pub fn num(v: f64) -> String {
    format!("{}", v)
}
pub fn col_hex(c: Col) -> String {
    format!("#{:02x}{:02x}{:02x}", c[0], c[1], c[2])
}

// ── 작은 JSON 읽기 (시간대 · 팔레트 받기용) ───────────────────
pub enum J {
    N(f64),
    S(String),
    B(bool),
    Null,
    A(Vec<J>),
    O(Vec<(String, J)>),
}
impl J {
    pub fn get(&self, k: &str) -> &J {
        if let J::O(v) = self {
            for (kk, vv) in v {
                if kk == k {
                    return vv;
                }
            }
        }
        &J::Null
    }
    pub fn arr(&self) -> &[J] {
        if let J::A(v) = self {
            v
        } else {
            &[]
        }
    }
    pub fn f(&self) -> f64 {
        if let J::N(v) = self {
            *v
        } else {
            0.0
        }
    }
    pub fn col(&self) -> Option<Col> {
        if let J::S(s) = self {
            Some(hx(s))
        } else {
            None
        }
    }
    pub fn cols(&self) -> Vec<Col> {
        self.arr().iter().filter_map(|j| j.col()).collect()
    }
    pub fn truthy(&self) -> bool {
        matches!(self, J::B(true)) || matches!(self, J::N(v) if *v != 0.0)
    }
}
pub fn parse_json(s: &[u8]) -> J {
    fn ws(s: &[u8], i: &mut usize) {
        while *i < s.len() && (s[*i] as char).is_whitespace() {
            *i += 1;
        }
    }
    fn val(s: &[u8], i: &mut usize) -> J {
        ws(s, i);
        match s[*i] {
            b'{' => {
                *i += 1;
                let mut v = vec![];
                loop {
                    ws(s, i);
                    if s[*i] == b'}' {
                        *i += 1;
                        break;
                    }
                    let k = if let J::S(k) = val(s, i) { k } else { String::new() };
                    ws(s, i);
                    *i += 1;
                    let x = val(s, i);
                    v.push((k, x));
                    ws(s, i);
                    if s[*i] == b',' {
                        *i += 1;
                    }
                }
                J::O(v)
            }
            b'[' => {
                *i += 1;
                let mut v = vec![];
                loop {
                    ws(s, i);
                    if s[*i] == b']' {
                        *i += 1;
                        break;
                    }
                    v.push(val(s, i));
                    ws(s, i);
                    if s[*i] == b',' {
                        *i += 1;
                    }
                }
                J::A(v)
            }
            b'"' => {
                *i += 1;
                let st = *i;
                while s[*i] != b'"' {
                    *i += 1;
                }
                let r = String::from_utf8_lossy(&s[st..*i]).into_owned();
                *i += 1;
                J::S(r)
            }
            b't' => {
                *i += 4;
                J::B(true)
            }
            b'f' => {
                *i += 5;
                J::B(false)
            }
            b'n' => {
                *i += 4;
                J::Null
            }
            _ => {
                let st = *i;
                while *i < s.len() && matches!(s[*i], b'-' | b'+' | b'.' | b'e' | b'E' | b'0'..=b'9') {
                    *i += 1;
                }
                J::N(std::str::from_utf8(&s[st..*i]).unwrap_or("0").parse().unwrap_or(0.0))
            }
        }
    }
    let mut i = 0;
    val(s, &mut i)
}
// 처음에 화면 폭 · 팔레트(C 전체)를, 배경을 쓸 때 시간대(PHASES)를 받음 (온 것만 바꿈)
pub fn init(w: f64, j: &J) {
    unsafe {
        if (*std::ptr::addr_of!(CTX)).is_none() {
            CTX = Some(Ctx {
                w,
                phases: vec![],
                pal: Pal { leaf: vec![], grass: vec![], org: vec![], yel: vec![], soil: vec![], stone: vec![], all: vec![] },
            });
        }
    }
    let cx = unsafe { (*std::ptr::addr_of_mut!(CTX)).as_mut().unwrap() };
    cx.w = w;
    if let J::A(_) = j.get("phases") {
        cx.phases = j
            .get("phases")
            .arr()
            .iter()
            .map(|p| {
                let s = p.get("sun");
                Phase {
                    sky: p.get("sky").cols(),
                    haze: p.get("haze").col().unwrap_or([0; 3]),
                    tint: p.get("tint").col(),
                    cloud: p.get("cloud").cols(),
                    sun: Sun {
                        x: s.get("x").f(),
                        y: s.get("y").f(),
                        r: s.get("r").f(),
                        core: s.get("core").col().unwrap_or([0; 3]),
                        glow: s.get("glow").col().unwrap_or([0; 3]),
                        moon: s.get("moon").truthy(),
                    },
                }
            })
            .collect();
    }
    if let J::O(v) = j.get("pal") {
        let c = j.get("pal");
        cx.pal = Pal {
            leaf: c.get("leaf").cols(),
            grass: c.get("grass").cols(),
            org: c.get("org").cols(),
            yel: c.get("yel").cols(),
            soil: c.get("soil").cols(),
            stone: c.get("stone").cols(),
            all: v.iter().filter(|(_, a)| matches!(a, J::A(_))).map(|(k, a)| (k.clone(), a.cols())).collect(),
        };
    }
}

// 이 장면에서 쓰는 난수 (art.js rng)
pub fn rng(seed: f64) -> Rng {
    Rng::new(seed as i64 as u32)
}
