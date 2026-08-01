import { HttpClient, HttpContext, HttpContextToken } from "@angular/common/http";
import { inject, Injectable, signal } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { environment } from "src/environments/environment";
import { TranslateService } from "@ngx-translate/core";

// Marks a request as an opportunistic/silent auth check (e.g. Ping(false) on the public
// login/register pages). authInterceptor reads this to know that if its fallback silent-refresh
// also fails, that failure must NOT force a /login navigation - there may never have been a
// session to begin with.
export const SILENT_401 = new HttpContextToken<boolean>(() => false);

@Injectable({ providedIn: 'root' })

export class HttpService {

  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;
  private readonly _router = inject(Router);
  private readonly _translate = inject(TranslateService);

  // Incremented every time a request responds with 401, so other
  // components (e.g. modals) can react by closing.
  public sessionExpired = signal(0);

  // `code` (e.g. "vault_reauth_required") lets this skip the /login redirect for failures that
  // authInterceptor already handles by showing the lock screen instead of ending the session.
  // `suppressRedirect` is set for the internal User/Refresh call made on behalf of a silent
  // (SILENT_401) request: its failure just means "no session", not "session ended".
  private handleUnauthorized(status: number, code?: string, suppressRedirect = false): void {
    if (status !== 401) return;
    if (code === 'vault_reauth_required') return;
    if (suppressRedirect) return;
    this.sessionExpired.update(value => value + 1);
    this._router.navigate(['/login']);
  }

  public async Get<T>(api: string, model: any = null): Promise<{response: T, success: boolean}> {
    try
    {
      const response = await firstValueFrom(this.http.get<T>(`${this.apiUrl}api/${api}`, {
        params: model,
        withCredentials: true
      }));
      return { response, success: true };
    }
    catch (error: any)
    {
      console.error(error);
      this.handleUnauthorized(error.status, error?.error?.code);
      const response = error.error as T;
      return {
        response: response ?? ({ message: this._translate.instant('common.unknownError') } as T),
        success: false,
      };
    }
  }

  // Downloads a raw binary response (e.g. an encrypted attachment) as a Blob. Unlike Get<T>, a
  // failed request here returns its error body as a Blob too (not parsed JSON), so there is no
  // usable error.error.code/message to surface without an extra async read step -- callers just
  // treat `success === false` as a generic failure.
  public async GetBlob(api: string, model: any = null): Promise<{response: Blob | null, success: boolean}> {
    try
    {
      const response = await firstValueFrom(this.http.get(`${this.apiUrl}api/${api}`, {
        params: model,
        responseType: 'blob',
        withCredentials: true
      }));
      return { response, success: true };
    }
    catch (error: any)
    {
      console.error(error);
      this.handleUnauthorized(error.status, error?.error?.code);
      return { response: null, success: false };
    }
  }

  // Consumes an endpoint that responds with Server-Sent Events: groups rows into batches via `event: batch`
  // and finishes with `event: done` (success) or `event: sync-error` (failure, already sent with status 200).
  // `onBatch` is chained in order (not in parallel) so that `done`/`sync-error` don't resolve before
  // the last batch has finished processing.
  public Stream<T>(api: string, onBatch: (batch: T[]) => void | Promise<void>): { close: () => void, done: Promise<{ message: string, success: boolean }> } {
    const eventSource = new EventSource(`${this.apiUrl}api/${api}`, { withCredentials: true });
    let pending: Promise<void> = Promise.resolve();
    let settled = false;
    let resolveDone!: (result: { message: string, success: boolean }) => void;

    const done = new Promise<{ message: string, success: boolean }>(resolve => {
      resolveDone = resolve;
    });

    const finish = (result: { message: string, success: boolean }) => {
      if (settled) return;
      settled = true;
      eventSource.close();
      resolveDone(result);
    };

    eventSource.addEventListener('batch', (event: Event) => {
      const batch = JSON.parse((event as MessageEvent).data) as T[];
      pending = pending.then(() => onBatch(batch));
    });

    eventSource.addEventListener('done', () => {
      pending.then(() => finish({ message: this._translate.instant('sync.complete'), success: true }));
    });

    eventSource.addEventListener('sync-error', (event: Event) => {
      pending.then(() => {
        const parsed = JSON.parse((event as MessageEvent).data) as { message?: string };
        finish({ message: parsed.message ?? this._translate.instant('common.unknownError'), success: false });
      });
    });

    // EventSource does not expose the HTTP status of the failed connection (a limitation of the native API),
    // so a 401 here cannot go through handleUnauthorized() like in the other methods: it is
    // treated as a generic failure. It is also not left to retry on its own (EventSource's
    // default behavior): we close and resolve, and whoever calls decides whether to retry.
    eventSource.onerror = () => finish({ message: this._translate.instant('sync.error'), success: false });

    return { close: () => finish({ message: this._translate.instant('sync.cancelled'), success: false }), done };
  }

  public async Post<T>(api: string, model: any = null, options: { suppressAuthRedirect?: boolean } = {}): Promise<{response: T, success: boolean}> {
    try
    {
      const response = await firstValueFrom(this.http.post<T>(`${this.apiUrl}api/${api}`, model, {
        withCredentials: true
      }));
      return { response, success: true };
    }
    catch (error: any)
    {
      console.error(error);
      this.handleUnauthorized(error.status, error?.error?.code, options.suppressAuthRedirect);
      const response = error?.error as T ?? ({ message: this._translate.instant('common.unknownError') } as T);
      return {
        response,
        success: false,
      };
    }
  }

  public async PostForm<T>(api: string, model: any = null): Promise<{response: T, success: boolean}> {
    try
    {
      const formData = new FormData();
      for (const key in model) {
        if (model.hasOwnProperty(key) == false) continue;
        const value = model[key];
        if (value === null || value === undefined || value === '') continue;
        if (value instanceof File) {
          formData.append(key, value, value.name);
          continue;
        }
        formData.append(key, value);
      }
      const response = await firstValueFrom(this.http.post<T>(`${this.apiUrl}api/${api}`, formData, {
        withCredentials: true
      }));
      return { response, success: true };
    }
    catch (error: any)
    {
      console.error(error);
      this.handleUnauthorized(error.status, error?.error?.code);
      const response = error.error as T;
      return {
        response,
        success: false,
      };
    }
  }

  public async Put<T>(api: string, model: any = null): Promise<{response: T, success: boolean}> {
    try
    {
      const response = await firstValueFrom(this.http.put<T>(`${this.apiUrl}api/${api}`, model, {
        withCredentials: true
      }));
      return { response, success: true };
    }
    catch (error: any)
    {
      console.error(error);
      this.handleUnauthorized(error.status, error?.error?.code);
      const response = error.error as T;
      return {
        response,
        success: false,
      };
    }
  }

  public async PutForm<T>(api: string, model: any = null): Promise<{response: T, success: boolean}> {
    const formData = new FormData();
    if (model) {
      for (const key in model) {
        if (model.hasOwnProperty(key) == false) continue;
        const value = model[key];
        if (value === null || value === undefined || value === '') continue;
        if (value instanceof File) {
          formData.append(key, value, value.name);
          continue;
        }
        formData.append(key, value);
      }
    }
    try
    {
      const response = await firstValueFrom(this.http.put<T>(`${this.apiUrl}api/${api}`, formData, {
        withCredentials: true
      }));
      return { response, success: true };
    }
    catch (error: any)
    {
      console.error(error);
      this.handleUnauthorized(error.status, error?.error?.code);
      const response = error.error as T;
      return {
        response,
        success: false,
      };
    }
  }

  public async Delete<T>(api: string, model: any = null): Promise<{response: T, success: boolean}> {
    try
    {
      const response = await firstValueFrom(this.http.delete<T>(`${this.apiUrl}api/${api}`, {
        body: model,
        withCredentials: true
      }));
      return { response, success: true };
    }
    catch (error: any)
    {
      console.error(error);
      this.handleUnauthorized(error.status, error?.error?.code);
      const response = error.error as T;
      return {
        response,
        success: false,
      };
    }
  }


  public async Ping(redirectToLogin: boolean = true): Promise<boolean> {
    try {
      await firstValueFrom<boolean>(this.http.get<boolean>(`${this.apiUrl}api/User/Ping`, {
        responseType: 'text' as any,
        withCredentials: true,
        context: new HttpContext().set(SILENT_401, redirectToLogin === false)
      }));
      return true;
    } catch (error: any) {
      console.error(error);
      if (error.status === 401 && redirectToLogin) {
        this.handleUnauthorized(error.status, error?.error?.code);
      }
      return false;
    }
  }


}
