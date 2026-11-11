import { DatePipe } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink, convertToParamMap, provideRouter } from '@angular/router';
import { PatientDetailsComponent } from './patient-details.component';
import { MedicalAlertModalComponent } from '../../shared/medical-alert-modal/medical-alert-modal.component';

describe('PatientDetailsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientDetailsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'p1' }) } },
        },
      ],
    })
      .overrideComponent(PatientDetailsComponent, {
        set: {
          imports: [
            RouterLink,
            DatePipe,
            ReactiveFormsModule,
            MedicalAlertModalComponent,
          ],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('triggers critical medical alert popup automatically when patient has registered allergies or conditions', () => {
    const fixture = TestBed.createComponent(PatientDetailsComponent);
    const http = TestBed.inject(HttpTestingController);

    const req = http.expectOne('/api/patients/p1');
    req.flush({
      id: 'p1',
      patientNumber: 'P-100',
      firstName: 'Ahmed',
      middleName: 'Ali',
      lastName: 'Hassan',
      gender: 2,
      phone: '0100000000',
      allergies: [{ id: 'a1', name: 'Penicillin' }],
      medicalConditions: [{ id: 'c1', name: 'Diabetes' }, { id: 'c2', name: 'Hypertension' }],
      medications: [{ id: 'm1', name: 'Aspirin', dosage: '100mg' }],
      status: 1,
    });

    const treatReq = http.expectOne('/api/treatments?page=1&pageSize=50&patientId=p1');
    treatReq.flush({ items: [], totalCount: 0 });

    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.hasMedicalAlerts()).toBe(true);
    expect(component.totalAlertsCount()).toBe(4);
    expect(component.showMedicalAlertModal()).toBe(true);
    expect(component.patientAllergies()).toEqual(['Penicillin']);
    expect(component.patientConditions()).toEqual(['Diabetes', 'Hypertension']);
    expect(component.patientMedications()).toEqual(['Aspirin (100mg)']);

    component.closeMedicalAlertModal();
    expect(component.showMedicalAlertModal()).toBe(false);

    component.openMedicalAlertModal();
    expect(component.showMedicalAlertModal()).toBe(true);
  });

  it('does not show medical alert popup when patient has no allergies or conditions', () => {
    const fixture = TestBed.createComponent(PatientDetailsComponent);
    const http = TestBed.inject(HttpTestingController);

    const req = http.expectOne('/api/patients/p1');
    req.flush({
      id: 'p1',
      patientNumber: 'P-101',
      firstName: 'Sarah',
      lastName: 'Mahmoud',
      gender: 1,
      allergies: [],
      medicalConditions: [],
      medications: [],
      status: 1,
    });

    const treatReq = http.expectOne('/api/treatments?page=1&pageSize=50&patientId=p1');
    treatReq.flush({ items: [], totalCount: 0 });

    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.hasMedicalAlerts()).toBe(false);
    expect(component.totalAlertsCount()).toBe(0);
    expect(component.showMedicalAlertModal()).toBe(false);
  });
  it('keeps the patient file and unsaved notes visible when saving fails', () => {
    const fixture = TestBed.createComponent(PatientDetailsComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/patients/p1').flush({
      id: 'p1', patientNumber: 'P-102', firstName: 'Sara', lastName: 'Ahmed',
      gender: 1, status: 1, phone: '0100000000', allergies: [], medicalConditions: [],
      medications: [], surgeries: [], canViewMedicalInformation: true, canEditMedicalInformation: true,
      medicalNotes: 'Original note',
    });
    http.expectOne(r => r.url === '/api/treatments').flush({ items: [], totalCount: 0 });
    const component = fixture.componentInstance;
    component.tab.set('notes');
    component.notesForm.setValue({ medicalNotes: 'Unsaved note' });
    component.saveMedicalNotes();
    http.expectOne('/api/patients/p1/medical-notes').flush({}, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(component.error()).toBe('');
    expect(component.operationError()).not.toBe('');
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.patient-profile-header')).toBeTruthy();
    expect(root.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('Unsaved note');
    expect(root.querySelector('.alert[role="alert"]')).toBeTruthy();
  });

  it('recovers the patient file after a failed initial request', () => {
    const fixture = TestBed.createComponent(PatientDetailsComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/patients/p1').flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.patient-load-error button')!.click();
    expect(fixture.componentInstance.loading()).toBe(true);
    expect(fixture.componentInstance.error()).toBe('');
    http.expectOne('/api/patients/p1').flush({
      id: 'p1', patientNumber: 'P-103', firstName: 'Sara', lastName: 'Ahmed',
      gender: 1, status: 1, allergies: [], medicalConditions: [], medications: [], surgeries: [],
    });
    http.expectOne(r => r.url === '/api/treatments').flush({ items: [], totalCount: 0 });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.patient-profile-header')).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).querySelector('.patient-load-error')).toBeNull();
  });

});
