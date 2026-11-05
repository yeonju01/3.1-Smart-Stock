const DB_NAME = 'SmartStockDB_V23';
const DB_VERSION = 18;
export const STORES = {
  PRODUCTS: 'products',
  SALES: 'sales',
  EVENTS: 'events',
  SETTINGS: 'settings'
};

let cachedDbPromise: Promise<IDBDatabase> | null = null;

function getDbInstance(): Promise<IDBDatabase> {
  if (cachedDbPromise) return cachedDbPromise;

  cachedDbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      Object.values(STORES).forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      });
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onclose = () => {
        cachedDbPromise = null;
      };
      db.onerror = () => {
        cachedDbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      cachedDbPromise = null;
      reject(request.error);
    };
  });

  return cachedDbPromise;
}

export const dbManager = {
  open(): Promise<IDBDatabase> {
    return getDbInstance();
  },

  async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async saveAll<T extends { id?: string }>(storeName: string, items: T[]): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      // Fast path: if empty, simply clear
      if (items.length === 0) {
        store.clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        return;
      }

      // Check existing keys to only delete removed items rather than wiping out everything
      const keyReq = store.getAllKeys();
      keyReq.onsuccess = () => {
        const existingKeys = new Set(keyReq.result.map(k => String(k)));
        const newKeySet = new Set(items.map(item => String(item.id)));

        // Delete items no longer present
        for (const k of existingKeys) {
          if (!newKeySet.has(k)) {
            store.delete(k);
          }
        }

        // Put all items
        for (let i = 0; i < items.length; i++) {
          store.put(items[i]);
        }
      };

      keyReq.onerror = () => {
        // Fallback to clear + put if getAllKeys fails
        store.clear();
        for (let i = 0; i < items.length; i++) {
          store.put(items[i]);
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },

  async deleteOne(storeName: string, id: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      transaction.objectStore(storeName).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },

  async getSettings(): Promise<any> {
    try {
      const res = await this.getAll(STORES.SETTINGS);
      return res.length > 0 ? res[0] : { id: 'app_settings', theme: 'berry' };
    } catch {
      return { id: 'app_settings', theme: 'berry' };
    }
  },

  async saveSettings(settings: any): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.SETTINGS, 'readwrite');
      transaction.objectStore(STORES.SETTINGS).put({ ...settings, id: 'app_settings' });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
};
