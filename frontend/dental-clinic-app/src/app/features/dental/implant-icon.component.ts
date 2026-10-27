import { Component, input } from '@angular/core';
@Component({selector:'app-implant-icon',standalone:true,template:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="path()"/></svg>`,styles:[`:host{display:inline-flex;width:27px;height:27px;flex-shrink:0;color:#079e9b}svg{width:100%;height:100%}`]})
export class ImplantIconComponent {
  readonly name=input('tooth');
  path() { switch(this.name()) {
    case 'date': return 'M5 4h14a1 1 0 0 1 1 1v15H4V5a1 1 0 0 1 1-1ZM8 2v4m8-4v4M4 9h16M8 13h2m4 0h2m-8 4h2';
    case 'notes': return 'M6 3h9l4 4v14H5V3h1Zm8 0v5h5M8 12h8m-8 4h8';
    case 'camera': return 'M3 7h4l2-3h6l2 3h4v14H3V7Zm13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z';
    case 'shield': return 'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4Z';
    case 'implant': return 'M8 3h8v5H8V3Zm1 5v11l3 3 3-3V8M8 11l8-2m-8 6 8-2m-8 6 8-2';
    default:return 'M12 4C8 1 3 3 3 8c0 4 2 13 5 13 2 0 1-8 4-8s2 8 4 8c3 0 5-9 5-13 0-5-5-7-9-4Zm-5 2c1-1 3 0 4 1';
  } }
}
