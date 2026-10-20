// JS와 똑같은 숫자가 나오게: 반올림 · 정수 변환 · 클램프는 JS 규칙 그대로
//  sin · exp 같은 초월 함수는 브라우저 Math를 빌려 씀 (Rust 것은 V8과 마지막 자리가 가끔 달라서)
#[link(wasm_import_module = "m")]
extern "C" {
    fn jsin(x: f64) -> f64;
    fn jcos(x: f64) -> f64;
    fn jasin(x: f64) -> f64;
    fn jexp(x: f64) -> f64;
    fn jpow(x: f64, y: f64) -> f64;
    fn jhypot2(x: f64, y: f64) -> f64;
    fn jhypot3(x: f64, y: f64, z: f64) -> f64;
}

pub const PI: f64 = std::f64::consts::PI;

#[inline] pub fn sin(x: f64) -> f64 { unsafe { jsin(x) } }
#[inline] pub fn cos(x: f64) -> f64 { unsafe { jcos(x) } }
#[inline] pub fn asin(x: f64) -> f64 { unsafe { jasin(x) } }
#[inline] pub fn exp(x: f64) -> f64 { unsafe { jexp(x) } }
#[inline] pub fn pow(x: f64, y: f64) -> f64 { unsafe { jpow(x, y) } }
#[inline] pub fn hypot(x: f64, y: f64) -> f64 { unsafe { jhypot2(x, y) } }
#[inline] pub fn hypot3(x: f64, y: f64, z: f64) -> f64 { unsafe { jhypot3(x, y, z) } }

// Math.max(a, Math.min(b, v))
#[inline] pub fn clamp(v: f64, a: f64, b: f64) -> f64 { max(a, min(b, v)) }
#[inline] pub fn min(a: f64, b: f64) -> f64 { if b < a { b } else { a } }
#[inline] pub fn max(a: f64, b: f64) -> f64 { if b > a { b } else { a } }

// Math.round: 반은 +쪽으로
#[inline] pub fn round(x: f64) -> f64 { let f = x.floor(); if x - f >= 0.5 { f + 1.0 } else { f } }

// ToInt32 (x | 0)
#[inline] pub fn to_i32(v: f64) -> i32 {
    if !v.is_finite() { return 0; }
    if v.abs() < 9.2e18 { return v as i64 as i32; }   // 아래 32비트만 = 2³²로 나눈 나머지 (wasm엔 실수 나머지 명령이 없어 fmod는 느림)
    let m = v.trunc() % 4294967296.0;
    (if m < 0.0 { m + 4294967296.0 } else { m }) as u32 as i32
}

// Uint8ClampedArray에 넣을 때: 0~255로 자르고 반은 짝수 쪽으로
#[inline] pub fn u8c(x: f64) -> u8 {
    if !(x > 0.0) { 0 } else if x >= 255.0 { 255 } else { x.round_ties_even() as u8 }
}

// art.js mix() → hex(): 채널마다 반올림
pub fn mix(a: [u8; 3], b: [u8; 3], t: f64) -> [u8; 3] {
    let ch = |k: usize| clamp(round(a[k] as f64 + (b[k] as f64 - a[k] as f64) * t), 0.0, 255.0) as u8;
    [ch(0), ch(1), ch(2)]
}

// 반투명 덧칠 (Uint8ClampedArray 반올림까지 같게): places.js cvBlend · 깔때기 put
pub fn blend(d: &mut [u8], q: usize, c: [u8; 3], a: f64) {
    let a0 = d[q + 3] as f64 / 255.0; let ao = a + a0 * (1.0 - a);
    if ao <= 0.0 { return; }
    for k in 0..3 { d[q + k] = u8c((c[k] as f64 * a + d[q + k] as f64 * a0 * (1.0 - a)) / ao); }
    d[q + 3] = u8c(ao * 255.0);
}
