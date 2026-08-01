import { Injectable } from "@angular/core";

@Injectable({ providedIn: 'root' })

export class LocalStorageService {

  public SetItem(key: 'user_username' | 'app_settings' | 'note_list_filters' | 'generate_password_settings', value: any): void {
    if (value === undefined) {
      localStorage.removeItem(key);
      return;
    }
    if (typeof value === 'object') {
      value = JSON.stringify(value);
    }
    localStorage.setItem(key, value);
  }

  public GetItem<T>(key: 'user_username' | 'app_settings' | 'note_list_filters' | 'generate_password_settings'): T | null {
    const value = localStorage.getItem(key);
    if (value === null) {
      return null;
    }
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }
  

}
