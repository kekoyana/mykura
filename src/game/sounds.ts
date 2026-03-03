export class SoundManager {
  private ctx: AudioContext | null = null;

  private ensure() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  playBreak() {
    const ctx = this.ensure();
    const len = ctx.sampleRate * 0.12;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.25;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = 0.4;
    src.connect(gain).connect(ctx.destination);
    src.start();
  }

  playPlace() {
    const ctx = this.ensure();
    const len = ctx.sampleRate * 0.08;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / ctx.sampleRate;
      d[i] = Math.sin(t * 800 * Math.PI * 2) * (1 - i / len) * 0.15
            + (Math.random() * 2 - 1) * (1 - i / len) * 0.1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = 0.35;
    src.connect(gain).connect(ctx.destination);
    src.start();
  }
}
