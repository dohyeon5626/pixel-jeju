// 이벤트(보스) 공격 (원래 game.js): 비트 바 · 회오리 · 구독 버튼 · 귤 상자 · 레이저 · 칼날 파동 · 칼 · 물줄기 · 물결 · 오름 · 파도 · 착지 그림자
use crate::draw::*;
use crate::game::*;
use crate::js::*;
use crate::noise::hash2;

// 물빛 (JS WATER) · 회오리 흙먼지 (JS Vortex.DUST)
fn water(i: usize) -> f64 {
    muted([0x2e5a7a, 0x4a86a8, 0x7ab4cc, 0xbfe0ea, 0xf2fbff][i])
}
const VORTEX_DUST: [u32; 6] = [0x3a2f28, 0x524236, 0x6c5746, 0x88705a, 0xa48b70, 0xbea688];
// 파도 (JS TIDE: 채도 0.85로 mute)
fn tide_col(i: usize) -> f64 {
    muted85([0x0e2e58, 0x1a4e86, 0x2a72aa, 0x3e98c4, 0x6cc4dc, 0xc8eef4, 0xffffff][i])
}

// ── 할망 비트에 맞춰 땅에서 솟는 주상절리 기둥 (글자면 그 글자가 솟음) ──
//  박자 시계는 JS가 부를 때마다 bNow에 넣어 줌
pub mod beat_bar {
    use super::*;
    pub const SCHEMA: Schema = &[
        ("x", Ty::Num),
        ("beatAt", Ty::Num),
        ("b0", Ty::Num),
        ("bNow", Ty::Num),
        ("lastB", Ty::Num),
        ("t", Ty::Num),
        ("H", Ty::Num),
        ("h", Ty::Num),
        ("up", Ty::Bool),
        ("upT", Ty::Num),
        ("acc", Ty::Bool),
        ("j", Ty::Num),
        ("letter", Ty::Bool),
        ("sprH", Ty::Num),
        ("top", Ty::Num),
        ("gap", Ty::Num),
        ("lifted", Ty::Num),
        ("boxY", Ty::Num),
        ("dead", Ty::Bool),
    ];
    const X: usize = 0;
    const BEAT_AT: usize = 1;
    const B0: usize = 2;
    const B_NOW: usize = 3;
    const LAST_B: usize = 4;
    const T: usize = 5;
    const BIG_H: usize = 6;
    const H: usize = 7;
    const UP: usize = 8;
    const UP_T: usize = 9;
    const ACC: usize = 10;
    const J: usize = 11;
    const LETTER: usize = 12;
    const SPR_H: usize = 13;
    const TOP: usize = 14;
    const GAP: usize = 15;
    const LIFTED: usize = 16;
    const BOX_Y: usize = 17;
    const DEAD: usize = 18;
    fn chunk(x: f64, y: f64, vx: f64, vy: f64, grav: f64, life: f64, size: f64, col: f64) {
        Fx { vx, vy, grav, life, size, col, ..Fx::new("chunk", x, y) }.emit();
    }
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        let c = ctx();
        let x = f[X];
        let acc = f[ACC] != 0.0;
        let letter = f[LETTER] != 0.0;
        f[T] += dt;
        let b = f[B_NOW];
        // 박자마다 그 자리 흙알갱이가 톡톡 튐 (언제 솟을지 몸으로 느끼게)
        if f[UP] == 0.0 && b.floor() > f[LAST_B] {
            f[LAST_B] = b.floor();
            let last = f[BEAT_AT] - b < 1.05;
            for _ in 0..if last { 4 } else { 2 } {
                let px = x + rand(-5.0, 5.0);
                let vx = rand(-15.0, 15.0);
                let vy = -rand(40.0, if last { 110.0 } else { 70.0 });
                chunk(px, GROUND - 1.0, vx, vy, 420.0, 0.35, 1.0, pick(&[pc("soil", 3), pc("stone", 3)]));
            }
        }
        // 박자 시계가 멈춰도 결국은 솟음
        if f[UP] == 0.0 && (b >= f[BEAT_AT] || f[T] > ((f[BEAT_AT] - f[B0]) * 60.0 / or(c.tempo, 92.0) + 1.0) * c.speed) {
            f[UP] = 1.0;
            f[UP_T] = 0.0;
            shake(if acc { 0.07 } else { 0.03 });
            sfx_args("burst", acc as i32 as f64, 0.0); // 땅을 뚫는 쿵 (+ 글자는 음계 소리)
            if letter {
                sfx_args("letter", or(f[J], 0.0), acc as i32 as f64);
            }
            for sd in [-1.0, 1.0] {
                Fx { vx: sd * 40.0, vy: -10.0, drag: 3.0, life: 0.3, size: 0.0, ..Fx::new("puff", x + sd * 6.0, GROUND - 1.0) }.emit();
            }
            Fx { big: acc, life: if acc { 0.3 } else { 0.22 }, col: pc("yel", 3), ..Fx::new("ring", x, GROUND - 1.0) }.emit();
            if acc {
                Fx { size: 9.0, life: 0.12, col: hexc(0xfff4d8), ..Fx::new("flare", x, GROUND - f[BIG_H] / 2.0) }.emit();
                for _ in 0..4 {
                    let px = x + rand(-8.0, 8.0);
                    let vx = rand(-90.0, 90.0);
                    let vy = -rand(90.0, 170.0);
                    let life = rand(0.4, 0.6);
                    chunk(px, GROUND - 1.0, vx, vy, 420.0, life, 2.0, pick(&[pc("stone", 2), pc("soil", 3)]));
                }
            }
            for _ in 0..5 {
                let px = x + rand(-6.0, 6.0);
                let py = GROUND - rand(4.0, 20.0);
                let vx = rand(-60.0, 60.0);
                let vy = -rand(60.0, 140.0);
                let life = rand(0.35, 0.6);
                let size = randi(1.0, 2.0);
                chunk(px, py, vx, vy, 420.0, life, size, pick(&[pc("stone", 2), pc("stone", 3), pc("soil", 3)]));
            }
        }
        if f[UP] != 0.0 {
            let was = f[UP_T];
            f[UP_T] += dt / c.speed;
            let u = f[UP_T];
            if letter {
                // 글자: 땅속에서 확 뛰어오름 → 떨어지듯 내려와 살짝 튕기며 멈춤 → 뜬 채 살랑 → 다시 땅속으로
                //  gap = 글자 아랫단과 땅 사이
                let s = f[SPR_H];
                let base = GROUND - s + 10.0;
                let peak = if acc { 22.0 } else { 16.0 };
                let hov = 7.0;
                let gap = if u < 0.09 {
                    -s + (peak + s) * ease_out(u / 0.09)
                } else if u < 0.17 {
                    peak - (peak - hov + 2.0) * pow((u - 0.09) / 0.08, 2.0)
                } else if u < 0.2 {
                    hov - 2.0 + 2.0 * sin((u - 0.17) / 0.03 * PI / 2.0)
                } else if u < 0.26 {
                    hov + sin((u - 0.2) * 30.0) * 0.8
                } else {
                    hov - (hov + s) * pow(clamp((u - 0.26) / 0.07, 0.0, 1.0), 1.5)
                };
                f[TOP] = round(base - gap);
                f[GAP] = gap;
                f[LIFTED] = clamp(gap / 6.0, 0.0, 1.0);
                f[BOX_Y] = f[TOP] + 4.0;
                f[H] = max(0.0, min(GROUND, f[TOP] + s - 10.0) - f[BOX_Y]); // 판정은 글자 몸통만 (높이 뛴 순간엔 밑이 빔)
                if was < 0.17 && u >= 0.17 {
                    // 내려앉을 때 밑에서 흙먼지
                    for sd in [-1.0, 1.0] {
                        Fx { vx: sd * 35.0, vy: -8.0, drag: 4.0, life: 0.25, size: 0.0, ..Fx::new("puff", x + sd * 5.0, GROUND - 1.0) }
                            .emit();
                    }
                }
                if was < 0.26 && u >= 0.26 {
                    // 들어갈 때 흙이 튐
                    for _ in 0..4 {
                        let px = x + rand(-5.0, 5.0);
                        let vx = rand(-25.0, 25.0);
                        let vy = -rand(20.0, 50.0);
                        chunk(px, GROUND - 2.0, vx, vy, 380.0, 0.35, 1.0, pick(&[pc("soil", 3), pc("stone", 2)]));
                    }
                }
                return f[DEAD] == 0.0 && u <= 0.34; // u는 솟은 뒤라 NaN이 아님
            }
            // 기둥 강세: 높이 솟았다가 내려앉음
            let big_h = f[BIG_H];
            let ov = if acc { 1.15 } else { 1.0 };
            f[H] = if u < 0.045 {
                round(big_h * ov * u / 0.045)
            } else if u < 0.09 {
                round(big_h * (ov - (ov - 1.0) * (u - 0.045) / 0.045))
            } else if u < 0.24 {
                big_h
            } else {
                round(big_h * max(0.0, 1.0 - (u - 0.24) / 0.07))
            };
            if was < 0.24 && u >= 0.24 {
                for _ in 0..4 {
                    let px = x + rand(-5.0, 5.0);
                    let py = GROUND - rand(10.0, 30.0);
                    let vx = rand(-25.0, 25.0);
                    let vy = rand(-30.0, 0.0);
                    chunk(px, py, vx, vy, 380.0, 0.4, 1.0, pc("stone", 2));
                }
            }
        }
        f[DEAD] == 0.0 && !(f[UP] != 0.0 && f[UP_T] > 0.32)
    }
    pub fn boxes(f: &[f64]) -> Boxes {
        if f[H] <= 8.0 {
            return vec![];
        }
        if f[LETTER] != 0.0 {
            let y = if f[BOX_Y].is_nan() { GROUND - f[H] } else { f[BOX_Y] };
            vec![[f[X] - 8.0, y, 16.0, f[H]]]
        } else {
            vec![[f[X] - 5.0, GROUND - f[H], 10.0, f[H]]]
        }
    }
    // 그리기 전용: 솟을 자리의 금 [cx, cy] (왼쪽 일곱 · 오른쪽 일곱)
    pub const DRAW: Schema = &[("crack", Ty::List)];
    const CRACK: usize = SCHEMA.len();
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        let x = round(f[X]);
        let letter = f[LETTER] != 0.0;
        let spr = own();
        if f[UP] == 0.0 {
            // 예고: 땅에 육각 테두리 + 박자마다 금빛으로 뛰는 테 + 솟기 직전 벌어지는 금
            let b = f[B_NOW];
            let left = f[BEAT_AT] - b;
            let fr = ((b % 1.0) + 1.0) % 1.0;
            let k = clamp(1.0 - left / 2.0, 0.0, 1.0);
            d.rgba(30.0, 16.0, 14.0, 0.35);
            d.rect(x - 5.0, GROUND, 11.0, 2.0);
            d.style(INK);
            d.rect(x - 5.0, GROUND - 1.0, 11.0, 1.0);
            d.rect(x - 5.0, GROUND + 2.0, 11.0, 1.0);
            d.rect(x - 7.0, GROUND, 2.0, 2.0);
            d.rect(x + 6.0, GROUND, 2.0, 2.0);
            if left < 1.0 {
                d.style(if odd(f[T] * 20.0) { pc("org", 3) } else { pc("yel", 3) });
            } else if fr < 0.22 {
                d.style(pc("yel", 2));
            } else {
                d.mix(pc("yel", 0), pc("soil", 2), 0.4);
            }
            d.rect(x - 4.0, GROUND - 1.0, 9.0, 1.0);
            d.rect(x - 4.0, GROUND + 2.0, 9.0, 1.0);
            d.rect(x - 6.0, GROUND, 1.0, 2.0);
            d.rect(x + 6.0, GROUND, 1.0, 2.0);
            d.style(INK);
            let crack = list(f, CRACK);
            let n = (crack.len() as f64 / 2.0 / 2.0 * k).ceil() as usize;
            for s in 0..2 {
                for i in 0..n {
                    let c = &crack[(s * 7 + i) * 2..];
                    d.rect(x + if c[0] > 0.0 { 6.0 } else { -6.0 } + c[0], GROUND + c[1], 1.0, 1.0);
                }
            }
            if left < 0.5 {
                // 솟기 직전: 땅 위로 끝이 살짝 보이며 덜덜
                let jy = (f[T] * 30.0).floor() % 2.0;
                let w = spr.w();
                if letter {
                    d.img_part(spr, [0.0, 6.0, w, 4.0], [round(x - w / 2.0) + jy, GROUND - 3.0, w, 4.0]);
                } else {
                    d.img_part(spr, [0.0, 0.0, w, 4.0], [x - 7.0 + jy, GROUND - 3.0, w, 4.0]);
                }
            }
            return;
        }
        if f[H] <= 0.0 {
            return;
        }
        let glow = if f[UP_T] < 0.16 { 0.5 } else { 0.2 };
        if letter {
            // 글자: 땅 선 아래는 가려 땅속에서 나오고 들어가는 것처럼 · 떠 있는 동안 땅에 그림자
            let w = spr.w();
            let sx = round(x - w / 2.0);
            if f[LIFTED] > 0.0 {
                // 그림자: 높이 뛸수록 작고 옅게
                let sw = round(clamp(9.0 - (f[GAP] - 7.0) * 0.25, 5.0, 9.0));
                d.rgba(30.0, 16.0, 14.0, 0.38 * f[LIFTED] * clamp(1.2 - f[GAP] / 30.0, 0.4, 1.0));
                d.rect(x - sw, GROUND - 1.0, sw * 2.0 + 1.0, 2.0);
                d.rect(x - sw + 2.0, GROUND + 1.0, sw * 2.0 - 3.0, 1.0);
            }
            d.save();
            d.clip(sx - 2.0, -VOFF, w + 4.0, GROUND + VOFF + 1.0);
            d.img(spr, sx, f[TOP]);
            if f[ACC] != 0.0 && f[UP_T] < 0.06 {
                // 강세 글자: 솟는 순간 하얗게 번쩍
                d.alpha(0.7);
                d.img_sil(spr, hexc(0xfff4d8), sx, f[TOP]);
                d.alpha(1.0);
            }
            d.restore();
            d.light(f[X], f[TOP] + 10.0, 14.0, hexc(0xffd890), glow);
            return;
        }
        let (w, hh) = (spr.w(), min(spr.h(), f[H]));
        d.img_part(spr, [0.0, 0.0, w, hh], [x - 7.0, GROUND - hh, w, hh]);
        if f[UP_T] < 0.16 {
            // 솟는 순간 윗면 금빛
            d.alpha(0.6);
            d.style(pc("yel", 3));
            d.rect(x - 4.0, GROUND - f[H] + 2.0, 9.0, 2.0);
            d.alpha(1.0);
        }
        d.light(f[X], GROUND - f[H], 14.0, hexc(0xffd890), glow);
    }
}

// ── 태풍 마이삭: 땅에서 말려 올라가 깔때기가 된 뒤 기어 옴 (big이면 먹구름 · 번개까지) ──
pub mod vortex {
    use super::*;
    pub const SCHEMA: Schema = &[
        ("x", Ty::Num),
        ("speed", Ty::Num),
        ("dir", Ty::Num),
        ("t", Ty::Num),
        ("spin", Ty::Num),
        ("formT", Ty::Num),
        ("big", Ty::Bool),
        ("boltT", Ty::Num),
        ("bolt", Ty::Num),
        ("dead", Ty::Bool),
    ];
    const X: usize = 0;
    const SPEED: usize = 1;
    const DIR: usize = 2;
    const T: usize = 3;
    const SPIN: usize = 4;
    const FORM_T: usize = 5;
    const BIG: usize = 6;
    const BOLT_T: usize = 7;
    const BOLT: usize = 8;
    const DEAD: usize = 9;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        let c = ctx();
        let (dir, speed) = (f[DIR], f[SPEED]);
        f[T] += dt;
        f[SPIN] += dt * 9.0;
        let formed = f[T] >= f[FORM_T];
        if formed {
            f[X] += dir * speed * dt;
        }
        let x = f[X];
        if random() < dt * if formed { 25.0 } else { 40.0 } {
            let a = rand(0.0, 6.28);
            let y = GROUND - rand(4.0, 36.0);
            let vx = -sin(a) * 60.0 + if formed { dir * speed } else { 0.0 };
            let vy = -rand(30.0, 70.0);
            let col = pick(&[pc("leaf", 2), pc("leaf", 3), pc("wood", 2)]);
            Fx { vx, vy, life: 0.6, size: 1.0, col, ..Fx::new("chunk", x + cos(a) * 14.0, y) }.emit();
        }
        if formed && random() < dt * 22.0 {
            // 발치에서 흙 알갱이가 휘감겨 튐
            let a = rand(0.0, 6.28);
            let px = x + cos(a) * rand(10.0, 22.0);
            let y = GROUND - rand(1.0, 10.0);
            let vx = -sin(a) * rand(60.0, 110.0) + dir * speed * 0.5;
            let vy = -rand(20.0, 70.0);
            let col = pick(&VORTEX_DUST.map(muted));
            Fx { vx, vy, grav: 160.0, life: 0.5, size: 1.0, col, ..Fx::new("chunk", px, y) }.emit();
        }
        gset("windTarget", sign(x - c.px) * min(52.0, 34.0 + c.tier * 4.0) * if formed { 1.0 } else { 0.4 });
        if formed && random() < dt * 18.0 {
            // 땅을 쓸며 빨려 드는 흙먼지
            let sd = if random() < 0.5 { -1.0 } else { 1.0 };
            let px = x + sd * rand(40.0, 90.0);
            let y = GROUND - rand(1.0, 5.0);
            let vx = -sd * rand(120.0, 180.0);
            let vy = -rand(0.0, 12.0);
            let len = randi(3.0, 7.0);
            Fx { vx, vy, life: 0.35, len, col: css("rgba(150,130,105,0.6)"), ..Fx::new("streak", px, y) }.emit();
        }
        if f[BIG] != 0.0 {
            // 마이삭: 하늘이 먹구름으로 덮이고 빗소리 · 깔때기 꼭대기로 번개가 내리꽂히고, 화면 끝에서 바람이 빨려 들어감
            gset("storm", min(0.7, c.storm + dt * 1.5));
            gset("stormHold", 0.15);
            gset("stormDir", dir);
            f[BOLT_T] = if f[BOLT_T].is_nan() { 0.4 } else { f[BOLT_T] } - dt;
            f[BOLT] = max(0.0, or(f[BOLT], 0.0) - dt);
            if f[BOLT_T] <= 0.0 {
                f[BOLT_T] = rand(0.9, 1.5) * c.speed;
                f[BOLT] = 0.13;
                gset("lightning", max(c.lightning, 0.12));
                sfx("thunder");
                shake(0.12);
                hook("bolt", 0.0, 0.0, 0.0, 0.0); // 번개 모양은 JS makeBolt가 그림용으로 만듦
            }
            if random() < dt * 20.0 {
                let sd = if random() < 0.5 { -1.0 } else { 1.0 };
                let sy = rand(-VOFF + 30.0, GROUND - 6.0);
                let edge = if sd < 0.0 { 0.0 } else { c.w };
                let len = randi(6.0, 14.0);
                let col = css("rgba(220,226,240,0.45)");
                let px = if sd < 0.0 { -4.0 } else { c.w + 4.0 };
                Fx { vx: (x - edge) * 1.6, vy: (GROUND - 30.0 - sy) * 0.8, life: 0.6, len, col, ..Fx::new("streak", px, sy) }.emit();
            }
        }
        if random() < dt * 6.0 {
            sfx("gust");
        }
        if random() < dt * 30.0 {
            let px = rand(0.0, c.w);
            let vy = rand(260.0, 340.0);
            let len = randi(5.0, 9.0);
            let life = (GROUND + VOFF + 12.0) / 260.0;
            Fx { vx: -60.0, vy, life, len, col: css("rgba(200,210,230,0.45)"), ..Fx::new("streak", px, -VOFF - 4.0) }.emit();
        }
        let alive = f[DEAD] == 0.0 && x > -40.0 && x < c.w + 40.0;
        if !alive {
            gset("windTarget", 0.0);
        }
        alive
    }
    pub fn boxes(f: &[f64]) -> Boxes {
        if f[T] < f[FORM_T] {
            return vec![];
        }
        let h = if f[BIG] != 0.0 { 40.0 } else { 30.0 };
        vec![[f[X] - 9.0, GROUND - h, 18.0, h]]
    }
    // 그리기 전용: 번개 모양 [x, y] (JS makeBolt가 만듦)
    pub const DRAW: Schema = &[("boltPts", Ty::List)];
    const BOLT_PTS: usize = SCHEMA.len();
    // 깔때기 둘레를 도는 잔해 (front: 깔때기 앞쪽 반바퀴만 · 아니면 뒤쪽)
    fn debris(f: &[f64], d: &mut Draw, front: bool) {
        for i in 0..6 {
            let fi = i as f64;
            let a = f[SPIN] * (1.1 + fi * 0.07) + fi * 1.05;
            let depth = sin(a);
            if (depth > 0.0) != front {
                continue;
            }
            let y = GROUND - 8.0 - fi * 5.0;
            let r = 6.0 + fi * 2.2;
            let (px, py) = (round(f[X] + cos(a) * r), round(y + depth * 2.0));
            if i % 3 == 0 {
                d.save();
                if !front {
                    d.alpha(0.6);
                }
                d.img(named(if i % 2 == 1 { "TANGERINE" } else { "PEBBLE" }), px - 4.0, py - 4.0);
                d.restore();
            } else {
                d.style(if !front {
                    pc("leaf", 1)
                } else if i % 2 == 1 {
                    pc("leaf", 3)
                } else {
                    pc("wood", 2)
                });
                d.rect(px, py, 2.0, 1.0);
                d.rect(px + if i % 2 == 1 { 1.0 } else { 0.0 }, py - 1.0, 1.0, 1.0);
            }
        }
    }
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        let cx = f[X];
        let form = clamp(f[T] / f[FORM_T], 0.0, 1.0);
        let pts = list(f, BOLT_PTS);
        if f[BOLT] > 0.0 && !pts.is_empty() {
            for w in pts.chunks(2).collect::<Vec<_>>().windows(2) {
                let (p, q) = (w[0], w[1]);
                d.line(p[0], p[1], q[0], q[1], 3.0, hexc(0xa8b8ff));
                d.line(p[0], p[1], q[0], q[1], 1.0, hexc(0xfff4e0));
            }
            d.light(cx, GROUND - 60.0, 30.0, hexc(0xc8d4ff), 0.8);
        }
        if form < 1.0 {
            // 예고: 땅에 소용돌이 고리가 말려 들어감
            d.style(INK);
            let mut a = 0.0;
            while a < 6.28 {
                let r = 14.0 * (1.0 - form) + 4.0;
                d.rect(round(cx + cos(a + f[SPIN]) * r), GROUND + round(sin(a + f[SPIN]) * 1.5), 1.0, 1.0);
                a += 0.3;
            }
        }
        debris(f, d, false);
        d.funnel(form);
        debris(f, d, true);
    }
}

// ── 구독 버튼: 예고 → 쾅 떨어져 박힘 ──
pub mod sub_slam {
    use super::*;
    pub const SCHEMA: Schema = &[
        ("x", Ty::Num),
        ("y", Ty::Num),
        ("t", Ty::Num),
        ("warn", Ty::Num),
        ("state", Ty::Enum(&["warn", "fall", "hold"])),
        ("vy", Ty::Num),
        ("holdT", Ty::Num),
        ("sprW", Ty::Num),
        ("sprH", Ty::Num),
        ("dead", Ty::Bool),
    ];
    const X: usize = 0;
    const Y: usize = 1;
    const T: usize = 2;
    const WARN: usize = 3;
    const STATE: usize = 4;
    const VY: usize = 5;
    const HOLD_T: usize = 6;
    const SPR_W: usize = 7;
    const SPR_H: usize = 8;
    const DEAD: usize = 9;
    const S_WARN: f64 = 0.0;
    const S_FALL: f64 = 1.0;
    const S_HOLD: f64 = 2.0;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        let speed = ctx().speed;
        let x = f[X];
        f[T] += dt;
        if f[STATE] == S_WARN && f[T] >= f[WARN] {
            f[STATE] = S_FALL;
        }
        if f[STATE] == S_FALL {
            f[VY] = min(1100.0, or(f[VY], 280.0) + 3200.0 * dt / speed);
            f[Y] += f[VY] / speed * dt;
            if f[Y] >= GROUND - f[SPR_H] {
                f[Y] = GROUND - f[SPR_H];
                f[STATE] = S_HOLD;
                f[HOLD_T] = 0.0;
                sfx("thud");
                hitstop(0.025, 0.4);
                shake(0.1);
                impact(x, GROUND - 2.0, pc("red", 3), 0.7, false);
                burst(x, GROUND - 8.0, 6.0, &[pc("red", 2), pc("red", 3), hexc(0xfff4e0)], 90.0, 0.5, 320.0, "chunk");
                hook("label", x, GROUND - 26.0, pc("red", 3), 0.0);
            }
        }
        if f[STATE] == S_HOLD {
            f[HOLD_T] += dt;
            if f[HOLD_T] > 0.3 {
                burst(x, GROUND - 6.0, 8.0, &[pc("red", 2), pc("red", 3)], 70.0, 0.4, 200.0, "px");
                return false;
            }
        }
        f[DEAD] == 0.0
    }
    pub fn boxes(f: &[f64]) -> Boxes {
        if f[STATE] == S_WARN {
            return vec![];
        }
        vec![[f[X] - f[SPR_W] / 2.0 + 2.0, f[Y] + 2.0, f[SPR_W] - 4.0, f[SPR_H] - 2.0]]
    }
    pub const DRAW: Schema = &[];
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        let (x, w) = (f[X], f[SPR_W]);
        let warn = f[STATE] == S_WARN;
        // 그림자 예고: 떨어질수록 진해짐
        let k = if warn { f[T] / f[WARN] } else { 1.0 };
        d.rgba(30.0, 16.0, 14.0, 0.2 + 0.4 * k);
        d.rect(round(x - w / 2.0 * (0.5 + 0.5 * k)), GROUND, round(w * (0.5 + 0.5 * k)), 2.0);
        if warn && even(f[T] * 12.0) {
            d.style(pc("red", 2));
            d.rect(round(x - 1.0), GROUND - 10.0, 2.0, 6.0);
            d.rect(round(x - 1.0), GROUND - 3.0, 2.0, 2.0);
        }
        if warn {
            d.top_mark(x, f[T]);
            return;
        }
        // 쾅 박힐 때 살짝 눌렸다 올라오고 하얗게 번쩍
        let q = if f[STATE] == S_HOLD { f[HOLD_T] / ctx().speed } else { 1.0 };
        let dip = if q < 0.05 {
            2.0
        } else if q < 0.1 {
            1.0
        } else {
            0.0
        };
        let (px, py) = (round(x - w / 2.0), round(f[Y]) + dip);
        d.img(own(), px, py);
        if q < 0.05 {
            d.alpha(0.7);
            d.img_sil(own(), hexc(0xfff4e0), px, py);
            d.alpha(1.0);
        }
    }
}

// ── 귤 상자 내려찍기: 화면 위에 매달려 흔들리다 구역째 쾅 (hy: 매달린 높이, 그리기도 씀) ──
pub mod area_smash {
    use super::*;
    pub const SCHEMA: Schema = &[
        ("x0", Ty::Num),
        ("x1", Ty::Num),
        ("delay", Ty::Num),
        ("t", Ty::Num),
        ("hitT", Ty::Num),
        ("y", Ty::Num),
        ("hy", Ty::Num),
        ("landed", Ty::Bool),
        ("dead", Ty::Bool),
    ];
    const X0: usize = 0;
    const X1: usize = 1;
    const DELAY: usize = 2;
    const T: usize = 3;
    const HIT_T: usize = 4;
    const Y: usize = 5;
    const HY: usize = 6;
    const LANDED: usize = 7;
    const DEAD: usize = 8;
    fn hang_y(f: &[f64], speed: f64) -> f64 {
        let e = ease_out(f[T] / (0.35 * speed));
        let k = clamp(f[T] / f[DELAY], 0.0, 1.0);
        round(-VOFF + 14.0 + 22.0 * e - if k > 0.75 { 3.0 * (k - 0.75) / 0.25 } else { 0.0 })
    }
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        let speed = ctx().speed;
        let (x0, x1) = (f[X0], f[X1]);
        f[T] += dt;
        f[HY] = hang_y(f, speed);
        let k = f[T] / f[DELAY];
        // 떨어지기 직전: 상자 틈으로 흙먼지 · 귤잎이 부스스
        if f[HIT_T] < 0.0 && k > 0.6 && random() < dt * 30.0 {
            let x = rand(x0 + 4.0, x1 - 4.0);
            let vx = rand(-8.0, 8.0);
            let vy = rand(20.0, 50.0);
            let col = pick(&[pc("wood", 2), pc("leaf", 2), pc("soil", 3)]);
            Fx { vx, vy, grav: 200.0, life: 0.6, size: 1.0, col, ..Fx::new("chunk", x, f[HY] + 20.0) }.emit();
        }
        if f[T] >= f[DELAY] && f[HIT_T] < 0.0 {
            f[HIT_T] = 0.0;
            f[Y] = f[HY];
            sfx("whoosh");
        }
        if f[HIT_T] >= 0.0 {
            f[HIT_T] += dt;
            f[Y] = min(GROUND - 20.0, f[Y] + dt * 1800.0);
            if f[Y] >= GROUND - 20.0 && f[LANDED] == 0.0 {
                f[LANDED] = 1.0;
                sfx("boom");
                shake(0.18);
                light((x0 + x1) / 2.0, GROUND - 8.0, 40.0, pc("org", 3), 1.0);
                let n = ((x1 - x0 - 12.0) / 26.0).ceil();
                let mid = (n / 2.0).floor();
                let (mut x, mut i) = (x0 + 12.0, 0.0);
                while x < x1 {
                    impact(x, GROUND - 4.0, pc("org", 3), if i == mid { 0.8 } else { 0.3 }, true);
                    juice(x, GROUND - 10.0, 6.0);
                    burst(x, GROUND - 10.0, 6.0, &[pc("wood", 1), pc("wood", 2), pc("wood", 3)], 120.0, 0.6, 400.0, "chunk");
                    for _ in 0..3 {
                        let px = x + rand(-8.0, 8.0);
                        let vx = rand(-90.0, 90.0);
                        let vy = -rand(120.0, 200.0);
                        let life = rand(0.5, 0.8);
                        let col = pick(&[pc("org", 2), pc("org", 3)]);
                        Fx { vx, vy, grav: 520.0, life, size: 2.0, col, ..Fx::new("chunk", px, GROUND - 14.0) }.emit();
                    }
                    x += 26.0;
                    i += 1.0;
                }
            }
            if f[HIT_T] > 0.5 {
                let mut x = x0 + 8.0;
                while x < x1 {
                    burst(x, GROUND - 10.0, 5.0, &[pc("org", 2), pc("wood", 2)], 70.0, 0.4, 240.0, "px");
                    x += 26.0;
                }
                return false;
            }
        }
        f[DEAD] == 0.0
    }
    pub fn boxes(f: &[f64]) -> Boxes {
        if f[HIT_T] >= 0.0 && f[HIT_T] < 0.2 {
            vec![[f[X0], f[Y], f[X1] - f[X0], 20.0]]
        } else {
            vec![]
        }
    }
    pub const DRAW: Schema = &[];
    // 귤 상자 줄 (구역 폭만큼 · shake_x: 흔들림)
    fn crates(f: &[f64], d: &mut Draw, y: f64, shake_x: f64) {
        let cs = crate_box();
        let cw = cs.w();
        let mut x = f[X0];
        while x < f[X1] - 4.0 {
            d.img(cs, round(min(x, f[X1] - cw) + shake_x), round(y));
            x += cw;
        }
    }
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        let (x0, x1, t) = (f[X0], f[X1], f[T]);
        let w = x1 - x0;
        if f[HIT_T] < 0.0 {
            // 예고: 화면 위에 매달린 귤 상자(점점 흔들림) + 땅엔 짙어지는 그림자와 공사 띠 + 양 끝 꺾쇠
            let k = clamp(t / f[DELAY], 0.0, 1.0);
            let fast = k > 0.7;
            let blink = odd(t * if fast { 16.0 } else { 5.0 });
            // 구역 가장자리: 얇은 세로 점선 (높이 뛴 숨비도 경계를 보게)
            d.rgba(232.0, 150.0, 90.0, 0.18 + 0.3 * k);
            let mut y = -VOFF + 36.0;
            while y < GROUND - 8.0 {
                d.rect(x0, y, 1.0, 3.0);
                d.rect(x1 - 1.0, y, 1.0, 3.0);
                y += 6.0;
            }
            // 땅 그림자: 상자가 내려올수록 진하고 넓게
            let sw = round(w * (0.6 + 0.4 * k));
            let sx = round(x0 + (w - sw) / 2.0);
            d.rgba(30.0, 16.0, 14.0, 0.12 + 0.4 * k);
            d.rect(sx, GROUND, sw, 2.0);
            d.rect(sx + 3.0, GROUND - 1.0, sw - 6.0, 1.0);
            // 땅속 공사 띠 (사선 줄무늬가 흐름)
            let off = (t * 24.0).floor();
            let mut x = x0 + 1.0;
            while x < x1 - 1.0 {
                d.style(if (to_i32(x + off) >> 2) % 2 != 0 { pc("org", 3) } else { INK });
                d.rect(x, GROUND + 3.0, 1.0, 2.0);
                x += 1.0;
            }
            // 양 끝 꺾쇠
            for (ex, s) in [(x0, 1.0), (x1 - 1.0, -1.0)] {
                d.style(INK);
                d.rect(ex - 1.0, GROUND - 9.0, 3.0, 10.0);
                d.rect(ex, GROUND - 10.0, s * 5.0 + if s < 0.0 { 1.0 } else { 0.0 }, 3.0);
                d.style(if blink { pc("yel", 3) } else { pc("org", 3) });
                d.rect(ex, GROUND - 8.0, 1.0, 8.0);
                d.rect(min(ex, ex + s * 4.0), GROUND - 9.0, 4.0, 1.0);
            }
            // 매달린 상자 + 밧줄
            let hy = f[HY];
            let sh = if !fast {
                0.0
            } else if odd(t * 30.0) {
                1.0
            } else {
                -1.0
            };
            let cw = crate_box().w();
            d.style(pc("wood", 1));
            let mut x = x0;
            while x < x1 - 4.0 {
                let cx = round(min(x, x1 - cw));
                d.rect(cx + 5.0 + sh, -VOFF, 1.0, hy + VOFF + 3.0);
                d.rect(cx + cw - 6.0 + sh, -VOFF, 1.0, hy + VOFF + 3.0);
                x += cw;
            }
            crates(f, d, hy, sh);
            return;
        }
        if f[LANDED] == 0.0 {
            // 내리꽂힘: 위로 바람 자국
            d.rgba(255.0, 244.0, 224.0, 0.45);
            let mut x = x0 + 3.0;
            while x < x1 {
                d.rect(x, round(f[Y] - 16.0 - (x % 3.0) * 4.0), 1.0, 12.0);
                x += 7.0;
            }
        }
        crates(f, d, f[Y], 0.0);
    }
}

// ── 레이저: 발사 지점에 빛이 모이다가 가로로 쭉 ──
pub mod laser {
    use super::*;
    pub const SCHEMA: Schema = &[
        ("y", Ty::Num),
        ("delay", Ty::Num),
        ("x0", Ty::Num),
        ("x1", Ty::Num),
        ("from", Ty::Num),
        ("t", Ty::Num),
        ("fired", Ty::Bool),
        ("after", Ty::Bool),
        ("dead", Ty::Bool),
    ];
    const Y: usize = 0;
    const DELAY: usize = 1;
    const X0: usize = 2;
    const X1: usize = 3;
    const FROM: usize = 4;
    const T: usize = 5;
    const FIRED: usize = 6;
    const AFTER: usize = 7;
    const DEAD: usize = 8;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        let speed = ctx().speed;
        let (y, x0, x1, from) = (f[Y], f[X0], f[X1], f[FROM]);
        f[T] += dt;
        if f[FIRED] == 0.0 && random() < dt * 30.0 {
            let a = rand(0.0, 6.28);
            let r = rand(14.0, 26.0);
            let (ca, sa) = (cos(a), sin(a));
            Fx { vx: -ca * r * 4.0, vy: -sa * r * 4.0, life: 0.25, col: pc("red", 3), ..Fx::new("trail", from + ca * r, y + sa * r) }
                .emit();
        }
        if f[T] >= f[DELAY] && f[FIRED] == 0.0 {
            f[FIRED] = 1.0;
            sfx("zap");
            shake(0.3);
            hook("flash", 0.03, hexc(0xffd8c8), 0.0, 0.0);
            Fx { size: 14.0, life: 0.25, col: pc("red", 3), ..Fx::new("flare", from, y) }.emit();
            let mut x = x0 + 10.0;
            while x < x1 {
                let sx = x + rand(-4.0, 4.0);
                spark(sx, y + rand(-3.0, 3.0));
                let vx = rand(-30.0, 30.0);
                let vy = rand(-90.0, -30.0);
                Fx { vx, vy, grav: 300.0, life: rand(0.3, 0.6), ..Fx::new("ember", x, y) }.emit();
                x += 18.0;
            }
        }
        if f[FIRED] != 0.0 && f[T] > f[DELAY] + 0.3 * speed && f[AFTER] == 0.0 {
            f[AFTER] = 1.0;
            Fx { len: round(x1 - x0), life: 0.18, col: css("rgba(255,200,180,0.45)"), ..Fx::new("streak", x0, y) }.emit();
        }
        f[DEAD] == 0.0 && f[T] < f[DELAY] + 0.32 * speed
    }
    pub fn boxes(f: &[f64]) -> Boxes {
        if f[FIRED] == 0.0 {
            return vec![];
        }
        vec![[f[X0], f[Y] - 4.0, f[X1] - f[X0], 8.0]]
    }
    pub const DRAW: Schema = &[];
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        let (x0, y, t) = (f[X0], f[Y], f[T]);
        let w = f[X1] - x0;
        if f[FIRED] == 0.0 {
            let k = clamp(t / f[DELAY], 0.0, 1.0);
            let half = round(1.0 + k * 3.0);
            let rev = f[FROM] == x0;
            // 점점 두꺼워지는 위험 띠 · 가운데 선 · 나아갈 방향으로 흐르는 빛 · 발사 지점에 모이는 빛 · 발사 직전 번쩍
            d.save();
            d.alpha(0.12 + 0.24 * k);
            d.style(pc("red", 2));
            d.rect(x0, y - half, w, half * 2.0 + 1.0);
            d.restore();
            d.mix(pc("red", 2), hexc(0xfff4e0), k * 0.7);
            d.rect(x0, y, w, 1.0);
            for i in 0..3 {
                let dd = (t * 220.0 + i as f64 * w / 3.0) % w;
                let px = round(if rev { x0 + dd } else { x0 + w - dd });
                d.style(hexc(0xfff4e0));
                d.rect(px - 3.0, y, 6.0, 1.0);
            }
            d.disc_mix(round(f[FROM]), y, round(1.0 + k * 3.0), pc("red", 3), hexc(0xfff4e0), k);
            if f[DELAY] - t < 0.12 * ctx().speed {
                d.style(hexc(0xfff4e0));
                d.rect(x0, y - 1.0, w, 3.0);
            }
            return;
        }
        let fl = (t * 30.0).floor() % 2.0;
        d.style(pc("red", 1));
        d.rect(x0, y - 4.0, w, 8.0);
        d.style(pc("red", 3));
        d.rect(x0, y - 3.0 + fl, w, 6.0 - fl * 2.0);
        d.style(hexc(0xfff4e0));
        d.rect(x0, y - 1.0, w, 2.0);
        let mut x = x0;
        while x < f[X1] {
            d.light(x, y, 20.0, hexc(0xff8070), 0.5);
            x += 40.0;
        }
    }
}

// ── 칼날 파동: 예고 점선 뒤 낮게 · 높게 날아옴 ──
pub mod slash_wave {
    use super::*;
    pub const SCHEMA: Schema = &[
        ("dir", Ty::Num),
        ("x", Ty::Num),
        ("high", Ty::Bool),
        ("y", Ty::Num),
        ("speed", Ty::Num),
        ("warn", Ty::Num),
        ("t", Ty::Num),
        ("go", Ty::Bool),
        ("dead", Ty::Bool),
    ];
    const DIR: usize = 0;
    const X: usize = 1;
    const HIGH: usize = 2;
    const Y: usize = 3;
    const SPEED: usize = 4;
    const WARN: usize = 5;
    const T: usize = 6;
    const GO: usize = 7;
    const DEAD: usize = 8;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        let w = ctx().w;
        let dir = f[DIR];
        f[T] += dt;
        if f[T] >= f[WARN] {
            if f[GO] == 0.0 {
                f[GO] = 1.0;
                sfx("whoosh");
            }
            f[X] += dir * f[SPEED] * dt;
            if random() < dt * 40.0 {
                let y = f[Y] + rand(-8.0, 8.0);
                let len = randi(4.0, 8.0);
                Fx { vx: -dir * 40.0, life: 0.2, len, col: css("rgba(255,244,224,0.5)"), ..Fx::new("streak", f[X] - dir * 6.0, y) }.emit();
            }
        }
        f[DEAD] == 0.0 && f[X] > -20.0 && f[X] < w + 20.0
    }
    pub fn boxes(f: &[f64]) -> Boxes {
        if f[GO] == 0.0 {
            return vec![];
        }
        let high = f[HIGH] != 0.0;
        let hh = if high { 12.0 } else { 8.0 };
        vec![[f[X] - 5.0, f[Y] - hh, 10.0, hh * 2.0]]
    }
    pub const DRAW: Schema = &[];
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        let w = ctx().w;
        let dir = f[DIR];
        if f[GO] == 0.0 {
            // 예고: 지나갈 높이에 깜빡이는 점선
            if odd(f[T] * 10.0) {
                return;
            }
            let ly = round(f[Y]);
            let (xa, xb) = if dir < 0.0 { (4.0, f[X] - 10.0) } else { (f[X] + 10.0, w - 4.0) };
            let mut x = xa;
            while x < xb {
                d.style(INK);
                d.rect(x - 1.0, ly - 1.0, 5.0, 3.0);
                d.style(pc("red", 3));
                d.rect(x, ly, 3.0, 1.0);
                x += 6.0;
            }
            return;
        }
        let hh = if f[HIGH] != 0.0 { 12.0 } else { 8.0 };
        let (x, y) = (round(f[X]), round(f[Y]));
        let sp = slash(hh, dir < 0.0);
        for k in 1..=3 {
            // 잔상
            let k = k as f64;
            d.alpha(0.35 / k);
            d.img(sp, x - 6.0 - dir * k * 6.0, y - hh - 1.0);
        }
        d.alpha(1.0);
        d.img(sp, x - 6.0, y - hh - 1.0);
        d.light(x, y, 16.0, hexc(0xfff0c0), 0.5);
    }
}

// ── 도마 난도질: 예고 → 칼날이 확 빨라지며 내리꽂힘 → 콱! → 꽂힌 칼이 부르르 떪 ──
pub mod knife_drop {
    use super::*;
    pub const SCHEMA: Schema = &[
        ("x", Ty::Num),
        ("delay", Ty::Num),
        ("t", Ty::Num),
        ("y", Ty::Num),
        ("vy", Ty::Num),
        ("st", Ty::Enum(&["warn", "fall", "stuck"])),
        ("sT", Ty::Num),
        ("dead", Ty::Bool),
    ];
    const X: usize = 0;
    const DELAY: usize = 1;
    const T: usize = 2;
    const Y: usize = 3;
    const VY: usize = 4;
    const ST: usize = 5;
    const S_T: usize = 6;
    const DEAD: usize = 7;
    const S_WARN: f64 = 0.0;
    const S_FALL: f64 = 1.0;
    const S_STUCK: f64 = 2.0;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        let speed = ctx().speed;
        let x = f[X];
        f[T] += dt;
        if f[ST] == S_WARN && f[T] >= f[DELAY] {
            f[ST] = S_FALL;
            sfx("whoosh");
        }
        if f[ST] == S_FALL {
            f[VY] = min(1600.0, f[VY] + 7000.0 * dt / speed); // 확 빨라지며 내리꽂힘
            f[Y] += f[VY] / speed * dt;
            if f[Y] >= GROUND - 26.0 {
                f[Y] = GROUND - 26.0;
                f[ST] = S_STUCK;
                f[S_T] = 0.0;
                sfx("stab");
                shake(0.14);
                hitstop(0.03, 0.25);
                Fx { size: 11.0, life: 0.12, ..Fx::new("flare", x, GROUND - 3.0) }.emit();
                Fx { big: true, life: 0.28, ..Fx::new("ring", x, GROUND - 1.0) }.emit();
                dust(x, GROUND, 4.0, 0.0, 1.0);
                for _ in 0..9 {
                    let px = x + rand(-3.0, 3.0);
                    let vx = rand(-110.0, 110.0);
                    let vy = -rand(60.0, 170.0);
                    let life = rand(0.35, 0.6);
                    let size = randi(1.0, 2.0);
                    let col = pick(&[pc("stone", 2), pc("stone", 3), pc("soil", 3), pc("soil", 2)]);
                    Fx { vx, vy, grav: 420.0, life, size, col, ..Fx::new("chunk", px, GROUND - 2.0) }.emit();
                }
                for sd in [-1.0, 1.0] {
                    // 옆으로 튀는 충격선
                    let vx = sd * rand(140.0, 190.0);
                    let vy = -rand(10.0, 30.0);
                    let col = css("rgba(255,244,224,0.8)");
                    Fx { vx, vy, drag: 6.0, life: 0.22, len: 4.0, col, ..Fx::new("streak", x + sd * 4.0, GROUND - 2.0) }.emit();
                }
                light(x, GROUND - 6.0, 22.0, hexc(0xfff4e0), 0.8);
            }
        }
        if f[ST] == S_STUCK {
            f[S_T] += dt;
            if f[S_T] > 0.6 * speed {
                burst(x, GROUND - 14.0, 6.0, &[pc("stone", 3), hexc(0xdcdcd4)], 60.0, 0.4, 300.0, "chunk");
                return false;
            }
        }
        f[DEAD] == 0.0
    }
    pub fn boxes(f: &[f64]) -> Boxes {
        if f[ST] == S_FALL {
            vec![[f[X] - 4.0, f[Y], 8.0, 34.0]]
        } else if f[ST] == S_STUCK && f[S_T] < 0.1 {
            vec![[f[X] - 4.0, GROUND - 26.0, 8.0, 26.0]]
        } else {
            vec![]
        }
    }
    // 그리기 전용: 꽂힌 자리 땅 갈라짐 [cx, cy] (여섯 갈래를 이어 붙임)
    pub const DRAW: Schema = &[("cracks", Ty::List)];
    const CRACKS: usize = SCHEMA.len();
    pub fn decal(f: &mut [f64], d: &mut Draw) {
        let (x, t) = (f[X], f[T]);
        if f[ST] == S_STUCK {
            // 꽂힌 자리 땅 갈라짐 (칼이 사라지며 함께 옅어짐)
            let a = clamp(1.0 - (f[S_T] / ctx().speed - 0.35) / 0.25, 0.0, 1.0);
            if a <= 0.0 {
                return;
            }
            d.alpha(a);
            d.style(INK);
            for c in list(f, CRACKS).chunks(2) {
                d.rect(x + c[0], GROUND + c[1], 1.0, 1.0);
            }
            d.rgba(30.0, 16.0, 14.0, 0.45);
            d.rect(x - 6.0, GROUND, 13.0, 2.0);
            d.alpha(1.0);
            return;
        }
        if f[ST] != S_WARN {
            return;
        }
        let k = clamp(t / f[DELAY], 0.0, 1.0);
        let on = odd(t * if k > 0.7 { 18.0 } else { 6.0 });
        d.style(INK);
        d.rect(x - 4.0, GROUND - 1.0, 9.0, 3.0);
        d.style(if on { hexc(0xfff4e0) } else { pc("red", 3) });
        d.rect(x - 3.0, GROUND, 7.0, 1.0);
        d.rgba(232.0, 69.0, 74.0, 0.15 + 0.25 * k);
        let mut y = -VOFF + 40.0;
        while y < GROUND - 4.0 {
            d.rect(x, y, 1.0, 2.0);
            y += 5.0;
        }
        d.top_mark(x, t);
    }
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        let speed = ctx().speed;
        let (x, t) = (f[X], f[T]);
        let knife = named("BIG_KNIFE");
        if f[ST] == S_WARN {
            // 떨어지기 직전: 화면 위에서 칼날이 번뜩
            let left = f[DELAY] - t;
            if left > 0.12 * speed {
                return;
            }
            d.img(knife, x - 5.0, -VOFF - 20.0 - round(left / speed * 30.0));
            if odd(t * 30.0) {
                d.style(hexc(0xfff4e0));
                d.rect(x - 2.0, -VOFF + 4.0, 3.0, 1.0);
                d.rect(x - 1.0, -VOFF + 3.0, 1.0, 3.0);
            }
            return;
        }
        if f[ST] == S_FALL {
            // 잔상 · 속도선
            d.save();
            for i in 1..=2 {
                let i = i as f64;
                d.alpha(0.28 / i);
                d.img(knife, x - 5.0, round(f[Y] - 8.0 - i * f[VY] * 0.012));
            }
            d.restore();
            d.rgba(255.0, 244.0, 224.0, 0.55);
            d.rect(x - 4.0, round(f[Y] - 30.0), 1.0, 18.0);
            d.rect(x + 4.0, round(f[Y] - 24.0), 1.0, 12.0);
            d.img(knife, x - 5.0, round(f[Y] - 8.0));
            return;
        }
        // 꽂힌 칼이 부르르 떨다 멎음 · 꽂히는 순간 깊이 박혔다 살짝 올라오며 하얗게 번쩍
        let q = f[S_T] / speed;
        let wob = if q < 0.28 { (if odd(f[S_T] * 40.0) { 1.0 } else { -1.0 }) * if q < 0.14 { 1.0 } else { 0.5 } } else { 0.0 };
        let sink = if q < 0.05 {
            2.0
        } else if q < 0.1 {
            1.0
        } else {
            0.0
        };
        d.save();
        if q > 0.4 {
            d.alpha(0.5);
        }
        d.img(knife, x - 5.0 + round(wob), round(f[Y] - 8.0 + sink));
        d.restore();
        if q < 0.06 {
            d.alpha(0.8);
            d.img_sil(knife, hexc(0xfff4e0), x - 5.0, round(f[Y] - 8.0 + sink));
            d.alpha(1.0);
        }
    }
}

// ── 쏟아지는 물줄기: 물방울 예고 → 콸콸 → 양옆으로 물결 둘 (물결은 JS ripple이 만듦) ──
pub mod water_fall {
    use super::*;
    pub const SCHEMA: Schema =
        &[("x", Ty::Num), ("delay", Ty::Num), ("t", Ty::Num), ("dur", Ty::Num), ("poured", Ty::Bool), ("dead", Ty::Bool)];
    const X: usize = 0;
    const DELAY: usize = 1;
    const T: usize = 2;
    const DUR: usize = 3;
    const POURED: usize = 4;
    const DEAD: usize = 5;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        let x = f[X];
        f[T] += dt;
        if f[T] < f[DELAY] {
            if random() < dt * (8.0 + 30.0 * f[T] / f[DELAY]) {
                let px = x + rand(-4.0, 4.0);
                let vy = rand(160.0, 240.0);
                let col = pick(&[water(2), water(3)]);
                Fx { vy, grav: 300.0, life: (GROUND + VOFF - 36.0) / 220.0, col, ..Fx::new("px", px, -VOFF + 36.0) }.emit();
            }
            return true;
        }
        if f[POURED] == 0.0 {
            f[POURED] = 1.0;
            sfx("splash");
            shake(0.15);
            hook("splash", x, 1.6, 0.0, 0.0);
            Fx { big: true, life: 0.35, col: water(3), ..Fx::new("ring", x, GROUND - 1.0) }.emit();
            for d in [-1.0, 1.0] {
                hook("ripple", x + d * 10.0, d, 0.0, 0.0);
            }
        }
        f[DEAD] == 0.0 && f[T] < f[DELAY] + f[DUR]
    }
    // 끝날 때 가늘어지는 물줄기만큼만
    pub fn boxes(f: &[f64]) -> Boxes {
        if f[POURED] == 0.0 {
            return vec![];
        }
        let k = (f[T] - f[DELAY]) / f[DUR];
        let hw = min(8.0, max(2.0, round(9.0 * if k < 0.7 { 1.0 } else { (1.0 - k) / 0.3 })));
        vec![[f[X] - hw, -VOFF + 36.0, hw * 2.0, GROUND + VOFF - 36.0]]
    }
    pub const DRAW: Schema = &[];
    // 쏟아질 자리: 젖어 가는 땅 · 위쪽 예고
    pub fn decal(f: &mut [f64], d: &mut Draw) {
        let (x, t) = (f[X], f[T]);
        if t >= f[DELAY] {
            return;
        }
        let k = t / f[DELAY];
        let w = round(8.0 + 10.0 * k);
        let half = (to_i32(w) >> 1) as f64;
        d.rgba(46.0, 90.0, 122.0, 0.2 + 0.4 * k);
        d.rect(x - half, GROUND, w, 2.0);
        d.style(water(3));
        if odd(t * 12.0) {
            d.rect(x - half, GROUND - 1.0, w, 1.0);
        }
        d.top_mark(x, t);
    }
    // 물줄기: 결 무늬가 아래로 흐름 · 끝날 땐 가늘어짐 · 위는 물안개, 아래는 물보라 웅덩이
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        if f[POURED] == 0.0 {
            return;
        }
        let (x, t) = (f[X], f[T]);
        let tile = named("FALL_TILE");
        let th = tile.h();
        let k = (t - f[DELAY]) / f[DUR];
        let hw = max(2.0, round(9.0 * if k < 0.7 { 1.0 } else { (1.0 - k) / 0.3 }));
        let top = -VOFF + 36.0;
        let off = (t * 260.0).floor() % th;
        // 바깥 먹선 1px로 다른 스프라이트와 같은 결
        d.mix(water(0), INK, 0.5);
        d.rect(x - hw - 1.0, top, 1.0, GROUND - top);
        d.rect(x + hw + 1.0, top, 1.0, GROUND - top);
        let mut y = top - off;
        while y < GROUND {
            let (y0, y1) = (max(top, y), min(GROUND, y + th));
            d.img_part(tile, [9.0 - hw, y0 - y, hw * 2.0 + 1.0, y1 - y0], [x - hw, y0, hw * 2.0 + 1.0, y1 - y0]);
            y += th;
        }
        // 시작점은 물안개 구름 속에서 쏟아지게 (잘린 듯한 윗단을 가림)
        for i in 0..7 {
            let a = i as f64 * 0.9 + t * 1.5;
            let (cx, cy) = (round(x + cos(a) * (hw + 4.0)), top + round(sin(a * 1.3) * 2.0));
            d.disc_mix(cx, cy, 4.0 + (i % 3) as f64, water(2), INK, 0.35);
        }
        for i in 0..7 {
            let a = i as f64 * 0.9 + t * 1.5;
            let (cx, cy) = (round(x + cos(a) * (hw + 4.0)), top - 1.0 + round(sin(a * 1.3) * 2.0));
            d.disc(cx, cy, 3.0 + (i % 3) as f64, if i % 2 == 1 { water(3) } else { water(4) });
        }
        d.style(water(2));
        d.rect(x - hw - 6.0, GROUND - 2.0, hw * 2.0 + 13.0, 2.0);
        d.style(water(4));
        d.rect(x - hw - 4.0, GROUND - 3.0, hw * 2.0 + 9.0, 1.0);
        for i in 0..6 {
            let a = t * 9.0 + i as f64;
            d.style(water(4));
            d.rect(round(x + cos(a) * (hw + 5.0)), GROUND - 3.0 - round(sin(a).abs() * 8.0), 2.0, 2.0);
        }
        d.light(x, GROUND - 30.0, 30.0, hexc(0xc8f0ff), 0.5);
    }
}

// ── 땅을 타고 퍼지는 낮은 물결 (높이 10) ──
pub mod ripple {
    use super::*;
    pub const SCHEMA: Schema = &[("x", Ty::Num), ("dir", Ty::Num), ("speed", Ty::Num), ("t", Ty::Num), ("dead", Ty::Bool)];
    const X: usize = 0;
    const DIR: usize = 1;
    const SPEED: usize = 2;
    const T: usize = 3;
    const DEAD: usize = 4;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        let w = ctx().w;
        f[T] += dt;
        f[X] += f[DIR] * f[SPEED] * dt;
        if random() < dt * 25.0 {
            let vy = -rand(40.0, 80.0);
            Fx { vx: f[DIR] * 30.0, vy, grav: 400.0, life: 0.35, col: water(4), ..Fx::new("px", f[X], GROUND - 8.0) }.emit();
        }
        f[DEAD] == 0.0 && f[X] > -20.0 && f[X] < w + 20.0
    }
    // 생기고 0.3초 뒤부터 (뛸 틈)
    pub fn boxes(f: &[f64]) -> Boxes {
        if f[T] < 0.3 * ctx().speed {
            return vec![];
        }
        vec![[f[X] - 5.0, GROUND - 10.0, 10.0, 10.0]]
    }
    pub const DRAW: Schema = &[];
    // 앞이 솟고 뒤로 잦아드는 물결 (기둥 16개)
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        for k in 0..16 {
            let k = k as f64;
            let hh = round(if k < 2.0 { 10.0 * (k + 1.0) / 3.0 } else { 10.0 * exp(-(k - 2.0) / 4.5) });
            if hh < 1.0 {
                continue;
            }
            let xx = round(f[X] - f[DIR] * k);
            d.mix(water(0), INK, 0.5);
            d.rect(xx, GROUND - hh - 1.0, 1.0, 1.0);
            let mut j = 0.0;
            while j < hh {
                d.style(water(if j == 0.0 {
                    4
                } else if j == 1.0 {
                    3
                } else if j < hh * 0.6 {
                    2
                } else {
                    1
                }));
                d.rect(xx, GROUND - hh + j, 1.0, 1.0);
                j += 1.0;
            }
        }
    }
}

// ── 오름이 땅을 뚫고 확 솟았다가 살짝 내려앉음 ──
pub mod oreum_rise {
    use super::*;
    pub const SCHEMA: Schema =
        &[("x", Ty::Num), ("delay", Ty::Num), ("H", Ty::Num), ("t", Ty::Num), ("h", Ty::Num), ("up", Ty::Bool), ("dead", Ty::Bool)];
    const X: usize = 0;
    const DELAY: usize = 1;
    const BIG_H: usize = 2;
    const T: usize = 3;
    const H: usize = 4;
    const UP: usize = 5;
    const DEAD: usize = 6;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        let x = f[X];
        f[T] += dt;
        let u = (f[T] - f[DELAY]) / ctx().speed;
        if u < 0.0 {
            if random() < dt * 20.0 {
                let px = x + rand(-10.0, 10.0);
                let vx = rand(-15.0, 15.0);
                let vy = -rand(30.0, 70.0);
                let col = pick(&[pc("soil", 3), pc("leaf", 2)]);
                Fx { vx, vy, grav: 400.0, life: 0.3, size: 1.0, col, ..Fx::new("chunk", px, GROUND - 1.0) }.emit();
            }
            return true;
        }
        if f[UP] == 0.0 {
            // 땅을 뚫는 순간: 쿵 · 흙과 풀 덩이가 튀고 충격 고리
            f[UP] = 1.0;
            sfx("rise");
            sfx("thud");
            shake(0.13);
            dust(x - 12.0, GROUND, 4.0, -1.0, 1.0);
            dust(x + 12.0, GROUND, 4.0, 1.0, 1.0);
            burst(x, GROUND - 6.0, 14.0, &[pc("soil", 2), pc("soil", 3), pc("leaf", 2), pc("leaf", 3)], 140.0, 0.6, 420.0, "chunk");
            Fx { big: true, life: 0.35, col: pc("leaf", 3), ..Fx::new("ring", x, GROUND - 1.0) }.emit();
            Fx { size: 10.0, life: 0.14, ..Fx::new("flare", x, GROUND - 4.0) }.emit();
            for _ in 0..5 {
                let px = x + rand(-10.0, 10.0);
                let vx = rand(-70.0, 70.0);
                let vy = -rand(120.0, 200.0);
                let life = rand(0.5, 0.8);
                let col = pick(&[pc("leaf", 3), pc("leaf", 2)]);
                Fx { vx, vy, grav: 480.0, life, size: 2.0, col, ..Fx::new("chunk", px, GROUND - 8.0) }.emit();
            }
        }
        let big_h = f[BIG_H];
        f[H] = if u < 0.08 {
            big_h * 1.12 * u / 0.08
        } else if u < 0.14 {
            big_h * (1.12 - 0.12 * (u - 0.08) / 0.06)
        } else if u < 0.6 {
            big_h
        } else {
            big_h * max(0.0, 1.0 - (u - 0.6) / 0.3)
        };
        u < 0.9 && f[DEAD] == 0.0
    }
    // 비탈 끝에서 보이지 않는 모서리에 걸리지 않게
    pub fn boxes(f: &[f64]) -> Boxes {
        if f[H] <= 8.0 {
            return vec![];
        }
        vec![[f[X] - 9.0, GROUND - f[H] * 0.85, 18.0, f[H] * 0.85]]
    }
    pub const DRAW: Schema = &[];
    // 솟을 자리: 갈라지는 금 · 부풀어 오르는 땅
    pub fn decal(f: &mut [f64], d: &mut Draw) {
        if f[UP] != 0.0 {
            return;
        }
        let x = f[X];
        let k = clamp(f[T] / f[DELAY], 0.0, 1.0);
        let r = to_i32(round(6.0 + 8.0 * k));
        d.style(INK);
        let mut i = -r;
        while i <= r {
            d.rect(x + i as f64, GROUND + if (i >> 1) % 2 != 0 { 1.0 } else { 0.0 }, 1.0, 1.0);
            i += 2;
        }
        if k > 0.5 {
            let bh = round((k - 0.5) * 6.0);
            for dx in -10..=10 {
                let dx = dx as f64;
                let h = round(bh * (1.0 - pow(dx / 10.0, 2.0)));
                if h > 0.0 {
                    d.style(pc("leaf", 2));
                    d.rect(x + dx, GROUND - h, 1.0, h);
                }
            }
        }
    }
    // 통째로 땅을 뚫고 솟음: 스프라이트 전체가 아래에서 올라오고 땅선에서 잘림 · 솟는 동안 흙이 흘러내림
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        if f[H] < 1.0 {
            return;
        }
        let x = f[X];
        let spr = oreum(f[BIG_H]);
        let sw = spr.w();
        let hh = round(f[H]);
        d.save();
        d.clip(x - sw, -VOFF, sw * 2.0, GROUND + VOFF);
        d.img(spr, round(x - sw / 2.0), GROUND - hh);
        d.restore();
        if hh < f[BIG_H] {
            for k in 0..3 {
                let kf = k as f64;
                d.style(if k % 2 == 1 { pc("soil", 3) } else { pc("soil", 2) });
                d.rect(round(x - sw / 2.0 + 4.0 + hash2(kf, hh, 7.0) * (sw - 8.0)), GROUND - 1.0 - (k % 2) as f64, 2.0, 1.0);
            }
        }
    }
}

// ── 설문대할망의 파도: 예고 뒤 낮게 · 높게 밀려옴 ──
pub mod tide_wave {
    use super::*;
    pub const SCHEMA: Schema = &[
        ("x", Ty::Num),
        ("dir", Ty::Num),
        ("speed", Ty::Num),
        ("high", Ty::Bool),
        ("warn", Ty::Num),
        ("t", Ty::Num),
        ("go", Ty::Bool),
        ("dead", Ty::Bool),
    ];
    const X: usize = 0;
    const DIR: usize = 1;
    const SPEED: usize = 2;
    const HIGH: usize = 3;
    const WARN: usize = 4;
    const T: usize = 5;
    const GO: usize = 6;
    const DEAD: usize = 7;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        let w = ctx().w;
        f[T] += dt;
        if f[T] < f[WARN] {
            return true;
        }
        if f[GO] == 0.0 {
            f[GO] = 1.0;
            sfx("wave");
        }
        f[X] += f[DIR] * f[SPEED] * dt;
        if random() < dt * 30.0 {
            let y = if f[HIGH] != 0.0 { GROUND - 34.0 } else { GROUND - 16.0 } + rand(-3.0, 3.0);
            let vy = -rand(30.0, 70.0);
            Fx { vx: f[DIR] * 40.0, vy, grav: 300.0, life: 0.4, col: water(4), ..Fx::new("px", f[X], y) }.emit();
        }
        f[DEAD] == 0.0 && f[X] > -30.0 && f[X] < w + 30.0
    }
    pub fn boxes(f: &[f64]) -> Boxes {
        if f[GO] == 0.0 {
            vec![]
        } else if f[HIGH] != 0.0 {
            vec![[f[X] - 6.0, GROUND - 42.0, 12.0, 26.0]]
        } else {
            vec![[f[X] - 6.0, GROUND - 16.0, 12.0, 16.0]]
        }
    }
    pub const DRAW: Schema = &[];
    pub fn draw(f: &mut [f64], d: &mut Draw) {
        let high = f[HIGH] != 0.0;
        let dir = f[DIR];
        let tt = f[T];
        if f[GO] == 0.0 {
            // 예고: 지나갈 높이에 물빛 점선
            if odd(tt * 10.0) {
                return;
            }
            let y0 = if high { GROUND - 30.0 } else { GROUND - 8.0 };
            let (xa, xb) = if dir < 0.0 { (4.0, f[X] - 12.0) } else { (f[X] + 12.0, ctx().w - 4.0) };
            let mut x = xa;
            while x < xb {
                d.style(INK);
                d.rect(x - 1.0, y0 - 1.0, 5.0, 3.0);
                d.style(water(3));
                d.rect(x, y0, 3.0, 1.0);
                x += 6.0;
            }
            return;
        }
        let x0 = round(f[X]);
        let s = tide(high, (tt * 12.0).floor() % 6.0, dir);
        let (back, uc, tip0, tip1, gap, top) = (s.geo("back"), s.geo("uc"), s.geo("tip0"), s.geo("tip1"), s.geo("gap"), s.geo("H"));
        // 뒤로 남는 물결 자국: 땅선 위 거품 줄이 뒤처지며 옅어짐
        for i in 0..9 {
            let k = (tt * 1.6 + i as f64 / 9.0) % 1.0;
            let ux = -back - 2.0 - k * 46.0;
            let len = max(1.0, round((1.0 - k) * 6.0));
            d.alpha((1.0 - k) * 0.8);
            d.style(tide_col(if i % 3 != 0 { 5 } else { 6 }));
            d.rect(round(x0 + dir * ux) - if dir < 0.0 { 0.0 } else { len }, GROUND - 1.0 - (i % 2) as f64, len, 1.0);
        }
        d.alpha(1.0);
        let (sw, sh, sax) = (s.w(), s.h(), s.ax());
        d.img(s, x0 - if dir > 0.0 { sax } else { sw - 1.0 - sax }, GROUND - sh + 1.0);
        if high {
            // 아치 바닥 얕은 물 · 아치 천장에서 떨어지는 물줄기
            let mut u = -12.0;
            while u <= uc {
                d.style(tide_col(2));
                d.rect(x0 + dir * u, GROUND - 1.0, 1.0, 1.0);
                if (u + (tt * 14.0).floor()) % 4.0 == 0.0 {
                    d.style(tide_col(5));
                    d.rect(x0 + dir * u, GROUND - 1.0, 1.0, 1.0);
                }
                u += 1.0;
            }
            for i in 0..5 {
                let ph = (tt * 2.2 + i as f64 / 5.0) % 1.0;
                let u = -10.0 + i as f64 * 4.5;
                d.style(tide_col(if i % 2 == 1 { 5 } else { 4 }));
                d.rect(round(x0 + dir * u), round(GROUND - gap + ph * (gap - 2.0)), 1.0, 2.0);
            }
        }
        // 입술 끝에서 떨어지는 물방울 · 물마루 물보라
        let (tip_x, tip_y) = (x0 + dir * tip0, GROUND - tip1);
        for i in 0..5 {
            let ph = (tt * 2.6 + i as f64 / 5.0) % 1.0;
            let fall = if high { tip1 - gap } else { tip1 };
            d.style(tide_col(if i % 2 == 1 { 5 } else { 6 }));
            d.rect(tip_x + dir * round(ph * 3.0 - 1.0 + (i % 3) as f64), round(tip_y + ph * ph * fall), 1.0, 2.0);
        }
        for i in 0..7 {
            let a = tt * 9.0 + i as f64 * 1.9;
            let r = 3.0 + (i % 3) as f64 * 2.0;
            d.style(tide_col(if i % 3 != 0 { 6 } else { 5 }));
            d.rect(x0 + dir * round(uc - 2.0 + cos(a) * r), GROUND - top - 2.0 + round(sin(a) * 2.5) - (i % 2) as f64, 1.0, 1.0);
        }
        d.light(f[X], GROUND - top / 2.0, 26.0, hexc(0xc8f0ff), 0.45);
    }
}

// ── 보스가 펄쩍 뛰어 내려앉는 자리 (그림자 예고 뒤 잠깐 판정) ──
pub mod hop_land {
    use super::*;
    pub const SCHEMA: Schema = &[("x", Ty::Num), ("w", Ty::Num), ("T", Ty::Num), ("t", Ty::Num)];
    const X: usize = 0;
    const W: usize = 1;
    const DUR: usize = 2;
    const T: usize = 3;
    pub fn update(f: &mut [f64], dt: f64) -> bool {
        f[T] += dt;
        f[T] < f[DUR] + 0.12 * ctx().speed
    }
    pub fn boxes(f: &[f64]) -> Boxes {
        if f[T] < f[DUR] {
            return vec![];
        }
        vec![[f[X] - f[W] / 2.0, GROUND - 70.0, f[W], 70.0]]
    }
    // 내려앉을 자리: 짙어지는 그림자 · 양 끝 깜빡이
    pub fn decal(f: &mut [f64], d: &mut Draw) {
        let k = clamp(f[T] / f[DUR], 0.0, 1.0);
        let w = round(f[W] * (0.4 + 0.6 * k));
        d.rgba(30.0, 16.0, 14.0, 0.15 + 0.45 * k);
        d.rect(round(f[X] - w / 2.0), GROUND, w, 2.0);
        d.rect(round(f[X] - w / 2.0) + 3.0, GROUND - 1.0, w - 6.0, 1.0);
        if k > 0.5 && odd(f[T] * 16.0) {
            d.style(pc("red", 3));
            d.rect(round(f[X] - f[W] / 2.0), GROUND + 2.0, 2.0, 1.0);
            d.rect(round(f[X] + f[W] / 2.0) - 2.0, GROUND + 2.0, 2.0, 1.0);
        }
    }
}
