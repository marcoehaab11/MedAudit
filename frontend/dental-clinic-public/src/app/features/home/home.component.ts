import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  standalone: true,
  template: '<iframe class="landing-frame" src="/planora/index.html" title="Planora landing page"></iframe>',
  styles: [`
    :host { display: block; width: 100%; height: 100dvh; background: #080e0b; }
    .landing-frame { display: block; width: 100%; height: 100%; border: 0; background: #080e0b; }
  `],
})
export class HomeComponent {}
