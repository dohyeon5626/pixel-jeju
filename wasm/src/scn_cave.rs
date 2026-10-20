// 만장굴 한 벌 (원래 places.js): 먼 벽 · 용암석주 · 천장(구멍 · 빛줄기) · 앞쪽 바닥 · 발밑 길 · 가장 앞 바위
//  픽셀 계산은 cave.rs, 여기는 그 위에 바위 · 등불 · 종유 · 덩굴을 얹음
use crate::cave::{cvc, light};
use crate::js::*;
use crate::noise::{hash2, vnoise, Rng};
use crate::scene::*;
use crate::scn_place::{pix_tree, tb};

// 같은 밝기 단계끼리 짝: 낮빛 쪽(서늘한 회청) · 가운데(보랏빛 회색) · 등불 쪽(따뜻한 황갈)
const COOL: [&str; 11] =
    ["#0b0a0f", "#121219", "#1a1a22", "#22242d", "#2c2f39", "#373b45", "#454a53", "#565c64", "#6b7279", "#868d92", "#a5adb0"];
const NEUT: [&str; 11] =
    ["#0c0a0d", "#141215", "#1d1a1e", "#262227", "#302b31", "#3c363b", "#4a4347", "#5a5255", "#6c6365", "#827877", "#9c908c"];
const WARM: [&str; 11] =
    ["#0e0b0a", "#18120f", "#231a15", "#30231b", "#3e2c21", "#4e3828", "#61452f", "#765438", "#8d6542", "#a6784d", "#c08c58"];
// cvC 색표 (밝기 11 × 온도 7) — 처음 한 번
pub fn init_cvc() {
    let mut t = [0u8; 231];
    for i in 0..11 {
        for r in -3i32..=3 {
            let q = r as f64 / 3.0;
            let n = hx(NEUT[i]);
            let c = if q < 0.0 {
                mix(n, hx(COOL[i]), -q)
            } else if q > 0.0 {
                mix(n, hx(WARM[i]), q)
            } else {
                n
            };
            t[(i * 7 + (r + 3) as usize) * 3..(i * 7 + (r + 3) as usize) * 3 + 3].copy_from_slice(&c);
        }
    }
    crate::cave::set_cvc(&t);
}

// 등불 번짐: 둥근 판 3겹 (픽셀 단위로 끊어지게)
fn glow(c: &mut Canvas, cx: f64, cy: f64, rx: f64, ry: f64, col: Col, a: f64) {
    for k in [1.0, 0.66, 0.36] {
        let (ax, ay) = (rx * k, ry * k);
        let mut y = -ay.floor();
        while y <= ay.floor() {
            let hw = round(ax * max(0.0, 1.0 - pow(y / ay, 2.0)).sqrt());
            if hw > 0.0 {
                c.fill_a(round(cx) - hw, round(cy) + y, hw * 2.0, 1.0, col, a / 3.0);
            }
            y += 1.0;
        }
    }
}
// 돌받침 등불: 낮은 현무암 받침 위 네모난 등 · X, Y: 받침 아래 가운데
fn lamp(c: &mut Canvas, x: f64, y: f64, big: bool) {
    glow(c, x, y - 7.0, if big { 12.0 } else { 9.0 }, if big { 9.0 } else { 7.0 }, hx("#ffc070"), 0.32);
    let w = if big { 9.0 } else { 7.0 };
    let hw = (w as i32 >> 1) as f64;
    c.fill(x - hw - 1.0, y - 5.0, w + 2.0, 5.0, hx("#16110e"));
    c.fill(x - hw, y - 5.0, w, 1.0, hx("#4a3424"));
    c.fill(x - hw, y - 4.0, w, 3.0, hx("#2e2219"));
    c.fill(x - hw, y - 4.0, 1.0, 3.0, hx("#5c4430"));
    c.fill(x - 2.0, y - 10.0, 5.0, 5.0, hx("#2a1c12"));
    c.fill(x - 1.0, y - 9.0, 3.0, 3.0, hx("#ffcf7a"));
    c.fill(x - 1.0, y - 9.0, 1.0, 2.0, hx("#fff3cf"));
    c.fill(x + 1.0, y - 7.0, 1.0, 1.0, hx("#e09040"));
    c.fill(x - 3.0, y - 11.0, 7.0, 1.0, hx("#3a2a1c"));
}
// 각진 현무암 덩이: 다각형 윤곽 + 면마다 다른 밝기 · 면 사이 금 · 셀아웃 테 (X: 왼쪽 · Y: 바닥 · sh: 층이 밀리는 만큼)
fn rock(c: &mut Canvas, x: f64, y: f64, w: f64, hh: f64, r: &mut Rng, sh: f64, moss: bool, day: f64) {
    let (pw, phh) = (w + 2.0, hh + 2.0);
    let n = 7.0 + (r.next() * 3.0).floor();
    let mut pts = vec![];
    let mut k = 0.0;
    while k < n {
        let a = PI + (k / (n - 1.0)) * PI;
        let rr = 0.82 + r.next() * 0.22;
        pts.push((1.0 + w / 2.0 + cos(a) * w / 2.0 * rr, 1.0 + hh + sin(a) * hh * rr));
        k += 1.0;
    }
    let last = pts.len() - 1;
    pts[0].1 = hh + 1.0;
    pts[last].1 = hh + 1.0;
    let m: Vec<u8> = poly_alpha(pw as i32, phh as i32, &pts).iter().map(|&a| (a > 120) as u8).collect();
    let mut pb = Pb::new(pw as i32, phh as i32);
    let nf = 3.0 + (r.next() * 3.0).floor();
    let mut fc = vec![];
    let mut k = 0.0;
    while k < nf {
        let fx = 1.0 + r.next() * w;
        let fy = 1.0 + r.next() * hh;
        let side = (fx - 1.0 - w / 2.0) / (w / 2.0);
        let up = 1.0 - (fy - 1.0) / hh;
        let a = side * 0.8 + (r.next() - 0.5) * 0.4;
        let b = -0.25 - up * 0.75 + (r.next() - 0.5) * 0.3;
        fc.push([fx, fy, a, b]);
        k += 1.0;
    }
    let (l, d0) = light(x - sh + w / 2.0, y - hh * 0.6, 1.0);
    let d = d0 * day;
    let wm = clamp((l * 1.4 - d * 1.2) / (0.25 + l + d), -1.0, 1.0);
    let (lx, ly, lz) = (if d > l { 0.45 } else { -0.55 }, -0.75, 0.5);
    let ln = hypot3(lx, ly, lz);
    let mosses = ["#22362a", "#30482e", "#425e36", "#587840", "#70904a"];
    for yy in 0..phh as i32 {
        for xx in 0..pw as i32 {
            if m[(yy * pw as i32 + xx) as usize] == 0 {
                continue;
            }
            let (xf, yf) = (xx as f64, yy as f64);
            let (mut b1, mut b2, mut f) = (1e9, 1e9, fc[0]);
            for q in &fc {
                let dd = pow(xf - q[0], 2.0) + pow((yf - q[1]) * 1.4, 2.0);
                if dd < b1 {
                    b2 = b1;
                    b1 = dd;
                    f = *q;
                } else if dd < b2 {
                    b2 = dd;
                }
            }
            let nz = max(0.05, 1.0 - f[2] * f[2] - f[3] * f[3]).sqrt();
            let lam = max(0.0, (f[2] * lx + f[3] * ly + nz * lz) / ln);
            let mut v = (0.16 + lam * 0.5) * (0.6 + l * 0.8 + d * 0.7) + (vnoise(xf * 0.5 + x, yf * 0.5, 7601.0) - 0.5) * 0.05;
            if b2.sqrt() - b1.sqrt() < 1.1 {
                v *= 0.78;
            } // 면 사이 모서리 금
            if yf >= hh {
                v *= 0.7;
            } // 바닥에 닿는 아랫단 그늘
            let mut col = cvc(clamp(v, 0.0, 1.0), wm);
            if moss && f[3] < -0.6 && vnoise(xf * 0.4 + x, yf * 0.6, 7602.0) > 0.45 {
                col = mix(hx(mosses[clamp(round(v * 6.0), 0.0, 4.0) as usize]), hx(NEUT[2]), 1.0 - day * 0.85);
            } // 윗면 이끼 (드문드문)
            pb.set(xf, yf, col);
        }
    }
    c.draw(&pb.sel_out(0.55).canvas(), round(x - 1.0), round(y - hh - 1.0));
}

// 먼 벽 (하늘 층) + 오른쪽 끝 갈래 굴
fn wall(day: f64) -> Canvas {
    let w = ctx().w as i32;
    let mut c = Canvas::new(w, 200);
    crate::cave::wall(&mut c.d, w as usize, day);
    let (cx, hw, top, bot) = (404.0, 28.0, 118.0, 183.0);
    let (ox, oy) = (cx - hw - 5.0, top - 5.0);
    let pw = min(w as f64 - ox, hw * 2.0 + 10.0) as i32;
    let ph = (bot - top + 6.0) as i32;
    let mut d = vec![0u8; (pw * ph * 4) as usize];
    for y in 0..ph {
        for i in 0..pw {
            let (s, t) = ((((oy as i32 + y) * w + ox as i32 + i) * 4) as usize, ((y * pw + i) * 4) as usize);
            d[t..t + 4].copy_from_slice(&c.d[s..s + 4]);
        }
    }
    crate::cave::passage(&mut d, w as f64);
    for y in 0..ph {
        for i in 0..pw {
            let (s, t) = ((((oy as i32 + y) * w + ox as i32 + i) * 4) as usize, ((y * pw + i) * 4) as usize);
            c.d[s..s + 4].copy_from_slice(&d[t..t + 4]);
        }
    }
    c
}
// 용암석주 (오름 층) + 발치 조명
fn column() -> Canvas {
    let lw = layer_w(L_OREUM);
    let sh = round(20.0 * L_OREUM);
    let mut c = Canvas::new(lw, 200);
    crate::cave::column(&mut c.d, lw, sh);
    for (lx, ly) in [(50.0, 190.0), (110.0, 190.0)] {
        let x = lx + sh;
        glow(&mut c, x, ly - 5.0, 12.0, 8.0, hx("#ffc070"), 0.35);
        c.fill(x - 4.0, ly - 4.0, 9.0, 4.0, hx("#16110e"));
        c.fill(x - 3.0, ly - 4.0, 7.0, 1.0, hx("#3e2c20"));
        c.fill(x - 2.0, ly - 6.0, 5.0, 2.0, hx("#ffd890"));
        c.fill(x - 1.0, ly - 6.0, 2.0, 1.0, hx("#fff3cf"));
    }
    c
}
// 천장 · 구멍 · 빛줄기 · 벽 밑 바위 더미 · 벽 등불 (밭 층)
fn ceil(pi: usize, day: f64) -> (Canvas, String) {
    let ph = &ctx().phases[pi];
    let lw = layer_w(L_FIELD);
    let lwf = lw as f64;
    let sh = round(20.0 * L_FIELD);
    let mut c = Canvas::new(lw, 200);
    let mut r = rng(7101.0);
    let (hx0, hx1) = (284.0 + sh, 338.0 + sh);
    let (hc, hw) = ((hx0 + hx1) / 2.0, (hx1 - hx0) / 2.0);
    let edge: Vec<f64> = (0..lw)
        .map(|i| {
            let i = i as f64;
            let mut e = 24.0
                + pow((i - lwf / 2.0).abs() / (lwf / 2.0), 2.2) * 24.0
                + sin(i * 0.016 + 0.4) * 3.0
                + (vnoise(i * 0.045, 0.5, 7102.0) - 0.5) * 9.0
                + (vnoise(i * 0.17, 1.5, 7103.0) - 0.5) * 3.0;
            for (lx, lwid, lh) in [(60.0, 14.0, 7.0), (196.0, 11.0, 6.0), (392.0, 16.0, 8.0)] {
                let u = (i - lx - sh) / lwid;
                if u.abs() < 1.0 {
                    e += pow(cos(u * PI / 2.0), 2.0) * lh;
                }
            }
            let u = (i - hc) / (hw + 26.0);
            if u.abs() < 1.0 {
                e += pow(1.0 - u * u, 1.5) * 21.0;
            }
            round(e)
        })
        .collect();
    let hole_bot = |i: f64| edge[clamp(i, 0.0, lwf - 1.0) as usize] - 5.0;
    let night = pi == 3;
    let (sky_t, sky_b) = if night { (ph.sky[0], ph.sky[1]) } else { (ph.sky[1], ph.sky[3]) };
    let gr: Vec<Col> =
        ["#1e3624", "#2e5230", "#46723a", "#669846", "#8cbc58"].iter().map(|k| mix(hx(k), hx("#141a20"), (1.0 - day) * 0.75)).collect();
    let gf: Vec<Col> = gr.iter().map(|&k| mix(k, hx("#1c2219"), 0.3)).collect();
    let dirt = mix(hx("#5a4a3a"), hx("#141a20"), (1.0 - day) * 0.7);
    let rk = mix(hx("#7a7a70"), hx("#141a20"), (1.0 - day) * 0.7);
    crate::cave::ceil(
        &mut c.d,
        lw,
        sh,
        &crate::cave::Ceil { edge: &edge, day, night, sky_t, sky_b, gr: [gr[2], gr[3], gr[4]], dirt, rock: rk },
    );
    // 구멍 가장자리 풀 · 덩굴 · 뿌리 · 풀잎
    for (bx, by, rad) in [
        (hx0 + 2.0, hole_bot(hx0) - 9.0, 6.0),
        (hx0 + 9.0, hole_bot(hx0 + 9.0) - 4.0, 4.0),
        (hx1 - 3.0, hole_bot(hx1) - 8.0, 6.0),
        (hx1 - 11.0, hole_bot(hx1 - 11.0) - 3.0, 4.0),
    ] {
        pix_tree(&mut c, bx, by, rad, &gr, &mut r, tb(6.0));
    }
    for k in 0..16 {
        let vx = round(hx0 - 4.0 + r.next() * (hx1 - hx0 + 8.0));
        if (vx - hc).abs() < hw * 0.45 {
            continue;
        }
        let len = 5.0 + (pow(r.next(), 1.6) * 36.0).floor();
        let y0 = max(hole_bot(vx), edge[clamp(vx, 0.0, lwf - 1.0) as usize] - 2.0) - 1.0;
        let seed = k as f64 * 7.0 + 3.0;
        let mut y = 0.0;
        while y < len {
            let ox = round(sin((y + seed) * 0.5) * 1.2);
            c.px(vx + ox, y0 + y, gr[if (y + seed) as i64 % 3 == 0 { 3 } else { 1 }]);
            if hash2(vx, y + seed, 81.0) < 0.35 {
                c.px(vx + ox + if hash2(y, vx, 82.0) < 0.5 { -1.0 } else { 1.0 }, y0 + y, gr[2]);
            }
            y += 1.0;
        }
    }
    let root = mix(hx("#4a3a2c"), hx("#141a20"), (1.0 - day) * 0.7);
    for _ in 0..5 {
        let mut rx = hx0 + 4.0 + (r.next() * (hx1 - hx0 - 8.0)).floor();
        let ry = hole_bot(rx) - 1.0;
        let len = 6.0 + (r.next() * 12.0).floor();
        let mut q = 0.0;
        while q < len {
            c.px(rx, ry + q, root);
            if r.next() < 0.3 {
                rx += if r.next() < 0.5 { -1.0 } else { 1.0 };
            }
            q += 1.0;
        }
    }
    for k in 0..16 {
        let gx = round(hx0 - 6.0 + r.next() * (hx1 - hx0 + 12.0));
        let gy = hole_bot(gx);
        if (gx - hc).abs() < hw * 0.7 {
            continue;
        }
        c.fill(gx, gy - 2.0, 1.0, 3.0, gr[2 + k % 2]);
    }
    // 용암종유: 짧고 뭉툭한 방울 모양
    let mut drips: Vec<[f64; 4]> = vec![];
    let mut i = 2.0;
    while i < lwf - 2.0 {
        if (i - hc).abs() >= hw + 4.0 {
            let e = edge[i as usize];
            let len = 2.0 + (pow(r.next(), 2.2) * 10.0).floor();
            let w0 = if len > 7.0 {
                3.0
            } else if len > 3.0 {
                2.0
            } else {
                1.0
            };
            let (l, _) = light(i - sh, e + 10.0, 1.0);
            let wm = clamp(l * 2.0, 0.0, 1.0);
            let mut j = 0.0;
            while j < len {
                let t = j / len;
                let ww = max(1.0, round(w0 * (1.0 - t * 0.55) + if j == len - 2.0 && len > 4.0 { 0.6 } else { 0.0 }));
                let x0 = i - (ww as i32 >> 1) as f64;
                c.fill(x0, e + j, ww, 1.0, cvc(0.2 + t * 0.08 + l * 0.35, wm));
                if ww > 1.0 {
                    c.fill(x0, e + j, 1.0, 1.0, cvc(0.32 + l * 0.5, wm));
                }
                j += 1.0;
            }
            if len > 4.0 {
                c.fill(i, e + len - 1.0, 1.0, 1.0, cvc(0.55 + l * 0.4, wm));
                if drips.len() < 6 && r.next() < 0.3 {
                    let a = r.next() * 3.0;
                    let b = 128.0 + (r.next() * 6.0).floor();
                    drips.push([i, e + len - VOFF, a, b]);
                }
            } // 젖은 끝 반짝 · 물방울 떨어질 자리
        }
        i += 3.0 + (r.next() * 5.0).floor();
    }
    // 벽 밑 바위 더미 (빛줄기가 닿는 곳은 이끼 · 고사리)
    let (sx0, sx1) = (252.0 + sh, 314.0 + sh);
    let mut i = -6.0;
    while i < lwf {
        let in_light = i > sx0 - 6.0 && i < sx1;
        let w = 9.0 + (r.next() * 14.0).floor();
        let hh = 5.0 + (r.next() * 7.0).floor();
        if !(i > 80.0 + sh - 40.0 && i < 80.0 + sh + 30.0) {
            let y = 190.0 + (r.next() * 5.0).floor();
            rock(&mut c, i, y, w, hh, &mut r, sh, in_light, day);
        } // 석주 발치는 비움
        i += 9.0 + (r.next() * 14.0).floor();
    }
    for k in 0..5 {
        // 고사리: 활처럼 휜 잎
        let fx = sx0 + 6.0 + ((k as f64 + r.next() * 0.6) / 5.0 * (sx1 - sx0 - 12.0)).floor();
        let fy = 189.0 + (r.next() * 4.0).floor();
        for sd in [-1.0, 1.0, -0.45, 0.45] {
            let len = 5.0 + (r.next() * 4.0).floor();
            let mut q = 0.0;
            while q < len {
                let px = round(fx + sd * q * 0.9);
                let py = round(fy - q * 1.15 + q * q / (len * 1.1));
                c.px(px, py, gf[if q < 2.0 { 1 } else { 2 }]);
                if q as i64 % 2 == 1 && q < len - 1.0 {
                    c.px(px, py - 1.0, gf[3]);
                }
                q += 1.0;
            }
        }
    }
    for (lx, ly) in [(150.0, 182.0), (346.0, 182.0)] {
        lamp(&mut c, lx + sh, ly + 5.0, false);
    }
    // 빛줄기: 구멍에서 이끼 바닥까지 비스듬히
    let lc = hx(["#f4faea", "#fff0d2", "#ffd0a0", "#b8c8f0"][pi.min(3)]);
    let a0 = 0.07 + day * 0.13;
    crate::cave::shaft(&mut c.d, lw, sh, lc, a0);
    let dj = drips.iter().map(|d| format!("[{},{},{},{}]", num(d[0]), num(d[1]), num(d[2]), num(d[3]))).collect::<Vec<_>>().join(",");
    let meta = format!(
        "\"oy\":-60,\"drips\":[{}],\"shaftCol\":\"{}\",\"shaft\":{{\"y0\":{},\"y1\":{},\"l0\":{},\"r0\":{},\"l1\":{},\"r1\":{}}}",
        dj,
        col_hex(lc),
        num(44.0 - VOFF),
        num(192.0 - VOFF),
        num(292.0 + sh),
        num(330.0 + sh),
        num(252.0 + sh),
        num(314.0 + sh)
    );
    (c, meta)
}
// 앞쪽 바닥 (가까운 층): 새끼줄 용암 바닥 · 물웅덩이 · 양옆 바위 더미 · 길가 등불
fn near() -> (Canvas, String) {
    let lw = layer_w(L_NEAR);
    let lwf = lw as f64;
    let sh = round(20.0 * L_NEAR);
    let mut c = Canvas::new(lw, 160);
    let mut r = rng(7401.0);
    crate::cave::near(&mut c.d, lw, sh);
    for _ in 0..6 {
        let px = (r.next() * lwf).floor();
        let py = 141.0 + (r.next() * 12.0).floor();
        let w = 8.0 + (r.next() * 14.0).floor();
        c.fill(px, py, w, 1.0, cvc(0.12, -0.3));
        c.fill(px + 1.0, py + 1.0, w - 2.0, 1.0, cvc(0.16, -0.2));
        let gx = px + 2.0 + (r.next() * (w - 4.0)).floor();
        c.fill(gx, py, 2.0, 1.0, cvc(0.55, 0.7));
    } // 물웅덩이 (등불 비침)
    for _ in 0..50 {
        let px = (r.next() * lwf).floor();
        let py = 138.0 + (r.next() * 19.0).floor();
        c.fill(px, py, 2.0, 1.0, cvc(0.16, 0.0));
        c.px(px, py - 1.0, cvc(0.4, 0.5));
    } // 자갈
    let mut rocks: Vec<[f64; 4]> = vec![];
    let mut i = -10.0;
    while i < lwf {
        let e = min(i, lwf - i) / lwf;
        if !(e > 0.16 && r.next() < 0.78) {
            let w = round(8.0 + r.next() * 12.0 + max(0.0, 0.16 - e) * 90.0);
            let hh = round(w * (0.42 + r.next() * 0.2));
            let y = 153.0 + (r.next() * 4.0).floor();
            rocks.push([i, y, w, hh]);
        }
        i += 7.0 + (r.next() * 10.0).floor();
    }
    for _ in 0..34 {
        let a = (r.next() * lwf).floor();
        let b = 140.0 + (r.next() * 16.0).floor();
        let w = 3.0 + (r.next() * 6.0).floor();
        let hh = 2.0 + (r.next() * 3.0).floor();
        rocks.push([a, b, w, hh]);
    } // 바닥 곳곳 잔돌
    rocks.sort_by(|a, b| a[1].partial_cmp(&b[1]).unwrap_or(std::cmp::Ordering::Equal));
    for [rx, ry, w, hh] in rocks {
        rock(&mut c, rx, ry, w, hh, &mut r, sh, false, 1.0);
    }
    let lamps = [32.0 + sh, 198.0 + sh, 372.0 + sh];
    for lx in lamps {
        lamp(&mut c, lx, 152.0, true);
    }
    (c, format!("\"lamps\":[{},{},{}]", num(lamps[0]), num(lamps[1]), num(lamps[2])))
}
// 발밑 길 (땅 층)
fn ground() -> Canvas {
    let lw = (world_w() + 8.0) as i32;
    let hh = (VIEW_H - GROUND + 4.0) as i32;
    let mut c = Canvas::new(lw, hh);
    let mut r = rng(7451.0);
    crate::cave::ground(&mut c.d, lw, hh);
    for _ in 0..70 {
        let px = (r.next() * lw as f64).floor();
        let py = 6.0 + (r.next() * (hh as f64 - 8.0)).floor();
        let w = 2.0 + (r.next() * 3.0).floor();
        c.fill(px, py, w, 1.0, cvc(0.16, 0.0));
        c.fill(px, py - 1.0, max(1.0, w - 1.0), 1.0, cvc(0.4, 0.5));
    } // 박힌 돌 조각
    c
}
// 가장 앞: 화면 아래를 감싸는 아주 어두운 바위 실루엣 · 위 가장자리에만 등불빛 테
fn front() -> Canvas {
    let lw = layer_w(L_FRONT);
    let lwf = lw as f64;
    let mut c = Canvas::new(lw, 30);
    let mut r = rng(7501.0);
    let mut top = vec![99.0; lw as usize];
    let mut i = -10.0;
    while i < lwf {
        let e = min(i, lwf - i);
        let w = 6.0 + r.next() * 10.0;
        let hh = if e < 50.0 { 12.0 + r.next() * 14.0 } else { 2.0 + r.next() * 5.0 };
        let cx = i;
        let mut k = (cx - w).floor();
        while k <= (cx + w).ceil() {
            if k >= 0.0 && k < lwf {
                let t = (k - cx) / w;
                if t.abs() <= 1.0 {
                    let y = round(30.0 - hh * pow(1.0 - t * t, 0.6) - (vnoise(k * 0.3, cx, 7502.0) - 0.5) * 2.0);
                    top[k as usize] = min(top[k as usize], y);
                }
            }
            k += 1.0;
        }
        i += 8.0 + (r.next() * 12.0).floor();
    }
    for i in 0..lw {
        let t = top[i as usize];
        let i = i as f64;
        if t < 30.0 {
            c.fill(i, t, 1.0, 30.0 - t, hx("#0b090c"));
            c.px(i, t, hx("#3a2a22"));
            if hash2(i, 1.0, 7503.0) < 0.3 {
                c.px(i, t + 1.0, hx("#1c1514"));
            }
        }
    }
    c
}
// buildCaveSet: 시간대마다 바뀌는 건 먼 벽 · 천장뿐 (나머지는 JS가 한 번만 받아 같이 씀)
pub fn set(pi: usize) {
    let day = [1.0, 0.85, 0.6, 0.3][pi.min(3)];
    out_push("sky", wall(day), String::new());
    let (c, m) = ceil(pi, day);
    out_push("field", c, m);
    out_empty("halla", L_HALL, 140);
    out_push("oreum", column(), "\"oy\":-60".into());
    let (c, m) = near();
    out_push("near", c, m);
    out_push("ground", ground(), String::new());
    out_push("front", front(), String::new());
}
