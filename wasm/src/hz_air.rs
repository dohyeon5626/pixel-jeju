// 하늘 · 바다에서 오는 장애물 (원래 game.js): 말풍선 · 썩은 귤 · 던진 것 · 갈라지는 글자 · 갈매기 · 벌 · 참새 · 택배 · 글라이더 · 돌고래 · 까마귀/박쥐 · 떨어지는 사투리
use crate::game::*;
use crate::js::*;

// ── 사투리 말풍선 (귤로 맞히면 글자가 와르르) ──
pub mod bubble {
    use super::*;
    pub const SCHEMA: Schema = &[
        ("dir", Ty::Num),
        ("kind", Ty::Enum(&["n", "big", "rap", "kind"])),
        ("w", Ty::Num),
        ("bodyH", Ty::Num),
        ("x", Ty::Num),
        ("y", Ty::Num),
        ("vx", Ty::Num),
        ("vy", Ty::Num),
        ("grav", Ty::Num),
        ("laneY", Ty::Num),
        ("bounces", Ty::Num),
        ("hp", Ty::Num),
        ("age", Ty::Num),
        ("flash", Ty::Num),
        ("dead", Ty::Bool),
    ];
    const DIR: usize = 0;
    const KIND: usize = 1;
    const W: usize = 2;
    const BODY_H: usize = 3;
    const X: usize = 4;
    const Y: usize = 5;
    const VX: usize = 6;
    const VY: usize = 7;
    const GRAV: usize = 8;
    const LANE_Y: usize = 9;
    const BOUNCES: usize = 10;
    const HP: usize = 11;
    const AGE: usize = 12;
    const FLASH: usize = 13;
    const DEAD: usize = 14;
    const K_BIG: f64 = 1.0;
    // 줄 높이가 정해진 말풍선 (laneY가 null이면 NaN으로 옴)
    fn laned(f: &[f64]) -> bool {
        !f[LANE_Y].is_nan()
    }
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        f[AGE] += dt;
        f[FLASH] -= dt;
        f[X] += f[VX] * dt;
        if laned(f) {
            f[Y] = lerp(f[Y], f[LANE_Y], 1.0 - pow(0.0004, dt));
        } else {
            f[VY] += f[GRAV] * dt;
            f[Y] += f[VY] * dt;
            if f[Y] + f[BODY_H] >= GROUND {
                f[Y] = GROUND - f[BODY_H];
                let left = f[BOUNCES];
                f[BOUNCES] -= 1.0;
                if left > 0.0 {
                    f[VY] = -f[VY].abs() * 0.55;
                    dust(f[X] + f[W] / 2.0, GROUND, 3.0, 0.0, 0.0);
                } else {
                    f[VY] = 0.0;
                    f[GRAV] = 0.0;
                }
            }
        }
        if f[KIND] == K_BIG && random() < dt * 14.0 {
            let x = if f[DIR] < 0.0 { f[X] + f[W] } else { f[X] };
            let y = f[Y] + rand(2.0, f[BODY_H] - 2.0);
            Fx { vx: -f[DIR] * 30.0, life: 0.3, col: pc("yel", 3), ..Fx::new("px", x, y) }.emit();
        }
        f[DEAD] == 0.0 && f[X] > -f[W] - 10.0 && f[X] < ctx().w + 10.0
    }
    pub fn boxes(f: &[f64]) -> Boxes {
        if f[AGE] < 0.14 || (laned(f) && (f[Y] - f[LANE_Y]).abs() > 3.0) {
            return vec![];
        }
        vec![[f[X] + 3.0, f[Y] + 5.0, f[W] - 6.0, f[BODY_H] - 9.0]]
    }
    pub fn on(f: &mut [f64], _ev: i32, _sx: f64, _sy: f64) -> bool {
        f[HP] -= 1.0;
        f[FLASH] = 0.08;
        if f[HP] > 0.0 {
            sfx("hit");
            spark(f[X] + 4.0, f[Y] + f[BODY_H] / 2.0);
            return true;
        }
        f[DEAD] = 1.0;
        sfx("shatter");
        hook("glyphs", f[X], f[Y], 0.0, 0.0);
        burst(f[X] + f[W] / 2.0, f[Y] + f[BODY_H] / 2.0, 10.0, &[hexc(0xffffff), hexc(0xd8e0f0)], 80.0, 0.4, 200.0, "px");
        reward(if f[KIND] == K_BIG { "bigShatter" } else { "shatter" }, f[X] + f[W] / 2.0, f[Y] - 4.0);
        true
    }
}

// ── 썩은 귤: 통통 튀다 터짐 (감귤 따기에서는 곧게 떨어져 철퍽) ──
pub mod rotten {
    use super::*;
    pub const SCHEMA: Schema = &[
        ("x", Ty::Num),
        ("y", Ty::Num),
        ("vx", Ty::Num),
        ("vy", Ty::Num),
        ("life", Ty::Num),
        ("grav", Ty::Num),
        ("falling", Ty::Bool),
        ("dead", Ty::Bool),
    ];
    const X: usize = 0;
    const Y: usize = 1;
    const VX: usize = 2;
    const VY: usize = 3;
    const LIFE: usize = 4;
    const GRAV: usize = 5;
    const FALLING: usize = 6;
    const DEAD: usize = 7;
    fn pop(f: &mut [f64]) {
        f[DEAD] = 1.0;
        burst(f[X], f[Y] - 4.0, 10.0, &[hexc(0x5e6e34), hexc(0x8a9a48), hexc(0x3e4a2a)], 70.0, 0.45, 300.0, "px");
        sfx("splat");
    }
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        let c = ctx();
        f[LIFE] -= dt;
        f[VY] += or(f[GRAV], 560.0) * dt;
        f[X] += f[VX] * dt;
        f[Y] += f[VY] * dt;
        if f[X] < c.arena_l - 2.0 || f[X] > c.arena_r {
            f[VX] *= -1.0;
            f[X] = clamp(f[X], c.arena_l - 2.0, c.arena_r);
        }
        if f[Y] >= GROUND && f[FALLING] != 0.0 {
            // 감귤 따기: 곧게 떨어져 철퍽 (예고 자리 그대로)
            pop(f);
            Fx { life: 0.2, col: hexc(0x8a9a48), ..Fx::new("ring", f[X], GROUND - 1.0) }.emit();
            return false;
        }
        if f[Y] >= GROUND {
            f[Y] = GROUND;
            f[VY] = -f[VY].abs() * 0.6;
            if f[VY].abs() < 60.0 {
                f[VY] = -150.0;
            }
            f[VX] *= 0.9;
        }
        if f[LIFE] <= 0.0 {
            pop(f);
            return false;
        }
        f[DEAD] == 0.0
    }
    pub fn boxes(f: &[f64]) -> Boxes {
        vec![[f[X] - 4.0, f[Y] - 8.0, 8.0, 8.0]]
    }
    pub fn on(f: &mut [f64], ev: i32, _sx: f64, _sy: f64) -> bool {
        pop(f);
        reward(if ev == EV_STOMP { "stompKill" } else { "shatter" }, f[X], f[Y] - 10.0);
        true
    }
}

// ── 이벤트 초상이 던지는 것: 잠깐 조준선 → 날아감 ──
pub mod zap {
    use super::*;
    pub const SCHEMA: Schema = &[
        ("x", Ty::Num),
        ("y", Ty::Num),
        ("vx", Ty::Num),
        ("vy", Ty::Num),
        ("t", Ty::Num),
        ("aim", Ty::Num),
        ("launched", Ty::Bool),
        ("isText", Ty::Bool),
        ("metal", Ty::Bool),
        ("sprH", Ty::Num),
        ("dead", Ty::Bool),
    ];
    pub const X: usize = 0;
    pub const Y: usize = 1;
    pub const VX: usize = 2;
    pub const VY: usize = 3;
    pub const T: usize = 4;
    const AIM: usize = 5;
    const LAUNCHED: usize = 6;
    const IS_TEXT: usize = 7;
    const METAL: usize = 8;
    const SPR_H: usize = 9;
    pub const DEAD: usize = 10;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        f[T] += dt;
        if f[T] < f[AIM] {
            return f[DEAD] == 0.0;
        }
        if f[LAUNCHED] == 0.0 {
            f[LAUNCHED] = 1.0;
            sfx("throw");
            Fx { size: 6.0, life: 0.15, col: pc("org", 3), ..Fx::new("flare", f[X], f[Y]) }.emit();
        }
        if random() < dt * 40.0 {
            let col = if f[IS_TEXT] != 0.0 { pc("yel", 3) } else { pc("org", 2) };
            Fx { vx: f[VX] * 0.2, vy: f[VY] * 0.2, life: 0.2, col, ..Fx::new("trail", f[X], f[Y]) }.emit();
        }
        f[X] += f[VX] * dt;
        f[Y] += f[VY] * dt;
        f[DEAD] == 0.0 && f[X] > -20.0 && f[X] < ctx().w + 20.0 && f[Y] > -VOFF - f[SPR_H] && f[Y] < GROUND + 10.0
    }
    pub fn boxes(f: &[f64]) -> Boxes {
        if f[T] < f[AIM] {
            return vec![];
        }
        vec![[f[X] - 4.0, f[Y] - 4.0, 8.0, 8.0]]
    }
    pub fn on(f: &mut [f64], _ev: i32, _sx: f64, _sy: f64) -> bool {
        f[DEAD] = 1.0;
        if f[METAL] != 0.0 {
            spark(f[X], f[Y]);
            sfx("tink");
        } else {
            burst(f[X], f[Y], 8.0, &[hexc(0x5e6e34), hexc(0x8a9a48)], 70.0, 0.4, 0.0, "px");
            sfx("splat");
        }
        reward("shatter", f[X], f[Y] - 8.0);
        true
    }
}

// ── 사투리 낱말: 날아가다 뜻풀이 글자로 갈라짐 (갈라진 글자는 JS split이 던짐) ──
pub mod split_zap {
    use super::zap::{DEAD, T, X, Y};
    use super::*;
    pub const SCHEMA: Schema = &[
        ("x", Ty::Num),
        ("y", Ty::Num),
        ("vx", Ty::Num),
        ("vy", Ty::Num),
        ("t", Ty::Num),
        ("aim", Ty::Num),
        ("launched", Ty::Bool),
        ("isText", Ty::Bool),
        ("metal", Ty::Bool),
        ("sprH", Ty::Num),
        ("dead", Ty::Bool),
        ("splitT", Ty::Num),
    ];
    const SPLIT_T: usize = 11;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        if !zap::update(f, dt) {
            return false;
        }
        if f[T] >= f[SPLIT_T] {
            f[DEAD] = 1.0;
            sfx("pop");
            shake(0.12);
            Fx { life: 0.3, col: pc("yel", 3), ..Fx::new("ring", f[X], f[Y]) }.emit();
            Fx { size: 10.0, life: 0.2, col: pc("yel", 3), ..Fx::new("flare", f[X], f[Y]) }.emit();
            hook("split", 0.0, 0.0, 0.0, 0.0);
            return false;
        }
        true
    }
    pub fn on(f: &mut [f64], _ev: i32, _sx: f64, _sy: f64) -> bool {
        f[DEAD] = 1.0;
        hook("popup", str_id("격파"), f[X], f[Y] - 12.0, hexc(0xffffff));
        reward("shatter", f[X], f[Y] - 8.0);
        sfx("tink");
        true
    }
}

// ── 갈매기: 포물선으로 내리꽂았다가 다시 올라감 ──
pub mod gull {
    use super::*;
    pub const SCHEMA: Schema = &[
        ("tx", Ty::Num),
        ("dir", Ty::Num),
        ("x", Ty::Num),
        ("y", Ty::Num),
        ("t", Ty::Num),
        ("T", Ty::Num),
        ("anim", Ty::Num),
        ("sx", Ty::Num),
        ("sy", Ty::Num),
        ("squawk", Ty::Bool),
        ("dead", Ty::Bool),
    ];
    const TX: usize = 0;
    const DIR: usize = 1;
    const X: usize = 2;
    const Y: usize = 3;
    const T: usize = 4;
    const DUR: usize = 5;
    const ANIM: usize = 6;
    const SX: usize = 7;
    const SY: usize = 8;
    const SQUAWK: usize = 9;
    const DEAD: usize = 10;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        f[T] += dt;
        f[ANIM] += dt * 10.0;
        if f[T] < 0.0 {
            return f[DEAD] == 0.0; // 편대: 차례가 올 때까지 대기 (길 미리보기는 계속 보임)
        }
        let k = f[T] / f[DUR];
        f[X] = lerp(f[SX], f[TX] + f[DIR] * 190.0, k);
        f[Y] = f[SY] + (GROUND - 10.0 - f[SY]) * (1.0 - pow(2.0 * k - 1.0, 2.0));
        if f[SQUAWK] == 0.0 && k > 0.25 {
            f[SQUAWK] = 1.0;
            sfx("gull");
        }
        f[DEAD] == 0.0 && k < 1.0
    }
    pub fn boxes(f: &[f64]) -> Boxes {
        if f[T] < 0.0 {
            return vec![];
        }
        vec![[f[X] - 6.0, f[Y] - 5.0, 12.0, 8.0]]
    }
    pub fn on(f: &mut [f64], _ev: i32, _sx: f64, _sy: f64) -> bool {
        f[DEAD] = 1.0;
        burst(f[X], f[Y], 10.0, &[hexc(0xffffff), hexc(0xc8ccd6)], 70.0, 0.5, 120.0, "px");
        reward("shatter", f[X], f[Y] - 10.0);
        true
    }
}

// ── 유채꽃 벌떼: 모두 같은 물결길을 따라 날아옴 ──
pub mod bee {
    use super::*;
    pub const SCHEMA: Schema =
        &[("dir", Ty::Num), ("x", Ty::Num), ("y", Ty::Num), ("ph", Ty::Num), ("speed", Ty::Num), ("t", Ty::Num), ("dead", Ty::Bool)];
    const DIR: usize = 0;
    const X: usize = 1;
    const Y: usize = 2;
    const PH: usize = 3;
    const SPEED: usize = 4;
    const T: usize = 5;
    const DEAD: usize = 6;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        let w = ctx().w;
        f[T] += dt;
        f[X] += f[DIR] * f[SPEED] * dt;
        f[Y] = GROUND - 24.0 + sin(f[X] * 0.045 + f[PH]) * 14.0;
        f[DEAD] == 0.0 && if f[DIR] > 0.0 { f[X] < w + 20.0 } else { f[X] > -20.0 }
    }
    pub fn boxes(f: &[f64]) -> Boxes {
        vec![[f[X] - 3.0, f[Y] - 3.0, 6.0, 5.0]]
    }
    pub fn on(f: &mut [f64], _ev: i32, _sx: f64, _sy: f64) -> bool {
        hook("daily", str_id("bee"), 0.0, 0.0, 0.0);
        f[DEAD] = 1.0;
        burst(f[X], f[Y], 6.0, &[pc("yel", 2), pc("stone", 1)], 60.0, 0.35, 120.0, "px");
        reward("shatter", f[X], f[Y] - 8.0);
        sfx("tink");
        true
    }
}

// ── 참새 무리: 예고 뒤 낮게 · 높게 지나감 (귤에 맞으면 놀라서 위로 흩어짐) ──
pub mod plane {
    use super::*;
    pub const SCHEMA: Schema = &[
        ("dir", Ty::Num),
        ("low", Ty::Bool),
        ("x", Ty::Num),
        ("y", Ty::Num),
        ("speed", Ty::Num),
        ("t", Ty::Num),
        ("warn", Ty::Num),
        ("flee", Ty::Bool),
        ("roared", Ty::Bool),
        ("dead", Ty::Bool),
    ];
    const DIR: usize = 0;
    const LOW: usize = 1;
    const X: usize = 2;
    const Y: usize = 3;
    const SPEED: usize = 4;
    const T: usize = 5;
    const WARN: usize = 6;
    const FLEE: usize = 7;
    const ROARED: usize = 8;
    const DEAD: usize = 9;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        let w = ctx().w;
        let dir = f[DIR];
        f[T] += dt;
        if f[FLEE] != 0.0 {
            f[X] += dir * f[SPEED] * 0.5 * dt;
            f[Y] -= 140.0 * dt;
            return f[Y] > -VOFF - 20.0;
        }
        if f[T] >= f[WARN] {
            if f[ROARED] == 0.0 {
                f[ROARED] = 1.0;
                sfx("chirp");
            }
            f[X] += dir * f[SPEED] * dt;
        }
        f[DEAD] == 0.0 && if dir > 0.0 { f[X] < w + 30.0 } else { f[X] > -30.0 }
    }
    pub fn boxes(f: &[f64]) -> Boxes {
        if f[T] < f[WARN] || f[FLEE] != 0.0 {
            return vec![];
        }
        let hw = if f[LOW] != 0.0 { 10.0 } else { 15.0 };
        vec![[f[X] - hw, f[Y] - 4.0, hw * 2.0, 9.0]]
    }
    pub fn on(f: &mut [f64], _ev: i32, sx: f64, sy: f64) -> bool {
        f[FLEE] = 1.0;
        sfx("chirp");
        burst(sx, sy, 6.0, &[hexc(0x8a5a3a), hexc(0xb4865c), hexc(0xe6dac2)], 50.0, 0.5, 80.0, "chunk");
        reward("shatter", f[X], f[Y] - 8.0);
        true
    }
}

// ── 택배 상자: 점점 빨라지며 떨어져 쿵 → 잠시 뒤 열려 귤 (밟거나 맞히면 귤 셋) ──
pub mod parcel {
    use super::*;
    pub const SCHEMA: Schema = &[
        ("x", Ty::Num),
        ("y", Ty::Num),
        ("t", Ty::Num),
        ("warn", Ty::Num),
        ("state", Ty::Enum(&["warn", "fall", "rest"])),
        ("vy", Ty::Num),
        ("safe", Ty::Bool),
        ("restT", Ty::Num),
        ("dead", Ty::Bool),
    ];
    const X: usize = 0;
    const Y: usize = 1;
    const T: usize = 2;
    const WARN: usize = 3;
    const STATE: usize = 4;
    const VY: usize = 5;
    const SAFE: usize = 6;
    const REST_T: usize = 7;
    const DEAD: usize = 8;
    const S_WARN: f64 = 0.0;
    const S_FALL: f64 = 1.0;
    const S_REST: f64 = 2.0;
    fn open(f: &mut [f64], bonus: bool) {
        let x = f[X];
        f[DEAD] = 1.0;
        burst(x, GROUND - 8.0, 8.0, &[pc("wood", 2), pc("org", 2)], 70.0, 0.4, 260.0, "px");
        for _ in 0..if bonus { 3 } else { 1 } {
            let px = x + rand(-6.0, 6.0);
            let vx = rand(-50.0, 50.0);
            let vy = rand(-160.0, -110.0);
            hook("tang", px, GROUND - 14.0, vx, vy);
        }
        if bonus {
            hook("popup", str_id("+귤"), x, GROUND - 26.0, pc("org", 3));
        }
    }
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        f[T] += dt;
        if f[STATE] == S_WARN && f[T] >= f[WARN] {
            f[STATE] = S_FALL;
        }
        if f[STATE] == S_FALL {
            f[VY] = min(820.0, or(f[VY], 220.0) + 2600.0 * dt);
            f[Y] += f[VY] * dt;
            if f[Y] >= GROUND - 13.0 {
                f[Y] = GROUND - 13.0;
                f[STATE] = S_REST;
                f[SAFE] = 1.0;
                f[REST_T] = 0.0;
                shake(0.12);
                sfx("thud");
                dust(f[X], GROUND, 5.0, 0.0, 1.0);
                Fx { life: 0.25, ..Fx::new("ring", f[X], GROUND - 1.0) }.emit();
                burst(f[X], GROUND - 4.0, 6.0, &[pc("wood", 1), pc("wood", 2), pc("soil", 3)], 90.0, 0.45, 380.0, "chunk");
            }
        }
        if f[STATE] == S_REST {
            f[REST_T] += dt;
            if f[REST_T] > 1.6 * ctx().speed {
                open(f, false);
                return false;
            }
        }
        f[DEAD] == 0.0
    }
    pub fn boxes(f: &[f64]) -> Boxes {
        if f[STATE] == S_FALL {
            vec![[f[X] - 7.0, f[Y], 14.0, 13.0]]
        } else if f[STATE] == S_REST {
            vec![[f[X] - 7.0, f[Y] + 2.0, 14.0, 4.0]]
        } else {
            vec![]
        }
    }
    pub fn on(f: &mut [f64], _ev: i32, _sx: f64, _sy: f64) -> bool {
        open(f, true);
        reward("shatter", f[X], GROUND - 16.0);
        true
    }
}

// ── 패러글라이더: 위를 밟으면 튀어 오르고 처음 한 번은 귤 둘 ──
pub mod glider {
    use super::*;
    pub const SCHEMA: Schema = &[
        ("dir", Ty::Num),
        ("y0", Ty::Num),
        ("y", Ty::Num),
        ("x", Ty::Num),
        ("speed", Ty::Num),
        ("t", Ty::Num),
        ("life", Ty::Num),
        ("sq", Ty::Num),
        ("paid", Ty::Bool),
        ("dead", Ty::Bool),
    ];
    const DIR: usize = 0;
    const Y0: usize = 1;
    const Y: usize = 2;
    const X: usize = 3;
    const SPEED: usize = 4;
    const T: usize = 5;
    const LIFE: usize = 6;
    const SQ: usize = 7;
    const PAID: usize = 8;
    const DEAD: usize = 9;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        let w = ctx().w;
        f[T] += dt;
        f[LIFE] -= dt;
        f[X] += f[DIR] * f[SPEED] * dt;
        f[Y] = f[Y0] + sin(f[T] * 2.0) * 3.0;
        f[DEAD] == 0.0 && f[LIFE] > 0.0 && if f[DIR] > 0.0 { f[X] < w + 20.0 } else { f[X] > -20.0 }
    }
    pub fn boxes(f: &[f64]) -> Boxes {
        vec![[f[X] - 12.0, f[Y] - 10.0, 24.0, 6.0]]
    }
    // 밟고 튀어 오름: 점수가 나면 true
    pub fn on(f: &mut [f64], _ev: i32, _sx: f64, _sy: f64) -> bool {
        f[SQ] = 0.15;
        if f[PAID] != 0.0 {
            return false;
        }
        f[PAID] = 1.0;
        for _ in 0..2 {
            let x = f[X] + rand(-6.0, 6.0);
            let vx = rand(-50.0, 50.0);
            let vy = rand(-120.0, -80.0);
            hook("tang", x, f[Y] - 8.0, vx, vy);
        }
        Fx { big: true, life: 0.3, col: pc("teal", 3), ..Fx::new("ring", f[X], f[Y] - 10.0) }.emit();
        light(f[X], f[Y] - 8.0, 24.0, pc("teal", 3), 0.7);
        true
    }
}

// ── 돌고래: 물에서 솟아 포물선으로 넘어감 ──
pub mod dolphin {
    use super::*;
    pub const SCHEMA: Schema = &[
        ("x0", Ty::Num),
        ("x1", Ty::Num),
        ("peak", Ty::Num),
        ("T", Ty::Num),
        ("warn", Ty::Num),
        ("t", Ty::Num),
        ("s", Ty::Num),
        ("dir", Ty::Num),
        ("x", Ty::Num),
        ("y", Ty::Num),
        ("dead", Ty::Bool),
    ];
    const X0: usize = 0;
    const X1: usize = 1;
    const PEAK: usize = 2;
    const DUR: usize = 3;
    const WARN: usize = 4;
    const T: usize = 5;
    const S: usize = 6;
    const DIR: usize = 7;
    const X: usize = 8;
    const Y: usize = 9;
    const DEAD: usize = 10;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        f[T] += dt;
        let s = (f[T] - f[WARN]) / f[DUR];
        if s >= 0.0 && f[S] < 0.0 {
            hook("splash", f[X0], 1.0, 0.0, 0.0);
        }
        if s >= 0.0 {
            f[S] = s;
            let k = min(1.0, s);
            f[X] = lerp(f[X0], f[X1], k);
            f[Y] = GROUND + 10.0 - (f[PEAK] + 10.0) * 4.0 * k * (1.0 - k);
            if random() < dt * 40.0 {
                let dir = f[DIR];
                let y = f[Y] + rand(-2.0, 2.0);
                let vx = -dir * rand(10.0, 30.0);
                let vy = rand(-10.0, 20.0);
                let col = pick(&[hexc(0xcfe4ec), hexc(0x9ec2d4)]);
                Fx { vx, vy, grav: 300.0, life: 0.4, col, ..Fx::new("px", f[X] - dir * 8.0, y) }.emit();
            }
            if s >= 1.0 {
                hook("splash", f[X1], 1.3, 0.0, 0.0);
                return false;
            }
        }
        f[DEAD] == 0.0
    }
    pub fn boxes(f: &[f64]) -> Boxes {
        if f[S] < 0.0 {
            return vec![];
        }
        vec![[f[X] - 7.0, f[Y] - 4.0, 14.0, 8.0]]
    }
    pub fn on(_f: &mut [f64], _ev: i32, sx: f64, sy: f64) -> bool {
        spark(sx, sy);
        sfx("tink");
        true
    }
}

// ── 까마귀 (동굴에서는 박쥐): 내려와 숨비를 노리다 조준을 굳히고 땅으로 내리꽂힘 ──
pub mod crow {
    use super::*;
    pub const SCHEMA: Schema = &[
        ("px", Ty::Num),
        ("py", Ty::Num),
        ("x", Ty::Num),
        ("y", Ty::Num),
        ("sx", Ty::Num),
        ("t", Ty::Num),
        ("delay", Ty::Num),
        ("state", Ty::Enum(&["in", "aim", "dive", "up"])),
        ("anim", Ty::Num),
        ("face", Ty::Num),
        ("bat", Ty::Bool),
        ("locked", Ty::Bool),
        ("tx", Ty::Num),
        ("ty", Ty::Num),
        ("vx", Ty::Num),
        ("vy", Ty::Num),
        ("gx", Ty::Num),
        ("ghT", Ty::Num),
        ("dead", Ty::Bool),
    ];
    const PX: usize = 0;
    const PY: usize = 1;
    const X: usize = 2;
    const Y: usize = 3;
    const SX: usize = 4;
    const T: usize = 5;
    const DELAY: usize = 6;
    const STATE: usize = 7;
    const ANIM: usize = 8;
    const FACE: usize = 9;
    const BAT: usize = 10;
    const LOCKED: usize = 11;
    const TX: usize = 12;
    const TY: usize = 13;
    const VX: usize = 14;
    const VY: usize = 15;
    const GX: usize = 16;
    const GH_T: usize = 17;
    const DEAD: usize = 18;
    const S_IN: f64 = 0.0;
    const S_AIM: f64 = 1.0;
    const S_DIVE: f64 = 2.0;
    const S_UP: f64 = 3.0;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        let c = ctx();
        let bat = f[BAT] != 0.0;
        f[T] += dt;
        f[ANIM] += dt * if bat { 18.0 } else { 12.0 };
        let sp = 210.0 * min(1.0, 1.35 / c.speed);
        let face = |x: f64| if c.px >= x { 1.0 } else { -1.0 };
        if f[STATE] == S_IN {
            let k = ease_out(f[T] / (0.45 * c.speed));
            f[X] = lerp(f[SX], f[PX], k);
            f[Y] = lerp(-VOFF - 16.0, f[PY], k);
            f[FACE] = face(f[X]);
            if f[T] >= f[DELAY] {
                f[STATE] = S_AIM;
                f[T] = 0.0;
                sfx(if bat { "tink" } else { "caw" });
            }
        } else if f[STATE] == S_AIM {
            f[Y] = f[PY] + sin(f[ANIM] * 0.4) * 1.5;
            if f[LOCKED] == 0.0 {
                f[TX] = c.px;
                f[TY] = c.py - 10.0;
                f[FACE] = face(f[X]);
                if f[T] >= 0.3 * c.speed {
                    f[LOCKED] = 1.0;
                    sfx("tink");
                    let dx = f[TX] - f[X];
                    let dy = max(50.0, f[TY] - f[Y]);
                    let l = hypot(dx, dy);
                    f[VX] = dx / l;
                    f[VY] = dy / l;
                    f[GX] = f[X] + f[VX] / f[VY] * (GROUND - 4.0 - f[Y]);
                    Fx { size: 5.0, life: 0.18, col: pc("red", 3), ..Fx::new("flare", f[X], f[Y] - 2.0) }.emit();
                }
            }
            if f[T] >= 0.9 * c.speed {
                f[STATE] = S_DIVE;
                sfx("whoosh");
            }
        } else if f[STATE] == S_DIVE {
            f[X] += f[VX] * sp * dt;
            f[Y] += f[VY] * sp * dt;
            f[GH_T] = or(f[GH_T], 0.0) - dt;
            if f[GH_T] <= 0.0 {
                f[GH_T] = 0.03;
                hook("ghost", f[X], f[Y], 0.15, pc("red", 2));
            }
            if f[Y] >= GROUND - 4.0 {
                // 땅에 꽂히는 순간 (숨비 가까이면 짧게 멈칫)
                let x = f[X];
                f[STATE] = S_UP;
                f[VY] = -1.0;
                shake(0.09);
                dust(x, GROUND, 5.0, if f[VX] > 0.0 { 1.0 } else { -1.0 }, 1.0);
                sfx("thud");
                Fx { size: 8.0, life: 0.12, ..Fx::new("flare", x, GROUND - 2.0) }.emit();
                Fx { life: 0.25, ..Fx::new("ring", x, GROUND - 1.0) }.emit();
                if (x - c.px).abs() < 30.0 {
                    hitstop(0.02, 0.6);
                }
                for _ in 0..10 {
                    let vx = rand(-50.0, 50.0);
                    let vy = -rand(30.0, 90.0);
                    let life = rand(0.5, 0.9);
                    let col = pick(&[hexc(0x2c2634), hexc(0x40384c)]);
                    Fx { vx, vy, grav: 120.0, drag: 2.0, life, size: 1.0, col, ..Fx::new("chunk", x, GROUND - 4.0) }.emit();
                }
            }
        } else {
            f[X] += f[VX] * sp * 0.6 * dt;
            f[Y] -= sp * 0.55 * dt;
            if f[Y] < -VOFF - 20.0 || f[X] < -20.0 || f[X] > c.w + 20.0 {
                return false;
            }
        }
        f[DEAD] == 0.0
    }
    pub fn boxes(f: &[f64]) -> Boxes {
        if f[STATE] != S_DIVE {
            return vec![];
        }
        vec![[f[X] - 5.0, f[Y] - 3.0, 10.0, 6.0]]
    }
    pub fn on(f: &mut [f64], _ev: i32, _sx: f64, _sy: f64) -> bool {
        f[DEAD] = 1.0;
        burst(f[X], f[Y], 8.0, &[hexc(0x2c2634), hexc(0x40384c), hexc(0x5a5268)], 60.0, 0.6, 120.0, "chunk");
        reward("shatter", f[X], f[Y] - 10.0);
        true
    }
}

// ── 떨어지는 사투리 낱말: 예고 → 쿵 박힘 → 부서지며 뜻풀이 ──
pub mod dialect {
    use super::*;
    pub const SCHEMA: Schema = &[
        ("w", Ty::Num),
        ("h", Ty::Num),
        ("x", Ty::Num),
        ("y", Ty::Num),
        ("land", Ty::Num),
        ("fall", Ty::Num),
        ("t", Ty::Num),
        ("st", Ty::Enum(&["warn", "fall", "land"])),
        ("lT", Ty::Num),
        ("dead", Ty::Bool),
    ];
    const W: usize = 0;
    const H: usize = 1;
    const X: usize = 2;
    const Y: usize = 3;
    const LAND: usize = 4;
    const FALL: usize = 5;
    const T: usize = 6;
    const ST: usize = 7;
    const L_T: usize = 8;
    const DEAD: usize = 9;
    const S_WARN: f64 = 0.0;
    const S_FALL: f64 = 1.0;
    const S_LAND: f64 = 2.0;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        let (w, h, x) = (f[W], f[H], f[X]);
        let start = f[LAND] - f[FALL];
        f[T] += dt;
        if f[ST] == S_WARN && f[T] >= start {
            f[ST] = S_FALL;
            sfx("whoosh");
        }
        if f[ST] == S_FALL {
            let s = clamp((f[T] - start) / f[FALL], 0.0, 1.0);
            f[Y] = lerp(-VOFF - h - 4.0, GROUND - h, s * s);
            if random() < dt * 40.0 {
                let fx = x + rand(-w / 2.0, w / 2.0);
                let vy = -rand(20.0, 60.0);
                let len = randi(4.0, 8.0);
                Fx { vy, life: 0.25, len, col: css("rgba(255,244,224,0.45)"), ..Fx::new("streak", fx, f[Y] - 2.0) }.emit();
            }
            if s >= 1.0 {
                f[ST] = S_LAND;
                f[L_T] = 0.0;
                sfx("boom");
                hook("duck", 0.25, 0.0, 0.0, 0.0);
                shake(0.3);
                hook("kick", 0.0, 3.0, 0.0, 0.0);
                hitstop(0.04, 0.0);
                for k in -2i32..=2 {
                    dust(x + k as f64 * w / 5.0, GROUND, 3.0, k.signum() as f64, 2.0);
                }
                Fx { big: true, life: 0.35, col: pc("yel", 3), ..Fx::new("ring", x, GROUND - 1.0) }.emit();
                for _ in 0..12 {
                    let fx = x + rand(-w / 2.0, w / 2.0);
                    let vx = rand(-90.0, 90.0);
                    let vy = -rand(80.0, 180.0);
                    let life = rand(0.4, 0.7);
                    let size = randi(1.0, 2.0);
                    let col = pick(&[pc("soil", 2), pc("soil", 3), pc("stone", 3)]);
                    Fx { vx, vy, grav: 480.0, life, size, col, ..Fx::new("chunk", fx, GROUND - 3.0) }.emit();
                }
                light(x, GROUND - h / 2.0, w * 0.6, pc("yel", 3), 0.8);
            }
        }
        if f[ST] == S_LAND {
            f[L_T] += dt;
            if f[L_T] > 0.32 * ctx().speed {
                let ramp = [pc("org", 0), pc("org", 1), pc("org", 2), pc("org", 3), pc("yel", 2), pc("yel", 3)];
                for _ in 0..14 {
                    let fx = x + rand(-w / 2.0, w / 2.0);
                    let y = GROUND - rand(2.0, h);
                    let vx = rand(-80.0, 80.0);
                    let vy = -rand(60.0, 160.0);
                    let life = rand(0.4, 0.8);
                    let size = randi(1.0, 2.0);
                    let col = pick(&ramp);
                    Fx { vx, vy, grav: 420.0, life, size, col, ..Fx::new("chunk", fx, y) }.emit();
                }
                hook("mean", x, GROUND - h - 12.0, 0.0, 0.0);
                sfx("shatter");
                return false;
            }
        }
        f[DEAD] == 0.0
    }
    pub fn boxes(f: &[f64]) -> Boxes {
        if f[ST] != S_FALL {
            return vec![];
        }
        vec![[f[X] - f[W] / 2.0 + 2.0, f[Y] + 2.0, f[W] - 4.0, f[H] - 3.0]]
    }
    pub fn on(_f: &mut [f64], _ev: i32, sx: f64, sy: f64) -> bool {
        spark(sx, sy);
        sfx("tink");
        true
    }
}
