import * as THREE from 'three';

const TEX_SIZE = 16;
const ATLAS_COLS = 4;
const ATLAS_ROWS = 5; // 20 slots

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

type Pattern = 'solid' | 'grass_top' | 'grass_side' | 'wood_side' | 'wood_top'
  | 'stone' | 'leaves' | 'water' | 'bedrock' | 'ore' | 'glass';

function drawTexture(
  ctx: CanvasRenderingContext2D, ox: number, oy: number,
  baseColor: string, pattern: Pattern, oreColor?: string,
) {
  const [r, g, b] = hexToRgb(baseColor);
  const [gr, gg, gb] = hexToRgb('#5B9A3C');
  let seed = ox * 1000 + oy * 7 + 1;
  const rand = () => { seed = (seed * 16807 + 7) % 2147483647; return seed / 2147483647; };

  for (let py = 0; py < TEX_SIZE; py++) {
    for (let px = 0; px < TEX_SIZE; px++) {
      let cr = r, cg = g, cb = b;
      const n = (rand() - 0.5) * 30;

      switch (pattern) {
        case 'grass_top':
          cr = r + n * 0.8; cg = g + n; cb = b + n * 0.5; break;
        case 'grass_side':
          if (py < 3) { cr = gr + n * 0.8; cg = gg + n; cb = gb + n * 0.5; }
          else { cr = r + n; cg = g + n * 0.8; cb = b + n * 0.5; }
          break;
        case 'stone':
          cr = r + n * 1.5; cg = g + n * 1.5; cb = b + n * 1.5;
          if (rand() < 0.05) { cr -= 30; cg -= 30; cb -= 30; }
          break;
        case 'wood_side': {
          const bark = Math.sin(px * 1.5) * 15 + n * 0.5;
          cr = r + bark; cg = g + bark * 0.6; cb = b + bark * 0.3; break;
        }
        case 'wood_top': {
          const dx = px - 8, dy = py - 8;
          const ring = Math.sin(Math.sqrt(dx * dx + dy * dy) * 2) * 20;
          cr = r + ring + n * 0.3; cg = g + ring * 0.7 + n * 0.3; cb = b + ring * 0.3; break;
        }
        case 'leaves':
          if (rand() < 0.15) { cr = r - 40; cg = g - 30; cb = b - 20; }
          else { cr = r + n; cg = g + n * 1.5; cb = b + n; }
          break;
        case 'water': {
          const w = Math.sin(px * 0.5 + py * 0.3) * 15;
          cr = r + w + n * 0.5; cg = g + w * 0.8 + n * 0.5; cb = b + w * 0.5; break;
        }
        case 'bedrock':
          cr = r + n * 2; cg = g + n * 2; cb = b + n * 2;
          if (rand() < 0.1) { cr += 20; cg += 20; cb += 20; }
          break;
        case 'ore': {
          // Stone base with colored ore specks
          cr = 128 + n * 1.5; cg = 128 + n * 1.5; cb = 128 + n * 1.5;
          if (rand() < 0.08) { cr -= 30; cg -= 30; cb -= 30; }
          // Ore specks
          const dx = (px % 5) - 2, dy = (py % 5) - 2;
          if (dx * dx + dy * dy < 3 && rand() < 0.6) {
            const [or, og, ob] = hexToRgb(oreColor || '#000');
            cr = or + n * 0.5; cg = og + n * 0.5; cb = ob + n * 0.5;
          }
          break;
        }
        case 'glass':
          cr = 200 + n * 0.3; cg = 220 + n * 0.3; cb = 240 + n * 0.3;
          // Glass grid lines
          if (px === 0 || py === 0 || px === 15 || py === 15) {
            cr = 180; cg = 200; cb = 220;
          }
          // Highlight
          if ((px === 3 || px === 4) && (py === 2 || py === 3)) {
            cr = 240; cg = 250; cb = 255;
          }
          break;
        default:
          cr = r + n; cg = g + n; cb = b + n;
      }

      ctx.fillStyle = `rgb(${Math.max(0,Math.min(255,cr|0))},${Math.max(0,Math.min(255,cg|0))},${Math.max(0,Math.min(255,cb|0))})`;
      ctx.fillRect(ox + px, oy + py, 1, 1);
    }
  }
}

export function createTextureAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLS * TEX_SIZE;
  canvas.height = ATLAS_ROWS * TEX_SIZE;
  const ctx = canvas.getContext('2d')!;

  const textures: { color: string; pattern: Pattern; oreColor?: string }[] = [
    { color: '#5B9A3C', pattern: 'grass_top' },     // 0
    { color: '#8B6B4A', pattern: 'grass_side' },     // 1
    { color: '#8B6B4A', pattern: 'solid' },           // 2 dirt
    { color: '#808080', pattern: 'stone' },            // 3
    { color: '#C4B17A', pattern: 'solid' },            // 4 sand
    { color: '#B5894E', pattern: 'wood_top' },         // 5
    { color: '#6B4226', pattern: 'wood_side' },        // 6
    { color: '#2D7A2D', pattern: 'leaves' },           // 7
    { color: '#3070CF', pattern: 'water' },            // 8
    { color: '#404040', pattern: 'bedrock' },          // 9
    { color: '#707070', pattern: 'stone' },            // 10 cobblestone
    { color: '#BC9451', pattern: 'solid' },            // 11 planks
    { color: '#E8E8F0', pattern: 'solid' },            // 12 snow
    { color: '#808080', pattern: 'ore', oreColor: '#1A1A1A' },  // 13 coal
    { color: '#808080', pattern: 'ore', oreColor: '#D4A574' },  // 14 iron
    { color: '#808080', pattern: 'ore', oreColor: '#44E8E8' },  // 15 diamond
    { color: '#D4EEFF', pattern: 'glass' },            // 16 glass
  ];

  textures.forEach((tex, i) => {
    const col = i % ATLAS_COLS;
    const row = Math.floor(i / ATLAS_COLS);
    drawTexture(ctx, col * TEX_SIZE, row * TEX_SIZE, tex.color, tex.pattern, tex.oreColor);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

export function getAtlasUV(textureIndex: number): [number, number, number, number] {
  const col = textureIndex % ATLAS_COLS;
  const row = Math.floor(textureIndex / ATLAS_COLS);
  return [
    col / ATLAS_COLS,
    1 - (row + 1) / ATLAS_ROWS,
    (col + 1) / ATLAS_COLS,
    1 - row / ATLAS_ROWS,
  ];
}
