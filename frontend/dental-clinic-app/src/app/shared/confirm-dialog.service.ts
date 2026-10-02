import { Injectable, signal } from '@angular/core';

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  icon?: string;
  variant?: 'primary' | 'danger' | 'warning' | 'success';
}

@Injectable({
  providedIn: 'root',
})
export class ConfirmDialogService {
  readonly isOpen = signal(false);
  readonly title = signal('تأكيد الإجراء');
  readonly message = signal('');
  readonly confirmText = signal('تأكيد');
  readonly cancelText = signal('إلغاء');
  readonly icon = signal('❓');
  readonly variant = signal<'primary' | 'danger' | 'warning' | 'success'>('primary');

  private resolver: ((val: boolean) => void) | null = null;

  ask(options: ConfirmDialogOptions): Promise<boolean> {
    this.title.set(options.title ?? (options.variant === 'danger' ? 'تأكيد الحذف والإلغاء' : 'تأكيد الإجراء'));
    this.message.set(options.message);
    this.confirmText.set(options.confirmText ?? 'تأكيد');
    this.cancelText.set(options.cancelText ?? 'إلغاء');
    this.variant.set(options.variant ?? 'primary');

    if (options.icon) {
      this.icon.set(options.icon);
    } else {
      switch (options.variant) {
        case 'success':
          this.icon.set('✓');
          break;
        case 'danger':
          this.icon.set('⚠️');
          break;
        case 'warning':
          this.icon.set('⚠️');
          break;
        default:
          this.icon.set('✨');
      }
    }

    this.isOpen.set(true);

    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  onConfirm() {
    this.isOpen.set(false);
    if (this.resolver) {
      this.resolver(true);
      this.resolver = null;
    }
  }

  onCancel() {
    this.isOpen.set(false);
    if (this.resolver) {
      this.resolver(false);
      this.resolver = null;
    }
  }
}
