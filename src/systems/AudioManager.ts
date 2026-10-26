import { AUDIO } from '@/config/gameConfig';
import type { MusicId, Settings, SfxId } from '@/types';
import { Logger } from '@/utils/Logger';
import { TRACKS, degreeToMidi, midiToFreq, type TrackDef } from './audio/MusicTracks';

type Bus = 'music' | 'sfx' | 'ui';

interface ToneOpts {
  freq: number;
  to?: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  delay?: number;
  bus?: Bus;
  filter?: number;
}

interface NoiseOpts {
  dur: number;
  filter: number;
  to?: number;
  type?: BiquadFilterType;
  gain?: number;
  delay?: number;
  bus?: Bus;
  q?: number;
}

/**
 * Synthesizes every sound and the music at runtime with the Web Audio API. Three independent
 * buses (Music, SFX, UI) map to the volume settings. The context is only created after a user
 * gesture, respecting browser autoplay policies.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses: Partial<Record<Bus, GainNode>> = {};
  private noise: AudioBuffer | null = null;
  private settings: Settings;
  private wantedMusic: MusicId | null = null;
  private playingMusic: MusicId | null = null;
  private track: TrackDef | null = null;
  private trackGain: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextStepTime = 0;
  private step = 0;
  private musicPaused = false;

  constructor(settings: Settings) {
    this.settings = { ...settings };
  }

  get unlocked(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Must be called from a user gesture handler (click, key, touch). */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        for (const bus of ['music', 'sfx', 'ui'] as Bus[]) {
          const g = this.ctx.createGain();
          g.connect(this.master);
          this.buses[bus] = g;
        }
        this.noise = this.createNoise();
        this.applySettings(this.settings);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      if (this.wantedMusic && this.playingMusic !== this.wantedMusic) this.startMusic(this.wantedMusic);
    } catch (err) {
      Logger.warn('Audio', 'Web Audio unavailable; continuing without sound.', err);
      this.ctx = null;
    }
  }

  applySettings(settings: Settings): void {
    this.settings = { ...settings };
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(settings.muted ? 0 : 1, t, 0.02);
    this.buses.music?.gain.setTargetAtTime(settings.musicVolume * 0.55, t, 0.05);
    this.buses.sfx?.gain.setTargetAtTime(settings.sfxVolume, t, 0.02);
    this.buses.ui?.gain.setTargetAtTime(settings.uiVolume * 0.8, t, 0.02);
  }

  // ------------------------------------------------------------------ music

  playMusic(id: MusicId): void {
    this.wantedMusic = id;
    this.musicPaused = false;
    if (!this.ctx || this.playingMusic === id) return;
    this.startMusic(id);
  }

  stopMusic(): void {
    this.wantedMusic = null;
    this.fadeOutTrack();
    this.playingMusic = null;
  }

  /** Pause keeps the track position; resume fades back in. */
  pauseMusic(): void {
    if (!this.ctx || !this.trackGain || this.musicPaused) return;
    this.musicPaused = true;
    this.trackGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
  }

  resumeMusic(): void {
    if (!this.ctx || !this.trackGain || !this.musicPaused) return;
    this.musicPaused = false;
    this.nextStepTime = this.ctx.currentTime + 0.05;
    this.trackGain.gain.setTargetAtTime(1, this.ctx.currentTime, 0.2);
  }

  private startMusic(id: MusicId): void {
    if (!this.ctx || id === 'victory') return;
    this.fadeOutTrack();
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.buses.music!);
    gain.gain.linearRampToValueAtTime(1, this.ctx.currentTime + AUDIO.fadeSeconds);
    this.trackGain = gain;
    this.track = TRACKS[id];
    this.playingMusic = id;
    this.step = 0;
    this.nextStepTime = this.ctx.currentTime + 0.05;
    if (this.timer === null) this.timer = setInterval(this.schedule, AUDIO.schedulerIntervalMs);
  }

  private fadeOutTrack(): void {
    if (!this.ctx || !this.trackGain) return;
    const g = this.trackGain;
    g.gain.cancelScheduledValues(this.ctx.currentTime);
    g.gain.setValueAtTime(g.gain.value, this.ctx.currentTime);
    g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + AUDIO.fadeSeconds);
    setTimeout(() => g.disconnect(), AUDIO.fadeSeconds * 1000 + 100);
    this.trackGain = null;
    this.track = null;
  }

  private readonly schedule = (): void => {
    if (!this.ctx || !this.track || !this.trackGain || this.musicPaused) return;
    const stepDur = 60 / this.track.bpm / 4;
    while (this.nextStepTime < this.ctx.currentTime + AUDIO.lookaheadSeconds) {
      this.playStep(this.track, this.step, this.nextStepTime, stepDur);
      this.nextStepTime += stepDur;
      this.step++;
    }
  };

  private playStep(track: TrackDef, step: number, time: number, stepDur: number): void {
    const s = step % 16;
    const bar = Math.floor(step / 16) % track.bass.length;
    const out = this.trackGain!;
    const at = (pattern: string): boolean => pattern[s] === 'x';
    if (at(track.kick)) this.kick(time, out, track.intensity);
    if (at(track.snare)) this.snare(time, out, track.intensity);
    if (at(track.hat)) this.hat(time, out);
    const b = track.bass[bar][s];
    if (b !== null)
      this.voice(time, out, midiToFreq(degreeToMidi(track, b) - 12), stepDur * 1.6, 'sawtooth', 0.16, 700);
    const l = track.lead[bar][s];
    if (l !== null)
      this.voice(
        time,
        out,
        midiToFreq(degreeToMidi(track, l) + 12),
        stepDur * 2.2,
        track.leadWave,
        0.06,
        2600,
      );
    if (s === 0) {
      for (const d of track.pads[bar]) {
        this.voice(time, out, midiToFreq(degreeToMidi(track, d)), stepDur * 15, 'sawtooth', 0.025, 900, 0.3);
      }
    }
  }

  // ------------------------------------------------------------------ synth voices

  private voice(
    time: number,
    out: AudioNode,
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    cutoff: number,
    attack = 0.005,
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    osc.type = type;
    osc.frequency.value = freq;
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(f).connect(g).connect(out);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  private kick(time: number, out: AudioNode, intensity: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.14);
    g.gain.setValueAtTime(0.5 * intensity, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
    osc.connect(g).connect(out);
    osc.start(time);
    osc.stop(time + 0.25);
  }

  private snare(time: number, out: AudioNode, intensity: number): void {
    this.noiseAt(time, out, { dur: 0.14, filter: 1800, type: 'bandpass', gain: 0.22 * intensity, q: 0.8 });
  }

  private hat(time: number, out: AudioNode): void {
    this.noiseAt(time, out, { dur: 0.035, filter: 7500, type: 'highpass', gain: 0.07 });
  }

  private noiseAt(time: number, out: AudioNode, o: NoiseOpts): void {
    const ctx = this.ctx!;
    if (!this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? 'lowpass';
    f.frequency.setValueAtTime(o.filter, time);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, time + o.dur);
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.gain ?? 0.3, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + o.dur);
    src.connect(f).connect(g).connect(out);
    src.start(time, Math.random() * 0.5);
    src.stop(time + o.dur + 0.02);
  }

  private tone(o: ToneOpts): void {
    const ctx = this.ctx!;
    const time = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, time);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, time + o.dur);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(o.gain ?? 0.3, time + (o.attack ?? 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, time + o.dur);
    let node: AudioNode = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.filter;
      node = osc.connect(f);
    }
    node.connect(g).connect(this.buses[o.bus ?? 'sfx']!);
    osc.start(time);
    osc.stop(time + o.dur + 0.05);
  }

  private burst(o: NoiseOpts): void {
    const ctx = this.ctx!;
    this.noiseAt(ctx.currentTime + (o.delay ?? 0), this.buses[o.bus ?? 'sfx']!, o);
  }

  private createNoise(): AudioBuffer {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // ------------------------------------------------------------------ sound effects

  play(id: SfxId): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    try {
      this.recipe(id);
    } catch (err) {
      Logger.warn('Audio', `Failed to play ${id}`, err);
    }
  }

  private recipe(id: SfxId): void {
    const T = (o: ToneOpts): void => this.tone(o);
    const N = (o: NoiseOpts): void => this.burst(o);
    switch (id) {
      case 'hit_light':
        N({ dur: 0.08, filter: 3000, to: 600, gain: 0.35 });
        T({ freq: 220, to: 90, dur: 0.08, type: 'square', gain: 0.12, filter: 1200 });
        break;
      case 'hit_heavy':
        N({ dur: 0.18, filter: 2200, to: 200, gain: 0.45 });
        T({ freq: 140, to: 45, dur: 0.22, type: 'sine', gain: 0.5 });
        break;
      case 'block':
        T({ freq: 900, to: 600, dur: 0.12, type: 'triangle', gain: 0.18 });
        N({ dur: 0.06, filter: 4000, type: 'bandpass', gain: 0.25, q: 4 });
        break;
      case 'whiff':
        N({ dur: 0.12, filter: 900, to: 2500, type: 'bandpass', gain: 0.12, q: 2 });
        break;
      case 'dodge':
        N({ dur: 0.18, filter: 500, to: 3000, type: 'bandpass', gain: 0.16, q: 1.5 });
        break;
      case 'perfect_dodge':
        T({ freq: 660, to: 1320, dur: 0.25, type: 'triangle', gain: 0.15 });
        T({ freq: 990, dur: 0.3, type: 'sine', gain: 0.1, delay: 0.06 });
        break;
      case 'jump':
        T({ freq: 260, to: 420, dur: 0.1, type: 'triangle', gain: 0.08 });
        break;
      case 'land':
        N({ dur: 0.08, filter: 500, gain: 0.15 });
        break;
      case 'fireball':
        N({ dur: 0.45, filter: 400, to: 2400, gain: 0.25 });
        T({ freq: 110, to: 220, dur: 0.4, type: 'sawtooth', gain: 0.1, filter: 900 });
        break;
      case 'uppercut':
        T({ freq: 180, to: 720, dur: 0.25, type: 'sawtooth', gain: 0.14, filter: 1800 });
        N({ dur: 0.25, filter: 800, to: 3000, gain: 0.2 });
        break;
      case 'shockwave':
        T({ freq: 70, to: 35, dur: 0.6, type: 'sine', gain: 0.55 });
        N({ dur: 0.5, filter: 300, to: 120, gain: 0.4 });
        break;
      case 'charge':
        T({ freq: 90, to: 160, dur: 0.35, type: 'sawtooth', gain: 0.18, filter: 600 });
        N({ dur: 0.3, filter: 600, gain: 0.25 });
        break;
      case 'kunai':
        T({ freq: 2200, to: 1400, dur: 0.07, type: 'triangle', gain: 0.08 });
        T({ freq: 2600, to: 1600, dur: 0.07, type: 'triangle', gain: 0.07, delay: 0.04 });
        T({ freq: 2400, to: 1500, dur: 0.07, type: 'triangle', gain: 0.07, delay: 0.08 });
        break;
      case 'teleport':
        T({ freq: 1200, to: 200, dur: 0.22, type: 'sine', gain: 0.14 });
        N({ dur: 0.2, filter: 6000, to: 800, type: 'bandpass', gain: 0.12 });
        break;
      case 'ultimate_start':
        T({ freq: 60, to: 240, dur: 0.9, type: 'sawtooth', gain: 0.2, filter: 1400, attack: 0.1 });
        T({ freq: 220, dur: 0.9, type: 'triangle', gain: 0.12, delay: 0.25 });
        T({ freq: 330, dur: 0.9, type: 'triangle', gain: 0.1, delay: 0.25 });
        T({ freq: 440, dur: 0.9, type: 'triangle', gain: 0.08, delay: 0.25 });
        N({ dur: 0.8, filter: 200, to: 5000, gain: 0.2 });
        break;
      case 'ultimate_hit':
        T({ freq: 120, to: 30, dur: 0.5, type: 'sine', gain: 0.6 });
        N({ dur: 0.5, filter: 3000, to: 150, gain: 0.5 });
        break;
      case 'ko':
        T({ freq: 90, to: 25, dur: 1.2, type: 'sine', gain: 0.6 });
        N({ dur: 1, filter: 2000, to: 80, gain: 0.45 });
        break;
      case 'countdown':
        T({ freq: 520, dur: 0.18, type: 'square', gain: 0.1, filter: 2000, bus: 'ui' });
        break;
      case 'fight':
        T({ freq: 392, dur: 0.5, type: 'sawtooth', gain: 0.14, filter: 2400, bus: 'ui' });
        T({ freq: 587, dur: 0.6, type: 'sawtooth', gain: 0.12, filter: 2400, delay: 0.12, bus: 'ui' });
        N({ dur: 0.4, filter: 1500, gain: 0.2 });
        break;
      case 'victory':
        [523, 659, 784, 1047].forEach((f, i) =>
          T({ freq: f, dur: 0.5, type: 'triangle', gain: 0.14, delay: i * 0.12, bus: 'ui' }),
        );
        break;
      case 'defeat':
        [392, 349, 311, 262].forEach((f, i) =>
          T({ freq: f, dur: 0.6, type: 'triangle', gain: 0.14, delay: i * 0.18, bus: 'ui' }),
        );
        break;
      case 'stun':
        for (let i = 0; i < 4; i++)
          T({ freq: 880, to: 660, dur: 0.12, type: 'sine', gain: 0.08, delay: i * 0.1 });
        break;
      case 'energy_full':
        T({ freq: 784, dur: 0.25, type: 'triangle', gain: 0.12, bus: 'ui' });
        T({ freq: 1175, dur: 0.35, type: 'triangle', gain: 0.1, delay: 0.08, bus: 'ui' });
        break;
      case 'ui_hover':
        T({ freq: 1400, dur: 0.03, type: 'square', gain: 0.03, filter: 3000, bus: 'ui' });
        break;
      case 'ui_click':
        T({ freq: 700, to: 1100, dur: 0.07, type: 'triangle', gain: 0.12, bus: 'ui' });
        break;
      case 'ui_back':
        T({ freq: 700, to: 420, dur: 0.08, type: 'triangle', gain: 0.1, bus: 'ui' });
        break;
      case 'ui_error':
        T({ freq: 140, dur: 0.15, type: 'square', gain: 0.1, filter: 800, bus: 'ui' });
        T({ freq: 130, dur: 0.15, type: 'square', gain: 0.1, filter: 800, delay: 0.1, bus: 'ui' });
        break;
      case 'counter':
        T({ freq: 1400, to: 700, dur: 0.12, type: 'square', gain: 0.12, filter: 3000 });
        T({ freq: 220, to: 60, dur: 0.35, type: 'sine', gain: 0.45, delay: 0.05 });
        N({ dur: 0.25, filter: 4000, to: 300, gain: 0.35, delay: 0.05 });
        break;
      case 'javelin':
        N({ dur: 0.3, filter: 1200, to: 4000, type: 'bandpass', gain: 0.2, q: 3 });
        T({ freq: 500, to: 900, dur: 0.18, type: 'triangle', gain: 0.08 });
        break;
      case 'plasma':
        T({ freq: 180, to: 900, dur: 0.22, type: 'sawtooth', gain: 0.12, filter: 2200 });
        T({ freq: 90, to: 60, dur: 0.3, type: 'sine', gain: 0.2 });
        break;
      case 'orb':
        T({ freq: 330, to: 495, dur: 0.6, type: 'sine', gain: 0.14, attack: 0.08 });
        T({ freq: 660, to: 990, dur: 0.6, type: 'triangle', gain: 0.06, attack: 0.08 });
        break;
      case 'beam':
        T({ freq: 80, to: 140, dur: 1.2, type: 'sawtooth', gain: 0.18, filter: 900, attack: 0.05 });
        N({ dur: 1.2, filter: 2500, gain: 0.25 });
        break;
      case 'rush':
        N({ dur: 0.25, filter: 300, to: 2500, gain: 0.25 });
        T({ freq: 120, to: 200, dur: 0.2, type: 'sawtooth', gain: 0.1, filter: 800 });
        break;
      case 'pact':
        T({ freq: 110, to: 55, dur: 0.6, type: 'sawtooth', gain: 0.18, filter: 700 });
        T({ freq: 233, dur: 0.5, type: 'triangle', gain: 0.08, delay: 0.1 });
        N({ dur: 0.5, filter: 800, to: 200, gain: 0.2 });
        break;
      case 'iai':
        T({ freq: 3000, to: 1200, dur: 0.15, type: 'triangle', gain: 0.08 });
        N({ dur: 0.12, filter: 6000, type: 'highpass', gain: 0.18, delay: 0.02 });
        break;
      case 'booster':
        N({ dur: 0.45, filter: 400, to: 3000, gain: 0.3 });
        T({ freq: 60, to: 240, dur: 0.4, type: 'sawtooth', gain: 0.12, filter: 1000 });
        break;
      case 'achievement':
        [523, 784, 1047, 1319].forEach((f, i) =>
          T({ freq: f, dur: 0.4, type: 'triangle', gain: 0.1, delay: i * 0.07, bus: 'ui' }),
        );
        break;
      case 'unlock':
        [440, 554, 659, 880, 1109].forEach((f, i) =>
          T({ freq: f, dur: 0.35, type: 'triangle', gain: 0.12, delay: i * 0.08, bus: 'ui' }),
        );
        break;
      default:
        break;
    }
  }
}
