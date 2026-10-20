// 땅 · 화면 끝에서 오는 장애물 (원래 game.js): 솟는 돌하르방 · 꼬마 하르방 · 화산탄/낙석 · 조랑말 · 날아오는 돌 · 테왁 · 캐리어 · 똥돼지 · 렌터카
//  모듈마다 필드 목록(SCHEMA) · 움직임(update → 살아 있으면 true) · 판정 상자(boxes) · 맞았을 때(on)
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
                    decal(tx, 6.0);
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
}
