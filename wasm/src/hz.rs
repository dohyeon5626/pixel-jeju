// 장애물 종류 목록: 이름 · 필드 목록 · 움직임 · 판정 상자 · 맞았을 때 (js/wasm.js가 이름으로 번호를 찾음)
use crate::game::{Boxes, Schema};
use crate::hz_air::*;
use crate::hz_event::*;
use crate::hz_ground::*;
use crate::hz_item::*;

type Update = fn(&mut [f64], f64) -> bool;
type BoxFn = fn(&[f64]) -> Boxes;
type OnFn = fn(&mut [f64], i32, f64, f64) -> bool;
pub struct Kind {
    pub name: &'static str,
    pub schema: Schema,
    pub update: Update,
    pub boxes: BoxFn,
    pub on: Option<OnFn>,
}

pub const KINDS: &[Kind] = &[
    Kind { name: "rise", schema: rise::SCHEMA, update: rise::update, boxes: rise::boxes, on: Some(rise::on) },
    Kind { name: "hopper", schema: hopper::SCHEMA, update: hopper::update, boxes: hopper::boxes, on: Some(hopper::on) },
    Kind { name: "meteor", schema: meteor::SCHEMA, update: meteor::update, boxes: meteor::boxes, on: None },
    Kind { name: "pony", schema: pony::SCHEMA, update: pony::update, boxes: pony::boxes, on: Some(pony::on) },
    Kind { name: "pebble", schema: pebble::SCHEMA, update: pebble::update, boxes: pebble::boxes, on: Some(pebble::on) },
    Kind { name: "tewak", schema: tewak::SCHEMA, update: tewak::update, boxes: tewak::boxes, on: Some(tewak::on) },
    Kind { name: "suitcase", schema: suitcase::SCHEMA, update: suitcase::update, boxes: suitcase::boxes, on: Some(suitcase::on) },
    Kind { name: "pig", schema: pig::SCHEMA, update: pig::update, boxes: pig::boxes, on: Some(pig::on) },
    Kind { name: "rentcar", schema: rentcar::SCHEMA, update: rentcar::update, boxes: rentcar::boxes, on: Some(rentcar::on) },
    Kind { name: "bubble", schema: bubble::SCHEMA, update: bubble::update, boxes: bubble::boxes, on: Some(bubble::on) },
    Kind { name: "rotten", schema: rotten::SCHEMA, update: rotten::update, boxes: rotten::boxes, on: Some(rotten::on) },
    Kind { name: "zap", schema: zap::SCHEMA, update: zap::update, boxes: zap::boxes, on: Some(zap::on) },
    Kind { name: "splitZap", schema: split_zap::SCHEMA, update: split_zap::update, boxes: zap::boxes, on: Some(split_zap::on) },
    Kind { name: "gull", schema: gull::SCHEMA, update: gull::update, boxes: gull::boxes, on: Some(gull::on) },
    Kind { name: "bee", schema: bee::SCHEMA, update: bee::update, boxes: bee::boxes, on: Some(bee::on) },
    Kind { name: "plane", schema: plane::SCHEMA, update: plane::update, boxes: plane::boxes, on: Some(plane::on) },
    Kind { name: "parcel", schema: parcel::SCHEMA, update: parcel::update, boxes: parcel::boxes, on: Some(parcel::on) },
    Kind { name: "glider", schema: glider::SCHEMA, update: glider::update, boxes: glider::boxes, on: Some(glider::on) },
    Kind { name: "dolphin", schema: dolphin::SCHEMA, update: dolphin::update, boxes: dolphin::boxes, on: Some(dolphin::on) },
    Kind { name: "crow", schema: crow::SCHEMA, update: crow::update, boxes: crow::boxes, on: Some(crow::on) },
    Kind { name: "dialect", schema: dialect::SCHEMA, update: dialect::update, boxes: dialect::boxes, on: Some(dialect::on) },
    Kind { name: "beatBar", schema: beat_bar::SCHEMA, update: beat_bar::update, boxes: beat_bar::boxes, on: None },
    Kind { name: "vortex", schema: vortex::SCHEMA, update: vortex::update, boxes: vortex::boxes, on: None },
    Kind { name: "subSlam", schema: sub_slam::SCHEMA, update: sub_slam::update, boxes: sub_slam::boxes, on: None },
    Kind { name: "areaSmash", schema: area_smash::SCHEMA, update: area_smash::update, boxes: area_smash::boxes, on: None },
    Kind { name: "laser", schema: laser::SCHEMA, update: laser::update, boxes: laser::boxes, on: None },
    Kind { name: "slashWave", schema: slash_wave::SCHEMA, update: slash_wave::update, boxes: slash_wave::boxes, on: None },
    Kind { name: "knifeDrop", schema: knife_drop::SCHEMA, update: knife_drop::update, boxes: knife_drop::boxes, on: None },
    Kind { name: "waterFall", schema: water_fall::SCHEMA, update: water_fall::update, boxes: water_fall::boxes, on: None },
    Kind { name: "ripple", schema: ripple::SCHEMA, update: ripple::update, boxes: ripple::boxes, on: None },
    Kind { name: "oreumRise", schema: oreum_rise::SCHEMA, update: oreum_rise::update, boxes: oreum_rise::boxes, on: None },
    Kind { name: "tideWave", schema: tide_wave::SCHEMA, update: tide_wave::update, boxes: tide_wave::boxes, on: None },
    Kind { name: "hopLand", schema: hop_land::SCHEMA, update: hop_land::update, boxes: hop_land::boxes, on: None },
    Kind { name: "pickup", schema: pickup::SCHEMA, update: pickup::update, boxes: no_boxes, on: None },
    Kind { name: "shot", schema: shot::SCHEMA, update: shot::update, boxes: no_boxes, on: None },
    Kind { name: "answer", schema: answer::SCHEMA, update: answer::update, boxes: no_boxes, on: None },
];
// 맞았을 때 종류 (game.rs EV_* 순서)
pub const EVENTS: [&str; 3] = ["shot", "stomp", "bounce"];

pub fn tables_json() -> String {
    let kinds: Vec<(&str, Schema)> = KINDS.iter().map(|k| (k.name, k.schema)).collect();
    let mut s = crate::game::tables_json(&kinds);
    s.insert_str(s.len() - 1, &format!(",\"events\":[{}]", EVENTS.iter().map(|e| format!("\"{}\"", e)).collect::<Vec<_>>().join(",")));
    s
}
