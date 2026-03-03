import * as THREE from 'three';
import { BlockType, BLOCKS } from './blocks';
import { getAtlasUV } from './textures';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64;

const AO_CURVE = [0.4, 0.65, 0.85, 1.0];

const FACES = [
  { dir: [0, 1, 0] as const, corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], texIdx: 0 },  // +Y top
  { dir: [0,-1, 0] as const, corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], texIdx: 2 },  // -Y bottom
  { dir: [1, 0, 0] as const, corners: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]], texIdx: 1 },  // +X
  { dir: [-1,0, 0] as const, corners: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]], texIdx: 1 },  // -X
  { dir: [0, 0, 1] as const, corners: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]], texIdx: 1 },  // +Z
  { dir: [0, 0,-1] as const, corners: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]], texIdx: 1 },  // -Z
];

function computeAO(
  bx: number, by: number, bz: number,
  corner: number[], dir: readonly number[],
  solid: (x: number, y: number, z: number) => boolean,
): number {
  const tangents: [number, number][] = [];
  for (let i = 0; i < 3; i++) {
    if (dir[i] === 0) tangents.push([i, corner[i] * 2 - 1]);
  }
  const s1 = [bx + dir[0], by + dir[1], bz + dir[2]];
  s1[tangents[0][0]] += tangents[0][1];
  const s2 = [bx + dir[0], by + dir[1], bz + dir[2]];
  s2[tangents[1][0]] += tangents[1][1];
  const cn = [bx + dir[0], by + dir[1], bz + dir[2]];
  cn[tangents[0][0]] += tangents[0][1];
  cn[tangents[1][0]] += tangents[1][1];

  const a = solid(s1[0], s1[1], s1[2]) ? 1 : 0;
  const b = solid(s2[0], s2[1], s2[2]) ? 1 : 0;
  const c = solid(cn[0], cn[1], cn[2]) ? 1 : 0;
  if (a && b) return 0;
  return 3 - (a + b + c);
}

export class Chunk {
  cx: number;
  cz: number;
  blocks: Uint8Array;
  mesh: THREE.Mesh | null = null;
  waterMesh: THREE.Mesh | null = null;
  needsUpdate = true;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
  }

  getBlock(x: number, y: number, z: number): BlockType {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE)
      return BlockType.AIR;
    return this.blocks[y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x];
  }

  setBlock(x: number, y: number, z: number, type: BlockType) {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) return;
    this.blocks[y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x] = type;
    this.needsUpdate = true;
  }

  buildMesh(
    solidMat: THREE.Material, waterMat: THREE.Material,
    getNeighbor: (wx: number, wy: number, wz: number) => BlockType,
  ) {
    const solid = { pos: [] as number[], norm: [] as number[], uv: [] as number[], col: [] as number[], idx: [] as number[], v: 0 };
    const water = { pos: [] as number[], norm: [] as number[], uv: [] as number[], col: [] as number[], idx: [] as number[], v: 0 };

    const wx0 = this.cx * CHUNK_SIZE;
    const wz0 = this.cz * CHUNK_SIZE;

    const isSolid = (wx: number, wy: number, wz: number): boolean => {
      if (wy < 0 || wy >= CHUNK_HEIGHT) return false;
      const lx = wx - wx0, lz = wz - wz0;
      const bt = (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE)
        ? this.getBlock(lx, wy, lz) : getNeighbor(wx, wy, wz);
      if (bt === BlockType.AIR) return false;
      const info = BLOCKS[bt];
      return info ? !info.transparent : false;
    };

    const getBlockAt = (lx: number, ly: number, lz: number): BlockType => {
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || ly < 0 || ly >= CHUNK_HEIGHT)
        return getNeighbor(wx0 + lx, ly, wz0 + lz);
      return this.getBlock(lx, ly, lz);
    };

    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const bt = this.getBlock(x, y, z);
          if (bt === BlockType.AIR) continue;
          const info = BLOCKS[bt];
          if (!info) continue;
          const isLiquid = info.liquid;
          const buf = isLiquid ? water : solid;
          const rt = info.renderType;

          // Cross-shaped rendering (flowers, tall grass)
          if (rt === 'cross') {
            const texId = info.textures[1];
            const [u0, v0, u1, v1] = getAtlasUV(texId);
            const bx = wx0 + x, bz = wz0 + z;
            // Two diagonal quads
            const crossQuads = [
              [[0,0,0],[1,0,1],[1,1,1],[0,1,0]], // diagonal 1
              [[0,0,1],[1,0,0],[1,1,0],[0,1,1]], // diagonal 2
            ];
            for (const quad of crossQuads) {
              for (const c of quad) {
                buf.pos.push(bx + c[0], y + c[1], bz + c[2]);
                buf.norm.push(0, 1, 0);
                buf.col.push(1, 1, 1);
              }
              buf.uv.push(u0,v0, u1,v0, u1,v1, u0,v1);
              buf.idx.push(buf.v, buf.v+1, buf.v+2, buf.v, buf.v+2, buf.v+3);
              buf.v += 4;
              // Back face
              for (const c of [...quad].reverse()) {
                buf.pos.push(bx + c[0], y + c[1], bz + c[2]);
                buf.norm.push(0, 1, 0);
                buf.col.push(1, 1, 1);
              }
              buf.uv.push(u0,v0, u1,v0, u1,v1, u0,v1);
              buf.idx.push(buf.v, buf.v+1, buf.v+2, buf.v, buf.v+2, buf.v+3);
              buf.v += 4;
            }
            continue;
          }

          // Torch rendering (thin pillar)
          if (rt === 'torch') {
            const texId = info.textures[1];
            const [u0, v0, u1, v1] = getAtlasUV(texId);
            const bx = wx0 + x, bz = wz0 + z;
            const inset = 0.35;
            // 4 side faces of thin pillar
            const torchFaces = [
              { corners: [[1-inset,0,1-inset],[1-inset,0,inset],[1-inset,1,inset],[1-inset,1,1-inset]], n: [1,0,0] },
              { corners: [[inset,0,inset],[inset,0,1-inset],[inset,1,1-inset],[inset,1,inset]], n: [-1,0,0] },
              { corners: [[inset,0,1-inset],[1-inset,0,1-inset],[1-inset,1,1-inset],[inset,1,1-inset]], n: [0,0,1] },
              { corners: [[1-inset,0,inset],[inset,0,inset],[inset,1,inset],[1-inset,1,inset]], n: [0,0,-1] },
            ];
            for (const tf of torchFaces) {
              for (const c of tf.corners) {
                buf.pos.push(bx + c[0], y + c[1], bz + c[2]);
                buf.norm.push(tf.n[0], tf.n[1], tf.n[2]);
                buf.col.push(1, 1, 1);
              }
              buf.uv.push(u0,v0, u1,v0, u1,v1, u0,v1);
              buf.idx.push(buf.v, buf.v+1, buf.v+2, buf.v, buf.v+2, buf.v+3);
              buf.v += 4;
            }
            // Top face
            const [tu0, tv0, tu1, tv1] = getAtlasUV(info.textures[0]);
            const topCorners = [[inset,1,1-inset],[1-inset,1,1-inset],[1-inset,1,inset],[inset,1,inset]];
            for (const c of topCorners) {
              buf.pos.push(bx + c[0], y + c[1], bz + c[2]);
              buf.norm.push(0, 1, 0);
              buf.col.push(1, 1, 1);
            }
            buf.uv.push(tu0,tv0, tu1,tv0, tu1,tv1, tu0,tv1);
            buf.idx.push(buf.v, buf.v+1, buf.v+2, buf.v, buf.v+2, buf.v+3);
            buf.v += 4;
            continue;
          }

          // Cactus rendering (slightly inset from edges)
          if (rt === 'cactus') {
            const bx = wx0 + x, bz = wz0 + z;
            const ci = 0.0625; // 1/16 inset
            const cactusFaces = [
              { corners: [[1-ci,0,1],[1-ci,0,0],[1-ci,1,0],[1-ci,1,1]], n: [1,0,0], texIdx: 1 },
              { corners: [[ci,0,0],[ci,0,1],[ci,1,1],[ci,1,0]], n: [-1,0,0], texIdx: 1 },
              { corners: [[0,0,1-ci],[1,0,1-ci],[1,1,1-ci],[0,1,1-ci]], n: [0,0,1], texIdx: 1 },
              { corners: [[1,0,ci],[0,0,ci],[0,1,ci],[1,1,ci]], n: [0,0,-1], texIdx: 1 },
              { corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], n: [0,1,0], texIdx: 0 },
              { corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], n: [0,-1,0], texIdx: 2 },
            ];
            for (const cf of cactusFaces) {
              const texId = info.textures[cf.texIdx];
              const [cu0, cv0, cu1, cv1] = getAtlasUV(texId);
              for (const c of cf.corners) {
                buf.pos.push(bx + c[0], y + c[1], bz + c[2]);
                buf.norm.push(cf.n[0], cf.n[1], cf.n[2]);
                buf.col.push(1, 1, 1);
              }
              buf.uv.push(cu0,cv0, cu1,cv0, cu1,cv1, cu0,cv1);
              buf.idx.push(buf.v, buf.v+1, buf.v+2, buf.v, buf.v+2, buf.v+3);
              buf.v += 4;
            }
            continue;
          }

          // Standard block rendering
          for (const face of FACES) {
            const nx = x + face.dir[0], ny = y + face.dir[1], nz = z + face.dir[2];
            const neighbor = getBlockAt(nx, ny, nz);

            if (neighbor !== BlockType.AIR) {
              const nInfo = BLOCKS[neighbor];
              if (nInfo && !nInfo.transparent) continue;
              if (neighbor === bt) continue;
            }

            const texId = info.textures[face.texIdx];
            const [u0, v0, u1, v1] = getAtlasUV(texId);

            const aoVals: number[] = [];
            for (const c of face.corners) {
              if (isLiquid) {
                aoVals.push(3);
              } else {
                aoVals.push(computeAO(wx0 + x, y, wz0 + z, c, face.dir, isSolid));
              }
            }

            for (let i = 0; i < 4; i++) {
              const c = face.corners[i];
              let cy = c[1];
              if (isLiquid && face.texIdx === 0 && cy === 1) cy = 0.85;
              buf.pos.push(wx0 + x + c[0], y + cy, wz0 + z + c[2]);
              buf.norm.push(face.dir[0], face.dir[1], face.dir[2]);
              const ao = AO_CURVE[aoVals[i]];
              buf.col.push(ao, ao, ao);
            }
            buf.uv.push(u0,v0, u1,v0, u1,v1, u0,v1);

            if (aoVals[0] + aoVals[2] > aoVals[1] + aoVals[3]) {
              buf.idx.push(buf.v, buf.v+1, buf.v+2, buf.v, buf.v+2, buf.v+3);
            } else {
              buf.idx.push(buf.v+1, buf.v+2, buf.v+3, buf.v+1, buf.v+3, buf.v);
            }
            buf.v += 4;
          }
        }
      }
    }

    this.mesh = this.buildGeo(solid, solidMat, this.mesh);
    this.waterMesh = this.buildGeo(water, waterMat, this.waterMesh);
    this.needsUpdate = false;
  }

  private buildGeo(
    buf: { pos: number[]; norm: number[]; uv: number[]; col: number[]; idx: number[] },
    mat: THREE.Material,
    existing: THREE.Mesh | null,
  ): THREE.Mesh | null {
    if (buf.pos.length === 0) {
      if (existing) {
        existing.geometry.dispose();
        existing.removeFromParent();
      }
      return null;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(buf.norm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(buf.col, 3));
    geo.setIndex(buf.idx);
    if (existing) {
      existing.geometry.dispose();
      existing.geometry = geo;
      return existing;
    }
    return new THREE.Mesh(geo, mat);
  }
}
