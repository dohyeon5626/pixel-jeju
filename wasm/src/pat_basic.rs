// 기본 패턴 (원래 game.js Pat*): 장애물을 언제 · 어디에 · 몇 개 낼지
//  모듈마다 필드 목록(SCHEMA) · 한 스텝(update) · 경고 뒤에 내는 동작(action)
//  생성자 · end()는 JS에 남음 (JS 상태만 만지는 한두 줄)
use crate::game::*;
use crate::js::*;
use crate::pat::*;

// 패턴 공통 칸: 흐른 시간 · 길이 · 다음까지 남은 시간
const T: usize = 0;
const DUR: usize = 1;
const NEXT: usize = 2;
// 공통 앞부분: 시간을 흘리고, 낼 때가 아니면 false (end: 끝나기 몇 초 전부터는 안 냄)
fn tick(f: &mut [f64], dt: f64, end: f64) -> bool {
    f[T] += dt;
    f[NEXT] -= dt;
    f[NEXT] <= 0.0 && f[T] <= f[DUR] - end
}
// 4분음표 하나 길이(초, 배속 반영) · 8분 · 16분
fn beat(c: &Ctx) -> f64 {
    60.0 / or(c.tempo, 138.0) * c.speed
}
fn side() -> f64 {
    pick(&[-1.0, 1.0])
}

// ── 솟는 돌하르방: 한두 개씩 · 가끔 16분음표 박자로 쭈루루룩 행렬 ──
pub mod rise {
    use super::*;
    pub const SCHEMA: Schema = &[("t", Ty::Num), ("dur", Ty::Num), ("next", Ty::Num), ("justWaved", Ty::Bool), ("paired", Ty::Bool)];
    const JUST_WAVED: usize = 3;
    const PAIRED: usize = 4;
    pub fn update(f: &mut [f64], dt: f64) {
        if !tick(f, dt, 1.2) {
            return;
        }
        let c = ctx();
        let d = c.diff;
        let warn = max(0.6, 0.95 - d * 0.06) * c.speed;
        if random() < if d >= 0.5 { 0.5 } else { 0.3 } && f[JUST_WAVED] == 0.0 && f[PAIRED] == 0.0 && c.npat <= 1.0 {
            // 돌하르방 행렬: 땅이 갈라지며 하르방이 16분음표 박자로 차례로 솟음
            let modes: &[&str] = if d >= 1.0 { &["sweep", "converge", "pingpong", "gap"] } else { &["sweep", "sweep", "gap"] };
            let mode = pick_of(modes);
            let step16 = beat(&c) / 4.0;
            let lead = beat_lead(warn);
            let hold = 0.14 * c.speed;
            let n = ((c.w - 32.0) / 26.0).ceil() + 1.0;
            let xs: Vec<f64> = (0..n as usize).map(|i| 16.0 + i as f64 * (c.w - 32.0) / (n - 1.0)).collect();
            let dir = side();
            let at = |i: usize| if dir > 0.0 { i as f64 } else { n - 1.0 - i as f64 };
            let rise = |x: f64, warn: f64, j: f64| {
                spawn("Rise", &[x, warn, hold, 1.0, j]);
            };
            if mode == "sweep" || mode == "gap" {
                let gap = if mode == "gap" { randi(3.0, n - 5.0) } else { -9.0 };
                for (i, &x) in xs.iter().enumerate() {
                    let j = at(i);
                    if (j - gap).abs() > 1.0 {
                        rise(x, lead + j * step16, j);
                    }
                }
                f[NEXT] = 2.4 + n * step16;
            } else if mode == "converge" {
                // 만나는 가운데 한 칸은 비움
                for (i, &x) in xs.iter().enumerate() {
                    if i != (n as usize) >> 1 {
                        rise(x, lead + min(i as f64, n - 1.0 - i as f64) * step16 * 1.3, i as f64);
                    }
                }
                f[NEXT] = 2.6 + n * step16 * 0.7;
            } else {
                // 갔다가 되돌아옴 · 돌아올 땐 끝 세 칸은 비워 둠 (돌아서는 자리 = 안전지대)
                for (i, &x) in xs.iter().enumerate() {
                    let j = at(i);
                    rise(x, lead + j * step16, j);
                    if j < n - 3.0 {
                        rise(x, lead + (2.0 * n - 1.0 - j) * step16 + 2.0 * beat(&c), j);
                    }
                }
                f[NEXT] = 3.0 + n * step16 * 2.0;
            }
            f[JUST_WAVED] = 1.0;
            sfx("alarm");
        } else {
            f[JUST_WAVED] = 0.0;
            let n = 1.0 + if random() < 0.25 + d * 0.12 { 1.0 } else { 0.0 } + if d >= 3.0 && random() < 0.35 { 1.0 } else { 0.0 };
            let mut xs = vec![clamp(c.px + rand(-10.0, 10.0), 16.0, c.w - 16.0)];
            let mut k = 0;
            while xs.len() < n as usize && k < 40 {
                let x = rand(16.0, c.w - 16.0);
                if xs.iter().all(|o| (o - x).abs() > 40.0) {
                    xs.push(x);
                }
                k += 1;
            }
            for x in xs {
                spawn("Rise", &[x, warn, 0.8, 0.0, 0.0]);
            }
            f[NEXT] = max(0.65, 1.4 - d * 0.12);
        }
    }
}

// ── 꼬마 하르방이 화면 끝에서 통통 ──
pub mod hop {
    use super::*;
    pub const SCHEMA: Schema = &[("t", Ty::Num), ("dur", Ty::Num), ("next", Ty::Num)];
    pub fn update(f: &mut [f64], dt: f64) {
        if !tick(f, dt, 1.0) {
            return;
        }
        let c = ctx();
        let dir = side();
        spawn("Hopper", &[dir]);
        if c.diff >= 2.0 && random() < 0.3 {
            spawn("Hopper", &[-dir]);
        }
        f[NEXT] = max(0.5, 1.2 - c.diff * 0.1) * rand(0.8, 1.2);
    }
}

// ── 화산탄 (동굴에서는 낙석): 숨비 근처 · 가끔 박자 맞춘 줄폭격 ──
pub mod meteor {
    use super::*;
    pub const SCHEMA: Schema = &[("t", Ty::Num), ("dur", Ty::Num), ("next", Ty::Num), ("barraged", Ty::Bool)];
    const BARRAGED: usize = 3;
    pub fn update(f: &mut [f64], dt: f64) {
        if !tick(f, dt, 1.4) {
            return;
        }
        let c = ctx();
        let d = c.diff;
        let fall = max(0.85, 1.2 - d * 0.05) * c.speed;
        if d >= 1.0 && f[BARRAGED] == 0.0 && query("meteorLive", 0.0) == 0.0 && random() < 0.35 {
            // 줄폭격: 화산 쪽에서부터 8분음표마다 한 발씩 · 숨비 근처에 두 칸짜리 빈자리
            f[BARRAGED] = 1.0;
            let step8 = beat(&c) / 2.0;
            let mut xs = vec![];
            let mut x = 18.0;
            while x < c.arena_r - 10.0 {
                xs.push(x);
                x += 40.0;
            }
            let near = (0..xs.len()).fold(0, |bi, i| if (xs[i] - c.px).abs() < (xs[bi] - c.px).abs() { i } else { bi });
            let gap = clamp(near as f64 + pick(&[-1.0, 0.0, 1.0]), 0.0, xs.len() as f64 - 2.0);
            let rev = random() < 0.5;
            let lead = beat_lead(fall);
            for (i, &x) in xs.iter().enumerate() {
                let fi = i as f64;
                if fi == gap || fi == gap + 1.0 {
                    continue;
                }
                let j = if rev { xs.len() - 1 - i } else { i };
                new_obj("Meteor", &[x, lead + j as f64 * step8]).set("chain", 1.0).spawn();
            }
            sfx(if c.indoor { "rumble" } else { "erupt" });
            shake(0.4);
            f[NEXT] = 2.2 + xs.len() as f64 * step8;
            return;
        }
        let tx = if random() < 0.6 { c.px + rand(-40.0, 40.0) } else { rand(10.0, c.w - 10.0) };
        spawn("Meteor", &[tx, fall]);
        if d >= 2.0 && random() < 0.3 {
            let tx2 = tx + side() * rand(40.0, 70.0);
            spawn("Meteor", &[tx2, fall + 0.15]);
        }
        f[NEXT] = max(max(0.3 * c.speed, 0.24), 0.65 - d * 0.07) * rand(0.8, 1.2);
        // 고배속에서도 실제로 0.3초에 한 발 이하
    }
}

// 화면 끝 경고 뒤 n마리가 줄지어 (off: 앞 마리와의 간격을 정함)
fn file_in(kind: &str, dir: f64, n: f64, gap: impl Fn() -> f64) {
    let mut off = 0.0;
    for _ in 0..n as usize {
        spawn(kind, &[dir, off]);
        off += gap();
    }
}

// ── 조랑말 떼 ──
pub mod pony {
    use super::*;
    pub const SCHEMA: Schema = &[("t", Ty::Num), ("dur", Ty::Num), ("next", Ty::Num)];
    pub fn update(f: &mut [f64], dt: f64) {
        if !tick(f, dt, 2.0) {
            return;
        }
        let c = ctx();
        let dir = side();
        let n = min(4.0, 1.0 + randi(0.0, (1.0 + c.diff).floor()));
        warn(-dir, None, 1.0 * c.speed, f64::NAN, 0, [dir, n, 0.0, 0.0]);
        f[NEXT] = max(1.6, 2.8 - c.diff * 0.2);
    }
    // 경고가 끝나면: 붙어 달리거나 한 마리 건너 크게 벌어짐
    pub fn action(_act: u32, dir: f64, n: f64, _c: f64, _d: f64) {
        file_in("Pony", dir, n, || 28.0 + if random() < 0.5 { rand(2.0, 8.0) } else { rand(76.0, 104.0) });
        sfx("neigh");
    }
}

// ── 바람: 맞바람 · 꽃잎 · 날아오는 돌과 테왁 ──
pub mod wind {
    use super::*;
    pub const SCHEMA: Schema =
        &[("t", Ty::Num), ("dur", Ty::Num), ("next", Ty::Num), ("dir", Ty::Num), ("started", Ty::Bool), ("lastLow", Ty::Bool)];
    const DIR: usize = 3;
    const STARTED: usize = 4;
    const LAST_LOW: usize = 5;
    pub fn update(f: &mut [f64], dt: f64) {
        let c = ctx();
        let dir = f[DIR];
        f[T] += dt;
        f[NEXT] -= dt;
        if f[T] > 0.8 {
            f[STARTED] = 1.0;
            gset("windTarget", dir * min(52.0, 48.0 + c.diff * 6.0)); // 맞바람에도 움직일 수 있게
        }
        let started = f[STARTED] != 0.0;
        if random() < dt * 30.0 {
            let y = rand(20.0, GROUND - 2.0);
            let vx = dir * rand(220.0, 320.0);
            let len = randi(6.0, 16.0);
            let x = if dir > 0.0 { -10.0 } else { c.w + 10.0 };
            Fx { vx, life: 1.6, len, col: css("rgba(255,244,224,0.5)"), ..Fx::new("streak", x, y) }.emit();
        }
        if started && random() < dt * 12.0 {
            let y = rand(90.0, GROUND);
            let vx = dir * rand(90.0, 160.0);
            let vy = rand(-20.0, 20.0);
            let col = pick(&[pc("yel", 2), pc("yel", 3), pc("leaf", 3)]);
            let x = if dir > 0.0 { -4.0 } else { c.w + 4.0 };
            Fx { vx, vy, life: 2.5, col, ..Fx::new("petal", x, y) }.emit();
        }
        if started && random() < dt * 4.0 {
            sfx("gust");
        }
        if !started || f[NEXT] > 0.0 || f[T] > f[DUR] - 1.0 {
            return;
        }
        let tewak = random() < 0.14;
        let pb = new_obj(if tewak { "Tewak" } else { "Pebble" }, &[dir]);
        if !tewak {
            // 낮은 돌 뒤 높은 돌은 착지할 틈을 두고
            let y = pb.get("y");
            if f[LAST_LOW] != 0.0 && y < GROUND - 24.0 {
                pb.set("x", pb.get("x") - dir * 55.0);
            }
            f[LAST_LOW] = (y > GROUND - 10.0) as i32 as f64;
        }
        pb.spawn();
        f[NEXT] = max(0.24 * c.speed, max(0.22, 0.55 - c.diff * 0.06) * rand(0.7, 1.3));
    }
}

// ── ᄒᆞᆫ저옵서예~ 캐리어 행렬 (사진 찍는 번쩍임) ──
pub mod suitcase {
    use super::*;
    pub const SCHEMA: Schema = &[("t", Ty::Num), ("dur", Ty::Num), ("next", Ty::Num), ("flash", Ty::Num)];
    const FLASH: usize = 3;
    pub fn update(f: &mut [f64], dt: f64) {
        f[FLASH] -= dt;
        f[T] += dt;
        f[NEXT] -= dt;
        if f[FLASH] <= 0.0 && f[T] < f[DUR] - 1.0 {
            f[FLASH] = rand(1.4, 2.4);
            hook("flash", 0.03, hexc(0xfff4e0), 0.0, 0.0);
            sfx("shutter");
        }
        if f[NEXT] > 0.0 || f[T] > f[DUR] - 2.0 {
            return;
        }
        let c = ctx();
        let dir = side();
        let n = 1.0 + randi(0.0, min(3.0, 1.0 + c.diff.floor()));
        warn(-dir, Some("case"), max(0.6, 0.9 - c.diff * 0.06) * c.speed, f64::NAN, 0, [dir, n, 0.0, 0.0]);
        f[NEXT] = max(1.1, 2.0 - c.diff * 0.18);
    }
    pub fn action(_act: u32, dir: f64, n: f64, _c: f64, _d: f64) {
        file_in("Suitcase", dir, n, || rand(30.0, 70.0));
        sfx("roll");
    }
}

// ── 똥돼지 질주 ──
pub mod pig {
    use super::*;
    pub const SCHEMA: Schema = &[("t", Ty::Num), ("dur", Ty::Num), ("next", Ty::Num)];
    pub fn update(f: &mut [f64], dt: f64) {
        if !tick(f, dt, 1.8) {
            return;
        }
        let c = ctx();
        let dir = side();
        let n = 1.0 + randi(0.0, min(2.0, c.diff.floor()));
        warn(-dir, Some("pig"), max(0.6, 0.9 - c.diff * 0.06) * c.speed, f64::NAN, 0, [dir, n, 0.0, 0.0]);
        f[NEXT] = max(1.2, 2.1 - c.diff * 0.16);
    }
    pub fn action(_act: u32, dir: f64, n: f64, _c: f64, _d: f64) {
        file_in("Pig", dir, n, || rand(60.0, 110.0));
        sfx("oink");
    }
}

// ── 감귤 따기: 썩은 귤이 곧게 떨어지고(떨어질 자리 표시) · 사이사이 귤 ──
pub mod harvest {
    use super::*;
    pub const SCHEMA: Schema = &[("t", Ty::Num), ("dur", Ty::Num), ("next", Ty::Num)];
    pub fn update(f: &mut [f64], dt: f64) {
        if !tick(f, dt, 1.2) {
            return;
        }
        let c = ctx();
        let x = rand(14.0, c.w - 14.0);
        if random() < 0.45 + c.diff * 0.05 {
            // 고배속에선 천천히 떨어져 실제 경고 시간이 0.5초 넘게
            let sl = max(1.0, c.speed / 1.5);
            new_obj("Rotten", &[x, -VOFF - 10.0, 0.0, 40.0 / sl])
                .set("grav", 560.0 / (sl * sl))
                .set("falling", 1.0)
                .set("life", 3.2 * sl)
                .spawn();
            mark_spot(x, 0.9 * sl);
        } else {
            let vx = rand(-20.0, 20.0);
            hook("tang", x, -VOFF - 10.0, vx, 20.0);
        }
        f[NEXT] = max(max(0.12 * c.speed, 0.16), 0.42 - c.diff * 0.05) * rand(0.7, 1.3);
        // 실제로 0.12초에 하나 이하
    }
}

// ── 갈매기 강하 · 가끔 편대 ──
pub mod gull {
    use super::*;
    pub const SCHEMA: Schema = &[("t", Ty::Num), ("dur", Ty::Num), ("next", Ty::Num), ("paired", Ty::Bool)];
    const PAIRED: usize = 3;
    pub fn update(f: &mut [f64], dt: f64) {
        if !tick(f, dt, 1.3) {
            return;
        }
        let c = ctx();
        if c.diff >= 0.5 && f[PAIRED] == 0.0 && c.npat <= 1.0 && random() < 0.4 {
            // 편대: 같은 쪽에서 8분음표마다 한 마리씩, 내리꽂는 자리를 30px씩 밀며 줄지어 강하 → 높이 한 번 뛰면 줄줄이 넘어감
            let n = randi(3.0, 5.0);
            let dir = side();
            let step8 = beat(&c) / 2.0;
            let base = clamp(c.px - dir * 45.0, 40.0, c.w - 40.0);
            for i in 0..n as usize {
                let gl = new_obj("Gull", &[]);
                let tx = clamp(base + dir * i as f64 * 30.0, 16.0, c.w - 16.0);
                let half = gl.get("T") / 2.0;
                gl.set("dir", dir).set("tx", tx).set("sx", tx - dir * 190.0).set("x", tx - dir * 190.0);
                gl.set("t", min(0.0, -(beat_lead(half) - half)) - i as f64 * step8).set("chain", 1.0).spawn();
            }
            sfx("gull");
            f[NEXT] = n * step8 + 1.6 * c.speed;
            return;
        }
        spawn("Gull", &[]);
        if c.diff > 1.5 && random() < 0.35 {
            spawn("Gull", &[]);
        }
        f[NEXT] = max(0.5, 1.1 - c.diff * 0.1) * rand(0.8, 1.2);
    }
}

// ── 렌터카 대행진 ──
pub mod car {
    use super::*;
    pub const SCHEMA: Schema = &[("t", Ty::Num), ("dur", Ty::Num), ("next", Ty::Num)];
    pub fn update(f: &mut [f64], dt: f64) {
        if !tick(f, dt, 2.0) {
            return;
        }
        let c = ctx();
        let dir = side();
        let n = 1.0 + if c.diff > 1.2 && random() < 0.5 { 1.0 } else { 0.0 };
        warn(-dir, Some("car"), max(0.7, 1.0 - c.diff * 0.06) * c.speed, f64::NAN, 0, [dir, n, 0.0, 0.0]);
        f[NEXT] = max(1.4, 2.4 - c.diff * 0.18);
    }
    pub fn action(_act: u32, dir: f64, n: f64, _c: f64, _d: f64) {
        file_in("RentCar", dir, n, || rand(90.0, 130.0));
    }
}

// ── 유채꽃 벌떼: 모두 같은 물결길 ──
pub mod bee {
    use super::*;
    pub const SCHEMA: Schema = &[("t", Ty::Num), ("dur", Ty::Num), ("next", Ty::Num), ("dir", Ty::Num)];
    const DIR: usize = 3;
    pub fn update(f: &mut [f64], dt: f64) {
        if !tick(f, dt, 1.6) {
            return;
        }
        let c = ctx();
        let dir = f[DIR];
        let ph = rand(0.0, 6.28);
        let n = 4.0 + min(3.0, c.diff.floor());
        let sp = (80.0 + c.diff * 8.0) * min(1.0, 1.35 / c.speed);
        warn(-dir, None, 0.8 * c.speed, ph, 0, [dir, n, sp, ph]);
        f[NEXT] = max(2.2, 2.8 - c.diff * 0.15);
    }
    pub fn action(_act: u32, dir: f64, n: f64, sp: f64, ph: f64) {
        sfx("buzz");
        for i in 0..n as usize {
            spawn("Bee", &[dir, i as f64, sp, ph]);
        }
    }
}

// ── 참새 무리 (낮게 · 높게, 가끔 둘째 무리가 뒤따라) ──
pub mod plane {
    use super::*;
    pub const SCHEMA: Schema = &[("t", Ty::Num), ("dur", Ty::Num), ("next", Ty::Num)];
    pub fn update(f: &mut [f64], dt: f64) {
        if !tick(f, dt, 1.8) {
            return;
        }
        let c = ctx();
        let dir = side();
        let low = random() < 0.55;
        let sp = (150.0 + c.diff * 10.0) * min(1.0, 1.35 / c.speed);
        spawn("Plane", &[dir, low as i32 as f64, sp]);
        if c.diff > 1.6 && random() < 0.35 {
            let p2 = new_obj("Plane", &[dir, !low as i32 as f64, sp]);
            p2.set("warn", p2.get("warn") + 0.9 * c.speed).spawn();
        }
        f[NEXT] = max(1.3, 2.1 - c.diff * 0.15);
    }
}

// ── 택배: 숨비 둘레에 차례로 떨어짐 (이미 있는 자리는 건너뜀) ──
pub mod parcel {
    use super::*;
    pub const SCHEMA: Schema = &[("t", Ty::Num), ("dur", Ty::Num), ("next", Ty::Num)];
    pub fn update(f: &mut [f64], dt: f64) {
        if !tick(f, dt, 2.0) {
            return;
        }
        let c = ctx();
        let n = 2.0 + min(2.0, c.diff.floor());
        for i in 0..n as usize {
            let fi = i as f64;
            let x = clamp(c.px + (fi - (n - 1.0) / 2.0) * 34.0 + rand(-6.0, 6.0), 16.0, c.arena_r - 16.0);
            if query("parcelNear", x) == 0.0 {
                spawn("Parcel", &[x, (0.65 + fi * 0.18) * c.speed]);
            }
        }
        f[NEXT] = max(1.5, 2.2 - c.diff * 0.15);
    }
}

// ── 패러글라이더(밟고 오르는 발판)와 그 아래 꼬마 하르방 ──
pub mod glider {
    use super::*;
    pub const SCHEMA: Schema =
        &[("t", Ty::Num), ("dur", Ty::Num), ("next", Ty::Num), ("gl", Ty::Num), ("dir", Ty::Num), ("high", Ty::Bool)];
    const GL: usize = 3;
    const DIR: usize = 4;
    const HIGH: usize = 5;
    pub fn update(f: &mut [f64], dt: f64) {
        let c = ctx();
        let dir = f[DIR];
        f[T] += dt;
        f[NEXT] -= dt;
        f[GL] -= dt;
        if f[T] > f[DUR] - 1.2 {
            return;
        }
        if f[GL] <= 0.0 {
            // 글라이더는 이 패턴 몫으로 치지 않음 (pat 없음)
            spawn("Glider", &[dir, f[HIGH], 52.0 * min(1.0, 1.35 / c.speed)]).set("pat", 0.0);
            f[HIGH] = (f[HIGH] == 0.0) as i32 as f64;
            f[GL] = 1.5;
        }
        if f[NEXT] > 0.0 || f[T] < 1.2 {
            return;
        }
        spawn("Hopper", &[-dir]);
        if c.diff >= 1.5 && random() < 0.35 {
            let x = clamp(c.px + rand(-8.0, 8.0), 16.0, c.w - 16.0);
            spawn("Rise", &[x, max(0.65, 0.95 - c.diff * 0.06) * c.speed, 0.6, 0.0, 0.0]);
        }
        f[NEXT] = max(0.7, 1.3 - c.diff * 0.1) * rand(0.85, 1.15);
    }
}

// ── 돌고래: 떨어질 자리가 숨비 근처 → 옆으로 비키거나 아치 밑으로 ──
pub mod dolphin {
    use super::*;
    pub const SCHEMA: Schema = &[("t", Ty::Num), ("dur", Ty::Num), ("next", Ty::Num)];
    pub fn update(f: &mut [f64], dt: f64) {
        if !tick(f, dt, 2.0) {
            return;
        }
        let c = ctx();
        let span = rand(130.0, 170.0);
        let end = clamp(c.px + rand(-14.0, 14.0), 20.0, c.arena_r - 20.0);
        let dir = if end - span < 10.0 {
            -1.0
        } else if end + span > c.arena_r - 10.0 {
            1.0
        } else {
            side()
        };
        let x1 = end;
        let x0 = clamp(x1 - dir * span, 10.0, c.arena_r - 10.0);
        let peak = rand(62.0, 84.0);
        let dur = max(0.8, (x1 - x0).abs() / 150.0) * c.speed;
        spawn("Dolphin", &[x0, x1, peak, dur, 0.9 * c.speed]);
        if c.diff >= 1.5 && random() < 0.45 {
            let y0 = clamp(x1 + dir * rand(60.0, 90.0), 10.0, c.arena_r - 10.0);
            let y1 = clamp(y0 + dir * span * 0.8, 10.0, c.arena_r - 10.0);
            if (y1 - y0).abs() > 90.0 {
                spawn("Dolphin", &[y0, y1, peak * 0.8, max(0.8, (y1 - y0).abs() / 150.0) * c.speed, 1.3 * c.speed]);
            }
        }
        f[NEXT] = max(1.3, 1.9 - c.diff * 0.12);
    }
}

// ── 까마귀 (동굴에선 박쥐) 두세 마리가 차례로 노림 ──
pub mod crow {
    use super::*;
    pub const SCHEMA: Schema = &[("t", Ty::Num), ("dur", Ty::Num), ("next", Ty::Num)];
    pub fn update(f: &mut [f64], dt: f64) {
        if !tick(f, dt, 2.2) {
            return;
        }
        let c = ctx();
        let n = 2.0 + if c.diff >= 2.5 { 1.0 } else { 0.0 };
        for i in 0..n as usize {
            let fi = i as f64;
            let x = clamp(c.px + (fi - (n - 1.0) / 2.0) * 70.0 + rand(-10.0, 10.0), 20.0, c.arena_r - 20.0);
            spawn("Crow", &[x, (0.55 + fi * 0.35) * c.speed]);
        }
        f[NEXT] = max(2.0, 2.6 - c.diff * 0.1);
    }
}

// ── 떨어지는 사투리 낱말 (쓴 낱말은 usedMask 비트로 빼고) ──
pub mod dialect {
    use super::*;
    pub const SCHEMA: Schema = &[("t", Ty::Num), ("dur", Ty::Num), ("next", Ty::Num), ("usedMask", Ty::Num)];
    const USED: usize = 3;
    pub fn update(f: &mut [f64], dt: f64) {
        if !tick(f, dt, 2.2) {
            return;
        }
        let c = ctx();
        let total = query("dialectCount", 0.0) as usize;
        let used = f[USED] as u64;
        let pool: Vec<usize> = (0..total).filter(|i| used & (1 << i) == 0).collect();
        let i = if pool.is_empty() { pick_index(total) } else { pool[pick_index(pool.len())] };
        f[USED] = (used | 1 << i) as f64;
        spawn("DialectWord", &[i as f64, c.px + rand(-20.0, 20.0), 1.0 * c.speed]);
        // 높은 단계: 가끔 두 번째 낱말이 옆에 조금 늦게 (사이는 비워 둠)
        if c.diff >= 1.5 && random() < 0.4 {
            let j = pick_index(total);
            let side = if c.px < c.w / 2.0 { 1.0 } else { -1.0 };
            spawn("DialectWord", &[j as f64, c.px + side * 150.0, 1.35 * c.speed]);
        }
        f[NEXT] = 1.9;
    }
}

// ── 태풍 상륙: 정전 → 먹구름 · 비바람 · 갈래 번개 (번개 모양은 JS makeBolt) ──
pub mod typhoon {
    use super::*;
    pub const SCHEMA: Schema =
        &[("t", Ty::Num), ("dur", Ty::Num), ("next", Ty::Num), ("bolt", Ty::Num), ("dir", Ty::Num), ("flash2", Ty::Num)];
    const BOLT: usize = 3;
    const DIR: usize = 4;
    const FLASH2: usize = 5;
    pub fn update(f: &mut [f64], dt: f64) {
        let c = ctx();
        let d = f[DIR];
        f[T] += dt;
        f[NEXT] -= dt;
        f[BOLT] -= dt;
        let t = f[T];
        let out = t > f[DUR] - 0.8;
        // 처음엔 전기가 나가듯 깜빡이며 어두워짐
        let dark = if out {
            max(0.0, c.dark - dt * 2.0)
        } else if t < 0.75 {
            if (t * 12.0).floor() % 3.0 == 1.0 {
                0.12
            } else {
                min(1.0, t * 1.6)
            }
        } else {
            min(1.0, c.dark + dt * 2.0)
        };
        gset("dark", dark);
        gset("storm", if out { max(0.0, c.storm - dt * 1.5) } else { min(1.0, c.storm + dt * 1.2) });
        gset("windTarget", d * min(52.0, 30.0 + c.diff * 5.0));
        let up = if d > 0.0 { -60.0 } else { 60.0 };
        if random() < dt * 75.0 {
            // 앞 빗줄기
            let x = rand(0.0, c.w) + up;
            let vx = d * rand(80.0, 110.0);
            let vy = rand(320.0, 380.0);
            let len = randi(5.0, 7.0);
            Fx { vx, vy, life: 0.9, len, near: true, col: css("rgba(205,220,245,0.7)"), ..Fx::new("rain", x, -VOFF - 6.0) }.emit();
        }
        if random() < dt * 55.0 {
            // 먼 빗줄기
            let x = rand(0.0, c.w) + up;
            Fx { vx: d * 60.0, vy: 240.0, life: 1.2, len: 3.0, col: css("rgba(165,180,215,0.35)"), ..Fx::new("rain", x, -VOFF - 6.0) }
                .emit();
        }
        if random() < dt * 4.0 {
            // 바람에 날리는 잎
            let y = rand(40.0, GROUND - 6.0);
            let vx = d * rand(170.0, 250.0);
            let vy = rand(-30.0, 20.0);
            let col = pick(&[pc("leaf", 2), pc("leaf", 3), pc("org", 2)]);
            let x = if d > 0.0 { -6.0 } else { c.w + 6.0 };
            Fx { vx, vy, life: 2.6, col, ..Fx::new("petal", x, y) }.emit();
        }
        if random() < dt * 7.0 {
            // 돌풍 줄
            let y = rand(-VOFF + 30.0, GROUND - 4.0);
            let vx = d * rand(300.0, 420.0);
            let len = randi(8.0, 18.0);
            let x = if d > 0.0 { -12.0 } else { c.w + 12.0 };
            Fx { vx, life: 1.1, len, col: css("rgba(225,232,245,0.4)"), ..Fx::new("streak", x, y) }.emit();
        }
        let mut lightning = c.lightning;
        if f[BOLT] <= 0.0 && t < f[DUR] - 1.0 {
            f[BOLT] = rand(1.2, 2.2);
            f[FLASH2] = 0.11;
            lightning = max(lightning, 0.16);
            gset("lightning", lightning);
            sfx("thunder");
            shake(0.2);
            hook("bolt", 0.0, 0.0, 0.0, 0.0); // 하늘에서 먼 땅으로 내리꽂히는 갈래 번개 모양
        }
        if f[FLASH2] > 0.0 {
            // 번쩍 · 번쩍 두 번
            f[FLASH2] -= dt;
            if f[FLASH2] <= 0.0 {
                gset("lightning", max(lightning, 0.07));
            }
        }
        if f[NEXT] > 0.0 || t > f[DUR] - 1.5 {
            return;
        }
        if random() < 0.55 {
            spawn(if random() < 0.15 { "Tewak" } else { "Pebble" }, &[d]);
        } else {
            let x = clamp(c.px + rand(-30.0, 30.0), 16.0, c.w - 16.0);
            spawn("Rise", &[x, max(0.7, 0.9 - c.diff * 0.05) * c.speed, 0.6, 0.0, 0.0]);
        }
        f[NEXT] = max(0.45, 1.0 - c.diff * 0.1);
    }
}
