// 회오리 깔때기 (game.js Vortex.funnelImg): 초당 30번 새로 그리는 픽셀
use crate::js::*;
use crate::noise::*;

const GROUND: f64 = 156.0;

// 깔때기 · 흙먼지 · 먹구름 색 (JS가 처음에 넘겨 줌)
static mut PAL: [Vec<[u8; 3]>; 3] = [Vec::new(), Vec::new(), Vec::new()];
pub fn set_pal(slot: usize, c: &[u8]) { unsafe { PAL[slot] = c.chunks(3).map(|c| [c[0], c[1], c[2]]).collect(); } }
fn pal(slot: usize) -> &'static [[u8; 3]] { unsafe { &(*std::ptr::addr_of!(PAL))[slot] } }
fn pick(p: &[[u8; 3]], v: f64) -> [u8; 3] { p[clamp((v * p.len() as f64).floor(), 0.0, (p.len() - 1) as f64) as usize] }

struct Buf<'a> { d: &'a mut [u8], cw: i32, chh: i32 }
impl Buf<'_> {
    fn put(&mut self, x: i32, y: i32, c: [u8; 3], a: f64) {
        if x < 0 || y < 0 || x >= self.cw || y >= self.chh || a <= 0.02 { return; }
        blend(self.d, ((y * self.cw + x) * 4) as usize, c, min(1.0, a));
    }
}

pub struct Args { pub cw: i32, pub chh: i32, pub ox: f64, pub oy: f64, pub x: f64, pub t: f64, pub sp: f64, pub dir: f64, pub big: bool, pub form: f64, pub low: f64, pub full: f64 }

pub fn draw(d: &mut [u8], a: &Args) {
    d.fill(0);
    let (tp, du, sc) = (pal(0), pal(1), pal(2));
    let mut b = Buf { d, cw: a.cw, chh: a.chh };
    let (t, sp, low, full, ox, oy) = (a.t, a.sp, a.low, a.full, a.ox, a.oy);
    let hb = if a.big { 40.0 } else { 30.0 };
    let cx_at = |u: f64| a.x + sin(t * 1.1 + u * 3.2) * 4.0 * (0.3 + u) + a.dir * u * u * 9.0 - ox;
    for yy in 0..a.chh {
        let y = yy as f64; let v = GROUND - (oy + y); if v < low || v > full + 2.0 { continue; }
        let u = clamp(v / full, 0.0, 1.0); let cx = cx_at(u); let r = 3.5 + pow(u, 1.7) * 30.0 + (if u < 0.07 { (0.07 - u) * 60.0 } else { 0.0 });
        let mut x = (cx - r - 3.0).floor();
        while x <= (cx + r + 3.0).ceil() {
            let s = (x + 0.5 - cx) / r; let es = s.abs() - (vnoise(v * 0.28 + t * 3.0, s * 2.0 + sp, 7711.0) - 0.5) * 0.3;
            if es <= 1.05 {
                let band = sin(asin(clamp(s, -1.0, 1.0)) * 2.4 + v * 0.22 - sp * 1.7);
                let lit = 0.47 - s * 0.26 + band * 0.16 + (vnoise(x * 0.3, v * 0.12 - t * 2.0, 7712.0) - 0.5) * 0.12 - u * 0.1;
                let mut col = pick(tp, lit);
                if u < 0.28 { col = mix(col, pick(du, lit), (0.28 - u) / 0.28 * 0.7); }
                b.put(x as i32, yy, col, clamp(1.2 - es * 1.15, 0.0, 1.0) * (0.92 - (if v < low + 6.0 { (low + 6.0 - v) / 6.0 * 0.6 } else { 0.0 })) * (if v > hb + 4.0 { 0.5 } else { 1.0 }));
            }
            x += 1.0;
        }
    }
    if low < 8.0 {   // 발치 흙먼지: 땅을 쓰는 치마 + 피어오르는 덩이
        let bx = cx_at(0.0); let k = 1.0 - low / 8.0;
        for yy in 0..a.chh {
            let v = GROUND - (oy + yy as f64); if v < -1.0 || v > 6.0 { continue; }
            let mut x = (bx - 34.0).floor();
            while x <= (bx + 34.0).ceil() {
                let dx = x + 0.5 - bx; let rr = hypot(dx / (28.0 + 4.0 * sin(t * 2.0 + dx * 0.1)), (v + 1.0) / 6.0);
                let sg = if dx != 0.0 { dx.signum() } else { 1.0 };
                let n = vnoise(dx * 0.18 - sp * 0.8 * sg, v * 0.4, 7713.0);
                if rr <= 0.75 + n * 0.4 { b.put(x as i32, yy, pick(du, 0.3 + n * 0.5), clamp((1.1 - rr) * 1.3, 0.0, 0.8) * k); }
                x += 1.0;
            }
        }
        let mut puffs: Vec<[f64; 5]> = (0..36).map(|i| {
            let i = i as f64; let h1 = hash2(i, 1.0, 7720.0); let h2 = hash2(i, 2.0, 7721.0); let h3 = hash2(i, 3.0, 7722.0); let rise = (t * (0.45 + h3 * 0.35) + h1) % 1.0; let v = rise * (hb + 2.0); let wv = 20.0 - rise * 10.0;
            let ang = sp * (1.05 + h2 * 0.45) + h2 * 6.283; let sa = sin(ang); let rr = wv * (0.25 + 0.75 * h3.sqrt());
            [bx + cos(ang) * rr, v + sa * 1.5, (5.4 - rise * 2.4) * (0.8 + h1 * 0.4), sa, rise]
        }).collect();
        puffs.sort_by(|p1, p2| p1[3].partial_cmp(&p2[3]).unwrap_or(std::cmp::Ordering::Equal));
        for &[px, pv, pr, sa, rise] in &puffs {
            let fade = (if rise > 0.82 { (1.0 - rise) / 0.18 } else { 1.0 }) * (if rise < 0.06 { rise / 0.06 } else { 1.0 });
            let mut yy = (pv - pr - 1.0).floor();
            while yy <= (pv + pr + 1.0).ceil() {
                let mut xx = (px - pr - 1.0).floor();
                while xx <= (px + pr + 1.0).ceil() {
                    let nx = (xx + 0.5 - px) / pr; let ny = (yy + 0.5 - pv) / pr; let dd = nx * nx + ny * ny; let en = (vnoise((xx - px) * 0.5 + pr * 3.0, (yy - pv) * 0.5 - t * 3.0, 7714.0) - 0.5) * 0.5;
                    if dd <= 1.0 + en {
                        let lit = 0.52 - nx * 0.15 + ny * 0.15 + sa * 0.12;
                        b.put(xx as i32, (GROUND - yy - oy) as i32, pick(du, lit), (if sa < 0.0 { 0.78 } else { 0.92 }) * fade * k * (if dd > 0.45 { max(0.2, 1.0 - (dd - 0.45) * 1.3) } else { 1.0 }));
                    }
                    xx += 1.0;
                }
                yy += 1.0;
            }
        }
    }
    if a.big || a.form > 0.2 {   // 꼭대기 먹구름 덩이
        let tx = cx_at(1.0);
        let mut x = (tx - 62.0).floor();
        while x <= (tx + 62.0).ceil() {
            let dx = (x - tx) / 62.0;
            if dx.abs() <= 1.0 {
                let bot = 22.0 - dx * dx * 14.0 + (vnoise(x * 0.12 + sp * 0.5 * a.dir, 1.0, 7715.0) - 0.5) * 6.0; let top_y = 2.0 + (vnoise(x * 0.08 - sp * 0.3, 2.0, 7716.0) - 0.5) * 6.0;
                let mut y = max(0.0, top_y.ceil());
                while y < 30.0 && y <= bot {
                    let n = vnoise((x - tx) * 0.09 + cos(sp * 0.4) * 2.0, y * 0.18 + sp * 0.25, 7717.0); let dep = (y - top_y) / max(1.0, bot - top_y);
                    b.put(x as i32, y as i32, pick(sc, 0.55 + n * 0.5 - dep * 0.45), (1.0 - pow(dx.abs(), 4.0)) * (if a.big { 1.0 } else { 0.85 }));
                    y += 1.0;
                }
            }
            x += 1.0;
        }
    }
}
