// art.js의 hash2 · vnoise · fbm · rng를 비트 단위로 똑같이
use crate::js::to_i32;

pub fn hash2(x: f64, y: f64, s: f64) -> f64 {
    let h = to_i32(x * 374761393.0 + y * 668265263.0 + s * 982451653.0) as u32;
    let h = (h ^ (h >> 13)).wrapping_mul(1274126177);
    (h ^ (h >> 16)) as f64 / 4294967296.0
}

pub fn vnoise(x: f64, y: f64, s: f64) -> f64 {
    let xi = x.floor(); let yi = y.floor(); let xf = x - xi; let yf = y - yi;
    let u = xf * xf * (3.0 - 2.0 * xf); let v = yf * yf * (3.0 - 2.0 * yf);
    let a = hash2(xi, yi, s); let b = hash2(xi + 1.0, yi, s); let c = hash2(xi, yi + 1.0, s); let d = hash2(xi + 1.0, yi + 1.0, s);
    a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

pub fn fbm(x: f64, y: f64, s: f64) -> f64 {
    vnoise(x, y, s) * 0.6 + vnoise(x * 2.1, y * 2.1, s + 7.0) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 13.0) * 0.1
}

pub struct Rng(u32);
impl Rng {
    pub fn new(seed: u32) -> Self { Rng(seed) }
    pub fn next(&mut self) -> f64 {
        self.0 = self.0.wrapping_add(0x6D2B79F5);
        let s = self.0;
        let mut t = (s ^ (s >> 15)).wrapping_mul(1 | s);
        t = t.wrapping_add((t ^ (t >> 7)).wrapping_mul(61 | t)) ^ t;
        (t ^ (t >> 14)) as f64 / 4294967296.0
    }
}
