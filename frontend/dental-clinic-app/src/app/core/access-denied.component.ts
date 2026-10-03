import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-access-denied',
  imports: [RouterLink],
  template: `<main style="max-width:600px;margin:5rem auto;padding:2rem;text-align:center"><h1>الوصول غير متاح</h1><p>حسابك لا يملك صلاحية فتح هذه الصفحة. إذا كنت تحتاجها، تواصل مع مسؤول العيادة.</p><a routerLink="/dashboard">العودة للصفحة الرئيسية</a></main>`,
})
export class AccessDeniedComponent {}
