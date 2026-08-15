import { describe, expect, it } from 'vitest';
import {
  activityType,
  clinicDate,
  crmTimeline,
  followUpActions,
  followUpStatus,
  followUpType,
} from './crm-labels';
describe('CRM presentation rules', () => {
  it('renders statuses and types in both languages', () => {
    expect(followUpStatus(2)).toBe('In progress');
    expect(followUpStatus(2, true)).not.toBe('In progress');
    expect(followUpType(8)).toBe('General');
    expect(activityType(1)).toBe('Call');
  });
  it('limits terminal status actions', () => {
    expect(followUpActions(1)).toEqual(['start', 'complete', 'cancel']);
    expect(followUpActions(2)).toEqual(['complete', 'cancel']);
    expect(followUpActions(3)).toEqual([]);
  });
  it('sorts communication and completed follow-ups into one timeline', () => {
    const timeline = crmTimeline(
      [
        {
          id: 'a',
          patientId: 'p',
          patientName: 'P',
          userId: 'u',
          userName: 'U',
          type: 1,
          direction: 1,
          occurredAt: '2026-08-15T11:30:00Z',
          createdAt: '2026-08-15T11:30:00Z',
        },
      ],
      [
        {
          id: 'f',
          patientId: 'p',
          patientName: 'P',
          assignedToUserId: 'u',
          assignedToName: 'U',
          type: 8,
          status: 3,
          dueAt: '2026-08-15T10:00:00Z',
          isOverdue: false,
          title: 'Done',
          createdAt: '2026-08-15T10:00:00Z',
          version: 'v',
          timeZone: 'Africa/Cairo',
        },
      ],
    );
    expect(timeline.map((x) => x.id)).toEqual(['a', 'f']);
  });
  it('formats UTC timestamps in the clinic timezone', () => {
    expect(clinicDate('2026-08-15T08:00:00Z', 'Africa/Cairo', 'en')).toContain('11:00');
  });
});
