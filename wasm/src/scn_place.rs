// 명소 배경 (원래 places.js): 이호테우 해변 · 서귀포 귤밭 · 정방폭포 · 천지연폭포 · 명소 땅
//  공용 그림 도구: 픽셀 나무 · 곰솔 · 폭포 · 물보라 · 덩굴 · 갯바위 · 주상절리 · 테트라포드 · 말 등대 · 방파제
//  난수(R)를 부르는 순서까지 원래 JS 그대로
use crate::js::*;
use crate::noise::{hash2, vnoise, Rng};
use crate::scene::*;
use crate::scn_theme;

fn cols_a(v: &[&str], ph: &Phase, d: f64) -> Vec<Col> {
    atmos(v, ph, d)
}

// ── 공용 도구 ─────────────────────────────────────────────────
// 바다 바탕: 수평선 top부터 아래로 짙어지는 그러데이션 + 잔물결
fn sea_base(c: &mut Canvas, lw: f64, ph: &Phase, top: f64, cols0: &[&str], seed: f64) {
    let cols = cols_a(cols0, ph, 0.12);
    let mut r = rng(seed);
    let mut y = top;
    while y < 140.0 {
        for i in 0..lw as i32 {
            let i = i as f64;
            let f = (y - top + (vnoise(i * 0.045, y * 0.08, seed) - 0.5) * 3.0) / (140.0 - top);
            c.px(i, y, band(&cols, clamp(1.0 - f * 1.1, 0.0, 0.999)));
        }
        y += 1.0;
    }
    let white = atmo(hx("#ffffff"), ph, 0.1);
    for _ in 0..60 {
        let yy = top + 2.0 + (pow(r.next(), 1.6) * (138.0 - top)).floor();
        let x = (r.next() * lw).floor();
        let w = 2.0 + (r.next() * 4.0).floor();
        c.fill(x, yy, w, 1.0, white);
    }
}

#[derive(Default, Clone, Copy)]
pub struct TreeOpt {
    pub flat: f64,
    pub blobs: f64,
    pub spread: f64,
    pub flowers: Option<(Col, Col)>,
}
pub fn tb(n: f64) -> TreeOpt {
    TreeOpt { blobs: n, ..Default::default() }
}
// 픽셀 수관: 작은 잎 덩이 여러 개 (덩이 칠하기는 tree.rs)
pub fn pix_tree(c: &mut Canvas, cx: f64, cy: f64, r: f64, ramp: &[Col], rr: &mut Rng, o: TreeOpt) {
    let fl = if o.flat != 0.0 { o.flat } else { 0.82 };
    let size = (r * 2.8).ceil() + 8.0;
    let c0 = size / 2.0;
    let n = if o.blobs != 0.0 { o.blobs } else { max(5.0, round(r * 0.9)) };
    let spread = if o.spread != 0.0 { o.spread } else { 0.6 };
    let mut blobs = vec![[c0, c0 - r * 0.08, r * 0.58]];
    let mut k = 0.0;
    while k < n {
        let a = rr.next() * 6.283;
        let d = rr.next().sqrt() * r * spread;
        let s = r * (0.32 + rr.next() * 0.26);
        blobs.push([c0 + cos(a) * d, c0 + sin(a) * d * fl, s]);
        k += 1.0;
    }
    blobs.sort_by(|p, q| p[1].partial_cmp(&q[1]).unwrap_or(std::cmp::Ordering::Equal));
    let mut img = Canvas::new(size as i32, size as i32);
    crate::tree::blobs(&mut img.d, size as i32, &blobs, round(cx), round(cy), r, fl, ramp);
    c.draw(&img, round(cx - c0), round(cy - c0));
    if let Some((f0, f1)) = o.flowers {
        let mut k = 0.0;
        while k < r * 1.3 {
            let a = rr.next() * 6.283;
            let d = rr.next().sqrt() * r * 0.75;
            let fx = round(cx + cos(a) * d);
            let fy = round(cy + sin(a) * d * fl);
            if img.alpha(round(fx - cx + c0) as i32, round(fy - cy + c0) as i32) != 0 {
                c.fill(fx, fy, 2.0, 1.0, f0);
                c.px(fx, fy, f1);
            }
            k += 1.0;
        }
    }
}
// 픽셀 곰솔: 바닷바람에 굽은 줄기 · 옆으로 뻗은 가지 · 가지 끝 납작한 솔잎 덩이
fn pix_pine(c: &mut Canvas, cx: f64, base: f64, hh: f64, ramp: &[Col], trunk: &[Col], r: &mut Rng, lean: f64) {
    let mut pts = vec![];
    let (mut px, mut py) = (cx, base);
    for _ in 0..=10 {
        pts.push((px, py));
        py -= hh * 0.08;
        px += lean * hh * 0.045 + (r.next() - 0.5) * 1.1;
    }
    for k in 0..10 {
        let ((x1, y1), (x2, y2)) = (pts[k], pts[k + 1]);
        let st = (hypot(x2 - x1, y2 - y1) * 1.5).ceil();
        let w = if k < 4 { 2.0 } else { 1.0 };
        let mut q = 0.0;
        while q <= st {
            let tx = round(x1 + (x2 - x1) * q / st);
            let ty = round(y1 + (y2 - y1) * q / st);
            c.fill(tx, ty, w, 1.0, trunk[0]);
            if w > 1.0 {
                c.px(tx, ty, trunk[1]);
            }
            q += 1.0;
        }
    }
    for k in 0..5 {
        let p = pts[(10).min(5 + k)];
        let side = if k % 2 == 1 { 1.0 } else { -1.0 };
        let reach = if k == 4 { 0.0 } else { hh * (0.12 + r.next() * 0.16) };
        let (ex, ey) = (round(p.0 + side * reach), round(p.1 - 1.0));
        let mut q = 0.0;
        while q <= reach {
            c.px(round(p.0 + side * q), round(p.1 - q * 0.15), trunk[0]);
            q += 1.0;
        }
        let rad = hh * (0.15 + r.next() * 0.06) * if k == 4 { 1.15 } else { 1.0 };
        pix_tree(c, ex, ey, rad, ramp, r, TreeOpt { flat: 0.42, blobs: 5.0, spread: 0.95, flowers: None });
    }
}
// 픽셀 폭포: 아래로 조금 퍼짐 · 세로 물결 줄 · 가장자리는 짙은 물빛, 가운데는 희게 · 오른쪽 그늘 · 벼랑 끝 흰 물마루
fn pix_fall(c: &mut Canvas, x0: f64, w: f64, y0: f64, y1: f64, ph: &Phase, seed: f64, d: f64, spread: f64) {
    let wr = cols_a(&["#4a6e90", "#6a92b2", "#92b6cc", "#bcd6e2", "#e2eef4", "#ffffff"], ph, d);
    let mut y = y0;
    while y < y1 {
        let t = (y - y0) / max(1.0, y1 - y0);
        let ww = w * (1.0 + t * spread);
        let lip = if y - y0 < 5.0 { round((1.0 - (y - y0) / 5.0) * 2.0) } else { 0.0 };
        let cxm = x0 + w / 2.0 + sin(t * 2.4) * 1.0 - lip;
        let l = round(cxm - ww / 2.0 + (vnoise(y * 0.22, 1.0, seed) - 0.5) * 2.0);
        let rr = round(cxm + ww / 2.0 + (vnoise(y * 0.22, 2.0, seed) - 0.5) * 2.0);
        let mut i = l;
        while i <= rr {
            let u = (i - l) / max(1.0, rr - l);
            let st = vnoise(i * 0.55 + seed, y * 0.03 - t * 2.0, seed + 3.0);
            let edge = min(u, 1.0 - u);
            let mut v =
                0.32 + (if st > 0.6 {
                    0.56
                } else if st > 0.42 {
                    0.32
                } else {
                    0.08
                }) + edge * 0.35
                    - if u > 0.68 { (u - 0.68) * 1.1 } else { 0.0 };
            if i == l || i == rr {
                v = 0.2;
            }
            if y - y0 < 3.0 {
                v = 0.99;
            } else if hash2((i as i32 >> 1) as f64, y, seed + 4.0) < 0.04 {
                v += 0.3;
            }
            c.px(i, y, wr[clamp((v * wr.len() as f64).floor(), 0.0, (wr.len() - 1) as f64) as usize]);
            i += 1.0;
        }
        y += 1.0;
    }
    c.fill(round(x0 - 3.0), y0 - 1.0, round(w + 4.0), 1.0, atmo(hx("#2a2622"), ph, d));
}
// 픽셀 물보라: 몽글몽글한 흰 거품 덩이 · 위로 튀는 물방울 · 물 위로 퍼지는 거품 줄 · 둘레 물안개
fn pix_foam(c: &mut Canvas, cx: f64, cy: f64, w: f64, ph: &Phase, seed: f64, water: bool) {
    let f = cols_a(&["#6a9cbc", "#9cc4dc", "#cde4f0", "#ecf6fa", "#ffffff"], ph, 0.1);
    let mut r = rng(seed);
    let mut k = 0.0;
    while k < w * 5.0 {
        let a = PI + r.next() * PI;
        let d = w * (0.5 + r.next() * 1.0);
        if r.next() < 0.6 {
            c.px(round(cx + cos(a) * d * 1.3), round(cy - 2.0 + sin(a) * d * 0.9), f[2]);
        }
        k += 1.0;
    }
    let pw = (w * 2.8).ceil() + 8.0;
    let phh = (w * 1.2).ceil() + 10.0;
    let mut pb = Pb::new(pw as i32, phh as i32);
    let ox = pw / 2.0;
    let base = phh - 5.0;
    let mut puffs = vec![];
    let mut k = 0.0;
    while k < round(w * 0.9) {
        let t = r.next() * 2.0 - 1.0;
        let pr = w * (0.16 + r.next() * 0.14) * (1.25 - t.abs() * 0.55);
        let py = base - (1.0 - t * t) * w * (0.25 + r.next() * 0.3) - pr * 0.3;
        puffs.push([ox + t * w * 1.05, py, pr]);
        k += 1.0;
    }
    puffs.sort_by(|p, q| p[1].partial_cmp(&q[1]).unwrap_or(std::cmp::Ordering::Equal));
    for [px, py, pr] in puffs {
        let mut yy = (py - pr).floor();
        while yy <= py + pr {
            let mut xx = (px - pr).floor();
            while xx <= px + pr {
                let nx = (xx + 0.5 - px) / pr;
                let ny = (yy + 0.5 - py) / pr;
                let d2 = nx * nx + ny * ny;
                if !(d2 > 1.0 || yy > base + round(sin(xx * 0.7) * 1.5)) {
                    let v = sphere_light(clamp(nx, -1.0, 1.0), clamp(ny, -1.0, 1.0));
                    pb.set(
                        xx,
                        yy,
                        if d2 > 0.76 && ny > 0.25 {
                            f[1]
                        } else if v > 0.78 {
                            f[4]
                        } else if v > 0.55 {
                            f[3]
                        } else {
                            f[2]
                        },
                    );
                }
                xx += 1.0;
            }
            yy += 1.0;
        }
    }
    c.draw(&pb.sel_out(0.3).canvas(), round(cx - ox), round(cy - base));
    let mut k = 0.0;
    while k < w * 3.0 {
        let a = PI + 0.15 + r.next() * (PI - 0.3);
        let d = w * (0.75 + r.next() * 0.9);
        let sz = if r.next() < 0.25 { 2.0 } else { 1.0 };
        c.fill(round(cx + cos(a) * d * 1.2), round(cy - w * 0.25 + sin(a) * d * 0.85), sz, sz, f[4]);
        k += 1.0;
    }
    if water {
        let mut k = 0.0;
        while k < w * 2.2 {
            let ox2 = (r.next() - 0.5) * w * 3.8;
            let ln = 2.0 + (r.next() * 6.0).floor() - (ox2.abs() / w).floor();
            if ln > 0.0 {
                let y = round(cy + 1.0 + r.next() * 10.0);
                c.fill(round(cx + ox2), y, ln, 1.0, f[3 + (k as usize % 2)]);
            }
            k += 1.0;
        }
    }
}
fn pix_vines(c: &mut Canvas, x0: f64, y0: f64, len: f64, ramp: &[Col], seed: f64) {
    let mut y = 0.0;
    while y < len {
        let ox = round(sin((y + seed) * 0.5) * 1.2);
        c.px(x0 + ox, y0 + y, ramp[if (y + seed) as i64 % 3 == 0 { 3 } else { 1 }]);
        if hash2(x0, y + seed, 81.0) < 0.35 {
            c.px(x0 + ox + if hash2(y, x0, 82.0) < 0.5 { -1.0 } else { 1.0 }, y0 + y, ramp[2]);
        }
        y += 1.0;
    }
}
// 갯바위 (구 음영 + 숨구멍 + 윗면 이끼)
fn basalt_rock(c: &mut Canvas, rx: f64, ry: f64, w: f64, hh: f64, st: &[Col], r: &mut Rng, moss: Option<&[Col]>) {
    let mut pb = Pb::new((w + 2.0) as i32, (hh + 2.0) as i32);
    for yy in 1..=hh as i32 {
        for xx in 1..=w as i32 {
            let (xf, yf) = (xx as f64, yy as f64);
            let nx = (xf - (w + 1.0) / 2.0) / (w / 2.0);
            let ny = (yf - (hh + 1.0) / 2.0) / (hh / 2.0);
            if pow(nx.abs(), 1.7) + pow(ny.abs(), 1.5) > 0.84 + 0.22 * vnoise(xf * 0.35, yf * 0.35, rx + 71.0) {
                continue;
            }
            let v = sphere_light(clamp(nx, -1.0, 1.0), clamp(ny, -1.0, 1.0));
            pb.set(
                xf,
                yf,
                st[if v < 0.32 {
                    0
                } else if v < 0.5 {
                    1
                } else if v < 0.72 {
                    2
                } else if v < 0.88 {
                    3
                } else {
                    4
                }],
            );
        }
    }
    let mut k = 0.0;
    while k < w * hh / 14.0 {
        let a = 1.0 + (r.next() * w).floor();
        let b = 1.0 + (r.next() * hh).floor();
        if pb.get(a, b).is_some() && pb.get(a, b + 1.0).is_some() {
            pb.set(a, b, st[0]);
            pb.set(a, b + 1.0, st[3]);
        }
        k += 1.0;
    }
    if let Some(m) = moss {
        for yy in 0..(hh + 2.0) as i32 {
            for xx in 0..(w + 2.0) as i32 {
                let (xf, yf) = (xx as f64, yy as f64);
                if pb.get(xf, yf).is_some() && pb.get(xf, yf - 1.0).is_none() && hash2(xf + rx, yf, 41.0) < 0.7 {
                    pb.set(xf, yf, m[if xf < (w + 2.0) * 0.6 { 1 } else { 0 }]);
                }
            }
        }
    }
    c.draw(&pb.sel_out(0.5).canvas(), rx, ry);
}
// 현무암 주상절리: 다각형 윤곽 안만 (기둥 칠하기는 basalt.rs) · warp: x0..=x1 휜 좌표
fn basalt_wall(
    c: &mut Canvas,
    pts: &[(f64, f64)],
    x0: f64,
    x1: f64,
    y_top: f64,
    y_bot: f64,
    seed: f64,
    ramp: &[Col],
    rag: f64,
    moss: f64,
    moss_cols: [Col; 2],
    warp: &dyn Fn(f64) -> f64,
) {
    let md = poly_alpha(c.w, c.h, pts);
    let wxv: Vec<f64> = (x0 as i32..=x1 as i32).map(|i| warp(i as f64)).collect();
    let o = crate::basalt::Opt { ramp, rag, moss, moss_cols };
    let (w, hh) = (c.w, c.h);
    crate::basalt::wall(&md, &mut c.d, w, hh, x0 as i32, x1 as i32, y_top, y_bot, seed, &wxv, &o);
}
// 테트라포드: 네 다리 중심에서 뻗은 굵은 선 · 왼쪽 위에서 빛
fn tetrapod(s: f64, seed: f64, cols: &[Col]) -> Canvas {
    let n = round(9.0 * s) + 4.0;
    let mut pb = Pb::new(n as i32, n as i32);
    let c = n / 2.0;
    let r = max(1.1, 1.5 * s);
    let l = 3.6 * s;
    let rot = hash2(seed, 1.0, 5.0) * 6.28;
    let legs: Vec<(f64, f64)> = [(0.0, -1.0), (0.87, 0.5), (-0.87, 0.5)]
        .iter()
        .map(|&(a, b)| {
            let (ca, sa) = (cos(rot * 0.3), sin(rot * 0.3));
            (a * ca - b * sa, a * sa + b * ca)
        })
        .collect();
    let seg_d = |px: f64, py: f64, ax: f64, ay: f64, bx: f64, by: f64| {
        let (vx, vy) = (bx - ax, by - ay);
        let t = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy), 0.0, 1.0);
        hypot(px - ax - vx * t, py - ay - vy * t)
    };
    for y in 0..n as i32 {
        for i in 0..n as i32 {
            let (xf, yf) = (i as f64 + 0.5, y as f64 + 0.5);
            let mut hit = hypot(xf - c, yf - c) < r * 1.25;
            for &(dx, dy) in &legs {
                if seg_d(xf, yf, c, c, c + dx * l, c + dy * l) < r * (1.0 - 0.15) {
                    hit = true;
                }
            }
            if !hit {
                continue;
            }
            let v = 0.62 - (xf - c) / n * 0.7 - (yf - c) / n * 0.8 + (hash2(i as f64 + seed, y as f64, 7.0) - 0.5) * 0.12;
            pb.set(i as f64, y as f64, band(cols, clamp(v, 0.0, 0.999)));
        }
    }
    pb.sel_out(0.55).canvas()
}
// 테트라포드 더미 (삼각형으로 쌓임) · 덮은 자리를 돌려줌
fn tetra_pile(c: &mut Canvas, cx: f64, base: f64, w: f64, s: f64, ph: &Phase, seed: f64) -> (f64, f64) {
    let cols = cols_a(&["#6e6a62", "#8e8a80", "#b0aa9e", "#cec8bc", "#e6e0d4"], ph, 0.06);
    let mut r = rng(seed);
    let rows = max(1.0, round(w / (9.0 * s) / 1.6));
    let mut rr = 0.0;
    while rr < rows {
        let cnt = max(1.0, round((w / (8.0 * s)) * (1.0 - rr / (rows + 0.5))));
        let rw = cnt * 7.0 * s;
        let mut k = 0.0;
        while k < cnt {
            let img = tetrapod(s * (0.85 + r.next() * 0.3), seed + rr * 31.0 + k, &cols);
            let x = round(cx - rw / 2.0 + k * 7.0 * s + (r.next() - 0.5) * 3.0 * s);
            let y = round(base - img.h as f64 - rr * 5.0 * s + (r.next() - 0.5) * 2.0);
            c.draw(&img, x, y);
            k += 1.0;
        }
        rr += 1.0;
    }
    (round(cx - w / 2.0), w)
}
// 말 모양 등대 (이호테우): 기단 → 앞다리를 들고 선 몸통 → 목과 머리 → 머리 위 등롱
fn horse_light(c: &mut Canvas, bx: f64, base: f64, red: bool, ph: &Phase, face: f64) {
    let b =
        cols_a(if red { &["#7a1e1a", "#b8322a", "#de5244", "#f2846e"] } else { &["#9a9aa6", "#c8c8cc", "#ececea", "#ffffff"] }, ph, 0.12);
    let dark = atmo(hx(if red { "#4a1410" } else { "#6a6a78" }), ph, 0.12);
    let glass = atmo(hx("#ffe9a0"), ph, 0.12);
    let mut pb = Pb::new(22, 40);
    let sh = |i: f64, l: f64, r: f64| {
        if i <= l + 1.0 {
            b[3]
        } else if i >= r - 1.0 {
            b[0]
        } else {
            b[2]
        }
    };
    for y in 34..40 {
        for i in 3..19 {
            let (i, y) = (i as f64, y as f64);
            pb.set(
                i,
                y,
                if y == 34.0 {
                    b[3]
                } else if y > 37.0 {
                    b[0]
                } else {
                    sh(i, 3.0, 18.0)
                },
            );
        }
    }
    for y in 31..34 {
        for i in 5..17 {
            let (i, y) = (i as f64, y as f64);
            pb.set(i, y, if y == 31.0 { b[3] } else { sh(i, 5.0, 16.0) });
        }
    }
    for y in 14..31 {
        let yf = y as f64;
        let t = (yf - 14.0) / 17.0;
        let l = round(7.0 - (1.0 - t) * 1.0);
        let r = round(14.0 + (1.0 - t) * 2.0);
        let mut i = l;
        while i <= r {
            if !(y > 25 && (10.0..=11.0).contains(&i)) {
                pb.set(i, yf, sh(i, l, r));
            }
            i += 1.0;
        }
    }
    for k in 0..8 {
        let kf = k as f64;
        let y = 14.0 - kf;
        let l = 9.0 + round(kf * 0.6);
        let r = l + 5.0;
        let mut i = l;
        while i <= r {
            pb.set(i, y, sh(i, l, r));
            i += 1.0;
        }
    }
    for y in 3..9 {
        for i in 13..21 {
            if (i > 18 && y < 5) || (i == 20 && y > 7) {
                continue;
            }
            pb.set(
                i as f64,
                y as f64,
                if y == 3 {
                    b[3]
                } else if y == 8 {
                    b[0]
                } else {
                    b[2]
                },
            );
        }
    }
    pb.set(14.0, 2.0, b[2]);
    pb.set(14.0, 1.0, b[1]);
    pb.set(16.0, 2.0, b[1]);
    pb.set(17.0, 5.0, dark);
    pb.set(20.0, 6.0, dark);
    for y in 6..16 {
        let yf = y as f64;
        pb.set(9.0 + round((15.0 - yf) * 0.5), yf, dark);
    }
    for i in 12..18 {
        pb.set(i as f64, 0.0, dark);
    }
    let mut img = pb.sel_out(0.6).canvas();
    if face < 0.0 {
        img = img.flip();
    }
    c.draw(&img, bx - 11.0, base - 40.0);
    c.fill(if face > 0.0 { bx + 3.0 } else { bx - 5.0 }, base - 40.0, 2.0, 1.0, glass);
}
// 방파제: 콘크리트 둑 (윗면 · 옆면 · 계단)
fn jetty(c: &mut Canvas, x0: f64, x1: f64, y: f64, ph: &Phase, steps: Option<f64>) {
    let a = |k: &str| atmo(hx(k), ph, 0.12);
    let mut i = x0;
    while i < x1 {
        c.px(i, y, a("#d0cabe"));
        c.fill(i, y + 1.0, 1.0, 3.0, a("#a8a296"));
        c.px(i, y + 4.0, a("#6a665e"));
        c.px(i, y + 5.0, a("#3e4a52"));
        i += 1.0;
    }
    if let Some(st) = steps {
        if st != 0.0 {
            for k in 0..5 {
                let kf = k as f64;
                c.fill(st + kf * 2.0, y - kf, 2.0, kf + 1.0, a(if k % 2 == 1 { "#b8b2a6" } else { "#8a857c" }));
            }
        }
    }
}
fn foam_band(c: &mut Canvas, lw: i32, ph: &Phase, seed: f64) {
    for i in 0..lw {
        let i = i as f64;
        let y = 138.0 + round((vnoise(i * 0.09, 0.5, seed) - 0.5) * 4.0);
        c.fill(i, y, 1.0, 2.0, atmo(hx("#e8f6ff"), ph, 0.05));
        c.px(i, y + 2.0, atmo(hx("#9ad0ec"), ph, 0.05));
    }
}
fn mask_json(m: &[u8]) -> String {
    format!("\"foamMask\":[{}]", m.iter().map(|v| v.to_string()).collect::<Vec<_>>().join(","))
}

// ═════════════════ 이호테우 해변 ═════════════════
fn iho_far(ph: &Phase) -> Canvas {
    // 수평선 왼쪽 멀리 제주 시내 · 오른쪽은 탁 트인 바다
    let lw = layer_w(L_HALL);
    let lwf = lw as f64;
    let mut c = Canvas::new(lw, 140);
    let mut r = rng(301.0);
    let (city, city2, hill) = (atmo(hx("#a4acb6"), ph, 0.6), atmo(hx("#bcc2c8"), ph, 0.65), atmo(hx("#9aa8ac"), ph, 0.65));
    let mut i = 0.0;
    while i < lwf * 0.4 {
        let t = round(2.0 + vnoise(i * 0.03, 0.4, 302.0) * 5.0 * (1.0 - i / (lwf * 0.4)));
        c.fill(i, 103.0 - t, 1.0, t + 1.0, hill);
        i += 1.0;
    }
    let mut i = 0.0;
    while i < lwf * 0.3 {
        let w = 2.0 + (r.next() * 4.0).floor();
        let hh = 1.0 + (r.next() * 4.0).floor();
        let col = if r.next() < 0.5 { city } else { city2 };
        c.fill(i, 103.0 - hh, w, hh + 1.0, col);
        i += w + (r.next() * 3.0).floor();
    }
    c
}
fn iho_sea(ph: &Phase) -> Canvas {
    // 옥빛 바다 · 왼쪽 방파제 끝 빨간 말 등대 · 오른쪽 테트라포드 무더기 위 하얀 말 등대
    let lw = layer_w(L_FIELD);
    let lwf = lw as f64;
    let mut c = Canvas::new(lw, 140);
    let top = 104.0;
    sea_base(&mut c, lwf, ph, top, &["#1e6e96", "#2a8cb0", "#3aa8c4", "#6cc8d4", "#a8e2e4"], 311.0);
    let (lx, rx) = (round(lwf * 0.2), round(lwf * 0.74));
    jetty(&mut c, 0.0, lx + 16.0, top + 8.0, ph, Some(lx - 30.0));
    tetra_pile(&mut c, lx + 18.0, top + 15.0, 40.0, 0.8, ph, 312.0);
    horse_light(&mut c, lx + 2.0, top + 8.0, true, ph, 1.0);
    jetty(&mut c, rx + 10.0, lwf, top + 6.0, ph, None);
    let rail = atmo(hx("#e8e4dc"), ph, 0.12);
    let mut i = rx + 14.0;
    while i < lwf {
        c.px(i, top + 3.0, rail);
        if i as i64 % 5 == 0 {
            c.fill(i, top + 3.0, 1.0, 3.0, rail);
        }
        i += 1.0;
    }
    tetra_pile(&mut c, rx - 2.0, top + 14.0, 76.0, 0.9, ph, 313.0);
    horse_light(&mut c, rx + 4.0, top + 1.0, false, ph, -1.0);
    let bx = round(lwf * 0.5);
    c.fill(bx, top - 2.0, 1.0, 7.0, atmo(hx("#2a2a30"), ph, 0.1));
    c.fill(bx, top - 1.0, 1.0, 3.0, atmo(hx("#e8c43a"), ph, 0.1)); // 항로 표지
    c
}
fn iho_near(ph: &Phase) -> (Canvas, String) {
    let lw = layer_w(L_NEAR);
    let lwf = lw as f64;
    let mut c = Canvas::new(lw, 160);
    let mut r = rng(321.0);
    let a = |k: &str| atmo(hx(k), ph, 0.05);
    let mut mask = vec![0u8; lw as usize];
    let mut cover = |(x0, w): (f64, f64)| {
        let mut k = max(0.0, x0);
        while k < min(lwf, x0 + w) {
            mask[k as usize] = 1;
            k += 1.0;
        }
    };
    foam_band(&mut c, lw, ph, 322.0);
    let s = cols_a(&["#a49884", "#bcb09a", "#8e8270"], ph, 0.05);
    c.fill(0.0, 141.0, lwf, 20.0, s[0]);
    c.fill(0.0, 141.0, lwf, 2.0, a("#8a8070"));
    for k in 0..240 {
        let (x, y) = ((r.next() * lwf).floor(), 143.0 + (r.next() * 14.0).floor());
        c.fill(x, y, 2.0, 1.0, s[1 + k % 2]);
    }
    cover(tetra_pile(&mut c, 22.0, 146.0, 70.0, 1.4, ph, 323.0));
    cover(tetra_pile(&mut c, lwf - 20.0, 145.0, 46.0, 1.2, ph, 324.0));
    (c, mask_json(&mask))
}

// ═════════════════ 서귀포 귤밭 ═════════════════
fn grove_fields(ph: &Phase) -> Canvas {
    // 먼 귤밭: 짙은 귤나무 줄 + 점점이 귤 · 삼나무 방풍림 · 비닐하우스
    let lw = layer_w(L_FIELD);
    let lwf = lw as f64;
    let mut c = Canvas::new(lw, 140);
    let mut r = rng(401.0);
    let d = 0.2;
    let t: Vec<Col> = ["#1e4a30", "#2a5e38", "#3a7444"].iter().map(|k| atmo(mute(hx(k), 0.8), ph, d)).collect();
    let (o, wall, gr) = (atmo(hx("#ff9a2a"), ph, d), atmo(hx("#3a3646"), ph, d), atmo(hx("#5a8a46"), ph, d));
    c.fill(0.0, 110.0, lwf, 30.0, gr);
    for (y, s) in [(112.0, 2.0), (117.0, 3.0), (123.0, 4.0), (130.0, 5.0)] {
        for i in 0..lw {
            c.px(i as f64, y + s + 1.0, wall);
        } // 밭담 줄
        let mut i = (r.next() * 4.0).floor();
        while i < lwf {
            for yy in 0..=s as i32 {
                for xx in 0..=s as i32 {
                    let (xf, yf) = (xx as f64, yy as f64);
                    if hypot(xf - s / 2.0, yf - s / 2.0) <= s / 2.0 + 0.3 {
                        c.px(
                            i + xf,
                            y + yf,
                            t[if xf + yf < s {
                                2
                            } else if xf + yf > s * 1.4 {
                                0
                            } else {
                                1
                            }],
                        );
                    }
                }
            }
            if r.next() < 0.6 {
                let (ox, oy) = ((r.next() * s).floor(), (r.next() * s).floor());
                c.px(i + ox, y + oy, o);
            }
            i += s + 2.0;
        }
    }
    let (ced, ced_l) = (atmo(hx("#1a3a2a"), ph, d), atmo(hx("#2a5038"), ph, d));
    for (y, n) in [(112.0, 5), (118.0, 4), (125.0, 3)] {
        for _ in 0..n {
            let sx = (r.next() * lwf).floor();
            let len = 16.0 + (r.next() * 30.0).floor();
            let mut tt = 0.0;
            while tt < len {
                let hh = 5.0 + if hash2(sx + tt, y, 3.0) < 0.5 { 1.0 } else { 0.0 };
                c.fill(sx + tt, y - hh, 2.0, hh, ced);
                c.px(sx + tt, y - hh, ced_l);
                tt += 2.0;
            }
        }
    }
    let (vh, vh_s) = (atmo(hx("#dfe6e8"), ph, d), atmo(hx("#a8b4b8"), ph, d));
    for k in 0..3 {
        let kf = k as f64;
        let hx_ = (lwf * (0.15 + kf * 0.3) + r.next() * 30.0).floor();
        let hy = 121.0 + ((k % 2) * 5) as f64;
        for n in 0..4 {
            for i in 0..7 {
                let (nf, i) = (n as f64, i as f64);
                let hh = round(sin((i + 0.5) / 7.0 * PI) * 3.0);
                c.fill(hx_ + nf * 7.0 + i, hy - hh, 1.0, hh + 2.0, if i > 4.0 { vh_s } else { vh });
            }
        }
    }
    c
}
fn grove_near(ph: &Phase) -> Canvas {
    // 현무암 돌담 위로 귤이 주렁주렁 달린 귤나무 덤불 · 나무 전봇대와 전깃줄
    let lw = layer_w(L_NEAR);
    let lwf = lw as f64;
    let mut c = Canvas::new(lw, 160);
    let mut r = rng(411.0);
    let a = |k: &str| atmo(hx(k), ph, 0.05);
    let l = cols_a(&["#163a20", "#22502a", "#326a34", "#4a8a40", "#6aa84c"], ph, 0.05);
    let o: Vec<Col> = ctx().pal.org.iter().map(|&k| atmo(k, ph, 0.05)).collect();
    let st = cols_a(&["#1e1c24", "#2e2c36", "#46434e", "#625e6a", "#837e8a"], ph, 0.05);
    let top: Vec<f64> = (0..lw)
        .map(|i| {
            let i = i as f64;
            round(112.0 - vnoise(i * 0.05, 0.3, 412.0) * 12.0 - sin(i * 0.11 + vnoise(i * 0.02, 1.0, 413.0) * 3.0).abs() * 6.0)
        })
        .collect();
    for i in 0..lw {
        let t0 = top[i as usize];
        let i = i as f64;
        let mut y = t0;
        while y < 140.0 {
            let d2 = y - t0;
            let v = 0.75 - d2 / 34.0 + (vnoise(i * 0.25, y * 0.25, 414.0) - 0.5) * 0.5 + if d2 < 2.0 { 0.2 } else { 0.0 };
            c.px(i, y, band(&l, clamp(v, 0.0, 0.999)));
            y += 1.0;
        }
    }
    let mut k = 0.0;
    while k < lwf * 0.5 {
        let i = (r.next() * lwf).floor();
        let y = top[i as usize] + 2.0 + (r.next() * 20.0).floor();
        c.fill(i, y, 2.0, 1.0, l[3]);
        c.px(i, y - 1.0, l[4]);
        k += 1.0;
    }
    let mut k = 0.0;
    while k < lwf * 0.42 {
        // 귤: 주렁주렁
        let i = (r.next() * lwf).floor();
        let ti = top[i as usize];
        let y = ti + 3.0 + (pow(r.next(), 0.8) * (138.0 - ti - 6.0)).floor();
        let big = r.next() < 0.35;
        c.fill(i, y, if big { 3.0 } else { 2.0 }, if big { 3.0 } else { 2.0 }, o[1]);
        c.fill(i, y, if big { 2.0 } else { 1.0 }, if big { 2.0 } else { 1.0 }, o[2]);
        c.px(i, y, o[3]);
        k += 1.0;
    }
    c.fill(0.0, 138.0, lwf, 14.0, st[0]);
    let stone = |c: &mut Canvas, r: &mut Rng, sx: f64, sy: f64, w: f64, hh: f64| {
        let mut pb = Pb::new((w + 2.0) as i32, (hh + 2.0) as i32);
        for yy in 1..=hh as i32 {
            for xx in 1..=w as i32 {
                let (xf, yf) = (xx as f64, yy as f64);
                let nx = (xf - (w + 1.0) / 2.0) / (w / 2.0);
                let ny = (yf - (hh + 1.0) / 2.0) / (hh / 2.0);
                if pow(nx.abs(), 2.2) + pow(ny.abs(), 2.2) > 0.95 + 0.2 * vnoise(xf * 0.4, yf * 0.4, sx + 9.0) {
                    continue;
                }
                let v = sphere_light(clamp(nx, -1.0, 1.0), clamp(ny, -1.0, 1.0));
                pb.set(
                    xf,
                    yf,
                    st[if v < 0.35 {
                        1
                    } else if v < 0.6 {
                        2
                    } else if v < 0.85 {
                        3
                    } else {
                        4
                    }],
                );
            }
        }
        let mut k = 0.0;
        while k < w * hh / 12.0 {
            let a = 1.0 + (r.next() * w).floor();
            let b = 1.0 + (r.next() * hh).floor();
            if pb.get(a, b).is_some() {
                pb.set(a, b, st[0]);
            }
            k += 1.0;
        }
        c.draw(&pb.sel_out(0.6).canvas(), sx - 1.0, sy - 1.0);
    };
    for (y, off, hh) in [(146.0, 0.0, 8.0), (139.0, 5.0, 8.0), (133.0, 2.0, 6.0)] {
        let mut i = -off;
        while i < lwf {
            let w = 8.0 + (r.next() * 8.0).floor();
            let h2 = hh - (r.next() * 2.0).floor();
            let sy = y + (r.next() * 2.0).floor();
            stone(&mut c, &mut r, i, sy, w, h2);
            i += w - 1.0;
        }
    }
    let poles = [round(lwf * 0.18), round(lwf * 0.63)]; // 전봇대 + 전깃줄
    for p in poles {
        c.fill(p, 52.0, 3.0, 90.0, a("#7a6a52"));
        c.fill(p, 52.0, 1.0, 90.0, a("#a8967a"));
        c.fill(p + 2.0, 52.0, 1.0, 90.0, a("#4e4232"));
        c.fill(p - 8.0, 58.0, 19.0, 2.0, a("#5a4c3a"));
        c.fill(p - 6.0, 66.0, 15.0, 2.0, a("#5a4c3a"));
        for ox in [-7.0, -2.0, 4.0, 9.0] {
            c.fill(p + ox, 56.0, 1.0, 2.0, a("#d8d4c8"));
        }
    }
    let wire = a("#2a2a30");
    for yo in [57.0, 65.0] {
        for i in 0..lw {
            let i = i as f64;
            let seg = if i < poles[0] {
                (poles[0] - 260.0, poles[0])
            } else if i < poles[1] {
                (poles[0], poles[1])
            } else {
                (poles[1], poles[1] + (poles[1] - poles[0]))
            };
            let t = (i - seg.0) / (seg.1 - seg.0);
            c.px(i, round(yo + sin(t * PI) * 6.0), wire);
        }
    }
    c
}

// 땅: 명소별 바닥 (자갈 · 동굴 바위 · 귤밭 흙)
pub fn ground_place(ph: &Phase, kind: &str) -> Canvas {
    if kind == "grove" {
        return scn_theme::ground(ph);
    }
    if kind == "iho" {
        return scn_theme::ground_theme(ph, "beach");
    }
    let cave = kind == "cave";
    let cph = cave_ph();
    let p = if cave { &cph } else { ph };
    let mut c = scn_theme::ground(p);
    let mut r = rng(901.0);
    let a = |k: &str| atmo(hx(k), p, 0.0);
    let tint = if cave {
        ["#2a2630", "#3a3442", "#1e1a24", "#141118"]
    } else if kind == "cheonji" {
        ["#4a5048", "#5e6a58", "#3a3e38", "#2a2e2a"]
    } else {
        ["#6a645c", "#8a8278", "#54504a", "#3e3a36"]
    };
    let (w, hh) = (c.w as f64, c.h as f64);
    for y in 0..c.h {
        let yf = y as f64;
        for i in 0..c.w {
            let i = i as f64;
            let yy = yf + (vnoise(i * 0.06, yf * 0.1, 902.0) - 0.5) * 5.0;
            let k = if yf < 2.0 {
                1
            } else if yy < 10.0 {
                0
            } else if yy < 18.0 {
                2
            } else {
                3
            };
            c.px(i, yf, a(tint[k]));
        }
    }
    for _ in 0..(if cave { 30 } else { 140 }) {
        // 자갈 · 돌멩이
        let pw = 2.0 + (r.next() * 4.0).floor();
        let ph2 = 1.0 + (r.next() * 2.0).floor();
        let sx = (r.next() * w).floor();
        let sy = 3.0 + (r.next() * (hh - 6.0)).floor();
        let col = a(tint[(r.next() * 2.0).floor() as usize]);
        c.fill(sx, sy, pw, ph2, col);
        c.fill(sx, sy, max(1.0, pw - 1.0), 1.0, a(if cave { "#4a4452" } else { "#b0a898" }));
    }
    if kind == "cheonji" {
        for i in 0..c.w {
            let i = i as f64;
            if vnoise(i * 0.1, 0.5, 903.0) > 0.45 {
                c.fill(i, 0.0, 1.0, 2.0, a(if vnoise(i * 0.3, 1.0, 904.0) > 0.6 { "#7a9a4a" } else { "#4e6a34" }));
            }
        }
    } // 이끼
    if cave {
        for i in 0..c.w {
            c.px(i as f64, 0.0, a("#4a4452"));
        }
    } // 바닥 윤곽만 은은하게
    c
}

// ═════════════════ 정방폭포 ═════════════════
fn jb_field(ph: &Phase) -> (Canvas, String) {
    // 왼쪽 바다와 섶섬 · 오른쪽 주상절리 절벽 · 넓은 폭포가 바다로 · 발치 바위
    let lw = layer_w(L_FIELD);
    let lwf = lw as f64;
    let mut c = Canvas::new(lw, 200);
    let mut r = rng(4101.0);
    let top = 104.0;
    let a = |k: &str, d: f64| atmo(hx(k), ph, d);
    c.ty = 60.0; // 오른쪽 절벽 · 나무 꼭대기가 층 위에서 잘리지 않게 화면 위(-60)부터
    sea_base(&mut c, lwf, ph, top, &["#1e5a9a", "#2a72b8", "#3c8ed2", "#62ace2", "#a0d2ee"], 4102.0);
    let sx = round(lwf * 0.16);
    let fl = cols_a(&["#2e5440", "#3a644a", "#4c7a58", "#64926a"], ph, 0.4); // 섶섬
    for i in -22..=22 {
        let i = i as f64;
        let t = i / 22.0;
        let hh = round(12.0 * pow(1.0 - t * t, 0.6) + if hash2(i, 1.0, 4103.0) < 0.3 { 1.0 } else { 0.0 });
        let mut y = top - hh;
        while y <= top {
            c.px(
                sx + i,
                y,
                if y > top - 2.0 {
                    a("#3e4a48", 0.4)
                } else {
                    fl[if y < top - hh + 2.0 {
                        if i < 2.0 {
                            3
                        } else {
                            2
                        }
                    } else if i < 0.0 {
                        1
                    } else {
                        0
                    }]
                },
            );
            y += 1.0;
        }
    }
    let fl5 = [fl[0], fl[1], fl[2], fl[3], fl[3]];
    for k in 0..9 {
        let i = -18.0 + k as f64 * 4.5 + (r.next() - 0.5) * 2.0;
        let t = i / 22.0;
        let hh = 12.0 * pow(max(0.0, 1.0 - t * t), 0.6);
        let rad = 2.6 + r.next() * 1.4;
        pix_tree(&mut c, sx + i, top - hh + 2.0, rad, &fl5, &mut r, tb(3.0));
    }
    let x0 = round(lwf * 0.47);
    let ct = |i: f64| round(46.0 - pow(clamp((i - x0) / (lwf - x0), 0.0, 1.0), 1.3) * 26.0 + (vnoise(i * 0.08, 0.5, 4104.0) - 0.5) * 4.0);
    let top_l = ct(x0 + 6.0);
    let left_x = |y: f64| {
        let t = (118.0 - y) / (118.0 - top_l);
        x0 - 4.0 * max(0.0, 1.0 - t * 4.0) + 6.0 * pow(t, 2.4) + sin(t * 6.5) * 1.2
    };
    let mut mask = vec![(x0 - 4.0, 118.0)];
    let mut y = 116.0;
    while y > top_l + 1.0 {
        mask.push((left_x(y), y));
        y -= 2.0;
    }
    let mut i = x0 + 6.0;
    while i <= lwf + 2.0 {
        mask.push((i, ct(i)));
        i += 2.0;
    }
    mask.push((lwf + 2.0, 118.0));
    let pts: Vec<(f64, f64)> = mask.iter().map(|&(a, b)| (a, b + 60.0)).collect(); // 픽셀을 직접 쓰는 함수라 층 이동(60px)을 직접 맞춤
    let ramp = cols_a(&["#201c1a", "#2e2a26", "#403a34", "#544d45", "#6c645a", "#887e70", "#a69a8a"], ph, 0.12);
    basalt_wall(&mut c, &pts, x0 - 12.0, lwf, 78.0, 178.0, 4105.0, &ramp, 3.0, 0.0, [hx("#3a6430"), hx("#4e7c3a")], &|i| i);
    let (fx, fw) = (round(lwf * 0.77), 30.0);
    let wet = a("#1a1816", 0.14); // 폭포 뒤 젖은 오목면
    let mut y = ct(fx) + 2.0;
    while y < 114.0 {
        let mut i = fx - 8.0;
        while i < fx + fw + 8.0 {
            let k = 1.0 - hypot((i - fx - fw / 2.0) / (fw / 2.0 + 8.0), (y - 80.0) / 40.0);
            if k > 0.15 || (k > 0.0 && (i + y) as i64 % 2 != 0) {
                c.px(i, y, wet);
            }
            i += 1.0;
        }
        y += 1.0;
    }
    let gr = cols_a(&["#22402a", "#2e5634", "#406e3e", "#5a8a4a", "#7aa25a"], ph, 0.14);
    let ev = cols_a(&["#1a4428", "#285c30", "#3a763a", "#56924a", "#7aae5a"], ph, 0.14);
    for _ in 0..36 {
        let vx = x0 + 8.0 + (r.next() * (lwf - x0 - 10.0)).floor();
        let vy = ct(vx) + 10.0 + (r.next() * 70.0).floor();
        if (vx - fx - fw / 2.0).abs() < 16.0 {
            continue;
        }
        let rad = 2.0 + r.next() * 2.5;
        pix_tree(&mut c, vx, vy, rad, &gr, &mut r, tb(3.0));
    }
    for k in 0..22 {
        let vx = x0 + 6.0 + (r.next() * (lwf - x0 - 8.0)).floor();
        if (vx - fx - fw / 2.0).abs() < 14.0 {
            continue;
        }
        let len = 5.0 + (r.next() * 16.0).floor();
        pix_vines(&mut c, vx, ct(vx) + 2.0, len, &gr, k as f64 * 7.0);
    }
    let evd = cols_a(&["#123220", "#1c4628", "#2a5e32", "#3e783e", "#58924c"], ph, 0.14); // 절벽 위: 상록 숲 두 겹 + 바다 쪽으로 기운 곰솔
    let mut i = x0 - 2.0;
    while i < lwf + 6.0 {
        let y = ct(max(x0, i)) - 12.0 - (r.next() * 4.0).floor();
        let rad = 6.0 + r.next() * 3.0;
        pix_tree(&mut c, i, y, rad, &evd, &mut r, TreeOpt::default());
        i += 5.0;
    }
    let mut i = x0 - 2.0;
    while i < lwf + 6.0 {
        let rad = 5.0 + r.next() * 3.0;
        pix_tree(&mut c, i + 2.0, ct(max(x0, i)) - 5.0, rad, &ev, &mut r, TreeOpt::default());
        i += 5.0;
    }
    let pn = cols_a(&["#1a3a2a", "#284e36", "#3a6844", "#548652", "#74a262"], ph, 0.14);
    let tr = cols_a(&["#3a2418", "#6a4a34"], ph, 0.14);
    for k in 0..15 {
        let px = x0 + 6.0 + k as f64 * 14.0 + ((r.next() - 0.5) * 8.0).floor();
        if px > lwf + 4.0 {
            break;
        }
        let hh = 24.0 + r.next() * 14.0;
        let lean = -0.3 - r.next() * 0.6;
        pix_pine(&mut c, px, ct(min(lwf, max(x0, px))) - 3.0, hh, &pn, &tr, &mut r, lean);
    }
    let mut i = x0 - 4.0;
    while i < lwf + 6.0 {
        let rad = 3.5 + r.next() * 2.0;
        pix_tree(&mut c, i, ct(max(x0, i)) + 1.0, rad, &ev, &mut r, tb(4.0));
        i += 5.0;
    }
    pix_fall(&mut c, fx, fw, ct(fx) + 1.0, 112.0, ph, 4106.0, 0.12, 0.3); // 넓은 폭포 · 발치 바위 · 물보라와 거품 줄
    let st = cols_a(&["#1e1b18", "#2e2a26", "#433d37", "#5c554c", "#7a7266"], ph, 0.12);
    for _ in 0..18 {
        let bw = 7.0 + (r.next() * 10.0).floor();
        let bx = x0 - 34.0 + (r.next() * (lwf - x0 + 30.0)).floor();
        if (bx + bw / 2.0 - fx - fw / 2.0).abs() < 12.0 {
            continue;
        }
        let ry = 104.0 + (r.next() * 8.0).floor();
        let bh = 5.0 + (r.next() * 5.0).floor();
        basalt_rock(&mut c, bx, ry, bw, bh, &st, &mut r, None);
    }
    let bg = cols_a(&["#24201c", "#38332d", "#4e4840", "#686056", "#867c6e"], ph, 0.1); // 절벽 발치 큰 둥근 바위
    for (bx, bw, bh) in [
        (x0 - 34.0, 22.0, 12.0),
        (x0 - 14.0, 28.0, 16.0),
        (x0 + 14.0, 20.0, 12.0),
        (fx - 26.0, 18.0, 11.0),
        (fx + fw + 6.0, 26.0, 15.0),
        (fx + fw + 30.0, 20.0, 12.0),
        (lwf - 26.0, 28.0, 16.0),
    ] {
        basalt_rock(&mut c, bx, 115.0 - bh, bw, bh, &bg, &mut r, None);
    }
    let mut i = x0 - 40.0;
    while i < lwf {
        if hash2(i, 9.0, 4108.0) < 0.55 && (i - fx - fw / 2.0).abs() > 18.0 {
            c.fill(
                i,
                114.0 + round(sin(i * 0.31) * 1.2),
                1.0 + if hash2(i, 5.0, 4110.0) < 0.3 { 1.0 } else { 0.0 },
                1.0,
                a(if hash2(i, 4.0, 4109.0) < 0.5 { "#ffffff" } else { "#d4ecf6" }, 0.1),
            );
        }
        i += 1.0;
    }
    pix_foam(&mut c, fx + fw / 2.0, 113.0, 25.0, ph, 4107.0, true);
    let meta = format!("\"oy\":-60,\"falls\":[{{\"x\":{},\"y0\":{},\"y1\":108,\"w\":{},\"a\":0.3,\"foam\":{{\"x\":{},\"y\":113,\"w\":25,\"water\":true}}}}]", num(fx), num(ct(fx) + 2.0), num(fw), num(fx + fw / 2.0));
    (c, meta)
}
fn jb_near(ph: &Phase) -> Canvas {
    // 앞쪽 풀밭 · 유채 · 하얀 들꽃 · 양옆 덤불
    let lw = layer_w(L_NEAR);
    let lwf = lw as f64;
    let mut c = Canvas::new(lw, 160);
    let mut r = rng(2111.0);
    let am = |v: &[Col]| v.iter().map(|&k| atmo(k, ph, 0.04)).collect::<Vec<Col>>();
    let (g, y) = (am(&ctx().pal.grass), am(&ctx().pal.yel));
    let wh = atmo(hx("#f4f0e4"), ph, 0.04);
    let ev = cols_a(&["#1a4428", "#285c30", "#3a763a", "#56924a", "#7aae5a"], ph, 0.04);
    for i in 0..lw {
        let i = i as f64;
        let t = 142.0 + round(vnoise(i * 0.08, 1.0, 2112.0) * 3.0);
        c.fill(i, t, 1.0, 160.0 - t, g[1]);
        c.px(i, t, g[3]);
        if hash2(i, 1.0, 2113.0) < 0.3 {
            c.px(i, t - 1.0, g[4]);
        }
        if hash2(i, 3.0, 2115.0) < 0.12 {
            c.fill(i, t - 2.0, 1.0, 2.0, g[2]);
            c.px(i, t - 3.0, g[4]);
        }
    }
    let mut k = 0.0;
    while k < lwf * 0.5 {
        let i = (r.next() * lwf).floor();
        let yy = 146.0 + (r.next() * 12.0).floor();
        c.fill(i, yy, 1.0, 2.0, g[0]);
        c.px(i + 1.0, yy, g[2]);
        k += 1.0;
    }
    let mut i = 0.0;
    while i < lwf {
        // 유채 (반복 조건에서 난수를 다시 뽑음 — 원래 그대로)
        if vnoise(i * 0.02, 0.0, 2114.0) >= 0.35 {
            let by = 152.0 + (r.next() * 4.0).floor();
            let mut k = 0.0;
            while k < 3.0 + (r.next() * 3.0).floor() {
                let fx = i + (r.next() * 6.0).floor() - 3.0;
                let fy = by - 4.0 - (r.next() * 10.0).floor();
                c.fill(fx + 1.0, fy + 2.0, 1.0, by - fy, g[1]);
                c.fill(fx, fy, 3.0, 1.0, y[1]);
                c.fill(fx + 1.0, fy - 1.0, 1.0, 3.0, y[1]);
                c.px(fx + 1.0, fy, y[3]);
                k += 1.0;
            }
        }
        i += 3.0 + (r.next() * 5.0).floor();
    }
    let mut k = 0.0;
    while k < lwf * 0.06 {
        let fx = (r.next() * lwf).floor();
        let fy = 146.0 + (r.next() * 10.0).floor();
        c.px(fx - 1.0, fy, wh);
        c.px(fx + 1.0, fy, wh);
        c.px(fx, fy - 1.0, wh);
        c.px(fx, fy + 1.0, wh);
        c.px(fx, fy, y[2]);
        k += 1.0;
    } // 하얀 들꽃
    for k in 0..4 {
        let rad = 9.0 + r.next() * 3.0;
        pix_tree(&mut c, 4.0 + k as f64 * 12.0, 137.0 + ((k % 2) * 4) as f64, rad, &ev, &mut r, TreeOpt::default());
    }
    for k in 0..3 {
        let rad = 9.0 + r.next() * 3.0;
        pix_tree(&mut c, lwf - 8.0 - k as f64 * 9.0, 124.0 + k as f64 * 6.0, rad, &ev, &mut r, TreeOpt::default());
    }
    c
}

// ═════════════════ 천지연폭포 ═════════════════
struct Cj {
    cx: f64,
    hw: f64,
    pm: f64,
    mouth: f64,
}
fn cj() -> Cj {
    let lw = layer_w(L_OREUM) as f64;
    Cj { cx: round(lw * 0.56), hw: round(lw * 0.3), pm: 1.2, mouth: round(lw * 0.3 * 0.74) }
}
fn cj_far(ph: &Phase) -> Canvas {
    // 먼 숲 언덕 (연무에 묻힌 둥근 능선)
    let lw = layer_w(L_HALL);
    let mut c = Canvas::new(lw, 140);
    let fl = cols_a(&["#4e7a6a", "#5e8a76", "#709a82", "#86ac92"], ph, 0.45);
    for i in 0..lw {
        let i = i as f64;
        let t = round(84.0 - sin(i * 0.012 + 1.0) * 14.0 - vnoise(i * 0.05, 1.0, 1601.0) * 8.0);
        let mut y = t;
        while y < 140.0 {
            c.px(
                i,
                y,
                band(
                    &fl,
                    clamp(
                        0.75 - (y - t) / 50.0 + (vnoise(i * 0.3, y * 0.3, 1602.0) - 0.5) * 0.3 + if y - t < 2.0 { 0.2 } else { 0.0 },
                        0.0,
                        0.999,
                    ),
                ),
            );
            y += 1.0;
        }
    }
    c
}
// 양옆 숲 지붕 한쪽: 시작 x · 끝 x · 높이 함수
type SideEdge<'a> = (f64, f64, &'a dyn Fn(f64) -> f64);
fn cj_mid(ph: &Phase) -> (Canvas, String) {
    // 골짜기 숲 비탈 · 이끼 낀 주상절리 절벽 · 폭포가 둥글게 패인 골짜기
    let lw = layer_w(L_OREUM);
    let lwf = lw as f64;
    let mut c = Canvas::new(lw, 140);
    let mut r = rng(4201.0);
    let far = cols_a(&["#2e5c44", "#3c6e4e", "#4e845c", "#66986c", "#84b080"], ph, 0.2);
    let ev = cols_a(&["#163a24", "#22522c", "#326c36", "#4c8a44", "#70a858"], ph, 0.08);
    let vn = cols_a(&["#2e5a26", "#447a30", "#62a03c", "#88c050", "#a8d468"], ph, 0.1);
    let gr = cols_a(&["#22402a", "#2e5634", "#406e3e", "#5a8a4a", "#7aa25a"], ph, 0.12);
    for i in 0..lw {
        let i = i as f64;
        c.fill(i, 57.0 + round(sin(i * 0.05) * 3.0), 1.0, 70.0, far[1]);
    } // 숲 밑을 채워 나무 사이로 하늘이 비치지 않게
    let mut i = -6.0;
    while i < lwf + 8.0 {
        let y = 56.0 + round(sin(i * 0.05) * 3.0) - (r.next() * 4.0).floor();
        let rad = 7.0 + r.next() * 3.0;
        pix_tree(&mut c, i, y, rad, &far, &mut r, TreeOpt::default());
        i += 6.0;
    }
    let mut i = -3.0;
    while i < lwf + 8.0 {
        let y = 64.0 + round(sin(i * 0.07 + 1.0) * 3.0) - (r.next() * 3.0).floor();
        let rad = 7.0 + r.next() * 3.0;
        pix_tree(&mut c, i, y, rad, &far, &mut r, TreeOpt::default());
        i += 6.0;
    }
    let mut y = 72.0;
    while y < 124.0 {
        let mut i = -4.0 + if y as i64 % 16 != 0 { 3.0 } else { 0.0 };
        while i < lwf + 8.0 {
            let tx = i + (r.next() - 0.5) * 3.0;
            let ty = y + (r.next() - 0.5) * 3.0;
            let rad = 7.0 + r.next() * 3.0;
            pix_tree(&mut c, tx, ty, rad, &far, &mut r, TreeOpt::default());
            i += 7.0;
        }
        y += 8.0;
    }
    let Cj { cx: cxa, hw: half_w, pm, .. } = cj();
    let (spm, cpm) = (sin(pm), cos(pm));
    let (x0, x1) = (cxa - half_w, cxa + half_w);
    let phi = |i: f64| asin(clamp((i - cxa) / half_w, -1.0, 1.0) * spm);
    let dep = |i: f64| (cos(phi(i)) - cpm) / (1.0 - cpm);
    let base = |i: f64| round(126.0 - dep(i) * 16.0);
    let ct = |i: f64| round(62.0 + dep(i) * 13.0 + (vnoise(i * 0.06, 0.5, 4202.0) - 0.5) * 4.0);
    let pool = cols_a(&["#0e4a5c", "#145e74", "#1e7890", "#3a98ae"], ph, 0.14); // 안쪽 못: 절벽 그늘에 짙고, 입구 쪽으로 밝아짐
    let mut i = x0;
    while i <= x1 {
        let b0 = base(i);
        let mut y = b0 - 1.0;
        while y < 126.0 {
            let k = clamp((y - 110.0) / 16.0, 0.0, 1.0) * 0.55 + (1.0 - dep(i)) * 0.45;
            c.px(i, y, band(&pool, clamp(k, 0.0, 0.999)));
            y += 1.0;
        }
        i += 1.0;
    }
    let mut mask = vec![];
    let mut i = x0;
    while i <= x1 {
        mask.push((i, ct(i)));
        i += 2.0;
    }
    let mut i = x1;
    while i >= x0 {
        mask.push((i, base(i) + 1.0));
        i -= 2.0;
    }
    let ramp = cols_a(&["#16181a", "#22252a", "#30343a", "#40454a", "#545a5e", "#6c7276", "#888e90"], ph, 0.18);
    let mc = cols_a(&["#3a6430", "#4e7c3a"], ph, 0.18);
    basalt_wall(&mut c, &mask, x0 - 4.0, x1 + 4.0, 62.0, 128.0, 4203.0, &ramp, 7.0, 0.7, [mc[0], mc[1]], &|i| cxa + phi(i) / spm * half_w);
    {
        // 휘어 든 면의 밝기: 해를 보는 오른쪽 벽은 밝게, 왼쪽 벽 · 가장 안쪽은 그늘 · 폭포 둘레는 물안개
        let (ia, ib) = (max(0.0, x0), min(lwf, x1 + 1.0));
        let mut f = vec![];
        let mut y0 = vec![];
        let mut y1 = vec![];
        let mut i = ia;
        while i < ib {
            f.push(1.0 + 0.26 * phi(i) / pm - 0.1 * dep(i));
            y0.push(ct(i) - 2.0);
            y1.push(base(i) + 1.0);
            i += 1.0;
        }
        crate::cliff::shade(&mut c.d, lw, ia as i32, &f, &y0, &y1, cxa);
    }
    let mut i = x0;
    while i <= x1 {
        let b0 = base(i);
        let t0 = b0 - 14.0 + round(sin(i * 0.04) * 2.0);
        let mut y = t0;
        while y < b0 {
            let k = (y - t0) / 14.0;
            if k > 0.3 || (i + y) as i64 % 2 != 0 {
                c.px(i, y, atmo(hx(if k > 0.65 { "#101214" } else { "#181a1e" }), ph, 0.18));
            }
            y += 1.0;
        }
        i += 1.0;
    } // 물가 아래쪽 패인 그늘
    for _ in 0..16 {
        let vx = x0 + 8.0 + (r.next() * (x1 - x0 - 16.0)).floor();
        let vy = ct(vx) + 8.0 + (r.next() * max(4.0, base(vx) - ct(vx) - 22.0)).floor();
        let rad = 2.0 + r.next() * 2.0;
        pix_tree(&mut c, vx, vy, rad, &gr, &mut r, tb(3.0));
    }
    let (fw, fx) = (20.0, cxa - 10.0);
    for k in 0..44 {
        let vx = x0 + 4.0 + (r.next() * (x1 - x0 - 8.0)).floor();
        if (vx - cxa).abs() < 17.0 {
            continue;
        }
        let len = min(6.0 + (r.next() * 24.0).floor(), base(vx) - ct(vx) - 6.0);
        pix_vines(&mut c, vx, ct(vx) + 1.0, len, if k % 2 == 1 { &vn } else { &gr }, k as f64 * 5.0);
    } // 늘어진 덩굴
    let mut i = x0 - 2.0;
    while i < x1 + 4.0 {
        let rad = 4.0 + r.next() * 2.0;
        pix_tree(&mut c, i, ct(i) - 2.0, rad, &ev, &mut r, tb(4.0));
        i += 5.0;
    }
    let fb = base(fx + fw / 2.0); // 폭포: 가장 안쪽 벽에서 떨어지는 한 줄기 + 오른쪽 가는 갈래 · 발치 물보라
    pix_fall(&mut c, fx, fw, ct(fx) + 1.0, fb, ph, 4204.0, 0.22, 0.3);
    pix_fall(&mut c, fx + fw + 4.0, 3.0, ct(fx + fw + 4.0) + 3.0, fb, ph, 4206.0, 0.22, 0.2);
    pix_foam(&mut c, fx + fw / 2.0, fb, 17.0, ph, 4207.0, false);
    let mid: Vec<Col> = far.iter().enumerate().map(|(i, &k)| mix(k, ev[i], 0.5)).collect(); // 양옆 숲: 뒤 숲과 한 덩이로 이어진 숲 지붕
    let f0 = |i: f64| 47.0 + pow(clamp((i + 8.0) / (x0 + 26.0), 0.0, 1.0), 1.4) * 19.0;
    let f1 = |i: f64| 47.0 + pow(clamp((lwf + 8.0 - i) / (lwf - x1 + 26.0), 0.0, 1.0), 1.4) * 19.0;
    let side_top: [SideEdge; 2] = [(-8.0, x0 + 18.0, &f0), (x1 - 18.0, lwf + 8.0, &f1)];
    for &(sx0, sx1, f) in &side_top {
        let mut i = max(0.0, sx0);
        while i < min(lwf, sx1) {
            let t = round(f(i) + 4.0 + (vnoise(i * 0.2, 3.0, 4208.0) - 0.5) * 3.0);
            c.fill(i, t, 1.0, 124.0 - t, if t < 70.0 { mid[1] } else { ev[1] });
            i += 1.0;
        }
    } // 숲 밑 채우기
    let mut crowns = vec![];
    let mut y = 40.0;
    while y < 124.0 {
        for (sd, &(sx0, sx1, f)) in side_top.iter().enumerate() {
            let sdf = sd as f64;
            let jag = round((vnoise(y * 0.15, 2.0 + sdf, 4210.0) - 0.5) * 22.0); // 절벽 끝을 덮는 숲 가장자리는 줄마다 들쭉날쭉
            let mut i = sx0 + if sd == 1 { -jag } else { 0.0 };
            while i < sx1 + if sd == 1 { 0.0 } else { jag } {
                let top = f(i) + (vnoise(i * 0.09, 1.0, 4209.0) - 0.5) * 6.0;
                if y >= top {
                    let a = i + (r.next() - 0.5) * 4.0;
                    let b = y + (r.next() - 0.5) * 3.0;
                    let rad = 7.0 + r.next() * 3.0;
                    crowns.push([a, b, rad]);
                }
                i += 7.0;
            }
        }
        y += 6.0;
    }
    crowns.sort_by(|p, q| p[1].partial_cmp(&q[1]).unwrap_or(std::cmp::Ordering::Equal));
    for [cx, cy, rad] in crowns {
        pix_tree(&mut c, cx, cy, rad, if cy < 66.0 { &mid } else { &ev }, &mut r, TreeOpt::default());
    } // 위(먼 쪽)는 뒤 숲 색, 아래는 짙게
    let meta = format!(
        "\"falls\":[{{\"x\":{},\"y0\":{},\"y1\":{},\"w\":{},\"a\":0.3,\"foam\":{{\"x\":{},\"y\":{},\"w\":17,\"water\":true}}}}]",
        num(fx),
        num(ct(fx) + 2.0),
        num(fb - 2.0),
        num(fw),
        num(fx + fw / 2.0),
        num(fb)
    );
    (c, meta)
}
fn cj_field(ph: &Phase) -> Canvas {
    // 옥빛 못: 폭포 쪽 좁은 입구에서 앞으로 넓게 트임 · 양옆 물가 바위 · 덤불
    let lw = layer_w(L_FIELD);
    let lwf = lw as f64;
    let mut c = Canvas::new(lw, 140);
    let mut r = rng(4211.0);
    let top = 118.0;
    let a = |k: &str| atmo(hx(k), ph, 0.1);
    sea_base(&mut c, lwf, ph, top, &["#145e78", "#1e7a96", "#2c98b4", "#4cb6cc", "#8ad6e2"], 4212.0);
    let cjv = cj();
    let (mc, mh) = (cjv.cx + 3.0, cjv.mouth);
    let shore_y = |i: f64| {
        if i < mc - mh {
            top + pow((mc - mh - i) / (mc - mh), 0.8) * 17.0
        } else if i > mc + mh {
            top + pow((i - mc - mh) / (lwf - mc - mh), 0.8) * 17.0
        } else {
            top
        }
    };
    let dk = a("#0e4a5e"); // 입구 바로 앞은 절벽 그늘이 이어져 짙게
    let mut y = top;
    while y < top + 7.0 {
        let mut i = mc - mh;
        while i < mc + mh {
            let k = round((1.0 - (y - top) / 7.0) * (1.0 - pow((i - mc).abs() / mh, 2.0)) * 3.0) / 3.0 * 0.5;
            if k > 0.0 {
                c.fill_a(i, y, 1.0, 1.0, dk, k);
            }
            i += 1.0;
        }
        y += 1.0;
    }
    let mut y = top;
    while y < top + 12.0 {
        let mut i = mc - 8.0;
        while i < mc + 8.0 {
            if hash2(i, (y as i64 >> 1) as f64, 4213.0) < (1.0 - (i - mc).abs() / 8.0) * (1.0 - (y - top) / 12.0) * 0.6 {
                c.px(i, y, a("#c8e8ec"));
            }
            i += 1.0;
        }
        y += 1.0;
    } // 폭포가 비친 옅은 빛
    let st = cols_a(&["#2a2c2c", "#40444a", "#5c6064", "#7c8084", "#9ea2a2"], ph, 0.12);
    let mo = cols_a(&["#3a6a30", "#5a8a3a"], ph, 0.12);
    let bu = cols_a(&["#1c4a26", "#2a6430", "#3e823a", "#5ca04a", "#80bc5c"], ph, 0.12);
    let fo = cols_a(&["#163a24", "#22522c", "#326c36", "#4c8a44", "#70a858"], ph, 0.08);
    for i in 0..lw {
        let i = i as f64;
        let sy = round(shore_y(i));
        if sy > top {
            c.fill(i, top, 1.0, sy - top, fo[0]);
        }
    } // 숲 밑 그늘
    let mut y = top - 3.0;
    while y < top + 18.0 {
        let mut i = -4.0;
        while i < lwf + 4.0 {
            if shore_y(i) >= y + 5.0 {
                let tx = i + (r.next() - 0.5) * 3.0;
                let ty = y + (r.next() - 0.5) * 2.0;
                let rad = 6.0 + r.next() * 3.0;
                pix_tree(&mut c, tx, ty, rad, &fo, &mut r, TreeOpt::default());
            }
            i += 6.0;
        }
        y += 5.0;
    } // 양옆 물가까지 내려온 숲
    let mut bx = 2.0;
    while bx < lwf {
        if (bx - mc).abs() >= mh - 4.0 {
            let rad = 5.0 + r.next() * 2.5;
            pix_tree(&mut c, bx, round(shore_y(bx)) - 6.0, rad, &bu, &mut r, tb(4.0));
        }
        bx += 7.0 + (r.next() * 5.0).floor();
    } // 물가 덤불
    let mut bx = 0.0;
    while bx < lwf {
        // 비스듬히 벌어지는 물가 바위
        let bw = 9.0 + (r.next() * 8.0).floor();
        let bh = 5.0 + (r.next() * 4.0).floor();
        let cxr = bx + bw / 2.0;
        if (cxr - mc).abs() < mh - 6.0 {
            bx = if cxr < mc { mc + mh - 6.0 } else { bx + bw };
            continue;
        }
        basalt_rock(&mut c, bx, round(shore_y(cxr)) + 2.0 - bh, bw, bh, &st, &mut r, Some(&mo));
        bx += bw - 2.0 + (r.next() * 5.0).floor();
    }
    for _ in 0..60 {
        let y = top + 3.0 + (pow(r.next(), 1.2) * 19.0).floor();
        let px = (r.next() * lwf).floor();
        if y > shore_y(px) + 1.0 {
            let col = a(if r.next() < 0.5 { "#ffffff" } else { "#c8eef4" });
            let w = 2.0 + (r.next() * 5.0).floor();
            c.fill(px, y, w, 1.0, col);
        }
    } // 잔물결
    c
}
fn cj_near(ph: &Phase) -> Canvas {
    // 못가 자갈 기슭 · 주황 꽃 덤불 · 이끼 바위
    let lw = layer_w(L_NEAR);
    let lwf = lw as f64;
    let mut c = Canvas::new(lw, 160);
    let mut r = rng(4221.0);
    let a = |k: &str| atmo(hx(k), ph, 0.05);
    for i in 0..lw {
        let i = i as f64;
        let t = 143.0 + round(vnoise(i * 0.12, 1.0, 4222.0) * 3.0 - 1.0);
        c.fill(i, t, 1.0, 160.0 - t, a("#3a3c38"));
        if hash2(i, 2.0, 4223.0) < 0.5 {
            c.px(i, t, a("#4e504a"));
        }
    }
    for _ in 0..140 {
        let col = a(["#5a5c56", "#6e706a", "#4a4c48"][(r.next() * 3.0).floor() as usize]);
        let x = (r.next() * lwf).floor();
        let y = 144.0 + (r.next() * 12.0).floor();
        let w = 2.0 + (r.next() * 3.0).floor();
        c.fill(x, y, w, 1.0, col);
    }
    let bl = cols_a(&["#1c4426", "#2a5e2e", "#3e7e38", "#5c9e46", "#86c05a"], ph, 0.05);
    let flw = cols_a(&["#e0782a", "#ffb050"], ph, 0.05);
    let st = cols_a(&["#2e302e", "#464844", "#62645e", "#80827a", "#a0a298"], ph, 0.05);
    let mo = cols_a(&["#3a6a30", "#5a8a3a"], ph, 0.05);
    for k in 0..6 {
        let tx = 14.0 + k as f64 * 15.0 + (r.next() * 6.0).floor();
        let ty = 133.0 + (r.next() * 6.0).floor();
        let rad = 8.0 + r.next() * 3.0;
        pix_tree(&mut c, tx, ty, rad, &bl, &mut r, TreeOpt { flowers: Some((flw[0], flw[1])), ..Default::default() });
    }
    for k in 0..3 {
        let ty = 136.0 + (r.next() * 4.0).floor();
        let rad = 7.0 + r.next() * 3.0;
        pix_tree(&mut c, lwf - 12.0 - k as f64 * 16.0, ty, rad, &bl, &mut r, TreeOpt::default());
    }
    for (rx, w2) in [(4.0, 22.0), (lwf - 34.0, 24.0), (round(lwf * 0.5), 12.0)] {
        basalt_rock(&mut c, rx, 136.0, w2, 10.0, &st, &mut r, Some(&mo));
    }
    c
}

// buildPlacePhase: 명소 한 시간대 (동굴은 scn_cave)
pub fn place(kind: &str, pi: usize) {
    if kind == "cave" {
        crate::scn_cave::set(pi);
        return;
    }
    let ph = &ctx().phases[pi];
    out_push("sky", scn_theme::sky(ph), String::new());
    out_push("front", scn_theme::front(ph), String::new());
    out_push("ground", ground_place(ph, kind), String::new());
    match kind {
        "iho" => {
            out_push("halla", iho_far(ph), String::new());
            out_empty("oreum", L_OREUM, 140);
            out_push("field", iho_sea(ph), String::new());
            let (c, m) = iho_near(ph);
            out_push("near", c, m);
        }
        "grove" => {
            let (c, m) = scn_theme::halla(ph);
            out_push("halla", c, m);
            out_push("oreum", scn_theme::oreum(ph), String::new());
            out_push("field", grove_fields(ph), String::new());
            out_push("near", grove_near(ph), String::new());
        }
        "jeongbang" => {
            out_empty("halla", L_HALL, 140);
            out_empty("oreum", L_OREUM, 140);
            let (c, m) = jb_field(ph);
            out_push("field", c, m);
            out_push("near", jb_near(ph), String::new());
        }
        _ => {
            out_push("halla", cj_far(ph), String::new());
            let (c, m) = cj_mid(ph);
            out_push("oreum", c, m);
            out_push("field", cj_field(ph), String::new());
            out_push("near", cj_near(ph), String::new());
        }
    }
}
