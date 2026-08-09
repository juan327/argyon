import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { TagModule } from 'primeng/tag';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { AboutService } from './about.service';

interface Credit {
  name: string;
  url: string;
  license: string;
}

@Component({
  selector: 'app-about',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardModule, DividerModule, TagModule, ButtonComponent, TranslatePipe],
  templateUrl: './about.component.html'
})

export class AboutComponent {
  private readonly _aboutService = inject(AboutService);

  public readonly githubUrl = 'https://github.com/juan327/argyon';

  public readonly version = signal('');

  public readonly backendCredits: Credit[] = [
    { name: 'Konscious.Security.Cryptography.Argon2', url: 'https://github.com/kmaragon/Konscious.Security.Cryptography', license: 'MIT' },
    { name: 'Microsoft.AspNetCore.Authentication.JwtBearer', url: 'https://github.com/dotnet/aspnetcore', license: 'MIT' },
    { name: 'Microsoft.EntityFrameworkCore.Sqlite', url: 'https://github.com/dotnet/efcore', license: 'MIT' },
    { name: 'Npgsql.EntityFrameworkCore.PostgreSQL', url: 'https://github.com/npgsql/efcore.pg', license: 'PostgreSQL License' },
    { name: 'Otp.NET', url: 'https://github.com/kspearrin/Otp.NET', license: 'MIT' },
  ];

  public readonly frontendCredits: Credit[] = [
    { name: 'Angular', url: 'https://angular.dev/', license: 'MIT' },
    { name: 'PrimeNG + @primeuix/themes', url: 'https://primeng.org/', license: 'MIT' },
    { name: 'PrimeIcons', url: 'https://github.com/primefaces/primeicons', license: 'MIT' },
    { name: 'Tailwind CSS', url: 'https://tailwindcss.com/', license: 'MIT' },
    { name: '@ngx-translate/core + http-loader', url: 'https://github.com/ngx-translate/core', license: 'MIT' },
    { name: 'argon2-browser', url: 'https://github.com/antelle/argon2-browser', license: 'MIT' },
    { name: 'qrcode', url: 'https://github.com/soldair/node-qrcode', license: 'MIT' },
    { name: 'RxJS', url: 'https://rxjs.dev/', license: 'Apache-2.0' },
    { name: 'temporal-polyfill', url: 'https://github.com/fullcalendar/temporal-polyfill', license: 'MIT' },
  ];

  async ngOnInit() {
    const result = await this._aboutService.GetVersion();
    this.version.set(result.version);
  }

  public get licenseUrl(): string {
    return `${this.githubUrl}/blob/main/LICENSE`;
  }

  public onOpenGithub() {
    window.open(this.githubUrl, '_blank', 'noopener,noreferrer');
  }
}
