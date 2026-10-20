// 장애물 종류 목록: 이름 · 필드 목록 · 움직임 · 판정 상자 · 맞았을 때 · 그리기 (js/wasm.js가 이름으로 번호를 찾음)
use crate::draw::Draw;
use crate::game::{Boxes, Schema};
use crate::hz_air::*;
use crate::hz_event::*;
use crate::hz_ground::*;
use crate::hz_item::*;

type Update = fn(&mut [f64], f64) -> bool;
type BoxFn = fn(&[f64]) -> Boxes;
type OnFn = fn(&mut [f64], i32, f64, f64) -> bool;
// 그리기: 필드는 그리는 중에 바뀔 수 있음 (낙석 모양 고르기 · 글라이더 눌림)
type DrawFn = fn(&mut [f64], &mut Draw);
pub struct Kind {
    pub name: &'static str,
    pub schema: Schema,
    pub update: Update,
    pub boxes: BoxFn,
    pub on: Option<OnFn>,
    // 그리기 전용 필드 (schema 뒤에 붙음) · 장애물 그림 · 그 아래 땅에 먼저 깔리는 예고(decal)
    pub dschema: Schema,
    pub draw: Option<DrawFn>,
    pub decal: Option<DrawFn>,
}
impl Kind {
    const fn new(name: &'static str, schema: Schema, update: Update, boxes: BoxFn) -> Kind {
        Kind { name, schema, update, boxes, on: None, dschema: &[], draw: None, decal: None }
    }
    const fn on(self, on: OnFn) -> Kind {
        Kind { on: Some(on), ..self }
    }
    const fn draw(self, dschema: Schema, draw: DrawFn) -> Kind {
        Kind { dschema, draw: Some(draw), ..self }
    }
    const fn decal(self, decal: DrawFn) -> Kind {
        Kind { decal: Some(decal), ..self }
    }
}

pub const KINDS: &[Kind] = &[
    // 땅 · 화면 끝 (hz_ground)
    Kind::new("rise", rise::SCHEMA, rise::update, rise::boxes).on(rise::on).draw(rise::DRAW, rise::draw).decal(rise::decal),
    Kind::new("hopper", hopper::SCHEMA, hopper::update, hopper::boxes).on(hopper::on).draw(hopper::DRAW, hopper::draw),
    Kind::new("meteor", meteor::SCHEMA, meteor::update, meteor::boxes).draw(meteor::DRAW, meteor::draw).decal(meteor::decal),
    Kind::new("pony", pony::SCHEMA, pony::update, pony::boxes).on(pony::on).draw(pony::DRAW, pony::draw),
    Kind::new("pebble", pebble::SCHEMA, pebble::update, pebble::boxes).on(pebble::on).draw(pebble::DRAW, pebble::draw),
    Kind::new("tewak", tewak::SCHEMA, tewak::update, tewak::boxes).on(tewak::on).draw(tewak::DRAW, tewak::draw),
    Kind::new("suitcase", suitcase::SCHEMA, suitcase::update, suitcase::boxes).on(suitcase::on).draw(suitcase::DRAW, suitcase::draw),
    Kind::new("pig", pig::SCHEMA, pig::update, pig::boxes).on(pig::on).draw(pig::DRAW, pig::draw),
    Kind::new("rentcar", rentcar::SCHEMA, rentcar::update, rentcar::boxes).on(rentcar::on).draw(rentcar::DRAW, rentcar::draw),
    // 하늘 · 바다 (hz_air)
    Kind::new("bubble", bubble::SCHEMA, bubble::update, bubble::boxes).on(bubble::on).draw(bubble::DRAW, bubble::draw),
    Kind::new("rotten", rotten::SCHEMA, rotten::update, rotten::boxes).on(rotten::on).draw(rotten::DRAW, rotten::draw),
    Kind::new("zap", zap::SCHEMA, zap::update, zap::boxes).on(zap::on).draw(zap::DRAW, zap::draw),
    Kind::new("splitZap", split_zap::SCHEMA, split_zap::update, zap::boxes).on(split_zap::on).draw(zap::DRAW, zap::draw),
    Kind::new("gull", gull::SCHEMA, gull::update, gull::boxes).on(gull::on).draw(gull::DRAW, gull::draw).decal(gull::decal),
    Kind::new("bee", bee::SCHEMA, bee::update, bee::boxes).on(bee::on).draw(bee::DRAW, bee::draw),
    Kind::new("plane", plane::SCHEMA, plane::update, plane::boxes).on(plane::on).draw(plane::DRAW, plane::draw),
    Kind::new("parcel", parcel::SCHEMA, parcel::update, parcel::boxes).on(parcel::on).draw(parcel::DRAW, parcel::draw),
    Kind::new("glider", glider::SCHEMA, glider::update, glider::boxes).on(glider::on).draw(glider::DRAW, glider::draw),
    Kind::new("dolphin", dolphin::SCHEMA, dolphin::update, dolphin::boxes)
        .on(dolphin::on)
        .draw(dolphin::DRAW, dolphin::draw)
        .decal(dolphin::decal),
    Kind::new("crow", crow::SCHEMA, crow::update, crow::boxes).on(crow::on).draw(crow::DRAW, crow::draw).decal(crow::decal),
    Kind::new("dialect", dialect::SCHEMA, dialect::update, dialect::boxes)
        .on(dialect::on)
        .draw(dialect::DRAW, dialect::draw)
        .decal(dialect::decal),
    // 이벤트 공격 (hz_event)
    Kind::new("beatBar", beat_bar::SCHEMA, beat_bar::update, beat_bar::boxes).draw(beat_bar::DRAW, beat_bar::draw),
    Kind::new("vortex", vortex::SCHEMA, vortex::update, vortex::boxes).draw(vortex::DRAW, vortex::draw),
    Kind::new("subSlam", sub_slam::SCHEMA, sub_slam::update, sub_slam::boxes).draw(sub_slam::DRAW, sub_slam::draw),
    Kind::new("areaSmash", area_smash::SCHEMA, area_smash::update, area_smash::boxes).draw(area_smash::DRAW, area_smash::draw),
    Kind::new("laser", laser::SCHEMA, laser::update, laser::boxes).draw(laser::DRAW, laser::draw),
    Kind::new("slashWave", slash_wave::SCHEMA, slash_wave::update, slash_wave::boxes).draw(slash_wave::DRAW, slash_wave::draw),
    Kind::new("knifeDrop", knife_drop::SCHEMA, knife_drop::update, knife_drop::boxes)
        .draw(knife_drop::DRAW, knife_drop::draw)
        .decal(knife_drop::decal),
    Kind::new("waterFall", water_fall::SCHEMA, water_fall::update, water_fall::boxes)
        .draw(water_fall::DRAW, water_fall::draw)
        .decal(water_fall::decal),
    Kind::new("ripple", ripple::SCHEMA, ripple::update, ripple::boxes).draw(ripple::DRAW, ripple::draw),
    Kind::new("oreumRise", oreum_rise::SCHEMA, oreum_rise::update, oreum_rise::boxes)
        .draw(oreum_rise::DRAW, oreum_rise::draw)
        .decal(oreum_rise::decal),
    Kind::new("tideWave", tide_wave::SCHEMA, tide_wave::update, tide_wave::boxes).draw(tide_wave::DRAW, tide_wave::draw),
    Kind::new("hopLand", hop_land::SCHEMA, hop_land::update, hop_land::boxes).decal(hop_land::decal),
    // 줍는 것 · 귤 · 답 팻말 (hz_item)
    Kind::new("pickup", pickup::SCHEMA, pickup::update, no_boxes).draw(pickup::DRAW, pickup::draw),
    Kind::new("shot", shot::SCHEMA, shot::update, no_boxes).draw(shot::DRAW, shot::draw),
    Kind::new("answer", answer::SCHEMA, answer::update, no_boxes).draw(answer::DRAW, answer::draw),
];
// 맞았을 때 종류 (game.rs EV_* 순서)
pub const EVENTS: [&str; 3] = ["shot", "stomp", "bounce"];

pub fn tables_json() -> String {
    let kinds: Vec<(&str, Schema, Schema)> = KINDS.iter().map(|k| (k.name, k.schema, k.dschema)).collect();
    let mut s = crate::game::tables_json(&kinds);
    s.insert_str(s.len() - 1, &format!(",\"events\":[{}]", EVENTS.iter().map(|e| format!("\"{}\"", e)).collect::<Vec<_>>().join(",")));
    // 숨비 필드 목록 (player.rs)
    let ty = |t: &crate::game::Ty| match t {
        crate::game::Ty::Bool => "b",
        crate::game::Ty::Opt => "o",
        _ => "n",
    };
    let player = crate::player::SCHEMA.iter().map(|(n, t)| format!("[\"{}\",\"{}\"]", n, ty(t))).collect::<Vec<_>>().join(",");
    s.insert_str(s.len() - 1, &format!(",\"player\":[{}]", player));
    s
}
