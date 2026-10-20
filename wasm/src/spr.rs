// 캐릭터 · 적 · 소품 스프라이트 (원래 chars.js · game.js · boss.js의 PB 그림)
//  결과는 트리(JSON)로: 캔버스는 {"$":번호, ax, ay …}, 좌우 한 쌍은 {"r":…, "l":…}
//  난수 · 반올림 · 색 비교까지 원래 JS 그대로 (픽셀이 같게)
use crate::js::*;
use crate::noise::{hash2, vnoise};
use crate::scene::*;

const D2R: f64 = PI / 180.0;
fn limb_end(x: f64, y: f64, len: f64, deg: f64) -> (f64, f64) {
    (x + sin(deg * D2R) * len, y + cos(deg * D2R) * len)
}
fn pal(k: &str) -> Vec<Col> {
    ctx().pal.c(k).to_vec()
}
fn mutes(v: &[&str]) -> Vec<Col> {
    v.iter().map(|s| mute(hx(s), 0.86)).collect()
}
fn m(s: &str) -> Col {
    mute(hx(s), 0.86)
}
fn arr(v: Vec<String>) -> String {
    format!("[{}]", v.join(","))
}
fn obj(v: &[(&str, String)]) -> String {
    format!("{{{}}}", v.iter().map(|(k, x)| format!("\"{}\":{}", k, x)).collect::<Vec<_>>().join(","))
}
// framePair: 오른쪽 그림 + 뒤집은 왼쪽 그림 (기준점도 뒤집음)
fn pair_c(c: Canvas, ax: f64, ay: f64, rx: &str, lx: &str) -> String {
    let l = c.flip();
    let w = c.w as f64;
    let (pr, pl) =
        (format!("\"ax\":{},\"ay\":{}{}", num(ax), num(ay), rx), format!("\"ax\":{},\"ay\":{}{}", num(w - 1.0 - ax), num(ay), lx));
    obj(&[("r", cv(c, &pr)), ("l", cv(l, &pl))])
}
fn pair(pb: &Pb, ax: f64, ay: f64) -> String {
    pair_c(pb.canvas(), ax, ay, "", "")
}
// litPair: 왼쪽 그림은 빛도 좌우를 뒤집어 다시 그린 것
fn lit_pair(make: impl Fn() -> (Canvas, f64, f64)) -> String {
    let (r, ax, ay) = make();
    light_flip(true);
    let (lc, _, _) = make();
    light_flip(false);
    let l = lc.flip();
    let w = r.w as f64;
    obj(&[
        ("r", cv(r, &format!("\"ax\":{},\"ay\":{}", num(ax), num(ay)))),
        ("l", cv(l, &format!("\"ax\":{},\"ay\":{}", num(w - 1.0 - ax), num(ay)))),
    ])
}
fn rl(c: Canvas) -> String {
    let l = c.flip();
    obj(&[("r", cv(c, "")), ("l", cv(l, ""))])
}
// 다각형 안 (칸 가운데 기준 홀짝 규칙)
fn in_poly(p: &[(f64, f64)], x: f64, y: f64) -> bool {
    let mut c = false;
    let n = p.len();
    let mut j = n - 1;
    for i in 0..n {
        let ((xi, yi), (xj, yj)) = (p[i], p[j]);
        if (yi > y) != (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi {
            c = !c;
        }
        j = i;
    }
    c
}

// ═════════ 숨비 (새내기 해녀) ═════════
#[derive(Clone)]
struct Pose {
    crouch: f64,
    bob: f64,
    lean: f64,
    head_x: f64,
    head_y: f64,
    arm_f: (f64, f64),
    arm_b: (f64, f64),
    leg_f: (f64, f64),
    leg_b: (f64, f64),
    eyes: &'static str,
    mouth: &'static str,
    leaf: f64,
}
fn base_pose() -> Pose {
    Pose {
        crouch: 0.0,
        bob: 0.0,
        lean: 0.0,
        head_x: 0.0,
        head_y: 0.0,
        arm_f: (10.0, -20.0),
        arm_b: (-10.0, -20.0),
        leg_f: (6.0, 0.0),
        leg_b: (-6.0, 0.0),
        eyes: "open",
        mouth: "",
        leaf: 0.0,
    }
}
fn gyul_head(pb: &mut Pb, ox: f64, oy: f64, o: &Pose) {
    let (s, u) = (pal("skin"), pal("suit"));
    pb.ellipse(ox + 7.0, oy + 6.6, 6.4, 6.6, |nx, ny| {
        let v = sphere_light(nx, ny);
        Some(
            u[if v < 0.3 {
                0
            } else if v < 0.5 {
                1
            } else if v < 0.72 {
                2
            } else {
                3
            }],
        )
    });
    pb.ellipse(ox + 8.4, oy + 8.6, 4.3, 4.1, |nx, ny| {
        Some(if nx < -0.5 {
            s[2]
        } else if nx > 0.55 || ny > 0.55 {
            s[1]
        } else {
            s[2]
        })
    });
    for x in 4..=12 {
        let x = x as f64;
        if let Some(c) = pb.get(ox + x, oy + 12.0) {
            if u.contains(&c) {
                pb.set(ox + x, oy + 12.0, pal("org")[1]);
            }
        }
    }
    let e = INK;
    let eye = |pb: &mut Pb, ex: f64| {
        if o.eyes == "x" {
            pb.set(ox + ex, oy + 8.0, e);
            pb.set(ox + ex + 1.0, oy + 9.0, e);
            return;
        }
        if o.eyes == "blink" || o.eyes == "squint" || o.eyes == "happy" {
            pb.set(ox + ex, oy + 9.0, e);
            pb.set(ox + ex + 1.0, oy + 9.0, s[0]);
            return;
        }
        pb.set(ox + ex, oy + 8.0, s[0]);
        pb.set(ox + ex, oy + 9.0, e);
    };
    eye(pb, 7.0);
    eye(pb, 10.0);
    if o.mouth == "o" || o.mouth == "grit" {
        pb.set(ox + 9.0, oy + 11.0, pal("red")[0]);
    } else {
        pb.set(ox + 8.0, oy + 11.0, s[0]);
        pb.set(ox + 9.0, oy + 11.0, s[0]);
    }
    for x in 1..=13 {
        let x = x as f64;
        if pb.get(ox + x, oy + 4.0).is_some() {
            pb.set(ox + x, oy + 4.0, u[0]);
        }
    }
    let (st, bl) = (pal("stone"), pal("blue"));
    pb.ellipse(ox + 8.0, oy + 3.4, 3.6, 2.4, |nx, ny| {
        Some(if hypot(nx, ny) > 0.7 {
            st[2]
        } else if nx + ny < -0.6 {
            st[3]
        } else {
            bl[1]
        })
    });
    pb.set(ox + 4.0 - o.leaf, oy, u[2]);
}
fn gyul_torso(pb: &mut Pb, x: f64, y: f64) {
    let (u, o, st) = (pal("suit"), pal("org"), pal("stone"));
    for j in 0..9 {
        for i in 0..10 {
            if (j == 0 || j > 5) && (i == 0 || i == 9) {
                continue;
            }
            let mut c = if i <= 1 {
                u[3]
            } else if i >= 8 {
                u[1]
            } else {
                u[2]
            };
            if i == 2 && j > 0 {
                c = o[2];
            }
            if j == 0 {
                c = if i >= 7 { u[2] } else { u[3] };
            }
            pb.set(x + i as f64, y + j as f64, c);
        }
    }
    for i in 0..10 {
        pb.set(x + i as f64, y + 8.0, if i == 3 || i == 4 { st[3] } else { st[1] });
    } // 납 허리띠
    for j in 9..12 {
        for i in 0..10 {
            if j == 11 && (i == 4 || i == 5) {
                continue;
            }
            pb.set(
                x + i as f64,
                y + j as f64,
                if i >= 8 {
                    u[0]
                } else if i <= 1 {
                    u[3]
                } else {
                    u[1]
                },
            );
        }
    }
}
fn gyul_arm(pb: &mut Pb, sx: f64, sy: f64, up: f64, fore: f64, back: bool) {
    let (u, cl) = (pal("suit"), pal("cloth"));
    let (ex, ey) = limb_end(sx, sy, 4.0, up);
    let (hx_, hy) = limb_end(ex, ey, 4.0, up + fore);
    pb.limb(sx, sy, ex, ey, 3.0, if back { u[1] } else { u[3] });
    pb.limb(ex, ey, hx_, hy, 2.0, if back { u[0] } else { u[2] });
    pb.rect(round(hx_ - 1.0), round(hy - 1.0), 3.0, 3.0, if back { cl[1] } else { cl[3] }); // 흰 면장갑
    if !back {
        pb.set(round(hx_ + 1.0), round(hy + 1.0), cl[2]);
    }
}
fn gyul_leg(pb: &mut Pb, hx_: f64, hy: f64, thigh: f64, shin: f64, back: bool) {
    let (u, o) = (pal("suit"), pal("org"));
    let (kx, ky) = limb_end(hx_, hy, 4.0, thigh);
    let (fx, fy) = limb_end(kx, ky, 5.0, shin);
    pb.limb(hx_, hy, kx, ky, 3.0, if back { u[0] } else { u[2] });
    pb.limb(kx, ky, fx, fy, 2.0, if back { u[0] } else { u[2] });
    let (sx, sy) = (round(fx) - 1.0, round(fy) + 1.0);
    pb.rect(sx, sy - 1.0, 3.0, 1.0, if back { u[1] } else { u[3] });
    pb.rect(sx, sy, 5.0, 1.0, if back { u[0] } else { u[2] });
    pb.rect(sx, sy + 1.0, 5.0, 1.0, if back { o[0] } else { o[2] }); // 주황 고무 밑창
}
const PW: i32 = 36;
const PH: i32 = 50;
const PAX: f64 = 18.0;
const PAY: f64 = 47.0;
fn gyul_pose(p: &Pose) -> String {
    let mut pb = Pb::new(PW, PH);
    let hip_y = 35.0 + p.crouch + p.bob;
    let (tx, ty) = (13.0 + p.lean, hip_y - 11.0);
    gyul_arm(&mut pb, tx + 2.0, ty + 2.0, p.arm_b.0, p.arm_b.1, true);
    gyul_leg(&mut pb, tx + 3.0, hip_y, p.leg_b.0, p.leg_b.1, true);
    gyul_torso(&mut pb, tx, ty);
    gyul_leg(&mut pb, tx + 6.0, hip_y, p.leg_f.0, p.leg_f.1, false);
    gyul_head(&mut pb, tx - 2.0 + p.head_x, ty - 12.0 + p.head_y, p);
    gyul_arm(&mut pb, tx + 8.0, ty + 2.0, p.arm_f.0, p.arm_f.1, false);
    let nx = tx + 3.0 - PAX;
    let ny = ty + 1.0 - PAY;
    pair_c(
        pb.sel_out(0.72).canvas(),
        PAX,
        PAY,
        &format!(",\"neck\":[{},{}]", num(nx), num(ny)),
        &format!(",\"neck\":[{},{}]", num(-nx), num(ny)),
    )
}
// 구르기 · 공중제비: 몸을 만 공을 각도별로
fn gyul_ball(theta: f64) -> String {
    let mut pb = Pb::new(PW, PH);
    let (cx, cy, r) = (18.0, PAY - 9.0, 8.2);
    let (sk, org, su, st, bl) = (pal("skin"), pal("org"), pal("suit"), pal("stone"), pal("blue"));
    let mut y = cy - 10.0;
    while y <= cy + 10.0 {
        for x in 8..=28 {
            let x = x as f64;
            let dx = x + 0.5 - cx;
            let dy = y + 0.5 - cy;
            let d = hypot(dx, dy);
            if d > r {
                continue;
            }
            let v = sphere_light(dx / r, dy / r);
            let u = dx * cos(theta) + dy * sin(theta);
            let q = -dx * sin(theta) + dy * cos(theta);
            let face = pow((u - 4.7) / 2.8, 2.0) + pow((q - 1.0) / 3.3, 2.0) < 1.0;
            let sole = pow((u + 1.0) / 4.0, 2.0) + pow((q - 5.0) / 1.6, 2.0) < 1.0;
            pb.set(
                x,
                y,
                if face {
                    sk[if v < 0.5 { 1 } else { 2 }]
                } else if sole {
                    org[1]
                } else {
                    su[if v < 0.35 {
                        0
                    } else if v < 0.6 {
                        1
                    } else if v < 0.8 {
                        2
                    } else {
                        3
                    }]
                },
            );
        }
        y += 1.0;
    }
    let (ex, ey) = (cx + cos(theta + 0.25) * 4.6, cy + sin(theta + 0.25) * 4.6);
    pb.set(ex, ey, INK);
    pb.set(ex + cos(theta + 1.8), ey + sin(theta + 1.8), INK);
    let (lx, ly) = (cx + cos(theta - 0.55) * 6.2, cy + sin(theta - 0.55) * 6.2);
    pb.set(lx, ly, st[3]);
    pb.set(lx + cos(theta + PI / 2.0), ly + sin(theta + PI / 2.0), bl[1]);
    pair(&pb.sel_out(0.72), PAX, PAY)
}
fn gyul() -> String {
    let b = base_pose();
    let p = |f: &dyn Fn(&mut Pose)| {
        let mut q = b.clone();
        f(&mut q);
        gyul_pose(&q)
    };
    let idle: Vec<String> = [0.0, 0.0, 1.0, 1.0]
        .iter()
        .enumerate()
        .map(|(i, &bb)| {
            p(&|q| {
                q.head_y = bb;
                q.arm_f = (8.0 + bb * 4.0, -15.0);
                q.arm_b = (-8.0 - bb * 4.0, -15.0);
                q.leaf = if i < 2 { 0.0 } else { 1.0 };
            })
        })
        .collect();
    let (mut run, mut tr0, mut tr1) = (vec![], vec![], vec![]);
    for i in 0..8 {
        let t = i as f64 / 8.0 * PI * 2.0;
        let leg = |q: f64| {
            let th = 40.0 * sin(q);
            let bend = 75.0 * max(0.0, cos(q));
            (th, th - bend)
        };
        let mut pose = b.clone();
        pose.lean = 1.0;
        pose.bob = if i % 4 == 1 || i % 4 == 2 { -1.0 } else { 0.0 };
        pose.leaf = -1.0;
        pose.leg_f = leg(t);
        pose.leg_b = leg(t + PI);
        pose.arm_f = (-55.0 * sin(t), 80.0);
        pose.arm_b = (55.0 * sin(t), 80.0);
        run.push(gyul_pose(&pose));
        let mut a = pose.clone();
        a.arm_f = (-150.0, -30.0);
        a.arm_b = (40.0, -20.0);
        tr0.push(gyul_pose(&a));
        let mut c = pose.clone();
        c.arm_f = (95.0, 0.0);
        c.arm_b = (-60.0, 20.0);
        tr1.push(gyul_pose(&c));
    }
    let blink = p(&|q| q.eyes = "blink");
    let up = p(&|q| {
        q.leg_f = (55.0, -10.0);
        q.leg_b = (-15.0, -55.0);
        q.arm_f = (160.0, 10.0);
        q.arm_b = (-150.0, -10.0);
        q.leaf = -1.0;
        q.mouth = "grin";
    });
    let apex = p(&|q| {
        q.leg_f = (35.0, -30.0);
        q.leg_b = (10.0, -50.0);
        q.arm_f = (100.0, 20.0);
        q.arm_b = (-100.0, -20.0);
        q.leaf = 1.0;
    });
    let fall = p(&|q| {
        q.leg_f = (18.0, 5.0);
        q.leg_b = (-12.0, 0.0);
        q.arm_f = (135.0, 0.0);
        q.arm_b = (-135.0, 0.0);
        q.leaf = 1.0;
        q.mouth = "o";
    });
    let land = p(&|q| {
        q.crouch = 2.0;
        q.leg_f = (40.0, -25.0);
        q.leg_b = (-25.0, 15.0);
        q.arm_f = (45.0, -30.0);
        q.arm_b = (-45.0, 30.0);
        q.leaf = 1.0;
        q.eyes = "squint";
    });
    let skid = p(&|q| {
        q.lean = -1.0;
        q.leg_f = (35.0, 35.0);
        q.leg_b = (-25.0, -10.0);
        q.arm_f = (-30.0, 60.0);
        q.arm_b = (-70.0, 40.0);
        q.eyes = "squint";
        q.mouth = "grit";
    });
    let th0 = p(&|q| {
        q.lean = -1.0;
        q.arm_f = (-150.0, -30.0);
        q.arm_b = (40.0, -20.0);
        q.leg_f = (20.0, 0.0);
        q.leg_b = (-20.0, 0.0);
        q.eyes = "squint";
        q.mouth = "grit";
    });
    let th1 = p(&|q| {
        q.lean = 2.0;
        q.arm_f = (95.0, 0.0);
        q.arm_b = (-60.0, 20.0);
        q.leg_f = (25.0, -5.0);
        q.leg_b = (-25.0, 5.0);
        q.mouth = "grin";
    });
    let hurt = p(&|q| {
        q.head_x = -1.0;
        q.leg_f = (25.0, -10.0);
        q.leg_b = (-35.0, -20.0);
        q.arm_f = (150.0, 20.0);
        q.arm_b = (-160.0, -20.0);
        q.eyes = "x";
        q.mouth = "o";
        q.leaf = 1.0;
    });
    let win = p(&|q| {
        q.arm_f = (170.0, 0.0);
        q.arm_b = (-170.0, 0.0);
        q.eyes = "happy";
        q.mouth = "grin";
        q.leaf = 1.0;
    });
    let roll: Vec<String> = (0..8).map(|i| gyul_ball(i as f64 / 8.0 * PI * 2.0)).collect();
    obj(&[
        ("idle", arr(idle)),
        ("run", arr(run)),
        ("throwRun", arr(vec![arr(tr0), arr(tr1)])),
        ("blink", blink),
        ("up", up),
        ("apex", apex),
        ("fall", fall),
        ("land", land),
        ("skid", skid),
        ("throw", arr(vec![th0, th1])),
        ("hurt", hurt),
        ("win", win),
        ("roll", arr(roll)),
    ])
}

// ═════════ 돌하르방 ═════════
struct Spec {
    w: f64,
    h: f64,
    seed: f64,
    dome_w: f64,
    brim_w: f64,
    head_w: f64,
    body_w: f64,
    brim: (f64, f64),
    head: (f64, f64),
    body0: f64,
    eye_y: f64,
    eye_dx: f64,
    nose: (f64, f64),
    nose_w: (f64, f64),
    mouth_y: f64,
    mouth_w: f64,
    hands: Vec<(f64, f64, f64, f64)>,
    pits: i32,
}
fn hareubang(sp: &Spec) -> Canvas {
    let (ww, hh) = ((sp.w + 4.0) as i32, (sp.h + 3.0) as i32);
    let mut pb = Pb::new(ww, hh);
    let cx = ww as f64 / 2.0;
    let st = pal("stone");
    let hw = |y: f64| {
        if y < sp.brim.0 {
            let t = (sp.brim.0 - y) / (sp.brim.0 + 0.8);
            return sp.dome_w * max(0.0, 1.0 - t * t).sqrt();
        }
        if y <= sp.brim.1 {
            return sp.brim_w;
        }
        if y <= sp.head.1 {
            return sp.head_w + if y > sp.head.0 + 4.0 && y < sp.head.1 - 2.0 { 0.5 } else { 0.0 };
        }
        if y < sp.body0 {
            return sp.head_w - 1.0;
        }
        sp.body_w + (y - sp.body0) / (sp.h - sp.body0) * 1.5
    };
    let tone = |v: f64| {
        if v < 0.28 {
            0
        } else if v < 0.45 {
            1
        } else if v < 0.62 {
            2
        } else if v < 0.8 {
            3
        } else {
            4
        }
    };
    let mut y = 0.0;
    while y < sp.h {
        let w = hw(y);
        let mut x = (cx - w).floor();
        while x < (cx + w).ceil() {
            let nx = (x + 0.5 - cx) / w;
            if nx.abs() <= 1.0 {
                let mut ny = -0.1;
                if y < sp.brim.0 {
                    ny = -(sp.brim.0 - y) / (sp.brim.0 + 1.0) * 0.9;
                }
                let mut v = sphere_light(nx * 0.97, ny) - 0.1;
                if y == sp.brim.0 {
                    v += 0.15;
                }
                if y == sp.brim.1 {
                    v -= 0.35;
                }
                if y > sp.brim.1 && y <= sp.brim.1 + 2.0 {
                    v -= 0.22;
                } // 챙 그늘
                if y >= sp.body0 - 1.0 && y <= sp.body0 {
                    v -= 0.18;
                } // 턱 밑 그늘
                pb.set(x, y + 1.0, st[tone(v)]);
            }
            x += 1.0;
        }
        y += 1.0;
    }
    let pp = |fx: f64, fy: f64| (round(cx + fx - 0.5), fy + 1.0);
    let get = |pb: &Pb, fx: f64, fy: f64| {
        let (x, y) = pp(fx, fy);
        pb.get(x, y)
    };
    let put = |pb: &mut Pb, fx: f64, fy: f64, k: i32| {
        let (x, y) = pp(fx, fy);
        if pb.get(x, y).is_some() {
            pb.set(x, y, st[k as usize]);
        }
    };
    let shift = |pb: &mut Pb, fx: f64, fy: f64, d: i32| {
        if let Some(c) = get(pb, fx, fy) {
            let i = st.iter().position(|&q| q == c).map(|p| p as i32).unwrap_or(-1);
            put(pb, fx, fy, (i + d).clamp(0, 4));
        }
    };
    let mut r = rng(sp.seed);
    for _ in 0..sp.pits {
        // 현무암 구멍
        let fy = (r.next() * (sp.h - 2.0)).floor();
        let fx = ((r.next() - 0.5) * hw(fy) * 1.7).floor();
        if get(&pb, fx, fy).is_none() || get(&pb, fx + 1.0, fy).is_none() || (fy >= sp.eye_y - 1.0 && fy <= sp.mouth_y + 1.0) {
            continue;
        }
        shift(&mut pb, fx, fy, -1);
        shift(&mut pb, fx + 1.0, fy, -1);
    }
    for sx in [-sp.eye_dx, sp.eye_dx] {
        for dx in -2..=2 {
            let dx = dx as f64;
            put(&mut pb, sx + dx, sp.eye_y - 1.0, 2);
            put(&mut pb, sx + dx, sp.eye_y, 1);
        }
    } // 깊게 판 눈
    let mut fy = sp.nose.0;
    while fy <= sp.nose.1 {
        // 크고 넓적한 주먹코
        let t = (fy - sp.nose.0) / (sp.nose.1 - sp.nose.0);
        let half = round(sp.nose_w.0 + (sp.nose_w.1 - sp.nose_w.0) * t * t);
        let mut dx = -half;
        while dx <= half {
            put(
                &mut pb,
                dx,
                fy,
                if dx < -half / 2.0 {
                    4
                } else if dx <= 0.0 {
                    3
                } else if dx < half {
                    2
                } else {
                    1
                },
            );
            dx += 1.0;
        }
        fy += 1.0;
    }
    let nb = sp.nose.1;
    put(&mut pb, -sp.nose_w.1 + 1.0, nb, 0);
    put(&mut pb, sp.nose_w.1 - 1.0, nb, 0);
    let mut dx = -sp.nose_w.1;
    while dx <= sp.nose_w.1 {
        put(&mut pb, dx, nb + 1.0, 1);
        dx += 1.0;
    }
    let mut dx = -sp.mouth_w;
    while dx <= sp.mouth_w {
        put(&mut pb, dx, sp.mouth_y, 0);
        dx += 1.0;
    } // 꾹 다문 입
    put(&mut pb, -sp.mouth_w - 1.0, sp.mouth_y - 1.0, 0);
    put(&mut pb, sp.mouth_w + 1.0, sp.mouth_y - 1.0, 0);
    for &(fy, x0, x1, th) in &sp.hands {
        // 손 (띠 모양 + 손가락 홈)
        let mut fx = x0;
        while fx <= x1 {
            if get(&pb, fx, fy).is_some() {
                put(&mut pb, fx, fy - 1.0, 1);
                let mut k = 0.0;
                while k < th {
                    put(
                        &mut pb,
                        fx,
                        fy + k,
                        if k == 0.0 {
                            4
                        } else if fx > sp.body_w * 0.5 {
                            2
                        } else {
                            3
                        },
                    );
                    k += 1.0;
                }
                put(&mut pb, fx, fy + th, 0);
            }
            fx += 1.0;
        }
        let tip = if x1 > 0.0 { x1 } else { x0 };
        for k in 1..=3 {
            let fx = tip - tip.signum() * k as f64 * 2.0;
            let mut j = 1.0;
            while j < th {
                put(&mut pb, fx, fy + j, 1);
                j += 1.0;
            }
        }
    }
    let mut fx = -sp.body_w - 2.0;
    while fx <= sp.body_w + 2.0 {
        put(&mut pb, fx, sp.h - 1.0, 0);
        fx += 1.0;
    } // 받침 그림자
    pb.sel_out(0.7).canvas()
}

// ═════════ 조랑말 · 돼지 · 갈매기 ═════════
fn pony_pose(t: f64) -> (Canvas, f64, f64) {
    let mut pb = Pb::new(44, 32);
    let hd = pal("hide");
    let (ink, line) = (INK, hx("#3b2420"));
    let bob = round(sin(t * 2.0) * 1.0);
    let (bx, by) = (18.0, 16.0 + bob);
    let legs = [(bx + 7.0, 0.0, true, true), (bx + 5.0, 0.35, true, false), (bx - 6.0, 0.55, false, true), (bx - 8.0, 0.9, false, false)];
    let draw_leg = |pb: &mut Pb, l: (f64, f64, bool, bool), pass: bool| {
        if l.3 != pass {
            return;
        }
        let q = t + l.1 * PI * 2.0;
        let th = 42.0 * sin(q);
        let bend = (if l.2 { -1.0 } else { 1.0 }) * 60.0 * max(0.0, cos(q));
        let (kx, ky) = limb_end(l.0, by + 4.0, 5.0, th);
        let (fx, fy) = limb_end(kx, ky, 5.0, th + bend);
        pb.limb(l.0, by + 3.0, kx, ky, 3.0, if l.3 { hd[1] } else { hd[2] });
        pb.limb(kx, ky, fx, fy, 2.0, if l.3 { hd[1] } else { hd[2] });
        pb.rect(round(fx) - 1.0, round(fy), 3.0, 2.0, if l.3 { ink } else { line });
    };
    for l in legs {
        draw_leg(&mut pb, l, true);
    }
    for k in 0..9 {
        let k = k as f64;
        let tx = bx - 10.0 - k;
        let ty = by - 2.0 + k * 0.5 + sin(t * 2.0 + k * 0.6) * (k * 0.35);
        pb.rect(round(tx), round(ty), 2.0, 2.0, if k < 3.0 { hd[0] } else { hx("#2a1418") });
    } // 꼬리
    let h1 = hd[1..].to_vec();
    pb.ellipse(bx, by, 11.5, 5.6, |nx, ny| Some(ramp_pick(&h1, sphere_light(nx, ny) * 0.95))); // 몸통
    let mut x = bx - 6.0;
    while x <= bx + 6.0 {
        if pb.get(x, by + 5.0).is_some() {
            pb.set(x, by + 5.0, hd[1]);
        }
        x += 1.0;
    } // 배
    let (h2, h3) = (hd[2], hd[3]);
    pb.limb_f(bx + 8.0, by - 1.0, bx + 13.0, by - 8.0, 6.0, |k| if k < 0.5 { h2 } else { h3 }); // 목
    pb.ellipse(bx + 16.0, by - 9.0, 4.6, 3.2, |nx, ny| Some(ramp_pick(&h1, sphere_light(nx, ny))));
    pb.rect(bx + 19.0, by - 9.0, 3.0, 3.0, hd[4]);
    pb.set(bx + 21.0, by - 8.0, hd[3]);
    pb.set(bx + 21.0, by - 7.0, ink);
    pb.set(bx + 16.0, by - 10.0, ink);
    pb.set(bx + 16.0, by - 11.0, hd[3]);
    pb.set(bx + 13.0, by - 13.0, hd[2]);
    pb.set(bx + 14.0, by - 13.0, hd[1]);
    pb.set(bx + 13.0, by - 14.0, hd[1]);
    for k in 0..7 {
        let k = k as f64;
        let mx = bx + 13.0 - k * 0.9;
        let my = by - 12.0 + k * 1.3;
        pb.rect(round(mx - 1.0 - sin(t * 2.0 + k) * 0.8), round(my), 2.0, 2.0, if k as i32 % 2 == 1 { hx("#2a1418") } else { hd[0] });
    } // 갈기
    for l in legs {
        draw_leg(&mut pb, l, false);
    }
    (pb.sel_out(0.72).canvas(), 20.0, 30.0)
}
fn pig_pose(t: f64) -> (Canvas, f64, f64) {
    let mut pb = Pb::new(30, 20);
    let k = mutes(&["#25211f", "#39332e", "#51483e", "#716351"]);
    let bob = [0.0, -1.0, 0.0, -1.0][(round(t / (PI / 2.0)) as i64 % 4) as usize];
    for (lx, ph) in [(19.0, 0.0), (16.0, 0.5), (9.0, 0.25), (6.0, 0.75)] {
        let a = sin(t + ph * 6.28) * 30.0;
        let (fx, fy) = limb_end(lx, 12.0 + bob, 5.0, a);
        pb.limb(lx, 12.0 + bob, fx, fy, 2.0, k[1]);
        pb.rect(round(fx) - 1.0, round(fy), 3.0, 1.0, k[0]);
    }
    pb.ellipse(13.0, 9.0 + bob, 10.0, 5.4, |nx, ny| {
        let v = sphere_light(nx, ny);
        Some(if v < 0.35 {
            k[0]
        } else if v < 0.6 {
            k[1]
        } else if v < 0.85 {
            k[2]
        } else {
            k[3]
        })
    });
    pb.ellipse(23.0, 8.0 + bob, 4.6, 3.2, |nx, ny| {
        let v = sphere_light(nx, ny);
        Some(if v < 0.4 {
            k[1]
        } else if v < 0.75 {
            k[2]
        } else {
            k[3]
        })
    });
    pb.rect(26.0, 8.0 + bob, 3.0, 3.0, k[2]);
    pb.set(27.0, 9.0 + bob, hx("#5a2a2a"));
    pb.set(28.0, 9.0 + bob, hx("#5a2a2a"));
    pb.set(24.0, 7.0 + bob, k[0]);
    pb.set(21.0, 3.0 + bob, k[2]);
    pb.set(22.0, 4.0 + bob, k[3]);
    pb.set(3.0, 6.0 + bob, k[2]);
    pb.set(2.0, 5.0 + bob, k[2]);
    pb.set(2.0, 4.0 + bob, k[3]);
    let cl = pal("cloth")[2];
    for y in 0..pb.h {
        for x in 0..pb.w {
            let (xf, yf) = (x as f64, y as f64);
            if let Some(c) = pb.get(xf, yf) {
                if pb.get(xf, yf - 1.0).is_none() {
                    pb.set(xf, yf, mix(c, cl, 0.35));
                }
            }
        }
    } // 등선 하이라이트
    (pb.sel_out(0.7).canvas(), 15.0, 18.0)
}
fn gull_pose(up: bool) -> String {
    let mut pb = Pb::new(18, 12);
    let wh = mutes(&["#8a90a0", "#c8ccd6", "#eef0f4", "#ffffff"]);
    pb.ellipse(9.0, 7.0, 4.6, 2.6, |nx, ny| {
        let v = sphere_light(nx, ny);
        Some(if v < 0.4 {
            wh[1]
        } else if v < 0.75 {
            wh[2]
        } else {
            wh[3]
        })
    });
    pb.ellipse(13.0, 6.0, 2.0, 1.6, |nx, ny| Some(if sphere_light(nx, ny) < 0.5 { wh[2] } else { wh[3] }));
    pb.rect(15.0, 6.0, 2.0, 1.0, m("#f2b43a"));
    pb.set(14.0, 5.0, INK);
    pb.rect(3.0, 7.0, 3.0, 1.0, wh[1]);
    pb.set(2.0, 6.0, wh[0]);
    let wy = if up { -1.0 } else { 1.0 };
    for i in 0..7 {
        let fi = i as f64;
        let x = 6.0 + fi;
        let y = 6.0 + wy * round((if i < 3 { fi } else { 6.0 - fi }) * if up { 1.3 } else { 0.6 });
        pb.set(x, y + if up { -1.0 } else { 1.0 }, if i > 4 { wh[0] } else { wh[1] });
        pb.set(x, y + if up { 0.0 } else { 2.0 }, wh[1]);
    }
    pair(&pb.sel_out(0.7), 9.0, 8.0)
}

// ═════════ 소품 · 이펙트 ═════════
fn fruit(rx: f64, ry: f64, bumps: bool) -> Canvas {
    let (w, h) = ((rx * 2.0).ceil() + 4.0, (ry * 2.0).ceil() + 6.0);
    let mut pb = Pb::new(w as i32, h as i32);
    let (cx, cy) = (w / 2.0, h - ry - 2.0);
    let (org, wood, leaf) = (pal("org"), pal("wood"), pal("leaf"));
    let o1 = org[1..].to_vec();
    pb.ellipse(cx, cy, rx, ry, |nx, ny| Some(ramp_pick(&o1, sphere_light(nx, ny))));
    if bumps {
        pb.ellipse(cx, cy - ry - 0.5, 2.4, 1.8, |nx, ny| Some(ramp_pick(&o1, sphere_light(nx, ny) * 0.9)));
    }
    let top = round(cy - ry - if bumps { 2.0 } else { 0.0 });
    pb.set(cx, top, wood[1]);
    pb.set(cx + 1.0, top - 1.0, leaf[3]);
    pb.set(cx + 2.0, top - 1.0, leaf[3]);
    pb.set(cx + 2.0, top - 2.0, leaf[4]);
    pb.set(cx + 1.0, top, leaf[2]);
    pb.set(round(cx - rx * 0.45), round(cy - ry * 0.45), org[4]);
    pb.sel_out(0.72).canvas()
}
fn heart(full: bool) -> Canvas {
    let rows = [".xx...xx.", "xxxx.xxxx", "xxxxxxxxx", "xxxxxxxxx", ".xxxxxxx.", "..xxxxx..", "...xxx...", "....x...."];
    let mut pb = Pb::new(11, 10);
    let red = pal("red");
    for (y, r) in rows.iter().enumerate() {
        for (x, ch) in r.chars().enumerate() {
            if ch != 'x' {
                continue;
            }
            let (xf, yf) = (x as f64, y as f64);
            let v = 1.0 - (yf / 8.0) * 0.8 - (xf / 9.0) * 0.3;
            pb.set(
                xf + 1.0,
                yf + 1.0,
                if full {
                    ramp_pick(&red[0..4], v + 0.2)
                } else if v > 0.6 {
                    hx("#5a4060")
                } else {
                    hx("#3e2a48")
                },
            );
        }
    }
    if full {
        pb.set(2.0, 2.0, red[3]);
        pb.set(3.0, 2.0, red[3]);
    }
    pb.sel_out(0.85).canvas()
}
fn meteor() -> Canvas {
    let mut pb = Pb::new(14, 14);
    let (y3, o3) = (pal("yel")[3], pal("org")[3]);
    let rk = hxs(&["#2a1a24", "#4a2a2e", "#6a3a34"]);
    pb.ellipse4(7.0, 7.0, 5.6, 5.4, |nx, ny, x, y| {
        let v = sphere_light(nx, ny);
        let crack = (x == 6.0 + ((y - 2.0) / 3.0).floor() && (3.0..=10.0).contains(&y)) || (y == 7.0 && (7.0..=10.0).contains(&x));
        Some(if crack {
            if v > 0.5 {
                y3
            } else {
                o3
            }
        } else {
            ramp_pick(&rk, v)
        })
    });
    pb.sel_out(0.7).canvas()
}
fn hxs(a: &[&str]) -> Vec<Col> {
    a.iter().map(|s| hx(s)).collect()
}
// 돌: 다각형 윤곽 + 면마다 다른 밝기 + 숨구멍 · rot: 돌려서 다시 그림 (빛은 그대로)
fn stone_sprite(seed: f64, size: f64, pl: &[Col], rot: f64, pores: i32, sides: f64) -> Canvas {
    let mut r = rng(seed);
    let n = sides + (r.next() * 3.0).floor();
    let el = 0.7 + r.next() * 0.45;
    let mut pts = vec![];
    let mut k = 0.0;
    while k < n {
        let a = k / n * 6.283 + (r.next() - 0.5) * 0.3;
        let rr = 0.8 + r.next() * 0.2;
        pts.push((cos(a) * rr, sin(a) * rr * el));
        k += 1.0;
    }
    let fac: Vec<[f64; 4]> = (0..4)
        .map(|_| {
            let a = r.next() * 6.283;
            let d = r.next() * 0.5;
            let p = (r.next() - 0.5) * 1.3;
            let q = (r.next() - 0.5) * 1.3;
            [cos(a) * d, sin(a) * d * el, p, q]
        })
        .collect();
    let pr: Vec<(f64, f64)> = (0..pores)
        .map(|_| {
            let a = (r.next() - 0.5) * 1.1;
            let b = (r.next() - 0.5) * 1.1 * el;
            (a, b)
        })
        .collect();
    let (ca, sa) = (cos(rot), sin(rot));
    let rp = |(x, y): (f64, f64)| (x * ca - y * sa, x * sa + y * ca);
    let p: Vec<(f64, f64)> = pts.iter().map(|&q| rp(q)).collect();
    let f: Vec<[f64; 4]> = fac
        .iter()
        .map(|q| {
            let a = rp((q[0], q[1]));
            let b = rp((q[2], q[3]));
            [a.0, a.1, b.0, b.1]
        })
        .collect();
    let po: Vec<(f64, f64)> = pr.iter().map(|&q| rp(q)).collect();
    let mut pb = Pb::new((size + 2.0) as i32, (size + 2.0) as i32);
    let (c0, sc) = ((size + 2.0) / 2.0, size / 2.0);
    for yy in 0..pb.h {
        for xx in 0..pb.w {
            let (xf, yf) = (xx as f64, yy as f64);
            let x = (xf + 0.5 - c0) / sc;
            let y = (yf + 0.5 - c0) / sc;
            if !in_poly(&p, x, y) {
                continue;
            }
            let (mut b1, mut b2, mut fq) = (9.0, 9.0, f[0]);
            for q in &f {
                let d = pow(x - q[0], 2.0) + pow(y - q[1], 2.0);
                if d < b1 {
                    b2 = b1;
                    b1 = d;
                    fq = *q;
                } else if d < b2 {
                    b2 = d;
                }
            }
            let nz = max(0.1, 1.0 - fq[2] * fq[2] - fq[3] * fq[3]).sqrt();
            let mut v = clamp((-0.55 * fq[2] - 0.65 * fq[3] + 0.5 * nz) * 0.75 + 0.42, 0.0, 1.0) - hypot(x, y) * 0.12;
            if b2.sqrt() - b1.sqrt() < 0.12 {
                v -= 0.12;
            } // 면 사이 모서리
            if po.iter().any(|&(px, py)| (x - px).abs() * sc < 0.55 && (y - py).abs() * sc < 0.55) {
                v = 0.02;
            } // 숨구멍
            pb.set(xf, yf, pl[clamp((v * pl.len() as f64).floor(), 0.0, (pl.len() - 1) as f64) as usize]);
        }
    }
    pb.sel_out(0.72).canvas()
}
fn suitcase(col: Col, big: bool) -> Canvas {
    let (w, h) = (if big { 18.0 } else { 14.0 }, if big { 22.0 } else { 17.0 });
    let mut pb = Pb::new((w + 2.0) as i32, (h + 6.0) as i32);
    let r: Vec<Col> = [mix(col, hx("#000000"), 0.45), mix(col, hx("#000000"), 0.2), col, mix(col, hx("#ffffff"), 0.35)]
        .iter()
        .map(|&c| mute(c, 0.86))
        .collect();
    let hd = hx("#4a4a56");
    pb.rect(4.0, 0.0, w - 6.0, 1.0, hd);
    pb.rect(4.0, 0.0, 1.0, 4.0, hd);
    pb.rect(w - 3.0, 0.0, 1.0, 4.0, hd);
    let mut y = 4.0;
    while y < h + 2.0 {
        let mut x = 1.0;
        while x <= w {
            if !((y == 4.0 || y == h + 1.0) && (x == 1.0 || x == w)) {
                let mut c = if x <= 2.0 {
                    r[3]
                } else if x >= w - 1.0 {
                    r[1]
                } else {
                    r[2]
                };
                if (x as i32 - 1) % 4 == 0 && x > 2.0 && x < w - 1.0 {
                    c = r[1];
                }
                if y == 4.0 {
                    c = r[3];
                }
                pb.set(x, y, c);
            }
            x += 1.0;
        }
        y += 1.0;
    }
    pb.rect(w - 4.0, 7.0, 3.0, 4.0, hx("#f4f0e0"));
    pb.set(w - 3.0, 8.0, hx("#e8403a"));
    pb.rect(2.0, h + 2.0, 3.0, 2.0, hx("#2a2a32"));
    pb.rect(w - 4.0, h + 2.0, 3.0, 2.0, hx("#2a2a32"));
    pb.sel_out(0.72).canvas()
}
fn rentcar() -> Canvas {
    let mut pb = Pb::new(32, 18);
    let wc = mutes(&["#8a90a0", "#c8ccd6", "#e8eaf0", "#ffffff"]);
    for y in 7..14 {
        for x in 1..31 {
            if y == 7 && !(3..=28).contains(&x) {
                continue;
            }
            pb.set(
                x as f64,
                y as f64,
                if y < 9 {
                    wc[3]
                } else if y > 12 {
                    wc[0]
                } else if x > 27 {
                    wc[1]
                } else {
                    wc[2]
                },
            );
        }
    }
    for y in 2..8 {
        let mut x = 8 + (7 - y);
        while x < 24 - (4 - y).max(0) {
            pb.set(x as f64, y as f64, if y == 2 { wc[2] } else { wc[3] });
            x += 1;
        }
    }
    for y in 3..7 {
        for x in 11 + (6 - y)..16 {
            pb.set(x as f64, y as f64, m("#5a8ac8"));
        }
        let mut x = 17;
        while x < 22 - (4 - y).max(0) {
            pb.set(x as f64, y as f64, m("#4a7ab8"));
            x += 1;
        }
    }
    pb.rect(28.0, 9.0, 2.0, 2.0, m("#fff0a0"));
    pb.rect(1.0, 9.0, 2.0, 2.0, m("#e8403a"));
    pb.rect(13.0, 11.0, 6.0, 2.0, hx("#ffffff"));
    pb.set(14.0, 11.0, INK);
    pb.set(15.0, 12.0, INK);
    pb.set(17.0, 11.0, INK); // '허' 번호판
    for wx in [7.0, 24.0] {
        pb.ellipse(wx, 14.0, 3.0, 3.0, |nx, ny| Some(if hypot(nx, ny) < 0.45 { hx("#9aa0ac") } else { hx("#22222a") }));
    }
    pb.sel_out(0.7).canvas()
}
fn chars() -> Vec<(&'static str, String)> {
    let mut o = vec![("GYUL", gyul())];
    let hb = Spec {
        w: 22.0,
        h: 52.0,
        seed: 7.0,
        dome_w: 8.2,
        brim_w: 9.6,
        head_w: 8.4,
        body_w: 9.0,
        brim: (9.0, 10.0),
        head: (11.0, 29.0),
        body0: 31.0,
        eye_y: 16.0,
        eye_dx: 4.0,
        nose: (15.0, 26.0),
        nose_w: (1.0, 3.0),
        mouth_y: 28.0,
        mouth_w: 3.0,
        hands: vec![(35.0, -9.0, 3.0, 3.0), (42.0, -3.0, 10.0, 3.0)],
        pits: 24,
    };
    o.push(("HAREUBANG", cv(hareubang(&hb), "")));
    let mini = Spec {
        w: 14.0,
        h: 26.0,
        seed: 3.0,
        dome_w: 5.2,
        brim_w: 6.4,
        head_w: 6.0,
        body_w: 6.2,
        brim: (4.0, 5.0),
        head: (6.0, 15.0),
        body0: 17.0,
        eye_y: 9.0,
        eye_dx: 3.0,
        nose: (9.0, 14.0),
        nose_w: (0.0, 2.0),
        mouth_y: 15.0,
        mouth_w: 2.0,
        hands: vec![(19.0, -6.0, 2.0, 2.0)],
        pits: 18,
    };
    o.push(("MINI", rl(hareubang(&mini))));
    o.push(("PONY", arr((0..6).map(|i| lit_pair(|| pony_pose(i as f64 / 6.0 * PI * 2.0))).collect())));
    o.push(("TANGERINE", cv(fruit(4.2, 3.8, false), "")));
    o.push(("HALLABONG", cv(fruit(5.0, 4.6, true), "")));
    o.push(("HEART", cv(heart(true), "")));
    o.push(("HEART_EMPTY", cv(heart(false), "")));
    o.push(("METEOR", cv(meteor(), "")));
    {
        let mut pb = Pb::new(8, 7);
        let st = pal("stone");
        let r = [st[2], st[3], st[4], hx("#ffffff")];
        pb.ellipse(4.0, 3.6, 3.0, 2.6, |nx, ny| Some(ramp_pick(&r, sphere_light(nx, ny))));
        o.push(("PEBBLE", cv(pb.sel_out(0.72).canvas(), "")));
    }
    let basalt = mutes(&["#24201e", "#3a3532", "#55504a", "#77706a", "#9a938a"]);
    let scoria = mutes(&["#3a1e1a", "#5a2c24", "#7e3e30", "#a05a44", "#c07a5a"]);
    let pale = mutes(&["#4a4642", "#68625c", "#8a837a", "#ada69c", "#d0c9be"]);
    let list: [(&Vec<Col>, f64, i32); 8] = [
        (&basalt, 8.0, 2),
        (&basalt, 7.0, 1),
        (&scoria, 7.0, 0),
        (&pale, 6.0, 0),
        (&basalt, 9.0, 3),
        (&scoria, 8.0, 1),
        (&basalt, 6.0, 1),
        (&pale, 8.0, 0),
    ];
    o.push((
        "PEBBLES",
        arr(list
            .iter()
            .enumerate()
            .map(|(i, &(pl, size, pores))| {
                arr((0..4).map(|r| cv(stone_sprite(301.0 + i as f64 * 17.0, size, pl, r as f64 * PI / 2.0, pores, 6.0), "")).collect())
            })
            .collect()),
    ));
    let (cl, org) = (pal("cloth"), pal("org"));
    let (cb, o1) = (vec![cl[1], cl[2], cl[3]], org[1..].to_vec());
    o.push((
        "TEWAK",
        arr((0..4)
            .map(|k| {
                let mut pb = Pb::new(12, 12);
                pb.ellipse(6.0, 6.0, 4.8, 4.8, |nx, ny| {
                    let a = atan2(ny, nx) + k as f64 * PI / 4.0;
                    Some(if sin(a).abs() < 0.25 { ramp_pick(&cb, sphere_light(nx, ny)) } else { ramp_pick(&o1, sphere_light(nx, ny)) })
                });
                cv(pb.sel_out(0.72).canvas(), "")
            })
            .collect()),
    ));
    let blob = |r: f64, cols: &[&str]| {
        let n = (r * 2.0).ceil() + 2.0;
        let mut pb = Pb::new(n as i32, n as i32);
        let c = hxs(cols);
        pb.ellipse(n / 2.0, n / 2.0, r, r, |nx, ny| Some(ramp_pick(&c, sphere_light(nx, ny))));
        cv(pb.canvas(), "")
    };
    o.push(("PUFFS", arr([1.2, 1.8, 2.5, 3.2, 4.0].iter().map(|&r| blob(r, &["#b89a80", "#dcc4a8", "#f4e8d6"])).collect())));
    o.push(("SMOKE", arr([1.5, 2.5, 3.5, 4.5, 6.0].iter().map(|&r| blob(r, &["#3a2a36", "#5a4652", "#7a6670"])).collect())));
    let yel = pal("yel");
    o.push((
        "SPARK",
        arr((0..3)
            .map(|k| {
                let mut pb = Pb::new(7, 7);
                let c = [hx("#ffffff"), yel[3], yel[2]][k];
                let r = 3 - k as i32;
                for i in -r..=r {
                    pb.set(3.0 + i as f64, 3.0, c);
                    pb.set(3.0, 3.0 + i as f64, c);
                }
                if k == 0 {
                    for (x, y) in [(2.0, 2.0), (4.0, 4.0), (2.0, 4.0), (4.0, 2.0)] {
                        pb.set(x, y, c);
                    }
                }
                cv(pb.canvas(), "")
            })
            .collect()),
    ));
    {
        let mut pb = Pb::new(18, 18);
        pb.ellipse(9.0, 9.0, 7.6, 7.2, |nx, ny| {
            let v = sphere_light(nx, ny);
            let mut c = if v < 0.36 {
                org[0]
            } else if v < 0.56 {
                org[1]
            } else if v < 0.8 {
                org[2]
            } else {
                org[3]
            };
            if (nx + 0.22 * ny).abs() < 0.10 || (ny - 0.16 * nx).abs() < 0.08 {
                c = if v > 0.5 { hx("#f4f0e6") } else { hx("#bcb8b0") };
            }
            Some(c)
        });
        o.push(("TEWAK_BACK", cv(pb.sel_out(0.72).canvas(), "")));
    }
    o.push((
        "SUITCASES",
        arr([("#756754", false), ("#59675e", false), ("#8b7451", true), ("#665b54", false), ("#b2a58c", true)]
            .iter()
            .map(|&(c, b)| {
                let s = suitcase(hx(c), b);
                let l = s.flip();
                obj(&[("r", cv(s, "")), ("l", cv(l, "")), ("big", b.to_string())])
            })
            .collect()),
    ));
    o.push(("PIG", arr((0..4).map(|i| lit_pair(|| pig_pose(i as f64 / 4.0 * PI * 2.0))).collect())));
    o.push(("GULL", arr(vec![gull_pose(true), gull_pose(false)])));
    o.push(("RENTCAR", rl(rentcar())));
    o
}

// ═════════ 게임 소품 · 적 (원래 game.js) ═════════
fn game() -> Vec<(&'static str, String)> {
    let (org, wood, leaf, cloth, stone, yel, red, teal) =
        (pal("org"), pal("wood"), pal("leaf"), pal("cloth"), pal("stone"), pal("yel"), pal("red"), pal("teal"));
    let mut o = vec![];
    // 떨어지는 귤: 빙글 도는 8프레임 × 착지 찌그러짐
    // 만장굴 낙석: 각진 현무암 덩이 6가지 (크기 · 모서리 · 등불빛) × 구르는 4칸
    let (cave, warm) =
        (mutes(&["#1e1a24", "#332d3a", "#4e4656", "#6e6676", "#8e8696"]), mutes(&["#1e1a1a", "#3a302c", "#5a4a40", "#7e6a58", "#a08a70"]));
    let rocks: [(f64, f64, bool, i32); 6] = [
        (13.0, 5.0, false, 2),
        (11.0, 5.0, false, 1),
        (15.0, 6.0, true, 2),
        (12.0, 4.0, false, 0),
        (14.0, 5.0, true, 1),
        (10.0, 5.0, false, 1),
    ];
    o.push((
        "FALLROCKS",
        arr(rocks
            .iter()
            .enumerate()
            .map(|(i, &(size, sides, w, pores))| {
                arr((0..4)
                    .map(|r| {
                        cv(
                            stone_sprite(611.0 + i as f64 * 23.0, size, if w { &warm } else { &cave }, r as f64 * PI / 2.0, pores, sides),
                            "",
                        )
                    })
                    .collect())
            })
            .collect()),
    ));
    o.push((
        "PICK_TANG",
        arr((0..8)
            .map(|i| {
                arr((0..2)
                    .map(|q| {
                        let q = q as f64;
                        let mut pb = Pb::new(13, 14);
                        let a = i as f64 * PI / 4.0;
                        let cy = 8.2 + q;
                        pb.ellipse(6.5, cy, 4.2 + q, 3.8 - q, |nx, ny| {
                            let v = sphere_light(nx, ny);
                            Some(
                                org[if v < 0.42 {
                                    1
                                } else if v < 0.78 {
                                    2
                                } else {
                                    3
                                }],
                            )
                        });
                        if cos(a) > -0.3 {
                            let x = round(6.0 + sin(a) * 3.0);
                            let y = round(cy - cos(a) * (4.0 - q));
                            pb.set(x, y, wood[1]);
                            pb.rect(x + 1.0, y - 1.0, 2.0, 1.0, leaf[2]);
                        }
                        cv(pb.sel_out(0.72).canvas(), "")
                    })
                    .collect())
            })
            .collect()),
    ));
    {
        // 삼다수
        let mut pb = Pb::new(9, 16);
        let w4 = mutes(&["#6aa0c0", "#a8d4e4", "#d8f0f6", "#f4fcff"]);
        let cap = m("#2c5aa8");
        pb.rect(3.0, 0.0, 3.0, 2.0, cap);
        pb.set(3.0, 0.0, m("#4a7ac8"));
        pb.rect(3.0, 2.0, 3.0, 1.0, w4[1]);
        pb.set(2.0, 3.0, w4[1]);
        pb.set(6.0, 3.0, w4[1]);
        for y in 4..15 {
            for x in 1..8 {
                pb.set(
                    x as f64,
                    y as f64,
                    if x == 1 {
                        w4[3]
                    } else if x == 2 {
                        w4[2]
                    } else if x == 7 {
                        w4[0]
                    } else {
                        w4[1]
                    },
                );
            }
        }
        let lb = hx("#f4f0e8");
        for x in 1..8 {
            let xf = x as f64;
            pb.set(xf, 8.0, lb);
            pb.set(xf, 9.0, if x % 2 == 1 { m("#3a72c0") } else { lb });
            pb.set(xf, 10.0, lb);
        }
        for x in 2..7 {
            pb.set(x as f64, 15.0, w4[0]);
        }
        o.push(("SAMDA", cv(pb.sel_out(0.72).canvas(), "")));
    }
    let drop_icon = |full: bool| {
        let mut pb = Pb::new(7, 8);
        let c = if full { mutes(&["#3a72c0", "#6aa8d8", "#bfe4f2"]) } else { mutes(&["#3a3236", "#4a4044", "#5a5054"]) };
        pb.set(3.0, 0.0, c[1]);
        pb.rect(2.0, 1.0, 3.0, 1.0, c[1]);
        for y in 2..7 {
            for x in 1..6 {
                if !(y == 6 && (x == 1 || x == 5)) {
                    pb.set(
                        x as f64,
                        y as f64,
                        if x == 2 && y < 5 {
                            c[2]
                        } else if x == 5 || y == 6 {
                            c[0]
                        } else {
                            c[1]
                        },
                    );
                }
            }
        }
        cv(pb.sel_out(0.72).canvas(), "")
    };
    o.push(("DROP", obj(&[("on", drop_icon(true)), ("off", drop_icon(false))])));
    {
        // 귤 망사리
        let mut pb = Pb::new(14, 12);
        let w2 = mutes(&["#5a3a22", "#7a5230", "#9a6c40"]);
        for y in 5..12 {
            let e = if y > 9 { 1 } else { 0 };
            for x in 1 + e..13 - e {
                pb.set(
                    x as f64,
                    y as f64,
                    if (x + y) % 3 == 0 {
                        w2[0]
                    } else if (x + (y >> 1)) % 2 == 1 {
                        w2[2]
                    } else {
                        w2[1]
                    },
                );
            }
        }
        for (cx, cy) in [(4.0, 4.0), (7.0, 3.0), (10.0, 4.0), (5.5, 6.0), (8.5, 6.0)] {
            pb.ellipse(cx, cy, 2.2, 2.0, |a, b| {
                Some(
                    org[if sphere_light(a, b) < 0.4 {
                        1
                    } else if sphere_light(a, b) < 0.75 {
                        2
                    } else {
                        3
                    }],
                )
            });
        }
        pb.set(7.0, 1.0, leaf[2]);
        o.push(("BASKET", cv(pb.sel_out(0.72).canvas(), "")));
    }
    {
        // 흰 접시에 오메기떡 세 알
        let mut pb = Pb::new(14, 11);
        let k = mutes(&["#4a5a2e", "#6a7e40", "#8ea25a"]);
        for x in 1..13 {
            pb.set(x as f64, 9.0, hx("#c8c0b4"));
            if x > 1 && x < 12 {
                pb.set(x as f64, 10.0, hx("#8a8478"));
            }
        }
        for x in 2..12 {
            pb.set(x as f64, 8.0, hx("#f4ecdc"));
        }
        for (cx, cy) in [(4.0, 6.0), (10.0, 6.0), (7.0, 3.6)] {
            pb.ellipse(cx, cy, 2.6, 2.2, |a, b| {
                Some(
                    k[if sphere_light(a, b) < 0.4 {
                        0
                    } else if sphere_light(a, b) < 0.75 {
                        1
                    } else {
                        2
                    }],
                )
            });
            pb.set(round(cx), round(cy - 1.0), hx("#f0d890"));
        }
        o.push(("OMEGI", cv(pb.sel_out(0.72).canvas(), "")));
    }
    o.push((
        "PINWHEEL",
        arr((0..2)
            .map(|f| {
                let mut pb = Pb::new(13, 16);
                for y in 7..16 {
                    pb.set(6.0, y as f64, wood[1]);
                }
                let cols = [red[3], yel[3], teal[3], org[3]];
                for (b, &col) in cols.iter().enumerate() {
                    let a = b as f64 * PI / 2.0 + f as f64 * PI / 4.0;
                    for r in 1..6 {
                        let r = r as f64;
                        let x = 6.0 + round(cos(a) * r);
                        let y = 6.0 + round(sin(a) * r);
                        pb.set(x, y, col);
                        pb.set(x + round(cos(a + 1.2)), y + round(sin(a + 1.2)), mix(col, INK, 0.3));
                    }
                }
                pb.set(6.0, 6.0, wood[0]);
                cv(pb.sel_out(0.72).canvas(), "")
            })
            .collect()),
    ));
    // 주상절리 기둥 4종: 윗면 다각형 · 앞으로 보이는 면 · 휘는 마디 · 숨구멍
    let tops: [&[(f64, f64)]; 4] = [
        &[(1.0, 3.0), (4.0, 0.0), (10.0, 0.0), (13.0, 3.0), (10.0, 6.0), (4.0, 6.0)],
        &[(1.0, 2.0), (7.0, 0.0), (13.0, 2.0), (11.0, 6.0), (3.0, 6.0)],
        &[(1.0, 4.0), (3.0, 1.0), (9.0, 0.0), (13.0, 2.0), (12.0, 5.0), (6.0, 7.0)],
        &[(1.0, 2.0), (5.0, 0.0), (12.0, 1.0), (13.0, 5.0), (8.0, 7.0), (2.0, 6.0)],
    ];
    o.push((
        "BASALTS",
        arr(tops
            .iter()
            .enumerate()
            .map(|(vi, poly)| {
                let (w, h) = (15, 66);
                let mut pb = Pb::new(w, h);
                let s = &stone;
                let vf = vi as f64;
                let n = poly.len();
                let min_x = poly.iter().map(|p| p.0).fold(f64::MAX, f64::min);
                let max_x = poly.iter().map(|p| p.0).fold(f64::MIN, f64::max);
                let il = poly.iter().position(|p| p.0 == min_x).unwrap();
                let ir = poly.iter().position(|p| p.0 == max_x).unwrap();
                let mut chain = vec![];
                let mut i = il;
                loop {
                    chain.push(poly[i]);
                    if i == ir {
                        break;
                    }
                    i = (i + n - 1) % n;
                }
                if chain.iter().map(|p| p.1).sum::<f64>() / (chain.len() as f64) < 3.0 {
                    chain.clear();
                    let mut i = il;
                    loop {
                        chain.push(poly[i]);
                        if i == ir {
                            break;
                        }
                        i = (i + 1) % n;
                    }
                }
                let seg_of = |x: f64| {
                    for k in 0..chain.len() - 1 {
                        if x <= chain[k + 1].0 {
                            return k;
                        }
                    }
                    chain.len() - 2
                };
                let low_y = |x: f64| {
                    let k = seg_of(x);
                    let ((x0, y0), (x1, y1)) = (chain[k], chain[k + 1]);
                    y0 + (y1 - y0) * if x1 == x0 { 0.0 } else { (x - x0) / (x1 - x0) }
                };
                let face_col = |k: usize| {
                    let sl = (chain[k + 1].1 - chain[k].1) / max(1.0, chain[k + 1].0 - chain[k].0);
                    if sl > 0.4 {
                        mix(s[3], s[4], 0.35)
                    } else if sl < -0.4 {
                        s[1]
                    } else {
                        s[2]
                    }
                };
                let mut joints = vec![];
                let mut y = 9 + vi as i64 * 2;
                while y < h as i64 - 4 {
                    joints.push(y as f64);
                    y += 7 + ((y * 7 + vi as i64 * 3) % 5);
                }
                let mut x = min_x;
                while x <= max_x {
                    let ly = low_y(x);
                    let k = seg_of(x);
                    let edge = chain[1..chain.len() - 1].iter().any(|p| (p.0 - x).abs() < 0.5);
                    let mut y = round(ly);
                    while y < h as f64 {
                        let d = y - ly;
                        let mut c = face_col(k);
                        if edge {
                            c = mix(s[0], s[1], 0.4);
                        }
                        if x == min_x || x == max_x {
                            c = s[0];
                        }
                        if joints.iter().any(|&j| round(d) == j) {
                            c = s[0];
                        } else if joints.iter().any(|&j| round(d) == j + 1.0) && !edge {
                            c = mix(c, s[4], 0.4);
                        } else if hash2(x, y, 6.0 + vf) < 0.12 {
                            c = mix(c, s[0], 0.55);
                        } // 숨구멍
                        if y > h as f64 - 9.0 && hash2(x, y, 8.0) < 0.35 {
                            c = mix(c, leaf[1], 0.5);
                        } // 밑동 이끼
                        pb.set(x, y, c);
                        y += 1.0;
                    }
                    x += 1.0;
                }
                for y in 0..9 {
                    let yf = y as f64;
                    let mut x = min_x;
                    while x <= max_x {
                        // 윗면: 밝은 다각형 + 진한 테두리
                        if in_poly(poly, x + 0.5, yf + 0.5) {
                            let rim = !in_poly(poly, x - 0.5, yf + 0.5)
                                || !in_poly(poly, x + 1.5, yf + 0.5)
                                || !in_poly(poly, x + 0.5, yf - 0.5)
                                || !in_poly(poly, x + 0.5, yf + 1.5);
                            let lit = (x - min_x) / (max_x - min_x) < 0.5 && yf < 3.0;
                            pb.set(
                                x,
                                yf,
                                if rim {
                                    s[0]
                                } else if lit {
                                    mix(s[4], hx("#ffffff"), 0.2)
                                } else if hash2(x, yf, 4.0 + vf) < 0.15 {
                                    s[3]
                                } else {
                                    s[4]
                                },
                            );
                        }
                        x += 1.0;
                    }
                }
                cv(pb.sel_out(0.72).canvas(), "")
            })
            .collect()),
    ));
    o.push((
        "BEE",
        arr((0..2)
            .map(|f| {
                let mut pb = Pb::new(8, 7);
                pb.ellipse4(4.0, 4.2, 3.0, 2.1, |nx, ny, x, _| {
                    Some(if (x as i64 + 1) % 3 == 0 {
                        stone[0]
                    } else if sphere_light(nx, ny) > 0.6 {
                        yel[3]
                    } else {
                        yel[2]
                    })
                });
                pb.set(7.0, 4.0, stone[0]);
                let wy = if f == 1 { 1.0 } else { 2.0 };
                pb.set(3.0, wy, cloth[2]);
                pb.set(4.0, wy, cloth[3]);
                pb.set(5.0, wy + if f == 1 { 0.0 } else { 1.0 }, cloth[2]);
                pair(&pb.sel_out(0.72), 4.0, 4.0)
            })
            .collect()),
    ));
    {
        // 참새 (날갯짓 4칸)
        let (kd, kb, kl, ku, kc, kw, kk, kg) =
            (m("#4e3424"), m("#8a5a3a"), m("#b48a62"), m("#c4b49c"), m("#8c4a2c"), m("#eee6d6"), m("#241c1a"), m("#5a504c"));
        let poly = |pb: &mut Pb, pts: &[(f64, f64)], col: &dyn Fn(f64, f64) -> Col| {
            let (x0, x1) =
                (pts.iter().map(|p| p.0).fold(f64::MAX, f64::min).floor(), pts.iter().map(|p| p.0).fold(f64::MIN, f64::max).ceil());
            let (y0, y1) =
                (pts.iter().map(|p| p.1).fold(f64::MAX, f64::min).floor(), pts.iter().map(|p| p.1).fold(f64::MIN, f64::max).ceil());
            let mut y = y0;
            while y <= y1 {
                let mut x = x0;
                while x <= x1 {
                    if in_poly(pts, x + 0.5, y + 0.5) {
                        pb.set(x, y, col(x, y));
                    }
                    x += 1.0;
                }
                y += 1.0;
            }
        };
        let mk_f = |wing: usize| {
            let mut pb = Pb::new(17, 13);
            poly(&mut pb, &[(5.0, 6.5), (0.5, 5.5), (0.5, 8.0), (5.0, 8.2)], &|_, y| if y < 6.5 { kb } else { kd });
            pb.ellipse(8.2, 7.2, 4.6, 2.5, |nx, ny| {
                Some(if ny > 0.1 {
                    ku
                } else if nx > -0.2 && nx < 0.3 && ny < -0.4 {
                    kd
                } else {
                    kb
                })
            });
            pb.ellipse(12.0, 5.8, 2.4, 2.3, |_, ny| Some(if ny < -0.15 { kc } else { kw }));
            pb.set(12.0, 5.0, kk);
            pb.set(13.0, 7.0, kk);
            pb.set(12.0, 7.0, kk);
            pb.set(14.0, 6.0, kg);
            pb.set(15.0, 6.0, kg);
            let tip = [(3.5, 0.2), (0.8, 4.2), (3.5, 11.8)][if wing == 3 { 1 } else { wing }];
            poly(&mut pb, &[(10.2, 6.0), tip, (6.2, 7.2)], &|x, y| {
                let k = hypot(x - tip.0, y - tip.1);
                if k < 2.2 {
                    kd
                } else if k > 5.2 {
                    kl
                } else {
                    kb
                }
            });
            pb.set(round((10.2 + tip.0) / 2.0), round((6.0 + tip.1) / 2.0), kw);
            pb.sel_out(0.72).canvas()
        };
        let r: Vec<Canvas> = [0, 1, 2, 1].iter().map(|&w| mk_f(w)).collect();
        let l: Vec<Canvas> = r.iter().map(|c| c.flip()).collect();
        let p = "\"ax\":8,\"ay\":7";
        o.push((
            "SPARROW",
            obj(&[("r", arr(r.into_iter().map(|c| cv(c, p)).collect())), ("l", arr(l.into_iter().map(|c| cv(c, p)).collect()))]),
        ));
    }
    {
        // 귤 택배 상자
        let mut pb = Pb::new(18, 15);
        let k = mutes(&["#6a4a2e", "#8a6440", "#a8804e", "#c49a62"]);
        for y in 2..14 {
            for x in 1..17 {
                pb.set(
                    x as f64,
                    y as f64,
                    if x < 3 {
                        k[3]
                    } else if x > 14 {
                        k[1]
                    } else if y == 2 {
                        k[3]
                    } else {
                        k[2]
                    },
                );
            }
        }
        for x in 1..17 {
            pb.set(x as f64, 5.0, k[1]);
        }
        for y in 2..14 {
            pb.set(8.0, y as f64, mix(k[2], hx("#d8c8a0"), 0.4));
        }
        pb.rect(4.0, 8.0, 3.0, 3.0, org[2]);
        pb.set(5.0, 7.0, leaf[2]);
        pb.rect(10.0, 8.0, 4.0, 1.0, k[0]);
        pb.rect(10.0, 10.0, 3.0, 1.0, k[0]);
        o.push(("PARCEL", cv(pb.sel_out(0.72).canvas(), "")));
    }
    {
        // 패러글라이더
        let mut pb = Pb::new(30, 24);
        for x in 2..28 {
            let xf = x as f64;
            let u = (xf - 14.5) / 13.0;
            let top = round(2.0 + u * u * 5.0);
            let k = if ((x - 2) / 4) % 2 == 1 { &teal } else { &org };
            pb.set(xf, top, k[3]);
            pb.set(xf, top + 1.0, k[2]);
            pb.set(xf, top + 2.0, if x % 4 == 1 { k[1] } else { k[2] });
            pb.set(xf, top + 3.0, k[1]);
        }
        let l = mix(stone[3], cloth[3], 0.5);
        for sx in [3.0, 9.0, 20.0, 26.0] {
            pb.limb(sx, 6.0 + if !(6.0..=23.0).contains(&sx) { 3.0 } else { 0.0 }, 14.5 + if sx < 15.0 { -1.0 } else { 1.0 }, 16.0, 1.0, l);
        }
        pb.rect(13.0, 15.0, 3.0, 3.0, wood[1]);
        pb.set(14.0, 15.0, wood[2]);
        pb.rect(13.0, 18.0, 3.0, 3.0, cloth[1]);
        pb.set(13.0, 18.0, cloth[2]);
        pb.set(12.0, 21.0, cloth[0]);
        pb.set(16.0, 21.0, cloth[0]);
        o.push(("GLIDER", cv(pb.sel_out(0.72).canvas(), "")));
    }
    let dol: Vec<Canvas> = [-0.6, 0.0, 0.6]
        .iter()
        .map(|&ang| {
            // 남방큰돌고래
            let (w, h) = (26, 18);
            let mut pb = Pb::new(w, h);
            let (ca, sa) = (cos(ang), sin(ang));
            let b = mutes(&["#34445a", "#506478", "#72889c", "#aebcc6"]);
            for y in 0..h {
                for x in 0..w {
                    let dx = x as f64 + 0.5 - 13.0;
                    let dy = y as f64 + 0.5 - 9.0;
                    let u = dx * ca + dy * sa;
                    let v = -dx * sa + dy * ca;
                    let mut c = None;
                    let half = if u > -10.0 && u < 9.0 { 3.4 * max(0.0, 1.0 - pow((u + 0.5) / 9.6, 2.0)).sqrt() } else { 0.0 };
                    if half > 0.0 && (v + 0.2).abs() <= half {
                        c = Some(if v > half * 0.3 {
                            b[3]
                        } else if v < -half * 0.45 {
                            b[1]
                        } else {
                            b[2]
                        });
                    }
                    if (8.5..11.5).contains(&u) && v > -0.6 && v < 1.2 {
                        c = Some(b[2]);
                    }
                    if u > -2.5 && u < 2.0 && v < -2.4 && v > -2.4 - (2.0 - (u + 0.5).abs()) * 1.4 {
                        c = Some(b[1]);
                    }
                    if u <= -9.5 && u > -13.0 && v.abs() < (-(u + 9.5)) * 1.2 + 0.5 {
                        c = Some(b[1]);
                    }
                    if u > 2.0 && u < 5.0 && v > 1.2 && v < 2.6 {
                        c = Some(b[1]);
                    }
                    if round(u) == 6.0 && round(v) == -1.0 {
                        c = Some(INK);
                    }
                    pb.set_o(x as f64, y as f64, c);
                }
            }
            pb.sel_out(0.72).canvas()
        })
        .collect();
    let dol_l: Vec<Canvas> = dol.iter().map(|c| c.flip()).collect();
    o.push(("DOLPHIN", arr(dol.into_iter().map(|c| cv(c, "")).collect())));
    o.push(("DOLPHIN_L", arr(dol_l.into_iter().map(|c| cv(c, "")).collect())));
    let birds = |frames: Vec<Canvas>| {
        let l: Vec<Canvas> = frames.iter().map(|c| c.flip()).collect();
        let p = "\"ax\":9,\"ay\":7";
        obj(&[("r", arr(frames.into_iter().map(|c| cv(c, p)).collect())), ("l", arr(l.into_iter().map(|c| cv(c, p)).collect()))])
    };
    {
        // 까마귀
        let k = mutes(&["#1c1822", "#2c2634", "#40384c", "#5a5268"]);
        let f: Vec<Canvas> = (0..4)
            .map(|wing| {
                let mut pb = Pb::new(18, 14);
                pb.ellipse(8.5, 7.5, 4.6, 2.5, |_, b| Some(if b < -0.35 { k[2] } else { k[1] }));
                pb.ellipse(13.0, 6.0, 1.9, 1.7, |_, b| Some(if b < -0.25 { k[2] } else { k[1] }));
                pb.set(15.0, 6.0, hx("#5e5a52"));
                pb.set(16.0, 6.0, hx("#4a463e"));
                pb.set(15.0, 7.0, hx("#3e3a34"));
                pb.set(13.0, 5.0, k[3]);
                pb.rect(1.0, 7.0, 3.0, 2.0, k[0]);
                pb.set(0.0, 8.0, k[0]);
                match wing {
                    0 => {
                        pb.limb(9.0, 6.0, 5.0, 1.0, 2.0, k[2]);
                        pb.limb(10.0, 6.0, 9.0, 0.0, 1.0, k[3]);
                    }
                    1 => {
                        pb.limb(9.0, 7.0, 4.0, 7.0, 2.0, k[2]);
                        pb.set(3.0, 7.0, k[3]);
                    }
                    2 => {
                        pb.limb(9.0, 8.0, 6.0, 13.0, 2.0, k[2]);
                        pb.set(6.0, 13.0, k[3]);
                    }
                    _ => {
                        pb.limb(11.0, 7.0, 4.0, 8.0, 1.0, k[2]);
                    }
                }
                pb.sel_out(0.72).canvas()
            })
            .collect();
        o.push(("CROW", birds(f)));
    }
    {
        // 만장굴의 박쥐
        let k = mutes(&["#16121c", "#2a2232", "#3e3248", "#5a4a66"]);
        let eye = hx("#e8584a");
        let f: Vec<Canvas> = (0..4)
            .map(|wing| {
                let mut pb = Pb::new(18, 14);
                let (cx, cy) = (9.0, 7.0);
                let span = [(-1.0, -5.0), (0.0, -2.0), (1.0, 3.0), (0.0, 1.0)][wing];
                if wing < 3 {
                    for sd in [-1.0, 1.0] {
                        let (tip_x, tip_y) = (cx + sd * 8.0, cy + span.1);
                        for k2 in 0..=8 {
                            let kf = k2 as f64;
                            let t = kf / 8.0;
                            let x = cx + sd * kf;
                            let y_top = round(cy - 1.0 + (tip_y - cy + 1.0) * t);
                            let y_bot = round(cy + 2.0 + (tip_y - cy) * t * 0.6 + sin(t * PI * 3.0) * 1.2 * t);
                            let mut y = min(y_top, y_bot);
                            while y <= max(y_top, y_bot) {
                                pb.set(x, y, if y == y_top { k[3] } else { k[1] });
                                y += 1.0;
                            }
                        }
                        pb.limb(cx + sd, cy - 1.0, tip_x, tip_y, 1.0, k[2]);
                    }
                } else {
                    pb.rect(cx - 3.0, cy - 1.0, 7.0, 4.0, k[1]);
                }
                pb.ellipse(cx + 0.5, cy + 1.0, 2.2, 2.6, |_, b| Some(if b < -0.3 { k[2] } else { k[1] }));
                pb.set(cx - 1.0, cy - 2.0, k[2]);
                pb.set(cx + 2.0, cy - 2.0, k[2]);
                pb.set(cx, cy, eye);
                pb.set(cx + 1.0, cy, eye);
                pb.sel_out(0.72).canvas()
            })
            .collect();
        o.push(("BAT", birds(f)));
    }
    {
        // 큰 칼 · 작은 칼
        let mut pb = Pb::new(10, 34);
        let bl = mutes(&["#7e8284", "#b0b4b2", "#dcdcd4", "#f2f2ea"]);
        for y in 0..10 {
            for x in 3..7 {
                pb.set(x as f64, y as f64, if x == 3 { wood[2] } else { wood[1] });
            }
        }
        pb.rect(1.0, 10.0, 8.0, 2.0, bl[0]);
        for y in 12..34 {
            let w = if y > 29 { 34 - y } else { 7 };
            for x in 1..1 + w {
                pb.set(
                    x as f64,
                    y as f64,
                    if x == 1 {
                        bl[3]
                    } else if x < 4 {
                        bl[2]
                    } else if x < 7 {
                        bl[1]
                    } else {
                        bl[0]
                    },
                );
            }
        }
        o.push(("BIG_KNIFE", cv(pb.sel_out(0.72).canvas(), "")));
        let mut pb = Pb::new(12, 5);
        let bl = mutes(&["#9ea2a0", "#dcdcd4"]);
        pb.rect(0.0, 1.0, 3.0, 2.0, wood[1]);
        for x in 3..12 {
            pb.set(x as f64, 1.0, bl[1]);
            if x < 11 {
                pb.set(x as f64, 2.0, bl[0]);
            }
        }
        let c = pb.sel_out(0.72).canvas();
        let fl = c.flip();
        let fj = cv(fl, "");
        o.push(("SMALL_KNIFE", cv(c, &format!("\"flip\":{},\"metal\":true", fj))));
    }
    {
        // 폭포 물줄기 결
        let (w, h) = (19, 48);
        let mut pb = Pb::new(w, h);
        let wa = mutes(&["#2e5a7a", "#4a86a8", "#7ab4cc", "#bfe0ea", "#f2fbff"]);
        let wf = w as f64;
        for y in 0..h {
            for x in 0..w {
                let (xf, yf) = (x as f64, y as f64);
                let e = (xf - (wf - 1.0) / 2.0).abs() / ((wf - 1.0) / 2.0);
                let streak = vnoise(xf * 0.9, yf * 0.08, 91.0) + (hash2(xf, (y >> 2) as f64, 92.0) - 0.5) * 0.3;
                let l = 0.75 - e * 0.55 + (streak - 0.5) * 0.7;
                pb.set(
                    xf,
                    yf,
                    if e > 0.9 {
                        wa[0]
                    } else if l > 0.75 {
                        wa[4]
                    } else if l > 0.5 {
                        wa[3]
                    } else if l > 0.28 {
                        wa[2]
                    } else {
                        wa[1]
                    },
                );
            }
        }
        o.push(("FALL_TILE", cv(pb.canvas(), "")));
    }
    {
        // 썩은 귤 (이벤트 투척물)
        let mut pb = Pb::new(10, 10);
        pb.ellipse4(5.0, 5.5, 4.0, 3.6, |a, b, x, y| {
            let v = sphere_light(a, b);
            let mut c = if v < 0.4 {
                hx("#3e4a2a")
            } else if v < 0.65 {
                hx("#5e6e34")
            } else {
                hx("#8a9a48")
            };
            if hash2((x as i64 >> 1) as f64, (y as i64 >> 1) as f64, 3.0) < 0.2 {
                c = hx("#2a3020");
            }
            Some(c)
        });
        pb.set(5.0, 1.0, wood[0]);
        pb.set(6.0, 1.0, hx("#3e4a2a"));
        o.push(("ROTTEN", cv(pb.sel_out(0.72).canvas(), "")));
    }
    {
        // 초상이 아직 없을 때: 담백한 실루엣
        let (w, eh) = (92, 104);
        let mut pb = Pb::new(w, eh);
        let (col, hi) = (m("#3a3446"), m("#4e4860"));
        pb.ellipse(46.0, 40.0, 22.0, 25.0, |a, b| Some(if a + b < -0.6 { hi } else { col }));
        for y in 66..eh {
            let yf = y as f64;
            let hw = min(44.0, 14.0 + (yf - 66.0) * 2.2);
            let mut x = 46.0 - hw;
            while x <= 46.0 + hw {
                pb.set(x, yf, if (x - 46.0) / hw + (yf - 66.0) / 40.0 < -0.4 { hi } else { col });
                x += 1.0;
            }
        }
        o.push(("STAND_IN", cv(pb.sel_out(0.72).canvas(), "")));
    }
    {
        // 정전 어둠: 숨비 둘레만 보임 · 2px 칸 6계단 고리
        let w = ctx().w;
        let (cw, ch) = ((w * 2.0 + 40.0) as i32, (H * 2.0 + 40.0) as i32);
        let mut c = Canvas::new(cw, ch);
        let (cx, cy) = (cw as f64 / 2.0, ch as f64 / 2.0);
        let mut y = 0;
        while y < ch {
            let mut i = 0;
            while i < cw {
                let t = clamp((hypot(i as f64 + 1.0 - cx, y as f64 + 1.0 - cy) - 26.0) / 64.0, 0.0, 1.0);
                let a = round(round(t * 6.0) / 6.0 * 0.88 * 255.0);
                if a != 0.0 {
                    for (dx, dy) in [(0, 0), (1, 0), (0, 1), (1, 1)] {
                        let (px, py) = (i + dx, y + dy);
                        if py < ch {
                            let p = ((py * cw + px) * 4) as usize;
                            c.d[p] = 6;
                            c.d[p + 1] = 6;
                            c.d[p + 2] = 16;
                            c.d[p + 3] = a as u8;
                        }
                    }
                }
                i += 2;
            }
            y += 2;
        }
        o.push(("DARK_TEX", cv(c, "")));
    }
    o
}

// 처음 한 번: 모든 고정 스프라이트 { 이름: 트리 }
pub fn all() -> String {
    let mut v = chars();
    v.extend(game());
    obj(&v.iter().map(|(k, s)| (*k, s.clone())).collect::<Vec<_>>())
}

// ═════════ 게임 중에 크기별로 처음 쓸 때 굽는 것 ═════════
pub fn crate_() -> String {
    let mut pb = Pb::new(26, 20);
    let (wd, org) = (pal("wood"), pal("org"));
    for y in 6..20 {
        for x in 0..26 {
            pb.set(
                x as f64,
                y as f64,
                if (y - 6) % 5 == 0 {
                    wd[0]
                } else if x < 2 {
                    wd[3]
                } else if x > 23 {
                    wd[1]
                } else {
                    wd[2]
                },
            );
        }
    }
    for (cx, cy) in [(5.0, 6.0), (11.0, 5.0), (17.0, 6.0), (22.0, 6.0), (8.0, 3.0), (15.0, 2.0), (20.0, 3.0)] {
        pb.ellipse(cx, cy, 3.2, 2.8, |a, b| {
            Some(
                org[if sphere_light(a, b) < 0.4 {
                    1
                } else if sphere_light(a, b) < 0.75 {
                    2
                } else {
                    3
                }],
            )
        });
    }
    cv(pb.sel_out(0.72).canvas(), "")
}
// 칼바람 초승달 (hh: 반 높이) → { l: 그린 그대로, r: 뒤집은 것 }
pub fn slash(hh: f64) -> String {
    let (w, h) = (12, (hh * 2.0 + 3.0) as i32);
    let mut pb = Pb::new(w, h);
    let (yel, org) = (pal("yel"), pal("org"));
    let mut j = -hh;
    while j <= hh {
        let t = j / hh;
        let bow = 6.0 * (1.0 - t * t);
        let th = max(1.0, round(3.2 * (1.0 - t * t))) + 1.0;
        let mut k = 0.0;
        while k < th {
            let x = round(2.0 + (6.0 - bow) + k);
            pb.set(
                x,
                j + hh + 1.0,
                if k == 0.0 {
                    hx("#fff4e0")
                } else if k == 1.0 {
                    yel[3]
                } else if k == 2.0 {
                    org[3]
                } else {
                    org[2]
                },
            );
            k += 1.0;
        }
        j += 1.0;
    }
    let r = pb.sel_out(0.72).canvas();
    let f = r.flip();
    obj(&[("l", cv(r, "")), ("r", cv(f, ""))])
}
// 솟는 오름 (H: 높이)
pub fn oreum(hh: f64) -> String {
    let hw = 13.0 + round(hh * 0.3);
    let w = hw * 2.0 + 3.0;
    let mut pb = Pb::new(w as i32, (hh + 4.0) as i32);
    let cx = hw + 1.0;
    let gr = mutes(&["#284a3e", "#30584a", "#3a6852", "#4c7c5e", "#64946c"]);
    let so = pal("soil");
    let mut i = -hw;
    while i <= hw {
        let t = i / hw;
        let a = t.abs();
        let mut top = hh - hh * (1.0 - pow(a, 1.7));
        if hh > 26.0 && a < 0.18 {
            top += (0.18 - a) / 0.18 * 2.4;
        }
        let top = round(top + (hash2(i, hh, 61.0) - 0.5) * 1.2);
        let mut y = max(0.0, top);
        while y < hh + 4.0 {
            let d = y - top;
            let mut l = 0.62 - t * 0.42 + (if d < 2.0 { 0.18 } else { 0.0 }) - (if y > hh - 4.0 { 0.2 } else { 0.0 })
                + (vnoise((cx + i) * 0.3 + y * 0.25, y * 0.12, 62.0) - 0.5) * 0.25;
            if (y + round(i * 0.6)) as i64 % 5 == 0 && d > 2.0 {
                l -= 0.08;
            } // 비스듬한 풀 결
            let mut col = band(&gr, clamp(l, 0.0, 0.999));
            if y >= hh {
                col = so[if y == hh {
                    3
                } else if y == hh + 1.0 {
                    2
                } else {
                    1
                }];
            } // 뚫고 나온 흙
            if d == 0.0 && hash2(i, hh, 63.0) < 0.25 {
                col = gr[4];
            } // 풀잎 끝 반짝
            pb.set(cx + i, y, col);
            y += 1.0;
        }
        i += 1.0;
    }
    cv(pb.sel_out(0.72).canvas(), "")
}
// 치마폭 파도 (오른쪽으로 가는 것 · hi: 높은 파도 · f: 물결 칸)
pub fn tide(hi: bool, f: f64) -> String {
    let t =
        [hx("#0e2e58"), hx("#1a4e86"), hx("#2a72aa"), hx("#3e98c4"), hx("#6cc4dc"), hx("#c8eef4"), hx("#ffffff")].map(|c| mute(c, 0.85));
    let hh = if hi { 46.0 } else { 22.0 };
    let back = if hi { 32.0 } else { 22.0 };
    let uc = if hi { 12.0 } else { 7.0 };
    let gap = if hi { 16.0 } else { 0.0 };
    let br = sin(f / 6.0 * 6.283);
    let r0 = (if hi { 17.0 } else { 9.0 }) + br * 0.5;
    let vc = hh - r0;
    let ph = if hi { 3.2 } else { 3.45 };
    let th0 = if hi { 7.5 } else { 4.6 };
    let r_out = |q: f64| r0 * (1.0 - 0.32 * q / ph);
    let thick = |q: f64| th0 * pow(max(0.0, 1.0 - q / ph), 0.8) + 0.7;
    let top = |u: f64| {
        if u < -back {
            0.0
        } else if hi {
            hh * (1.0 - pow((uc - min(u, uc)) / (uc + back), 2.2))
        } else {
            hh * pow(sin(clamp((u + back) / (uc + back), 0.0, 1.0) * PI / 2.0), 1.25)
        }
    };
    let front = |v: f64| uc + pow(max(0.0, vc - v), 1.25) * if hi { 0.28 } else { 0.32 };
    let (tcx, tcy, trx, tryy) = (uc + r0 * 0.2, vc - r0 * 0.14, r0 * 0.5, r0 * 0.42);
    let u0 = -back - 3.0;
    let w = (uc + r0 + (if hi { 6.0 } else { 10.0 }) - u0).ceil();
    let h = hh + 4.0;
    let ax = -u0;
    let mut pb = Pb::new(w as i32, h as i32);
    let fr = f * 3.1;
    let foam = |x: f64, y: f64, s: f64| vnoise(x * 0.45 + fr, y * 0.45, s);
    for py in 0..h as i32 {
        for px in 0..w as i32 {
            let (pxf, pyf) = (px as f64, py as f64);
            let u = pxf - ax;
            let v = h - 1.0 - pyf;
            let dx = u - uc;
            let dy = v - vc;
            let r = hypot(dx, dy);
            let mut q = atan2(dx, dy);
            if q < -PI / 2.0 {
                q += 2.0 * PI;
            }
            let in_curl = q >= 0.0 && q <= ph;
            let ro = if in_curl { r_out(q) } else { 0.0 };
            let ri = ro - if in_curl { thick(q) } else { 0.0 };
            let mut c = None;
            if in_curl && r <= ro && r >= ri {
                // 입술
                let out = ro - r;
                let up = cos(q);
                if out < (if q < 1.1 { 0.9 } else { 1.2 + (q - 1.1) * 0.9 }) + foam(u, v, 31.0) * 1.5 && q < ph - 0.35 {
                    c = Some(if foam(u, v, 32.0) < 0.62 { t[6] } else { t[5] });
                } else {
                    c = Some(if r - ri < 1.2 {
                        t[2]
                    } else if up > 0.2 {
                        t[4]
                    } else {
                        t[3]
                    });
                }
            } else if in_curl && r < ri && pow((u - tcx) / trx, 2.0) + pow((v - tcy) / tryy, 2.0) < 1.0 {
                // 관 안
                let e = hypot((u - tcx) / trx, (v - tcy) / tryy);
                c = Some(if e > 0.78 && (v > tcy || u < tcx) { t[1] } else { t[0] });
            } else if (u <= uc && v <= top(u)) || (u > uc && u <= front(v) && v < vc) || (in_curl && r < ri) {
                // 몸통 · 앞면
                let d_top = if u <= uc { top(u) - v } else { vc + r0 - v };
                let face_side = u > uc - 2.0 && v < vc + r0 * 0.6;
                if u <= uc && d_top < 1.2 + foam(u, v, 33.0) * 2.2 * clamp((u + back * 0.7) / (uc + back * 0.7), 0.0, 1.0) {
                    c = Some(if foam(u, v, 34.0) < 0.6 { t[6] } else { t[5] });
                } else if face_side {
                    c = Some(if v > vc + r0 * 0.25 {
                        t[4]
                    } else if v > vc - r0 * 0.2 {
                        t[3]
                    } else {
                        t[2]
                    });
                } else {
                    let mut cc = if d_top < 4.0 {
                        t[4]
                    } else if d_top < 9.0 {
                        t[3]
                    } else if d_top < 16.0 {
                        t[2]
                    } else {
                        t[1]
                    };
                    let sl = d_top - (vnoise(u * 0.12 + fr * 0.4, 1.0, 38.0) - 0.5) * 3.0;
                    if u < uc - 3.0
                        && d_top > 3.0
                        && ((sl - 6.5).abs() < 0.5 || (sl - 12.5).abs() < 0.5)
                        && vnoise(u * 0.22 - fr * 0.5, round(sl), 39.0) > 0.48
                    {
                        cc = t[5];
                    }
                    c = Some(cc);
                }
            }
            if !hi
                && c.is_none()
                && u > uc - 3.0
                && u < front(0.0) + 6.0
                && v < 3.5 + foam(u, 0.0, 36.0) * 4.0 * (1.0 - (u - front(0.0) + 2.0).abs() / 11.0)
            {
                c = Some(if foam(u, v, 37.0) < 0.55 { t[6] } else { t[5] });
            } // 낮은 파도 앞발치
            if c.is_some() && hi && v < gap + 2.0 && u > -14.0 {
                let arch_top = if u < 0.0 { gap * max(0.0, 1.0 - pow(u / 14.0, 2.0)).sqrt() } else { gap };
                if v < arch_top {
                    c = None;
                } else if v < arch_top + 1.5 && foam(u, v, 40.0) < 0.5 {
                    c = Some(t[5]);
                }
            } // 굴러서 지나갈 아치
            if let Some(cc) = c {
                pb.set(pxf, pyf, cc);
            }
        }
    }
    let tq = ph;
    let tr = r_out(tq) - thick(tq) * 0.5;
    let tu = uc + sin(tq) * tr;
    let tv = vc + cos(tq) * tr; // 입술 끝 갈퀴
    for k in 0..3 {
        let ang = tq + (k as f64 - 1.0) * 0.5;
        let len = 2.0 + ((k as f64 + f) % 3.0);
        let mut j = 0.0;
        while j <= len {
            let uu = round(tu + sin(ang) * j * 0.8);
            let vv = round(tv + cos(ang) * j * 0.8);
            if !hi || vv >= gap {
                pb.set(uu + ax, h - 1.0 - vv, if j == len { t[5] } else { t[6] });
            }
            j += 1.0;
        }
    }
    let geo = format!(
        "{{\"H\":{},\"back\":{},\"uc\":{},\"gap\":{},\"tip\":[{},{}]}}",
        num(hh),
        num(back),
        num(uc),
        num(gap),
        num(round(tu)),
        num(round(tv))
    );
    cv(pb.sel_out(0.62).canvas(), &format!("\"ax\":{},\"geo\":{}", num(ax), geo))
}
// 날씨 아이콘 (id: 0 태풍 · 1 귤 풍년 · 2 참새 · 3 정상 · 4 그 밖)
pub fn wx(id: i32) -> String {
    let mut pb = Pb::new(10, 10);
    let (y, o, s, wh, leaf) = (pal("yel"), pal("org"), pal("stone"), pal("cloth"), pal("leaf"));
    let pat = |pb: &mut Pb, rows: &[&str], mp: &[(char, Col)]| {
        for (yy, r) in rows.iter().enumerate() {
            for (xx, ch) in r.chars().enumerate() {
                if let Some(&(_, c)) = mp.iter().find(|(k, _)| *k == ch) {
                    pb.set(xx as f64, yy as f64, c);
                }
            }
        }
    };
    match id {
        0 => pat(
            &mut pb,
            &[
                "..........",
                "....+++...",
                ".......+..",
                "....##.+..",
                "...#..#...",
                "...#..#...",
                "..+.##....",
                "..+.......",
                "...+++....",
                "..........",
            ],
            &[('#', wh[3]), ('+', wh[1])],
        ),
        1 => {
            pb.ellipse(5.0, 6.0, 3.6, 3.2, |nx, ny| {
                Some(
                    o[if sphere_light(nx, ny) < 0.5 {
                        1
                    } else if sphere_light(nx, ny) < 0.8 {
                        2
                    } else {
                        3
                    }],
                )
            });
            pb.set(5.0, 2.0, leaf[2]);
            pb.set(6.0, 2.0, leaf[3]);
        }
        2 => {
            let k = mutes(&["#8a5a3a", "#5a3a28", "#8c4a2c", "#e6dac2", "#261d1c", "#f4efe4"]);
            pb.ellipse(4.5, 6.2, 3.2, 2.3, |_, ny| Some(if ny > 0.2 { k[3] } else { k[0] }));
            pb.ellipse(7.0, 4.2, 1.9, 1.8, |_, ny| Some(if ny < -0.2 { k[2] } else { k[5] }));
            pb.set(7.0, 4.0, k[4]);
            pb.set(9.0, 4.0, k[4]);
            pb.set(7.0, 5.0, k[4]);
            pb.set(1.0, 6.0, k[1]);
            pb.set(0.0, 7.0, k[1]);
            pb.limb(4.0, 5.0, 2.0, 2.0, 1.0, k[1]);
        }
        3 => {
            for yy in 3..9 {
                for xx in 2..8 {
                    pb.set(
                        xx as f64,
                        yy as f64,
                        if xx == 2 {
                            o[3]
                        } else if xx == 7 {
                            o[1]
                        } else {
                            o[2]
                        },
                    );
                }
            }
            pb.set(4.0, 2.0, s[2]);
            pb.set(5.0, 2.0, s[2]);
            pb.set(3.0, 9.0, s[1]);
            pb.set(6.0, 9.0, s[1]);
        }
        _ => {
            for (dx, dy) in [(0.0, -2.0), (2.0, 0.0), (0.0, 2.0), (-2.0, 0.0), (1.0, -1.0), (-1.0, 1.0), (1.0, 1.0), (-1.0, -1.0)] {
                pb.set(5.0 + dx, 4.0 + dy, y[2]);
            }
            pb.set(5.0, 4.0, o[2]);
            pb.set(5.0, 7.0, leaf[2]);
            pb.set(5.0, 8.0, leaf[1]);
        }
    }
    cv(pb.sel_out(0.72).canvas(), "")
}
