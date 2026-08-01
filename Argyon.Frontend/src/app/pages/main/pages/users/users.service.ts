import { inject, Injectable } from '@angular/core';
import { DTOGeneric, DTOUser } from 'src/app/shared/dto';
import { AuthService } from 'src/app/shared/services/auth.service';
import { HttpService } from 'src/app/shared/services/http.service';
import { VMUser } from 'src/app/shared/vm';

@Injectable({ providedIn: 'root' })

export class UsersService {
  private readonly httpService = inject(HttpService);
  private readonly authService = inject(AuthService);

  public async List(model: VMUser.VMList): Promise<{ message: string, success: boolean, data: DTOUser.DTOUserListItem[], totalCount: number }> {
    const { response, success } = await this.httpService.Get<DTOGeneric.DTOResponseApiPagedListData<DTOUser.DTOUserListItem>>('User', model);
    return { message: response.message, success, data: response.data ?? [], totalCount: response.totalCount ?? 0 };
  }

  public async ChangeRole(model: VMUser.VMChangeRole): Promise<{ message: string, success: boolean }> {
    const { response, success } = await this.httpService.Put<DTOGeneric.DTOResponseApi>('User/ChangeRole', model);
    return { message: response.message, success };
  }

  public async Delete(model: VMUser.VMDeleteUser): Promise<{ message: string, success: boolean }> {
    const { response, success } = await this.httpService.Delete<DTOGeneric.DTOResponseApi>('User', model);
    return { message: response.message, success };
  }

  // Generates a new Vault Key for the account being created, wrapped with the password chosen for
  // it (not the Owner's/Administrator's password who is creating it). It does not activate that vault key in the
  // current browser: AuthService.CreateVault does not mutate the session state of whoever runs it.
  public async Create(model: { username: string, password: string, passwordConfirmation: string, roleCode: DTOUser.RoleCode }): Promise<{ message: string, success: boolean }> {
    const vault = await this.authService.CreateVault(model.password);
    if (vault.success === false) {
      return { message: vault.message, success: false };
    }

    const request: VMUser.VMCreateUser = {
      username: model.username,
      authHash: vault.authHash!,
      roleCode: model.roleCode,
      salt: vault.salt!,
      kdfAlgorithm: vault.kdfAlgorithm!,
      kdfMemory: vault.kdfMemory!,
      kdfIterations: vault.kdfIterations!,
      kdfParallelism: vault.kdfParallelism!,
      encryptedVaultKeyIv: vault.encryptedVaultKeyIv!,
      encryptedVaultKey: vault.encryptedVaultKey!,
    };

    const { response, success } = await this.httpService.Post<DTOGeneric.DTOResponseApi>('User', request);
    return { message: response.message, success };
  }

  public async SetBlocked(model: VMUser.VMSetBlocked): Promise<{ message: string, success: boolean }> {
    const { response, success } = await this.httpService.Put<DTOGeneric.DTOResponseApi>('User/SetBlocked', model);
    return { message: response.message, success };
  }

  public async SetLimits(model: VMUser.VMSetLimits): Promise<{ message: string, success: boolean }> {
    const { response, success } = await this.httpService.Put<DTOGeneric.DTOResponseApi>('User/SetLimits', model);
    return { message: response.message, success };
  }

  public async SetPermissions(model: VMUser.VMSetPermissions): Promise<{ message: string, success: boolean }> {
    const { response, success } = await this.httpService.Put<DTOGeneric.DTOResponseApi>('User/SetPermissions', model);
    return { message: response.message, success };
  }

  public async SetContentLimits(model: VMUser.VMSetContentLimits): Promise<{ message: string, success: boolean }> {
    const { response, success } = await this.httpService.Put<DTOGeneric.DTOResponseApi>('User/SetContentLimits', model);
    return { message: response.message, success };
  }
}
