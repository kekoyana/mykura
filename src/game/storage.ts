// storage.ts - Save/load system using IndexedDB with RLE compression
// Pure data layer with no dependencies on Three.js or other game files.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SaveData {
  chunks: Record<string, number[]>; // key "cx,cz" -> RLE compressed block data
  playerX: number;
  playerY: number;
  playerZ: number;
  playerYaw: number;
  playerPitch: number;
  selectedSlot: number;
  dayTime: number;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// RLE compression utilities for Uint8Array
// ---------------------------------------------------------------------------
// Format: flat array of [value, count, value, count, ...] pairs.
// count is clamped to 1-255. Runs longer than 255 are split into multiple
// consecutive pairs with the same value.

/**
 * RLE-encode a Uint8Array into a flat number[] of [value, count] pairs.
 */
export function rleEncode(data: Uint8Array): number[] {
  if (data.length === 0) return [];

  const encoded: number[] = [];
  let currentValue = data[0];
  let runLength = 1;

  for (let i = 1; i < data.length; i++) {
    const value = data[i];

    if (value === currentValue && runLength < 255) {
      runLength++;
    } else {
      encoded.push(currentValue, runLength);
      currentValue = value;
      runLength = 1;
    }
  }

  // Flush the final run
  encoded.push(currentValue, runLength);

  return encoded;
}

/**
 * Decode an RLE-encoded number[] back into a Uint8Array of the given length.
 * The `length` parameter is the expected size of the decoded output and is used
 * to pre-allocate the result buffer. If the encoded data produces fewer values
 * than `length`, the remaining entries are zero-filled (Uint8Array default).
 */
export function rleDecode(encoded: number[], length: number): Uint8Array {
  const result = new Uint8Array(length);
  let offset = 0;

  for (let i = 0; i < encoded.length; i += 2) {
    const value = encoded[i];
    const count = encoded[i + 1];

    for (let j = 0; j < count && offset < length; j++) {
      result[offset++] = value;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

const DB_NAME = "mycraft";
const DB_VERSION = 1;
const STORE_NAME = "saves";
const SAVE_KEY = "autosave";

/**
 * Open (or create) the IndexedDB database. Returns a promise that resolves
 * with the IDBDatabase handle.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Thin wrapper around an IndexedDB transaction that returns a promise.
 * `mode` is "readonly" or "readwrite".
 * The `work` callback receives the object store and should return an
 * IDBRequest whose result will be resolved through the promise.
 */
function withStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const request = work(store);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);

        tx.oncomplete = () => db.close();
        tx.onerror = () => {
          reject(tx.error);
          db.close();
        };
      }),
  );
}

// ---------------------------------------------------------------------------
// GameStorage
// ---------------------------------------------------------------------------

export class GameStorage {
  /**
   * Persist a SaveData object into IndexedDB under the "autosave" key.
   */
  async save(data: SaveData): Promise<void> {
    await withStore<IDBValidKey>("readwrite", (store) =>
      store.put(data, SAVE_KEY),
    );
  }

  /**
   * Load the previously saved SaveData, or return null if no save exists.
   */
  async load(): Promise<SaveData | null> {
    const result = await withStore<SaveData | undefined>("readonly", (store) =>
      store.get(SAVE_KEY),
    );
    return result ?? null;
  }

  /**
   * Check whether a save exists without loading the full data.
   * Uses a cursor/count on the specific key for efficiency.
   */
  async hasSave(): Promise<boolean> {
    const result = await withStore<number>("readonly", (store) =>
      store.count(SAVE_KEY),
    );
    return result > 0;
  }

  /**
   * Delete the saved data.
   */
  async deleteSave(): Promise<void> {
    await withStore<undefined>("readwrite", (store) =>
      store.delete(SAVE_KEY) as IDBRequest<undefined>,
    );
  }
}
