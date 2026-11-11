import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { PatientFormComponent } from './patient-form.component';

describe('Patient creation medical history', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
      ],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('commits medical text typed into the actual inputs even when submitted without blur', async () => {
    const fixture = TestBed.createComponent(PatientFormComponent);
    const c = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    c.form.patchValue({
      firstName: 'Mona',
      lastName: 'Hassan',
      dateOfBirth: '1990-01-01',
      phone: '01012345678',
    });
    fixture.detectChanges();
    await fixture.whenStable();
    const inputs = fixture.nativeElement.querySelectorAll(
      'app-tag-input input',
    ) as NodeListOf<HTMLInputElement>;
    ['Penicillin', 'Diabetes', 'Metformin'].forEach((value, index) => {
      inputs[index].value = value;
      inputs[index].dispatchEvent(new Event('input'));
    });
    c.save();
    const request = http.expectOne('/api/patients');
    expect(request.request.body).toMatchObject({
      allergies: ['Penicillin'],
      medicalConditions: ['Diabetes'],
      medications: ['Metformin'],
    });
    request.flush({}, { status: 400, statusText: 'test' });
  }, 15_000);
  it('includes edited medical history in the profile save when permitted', () => {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { snapshot: { paramMap: convertToParamMap({ id: 'p1' }) } },
    });
    const c = TestBed.createComponent(PatientFormComponent).componentInstance;
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne('/api/patients/p1')
      .flush({
        firstName: 'Mona',
        lastName: 'Hassan',
        gender: 2,
        dateOfBirth: '1990-01-01',
        phone: '01012345678',
        canEditMedicalInformation: true,
        allergies: [{ name: 'Latex' }],
        medicalConditions: [],
        medications: [],
      });
    c.conditions = ['Diabetes'];
    c.save();
    const request = http.expectOne('/api/patients/p1');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toMatchObject({
      allergies: ['Latex'],
      medicalConditions: ['Diabetes'],
    });
    request.flush({}, { status: 400, statusText: 'test' });
  });
  it('sends the medical warnings in the same request as the new patient and reports failure', () => {
    const c = TestBed.createComponent(PatientFormComponent).componentInstance;
    const http = TestBed.inject(HttpTestingController);
    c.form.patchValue({
      firstName: 'Mona',
      lastName: 'Hassan',
      dateOfBirth: '1990-01-01',
      phone: '01012345678',
    });
    c.allergies = ['Penicillin'];
    c.conditions = ['Diabetes'];
    c.medications = ['Metformin'];
    c.save();
    const request = http.expectOne('/api/patients');
    expect(request.request.body).toMatchObject({
      allergies: ['Penicillin'],
      medicalConditions: ['Diabetes'],
      medications: ['Metformin'],
    });
    request.flush(
      { detail: 'Could not save medical history' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(c.saving()).toBe(false);
    expect(c.error()).toBeTruthy();
    http.expectNone((r) => /allergies|conditions|medications/.test(r.url));
  });
  it('blocks saving an unloaded edit and supports retry without losing the permission contract', () => {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { snapshot: { paramMap: convertToParamMap({ id: 'p1' }) } },
    });
    const fixture = TestBed.createComponent(PatientFormComponent),
      c = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/patients/p1').flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(c.loadError()).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.patient-form')).toBeNull();
    c.save();
    http.expectNone((r) => r.method === 'PUT');
    c.loadPatient();
    http
      .expectOne('/api/patients/p1')
      .flush({
        firstName: 'Mona',
        lastName: 'Hassan',
        dateOfBirth: '1990-01-01',
        phone: '01012345678',
        canEditMedicalInformation: false,
        allergies: [{ name: 'Latex' }],
        medicalConditions: [],
        medications: [],
      });
    c.allergies = ['Changed'];
    c.save();
    const update = http.expectOne('/api/patients/p1');
    expect(update.request.body.allergies).toBeUndefined();
    update.flush({}, { status: 403, statusText: 'Forbidden' });
  });
  it('prevents duplicate patient creation while preserving data after failure', () => {
    const c = TestBed.createComponent(PatientFormComponent).componentInstance,
      http = TestBed.inject(HttpTestingController);
    c.form.patchValue({
      firstName: 'Mona',
      lastName: 'Hassan',
      dateOfBirth: '1990-01-01',
      phone: '01012345678',
    });
    c.allergies = ['Latex'];
    c.save();
    c.save();
    const req = http.expectOne((r) => r.url === '/api/patients' && r.method === 'POST');
    req.flush({}, { status: 503, statusText: 'Unavailable' });
    expect(c.form.controls.firstName.value).toBe('Mona');
    expect(c.allergies).toEqual(['Latex']);
    expect(c.saving()).toBe(false);
  });
});
