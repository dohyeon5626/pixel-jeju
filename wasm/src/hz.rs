// 장애물 종류 목록: 이름 · 필드 목록 · 움직임 · 판정 상자 · 맞았을 때 (js/wasm.js가 이름으로 번호를 찾음)
use crate::game::{Boxes, Schema};
use crate::hz_ground::*;

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
];
// 맞았을 때 종류 (EV_SHOT · EV_STOMP 순서)
pub const EVENTS: [&str; 2] = ["shot", "stomp"];

pub fn tables_json() -> String {
    let kinds: Vec<(&str, Schema)> = KINDS.iter().map(|k| (k.name, k.schema)).collect();
    let mut s = crate::game::tables_json(&kinds);
    s.insert_str(s.len() - 1, &format!(",\"events\":[{}]", EVENTS.iter().map(|e| format!("\"{}\"", e)).collect::<Vec<_>>().join(",")));
    s
}
