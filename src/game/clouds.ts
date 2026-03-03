import * as THREE from 'three';
import { SimplexNoise } from './noise';

export class CloudLayer {
  mesh: THREE.Mesh;
  private offset = 0;

  constructor(scene: THREE.Scene) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const noise = new SimplexNoise(314);

    const imageData = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const v = noise.fbm(x * 0.015, y * 0.015, 4, 2, 0.5);
        const alpha = Math.max(0, Math.min(255, (v + 0.1) * 300));
        const i = (y * size + x) * 4;
        imageData.data[i] = 255;
        imageData.data[i + 1] = 255;
        imageData.data[i + 2] = 255;
        imageData.data[i + 3] = alpha;
      }
    }
    ctx.putImageData(imageData, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;

    const geo = new THREE.PlaneGeometry(300, 300);
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0.5,
      side: THREE.DoubleSide, depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 55;
    scene.add(this.mesh);
  }

  update(dt: number, playerX: number, playerZ: number) {
    this.offset += dt * 1.5;
    this.mesh.position.x = playerX;
    this.mesh.position.z = playerZ;
    const tex = (this.mesh.material as THREE.MeshBasicMaterial).map!;
    tex.offset.x = this.offset * 0.002;
  }

  setOpacity(v: number) {
    (this.mesh.material as THREE.MeshBasicMaterial).opacity = v * 0.5;
  }
}
