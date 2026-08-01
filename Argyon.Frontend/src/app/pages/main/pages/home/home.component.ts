import { Component, computed, inject, signal, WritableSignal } from '@angular/core';
import { form, FormField, maxLength, min, minLength, required } from '@angular/forms/signals';
import { HomeService } from './home.service';
import { Router } from '@angular/router';
import { DTOGeneric, DTOUser } from 'src/app/shared/dto';
import { NoteListComponent } from './partials/noteList/noteList.component';
import { NoteCreateComponent } from './partials/noteCreate/noteCreate.component';
import { VMFolder, VMNote } from 'src/app/shared/vm';
import { Note, Note_Data, NoteTemplate } from 'src/app/shared/entities/note';
import { DialogComponent } from "src/app/shared/components/dialog/dialog.component";
import { GenericService } from 'src/app/shared/services/generic.service';
import { NgTemplateOutlet } from '@angular/common';
import { DatabaseService } from 'src/app/shared/services/database.service';
import { InputTextAreaComponent } from "src/app/shared/components/inputTextArea/inputTextArea.component";
import { SplitButtonModule } from 'primeng/splitbutton';
import { MenuItem } from 'primeng/api';
import { AlertService } from 'src/app/shared/services/alert.service';
import { AuthService } from 'src/app/shared/services/auth.service';
import { MessageModule } from 'primeng/message';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-home',
  imports: [NoteListComponent, NoteCreateComponent, DialogComponent, InputTextAreaComponent, SplitButtonModule, NgTemplateOutlet, MessageModule, TranslatePipe],
  templateUrl: './home.component.html'
})

export class HomeComponent {

  private readonly thisService = inject(HomeService);
  public readonly databaseService = inject(DatabaseService);
  public readonly authService = inject(AuthService);
  private readonly _alertService = inject(AlertService);
  private readonly _translate = inject(TranslateService);

  public parentNote = signal<Note | null>(null);
  public modalNote = signal<{ open: boolean; note: Note | null; template: NoteTemplate }>({
    open: false,
    note: null,
    template: 'password',
  });
  public modalFolder = signal({
    open: false,
    note: null as Note | null
  });
  public openNoteDelete = signal(false);

  // Computed (rather than built once in the constructor) so the labels
  // re-translate reactively whenever the active language changes.
  public items = computed<MenuItem[]>(() => {
    this._translate.currentLang();
    return [
      {
        label: this._translate.instant('home.newPage'),
        icon: 'pi pi-globe',
        command: () => {
          this.onOpenNote({ note: null, template: 'page' });
        }
      },
      {
        label: this._translate.instant('home.newCard'),
        icon: 'pi pi-credit-card',
        command: () => {
          this.onOpenNote({ note: null, template: 'card' });
        }
      },
      { separator: true },
      {
        label: this._translate.instant('home.newFolder'),
        icon: 'pi pi-folder-plus',
        command: () => {
          this.onOpenFolder({ note: null});
        }
      },
    ];
  });

  public onNoteModalCloseRequested(open: boolean, note: NoteCreateComponent) {
    if (open) return;
    note.requestCancel();
  }

  public async onOpenNote(model: { note: Note | null, template?: NoteTemplate }) {
    this.modalNote.set({
      open: true,
      note: model.note,
      template: model.template ?? 'password',
    });
  }

  public async onOpenFolder(model: { note: Note | null }) {
    this.modalFolder.set({
      open: true,
      note: model.note,
    });
  }

  public async onCreateNote(model: { message: string, success: boolean }) {
    this.modalNote.set({
      open: false,
      note: null,
      template: 'password',
    });
    await this.databaseService.StartBuild();
  }

  public async onCreateFolder(model: { message: string, success: boolean }) {
    this.modalFolder.set({
      open: false,
      note: null,
    });
    await this.databaseService.StartBuild();
  }

  public async OnDeleteNote(event: { note: Note, authHash: string }) {
    const model: VMNote.VMDelete = {
      noteId: event.note.id,
      authHash: event.authHash,
    };
    this._alertService.showLoading(this._translate.instant('home.deletingNote'));
    const { message, success } = await this.thisService.DeleteNote(model);
    this._alertService.hideLoading();
    if (success === false) {
      this._alertService.showError(message);
      return;
    }
    await this.databaseService.StartBuild();
  }

  public async onToggleFavorite(note: Note) {
    const model: VMNote.VMSetFavorite = {
      noteId: note.id,
      isFavorite: !note.isFavorite,
    };
    this._alertService.showLoading(this._translate.instant('home.updatingFavorite'));
    const { message, success } = await this.thisService.SetFavorite(model);
    this._alertService.hideLoading();
    if (success === false) {
      this._alertService.showError(message);
      return;
    }
    await this.databaseService.StartBuild();
  }

  public async onEditNote(note: Note) {
    // The edit button is already disabled while loading (see noteList.component.html); this is
    // a second barrier in case it gets invoked through another path.
    if (this.databaseService.loadingDatabase()) {
      this._alertService.showWarn(this._translate.instant('home.waitForNotesToLoad'));
      return;
    }
    if (note.isFolder === false) {
      this.modalNote.set({
        open: true,
        note,
        template: 'password',
      });
    } else {
      this.modalFolder.set({
        open: true,
        note,
      });
    }
  }

}
