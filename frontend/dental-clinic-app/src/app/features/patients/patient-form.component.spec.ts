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
  it('commits medical text typed into the actual inputs even when submitted without blur', async () => {
    const fixture = TestBed.createComponent(PatientFormComponent);
    const c = fixture.componentInstance; const http = TestBed.inject(HttpTestingController);
    c.form.patchValue({ firstName: 'Mona', lastName: 'Hassan', dateOfBirth: '1990-01-01', phone: '01012345678' });
    fixture.detectChanges(); await fixture.whenStable();
    const inputs = fixture.nativeElement.querySelectorAll('app-tag-input input') as NodeListOf<HTMLInputElement>;
    ['Penicillin', 'Diabetes', 'Metformin'].forEach((value, index) => { inputs[index].value = value; inputs[index].dispatchEvent(new Event('input')); });
    c.save();
    const request = http.expectOne('/api/patients');
    expect(request.request.body).toMatchObject({ allergies: ['Penicillin'], medicalConditions: ['Diabetes'], medications: ['Metformin'] });
    request.flush({}, { status: 400, statusText: 'test' });
  });
  it('includes edited medical history in the profile save when permitted', () => {
    TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { paramMap: convertToParamMap({ id: 'p1' }) } } });
    const c = TestBed.createComponent(PatientFormComponent).componentInstance;
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/patients/p1').flush({ firstName: 'Mona', lastName: 'Hassan', gender: 2, dateOfBirth: '1990-01-01', phone: '01012345678', canEditMedicalInformation: true, allergies: [{ name: 'Latex' }], medicalConditions: [], medications: [] });
    c.conditions = ['Diabetes']; c.save();
    const request = http.expectOne('/api/patients/p1');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toMatchObject({ allergies: ['Latex'], medicalConditions: ['Diabetes'] });
    request.flush({}, { status: 400, statusText: 'test' });
  });
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
