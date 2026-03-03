import * as THREE from 'three';
import { World } from './world';
import { Player } from './player';
import { BlockType, BLOCKS, HOTBAR_BLOCKS } from './blocks';
import { ParticleSystem } from './particles';
import { SoundManager } from './sounds';
import { CloudLayer } from './clouds';

const DAY_COLOR = new THREE.Color(0x87ceeb);
const NIGHT_COLOR = new THREE.Color(0x0a0a2e);
const DAWN_COLOR = new THREE.Color(0xf4845f);

export class Engine {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  world: World;
  player: Player;
  particles: ParticleSystem;
  sounds: SoundManager;
  clouds: CloudLayer;
  selectedSlot = 0;

  private highlight: THREE.LineSegments;
  private ambientLight: THREE.AmbientLight;
  private sunLight: THREE.DirectionalLight;
  private lastTime = 0;
  private rafId = 0;
  private locked = false;
  private dayTime = 0.3; // 0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk
  private fps = 0;
  private frameCount = 0;
  private fpsTimer = 0;

  onHotbarChange?: (i: number) => void;
  onPositionChange?: (p: { x: number; y: number; z: number }) => void;
  onLockChange?: (locked: boolean) => void;
  onTimeChange?: (dayTime: number) => void;
  onFpsChange?: (fps: number) => void;
  onInventoryToggle?: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(DAY_COLOR);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(DAY_COLOR, 55, 85);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.sunLight.position.set(50, 100, 30);
    this.scene.add(this.sunLight);

    this.world = new World(this.scene);
    this.player = new Player(this.camera, this.world, 0, 0);
    this.particles = new ParticleSystem(this.scene);
    this.sounds = new SoundManager();
    this.clouds = new CloudLayer(this.scene);

    const hlEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.005, 1.005, 1.005));
    this.highlight = new THREE.LineSegments(hlEdges, new THREE.LineBasicMaterial({ color: 0x000000 }));
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    this.bind(canvas);
    this.world.update(this.player.position.x, this.player.position.z);
  }

  private bind(canvas: HTMLCanvasElement) {
    canvas.addEventListener('click', () => { if (!this.locked) canvas.requestPointerLock(); });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      this.onLockChange?.(this.locked);
    });

    document.addEventListener('mousemove', (e) => {
      if (this.locked) this.player.onMouseMove(e.movementX, e.movementY);
    });

    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      const hit = this.world.raycast(this.camera.position, this.player.getForward());
      if (!hit) return;

      if (e.button === 0) {
        // Break block
        const blockInfo = BLOCKS[hit.block];
        if (blockInfo) {
          const color = new THREE.Color(blockInfo.color);
          this.particles.emit(
            new THREE.Vector3(hit.pos[0] + 0.5, hit.pos[1] + 0.5, hit.pos[2] + 0.5),
            color, 15
          );
        }
        this.world.setBlock(hit.pos[0], hit.pos[1], hit.pos[2], BlockType.AIR);
        this.sounds.playBreak();
      } else if (e.button === 2) {
        // Place block
        const px = hit.pos[0] + hit.normal[0];
        const py = hit.pos[1] + hit.normal[1];
        const pz = hit.pos[2] + hit.normal[2];
        // Don't place inside player
        const pp = this.player.position;
        const playerBlocks: [number, number, number][] = [];
        for (let dy = 0; dy < 2; dy++) {
          playerBlocks.push([Math.floor(pp.x), Math.floor(pp.y + dy), Math.floor(pp.z)]);
        }
        if (playerBlocks.some(([bx, by, bz]) => bx === px && by === py && bz === pz)) return;
        this.world.setBlock(px, py, pz, HOTBAR_BLOCKS[this.selectedSlot]);
        this.sounds.playPlace();
      }
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('wheel', (e) => {
      if (!this.locked) return;
      e.preventDefault();
      const len = HOTBAR_BLOCKS.length;
      this.selectedSlot = ((this.selectedSlot + (e.deltaY > 0 ? 1 : -1)) % len + len) % len;
      this.onHotbarChange?.(this.selectedSlot);
    }, { passive: false });

    document.addEventListener('keydown', (e) => {
      this.player.onKeyDown(e.key);
      const n = parseInt(e.key);
      if (n >= 1 && n <= 9) {
        this.selectedSlot = n - 1;
        this.onHotbarChange?.(this.selectedSlot);
      }
      if (e.key.toLowerCase() === 'e' && this.locked) {
        this.onInventoryToggle?.();
      }
    });

    document.addEventListener('keyup', (e) => this.player.onKeyUp(e.key));

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  selectBlock(blockType: number) {
    const idx = HOTBAR_BLOCKS.indexOf(blockType);
    if (idx >= 0) {
      this.selectedSlot = idx;
      this.onHotbarChange?.(idx);
    } else {
      // Replace current slot
      HOTBAR_BLOCKS[this.selectedSlot] = blockType;
      this.onHotbarChange?.(this.selectedSlot);
    }
  }

  start() { this.lastTime = performance.now(); this.loop(); }
  stop() { cancelAnimationFrame(this.rafId); }

  private loop = () => {
    this.rafId = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    // FPS counter
    this.frameCount++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.fps = Math.round(this.frameCount / this.fpsTimer);
      this.onFpsChange?.(this.fps);
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    // Day/night cycle
    this.dayTime = (this.dayTime + dt * 0.008) % 1;
    this.updateLighting();

    this.player.update(dt);
    this.world.update(this.player.position.x, this.player.position.z);
    this.particles.update(dt);
    this.clouds.update(dt, this.player.position.x, this.player.position.z);

    // Water tint
    if (this.player.inWater) {
      this.scene.fog = new THREE.Fog(0x1040a0, 2, 15);
      this.renderer.setClearColor(0x1040a0);
    }

    // Block highlight
    if (this.locked) {
      const hit = this.world.raycast(this.camera.position, this.player.getForward());
      if (hit) {
        this.highlight.position.set(hit.pos[0] + 0.5, hit.pos[1] + 0.5, hit.pos[2] + 0.5);
        this.highlight.visible = true;
      } else {
        this.highlight.visible = false;
      }
    } else {
      this.highlight.visible = false;
    }

    this.onPositionChange?.({
      x: Math.floor(this.player.position.x),
      y: Math.floor(this.player.position.y),
      z: Math.floor(this.player.position.z),
    });
    this.onTimeChange?.(this.dayTime);

    this.renderer.render(this.scene, this.camera);
  };

  private updateLighting() {
    const sunAngle = this.dayTime * Math.PI * 2 - Math.PI / 2;
    const sunHeight = Math.sin(sunAngle);
    const dayFactor = Math.max(0, Math.min(1, sunHeight * 2.5 + 0.5));

    // Sun position
    this.sunLight.position.set(Math.cos(sunAngle) * 80, Math.sin(sunAngle) * 80, 30);

    // Sky color with dawn/dusk transition
    const isDawnDusk = Math.abs(dayFactor - 0.5) < 0.3;
    const skyColor = new THREE.Color();
    if (isDawnDusk && dayFactor > 0.2 && dayFactor < 0.8) {
      const dawnFactor = 1 - Math.abs(dayFactor - 0.5) / 0.3;
      skyColor.lerpColors(
        new THREE.Color().lerpColors(NIGHT_COLOR, DAY_COLOR, dayFactor),
        DAWN_COLOR,
        dawnFactor * 0.4
      );
    } else {
      skyColor.lerpColors(NIGHT_COLOR, DAY_COLOR, dayFactor);
    }

    if (!this.player.inWater) {
      this.renderer.setClearColor(skyColor);
      this.scene.fog = new THREE.Fog(skyColor, 55, 85);
    }

    // Light intensities
    this.ambientLight.intensity = 0.15 + dayFactor * 0.5;
    this.sunLight.intensity = dayFactor * 0.85;
    this.sunLight.color.lerpColors(new THREE.Color(0x4466aa), new THREE.Color(0xffffff), dayFactor);

    // Clouds
    this.clouds.setOpacity(dayFactor);
  }
}
