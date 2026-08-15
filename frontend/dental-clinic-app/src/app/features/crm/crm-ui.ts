import { CrmDashboard, FollowUpPayload } from './crm-api.service';

export const dashboardValues = (data: CrmDashboard) => [
  data.newPatientsToday,
  data.newPatientsThisWeek,
  data.pendingFollowUps,
  data.overdueFollowUps,
  data.completedFollowUps,
  data.todayFollowUps,
];

export const followUpFilters = (values: Record<string, string | boolean>, page: number) => {
  const result: Record<string, string> = { page: String(Math.max(1, page)) };
  Object.entries(values).forEach(([key, value]) => {
    if (value) result[key] = String(value);
  });
  return result;
};

export const validFollowUp = (value: Partial<FollowUpPayload>) =>
  !!(
    value.patientId?.trim() &&
    value.assignedToUserId?.trim() &&
    value.type &&
    value.dueDate &&
    value.dueTime &&
    value.title?.trim()
  );
export const isCrmConflict = (status: number) => status === 409;
