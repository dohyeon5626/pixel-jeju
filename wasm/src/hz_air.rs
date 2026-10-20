// 하늘 · 바다에서 오는 장애물 (원래 game.js): 말풍선 · 썩은 귤 · 던진 것 · 갈라지는 글자 · 갈매기 · 벌 · 참새 · 택배 · 글라이더 · 돌고래 · 까마귀/박쥐 · 떨어지는 사투리
use crate::draw::*;
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
    pub const DRAW: Schema = &[];
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        let pop = if f[AGE] < 0.12 { ease_back(f[AGE] / 0.12) } else { 1.0 };
        let wob = round(sin(f[AGE] * 14.0) * 1.0);
        if f[Y] + f[BODY_H] > GROUND - 30.0 {
            d.shadow(f[X] + f[W] / 2.0, f[W] * 0.6);
        }
        let (x, y) = (round(f[X]), round(f[Y] + wob + (1.0 - pop) * 6.0));
        if f[FLASH] > 0.0 {
            d.img_sil(own(), hexc(0xffffff), x, y); // 맞은 순간 하얗게
        } else {
            d.img(own(), x, y);
        }
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
    pub const DRAW: Schema = &[];
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        if f[LIFE] < 1.0 && odd(f[LIFE] * 10.0) {
            return; // 사라지기 직전 깜빡
        }
        d.shadow(f[X], 7.0);
        d.img(named("ROTTEN"), round(f[X] - 5.0), round(f[Y] - 10.0));
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
        ("ax", Ty::Num),
        ("ay", Ty::Num),
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
    const AX: usize = 11;
    const AY: usize = 12;
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
    pub const DRAW: Schema = &[];
    // 조준하는 동안은 깜빡이는 점선 · 날아가면 그림 (왼쪽으로 가면 뒤집은 그림이 있으면 그것)
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        if f[T] < f[AIM] {
            if odd(f[T] * 16.0) {
                return;
            }
            let m = hypot(f[VX], f[VY]);
            let (ux, uy) = (f[VX] / m, f[VY] / m);
            d.style(pc("red", 2));
            for i in 1..16 {
                let i = i as f64;
                d.rect(round(f[AX] + ux * i * 10.0), round(f[AY] + uy * i * 10.0), 2.0, 2.0);
            }
            return;
        }
        let spr = if f[VX] < 0.0 && own().has_flip() { own().at(FLIP) } else { own() };
        d.img(spr, round(f[X] - spr.w() / 2.0), round(f[Y] - spr.h() / 2.0));
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
        ("ax", Ty::Num),
        ("ay", Ty::Num),
        ("splitT", Ty::Num),
    ];
    const SPLIT_T: usize = 13;
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
    pub const DRAW: Schema = &[];
    // 내리꽂을 길 미리보기 · 땅의 그림자
    pub fn decal(f: &mut [f64], d: &mut Draw) {
        let k = max(0.0, f[T]) / f[DUR];
        if k < 0.45 {
            d.alpha(1.0 - k / 0.45);
            let mut s = max(0.08, k);
            while s < 0.92 {
                let x = round(lerp(f[SX], f[TX] + f[DIR] * 190.0, s));
                let y = round(f[SY] + (GROUND - 10.0 - f[SY]) * (1.0 - pow(2.0 * s - 1.0, 2.0)));
                if y >= -VOFF + 30.0 {
                    d.style(INK);
                    d.rect(x - 1.0, y - 1.0, 3.0, 3.0);
                    d.style(pc("red", 3));
                    d.rect(x, y, 1.0, 1.0);
                }
                s += 0.04;
            }
            d.alpha(1.0);
        }
        if k < 0.7 {
            let a = 0.15 + min(1.0, k / 0.4) * 0.3;
            d.rgba(30.0, 20.0, 40.0, a);
            d.rect(round(f[TX] - 40.0), GROUND, 80.0, 1.0);
            d.rgba(200.0, 40.0, 40.0, a);
            d.rect(round(f[TX] - 6.0), GROUND, 12.0, 1.0);
        }
    }
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        let fr = named("GULL").at([0.0, 0.0, 1.0, 1.0, 1.0, 0.0][(f[ANIM].floor() % 6.0) as usize]).side(f[DIR] > 0.0);
        d.img(fr, round(f[X] - fr.ax()), round(f[Y] - fr.ay()));
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
    pub const DRAW: Schema = &[];
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        let fr = named("BEE").at((f[T] * 18.0).floor() % 2.0).side(f[DIR] > 0.0);
        d.img(fr, round(f[X] - fr.ax()), round(f[Y] - fr.ay()));
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
    // 그리기 전용: 참새마다 [자리 ox · oy, 날갯짓 위상]
    pub const DRAW: Schema = &[("birds", Ty::List)];
    const BIRDS: usize = SCHEMA.len();
    // 참새 무리 (sil: 예고용 붉은 그림자 · x: 그릴 자리)
    fn birds(f: &[f64], d: &mut Draw, sil: bool, x: f64) {
        let set = named("SPARROW").side(f[DIR] > 0.0);
        let flee = f[FLEE] != 0.0;
        for b in list(f, BIRDS).chunks(3) {
            let (ox, oy, ph) = (b[0], b[1], b[2]);
            let fr = set.at((f[T] * 14.0 + ph * 3.0).floor() % 4.0);
            let bob = round(sin(f[T] * 7.0 + ph) * 1.2) + if flee { -round(ox * 0.4) } else { 0.0 };
            let (px, py) = (round(x + ox * f[DIR] - fr.ax()), round(f[Y] + oy + bob - fr.ay()));
            if sil {
                d.img_sil(fr, pc("red", 2), px, py);
            } else {
                d.img(fr, px, py);
            }
        }
    }
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        let c = ctx();
        if f[T] < f[WARN] {
            // 예고: 지나갈 높이에 점선 + 참새 그림자
            if f[T] < f[WARN] - 0.7 * c.speed {
                return;
            }
            let ly = round(f[Y]);
            let mut x = 2.0;
            while x < c.w {
                d.style(INK);
                d.rect(x - 1.0, ly - 1.0, 5.0, 3.0);
                d.style(pc("red", 3));
                d.rect(x, ly, 3.0, 1.0);
                x += 6.0;
            }
            if !odd(f[T] * 10.0) {
                d.save();
                d.alpha(0.6);
                birds(f, d, true, if f[DIR] > 0.0 { 20.0 } else { c.w - 20.0 });
                d.restore();
            }
            return;
        }
        if f[LOW] != 0.0 && f[FLEE] == 0.0 {
            d.shadow(f[X], 20.0);
        }
        birds(f, d, false, f[X]);
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
    pub const DRAW: Schema = &[];
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        let c = ctx();
        let k = if f[STATE] == S_WARN { f[T] / f[WARN] } else { 1.0 };
        d.rgba(30.0, 16.0, 14.0, 0.2 + 0.4 * k);
        d.rect(round(f[X] - 4.0 - 4.0 * k), GROUND, round(8.0 + 8.0 * k), 2.0);
        if f[STATE] == S_WARN {
            d.top_mark(f[X], f[T]);
            return;
        }
        // 내려앉은 상자 뒤로 숨비가 지나가면 반투명 · 쿵 박힐 때 살짝 눌림
        let rest = f[STATE] == S_REST;
        if rest && (c.px - f[X]).abs() < 12.0 && c.py > f[Y] {
            d.alpha(0.6);
        }
        let dip = if rest && f[REST_T] < 0.05 {
            2.0
        } else if rest && f[REST_T] < 0.1 {
            1.0
        } else {
            0.0
        };
        d.img(named("PARCEL"), round(f[X] - 9.0), round(f[Y] - 1.0) + dip);
        d.alpha(1.0);
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
    pub const DRAW: Schema = &[];
    // 밟힌 순간 한 칸 눌림 (그릴 때마다 sq가 줄어듦) · 사라지기 직전 깜빡
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        let sq = if f[SQ] > 0.0 { 1.0 } else { 0.0 };
        f[SQ] = max(0.0, or(f[SQ], 0.0) - 1.0 / 120.0);
        d.save();
        d.alpha(if f[LIFE] < 1.0 && odd(f[LIFE] * 10.0) { 0.4 } else { 1.0 });
        d.img(named("GLIDER"), round(f[X] - 15.0), round(f[Y] - 12.0 + sq));
        d.restore();
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
            (f[X], f[Y]) = pos(f, min(1.0, s));
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
    pub const DRAW: Schema = &[];
    // 궤도 위 s(0 → 1) 자리
    pub fn pos(f: &[f64], s: f64) -> (f64, f64) {
        (lerp(f[X0], f[X1], s), GROUND + 10.0 - (f[PEAK] + 10.0) * 4.0 * s * (1.0 - s))
    }
    // 지나갈 길: 처음엔 또렷한 점선, 뛰어오르면 남은 길만 옅게 · 솟을 자리와 떨어질 자리에 조여 드는 물결 고리
    pub fn decal(f: &mut [f64], d: &mut Draw) {
        let s0 = max(0.0, f[S]);
        let on = f[S] < 0.0;
        if on || s0 < 0.6 {
            let mut s = s0;
            while s <= 1.001 {
                let (x, y) = pos(f, s);
                if y <= GROUND - 2.0 {
                    if on {
                        d.style(INK);
                        d.rect(round(x) - 1.0, round(y) - 1.0, 3.0, 3.0);
                        d.style(pc("red", 3));
                    } else {
                        d.rgba(232.0, 69.0, 74.0, 0.35);
                    }
                    d.rect(round(x), round(y), 1.0, 1.0);
                }
                s += 0.045;
            }
        }
        if on {
            let k = clamp(f[T] / f[WARN], 0.0, 1.0);
            for ex in [f[X0], f[X1]] {
                let r = round(10.0 - 6.0 * k);
                d.style(INK);
                d.rect(round(ex - r - 1.0), GROUND - 1.0, 2.0 * r + 3.0, 3.0);
                d.style(hexc(if odd(f[T] * 12.0) { 0x9ec2d4 } else { 0xcfe4ec }));
                d.rect(round(ex - r), GROUND, 2.0 * r + 1.0, 1.0);
            }
        }
    }
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        if f[S] < 0.0 {
            return;
        }
        let i = if f[S] < 0.38 {
            0.0
        } else if f[S] < 0.62 {
            1.0
        } else {
            2.0
        };
        let fr = named(if f[DIR] > 0.0 { "DOLPHIN" } else { "DOLPHIN_L" }).at(i);
        d.save();
        d.clip(-60.0, -VOFF - 40.0, ctx().w + 120.0, GROUND + VOFF + 40.0); // 물 밑으로는 안 보이게
        d.img(fr, round(f[X] - 13.0), round(f[Y] - 9.0));
        d.restore();
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
                ghost(frame(f), f[X], f[Y], 0.15, pc("red", 2));
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
    pub const DRAW: Schema = &[];
    // 지금 그림: 내리꽂는 중이면 날개 접은 그림, 아니면 날갯짓 (동굴에서는 박쥐) — 잔상도 이 그림
    pub fn frame(f: &[f64]) -> Img {
        let dive = f[STATE] == S_DIVE;
        let set = named(if f[BAT] != 0.0 { "BAT" } else { "CROW" }).side(if dive { f[VX] } else { f[FACE] } >= 0.0);
        if dive {
            set.at(3.0)
        } else {
            set.at([0.0, 1.0, 2.0, 1.0][(f[ANIM].floor() % 4.0) as usize])
        }
    }
    // 조준선: 따라다니는 동안은 옅게, 굳으면 붉은 점선이 빨라지게 깜빡 + 땅에 ×
    pub fn decal(f: &mut [f64], d: &mut Draw) {
        if f[STATE] != S_AIM {
            return;
        }
        let c = ctx();
        if f[LOCKED] == 0.0 {
            d.rgba(232.0, 69.0, 74.0, 0.3);
            let dx = c.px - f[X];
            let dy = max(50.0, c.py - 10.0 - f[Y]);
            let n = hypot(dx, dy) / 6.0;
            let mut i = 1.0;
            while i < n {
                d.rect(round(f[X] + dx * i / n), round(f[Y] + dy * i / n), 1.0, 1.0);
                i += 1.0;
            }
            return;
        }
        let left = 0.9 * c.speed - f[T];
        let blink = odd(f[T] * if left < 0.25 * c.speed { 20.0 } else { 8.0 });
        let n = hypot(f[GX] - f[X], GROUND - 4.0 - f[Y]) / 5.0;
        let mut i = 1.0;
        while i < n {
            let x = round(lerp(f[X], f[GX], i / n));
            let y = round(lerp(f[Y], GROUND - 4.0, i / n));
            d.style(INK);
            d.rect(x - 1.0, y - 1.0, 3.0, 3.0);
            d.style(if blink { pc("yel", 3) } else { pc("red", 3) });
            d.rect(x, y, 1.0, 1.0);
            i += 1.0;
        }
        let gx = round(f[GX]);
        d.style(INK);
        d.rect(gx - 3.0, GROUND - 1.0, 7.0, 3.0);
        d.style(pc("red", 3));
        d.rect(gx - 2.0, GROUND, 5.0, 1.0);
        d.rect(gx, GROUND - 1.0, 1.0, 3.0);
    }
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        d.img(frame(f), round(f[X] - 9.0), round(f[Y] - 7.0));
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
    pub const DRAW: Schema = &[];
    // 떨어질 자리: 짙어지는 그림자 · 양 끝 깜빡이 · 낱말 그림자 · 위쪽 예고
    pub fn decal(f: &mut [f64], d: &mut Draw) {
        if f[ST] != S_WARN {
            return;
        }
        let (x, t, w, h) = (f[X], f[T], f[W], f[H]);
        let k = clamp(t / (f[LAND] - f[FALL]), 0.0, 1.0);
        let ww = round(w * (0.5 + 0.5 * k));
        let blink = odd(t * if k > 0.7 { 18.0 } else { 6.0 });
        d.rgba(30.0, 16.0, 14.0, 0.15 + 0.45 * k);
        d.rect(round(x - ww / 2.0), GROUND, ww, 2.0);
        d.rect(round(x - ww / 2.0) + 3.0, GROUND - 1.0, ww - 6.0, 1.0);
        d.style(if blink { pc("yel", 3) } else { pc("red", 3) });
        for ex in [x - w / 2.0, x + w / 2.0 - 2.0] {
            d.rect(round(ex), GROUND + 2.0, 2.0, 1.0);
        }
        if k > 0.25 {
            d.save();
            d.alpha(0.18 + 0.2 * k);
            d.img_sil(own(), pc("red", 2), round(x - w / 2.0), GROUND - h);
            d.restore();
        }
        d.top_mark(x - w / 2.0 + 3.0, t);
        d.top_mark(x + w / 2.0 - 3.0, t);
    }
    // 떨어지는 낱말 · 쿵 박힐 때 살짝 찌그러짐 · 박힌 자리 금
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        if f[ST] == S_WARN {
            return;
        }
        let (w, h) = (f[W], f[H]);
        let sq = if f[ST] == S_LAND && f[L_T] < 0.08 { 2.0 } else { 0.0 };
        let (x, y) = (round(f[X] - w / 2.0), round(f[Y]));
        if sq != 0.0 {
            d.img_scaled(own(), x - 2.0, y + sq, w + 4.0, h - sq);
        } else {
            d.img(own(), x, y);
        }
        if f[ST] == S_LAND {
            d.style(INK);
            let mut k = 0.0;
            while k < w {
                d.rect(x + k, GROUND - 1.0 - ((k / 5.0) % 2.0), 3.0, 1.0);
                k += 5.0;
            }
        }
    }
}
