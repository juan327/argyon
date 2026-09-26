import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { AlertService } from 'src/app/shared/services/alert.service';
import { OfflineStorageService } from 'src/app/shared/services/offlineStorage.service';
import { OfflineService } from 'src/app/shared/services/offline.service';
import { SettingsService } from 'src/app/shared/services/settings.service';

@Component({
  selector: 'partial-offline-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ButtonComponent, TranslatePipe],
  templateUrl: './offlineBanner.component.html',
})

export class OfflineBannerComponent {
  public readonly settingsService = inject(SettingsService);
  private readonly _offlineStorage = inject(OfflineStorageService);
  private readonly _offlineService = inject(OfflineService);
  private readonly _alertService = inject(AlertService);
  private readonly _translate = inject(TranslateService);

  public snapshotDate = computed<Date | null>(() => {
    const syncedAt = this._offlineStorage.snapshotMeta()?.syncedAt ?? null;
    return syncedAt === null ? null : new Date(syncedAt);
  });

  // Just hides the banner from view; it does not disable offline mode (see onExitOfflineMode).
  // Resets whenever this component is re-created, i.e. the next time offline mode is turned on.
  public dismissed = signal(false);

  public onExitOfflineMode() {
    this._alertService.showConfirmation({
      title: this._translate.instant('offline.disableConfirmTitle'),
      message: this._translate.instant('offline.disableConfirmMessage'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this._translate.instant('offline.exitButton'),
      acceptSeverity: 'warn',
      accept: async () => {
        await this._offlineService.DisableOffline();
      },
    });
  }

  public onDismiss() {
    this.dismissed.set(true);
  }

}
