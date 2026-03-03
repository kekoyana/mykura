import * as THREE from 'three';

interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  r: number; g: number; b: number;
  life: number;
}

const MAX = 300;

export class ParticleSystem {
  private particles: Particle[] = [];
  private geometry: THREE.BufferGeometry;
  private points: THREE.Points;

  constructor(scene: THREE.Scene) {
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    this.geometry.setDrawRange(0, 0);

    this.points = new THREE.Points(this.geometry, new THREE.PointsMaterial({
      size: 0.12, vertexColors: true, transparent: true, depthWrite: false,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  emit(pos: THREE.Vector3, color: THREE.Color, count: number) {
    for (let i = 0; i < count && this.particles.length < MAX; i++) {
      this.particles.push({
        x: pos.x + (Math.random() - 0.5) * 0.8,
        y: pos.y + (Math.random() - 0.5) * 0.8,
        z: pos.z + (Math.random() - 0.5) * 0.8,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 5 + 1,
        vz: (Math.random() - 0.5) * 4,
        r: color.r, g: color.g, b: color.b,
        life: 0.5 + Math.random() * 0.5,
      });
    }
  }

  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vy -= 12 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = this.geometry.getAttribute('color') as THREE.BufferAttribute;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      posAttr.setXYZ(i, p.x, p.y, p.z);
      const fade = Math.max(0, p.life * 2);
      colAttr.setXYZ(i, p.r * fade, p.g * fade, p.b * fade);
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    this.geometry.setDrawRange(0, this.particles.length);
  }
}
