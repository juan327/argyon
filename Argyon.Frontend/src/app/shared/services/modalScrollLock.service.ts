import { Injectable } from "@angular/core";

const SCROLL_LOCK_CLASS = 'p-overflow-hidden';

@Injectable({ providedIn: 'root' })

export class ModalScrollLockService {

  private openCount = 0;
  private observer?: MutationObserver;

  public Register(): void {
    this.openCount++;
    this.EnsureObserver();
  }

  public Unregister(): void {
    this.openCount = Math.max(0, this.openCount - 1);
  }

  // PrimeNG's p-dialog unconditionally strips this class from <body> whenever any
  // modal finishes closing, even if another modal is still open (library bug).
  // We watch for that removal and restore the class as long as we still have
  // open modals registered.
  private EnsureObserver(): void {
    if (this.observer) {
      return;
    }
    this.observer = new MutationObserver(() => {
      if (this.openCount > 0 && !document.body.classList.contains(SCROLL_LOCK_CLASS)) {
        document.body.classList.add(SCROLL_LOCK_CLASS);
      }
    });
    this.observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

}
