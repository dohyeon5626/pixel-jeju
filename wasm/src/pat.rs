// 패턴(장애물을 언제 · 어디에 낼지) 다리: 패턴 상태는 JS 객체에 두고 장애물과 같은 방식으로 필드를 주고받음
//  Rust가 JS 장애물을 만들고(jnew — 생성자 안의 난수 순서까지 원래대로) · 필드를 읽고 고친 뒤(jget · jset) · 판에 냄(jspawn)
//  경고 뒤에 나오는 것(원래 클로저)은 동작 번호로 남겨 두면 때가 됐을 때 JS가 pat_action으로 다시 부름
use crate::game::{hook, idx, Schema, Ty};
use crate::pat_basic::*;

#[link(wasm_import_module = "g")]
extern "C" {
    fn jnew(kind: f64, a: f64, b: f64, c: f64, d: f64, e: f64) -> f64;
    fn jget(h: f64, field: f64) -> f64;
    fn jset(h: f64, field: f64, v: f64);
    fn jspawn(h: f64);
    fn jwarn(side: f64, kind: f64, dur: f64, ph: f64, act: f64, a: f64, b: f64, c: f64, d: f64);
    fn jquery(q: f64, a: f64) -> f64;
}

// 만들 수 있는 장애물 (JS 생성자 · 인자는 js/wasm.js NEW 표와 같은 순서)
pub const NEW: [&str; 18] = [
    "Rise",
    "Hopper",
    "Meteor",
    "Pony",
    "Pebble",
    "Tewak",
    "Suitcase",
    "Pig",
    "RentCar",
    "Bee",
    "Gull",
    "Plane",
    "Parcel",
    "Glider",
    "Dolphin",
    "Crow",
    "DialectWord",
    "Rotten",
];
// 만든 뒤 읽고 고치는 필드 (참거짓은 Bool)
pub const FIELDS: &[(&str, Ty)] = &[
    ("chain", Ty::Bool),
    ("dir", Ty::Num),
    ("tx", Ty::Num),
    ("sx", Ty::Num),
    ("x", Ty::Num),
    ("y", Ty::Num),
    ("t", Ty::Num),
    ("T", Ty::Num),
    ("warn", Ty::Num),
    ("grav", Ty::Num),
    ("falling", Ty::Bool),
    ("life", Ty::Num),
    ("pat", Ty::Num), // 고치면 null (이 패턴 몫으로 안 침)
];
// 경고 종류 (화면 끝 아이콘): 없으면 NaN
pub const WARN_KINDS: [&str; 3] = ["case", "pig", "car"];
// 판에 물어보기: 날아오거나 끓는 화산탄이 있나 · x 근처(14px)에 택배가 있나 · 사투리 낱말 수
pub const QUERIES: [&str; 3] = ["meteorLive", "parcelNear", "dialectCount"];

// 아직 판에 내지 않은 장애물 하나
#[derive(Clone, Copy)]
pub struct Obj(f64);
pub fn new_obj(kind: &str, args: &[f64]) -> Obj {
    let a = |i: usize| args.get(i).copied().unwrap_or(f64::NAN);
    Obj(unsafe { jnew(idx(&NEW, kind), a(0), a(1), a(2), a(3), a(4)) })
}
fn field(name: &str) -> f64 {
    FIELDS.iter().position(|(n, _)| *n == name).expect("FIELDS에 없음") as f64
}
impl Obj {
    pub fn get(self, name: &str) -> f64 {
        unsafe { jget(self.0, field(name)) }
    }
    pub fn set(self, name: &str, v: f64) -> Obj {
        unsafe { jset(self.0, field(name), v) };
        self
    }
    // 판에 냄 (원래 spawnHz)
    pub fn spawn(self) -> Obj {
        unsafe { jspawn(self.0) };
        self
    }
}
// 만들고 바로 냄
pub fn spawn(kind: &str, args: &[f64]) -> Obj {
    new_obj(kind, args).spawn()
}
// 화면 끝 경고: dur초 뒤 이 패턴의 동작 act(a, b, c, d)가 불림 (kind: WARN_KINDS 이름 · ph: 벌떼 물결 위상)
pub fn warn(side: f64, kind: Option<&str>, dur: f64, ph: f64, act: u32, args: [f64; 4]) {
    let k = kind.map(|k| idx(&WARN_KINDS, k)).unwrap_or(f64::NAN);
    unsafe { jwarn(side, k, dur, ph, act as f64, args[0], args[1], args[2], args[3]) }
}
pub fn query(q: &str, a: f64) -> f64 {
    unsafe { jquery(idx(&QUERIES, q), a) }
}
// 지금부터 d초(월드) 뒤 이후로 가장 가까운 박 머리까지의 시간 (원래 JS beatLead)
pub fn beat_lead(d: f64) -> f64 {
    hook("beatLead", d, 0.0, 0.0, 0.0)
}

type Update = fn(&mut [f64], f64);
type Action = fn(u32, f64, f64, f64, f64);
pub struct PatKind {
    pub name: &'static str,
    pub schema: Schema,
    pub update: Update,
    pub action: Option<Action>,
}
impl PatKind {
    const fn new(name: &'static str, schema: Schema, update: Update) -> PatKind {
        PatKind { name, schema, update, action: None }
    }
    const fn action(self, action: Action) -> PatKind {
        PatKind { action: Some(action), ..self }
    }
}
pub const PATS: &[PatKind] = &[
    PatKind::new("rise", rise::SCHEMA, rise::update),
    PatKind::new("hop", hop::SCHEMA, hop::update),
    PatKind::new("meteor", meteor::SCHEMA, meteor::update),
    PatKind::new("pony", pony::SCHEMA, pony::update).action(pony::action),
    PatKind::new("wind", wind::SCHEMA, wind::update),
    PatKind::new("suitcase", suitcase::SCHEMA, suitcase::update).action(suitcase::action),
    PatKind::new("pig", pig::SCHEMA, pig::update).action(pig::action),
    PatKind::new("harvest", harvest::SCHEMA, harvest::update),
    PatKind::new("gull", gull::SCHEMA, gull::update),
    PatKind::new("car", car::SCHEMA, car::update).action(car::action),
    PatKind::new("bee", bee::SCHEMA, bee::update).action(bee::action),
    PatKind::new("plane", plane::SCHEMA, plane::update),
    PatKind::new("parcel", parcel::SCHEMA, parcel::update),
    PatKind::new("glider", glider::SCHEMA, glider::update),
    PatKind::new("dolphin", dolphin::SCHEMA, dolphin::update),
    PatKind::new("crow", crow::SCHEMA, crow::update),
    PatKind::new("dialect", dialect::SCHEMA, dialect::update),
    PatKind::new("typhoon", typhoon::SCHEMA, typhoon::update),
];

// 패턴 필드 목록 · 이름표 JSON (JS가 처음에 한 번 읽음)
pub fn tables_json() -> String {
    let list = |v: &[&str]| format!("[{}]", v.iter().map(|s| format!("\"{}\"", s)).collect::<Vec<_>>().join(","));
    let ty = |t: &Ty| match t {
        Ty::Num => "\"n\"".to_string(),
        Ty::Bool => "\"b\"".to_string(),
        Ty::Enum(v) => list(v),
        Ty::List => "\"l\"".to_string(),
    };
    let fields = |s: &[(&str, Ty)]| s.iter().map(|(n, t)| format!("[\"{}\",{}]", n, ty(t))).collect::<Vec<_>>().join(",");
    let kinds = PATS.iter().map(|p| format!("\"{}\":[{}]", p.name, fields(p.schema))).collect::<Vec<_>>().join(",");
    format!(
        "{{\"kinds\":{{{}}},\"new\":{},\"fields\":[{}],\"warn\":{},\"queries\":{}}}",
        kinds,
        list(&NEW),
        fields(FIELDS),
        list(&WARN_KINDS),
        list(&QUERIES)
    )
}
