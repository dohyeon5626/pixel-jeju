// 픽셀 나무 수관 (scn_place의 pix_tree가 부름): 잎 덩이마다 구 음영 · 아랫단 그늘 테 · 반짝 잎 → RGBA
//  덩이 [x, y, 반지름]은 난수 순서를 지키려고 부르는 쪽에서 정해 넘김 · rcx, rcy: 반올림한 나무 자리 (잎 무늬 시드)
use crate::js::*;
use crate::noise::hash2;
use crate::scene::{sphere_light, Col};

pub fn blobs(d: &mut [u8], size: i32, blobs: &[[f64; 3]], rcx: f64, rcy: f64, r: f64, fl: f64, ramp: &[Col]) {
    d.fill(0);
    let ramp_n = ramp.len();
    let c0 = size as f64 / 2.0;
    for &[bx, by, br] in blobs {
        let mut yy = (by - br - 1.0).floor();
        while yy <= (by + br + 1.0).ceil() {
            let mut xx = (bx - br - 1.0).floor();
            while xx <= (bx + br + 1.0).ceil() {
                let nx = (xx + 0.5 - bx) / br;
                let ny = (yy + 0.5 - by) / (br * fl);
                let dd = nx * nx + ny * ny;
                if dd <= 1.0 + (hash2(xx + rcx * 7.0, yy + rcy * 3.0, 71.0) - 0.5) * 0.4 {
                    let mut v = sphere_light(clamp(nx, -1.0, 1.0), clamp(ny, -1.0, 1.0)) * 0.7
                        + (0.5 - (xx - c0) / r * 0.2 - (yy - c0) / r * 0.3) * 0.3;
                    if dd > 0.66 && ny > 0.2 {
                        v -= 0.2;
                    }
                    let hh = hash2(xx + rcx * 5.0, yy + rcy, 72.0);
                    if hh < 0.06 {
                        v += 0.24;
                    } else if hh > 0.95 {
                        v -= 0.22;
                    }
                    if xx >= 0.0 && yy >= 0.0 && xx < size as f64 && yy < size as f64 {
                        let p = (yy as i32 * size + xx as i32) as usize * 4;
                        let c = ramp[clamp((v * ramp_n as f64).floor(), 0.0, (ramp_n - 1) as f64) as usize];
                        d[p..p + 3].copy_from_slice(&c);
                        d[p + 3] = 255;
                    }
                }
                xx += 1.0;
            }
            yy += 1.0;
        }
    }
}
