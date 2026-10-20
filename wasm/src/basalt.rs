// 현무암 주상절리 픽셀 (scn_place의 basalt_wall이 부름) — 다각형 마스크 안만 칠함
//  원래 JS처럼 i가 캔버스 밖이어도 평평한 인덱스(y * w + i)로 다룸 (옆 줄로 넘어가는 것까지 같게)
use crate::js::*;
use crate::noise::*;
use crate::scene::Col;

// 램프 (그늘 → 빛) · 꼭대기 들쭉날쭉한 정도 · 이끼 문턱(0이면 이끼 없음)과 이끼 두 색
pub struct Opt<'a> {
    pub ramp: &'a [Col],
    pub rag: f64,
    pub moss: f64,
    pub moss_cols: [Col; 2],
}

// 기둥 하나: 자리 · 폭 · 빛 받는 면이 꺾이는 곳 · 밝기 · 마디 길이들 · 마디 시작 · 기울기 · 꼭대기 높이
struct Column {
    x: f64,
    w: f64,
    ridge: f64,
    tone: f64,
    seg: [f64; 14],
    off: f64,
    slant: f64,
    top_off: f64,
}

#[allow(clippy::too_many_arguments)]
pub fn wall(md: &[u8], d: &mut [u8], w: i32, h: i32, x0: i32, x1: i32, y_top: f64, y_bot: f64, seed: f64, wxv: &[f64], o: &Opt) {
    let mut r = Rng::new(seed as u32);
    let ramp = o.ramp;
    let wx = |i: i32| wxv[(i - x0) as usize];
    let wx0 = min(wx(x0), wx(x1)).floor();
    let wx1 = max(wx(x0), wx(x1)).ceil();
    let mut cols = vec![];
    let mut i = wx0 - 30.0;
    while i < wx1 + 30.0 {
        let cw = 6.0 + (r.next() * 10.0).floor();
        let ridge = 0.3 + r.next() * 0.35;
        let tone = (r.next() - 0.5) * 0.1;
        let mut seg = [0.0; 14];
        for s in seg.iter_mut() {
            *s = 8.0 + r.next() * 18.0;
        }
        let off = r.next() * 20.0;
        let slant = (r.next() - 0.5) * 5.0;
        let top_off = (r.next() * o.rag).floor();
        cols.push(Column { x: i, w: cw, ridge, tone, seg, off, slant, top_off });
        i += cw;
    }
    let mut top_y = vec![9999i32; w as usize];
    for i in 0..w {
        for y in 0..h {
            if md[(y * w + i) as usize] > 127 {
                top_y[i as usize] = y;
                break;
            }
        }
    }
    let n = w * h;
    for yy in 0..h {
        for ii in x0..x1 {
            let pi = yy * w + ii;
            if pi < 0 || pi >= n {
                continue;
            } // JS에선 범위 밖 읽기 · 쓰기가 아무 일도 안 함
            let p = pi as usize;
            if md[p] < 128 {
                continue;
            }
            let (i, y) = (ii as f64, yy as f64);
            let iw = wx(ii) + (vnoise(i * 0.05, y * 0.025, seed + 7.0) - 0.5) * 8.0 + sin(y * 0.035 + i * 0.02) * 1.5;
            let mut ci = 0;
            while ci < cols.len() - 1 && iw >= cols[ci].x + cols[ci].w {
                ci += 1;
            }
            let col = &cols[ci];
            let u = clamp((iw - col.x) / col.w, 0.0, 0.999);
            if ii >= 0
                && ii < w
                && y < top_y[ii as usize] as f64 + col.top_off * (0.4 + 0.6 * (1.0 - sin(u * PI))) + (1.0 - sin(u * PI)) * 2.0
            {
                continue;
            }
            let mut sy = y + col.off + (u - 0.5) * col.slant + sin(u * PI) * 1.6;
            let mut si = 0;
            while si < 13 && sy > col.seg[si] {
                sy -= col.seg[si];
                si += 1;
            }
            let seg_t = sy / col.seg[si];
            let seg_tone = (hash2(col.x, si as f64, seed) - 0.5) * 0.12;
            let rr = col.ridge;
            let face = if u < rr - 0.06 {
                0.62 - u * 0.14
            } else if u > rr + 0.06 {
                0.36 - (u - rr) * 0.22
            } else {
                0.5 - (u - rr) * 1.1
            };
            let mut v =
                face + col.tone + seg_tone + (vnoise(i * 0.3, y * 0.3, seed + 1.0) - 0.5) * 0.2 + (hash2(i, y, seed + 2.0) - 0.5) * 0.06;
            v -= clamp((y - y_top) / (y_bot - y_top), 0.0, 1.0) * 0.18;
            let edge_u = min(u, 1.0 - u);
            let edge_s = min(seg_t, 1.0 - seg_t) * col.seg[si];
            if edge_u * col.w < 0.8 {
                v = 0.1 + vnoise(i, y * 0.2, seed + 8.0) * 0.08;
            } else if edge_s < 0.9 {
                v = 0.12;
            } else {
                let cr = hypot(max(0.0, 2.5 - edge_u * col.w), max(0.0, 2.5 - edge_s));
                if cr > 0.0 {
                    v -= cr * 0.07;
                }
                if seg_t < 0.2 && u < rr {
                    v += 0.08;
                }
            }
            if hash2(col.x, si as f64, seed + 3.0) < 0.06 {
                v -= 0.18;
            }
            if o.moss != 0.0
                && vnoise(i * 0.09, y * 0.035, seed + 4.0) > o.moss
                && hash2((ii >> 1) as f64, (yy >> 1) as f64, seed + 9.0) < 0.8
            {
                let m = o.moss_cols[if hash2(i, y, seed + 5.0) < 0.5 { 0 } else { 1 }];
                d[p * 4..p * 4 + 3].copy_from_slice(&m);
                d[p * 4 + 3] = 255;
                continue;
            }
            let k = clamp(v, 0.0, 0.999) * (ramp.len() - 1) as f64;
            let a = k.floor();
            let t = k - a;
            let c0 = ramp[a as usize];
            let c1 = ramp[(ramp.len() - 1).min(a as usize + 1)];
            let mixv = if t > 0.66 {
                true
            } else if t > 0.33 {
                hash2((ii >> 1) as f64, y, seed + 6.0) < 0.5
            } else {
                false
            };
            let c = if mixv { c1 } else { c0 };
            d[p * 4] = c[0];
            d[p * 4 + 1] = c[1];
            d[p * 4 + 2] = c[2];
            d[p * 4 + 3] = 255;
        }
    }
}
