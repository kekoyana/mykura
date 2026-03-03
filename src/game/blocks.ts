export enum BlockType {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  SAND = 4,
  WOOD = 5,
  LEAVES = 6,
  WATER = 7,
  BEDROCK = 8,
  COBBLESTONE = 9,
  PLANKS = 10,
  SNOW = 11,
  COAL_ORE = 12,
  IRON_ORE = 13,
  DIAMOND_ORE = 14,
  GLASS = 15,
}

export interface BlockInfo {
  name: string;
  transparent: boolean;
  liquid: boolean;
  // Texture indices in atlas: [top, side, bottom]
  textures: [number, number, number];
  color: string; // representative color for UI
}

export const BLOCKS: Record<number, BlockInfo> = {
  [BlockType.GRASS]:       { name: 'Grass',       transparent: false, liquid: false, textures: [0, 1, 2],  color: '#5B9A3C' },
  [BlockType.DIRT]:        { name: 'Dirt',        transparent: false, liquid: false, textures: [2, 2, 2],  color: '#8B6B4A' },
  [BlockType.STONE]:       { name: 'Stone',       transparent: false, liquid: false, textures: [3, 3, 3],  color: '#808080' },
  [BlockType.SAND]:        { name: 'Sand',        transparent: false, liquid: false, textures: [4, 4, 4],  color: '#C4B17A' },
  [BlockType.WOOD]:        { name: 'Wood',        transparent: false, liquid: false, textures: [5, 6, 5],  color: '#6B4226' },
  [BlockType.LEAVES]:      { name: 'Leaves',      transparent: true,  liquid: false, textures: [7, 7, 7],  color: '#2D7A2D' },
  [BlockType.WATER]:       { name: 'Water',       transparent: true,  liquid: true,  textures: [8, 8, 8],  color: '#3070CF' },
  [BlockType.BEDROCK]:     { name: 'Bedrock',     transparent: false, liquid: false, textures: [9, 9, 9],  color: '#404040' },
  [BlockType.COBBLESTONE]: { name: 'Cobblestone', transparent: false, liquid: false, textures: [10, 10, 10], color: '#707070' },
  [BlockType.PLANKS]:      { name: 'Planks',      transparent: false, liquid: false, textures: [11, 11, 11], color: '#BC9451' },
  [BlockType.SNOW]:        { name: 'Snow',        transparent: false, liquid: false, textures: [12, 12, 12], color: '#E8E8F0' },
  [BlockType.COAL_ORE]:    { name: 'Coal Ore',    transparent: false, liquid: false, textures: [13, 13, 13], color: '#3A3A3A' },
  [BlockType.IRON_ORE]:    { name: 'Iron Ore',    transparent: false, liquid: false, textures: [14, 14, 14], color: '#C4A882' },
  [BlockType.DIAMOND_ORE]: { name: 'Diamond Ore', transparent: false, liquid: false, textures: [15, 15, 15], color: '#5ED0D0' },
  [BlockType.GLASS]:       { name: 'Glass',       transparent: true,  liquid: false, textures: [16, 16, 16], color: '#D4EEFF' },
};

export const HOTBAR_BLOCKS = [
  BlockType.GRASS,
  BlockType.DIRT,
  BlockType.STONE,
  BlockType.COBBLESTONE,
  BlockType.PLANKS,
  BlockType.WOOD,
  BlockType.LEAVES,
  BlockType.SAND,
  BlockType.GLASS,
];

export const ALL_BLOCKS = [
  BlockType.GRASS, BlockType.DIRT, BlockType.STONE, BlockType.COBBLESTONE,
  BlockType.PLANKS, BlockType.WOOD, BlockType.LEAVES, BlockType.SAND,
  BlockType.SNOW, BlockType.GLASS, BlockType.COAL_ORE, BlockType.IRON_ORE,
  BlockType.DIAMOND_ORE, BlockType.BEDROCK,
];
