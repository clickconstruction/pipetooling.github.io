/** Pure helpers + constants for the Settings → Templates & testing tab.
 * Extracted from Settings.tsx so the (future) presentational tab component and unit tests
 * can reuse them without importing from the page module. No React / no I/O here. */

/** Variable placeholders advertised in the email-template editor hint row. */
export const VARIABLE_HINT = '{{name}}, {{email}}, {{role}}, {{link}}'

/** Variable placeholders advertised in the notification-template editor hint row. */
export const NOTIFICATION_VARIABLE_HINT =
  '{{assignee_name}}, {{item_title}}, {{name}}, {{stage_name}}, {{project_name}}, {{assigned_to_name}}, {{next_stage_name}}, {{rejection_reason}}'

/** Variable placeholders advertised for the work_order_* email templates
 * (the set substituted by workOrderNotifications.ts: offered fills
 * {{offered_by}}, accepted/declined fill {{responder}}/{{reason}}). */
export const WORK_ORDER_VARIABLE_HINT =
  '{{name}}, {{email}}, {{project_name}}, {{stage_name}}, {{offered_by}}, {{responder}}, {{amount}}, {{window}}, {{reason}}, {{workflow_link}}'

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
    | 'work_order_offered'
    | 'work_order_accepted'
    | 'work_order_declined'
    | 'lien_release_to_customer'
    | 'hazmat_notice'
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
 * (the transactional types are excluded: `invitation` is consumed by the invite-user
 * Edge Function, `sign_in` by send-sign-in-email; `login_as` is currently unused —
 * login-as-user hands the link to the client without emailing). */
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

/** Default subject/body used when creating a new email template of each type
 * (settings → email templates → "Create"). Product copy — preserve verbatim. */
export const EMAIL_TEMPLATE_DEFAULTS: Record<EmailTemplate['template_type'], { subject: string; body: string }> = {
  invitation: {
    subject: 'Invitation to join ClickTooling',
    body: 'Hi {{name}},\n\nYou\'ve been invited to join ClickTooling as a {{role}}. Click the link below to set up your account:\n\n{{link}}\n\nIf you didn\'t expect this invitation, you can safely ignore this email.',
  },
  sign_in: {
    subject: 'Sign in to ClickTooling',
    body: 'Hi {{name}},\n\nClick the link below to sign in to your ClickTooling account:\n\n{{link}}\n\nIf you didn\'t request this sign-in link, you can safely ignore this email.',
  },
  login_as: {
    subject: 'Sign in to ClickTooling',
    body: 'Hi {{name}},\n\nA dev has requested to sign in as you. Click the link below:\n\n{{link}}\n\nIf you didn\'t expect this, please contact your administrator.',
  },
  stage_assigned_started: {
    subject: 'Workflow stage started: {{stage_name}}',
    body: 'Hi {{assigned_to_name}},\n\nThe workflow stage "{{stage_name}}" for project "{{project_name}}" has been started.\n\nProject: {{project_name}}\nStage: {{stage_name}}\n\nView the workflow: {{workflow_link}}',
  },
  stage_assigned_complete: {
    subject: 'Workflow stage completed: {{stage_name}}',
    body: 'Hi {{assigned_to_name}},\n\nThe workflow stage "{{stage_name}}" for project "{{project_name}}" has been completed.\n\nProject: {{project_name}}\nStage: {{stage_name}}\n\nView the workflow: {{workflow_link}}',
  },
  stage_assigned_reopened: {
    subject: 'Workflow stage re-opened: {{stage_name}}',
    body: 'Hi {{assigned_to_name}},\n\nThe workflow stage "{{stage_name}}" for project "{{project_name}}" has been re-opened.\n\nProject: {{project_name}}\nStage: {{stage_name}}\n\nView the workflow: {{workflow_link}}',
  },
  stage_me_started: {
    subject: 'Workflow stage started: {{stage_name}}',
    body: 'Hi {{name}},\n\nThe workflow stage "{{stage_name}}" for project "{{project_name}}" has been started.\n\nProject: {{project_name}}\nStage: {{stage_name}}\nAssigned to: {{assigned_to_name}}\n\nView the workflow: {{workflow_link}}',
  },
  stage_me_complete: {
    subject: 'Workflow stage completed: {{stage_name}}',
    body: 'Hi {{name}},\n\nThe workflow stage "{{stage_name}}" for project "{{project_name}}" has been completed.\n\nProject: {{project_name}}\nStage: {{stage_name}}\nAssigned to: {{assigned_to_name}}\n\nView the workflow: {{workflow_link}}',
  },
  stage_me_reopened: {
    subject: 'Workflow stage re-opened: {{stage_name}}',
    body: 'Hi {{name}},\n\nThe workflow stage "{{stage_name}}" for project "{{project_name}}" has been re-opened.\n\nProject: {{project_name}}\nStage: {{stage_name}}\nAssigned to: {{assigned_to_name}}\n\nView the workflow: {{workflow_link}}',
  },
  stage_next_complete_or_approved: {
    subject: 'Next workflow stage ready: {{stage_name}}',
    body: 'Hi {{assigned_to_name}},\n\nThe previous workflow stage for project "{{project_name}}" has been completed or approved. Your stage "{{stage_name}}" is now ready to begin.\n\nProject: {{project_name}}\nYour stage: {{stage_name}}\nPrevious stage: {{previous_stage_name}}\n\nView the workflow: {{workflow_link}}',
  },
  stage_prior_rejected: {
    subject: 'Prior work incomplete: {{stage_name}}',
    body: 'Hi {{assigned_to_name}},\n\nThe workflow stage "{{stage_name}}" for project "{{project_name}}" that you completed has been marked as incomplete.\n\nProject: {{project_name}}\nStage: {{stage_name}}\nReason: {{rejection_reason}}\n\nView the workflow: {{workflow_link}}',
  },
  // Work-order dispatch (RUN_SUBS_PLAN Phase 4) — verbatim copies of the row
  // seeds in migration 20260801220000_work_order_dispatch.sql.
  work_order_offered: {
    subject: 'New work order: {{stage_name}} at {{project_name}}',
    body: 'Hi {{name}},\n\n{{offered_by}} offered you a work order:\n\n{{stage_name}} at {{project_name}}\nAmount: {{amount}}\nProposed window: {{window}}\n\nOpen your dashboard to accept or decline: {{workflow_link}}',
  },
  work_order_accepted: {
    subject: '{{responder}} accepted: {{stage_name}} at {{project_name}}',
    body: '{{responder}} accepted the work order for {{stage_name}} at {{project_name}} ({{amount}}).\n\nWindow: {{window}}\n\nOpen the workflow: {{workflow_link}}',
  },
  work_order_declined: {
    subject: '{{responder}} declined: {{stage_name}} at {{project_name}}',
    body: '{{responder}} declined the work order for {{stage_name}} at {{project_name}} ({{amount}}).\n\nReason: {{reason}}\n\nRe-price or offer someone else: {{workflow_link}}',
  },
  // Customer cover notes (v2.2658) — defaults mirror the built-in wording in
  // sendLienReleaseEmail.ts / sendHazmatNoticeEmail.ts; the sender falls back
  // to those builders when no row is saved.
  lien_release_to_customer: {
    subject: 'Release of lien — {{project}}',
    body: 'Attached is the signed release of lien ({{form_label}}, {{amount}}) for {{project}}.\n\nThe attached PDF is the complete, signed document for your records.',
  },
  hazmat_notice: {
    subject: 'Biohazard Remediation Fee Notice — Job {{job_number}}',
    body: 'Please find the Biohazard Remediation Fee Notice for job {{job_number}} attached as a PDF. It documents the biohazard remediation fee on the {{invoice_reference}}. The notice includes the incident summary, photographic evidence, technician statements, and the contractual basis for the fee.',
  },
}

/** Substitute {{key}} placeholders in an email template's subject and body.
 * Every occurrence of each provided variable is replaced; unknown placeholders
 * are left untouched. */
export function replaceTemplateVariables(
  template: { subject: string; body: string },
  variables: Record<string, string>
): { subject: string; body: string } {
  let subject = template.subject
  let body = template.body

  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    subject = subject.replace(regex, value)
    body = body.replace(regex, value)
  })

  return { subject, body }
}
