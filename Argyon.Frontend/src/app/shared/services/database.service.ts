import { effect, inject, Injectable, signal } from "@angular/core";
import { Folder, Note, Note_Category } from "../entities/note";
import { CipherService } from "./cipher.service";
import { GenericService } from "./generic.service";
import { DTOUser, DTONote } from "../dto";
import { HttpService } from "./http.service";
import { SettingsService } from "./settings.service";

// How long it has to be loading before showing the notice: with few notes and a good connection,
// the sync finishes in an instant and there's no point in the user getting to see the message.
const LOADING_NOTICE_DELAY_MS = 500;

@Injectable({ providedIn: 'root' })

export class DatabaseService {
  private readonly _httpService = inject(HttpService);
  private readonly _cipherService = inject(CipherService);
  private readonly _genericService = inject(GenericService);
  private readonly _settingsService = inject(SettingsService);

  public notes = signal<Note[]>([]);
  public folders = signal<Folder[]>([]);
  public loadingDatabase = signal(false);
  public syncedCount = signal(0);

  // Signal separate from loadingDatabase: the edit lock uses loadingDatabase (immediate, it has
  // to be correct from the first moment), but the visible notice is delayed so it doesn't flash
  // on fast loads.
  public loadingNoticeVisible = signal(false);

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
    return result;
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
