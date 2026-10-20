// 숨비 이동 (game.js updatePlayer): 걷기 가속 · 중력 · 벽 · 천장만 — 입력 · 효과 · 소리는 JS
use crate::js::*;

const GRAV: f64 = 860.0; const MAX_FALL: f64 = 470.0;
const SPEED: f64 = 94.0; const ACCEL: f64 = 1150.0; const AIR_ACCEL: f64 = 760.0; const FRICTION: f64 = 1500.0; const AIR_FRICTION: f64 = 320.0;
const CEIL: f64 = -60.0 + 40.0;   // -VOFF + 40: 점수판 아래

fn approach(v: f64, t: f64, d: f64) -> f64 { if v < t { min(v + d, t) } else { max(v - d, t) } }

// 좌우 입력(dir)에 따른 새 vx
pub fn walk(vx: f64, dir: f64, on_ground: bool, speed_up: f64, dt: f64) -> f64 {
    if dir != 0.0 { approach(vx, dir * SPEED * (1.0 + 0.08 * speed_up), (if on_ground { ACCEL } else { AIR_ACCEL }) * dt) }
    else { approach(vx, 0.0, (if on_ground { FRICTION } else { AIR_FRICTION }) * dt) }
}

// s: [x, y, vx, vy, dt, wind, rollT, arenaL, arenaR, pound, holdJump, onGround] → x · y · vy를 고쳐 씀
pub fn fall(s: &mut [f64]) {
    let (vx, dt, wind, roll_t, al, ar, pound, hold, on_ground) = (s[2], s[4], s[5], s[6], s[7], s[8], s[9] != 0.0, s[10] != 0.0, s[11] != 0.0);
    let mut gmul = 1.0;
    if s[3].abs() < 50.0 && hold && !on_ground { gmul = 0.55; } else if s[3] > 0.0 { gmul = 1.25; }
    if !pound { s[3] = min(s[3] + GRAV * gmul * dt, MAX_FALL); }
    s[0] += (vx + wind * (if roll_t > 0.0 { 0.4 } else { 1.0 })) * dt;
    s[1] += s[3] * dt;
    s[0] = clamp(s[0], al, ar);
    if s[1] < CEIL { s[1] = CEIL; if s[3] < 0.0 { s[3] *= 0.3; } }
}
