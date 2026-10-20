// 글자 스프라이트 (art.js textSprite · wordSprite): 1px fillRect를 수천 번 쌓는 대신 RGBA를 바로 칠함
//  src: 글자 알파 (w * h) · 색은 불투명 RGB만 (반투명 색은 JS가 원래대로 그림)
fn on(a: &[u8], w: i32, h: i32, i: i32, j: i32, thr: u8) -> bool {
    i >= 0 && j >= 0 && i < w && j < h && a[(j * w + i) as usize] > thr
}
fn set(d: &mut [u8], ow: i32, i: i32, j: i32, c: [u8; 3]) {
    let oh = d.len() as i32 / 4 / ow;
    if i < 0 || j < 0 || i >= ow || j >= oh {
        return;
    }
    let p = ((j * ow + i) * 4) as usize;
    d[p] = c[0];
    d[p + 1] = c[1];
    d[p + 2] = c[2];
    d[p + 3] = 255;
}

// textSprite: 먹선(+ 아래 그림자) · 글자 색 · 다듬을 경계 상자 (bb: x0 · y0 · x1 · y1, 없으면 x1 = -1)
#[allow(clippy::too_many_arguments)]
pub fn sprite(a: &[u8], w: i32, h: i32, d: &mut [u8], ow: i32, outline: Option<[u8; 3]>, shadow: bool, fill: [u8; 3], bb: &mut [i32]) {
    d.fill(0);
    let o = |i, j| on(a, w, h, i, j, 110);
    let pad = outline.is_some() as i32;
    if let Some(oc) = outline {
        for j in -1..=h {
            for i in -1..=w {
                if !o(i, j)
                    && (o(i - 1, j)
                        || o(i + 1, j)
                        || o(i, j - 1)
                        || o(i, j + 1)
                        || (shadow && (o(i, j - 2) || o(i - 1, j - 2) || o(i + 1, j - 2))))
                {
                    set(d, ow, i + pad, j + pad, oc);
                }
            }
        }
    }
    for j in 0..h {
        for i in 0..w {
            if o(i, j) {
                set(d, ow, i + pad, j + pad, fill);
            }
        }
    }
    let oh = d.len() as i32 / 4 / ow;
    let (mut x0, mut y0, mut x1, mut y1) = (ow, oh, -1, -1);
    for j in 0..oh {
        for i in 0..ow {
            if d[((j * ow + i) * 4 + 3) as usize] != 0 {
                x0 = x0.min(i);
                x1 = x1.max(i);
                y0 = y0.min(j);
                y1 = y1.max(j);
            }
        }
    }
    bb.copy_from_slice(&[x0, y0, x1, y1]);
}

// wordSprite: 날아오는 말 글자 — 두꺼운 먹선 · 아래 그림자 · 아래 두 줄은 먹빛을 섞음 (출력 (w + 4) × (h + 6))
#[allow(clippy::too_many_arguments)]
pub fn word(a: &[u8], w: i32, h: i32, d: &mut [u8], edge: [u8; 3], shade: [u8; 3], col: [u8; 3], low: [u8; 3]) {
    d.fill(0);
    let o = |i, j| on(a, w, h, i, j, 0);
    let ow = w + 4;
    for j in -2..h + 4 {
        for i in -2..w + 2 {
            let ring = o(i, j) || o(i - 1, j) || o(i + 1, j) || o(i, j - 1) || o(i, j + 1);
            if ring {
                set(d, ow, i + 2, j + 2, edge);
            } else if o(i, j - 2) {
                set(d, ow, i + 2, j + 2, shade);
            }
        }
    }
    for j in 0..h {
        for i in 0..w {
            if o(i, j) {
                set(d, ow, i + 2, j + 2, if j > h - 3 { low } else { col });
            }
        }
    }
}

// 알파가 thr보다 큰 칸 → 1 (cvMask · 아래아 글자 이진화)
pub fn mask(d: &[u8], thr: u8, m: &mut [u8]) {
    for (q, v) in m.iter_mut().enumerate() {
        *v = (d[q * 4 + 3] > thr) as u8;
    }
}

// 1인 칸만 색칠 (아래아 글자를 먹색으로 찍기)
pub fn paint(m: &[u8], c: [u8; 3], d: &mut [u8]) {
    d.fill(0);
    for (q, &v) in m.iter().enumerate() {
        if v != 0 {
            d[q * 4] = c[0];
            d[q * 4 + 1] = c[1];
            d[q * 4 + 2] = c[2];
            d[q * 4 + 3] = 255;
        }
    }
}
