import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { PatientFormComponent } from './patient-form.component';

describe('Patient creation medical history', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PatientFormComponent], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } }] }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('sends the medical warnings in the same request as the new patient and reports failure', () => {
    const c = TestBed.createComponent(PatientFormComponent).componentInstance;
    const http = TestBed.inject(HttpTestingController);
    c.form.patchValue({ firstName: 'Mona', lastName: 'Hassan', dateOfBirth: '1990-01-01', phone: '01012345678' });
    c.allergies = ['Penicillin']; c.conditions = ['Diabetes']; c.medications = ['Metformin'];
    c.save();
    const request = http.expectOne('/api/patients');
    expect(request.request.body).toMatchObject({ allergies: ['Penicillin'], medicalConditions: ['Diabetes'], medications: ['Metformin'] });
    request.flush({ detail: 'Could not save medical history' }, { status: 409, statusText: 'Conflict' });
    expect(c.saving()).toBe(false); expect(c.error()).toBeTruthy();
    http.expectNone(r => /allergies|conditions|medications/.test(r.url));
  });
});
