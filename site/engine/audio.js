// Synthesized sound only — no asset files. Silent until the visitor opts in;
// every call is safe (and cheap) while muted.

const DRONES = {
  surface: { freqs: [55, 82.5, 110.5], gain: 0.055, band: 420 },
  deep:    { freqs: [41, 61.5, 44], gain: 0.075, band: 260 },
  seventh: { freqs: [73, 97.9, 146.8], gain: 0.05, band: 900 },
};

export function makeAudio(bus) {
  let actx = null;
  let master = null;
  let enabled = false;
  let drone = null;      // { name, nodes[], gain }
  let pending = null;    // drone requested while muted

  const ensure = () => {
    if (actx) return actx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    actx = new AC();
    master = actx.createGain();
    master.gain.value = 0.9;
    master.connect(actx.destination);
    return actx;
  };

  const stopDrone = (fade = 0.6) => {
    if (!drone) return;
    const d = drone; drone = null;
    try {
      d.gain.gain.cancelScheduledValues(actx.currentTime);
      d.gain.gain.setTargetAtTime(0, actx.currentTime, fade / 3);
      setTimeout(() => d.nodes.forEach((n) => { try { n.stop(); } catch {} }), fade * 1000 + 200);
    } catch {}
  };

  const startDrone = (name) => {
    const spec = DRONES[name];
    if (!spec || !ensure()) return;
    stopDrone(0.5);
    const g = actx.createGain();
    g.gain.value = 0;
    const filt = actx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = spec.band;
    g.connect(filt).connect(master);
    const lfos = [];   // stopped with the drone, or they run forever
    const nodes = spec.freqs.map((f, i) => {
      const o = actx.createOscillator();
      o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.value = f;
      // slow detune drift keeps the bed from sounding static
      const lfo = actx.createOscillator();
      const lg = actx.createGain();
      lfo.frequency.value = 0.03 + i * 0.017;
      lg.gain.value = 1.4 + i;
      lfo.connect(lg).connect(o.detune);
      lfo.start();
      lfos.push(lfo);
      o.connect(g);
      o.start();
      return o;
    });
    g.gain.setTargetAtTime(spec.gain, actx.currentTime, 1.2);
    drone = { name, nodes: nodes.concat(lfos), gain: g };
  };

  const api = {
    get enabled() { return enabled; },

    toggle(force) {
      enabled = force === undefined ? !enabled : !!force;
      if (enabled) {
        ensure();
        if (actx && actx.state === 'suspended') actx.resume();
        if (pending) { startDrone(pending); }
      } else {
        pending = drone ? drone.name : pending;
        stopDrone(0.35);
      }
      bus && bus.emit('audio:toggle', enabled);
      return enabled;
    },

    drone(name, on = true) {
      pending = on ? name : null;
      if (!enabled) return;
      on ? startDrone(name) : stopDrone();
    },

    tone(hz = 440, o = {}) {
      if (!enabled || !ensure()) return;
      const { dur = 0.2, type = 'sine', gain = 0.3, slideTo, delay = 0 } = o;
      const t = actx.currentTime + delay;
      const osc = actx.createOscillator();
      const g = actx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(hz, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.03, dur * 0.3));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(master);
      osc.start(t); osc.stop(t + dur + 0.05);
    },

    noise(o = {}) {
      if (!enabled || !ensure()) return;
      const { dur = 0.3, gain = 0.2, band = [200, 2000], delay = 0 } = o;
      const t = actx.currentTime + delay;
      const len = Math.max(1, Math.floor(actx.sampleRate * dur));
      const buf = actx.createBuffer(1, len, actx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = actx.createBufferSource();
      src.buffer = buf;
      const bp = actx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = (band[0] + band[1]) / 2;
      bp.Q.value = Math.max(0.3, (band[0] + band[1]) / 2 / Math.max(1, band[1] - band[0]));
      const g = actx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(bp).connect(g).connect(master);
      src.start(t); src.stop(t + dur + 0.02);
    },

    // The signature sound: a drop hitting water far below.
    drip({ pitch = 1, delay = 0 } = {}) {
      if (!enabled) return;
      api.tone(1500 * pitch, { dur: 0.09, type: 'sine', gain: 0.18, slideTo: 420 * pitch, delay });
      api.tone(760 * pitch, { dur: 0.22, type: 'sine', gain: 0.1, slideTo: 300 * pitch, delay: delay + 0.015 });
      api.noise({ dur: 0.16, gain: 0.03, band: [900, 4200], delay: delay + 0.01 });
    },

    thud({ gain = 0.5, delay = 0 } = {}) {
      if (!enabled) return;
      api.tone(110, { dur: 0.42, type: 'sine', gain, slideTo: 32, delay });
      api.noise({ dur: 0.3, gain: gain * 0.4, band: [60, 420], delay });
    },
  };

  return api;
}
