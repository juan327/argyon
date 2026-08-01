import { Component, inject, input, model, output, signal, computed } from '@angular/core';
import { NoteListService } from './noteList.service';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { Note } from 'src/app/shared/entities/note';
import { CommonModule, DatePipe, JsonPipe } from '@angular/common';
import { DatabaseService } from 'src/app/shared/services/database.service';
import { TagModule } from 'primeng/tag';
import { AlertService } from 'src/app/shared/services/alert.service';
import { AuthService } from 'src/app/shared/services/auth.service';
import { SettingsService } from 'src/app/shared/services/settings.service';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { PopoverModule } from 'primeng/popover';
import { DatePickerModule } from 'primeng/datepicker';
import { SplitButtonModule } from 'primeng/splitbutton';
import { MenuItem } from 'primeng/api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LocalStorageService } from 'src/app/shared/services/localStorage.service';
import { DialogComponent } from 'src/app/shared/components/dialog/dialog.component';
import { InputPasswordComponent } from 'src/app/shared/components/inputPassword/inputPassword.component';
import { AttachmentManagerComponent } from '../attachmentManager/attachmentManager.component';

interface NoteListFilters {
  showAllNotes: boolean;
  openOnRowClick: boolean;
  showOnlyFavorites: boolean;
  hideNamesAndTags: boolean;
  dateRange: string[] | null;
}

@Component({
  selector: 'partial-noteList',
  imports: [CommonModule, DatePipe, TagModule, ButtonComponent, ButtonModule, TooltipModule, TableModule, FormsModule, InputTextModule, InputGroupModule, InputGroupAddonModule, ToggleSwitchModule, PopoverModule, DatePickerModule, SplitButtonModule, TranslatePipe, DialogComponent, InputPasswordComponent, AttachmentManagerComponent],
  templateUrl: './noteList.component.html'
})

export class NoteListComponent {

  private readonly _thisService = inject(NoteListService);
  public readonly databaseService = inject(DatabaseService);
  private readonly _alertService = inject(AlertService);
  public readonly settingsService = inject(SettingsService);
  public readonly authService = inject(AuthService);
  private readonly _translate = inject(TranslateService);
  private readonly _localStorageService = inject(LocalStorageService);

  public parentNote = model<Note | null>(null);
  public onEditNote = output<Note>();
  public onDeleteNote = output<{ note: Note, authHash: string }>();
  public onToggleFavorite = output<Note>();

  public deleteConfirmOpen = signal(false);
  public deleteConfirmNote = signal<Note | null>(null);
  public deleteConfirmPassword = signal('');
  public deleteConfirmLoading = signal(false);

  public attachmentsModalNote = signal<Note | null>(null);

  private _folderPath = signal<string[]>([]);

  public tableFirst = signal(0);

  private _storedFilters = this._localStorageService.GetItem<NoteListFilters>('note_list_filters');

  public searchText = signal('');
  public showAllNotes = signal(this._storedFilters?.showAllNotes ?? false);
  public dateRange = signal<Date[] | null>(this._storedFilters?.dateRange?.map(date => new Date(date)) ?? null);
  public openOnRowClick = signal(this._storedFilters?.openOnRowClick ?? false);
  public showOnlyFavorites = signal(this._storedFilters?.showOnlyFavorites ?? false);
  public hideNamesAndTags = signal(this._storedFilters?.hideNamesAndTags ?? false);

  public readonly hiddenTextPlaceholder = '••••••••';

  public breadcrumb = computed(() => {
    const ids = this._folderPath();
    let level = this.databaseService.notes();
    const trail: Note[] = [];

    for (const id of ids) {
      const folder = level.find(note => note.id === id);
      if (!folder) break;
      trail.push(folder);
      level = folder.notes ?? [];
    }

    return trail;
  });

  public currentFolder = computed<Note | null>(() => {
    const trail = this.breadcrumb();
    return trail.length > 0 ? trail[trail.length - 1] : null;
  });

  public listNotes = computed<(Note & { folderPath?: string; actionsMenu: MenuItem[] })[]>(() => {
    const notes = this.showAllNotes()
      ? this._flattenNotes(this.databaseService.notes())
      : (this.currentFolder()?.notes ?? this.databaseService.notes());
    const filtered = this._filterNotes(notes);
    // Stable sort: favorites first, keeping the existing relative order (folders first, most
    // recently updated first) within each group.
    const sorted = [...filtered].sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite));

    // Memoized here (rather than called from the template) so p-splitbutton's [model] gets a
    // stable array reference instead of one rebuilt on every change-detection cycle, which
    // breaks click handling on its overlay items.
    this._translate.currentLang();
    return sorted.map(note => ({
      ...note,
      actionsMenu: this._buildActionsMenu(note),
    }));
  });

  public OnEditNote(note: Note) {
    this.onEditNote.emit(note);
  }

  public OnDeleteNote(note: Note) {
    this.deleteConfirmNote.set(note);
    this.deleteConfirmPassword.set('');
    this.deleteConfirmOpen.set(true);
  }

  public OnCancelDeleteNote() {
    this.deleteConfirmOpen.set(false);
    this.deleteConfirmNote.set(null);
    this.deleteConfirmPassword.set('');
  }

  public async OnConfirmDeleteNote() {
    const note = this.deleteConfirmNote();
    if (note === null) return;

    this.deleteConfirmLoading.set(true);
    const validation = await this.authService.ValidateMasterPasswordLocally(this.deleteConfirmPassword());
    this.deleteConfirmLoading.set(false);

    if (validation.success === false || validation.authHash === undefined) {
      this._alertService.showError(validation.message);
      return;
    }

    this.deleteConfirmOpen.set(false);
    this.deleteConfirmNote.set(null);
    this.deleteConfirmPassword.set('');
    this.onDeleteNote.emit({ note, authHash: validation.authHash });
  }

  private _buildActionsMenu(note: Note): MenuItem[] {
    if (this.authService.canManageNotes() === false) return [];

    const items: MenuItem[] = [];
    items.push({
      label: this._translate.instant(note.isFavorite ? 'noteList.removeFromFavorites' : 'noteList.addToFavorites'),
      icon: note.isFavorite ? 'pi pi-star-fill' : 'pi pi-star',
      command: () => this.onToggleFavorite.emit(note),
    });
    if (note.isFolder) {
      items.push({
        label: this._translate.instant('common.edit'),
        icon: 'pi pi-pencil',
        command: () => this.OnEditNote(note),
      });
    } else {
      items.push({
        label: this._translate.instant('noteList.manageAttachments'),
        icon: 'pi pi-paperclip',
        command: () => this.attachmentsModalNote.set(note),
      });
    }
    items.push({
      label: this._translate.instant('common.delete'),
      icon: 'pi pi-trash',
      command: () => this.OnDeleteNote(note),
    });
    return items;
  }

  public OnBackToFolder() {
    this._folderPath.update(path => path.slice(0, -1));
    this.parentNote.set(this.currentFolder());
    this.tableFirst.set(0);
  }

  public OnRowClick(note: Note) {
    if (!this.openOnRowClick()) return;

    if (note.isFolder) {
      this.OnGoToFolder(note);
    } else if (this.authService.canManageNotes()) {
      this.OnEditNote(note);
    }
  }

  public OnToggleOpenOnRowClick(value: boolean) {
    this.openOnRowClick.set(value);
    this._saveFilters();
  }

  public OnToggleShowOnlyFavorites(value: boolean) {
    this.showOnlyFavorites.set(value);
    this.tableFirst.set(0);
    this._saveFilters();
  }

  public OnToggleHideNamesAndTags(value: boolean) {
    this.hideNamesAndTags.set(value);
    this._saveFilters();
  }

  public OnGoToFolder(note: Note) {
    if (note.isFolder === false) return;
    this.showAllNotes.set(false);
    this._folderPath.update(path => [...path, note.id]);
    this.parentNote.set(this.currentFolder());
    this.tableFirst.set(0);
  }

  public OnGoToRoot() {
    this._folderPath.set([]);
    this.parentNote.set(null);
    this.tableFirst.set(0);
  }

  public OnGoToBreadcrumb(index: number) {
    this._folderPath.update(path => path.slice(0, index + 1));
    this.parentNote.set(this.currentFolder());
    this.tableFirst.set(0);
  }

  public OnSearchTextChange(value: string) {
    this.searchText.set(value);
    this.tableFirst.set(0);
  }

  public OnToggleShowAllNotes(value: boolean) {
    this.showAllNotes.set(value);
    if (value) {
      this._folderPath.set([]);
      this.parentNote.set(null);
    }
    this.tableFirst.set(0);
    this._saveFilters();
  }

  public OnDateRangeChange(value: Date[] | null) {
    this.dateRange.set(value);
    this.tableFirst.set(0);
    this._saveFilters();
  }

  private _saveFilters(): void {
    this._localStorageService.SetItem('note_list_filters', {
      showAllNotes: this.showAllNotes(),
      openOnRowClick: this.openOnRowClick(),
      showOnlyFavorites: this.showOnlyFavorites(),
      hideNamesAndTags: this.hideNamesAndTags(),
      dateRange: this.dateRange()?.map(date => date.toISOString()) ?? null,
    } satisfies NoteListFilters);
  }

  public convertStringToArray(text: string, separator: string = ','): string[] {
    return text
      .split(separator)
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }

  private _flattenNotes(notes: Note[], parentPath: string[] = []): (Note & { folderPath?: string })[] {
    return notes.reduce<(Note & { folderPath?: string })[]>((acc, note) => {
      acc.push({ ...note, folderPath: parentPath.length > 0 ? parentPath.join(' > ') : undefined });
      if (note.isFolder) {
        acc.push(...this._flattenNotes(note.notes ?? [], [...parentPath, note.name]));
      }
      return acc;
    }, []);
  }

  private _filterNotes<T extends Note>(notes: T[]): T[] {
    const search = this.searchText().trim().toLowerCase();
    const [rangeStart, rangeEnd] = this.dateRange() ?? [];

    return notes.filter(note => {
      const nameMatch = !search || note.name.toLowerCase().includes(search);
      const tagsMatch = !search || this.convertStringToArray(note.tags).some(tag => tag.toLowerCase().includes(search));
      const dateMatch = this._isWithinDateRange(note.updatedAt, rangeStart, rangeEnd);
      const favoriteMatch = !this.showOnlyFavorites() || note.isFavorite;
      return (nameMatch || tagsMatch) && dateMatch && favoriteMatch;
    });
  }

  private _isWithinDateRange(date: Date, rangeStart?: Date, rangeEnd?: Date): boolean {
    if (!rangeStart) return true;
    const value = new Date(date);

    const start = new Date(rangeStart);
    start.setHours(0, 0, 0, 0);
    if (value < start) return false;

    const end = new Date(rangeEnd ?? rangeStart);
    end.setHours(23, 59, 59, 999);
    return value <= end;
  }

}
