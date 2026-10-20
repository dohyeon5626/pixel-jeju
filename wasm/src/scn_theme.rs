// 기본 테마 배경 (원래 scenery.js): 하늘 · 한라산 · 오름 · 밭 · 가까운 층 · 땅 · 전경 · 성산 · 바다 · 해안 · 구름 · 비네트
//  난수(R)를 부르는 순서까지 원래 JS 그대로 (순서가 바뀌면 다른 그림이 나옴)
use crate::js::*;
use crate::noise::{hash2, vnoise};
use crate::scene::*;

// ── 하늘 ─────────────────────────────────────────────────────
pub fn sky(ph: &Phase) -> Canvas {
    let w = ctx().w as i32;
    let sh = 140.0 + VOFF;
    let mut c = Canvas::new(w, sh as i32);
    let n = ph.sky.len();
    let band_h = sh / n as f64;
    for y in 0..sh as i32 {
        let yf = y as f64;
        let f = yf / band_h;
        let i = min((n - 1) as f64, f.floor()) as usize;
        let fr = f - i as f64;
        for xx in 0..w {
            let x = xx as f64;
            let t = clamp(
                fr * fr * (3.0 - 2.0 * fr) + (vnoise(x * 0.02, yf * 0.05, 96.0) - 0.5) * 0.1 + (hash2(x, yf, 97.0) - 0.5) * 0.04,
                0.0,
                1.0,
            );
            c.px(x, yf, mix(ph.sky[i], ph.sky[(n - 1).min(i + 1)], round(t * 24.0) / 24.0));
        }
    }
    // 높은 하늘의 엷은 새털구름 줄기
    let mut rs = rng(91.0);
    let wf = w as f64;
    for k in 0..10 {
        let k = k as f64;
        let y0 = (rs.next() * sh * 0.6).floor();
        let x0 = (rs.next() * wf).floor();
        let len = 40.0 + (rs.next() * 90.0).floor();
        let mut i = 0.0;
        while i < len {
            let t = i / len;
            let a = pow(sin(t * PI), 1.5) * (0.06 + 0.14 * vnoise(i * 0.08, k, 92.0));
            let px = x0 + i;
            if px >= wf {
                break;
            }
            let yy = y0 + round(sin(t * 3.0 + k) * 1.5);
            c.fill_a(px, yy, 1.0, 1.0, ph.cloud[3], a);
            if t > 0.3 && t < 0.7 && vnoise(i * 0.2, k, 93.0) > 0.55 {
                c.fill_a(px, yy + 1.0, 1.0, 1.0, ph.cloud[3], a);
            }
            i += 1.0;
        }
    }
    // 수평선 근처 멀리 깔린 구름 띠 (위아래 모두 서서히 옅어짐)
    let hy = sh - 40.0;
    let bank = mix(ph.cloud[2], ph.haze, 0.5);
    for i in 0..w {
        let i = i as f64;
        let hgt = round(vnoise(i * 0.04, 0.5, 94.0) * 7.0 + vnoise(i * 0.15, 1.5, 95.0) * 3.0);
        let bot = 2.0 + round(vnoise(i * 0.07, 3.5, 98.0) * 4.0);
        let span = hgt + bot;
        let mut y = hy - hgt;
        while y < hy + bot {
            let u = (y - (hy - hgt)) / max(1.0, span);
            c.fill_a(i, y, 1.0, 1.0, bank, 0.24 * pow(sin(u * PI), 0.8));
            y += 1.0;
        }
    }
    // 해 / 달
    let s = &ph.sun;
    let mut pb = Pb::new(w, 140);
    pb.ellipse(s.x, s.y, s.r, s.r, |nx, ny| {
        if s.moon {
            if nx > 0.35 && hypot(nx - 0.6, ny + 0.1) < 0.75 {
                None
            } else if nx + ny < -0.5 {
                Some(mix(s.core, hx("#ffffff"), 0.5))
            } else {
                Some(s.core)
            }
        } else {
            Some(band(&[s.glow, mix(s.core, s.glow, 0.5), s.core], sphere_light(nx, ny)))
        }
    });
    let mut a = 0.0;
    while a < 6.28 {
        c.fill_a(round(s.x + cos(a) * (s.r + 2.0)), round(s.y + sin(a) * (s.r + 2.0)), 1.0, 1.0, s.glow, 0.3);
        a += 0.5 / (s.r + 2.0);
    }
    c.draw(&pb.canvas(), 0.0, 0.0);
    c
}

// 뭉게구름: 노이즈로 윗면은 울퉁불퉁, 밑면은 납작하고 어둡게 · 양 끝 밑면은 둥글게 말아 올림
pub fn cloud(w: f64, hh: f64, seed: f64, pal: &[Col]) -> Canvas {
    let pad = 10.0;
    let mut pb = Pb::new((w + pad * 2.0) as i32, (hh + 2.0) as i32);
    let base = hh * 0.8 + 2.0;
    let skew = (hash2(seed, 1.0, 5.0) - 0.5) * 0.4;
    for y in 0..(hh + 2.0) as i32 {
        for xx in 0..(w + pad * 2.0) as i32 {
            let (y, xx) = (y as f64, xx as f64);
            let x = xx - pad;
            let nx = ((x + 0.5) / w * 2.0 - 1.0) - skew;
            let edge = max(0.0, 1.0 - nx * nx);
            if edge <= 0.0 {
                continue;
            }
            let top = max(
                1.0,
                base - hh * 0.74 * pow(edge, 0.7) * (0.4 + 0.6 * vnoise(x * 0.06, 0.5, seed))
                    - (vnoise(x * 0.2, 1.5, seed + 1.0) - 0.5) * 5.0 * edge,
            );
            let bot = base - (1.0 - edge.sqrt()) * 5.0 + (vnoise(x * 0.2, 2.5, seed + 2.0) - 0.5) * 2.0;
            if y < top || y > bot {
                continue;
            }
            let dt = (y - top) / max(1.0, base - top);
            let v = 1.0 - dt * 0.9 - max(0.0, nx) * 0.25 + (vnoise(x * 0.15, y * 0.2, seed + 3.0) - 0.5) * 0.35;
            pb.set(xx, y, band(pal, clamp(v, 0.0, 0.999)));
        }
    }
    pb.canvas()
}

// ── 한라산 ───────────────────────────────────────────────────
pub fn halla_top(x: f64, cx: f64) -> f64 {
    let d = (x - cx).abs();
    if d < 9.0 {
        return 60.0 + if d < 6.0 { 2.0 } else { 1.0 };
    }
    if d < 16.0 {
        return 59.0 + if d > 13.0 { 1.0 } else { 0.0 };
    }
    let t = d - 16.0;
    round(59.0 + t * 0.2 + t * t * 0.0017)
}
pub fn halla(ph: &Phase) -> (Canvas, String) {
    let lw = layer_w(L_HALL);
    let mut c = Canvas::new(lw, 140);
    let cx = round(lw as f64 / 2.0);
    let rock = atmos(&["#56525c", "#6e6872", "#8a8288", "#a69c9c", "#c2b8b2"], ph, 0.35);
    let grass = atmos(&["#4a5a52", "#5a6c5a", "#6e8064", "#869470", "#a0aa84"], ph, 0.35);
    let forest = atmos(&["#2a4640", "#32544a", "#3c6252", "#4a705c", "#5c8068"], ph, 0.35);
    let tops: Vec<f64> = (0..lw).map(|i| halla_top(i as f64, cx)).collect();
    for ii in 0..lw {
        let i = ii as f64;
        let top = tops[ii as usize];
        let side = clamp((i - cx) / (lw as f64 * 0.42), -1.0, 1.0);
        let mut y = top;
        while y < 140.0 {
            let depth = y - top;
            let u = (i - cx + (vnoise(y * 0.06, i * 0.01, 9.0) - 0.5) * 16.0) / (y - 44.0);
            let ridge = vnoise(u * 6.0 + 3.0, y * 0.02, 7.0) * 0.62 + vnoise(u * 15.0 + 9.0, y * 0.05, 8.0) * 0.38;
            let mut l = 0.56 - side * 0.3 + (ridge - 0.5) * 0.4 * clamp(depth / 12.0, 0.25, 1.0);
            l += (vnoise(i * 0.18, y * 0.18, 3.0) - 0.5) * 0.1;
            if depth < 2.0 {
                l += 0.16;
            }
            let alt = y + (vnoise(i * 0.07, 0.3, 11.0) - 0.5) * 9.0 + (ridge - 0.5) * 6.0;
            let is_forest = !(depth < 5.0 && (i - cx).abs() < 32.0) && alt >= 80.0;
            let ramp = if depth < 5.0 && (i - cx).abs() < 32.0 {
                &rock
            } else if alt < 80.0 {
                &grass
            } else {
                &forest
            };
            let mut col = band(ramp, clamp(l, 0.0, 0.999));
            if is_forest && hash2((ii >> 1) as f64, (y as i32 >> 1) as f64, 5.0) < 0.07 && l > 0.45 {
                col = band(ramp, clamp(l + 0.15, 0.0, 0.999));
            }
            let hz = clamp((y - 96.0) / 30.0, 0.0, 1.0);
            if hz > 0.0 {
                col = mix(col, ph.haze, hz * 0.35);
            }
            c.px(i, y, col);
            y += 1.0;
        }
    }
    // 기슭의 작은 오름들: 능선 윤곽만 (왼쪽 빛 · 오른쪽 그늘)
    for (ox, ow, oh) in [(-74.0, 13.0, 6.0), (-44.0, 9.0, 4.0), (58.0, 11.0, 5.0), (96.0, 15.0, 6.0)] {
        let ox0 = cx + ox;
        let base = tops[clamp(ox0, 0.0, (lw - 1) as f64) as usize] + 13.0;
        let mut i = -ow;
        while i <= ow {
            let t = i / ow;
            let yy = base - round(oh * (1.0 - t * t));
            let l = 0.62 - t * 0.4;
            c.px(ox0 + i, yy, mix(band(&forest, clamp(l + 0.12, 0.0, 0.999)), ph.haze, 0.12));
            if t.abs() < 0.85 {
                c.px(ox0 + i, yy + 1.0, mix(band(&forest, clamp(l - 0.08, 0.0, 0.999)), ph.haze, 0.12));
            }
            i += 1.0;
        }
    }
    // 백록담: 정상 분화구 테두리
    let mut i = cx - 8.0;
    while i <= cx + 8.0 {
        c.px(i, tops[i as usize] + 1.0, if i < cx { rock[1] } else { rock[0] });
        i += 1.0;
    }
    c.fill(cx - 5.0, 62.0, 11.0, 1.0, rock[0]);
    (c, format!("\"cx\":{},\"top\":59", num(cx)))
}
pub fn oreum(ph: &Phase) -> Canvas {
    let lw = layer_w(L_OREUM);
    let mut c = Canvas::new(lw, 140);
    let cols = atmos(&["#2a5a4c", "#336852", "#3e765a", "#508866", "#68a078"], ph, 0.28);
    let mut hill = |cx: f64, w: f64, hh: f64, base: f64, crater: bool, seed: f64| {
        let mut i = -round(w * 1.3);
        while i <= round(w * 1.3) {
            let t = clamp(i / w, -1.0, 1.0);
            let a = (i / w).abs();
            let mut top = if a <= 1.0 { base - hh * (1.0 - pow(a, 1.7)) } else { base + (a - 1.0) * w * 0.35 };
            if crater && a < 0.2 {
                top += (0.2 - a) / 0.2 * 2.2;
            }
            let top = round(top);
            let mut y = top;
            while y < 140.0 {
                let depth = y - top;
                let mut l = 0.58 - t * 0.38 + (vnoise((cx + i) * 0.12, y * 0.12, seed) - 0.5) * 0.18;
                if depth < 2.0 {
                    l += 0.16;
                }
                if y > base - 4.0 {
                    l -= 0.08;
                }
                let mut col = band(&cols, clamp(l, 0.0, 0.999));
                if hash2(((cx + i) / 3.0).floor(), (y / 2.0).floor(), seed) < 0.04 && depth > 2.0 {
                    let k = cols.iter().position(|&q| q == col).map(|p| p as i32).unwrap_or(-1);
                    col = cols[(4).min(k + 1) as usize];
                }
                c.px(cx + i, y, col);
                y += 1.0;
            }
            i += 1.0;
        }
    };
    let lwf = lw as f64;
    hill(40.0, 48.0, 22.0, 116.0, true, 1.0);
    hill(118.0, 28.0, 12.0, 117.0, false, 2.0);
    hill(lwf - 70.0, 56.0, 26.0, 116.0, true, 3.0);
    hill(lwf - 150.0, 24.0, 10.0, 118.0, false, 4.0);
    c
}

// ── 먼 밭 · 방풍림 · 제주 집 ─────────────────────────────────
pub fn fields(ph: &Phase) -> Canvas {
    let lw = layer_w(L_FIELD);
    let lwf = lw as f64;
    let mut c = Canvas::new(lw, 140);
    let mut r = rng(17.0);
    let a2 = |k: &str| atmo(mute(hx(k), 0.75), ph, 0.18); // 먼 밭은 채도를 한 번 더 눌러 멀리 보이게
    let (g1, g2, g3, y1, y2, s1, s2, wall, tree, tree_l) = (
        a2("#5fa846"),
        a2("#7cbc52"),
        a2("#98cc5e"),
        a2("#f2cf3c"),
        a2("#ffe27a"),
        a2("#a87a4e"),
        a2("#c4966a"),
        a2("#3a3646"),
        a2("#24573c"),
        a2("#3a7a48"),
    );
    let (roof_o, roof_b, wall_w, wall_s, org) = (a2("#e2683a"), a2("#3a6ac8"), a2("#f2ede4"), a2("#c8c0b8"), a2("#ff9a2a"));
    let kinds: [(Col, Option<Col>); 7] = [(g1, None), (g2, None), (g3, None), (y1, Some(y2)), (s1, Some(s2)), (g2, None), (g1, None)];
    for (y, hh) in [(112.0, 3.0), (115.0, 4.0), (119.0, 5.0), (124.0, 6.0)] {
        let mut i = -(r.next() * 20.0).floor();
        let mut carry = 0.0;
        while i < lwf {
            let w = 18.0 + (r.next() * 30.0).floor() + hh * 3.0;
            let (base, alt) = kinds[(r.next() * 7.0).floor() as usize];
            let edge = mix(wall, base, 0.35);
            let slant = carry;
            let next_slant = (r.next() - 0.5) * 1.4;
            carry = next_slant; // 이웃 밭과 경계를 공유해 틈이 없게
            let mut xx = -4.0;
            while xx < w + 4.0 {
                let top = y + round((vnoise((i + xx) * 0.05, y, 31.0) - 0.5) * 1.6);
                let bot = y + hh + round((vnoise((i + xx) * 0.09, y + 7.0, 35.0) - 0.5) * 1.4);
                let mut yy = top;
                while yy < bot {
                    let dy = yy - y;
                    let l = round(dy * slant);
                    let rr = w + round(dy * next_slant);
                    if !(xx < l || xx >= rr) {
                        let mut col = base;
                        if alt.is_some() && (xx + (yy - top)) as i32 % 4 == 0 {
                            col = alt.unwrap();
                        } else if hash2(((i + xx) as i32 >> 1) as f64, yy, 33.0) < 0.12 {
                            col = mix(base, wall, 0.15);
                        }
                        if (yy == bot - 1.0 || xx == rr - 1.0) && hash2(i + xx, yy, 34.0) < 0.7 {
                            col = edge;
                        } // 밭담: 끊기는 돌 점
                        c.px(i + xx, yy, col);
                    }
                    yy += 1.0;
                }
                xx += 1.0;
            }
            i += w;
        }
    }
    // 방풍림 줄 (삼나무)
    for (y, n) in [(114.0, 9), (118.0, 7), (123.0, 6)] {
        for _ in 0..n {
            let sx = (r.next() * lwf).floor();
            let len = 10.0 + (r.next() * 24.0).floor();
            let mut t = 0.0;
            while t < len {
                c.fill(sx + t, y - 3.0, 3.0, 4.0, tree);
                c.fill(sx + t + 1.0, y - 4.0, 1.0, 1.0, tree);
                c.px(sx + t, y - 3.0, tree_l);
                if r.next() < 0.25 {
                    c.px(sx + t + 1.0, y - 1.0, org);
                }
                t += 3.0;
            }
        }
    }
    // 집들
    for k in 0..6 {
        let hx_ = 20.0 + (r.next() * (lwf - 40.0)).floor();
        let hy = [116.0, 121.0, 127.0][k % 3];
        let big = (k % 3) as f64;
        let (ww, hh) = (6.0 + big * 2.0, 3.0 + big);
        c.fill(hx_, hy - hh, ww, hh, wall_w);
        c.fill(hx_ + ww - 2.0, hy - hh, 2.0, hh, wall_s);
        let roof = if k % 2 == 1 { roof_o } else { roof_b };
        c.fill(hx_ - 1.0, hy - hh - 2.0, ww + 2.0, 2.0, roof);
        c.fill(hx_, hy - hh - 3.0, ww, 1.0, roof);
        c.fill(hx_ + 2.0, hy - 2.0, 1.0, 2.0, wall);
    }
    c
}

// ── 가까운 층: 귤나무 · 야자수 · 동백 · 초가집 · 정낭 · 돌담 · 유채 ───
pub fn near(ph: &Phase) -> Canvas {
    let lw = layer_w(L_NEAR);
    let lwf = lw as f64;
    let mut c = Canvas::new(lw, 160);
    let mut r = rng(5.0);
    let a = |k: &str| atmo(hx(k), ph, 0.06);
    let am = |v: &[Col]| v.iter().map(|&k| atmo(k, ph, 0.06)).collect::<Vec<Col>>();
    let p = &ctx().pal;
    let (l, o, y, g) = (am(&p.leaf), am(&p.org), am(&p.yel), am(&p.grass));
    let st = atmos(&["#2a2632", "#3e3a4a", "#56526a", "#7a7590", "#a39eb6"], ph, 0.06);
    c.fill(0.0, 132.0, lwf, 28.0, g[2]);
    c.fill(0.0, 132.0, lwf, 2.0, g[3]);
    let palm = |c: &mut Canvas, px: f64, top: f64| {
        let mut yy = top;
        while yy < 150.0 {
            let m = yy as i32 % 3;
            c.fill(
                px,
                yy,
                3.0,
                1.0,
                if m == 0 {
                    st[1]
                } else if m == 1 {
                    a("#8a6a4e")
                } else {
                    a("#6a4e3a")
                },
            );
            if m != 0 {
                c.px(px, yy, a("#a88a68"));
            }
            yy += 1.0;
        }
        let fr: Vec<(f64, f64)> =
            [(-14.0, 4.0), (-11.0, -3.0), (-6.0, -7.0), (0.0, -9.0), (6.0, -7.0), (11.0, -3.0), (14.0, 4.0), (-9.0, 8.0), (9.0, 8.0)]
                .iter()
                .enumerate()
                .map(|(i, &(fx, fy))| {
                    (round(fx * (0.8 + hash2(px, i as f64, 61.0) * 0.4)), round(fy + (hash2(px, i as f64, 62.0) - 0.5) * 4.0))
                })
                .collect();
        for (fx, fy) in fr {
            let n = max(fx.abs(), fy.abs());
            let mut k = 0.0;
            while k <= n {
                let t = k / n;
                let xx = px + 1.0 + fx * t;
                let yy = top + fy * t + (t * t) * fx.abs() * 0.35;
                c.fill(
                    round(xx),
                    round(yy),
                    2.0,
                    1.0,
                    if fy > 2.0 {
                        l[0]
                    } else if t < 0.4 {
                        l[1]
                    } else {
                        l[2]
                    },
                );
                if k as i32 % 2 == 0 && fy <= 2.0 {
                    c.px(round(xx), round(yy) - 1.0, l[3]);
                }
                k += 1.0;
            }
        }
        c.fill(px - 1.0, top, 5.0, 3.0, a("#5a3e2a"));
    };
    let tree = |c: &mut Canvas, r: &mut crate::noise::Rng, tx: f64, ty: f64, rad: f64| {
        let size = (rad * 2.6).ceil() + 6.0;
        let mut pb = Pb::new(size as i32, size as i32);
        let blobs: Vec<(f64, f64, f64)> =
            [(0.0, 0.0, rad), (-rad * 0.55, rad * 0.25, rad * 0.7), (rad * 0.55, rad * 0.2, rad * 0.75), (0.0, -rad * 0.35, rad * 0.7)]
                .iter()
                .enumerate()
                .map(|(i, &(bx, by, br))| {
                    let i = i as f64;
                    (
                        bx + (hash2(tx, i, 51.0) - 0.5) * rad * 0.2,
                        by + (hash2(tx, i, 52.0) - 0.5) * rad * 0.2,
                        br * (0.9 + hash2(tx, i, 53.0) * 0.1),
                    )
                })
                .collect();
        let (pw, ph_) = (pb.w as f64, pb.h as f64);
        for yy in 0..pb.h {
            for xx in 0..pb.w {
                let (xf, yf) = (xx as f64, yy as f64);
                let mut bv = -1.0;
                let mut best = false;
                for &(bx, by, br) in &blobs {
                    let nx = (xf + 0.5 - (pw / 2.0 + bx)) / br;
                    let ny = (yf + 0.5 - (ph_ / 2.0 + by)) / br;
                    if nx * nx + ny * ny <= 0.9 + 0.18 * vnoise(xf * 0.45, yf * 0.45, tx + 54.0) {
                        let v = sphere_light(clamp(nx, -1.0, 1.0), clamp(ny, -1.0, 1.0));
                        if v > bv {
                            bv = v;
                            best = true;
                        }
                    }
                }
                if best {
                    pb.set(
                        xf,
                        yf,
                        if bv < 0.38 {
                            l[0]
                        } else if bv < 0.58 {
                            l[1]
                        } else if bv < 0.8 {
                            l[2]
                        } else {
                            l[3]
                        },
                    );
                }
            }
        }
        let img = pb.canvas();
        c.fill(tx - 1.0, ty, 3.0, 150.0 - ty, a("#5a3e2a"));
        c.draw(&img, round(tx - pw / 2.0), round(ty - ph_ / 2.0 - rad * 0.4));
        let mut k = 0.0;
        while k < rad * 1.4 {
            let an = r.next() * PI * 2.0;
            let rr = r.next() * rad * 0.85;
            let ox = round(tx + cos(an) * rr);
            let oy = round(ty - rad * 0.4 + sin(an) * rr * 0.8);
            c.fill(ox, oy, 2.0, 2.0, o[2]);
            c.px(ox, oy, o[3]);
            c.px(ox + 1.0, oy + 1.0, o[1]);
            k += 1.0;
        }
    };
    let mut i = 0.0;
    while i < lwf {
        let ty = 126.0 + (r.next() * 4.0).floor();
        let rad = 9.0 + (r.next() * 4.0).floor();
        tree(&mut c, &mut r, i + 10.0, ty, rad);
        i += 34.0 + (r.next() * 20.0).floor();
    }
    palm(&mut c, round(lwf * 0.22), 88.0);
    palm(&mut c, round(lwf * 0.71), 80.0);
    // 동백나무 (짙은 잎 + 붉은 꽃)
    let mut camellia = |c: &mut Canvas, cx: f64, cy: f64, rad: f64| {
        let mut pb = Pb::new((rad * 2.0 + 4.0) as i32, (rad * 2.0 + 4.0) as i32);
        pb.ellipse(rad + 2.0, rad + 2.0, rad, rad * 0.85, |nx, ny| {
            let v = sphere_light(nx, ny);
            Some(if v < 0.4 {
                a("#163a2c")
            } else if v < 0.65 {
                a("#20503a")
            } else {
                a("#2e6a48")
            })
        });
        c.draw(&pb.canvas(), round(cx - rad - 2.0), round(cy - rad - 2.0));
        let mut k = 0.0;
        while k < rad * 1.2 {
            let an = r.next() * 6.28;
            let rr = r.next() * rad * 0.8;
            let fx = round(cx + cos(an) * rr);
            let fy = round(cy + sin(an) * rr * 0.8);
            c.fill(fx, fy, 2.0, 2.0, a("#c83a48"));
            c.px(fx, fy, a("#f2d04a"));
            k += 1.0;
        }
    };
    camellia(&mut c, round(lwf * 0.08), 128.0, 8.0);
    camellia(&mut c, round(lwf * 0.93), 127.0, 9.0);
    // 초가집: 현무암 돌벽 + 둥근 초가지붕
    let choga = |c: &mut Canvas, hxx: f64, base: f64, w: f64| {
        let hw = w / 2.0;
        let wall_h = 11.0;
        let mut yy = base - wall_h;
        while yy < base {
            let mut i = -hw + 2.0;
            while i < hw - 2.0 {
                let row = ((yy / 3.0).floor() as i32 % 2) as f64 * 2.0;
                let v = hash2(((i + 40.0 + row) / 4.0).floor(), (yy / 3.0).floor(), 4.0);
                let mut col = a(if v < 0.33 {
                    "#2e2a36"
                } else if v < 0.66 {
                    "#3e3a48"
                } else {
                    "#4e4a5a"
                });
                if (i + 40.0 + row) as i32 % 4 == 0 || yy as i32 % 3 == 0 {
                    col = a("#1e1a24");
                }
                c.px(hxx + i, yy, col);
                i += 1.0;
            }
            yy += 1.0;
        }
        c.fill(hxx - 3.0, base - 8.0, 6.0, 8.0, a("#3a2418"));
        c.fill(hxx - 2.0, base - 7.0, 4.0, 7.0, a("#6a4628"));
        let r_top = base - wall_h - 12.0;
        let mut yy = r_top;
        while yy < base - wall_h + 3.0 {
            let t = (yy - r_top) / 15.0;
            let half = round(
                hw * min(1.0, t * 1.6).sqrt() + (if yy > base - wall_h { 2.0 } else { 0.0 }) + (vnoise(yy * 0.45, hxx, 64.0) - 0.5) * 2.0,
            );
            let mut i = -half;
            while i <= half {
                let ny = t;
                let nx = i / (if half != 0.0 { half } else { 1.0 });
                let mut col = if sphere_light(nx * 0.9, -0.6 + ny) > 0.62 {
                    "#c8a868"
                } else if sphere_light(nx * 0.9, -0.6 + ny) > 0.42 {
                    "#a88850"
                } else {
                    "#7a6038"
                };
                if (round(i + sin(t * 2.0) * 2.0) as i32 + 70) % 9 == 0 || yy == r_top + 6.0 || yy == r_top + 11.0 {
                    col = "#5a4428";
                }
                c.px(round(hxx + i), yy, a(col));
                i += 1.0;
            }
            yy += 1.0;
        }
    };
    choga(&mut c, round(lwf * 0.3), 133.0, 34.0);
    // 정낭: 구멍 뚫린 정주석 두 개 + 비스듬히 걸친 나무 세 개
    let gx = round(lwf * 0.42);
    for ox in [0.0, 24.0] {
        c.fill(gx + ox, 112.0, 6.0, 28.0, a("#2e2a36"));
        c.fill(gx + ox, 112.0, 2.0, 28.0, a("#4e4a58"));
        c.fill(gx + ox + 5.0, 112.0, 1.0, 28.0, a("#1e1a24"));
        for k in 0..3 {
            c.fill(gx + ox + 2.0, 116.0 + k as f64 * 6.0, 2.0, 2.0, a("#141018"));
        }
    }
    for k in 0..3 {
        let y0 = 117.0 + k as f64 * 6.0;
        let y1 = if k == 2 { 138.0 } else { y0 };
        for i in 0..=26 {
            let i = i as f64;
            let yy = round(y0 + (y1 - y0) * (i / 26.0));
            c.fill(gx + 2.0 + i, yy, 1.0, 2.0, a("#6a4628"));
            c.px(gx + 2.0 + i, yy, a("#9a7044"));
        }
    }
    // 돌담: 돌 하나하나 셰이딩, 사이 틈은 어둡게
    let stone = |c: &mut Canvas, r: &mut crate::noise::Rng, sx: f64, sy: f64, w: f64, hh: f64| {
        let mut pb = Pb::new((w + 2.0) as i32, (hh + 2.0) as i32);
        let c1 = r.next() * 0.12;
        let c2 = r.next() * 0.12;
        for yy in 1..=hh as i32 {
            for xx in 1..=w as i32 {
                let (xf, yf) = (xx as f64, yy as f64);
                let u = (xf - 0.5) / w;
                let v = (yf - 0.5) / hh;
                if u + 0.7 * v < 0.16 + c1 || u - 0.4 * v > 0.87 - c2 || v - 0.25 * u > 0.87 || v + 0.3 * u < 0.17 + c2 {
                    continue;
                }
                pb.set(
                    xf,
                    yf,
                    if v < 0.3 && u < 0.72 {
                        st[3]
                    } else if u > 0.7 || v > 0.72 {
                        st[1]
                    } else {
                        st[2]
                    },
                );
            }
        }
        if w > 6.0 {
            let px = 2.0 + (r.next() * (w - 3.0)).floor();
            let py = 2.0 + (r.next() * (hh - 3.0)).floor();
            if pb.get(px, py).is_some() {
                pb.set(px, py, st[1]);
            }
        }
        c.draw(&pb.sel_out(0.7).canvas(), sx - 1.0, sy - 1.0);
    };
    c.fill(0.0, 138.0, lwf, 12.0, st[0]);
    for (yy, off, hh) in [(143.0, 0.0, 7.0), (137.0, 4.0, 7.0), (131.0, 9.0, 6.0)] {
        let mut i = -off;
        while i < lwf {
            let w = 7.0 + (r.next() * 7.0).floor();
            let h2 = hh - (r.next() * 2.0).floor();
            let sy = yy + (r.next() * 2.0).floor();
            stone(&mut c, &mut r, i, sy, w, h2);
            i += w + if r.next() < 0.3 { 2.0 } else { 0.0 };
        }
    }
    // 유채꽃 덤불 (꽃밭은 군데군데)
    let mut i = 0.0;
    while i < lwf {
        if vnoise(i * 0.018, 0.0, 91.0) >= 0.42 {
            let by = 152.0 + (r.next() * 4.0).floor();
            let n = 3.0 + (r.next() * 4.0).floor();
            let mut k = 0.0;
            while k < n {
                let fx = i + (r.next() * 7.0).floor() - 3.0;
                let fy = by - 4.0 - (r.next() * 8.0).floor();
                c.fill(fx + 1.0, fy + 2.0, 1.0, by - fy, g[1]);
                let wide = hash2(fx, fy, 67.0) > 0.55;
                c.fill(fx, fy, if wide { 3.0 } else { 2.0 }, 1.0, y[1]);
                c.fill(fx + 1.0, fy - 1.0, 1.0, 3.0, y[1]);
                c.px(fx + 1.0, fy, y[3]);
                k += 1.0;
            }
        }
        i += 5.0 + (r.next() * 7.0).floor();
    }
    c
}

// ── 땅 (게임 무대): 풀 립 + 흙 띠 + 박힌 돌 ────────────────────
pub fn ground(ph: &Phase) -> Canvas {
    let lw = (world_w() + 8.0) as i32;
    let lwf = lw as f64;
    let hh = (VIEW_H - GROUND + 4.0) as i32;
    let mut c = Canvas::new(lw, hh);
    let mut r = rng(23.0);
    let am = |v: &[Col]| v.iter().map(|&k| atmo(k, ph, 0.0)).collect::<Vec<Col>>();
    let p = &ctx().pal;
    let (g, s, st) = (am(&p.grass), am(&p.soil), am(&p.stone));
    let top = 3.0;
    let bands = [(top, s[3]), (top + 5.0, s[2]), (top + 11.0, s[1]), (top + 19.0, s[0])];
    for y in top as i32..hh {
        let yf = y as f64;
        for i in 0..lw {
            let yy = yf + (vnoise(i as f64 * 0.055, yf * 0.08, 23.0) - 0.5) * 5.0;
            let mut j = 0;
            while j < bands.len() - 1 && yy >= bands[j + 1].0 {
                j += 1;
            }
            let mut col = bands[j].1;
            if hash2((i >> 1) as f64, yf, 24.0) < 0.05 {
                col = bands[j.saturating_sub(1)].1;
            } // 흙 알갱이
            c.px(i as f64, yf, col);
        }
    }
    for _ in 0..60 {
        // 흙 결
        let sx = (r.next() * lwf).floor();
        let sy = top + 6.0 + (r.next() * 18.0).floor();
        let w = 3.0 + (r.next() * 6.0).floor();
        let k = if sy < top + 11.0 { 2 } else { 1 };
        c.fill(sx, sy, w, 1.0, s[(k - 1).max(0) as usize]);
        c.fill(sx + 1.0, sy - 1.0, w - 2.0, 1.0, s[(k + 1).min(4) as usize]);
    }
    for _ in 0..16 {
        // 박힌 현무암
        let w = 4.0 + (r.next() * 5.0).floor();
        let h2 = 3.0 + (r.next() * 2.0).floor();
        let mut pb = Pb::new((w + 2.0) as i32, (h2 + 2.0) as i32);
        pb.ellipse((w + 2.0) / 2.0, (h2 + 2.0) / 2.0, w / 2.0, h2 / 2.0, |nx, ny| {
            let v = sphere_light(nx, ny);
            Some(if v < 0.4 {
                st[1]
            } else if v < 0.7 {
                st[2]
            } else {
                st[3]
            })
        });
        let (x, y) = ((r.next() * lwf).floor(), top + 7.0 + (r.next() * 16.0).floor());
        c.draw(&pb.sel_out(0.6).canvas(), x, y);
    }
    for _ in 0..24 {
        // 들꽃 군락 · 작은 풀 덤불
        let fx = (r.next() * lwf).floor();
        let fy = top + 5.0 + (r.next() * 4.0).floor();
        c.fill(fx, fy, 3.0, 1.0, g[2]);
        c.px(fx + 1.0, fy - 1.0, g[2]);
        if r.next() < 0.5 {
            let fl = ["#f2e8c8", "#e8c43a", "#d87aa0"][(r.next() * 3.0).floor() as usize];
            c.px(fx + 1.0, fy - 2.0, atmo(hx(fl), ph, 0.0));
        }
    }
    for i in 0..lw {
        // 풀 립: 물결 모양 아랫단 + 위로 솟은 풀잎
        let i = i as f64;
        let depth = 3.0
            + if (sin(i * 0.45) + sin(i * 0.17 + 1.0)) > 0.6 {
                2.0
            } else if sin(i * 0.9) > 0.3 {
                1.0
            } else {
                0.0
            };
        let mut y = 0.0;
        while y < depth {
            c.px(
                i,
                top + y,
                if y == 0.0 {
                    g[4]
                } else if y == 1.0 {
                    g[3]
                } else if y == depth - 1.0 {
                    g[1]
                } else {
                    g[2]
                },
            );
            y += 1.0;
        }
        c.px(i, top + depth, mix(s[3], INK, 0.35));
        let blade = hash2(i, 3.0, 2.0);
        if blade < 0.35 {
            c.px(i, top - 1.0, g[3]);
        }
        if blade < 0.12 {
            c.px(i, top - 2.0, g[4]);
        }
    }
    c
}
pub fn ground_theme(ph: &Phase, kind: &str) -> Canvas {
    let mut c = ground(ph);
    if kind == "field" {
        return c;
    }
    let mut r = rng(5.0);
    let tint = if kind == "beach" { ["#c8b48c", "#e0cca4", "#a8946c", "#8a7654"] } else { ["#3c3644", "#4e4858", "#2e2a36", "#24202c"] };
    let (w, hh) = (c.w as f64, c.h);
    for y in 1..hh {
        let yf = y as f64;
        for i in 0..c.w {
            // 흙 대신 모래: 위쪽 풀 립은 남기고 아래만 덮음
            let i = i as f64;
            let edge = yf < 3.0 + if vnoise(i * 0.3, 0.5, 81.0) > 0.55 { 1.0 } else { 0.0 };
            if yf < 2.0 && vnoise(i * 0.3, 0.5, 81.0) < 0.45 {
                continue;
            }
            let yy = yf + (vnoise(i * 0.06, yf * 0.1, 82.0) - 0.5) * 5.0;
            let k = if edge {
                1
            } else if yy < 10.0 {
                0
            } else if yy < 18.0 {
                2
            } else {
                3
            };
            c.px(i, yf, atmo(hx(tint[k]), ph, 0.0));
        }
    }
    for _ in 0..120 {
        let (x, y) = ((r.next() * w).floor(), 8.0 + (r.next() * 18.0).floor());
        c.fill(x, y, 2.0, 1.0, atmo(hx(tint[1]), ph, 0.0));
    }
    for _ in 0..10 {
        let sx = (r.next() * w).floor();
        let sy = 10.0 + (r.next() * 14.0).floor();
        c.fill(sx, sy, 3.0, 2.0, atmo(hx("#f4e8d0"), ph, 0.0));
        c.px(sx + 1.0, sy, atmo(hx("#c88a6a"), ph, 0.0));
    } // 조개껍데기
    c
}

// 전경: 화면 아래를 감싸는 어두운 풀 실루엣
pub fn front(ph: &Phase) -> Canvas {
    let lw = layer_w(L_FRONT);
    let lwf = lw as f64;
    let mut c = Canvas::new(lw, 30);
    let mut r = rng(88.0);
    let (dark, mid, flw) = (atmo(hx("#10241e"), ph, 0.0), atmo(hx("#1a382a"), ph, 0.0), atmo(hx("#8a7a2a"), ph, 0.0));
    let mut i = 0.0;
    while i < lwf {
        let edge = min(i, lwf - i) < 40.0;
        let hh = (if edge { 12.0 } else { 4.0 }) + (r.next() * if edge { 16.0 } else { 7.0 }).floor();
        let lean = (r.next() - 0.5) * 6.0;
        let mut k = 0.0;
        while k < hh {
            let t = k / hh;
            c.fill(round(i + lean * t * t), 30.0 - k, if k < hh * 0.6 { 2.0 } else { 1.0 }, 1.0, if k < hh * 0.5 { dark } else { mid });
            k += 1.0;
        }
        if r.next() < 0.12 {
            c.fill(round(i + lean) - 1.0, 30.0 - hh - 1.0, 3.0, 2.0, flw);
        }
        i += 2.0 + (r.next() * 3.0).floor();
    }
    c
}

// 비네트 (부드럽게 가장자리만): 가운데에서 멀수록 보랏빛 어둠
pub fn vignette() -> Canvas {
    let w = ctx().w;
    let mut c = Canvas::new(w as i32, H as i32);
    let (cx, cy, r0, r1) = (w / 2.0, H / 2.0, H * 0.45, H * 1.05);
    for y in 0..H as i32 {
        for i in 0..w as i32 {
            let d = hypot(i as f64 + 0.5 - cx, y as f64 + 0.5 - cy);
            let t = clamp((d - r0) / (r1 - r0), 0.0, 1.0);
            let a = round(0.45 * t * 255.0);
            if a <= 0.0 {
                continue;
            }
            let p = ((y * w as i32 + i) * 4) as usize;
            c.d[p] = 20;
            c.d[p + 1] = 8;
            c.d[p + 2] = 30;
            c.d[p + 3] = a as u8;
        }
    }
    c
}

// ── 해안 테마: 성산일출봉 · 바다 · 등대 · 현무암 갯바위 · 불턱 ───
pub fn seongsan(ph: &Phase) -> (Canvas, String) {
    let lw = layer_w(L_HALL);
    let lwf = lw as f64;
    let mut c = Canvas::new(lw, 140);
    let rock = atmos(&["#3a322e", "#4e443e", "#665850", "#806e62", "#9c8876"], ph, 0.28);
    let grass = atmos(&["#2c4630", "#3a5a3c", "#4c7048", "#628656", "#7e9e68"], ph, 0.28);
    let land = atmos(&["#3e4a34", "#566444", "#6e7a52"], ph, 0.28);
    let (base, x0, xs, xr, crown) = (105.0, round(lwf * 0.40), round(lwf * 0.55), round(lwf * 0.86), 60.0);
    let n = xr as usize + 1;
    let mut tops = vec![0.0; n];
    for (ii, top) in tops.iter_mut().enumerate() {
        let i = ii as f64;
        let y = if i < x0 {
            base - 5.0 - round(vnoise(i * 0.06, 0.5, 21.0) * 2.0)
        } else if i < xs {
            let t = (i - x0) / (xs - x0);
            let e = t * t * (3.0 - 2.0 * t);
            base - 5.0 - (base - 5.0 - crown - 4.0) * pow(e, 1.15)
        } else if i > xr - 16.0 {
            let t = (i - (xr - 16.0)) / 16.0;
            crown + 2.0 + t * t * 34.0 + round((vnoise(i * 0.5, 2.5, 22.0) - 0.5) * 4.0)
        } else {
            let fade = clamp((i - xs) / 14.0, 0.0, 1.0);
            crown + round(((vnoise(i * 0.35, 1.5, 22.0) - 0.5) * 5.0 + if (ii as i64 * 13) % 7 == 0 { -2.0 } else { 0.0 }) * fade)
        };
        *top = round(y);
    }
    {
        let raw = tops.clone();
        let mut i = max(0.0, xs - 12.0);
        while i <= min(xr, xs + 10.0) {
            let (mut sum, mut cnt) = (0.0, 0.0);
            for k in -6..=6 {
                sum += raw[clamp(i + k as f64, 0.0, xr) as usize];
                cnt += 1.0;
            }
            tops[i as usize] = round(sum / cnt);
            i += 1.0;
        }
    }
    for (ii, &top) in tops.iter().enumerate() {
        let i = ii as f64;
        let side = (i - xs) / (xr - xs);
        let mut y = top;
        while y < base + 6.0 {
            let depth = y - top;
            let mut col;
            if i < xs {
                let far = clamp((x0 + 30.0 - i) / 120.0, 0.0, 1.0);
                let v =
                    0.62 - far * 0.16 + (if depth < 2.0 { 0.2 - far * 0.06 } else { 0.0 }) + (vnoise(i * 0.2, y * 0.35, 23.0) - 0.5) * 0.3
                        - if y > base - 6.0 { 0.18 } else { 0.0 };
                col = band(&grass, clamp(v, 0.0, 0.999));
                if far > 0.0 {
                    col = mix(col, land[1], far * 0.35);
                }
            } else {
                let fr = clamp((i - xs) / 18.0, 0.0, 1.0);
                let rockiness = clamp(
                    (if depth < 4.0 { 0.9 * fr } else { 0.0 }) + (side - 0.45) * 1.6 + (vnoise(i * 0.15, y * 0.12, 24.0) - 0.5) * 0.7 * fr,
                    0.0,
                    1.0,
                );
                let tex = (vnoise(i * 0.2, y * 0.35, 23.0) - 0.5) * 0.3;
                let gully = (vnoise(i * 0.18, y * 0.1, 25.0) - 0.5) * 0.14 * fr;
                let mut v = 0.62 - max(0.0, side) * 0.36 + (if depth < 2.0 { 0.18 } else { 0.0 }) + tex + gully
                    - if y > base - 6.0 { 0.18 } else { 0.0 };
                if rockiness > 0.55 {
                    if (y + round(vnoise(i * 0.05, 3.0, 26.0) * 3.0)) as i32 % 6 == 0 {
                        v -= 0.1;
                    } // 응회암 지층
                    if vnoise(i * 0.25, y * 0.06, 27.0) > 0.7 {
                        v -= 0.12;
                    } // 굽이진 골
                    col = band(&rock, clamp(v, 0.0, 0.999));
                } else {
                    col = band(&grass, clamp(v, 0.0, 0.999));
                }
            }
            if y >= base - 1.0 {
                col = mix(col, rock[0], 0.4);
            } // 물가 그늘
            c.px(i, y, col);
            y += 1.0;
        }
    }
    let mut i = xs + 10.0;
    while i < xr - 8.0 {
        if (i as i64 * 7) % 3 != 0 {
            c.px(i, tops[i as usize] + 2.0, rock[1]);
        }
        i += 1.0;
    } // 분화구 안쪽 그늘
    let mut i = xr - 2.0;
    while i < xr + 10.0 {
        let hh = 3.0 - (i - xr - 3.0).abs() / 3.0;
        let mut y = base - round(hh);
        while y < base + 6.0 {
            c.px(i, y, rock[if i < xr + 3.0 { 1 } else { 0 }]);
            y += 1.0;
        }
        i += 1.0;
    } // 절벽 발치 바위
    (c, format!("\"cx\":{},\"top\":{}", num(round((xs + xr) / 2.0)), num(crown)))
}
pub fn sea(ph: &Phase, emerald: bool) -> Canvas {
    let lw = layer_w(L_FIELD);
    let lwf = lw as f64;
    let mut c = Canvas::new(lw, 140);
    let mut r = rng(71.0);
    let top = 104.0;
    let cols = if emerald {
        atmos(&["#1e7a8a", "#2a9aa0", "#4ac0b4", "#86dcc8", "#c8f4e4"], ph, 0.12)
    } else {
        atmos(&["#1a4a8a", "#2462a8", "#3a82c4", "#6aaedc", "#a8d8f0"], ph, 0.12)
    };
    let mut y = top;
    while y < 140.0 {
        for i in 0..lw {
            let i = i as f64;
            let f2 = (y - top + (vnoise(i * 0.045, y * 0.08, 72.0) - 0.5) * 3.0) / 36.0;
            c.px(i, y, band(&cols, clamp(if emerald { f2 * 1.1 } else { 1.0 - f2 * 1.15 }, 0.0, 0.999)));
        }
        y += 1.0;
    }
    let white = atmo(hx("#ffffff"), ph, 0.1);
    for _ in 0..70 {
        let yy = top + 2.0 + (pow(r.next(), 1.6) * 32.0).floor();
        let x = (r.next() * lwf).floor();
        let w = 2.0 + (r.next() * 4.0).floor();
        c.fill(x, yy, w, 1.0, white);
    }
    if emerald {
        let ix = round(lwf * 0.68); // 비양도: 낮고 평평한 섬 + 한쪽에 작은 봉우리
        for i in -34..=34 {
            let i = i as f64;
            let t = i / 34.0;
            let flat = round(3.0 * max(0.0, 1.0 - t * t).sqrt());
            let cone = max(0.0, 8.0 - (i - 10.0).abs() * 0.7);
            let yy = top - flat - round(cone);
            c.fill(ix + i, yy, 1.0, top - yy + 1.0, atmo(hx(if i < 10.0 { "#4e7a5e" } else { "#3e6a4e" }), ph, 0.35));
            if cone > 1.0 && i < 10.0 {
                c.px(ix + i, yy, atmo(hx("#6a9a72"), ph, 0.35));
            }
        }
        for _ in 0..14 {
            // 얕은 바다의 검은 현무암 암초
            let rx = (r.next() * lwf).floor();
            let ry = top + 22.0 + (r.next() * 12.0).floor();
            let rw = 4.0 + (r.next() * 10.0).floor();
            let mut i = 0.0;
            while i < rw {
                c.fill(
                    rx + i,
                    ry + if i as i32 % 4 == 0 { 1.0 } else { 0.0 },
                    1.0,
                    1.0 + if i > 1.0 && i < rw - 2.0 { 1.0 } else { 0.0 },
                    atmo(hx(if i as i32 % 3 != 0 { "#2a4a52" } else { "#1e3a44" }), ph, 0.1),
                );
                i += 1.0;
            }
        }
    }
    // 등대 (빨간 등대 + 방파제)
    let lx = round(lwf * 0.12);
    c.fill(lx - 30.0, top + 9.0, 46.0, 3.0, atmo(hx("#3a3a46"), ph, 0.15));
    for y in 0..18 {
        let y = y as f64;
        let cc = atmo(hx(if (y as i32) % 6 < 3 { "#e8403a" } else { "#f4f0e8" }), ph, 0.12);
        c.fill(lx - 2.0, top + 9.0 - y, 5.0, 1.0, cc);
        c.px(lx + 2.0, top + 9.0 - y, mix(cc, INK, 0.3));
    }
    c.fill(lx - 3.0, top - 10.0, 7.0, 2.0, atmo(hx("#3a3a46"), ph, 0.15));
    c.fill(lx - 1.0, top - 12.0, 3.0, 2.0, atmo(hx("#ffe9a0"), ph, 0.0));
    // 고깃배
    let bx = round(lwf * 0.42);
    let hull = atmo(hx("#f2ede4"), ph, 0.15);
    let hd = mix(hull, INK, 0.3);
    c.fill(bx, top + 4.0, 12.0, 2.0, hull);
    c.fill(bx + 3.0, top + 1.0, 4.0, 3.0, hull);
    c.fill(bx + 11.0, top + 4.0, 1.0, 2.0, hd);
    c.fill(bx + 6.0, top + 1.0, 1.0, 3.0, hd);
    c.fill(bx, top + 6.0, 12.0, 1.0, atmo(hx("#3a6ac8"), ph, 0.15));
    for k in 0..5 {
        // 물에 뜬 해녀 테왁
        let tx = round(lwf * (0.55 + k as f64 * 0.08)) + (r.next() * 8.0).floor();
        let ty = top + 14.0 + (r.next() * 12.0).floor();
        c.fill(tx, ty, 2.0, 2.0, atmo(hx("#ff8a1a"), ph, 0.05));
        c.fill(tx - 1.0, ty + 2.0, 4.0, 1.0, atmo(hx("#ffffff"), ph, 0.1));
    }
    c
}
pub fn coast_near(ph: &Phase, sand: bool) -> (Canvas, String) {
    let lw = layer_w(L_NEAR);
    let lwf = lw as f64;
    let mut c = Canvas::new(lw, 160);
    let mut r = rng(9.0);
    let a = |k: &str| atmo(hx(k), ph, 0.05);
    let st = atmos(&["#16141c", "#24222e", "#36343f", "#4e4b58", "#6e6a7a"], ph, 0.05);
    let l: Vec<Col> = ctx().pal.leaf.iter().map(|&k| atmo(k, ph, 0.05)).collect();
    let moss = atmos(&["#2e4424", "#46652a", "#6a8a34", "#94ae48"], ph, 0.05);
    let mut mask = vec![0u8; lw as usize];
    let cover = |mask: &mut Vec<u8>, x0: f64, w: f64| {
        let mut k = max(0.0, x0);
        while k < min(lwf, x0 + w) {
            mask[k as usize] = 1;
            k += 1.0;
        }
    }; // 파도 거품이 바위 위로 지나가지 않게
    for i in 0..lw {
        let i = i as f64;
        let y = 138.0 + round((vnoise(i * 0.09, 0.5, 77.0) - 0.5) * 4.0);
        c.fill(i, y, 1.0, 2.0, a("#e8f6ff"));
        c.px(i, y + 2.0, a("#9ad0ec"));
    } // 파도 거품 띠
    let sand_cols = if sand { ["#e8d8b4", "#f6ead0", "#d8c49c"] } else { ["#3a3440", "#4a4452", "#2c2832"] };
    c.fill(0.0, 141.0, lwf, 20.0, a(sand_cols[0]));
    for k in 0..200 {
        let (x, y) = ((r.next() * lwf).floor(), 142.0 + (r.next() * 14.0).floor());
        c.fill(x, y, 2.0, 1.0, a(sand_cols[1 + k % 2]));
    }
    let rock = |c: &mut Canvas, r: &mut crate::noise::Rng, mask: &mut Vec<u8>, rx: f64, ry: f64, w: f64, hh: f64| {
        let mut pb = Pb::new((w + 2.0) as i32, (hh + 2.0) as i32);
        for yy in 1..=hh as i32 {
            for xx in 1..=w as i32 {
                let (xf, yf) = (xx as f64, yy as f64);
                let nx = (xf - (w + 1.0) / 2.0) / (w / 2.0);
                let ny = (yf - (hh + 1.0) / 2.0) / (hh / 2.0);
                if pow(nx.abs(), 1.6) + pow(ny.abs(), 1.4) > 0.82 + 0.24 * vnoise(xf * 0.35, yf * 0.35, rx + 71.0) {
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
            let px = 1.0 + (r.next() * w).floor();
            let py = 1.0 + (r.next() * hh).floor();
            if pb.get(px, py).is_some() && pb.get(px, py + 1.0).is_some() {
                pb.set(px, py, st[0]);
                pb.set(px, py + 1.0, st[3]);
            }
            k += 1.0;
        }
        if !sand {
            for yy in 0..(hh + 2.0) as i32 {
                for xx in 0..(w + 2.0) as i32 {
                    // 성산 쪽 해안: 바위 윗면에 초록 이끼
                    let (xf, yf) = (xx as f64, yy as f64);
                    if pb.get(xf, yf).is_some()
                        && (pb.get(xf, yf - 1.0).is_none() || pb.get(xf, yf - 2.0).is_none())
                        && hash2(xf + rx, yf, 41.0) < 0.8
                    {
                        pb.set(
                            xf,
                            yf,
                            moss[if pb.get(xf, yf - 1.0).is_none() {
                                if xf < (w + 2.0) * 0.6 {
                                    3
                                } else {
                                    2
                                }
                            } else {
                                1
                            }],
                        );
                    }
                }
            }
        }
        c.draw(&pb.sel_out(0.5).canvas(), rx, ry);
        if ry + hh + 2.0 >= 136.0 {
            cover(mask, rx, w + 2.0);
        }
    };
    if !sand {
        // 광치기 해변: 이끼 덮인 평평한 암반 · 하늘을 비추는 물웅덩이
        let mut i = 0.0;
        while i < lwf {
            let w = 30.0 + (r.next() * 46.0).floor();
            let y0 = 133.0 + (r.next() * 6.0).floor();
            let mut xx = 0.0;
            while xx < w {
                let top = y0 + round(sin((i + xx) * 0.09) * 1.5) + if xx < 3.0 || xx > w - 4.0 { 1.0 } else { 0.0 };
                let mut yy = top;
                while yy < 142.0 {
                    let d = yy - top;
                    let mut col = if d == 0.0 {
                        moss[if xx < w * 0.55 { 3 } else { 2 }]
                    } else if d < 3.0 {
                        moss[if hash2(i + xx, yy, 42.0) < 0.3 { 1 } else { 2 }]
                    } else if d < 5.0 {
                        moss[0]
                    } else {
                        st[1]
                    };
                    if hash2(i + xx, yy, 43.0) < 0.04 && d > 0.0 {
                        col = st[1];
                    } // 바위 틈
                    c.px(i + xx, yy, col);
                    yy += 1.0;
                }
                xx += 1.0;
            }
            cover(&mut mask, i, w);
            if r.next() < 0.6 {
                let px = i + 6.0 + (r.next() * (w - 18.0)).floor();
                let pw = 6.0 + (r.next() * 8.0).floor();
                let py = y0 + 2.0;
                c.fill(px - 1.0, py, pw + 2.0, 2.0, st[0]);
                c.fill(px, py, pw, 1.0, a("#a8c8d8"));
                c.fill(px + 1.0, py, max(1.0, (pw as i32 >> 2) as f64), 1.0, a("#d8ecf4"));
            }
            i += w + 4.0 + (r.next() * 20.0).floor();
        }
    }
    let mut i = 0.0;
    while i < lwf {
        let (ry, w, hh) = (128.0 + (r.next() * 8.0).floor(), 14.0 + (r.next() * 16.0).floor(), 9.0 + (r.next() * 6.0).floor());
        rock(&mut c, &mut r, &mut mask, i, ry, w, hh);
        i += 26.0 + (r.next() * 30.0).floor();
    }
    // 불턱: 뒷줄은 작고 높게, 앞줄은 크고 낮게, 사이로 불씨
    let bx = round(lwf * 0.55);
    for k in 0..8 {
        let kf = k as f64;
        rock(&mut c, &mut r, &mut mask, bx - 24.0 + kf * 6.0 + (k % 2) as f64, 127.0 + if k == 0 || k == 7 { 2.0 } else { 0.0 }, 7.0, 5.0);
    }
    c.fill(bx - 2.0, 130.0, 3.0, 2.0, a("#ff9a3a"));
    c.px(bx - 1.0, 129.0, a("#ffd84a"));
    for k in 0..6 {
        let kf = k as f64;
        rock(&mut c, &mut r, &mut mask, bx - 22.0 + kf * 8.0 + (k % 2) as f64, 131.0 + if k == 0 || k == 5 { 1.0 } else { 0.0 }, 9.0, 6.0);
    }
    let pine = |c: &mut Canvas, px: f64, top: f64| {
        c.fill(px, top + 10.0, 2.0, 140.0 - top - 10.0, a("#5a3e2a"));
        for yy in 0..18 {
            let yf = yy as f64;
            let hw = round((3.0 + yf * 0.3) * (0.65 + 0.35 * vnoise(yf * 0.45, px, 8.0)));
            let mut xx = -hw;
            while xx <= hw {
                c.px(
                    px + xx,
                    top + yf,
                    if xx < 0.0 && yy % 5 < 2 {
                        l[2]
                    } else if yy % 5 == 4 {
                        l[0]
                    } else {
                        l[1]
                    },
                );
                xx += 1.0;
            }
        }
    };
    if sand {
        pine(&mut c, round(lwf * 0.2), 96.0);
        pine(&mut c, round(lwf * 0.82), 92.0);
        pine(&mut c, round(lwf * 0.88), 100.0);
    } else {
        pine(&mut c, round(lwf * 0.86), 98.0);
    }
    (c, format!("\"foamMask\":[{}]", mask.iter().map(|v| v.to_string()).collect::<Vec<_>>().join(",")))
}

// buildTheme: 기본 테마(밭 · 성산 · 협재)의 한 시간대
pub fn theme(kind: &str, pi: usize) {
    let ph = &ctx().phases[pi];
    out_push("sky", sky(ph), String::new());
    if kind == "coast" {
        let (c, m) = seongsan(ph);
        out_push("halla", c, m);
    } else {
        let (c, m) = halla(ph);
        out_push("halla", c, m);
    }
    if kind == "coast" {
        out_empty("oreum", L_OREUM, 140);
    } else {
        out_push("oreum", oreum(ph), String::new());
    }
    out_push("field", if kind == "field" { fields(ph) } else { sea(ph, kind == "beach") }, String::new());
    if kind == "field" {
        out_push("near", near(ph), String::new());
    } else {
        let (c, m) = coast_near(ph, kind == "beach");
        out_push("near", c, m);
    }
    out_push("ground", ground_theme(ph, kind), String::new());
    out_push("front", front(ph), String::new());
}
