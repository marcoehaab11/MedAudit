import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { AuthService } from './core/auth.service';

describe('App', () => {
  beforeEach(async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    );
    localStorage.removeItem('planora.sidebar.shell-test-user');
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.removeItem('planora.sidebar.shell-test-user');
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the clinic shell when authenticated', async () => {
    const fixture = TestBed.createComponent(App);
    const auth = TestBed.inject(AuthService);
    auth.authenticated.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.sidebar')).toBeTruthy();
  });
  it('hides empty navigation groups and links without permission', () => {
    const fixture = TestBed.createComponent(App);
    const auth = TestBed.inject(AuthService);
    auth.authenticated.set(true);
    auth.permissions.set(['Patients.View']);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.sidebar a[href="/patients"]')).toBeTruthy();
    expect(root.querySelector('.sidebar a[href="/doctors"]')).toBeNull();
    expect(root.querySelector('#nav-heading-finance')).toBeNull();
    expect(root.querySelector('#nav-heading-administration')).toBeNull();
    expect(root.querySelector('.skip-link')).toBeTruthy();
  });

  it('persists desktop collapse per account and retains expand and sign-out controls', () => {
    const fixture = TestBed.createComponent(App);
    const auth = TestBed.inject(AuthService);
    auth.authenticated.set(true);
    auth.userId.set('shell-test-user');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const toggle = root.querySelector<HTMLButtonElement>('.collapse-btn')!;
    toggle.click();
    fixture.detectChanges();
    expect(root.querySelector('.app-shell.collapsed')).toBeTruthy();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(localStorage.getItem('planora.sidebar.shell-test-user')).toBe('collapsed');
    expect(root.querySelector('.signout-btn')).toBeTruthy();
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('makes the page inert only while the mobile drawer is open and closes on Escape', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    );
    const fixture = TestBed.createComponent(App);
    TestBed.inject(AuthService).authenticated.set(true);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const trigger = root.querySelector<HTMLButtonElement>('.mobile-menu-btn')!;
    trigger.click();
    fixture.detectChanges();
    expect(root.querySelector<HTMLElement>('.main-area')!.inert).toBe(true);
    expect(root.querySelector('#app-sidebar')!.getAttribute('aria-modal')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(root.querySelector<HTMLElement>('.main-area')!.inert).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});
