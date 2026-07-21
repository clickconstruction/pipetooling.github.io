import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useToastContext } from '../contexts/ToastContext'
import { withSupabaseRetry } from '../utils/errorHandling'
import {
  APP_SETTINGS_KEY_FIELD_DISPATCH_PHONE,
  APP_SETTINGS_KEY_JOB_TALLY_MIN_POSTED_YMD,
} from '../lib/appSettingsKeys'
import {
  EMAIL_TEMPLATE_DEFAULTS,
  replaceTemplateVariables,
  substituteNotificationVariables,
  WORKFLOW_FN_TEST_PLACEHOLDER_STEP_ID,
  type EmailTemplate,
  type NotificationTemplate,
  type WorkflowFnEmailTemplateType,
} from '../lib/settingsTemplates'

type TemplatesEngineUserRow = { id: string; name: string; email: string; role: string }

/**
 * State + handlers for the Settings → Templates & testing tab (dev only):
 * email/notification template CRUD, the three edge-function test senders
 * (test-email, send-checklist-notification, send-workflow-notification),
 * report review settings (edit window / sub visibility / report_enabled_users
 * diff-sync), and the Job Parts Tally min-date + field-dispatch phone loads.
 * Extracted verbatim from Settings.tsx (v2.854); `enabled` = myRole === 'dev'.
 * `onSharedError` preserves the legacy mostly-invisible shared error write
 * from saveReportSettings (map quirk #4).
 */
export function useSettingsTemplatesEngine({
  enabled,
  authUserId,
  users,
  onSharedError,
}: {
  enabled: boolean
  authUserId: string | null
  users: TemplatesEngineUserRow[]
  onSharedError: (message: string) => void
}) {
  const { showToast } = useToastContext()

  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([])
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [templateSubject, setTemplateSubject] = useState('')
  const [templateBody, setTemplateBody] = useState('')
  const [templateSaving, setTemplateSaving] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [testingTemplate, setTestingTemplate] = useState<EmailTemplate | null>(null)
  const [testSending, setTestSending] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)
  const [emailTemplatesSectionOpen, setEmailTemplatesSectionOpen] = useState(false)
  const [reportSettingsSectionOpen, setReportSettingsSectionOpen] = useState(false)
  const [reportEditWindowDays, setReportEditWindowDays] = useState<string>('2')
  const [reportSubVisibilityMonths, setReportSubVisibilityMonths] = useState<string>('3')
  const [reportEnabledUserIds, setReportEnabledUserIds] = useState<Set<string>>(new Set())
  const [reportSettingsSaving, setReportSettingsSaving] = useState(false)
  const [notificationTemplates, setNotificationTemplates] = useState<NotificationTemplate[]>([])
  const [notificationTemplatesSectionOpen, setNotificationTemplatesSectionOpen] = useState(false)
  const [workflowFnEmailSectionOpen, setWorkflowFnEmailSectionOpen] = useState(false)
  const [templatesJobPartsTallySectionOpen, setTemplatesJobPartsTallySectionOpen] = useState(false)
  const [editingNotificationTemplate, setEditingNotificationTemplate] = useState<NotificationTemplate | null>(null)
  const [notificationTemplateTitle, setNotificationTemplateTitle] = useState('')
  const [notificationTemplateBody, setNotificationTemplateBody] = useState('')
  const [notificationTemplateSaving, setNotificationTemplateSaving] = useState(false)
  const [notificationTemplateError, setNotificationTemplateError] = useState<string | null>(null)
  const [templateTestTargetUserId, setTemplateTestTargetUserId] = useState('')
  const [notificationTestSending, setNotificationTestSending] = useState<string | null>(null)
  const [notificationTestError, setNotificationTestError] = useState<string | null>(null)
  const [notificationTestSuccess, setNotificationTestSuccess] = useState<string | null>(null)
  const [workflowFnTestTemplateType, setWorkflowFnTestTemplateType] =
    useState<WorkflowFnEmailTemplateType>('stage_assigned_started')
  const [workflowFnTestSending, setWorkflowFnTestSending] = useState(false)
  const [workflowFnTestError, setWorkflowFnTestError] = useState<string | null>(null)
  const [workflowFnTestSuccess, setWorkflowFnTestSuccess] = useState<string | null>(null)
  const [jobTallyMinPostedYmdInput, setJobTallyMinPostedYmdInput] = useState('')
  const [jobTallyMinPostedYmdSaving, setJobTallyMinPostedYmdSaving] = useState(false)
  const [jobTallyMinPostedYmdError, setJobTallyMinPostedYmdError] = useState<string | null>(null)
  const [fieldDispatchPhoneInput, setFieldDispatchPhoneInput] = useState('')
  const [fieldDispatchPhoneSaving, setFieldDispatchPhoneSaving] = useState(false)

  async function loadNotificationTemplates() {
    const { data, error: e } = await supabase
      .from('notification_templates')
      .select('id, template_type, push_title, push_body, updated_at')
      .order('template_type')
    if (e) {
      console.error('Error loading notification templates:', e)
    } else {
      setNotificationTemplates((data as NotificationTemplate[]) ?? [])
    }
  }

  async function loadEmailTemplates() {
    const { data, error: eTemplates } = await supabase
      .from('email_templates')
      .select('id, template_type, subject, body, updated_at')
      .order('template_type')

    if (eTemplates) {
      console.error('Error loading email templates:', eTemplates)
      // Don't set error here - templates might not exist yet
    } else {
      setEmailTemplates((data as EmailTemplate[]) ?? [])
    }
  }

  function openEditNotificationTemplate(template: NotificationTemplate | null) {
    if (template) {
      setEditingNotificationTemplate(template)
      setNotificationTemplateTitle(template.push_title)
      setNotificationTemplateBody(template.push_body)
    } else {
      setEditingNotificationTemplate(null)
    }
    setNotificationTemplateError(null)
  }

  function closeEditNotificationTemplate() {
    setEditingNotificationTemplate(null)
    setNotificationTemplateTitle('')
    setNotificationTemplateBody('')
    setNotificationTemplateError(null)
  }

  async function saveNotificationTemplate(e: FormEvent) {
    e.preventDefault()
    if (!editingNotificationTemplate) return
    if (!notificationTemplateTitle.trim() || !notificationTemplateBody.trim()) {
      setNotificationTemplateError('Title and body are required')
      return
    }
    setNotificationTemplateSaving(true)
    setNotificationTemplateError(null)
    const { error: err } = await supabase
      .from('notification_templates')
      .update({
        push_title: notificationTemplateTitle.trim(),
        push_body: notificationTemplateBody.trim(),
      })
      .eq('id', editingNotificationTemplate.id)
    setNotificationTemplateSaving(false)
    if (err) setNotificationTemplateError(err.message)
    else {
      await loadNotificationTemplates()
      closeEditNotificationTemplate()
    }
  }

  async function sendTestNotificationTemplate(template: NotificationTemplate) {
    if (!templateTestTargetUserId) {
      setNotificationTestError('Select a test target first')
      return
    }
    const targetUser = users.find((u) => u.id === templateTestTargetUserId)
    if (!targetUser) {
      setNotificationTestError('Target user not found')
      return
    }
    setNotificationTestSending(template.template_type)
    setNotificationTestError(null)
    setNotificationTestSuccess(null)
    try {
      const {
        data: { session: refreshedSession },
        error: refreshErr,
      } = await supabase.auth.refreshSession()
      if (refreshErr || !refreshedSession?.access_token) {
        setNotificationTestError('Session expired. Please sign out and sign back in.')
        return
      }
      const { title, body } = substituteNotificationVariables(template, targetUser)
      const pushUrl =
        template.template_type === 'checklist_completed'
          ? '/checklist'
          : template.template_type === 'test_notification'
            ? '/settings'
            : '/workflow'
      const { data, error } = await supabase.functions.invoke('send-checklist-notification', {
        headers: {
          Authorization: `Bearer ${refreshedSession.access_token}`,
        },
        body: {
          recipient_user_id: templateTestTargetUserId,
          push_title: title,
          push_body: body,
          push_url: pushUrl,
          tag: template.template_type,
        },
      })
      if (error) throw error
      const res = data as { error?: string; push_sent?: number } | null
      if (res?.error) throw new Error(res.error)
      const sent = res?.push_sent ?? 0
      setNotificationTestSuccess(
        sent > 0
          ? `Sent to ${sent} device(s).`
          : 'Sent. (Target may have no push subscriptions, or on iOS with app open the system notification may not appear.)'
      )
    } catch (err) {
      let msg = err instanceof Error ? err.message : 'Failed to send test notification'
      if (err instanceof FunctionsHttpError && err.context?.json) {
        try {
          const body = (await err.context.json()) as { error?: string } | null
          if (body?.error) msg = body.error
        } catch { /* ignore */ }
      }
      setNotificationTestError(msg)
    } finally {
      setNotificationTestSending(null)
    }
  }

  function openEditTemplate(template: EmailTemplate | undefined, templateType: EmailTemplate['template_type']) {
    if (template) {
      setEditingTemplate(template)
      setTemplateSubject(template.subject)
      setTemplateBody(template.body)
    } else {
      // Create new template with defaults
      const defaultTemplate = EMAIL_TEMPLATE_DEFAULTS[templateType]
      setEditingTemplate({
        id: '', // Will be created
        template_type: templateType,
        subject: defaultTemplate.subject,
        body: defaultTemplate.body,
        updated_at: null,
      })
      setTemplateSubject(defaultTemplate.subject)
      setTemplateBody(defaultTemplate.body)
    }
    setTemplateError(null)
  }

  async function sendTestEmail(e: FormEvent) {
    e.preventDefault()
    if (!testingTemplate) return

    if (!templateTestTargetUserId) {
      setTestError('Select a test target first')
      return
    }
    const targetUser = users.find((u) => u.id === templateTestTargetUserId)
    if (!targetUser) {
      setTestError('Target user not found')
      return
    }
    const to = targetUser.email.trim()
    if (!to) {
      setTestError('Selected user has no email')
      return
    }

    setTestSending(true)
    setTestError(null)

    const {
      data: { session: refreshedSession },
      error: refreshErr,
    } = await supabase.auth.refreshSession()
    if (refreshErr || !refreshedSession?.access_token) {
      setTestError('Session expired. Please sign out and sign back in.')
      setTestSending(false)
      return
    }

    const testVariables: Record<string, string> = {
      name: (targetUser.name || '').trim() || to,
      email: targetUser.email,
      role: targetUser.role,
      link: 'https://example.com/test-link',
      project_name: 'Test Project',
      stage_name: 'Test Stage',
      assigned_to_name: 'John Doe',
      workflow_link: 'https://example.com/workflow',
      previous_stage_name: 'Previous Stage',
      rejection_reason: 'Test rejection reason',
    }

    const { subject, body } = replaceTemplateVariables(testingTemplate, testVariables)

    const { data, error: eFn } = await supabase.functions.invoke('test-email', {
      headers: {
        Authorization: `Bearer ${refreshedSession.access_token}`,
      },
      body: {
        to,
        subject,
        body,
        template_type: testingTemplate.template_type,
      },
    })

    setTestSending(false)

    if (eFn) {
      let msg = eFn.message
      let statusCode = ''
      if (eFn instanceof FunctionsHttpError) {
        statusCode = ` (Status: ${eFn.context?.status || 'unknown'})`
        if (eFn.context?.json) {
          try {
            const b = (await eFn.context.json()) as { error?: string; message?: string } | null
            if (b?.error) msg = b.error
            else if (b?.message) msg = b.message
          } catch { /* ignore */ }
        }
        // Try to get response text as well
        if (eFn.context?.response) {
          try {
            const text = await eFn.context.response.text()
            if (text) msg += ` - ${text}`
          } catch { /* ignore */ }
        }
      }
      setTestError(`Error: ${msg}${statusCode}`)
      return
    }

    const err = (data as { error?: string } | null)?.error
    if (err) {
      setTestError(err)
    } else {
      const recipientLabel = (targetUser.name || '').trim()
        ? `${targetUser.name} <${to}>`
        : to
      alert(`Test email sent to ${recipientLabel}!\n\nSubject: ${subject}\n\nBody:\n${body}`)
      setTestingTemplate(null)
    }
  }

  async function sendWorkflowNotificationEmailTest() {
    if (!templateTestTargetUserId) {
      setWorkflowFnTestError('Select a test target first')
      return
    }
    const targetUser = users.find((u) => u.id === templateTestTargetUserId)
    if (!targetUser) {
      setWorkflowFnTestError('Target user not found')
      return
    }
    const to = targetUser.email.trim()
    if (!to) {
      setWorkflowFnTestError('Selected user has no email')
      return
    }
    const hasTemplate = emailTemplates.some((t) => t.template_type === workflowFnTestTemplateType)
    if (!hasTemplate) {
      setWorkflowFnTestError('Create this email template in the list below before testing the Edge Function')
      return
    }

    setWorkflowFnTestSending(true)
    setWorkflowFnTestError(null)
    setWorkflowFnTestSuccess(null)

    const {
      data: { session: refreshedSession },
      error: refreshErr,
    } = await supabase.auth.refreshSession()
    if (refreshErr || !refreshedSession?.access_token) {
      setWorkflowFnTestError('Session expired. Please sign out and sign back in.')
      setWorkflowFnTestSending(false)
      return
    }

    const recipientName = (targetUser.name || '').trim() || to
    const workflowLink = `${window.location.origin}/settings`
    const variables: Record<string, string> = {
      name: recipientName,
      email: targetUser.email,
      project_name: 'Test Project',
      stage_name: 'Test Stage',
      assigned_to_name: 'Jane Doe',
      workflow_link: workflowLink,
    }
    if (workflowFnTestTemplateType === 'stage_next_complete_or_approved') {
      variables.previous_stage_name = 'Previous Stage (test)'
    }
    if (workflowFnTestTemplateType === 'stage_prior_rejected') {
      variables.previous_stage_name = 'Previous Stage (test)'
      variables.rejection_reason = 'Test rejection'
    }

    const { data, error: eFn } = await supabase.functions.invoke('send-workflow-notification', {
      headers: {
        Authorization: `Bearer ${refreshedSession.access_token}`,
      },
      body: {
        template_type: workflowFnTestTemplateType,
        step_id: WORKFLOW_FN_TEST_PLACEHOLDER_STEP_ID,
        recipient_email: to,
        recipient_name: recipientName,
        variables,
      },
    })

    setWorkflowFnTestSending(false)

    if (eFn) {
      let msg = eFn.message
      let statusCode = ''
      if (eFn instanceof FunctionsHttpError) {
        statusCode = ` (Status: ${eFn.context?.status || 'unknown'})`
        if (eFn.context?.json) {
          try {
            const b = (await eFn.context.json()) as { error?: string; message?: string } | null
            if (b?.error) msg = b.error
            else if (b?.message) msg = b.message
          } catch {
            /* ignore */
          }
        }
        if (eFn.context?.response) {
          try {
            const text = await eFn.context.response.text()
            if (text) msg += ` - ${text}`
          } catch {
            /* ignore */
          }
        }
      }
      setWorkflowFnTestError(`Error: ${msg}${statusCode}`)
      return
    }

    const res = data as { error?: string; email_id?: string; push_sent?: number } | null
    if (res?.error) {
      setWorkflowFnTestError(res.error)
      return
    }
    const pushPart =
      typeof res?.push_sent === 'number' && res.push_sent > 0 ? ` Push sent: ${res.push_sent}.` : ''
    setWorkflowFnTestSuccess(
      `Sent via send-workflow-notification to ${to}. Resend id: ${res?.email_id ?? '—'}.${pushPart}`
    )
  }

  function openTestEmail(template: EmailTemplate | { template_type: EmailTemplate['template_type']; subject: string; body: string }) {
    setTestingTemplate(template as EmailTemplate)
    setTestError(null)
  }

  function testCurrentTemplate() {
    if (!editingTemplate || !templateSubject.trim() || !templateBody.trim()) {
      setTemplateError('Please fill in both subject and body before testing')
      return
    }
    if (!templateTestTargetUserId) {
      setTemplateError('Select a test target under Templates & testing before testing')
      return
    }
    // Create a temporary template object from current form values
    const tempTemplate: EmailTemplate = {
      id: editingTemplate.id || '',
      template_type: editingTemplate.template_type,
      subject: templateSubject.trim(),
      body: templateBody.trim(),
      updated_at: null,
    }
    openTestEmail(tempTemplate)
  }

  function closeTestEmail() {
    setTestingTemplate(null)
    setTestError(null)
  }

  function closeEditTemplate() {
    setEditingTemplate(null)
    setTemplateSubject('')
    setTemplateBody('')
    setTemplateError(null)
  }

  async function saveEmailTemplate(e: FormEvent) {
    e.preventDefault()
    if (!editingTemplate) return

    setTemplateSaving(true)
    setTemplateError(null)

    if (editingTemplate.id) {
      // Update existing template
      const { error: e } = await supabase
        .from('email_templates')
        .update({
          subject: templateSubject.trim(),
          body: templateBody.trim(),
        })
        .eq('id', editingTemplate.id)

      setTemplateSaving(false)

      if (e) {
        setTemplateError(e.message)
      } else {
        await loadEmailTemplates()
        closeEditTemplate()
      }
    } else {
      // Create new template
      const { error: e } = await supabase
        .from('email_templates')
        .insert({
          template_type: editingTemplate.template_type,
          subject: templateSubject.trim(),
          body: templateBody.trim(),
          updated_at: new Date().toISOString(),
        })

      setTemplateSaving(false)

      if (e) {
        setTemplateError(e.message)
      } else {
        await loadEmailTemplates()
        closeEditTemplate()
      }
    }
  }

  async function saveReportSettings(e: FormEvent) {
    e.preventDefault()
    if (!enabled) return
    setReportSettingsSaving(true)
    const editDays = Math.max(0, Math.floor(parseFloat(reportEditWindowDays) || 0))
    const visMonths = Math.max(0, Math.floor(parseFloat(reportSubVisibilityMonths) || 0))
    const { error: appErr } = await supabase.from('app_settings').upsert(
      [
        { key: 'report_edit_window_days', value_num: editDays },
        { key: 'report_sub_visibility_months', value_num: visMonths },
      ],
      { onConflict: 'key' }
    )
    if (appErr) {
      onSharedError(appErr.message)
      setReportSettingsSaving(false)
      return
    }
    const currentIds = reportEnabledUserIds
    const { data: existing } = await supabase.from('report_enabled_users').select('user_id')
    const existingIds = new Set((existing ?? []).map((r: { user_id: string }) => r.user_id))
    for (const uid of currentIds) {
      if (!existingIds.has(uid)) {
        await supabase.from('report_enabled_users').insert({ user_id: uid })
      }
    }
    for (const uid of existingIds) {
      if (!currentIds.has(uid)) {
        await supabase.from('report_enabled_users').delete().eq('user_id', uid)
      }
    }
    setReportSettingsSaving(false)
    showToast('Report settings saved.', 'success')
  }

  function toggleReportEnabledUser(userId: string) {
    setReportEnabledUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  // Initial loads (were part of Settings.tsx loadData's dev branch)
  useEffect(() => {
    if (!enabled) return
    void loadNotificationTemplates()
    void loadEmailTemplates()
    void (async () => {
      const { data: settingsRows } = await supabase
        .from('app_settings')
        .select('key, value_num')
        .in('key', ['report_edit_window_days', 'report_sub_visibility_months'])
      const byKey = new Map((settingsRows ?? []).map((r) => [r.key, r] as [string, { value_num: number | null }]))
      setReportEditWindowDays(String(byKey.get('report_edit_window_days')?.value_num ?? 2))
      setReportSubVisibilityMonths(String(byKey.get('report_sub_visibility_months')?.value_num ?? 3))
      const { data: enabledRows } = await supabase.from('report_enabled_users').select('user_id')
      setReportEnabledUserIds(new Set((enabledRows ?? []).map((r: { user_id: string }) => r.user_id)))
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  // Default template test target (notifications + email): current user if in list, else first user
  useEffect(() => {
    if (!enabled || users.length === 0) return
    setTemplateTestTargetUserId((prev) => {
      if (prev) return prev
      const meInList = authUserId && users.some((u) => u.id === authUserId)
      return meInList ? authUserId! : users[0]!.id
    })
  }, [enabled, users, authUserId])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase
              .from('app_settings')
              .select('value_text')
              .eq('key', APP_SETTINGS_KEY_JOB_TALLY_MIN_POSTED_YMD)
              .maybeSingle(),
          'load job tally min posted app setting',
        )
        if (cancelled) return
        const vt = (data as { value_text: string | null } | null)?.value_text
        setJobTallyMinPostedYmdInput(vt?.trim() ?? '')
      } catch {
        if (!cancelled) setJobTallyMinPostedYmdInput('')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase
              .from('app_settings')
              .select('value_text')
              .eq('key', APP_SETTINGS_KEY_FIELD_DISPATCH_PHONE)
              .maybeSingle(),
          'load field dispatch phone app setting',
        )
        if (cancelled) return
        const vt = (data as { value_text: string | null } | null)?.value_text
        setFieldDispatchPhoneInput(vt?.trim() ?? '')
      } catch {
        if (!cancelled) setFieldDispatchPhoneInput('')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])

  return {
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
  }
}
