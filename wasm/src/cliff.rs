// 천지연 휘어 든 절벽 면 밝기 (places.js cjMid4): 열마다 밝기 f · 칠할 세로 범위는 JS가 정함 · 폭포 둘레는 물안개
use crate::js::*;

#[allow(clippy::too_many_arguments)]
pub fn shade(d: &mut [u8], lw: i32, ia: i32, f: &[f64], y0: &[f64], y1: &[f64], cxa: f64) {
    for (c, &fc) in f.iter().enumerate() {
        let i = ia + c as i32;
        let mut y = y0[c];
        while y <= y1[c] {
            let q = (y as i32 * lw + i) * 4;
            if q >= 0 && ((q + 3) as usize) < d.len() && d[q as usize + 3] != 0 {
                let q = q as usize; let mist = max(0.0, 1.0 - (i as f64 - cxa).abs() / 34.0) * clamp((y - 86.0) / 26.0, 0.0, 1.0) * 0.3;
                for k in 0..3 { let v = d[q + k] as f64 * fc; d[q + k] = u8c(clamp(v + (226.0 - v) * mist, 0.0, 255.0)); }
            }
            y += 1.0;
        }
    }
}
