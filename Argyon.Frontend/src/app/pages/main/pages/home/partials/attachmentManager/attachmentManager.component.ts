import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal, viewChild } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { FileUpload, FileUploadModule, FileSelectEvent } from 'primeng/fileupload';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AttachmentManagerService } from './attachmentManager.service';
import { DTOAttachment } from 'src/app/shared/dto';
import { VMAttachment } from 'src/app/shared/vm';
import { Note } from 'src/app/shared/entities/note';
import { DialogComponent } from 'src/app/shared/components/dialog/dialog.component';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { CipherService } from 'src/app/shared/services/cipher.service';
import { GenericService } from 'src/app/shared/services/generic.service';
import { AlertService } from 'src/app/shared/services/alert.service';
import { AuthService } from 'src/app/shared/services/auth.service';
import { SettingsService } from 'src/app/shared/services/settings.service';

interface DecryptedAttachment extends DTOAttachment.DTOGet {
  decryptedName: string;
}

@Component({
  selector: 'partial-attachment-manager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe, FormsModule, TableModule, InputTextModule, InputGroupModule, InputGroupAddonModule, FileUploadModule, TranslatePipe, DialogComponent, ButtonComponent],
  templateUrl: './attachmentManager.component.html'
})

export class AttachmentManagerComponent implements OnInit {
  public attachmentFileUpload = viewChild<FileUpload>('attachmentFileUpload');

  private readonly _thisService = inject(AttachmentManagerService);
  private readonly _cipherService = inject(CipherService);
  private readonly _genericService = inject(GenericService);
  private readonly _alertService = inject(AlertService);
  private readonly _translate = inject(TranslateService);
  public readonly settingsService = inject(SettingsService);
  public readonly authService = inject(AuthService);

  public note = input.required<Note>();
  public open = output<boolean>();

  public attachments = signal<DecryptedAttachment[]>([]);
  public loading = signal(true);
  public uploading = signal(false);
  public searchText = signal('');
  public tableFirst = signal(0);

  public uploadModalOpen = signal(false);
  public selectedFile = signal<File | null>(null);

  // AES-GCM appends a 16-byte authentication tag to the ciphertext; the file is sent as raw
  // binary (not base64/JSON-wrapped), so this is the exact size the server will end up storing.
  public estimatedEncryptedSize = computed(() => {
    const file = this.selectedFile();
    return file === null ? 0 : file.size + 16;
  });

  // null = unlimited (mirrors the backend's own convention for this limit).
  public maxAttachmentSizeLabel = computed(() => {
    const maxKb = this.authService.maxAttachmentFileSizeKb();
    return maxKb === null ? null : this._genericService.formatBytes(maxKb * 1024);
  });

  private _debouncedSearchText = signal('');
  private _searchDebounce: ReturnType<typeof setTimeout> | undefined;

  public filteredAttachments = computed(() => {
    const search = this._debouncedSearchText().trim().toLowerCase();
    const attachments = this.attachments();
    return search ? attachments.filter(a => a.decryptedName.toLowerCase().includes(search)) : attachments;
  });

  async ngOnInit() {
    await this.LoadAttachments();
  }

  public formatBytes(bytes: number): string {
    return this._genericService.formatBytes(bytes);
  }

  public OnSearchTextChange(value: string): void {
    this.searchText.set(value);
    this.tableFirst.set(0);

    if (this._searchDebounce !== undefined) {
      clearTimeout(this._searchDebounce);
    }
    this._searchDebounce = setTimeout(() => {
      this._debouncedSearchText.set(value);
    }, 300);
  }

  private async LoadAttachments(): Promise<void> {
    this.loading.set(true);
    const { message, success, data } = await this._thisService.ListAttachments(this.note().id);
    if (success === false) {
      this._alertService.showError(message);
      this.loading.set(false);
      return;
    }

    const decrypted = await Promise.all(data.map(async attachment => ({
      ...attachment,
      decryptedName: await this._cipherService.Decrypt(attachment.name, this._cipherService.ConvertBase64ToUint8Array(attachment.nameIv)),
      createdAt: this._genericService.convertUtcToTimezone(new Date(attachment.createdAt), this.settingsService.settings().timezone),
    })));
    this.attachments.set(decrypted);
    this.loading.set(false);
  }

  public OnOpenUploadModal(): void {
    this.selectedFile.set(null);
    this.uploadModalOpen.set(true);
  }

  public OnCancelUpload(): void {
    this.uploadModalOpen.set(false);
    this.selectedFile.set(null);
    this.attachmentFileUpload()?.clear();
  }

  public OnFileSelected(event: FileSelectEvent): void {
    this.selectedFile.set(event.currentFiles[0] ?? null);
  }

  public async OnConfirmUpload(): Promise<void> {
    const file = this.selectedFile();
    if (file === null) return;

    const maxKb = this.authService.maxAttachmentFileSizeKb();
    if (maxKb !== null && this.estimatedEncryptedSize() > maxKb * 1024) {
      this._alertService.showWarn(this._translate.instant('attachmentManager.fileTooLarge'));
      return;
    }

    this.uploading.set(true);
    try {
      const nameIv = this._cipherService.GenerateIv();
      const contentIv = this._cipherService.GenerateIv();

      const encryptedName = await this._cipherService.Encrypt(file.name, nameIv.iv);
      const fileBytes = await file.arrayBuffer();
      const encryptedBytes = await this._cipherService.EncryptBytes(fileBytes, contentIv.iv);
      const encryptedFile = new File([encryptedBytes], 'blob');

      const model: VMAttachment.VMCreate = {
        noteId: this.note().id,
        name: encryptedName,
        nameIv: nameIv.ivBase64,
        contentIv: contentIv.ivBase64,
        file: encryptedFile,
      };

      const { message, success } = await this._thisService.UploadAttachment(model);
      if (success === false) {
        this._alertService.showError(message);
        return;
      }

      this.uploadModalOpen.set(false);
      this.selectedFile.set(null);
      await this.LoadAttachments();
    } finally {
      this.uploading.set(false);
      this.attachmentFileUpload()?.clear();
    }
  }

  public async OnDownload(attachment: DecryptedAttachment): Promise<void> {
    const { response: blob, success } = await this._thisService.DownloadAttachment(this.note().id, attachment.id);
    if (success === false || blob === null) {
      this._alertService.showError(this._translate.instant('attachmentManager.downloadError'));
      return;
    }

    const contentIv = this._cipherService.ConvertBase64ToUint8Array(attachment.contentIv);
    const encryptedBytes = await blob.arrayBuffer();
    const decryptedBytes = await this._cipherService.DecryptBytes(encryptedBytes, contentIv);

    const decryptedBlob = new Blob([decryptedBytes]);
    const url = URL.createObjectURL(decryptedBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.decryptedName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  public OnDelete(attachment: DecryptedAttachment): void {
    this._alertService.showConfirmation({
      title: this._translate.instant('attachmentManager.confirmDeleteTitle'),
      message: this._translate.instant('attachmentManager.confirmDeleteMessage', { name: attachment.decryptedName }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this._translate.instant('common.delete'),
      acceptSeverity: 'danger',
      accept: () => this.ConfirmDelete(attachment),
    });
  }

  private async ConfirmDelete(attachment: DecryptedAttachment): Promise<void> {
    this._alertService.showLoading(this._translate.instant('attachmentManager.deletingAttachment'));
    const { message, success } = await this._thisService.DeleteAttachment({ noteId: this.note().id, attachmentId: attachment.id });
    this._alertService.hideLoading();
    if (success === false) {
      this._alertService.showError(message);
      return;
    }
    await this.LoadAttachments();
  }

}
