// 효과음 (원래 audio.js sfx): 효과음마다 무엇을 낼지 · 너무 잦으면 건너뛰기
//  소리는 JS(Sound.toneN · noiseN, WebAudio)가 냄 — 부르는 그 자리에서 바로 불러 Math.random 순서까지 원래와 같음
use crate::game::random;
use crate::js::{min, pow};

#[link(wasm_import_module = "g")]
extern "C" {
    fn jtone(f: f64, f2: f64, d: f64, w: f64, v: f64, at: f64, vib: f64, exact: f64);
    fn jnoise(d: f64, v: f64, ft: f64, f: f64, f2: f64, q: f64, at: f64);
}

// 이름 목록 (JS가 처음에 받아 Sound.sfx[이름]을 만듦)
pub const NAMES: [&str; 61] = [
    "jump", "roll", "land", "hurt", "dodge", "pickup", "heal", "crack", "rise", "hop", "buzz", "zap", "boom", "erupt", "launch", "whoosh",
    "chirp", "gust", "neigh", "gallop", "babble", "pop", "burst", "rumble", "grind", "drip", "letter", "level", "start", "over", "select",
    "djump", "throw", "splat", "hit", "tink", "stomp", "shatter", "combo", "empty", "alarm", "block", "equip", "bag", "lowhp", "siren",
    "wave", "clear", "quiz", "card", "wow", "oink", "shutter", "thunder", "caw", "splash", "gull", "honk", "stab", "thud", "rise2",
];

// 파형 · 필터 (audio.js WAVES · FILTERS 순서)
#[derive(Clone, Copy)]
enum W {
    Square,
    Triangle,
    Sine,
    Saw,
    P25,
    P12,
}
#[derive(Clone, Copy)]
enum Ft {
    Low,
    Band,
    High,
}
use Ft::*;
use W::*;

// 음 하나 (원래 tone({...})의 기본값: 시작 0 · 떨림 0 · 미세 흔들기 켬)
struct Tone {
    f: f64,
    f2: f64,
    d: f64,
    w: W,
    v: f64,
    at: f64,
    vib: f64,
    exact: bool,
}
fn tone(f: f64, f2: f64, d: f64, w: W, v: f64) -> Tone {
    Tone { f, f2, d, w, v, at: 0.0, vib: 0.0, exact: false }
}
impl Tone {
    fn at(self, at: f64) -> Self {
        Tone { at, ..self }
    }
    fn vib(self, vib: f64) -> Self {
        Tone { vib, ..self }
    }
    // 미세하게 흔들지 않음 (음계가 정확해야 하는 소리)
    fn exact(self) -> Self {
        Tone { exact: true, ..self }
    }
    fn play(self) {
        unsafe { jtone(self.f, self.f2, self.d, self.w as i32 as f64, self.v, self.at, self.vib, self.exact as i32 as f64) }
    }
}
// 잡음 하나 (필터 통과)
struct Noise {
    d: f64,
    v: f64,
    ft: Ft,
    f: f64,
    f2: f64,
    q: f64,
    at: f64,
}
fn noise(d: f64, v: f64, ft: Ft, f: f64, f2: f64, q: f64) -> Noise {
    Noise { d, v, ft, f, f2, q, at: 0.0 }
}
// 원래 noise({ d, v, f })처럼 저역 통과 · 끝 주파수 없음 · q 1
fn low(d: f64, v: f64, f: f64) -> Noise {
    noise(d, v, Low, f, 0.0, 1.0)
}
impl Noise {
    fn at(self, at: f64) -> Self {
        Noise { at, ..self }
    }
    fn play(self) {
        unsafe { jnoise(self.d, self.v, self.ft as i32 as f64, self.f, self.f2, self.q, self.at) }
    }
}
// 음계를 차례로 (아르페지오): i번째 음은 i * gap초 뒤
fn arp(fs: &[f64], d: f64, w: W, v: f64, gap: f64) {
    for (i, &f) in fs.iter().enumerate() {
        tone(f, 0.0, d, w, v).at(i as f64 * gap).play();
    }
}

// 너무 잦으면 건너뛰기: 같은 효과음을 ms 안에 또 내면 true (원래 throttle)
static mut LAST: [f64; NAMES.len()] = [0.0; NAMES.len()];
fn throttled(id: usize, ms: f64, now: f64) -> bool {
    let last = unsafe { &mut *std::ptr::addr_of_mut!(LAST) };
    if now - last[id] < ms {
        return true;
    }
    last[id] = now;
    false
}
// 원래 n2f: 미디 음 번호 → 주파수
fn n2f(n: f64) -> f64 {
    440.0 * pow(2.0, (n - 69.0) / 12.0)
}

// 효과음 하나 내기 · a · b: 강세(0 · 1) · 번호 같은 인자 (babble은 글자 수 · 크게), now: performance.now()
pub fn play(id: usize, a: f64, b: f64, now: f64) {
    let thr = |ms: f64| throttled(id, ms, now);
    match NAMES[id] {
        "jump" => {
            tone(280.0, 620.0, 0.12, P25, 0.22).play();
            noise(0.1, 0.05, Band, 1200.0, 2800.0, 1.5).play();
        }
        "roll" => {
            noise(0.18, 0.25, Band, 900.0, 300.0, 2.0).play();
            tone(160.0, 90.0, 0.12, Triangle, 0.25).play();
        }
        "land" => {
            if !thr(80.0) {
                low(0.06, 0.18, 600.0).play();
                tone(120.0, 60.0, 0.08, Sine, 0.16).play();
            }
        }
        "hurt" => {
            tone(520.0, 90.0, 0.32, Square, 0.25).play();
            noise(0.2, 0.3, Low, 3000.0, 400.0, 1.0).play();
        }
        "dodge" => {
            tone(1320.0, 0.0, 0.06, Triangle, 0.22).play();
            tone(1760.0, 0.0, 0.1, Triangle, 0.2).at(0.05).play();
        }
        "pickup" => {
            if !thr(60.0) {
                arp(&[988.0, 1319.0, 1568.0], 0.07, P25, 0.16, 0.045);
            }
        }
        "heal" => arp(&[523.0, 659.0, 784.0, 1047.0], 0.1, Triangle, 0.25, 0.07),
        "crack" => {
            if !thr(90.0) {
                noise(0.05, 0.15, High, 1500.0, 0.0, 1.0).play();
            }
        }
        "rise" => {
            if !thr(70.0) {
                noise(0.35, 0.45, Low, 700.0, 80.0, 1.0).play();
                tone(110.0, 45.0, 0.3, Square, 0.22).play();
            }
        }
        "hop" => {
            if !thr(60.0) {
                tone(220.0, 110.0, 0.08, Triangle, 0.22).play();
            }
        }
        "buzz" => {
            if !thr(300.0) {
                tone(220.0, 240.0, 0.12, Saw, 0.04).play();
            }
        }
        "zap" => tone(1200.0, 180.0, 0.18, Saw, 0.12).play(),
        "boom" => {
            if !thr(60.0) {
                noise(0.02, 0.2, Band, 2400.0, 0.0, 1.0).play();
                noise(0.6, 0.5, Low, 1600.0, 60.0, 1.0).play();
                noise(0.35, 0.12, High, 3000.0, 0.0, 1.0).at(0.05).play();
                tone(55.0, 28.0, 0.7, Sine, 0.35).play();
                tone(90.0, 30.0, 0.5, Sine, 0.5).play();
            }
        }
        "erupt" => {
            noise(1.8, 0.5, Low, 400.0, 50.0, 1.0).play();
            tone(60.0, 25.0, 1.6, Saw, 0.18).play();
        }
        "launch" => {
            if !thr(70.0) {
                tone(200.0, 900.0, 0.25, P12, 0.08).play();
            }
        }
        "whoosh" => {
            if !thr(80.0) {
                noise(0.35, 0.3, Band, 400.0, 2400.0, 3.0).play();
            }
        }
        // 참새: 짹짹
        "chirp" => {
            if !thr(120.0) {
                tone(3400.0, 4300.0, 0.05, Sine, 0.07).play();
                tone(3600.0, 4600.0, 0.05, Sine, 0.06).at(0.09).play();
            }
        }
        "gust" => {
            if !thr(200.0) {
                noise(0.3, 0.12, Band, 1800.0, 700.0, 4.0).play();
            }
        }
        "neigh" => tone(980.0, 520.0, 0.45, P25, 0.12).vib(60.0).play(),
        "gallop" => {
            if !thr(110.0) {
                low(0.04, 0.12, 500.0).play();
                low(0.04, 0.1, 500.0).at(0.06).play();
            }
        }
        // 할망 목소리: 글자 수(a, 최대 10)만큼 옹알옹알 (동물의 숲 풍), b: 크게
        "babble" => {
            let big = b != 0.0;
            let base = if big { 260.0 } else { 330.0 };
            for i in 0..a as usize {
                let f = base * (0.85 + random() * 0.45);
                tone(f, f * 0.8, 0.07, P25, if big { 0.2 } else { 0.14 }).at(i as f64 * 0.075).play();
            }
        }
        "pop" => tone(600.0, 1200.0, 0.05, Square, 0.12).play(),
        // 땅을 뚫고 솟음: 쿵 + 흙 무너지는 소리 + 자갈 (a: 강세)
        "burst" => {
            if !thr(35.0) {
                let acc = a != 0.0;
                let k = |hi: f64, lo: f64| if acc { hi } else { lo };
                tone(k(120.0, 150.0), 45.0, k(0.14, 0.09), Sine, k(0.42, 0.26)).play();
                noise(k(0.16, 0.1), k(0.3, 0.18), Low, 900.0, 180.0, 1.0).play();
                noise(0.05, k(0.12, 0.07), Band, 2200.0, 0.0, 1.5).play();
            }
        }
        // 땅울림 (솟기 전 · 흙 물결이 일 때)
        "rumble" => {
            if !thr(200.0) {
                noise(0.5, 0.22, Low, 220.0, 90.0, 1.0).play();
                tone(55.0, 40.0, 0.45, Sine, 0.22).play();
            }
        }
        // 흙 물결이 굴러가며 자갈 갈리는 소리
        "grind" => {
            if !thr(70.0) {
                noise(0.07, 0.1, Band, 700.0 + random() * 500.0, 0.0, 1.2).play();
            }
        }
        // 만장굴 물방울 (동굴 잔향으로 울림)
        "drip" => {
            if !thr(250.0) {
                tone(2000.0 + random() * 1000.0, 850.0, 0.07, Sine, 0.05).play();
            }
        }
        // 사투리 글자 솟기: 글자(a번째)마다 단조 5음 음계로 톡톡 · 정박 글자(b)는 강하게
        "letter" => {
            if !thr(20.0) {
                let (j, acc) = (a, b != 0.0);
                let n = 69.0 + [0.0, 3.0, 5.0, 7.0, 10.0][(j as i64 % 5) as usize] + ((j / 5.0).floor() as i64 % 2) as f64 * 12.0;
                tone(n2f(n), 0.0, if acc { 0.07 } else { 0.045 }, P25, if acc { 0.1 } else { 0.055 }).exact().play();
                if acc {
                    noise(0.05, 0.12, High, 2600.0, 0.0, 1.0).play();
                }
            }
        }
        "level" => arp(&[659.0, 784.0, 988.0, 1319.0], 0.12, P25, 0.18, 0.08),
        "start" => arp(&[523.0, 784.0, 1047.0], 0.12, P25, 0.2, 0.09),
        "over" => arp(&[784.0, 659.0, 523.0, 392.0, 330.0], 0.22, Triangle, 0.3, 0.16),
        "select" => tone(880.0, 0.0, 0.05, P25, 0.15).play(),
        "djump" => {
            tone(420.0, 980.0, 0.14, P12, 0.2).play();
            noise(0.12, 0.12, High, 3000.0, 0.0, 1.0).play();
        }
        "throw" => {
            if !thr(50.0) {
                noise(0.09, 0.16, Band, 1800.0, 600.0, 2.0).play();
                tone(700.0, 420.0, 0.06, Triangle, 0.12).play();
            }
        }
        "splat" => {
            if !thr(40.0) {
                noise(0.12, 0.2, Low, 1400.0, 300.0, 1.0).play();
                tone(300.0, 120.0, 0.08, Sine, 0.25).play();
            }
        }
        "hit" => {
            if !thr(35.0) {
                tone(180.0, 70.0, 0.12, Square, 0.25).play();
                noise(0.08, 0.25, Low, 2600.0, 500.0, 1.0).play();
            }
        }
        "tink" => {
            if !thr(50.0) {
                tone(2200.0, 1600.0, 0.06, Triangle, 0.14).play();
            }
        }
        // 묵직한 저음 + 짧은 딱
        "stomp" => {
            tone(180.0, 70.0, 0.12, Sine, 0.5).play();
            tone(520.0, 760.0, 0.08, Square, 0.12).play();
            noise(0.06, 0.25, Band, 2200.0, 0.0, 1.5).play();
        }
        "shatter" => {
            if !thr(40.0) {
                noise(0.16, 0.2, High, 2500.0, 0.0, 1.0).play();
                tone(1400.0, 2400.0, 0.08, P25, 0.08).play();
            }
        }
        // 콤보: a번째일수록 높게 (12에서 멈춤)
        "combo" => {
            if !thr(40.0) {
                tone(660.0 * pow(1.06, min(a, 12.0)), 0.0, 0.07, P25, 0.12).play();
            }
        }
        "empty" => {
            tone(200.0, 0.0, 0.05, Square, 0.12).play();
            tone(150.0, 0.0, 0.05, Square, 0.12).at(0.06).play();
        }
        // 짧은 경보 (패턴 예고)
        "alarm" => {
            tone(740.0, 990.0, 0.11, Square, 0.11).play();
            tone(990.0, 740.0, 0.11, Square, 0.11).at(0.12).play();
        }
        // 테왁에 텅 막힘 (나무통 소리)
        "block" => {
            tone(330.0, 190.0, 0.09, Triangle, 0.32).play();
            noise(0.05, 0.22, Band, 900.0, 0.0, 2.0).play();
            tone(1400.0, 1100.0, 0.05, Triangle, 0.08).at(0.02).play();
        }
        // 방패를 손에 쥠
        "equip" => {
            arp(&[392.0, 587.0, 784.0], 0.08, P25, 0.14, 0.05);
            noise(0.04, 0.12, High, 4000.0, 0.0, 1.0).at(0.12).play();
        }
        // 망사리 가득 귤
        "bag" => {
            arp(&[659.0, 784.0, 988.0, 1175.0], 0.06, P25, 0.13, 0.04);
            noise(0.12, 0.1, Band, 1800.0, 0.0, 0.8).play();
        }
        // 체력 1: 낮은 두 번 경고
        "lowhp" => {
            for i in 0..2 {
                tone(440.0, 330.0, 0.12, Square, 0.1).at(i as f64 * 0.18).exact().play();
            }
        }
        "siren" => {
            for i in 0..3 {
                let at = i as f64 * 0.46;
                tone(620.0, 880.0, 0.22, Square, 0.13).at(at).play();
                tone(880.0, 620.0, 0.22, Square, 0.13).at(at + 0.23).play();
            }
        }
        "wave" => {
            noise(0.5, 0.4, Low, 900.0, 70.0, 1.0).play();
            tone(90.0, 40.0, 0.4, Sine, 0.45).play();
        }
        "clear" => arp(&[523.0, 659.0, 784.0, 1047.0, 784.0, 1047.0, 1319.0], 0.16, P25, 0.2, 0.11),
        "quiz" => arp(&[784.0, 988.0, 784.0, 1175.0], 0.09, P25, 0.16, 0.09),
        "card" => {
            tone(110.0, 55.0, 0.25, Sine, 0.6).play();
            noise(0.12, 0.25, Low, 1400.0, 300.0, 1.0).play();
            tone(1318.0, 0.0, 0.12, P25, 0.12).at(0.06).play();
        }
        "wow" => arp(&[659.0, 880.0, 1047.0, 1319.0], 0.1, P25, 0.16, 0.06),
        "oink" => {
            if !thr(300.0) {
                tone(320.0, 180.0, 0.12, Saw, 0.14).vib(30.0).play();
                tone(300.0, 160.0, 0.1, Saw, 0.12).at(0.14).vib(30.0).play();
            }
        }
        "shutter" => {
            noise(0.04, 0.25, High, 3000.0, 0.0, 1.0).play();
            noise(0.05, 0.2, High, 2000.0, 0.0, 1.0).at(0.07).play();
        }
        "thunder" => {
            noise(0.14, 0.42, High, 2400.0, 0.0, 1.0).play();
            noise(1.0, 0.5, Low, 900.0, 60.0, 1.0).at(0.05).play();
            noise(1.6, 0.22, Low, 300.0, 60.0, 1.0).at(0.25).play();
            tone(60.0, 30.0, 0.9, Sine, 0.4).play();
        }
        "caw" => {
            tone(380.0, 240.0, 0.16, Saw, 0.09).vib(25.0).play();
            noise(0.14, 0.08, Band, 900.0, 0.0, 2.0).play();
            tone(340.0, 220.0, 0.14, Saw, 0.07).at(0.2).vib(25.0).play();
        }
        "splash" => {
            noise(0.35, 0.3, Band, 1800.0, 400.0, 0.8).play();
            tone(300.0, 120.0, 0.18, Sine, 0.15).play();
        }
        "gull" => {
            tone(1500.0, 900.0, 0.14, P25, 0.1).vib(40.0).play();
            tone(1400.0, 1000.0, 0.12, P25, 0.08).at(0.16).vib(40.0).play();
        }
        "honk" => {
            for at in [0.0, 0.2] {
                let d = if at > 0.0 { 0.18 } else { 0.14 };
                tone(420.0, 0.0, d, Square, 0.12).at(at).play();
                tone(520.0, 0.0, d, Square, 0.1).at(at).play();
            }
        }
        // 칼이 땅에 콱: 묵직한 쿵 + 흙 튀는 소리 + 쇳소리
        "stab" => {
            if !thr(30.0) {
                tone(150.0, 42.0, 0.15, Sine, 0.55).play();
                noise(0.07, 0.3, Band, 1600.0, 0.0, 1.2).play();
                tone(2700.0, 2300.0, 0.14, Triangle, 0.09).at(0.01).play();
            }
        }
        // 쿵 + 폰 스피커용 딸깍 · 한 옥타브 위
        "thud" => {
            if !thr(90.0) {
                tone(80.0, 38.0, 0.16, Sine, 0.5).play();
                low(0.09, 0.18, 500.0).play();
                noise(0.015, 0.14, Band, 2200.0, 0.0, 1.2).play();
                tone(160.0, 80.0, 0.1, Triangle, 0.16).play();
            }
        }
        "rise2" => {
            tone(70.0, 160.0, 1.2, Saw, 0.14).play();
            noise(1.2, 0.3, Low, 300.0, 900.0, 1.0).play();
        }
        _ => {}
    }
}

// 이름 목록 JSON (JS가 처음에 한 번 읽음)
pub fn names_json() -> String {
    format!("[{}]", NAMES.iter().map(|n| format!("\"{}\"", n)).collect::<Vec<_>>().join(","))
}
