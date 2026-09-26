import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { form, FormField, validate } from '@angular/forms/signals';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { RadioButtonModule } from 'primeng/radiobutton';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';
import { TabsModule } from 'primeng/tabs';
import { FileUpload, FileUploadModule, FileSelectEvent } from 'primeng/fileupload';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { InputPasswordComponent } from 'src/app/shared/components/inputPassword/inputPassword.component';
import { AlertService } from 'src/app/shared/services/alert.service';
import { AuthService } from 'src/app/shared/services/auth.service';
import { OfflineStorageService } from 'src/app/shared/services/offlineStorage.service';
import { DatabaseService } from 'src/app/shared/services/database.service';
import { ExportVaultService } from './exportVault.service';
import { ImportVaultService } from './importVault.service';
import { VaultBundle } from './vaultBundle';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageModule } from 'primeng/message';
import { IftaLabelModule } from 'primeng/iftalabel';
import { TreeSelectModule } from 'primeng/treeselect';
import { TreeNode } from 'primeng/api';
import { TreeNodeSelectEvent } from 'primeng/tree';
import { Folder } from 'src/app/shared/entities/note';

@Component({
  selector: 'app-data',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, FormField, CardModule, DividerModule, RadioButtonModule, CheckboxModule, SelectModule, TabsModule, FileUploadModule, ButtonComponent, InputPasswordComponent, TranslatePipe, MessageModule, IftaLabelModule, TreeSelectModule],
  templateUrl: './data.component.html'
})

export class DataComponent {
  public readonly authService = inject(AuthService);
  public readonly offlineStorage = inject(OfflineStorageService);
  private readonly _alertService = inject(AlertService);
  private readonly _databaseService = inject(DatabaseService);
  private readonly _exportService = inject(ExportVaultService);
  private readonly _importService = inject(ImportVaultService);
  private readonly _translate = inject(TranslateService);

  // ---- Export ----
  public exportFormat = signal<'encrypted' | 'plain'>('encrypted');
  public exportFormatOptions = computed(() => {
    this._translate.currentLang();
    return [
      { label: this._translate.instant('data.encryptedOption'), value: 'encrypted' },
      { label: this._translate.instant('data.plainOption'), value: 'plain' },
    ];
  });
  public exportPasswordMode = signal<'same' | 'different'>('same');
  public plainExportConfirmed = signal(false);

  public exportForm = signal({
    currentPassword: '',
    newExportPassword: '',
    newExportPasswordConfirmation: '',
  });

  public exportSignal = form(this.exportForm, (path) => {
    validate(path.currentPassword, ({ value }) => {
      if (!value()) return { kind: 'required', message: this._translate.instant('data.currentPasswordRequired') };
      return null;
    }),
      validate(path.newExportPassword, ({ value }) => {
        if (this.exportFormat() !== 'encrypted' || this.exportPasswordMode() !== 'different') return null;
        if (!value()) return { kind: 'required', message: this._translate.instant('data.newExportPasswordRequired') };
        if (value().length < 6) return { kind: 'minLength', message: this._translate.instant('data.minLength6') };
        return null;
      }),
      validate(path.newExportPasswordConfirmation, ({ value }) => {
        if (this.exportFormat() !== 'encrypted' || this.exportPasswordMode() !== 'different') return null;
        if (value() !== this.exportForm().newExportPassword) {
          return { kind: 'passwordMismatch', message: this._translate.instant('common.passwordMismatch') };
        }
        return null;
      })
  });

  public IsExportDisabled(): boolean {
    if (this.exportSignal().invalid()) return true;
    if (this.exportFormat() === 'plain') {
      return this.plainExportConfirmed() === false;
    }
    return false;
  }

  public async OnExport(e: SubmitEvent) {
    e.preventDefault();

    this._alertService.showLoading(this._translate.instant('data.generatingExport'));

    // Both formats require re-proving the master password first; this is validated entirely
    // client-side against the session's cached vault key wrap info, no server round trip.
    const validation = await this.authService.ValidateMasterPasswordLocally(this.exportForm().currentPassword);
    if (validation.success === false) {
      this._alertService.hideLoading();
      this._alertService.showError(validation.message);
      return;
    }

    const result = this.exportFormat() === 'plain'
      ? await this._exportService.BuildPlainBundle()
      : await this._exportService.BuildEncryptedBundle(
        validation.kek!,
        this.exportPasswordMode() === 'different' ? this.exportForm().newExportPassword : null
      );

    this._alertService.hideLoading();

    if (result.success === false || result.bundle === undefined) {
      this._alertService.showError(result.message);
      return;
    }

    this.DownloadBundle(result.bundle);
    this._alertService.showSuccess(this._translate.instant('data.exportDownloaded'));
    this.exportForm.set({ currentPassword: '', newExportPassword: '', newExportPasswordConfirmation: '' });
    this.plainExportConfirmed.set(false);
  }

  private DownloadBundle(bundle: VaultBundle): void {
    const json = JSON.stringify(bundle, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);

    const link = document.createElement('a');
    link.href = url;
    link.download = `argyon-export-${date}${bundle.encrypted ? '' : this._translate.instant('data.unencryptedFileSuffix')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ---- Import ----
  public importFileUpload = viewChild<FileUpload>('importFileUpload');

  private readonly _noFolderNode: TreeNode = { key: '', label: this._translate.instant('data.noFolder'), data: this._translate.instant('data.noFolder') };
  public _folderTree = computed<TreeNode[]>(() => {
    const buildFolderTree = (folders: Folder[], parentPath: string[] = []): TreeNode[] => {
      return folders.map(folder => {
        const path = [...parentPath, folder.name];
        const children = buildFolderTree(folder.folders, path);
        return {
          key: folder.id,
          label: folder.name,
          data: path.join(' > '),
          children: children.length > 0 ? children : undefined,
        };
      });
    };
    return [this._noFolderNode, ...buildFolderTree(this._databaseService.folders())];
  });
  public importTargetFolder = signal<TreeNode | null>(this._noFolderNode);

  public parsedBundle = signal<VaultBundle | null>(null);
  public importPassword = signal('');

  public async OnFileSelected(e: FileSelectEvent): Promise<void> {
    const file = e.currentFiles[0] ?? null;

    this.parsedBundle.set(null);
    this.importPassword.set('');

    if (file === null) return;

    const { message, success, bundle } = await this._importService.ParseFile(file);
    if (success === false || bundle === undefined) {
      this._alertService.showError(message);
      this.importFileUpload()?.clear();
      return;
    }

    this.parsedBundle.set(bundle);
  }

  public onSelectImportFolder(event: TreeNodeSelectEvent): void {
    this.importTargetFolder.set({
      key: event.node.key,
      data: event.node.data,
      label: event.node.label,
    });
  }

  public onUnselectImportFolder(): void {
    this.importTargetFolder.set(this._noFolderNode);
  }

  public IsImportDisabled(): boolean {
    const bundle = this.parsedBundle();
    if (bundle === null) return true;
    if (bundle.encrypted === true && this.importPassword().length === 0) return true;
    return false;
  }

  public async OnImport(e: SubmitEvent): Promise<void> {
    e.preventDefault();

    const bundle = this.parsedBundle();
    if (bundle === null) return;

    const targetParentId = (this.importTargetFolder()?.key as string) || null;

    this._alertService.showLoading(this._translate.instant('data.importingNotes'));
    const { message, success } = await this._importService.Import(bundle, bundle.encrypted ? this.importPassword() : null, targetParentId);
    this._alertService.hideLoading();

    this._alertService.showAlert(success ? 'success' : 'error', this._translate.instant(success ? 'data.importCompleted' : 'data.importError'), message);

    if (success) {
      this.parsedBundle.set(null);
      this.importPassword.set('');
      this.importFileUpload()?.clear();
      this.importTargetFolder.set(this._noFolderNode);
      await this._databaseService.StartBuild();
    }
  }

}
