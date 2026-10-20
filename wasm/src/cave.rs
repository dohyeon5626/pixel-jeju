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
