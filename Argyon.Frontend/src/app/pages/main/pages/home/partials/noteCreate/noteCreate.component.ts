import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, OnInit, output, signal, TemplateRef, ViewChild, viewChild, WritableSignal } from '@angular/core';
import { form, FormField, maxLength, required } from '@angular/forms/signals';
import { NoteCreateService } from './noteCreate.service';
import { Router } from '@angular/router';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { InputTextComponent } from 'src/app/shared/components/inputText/inputText.component';
import { CipherService } from 'src/app/shared/services/cipher.service';
import { AuthService } from 'src/app/shared/services/auth.service';
import { DTOGeneric, DTOUser } from 'src/app/shared/dto';
import { Folder, Note, Note_Category, Note_Data, Note_Data_Type, NoteTemplate, NOTE_DATE_TYPES, NOTE_MASK_TYPE_CONFIG, NOTE_MASK_TYPES } from 'src/app/shared/entities/note';
import { InputTextAreaComponent } from "src/app/shared/components/inputTextArea/inputTextArea.component";
import { VMFolder, VMNote } from 'src/app/shared/vm';
import { DatabaseService } from 'src/app/shared/services/database.service';
import { FieldsetModule } from 'primeng/fieldset';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { InputAutocompleteComponent } from 'src/app/shared/components/inputAutocomplete/inputAutocomplete.component';
import { InputTextModule } from 'primeng/inputtext';
import { AlertService } from 'src/app/shared/services/alert.service';
import { InputPasswordComponent } from "src/app/shared/components/inputPassword/inputPassword.component";
import { TreeSelectModule } from 'primeng/treeselect';
import { TreeNode } from 'primeng/api';
import { TreeNodeSelectEvent } from 'primeng/tree';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { DialogComponent } from 'src/app/shared/components/dialog/dialog.component';
import { InputDatePickerComponent } from 'src/app/shared/components/inputDatePicker/inputDatePicker.component';
import { InputMaskComponent } from 'src/app/shared/components/inputMask/inputMask.component';
import { TabsModule } from 'primeng/tabs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { IftaLabelModule } from 'primeng/iftalabel';
import { CheckboxModule } from 'primeng/checkbox';

@Component({
  selector: 'partial-noteCreate',
  imports: [DecimalPipe, FormField, InputTextComponent, ButtonComponent, InputTextAreaComponent, TreeSelectModule, FieldsetModule, AutoCompleteModule, InputAutocompleteComponent, InputTextModule, InputPasswordComponent, FormsModule, SelectModule, DialogComponent, InputDatePickerComponent, InputMaskComponent, TabsModule, TranslatePipe, IftaLabelModule, CheckboxModule ],
  templateUrl: './noteCreate.component.html',
  styleUrls: ['./noteCreate.component.css']
})

export class NoteCreateComponent implements OnInit {
  public footer = viewChild.required<TemplateRef<unknown>>('footer');

  private readonly thisService = inject(NoteCreateService);
  private readonly cipherService = inject(CipherService);
  private readonly databaseService = inject(DatabaseService);
  private readonly _alertService = inject(AlertService);
  private readonly _translate = inject(TranslateService);
  private readonly _authService = inject(AuthService);

  public note = input<Note | null>(null);
  public parentNote = input<Note | null>(null);
  public isFolder = input<boolean>(false);
  public template = input<NoteTemplate>('password');

  public onCreate = output<{ message: string, success: boolean }>();
  public onCancel = output<void>();

  public _action: 'create' | 'edit' = 'create';
  private readonly _noFolderNode: TreeNode = { key: '', label: this._translate.instant('noteCreate.noFolder'), data: this._translate.instant('noteCreate.noFolder') };
  public _folderTree = signal<TreeNode[]>([this._noFolderNode]);
  public _selectedFolder = signal<TreeNode | null>(this._noFolderNode);

  public noteDataType = Note_Data_Type;
  public noteDateTypes = NOTE_DATE_TYPES;
  public noteMaskTypes = NOTE_MASK_TYPES;
  public _mainForm: WritableSignal<{ parentFolder: TreeNode | null; name: string; data: Note_Category[]; tags: string; description: string }> = signal<any>({
    parentFolder: this._noFolderNode,
    name: '',
    data: [],
    tags: '',
    description: '',
  });

  public _editMode = signal<boolean>(false);
  public _isFavorite = signal<boolean>(false);

  public _mainSignal = form(this._mainForm, (path) => {
    required(path.name),
      maxLength(path.name, () => this._authService.maxNoteNameChars() ?? undefined),
      maxLength(path.description, () => this._authService.maxNoteDescriptionChars() ?? undefined),
      required(path.data)
  });

  // Tags don't go through signal-forms (they're driven by component-inputAutocomplete), so their
  // length limit is checked manually here instead of via maxLength().
  public readonly _tagsMaxChars = computed(() => this._authService.maxNoteTagsChars());
  public readonly _tagsExceeded = computed(() => {
    const max = this._tagsMaxChars();
    return max !== null && this._mainForm().tags.length > max;
  });

  // Debounced, client-side approximation of the encrypted "data" blob size, purely informational
  // (the backend is the real gate for this limit): recomputed a short moment after the user
  // stops editing category fields, mirroring the actual double JSON.stringify done in OnSubmit().
  public readonly _dataKbMaxLimit = computed(() => this._authService.maxNoteDataKb());
  public _dataKbEstimate = signal<number>(0);
  private _dataKbEstimateTimeout: ReturnType<typeof setTimeout> | undefined;
  private readonly _debounceDataKbEstimate = effect(() => {
    const data = this._mainForm().data;
    if (this.isFolder()) return;

    if (this._dataKbEstimateTimeout !== undefined) {
      clearTimeout(this._dataKbEstimateTimeout);
    }
    this._dataKbEstimateTimeout = setTimeout(() => {
      this._dataKbEstimateTimeout = undefined;
      this._dataKbEstimate.set(this.computeApproxDataKb(data));
    }, 400);
  });
  public readonly _dataKbLimitExceeded = computed(() => {
    const max = this._dataKbMaxLimit();
    return max !== null && this._dataKbEstimate() > max;
  });

  private computeApproxDataKb(data: Note_Category[]): number {
    // Matches OnSubmit(): the "data" plaintext is JSON.stringify'd once to build the payload,
    // then CipherService.Encrypt() JSON.stringify's it again before encrypting.
    const dataJson = JSON.stringify(data);
    const plaintextBytes = new TextEncoder().encode(JSON.stringify(dataJson)).length;
    const gcmBytes = plaintextBytes + 16; // AES-GCM auth tag
    const base64Bytes = Math.ceil(gcmBytes / 3) * 4; // base64 expansion
    return base64Bytes / 1024;
  }

  public readonly _fieldTypeOptions = computed<{ label: string; value: Note_Data_Type }[]>(() => {
    this._translate.currentLang();
    return [
      { label: this._translate.instant('noteCreate.fieldType.text'), value: Note_Data_Type.Text },
      { label: this._translate.instant('noteCreate.fieldType.textArea'), value: Note_Data_Type.TextArea },
      { label: this._translate.instant('noteCreate.fieldType.password'), value: Note_Data_Type.Password },
      { label: this._translate.instant('noteCreate.fieldType.date'), value: Note_Data_Type.Date },
      { label: this._translate.instant('noteCreate.fieldType.cardNumber'), value: Note_Data_Type.CardNumber },
    ];
  });

  private readonly _textCompatibleTypes: Note_Data_Type[] = [Note_Data_Type.Text, Note_Data_Type.TextArea, Note_Data_Type.Password];

  public _fieldModalOpen = signal<boolean>(false);
  public _fieldModalMode = signal<'add' | 'edit'>('add');
  public _fieldLabelInput = signal<string>('');
  public _fieldTypeInput = signal<Note_Data_Type>(Note_Data_Type.Text);
  public _fieldDateDay = signal<boolean>(true);
  public _fieldDateMonth = signal<boolean>(true);
  public _fieldDateYear = signal<boolean>(true);
  public _fieldDateHour = signal<boolean>(false);
  private _fieldModalCategoryId: string | null = null;
  private _fieldModalIndex: number | null = null;

  public _categoryModalOpen = signal<boolean>(false);
  public _categoryModalMode = signal<'add' | 'edit'>('add');
  public _categoryNameInput = signal<string>('');
  private _categoryModalId: string | null = null;

  public _activeCategoryTab = signal<string>('');
  public readonly addCategoryTabValue = '__add-category__';

  async ngOnInit() {
    this.buildInitialState();
  }

  private buildInitialState() {
    function buildFolderTree(folders: Folder[], parentPath: string[] = []): TreeNode[] {
      return folders
        .map(folder => {
          const path = [...parentPath, folder.name];
          const children = buildFolderTree(folder.folders, path);
          return {
            key: folder.id,
            label: folder.name,
            data: path.join(' > '),
            children: children.length > 0 ? children : undefined,
          };
        });
      }

        
    const folderTree = buildFolderTree(this.databaseService.folders());
    this._folderTree.update((tree) => [...tree, ...folderTree]);

    const localNote = this.note();
    if (localNote !== null) {
      this._action = 'edit';
      const parentId = localNote.parentId ?? '';
      const selectedFolder = this.findFolderNode(parentId) ?? this._noFolderNode;
      this._mainForm.update((form) => {
        form.name = localNote.name;
        form.data = localNote.data;
        form.tags = localNote.tags ?? '';
        form.description = localNote.description ?? '';
        form.parentFolder = selectedFolder;
        return form;
      });
      this._isFavorite.set(localNote.isFavorite);
      this._selectedFolder.set(selectedFolder);
      this._activeCategoryTab.set(this._mainForm().data[0]?.id ?? '');
      return;
    }

    const localParentNote = this.parentNote();
    if (localParentNote !== null) {
      const selectedFolder = this.findFolderNode(localParentNote.id) ?? this._noFolderNode;
      this._mainForm.update((form) => {
        form.parentFolder = selectedFolder;
        return form;
      });
      this._selectedFolder.set(selectedFolder);
    }
    if (this.isFolder()) return;

    const templateCategory = this.buildTemplateCategory(this.template());
    this._mainForm.update((form) => {
      form.data.push(templateCategory);
      return form;
    });
    this._activeCategoryTab.set(templateCategory.id);
  }

  private buildTemplateCategory(template: NoteTemplate): Note_Category {
    if (template === 'page') {
      const newDataUrl: Note_Data = {
        Type: Note_Data_Type.Text,
        label: this._translate.instant('noteCreate.templates.url'),
        placeholder: this._translate.instant('noteCreate.templates.urlPlaceholder'),
        value: '',
      };

      return {
        id: crypto.randomUUID(),
        description: null,
        name: this._translate.instant('noteCreate.templates.pageCategory'),
        data: [newDataUrl],
      };
    }

    if (template === 'card') {
      const newDataName: Note_Data = {
        Type: Note_Data_Type.Text,
        label: this._translate.instant('noteCreate.templates.name'),
        placeholder: this._translate.instant('noteCreate.templates.namePlaceholder'),
        value: '',
      };

      const newDataNumber: Note_Data = {
        Type: Note_Data_Type.CardNumber,
        label: this._translate.instant('noteCreate.templates.number'),
        placeholder: this._translate.instant('noteCreate.templates.numberPlaceholder'),
        value: '',
      };

      const newDataExpiration: Note_Data = {
        Type: Note_Data_Type.Date,
        label: this._translate.instant('noteCreate.templates.expirationDate'),
        placeholder: this._translate.instant('noteCreate.templates.expirationDatePlaceholder'),
        value: '',
        dateDay: false,
        dateMonth: true,
        dateYear: true,
        dateHour: false,
      };

      const newDataCvv: Note_Data = {
        Type: Note_Data_Type.Text,
        label: this._translate.instant('noteCreate.templates.cvv'),
        placeholder: this._translate.instant('noteCreate.templates.cvvPlaceholder'),
        value: '',
      };

      return {
        id: crypto.randomUUID(),
        description: null,
        name: this._translate.instant('noteCreate.templates.cardCategory'),
        data: [newDataName, newDataNumber, newDataExpiration, newDataCvv],
      };
    }

    const newDataUsername: Note_Data = {
      Type: Note_Data_Type.Text,
      label: this._translate.instant('noteCreate.templates.username'),
      placeholder: this._translate.instant('noteCreate.templates.usernamePlaceholder'),
      value: '',
    };

    const newDataPassword: Note_Data = {
      Type: Note_Data_Type.Password,
      label: this._translate.instant('noteCreate.templates.password'),
      placeholder: this._translate.instant('noteCreate.templates.passwordPlaceholder'),
      value: '',
    };

    const newDataUrl: Note_Data = {
      Type: Note_Data_Type.Text,
      label: this._translate.instant('noteCreate.templates.url'),
      placeholder: this._translate.instant('noteCreate.templates.urlPlaceholder'),
      value: '',
    };

    return {
      id: crypto.randomUUID(),
      description: null,
      name: this._translate.instant('noteCreate.templates.mainCategory'),
      data: [newDataUsername, newDataPassword, newDataUrl],
    };
  }

  public requestCancel(): void {
    this.onCancel.emit();
  }

  private findFolderNode(key: string, nodes: TreeNode[] = this._folderTree()): TreeNode | null {
    for (const node of nodes) {
      if (node.key === key) return node;
      if (node.children) {
        const found = this.findFolderNode(key, node.children);
        if (found) return found;
      }
    }
    return null;
  }

  public async OnSubmit(e: SubmitEvent | undefined = undefined) {
    e?.preventDefault();
    if (this._mainSignal().invalid() || this._tagsExceeded()) {
      this._alertService.showWarn(this._translate.instant('noteCreate.invalidFormTitle'), this._translate.instant('noteCreate.invalidFormMessage'));
      return;
    }

    const modelForm = this._mainForm();

    const nameIv = this.cipherService.GenerateIv();
    const dataIv = this.cipherService.GenerateIv();
    const tagsIv = this.cipherService.GenerateIv();
    const descriptionIv = this.cipherService.GenerateIv();

    const encryptedName = await this.cipherService.Encrypt(modelForm.name, nameIv.iv);
    const encryptedTags = await this.cipherService.Encrypt(modelForm.tags, tagsIv.iv);

    const dataJson = JSON.stringify(modelForm.data);
    const data = await this.cipherService.Encrypt(dataJson, dataIv.iv);

    const parentFolderKey = modelForm.parentFolder?.key as string | undefined;

    const model = {
      parentNoteId: parentFolderKey ? parentFolderKey : null,
      name: encryptedName,
      nameIv: nameIv.ivBase64,
      data: data,
      dataIv: dataIv.ivBase64,
      tags: encryptedTags,
      tagsIv: tagsIv.ivBase64,
      description: await this.cipherService.Encrypt(modelForm.description, descriptionIv.iv),
      descriptionIv: descriptionIv.ivBase64,
      isFavorite: this._isFavorite(),
    };

    this._alertService.showLoading(this._translate.instant(this._action === 'create' ? 'noteCreate.creating' : 'noteCreate.editing'));

    if (this._action === 'edit') {
      const localNote = this.note()!;

      if (this.isFolder()) {
        const editModel: VMFolder.VMPut = {
          noteId: localNote.id,
          ...model
        };
        const { message: response, success } = await this.thisService.EditFolder(editModel);
        this.onCreate.emit({ message: response, success });
        this._alertService.showAlert(success ? 'success' : 'error', this._translate.instant('noteCreate.folderEdited'), response);
        this._alertService.hideLoading();
        return;
      }
      else {
        const editModel: VMNote.VMPut = {
          noteId: localNote.id,
          ...model
        };

        const { message: response, success } = await this.thisService.EditNote(editModel);
        this.onCreate.emit({ message: response, success });
        this._alertService.showAlert(success ? 'success' : 'error', this._translate.instant('noteCreate.noteEdited'), response);
        this._alertService.hideLoading();
      }
    }
    else if (this._action === 'create') {

      if (this.isFolder()) {
        const { message: response, success } = await this.thisService.CreateFolder(model);
        this.onCreate.emit({ message: response, success });
        this._alertService.showAlert(success ? 'success' : 'error', this._translate.instant('noteCreate.folderCreated'), response);
        this._alertService.hideLoading();
      }
      else {
        const { message: response, success } = await this.thisService.CreateNote(model);
        this.onCreate.emit({ message: response, success });
        this._alertService.showAlert(success ? 'success' : 'error', this._translate.instant('noteCreate.noteCreated'), response);
        this._alertService.hideLoading();
      }
    }
  }

  public onCategoryTabChange(value: string | number | undefined) {
    if (value === this.addCategoryTabValue) {
      const previousTab = this._activeCategoryTab();
      // p-tabs already switched its internal state to the "+" tab optimistically;
      // since our own signal never changes value, Angular skips re-pushing it into
      // the child on the next change detection. Force a real change (via an
      // intermediate value on a separate tick) so it actually syncs back.
      this._activeCategoryTab.set('');
      setTimeout(() => this._activeCategoryTab.set(previousTab));
      this.openAddCategoryModal();
      return;
    }
    this._activeCategoryTab.set(value as string);
  }

  public openAddCategoryModal() {
    this._categoryModalMode.set('add');
    this._categoryModalId = null;
    this._categoryNameInput.set('');
    this._categoryModalOpen.set(true);
  }

  public openEditCategoryModal(category: Note_Category) {
    this._categoryModalMode.set('edit');
    this._categoryModalId = category.id;
    this._categoryNameInput.set(category.name);
    this._categoryModalOpen.set(true);
  }

  public closeCategoryModal() {
    this._categoryModalOpen.set(false);
  }

  public saveCategoryModal() {
    const name = this._categoryNameInput().trim();
    if (!name) {
      this._alertService.showWarn(this._translate.instant('noteCreate.invalidFieldTitle'), this._translate.instant('noteCreate.categoryNameRequired'));
      return;
    }

    if (this._categoryModalMode() === 'add') {
      const newCategory: Note_Category = {
        id: crypto.randomUUID(),
        name,
        description: null,
        data: [],
      };
      this._mainForm.update(form => ({
        ...form,
        data: [...form.data, newCategory]
      }));
    } else {
      const categoryId = this._categoryModalId;
      this._mainForm.update(form => ({
        ...form,
        data: form.data.map(c => c.id !== categoryId ? c : { ...c, name })
      }));
    }
    this._categoryModalOpen.set(false);
  }

  public removeCategory(category: Note_Category) {
    this._mainForm.update(form => ({
      ...form,
      data: form.data.filter(c => c.id !== category.id)
    }));
  }

  public confirmRemoveCategory(category: Note_Category) {
    this._alertService.showConfirmation({
      title: this._translate.instant('noteCreate.confirmDeleteCategoryTitle'),
      message: this._translate.instant('noteCreate.confirmDeleteCategoryMessage', { name: category.name }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this._translate.instant('common.delete'),
      acceptSeverity: 'danger',
      accept: () => this.removeCategory(category),
    });
  }

  public removeNote(category: Note_Category, index: number) {
    this._mainForm.update(form => ({
      ...form,
      data: form.data.map(c => c.id !== category.id ? c : { ...category, data: category.data.filter((_, i) => i !== index) })
    }));
  }

  public confirmRemoveNote(category: Note_Category, index: number) {
    const field = category.data[index];
    this._alertService.showConfirmation({
      title: this._translate.instant('noteCreate.confirmDeleteFieldTitle'),
      message: this._translate.instant('noteCreate.confirmDeleteFieldMessage', { label: field.label }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this._translate.instant('common.delete'),
      acceptSeverity: 'danger',
      accept: () => this.removeNote(category, index),
    });
  }

  public toggleEditMode() {
    this._editMode.update(value => !value);
  }

  public toggleFavorite() {
    this._isFavorite.update(value => !value);
  }

  public openAddFieldModal(category: Note_Category) {
    this._fieldModalMode.set('add');
    this._fieldModalCategoryId = category.id;
    this._fieldModalIndex = null;
    this._fieldLabelInput.set('');
    this._fieldTypeInput.set(Note_Data_Type.Text);
    this._fieldDateDay.set(true);
    this._fieldDateMonth.set(true);
    this._fieldDateYear.set(true);
    this._fieldDateHour.set(false);
    this._fieldModalOpen.set(true);
  }

  public openEditFieldModal(category: Note_Category, index: number) {
    const field = category.data[index];
    this._fieldModalMode.set('edit');
    this._fieldModalCategoryId = category.id;
    this._fieldModalIndex = index;
    this._fieldLabelInput.set(field.label);
    this._fieldTypeInput.set(field.Type);
    this._fieldDateDay.set(field.dateDay ?? true);
    this._fieldDateMonth.set(field.dateMonth ?? true);
    this._fieldDateYear.set(field.dateYear ?? true);
    this._fieldDateHour.set(field.dateHour ?? false);
    this._fieldModalOpen.set(true);
  }

  public closeFieldModal() {
    this._fieldModalOpen.set(false);
  }

  public getMask(type: Note_Data_Type): string {
    return NOTE_MASK_TYPE_CONFIG[type] ?? '';
  }

  private isValueCompatibleWithType(value: string, type: Note_Data_Type): boolean {
    if (!value) return true;
    return this._textCompatibleTypes.includes(type);
  }

  private canUncheckDatePart(part: 'day' | 'month' | 'year' | 'hour'): boolean {
    const day = part === 'day' ? false : this._fieldDateDay();
    const month = part === 'month' ? false : this._fieldDateMonth();
    const year = part === 'year' ? false : this._fieldDateYear();
    const hour = part === 'hour' ? false : this._fieldDateHour();
    return day || month || year || hour;
  }

  public toggleFieldDateDay() {
    if (this._fieldDateDay()) {
      if (!this.canUncheckDatePart('day')) return;
      this._fieldDateDay.set(false);
      return;
    }
    this._fieldDateDay.set(true);
    this._fieldDateMonth.set(true);
    this._fieldDateYear.set(true);
  }

  public toggleFieldDateMonth() {
    if (this._fieldDateDay()) return;
    if (this._fieldDateMonth()) {
      if (!this.canUncheckDatePart('month')) return;
      this._fieldDateMonth.set(false);
      return;
    }
    this._fieldDateMonth.set(true);
    this._fieldDateYear.set(true);
  }

  public toggleFieldDateYear() {
    if (this._fieldDateDay() || this._fieldDateMonth()) return;
    if (this._fieldDateYear()) {
      if (!this.canUncheckDatePart('year')) return;
      this._fieldDateYear.set(false);
      return;
    }
    this._fieldDateYear.set(true);
  }

  public toggleFieldDateHour() {
    if (this._fieldDateHour()) {
      if (!this.canUncheckDatePart('hour')) return;
      this._fieldDateHour.set(false);
      return;
    }
    this._fieldDateHour.set(true);
  }

  public saveFieldModal() {
    const label = this._fieldLabelInput().trim();
    if (!label) {
      this._alertService.showWarn(this._translate.instant('noteCreate.invalidFieldTitle'), this._translate.instant('noteCreate.fieldLabelRequired'));
      return;
    }

    const type = this._fieldTypeInput();
    if (type === Note_Data_Type.Date && !this._fieldDateDay() && !this._fieldDateMonth() && !this._fieldDateYear() && !this._fieldDateHour()) {
      this._alertService.showWarn(this._translate.instant('noteCreate.invalidFieldTitle'), this._translate.instant('noteCreate.dateFieldAtLeastOneRequired'));
      return;
    }

    const categoryId = this._fieldModalCategoryId;
    if (categoryId === null) return;

    const dateParts = {
      dateDay: type === Note_Data_Type.Date ? this._fieldDateDay() : undefined,
      dateMonth: type === Note_Data_Type.Date ? this._fieldDateMonth() : undefined,
      dateYear: type === Note_Data_Type.Date ? this._fieldDateYear() : undefined,
      dateHour: type === Note_Data_Type.Date ? this._fieldDateHour() : undefined,
    };

    if (this._fieldModalMode() === 'add') {
      const newData: Note_Data = {
        Type: type,
        label,
        placeholder: this._translate.instant('noteCreate.fieldPlaceholder', { label: label.toLowerCase() }),
        value: '',
        ...dateParts,
      };
      this._mainForm.update(form => ({
        ...form,
        data: form.data.map(c => c.id !== categoryId ? c : { ...c, data: [...c.data, newData] })
      }));
      this._fieldModalOpen.set(false);
      return;
    }

    const index = this._fieldModalIndex!;
    const category = this._mainForm().data.find(c => c.id === categoryId);
    const existingField = category?.data[index];
    if (!existingField) return;

    const typeChanged = existingField.Type !== type;
    const willClearValue = typeChanged && !this.isValueCompatibleWithType(existingField.value, type);

    const applyChange = () => {
      this._mainForm.update(form => ({
        ...form,
        data: form.data.map(c => c.id !== categoryId ? c : {
          ...c,
          data: c.data.map((d, i) => i !== index ? d : { ...d, label, Type: type, value: willClearValue ? '' : d.value, ...dateParts })
        })
      }));
      this._fieldModalOpen.set(false);
    };

    if (willClearValue) {
      this._alertService.showConfirmation({
        title: this._translate.instant('noteCreate.confirmChangeFieldTypeTitle'),
        message: this._translate.instant('noteCreate.confirmChangeFieldTypeMessage', { label: existingField.label }),
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: this._translate.instant('noteCreate.changeAction'),
        acceptSeverity: 'success',
        accept: () => applyChange(),
      });
    } else {
      applyChange();
    }
  }

  public updateTags(value: string) {
    this._mainForm.update(form => {
      form.tags = value;
      return form;
    });
  }

  public copyFieldValue(value: string) {
    if (value) {
      navigator.clipboard.writeText(value);
      this._alertService.showAlert('info', this._translate.instant('noteCreate.fieldCopiedTitle'), this._translate.instant('noteCreate.fieldCopiedMessage'));
    }
  }

  public onSelectFolder(event: TreeNodeSelectEvent)
  {
    const newParentFolder = {
      key: event.node.key,
      data: event.node.data,
      label: event.node.label,
    };
    this._mainForm.update(form => ({
      ...form,
      parentFolder: newParentFolder
    }));
  }

  public onUnselectFolder() {
    this._selectedFolder.set(this._noFolderNode);
    this._mainForm.update(form => ({
      ...form,
      parentFolder: this._noFolderNode
    }));
  }
}
