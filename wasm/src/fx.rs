// 파티클 한 스텝 (game.js updateFxList): JS 파티클 객체들을 한 번에 넘겨받아 같이 움직임
//  한 칸 8개: x · y · vx · vy · life · grav · drag · 종류 (0 기타 · 1 px · 2 chunk · 3 petal · 4 rain)
//  땅에 닿은 빗방울은 life = 0, 종류 = 5로 돌려줌 (튀는 물방울은 Math.random을 써야 해서 JS가 만듦)
use crate::js::*;

const GROUND: f64 = 156.0;

pub fn step(b: &mut [f64], dt: f64, t: f64) {
    for p in b.chunks_exact_mut(8) {
        let kind = p[7] as i32;
        p[4] -= dt; p[3] += p[5] * dt;
        if p[6] != 0.0 { p[2] *= 1.0 - p[6] * dt; p[3] *= 1.0 - p[6] * dt; }
        if kind == 3 { p[3] += sin(t * 6.0 + p[0]) * 60.0 * dt; }
        p[0] += p[2] * dt; p[1] += p[3] * dt;
        if (kind == 1 || kind == 2) && p[5] != 0.0 && p[1] > GROUND + 1.0 { p[1] = GROUND + 1.0; p[3] *= -0.35; p[2] *= 0.6; }
        if kind == 4 && p[1] >= GROUND - 1.0 { p[4] = 0.0; p[7] = 5.0; }
    }
}
