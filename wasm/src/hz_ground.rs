// 땅 · 화면 끝에서 오는 장애물 (원래 game.js): 솟는 돌하르방 · 꼬마 하르방 · 화산탄/낙석 · 조랑말 · 날아오는 돌 · 테왁 · 캐리어 · 똥돼지 · 렌터카
//  모듈마다 필드 목록(SCHEMA) · 움직임(update → 살아 있으면 true) · 판정 상자(boxes) · 맞았을 때(on)
use crate::draw::*;
use crate::game::*;
use crate::js::*;

// ── 땅에서 솟는 돌하르방 (부술 수 없음) ──
pub mod rise {
    use super::*;
    pub const SCHEMA: Schema = &[
        ("x", Ty::Num),
        ("warn", Ty::Num),
        ("hold", Ty::Num),
        ("t", Ty::Num),
        ("phase", Ty::Enum(&["warn", "rise", "hold", "sink"])),
        ("up", Ty::Num),
        ("chain", Ty::Bool),
        ("idx", Ty::Num),
    ];
    const X: usize = 0;
    const WARN: usize = 1;
    const HOLD: usize = 2;
    const T: usize = 3;
    const PHASE: usize = 4;
    const UP: usize = 5;
    const CHAIN: usize = 6;
    const IDX: usize = 7;
    const P_WARN: f64 = 0.0;
    const P_RISE: f64 = 1.0;
    const P_HOLD: f64 = 2.0;
    const P_SINK: f64 = 3.0;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        f[T] += dt;
        let chain = f[CHAIN] != 0.0;
        if f[PHASE] == P_WARN {
            if random() < dt * if chain { 6.0 } else { 26.0 } {
                let x = f[X] + rand(-8.0, 8.0);
                let vx = rand(-12.0, 12.0);
                let vy = rand(-80.0, -30.0);
                let col = pick(&[pc("soil", 2), pc("soil", 3), pc("stone", 2)]);
                let size = randi(1.0, 2.0);
                Fx { vx, vy, grav: 340.0, life: 0.45, col, size, ..Fx::new("px", x, GROUND + 1.0) }.emit();
            }
            if !chain && random() < dt * 8.0 {
                sfx("crack");
            }
            light(f[X], GROUND, 4.0 + 12.0 * (f[T] / f[WARN]), hexc(0xffb040), 0.5);
            if f[T] >= f[WARN] {
                f[PHASE] = P_RISE;
                f[T] = 0.0;
                let loud = !chain || f[IDX] as i64 % 4 == 0; // 행렬은 네 번째마다만 크게
                sfx("rise");
                if loud {
                    shake(if chain { 0.1 } else { 0.25 });
                    burst(f[X], GROUND, 14.0, &[pc("soil", 2), pc("soil", 3), pc("stone", 2), pc("stone", 3)], 110.0, 0.7, 360.0, "chunk");
                }
                dust(f[X] - 8.0, GROUND, 4.0, -1.0, 1.0);
                dust(f[X] + 8.0, GROUND, 4.0, 1.0, 1.0);
            }
        } else if f[PHASE] == P_RISE {
            f[UP] = min(1.0, ease_back(f[T] / 0.16));
            if f[T] >= 0.16 {
                f[PHASE] = P_HOLD;
                f[T] = 0.0;
                f[UP] = 1.0;
            }
        } else if f[PHASE] == P_HOLD {
            if f[T] >= f[HOLD] {
                f[PHASE] = P_SINK;
                f[T] = 0.0;
            }
        } else {
            f[UP] = max(0.0, 1.0 - f[T] / 0.4);
            if random() < dt * 30.0 {
                dust(f[X] + rand(-9.0, 9.0), GROUND, 1.0, 0.0, 0.0);
            }
            if f[UP] <= 0.0 {
                return false;
            }
        }
        true
    }
    pub fn boxes(f: &[f64]) -> Boxes {
        if f[PHASE] == P_WARN || (f[PHASE] == P_SINK && f[UP] < 0.5) {
            return vec![];
        }
        let h = 48.0 * f[UP];
        vec![[f[X] - 9.0, GROUND - h, 18.0, h]]
    }
    pub fn on(_f: &mut [f64], _ev: i32, sx: f64, sy: f64) -> bool {
        spark(sx, sy);
        sfx("tink");
        true
    }
    // 그리기 전용: 땅이 갈라지는 금 [dx, dy, 순서] 묶음
    pub const DRAW: Schema = &[("crack", Ty::List)];
    const CRACK: usize = SCHEMA.len();
    // 솟을 자리: 달아오르는 땅 · 점점 벌어지는 금
    pub fn decal(f: &mut [f64], d: &mut Draw) {
        let warn = f[PHASE] == P_WARN;
        let k = if warn { clamp(f[T] / f[WARN], 0.0, 1.0) } else { 1.0 };
        let n = (k * 10.0).ceil();
        let glow = warn && odd(f[T] * 14.0);
        if warn {
            d.rgba(255.0, 150.0, 60.0, 0.15 + 0.35 * k);
            d.rect(f[X] - 9.0, GROUND - 1.0, 19.0, 2.0);
        }
        let col = hexc(if !warn {
            0x1a0c0c
        } else if glow {
            0xffe08a
        } else {
            0xff9a3a
        });
        for c in list(f, CRACK).chunks(3) {
            if c[2] < n {
                d.style(col);
                d.rect(f[X] + c[0], GROUND + c[1], 1.0, 2.0);
            }
        }
    }
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        if f[PHASE] == P_WARN {
            return;
        }
        let img = named("HAREUBANG");
        let over = if f[PHASE] == P_RISE { round(3.0 * (1.0 - clamp(f[T] / 0.16, 0.0, 1.0))) } else { 0.0 };
        d.save();
        d.clip(-20.0, -60.0, ctx().w + 40.0, GROUND + 62.0);
        d.img(img, round(f[X] - img.w() / 2.0), round(GROUND + 2.0 - img.h() * f[UP]) - over);
        d.restore();
    }
}

// ── 꼬마 하르방: 통통 튀며 건너옴 (밟거나 맞히면 부서짐) ──
pub mod hopper {
    use super::*;
    pub const SCHEMA: Schema = &[
        ("dir", Ty::Num),
        ("x", Ty::Num),
        ("y", Ty::Num),
        ("t", Ty::Num),
        ("vx", Ty::Num),
        ("vy", Ty::Num),
        ("hop", Ty::Num),
        ("sq", Ty::Num),
        ("dead", Ty::Bool),
    ];
    const DIR: usize = 0;
    const X: usize = 1;
    const Y: usize = 2;
    const T: usize = 3;
    const VX: usize = 4;
    const VY: usize = 5;
    const HOP: usize = 6;
    const SQ: usize = 7;
    const DEAD: usize = 8;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        let w = ctx().w;
        let dir = f[DIR];
        f[T] += dt;
        if if dir > 0.0 { f[X] < -10.0 } else { f[X] > w + 10.0 } {
            // 화면 밖: 끝 흙이 들썩이며 예고
            f[X] += f[VX] * dt;
            if random() < dt * 14.0 {
                let x = if dir > 0.0 { rand(2.0, 8.0) } else { w - rand(2.0, 8.0) };
                let vx = dir * rand(5.0, 20.0);
                let vy = -rand(30.0, 70.0);
                let col = pick(&[pc("soil", 3), pc("stone", 3)]);
                Fx { vx, vy, grav: 400.0, life: 0.3, size: 1.0, col, ..Fx::new("chunk", x, GROUND - 1.0) }.emit();
            }
            return f[DEAD] == 0.0;
        }
        f[VY] += 760.0 * dt;
        f[X] += f[VX] * dt;
        f[Y] += f[VY] * dt;
        if f[Y] >= GROUND {
            f[Y] = GROUND;
            f[VY] = -f[HOP] * rand(0.85, 1.1);
            f[SQ] = 0.12;
            if f[X] > 0.0 && f[X] < w {
                dust(f[X], GROUND, 3.0, 0.0, 0.0);
                sfx("hop");
            }
        }
        f[SQ] -= dt;
        f[DEAD] == 0.0 && if dir > 0.0 { f[X] < w + 30.0 } else { f[X] > -30.0 }
    }
    pub fn boxes(f: &[f64]) -> Boxes {
        vec![[f[X] - 7.0, f[Y] - 20.0, 14.0, 19.0]]
    }
    pub fn on(f: &mut [f64], ev: i32, _sx: f64, _sy: f64) -> bool {
        f[DEAD] = 1.0;
        burst(f[X], f[Y] - 10.0, 16.0, &[pc("stone", 1), pc("stone", 2), pc("stone", 3), pc("stone", 4)], 120.0, 0.7, 420.0, "chunk");
        dust(f[X], f[Y], 5.0, 0.0, 1.0);
        sfx("shatter");
        reward(if ev == EV_STOMP { "stompKill" } else { "shotKill" }, f[X], f[Y] - 26.0);
        true
    }
    pub const DRAW: Schema = &[];
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        let dir = f[DIR];
        if if dir > 0.0 { f[X] < -10.0 } else { f[X] > ctx().w + 10.0 } {
            // 화면 밖: 끝에 꺾쇠 예고
            if even(f[T] * 10.0) {
                d.chev(dir, GROUND - 10.0, pc("red", 3));
            }
            return;
        }
        let img = named("MINI").side(dir > 0.0);
        let air = GROUND - f[Y];
        d.shadow(f[X], clamp(14.0 - air / 5.0, 5.0, 14.0));
        d.img(img, round(f[X] - img.w() / 2.0), round(f[Y] + 1.0 - img.h()));
    }
}

// ── 한라산 화산탄 (동굴에서는 천장에서 떨어지는 낙석) ──
pub mod meteor {
    use super::*;
    pub const SCHEMA: Schema = &[
        ("tx", Ty::Num),
        ("rock", Ty::Bool),
        ("sx", Ty::Num),
        ("sy", Ty::Num),
        ("fall", Ty::Num),
        ("t", Ty::Num),
        ("phase", Ty::Enum(&["fall", "boom", "lava"])),
        ("x", Ty::Num),
        ("y", Ty::Num),
        ("chain", Ty::Bool),
    ];
    const TX: usize = 0;
    const ROCK: usize = 1;
    const SX: usize = 2;
    const SY: usize = 3;
    const FALL: usize = 4;
    const T: usize = 5;
    const PHASE: usize = 6;
    const X: usize = 7;
    const Y: usize = 8;
    const CHAIN: usize = 9;
    const P_FALL: f64 = 0.0;
    const P_BOOM: f64 = 1.0;
    const P_LAVA: f64 = 2.0;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        f[T] += dt;
        let rock = f[ROCK] != 0.0;
        let tx = f[TX];
        if f[PHASE] == P_FALL {
            let e = pow(clamp(f[T] / f[FALL], 0.0, 1.0), 1.6);
            f[X] = lerp(f[SX], tx, e);
            f[Y] = lerp(f[SY], GROUND - 5.0, e);
            if rock {
                if random() < 0.4 {
                    let x = f[X] + rand(-3.0, 3.0);
                    let vx = rand(-8.0, 8.0);
                    let vy = rand(-10.0, 10.0);
                    let col = pick(&[hexc(0x3a3440), hexc(0x5a5260)]);
                    Fx { vx, vy, life: 0.3, size: 1.0, col, ..Fx::new("chunk", x, f[Y] - 4.0) }.emit();
                }
            } else {
                if random() < 0.6 {
                    let x = f[X] + rand(-3.0, 3.0);
                    let y = f[Y] + rand(-3.0, 3.0);
                    let vx = rand(-10.0, 10.0);
                    let vy = rand(-30.0, -8.0);
                    let life = rand(0.2, 0.45);
                    let col = pick(&[pc("yel", 3), pc("yel", 2), pc("org", 3), pc("org", 2)]);
                    let size = randi(1.0, 3.0);
                    Fx { vx, vy, life, col, size, ..Fx::new("px", x, y) }.emit();
                }
                if random() < dt * 30.0 {
                    let vx = rand(-6.0, 6.0);
                    let size = randi(0.0, 2.0);
                    Fx { vx, vy: -12.0, life: 0.7, size, ..Fx::new("smoke", f[X], f[Y] - 4.0) }.emit();
                }
                light(f[X], f[Y], 26.0, hexc(0xff9040), 0.9);
            }
            if f[T] >= f[FALL] {
                f[PHASE] = P_BOOM;
                f[T] = 0.0;
                sfx("boom");
                impact(tx, GROUND - 3.0, if rock { pc("stone", 3) } else { pc("org", 3) }, 1.0, false);
                if (tx - ctx().px).abs() < 36.0 && f[CHAIN] == 0.0 {
                    hitstop(0.02, 0.6);
                } // 바로 옆에 떨어지면 짧게 멈칫
                if rock {
                    burst(
                        tx,
                        GROUND - 2.0,
                        14.0,
                        &[hexc(0x2a2630), hexc(0x3e3846), hexc(0x5a5262), hexc(0x7a7282)],
                        120.0,
                        0.7,
                        400.0,
                        "chunk",
                    );
                    for _ in 0..6 {
                        let x = tx + rand(-10.0, 10.0);
                        let vx = rand(-30.0, 30.0);
                        let vy = rand(-20.0, -5.0);
                        let life = rand(0.5, 0.9);
                        let size = randi(1.0, 2.0);
                        Fx { vx, vy, life, size, ..Fx::new("puff", x, GROUND - 4.0) }.emit();
                    }
                } else {
                    burst(
                        tx,
                        GROUND - 2.0,
                        16.0,
                        &[hexc(0x3a2a2a), hexc(0x5a4040), pc("org", 3), pc("yel", 3)],
                        130.0,
                        0.8,
                        400.0,
                        "chunk",
                    );
                    Fx { life: 0.35, col: pc("yel", 3), ..Fx::new("ring", tx, GROUND - 2.0) }.emit();
                    for _ in 0..6 {
                        let x = tx + rand(-8.0, 8.0);
                        let vx = rand(-20.0, 20.0);
                        let vy = rand(-30.0, -10.0);
                        let life = rand(0.6, 1.0);
                        let size = randi(1.0, 3.0);
                        Fx { vx, vy, life, size, ..Fx::new("smoke", x, GROUND - 6.0) }.emit();
                    }
                    scorch(tx, 6.0);
                }
            }
        } else if f[PHASE] == P_BOOM {
            if !rock {
                light(tx, GROUND - 8.0, 60.0 * (1.0 - f[T] / 0.3), hexc(0xffc060), 1.0);
            }
            if f[T] >= 0.3 {
                if rock {
                    return false;
                }
                f[PHASE] = P_LAVA;
                f[T] = 0.0;
            }
        } else {
            light(tx, GROUND, 22.0, hexc(0xff6020), 0.7 * (1.0 - f[T] / 1.5));
            if random() < dt * 6.0 {
                let x = tx + rand(-7.0, 7.0);
                let vy = rand(-30.0, -10.0);
                let col = pick(&[pc("yel", 3), pc("org", 3)]);
                Fx { vy, grav: 60.0, life: 0.4, col, ..Fx::new("px", x, GROUND - 1.0) }.emit();
            }
            if f[T] >= 1.5 {
                return false;
            }
        }
        true
    }
    pub fn boxes(f: &[f64]) -> Boxes {
        if f[PHASE] == P_FALL {
            return if f[Y] > -VOFF + 10.0 { vec![[f[X] - 5.0, f[Y] - 5.0, 10.0, 10.0]] } else { vec![] };
        }
        if f[PHASE] == P_BOOM {
            return if f[T] < 0.14 { vec![[f[TX] - 15.0, GROUND - 18.0, 30.0, 18.0]] } else { vec![] };
        }
        if f[T] < 1.2 {
            vec![[f[TX] - 10.0, GROUND - 3.0, 20.0, 3.0]]
        } else {
            vec![]
        }
    }
    // 그리기 전용: 낙석 모양 번호 (처음 그릴 때 FALLROCKS에서 하나 고름)
    pub const DRAW: Schema = &[("rsI", Ty::Num)];
    const RS: usize = SCHEMA.len();
    // 떨어질 자리 표시 · 식어 가는 용암
    pub fn decal(f: &mut [f64], d: &mut Draw) {
        let (tx, t) = (f[TX], f[T]);
        let rock = f[ROCK] != 0.0;
        if f[PHASE] == P_FALL {
            if f[Y] < -VOFF + 40.0 {
                d.top_mark(f[X], t);
            }
            let k = clamp(t / f[FALL], 0.0, 1.0);
            let rx = 15.0;
            let rk = round(rx * k);
            let blink = odd(t * (6.0 + k * 18.0));
            if rock {
                // 동굴: 먹 받침 (어두운 바닥에서도 보이게)
                d.style(INK);
                for s in [-1.0, 1.0] {
                    d.rect(tx + s * rx - 1.0, GROUND - 3.0, 3.0, 7.0);
                }
                d.rect(tx - rk - 1.0, GROUND - 1.0, rk * 2.0 + 3.0, 4.0);
            }
            d.style(if blink { pc("red", 2) } else { pc("yel", 2) });
            for s in [-1.0, 1.0] {
                d.rect(tx + s * rx, GROUND - 1.0, 1.0, 3.0);
                d.rect(tx + s * (rx - 1.0), GROUND - 2.0, 1.0, 1.0);
                d.rect(tx + s * (rx - 1.0), GROUND + 2.0, 1.0, 1.0);
            }
            if rock {
                d.rgba(255.0, if blink { 120.0 } else { 200.0 }, 70.0, 0.35 + k * 0.45);
            } else {
                d.rgba(200.0, 40.0, 20.0, 0.15 + k * 0.35);
            }
            d.rect(tx - rk, GROUND, rk * 2.0 + 1.0, 2.0);
        } else if f[PHASE] == P_LAVA {
            let cool = if t > 1.1 { (t - 1.1) / 0.4 } else { 0.0 };
            d.style(hexc(if cool > 0.5 { 0x4a2a28 } else { 0xc83a18 }));
            d.rect(tx - 11.0, GROUND, 23.0, 2.0);
            d.rect(tx - 9.0, GROUND - 1.0, 19.0, 1.0);
            d.style(if cool > 0.5 {
                hexc(0x6a3a30)
            } else if odd(t * 6.0) {
                pc("yel", 2)
            } else {
                pc("org", 3)
            });
            d.rect(tx - 7.0, GROUND, 15.0, 1.0);
        }
    }
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        let (tx, t) = (f[TX], f[T]);
        let rock = f[ROCK] != 0.0;
        if f[PHASE] == P_FALL {
            if rock {
                // 낙석은 하나씩 다른 돌이 구르며 떨어짐
                let rocks = named("FALLROCKS");
                if f[RS].is_nan() {
                    f[RS] = (random() * rocks.len()).floor();
                }
                let fr = rocks.at(f[RS]).at((t * 9.0 + tx).floor() % 4.0);
                d.img(fr, round(f[X] - fr.w() / 2.0), round(f[Y] - fr.h() / 2.0));
            } else {
                d.img(named("METEOR"), round(f[X] - 7.0), round(f[Y] - 7.0));
            }
        } else if f[PHASE] == P_BOOM && rock {
            let k = t / 0.3;
            d.alpha(1.0 - k);
            d.disc(tx, GROUND - 5.0, round(6.0 + k * 12.0), hexc(0x5a5262));
            d.alpha(1.0);
        } else if f[PHASE] == P_BOOM {
            let k = t / 0.3;
            let r = round(5.0 + k * 16.0);
            if k < 0.3 {
                d.disc(tx, GROUND - 7.0, r + 2.0, hexc(0xfff4e0));
            }
            d.disc(tx, GROUND - 7.0, r, if k < 0.5 { pc("yel", 3) } else { pc("org", 3) });
            d.disc(tx, GROUND - 7.0, max(1.0, r - 5.0), if k < 0.5 { hexc(0xfff4e0) } else { pc("yel", 2) });
        }
    }
}

// ── 조랑말 떼: 밟으면 튕겨 오름 ──
pub mod pony {
    use super::*;
    pub const SCHEMA: Schema = &[("dir", Ty::Num), ("x", Ty::Num), ("speed", Ty::Num), ("anim", Ty::Num)];
    const DIR: usize = 0;
    const X: usize = 1;
    const SPEED: usize = 2;
    const ANIM: usize = 3;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        let w = ctx().w;
        let dir = f[DIR];
        f[X] += dir * f[SPEED] * dt;
        f[ANIM] += dt * f[SPEED] / 11.0;
        if f[X] > -10.0 && f[X] < w + 10.0 {
            if random() < dt * 16.0 {
                dust(f[X] - dir * 12.0, GROUND, 1.0, -dir, 0.0);
            }
            sfx("gallop");
        }
        if dir > 0.0 {
            f[X] < w + 40.0
        } else {
            f[X] > -40.0
        }
    }
    pub fn boxes(f: &[f64]) -> Boxes {
        vec![[f[X] - 12.0, GROUND - 15.0, 24.0, 14.0]]
    }
    pub fn on(_f: &mut [f64], _ev: i32, sx: f64, sy: f64) -> bool {
        spark(sx, sy);
        sfx("tink");
        true
    }
    pub const DRAW: Schema = &[];
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        let fr = named("PONY").at(f[ANIM].floor() % 6.0).side(f[DIR] > 0.0);
        d.shadow(f[X], 22.0);
        d.img(fr, round(f[X] - fr.ax()), round(GROUND - fr.ay()));
    }
}

// ── 바람에 날아오는 돌 ──
pub mod pebble {
    use super::*;
    pub const SCHEMA: Schema = &[
        ("dir", Ty::Num),
        ("x", Ty::Num),
        ("y", Ty::Num),
        ("y0", Ty::Num),
        ("vx", Ty::Num),
        ("ph", Ty::Num),
        ("t", Ty::Num),
        ("dead", Ty::Bool),
    ];
    const DIR: usize = 0;
    const X: usize = 1;
    const Y: usize = 2;
    const Y0: usize = 3;
    const VX: usize = 4;
    const PH: usize = 5;
    const T: usize = 6;
    const DEAD: usize = 7;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        let w = ctx().w;
        f[T] += dt;
        f[X] += f[VX] * dt;
        if f[Y0].is_nan() {
            f[Y0] = f[Y];
        } // 처음 높이 (JS의 y0 ?? y)
        f[Y] = f[Y0] + sin(f[T] * 14.0 + f[PH]) * 1.0;
        f[DEAD] == 0.0 && if f[DIR] > 0.0 { f[X] < w + 10.0 } else { f[X] > -10.0 }
    }
    pub fn boxes(f: &[f64]) -> Boxes {
        vec![[f[X] - 3.0, f[Y] - 3.0, 6.0, 5.0]]
    }
    pub fn on(f: &mut [f64], _ev: i32, _sx: f64, _sy: f64) -> bool {
        f[DEAD] = 1.0;
        burst(f[X], f[Y], 6.0, &[pc("stone", 3), pc("stone", 4)], 60.0, 0.4, 300.0, "chunk");
        reward("shatter", f[X], f[Y] - 8.0);
        true
    }
    // 그리기 전용: 데굴데굴 도는 빠르기 (모양은 이 돌의 spr 네 장)
    pub const DRAW: Schema = &[("spin", Ty::Num)];
    const SPIN: usize = SCHEMA.len();
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        let dir = f[DIR];
        if if dir > 0.0 { f[X] < -4.0 } else { f[X] > ctx().w + 4.0 } {
            if even(f[T] * 12.0) {
                d.chev(dir, f[Y], pc("red", 3));
            }
            return;
        }
        d.rgba(255.0, 244.0, 224.0, 0.6);
        d.rect(round(f[X] - dir * 10.0 - 3.0), round(f[Y] - 1.0), 6.0, 1.0);
        d.rect(round(f[X] - dir * 17.0 - 2.0), round(f[Y] + 1.0), 4.0, 1.0);
        let fr = own().at((((f[T] * f[SPIN] + f[PH]).floor() * dir) % 4.0 + 4.0) % 4.0);
        d.img(fr, round(f[X] - fr.w() / 2.0), round(f[Y] - fr.h() / 2.0));
    }
}

// ── 굴러오는 테왁 ──
pub mod tewak {
    use super::*;
    pub const SCHEMA: Schema =
        &[("dir", Ty::Num), ("x", Ty::Num), ("y", Ty::Num), ("vx", Ty::Num), ("vy", Ty::Num), ("t", Ty::Num), ("dead", Ty::Bool)];
    const DIR: usize = 0;
    const X: usize = 1;
    const Y: usize = 2;
    const VX: usize = 3;
    const VY: usize = 4;
    const T: usize = 5;
    const DEAD: usize = 6;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        let w = ctx().w;
        let dir = f[DIR];
        f[T] += dt;
        f[X] += f[VX] * dt;
        if if dir > 0.0 { f[X] < -8.0 } else { f[X] > w + 8.0 } {
            return f[DEAD] == 0.0;
        }
        f[VY] += 620.0 * dt;
        f[Y] += f[VY] * dt;
        if f[Y] >= GROUND {
            f[Y] = GROUND;
            f[VY] = -rand(130.0, 180.0);
        }
        f[DEAD] == 0.0 && if dir > 0.0 { f[X] < w + 14.0 } else { f[X] > -14.0 }
    }
    pub fn boxes(f: &[f64]) -> Boxes {
        vec![[f[X] - 5.0, f[Y] - 11.0, 10.0, 10.0]]
    }
    pub fn on(f: &mut [f64], _ev: i32, _sx: f64, _sy: f64) -> bool {
        f[DEAD] = 1.0;
        burst(f[X], f[Y] - 6.0, 10.0, &[pc("org", 2), pc("org", 3), hexc(0xffffff)], 70.0, 0.4, 260.0, "px");
        reward("shatter", f[X], f[Y] - 14.0);
        true
    }
    pub const DRAW: Schema = &[];
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        let dir = f[DIR];
        if if dir > 0.0 { f[X] < -6.0 } else { f[X] > ctx().w + 6.0 } {
            if even(f[T] * 12.0) {
                d.chev(dir, GROUND - 14.0, pc("org", 3));
            }
            return;
        }
        d.shadow(f[X], 9.0);
        let img = named("TEWAK").at((((f[X] / 6.0).floor() * dir) % 4.0 + 4.0) % 4.0);
        d.img(img, round(f[X] - 6.0), round(f[Y] - 11.0));
    }
}

// ── ᄒᆞᆫ저옵서예~: 관광객 캐리어 (밟으면 뚜껑이 열리며 짐이 와르르) ──
pub mod suitcase {
    use super::*;
    pub const SCHEMA: Schema = &[
        ("dir", Ty::Num),
        ("x", Ty::Num),
        ("y", Ty::Num),
        ("vy", Ty::Num),
        ("speed", Ty::Num),
        ("hop", Ty::Bool),
        ("rot", Ty::Num),
        ("sw", Ty::Num),
        ("sh", Ty::Num),
        ("dead", Ty::Bool),
    ];
    const DIR: usize = 0;
    const X: usize = 1;
    const Y: usize = 2;
    const VY: usize = 3;
    const SPEED: usize = 4;
    const HOP: usize = 5;
    const ROT: usize = 6;
    const SW: usize = 7;
    const SH: usize = 8;
    const DEAD: usize = 9;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        let w = ctx().w;
        let dir = f[DIR];
        f[X] += dir * f[SPEED] * dt;
        f[ROT] += dt * 18.0;
        if f[HOP] != 0.0 {
            f[VY] += 700.0 * dt;
            f[Y] += f[VY] * dt;
            if f[Y] >= GROUND {
                f[Y] = GROUND;
                f[VY] = -f[VY].abs() * 0.22;
                if f[VY].abs() < 25.0 {
                    f[VY] = 0.0;
                    f[HOP] = 0.0;
                }
                dust(f[X], GROUND, 2.0, 0.0, 0.0);
            }
        }
        if f[X] > -10.0 && f[X] < w + 10.0 && random() < dt * 10.0 {
            Fx { vx: -dir * 20.0, vy: -10.0, life: 0.25, size: 1.0, ..Fx::new("puff", f[X] - dir * 6.0, GROUND) }.emit();
        }
        f[DEAD] == 0.0 && if dir > 0.0 { f[X] < w + 30.0 } else { f[X] > -30.0 }
    }
    pub fn boxes(f: &[f64]) -> Boxes {
        vec![[f[X] - f[SW] / 2.0 + 2.0, f[Y] - f[SH] + 6.0, f[SW] - 4.0, f[SH] - 7.0]]
    }
    pub fn on(f: &mut [f64], ev: i32, _sx: f64, _sy: f64) -> bool {
        f[DEAD] = 1.0;
        let cols = [muted(0xf4f0e0), muted(0xe87a9a), muted(0x4aa3ec), muted(0xf2c84a)];
        burst(f[X], f[Y] - 10.0, 16.0, &cols, 110.0, 0.6, 360.0, "chunk");
        sfx("shatter");
        reward(if ev == EV_STOMP { "stompKill" } else { "shatter" }, f[X], f[Y] - 20.0);
        true
    }
    // 그리기 전용: 캐리어 모양 번호
    pub const DRAW: Schema = &[("k", Ty::Num)];
    const K: usize = SCHEMA.len();
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        let s = named("SUITCASES").at(f[K]).side(f[DIR] <= 0.0); // 오른쪽으로 가면 왼쪽 그림 (손잡이가 뒤로)
        d.shadow(f[X], s.w() - 2.0);
        d.img(s, round(f[X] - s.w() / 2.0), round(f[Y] - s.h() + 3.0));
    }
}

// ── 똥돼지 질주: 가까워지면 펄쩍 · 밟으면 등을 디딤돌 삼아 튀어 오름 ──
pub mod pig {
    use super::*;
    pub const SCHEMA: Schema = &[
        ("dir", Ty::Num),
        ("x", Ty::Num),
        ("y", Ty::Num),
        ("vy", Ty::Num),
        ("speed", Ty::Num),
        ("anim", Ty::Num),
        ("leap", Ty::Bool),
        ("leaped", Ty::Bool),
        ("squash", Ty::Num),
        ("dead", Ty::Bool),
    ];
    const DIR: usize = 0;
    const X: usize = 1;
    const Y: usize = 2;
    const VY: usize = 3;
    const SPEED: usize = 4;
    const ANIM: usize = 5;
    const LEAP: usize = 6;
    const LEAPED: usize = 7;
    const SQUASH: usize = 8;
    const DEAD: usize = 9;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        let c = ctx();
        let dir = f[DIR];
        f[X] += dir * f[SPEED] * dt;
        f[ANIM] += dt * f[SPEED] / 12.0;
        if f[LEAP] != 0.0 && f[LEAPED] == 0.0 && (f[X] - c.px).abs() < 130.0 {
            f[LEAPED] = 1.0;
            f[VY] = -230.0;
            sfx("oink");
            dust(f[X], GROUND, 4.0, 0.0, 1.0);
            Fx { size: 5.0, life: 0.15, col: pc("yel", 3), ..Fx::new("flare", f[X], GROUND - 18.0) }.emit();
        }
        if f[Y] < GROUND || f[VY] < 0.0 {
            f[VY] += 760.0 * dt;
            f[Y] += f[VY] * dt;
            if f[Y] >= GROUND {
                f[Y] = GROUND;
                f[VY] = 0.0;
                dust(f[X], GROUND, 3.0, 0.0, 0.0);
            }
        }
        if f[X] > -10.0 && f[X] < c.w + 10.0 && random() < dt * 18.0 {
            dust(f[X] - dir * 10.0, GROUND, 1.0, -dir, 0.0);
        }
        f[DEAD] == 0.0 && if dir > 0.0 { f[X] < c.w + 30.0 } else { f[X] > -30.0 }
    }
    pub fn boxes(f: &[f64]) -> Boxes {
        vec![[f[X] - 11.0, f[Y] - 14.0, 22.0, 12.0]]
    }
    pub fn on(f: &mut [f64], ev: i32, sx: f64, sy: f64) -> bool {
        if ev == EV_BOUNCE {
            sfx("oink");
            f[SQUASH] = 0.15;
        } else {
            spark(sx, sy);
            sfx("oink");
        }
        true
    }
    pub const DRAW: Schema = &[];
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        let fr = named("PIG").at(f[ANIM].floor() % 4.0).side(f[DIR] > 0.0);
        let bob = if f[LEAP] != 0.0 && f[LEAPED] == 0.0 { -round(sin(f[ANIM] * 1.57).abs() * 3.0) } else { 0.0 };
        d.shadow(f[X], 20.0);
        d.img(fr, round(f[X] - fr.ax()), round(f[Y] - fr.ay()) + bob);
    }
}

// ── 렌터카 대행진: 숨비 가까이서 빵! ──
pub mod rentcar {
    use super::*;
    pub const SCHEMA: Schema = &[("dir", Ty::Num), ("x", Ty::Num), ("speed", Ty::Num), ("honk", Ty::Bool), ("t", Ty::Num)];
    const DIR: usize = 0;
    const X: usize = 1;
    const SPEED: usize = 2;
    const HONK: usize = 3;
    const T: usize = 4;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        let c = ctx();
        let dir = f[DIR];
        f[T] += dt;
        f[X] += dir * f[SPEED] * dt;
        if f[HONK] == 0.0 && f[X] > 12.0 && f[X] < c.w - 12.0 && (f[X] - c.px).abs() < 120.0 {
            f[HONK] = 1.0;
            sfx("honk");
            for i in 0..3 {
                let y = GROUND - 10.0 + (i - 1) as f64 * 3.0;
                Fx { vx: dir * 120.0, life: 0.12, len: 4.0, col: pc("yel", 3), ..Fx::new("streak", f[X] + dir * 18.0, y) }.emit();
            }
        }
        if f[X] > -10.0 && f[X] < c.w + 10.0 && random() < dt * 20.0 {
            Fx { vx: -dir * 30.0, vy: -8.0, life: 0.4, size: 1.0, ..Fx::new("puff", f[X] - dir * 16.0, GROUND - 3.0) }.emit();
        }
        if dir > 0.0 {
            f[X] < c.w + 40.0
        } else {
            f[X] > -40.0
        }
    }
    pub fn boxes(f: &[f64]) -> Boxes {
        vec![[f[X] - 14.0, GROUND - 15.0, 28.0, 14.0]]
    }
    pub fn on(_f: &mut [f64], _ev: i32, sx: f64, sy: f64) -> bool {
        spark(sx, sy);
        sfx("tink");
        true
    }
    pub const DRAW: Schema = &[];
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        let c = named("RENTCAR").side(f[DIR] > 0.0);
        d.shadow(f[X], 28.0);
        d.img(c, round(f[X] - 16.0), round(GROUND - 17.0));
    }
}
