// 장애물이 아닌 것 (원래 game.js): 줍는 것 · 플레이어의 귤 · 시험 답 팻말
//  움직임 · 그리기는 여기서 (판정 상자는 하나뿐이라 JS box()에 그대로 둠)
use crate::draw::*;
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
    const K_WATER: f64 = 4.0;
    const K_SHIELD: f64 = 5.0;
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
    pub const DRAW: Schema = &[];
    // 아이템(귤 망사리 ~ 한라봉)은 금빛 테 안에 · 그냥 귤은 빙글 돌며 착지 때 찌그러짐 · 이름표
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        let c = ctx();
        let (x, y, kind) = (f[X], f[Y], f[KIND]);
        if f[LIFE] < 1.2 && odd(f[LIFE] * 6.0) {
            return; // 사라지기 직전 깜빡
        }
        let item = (1.0..=6.0).contains(&kind);
        if item {
            let pulse = odd(c.amb_t * 6.0 + f[PHASE]);
            let (bx, by) = (round(x - 10.0), round(y - 21.0));
            d.style(INK);
            d.rect(bx - 1.0, by - 1.0, 22.0, 22.0);
            d.style(if pulse { pc("yel", 3) } else { pc("org", 3) });
            d.rect(bx, by, 20.0, 20.0);
            d.style(muted(0x2a2024)); // UI.panel
            d.rect(bx + 2.0, by + 2.0, 16.0, 16.0);
            for k in 0..4 {
                let a = c.amb_t * 3.0 + k as f64 * 1.57 + f[PHASE];
                d.style(hexc(0xfff4e0));
                d.rect(round(x + cos(a) * 14.0), round(y - 11.0 + sin(a) * 14.0), 1.0, 1.0);
            }
            d.light(x, y - 11.0, 16.0, pc("yel", 3), 0.6);
        }
        let img = match kind as usize {
            1 => named("BASKET"),
            2 => named("OMEGI"),
            3 => named("PINWHEEL").at((c.amb_t * 10.0).floor() % 2.0),
            4 => named("SAMDA"),
            5 => named("TEWAK").at((f[SPIN] * 4.0).floor() % 4.0),
            6 => named("HALLABONG"),
            7 => named("HALLABONG_FAKE"),
            _ => named("PICK_TANG").at((f[SPIN] * 8.0).floor() % 8.0).at(if f[SQ] > 0.0 { 1.0 } else { 0.0 }),
        };
        let (iw, ih) = (img.w(), img.h());
        // 그림자: 땅에 가까울수록 크고 진하게
        let near = clamp(1.0 - (GROUND - y) / 100.0, 0.0, 1.0);
        if near > 0.15 {
            d.shadow(x, round(3.0 + near * (iw - 6.0)));
        }
        if kind == K_FAKE {
            // 함정: 둘레에 날파리
            let a = c.amb_t * 9.0 + x;
            d.style(INK);
            d.rect(round(x + cos(a) * 7.0), round(y - 12.0 + sin(a * 1.3) * 3.0), 1.0, 1.0);
        }
        d.img(img, round(x - iw / 2.0), round(y - ih + 1.0));
        if kind == K_WATER && (c.amb_t * 6.0 + f[PHASE]).floor() % 3.0 == 0.0 {
            d.style(hexc(0xf4fcff));
            d.rect(round(x + cos(c.amb_t * 3.0) * 7.0), round(y - 10.0 + sin(c.amb_t * 4.0) * 6.0), 1.0, 1.0);
            d.light(x, y - 8.0, 12.0, hexc(0xc8f0ff), 0.5);
        }
        if kind == K_SHIELD {
            let mut a = 0.0;
            while a < 6.28 {
                if (round(a / 0.4) + (c.amb_t * 8.0).floor()) % 2.0 == 0.0 {
                    d.style(pc("yel", 3));
                    d.rect(round(x + cos(a) * 8.0), round(y - ih / 2.0 + sin(a) * 8.0), 1.0, 1.0);
                }
                a += 0.4;
            }
        }
        if item || kind == K_FAKE || (f[GROUNDED] != 0.0 && (x - c.px).abs() < 60.0) {
            let label = ["+1", "귤+5", "점수×2", "귤자석", "삼다수", "방패", "+♥", "×"][kind as usize];
            let col = if kind == K_FAKE { pc("red", 3) } else { pc("yel", 3) };
            d.text(label, x, if item { y - 31.0 } else { y - ih - 8.0 }, col);
        }
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
    // 그리기 전용: 꼬리 자국 [x, y] 다섯 개 (JS가 움직인 뒤 쌓음)
    pub const DRAW: Schema = &[("trail", Ty::List)];
    const TRAIL: usize = SCHEMA.len();
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        for (i, p) in list(f, TRAIL).chunks(2).enumerate() {
            d.style(if i < 2 { pc("org", 1) } else { pc("org", 2) });
            d.rect(round(p[0]), round(p[1]), 2.0, 2.0);
        }
        let img = named("TANGERINE");
        d.img(img, round(f[X] - img.w() / 2.0) + (f[ROT].floor() % 2.0), round(f[Y] - img.h() / 2.0));
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
    // 그리기 전용: 가로 자리
    pub const DRAW: Schema = &[("x", Ty::Num)];
    const X: usize = SCHEMA.len();
    // 팻말이 톡 튀어나오고, 잠시 뒤 아래에 깜빡이는 화살표
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        let s = own();
        let k = ease_back(min(1.0, f[T] / 0.3));
        d.img(s, round(f[X] - s.w() / 2.0), round(f[Y] + (1.0 - k) * 8.0));
        if f[T] > 0.4 && odd(f[T] * 3.0) {
            let (ax, ay) = (round(f[X]), f[Y] + s.body_h() + 3.0);
            d.style(INK);
            d.rect(ax - 3.0, ay - 1.0, 7.0, 5.0);
            d.style(pc("yel", 3));
            d.rect(ax, ay, 1.0, 3.0);
            d.rect(ax - 1.0, ay + 1.0, 3.0, 1.0);
            d.rect(ax - 2.0, ay + 2.0, 5.0, 1.0);
        }
    }
}
