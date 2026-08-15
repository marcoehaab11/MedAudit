import { describe, expect, it } from 'vitest';
import { dashboardValues, followUpFilters, isCrmConflict, validFollowUp } from './crm-ui';

describe('CRM UI behavior', () => {
  it('maps aggregated dashboard values without loading CRM rows', () => {
    expect(
      dashboardValues({
        newPatientsToday: 1,
        newPatientsThisWeek: 2,
        newPatientsThisMonth: 3,
        pendingFollowUps: 4,
        overdueFollowUps: 5,
        completedFollowUps: 6,
        todayFollowUps: 7,
        timeZone: 'Africa/Cairo',
      }),
    ).toEqual([1, 2, 4, 5, 6, 7]);
  });
  it('sends only active server-side filters and a safe page', () => {
    expect(followUpFilters({ search: 'patient', overdue: true, status: '' }, 0)).toEqual({
      page: '1',
      search: 'patient',
      overdue: 'true',
    });
  });
  it('validates required follow-up creation fields', () => {
    const draft = {
      patientId: 'p',
      assignedToUserId: 'u',
      type: 8,
      dueDate: '2026-08-15',
      dueTime: '09:00',
      title: 'Call patient',
    };
    expect(validFollowUp(draft)).toBe(true);
    expect(validFollowUp({ ...draft, title: ' ' })).toBe(false);
  });
  it('recognizes optimistic concurrency responses', () => {
    expect(isCrmConflict(409)).toBe(true);
    expect(isCrmConflict(400)).toBe(false);
  });
});
