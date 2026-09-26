import { computed, inject, Injectable, signal } from "@angular/core";
import { DTONote, DTOUser } from "../dto";
import { LocalStorageService } from "./localStorage.service";

// Everything needed to re-activate a session purely offline: the same wrap info the server
// would normally hand back, plus the account metadata the guard/permissions/timers need.
// `syncedAt === null` means offline mode was enabled but notes were never synced yet.
export interface OfflineMeta {
  userId: string;
  username: string;
  syncedAt: string | null;
  vaultKeyInfo: DTOUser.DTOVaultKeyInfo;
  me: DTOUser.DTOMe;
}

interface OfflineFlags {
  offlineMode: boolean;
}

const DB_NAME = 'argyon-offline';
const DB_VERSION = 1;
const NOTES_STORE = 'notes';
const META_STORE = 'meta';
const META_KEY = 'meta';

/**
 * Thin wrapper around IndexedDB: stores the encrypted note list exactly as it comes from
 * `GET Note` (ciphertext only, same as the server) plus the account metadata needed to unlock
 * and use the app without a network connection. Also owns the offline-mode flag, since it has to
 * be readable from a leaf service with no dependency on AuthService/DatabaseService, to avoid a
 * circular dependency with them (see OfflineService, which orchestrates using this + those).
 */
@Injectable({ providedIn: 'root' })

export class OfflineStorageService {
  private readonly _localStorage = inject(LocalStorageService);

  public offlineMode = signal(false);
  public snapshotMeta = signal<OfflineMeta | null>(null);
  public hasSnapshot = computed(() => this.snapshotMeta() !== null);

  // Set by AuthGuard when the server can't be reached on load: MainComponent then shows the
  // retry screen instead of redirecting to /login.
  public serverUnreachable = signal(false);

  private dbPromise: Promise<IDBDatabase> | null = null;
  private readonly metaLoaded: Promise<void>;

  constructor() {
    const stored = this._localStorage.GetItem<OfflineFlags>('offline_settings');
    this.offlineMode.set(stored?.offlineMode ?? false);
    this.metaLoaded = this.GetMeta().then(meta => this.snapshotMeta.set(meta));
  }

  // The meta record loads asynchronously on startup; the guard awaits this before deciding.
  public WhenReady(): Promise<void> {
    return this.metaLoaded;
  }

  public MetaFor(username: string | null): OfflineMeta | null {
    const meta = this.snapshotMeta();
    return meta !== null && meta.username === username ? meta : null;
  }

  public SetOfflineMode(value: boolean): void {
    this.offlineMode.set(value);
    this._localStorage.SetItem('offline_settings', { offlineMode: value } satisfies OfflineFlags);
  }

  private OpenDb(): Promise<IDBDatabase> {
    if (this.dbPromise !== null) {
      return this.dbPromise;
    }
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (db.objectStoreNames.contains(NOTES_STORE) === false) {
          db.createObjectStore(NOTES_STORE, { keyPath: 'id' });
        }
        if (db.objectStoreNames.contains(META_STORE) === false) {
          db.createObjectStore(META_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.dbPromise;
  }

  // Makes sure there's a meta record for this account (so the vault can be unlocked locally after
  // a reload) even if nothing was ever synced. A snapshot left over from another account is
  // discarded rather than mixed in.
  public async EnsureMeta(me: DTOUser.DTOMe, vaultKeyInfo: DTOUser.DTOVaultKeyInfo): Promise<void> {
    const current = this.snapshotMeta();
    if (current !== null && current.username === me.username) {
      return;
    }
    await this.SaveSnapshot([], {
      userId: me.id,
      username: me.username,
      syncedAt: null,
      vaultKeyInfo,
      me,
    });
  }

  // Replaces the whole snapshot atomically: a partial overwrite (e.g. the tab closing mid-write)
  // would leave stale notes mixed with a newer meta record, silently corrupting what offline mode
  // shows later.
  public async SaveSnapshot(notes: DTONote.DTOGet[], meta: OfflineMeta): Promise<void> {
    const db = await this.OpenDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([NOTES_STORE, META_STORE], 'readwrite');
      const notesStore = tx.objectStore(NOTES_STORE);
      notesStore.clear();
      for (const note of notes) {
        notesStore.put(note);
      }
      tx.objectStore(META_STORE).put(meta, META_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    this.snapshotMeta.set(meta);
  }

  public async GetNotes(): Promise<DTONote.DTOGet[]> {
    const db = await this.OpenDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(NOTES_STORE, 'readonly').objectStore(NOTES_STORE).getAll();
      request.onsuccess = () => resolve(request.result as DTONote.DTOGet[]);
      request.onerror = () => reject(request.error);
    });
  }

  public async GetMeta(): Promise<OfflineMeta | null> {
    try {
      const db = await this.OpenDb();
      return await new Promise((resolve, reject) => {
        const request = db.transaction(META_STORE, 'readonly').objectStore(META_STORE).get(META_KEY);
        request.onsuccess = () => resolve((request.result as OfflineMeta | undefined) ?? null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  public async Clear(): Promise<void> {
    const db = await this.OpenDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([NOTES_STORE, META_STORE], 'readwrite');
      tx.objectStore(NOTES_STORE).clear();
      tx.objectStore(META_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    this.snapshotMeta.set(null);
  }
}
