// 동굴 (places.js): 먼 벽 · 용암석주 · 앞쪽 바닥 · 발밑 길의 픽셀 계산
use crate::js::*;
use crate::noise::*;

// cvC 색표: 밝기 11단계 × 온도 7단계 (JS가 처음에 넘겨 줌)
static mut CVC: [[u8; 3]; 77] = [[0; 3]; 77];
pub fn set_cvc(t: &[u8]) { for k in 0..77 { unsafe { CVC[k] = [t[k * 3], t[k * 3 + 1], t[k * 3 + 2]]; } } }

fn cvc(v: f64, w: f64) -> [u8; 3] {
    let i = clamp(round(v * 10.0), 0.0, 10.0) as usize; let r = round(clamp(w, -1.0, 1.0) * 3.0) as i32;
    unsafe { CVC[i * 7 + (r + 3) as usize] }
}
fn put(d: &mut [u8], w: i32, i: i32, y: i32, c: [u8; 3]) {
    if i < 0 || i >= w || y < 0 { return; }
    let p = ((y * w + i) * 4) as usize; if p >= d.len() { return; }
    d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
}

// cvLight: 화면 좌표 → (등불빛, 낮빛)
fn light(sx: f64, sy: f64, col_k: f64) -> (f64, f64) {
    let mut l = 0.0;
    for (lx, ly, s) in [(150.0, 182.0, 1.0), (346.0, 182.0, 0.85)] {
        let dx = (sx - lx) / 44.0; let dy = (sy - ly) / (if sy < ly { 80.0 } else { 12.0 });
        l += s * exp(-dx * dx - dy * dy);
    }
    for (lx, ly) in [(50.0, 190.0), (110.0, 190.0)] {
        let dx = (sx - lx) / 30.0; let dy = (sy - ly) / (if sy < ly { 150.0 } else { 10.0 });
        l += 0.75 * col_k * exp(-dx * dx - dy * dy);
    }
    let dx = (sx - 290.0) / 58.0; let dy = (sy - 104.0) / 110.0;
    (l, 0.5 * exp(-dx * dx - dy * dy))
}

// caveWallData: 먼 벽의 결 · 등불 · 낮빛 (시간대와 상관없어 한 번만)
struct Wall { w: usize, a: Vec<f32>, hl: Vec<f32>, l: Vec<f32>, d: Vec<f32>, amb: Vec<f32> }
static mut WALL: Option<Wall> = None;

fn wall_data(w: usize) -> &'static Wall {
    unsafe {
        if let Some(f) = (*std::ptr::addr_of!(WALL)).as_ref() { if f.w == w { return f; } }
        WALL = Some(build_wall(w));
        (*std::ptr::addr_of!(WALL)).as_ref().unwrap()
    }
}

fn build_wall(w: usize) -> Wall {
    let h2 = 200usize; let n = w * h2; let wf = w as f64;
    let mut f = Wall { w, a: vec![0.0; n], hl: vec![0.0; n], l: vec![0.0; n], d: vec![0.0; n], amb: vec![0.0; n] };
    let mut r = Rng::new(7001);
    let mut base = vec![]; let mut y = 36.0; while y < 188.0 { base.push(y); y += 3.0 + (pow(r.next(), 1.5) * 10.0).floor(); }
    struct S { b: f64, alb: f64, pits: bool, s: f64 }
    let st: Vec<S> = base.iter().enumerate().map(|(k, &b)| { let k = k as f64; S { b, alb: 1.0 + (hash2(k, 1.0, 7003.0) - 0.5) * 0.2, pits: hash2(k, 2.0, 7004.0) < 0.2, s: 0.55 + hash2(k, 3.0, 7005.0) * 0.45 } }).collect();
    let uf = |i: f64| sin(i * 0.011 + 0.7) * 3.0 + (vnoise(i * 0.018, 0.5, 7002.0) - 0.5) * 5.0;
    let cw = w + 2; let mut crack = vec![false; cw * h2];   // 용암 금 (i + 1까지 보므로 한 칸 넉넉히)
    for cx0 in [124i32, 232, 306, 366] {
        let (mut cx, mut dir) = (cx0, 0i32);
        let mut y = 34; while y < 92 + (cx0 % 3) * 6 { if r.next() < 0.35 { dir = round((r.next() - 0.5) * 2.0) as i32; } if r.next() < 0.6 { cx += dir; } if cx >= 0 && (cx as usize) < cw { crack[y as usize * cw + cx as usize] = true; } y += 1; }
    }
    for ii in 0..w {
        let i = ii as f64; let u = uf(i);
        let bs: Vec<f64> = st.iter().enumerate().map(|(k, o)| o.b + u * (0.4 + 0.6 * o.b / 190.0) + (vnoise(i * 0.035, k as f64 * 1.7, 7006.0) - 0.5) * 2.4).collect();
        let wb = 183.0 + round((vnoise(i * 0.04, 4.5, 7011.0) - 0.5) * 5.0);
        let shv: Vec<(f64, f64, f64)> = [(100.0, 7010.0), (152.0, 7020.0)].iter().map(|&(oy, os)| {
            let pr = vnoise(i * 0.012 + os, 0.5, os + 1.0); let top = round(oy + u * 0.8 + (vnoise(i * 0.03, 1.0, os + 2.0) - 0.5) * 4.0);
            let mut th = if pr < 0.36 { 0.0 } else { round((2.0 + vnoise(i * 0.06, 2.0, os + 3.0) * 5.0) * clamp((pr - 0.36) / 0.12, 0.0, 1.0)) };
            if th != 0.0 && vnoise(i * 0.35, 5.0, os + 5.0) > 0.84 { th += 1.0 + round(vnoise(i * 0.9, 6.0, os + 6.0)); }
            (top, th, round(3.0 + vnoise(i * 0.05, 3.0, os + 4.0) * 4.0))
        }).collect();
        let mut k = 0;
        for yy in 0..h2 {
            let y = yy as f64;
            while k < bs.len() - 1 && y >= bs[k + 1] { k += 1; }
            let mot = (fbm(i * 0.016, y * 0.07, 7007.0) - 0.5) * 0.2;
            let (mut a, mut hl) = (0.76 + mot, 0.0);
            if y >= bs[0] && y < wb - 2.0 {
                let o = &st[k]; let dy = y - bs[k].floor(); let on = vnoise(i * 0.022, k as f64 * 3.1, 7008.0) > 0.33;
                a *= o.alb;
                if on && dy == 0.0 { a *= 1.0 - 0.34 * o.s; } else if on && dy == 1.0 { hl = 0.06 * o.s; }
                if o.pits && hash2(i, y, 7009.0) < 0.025 { a *= 0.62; }
            }
            for &(top, th, sd) in &shv { if th != 0.0 {
                let r = y - top;
                if r == -1.0 { hl = 0.2; }
                else if r >= 0.0 && r < th { a = (0.92 - r / th * 0.14) * (1.0 + mot * 0.5); hl = if r == 0.0 { 0.1 } else { 0.0 }; }
                else if r >= th && r < th + sd { a *= 0.42 + 0.4 * (r - th) / sd; hl = 0.0; }
                else if r >= th + sd && r < th + sd + 4.0 { a *= 0.9; }
            } }
            if crack[yy * cw + ii] { a *= 0.42; hl = 0.0; } else if crack[yy * cw + ii + 1] { hl = 0.08; }
            if y >= wb - 3.0 && y < wb { a *= 0.55 + (wb - 1.0 - y) * 0.08; }
            if y >= wb { a = 0.95 + (vnoise(i * 0.1, y * 0.3, 7012.0) - 0.5) * 0.2; }
            let (l, d0) = light(i, y, 0.4); let vig = 1.0 - pow((i - wf / 2.0).abs() / (wf / 2.0), 3.0) * 0.4; let q = yy * w + ii;
            f.a[q] = a as f32; f.hl[q] = hl as f32; f.l[q] = l as f32; f.d[q] = d0 as f32;
            f.amb[q] = ((if y < 40.0 { 0.2 + y / 40.0 * 0.1 } else { 0.3 }) * vig + (if y >= wb { 0.06 } else { 0.0 })) as f32;
        }
    }
    f
}

// caveWall: 시간대(day)마다 먼 벽 색칠
pub fn wall(d: &mut [u8], w: usize, day: f64) {
    let f = wall_data(w);
    for q in 0..w * 200 {
        let l = f.l[q] as f64; let dd = f.d[q] as f64 * day;
        let c = cvc(f.a[q] as f64 * (f.amb[q] as f64 + l * 0.66 + dd * 0.6) + f.hl[q] as f64 * (0.4 + l), (l * 1.5 - dd * 1.2) / (0.2 + l + dd));
        d[q * 4] = c[0]; d[q * 4 + 1] = c[1]; d[q * 4 + 2] = c[2]; d[q * 4 + 3] = 255;
    }
}

// caveColumn: 용암석주 높이 지도 → 면 기울기로 음영
pub fn column(d: &mut [u8], lw: i32, sh: f64) {
    let cx = 80.0 + sh; let top = 10.0; let bot = 192.0;
    let mut r = Rng::new(7310);
    let prof = |y: f64| {
        let t = clamp((y - top) / (bot - top), 0.0, 1.0);
        let waist = |tt: f64| 9.0 + sin((tt - 0.2) * 14.0) * 1.5 + (tt - 0.2) * 7.0;
        let w = if t < 0.2 { 9.0 + pow(1.0 - t / 0.2, 2.0) * 22.0 } else if t < 0.56 { waist(t) } else { waist(0.56) + pow((t - 0.56) / 0.44, 1.35) * 34.0 };
        w + (vnoise(y * 0.07, 0.5, 7301.0) - 0.5) * 4.0
    };
    let lean = |y: f64| sin(clamp((y - top) / (bot - top), 0.0, 1.0) * 2.6 + 0.2) * 3.0;
    let mut blobs = vec![];
    let mut y = top + 6.0;
    while y < bot - 3.0 {
        let hw = prof(y); let m = cx + lean(y); let base = y > bot - 56.0; let n = max(2.0, round(hw / (if base { 8.0 } else { 6.0 })));
        let mut k = 0.0;
        while k < n {
            let u = (k / (n - 1.0) - 0.5) * 2.0 * 0.75 + (r.next() - 0.5) * 0.3; let rx = hw * (0.24 + r.next() * 0.18) + 2.0;
            let ry = rx * (if base { 0.7 + r.next() * 0.4 } else { 1.6 + r.next() * 1.2 });
            blobs.push((m + u * (hw - rx * 0.4), min(bot - ry * 0.6, y + ry * 0.5), rx, ry));
            k += 1.0;
        }
        y += 4.0 + r.next() * 4.0;
    }
    let x0 = cx - 60.0; let x1 = cx + 60.0; let gw = (x1 - x0 + 1.0) as usize;
    let mut hm = vec![0f32; gw * 200];
    for yy in 0..192usize {
        let y = yy as f64; let hw = prof(max(top, y)) + (if y < top { (top - y) * 1.3 } else { 0.0 }); let m = cx + lean(max(top, y));
        for g in 0..gw { let i = x0 + g as f64; let dx = (i + 0.5 - m) / hw; hm[yy * gw + g] = (if dx.abs() < 1.0 { (1.0 - dx * dx).sqrt() * hw * 0.75 } else { 0.0 }) as f32; }
    }
    for &(bx, by, rx, ry) in &blobs {
        let mut yy = max(0.0, (by - ry).floor());
        while yy <= min(bot - 1.0, (by + ry).ceil()) {
            let mut i = max(x0, (bx - rx).floor());
            while i <= min(x1, (bx + rx).ceil()) {
                let nx = (i + 0.5 - bx) / rx; let ny = (yy + 0.5 - by) / ry; let dd = nx * nx + ny * ny;
                if dd < 1.0 {
                    let q = yy as usize * gw + (i - x0) as usize; let hb = (1.0 - dd).sqrt() * rx * 0.55; let m = cx + lean(yy); let hw = prof(yy); let dx = (bx - m) / hw;
                    let base = if dx.abs() < 1.0 { (1.0 - dx * dx).sqrt() * hw * 0.75 } else { 0.0 };
                    hm[q] = max(hm[q] as f64, base * 0.92 * pow(1.0 - dd, 0.35) + hb) as f32;
                }
                i += 1.0;
            }
            yy += 1.0;
        }
    }
    let hat = |i: f64, y: f64| if i < x0 || i > x1 || y < 0.0 || y >= bot { 0.0 } else { hm[y as usize * gw + (i - x0) as usize] as f64 };
    let ln = hypot3(0.0, 0.55, 0.83);
    for yy in 0..192 {
        let y = yy as f64;
        for g in 0..gw {
            let i = x0 + g as f64; let h0 = hat(i, y); if h0 <= 0.0 { continue; }
            let gx = (hat(i + 1.0, y) - hat(i - 1.0, y)) / 2.0; let gy = (hat(i, y + 1.0) - hat(i, y - 1.0)) / 2.0; let nl = hypot3(gx, gy, 1.0); let nx = -gx / nl; let ny = -gy / nl; let nz = 1.0 / nl;
            let (l, _) = light(i - sh, y, 1.0); let lam = max(0.0, (ny * 0.55 + nz * 0.83) / ln); let side = max(0.0, -nx * 0.6 + nz * 0.5);
            let mut v = (0.86 + (vnoise(i * 0.3, y * 0.08, 7304.0) - 0.5) * 0.16) * (0.1 + side * 0.08 + lam * (0.14 + l * 1.3));
            if y < top + 16.0 { v *= 0.55 + max(0.0, y - top) / 36.0; }
            put(d, lw, i as i32, yy, cvc(clamp(v, 0.0, 1.0), clamp(0.3 + l * 1.5, 0.0, 1.0)));
        }
    }
}

// caveNear: 새끼줄 용암 바닥 + 등불빛
pub fn near(d: &mut [u8], lw: i32, sh: f64) {
    let lamps = [32.0 + sh, 198.0 + sh, 372.0 + sh];
    for ii in 0..lw {
        let i = ii as f64; let fb = 134.0 + round((vnoise(i * 0.05, 0.5, 7402.0) - 0.5) * 4.0);
        let mut y = fb;
        while y < 160.0 {
            let t = (y - fb) / (160.0 - fb); let ry = (y - fb) * 1.6;
            let rope = (sin((i * 0.16 + (ry + 1.0).sqrt() * 2.2 + vnoise(i * 0.02, ry * 0.05, 7403.0) * 4.0) * PI)).abs() < 0.16 && vnoise(i * 0.018, 3.0, 7404.0) > 0.42;
            let mut l = 0.0;
            for lx in lamps { let dx = (i - lx) / (26.0 + vnoise(i * 0.1, y * 0.3, 7406.0) * 10.0); let dy = (y - 150.0) / 9.0; l += exp(-dx * dx - dy * dy); }
            let (l0, d0) = light(i - sh, 186.0 + t * 10.0, 1.0);
            let mut v = (0.33 + (vnoise(i * 0.06, y * 0.3, 7405.0) - 0.5) * 0.12) * (0.8 + l * 0.8 + l0 * 0.5 + d0 * 0.5) - t * 0.06 + (if rope { 0.09 } else { 0.0 });
            if y == fb { v += 0.1; } else if y == fb + 1.0 { v += 0.04; }
            put(d, lw, ii, y as i32, cvc(clamp(v, 0.0, 1.0), clamp((l + l0) * 1.4 - d0, -1.0, 1.0)));
            y += 1.0;
        }
    }
}

// caveGround: 발밑 현무암 길
pub fn ground(d: &mut [u8], lw: i32, h: i32) {
    for ii in 0..lw { for yy in 2..h {
        let (i, y) = (ii as f64, yy as f64); let top = yy < 4;
        let rope = sin((i + sin(y * 0.8 + i * 0.05) * 4.0) * 0.42 + vnoise(i * 0.04, y * 0.15, 7452.0) * 5.0) > 0.75 && vnoise(i * 0.03, 7.0, 7453.0) > 0.4;
        let v = if top { if yy == 2 { 0.58 } else { 0.47 } } else { 0.34 - (y - 4.0) * 0.008 + (vnoise(i * 0.07, y * 0.2, 7454.0) - 0.5) * 0.1 + (if rope { 0.07 } else { 0.0 }) };
        if yy == 2 && vnoise(i * 0.3, 1.0, 7455.0) < 0.3 { continue; }
        put(d, lw, ii, yy, cvc(clamp(v, 0.0, 1.0), if top { 0.6 } else { 0.3 }));
    } }
}

// cvCell: 보로노이 (가장자리까지 거리, 칸 번호) — 금 간 천장 판
fn cell(u: f64, v: f64, seed: f64) -> (f64, f64) {
    let (mut d1, mut d2, mut hid) = (9.0, 9.0, 0.0);
    let gu = u.floor(); let gv = v.floor();
    for a in -1..=1 { for b in -1..=1 {
        let (a, b) = (a as f64, b as f64);
        let cu = gu + a + hash2(gu + a, gv + b, seed); let cv = gv + b + hash2(gu + a, gv + b, seed + 1.0); let dd = hypot(u - cu, v - cv);
        if dd < d1 { d2 = d1; d1 = dd; hid = hash2(gu + a, gv + b, seed + 2.0); } else if dd < d2 { d2 = dd; }
    } }
    (d2 - d1, hid)
}

// caveCeil 천장 · 구멍 너머 하늘: edge는 JS가 정한 천장 아래 끝 (열마다)
pub struct Ceil<'a> { pub edge: &'a [f64], pub day: f64, pub night: bool, pub sky_t: [u8; 3], pub sky_b: [u8; 3], pub gr: [[u8; 3]; 3], pub dirt: [u8; 3], pub rock: [u8; 3] }

pub fn ceil(d: &mut [u8], lw: i32, sh: f64, o: &Ceil) {
    let hx0 = 284.0 + sh; let hx1 = 338.0 + sh; let hc = (hx0 + hx1) / 2.0; let hw = (hx1 - hx0) / 2.0;
    let edge = |i: i32| o.edge[i.clamp(0, lw - 1) as usize];
    let hole_bot = |i: i32| edge(i) - 5.0;
    let in_hole = |i: i32, y: f64| { let hd = hole_bot(i); y < hd && (i as f64 - hc).abs() / hw < max(0.0, 1.0 - pow(y / hd, 3.0)).sqrt() * (1.0 + (vnoise(y * 0.35, if i as f64 > hc { 1.0 } else { 2.0 }, 7107.0) - 0.5) * 0.22) };
    let star = [0xe8, 0xe0, 0xf0];
    for ii in 0..lw {
        let i = ii as f64; let e = o.edge[ii as usize];
        let (l, _) = light(i - sh, e + 8.0, 1.0);
        let mut y = 0.0;
        while y <= e {
            if in_hole(ii, y) {   // 구멍 너머: 하늘 → 맞은편 테두리 (풀 · 흙 · 바위)
                let fr = hole_bot(ii) - y; let gl = 7.0 + round(vnoise(i * 0.25, 0.5, 7108.0) * 3.0);
                let col = if fr > gl { if o.night && hash2(i, y, 7112.0) < 0.012 { star } else { mix(o.sky_t, o.sky_b, clamp(y / hole_bot(ii) * 1.2, 0.0, 1.0)) } }
                    else if fr > gl - 2.0 { o.gr[1 + (hash2(i, y, 7109.0) < 0.3) as usize] } else if fr > gl - 4.0 { o.gr[0] } else if fr > 2.0 { o.dirt } else { o.rock };
                put(d, lw, ii, y as i32, col);
                if fr == gl + 1.0 && hash2(i, 3.0, 7110.0) < 0.45 { put(d, lw, ii, (y - (hash2(i, 4.0, 7111.0) * 3.0).floor()) as i32, o.gr[1]); }   // 풀잎이 하늘로 삐죽
            } else {
                let (cr, hid) = cell(i * 0.085, y * 0.16, 7104.0);
                let mut v = 0.11 + hid * 0.09 + (vnoise(i * 0.2, y * 0.3, 7105.0) - 0.5) * 0.04;
                if cr < 0.06 { v *= 0.45; } else if cr < 0.12 { v += 0.035; }
                let rim = pow(clamp(1.0 - (e - y) / 10.0, 0.0, 1.0), 1.5); let nh = exp(-max(0.0, (i - hc).abs() - hw) / 5.0) * o.day * (if y < hole_bot(ii) + 3.0 { 1.0 } else { 0.4 });
                v += rim * (0.15 + l * 0.5) + nh * 0.32;
                put(d, lw, ii, y as i32, cvc(clamp(v, 0.0, 1.0), clamp(rim * l * 2.0 - nh * 1.6, -1.0, 1.0)));
            }
            y += 1.0;
        }
    }
}

// caveCeil 빛줄기: 구멍에서 바닥까지 비스듬히 4단계로 끊은 반투명 빛 (이미 그린 그림 위에)
pub fn shaft(d: &mut [u8], lw: i32, sh: f64, lc: [u8; 3], a0: f64) {
    let (t, b) = ([292.0, 330.0, 44.0], [252.0, 314.0, 192.0]);
    let mut y = t[2];
    while y < b[2] {
        let k = (y - t[2]) / (b[2] - t[2]); let l = t[0] + (b[0] - t[0]) * k + sh; let r = t[1] + (b[1] - t[1]) * k + sh;
        let mut i = l.floor();
        while i <= r.ceil() {
            let uu = (i - l) / (r - l); let e = clamp(min(uu, 1.0 - uu) / 0.18, 0.0, 1.0); let st = vnoise(uu * 6.5 - k * 1.2, k * 2.2, 7106.0);
            let a = round(a0 * e * (0.5 + 0.5 * st) * (1.0 - k * 0.3) / (a0 / 4.0)) * (a0 / 4.0);
            if a > 0.0 && i >= 0.0 && i < lw as f64 {
                let p = ((y as i32 * lw + i as i32) * 4) as usize;
                if p < d.len() { blend(d, p, lc, a); }
            }
            i += 1.0;
        }
        y += 1.0;
    }
}

// cavePassage: 오른쪽 끝 갈래 굴 — 안으로 갈수록 작아지며 어두워지는 아치 몇 겹 (d: 굴 둘레만 잘라 온 RGBA)
pub fn passage(d: &mut [u8], scr_w: f64) {
    let (cx, hw, top, bot) = (404.0, 28.0, 118.0, 183.0);
    let vx = cx - 6.0; let vy = bot - 26.0; let ay = top + hw;
    let ox = cx - hw - 5.0; let oy = top - 5.0; let w = min(scr_w - ox, hw * 2.0 + 10.0); let h = bot - top + 6.0;
    let inside = |i: f64, y: f64| { let dx = (i - cx) / hw; dx.abs() <= 1.0 && y < bot && y >= ay - (1.0 - dx * dx).sqrt() * (ay - top) };
    let sc = [1.0, 0.7, 0.48, 0.32, 0.2];
    let in_k = |i: f64, y: f64, k: usize| inside(vx + (i - vx) / sc[k], vy + (y - vy) / sc[k]);
    let wi = w as i32;
    for yy in 0..h as i32 { for ii in 0..wi {
        let i = ox + ii as f64; let y = oy + yy as f64;
        if !inside(i, y) {   // 입구 테두리: 왼쪽은 등불빛, 오른쪽은 그늘
            if [(-1.0, 0.0), (1.0, 0.0), (0.0, -1.0), (-2.0, 0.0), (2.0, 0.0), (0.0, -2.0)].iter().any(|&(a, b)| inside(i + a, y + b)) {
                let (l, _) = light(i, y, 1.0);
                put(d, wi, ii, yy, cvc(if i < cx { 0.36 + l * 0.4 } else { 0.16 }, if i < cx { clamp(l * 1.6, 0.0, 1.0) } else { 0.0 }));
            }
            continue;
        }
        let mut k = 0; while k < sc.len() - 1 && in_k(i, y, k + 1) { k += 1; }
        let edge_l = !in_k(i - 1.0, y, k) || !in_k(i - 2.0, y, k); let edge_t = !in_k(i, y - 1.0, k); let fl = y > vy + (bot - vy) * sc[k] - 3.0;
        let mut v = [0.27, 0.2, 0.14, 0.09, 0.06][k] + (vnoise(i * 0.2, y * 0.2, 7051.0) - 0.5) * 0.04;
        if fl { v += 0.06; }
        if edge_l && i > vx - 2.0 { v -= 0.05; } else if edge_l || edge_t { v += 0.07 * (1.0 - k as f64 * 0.18); }
        let ed = hypot((i - vx) / (hw * 0.32), (y - vy - 6.0) / (hw * 0.28)); let end = if ed < 1.0 { if ed < 0.5 { 0.16 } else { 0.09 } } else { 0.0 };
        put(d, wi, ii, yy, cvc(clamp(v + end, 0.0, 1.0), clamp(0.45 - k as f64 * 0.08 + end * 4.0, 0.0, 1.0)));
    } }
}
