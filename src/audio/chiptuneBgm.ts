/**
 * PROCEDURAL CHIPTUNE FM SYNTHESIZER (Web Audio API)
 * Zero external audio assets. Real-time synthesized 8-bit / 16-bit retro arcade soundtrack.
 * Uses rock-solid lookahead scheduling (Web Audio clock) for jitter-free tempo.
 */

import { readStorage, writeStorage } from '../utils/browser';

export type BgmTrack = 'HUB' | 'BATTLE';

export class ProceduralChiptuneEngine {
  private ctx: AudioContext | null = null;
  public enabled = false;
  public currentTrack: BgmTrack = 'HUB';
  public volume = 0.18;

  private masterGain: GainNode | null = null;
  private isRunning = false;
  private timerId: number | null = null;

  // Music Timing (Lookahead Web Audio Scheduler)
  private nextNoteTime = 0;
  private currentStep = 0; // 0..15 (16th notes)
  private tempoBpm = 110;
  private readonly lookaheadMs = 25;
  private readonly scheduleAheadTime = 0.12;

  // Musical Scales (Frequency Hz)
  // Pentatonic Minor in D (Battle) and A (Hub)
  private readonly notesHub = [
    220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33
  ]; // A minor
  private readonly notesBattle = [
    146.83, 174.61, 196.0, 220.0, 261.63, 293.66, 349.23, 392.0, 440.0
  ]; // D minor / Dorian

  // Bass Patterns (16 steps)
  private readonly bassHub = [
    0, -1, 0, -1, 3, -1, 0, -1, 4, -1, 3, -1, 0, -1, 2, -1
  ];
  private readonly bassBattle = [
    0, 0, 3, 0, 5, 0, 3, 0, 0, 0, 6, 5, 3, 5, 0, 3
  ];

  // Lead Melody Patterns
  private readonly leadHub = [
    5, -1, 4, -1, 3, 2, 0, -1, 2, 3, 5, -1, 4, 3, 2, -1
  ];
  private readonly leadBattle = [
    5, 7, 5, 3, 5, 8, 7, 5, 3, 5, 3, 2, 3, 5, 7, 8
  ];

  constructor() {
    this.enabled = readStorage('local', 'tp04_bgm_enabled') === 'true';
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (typeof AC !== 'function') return null;
      try {
        this.ctx = new AC();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    writeStorage('local', 'tp04_bgm_enabled', String(this.enabled));
    if (this.enabled) {
      this.start();
    } else {
      this.stop();
    }
    return this.enabled;
  }

  public setTrack(track: BgmTrack): void {
    if (this.currentTrack === track) return;
    this.currentTrack = track;
    this.tempoBpm = track === 'BATTLE' ? 134 : 108;
    this.currentStep = 0;
  }

  public start(): void {
    if (!this.enabled || this.isRunning) return;
    const ac = this.ensureContext();
    if (!ac) return;

    this.isRunning = true;
    this.tempoBpm = this.currentTrack === 'BATTLE' ? 134 : 108;
    this.nextNoteTime = ac.currentTime + 0.05;
    this.currentStep = 0;

    if (this.masterGain) {
      this.masterGain.gain.cancelScheduledValues(ac.currentTime);
      this.masterGain.gain.setValueAtTime(0.001, ac.currentTime);
      this.masterGain.gain.exponentialRampToValueAtTime(this.volume, ac.currentTime + 0.4);
    }

    this.timerId = window.setInterval(() => {
      this.scheduler();
    }, this.lookaheadMs);
  }

  public stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.isRunning = false;

    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    }
  }

  private scheduler(): void {
    if (!this.ctx || !this.enabled || !this.isRunning) return;
    const now = this.ctx.currentTime;
    const stepDuration = 15 / this.tempoBpm;
    // A throttled/background tab must skip old notes, never synthesize the missed minutes.
    if (this.nextNoteTime < now) {
      const missed = Math.ceil((now - this.nextNoteTime) / stepDuration);
      this.currentStep = (this.currentStep + missed) % 16;
      this.nextNoteTime = Math.max(now, this.nextNoteTime + missed * stepDuration);
    }
    let scheduled = 0;
    while (this.nextNoteTime < now + this.scheduleAheadTime && scheduled++ < 8) {
      this.scheduleStep(this.currentStep, this.nextNoteTime);
      this.nextNoteTime += stepDuration;
      this.currentStep = (this.currentStep + 1) % 16;
    }
  }

  public dispose(): void {
    this.stop();
    this.masterGain?.disconnect();
    const context = this.ctx;
    this.ctx = null;
    this.masterGain = null;
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }

  private scheduleStep(step: number, time: number): void {
    if (!this.ctx || !this.masterGain) return;

    const isBattle = this.currentTrack === 'BATTLE';
    const scale = isBattle ? this.notesBattle : this.notesHub;
    const bassPattern = isBattle ? this.bassBattle : this.bassHub;
    const leadPattern = isBattle ? this.leadBattle : this.leadHub;

    // 1. Kick Drum (Steps 0, 4, 8, 12, plus syncopation on battle)
    const isKick = step % 4 === 0 || (isBattle && step === 14);
    if (isKick) {
      this.playKick(time);
    }

    // 2. Snare Drum / Noise Clap (Steps 4 and 12)
    const isSnare = step === 4 || step === 12;
    if (isSnare) {
      this.playSnare(time);
    }

    // 3. Hi-Hat (Every odd 16th or 8th note)
    const isHiHat = step % 2 === 0;
    if (isHiHat) {
      this.playHiHat(time, step % 4 === 2 ? 0.08 : 0.04);
    }

    // 4. Bass Line (Triangle wave with low-pass envelope)
    const bassNoteIdx = bassPattern[step];
    if (typeof bassNoteIdx === 'number' && bassNoteIdx >= 0 && scale[bassNoteIdx]) {
      const freq = scale[bassNoteIdx] * 0.5; // octave down
      this.playBassNote(freq, time, 0.14);
    }

    // 5. Chiptune Square Lead (Arpeggiated retro square pulse)
    const leadNoteIdx = leadPattern[step];
    if (typeof leadNoteIdx === 'number' && leadNoteIdx >= 0 && scale[leadNoteIdx]) {
      const freq = scale[leadNoteIdx];
      this.playLeadNote(freq, time, isBattle ? 0.11 : 0.16);
    }
  }

  private playKick(time: number): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, time);
    osc.frequency.exponentialRampToValueAtTime(32, time + 0.09);

    gain.gain.setValueAtTime(0.42, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.11);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.12);
  }

  private playSnare(time: number): void {
    if (!this.ctx || !this.masterGain) return;

    // White noise burst buffer
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.1);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(950, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.24, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.095);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(time);
    noise.stop(time + 0.1);
  }

  private playHiHat(time: number, vol = 0.05): void {
    if (!this.ctx || !this.masterGain) return;

    const bufferSize = Math.floor(this.ctx.sampleRate * 0.04);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(5500, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.038);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(time);
    noise.stop(time + 0.04);
  }

  private playBassNote(freq: number, time: number, dur: number): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.26, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + dur + 0.01);
  }

  private playLeadNote(freq: number, time: number, dur: number): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Classic 8-bit square wave
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);
    // Subtle vibrato/arpeggio pitch transient
    osc.frequency.setValueAtTime(freq * 1.015, time + 0.03);
    osc.frequency.setValueAtTime(freq, time + 0.06);

    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + dur + 0.01);
  }
}

export const bgm = new ProceduralChiptuneEngine();
