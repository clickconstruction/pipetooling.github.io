/** Pure helpers + constants for the Settings → Templates & testing tab.
 * Extracted from Settings.tsx so the (future) presentational tab component and unit tests
 * can reuse them without importing from the page module. No React / no I/O here. */

/** Variable placeholders advertised in the email-template editor hint row. */
export const VARIABLE_HINT = '{{name}}, {{email}}, {{role}}, {{link}}'

/** Variable placeholders advertised in the notification-template editor hint row. */
export const NOTIFICATION_VARIABLE_HINT =
  '{{assignee_name}}, {{item_title}}, {{name}}, {{stage_name}}, {{project_name}}, {{assigned_to_name}}, {{next_stage_name}}, {{rejection_reason}}'

/** Placeholder step id for send-workflow-notification test (no recipient_user_id → no notification_history insert). */
export const WORKFLOW_FN_TEST_PLACEHOLDER_STEP_ID = '00000000-0000-4000-8000-000000000001'

/** Stored email-template row (settings → email templates). */
export type EmailTemplate = {
  id: string
  template_type:
    | 'invitation'
    | 'sign_in'
    | 'login_as'
    | 'stage_assigned_started'
    | 'stage_assigned_complete'
    | 'stage_assigned_reopened'
    | 'stage_me_started'
    | 'stage_me_complete'
    | 'stage_me_reopened'
    | 'stage_next_complete_or_approved'
    | 'stage_prior_rejected'
  subject: string
  body: string
  updated_at: string | null
}

export type NotificationTemplateType =
  | 'checklist_completed'
  | 'test_notification'
  | 'stage_assigned_started'
  | 'stage_assigned_complete'
  | 'stage_assigned_reopened'
  | 'stage_me_started'
  | 'stage_me_complete'
  | 'stage_me_reopened'
  | 'stage_next_complete_or_approved'
  | 'stage_prior_rejected'

/** Stored push-notification template row (settings → notification templates). */
export type NotificationTemplate = {
  id: string
  template_type: NotificationTemplateType
  push_title: string
  push_body: string
  updated_at: string | null
}

/** Email template types that the workflow-email Edge Function test can target
 * (the transactional `invitation` / `sign_in` / `login_as` types are excluded). */
export type WorkflowFnEmailTemplateType =
  | 'stage_assigned_started'
  | 'stage_assigned_complete'
  | 'stage_assigned_reopened'
  | 'stage_me_started'
  | 'stage_me_complete'
  | 'stage_me_reopened'
  | 'stage_next_complete_or_approved'
  | 'stage_prior_rejected'

export const WORKFLOW_FN_EMAIL_TEST_OPTIONS: Array<{ type: WorkflowFnEmailTemplateType; label: string }> = [
  { type: 'stage_assigned_started', label: 'Stage Started (Assigned)' },
  { type: 'stage_assigned_complete', label: 'Stage Complete (Assigned)' },
  { type: 'stage_assigned_reopened', label: 'Stage Re-opened (Assigned)' },
  { type: 'stage_me_started', label: 'Stage Started (ME)' },
  { type: 'stage_me_complete', label: 'Stage Complete (ME)' },
  { type: 'stage_me_reopened', label: 'Stage Re-opened (ME)' },
  { type: 'stage_next_complete_or_approved', label: 'Next Stage Ready' },
  { type: 'stage_prior_rejected', label: 'Prior work incomplete' },
]

/** Minimal structural shapes so the kernel stays decoupled from Settings.tsx's row types. */
type NotificationTemplateText = { push_title: string; push_body: string }
type NotificationTargetUser = { name: string | null; email: string | null }

/** Fill a notification template's title/body with sample values for a test send.
 * Display name falls back name → email → "Test User". Every occurrence of each
 * placeholder is replaced (split/join, not regex, so braces need no escaping). */
export function substituteNotificationVariables(
  template: NotificationTemplateText,
  targetUser: NotificationTargetUser
): { title: string; body: string } {
  const displayName = targetUser.name?.trim() || targetUser.email || 'Test User'
  const replacements: Record<string, string> = {
    '{{assignee_name}}': displayName,
    '{{name}}': displayName,
    '{{assigned_to_name}}': displayName,
    '{{item_title}}': 'Sample checklist item',
    '{{stage_name}}': 'Sample stage',
    '{{project_name}}': 'Sample project',
    '{{next_stage_name}}': 'Next stage',
    '{{rejection_reason}}': 'Sample rejection reason',
  }
  const replaceAll = (s: string) => {
    let out = s
    for (const [key, val] of Object.entries(replacements)) {
      out = out.split(key).join(val)
    }
    return out
  }
  return {
    title: replaceAll(template.push_title),
    body: replaceAll(template.push_body),
  }
}
