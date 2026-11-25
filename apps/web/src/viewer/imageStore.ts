/**
 * Where computed images of rope are kept between visits: the browser's own database, so that a rope seen
 * before is drawn at once the next time. Anything here may fail (a private window, a full disk, no
 * database at all), and then nothing is kept: the images are simply computed again.
 */

export interface StoredImage {
  readonly width: number;
  readonly height: number;
  /** One or more images of that size, four values per texel. */
  readonly planes: readonly Uint8Array[];
}

export interface ImageStore {
  read(key: string): Promise<StoredImage | undefined>;
  /** Keeps a copy of the image, made before this returns. It never fails: at worst nothing is kept. */
  write(key: string, image: StoredImage): void;
}

/** A store that keeps nothing. */
export const NO_STORE: ImageStore = { read: () => Promise.resolve(undefined), write: () => undefined };

/** Whether something read back from a store is an image as this code writes them. */
export function isStoredImage(value: unknown): value is StoredImage {
  if (typeof value !== 'object' || value === null) return false;
  const { width, height, planes } = value as Partial<StoredImage>;
  return (
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    Array.isArray(planes) &&
    planes.length > 0 &&
    planes.every((plane) => plane instanceof Uint8Array && plane.length === 4 * (width as number) * (height as number))
  );
}

const DATABASE = 'idontknot-rope-images';
const IMAGES = 'images';

/**
 * The store of this browser. `build` names the code that computes the images: what any other build kept
 * is never read, and is thrown away, so that a change to how rope is drawn is not hidden by old images.
 */
export function openImageStore(build: string): Promise<ImageStore> {
  const mine = `${build} `;
  return new Promise((resolve) => {
    try {
      const opening = indexedDB.open(DATABASE, 1);
      opening.onupgradeneeded = () => void opening.result.createObjectStore(IMAGES);
      opening.onerror = () => resolve(NO_STORE);
      opening.onblocked = () => resolve(NO_STORE);
      opening.onsuccess = () => {
        const database = opening.result;
        resolve({
          read: (key) =>
            new Promise((found) => {
              try {
                const asked = database
                  .transaction(IMAGES)
                  .objectStore(IMAGES)
                  .get(mine + key);
                asked.onsuccess = () => found(isStoredImage(asked.result) ? asked.result : undefined);
                asked.onerror = () => found(undefined);
              } catch {
                found(undefined);
              }
            }),
          write: (key, image) => {
            try {
              const put = database
                .transaction(IMAGES, 'readwrite')
                .objectStore(IMAGES)
                .put(image, mine + key);
              put.onerror = (event) => event.preventDefault();
            } catch {
              // nothing is kept
            }
          },
        });
        try {
          const images = database.transaction(IMAGES, 'readwrite').objectStore(IMAGES);
          const keys = images.getAllKeys();
          keys.onsuccess = () => {
            for (const key of keys.result) if (typeof key !== 'string' || !key.startsWith(mine)) images.delete(key);
          };
        } catch {
          // what other builds kept stays a little longer
        }
      };
    } catch {
      resolve(NO_STORE);
    }
  });
}
