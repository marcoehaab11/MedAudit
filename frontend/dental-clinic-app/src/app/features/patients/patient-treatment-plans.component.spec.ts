import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth.service';
import { PatientTreatmentPlansComponent } from './patient-treatment-plans.component';

describe('Patient treatment plans', () => {
  it('groups real statuses across pages and suppresses planned items linked to execution', () => {
    TestBed.configureTestingModule({
      imports: [PatientTreatmentPlansComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            hasPermission: (permission: string) =>
              ['TreatmentPlans.View', 'Treatments.View'].includes(permission),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(PatientTreatmentPlansComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('patientId', 'p1');
    fixture.detectChanges();

    const treatment = (id: string, treatmentName: string, status: number, tooth: number) =>
      ({ id, patientId: 'p1', treatmentName, status, toothNumbers: [tooth] });

    http.expectOne('/api/treatments?page=1&pageSize=100&patientId=p1').flush({
      page: 1,
      totalPages: 2,
      items: [
        { ...treatment('ongoing', 'Crown preparation', 3, 26), treatmentPlanItemId: 'linked' },
        treatment('cancelled', 'Cancelled', 5, 16),
        { ...treatment('other', 'Different patient', 4, 22), patientId: 'p2' },
      ],
    });
    http.expectOne('/api/treatments?page=2&pageSize=100&patientId=p1').flush({
      page: 2, totalPages: 2, items: [treatment('completed', 'Endodontics', 4, 46)],
    });
    http.expectOne('/api/treatment-plans?page=1&pageSize=100&patientId=p1').flush({
      page: 1, totalPages: 1, items: [{ id: 'plan1', status: 5 }],
    });
    http.expectOne('/api/treatment-plans/plan1').flush({
      id: 'plan1',
      patientId: 'p1',
      status: 5,
      items: [
        { id: 'linked', treatmentName: 'Linked crown', toothNumber: 26 },
        { id: 'unstarted', treatmentName: 'Restoration', toothNumber: 13 },
      ],
    });
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const cardText = (status: string) =>
      [...root.querySelectorAll(`[data-status="${status}"] .procedure-card`)]
        .map(card => card.textContent ?? '');
    expect(cardText('completed')).toEqual([expect.stringContaining('Endodontics')]);
    expect(cardText('ongoing')).toEqual([expect.stringContaining('Crown preparation')]);
    expect(cardText('planned')).toEqual([expect.stringContaining('Restoration')]);
    expect(root.textContent).not.toMatch(/Different patient|Linked crown|Cancelled/);
    http.verify();
  });
});
