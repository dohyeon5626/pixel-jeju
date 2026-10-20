// 장애물이 아닌 것 (원래 game.js): 줍는 것 · 플레이어의 귤 · 시험 답 팻말
//  움직임만 여기서 (판정 상자는 하나뿐이라 JS box()에 그대로 둠)
use crate::game::*;
use crate::js::*;

pub fn no_boxes(_f: &[f64]) -> Boxes {
    vec![]
}

// ── 줍는 것: 귤 · 아이템 (떨어지며 살랑 · 가까이 가면 끌려옴) ──
pub mod pickup {
    use super::*;
    pub const SCHEMA: Schema = &[
        ("kind", Ty::Enum(&["tang", "basket", "omegi", "pinwheel", "water", "shield", "bong", "fake"])),
        ("x", Ty::Num),
        ("y", Ty::Num),
        ("vx", Ty::Num),
        ("vy", Ty::Num),
        ("life", Ty::Num),
        ("grounded", Ty::Bool),
        ("t", Ty::Num),
        ("phase", Ty::Num),
        ("spin", Ty::Num),
        ("sq", Ty::Num),
        ("float", Ty::Bool),
        ("y0", Ty::Num),
        ("dead", Ty::Bool),
    ];
    const KIND: usize = 0;
    const X: usize = 1;
    const Y: usize = 2;
    const VX: usize = 3;
    const VY: usize = 4;
    const LIFE: usize = 5;
    const GROUNDED: usize = 6;
    const T: usize = 7;
    const PHASE: usize = 8;
    const SPIN: usize = 9;
    const SQ: usize = 10;
    const FLOAT: usize = 11;
    const Y0: usize = 12;
    const DEAD: usize = 13;
    const K_TANG: f64 = 0.0;
    const K_FAKE: f64 = 7.0;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        let c = ctx();
        f[T] += dt;
        f[SQ] = max(0.0, f[SQ] - dt);
        if f[FLOAT] != 0.0 {
            // 공중에 떠 있는 귤: 살랑 · 가까이 가면 끌려옴
            f[LIFE] -= dt / c.speed;
            f[Y] = f[Y0] + sin(f[T] * 3.0 + f[PHASE]) * 1.5;
            f[SPIN] += dt * 0.6;
            let (ddx, ddy) = (c.px - f[X], c.py - 12.0 - f[Y]);
            if !c.p_dead && hypot(ddx, ddy) < 16.0 {
                f[FLOAT] = 0.0;
                f[GROUNDED] = 0.0;
            }
            return f[LIFE] > 0.0 && f[DEAD] == 0.0;
        }
        let (dx, dy) = (c.px - f[X], c.py - 12.0 - f[Y]);
        let d = hypot(dx, dy);
        let mag = c.magnet > 0.0 && f[KIND] == K_TANG;
        let pull = f[KIND] != K_FAKE && !c.p_dead && d < if mag { 110.0 } else { 26.0 };
        let free = |f: &[f64]| f[GROUNDED] == 0.0 && f[SQ] == 0.0;
        if pull {
            f[GROUNDED] = 0.0;
            f[SQ] = 0.0;
            let k = if mag { max(18.0, 45.0 * (1.0 - d / 110.0)) } else { 45.0 * (1.0 - d / 26.0) };
            f[VX] += (dx * k - f[VX] * 8.0) * dt;
            f[VY] += (dy * k - f[VY] * 8.0) * dt;
        } else if free(f) {
            // 공기 저항: 끝없이 빨라지지 않고, 옆으로 살랑살랑
            f[VY] = min(f[VY] + 520.0 * dt, 190.0);
            f[VX] = (f[VX] + sin(f[T] * 3.0 + f[PHASE]) * 8.0 * dt) * exp(-0.6 * dt);
        }
        if free(f) {
            f[X] += f[VX] * dt;
            f[Y] += f[VY] * dt;
            f[SPIN] += (1.2 + f[VX].abs() * 0.03) * dt;
        }
        if f[X] < c.arena_l - 2.0 || f[X] > c.arena_r {
            f[VX] *= -0.35;
            f[X] = clamp(f[X], c.arena_l - 2.0, c.arena_r);
        }
        if f[Y] >= GROUND && f[VY] > 0.0 {
            let impact = f[VY];
            f[Y] = GROUND;
            f[SQ] = 0.07;
            f[VX] *= 0.55;
            let grounded = impact < 45.0;
            f[GROUNDED] = grounded as i32 as f64;
            f[VY] = if grounded { 0.0 } else { -impact * 0.22 };
            if grounded {
                f[VX] = 0.0;
            } else {
                dust(f[X], GROUND, 1.0, 0.0, 0.0);
            }
        }
        if f[GROUNDED] != 0.0 {
            f[LIFE] -= dt / c.speed; // 실제 시간으로 사라짐
        }
        f[LIFE] > 0.0 && f[DEAD] == 0.0
    }
}

// ── 플레이어의 귤 (꼬리 자국은 JS가 그림용으로 쌓음) ──
pub mod shot {
    use super::*;
    pub const SCHEMA: Schema = &[("x", Ty::Num), ("y", Ty::Num), ("vx", Ty::Num), ("vy", Ty::Num), ("rot", Ty::Num), ("dead", Ty::Bool)];
    const X: usize = 0;
    const Y: usize = 1;
    const VX: usize = 2;
    const VY: usize = 3;
    const ROT: usize = 4;
    const DEAD: usize = 5;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        f[VY] += 150.0 * dt;
        f[X] += f[VX] * dt;
        f[Y] += f[VY] * dt;
        f[ROT] += dt * 20.0;
        if f[Y] >= GROUND - 2.0 {
            juice(f[X], GROUND - 2.0, 6.0);
            sfx("splat");
            return false;
        }
        f[DEAD] == 0.0 && f[X] > -10.0 && f[X] < ctx().w + 10.0
    }
}

// ── 제주어 시험 답 팻말: 둥실둥실 ──
pub mod answer {
    use super::*;
    pub const SCHEMA: Schema = &[("t", Ty::Num), ("y", Ty::Num), ("dead", Ty::Bool)];
    const T: usize = 0;
    const Y: usize = 1;
    const DEAD: usize = 2;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        f[T] += dt;
        f[Y] = GROUND - 50.0 + round(sin(f[T] * 3.0) * 3.0);
        f[DEAD] == 0.0
    }
}
