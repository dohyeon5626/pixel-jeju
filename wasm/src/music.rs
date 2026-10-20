// 배경음악 작곡 (원래 audio.js): 곡마다 5음계 동기(모티프)를 시드로 만들어 A · A' · B · 쉼 · C 로 엮음
//  여기서는 8분음표 한 칸에 낼 음 · 드럼을 "음표 목록"으로만 정하고, 소리는 JS(Web Audio)가 냄
//  음표 한 개 = 9칸: [종류(0 음 · 1 잡음), f, f2, 길이, 파형/필터, 세기, 시작(칸 기준 초), 버스, det/q]
use crate::js::*;

#[derive(Clone, Copy, PartialEq)]
enum Groove {
    Calm,
    Pop,
    Shuffle,
    Halftime,
    Drive,
    Lofi,
    Janggu,
    Taiko,
}
#[derive(Clone, Copy, PartialEq)]
enum Lead {
    Triangle,
    P25,
    P12,
    Pluck,
}
struct Song {
    root: f64,
    minor: bool,
    prog: [f64; 4],
    seed: u32,
    groove: Groove,
    lead: Lead,
}
const MAJ: [f64; 5] = [0.0, 2.0, 4.0, 7.0, 9.0];
const MIN: [f64; 5] = [0.0, 3.0, 5.0, 7.0, 10.0];
// 곡 번호는 audio.js SONG_KEYS와 같은 순서 (title · field · coast · beach · night · lofi · myth · grove · iho · cave · falls · taiko · nightsea · stars)
const SONGS: [Song; 14] = [
    Song { root: 57.0, minor: false, prog: [0.0, 9.0, 5.0, 7.0], seed: 3, groove: Groove::Calm, lead: Lead::Triangle },
    Song { root: 57.0, minor: false, prog: [0.0, 9.0, 5.0, 7.0], seed: 11, groove: Groove::Pop, lead: Lead::P25 }, // 구좌 밭담길: 밝은 장5음계
    Song { root: 55.0, minor: false, prog: [0.0, 5.0, 9.0, 7.0], seed: 23, groove: Groove::Shuffle, lead: Lead::P25 }, // 성산 앞바다: 출렁이는 셔플
    Song { root: 53.0, minor: true, prog: [0.0, 8.0, 3.0, 10.0], seed: 37, groove: Groove::Halftime, lead: Lead::Triangle }, // 협재 노을: 느긋한 하프타임
    Song { root: 52.0, minor: true, prog: [0.0, 8.0, 10.0, 7.0], seed: 51, groove: Groove::Drive, lead: Lead::P25 }, // 불의 밤: 달리는 단조
    Song { root: 55.0, minor: true, prog: [0.0, 5.0, 3.0, 7.0], seed: 61, groove: Groove::Lofi, lead: Lead::Triangle }, // 뭐랭하멘 방송
    Song { root: 50.0, minor: true, prog: [0.0, 0.0, 10.0, 7.0], seed: 71, groove: Groove::Janggu, lead: Lead::Pluck }, // 설문대할망: 장구 굿거리
    Song { root: 59.0, minor: false, prog: [0.0, 7.0, 9.0, 5.0], seed: 91, groove: Groove::Pop, lead: Lead::Triangle }, // 귤밭: 따스한 장조
    Song { root: 54.0, minor: false, prog: [0.0, 9.0, 7.0, 5.0], seed: 97, groove: Groove::Shuffle, lead: Lead::P25 }, // 이호테우: 바닷바람 셔플
    Song { root: 49.0, minor: true, prog: [0.0, 10.0, 8.0, 7.0], seed: 103, groove: Groove::Halftime, lead: Lead::Pluck }, // 만장굴: 울리는 단조
    Song { root: 56.0, minor: false, prog: [0.0, 5.0, 7.0, 9.0], seed: 109, groove: Groove::Halftime, lead: Lead::Triangle }, // 폭포: 시원하게 흐르는
    Song { root: 52.0, minor: true, prog: [0.0, 3.0, 0.0, 10.0], seed: 83, groove: Groove::Taiko, lead: Lead::P12 }, // 칼 든 하르방: 북 난타
    Song { root: 50.0, minor: true, prog: [0.0, 5.0, 8.0, 7.0], seed: 117, groove: Groove::Shuffle, lead: Lead::P25 }, // 밤바다: 출렁이는 단조 셔플
    Song { root: 54.0, minor: true, prog: [0.0, 8.0, 3.0, 7.0], seed: 127, groove: Groove::Drive, lead: Lead::Pluck }, // 별밤 · 달밤 폭포: 반짝이는 단조
];
const ARR: [&str; 6] = ["A", "A2", "B", "A", "C", "B2"]; // 구간 순서 (한 구간 = 4마디)

// 파형 · 필터 · 버스 번호 (audio.js와 같은 순서)
//  파형: 0 square · 1 triangle · 2 sine · 3 sawtooth · 4 p25 · 5 p12 / 필터: 0 lowpass · 1 bandpass · 2 highpass
const TRI: f64 = 1.0;
const SINE: f64 = 2.0;
const SAW: f64 = 3.0;
const P25: f64 = 4.0;
const P12: f64 = 5.0;
const BAND: f64 = 1.0;
const HIGH: f64 = 2.0;
const BUS: f64 = 0.0;
const BUS_L: f64 = 1.0;
const BUS_R: f64 = 2.0;

fn n2f(n: f64) -> f64 {
    440.0 * pow(2.0, (n - 69.0) / 12.0)
}

// 한 프레이즈 = 32칸(8분음표, 4마디): 모티프 · 변주 · 모티프 · 맺음 (0은 쉼)
fn phrase(s: &Song, seed: u32, lift: f64) -> [f64; 32] {
    let mut r = crate::noise::Rng::new(seed);
    let sc = if s.minor { MIN } else { MAJ };
    let mut motif: [Option<f64>; 8] = [None; 8];
    let mut d = 2.0 + lift;
    for (i, slot) in motif.iter_mut().enumerate() {
        if i > 0 && r.next() < if i % 2 == 1 { 0.45 } else { 0.18 } {
            continue;
        }
        let step = if r.next() < 0.7 {
            if r.next() < 0.5 {
                -1.0
            } else {
                1.0
            }
        } else {
            (r.next() * 7.0).floor() - 1.0
        };
        d = max(0.0, min(6.0, d + step));
        *slot = Some(d);
    }
    let shift = if r.next() < 0.5 { 1.0 } else { 2.0 };
    let mut out = [0.0; 32];
    for b in 0..4 {
        for i in 0..8 {
            let mut v = motif[i];
            if b == 1 {
                v = v.map(|x| x + shift);
            }
            if b == 3 {
                v = match i {
                    0..=3 => motif[i].map(|x| max(0.0, x - 1.0)),
                    4 => Some(lift),
                    _ => None,
                };
            } // 맺음: 으뜸음으로 내려앉음
            out[b * 8 + i] = match v.map(|x| min(8.0, x)) {
                Some(v) => s.root + 12.0 + sc[v as usize % 5] + 12.0 * (v / 5.0).floor(),
                None => 0.0,
            }; // 너무 높아 귀가 따갑지 않게
        }
    }
    out
}

// 지금 곡의 세 프레이즈 (A · B · C) + 첫 화면 곡 · 이번 칸의 음표 목록
struct State {
    song: usize,
    a: [f64; 32],
    b: [f64; 32],
    c: [f64; 32],
    title: [f64; 32],
    ev: Vec<f64>,
}
fn phrases(k: usize) -> ([f64; 32], [f64; 32], [f64; 32]) {
    let s = &SONGS[k];
    (phrase(s, s.seed, 0.0), phrase(s, s.seed + 7, 2.0), phrase(s, s.seed + 13, 1.0))
}
static mut ST: Option<State> = None;
fn st() -> &'static mut State {
    unsafe {
        let slot = &mut *std::ptr::addr_of_mut!(ST);
        slot.get_or_insert_with(|| {
            let (a, b, c) = phrases(1);
            State { song: 1, a, b, c, title: phrase(&SONGS[0], SONGS[0].seed, 0.0), ev: vec![] }
        })
    }
}
// 곡 바꾸기 (모르는 곡은 밭 노래)
pub fn set_song(k: usize) {
    let k = if k < SONGS.len() { k } else { 1 };
    let (a, b, c) = phrases(k);
    let t = st();
    t.song = k;
    t.a = a;
    t.b = b;
    t.c = c;
}
pub fn events() -> &'static [f64] {
    &st().ev
}

fn tone(f: f64, f2: f64, d: f64, wave: f64, v: f64, at: f64, bus: f64, det: f64) {
    st().ev.extend_from_slice(&[0.0, f, f2, d, wave, v, at, bus, det]);
}
fn noise(d: f64, v: f64, ft: f64, f: f64, f2: f64, q: f64, at: f64, bus: f64) {
    st().ev.extend_from_slice(&[1.0, f, f2, d, ft, v, at, bus, q]);
}
fn kick(at: f64, v: f64) {
    tone(150.0, 40.0, 0.12, SINE, v, at, BUS, 0.0);
    noise(0.012, v * 0.25, HIGH, 3000.0, 0.0, 1.0, at, BUS);
} // 딸깍 하는 머리 소리로 또렷하게
fn snare(at: f64, v: f64) {
    noise(0.08, v, BAND, 1800.0, 0.0, 1.0, at, BUS);
    tone(200.0, 140.0, 0.05, TRI, v * 0.6, at, BUS, 0.0);
} // 몸통 소리
fn hat(at: f64, v: f64) {
    noise(0.03, v, HIGH, 7000.0, 0.0, 1.0, at, BUS_R);
}
fn drums(g: Groove, k: i64, bar: i64, sec: char, at: f64, e: f64, fill: bool) {
    if fill && bar == 3 && k >= 4 {
        snare(at, 0.12 + (k - 4) as f64 * 0.05);
        if k % 2 == 1 {
            snare(at + e / 2.0, 0.1);
        }
        return;
    } // 4마디마다 스네어 롤
    match g {
        Groove::Pop => {
            if k == 0 || k == 4 || (k == 7 && sec == 'B') {
                kick(at, 0.6);
            }
            if k == 2 || k == 6 {
                snare(at, 0.22);
            }
            if k % 2 == 1 || sec == 'B' {
                hat(at, if k % 2 == 1 { 0.1 } else { 0.06 });
            }
        }
        Groove::Shuffle => {
            if k == 0 || k == 5 {
                kick(at, 0.6);
            }
            if k == 2 || k == 6 {
                snare(at, 0.22);
            }
            hat(at + if k % 2 == 1 { e * 0.25 } else { 0.0 }, if k % 2 == 1 { 0.08 } else { 0.11 });
        }
        Groove::Halftime => {
            if k == 0 || (k == 3 && bar % 2 == 1) {
                kick(at, 0.6);
            }
            if k == 4 {
                snare(at, 0.26);
            }
            if k % 2 == 0 {
                hat(at, 0.07);
            }
        }
        Groove::Drive => {
            if k % 2 == 0 {
                kick(at, if k % 4 == 0 { 0.65 } else { 0.4 });
            }
            if k == 2 || k == 6 {
                snare(at, 0.25);
            }
            hat(at, 0.09);
        }
        Groove::Lofi => {
            if k == 0 || k == 5 {
                kick(at, 0.5);
            }
            if k == 4 {
                snare(at, 0.16);
            }
            if k % 2 == 0 {
                hat(at + e * 0.18, 0.05);
            }
            if k == 0 {
                noise(e * 8.0, 0.02, BAND, 3000.0, 0.0, 0.5, at, BUS);
            }
        }
        Groove::Janggu => {
            if k == 0 || k == 3 {
                tone(110.0, 70.0, 0.18, SINE, 0.55, at, BUS, 0.0);
            }
            if k == 2 || k == 5 || k == 7 {
                noise(0.05, 0.2, BAND, 2600.0, 0.0, 2.0, at, BUS);
            }
            if k == 6 {
                tone(180.0, 130.0, 0.1, TRI, 0.3, at, BUS, 0.0);
            }
        }
        Groove::Taiko => {
            if k % 2 == 0 || (k == 7 && bar % 2 == 1) {
                tone(95.0, 50.0, 0.2, SINE, if k == 0 { 0.8 } else { 0.5 }, at, BUS, 0.0);
            }
            if k == 3 || k == 7 {
                noise(0.06, 0.25, BAND, 1200.0, 0.0, 1.5, at, BUS);
            }
        }
        Groove::Calm => {
            if k == 0 && bar % 2 == 0 {
                kick(at, 0.25);
            }
        }
    }
}

// 붐뱁 힙합 비트 (할망 랩 타임) — 판마다 드럼 · 베이스 변주
struct Hip {
    kick: &'static [i64],
    snare: &'static [i64],
    roots: [f64; 4],
}
const HIP: [Hip; 3] = [
    Hip { kick: &[0, 3], snare: &[2, 6], roots: [45.0, 45.0, 38.0, 40.0] },
    Hip { kick: &[0, 3, 4], snare: &[2, 6], roots: [45.0, 43.0, 41.0, 40.0] },
    Hip { kick: &[0, 5], snare: &[2, 6, 7], roots: [45.0, 48.0, 43.0, 41.0] },
];
fn hiphop(s: i64, tempo: f64, var: usize) {
    let e = 60.0 / tempo / 2.0;
    let k = s % 8;
    let bar = (s / 8) % 4;
    let h = &HIP[var % HIP.len()];
    let at = if k % 2 == 1 { e * 0.22 } else { 0.0 }; // 스윙
    if h.kick.contains(&k) || (k == 5 && bar == 3) {
        tone(120.0, 38.0, 0.22, SINE, 0.85, at, BUS, 0.0);
        noise(0.012, 0.2, HIGH, 3000.0, 0.0, 1.0, at, BUS);
    }
    if h.snare.contains(&k) {
        noise(0.16, 0.42, BAND, 1600.0, 0.0, 0.8, at, BUS);
        tone(190.0, 120.0, 0.08, TRI, 0.3, at, BUS, 0.0);
    }
    noise(if k % 2 == 1 { 0.025 } else { 0.04 }, if k % 2 == 1 { 0.07 } else { 0.12 }, HIGH, 8000.0, 0.0, 1.0, at, BUS);
    let root = h.roots[bar as usize];
    if k == 0 || k == 3 {
        tone(n2f(root - 12.0), 0.0, e * 2.2, SINE, 0.55, at, BUS, 0.0);
    }
    if k == 1 || k == 5 {
        for iv in [0.0, 3.0, 7.0, 10.0] {
            tone(n2f(root + 12.0 + iv), 0.0, e * 0.9, TRI, 0.07, at, BUS, 0.0);
        }
    }
    if bar == 3 && k == 7 {
        noise(0.12, 0.2, BAND, 2600.0, 500.0, 3.0, at, BUS);
        tone(800.0, 220.0, 0.1, SAW, 0.06, at, BUS, 0.0);
    }
}

// 8분음표 한 칸(s)의 음표들 → events()
pub fn step(s: i64, tempo: f64, calm: bool, hip: bool, key: f64, varied: bool, accent: bool, hip_var: usize) {
    st().ev.clear();
    if hip {
        hiphop(s, tempo, hip_var);
        return;
    }
    let e = 60.0 / tempo / 2.0;
    let at = 0.0;
    let sec_idx = ((s / 32) % ARR.len() as i64) as usize;
    let sec0 = if calm { "A" } else { ARR[sec_idx] };
    let sec = sec0.as_bytes()[0] as char;
    let pos = (s % 32) as usize;
    let k = s % 8;
    let bar = (pos / 8) as i64;
    let tr = if calm {
        0.0
    } else {
        key + if varied && sec == 'B' {
            if key >= 5.0 {
                -7.0
            } else {
                5.0
            }
        } else {
            0.0
        }
    };
    let (sg, m0) = {
        let t = st();
        (
            if calm { &SONGS[0] } else { &SONGS[t.song] },
            if calm {
                t.title[pos]
            } else {
                match sec {
                    'B' => t.b[pos],
                    'C' => t.c[pos],
                    _ => t.a[pos],
                }
            },
        )
    }; // 상태는 여기서만 읽고 놓음 (아래 tone이 음표를 쌓음)
    let r = sg.root - 12.0 + sg.prog[(bar % 4) as usize] + tr;
    // 멜로디 (C 구간은 비우고 반주만 · A2/B2는 한 옥타브 위 대선율이 따라옴)
    if m0 != 0.0 && sec != 'C' {
        let f = n2f(m0 + tr);
        let pluck = sg.lead == Lead::Pluck;
        let wave = match sg.lead {
            Lead::P25 => P25,
            Lead::P12 => P12,
            _ => TRI,
        };
        if calm {
            if s % 2 == 0 {
                tone(f, 0.0, e * 1.6, TRI, 0.28, at, BUS, 0.0);
            }
        } else {
            tone(
                f,
                if pluck { f * 0.985 } else { 0.0 },
                if pluck { e * 0.7 } else { e * 0.9 },
                wave,
                if wave == TRI { 0.3 } else { 0.2 },
                at,
                BUS_L,
                0.0,
            );
            if wave != TRI {
                tone(f, 0.0, e * 0.85, wave, 0.08, at, BUS_R, 11.0);
            } // 코러스: 살짝 어긋난 두 번째 소리를 오른쪽에
            tone(f, 0.0, e * 0.5, wave, 0.06, at + e * 1.5, BUS_R, 0.0); // 메아리
            if sec == 'B' && k % 2 == 0 {
                tone(f * if sg.minor { 1.189 } else { 1.26 }, 0.0, e * 0.8, P12, 0.05, at, BUS_L, 0.0);
            } // B: 3도 위 화음
            if sec0.len() > 1 && k % 2 == 0 && m0 + tr <= 84.0 {
                tone(f * 2.0, 0.0, e * 0.6, P12, 0.06, at, BUS_R, 0.0);
            }
        }
    }
    // 화음 패드: 마디 머리에 깔리는 은은한 3화음 (구간 C는 더 길고 크게)
    if !calm && k == 0 {
        let third = if sg.minor { 3.0 } else { 4.0 };
        for iv in [0.0, third, 7.0] {
            tone(n2f(r + 24.0 + iv), 0.0, e * 7.5, TRI, if sec == 'C' { 0.05 } else { 0.03 }, at, BUS, 0.0);
        }
    }
    // 다음 구간으로 넘어가기 직전 마디: 차오르는 소리
    let next_sec = ARR[(sec_idx + 1) % ARR.len()].as_bytes()[0] as char;
    if !calm && pos == 24 && next_sec != sec {
        noise(e * 8.0, 0.06, BAND, 500.0, 5000.0, 2.0, at, BUS);
    }
    // 구간 머리: B로 들어가면 "드롭" — 묵직한 서브 + 심벌
    if !calm && pos == 0 && sec == 'B' {
        tone(70.0, 32.0, 0.6, SINE, 0.6, at, BUS, 0.0);
        noise(0.8, 0.12, HIGH, 4000.0, 0.0, 1.0, at, BUS);
    }
    // 베이스: 구간마다 걷는 모양이 다름
    let bass = match sec {
        'B' => [0.0, 12.0, 7.0, 12.0],
        'C' => [0.0, 0.0, 7.0, 5.0],
        _ => [0.0, 12.0, 0.0, 7.0],
    };
    if k % 2 == 0 {
        tone(n2f(r + bass[((k >> 1) % 4) as usize]), 0.0, e * 0.95, TRI, if calm { 0.3 } else { 0.45 }, at, BUS, 0.0);
    } else if !calm && sec == 'B' && (k == 3 || k == 7) {
        tone(n2f(r + 12.0), 0.0, e * 0.4, TRI, 0.25, at, BUS, 0.0);
    } // B: 엇박 베이스로 들썩이게
      // 아르페지오 (C · B2 구간)
    if !calm && (sec == 'C' || sec0 == "B2") {
        let iv = (if sg.minor { [0.0, 3.0, 7.0, 12.0] } else { [0.0, 4.0, 7.0, 12.0] })[(k % 4) as usize];
        tone(n2f(r + 24.0 + iv), 0.0, e * 0.4, P12, 0.07, at, BUS_R, 0.0);
    }
    if !calm && pos == 0 && sec_idx % 2 == 0 {
        noise(0.5, 0.08, HIGH, 5000.0, 0.0, 1.0, at, BUS);
    } // 구간 시작 심벌
    drums(if calm { Groove::Calm } else { sg.groove }, k, bar, sec, at, e, !calm && sec != 'C');
    if accent && !calm {
        hat(at + e / 2.0, 0.06);
    } // 박자 콤보가 붙으면 16분 하이햇이 더해져 음악이 "맞물림"
}
