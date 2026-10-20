// ─────────────────────────────────────────────────────────────
//  픽셀 제주 — 사운드 (WebAudio로 만드는 칩튠 효과음 + 배경음악)
// ─────────────────────────────────────────────────────────────
'use strict';

const Sound = (() => {
  let ac = null, master, sfxBus, musicBus, musicL, musicR, mSend, sSend, noiseBuf, pulse25, pulse12, space = 'open';
  let muted = false;
  try { muted = localStorage.getItem('jeju.muted') === '1'; } catch (e) { /* 저장소 사용 불가 */ }

  function init() {
    if (ac) { if (ac.state !== 'running' && ac.state !== 'closed') ac.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { setup(AC); } catch (e) { try { if (ac) ac.close(); } catch (_) { /* 무시 */ } ac = null; }   // 소리 장치를 못 만들면 소리 없이 계속
  }
  function setup(AC) {
    ac = new AC();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.95;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.2;   // 소리가 겹쳐도 찢어지지 않게
    master.connect(comp).connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.5; sfxBus.connect(master);
    const verb = ac.createConvolver(), len = Math.floor(ac.sampleRate * 1.7), ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const dd = ir.getChannelData(ch); for (let i = 0; i < len; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8); }
    verb.buffer = ir; verb.connect(master);   // 잔향: 음악 · 효과음을 조금씩 보내 공간감 (만장굴은 크게 울림)
    mSend = ac.createGain(); mSend.gain.value = 0.14; mSend.connect(verb);
    newMusicBus();
    sSend = ac.createGain(); sSend.gain.value = 0.08; sfxBus.connect(sSend).connect(verb);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    pulse25 = pulseWave(0.25); pulse12 = pulseWave(0.125);
  }
  // 음악 버스: 곡을 멈추거나 바꿀 때마다 새로 만듦 → 미리 예약해 둔 음표(최대 0.3초)는 옛 버스와 함께 바로 잦아들어 다음 곡과 겹치지 않음
  function newMusicBus() {
    const old = musicBus;
    if (old) { const n = ac.currentTime; old.gain.cancelScheduledValues(n); old.gain.setTargetAtTime(0, n, 0.02); setTimeout(() => { try { old.disconnect(); } catch (e) { /* 이미 끊김 */ } }, 500); }
    musicBus = ac.createGain(); musicBus.gain.value = 0.2; musicBus.connect(master); musicBus.connect(mSend);
    const panBus = p => { const gn = ac.createGain(); if (ac.createStereoPanner) { const pn = ac.createStereoPanner(); pn.pan.value = p; gn.connect(pn).connect(musicBus); } else gn.connect(musicBus); return gn; };
    musicL = panBus(-0.22); musicR = panBus(0.28);   // 멜로디는 살짝 왼쪽, 반짝이는 소리(메아리 · 아르페지오 · 하이햇)는 오른쪽 — 칩튠이 넓게 들리게
  }
  function pulseWave(duty) {
    const n = 32, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    return ac.createPeriodicWave(re, im);
  }

  let dtT = -1, dtV = 0;
  function tone({ f, f2 = 0, d = 0.1, type = 'square', v = 0.3, at = 0, bus = sfxBus, vib = 0, exact = false, det = 0 }) {
    if (!ac) return;
    const t0 = ac.currentTime + at;
    const o = ac.createOscillator(), gn = ac.createGain();
    if (bus === sfxBus && !exact) { if (ac.currentTime !== dtT) { dtT = ac.currentTime; dtV = (Math.random() - 0.5) * 36; } o.detune.value = dtV; }   // 같은 효과음도 칠 때마다 미세하게 달라 덜 질림
    if (det) o.detune.value += det;
    if (type === 'p25') o.setPeriodicWave(pulse25);
    else if (type === 'p12') o.setPeriodicWave(pulse12);
    else o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
    if (vib) {
      const l = ac.createOscillator(), lg = ac.createGain();
      l.frequency.value = 18; lg.gain.value = vib;
      l.connect(lg).connect(o.frequency); l.start(t0); l.stop(t0 + d + 0.05);
    }
    gn.gain.setValueAtTime(v, t0);
    gn.gain.exponentialRampToValueAtTime(0.0008, t0 + d);
    o.connect(gn).connect(bus);
    o.start(t0); o.stop(t0 + d + 0.03);
  }
  function noise({ d = 0.2, v = 0.3, at = 0, ft = 'lowpass', f = 2000, f2 = 0, q = 1, bus = sfxBus }) {
    if (!ac) return;
    const t0 = ac.currentTime + at;
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const fl = ac.createBiquadFilter(); fl.type = ft; fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t0);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + d);
    const gn = ac.createGain();
    gn.gain.setValueAtTime(v, t0); gn.gain.exponentialRampToValueAtTime(0.0008, t0 + d);
    s.connect(fl).connect(gn).connect(bus);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + d + 0.03);
  }

  // ── 효과음: 무엇을 낼지 · 너무 잦으면 건너뛰기는 Rust(wasm/src/sfx.rs)가 정하고, 소리는 아래 toneN · noiseN으로 냄 ──
  //  인자: 강세(참거짓) · 번호는 수로, 할망 목소리(babble)는 글자 수(아래아 글자도 한 글자 · 최대 10)로 넘김
  const num = v => v ? +v : 0;
  const sfx = Object.fromEntries(WK.sfxNames().map((n, i) => [n, (a, b) => WK.sfx(i, num(a), num(b))]));
  const babbleN = sfx.babble;
  sfx.babble = (text, big) => babbleN(Math.min(10, graphemes(text.replace(/[\s!?~.]/g, '')).length), big);

  // ── 배경음악: 곡마다 5음계 동기(모티프)를 시드로 만들어 A · A' · B · 쉼 · C 로 엮어 감 ──
  //    무엇을 칠지(멜로디 · 화음 · 베이스 · 드럼)는 Rust(wasm/src/music.rs)가 정하고, 여기서는 받은 음표를 소리로 냄
  const SONG_KEYS = ['title', 'field', 'coast', 'beach', 'night', 'lofi', 'myth', 'grove', 'iho', 'cave', 'falls', 'taiko', 'nightsea', 'stars'];   // music.rs SONGS와 같은 순서
  const HIP_VARIANTS = 3;   // 할망 랩 붐뱁 비트 변주 수 (music.rs HIP)
  let songKey = 'field';
  function buildSong(k) { songKey = k; WK.musicSong(SONG_KEYS.indexOf(k)); }
  buildSong('field');
  let eSched = 60 / 138 / 2, accent = false;
  let playing = false, step = 0, nextT = 0, timer = 0, tempo = 138, calm = false, style = 'chip', t0 = 0, hipVar = 0;

  let key = 0, varied = false;
  function setKey(k, v) { key = k; varied = v; }
  function setSong(k) { if (k !== songKey) buildSong(k); }
  const WAVES = ['square', 'triangle', 'sine', 'sawtooth', 'p25', 'p12'], FILTERS = ['lowpass', 'bandpass', 'highpass'];   // music.rs · sfx.rs 번호 순서
  // 번호로 부르는 소리 (효과음은 Rust가 부름)
  const toneN = (f, f2, d, w, v, at, vib, exact) => tone({ f, f2, d, type: WAVES[w], v, at, vib, exact: !!exact });
  const noiseN = (d, v, w, f, f2, q, at) => noise({ d, v, ft: FILTERS[w], f, f2, q, at });
  function scheduleStep(s, t) {
    const at = t - ac.currentTime, buses = [musicBus, musicL, musicR];
    WK.musicStep(s, tempo, calm, style === 'hiphop', key, varied, accent, hipVar, (kind, f, f2, d, w, v, off, bus, x) => kind
      ? noise({ d, v, ft: FILTERS[w], f, f2, q: x, at: at + off, bus: buses[bus] })
      : tone({ f, f2, d, type: WAVES[w], v, at: at + off, bus: buses[bus], det: x }));
  }
  function pump() {
    if (!playing || !ac) return;
    if (nextT < ac.currentTime - 0.1) { const e = 60 / tempo / 2, k = Math.ceil((ac.currentTime + 0.05 - nextT) / e); step += k; nextT += k * e; }   // 멈췄다 풀려도 박자 위상 유지
    while (nextT < ac.currentTime + 0.3) {   // 0.3초 앞까지 예약: 화면이 잠깐 멈춰도(배경 굽기 등) 음악은 안 끊김
      scheduleStep(step, nextT);
      eSched = 60 / tempo / 2; nextT += eSched;
      step++;
    }
  }
  function startMusic(opts = {}) {
    if (!ac) return;
    calm = !!opts.calm;
    tempo = Math.min(176, opts.tempo || 138);
    if (opts.song) setSong(opts.song);
    if (opts.style === 'hiphop' && !(playing && style === 'hiphop')) hipVar = Math.floor(Math.random() * HIP_VARIANTS);
    const st = opts.style || 'chip';
    if (playing && st === style && !opts.restart) return;
    if (playing) newMusicBus();   // 곡을 바꿀 땐 앞 곡에서 예약해 둔 음을 끊음
    style = st;
    playing = true; step = 0; nextT = ac.currentTime + 0.05; t0 = nextT;
    if (opts.fromBeat > 0) { const s2 = opts.fromBeat * 2, e = 60 / tempo / 2; step = Math.ceil(s2); nextT += (step - s2) * e; eSched = e; }   // 일시정지 뒤: 멈춘 박자에서 이어서
    clearInterval(timer); timer = setInterval(pump, 40);
  }
  function stopMusic() { if (playing && ac) newMusicBus(); playing = false; clearInterval(timer); }
  const ambs = {}, AMB = { rain: { ft: 'bandpass', f: 2600, q: 0.35 }, surf: { ft: 'lowpass', f: 620, q: 0.6, swell: 0.12, rate: 0.7 }, falls: { ft: 'bandpass', f: 1100, q: 0.4, rate: 0.85 } };
  function ambience(name, level) {   // 이어지는 분위기 소리: 크기만 부드럽게 바꿈 (0이 되면 잠시 뒤 멈춤)
    if (!ac) return; let a = ambs[name];
    if (!a) {
      if (level <= 0.001) return;
      const K = AMB[name] || AMB.rain, sN = ac.createBufferSource(); sN.buffer = noiseBuf; sN.loop = true; sN.playbackRate.value = K.rate || 1;
      const fl = ac.createBiquadFilter(); fl.type = K.ft; fl.frequency.value = K.f; fl.Q.value = K.q; const gn = ac.createGain(); gn.gain.value = 0;
      let out = sN.connect(fl), lfo = null;
      if (K.swell) { const sw = ac.createGain(); sw.gain.value = 0.55; lfo = ac.createOscillator(); lfo.frequency.value = K.swell; const lg = ac.createGain(); lg.gain.value = 0.45; lfo.connect(lg).connect(sw.gain); lfo.start(); out = out.connect(sw); }   // 파도: 천천히 밀려왔다 빠짐
      out.connect(gn).connect(sfxBus); sN.start(); a = ambs[name] = { sN, gn, lfo, lv: 0, off: 0 };
    }
    if (Math.abs(level - a.lv) > 0.002) { a.lv = level; a.gn.gain.setTargetAtTime(level, ac.currentTime, 0.25); }
    if (level <= 0.001) { a.off = a.off || ac.currentTime; if (ac.currentTime - a.off > 2) { try { a.sN.stop(); if (a.lfo) a.lfo.stop(); } catch (e) { /* 이미 멈춤 */ } delete ambs[name]; } } else a.off = 0;
  }
  function setSpace(k) { if (!ac || !mSend || space === k) return; space = k; const n = ac.currentTime, cave = k === 'cave'; mSend.gain.setTargetAtTime(cave ? 0.34 : 0.14, n, 0.4); sSend.gain.setTargetAtTime(cave ? 0.32 : 0.08, n, 0.4); }   // 만장굴: 크게 울리는 동굴 메아리
  function setTempo(t) { tempo = Math.min(176, t); }   // 아주 빨라져도 음악은 이 이상 빨라지지 않음
  function suspend() { if (ac && ac.state === 'running') ac.suspend().catch(() => {}); }
  function resume() { if (ac && ac.state === 'suspended') ac.resume().catch(() => {}); }

  // 큰 충격 때 음악을 잠깐 눌러 타격음이 묻히지 않게
  function duck(t = 0.25) { if (!ac || !musicBus) return; const n = ac.currentTime, gg = musicBus.gain; gg.cancelScheduledValues(n); gg.setValueAtTime(0.07, n); gg.linearRampToValueAtTime(0.2, n + t); }
  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('jeju.muted', m ? '1' : '0'); } catch (e) { /* 무시 */ }
    if (master) master.gain.value = m ? 0 : 0.95;
  }

  return {
    init, sfx, toneN, noiseN, startMusic, stopMusic, setTempo, setMuted, setKey, setSong, duck, ambience, setSpace, suspend, resume,
    setAccent(v) { accent = !!v; },
    get tempo() { return tempo; },
    get muted() { return muted; },
    get playing() { return playing; },
    get running() { return !!ac && ac.state === 'running'; },   // 브라우저가 소리를 막고 있으면 false (첫 입력 전)
    get style() { return style; },
    // 현재 박자 (4분음표 단위, 소수점 = 박 안의 위치)
    // 실제로 들리는 박: 예약한 8분음표 칸(step) 기준이라 템포가 바뀌어도 위상이 어긋나지 않음 (출력 지연 보정)
    beat() { if (!(ac && playing && ac.state === 'running')) return -1; const now = ac.currentTime - (ac.outputLatency || ac.baseLatency || 0), e = eSched; return Math.max(0, (step - (nextT - now) / e) / 2); },
  };
})();
