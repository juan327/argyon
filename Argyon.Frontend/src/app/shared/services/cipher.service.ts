import { inject, Injectable } from "@angular/core";
import { AuthService } from "./auth.service";

@Injectable({ providedIn: 'root' })

export class CipherService {

  private readonly authService = inject(AuthService);

  public GenerateIv() {
    const newIv = crypto.getRandomValues(new Uint8Array(16));
    return {
      iv: newIv,
      ivBase64: btoa(String.fromCharCode(...newIv))
    }
  }

  public ConvertBase64ToUint8Array(base64String: string | null): Uint8Array<ArrayBuffer> {
    if (base64String === null) return new Uint8Array();
    return Uint8Array.from(atob(base64String), c => c.charCodeAt(0));
  }
  
  // 🔐 ENCRYPT
  public async Encrypt(data: any, iv: Uint8Array<ArrayBuffer>, key?: CryptoKey) {

    const cryptoKey = key ?? this.authService.cryptoKey;
    if (cryptoKey === null) {
      return '';
    }

    const encoded = new TextEncoder().encode(JSON.stringify(data));

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      cryptoKey,
      encoded
    );

    return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  }

  // 🔐 Decrypt
  async Decrypt(encryptedData: string | null | undefined, iv: Uint8Array<ArrayBuffer>, key?: CryptoKey): Promise<string> {
    const cryptoKey = key ?? this.authService.cryptoKey;
    if (cryptoKey === null) {
      return '';
    }

    if (encryptedData === undefined) {
      return '';
    }
    if (encryptedData === null) {
      return '';
    }

    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv
      },
      cryptoKey,
      Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0))
    );

    return JSON.parse(new TextDecoder().decode(decrypted));
  }

  // Binary counterparts of Encrypt/Decrypt, used for attachment file content: no
  // JSON.stringify/TextEncoder/base64 round-trip, since that's wasteful and semantically wrong for
  // raw file bytes (unlike Encrypt/Decrypt, which are for text values like names/tags).
  public async EncryptBytes(data: ArrayBuffer, iv: Uint8Array<ArrayBuffer>, key?: CryptoKey): Promise<ArrayBuffer> {
    const cryptoKey = key ?? this.authService.cryptoKey;
    if (cryptoKey === null) {
      return new ArrayBuffer(0);
    }

    return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, cryptoKey, data);
  }

  public async DecryptBytes(data: ArrayBuffer, iv: Uint8Array<ArrayBuffer>, key?: CryptoKey): Promise<ArrayBuffer> {
    const cryptoKey = key ?? this.authService.cryptoKey;
    if (cryptoKey === null) {
      return new ArrayBuffer(0);
    }

    return crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, cryptoKey, data);
  }

}
