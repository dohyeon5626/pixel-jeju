// 숨비 (원래 game.js updatePlayer): 입력 버퍼 · 구르기 · 점프 · 3단 점프 · 던지기 · 내려찍기 · 걷기 · 중력 · 착지
//  상태는 JS의 P 객체에 두고 SCHEMA 순서로 주고받음 · 잔상(지금 그림) · 박자 판정 · 귤 던지기 · 내려찍기로 부순 장애물 · 목도리는 JS 훅
use crate::game::*;
use crate::js::*;

const GRAV: f64 = 860.0;
const JUMP_V: f64 = 410.0;
const DJUMP_V: f64 = 300.0;
const JUMP_CUT: f64 = 0.52;
const AIR_JUMPS: f64 = 2.0; // 공중 점프 2번 = 3단 점프
const ROLL_T: f64 = 0.34;
const ROLL_CD: f64 = 0.36;
const ROLL_V: f64 = 210.0;
const COYOTE: f64 = 0.09;
const BUFFER: f64 = 0.13;
const THROW_CD: f64 = 0.24;
const MAX_FALL: f64 = 470.0;
const SPEED: f64 = 94.0;
const ACCEL: f64 = 1150.0;
const AIR_ACCEL: f64 = 760.0;
const FRICTION: f64 = 1500.0;
const AIR_FRICTION: f64 = 320.0;
const CEIL: f64 = -60.0 + 40.0; // -VOFF + 40: 점수판 아래

fn approach(v: f64, t: f64, d: f64) -> f64 {
    if v < t {
        min(v + d, t)
    } else {
        max(v - d, t)
    }
}

// 좌우 입력(dir)에 따른 새 vx
fn walk(vx: f64, dir: f64, on_ground: bool, speed_up: f64, dt: f64) -> f64 {
    if dir != 0.0 {
        approach(vx, dir * SPEED * (1.0 + 0.08 * speed_up), (if on_ground { ACCEL } else { AIR_ACCEL }) * dt)
    } else {
        approach(vx, 0.0, (if on_ground { FRICTION } else { AIR_FRICTION }) * dt)
    }
}

// s: [x, y, vx, vy, dt, wind, rollT, arenaL, arenaR, pound, holdJump, onGround] → x · y · vy를 고쳐 씀
fn fall(s: &mut [f64]) {
    let (vx, dt, wind, roll_t, al, ar, pound, hold, on_ground) =
        (s[2], s[4], s[5], s[6], s[7], s[8], s[9] != 0.0, s[10] != 0.0, s[11] != 0.0);
    let mut gmul = 1.0;
    if s[3].abs() < 50.0 && hold && !on_ground {
        gmul = 0.55;
    } else if s[3] > 0.0 {
        gmul = 1.25;
    }
    if !pound {
        s[3] = min(s[3] + GRAV * gmul * dt, MAX_FALL);
    }
    s[0] += (vx + wind * (if roll_t > 0.0 { 0.4 } else { 1.0 })) * dt;
    s[1] += s[3] * dt;
    s[0] = clamp(s[0], al, ar);
    if s[1] < CEIL {
        s[1] = CEIL;
        if s[3] < 0.0 {
            s[3] *= 0.3;
        }
    }
}

pub const SCHEMA: Schema = &[
    ("x", Ty::Num),
    ("y", Ty::Num),
    ("vx", Ty::Num),
    ("vy", Ty::Num),
    ("face", Ty::Num),
    ("onGround", Ty::Bool),
    ("airJumps", Ty::Num),
    ("rollT", Ty::Num),
    ("rollCD", Ty::Num),
    ("rollCDMax", Ty::Num),
    ("inv", Ty::Num),
    ("hurtT", Ty::Num),
    ("coyote", Ty::Num),
    ("buffer", Ty::Num),
    ("jumpCut", Ty::Bool),
    ("anim", Ty::Num),
    ("blinkT", Ty::Num),
    ("dead", Ty::Bool),
    ("dustT", Ty::Num),
    ("throwT", Ty::Num),
    ("throwCD", Ty::Num),
    ("flipT", Ty::Num),
    ("flipMax", Ty::Num),
    ("sx", Ty::Num),
    ("sy", Ty::Num),
    ("ghostT", Ty::Num),
    ("ghostT2", Ty::Num),
    ("skidT", Ty::Num),
    ("landT", Ty::Num),
    ("spin", Ty::Num),
    ("prevY", Ty::Num),
    ("confuseT", Ty::Num),
    ("rollBuf", Ty::Num),
    ("poundBuf", Ty::Num),
    ("throwBuf", Ty::Num),
    ("pound", Ty::Bool),
    ("poundT", Ty::Num),
    ("poundSafe", Ty::Num),
    ("peakY", Ty::Opt),
];
const X: usize = 0;
const Y: usize = 1;
const VX: usize = 2;
const VY: usize = 3;
const FACE: usize = 4;
const ON_GROUND: usize = 5;
const AIR_JUMPS_F: usize = 6;
const ROLL_T_F: usize = 7;
const ROLL_CD_F: usize = 8;
const ROLL_CD_MAX: usize = 9;
const INV: usize = 10;
const HURT_T: usize = 11;
const COYOTE_F: usize = 12;
const BUFFER_F: usize = 13;
const JUMP_CUT_F: usize = 14;
const ANIM: usize = 15;
const BLINK_T: usize = 16;
const DEAD: usize = 17;
const DUST_T: usize = 18;
const THROW_T: usize = 19;
const THROW_CD_F: usize = 20;
const FLIP_T: usize = 21;
const FLIP_MAX: usize = 22;
const SX: usize = 23;
const SY: usize = 24;
const GHOST_T: usize = 25;
const GHOST_T2: usize = 26;
const SKID_T: usize = 27;
const LAND_T: usize = 28;
const SPIN: usize = 29;
const PREV_Y: usize = 30;
const CONFUSE_T: usize = 31;
const ROLL_BUF: usize = 32;
const POUND_BUF: usize = 33;
const THROW_BUF: usize = 34;
const POUND: usize = 35;
const POUND_T: usize = 36;
const POUND_SAFE: usize = 37;
const PEAK_Y: usize = 38;

// 입력 (js/wasm.js playerUpdate가 비트로 묶음): 조작 가능 · 누르고 있음(좌 · 우 · 점프 · 던지기) · 이번에 눌림(점프 · 구르기 · 아래 · 던지기)
const IN_CTRL: u32 = 1;
const IN_LEFT: u32 = 2;
const IN_RIGHT: u32 = 4;
const IN_JUMP_HELD: u32 = 8;
const IN_THROW_HELD: u32 = 16;
const IN_JUMP: u32 = 32;
const IN_ROLL: u32 = 64;
const IN_DOWN: u32 = 128;
const IN_THROW: u32 = 256;

// 잔상 하나 (그림은 JS curFrame — 지금 숨비 상태로)
fn ghost(x: f64, y: f64, life: f64, col: f64) {
    hook("pghost", x, y, life, col);
}
// 박 머리에 맞춘 동작이면 true (박자 콤보 · 점수는 JS onBeatAct)
fn beat_act(x: f64, y: f64, scoring: bool) -> bool {
    hook("beatAct", x, y, scoring as i32 as f64, 0.0) != 0.0
}
fn end_roll(f: &mut [f64], cd: f64) {
    f[ROLL_T_F] = 0.0;
    f[ROLL_CD_F] = cd;
    f[ROLL_CD_MAX] = cd;
}
// 쌓아 둔 구르기: 쿨다운 끝나기 직전(0.3초 안)에 누른 것도 버리지 않고 풀리는 순간 나감
fn roll_buf(f: &[f64]) -> f64 {
    max(BUFFER, min(0.3, (if f[ROLL_T_F] > 0.0 { f[ROLL_T_F] + ROLL_CD } else { 0.0 }) + max(0.0, f[ROLL_CD_F]) + 0.05))
}

// 내려찍기 착지: 쾅 · 충격파로 주변 하르방 · 썩은 귤을 부숨 (부수기는 JS poundKills)
fn pound_land(f: &mut [f64]) {
    let x = f[X];
    f[POUND] = 0.0;
    f[POUND_SAFE] = 0.12;
    f[ROLL_CD_F] = ROLL_CD;
    f[LAND_T] = 0.16;
    f[SX] = 1.35;
    f[SY] = 0.7;
    sfx("boom");
    hook("duck", 0.3, 0.0, 0.0, 0.0);
    shake(0.2);
    hook("kick", 0.0, 3.0, 0.0, 0.0);
    hitstop(0.065, 0.0);
    Fx { big: true, life: 0.35, col: pc("yel", 3), ..Fx::new("ring", x, GROUND - 1.0) }.emit();
    Fx { life: 0.25, ..Fx::new("ring", x, GROUND - 1.0) }.emit();
    dust(x - 6.0, GROUND, 5.0, -1.0, 2.0);
    dust(x + 6.0, GROUND, 5.0, 1.0, 2.0);
    light(x, GROUND - 6.0, 34.0, pc("yel", 3), 0.9);
    for sd in [-1.0, 1.0] {
        for i in 0..4 {
            let vx = sd * rand(30.0, 70.0);
            let vy = -rand(60.0, 140.0);
            let life = rand(0.3, 0.5);
            let size = randi(1.0, 2.0);
            let col = pick(&[pc("soil", 3), pc("stone", 3)]);
            Fx { vx, vy, grav: 420.0, life, size, col, ..Fx::new("chunk", x + sd * (6.0 + i as f64 * 6.0), GROUND - 2.0) }.emit();
        }
    }
    beat_act(x, GROUND - 4.0, true);
    hook("poundKills", 0.0, 0.0, 0.0, 0.0);
}

// 숨비 한 스텝: input 비트 · 걷기 빠르기 강화(G.up.speed) · 바람 · 양옆 벽
pub fn update(f: &mut [f64], dt: f64, input: u32, up_speed: f64, wind: f64, al: f64, ar: f64) {
    let c = ctx();
    let has = |b: u32| input & b != 0;
    f[PREV_Y] = f[Y];
    if f[DEAD] != 0.0 {
        // 쓰러지면 빙글 돌며 떨어짐
        f[VY] += GRAV * dt;
        f[X] += f[VX] * dt;
        f[Y] += f[VY] * dt;
        f[SPIN] += dt * 14.0;
        return;
    }
    let ctrl = has(IN_CTRL);
    f[INV] = max(0.0, f[INV] - dt);
    f[HURT_T] = max(0.0, f[HURT_T] - dt);
    for k in [ROLL_CD_F, THROW_CD_F, THROW_T, FLIP_T, LAND_T, SKID_T, BLINK_T] {
        f[k] -= dt;
    }
    if f[BLINK_T] < -0.12 {
        f[BLINK_T] = rand(1.5, 4.0);
    }
    f[CONFUSE_T] = max(0.0, or(f[CONFUSE_T], 0.0) - dt);
    // 사투리 혼란: 좌우 반전
    let dir = (if ctrl { has(IN_RIGHT) as i32 - has(IN_LEFT) as i32 } else { 0 }) as f64 * if f[CONFUSE_T] > 0.0 { -1.0 } else { 1.0 };
    if has(IN_JUMP) {
        f[BUFFER_F] = BUFFER;
    } else {
        f[BUFFER_F] -= dt;
    }
    if has(IN_ROLL) {
        f[ROLL_BUF] = roll_buf(f);
    } else {
        f[ROLL_BUF] = or(f[ROLL_BUF], 0.0) - dt;
    }
    // ↓/S: 공중이면 내려찍기, 땅이면 구르기
    if has(IN_DOWN) {
        if f[ON_GROUND] == 0.0 && GROUND - f[Y] > 20.0 {
            f[POUND_BUF] = BUFFER;
        } else {
            f[ROLL_BUF] = roll_buf(f);
        }
    } else {
        f[POUND_BUF] = or(f[POUND_BUF], 0.0) - dt;
    }
    if has(IN_THROW) {
        f[THROW_BUF] = max(BUFFER, min(0.3, max(max(0.0, f[THROW_CD_F]), f[ROLL_T_F]) + 0.05));
    } else {
        f[THROW_BUF] = or(f[THROW_BUF], 0.0) - dt;
    }
    if has(IN_THROW_HELD) && ctrl {
        f[THROW_BUF] = max(f[THROW_BUF], 0.02);
    }
    if !ctrl {
        f[BUFFER_F] = 0.0;
        f[ROLL_BUF] = 0.0;
        f[THROW_BUF] = 0.0;
    }
    f[COYOTE_F] = if f[ON_GROUND] != 0.0 { COYOTE } else { f[COYOTE_F] - dt };

    if f[FLIP_T] > 0.0 {
        f[GHOST_T] -= dt;
        if f[GHOST_T] <= 0.0 {
            // 3단 점프 막바지(정점 근처)는 금빛 잔상
            ghost(f[X], f[Y], 0.18, if f[AIR_JUMPS_F] == 0.0 && f[FLIP_MAX] - f[FLIP_T] < 0.12 { pc("yel", 3) } else { pc("cloth", 2) });
            f[GHOST_T] = 0.05;
        }
    }
    if f[HURT_T] > 0.0 {
        f[VX] = approach(f[VX], 0.0, 200.0 * dt);
    } else if f[ROLL_T_F] > 0.0 {
        f[ROLL_T_F] -= dt;
        f[VX] = f[FACE] * ROLL_V * (0.5 + 0.5 * (f[ROLL_T_F] / ROLL_T));
        f[GHOST_T] -= dt;
        if f[GHOST_T] <= 0.0 {
            ghost(f[X], f[Y], 0.22, pc("org", 3));
            f[GHOST_T] = 0.035;
        }
        f[DUST_T] -= dt;
        if f[ON_GROUND] != 0.0 && f[DUST_T] <= 0.0 {
            dust(f[X] - f[FACE] * 5.0, GROUND, 1.0, -f[FACE], 0.0);
            f[DUST_T] = 0.04;
        }
        if f[ROLL_T_F] <= 0.0 {
            end_roll(f, ROLL_CD);
        }
    } else if dir != 0.0 {
        if f[ON_GROUND] != 0.0 && sign(f[VX]) == -dir && f[VX].abs() > 50.0 {
            // 반대로 꺾을 때 미끄러짐
            f[SKID_T] = 0.12;
            if random() < 0.5 {
                dust(f[X] + dir * 4.0, GROUND, 1.0, dir, 0.0);
            }
        }
        f[VX] = walk(f[VX], dir, f[ON_GROUND] != 0.0, up_speed, dt);
        f[FACE] = dir;
    } else {
        f[VX] = walk(f[VX], 0.0, f[ON_GROUND] != 0.0, 0.0, dt);
    }

    if f[POUND_BUF] > 0.0 && f[HURT_T] <= 0.0 && f[POUND] == 0.0 && f[ON_GROUND] == 0.0 {
        // 내려찍기: 곧장 내리꽂혀 착지 충격파로 주변 하르방 · 썩은 귤을 부숨
        f[POUND_BUF] = 0.0;
        f[POUND] = 1.0;
        f[FLIP_T] = 0.0;
        f[ROLL_T_F] = 0.0;
        f[VX] = 0.0;
        f[VY] = 0.0;
        f[POUND_T] = 0.08;
        sfx("whoosh");
        f[SX] = 0.8;
        f[SY] = 1.25;
        Fx { size: 7.0, life: 0.15, col: pc("yel", 3), ..Fx::new("flare", f[X], f[Y] - 12.0) }.emit();
    }
    if f[ROLL_BUF] > 0.0 && f[HURT_T] <= 0.0 && f[ROLL_T_F] <= 0.0 && f[ROLL_CD_F] <= 0.0 && f[POUND] == 0.0 {
        f[ROLL_BUF] = 0.0;
        if dir != 0.0 {
            f[FACE] = dir;
        }
        f[ROLL_T_F] = ROLL_T;
        f[FLIP_T] = 0.0;
        if beat_act(f[X], f[Y] - 8.0, false) {
            // 박자 구르기: 살짝 느려지며 잔상 셋
            gset("slow", max(c.slow, 0.08));
            for k in 1..=3 {
                ghost(f[X] - f[FACE] * k as f64 * 5.0, f[Y], 0.2, pc("teal", 3));
            }
        }
        if f[ON_GROUND] == 0.0 {
            f[VY] = min(f[VY], 0.0) * 0.3;
        }
        sfx("roll");
        dust(f[X], GROUND, 4.0, -f[FACE], 0.0);
        f[SX] = 1.25;
        f[SY] = 0.8;
    }
    if f[BUFFER_F] > 0.0 && f[HURT_T] <= 0.0 {
        if f[COYOTE_F] > 0.0 {
            jump(f);
        } else if f[AIR_JUMPS_F] > 0.0 {
            air_jump(f);
        }
    }
    if !has(IN_JUMP_HELD) && f[VY] < 0.0 && f[JUMP_CUT_F] == 0.0 {
        // 일찍 떼면 낮게
        f[VY] *= JUMP_CUT;
        f[JUMP_CUT_F] = 1.0;
    }

    if f[THROW_BUF] > 0.0 && f[THROW_CD_F] <= 0.0 && f[HURT_T] <= 0.0 && f[ROLL_T_F] <= 0.0 {
        f[THROW_BUF] = 0.0;
        if c.ammo > 0.0 {
            gset("ammo", c.ammo - 1.0);
            f[THROW_CD_F] = THROW_CD;
            f[THROW_T] = 0.2;
            hook("throwShot", 0.0, 0.0, 0.0, 0.0); // 귤 하나 (G.shots)
            sfx("throw");
            f[SX] = 1.12;
            f[SY] = 0.92;
            Fx { size: 4.0, life: 0.1, col: pc("org", 3), ..Fx::new("flare", f[X] + f[FACE] * 9.0, f[Y] - 18.0) }.emit();
            Fx { vx: f[FACE] * 20.0, vy: -10.0, life: 0.2, size: 0.0, ..Fx::new("puff", f[X] + f[FACE] * 8.0, f[Y] - 18.0) }.emit();
        } else {
            sfx("empty");
            hook("popup", str_id("귤 없음"), f[X], f[Y] - 34.0, pc("org", 3));
            f[THROW_CD_F] = 0.4;
        }
    }

    f[POUND_SAFE] = max(0.0, or(f[POUND_SAFE], 0.0) - dt);
    if f[POUND] != 0.0 {
        f[VX] = 0.0;
        f[POUND_T] -= dt;
        f[VY] = if f[POUND_T] > 0.0 { 0.0 } else { 620.0 };
        f[GHOST_T2] = or(f[GHOST_T2], 0.0) - dt;
        if f[GHOST_T2] <= 0.0 && f[POUND_T] <= 0.0 {
            f[GHOST_T2] = 0.03;
            ghost(f[X], f[Y], 0.16, pc("yel", 3));
        }
    }
    // 중력 · 바람 · 양옆 벽 · 부드러운 천장
    let mut s = [f[X], f[Y], f[VX], f[VY], dt, wind, f[ROLL_T_F], al, ar, f[POUND], has(IN_JUMP_HELD) as i32 as f64, f[ON_GROUND]];
    fall(&mut s);
    (f[X], f[Y], f[VY]) = (s[0], s[1], s[3]);
    if f[ON_GROUND] == 0.0 {
        f[PEAK_Y] = min(if f[PEAK_Y].is_nan() { f[Y] } else { f[PEAK_Y] }, f[Y]);
    }

    if f[Y] >= GROUND {
        if f[ON_GROUND] == 0.0 && f[POUND] != 0.0 {
            pound_land(f);
        }
        if f[ON_GROUND] == 0.0 {
            land(f);
        }
        f[Y] = GROUND;
        f[VY] = 0.0;
        f[ON_GROUND] = 1.0;
        f[AIR_JUMPS_F] = AIR_JUMPS;
    } else {
        f[ON_GROUND] = 0.0;
    }

    if f[ON_GROUND] != 0.0 && f[VX].abs() > 10.0 && f[ROLL_T_F] <= 0.0 {
        f[ANIM] += dt * (f[VX].abs() / SPEED) * 15.0;
        f[DUST_T] -= dt;
        if f[DUST_T] <= 0.0 {
            dust(f[X] - f[FACE] * 5.0, GROUND, 1.0, -f[FACE], 0.0);
            f[DUST_T] = 0.16;
        }
    } else if f[ROLL_T_F] <= 0.0 {
        f[ANIM] = 0.0;
    }
    f[SX] = approach(f[SX], 1.0, dt * 5.0);
    f[SY] = approach(f[SY], 1.0, dt * 5.0);
    hook("scarf", 0.0, 0.0, 0.0, 0.0); // 등의 테왁 · 목도리 줄
}

// 땅에서 점프 (구르는 중이면 구르기를 끊고 앞으로 힘차게)
fn jump(f: &mut [f64]) {
    f[VY] = -JUMP_V;
    f[ON_GROUND] = 0.0;
    f[COYOTE_F] = 0.0;
    f[BUFFER_F] = 0.0;
    f[JUMP_CUT_F] = 0.0;
    if f[ROLL_T_F] > 0.0 {
        end_roll(f, ROLL_CD * 0.4);
        f[VX] = f[FACE] * SPEED * 1.25;
    }
    f[SX] = 0.75;
    f[SY] = 1.3;
    sfx("jump");
    dust(f[X] - 3.0, GROUND, 3.0, -1.0, 0.0);
    dust(f[X] + 3.0, GROUND, 3.0, 1.0, 0.0);
    beat_act(f[X], GROUND - 4.0, false);
    Fx { life: 0.22, col: pc("cloth", 2), ..Fx::new("ring", f[X], GROUND - 1.0) }.emit();
    for s in [-1.0, 1.0] {
        Fx { vx: s * 10.0, vy: -70.0, life: 0.14, col: pc("cloth", 2), ..Fx::new("trail", f[X] + s * 5.0, GROUND - 3.0) }.emit();
    }
}

// 공중 점프 (마지막 세 번째는 금빛으로 높이)
fn air_jump(f: &mut [f64]) {
    let (x, y) = (f[X], f[Y]);
    f[AIR_JUMPS_F] -= 1.0;
    let third = f[AIR_JUMPS_F] == 0.0;
    f[VY] = if third { -DJUMP_V * 0.92 } else { -DJUMP_V };
    f[BUFFER_F] = 0.0;
    f[JUMP_CUT_F] = 0.0;
    f[FLIP_T] = if third { 0.42 } else { 0.32 };
    f[FLIP_MAX] = f[FLIP_T];
    if f[ROLL_T_F] > 0.0 {
        end_roll(f, ROLL_CD * 0.6);
    }
    f[SX] = 0.8;
    f[SY] = 1.25;
    sfx("djump");
    let col = if third { pc("yel", 3) } else { pc("cloth", 3) };
    Fx { life: 0.25, col, ..Fx::new("ring", x, y - 2.0) }.emit();
    Fx { size: if third { 9.0 } else { 5.0 }, life: 0.18, col, ..Fx::new("flare", x, y - 4.0) }.emit();
    for i in -2..=2 {
        let i = i as f64;
        let col = if third { pc("yel", 2) } else { pc("cloth", 2) };
        Fx { vx: i * 25.0, vy: 90.0, life: 0.2, col, ..Fx::new("trail", x + i * 2.0, y) }.emit();
    }
    if third {
        sfx("dodge");
        light(x, y - 10.0, 26.0, pc("yel", 3), 0.8);
        for _ in 0..8 {
            let px = x + rand(-8.0, 8.0);
            let py = y - rand(0.0, 16.0);
            let vx = rand(-30.0, 30.0);
            let vy = rand(-40.0, 10.0);
            Fx { vx, vy, life: 0.4, ..Fx::new("spark", px, py) }.emit();
        }
    }
    for _ in 0..6 {
        let px = x + rand(-6.0, 6.0);
        let vx = rand(-40.0, 40.0);
        let vy = rand(20.0, 60.0);
        Fx { vx, vy, life: 0.3, size: 1.0, ..Fx::new("puff", px, y) }.emit();
    }
}

// 착지: 흙먼지 · 높이 떨어졌으면 고리와 흔들림
fn land(f: &mut [f64]) {
    let x = f[X];
    let hard = f[VY] > 220.0;
    dust(x - 4.0, GROUND, if hard { 4.0 } else { 2.0 }, -1.0, 0.0);
    dust(x + 4.0, GROUND, if hard { 4.0 } else { 2.0 }, 1.0, 0.0);
    if f[VY] > 150.0 {
        sfx("land");
    }
    f[FLIP_T] = 0.0;
    f[LAND_T] = if hard { 0.1 } else { 0.05 };
    let fall = GROUND - if f[PEAK_Y].is_nan() { GROUND } else { f[PEAK_Y] };
    f[PEAK_Y] = f64::NAN; // 없음 (Opt)
    if fall > 150.0 {
        light(x, GROUND - 4.0, 22.0, pc("yel", 3), 0.6);
        Fx { life: 0.3, col: pc("yel", 3), ..Fx::new("ring", x, GROUND - 1.0) }.emit();
    }
    if fall > 110.0 {
        Fx { big: true, life: 0.25, col: pc("cloth", 2), ..Fx::new("ring", x, GROUND - 1.0) }.emit();
        shake(0.08);
        for _ in 0..6 {
            let vx = rand(-90.0, 90.0);
            let vy = rand(-60.0, -20.0);
            let life = rand(0.25, 0.4);
            Fx { vx, vy, grav: 300.0, life, size: 1.0, col: pc("soil", 3), ..Fx::new("chunk", x, GROUND - 1.0) }.emit();
        }
    }
}
