import * as THREE from 'three';
import { World } from './world';
import { BlockType, BLOCKS } from './blocks';

const WALK_SPEED = 4.5;
const SPRINT_SPEED = 7;
const SWIM_SPEED = 3;
const JUMP_SPEED = 7.5;
const GRAVITY = 20;
const WATER_GRAVITY = 5;
const PLAYER_HEIGHT = 1.7;
const PLAYER_WIDTH = 0.3;
const MOUSE_SENS = 0.002;

export class Player {
  camera: THREE.PerspectiveCamera;
  position: THREE.Vector3;
  velocity = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  onGround = false;
  inWater = false;
  sprinting = false;
  private keys = new Set<string>();
  private world: World;

  constructor(camera: THREE.PerspectiveCamera, world: World, sx: number, sz: number) {
    this.camera = camera;
    this.world = world;
    this.position = new THREE.Vector3(sx + 0.5, world.getSpawnHeight(sx, sz), sz + 0.5);
  }

  onMouseMove(dx: number, dy: number) {
    this.yaw -= dx * MOUSE_SENS;
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch - dy * MOUSE_SENS));
  }

  onKeyDown(key: string) { this.keys.add(key.toLowerCase()); }
  onKeyUp(key: string) { this.keys.delete(key.toLowerCase()); }

  getForward(): THREE.Vector3 {
    return new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    ).normalize();
  }

  update(dt: number) {
    // Check water
    const headY = this.position.y + PLAYER_HEIGHT - 0.3;
    const headBlock = this.world.getBlock(Math.floor(this.position.x), Math.floor(headY), Math.floor(this.position.z));
    this.inWater = headBlock === BlockType.WATER;
    const feetBlock = this.world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y), Math.floor(this.position.z));
    const feetInWater = feetBlock === BlockType.WATER;

    // Sprint
    this.sprinting = this.keys.has('shift') && !this.inWater;

    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const move = new THREE.Vector3();
    if (this.keys.has('w') || this.keys.has('arrowup')) move.add(fwd);
    if (this.keys.has('s') || this.keys.has('arrowdown')) move.sub(fwd);
    if (this.keys.has('a') || this.keys.has('arrowleft')) move.sub(right);
    if (this.keys.has('d') || this.keys.has('arrowright')) move.add(right);
    if (move.lengthSq() > 0) move.normalize();

    const speed = feetInWater ? SWIM_SPEED : this.sprinting ? SPRINT_SPEED : WALK_SPEED;
    this.velocity.x = move.x * speed;
    this.velocity.z = move.z * speed;

    if (this.keys.has(' ')) {
      if (feetInWater || this.inWater) {
        this.velocity.y = 3.5; // Swim up
      } else if (this.onGround) {
        this.velocity.y = JUMP_SPEED;
        this.onGround = false;
      }
    }

    this.velocity.y -= (feetInWater ? WATER_GRAVITY : GRAVITY) * dt;
    if (feetInWater) this.velocity.y *= 0.9; // Water drag

    this.moveAxis(0, this.velocity.x * dt);
    this.moveAxis(1, this.velocity.y * dt);
    this.moveAxis(2, this.velocity.z * dt);

    this.camera.position.set(this.position.x, this.position.y + PLAYER_HEIGHT - 0.3, this.position.z);
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }

  private moveAxis(axis: number, delta: number) {
    const p = this.position;
    const old = axis === 0 ? p.x : axis === 1 ? p.y : p.z;
    if (axis === 0) p.x += delta;
    else if (axis === 1) p.y += delta;
    else p.z += delta;

    if (this.collides()) {
      if (axis === 0) p.x = old;
      else if (axis === 1) { p.y = old; if (delta < 0) this.onGround = true; this.velocity.y = 0; }
      else p.z = old;
    } else if (axis === 1) {
      this.onGround = false;
    }
  }

  private collides(): boolean {
    const p = this.position;
    for (let bx = Math.floor(p.x - PLAYER_WIDTH); bx <= Math.floor(p.x + PLAYER_WIDTH); bx++)
      for (let by = Math.floor(p.y); by <= Math.floor(p.y + PLAYER_HEIGHT); by++)
        for (let bz = Math.floor(p.z - PLAYER_WIDTH); bz <= Math.floor(p.z + PLAYER_WIDTH); bz++) {
          const b = this.world.getBlock(bx, by, bz);
          if (b === BlockType.AIR) continue;
          const bi = BLOCKS[b];
          if (bi && !bi.solid) continue;
          return true;
        }
    return false;
  }
}
