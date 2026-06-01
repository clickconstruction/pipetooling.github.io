/** Settings → Templates & testing tab (dev only): invoice/map dev blocks, dispatch phone,
 * job parts tally min-date, delete-all-estimates, notification/email template test + editors,
 * workflow-email Edge Function test, and report settings.
 * Presentational; all state/handlers live in the parent (Settings.tsx) and arrive as props.
 * The SettingsGroup wrapper and the myRole === dev gate stay in the parent. */
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import {
  APP_SETTINGS_KEY_FIELD_DISPATCH_PHONE,
  APP_SETTINGS_KEY_JOB_TALLY_MIN_POSTED_YMD,
  isValidYmd,
} from '../../lib/appSettingsKeys'
import {
  NOTIFICATION_VARIABLE_HINT,
  VARIABLE_HINT,
  WORKFLOW_FN_EMAIL_TEST_OPTIONS,
  type EmailTemplate,
  type NotificationTemplate,
  type WorkflowFnEmailTemplateType,
} from '../../lib/settingsTemplates'
import StripeInvoiceFooterDevSettingsBlock from './StripeInvoiceFooterDevSettingsBlock'
import PhysicalInvoiceFooterDevSettingsBlock from './PhysicalInvoiceFooterDevSettingsBlock'
import BillCustomerMemoDevSettingsBlock from './BillCustomerMemoDevSettingsBlock'
import MapDefaultViewSettingsBlock from './MapDefaultViewSettingsBlock'
import PhysicalInvoiceIssuerDevSettingsBlock from './PhysicalInvoiceIssuerDevSettingsBlock'

type TemplatesTabUserRow = { id: string; name: string; email: string; role: string }

type SettingsTemplatesTabProps = {
  authUser: { id: string } | null
  users: TemplatesTabUserRow[]
  // Field collect payment — dispatch phone
  fieldDispatchPhoneInput: string
  setFieldDispatchPhoneInput: Dispatch<SetStateAction<string>>
  fieldDispatchPhoneSaving: boolean
  setFieldDispatchPhoneSaving: Dispatch<SetStateAction<boolean>>
  // Job parts tally min posted date
  jobTallyMinPostedYmdInput: string
  setJobTallyMinPostedYmdInput: Dispatch<SetStateAction<string>>
  jobTallyMinPostedYmdSaving: boolean
  setJobTallyMinPostedYmdSaving: Dispatch<SetStateAction<boolean>>
  jobTallyMinPostedYmdError: string | null
  setJobTallyMinPostedYmdError: Dispatch<SetStateAction<string | null>>
  templatesJobPartsTallySectionOpen: boolean
  setTemplatesJobPartsTallySectionOpen: Dispatch<SetStateAction<boolean>>
  // Delete all estimates
  templatesDeleteAllEstimatesSectionOpen: boolean
  setTemplatesDeleteAllEstimatesSectionOpen: Dispatch<SetStateAction<boolean>>
  devResetEstimatesModalOpen: boolean
  setDevResetEstimatesModalOpen: Dispatch<SetStateAction<boolean>>
  devResetEstimatesConfirmInput: string
  setDevResetEstimatesConfirmInput: Dispatch<SetStateAction<string>>
  devResetEstimatesLoading: boolean
  setDevResetEstimatesLoading: Dispatch<SetStateAction<boolean>>
  // Test target + notification template testing
  templateTestTargetUserId: string
  setTemplateTestTargetUserId: Dispatch<SetStateAction<string>>
  notificationTestError: string | null
  setNotificationTestError: Dispatch<SetStateAction<string | null>>
  notificationTestSuccess: string | null
  setNotificationTestSuccess: Dispatch<SetStateAction<string | null>>
  notificationTestSending: string | null
  testError: string | null
  setTestError: Dispatch<SetStateAction<string | null>>
  // Workflow-email Edge Function test
  workflowFnEmailSectionOpen: boolean
  setWorkflowFnEmailSectionOpen: Dispatch<SetStateAction<boolean>>
  workflowFnTestError: string | null
  setWorkflowFnTestError: Dispatch<SetStateAction<string | null>>
  workflowFnTestSuccess: string | null
  setWorkflowFnTestSuccess: Dispatch<SetStateAction<string | null>>
  workflowFnTestTemplateType: WorkflowFnEmailTemplateType
  setWorkflowFnTestTemplateType: Dispatch<SetStateAction<WorkflowFnEmailTemplateType>>
  workflowFnTestSending: boolean
  // Email templates
  emailTemplates: EmailTemplate[]
  emailTemplatesSectionOpen: boolean
  setEmailTemplatesSectionOpen: Dispatch<SetStateAction<boolean>>
  editingTemplate: EmailTemplate | null
  templateSubject: string
  setTemplateSubject: Dispatch<SetStateAction<string>>
  templateBody: string
  setTemplateBody: Dispatch<SetStateAction<string>>
  templateSaving: boolean
  templateError: string | null
  setTemplateError: Dispatch<SetStateAction<string | null>>
  testingTemplate: EmailTemplate | null
  testSending: boolean
  // Notification templates
  notificationTemplates: NotificationTemplate[]
  notificationTemplatesSectionOpen: boolean
  setNotificationTemplatesSectionOpen: Dispatch<SetStateAction<boolean>>
  editingNotificationTemplate: NotificationTemplate | null
  notificationTemplateTitle: string
  setNotificationTemplateTitle: Dispatch<SetStateAction<string>>
  notificationTemplateBody: string
  setNotificationTemplateBody: Dispatch<SetStateAction<string>>
  notificationTemplateSaving: boolean
  notificationTemplateError: string | null
  setNotificationTemplateError: Dispatch<SetStateAction<string | null>>
  // Report settings
  reportEditWindowDays: string
  setReportEditWindowDays: Dispatch<SetStateAction<string>>
  reportSubVisibilityMonths: string
  setReportSubVisibilityMonths: Dispatch<SetStateAction<string>>
  reportEnabledUserIds: Set<string>
  reportSettingsSaving: boolean
  reportSettingsSectionOpen: boolean
  setReportSettingsSectionOpen: Dispatch<SetStateAction<boolean>>
  // Handlers (logic stays in parent)
  closeEditNotificationTemplate: () => void
  closeEditTemplate: () => void
  closeTestEmail: () => void
  openEditTemplate: (template: EmailTemplate | undefined, templateType: EmailTemplate['template_type']) => void
  openEditNotificationTemplate: (template: NotificationTemplate | null) => void
  openTestEmail: (
    template: EmailTemplate | { template_type: EmailTemplate['template_type']; subject: string; body: string },
  ) => void
  saveEmailTemplate: (e: FormEvent) => void
  saveNotificationTemplate: (e: FormEvent) => void
  saveReportSettings: (e: FormEvent) => void
  sendTestEmail: (e: FormEvent) => void
  sendTestNotificationTemplate: (template: NotificationTemplate) => void
  sendWorkflowNotificationEmailTest: () => void
  testCurrentTemplate: () => void
  toggleReportEnabledUser: (userId: string) => void
}

export default function SettingsTemplatesTab({
  authUser,
  users,
  fieldDispatchPhoneInput,
  setFieldDispatchPhoneInput,
  fieldDispatchPhoneSaving,
  setFieldDispatchPhoneSaving,
  jobTallyMinPostedYmdInput,
  setJobTallyMinPostedYmdInput,
  jobTallyMinPostedYmdSaving,
  setJobTallyMinPostedYmdSaving,
  jobTallyMinPostedYmdError,
  setJobTallyMinPostedYmdError,
  templatesJobPartsTallySectionOpen,
  setTemplatesJobPartsTallySectionOpen,
  templatesDeleteAllEstimatesSectionOpen,
  setTemplatesDeleteAllEstimatesSectionOpen,
  devResetEstimatesModalOpen,
  setDevResetEstimatesModalOpen,
  devResetEstimatesConfirmInput,
  setDevResetEstimatesConfirmInput,
  devResetEstimatesLoading,
  setDevResetEstimatesLoading,
  templateTestTargetUserId,
  setTemplateTestTargetUserId,
  notificationTestError,
  setNotificationTestError,
  notificationTestSuccess,
  setNotificationTestSuccess,
  notificationTestSending,
  testError,
  setTestError,
  workflowFnEmailSectionOpen,
  setWorkflowFnEmailSectionOpen,
  workflowFnTestError,
  setWorkflowFnTestError,
  workflowFnTestSuccess,
  setWorkflowFnTestSuccess,
  workflowFnTestTemplateType,
  setWorkflowFnTestTemplateType,
  workflowFnTestSending,
  emailTemplates,
  emailTemplatesSectionOpen,
  setEmailTemplatesSectionOpen,
  editingTemplate,
  templateSubject,
  setTemplateSubject,
  templateBody,
  setTemplateBody,
  templateSaving,
  templateError,
  setTemplateError,
  testingTemplate,
  testSending,
  notificationTemplates,
  notificationTemplatesSectionOpen,
  setNotificationTemplatesSectionOpen,
  editingNotificationTemplate,
  notificationTemplateTitle,
  setNotificationTemplateTitle,
  notificationTemplateBody,
  setNotificationTemplateBody,
  notificationTemplateSaving,
  notificationTemplateError,
  setNotificationTemplateError,
  reportEditWindowDays,
  setReportEditWindowDays,
  reportSubVisibilityMonths,
  setReportSubVisibilityMonths,
  reportEnabledUserIds,
  reportSettingsSaving,
  reportSettingsSectionOpen,
  setReportSettingsSectionOpen,
  closeEditNotificationTemplate,
  closeEditTemplate,
  closeTestEmail,
  openEditTemplate,
  openEditNotificationTemplate,
  openTestEmail,
  saveEmailTemplate,
  saveNotificationTemplate,
  saveReportSettings,
  sendTestEmail,
  sendTestNotificationTemplate,
  sendWorkflowNotificationEmailTest,
  testCurrentTemplate,
  toggleReportEnabledUser,
}: SettingsTemplatesTabProps) {
  const { showToast } = useToastContext()
  return (
    <>
          <StripeInvoiceFooterDevSettingsBlock />
          <PhysicalInvoiceIssuerDevSettingsBlock />
          <PhysicalInvoiceFooterDevSettingsBlock />
          <BillCustomerMemoDevSettingsBlock />
          <MapDefaultViewSettingsBlock />
          <div
            style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              background: '#fafafa',
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 600 }}>
              Field collect payment — dispatch phone
            </h3>
            <p style={{ margin: '0 0 0.75rem', color: '#6b7280', fontSize: '0.875rem', lineHeight: 1.5 }}>
              Shown to subcontractors on Collect Payment step 2 (Awaiting dispatch). E.164 or US digits; example:{' '}
              <code>+15123600599</code> or <code>512 360 0599</code>. Leave empty to use the app default.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
              <label htmlFor="field-dispatch-phone" style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                Phone
              </label>
              <input
                id="field-dispatch-phone"
                type="text"
                autoComplete="tel"
                value={fieldDispatchPhoneInput}
                onChange={(e) => setFieldDispatchPhoneInput(e.target.value)}
                placeholder="+15123600599"
                style={{ padding: '0.35rem 0.5rem', fontSize: '0.875rem', minWidth: 200 }}
              />
              <button
                type="button"
                disabled={fieldDispatchPhoneSaving}
                onClick={() => {
                  void (async () => {
                    setFieldDispatchPhoneSaving(true)
                    try {
                      await withSupabaseRetry(
                        async () =>
                          supabase.from('app_settings').upsert(
                            {
                              key: APP_SETTINGS_KEY_FIELD_DISPATCH_PHONE,
                              value_text: fieldDispatchPhoneInput.trim(),
                            },
                            { onConflict: 'key' },
                          ),
                        'save field dispatch phone app setting',
                      )
                      showToast('Dispatch phone saved.', 'success')
                    } catch (e) {
                      showToast(formatErrorMessage(e), 'error')
                    } finally {
                      setFieldDispatchPhoneSaving(false)
                    }
                  })()
                }}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.875rem',
                  cursor: fieldDispatchPhoneSaving ? 'wait' : 'pointer',
                }}
              >
                {fieldDispatchPhoneSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
          <div style={{ marginBottom: '1.5rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <button
              type="button"
              onClick={() => setTemplatesJobPartsTallySectionOpen((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                margin: 0,
                padding: '1rem',
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 600,
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '0.75rem' }}>{templatesJobPartsTallySectionOpen ? '▼' : '▶'}</span>
              Job Parts Tally
            </button>
            {templatesJobPartsTallySectionOpen ? (
              <div
                style={{
                  padding: '0 1rem 1rem 1rem',
                  borderTop: '1px solid #e5e7eb',
                  background: '#fafafa',
                }}
              >
                <p style={{ margin: '0 0 0.75rem', color: '#6b7280', fontSize: '0.875rem', lineHeight: 1.5 }}>
                  Org-wide minimum posted date (Chicago calendar day). Transactions before this day are hidden on Job Parts
                  Tally for everyone. Leave empty to show all.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                  <label htmlFor="job-tally-min-posted-ymd" style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                    Minimum posted date
                  </label>
                  <input
                    id="job-tally-min-posted-ymd"
                    type="date"
                    value={jobTallyMinPostedYmdInput}
                    onChange={(e) => {
                      setJobTallyMinPostedYmdInput(e.target.value)
                      setJobTallyMinPostedYmdError(null)
                    }}
                    style={{ padding: '0.35rem 0.5rem', fontSize: '0.875rem' }}
                  />
                  <button
                    type="button"
                    disabled={jobTallyMinPostedYmdSaving}
                    onClick={() => {
                      void (async () => {
                        const trimmed = jobTallyMinPostedYmdInput.trim()
                        if (trimmed !== '' && !isValidYmd(trimmed)) {
                          setJobTallyMinPostedYmdError('Use YYYY-MM-DD or clear the field.')
                          return
                        }
                        setJobTallyMinPostedYmdError(null)
                        setJobTallyMinPostedYmdSaving(true)
                        try {
                          await withSupabaseRetry(
                            async () =>
                              supabase.from('app_settings').upsert(
                                { key: APP_SETTINGS_KEY_JOB_TALLY_MIN_POSTED_YMD, value_text: trimmed },
                                { onConflict: 'key' },
                              ),
                            'save job tally min posted app setting',
                          )
                          showToast('Job Tally minimum posted date saved.', 'success')
                        } catch (e) {
                          showToast(formatErrorMessage(e), 'error')
                        } finally {
                          setJobTallyMinPostedYmdSaving(false)
                        }
                      })()
                    }}
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.875rem',
                      cursor: jobTallyMinPostedYmdSaving ? 'wait' : 'pointer',
                    }}
                  >
                    {jobTallyMinPostedYmdSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
                {jobTallyMinPostedYmdError ? (
                  <p style={{ margin: '0.5rem 0 0', color: '#b91c1c', fontSize: '0.8125rem' }}>
                    {jobTallyMinPostedYmdError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          <div style={{ marginBottom: '1.5rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <button
              type="button"
              onClick={() => setTemplatesDeleteAllEstimatesSectionOpen((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                margin: 0,
                padding: '1rem',
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 600,
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '0.75rem' }}>{templatesDeleteAllEstimatesSectionOpen ? '▼' : '▶'}</span>
              Delete all estimates (this org, dev only)
            </button>
            {templatesDeleteAllEstimatesSectionOpen ? (
              <div
                style={{
                  padding: '0 1rem 1rem 1rem',
                  borderTop: '1px solid #fecaca',
                  background: '#fffbeb',
                }}
              >
                <p style={{ margin: '0 0 0.75rem', color: '#78350f', fontSize: '0.875rem', lineHeight: 1.5 }}>
                  Permanently removes every estimate for your resolved org (all statuses). Jobs are not deleted. Related
                  thread notes and customer events are removed with each estimate. The next quote number is{' '}
                  <strong>1</strong> only if no estimate rows remain in the database after this; if other organizations still
                  have quotes, the next number follows the global sequence.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setDevResetEstimatesConfirmInput('')
                    setDevResetEstimatesModalOpen(true)
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    background: '#b91c1c',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  Delete all estimates…
                </button>
              </div>
            ) : null}
          </div>
          {devResetEstimatesModalOpen ? (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="dev-reset-estimates-title"
                style={{
                  background: 'white',
                  borderRadius: 8,
                  padding: '1.5rem',
                  maxWidth: '480px',
                  width: '90%',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                }}
              >
                <h3 id="dev-reset-estimates-title" style={{ marginTop: 0, marginBottom: '0.75rem', color: '#991b1b' }}>
                  Confirm delete all estimates
                </h3>
                <p style={{ margin: '0 0 0.75rem', color: '#374151', fontSize: '0.875rem', lineHeight: 1.5 }}>
                  This cannot be undone. Type <strong>DELETE</strong> below to confirm.
                </p>
                <input
                  type="text"
                  value={devResetEstimatesConfirmInput}
                  onChange={(e) => setDevResetEstimatesConfirmInput(e.target.value)}
                  placeholder="DELETE"
                  autoComplete="off"
                  aria-label="Type DELETE to confirm"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.875rem',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    marginBottom: '1rem',
                  }}
                />
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={devResetEstimatesLoading}
                    onClick={() => {
                      setDevResetEstimatesModalOpen(false)
                      setDevResetEstimatesConfirmInput('')
                    }}
                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={devResetEstimatesLoading || devResetEstimatesConfirmInput.trim() !== 'DELETE'}
                    onClick={() => {
                      void (async () => {
                        setDevResetEstimatesLoading(true)
                        try {
                          const deleted = await withSupabaseRetry(
                            () => supabase.rpc('dev_reset_estimates_for_testing'),
                            'dev reset estimates',
                          )
                          const n = typeof deleted === 'number' ? deleted : 0
                          showToast(`Deleted ${n} estimate(s). Quote numbering updated.`, 'success')
                          setDevResetEstimatesModalOpen(false)
                          setDevResetEstimatesConfirmInput('')
                        } catch (e) {
                          showToast(formatErrorMessage(e, 'Could not reset estimates'), 'error')
                        } finally {
                          setDevResetEstimatesLoading(false)
                        }
                      })()
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      background:
                        devResetEstimatesLoading || devResetEstimatesConfirmInput.trim() !== 'DELETE'
                          ? '#e5e7eb'
                          : '#b91c1c',
                      color:
                        devResetEstimatesLoading || devResetEstimatesConfirmInput.trim() !== 'DELETE'
                          ? '#6b7280'
                          : '#ffffff',
                      border: 'none',
                      borderRadius: 4,
                      cursor:
                        devResetEstimatesLoading || devResetEstimatesConfirmInput.trim() !== 'DELETE'
                          ? 'not-allowed'
                          : 'pointer',
                    }}
                  >
                    {devResetEstimatesLoading ? 'Deleting…' : 'Confirm delete'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          <p style={{ marginTop: '2rem', marginBottom: '0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>
            Choose who receives <strong>notification</strong> and <strong>email</strong> template tests (push goes to their devices; email goes to their account email).
          </p>
          <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <label htmlFor="templates-test-target" style={{ fontWeight: 600, fontSize: '0.875rem' }}>
              Test target (notifications and email):
            </label>
            <select
              id="templates-test-target"
              value={templateTestTargetUserId}
              onChange={(e) => {
                setTemplateTestTargetUserId(e.target.value)
                setNotificationTestError(null)
                setNotificationTestSuccess(null)
                setTestError(null)
                setWorkflowFnTestError(null)
                setWorkflowFnTestSuccess(null)
              }}
              style={{ padding: '0.35rem 0.5rem', minWidth: 200 }}
            >
              <option value="">Select user…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.id === authUser?.id ? `${u.name || u.email} (Me)` : u.name || u.email}
                </option>
              ))}
            </select>
            {notificationTestSuccess && (
              <span style={{ color: '#059669', fontSize: '0.875rem' }}>{notificationTestSuccess}</span>
            )}
            {notificationTestError && (
              <span style={{ color: '#b91c1c', fontSize: '0.875rem' }}>{notificationTestError}</span>
            )}
          </div>

          <div style={{ marginTop: '2rem', marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <button
              type="button"
              onClick={() => setWorkflowFnEmailSectionOpen((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                margin: 0,
                padding: '1rem',
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 600,
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '0.75rem' }}>{workflowFnEmailSectionOpen ? '▼' : '▶'}</span>
              Workflow email (Edge Function)
            </button>
            {workflowFnEmailSectionOpen && (
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
                <p style={{ margin: '0 0 0.75rem 0', color: '#6b7280', fontSize: '0.875rem' }}>
                  Calls <code style={{ fontSize: '0.8125rem' }}>send-workflow-notification</code> so the server loads{' '}
                  <code style={{ fontSize: '0.8125rem' }}>email_templates</code> by type and sends via Resend (not the{' '}
                  <code style={{ fontSize: '0.8125rem' }}>test-email</code> shortcut). Does not write{' '}
                  <code style={{ fontSize: '0.8125rem' }}>notification_history</code>.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                  <label htmlFor="workflow-fn-test-template" style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                    Template type:
                  </label>
                  <select
                    id="workflow-fn-test-template"
                    value={workflowFnTestTemplateType}
                    onChange={(e) => {
                      setWorkflowFnTestTemplateType(e.target.value as WorkflowFnEmailTemplateType)
                      setWorkflowFnTestError(null)
                      setWorkflowFnTestSuccess(null)
                    }}
                    style={{ padding: '0.35rem 0.5rem', minWidth: 220 }}
                  >
                    {WORKFLOW_FN_EMAIL_TEST_OPTIONS.map((o) => (
                      <option key={o.type} value={o.type}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void sendWorkflowNotificationEmailTest()}
                    disabled={
                      !templateTestTargetUserId ||
                      workflowFnTestSending ||
                      !emailTemplates.some((t) => t.template_type === workflowFnTestTemplateType)
                    }
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}
                  >
                    {workflowFnTestSending ? 'Sending…' : 'Send test'}
                  </button>
                </div>
                {!emailTemplates.some((t) => t.template_type === workflowFnTestTemplateType) && (
                  <p style={{ margin: '0.5rem 0 0 0', color: '#b45309', fontSize: '0.8125rem' }}>
                    Create this template under Email Templates below to enable the button.
                  </p>
                )}
                {workflowFnTestSuccess && (
                  <p style={{ margin: '0.5rem 0 0 0', color: '#059669', fontSize: '0.875rem' }}>{workflowFnTestSuccess}</p>
                )}
                {workflowFnTestError && (
                  <p style={{ margin: '0.5rem 0 0 0', color: '#b91c1c', fontSize: '0.875rem' }}>{workflowFnTestError}</p>
                )}
              </div>
            )}
          </div>

          {/* Notification Templates - collapsible, above Email Templates */}
          <div style={{ marginTop: '2rem', marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <button
              type="button"
              onClick={() => setNotificationTemplatesSectionOpen((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                margin: 0,
                padding: '1rem',
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 600,
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '0.75rem' }}>{notificationTemplatesSectionOpen ? '▼' : '▶'}</span>
              Notification Templates
            </button>
            {notificationTemplatesSectionOpen && (
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
                <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                  Customize push notification title and body shown to users. Use variables like {NOTIFICATION_VARIABLE_HINT}.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {[
                    { type: 'checklist_completed' as const, label: 'Checklist completed', description: 'When a checklist item is completed' },
                    { type: 'test_notification' as const, label: 'Test notification', description: 'Settings test notification' },
                    { type: 'stage_assigned_started' as const, label: 'Stage started (assigned)', description: 'Workflow stage started, sent to assigned person' },
                    { type: 'stage_assigned_complete' as const, label: 'Stage completed (assigned)', description: 'Workflow stage completed, sent to assigned person' },
                    { type: 'stage_assigned_reopened' as const, label: 'Stage re-opened (assigned)', description: 'Workflow stage re-opened, sent to assigned person' },
                    { type: 'stage_me_started' as const, label: 'Stage started (ME)', description: 'Subscribed stage started' },
                    { type: 'stage_me_complete' as const, label: 'Stage completed (ME)', description: 'Subscribed stage completed' },
                    { type: 'stage_me_reopened' as const, label: 'Stage re-opened (ME)', description: 'Subscribed stage re-opened' },
                    { type: 'stage_next_complete_or_approved' as const, label: 'Your turn', description: 'Next stage ready after previous completed/approved' },
                    { type: 'stage_prior_rejected' as const, label: 'Prior work incomplete', description: 'Prior work incomplete, sent to prior assignee' },
                  ].map(({ type, label, description }) => {
                    const template = notificationTemplates.find(t => t.template_type === type)
                    return (
                      <div key={type} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{label}</h3>
                            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>{description}</p>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={() => template && sendTestNotificationTemplate(template)}
                              disabled={!template || !templateTestTargetUserId || !!notificationTestSending}
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}
                            >
                              {notificationTestSending === type ? 'Sending…' : 'Test'}
                            </button>
                            <button
                              type="button"
                              onClick={() => template && openEditNotificationTemplate(template)}
                              disabled={!template}
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                        {template && (
                          <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                            <div><strong>Title:</strong> {template.push_title}</div>
                            <div style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap', maxHeight: '3rem', overflow: 'hidden' }}>
                              <strong>Body:</strong> {template.push_body.substring(0, 100)}{template.push_body.length > 100 ? '...' : ''}
                            </div>
                            {template.updated_at && (
                              <div style={{ marginTop: '0.25rem', fontSize: '0.8125rem' }}>
                                Last updated: {new Date(template.updated_at).toLocaleString()}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Email Templates - collapsible, collapsed by default */}
          <div style={{ marginTop: '2rem', marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <button
              type="button"
              onClick={() => setEmailTemplatesSectionOpen((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                margin: 0,
                padding: '1rem',
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 600,
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '0.75rem' }}>{emailTemplatesSectionOpen ? '▼' : '▶'}</span>
              Email Templates
            </button>
            {emailTemplatesSectionOpen && (
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
                <p style={{ marginBottom: '0.5rem', color: '#dc2626', fontSize: '0.875rem', fontStyle: 'italic' }}>
                  Note: Create an account · Forgot password? has been hidden on the sign in page.
                </p>
                <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                  Customize the content of emails sent to users. Use variables like {VARIABLE_HINT} in your templates.
                </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>User Management</h3>
            {[
              { type: 'invitation' as const, label: 'Invitation Email', description: 'Sent when inviting a new user' },
              { type: 'sign_in' as const, label: 'Sign-In Email', description: 'Sent when requesting a sign-in link' },
              { type: 'login_as' as const, label: 'Login As Email', description: 'Sent when dev logs in as another user' },
            ].map(({ type, label, description }) => {
              const template = emailTemplates.find(t => t.template_type === type)
              return (
                <div key={type} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{label}</h3>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>{description}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {template && (
                        <button
                          type="button"
                          onClick={() => openTestEmail(template)}
                          disabled={!templateTestTargetUserId}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}
                        >
                          Test
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEditTemplate(template, type)}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}
                      >
                        {template ? 'Edit' : 'Create'}
                      </button>
                    </div>
                  </div>
                  {template && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      <div><strong>Subject:</strong> {template.subject}</div>
                      <div style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap', maxHeight: '3rem', overflow: 'hidden' }}>
                        <strong>Body:</strong> {template.body.substring(0, 100)}{template.body.length > 100 ? '...' : ''}
                      </div>
                      {template.updated_at && (
                        <div style={{ marginTop: '0.25rem', fontSize: '0.8125rem' }}>
                          Last updated: {new Date(template.updated_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            
            <h3 style={{ margin: '1.5rem 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Workflow Stage Notifications</h3>
            <h4 style={{ margin: '0.5rem 0', fontSize: '0.875rem', fontWeight: 500, color: '#6b7280' }}>Notify Assigned Person</h4>
            {[
              { type: 'stage_assigned_started' as const, label: 'Stage Started (Assigned)', description: 'Sent to assigned person when stage is started' },
              { type: 'stage_assigned_complete' as const, label: 'Stage Complete (Assigned)', description: 'Sent to assigned person when stage is completed' },
              { type: 'stage_assigned_reopened' as const, label: 'Stage Re-opened (Assigned)', description: 'Sent to assigned person when stage is re-opened' },
            ].map(({ type, label, description }) => {
              const template = emailTemplates.find(t => t.template_type === type)
              return (
                <div key={type} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{label}</h3>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>{description}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {template && (
                        <button
                          type="button"
                          onClick={() => openTestEmail(template)}
                          disabled={!templateTestTargetUserId}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}
                        >
                          Test
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEditTemplate(template, type)}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}
                      >
                        {template ? 'Edit' : 'Create'}
                      </button>
                    </div>
                  </div>
                  {template && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      <div><strong>Subject:</strong> {template.subject}</div>
                      <div style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap', maxHeight: '3rem', overflow: 'hidden' }}>
                        <strong>Body:</strong> {template.body.substring(0, 100)}{template.body.length > 100 ? '...' : ''}
                      </div>
                      {template.updated_at && (
                        <div style={{ marginTop: '0.25rem', fontSize: '0.8125rem' }}>
                          Last updated: {new Date(template.updated_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            
            <h4 style={{ margin: '1rem 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 500, color: '#6b7280' }}>Notify Me (Current User)</h4>
            {[
              { type: 'stage_me_started' as const, label: 'Stage Started (ME)', description: 'Sent to you when a subscribed stage is started' },
              { type: 'stage_me_complete' as const, label: 'Stage Complete (ME)', description: 'Sent to you when a subscribed stage is completed' },
              { type: 'stage_me_reopened' as const, label: 'Stage Re-opened (ME)', description: 'Sent to you when a subscribed stage is re-opened' },
            ].map(({ type, label, description }) => {
              const template = emailTemplates.find(t => t.template_type === type)
              return (
                <div key={type} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{label}</h3>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>{description}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {template && (
                        <button
                          type="button"
                          onClick={() => openTestEmail(template)}
                          disabled={!templateTestTargetUserId}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}
                        >
                          Test
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEditTemplate(template, type)}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}
                      >
                        {template ? 'Edit' : 'Create'}
                      </button>
                    </div>
                  </div>
                  {template && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      <div><strong>Subject:</strong> {template.subject}</div>
                      <div style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap', maxHeight: '3rem', overflow: 'hidden' }}>
                        <strong>Body:</strong> {template.body.substring(0, 100)}{template.body.length > 100 ? '...' : ''}
                      </div>
                      {template.updated_at && (
                        <div style={{ marginTop: '0.25rem', fontSize: '0.8125rem' }}>
                          Last updated: {new Date(template.updated_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            
            <h4 style={{ margin: '1rem 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 500, color: '#6b7280' }}>Cross-Step Notifications</h4>
            {[
              { type: 'stage_next_complete_or_approved' as const, label: 'Next Stage Ready', description: 'Sent to next stage assignee when current stage is completed or approved' },
              { type: 'stage_prior_rejected' as const, label: 'Prior work incomplete', description: 'Sent to prior stage assignee when their stage is marked incomplete' },
            ].map(({ type, label, description }) => {
              const template = emailTemplates.find(t => t.template_type === type)
              return (
                <div key={type} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{label}</h3>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>{description}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {template && (
                        <button
                          type="button"
                          onClick={() => openTestEmail(template)}
                          disabled={!templateTestTargetUserId}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}
                        >
                          Test
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEditTemplate(template, type)}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}
                      >
                        {template ? 'Edit' : 'Create'}
                      </button>
                    </div>
                  </div>
                  {template && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      <div><strong>Subject:</strong> {template.subject}</div>
                      <div style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap', maxHeight: '3rem', overflow: 'hidden' }}>
                        <strong>Body:</strong> {template.body.substring(0, 100)}{template.body.length > 100 ? '...' : ''}
                      </div>
                      {template.updated_at && (
                        <div style={{ marginTop: '0.25rem', fontSize: '0.8125rem' }}>
                          Last updated: {new Date(template.updated_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
                </div>
              </div>
            )}
          </div>

          {editingTemplate && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 500, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' }}>
                <h2 style={{ marginTop: 0 }}>
                  Edit {editingTemplate.template_type === 'invitation' ? 'Invitation' : 
                    editingTemplate.template_type === 'sign_in' ? 'Sign-In' : 
                    editingTemplate.template_type === 'login_as' ? 'Login As' :
                    editingTemplate.template_type === 'stage_assigned_started' ? 'Stage Started (Assigned)' :
                    editingTemplate.template_type === 'stage_assigned_complete' ? 'Stage Complete (Assigned)' :
                    editingTemplate.template_type === 'stage_assigned_reopened' ? 'Stage Re-opened (Assigned)' :
                    editingTemplate.template_type === 'stage_me_started' ? 'Stage Started (ME)' :
                    editingTemplate.template_type === 'stage_me_complete' ? 'Stage Complete (ME)' :
                    editingTemplate.template_type === 'stage_me_reopened' ? 'Stage Re-opened (ME)' :
                    editingTemplate.template_type === 'stage_next_complete_or_approved' ? 'Next Stage Ready' :
                    editingTemplate.template_type === 'stage_prior_rejected' ? 'Prior work incomplete' :
                    'Email'} Template
                </h2>
                <form onSubmit={saveEmailTemplate}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="template-subject" style={{ display: 'block', marginBottom: 4 }}>Subject *</label>
                    <input
                      id="template-subject"
                      type="text"
                      value={templateSubject}
                      onChange={(e) => { setTemplateSubject(e.target.value); setTemplateError(null) }}
                      required
                      disabled={templateSaving}
                      placeholder="e.g., Welcome to PipeTooling"
                      style={{ width: '100%', padding: '0.5rem' }}
                    />
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
                      Available variables: {
                        editingTemplate.template_type.startsWith('stage_') 
                          ? '{{name}}, {{email}}, {{project_name}}, {{stage_name}}, {{assigned_to_name}}, {{workflow_link}}, {{previous_stage_name}}, {{rejection_reason}}'
                          : VARIABLE_HINT
                      }
                    </p>
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="template-body" style={{ display: 'block', marginBottom: 4 }}>Body *</label>
                    <textarea
                      id="template-body"
                      value={templateBody}
                      onChange={(e) => { setTemplateBody(e.target.value); setTemplateError(null) }}
                      required
                      disabled={templateSaving}
                      rows={12}
                      placeholder="e.g., Hi {{name}},&#10;&#10;You've been invited to join PipeTooling as a {{role}}. Click the link below to set up your account:&#10;&#10;{{link}}"
                      style={{ width: '100%', padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.875rem' }}
                    />
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
                      Available variables: {
                        editingTemplate.template_type.startsWith('stage_') 
                          ? '{{name}}, {{email}}, {{project_name}}, {{stage_name}}, {{assigned_to_name}}, {{workflow_link}}, {{previous_stage_name}}, {{rejection_reason}}'
                          : VARIABLE_HINT
                      }
                    </p>
                  </div>
                  {templateError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{templateError}</p>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" disabled={templateSaving}>
                      {templateSaving ? 'Saving…' : 'Save template'}
                    </button>
                    <button 
                      type="button" 
                      onClick={testCurrentTemplate}
                      disabled={templateSaving || !templateSubject.trim() || !templateBody.trim() || !templateTestTargetUserId}
                      style={{ background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}
                    >
                      Test Email
                    </button>
                    <button type="button" onClick={closeEditTemplate} disabled={templateSaving}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {editingNotificationTemplate && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 500, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' }}>
                <h2 style={{ marginTop: 0 }}>
                  Edit Notification: {editingNotificationTemplate.template_type.replace(/_/g, ' ')}
                </h2>
                <form onSubmit={saveNotificationTemplate}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="notification-template-title" style={{ display: 'block', marginBottom: 4 }}>Push Title *</label>
                    <input
                      id="notification-template-title"
                      type="text"
                      value={notificationTemplateTitle}
                      onChange={(e) => { setNotificationTemplateTitle(e.target.value); setNotificationTemplateError(null) }}
                      required
                      disabled={notificationTemplateSaving}
                      placeholder="e.g., Checklist completed"
                      style={{ width: '100%', padding: '0.5rem' }}
                    />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="notification-template-body" style={{ display: 'block', marginBottom: 4 }}>Push Body *</label>
                    <textarea
                      id="notification-template-body"
                      value={notificationTemplateBody}
                      onChange={(e) => { setNotificationTemplateBody(e.target.value); setNotificationTemplateError(null) }}
                      required
                      disabled={notificationTemplateSaving}
                      rows={6}
                      placeholder="e.g., {{assignee_name}} completed {{item_title}}"
                      style={{ width: '100%', padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.875rem' }}
                    />
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
                      Variables: {NOTIFICATION_VARIABLE_HINT}
                    </p>
                  </div>
                  {notificationTemplateError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{notificationTemplateError}</p>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" disabled={notificationTemplateSaving}>
                      {notificationTemplateSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" onClick={closeEditNotificationTemplate} disabled={notificationTemplateSaving}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {testingTemplate && (() => {
            const testTargetUser = templateTestTargetUserId
              ? users.find((u) => u.id === templateTestTargetUserId)
              : undefined
            const testTargetEmail = testTargetUser?.email?.trim() ?? ''
            const testRecipientLabel =
              testTargetEmail && (testTargetUser?.name || '').trim()
                ? `${(testTargetUser?.name || '').trim()} <${testTargetEmail}>`
                : testTargetEmail || '—'
            return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400 }}>
                <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  Send a test email to <strong>{testRecipientLabel}</strong> (the user selected under <strong>Test target</strong> above). Variables like {'{{name}}'}, {'{{email}}'}, and {'{{role}}'} use that user&apos;s data; other placeholders use sample values.
                </p>
                <form onSubmit={sendTestEmail}>
                  <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f9fafb', borderRadius: 4, fontSize: '0.875rem' }}>
                    <div><strong>Template:</strong> {testingTemplate.template_type}</div>
                    <div style={{ marginTop: '0.5rem' }}><strong>Subject:</strong> {testingTemplate.subject}</div>
                    <div style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}><strong>Body Preview:</strong><br />{testingTemplate.body.substring(0, 200)}{testingTemplate.body.length > 200 ? '...' : ''}</div>
                  </div>
                  {testError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{testError}</p>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" disabled={testSending || !templateTestTargetUserId || !testTargetEmail}>
                      {testSending ? 'Sending…' : 'Send Test Email'}
                    </button>
                    <button type="button" onClick={closeTestEmail} disabled={testSending}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
            )
          })()}

          {/* Dashboard: Report Review - collapsible, dev-only */}
          <div style={{ marginTop: '2rem', marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <button
              type="button"
              onClick={() => setReportSettingsSectionOpen((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                margin: 0,
                padding: '1rem',
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 600,
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '0.75rem' }}>{reportSettingsSectionOpen ? '▼' : '▶'}</span>
              Dashboard: Report Review
            </button>
            {reportSettingsSectionOpen && (
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
                <form onSubmit={saveReportSettings}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Report edit window (days)</label>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8125rem', color: '#6b7280' }}>Days subcontractors and Helper users can edit their own reports after creation.</p>
                    <input type="number" min={0} step={1} value={reportEditWindowDays} onChange={(e) => setReportEditWindowDays(e.target.value)} style={{ width: '6rem', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Field report visibility (months)</label>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8125rem', color: '#6b7280' }}>Months subcontractors and Helper users can see their own reports.</p>
                    <input type="number" min={0} step={1} value={reportSubVisibilityMonths} onChange={(e) => setReportSubVisibilityMonths(e.target.value)} style={{ width: '6rem', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 600 }}>Report-enabled users</h3>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8125rem', color: '#6b7280' }}>Subcontractors, Helper users, and primaries selected here can see the Recent Reports section on their Dashboard. Unselected users do not see Recent Reports. All users can create reports via the Job Report button.</p>
                    <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 4, padding: '0.5rem' }}>
                      {users.filter((u) => u.role === 'subcontractor' || u.role === 'helpers' || u.role === 'primary').map((u) => (
                        <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', cursor: 'pointer' }}>
                          <input type="checkbox" checked={reportEnabledUserIds.has(u.id)} onChange={() => toggleReportEnabledUser(u.id)} />
                          <span>{u.name || u.email}</span>
                          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>({u.role})</span>
                        </label>
                      ))}
                      {users.filter((u) => u.role === 'subcontractor' || u.role === 'helpers' || u.role === 'primary').length === 0 && (
                        <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>No subcontractors, Helper users, or primaries.</p>
                      )}
                    </div>
                  </div>
                  <button type="submit" disabled={reportSettingsSaving} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: reportSettingsSaving ? 'not-allowed' : 'pointer' }}>
                    {reportSettingsSaving ? 'Saving…' : 'Save report settings'}
                  </button>
                </form>
              </div>
            )}
          </div>
    </>
  )
}
