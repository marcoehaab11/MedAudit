import { Component, ElementRef, input, output, viewChild } from '@angular/core';

@Component({
  selector: 'app-workspace-dialog',
  template: `
    <dialog #dialog [class.drawer]="drawer()" [attr.aria-label]="title()" [style.--dialog-width]="width()" (close)="closed.emit()" (cancel)="onCancel($event)">
      <header>
        <h2>{{ title() }}</h2>
        <button #closeButton type="button" class="button" autofocus [disabled]="closeDisabled()" (click)="close()">{{ closeLabel() }}</button>
      </header>
      <ng-content />
    </dialog>
  `,
  styles: `
    dialog {
      position: fixed; inset: 0; margin: auto; padding: 1rem;
      inline-size: min(var(--dialog-width), calc(100% - 1.5rem)); max-inline-size: none;
      max-block-size: calc(100dvh - 1.5rem); overflow: auto; overscroll-behavior: contain;
      color: var(--ink); background: white; border: 1px solid var(--border);
      border-radius: 16px; box-shadow: 0 20px 60px #122b383d;
    }
    dialog::backdrop { background: #0f2938a3; }
    dialog.drawer {
      inset-inline-start: auto;
      margin: 0;
      inline-size: min(var(--dialog-width), 100%);
      block-size: 100dvh;
      max-block-size: none;
      border-radius: 0;
    }
    header {
      position: sticky; z-index: 2; inset-block-start: -1rem;
      display: flex; justify-content: space-between; align-items: center; gap: 1rem;
      padding-block: .75rem; margin-block-start: -.75rem; background: white;
      border-block-end: 1px solid var(--border);
    }
    h2 { font-size: 1.15rem; margin: 0; }
    button { min-block-size: 44px; }
  `,
})
export class WorkspaceDialogComponent {
  readonly title = input.required<string>();
  readonly width = input('60rem');
  readonly drawer = input(false);
  readonly closeDisabled = input(false);
  readonly closeLabel = input.required<string>();
  readonly closed = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly closeButton = viewChild.required<ElementRef<HTMLButtonElement>>('closeButton');

  open(): void { this.dialog().nativeElement.showModal(); }
  close(): void { this.dialog().nativeElement.close(); }
  focusCloseButton(): void { this.closeButton().nativeElement.focus(); }
  protected onCancel(event: Event): void {
    if (this.closeDisabled()) event.preventDefault();
  }
}
