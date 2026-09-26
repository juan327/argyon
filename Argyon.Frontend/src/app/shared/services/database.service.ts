import { effect, inject, Injectable, signal } from "@angular/core";
import { Folder, Note, Note_Category } from "../entities/note";
import { CipherService } from "./cipher.service";
import { GenericService } from "./generic.service";
import { DTOUser, DTONote, DTOGeneric } from "../dto";
import { HttpService } from "./http.service";
import { SettingsService } from "./settings.service";
import { AuthService } from "./auth.service";
import { AlertService } from "./alert.service";
import { TokenRefreshService } from "./tokenRefresh.service";
import { OfflineStorageService } from "./offlineStorage.service";
import { TranslateService } from "@ngx-translate/core";
import { VMUser } from "../vm";

// How long it has to be loading before showing the notice: with few notes and a good connection,
// the sync finishes in an instant and there's no point in the user getting to see the message.
const LOADING_NOTICE_DELAY_MS = 500;

@Injectable({ providedIn: 'root' })

export class DatabaseService {
  private readonly _httpService = inject(HttpService);
  private readonly _cipherService = inject(CipherService);
  private readonly _genericService = inject(GenericService);
  private readonly _settingsService = inject(SettingsService);
  private readonly _authService = inject(AuthService);
  private readonly _alertService = inject(AlertService);
  private readonly _tokenRefreshService = inject(TokenRefreshService);
  private readonly _offlineStorage = inject(OfflineStorageService);
  private readonly _translate = inject(TranslateService);

  public notes = signal<Note[]>([]);
  public folders = signal<Folder[]>([]);
  public loadingDatabase = signal(false);
  public syncedCount = signal(0);

  // Signal separate from loadingDatabase: the edit lock uses loadingDatabase (immediate, it has
  // to be correct from the first moment), but the visible notice is delayed so it doesn't flash
  // on fast loads.
  public loadingNoticeVisible = signal(false);

  public syncingLocal = signal(false);
  public syncedLocalCount = signal(0);

  private eventStream: { close: () => void } | null = null;
  private syncToken = 0;
  private loadingNoticeTimeout: ReturnType<typeof setTimeout> | null = null;

  // If the session expires while a stream is open (401 on any HttpService call,
  // not just when logging out from the menu), we close it here: otherwise it would keep running in
  // the background after the app has already redirected to /login.
  private readonly _closeStreamOnSessionExpired = effect(() => {
    this._httpService.sessionExpired();
    this.CloseStream();
  });

  private readonly _delayLoadingNotice = effect(() => {
    const isLoading = this.loadingDatabase();

    if (this.loadingNoticeTimeout !== null) {
      clearTimeout(this.loadingNoticeTimeout);
      this.loadingNoticeTimeout = null;
    }

    if (isLoading === false) {
      this.loadingNoticeVisible.set(false);
      return;
    }

    this.loadingNoticeTimeout = setTimeout(() => {
      this.loadingNoticeTimeout = null;
      this.loadingNoticeVisible.set(true);
    }, LOADING_NOTICE_DELAY_MS);
  });

  public CloseStream(): void {
    this.eventStream?.close();
    this.eventStream = null;
  }

  public async StartBuild(): Promise<{ message: string, success: boolean }> {
    // Offline mode never touches the network - everything comes from the last saved snapshot.
    if (this._offlineStorage.offlineMode()) {
      return this.LoadFromCache();
    }

    // Race token: if another StartBuild() starts before this one finishes (e.g. the user
    // creates or deletes a note while the previous load is still in progress), this run must not
    // overwrite notes/folders/loadingDatabase with already-stale data when it finally resolves.
    const myToken = ++this.syncToken;
    this.CloseStream();
    this.notes.set([]);
    this.folders.set([]);
    this.syncedCount.set(0);
    this.loadingDatabase.set(true);

    const decrypted: Note[] = [];
    const stream = this._httpService.Stream<DTONote.DTOGet>('Note', async batch => {
      const newNotes = await Promise.all(batch.map(note => this.DecryptNote(note)));
      decrypted.push(...newNotes);
      if (myToken !== this.syncToken) return;
      this.notes.set(this.BuildTree(decrypted));
      this.folders.set(this.FlattenFolders(this.notes()));
      this.syncedCount.update(count => count + batch.length);
    });
    this.eventStream = stream;

    const result = await stream.done;
    if (myToken === this.syncToken) {
      this.eventStream = null;
      this.loadingDatabase.set(false);
    }

    if (result.success) {
      return result;
    }

    // A failed sync isn't necessarily an expired session (HttpService/authInterceptor already
    // handle that): it may just mean the server is unreachable. Offer switching to offline mode
    // instead of leaving the user stuck.
    if (myToken === this.syncToken && await this.OfferOfflineSwitch()) {
      return this.LoadFromCache();
    }
    return result;
  }

  // Reads the last saved snapshot from IndexedDB and rebuilds notes/folders from it, exactly like
  // StartBuild does with a live stream, minus the network round trip.
  public async LoadFromCache(): Promise<{ message: string, success: boolean }> {
    this.CloseStream();
    this.loadingDatabase.set(true);
    this.syncedCount.set(0);

    try {
      const rawNotes = await this._offlineStorage.GetNotes();
      const decrypted = await Promise.all(rawNotes.map(note => this.DecryptNote(note)));
      this.notes.set(this.BuildTree(decrypted));
      this.folders.set(this.FlattenFolders(this.notes()));
      this.syncedCount.set(decrypted.length);
      return { message: this._translate.instant('sync.complete'), success: true };
    } catch (error) {
      console.error(error);
      return { message: this._translate.instant('sync.error'), success: false };
    } finally {
      this.loadingDatabase.set(false);
    }
  }

  // Manual "sync data" action: re-proves the master password against the server (same rationale
  // as OfflineService.EnableOffline - this is a deliberate, security-relevant action), then
  // downloads the encrypted notes and stores them as-is in IndexedDB. Uses its own stream
  // (separate from StartBuild's) so it never clobbers what the view shows.
  public async SyncToLocal(password: string): Promise<{ message: string, success: boolean }> {
    const currentUser = this._authService.currentUser();
    if (currentUser === null || this.syncingLocal()) {
      return { message: this._translate.instant('common.unknownError'), success: false };
    }

    this.syncingLocal.set(true);
    this.syncedLocalCount.set(0);
    try {
      const connection = await this._httpService.CheckConnection();
      if (connection === 'offline') {
        return { message: this._translate.instant('offline.syncServerUnreachable'), success: false };
      }
      // Offline mode stops the token refresh loop (and authInterceptor won't refresh on a 401), so
      // an explicit sync is the one place where the access token is renewed on demand.
      if (connection === 'unauthorized' && this._offlineStorage.offlineMode()) {
        const refreshed = await this._tokenRefreshService.refresh(true);
        if (refreshed === null) {
          return { message: this._translate.instant('offline.syncSessionExpired'), success: false };
        }
      }

      const material = await this._authService.DeriveAuthHashForUser(currentUser.username, password);
      if (material.success === false) {
        return { message: material.message, success: false };
      }
      const validateRequest: VMUser.VMValidatePassword = { authHash: material.authHash! };
      const { response: vaultKeyInfo, success: validateSuccess } = await this._httpService.Post<DTOGeneric.DTOResponseApiData<DTOUser.DTOVaultKeyInfo>>('User/ValidatePassword', validateRequest);
      if (validateSuccess === false) {
        return { message: vaultKeyInfo.message, success: false };
      }

      const rawNotes: DTONote.DTOGet[] = [];
      const stream = this._httpService.Stream<DTONote.DTOGet>('Note', batch => {
        rawNotes.push(...batch);
        this.syncedLocalCount.update(count => count + batch.length);
      });
      const result = await stream.done;
      if (result.success === false) {
        return result;
      }

      await this._offlineStorage.SaveSnapshot(rawNotes, {
        userId: currentUser.id,
        username: currentUser.username,
        syncedAt: new Date().toISOString(),
        vaultKeyInfo: vaultKeyInfo.data,
        me: currentUser,
      });
      if (this._offlineStorage.offlineMode()) {
        await this.LoadFromCache();
      }
      return { message: this._translate.instant('offline.syncSuccess', { count: rawNotes.length }), success: true };
    } catch (error) {
      console.error(error);
      return { message: this._translate.instant('common.unknownError'), success: false };
    } finally {
      this.syncingLocal.set(false);
    }
  }

  // Only offered when the server really looks unreachable (not a plain 401, which is handled
  // elsewhere). Mirrors OfflineService.EnableOffline inline, since OfflineService depends on this
  // service and injecting it here would be circular.
  private async OfferOfflineSwitch(): Promise<boolean> {
    const connection = await this._httpService.CheckConnection();
    if (connection !== 'offline') return false;

    return new Promise<boolean>(resolve => {
      this._alertService.showConfirmation({
        title: this._translate.instant('offline.switchDialogTitle'),
        message: this._translate.instant('offline.switchDialogMessage'),
        icon: 'pi pi-wifi',
        acceptLabel: this._translate.instant('offline.switchDialogAccept'),
        acceptSeverity: 'warn',
        accept: async () => {
          const me = this._authService.currentUser();
          const vaultKeyInfo = this._authService.vaultKeyInfo;
          if (me !== null && vaultKeyInfo !== null) {
            await this._offlineStorage.EnsureMeta(me, vaultKeyInfo);
          }
          this._offlineStorage.SetOfflineMode(true);
          this._tokenRefreshService.stop();
          resolve(true);
        },
        reject: () => resolve(false),
      });
    });
  }

  private async DecryptNote(note: DTONote.DTOGet): Promise<Note> {
    const nameIv = this._cipherService.ConvertBase64ToUint8Array(note.nameIv);
    const tagsIv = this._cipherService.ConvertBase64ToUint8Array(note.tagsIv);
    const descriptionIv = this._cipherService.ConvertBase64ToUint8Array(note.descriptionIv);

    const newNote: Note = {
      id: note.id,
      isFolder: note.isFolder,
      isFavorite: note.isFavorite,
      hasAttachments: note.hasAttachments,
      description: await this._cipherService.Decrypt(note.description, descriptionIv),
      parentId: note.parentId,
      createdAt: this._genericService.convertUtcToTimezone(new Date(note.createdAt), this._settingsService.settings().timezone),
      updatedAt: this._genericService.convertUtcToTimezone(new Date(note.updatedAt), this._settingsService.settings().timezone),
      tags: await this._cipherService.Decrypt(note.tags, tagsIv),
      name: await this._cipherService.Decrypt(note.name, nameIv),
      data: [] as Note_Category[],
      notes: [] as Note[],
    };

    if (note.data !== null) {
      const dataIv = this._cipherService.ConvertBase64ToUint8Array(note.dataIv);
      const dataJson = await this._cipherService.Decrypt(note.data, dataIv);
      newNote.data = JSON.parse(dataJson) as Note_Category[];
    }

    if (newNote.isFolder) {
      newNote.notes = [];
    }
    return newNote;
  }

  private BuildTree(notes: Note[]): Note[] {
    const noteMap = new Map(notes.map(note => [note.id, note]));
    const roots: Note[] = [];

    for (const note of notes) {
      const parent = note.parentId ? noteMap.get(note.parentId) : undefined;

      if (parent?.isFolder) {
        parent.notes!.push(note);
      } else {
        roots.push(note);
      }
    }

    return roots;
  }

  private FlattenFolders(notes: Note[]): Folder[] {
    const result: Folder[] = [];

    for (const note of notes) {
      if (note.isFolder === false) continue;
      const newFolder: Folder = {
        id: note.id,
        name: note.name,
        tags: note.tags,
        description: note.description,
        folders: this.FlattenFolders(note.notes),
      };
      result.push(newFolder);
    }
    return result;
  }

}
