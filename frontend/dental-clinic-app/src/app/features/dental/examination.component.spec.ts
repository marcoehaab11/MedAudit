import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ExaminationComponent } from './examination.component';

describe('ExaminationComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExaminationComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ appointmentId: 'a1' }) } },
        },
      ],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('loads the examination and supports finding, procedure and endodontic views', () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.selected = 36;
    fixture.detectChanges();
    expect(component.selectedFindings()).toHaveLength(1);
    expect(component.selectedProcedures()).toHaveLength(1);
    component.tab.set('endodontic');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('21 mm');
  });

  it('sends the current version and reloads after adding a finding', () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    fixture.componentInstance.selected = 36;
    fixture.componentInstance.addFinding();
    const request = http.expectOne('/api/examinations/e1/findings');
    expect(request.request.body.version).toBe('00000000-0000-0000-0000-000000000001');
    expect(request.request.body.toothNumber).toBe(36);
    request.flush({});
    http.expectOne('/api/appointments/a1/examination').flush(examination());
  });

  it('shows actionable conflict feedback after a stale draft write', () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    fixture.componentInstance.saveNotes();
    http.expectOne('/api/examinations/e1').flush({}, { status: 409, statusText: 'Conflict' });
    expect(fixture.componentInstance.error()).toContain('changed');
  });
});

function examination() {
  return {
    id: 'e1',
    patientId: 'p1',
    patientName: 'Mona Hassan',
    patientNumber: 'P-1',
    appointmentId: 'a1',
    appointmentStatus: 4,
    doctorUserId: 'u1',
    doctorName: 'Dr Sara',
    status: 1,
    notes: 'draft',
    createdAt: '2026-08-17T06:00:00Z',
    updatedAt: '2026-08-17T06:00:00Z',
    version: '00000000-0000-0000-0000-000000000001',
    canEdit: true,
    canComplete: true,
    findings: [
      {
        id: 'f1',
        toothId: 't36',
        toothNumber: 36,
        type: 2,
        surfaces: [2, 4],
        notes: 'Caries',
        createdAt: '',
        createdBy: 'u1',
      },
    ],
    procedures: [
      {
        id: 'p1',
        toothId: 't36',
        toothNumber: 36,
        type: 1,
        surfaces: [2, 4],
        notes: 'Filling',
        createdAt: '',
        createdBy: 'u1',
      },
    ],
    endodonticRecords: [
      {
        id: 'r1',
        toothId: 't36',
        toothNumber: 36,
        notes: 'Endo',
        createdAt: '',
        createdBy: 'u1',
        canals: [{ id: 'c1', name: 'MB', lengthMm: 21 }],
      },
    ],
  };
}
