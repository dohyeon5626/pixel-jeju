// pixTree (places.js): 잎 덩이마다 구 음영 · 아랫단 그늘 테 · 반짝 잎 → RGBA (PB에 색 이름을 넣었다 바꾸는 단계 없이)
//  덩이 배치는 JS 난수 순서를 지키려고 JS에서 정해 넘김
use crate::js::*;
use crate::noise::hash2;

#[allow(clippy::too_many_arguments)]
pub fn blobs(d: &mut [u8], size: i32, blobs: &[f64], rcx: f64, rcy: f64, r: f64, fl: f64, ramp: &[u8]) {
    d.fill(0);
    let ramp_n = ramp.len() / 3;
    let m = hypot3(-0.5, -0.7, 0.5);
    let (l0, l1, l2) = (-0.5 / m, -0.7 / m, 0.5 / m);
    let c0 = size as f64 / 2.0;
    for b in blobs.chunks(3) {
        let (bx, by, br) = (b[0], b[1], b[2]);
        let mut yy = (by - br - 1.0).floor();
        while yy <= (by + br + 1.0).ceil() {
            let mut xx = (bx - br - 1.0).floor();
            while xx <= (bx + br + 1.0).ceil() {
                let nx = (xx + 0.5 - bx) / br; let ny = (yy + 0.5 - by) / (br * fl); let dd = nx * nx + ny * ny;
                if dd <= 1.0 + (hash2(xx + rcx * 7.0, yy + rcy * 3.0, 71.0) - 0.5) * 0.4 {
                    let (sx, sy) = (clamp(nx, -1.0, 1.0), clamp(ny, -1.0, 1.0));
                    let nz = max(0.0, 1.0 - sx * sx - sy * sy).sqrt();
                    let mut v = clamp((sx * l0 + sy * l1 + nz * l2) * 0.55 + 0.45, 0.0, 1.0) * 0.7 + (0.5 - (xx - c0) / r * 0.2 - (yy - c0) / r * 0.3) * 0.3;
                    if dd > 0.66 && ny > 0.2 { v -= 0.2; }
                    let hh = hash2(xx + rcx * 5.0, yy + rcy, 72.0); if hh < 0.06 { v += 0.24; } else if hh > 0.95 { v -= 0.22; }
                    if xx >= 0.0 && yy >= 0.0 && xx < size as f64 && yy < size as f64 {
                        let p = (yy as i32 * size + xx as i32) as usize * 4; let k = clamp((v * ramp_n as f64).floor(), 0.0, (ramp_n - 1) as f64) as usize * 3;
                        d[p] = ramp[k]; d[p + 1] = ramp[k + 1]; d[p + 2] = ramp[k + 2]; d[p + 3] = 255;
                    }
                }
                xx += 1.0;
            }
            yy += 1.0;
        }
    }
}
