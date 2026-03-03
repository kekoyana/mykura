import * as THREE from 'three';
import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT } from './chunk';
import { BlockType } from './blocks';
import { SimplexNoise } from './noise';
import { createTextureAtlas } from './textures';

const RENDER_DISTANCE = 5;
const WATER_LEVEL = 20;
const BASE_HEIGHT = 25;

type Biome = 'plains' | 'forest' | 'desert' | 'snow';

export class World {
  chunks = new Map<string, Chunk>();
  solidMaterial: THREE.MeshLambertMaterial;
  waterMaterial: THREE.MeshLambertMaterial;
  scene: THREE.Scene;
  private noise: SimplexNoise;
  private treeNoise: SimplexNoise;
  private caveNoise: SimplexNoise;
  private caveNoise2: SimplexNoise;
  private oreNoise: SimplexNoise;
  private biomeNoise: SimplexNoise;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.noise = new SimplexNoise(42);
    this.treeNoise = new SimplexNoise(123);
    this.caveNoise = new SimplexNoise(777);
    this.caveNoise2 = new SimplexNoise(888);
    this.oreNoise = new SimplexNoise(555);
    this.biomeNoise = new SimplexNoise(999);

    const atlas = createTextureAtlas();
    this.solidMaterial = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true });
    this.waterMaterial = new THREE.MeshLambertMaterial({
      map: atlas, vertexColors: true,
      transparent: true, opacity: 0.65, side: THREE.DoubleSide,
    });
  }

  private key(cx: number, cz: number) { return `${cx},${cz}`; }

  getBlock(wx: number, wy: number, wz: number): BlockType {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return BlockType.AIR;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.chunks.get(this.key(cx, cz));
    if (!chunk) return BlockType.AIR;
    return chunk.getBlock(((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE, wy, ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE);
  }

  setBlock(wx: number, wy: number, wz: number, type: BlockType) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.chunks.get(this.key(cx, cz));
    if (!chunk) return;
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    chunk.setBlock(lx, wy, lz, type);
    if (lx === 0) this.dirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.dirty(cx + 1, cz);
    if (lz === 0) this.dirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.dirty(cx, cz + 1);
  }

  private dirty(cx: number, cz: number) {
    const c = this.chunks.get(this.key(cx, cz));
    if (c) c.needsUpdate = true;
  }

  private getBiome(wx: number, wz: number): Biome {
    const v = this.biomeNoise.noise2d(wx * 0.004, wz * 0.004);
    if (v < -0.3) return 'desert';
    if (v > 0.4) return 'snow';
    if (v > 0.05) return 'forest';
    return 'plains';
  }

  private getHeight(wx: number, wz: number): number {
    const base = this.noise.fbm(wx * 0.008, wz * 0.008, 5, 2, 0.5);
    const detail = this.noise.fbm(wx * 0.03, wz * 0.03, 3, 2, 0.5) * 0.3;
    return Math.floor(BASE_HEIGHT + (base + detail) * 15);
  }

  private isCave(wx: number, wy: number, wz: number): boolean {
    const v1 = this.caveNoise.noise3d(wx * 0.04, wy * 0.06, wz * 0.04);
    const v2 = this.caveNoise2.noise3d(wx * 0.06 + 100, wy * 0.09 + 100, wz * 0.06 + 100);
    return Math.abs(v1) < 0.08 || Math.abs(v2) < 0.06;
  }

  private generateChunk(cx: number, cz: number): Chunk {
    const chunk = new Chunk(cx, cz);

    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        const h = this.getHeight(wx, wz);
        const biome = this.getBiome(wx, wz);

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          let bt = BlockType.AIR;

          if (y === 0) {
            bt = BlockType.BEDROCK;
          } else if (y < h - 4) {
            bt = BlockType.STONE;
          } else if (y < h) {
            bt = biome === 'desert' ? BlockType.SAND : BlockType.DIRT;
          } else if (y === h) {
            if (biome === 'desert') bt = BlockType.SAND;
            else if (biome === 'snow') bt = BlockType.SNOW;
            else if (h < WATER_LEVEL - 1) bt = BlockType.SAND;
            else bt = BlockType.GRASS;
          } else if (y <= WATER_LEVEL && y > h) {
            bt = BlockType.WATER;
          }

          // Caves (don't carve surface, bedrock, or underwater)
          if (bt !== BlockType.AIR && bt !== BlockType.WATER && bt !== BlockType.BEDROCK
              && y > 1 && y < h - 1 && this.isCave(wx, y, wz)) {
            bt = BlockType.AIR;
          }

          // Ores
          if (bt === BlockType.STONE) {
            const ov = this.oreNoise.noise3d(wx * 0.12, y * 0.12, wz * 0.12);
            if (y < 16 && ov > 0.65) bt = BlockType.DIAMOND_ORE;
            else if (y < 40 && ov > 0.55) bt = BlockType.IRON_ORE;
            else if (ov > 0.5) bt = BlockType.COAL_ORE;
          }

          chunk.setBlock(lx, y, lz, bt);
        }
      }
    }

    // Trees
    for (let lz = 2; lz < CHUNK_SIZE - 2; lz++) {
      for (let lx = 2; lx < CHUNK_SIZE - 2; lx++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        const h = this.getHeight(wx, wz);
        if (h <= WATER_LEVEL) continue;

        const biome = this.getBiome(wx, wz);
        if (biome === 'desert') continue;

        const threshold = biome === 'forest' ? 0.2 : biome === 'snow' ? 0.4 : 0.35;
        const tv = this.treeNoise.noise2d(wx * 0.5, wz * 0.5);
        if (tv > threshold && this.treeNoise.noise2d(wx * 3.7, wz * 3.7) > 0.2) {
          const th = 4 + Math.floor(Math.abs(this.treeNoise.noise2d(wx * 2, wz * 2)) * 3);
          for (let ty = 1; ty <= th; ty++) {
            chunk.setBlock(lx, h + ty, lz, BlockType.WOOD);
          }
          for (let ly = -2; ly <= 1; ly++) {
            const r = ly <= 0 ? 2 : 1;
            for (let dx = -r; dx <= r; dx++) {
              for (let dz = -r; dz <= r; dz++) {
                if (dx === 0 && dz === 0 && ly < 1) continue;
                if (Math.abs(dx) === r && Math.abs(dz) === r && this.treeNoise.noise2d(wx+dx, wz+dz) > 0) continue;
                const fx = lx + dx, fz = lz + dz, fy = h + th + ly;
                if (fx >= 0 && fx < CHUNK_SIZE && fz >= 0 && fz < CHUNK_SIZE && fy < CHUNK_HEIGHT) {
                  if (chunk.getBlock(fx, fy, fz) === BlockType.AIR)
                    chunk.setBlock(fx, fy, fz, BlockType.LEAVES);
                }
              }
            }
          }
        }
      }
    }

    chunk.needsUpdate = true;
    return chunk;
  }

  update(playerX: number, playerZ: number) {
    const pcx = Math.floor(playerX / CHUNK_SIZE);
    const pcz = Math.floor(playerZ / CHUNK_SIZE);

    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
      for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
        if (dx * dx + dz * dz > RENDER_DISTANCE * RENDER_DISTANCE + 1) continue;
        const cx = pcx + dx, cz = pcz + dz;
        const k = this.key(cx, cz);
        if (!this.chunks.has(k)) {
          this.chunks.set(k, this.generateChunk(cx, cz));
          this.dirty(cx - 1, cz); this.dirty(cx + 1, cz);
          this.dirty(cx, cz - 1); this.dirty(cx, cz + 1);
        }
      }
    }

    for (const [k, chunk] of this.chunks) {
      const [cx, cz] = k.split(',').map(Number);
      if (Math.abs(cx - pcx) > RENDER_DISTANCE + 2 || Math.abs(cz - pcz) > RENDER_DISTANCE + 2) {
        if (chunk.mesh) { this.scene.remove(chunk.mesh); chunk.mesh.geometry.dispose(); }
        if (chunk.waterMesh) { this.scene.remove(chunk.waterMesh); chunk.waterMesh.geometry.dispose(); }
        this.chunks.delete(k);
      }
    }

    // Rebuild dirty chunks sorted by distance
    const getNeighbor = (wx: number, wy: number, wz: number) => this.getBlock(wx, wy, wz);
    const dirtyChunks = [...this.chunks.values()].filter(c => c.needsUpdate);
    dirtyChunks.sort((a, b) =>
      ((a.cx - pcx) ** 2 + (a.cz - pcz) ** 2) - ((b.cx - pcx) ** 2 + (b.cz - pcz) ** 2)
    );

    for (let i = 0; i < Math.min(6, dirtyChunks.length); i++) {
      const chunk = dirtyChunks[i];
      chunk.buildMesh(this.solidMaterial, this.waterMaterial, getNeighbor);
      if (chunk.mesh && !chunk.mesh.parent) this.scene.add(chunk.mesh);
      if (chunk.waterMesh && !chunk.waterMesh.parent) this.scene.add(chunk.waterMesh);
    }
  }

  raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDist = 8) {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const sx = direction.x > 0 ? 1 : -1;
    const sy = direction.y > 0 ? 1 : -1;
    const sz = direction.z > 0 ? 1 : -1;
    const tdx = direction.x === 0 ? Infinity : Math.abs(1 / direction.x);
    const tdy = direction.y === 0 ? Infinity : Math.abs(1 / direction.y);
    const tdz = direction.z === 0 ? Infinity : Math.abs(1 / direction.z);
    let tmx = direction.x === 0 ? Infinity : ((direction.x > 0 ? x + 1 : x) - origin.x) / direction.x;
    let tmy = direction.y === 0 ? Infinity : ((direction.y > 0 ? y + 1 : y) - origin.y) / direction.y;
    let tmz = direction.z === 0 ? Infinity : ((direction.z > 0 ? z + 1 : z) - origin.z) / direction.z;
    let nx = 0, ny = 0, nz = 0;

    for (let i = 0; i < maxDist * 3; i++) {
      const block = this.getBlock(x, y, z);
      if (block !== BlockType.AIR && block !== BlockType.WATER)
        return { pos: [x, y, z] as [number, number, number], normal: [nx, ny, nz] as [number, number, number], block };
      if (tmx < tmy) {
        if (tmx < tmz) { if (tmx > maxDist) break; x += sx; tmx += tdx; nx = -sx; ny = 0; nz = 0; }
        else { if (tmz > maxDist) break; z += sz; tmz += tdz; nx = 0; ny = 0; nz = -sz; }
      } else {
        if (tmy < tmz) { if (tmy > maxDist) break; y += sy; tmy += tdy; nx = 0; ny = -sy; nz = 0; }
        else { if (tmz > maxDist) break; z += sz; tmz += tdz; nx = 0; ny = 0; nz = -sz; }
      }
    }
    return null;
  }

  getSpawnHeight(wx: number, wz: number): number {
    return Math.max(this.getHeight(wx, wz) + 2, WATER_LEVEL + 2);
  }
}
