import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { SplitButtonModule } from 'primeng/splitbutton';
import { MenuItem } from 'primeng/api';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { DialogComponent } from 'src/app/shared/components/dialog/dialog.component';
import { InputTextComponent } from 'src/app/shared/components/inputText/inputText.component';
import { InputPasswordComponent } from 'src/app/shared/components/inputPassword/inputPassword.component';
import { PresetLimitSelectComponent } from 'src/app/shared/components/presetLimitSelect/presetLimitSelect.component';
import { AlertService } from 'src/app/shared/services/alert.service';
import { AuthService } from 'src/app/shared/services/auth.service';
import { GenericService } from 'src/app/shared/services/generic.service';
import { SettingsService } from 'src/app/shared/services/settings.service';
import { DTOUser } from 'src/app/shared/dto';
import { CONTENT_LIMIT_CHAR_PRESETS, CONTENT_LIMIT_KB_PRESETS } from 'src/app/shared/constants/contentLimits';
import { UsersService } from './users.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { IftaLabelModule } from 'primeng/iftalabel';

@Component({
  selector: 'app-users',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DatePipe, CardModule, DividerModule, TableModule, TagModule, SelectModule, InputNumberModule, InputTextModule, InputGroupModule, InputGroupAddonModule, SplitButtonModule, ButtonComponent, DialogComponent, InputTextComponent, InputPasswordComponent, PresetLimitSelectComponent, TranslatePipe, IftaLabelModule],
  templateUrl: './users.component.html'
})

export class UsersComponent {
  public readonly authService = inject(AuthService);
  private readonly _alertService = inject(AlertService);
  private readonly _usersService = inject(UsersService);
  private readonly _translateService = inject(TranslateService);
  private readonly _genericService = inject(GenericService);
  public readonly settingsService = inject(SettingsService);

  public readonly RoleCode = DTOUser.RoleCode;

  public users = signal<DTOUser.DTOUserListItem[]>([]);
  public loading = signal(true);

  // p-splitbutton loses click handling on its overlay items when [model] is bound to an
  // array rebuilt on every change-detection cycle (e.g. a method called from the template).
  // Memoizing one MenuItem[] per user (rebuilt only when the user list or language changes)
  // keeps a stable reference and fixes it.
  public readonly usersWithActionsMenu = computed(() => {
    this._translateService.currentLang();
    return this.users().map((user) => ({
      ...user,
      actionsMenu: this.GetUserActionsMenu(user),
    }));
  });

  public tableFirst = signal(0);
  public rows = signal(10);
  public totalRecords = signal(0);
  public searchText = signal('');
  private _searchDebounce: ReturnType<typeof setTimeout> | undefined;

  public readonly roleOptions = computed(() => {
    this._translateService.currentLang();
    return [
      { label: this._translateService.instant('users.roleAdministrator'), value: DTOUser.RoleCode.Administrator },
      { label: this._translateService.instant('users.roleUser'), value: DTOUser.RoleCode.User },
    ];
  });

  public changeRoleModalOpen = signal(false);
  public changeRoleTarget = signal<DTOUser.DTOUserListItem | null>(null);
  public changeRoleSelected = signal<DTOUser.RoleCode>(DTOUser.RoleCode.User);

  public readonly limitModeOptions = computed(() => {
    this._translateService.currentLang();
    return [
      { label: this._translateService.instant('users.limitModeInherit'), value: 'inherit' },
      { label: this._translateService.instant('users.limitModeUnlimited'), value: 'unlimited' },
      { label: this._translateService.instant('users.limitModeCustom'), value: 'custom' },
    ];
  });

  public limitsModalOpen = signal(false);
  public limitsTarget = signal<DTOUser.DTOUserListItem | null>(null);
  public limitsNotesMode = signal<'inherit' | 'unlimited' | 'custom'>('inherit');
  public limitsNotesValue = signal(0);
  public limitsFoldersMode = signal<'inherit' | 'unlimited' | 'custom'>('inherit');
  public limitsFoldersValue = signal(0);

  public readonly charPresets = CONTENT_LIMIT_CHAR_PRESETS;
  public readonly kbPresets = CONTENT_LIMIT_KB_PRESETS;

  public contentLimitsModalOpen = signal(false);
  public contentLimitsTarget = signal<DTOUser.DTOUserListItem | null>(null);
  public contentLimitsNameChars = signal<number | null>(null);
  public contentLimitsDescriptionChars = signal<number | null>(null);
  public contentLimitsTagsChars = signal<number | null>(null);
  public contentLimitsDataKb = signal<number | null>(null);
  public contentLimitsAttachmentSizeKb = signal<number | null>(null);

  public readonly permissionModeOptions = computed(() => {
    this._translateService.currentLang();
    return [
      { label: this._translateService.instant('users.permissionModeInherit'), value: 'inherit' },
      { label: this._translateService.instant('users.permissionModeAllow'), value: 'allow' },
      { label: this._translateService.instant('users.permissionModeDeny'), value: 'deny' },
    ];
  });

  public permissionsModalOpen = signal(false);
  public permissionsTarget = signal<DTOUser.DTOUserListItem | null>(null);
  public manageNotesMode = signal<'inherit' | 'allow' | 'deny'>('inherit');
  public twoFactorMode = signal<'inherit' | 'allow' | 'deny'>('inherit');

  public createUserModalOpen = signal(false);
  public createUsername = signal('');
  public createPassword = signal('');
  public createPasswordConfirmation = signal('');
  public createRoleSelected = signal<DTOUser.RoleCode>(DTOUser.RoleCode.User);

  private async LoadUsers(): Promise<void> {
    this.loading.set(true);
    const { message, success, data, totalCount } = await this._usersService.List({
      skip: this.tableFirst(),
      take: this.rows(),
      search: this.searchText().trim(),
    });
    this.loading.set(false);

    if (success === false) {
      this._alertService.showError(message);
      return;
    }

    const timezone = this.settingsService.settings().timezone;
    this.users.set(data.map((user) => ({
      ...user,
      createdAt: this._genericService.convertUtcToTimezone(new Date(user.createdAt), timezone),
    })));
    this.totalRecords.set(totalCount);
  }

  public async OnLazyLoad(event: TableLazyLoadEvent): Promise<void> {
    this.tableFirst.set(event.first ?? 0);
    this.rows.set(event.rows ?? this.rows());
    await this.LoadUsers();
  }

  public OnSearchTextChange(value: string): void {
    this.searchText.set(value);
    this.tableFirst.set(0);

    if (this._searchDebounce) {
      clearTimeout(this._searchDebounce);
    }
    this._searchDebounce = setTimeout(() => {
      this.LoadUsers();
    }, 300);
  }

  public RoleLabel(roleCode: DTOUser.RoleCode): string {
    switch (roleCode) {
      case DTOUser.RoleCode.Owner: return this._translateService.instant('users.roleOwner');
      case DTOUser.RoleCode.Administrator: return this._translateService.instant('users.roleAdministrator');
      default: return this._translateService.instant('users.roleUser');
    }
  }

  public RoleSeverity(roleCode: DTOUser.RoleCode): 'info' | 'warn' | 'secondary' {
    switch (roleCode) {
      case DTOUser.RoleCode.Owner: return 'info';
      case DTOUser.RoleCode.Administrator: return 'warn';
      default: return 'secondary';
    }
  }

  public GetUserActionsMenu(user: DTOUser.DTOUserListItem): MenuItem[] {
    return [
      {
        label: this._translateService.instant('users.changeRole'),
        icon: 'pi pi-user-edit',
        command: () => this.onOpenChangeRoleModal(user),
      },
      {
        label: this._translateService.instant('users.editLimits'),
        icon: 'pi pi-sliders-h',
        command: () => this.onOpenLimitsModal(user),
      },
      {
        label: this._translateService.instant('users.editContentLimits'),
        icon: 'pi pi-file-edit',
        command: () => this.onOpenContentLimitsModal(user),
      },
      {
        label: this._translateService.instant('users.editPermissions'),
        icon: 'pi pi-shield',
        command: () => this.onOpenPermissionsModal(user),
      },
      { separator: true },
      {
        label: this._translateService.instant('common.delete'),
        icon: 'pi pi-trash',
        command: () => this.onDelete(user),
      },
    ];
  }

  public onOpenChangeRoleModal(user: DTOUser.DTOUserListItem): void {
    this.changeRoleTarget.set(user);
    this.changeRoleSelected.set(user.roleCode);
    this.changeRoleModalOpen.set(true);
  }

  public async onConfirmChangeRole(): Promise<void> {
    const target = this.changeRoleTarget();
    if (target === null) return;

    this._alertService.showLoading(this._translateService.instant('users.updatingRole'));
    const { message, success } = await this._usersService.ChangeRole({ userId: target.id, roleCode: this.changeRoleSelected() });
    this._alertService.hideLoading();

    if (success === false) {
      this._alertService.showError(message);
      return;
    }

    this.changeRoleModalOpen.set(false);
    this._alertService.showSuccess(message);
    await this.LoadUsers();
  }

  private ToLimitModeAndValue(override: number | null): ['inherit' | 'unlimited' | 'custom', number] {
    if (override === null) return ['inherit', 0];
    if (override === -1) return ['unlimited', 0];
    return ['custom', override];
  }

  private ToOverrideValue(mode: 'inherit' | 'unlimited' | 'custom', value: number): number | null {
    switch (mode) {
      case 'inherit': return null;
      case 'unlimited': return -1;
      default: return value;
    }
  }

  public onOpenLimitsModal(user: DTOUser.DTOUserListItem): void {
    this.limitsTarget.set(user);
    const [notesMode, notesValue] = this.ToLimitModeAndValue(user.maxNotesOverride);
    const [foldersMode, foldersValue] = this.ToLimitModeAndValue(user.maxFoldersOverride);
    this.limitsNotesMode.set(notesMode);
    this.limitsNotesValue.set(notesValue);
    this.limitsFoldersMode.set(foldersMode);
    this.limitsFoldersValue.set(foldersValue);
    this.limitsModalOpen.set(true);
  }

  public async onConfirmSetLimits(): Promise<void> {
    const target = this.limitsTarget();
    if (target === null) return;

    this._alertService.showLoading(this._translateService.instant('users.updatingLimits'));
    const { message, success } = await this._usersService.SetLimits({
      userId: target.id,
      maxNotesOverride: this.ToOverrideValue(this.limitsNotesMode(), this.limitsNotesValue()),
      maxFoldersOverride: this.ToOverrideValue(this.limitsFoldersMode(), this.limitsFoldersValue()),
    });
    this._alertService.hideLoading();

    if (success === false) {
      this._alertService.showError(message);
      return;
    }

    this.limitsModalOpen.set(false);
    this._alertService.showSuccess(message);
    await this.LoadUsers();
  }

  public onOpenContentLimitsModal(user: DTOUser.DTOUserListItem): void {
    this.contentLimitsTarget.set(user);
    this.contentLimitsNameChars.set(user.maxNoteNameCharsOverride);
    this.contentLimitsDescriptionChars.set(user.maxNoteDescriptionCharsOverride);
    this.contentLimitsTagsChars.set(user.maxNoteTagsCharsOverride);
    this.contentLimitsDataKb.set(user.maxNoteDataKbOverride);
    this.contentLimitsAttachmentSizeKb.set(user.maxAttachmentFileSizeKbOverride);
    this.contentLimitsModalOpen.set(true);
  }

  public async onConfirmSetContentLimits(): Promise<void> {
    const target = this.contentLimitsTarget();
    if (target === null) return;

    this._alertService.showLoading(this._translateService.instant('users.updatingContentLimits'));
    const { message, success } = await this._usersService.SetContentLimits({
      userId: target.id,
      maxNoteNameCharsOverride: this.contentLimitsNameChars(),
      maxNoteDescriptionCharsOverride: this.contentLimitsDescriptionChars(),
      maxNoteTagsCharsOverride: this.contentLimitsTagsChars(),
      maxNoteDataKbOverride: this.contentLimitsDataKb(),
      maxAttachmentFileSizeKbOverride: this.contentLimitsAttachmentSizeKb(),
    });
    this._alertService.hideLoading();

    if (success === false) {
      this._alertService.showError(message);
      return;
    }

    this.contentLimitsModalOpen.set(false);
    this._alertService.showSuccess(message);
    await this.LoadUsers();
  }

  private ToPermissionMode(override: boolean | null): 'inherit' | 'allow' | 'deny' {
    if (override === null) return 'inherit';
    return override ? 'allow' : 'deny';
  }

  private ToPermissionOverride(mode: 'inherit' | 'allow' | 'deny'): boolean | null {
    switch (mode) {
      case 'inherit': return null;
      case 'allow': return true;
      case 'deny': return false;
    }
  }

  public onOpenPermissionsModal(user: DTOUser.DTOUserListItem): void {
    this.permissionsTarget.set(user);
    this.manageNotesMode.set(this.ToPermissionMode(user.canManageNotesOverride));
    this.twoFactorMode.set(this.ToPermissionMode(user.canUseTwoFactorOverride));
    this.permissionsModalOpen.set(true);
  }

  public async onConfirmSetPermissions(): Promise<void> {
    const target = this.permissionsTarget();
    if (target === null) return;

    this._alertService.showLoading(this._translateService.instant('users.updatingPermissions'));
    const { message, success } = await this._usersService.SetPermissions({
      userId: target.id,
      canManageNotesOverride: this.ToPermissionOverride(this.manageNotesMode()),
      canUseTwoFactorOverride: this.ToPermissionOverride(this.twoFactorMode()),
    });
    this._alertService.hideLoading();

    if (success === false) {
      this._alertService.showError(message);
      return;
    }

    this.permissionsModalOpen.set(false);
    this._alertService.showSuccess(message);
    await this.LoadUsers();
  }

  public onOpenCreateUserModal(): void {
    this.createUsername.set('');
    this.createPassword.set('');
    this.createPasswordConfirmation.set('');
    this.createRoleSelected.set(DTOUser.RoleCode.User);
    this.createUserModalOpen.set(true);
  }

  public async onConfirmCreateUser(): Promise<void> {
    const username = this.createUsername();
    const password = this.createPassword();
    const passwordConfirmation = this.createPasswordConfirmation();

    if (username.trim() === '' || password === '') {
      this._alertService.showError(this._translateService.instant('users.usernamePasswordRequired'));
      return;
    }
    if (password !== passwordConfirmation) {
      this._alertService.showError(this._translateService.instant('common.passwordMismatch'));
      return;
    }

    this._alertService.showLoading(this._translateService.instant('users.creatingUser'));
    const { message, success } = await this._usersService.Create({
      username,
      password,
      passwordConfirmation,
      roleCode: this.authService.currentUser()?.roleCode === DTOUser.RoleCode.Owner ? this.createRoleSelected() : DTOUser.RoleCode.User,
    });
    this._alertService.hideLoading();

    if (success === false) {
      this._alertService.showError(message);
      return;
    }

    this.createUserModalOpen.set(false);
    this._alertService.showSuccess(message);
    await this.LoadUsers();
  }

  public onToggleBlocked(user: DTOUser.DTOUserListItem): void {
    const nextBlocked = user.isBlocked === false;
    this._alertService.showConfirmation({
      title: this._translateService.instant(nextBlocked ? 'users.confirmBlockTitle' : 'users.confirmUnblockTitle'),
      message: nextBlocked
        ? this._translateService.instant('users.confirmBlockMessage', { username: user.username })
        : this._translateService.instant('users.confirmUnblockMessage', { username: user.username }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this._translateService.instant(nextBlocked ? 'users.blockAction' : 'users.unblockAction'),
      acceptSeverity: nextBlocked ? 'success' : 'warn',
      accept: async () => {
        this._alertService.showLoading(this._translateService.instant(nextBlocked ? 'users.blockingUser' : 'users.unblockingUser'));
        const { message, success } = await this._usersService.SetBlocked({ userId: user.id, isBlocked: nextBlocked });
        this._alertService.hideLoading();

        if (success === false) {
          this._alertService.showError(message);
          return;
        }

        this._alertService.showSuccess(message);
        await this.LoadUsers();
      }
    });
  }

  public onDelete(user: DTOUser.DTOUserListItem): void {
    this._alertService.showConfirmation({
      title: this._translateService.instant('users.confirmDeleteUserTitle'),
      message: this._translateService.instant('users.confirmDeleteUserMessage', { username: user.username }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this._translateService.instant('common.delete'),
      acceptSeverity: 'danger',
      accept: async () => {
        this._alertService.showLoading(this._translateService.instant('users.deletingUser'));
        const { message, success } = await this._usersService.Delete({ userId: user.id });
        this._alertService.hideLoading();

        if (success === false) {
          this._alertService.showError(message);
          return;
        }

        this._alertService.showSuccess(message);
        await this.LoadUsers();
      }
    });
  }
}
