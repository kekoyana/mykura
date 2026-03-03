import * as THREE from 'three';
import { SimplexNoise } from './noise';

const STAR_COUNT = 400;
const STAR_SPHERE_RADIUS = 140;
const SUN_ORBIT_RADIUS = 110;
const MOON_ORBIT_RADIUS = 110;
const SUN_VISUAL_RADIUS = 5;
const MOON_VISUAL_RADIUS = 4;

function createCircleTexture(size: number, color: [number, number, number], glow: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;

  if (glow) {
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 1.0)`);
    gradient.addColorStop(0.3, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.8)`);
    gradient.addColorStop(0.7, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.3)`);
    gradient.addColorStop(1, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  } else {
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 1.0)`);
    gradient.addColorStop(0.8, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.9)`);
    gradient.addColorStop(1, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createStars(scene: THREE.Scene): { points: THREE.Points; geometry: THREE.BufferGeometry; material: THREE.PointsMaterial } {
  const noise = new SimplexNoise(42);
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);

  for (let i = 0; i < STAR_COUNT; i++) {
    // Distribute points on a sphere using spherical coordinates with noise-based variation
    const theta = Math.acos(2 * noise.noise2d(i * 0.1, 0.0) * 0.5 + 2 * (i / STAR_COUNT) - 1);
    const phi = 2 * Math.PI * ((i * 1.618033988749895) % 1); // golden ratio distribution

    const r = STAR_SPHERE_RADIUS;
    positions[i * 3] = r * Math.sin(theta) * Math.cos(phi);
    positions[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
    positions[i * 3 + 2] = r * Math.cos(theta);

    // White to slightly blue colors with varying brightness
    const brightness = 0.5 + 0.5 * Math.abs(noise.noise2d(i * 0.3, 7.7));
    const blueShift = 0.05 * Math.abs(noise.noise2d(i * 0.5, 13.3));
    colors[i * 3] = brightness * (1.0 - blueShift);
    colors[i * 3 + 1] = brightness * (1.0 - blueShift * 0.5);
    colors[i * 3 + 2] = brightness;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.8,
    transparent: true,
    opacity: 1.0,
    vertexColors: true,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  return { points, geometry, material };
}

function createSun(scene: THREE.Scene): THREE.Sprite {
  const texture = createCircleTexture(128, [255, 220, 80], true);
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: 0xffdd55,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(SUN_VISUAL_RADIUS * 2, SUN_VISUAL_RADIUS * 2, 1);
  scene.add(sprite);
  return sprite;
}

function createMoon(scene: THREE.Scene): THREE.Sprite {
  const texture = createCircleTexture(128, [220, 220, 235], false);
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: 0xddddef,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(MOON_VISUAL_RADIUS * 2, MOON_VISUAL_RADIUS * 2, 1);
  scene.add(sprite);
  return sprite;
}

export class SkySystem {
  private stars: {
    points: THREE.Points;
    geometry: THREE.BufferGeometry;
    material: THREE.PointsMaterial;
  };
  private sun: THREE.Sprite;
  private moon: THREE.Sprite;

  constructor(scene: THREE.Scene) {
    this.stars = createStars(scene);
    this.sun = createSun(scene);
    this.moon = createMoon(scene);
  }

  update(dayTime: number, playerPos: THREE.Vector3): void {
    // dayTime: 0 = midnight, 0.5 = noon
    // dayFactor: 0 at night, 1 at noon
    const sunAngle = dayTime * Math.PI * 2 - Math.PI / 2;

    // Compute a dayFactor based on the sun's vertical position.
    // sin(sunAngle) gives us how high the sun is: 1 at noon, -1 at midnight.
    const sinSun = Math.sin(sunAngle);
    // Map to 0..1: above horizon = day, below = night
    const dayFactor = Math.max(0, Math.min(1, sinSun * 2 + 0.5));

    // --- Stars ---
    // Visible at night (dayFactor < 0.3), fade smoothly in/out
    let starOpacity: number;
    if (dayFactor < 0.2) {
      starOpacity = 1.0;
    } else if (dayFactor < 0.4) {
      starOpacity = 1.0 - (dayFactor - 0.2) / 0.2;
    } else {
      starOpacity = 0.0;
    }
    this.stars.material.opacity = starOpacity;
    this.stars.points.visible = starOpacity > 0.001;

    // Stars follow the player
    this.stars.points.position.set(playerPos.x, playerPos.y, playerPos.z);

    // --- Sun ---
    const sunX = playerPos.x + Math.cos(sunAngle) * SUN_ORBIT_RADIUS;
    const sunY = playerPos.y + Math.sin(sunAngle) * SUN_ORBIT_RADIUS;
    const sunZ = playerPos.z;
    this.sun.position.set(sunX, sunY, sunZ);

    // Fade sun near horizon
    const sunVisibility = Math.max(0, Math.min(1, sinSun * 3 + 0.5));
    (this.sun.material as THREE.SpriteMaterial).opacity = sunVisibility;
    this.sun.visible = sunVisibility > 0.001;

    // --- Moon ---
    const moonAngle = sunAngle + Math.PI;
    const moonX = playerPos.x + Math.cos(moonAngle) * MOON_ORBIT_RADIUS;
    const moonY = playerPos.y + Math.sin(moonAngle) * MOON_ORBIT_RADIUS;
    const moonZ = playerPos.z;
    this.moon.position.set(moonX, moonY, moonZ);

    // Fade moon near horizon
    const sinMoon = Math.sin(moonAngle);
    const moonVisibility = Math.max(0, Math.min(1, sinMoon * 3 + 0.5));
    (this.moon.material as THREE.SpriteMaterial).opacity = moonVisibility;
    this.moon.visible = moonVisibility > 0.001;
  }

  dispose(): void {
    // Stars
    this.stars.geometry.dispose();
    this.stars.material.dispose();
    if (this.stars.points.parent) {
      this.stars.points.parent.remove(this.stars.points);
    }

    // Sun
    const sunMat = this.sun.material as THREE.SpriteMaterial;
    if (sunMat.map) sunMat.map.dispose();
    sunMat.dispose();
    if (this.sun.parent) {
      this.sun.parent.remove(this.sun);
    }

    // Moon
    const moonMat = this.moon.material as THREE.SpriteMaterial;
    if (moonMat.map) moonMat.map.dispose();
    moonMat.dispose();
    if (this.moon.parent) {
      this.moon.parent.remove(this.moon);
    }
  }
}
