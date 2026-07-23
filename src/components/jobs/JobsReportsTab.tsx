import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { looksLikeRawJobIdName } from '../../lib/jobs/jobFormatting'
import { Folder, Images, Pencil, PanelRightOpen } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { displayReportTemplateName } from '../../lib/reportTemplateDisplayName'
import { formatReportFieldValueInlineList } from '../../lib/reportSignatureField'
import NewReportModal from '../NewReportModal'
import RecurringEmailReportsModal from './RecurringEmailReportsModal'
import type { UserRole } from '../../hooks/useAuth'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { OpenEditJobOptions } from '../../contexts/JobFormModalContext'
import type { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import type { useToastContext } from '../../contexts/ToastContext'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'

const JOBS_REPORTS_TAB_TOAST_NO_CUSTOMER_FILES =
  "Customer Files isn't linked for this job yet. Contact Dispatch to have it added."

const JOBS_REPORTS_TAB_TOAST_NO_CUSTOMER_PICTURES =
  "Customer Pictures isn't linked for this job yet. Contact Dispatch to have it added."

/** Row shape from `list_reports_with_job_info` (Reports tab); link columns added in 20270517120000 migration. */
type ReportWithJob = {
  id: string
  template_id: string
  template_name: string
  created_by_user_id: string
  created_by_name: string
  created_at: string
  updated_at: string
  field_values: Record<string, string>
  job_ledger_id: string | null
  project_id: string | null
  job_display_name: string
  job_hcp_number: string
  job_google_drive_link?: string | null
  job_job_pictures_link?: string | null
  job_address?: string | null
}

export type JobsReportsTabProps = {
  /** Current auth user id; null when unauthenticated. Gates loads + seeds modals. */
  authUserId: string | null
  /** Current auth user email; used to label the master-technician scope choice. */
  authUserEmail: string | null
  authRole: UserRole | null
  authProfileName: string | null
  /** Synced role string; controls template management + delete-button visibility. */
  myRole: string | null
  /** Parent-owned jobs list cache; read to seed the edit-job modal. */
  jobs: JobWithDetails[]
  /** Reload the parent jobs cache after an edit. */
  loadJobs: () => void
  /** Open the shared edit-job modal. */
  tryOpenEditJob: (jobId: string, options?: OpenEditJobOptions) => void
  /** Shared job-detail preview panel. */
  jobDetailModal: ReturnType<typeof useJobDetailModal>
  /** Toast helper from the parent toast context. */
  showToast: ReturnType<typeof useToastContext>['showToast']
  /** Shared error banner state owned by the parent. */
  error: string | null
  onError: (msg: string | null) => void
}

export default function JobsReportsTab({
  authUserId,
  authUserEmail,
  authRole,
  authProfileName,
  myRole,
  jobs,
  loadJobs,
  tryOpenEditJob,
  jobDetailModal,
  showToast,
  error,
  onError,
}: JobsReportsTabProps) {
  const [reportsList, setReportsList] = useState<ReportWithJob[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportsSearch, setReportsSearch] = useState('')
  const [reportsViewMode, setReportsViewMode] = useState<'job' | 'person'>('job')
  const [reportsExpandedJobs, setReportsExpandedJobs] = useState<Set<string>>(new Set())
  const [reportsExpandedPersons, setReportsExpandedPersons] = useState<Set<string>>(new Set())
  const [newReportModalOpen, setNewReportModalOpen] = useState(false)
  const [recurringEmailReportsModalOpen, setRecurringEmailReportsModalOpen] = useState(false)
  const [reportsDeletingId, setReportsDeletingId] = useState<string | null>(null)
  const [reportTemplatesModalOpen, setReportTemplatesModalOpen] = useState(false)
  const [reportTemplatesList, setReportTemplatesList] = useState<
    Array<{ id: string; name: string; sequence_order: number; app_managed: boolean }>
  >([])
  const [reportTemplatesLoading, setReportTemplatesLoading] = useState(false)
  const [templateFormOpen, setTemplateFormOpen] = useState(false)
  const [editingReportTemplateId, setEditingReportTemplateId] = useState<string | null>(null)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateFields, setNewTemplateFields] = useState<string[]>([''])
  const [templateSaving, setTemplateSaving] = useState(false)
  const [templateDeletingId, setTemplateDeletingId] = useState<string | null>(null)
  const [scopeMastersForRecurringReports, setScopeMastersForRecurringReports] = useState<
    readonly { id: string; label: string }[]
  >([])

  const canManageTemplates = myRole === 'dev' || myRole === 'master_technician' || isAssistantLike(myRole)

  async function loadReports() {
    if (!authUserId) return
    setReportsLoading(true)
    onError(null)
    const { data, error: err } = await supabase.rpc('list_reports_with_job_info')
    if (err) {
      onError(`Failed to load reports: ${err.message}`)
    } else {
      setReportsList((Array.isArray(data) ? data : []) as ReportWithJob[])
    }
    setReportsLoading(false)
  }

  async function loadReportTemplates() {
    setReportTemplatesLoading(true)
    const { data, error: err } = await supabase.from('report_templates').select('id, name, sequence_order, app_managed').order('sequence_order')
    if (err) {
      onError(`Failed to load templates: ${err.message}`)
    } else {
      setReportTemplatesList(
        ((data ?? []) as Array<{ id: string; name: string; sequence_order: number; app_managed: boolean | null }>).map(
          (row) => ({ ...row, app_managed: !!row.app_managed }),
        ),
      )
    }
    setReportTemplatesLoading(false)
  }

  async function deleteReport(id: string) {
    if (!confirm('Delete this report?')) return
    setReportsDeletingId(id)
    const { error: err } = await supabase.from('reports').delete().eq('id', id)
    if (err) onError(`Failed to delete report: ${err.message}`)
    else await loadReports()
    setReportsDeletingId(null)
  }

  useEffect(() => {
    if (!authUserId) {
      setScopeMastersForRecurringReports([])
      return
    }
    if (!(authRole === 'dev' || authRole === 'master_technician' || isAssistantLike(authRole))) {
      setScopeMastersForRecurringReports([])
      return
    }
    let cancelled = false

    if (authRole === 'master_technician') {
      const label = ((authProfileName ?? authUserEmail ?? authUserId) as string).trim()
      setScopeMastersForRecurringReports([{ id: authUserId, label }])
      return
    }

    async function load() {
      if (isAssistantLike(authRole)) {
        const { data: maps, error } = await supabase
          .from('master_assistants')
          .select('master_id')
          .eq('assistant_id', authUserId!)
        if (cancelled) return
        if (error || !maps?.length) {
          setScopeMastersForRecurringReports([])
          return
        }
        const mids = [...new Set(maps.map((r) => r.master_id))]
        const { data: masters } = await supabase.from('users').select('id,name').in('id', mids)
        if (cancelled) return
        setScopeMastersForRecurringReports(
          ((masters ?? []) as Array<{ id: string; name: string }>).map((u) => ({
            id: u.id,
            label: (u.name ?? '').trim() || u.id,
          })),
        )
        return
      }

      if (authRole === 'dev') {
        const { data: masters } = await supabase
          .from('users')
          .select('id,name')
          .eq('role', 'master_technician')
          .is('archived_at', null)
          .order('name', { ascending: true })
          .limit(200)
        if (cancelled) return
        setScopeMastersForRecurringReports(
          ((masters ?? []) as Array<{ id: string; name: string }>).map((u) => ({
            id: u.id,
            label: (u.name ?? '').trim() || u.id,
          })),
        )
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [authUserId, authUserEmail, authRole, authProfileName])

  // Deferred load when the tab mounts (parent renders it only while active).
  useEffect(() => {
    if (!authUserId) return
    const t = setTimeout(() => {
      loadReports()
      loadReportTemplates()
    }, 80)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId])

  function openReportTemplatesModal() {
    setReportTemplatesModalOpen(true)
    setTemplateFormOpen(false)
    setEditingReportTemplateId(null)
    loadReportTemplates()
  }

  function openAddTemplate() {
    setEditingReportTemplateId(null)
    setNewTemplateName('')
    setNewTemplateFields([''])
    setTemplateFormOpen(true)
  }

  async function openEditReportTemplate(template: { id: string; name: string; sequence_order: number; app_managed: boolean }) {
    if (template.app_managed) {
      onError('Built-in templates cannot be edited.')
      return
    }
    setEditingReportTemplateId(template.id)
    setNewTemplateName(template.name)
    const { data: fields } = await supabase
      .from('report_template_fields')
      .select('label')
      .eq('template_id', template.id)
      .order('sequence_order')
    const labels = (fields as Array<{ label: string }> | null)?.map((f) => f.label) ?? []
    setNewTemplateFields(labels.length > 0 ? labels : [''])
    setTemplateFormOpen(true)
  }

  function closeTemplateForm() {
    setTemplateFormOpen(false)
    setEditingReportTemplateId(null)
  }

  async function saveTemplate(e: FormEvent) {
    e.preventDefault()
    if (!newTemplateName.trim()) return
    const editingMeta = editingReportTemplateId ? reportTemplatesList.find((x) => x.id === editingReportTemplateId) : undefined
    if (editingMeta?.app_managed) {
      onError('Built-in templates cannot be edited.')
      return
    }
    setTemplateSaving(true)
    onError(null)
    const fields = newTemplateFields.map((l) => l.trim()).filter(Boolean)

    if (editingReportTemplateId) {
      const { error: tErr } = await supabase
        .from('report_templates')
        .update({ name: newTemplateName.trim() })
        .eq('id', editingReportTemplateId)
      if (tErr) {
        onError(tErr.message)
        setTemplateSaving(false)
        return
      }
      const { error: delErr } = await supabase.from('report_template_fields').delete().eq('template_id', editingReportTemplateId)
      if (delErr) {
        onError(delErr.message)
        setTemplateSaving(false)
        return
      }
      if (fields.length > 0) {
        const { error: fErr } = await supabase.from('report_template_fields').insert(
          fields.map((label, i) => ({ template_id: editingReportTemplateId, label, sequence_order: i }))
        )
        if (fErr) {
          onError(fErr.message)
          setTemplateSaving(false)
          return
        }
      }
    } else {
      const { data: t, error: tErr } = await supabase
        .from('report_templates')
        .insert({ name: newTemplateName.trim(), sequence_order: 999 })
        .select('id')
        .single()
      if (tErr) {
        onError(tErr.message)
        setTemplateSaving(false)
        return
      }
      const templateId = (t as { id: string }).id
      if (fields.length > 0) {
        const { error: fErr } = await supabase.from('report_template_fields').insert(
          fields.map((label, i) => ({ template_id: templateId, label, sequence_order: i }))
        )
        if (fErr) {
          onError(fErr.message)
          setTemplateSaving(false)
          return
        }
      }
    }

    closeTemplateForm()
    setTemplateSaving(false)
    loadReportTemplates()
    loadReports()
  }

  async function deleteReportTemplate(id: string) {
    const tmpl = reportTemplatesList.find((t) => t.id === id)
    if (tmpl?.app_managed) {
      onError('Built-in templates cannot be deleted.')
      return
    }
    const { count } = await supabase.from('reports').select('*', { count: 'exact', head: true }).eq('template_id', id)
    if ((count ?? 0) > 0) {
      onError('Cannot delete: this template has reports.')
      return
    }
    if (!confirm('Delete this template?')) return
    setTemplateDeletingId(id)
    const { error: err } = await supabase.from('report_templates').delete().eq('id', id)
    setTemplateDeletingId(null)
    if (err) onError(err.message)
    else {
      closeTemplateForm()
      loadReportTemplates()
    }
  }

  return (
    <>
      <div>
        {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setNewReportModalOpen(true)}
            style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            New report
          </button>
          {canManageTemplates ? (
            <button
              type="button"
              onClick={() => setRecurringEmailReportsModalOpen(true)}
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--bg-muted)',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                cursor: 'pointer',
                color: 'var(--text-strong)',
              }}
            >
              Recurring Email Reports
            </button>
          ) : null}
          {canManageTemplates && (
            <button
              type="button"
              onClick={openReportTemplatesModal}
              title="Manage templates"
              aria-label="Manage report templates"
              style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', color: 'var(--text-700)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
            >
              Templates
            </button>
          )}
          <input
            type="text"
            placeholder={reportsViewMode === 'person' ? 'Search by job, HCP, or person' : 'Search by job name, HCP, or address'}
            value={reportsSearch}
            onChange={(e) => setReportsSearch(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, minWidth: 200 }}
          />
          <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border-strong)', borderRadius: 4, overflow: 'hidden', marginLeft: 'auto' }}>
            <button
              type="button"
              onClick={() => setReportsViewMode('job')}
              style={{ padding: '0.5rem 0.75rem', background: reportsViewMode === 'job' ? '#3b82f6' : 'var(--bg-subtle)', color: reportsViewMode === 'job' ? 'white' : 'var(--text-700)', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              By Job
            </button>
            <button
              type="button"
              onClick={() => setReportsViewMode('person')}
              style={{ padding: '0.5rem 0.75rem', background: reportsViewMode === 'person' ? '#3b82f6' : 'var(--bg-subtle)', color: reportsViewMode === 'person' ? 'white' : 'var(--text-700)', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              By Person
            </button>
          </div>
        </div>
        {reportTemplatesModalOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, maxWidth: 400, width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
              {templateFormOpen ? (
                <>
                  <h3 style={{ margin: '0 0 1rem 0' }}>{editingReportTemplateId ? 'Edit template' : 'Add template'}</h3>
                  <form onSubmit={saveTemplate}>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Template name *</label>
                      <input type="text" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} required placeholder="e.g. Walk Report" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Field labels</label>
                      {newTemplateFields.map((val, i) => (
                        <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <input type="text" value={val} onChange={(e) => setNewTemplateFields((prev) => { const n = [...prev]; n[i] = e.target.value; return n })} placeholder="e.g. What is the status?" style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                          <button type="button" onClick={() => setNewTemplateFields((prev) => prev.filter((_, j) => j !== i))} style={{ padding: '0.5rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Remove</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => setNewTemplateFields((prev) => [...prev, ''])} style={{ marginTop: '0.25rem', padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Add field</button>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button type="button" onClick={closeTemplateForm} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                        {editingReportTemplateId && (
                          <button type="button" onClick={() => editingReportTemplateId && deleteReportTemplate(editingReportTemplateId)} disabled={!!templateDeletingId} style={{ padding: '0.5rem 1rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', border: 'none', borderRadius: 4, cursor: templateDeletingId ? 'not-allowed' : 'pointer' }}>{templateDeletingId ? '…' : 'Delete'}</button>
                        )}
                      </div>
                      <button type="submit" disabled={templateSaving || !newTemplateName.trim()} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: templateSaving ? 'not-allowed' : 'pointer' }}>{templateSaving ? 'Saving…' : 'Save'}</button>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0 }}>Report Templates</h3>
                    <button type="button" onClick={() => setReportTemplatesModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)' }} aria-label="Close">×</button>
                  </div>
                  <button type="button" onClick={openAddTemplate} style={{ width: '100%', marginBottom: '1rem', padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Add template</button>
                  {reportTemplatesLoading ? (
                    <p style={{ color: 'var(--text-muted)' }}>Loading templates…</p>
                  ) : reportTemplatesList.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>No templates yet.</p>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {reportTemplatesList.map((t) => (
                        <li key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                          <span>{t.name}</span>
                          {t.app_managed ? (
                            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }} title="Built-in template">
                              Built-in
                            </span>
                          ) : (
                            <button type="button" onClick={() => openEditReportTemplate(t)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>
                              Edit
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>
        )}
        {reportsLoading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading reports…</p>
        ) : (
          (() => {
            const q = reportsSearch.trim().toLowerCase()
            const filtered = q
              ? reportsList.filter(
                  (r) =>
                    (r.job_display_name ?? '').toLowerCase().includes(q) ||
                    (r.job_hcp_number ?? '').toLowerCase().includes(q) ||
                    (r.created_by_name ?? '').toLowerCase().includes(q)
                )
              : reportsList
            if (reportsViewMode === 'person') {
              const byPersonKey = new Map<string, ReportWithJob[]>()
              for (const r of filtered) {
                const key = r.created_by_user_id
                const arr = byPersonKey.get(key) ?? []
                arr.push(r)
                byPersonKey.set(key, arr)
              }
              const personGroups = Array.from(byPersonKey.entries())
                .map(([key, reps]) => ({ key, reps: reps.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) }))
                .filter(({ reps }) => reps.length > 0)
                .sort((a, b) => new Date(b.reps[0]!.created_at).getTime() - new Date(a.reps[0]!.created_at).getTime())
              if (personGroups.length === 0) {
                return <p style={{ color: 'var(--text-muted)' }}>No reports yet. Click New report to add one.</p>
              }
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {personGroups.map(({ key, reps }) => {
                    const person = reps[0]!
                    const displayName = person.created_by_name || 'Unknown'
                    const isExpanded = reportsExpandedPersons.has(key)
                    return (
                      <div key={key} style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                        <button
                          type="button"
                          onClick={() =>
                            setReportsExpandedPersons((prev) => {
                              const next = new Set(prev)
                              if (next.has(key)) next.delete(key)
                              else next.add(key)
                              return next
                            })
                          }
                          style={{
                            width: '100%',
                            minWidth: 0,
                            padding: '0.75rem 1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: 'var(--bg-subtle)',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontSize: '0.875rem',
                          }}
                        >
                          <span
                            style={{
                              flex: 1,
                              minWidth: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {displayName}
                          </span>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              flexShrink: 0,
                              marginLeft: 'auto',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                              {reps.length} report{reps.length !== 1 ? 's' : ''}
                            </span>
                            <span style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>▼</span>
                          </span>
                        </button>
                        {isExpanded && (
                          <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid var(--border)' }}>
                            {reps.map((r) => (
                              <div key={r.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                  <div>
                                    <span style={{ fontWeight: 600 }}>{displayReportTemplateName(r.template_name, authRole)}</span>
                                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                                      {new Date(r.created_at).toLocaleString()} · {r.job_display_name && !looksLikeRawJobIdName(r.job_display_name) ? r.job_display_name : r.job_hcp_number ? `Job ${r.job_hcp_number}` : 'Unknown job'}
                                      {r.job_hcp_number ? ` (Job: ${r.job_hcp_number})` : ''}
                                    </span>
                                  </div>
                                  {myRole === 'dev' && (
                                    <button
                                      type="button"
                                      onClick={() => deleteReport(r.id)}
                                      disabled={reportsDeletingId === r.id}
                                      title="Delete"
                                      aria-label="Delete"
                                      style={{ padding: '0.25rem', cursor: reportsDeletingId === r.id ? 'not-allowed' : 'pointer', background: 'none', border: 'none', color: 'var(--text-red-600)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                    >
                                      {reportsDeletingId === r.id ? '…' : 'Delete'}
                                    </button>
                                  )}
                                </div>
                                {r.field_values && Object.keys(r.field_values).length > 0 && (
                                  <div style={{ fontSize: '0.875rem' }}>
                                    {Object.entries(r.field_values).map(([label, val]) =>
                                      val ? (
                                        <div key={label} style={{ marginBottom: '0.25rem' }}>
                                          <span style={{ color: 'var(--text-muted)' }}>{label}:</span> {formatReportFieldValueInlineList(val)}
                                        </div>
                                      ) : null
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            }
            const byJobKey = new Map<string, ReportWithJob[]>()
            for (const r of filtered) {
              const key = `${r.job_ledger_id ?? ''}-${r.project_id ?? ''}`
              const arr = byJobKey.get(key) ?? []
              arr.push(r)
              byJobKey.set(key, arr)
            }
            const jobGroups = Array.from(byJobKey.entries())
              .map(([key, reps]) => ({ key, reps: reps.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) }))
              .filter(({ reps }) => reps.length > 0)
              .sort((a, b) => new Date(b.reps[0]!.created_at).getTime() - new Date(a.reps[0]!.created_at).getTime())
            if (jobGroups.length === 0) {
              return <p style={{ color: 'var(--text-muted)' }}>No reports yet. Click New report to add one.</p>
            }
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {jobGroups.map(({ key, reps }) => {
                  const job = reps[0]!
                  const displayName =
                    job.job_display_name && !looksLikeRawJobIdName(job.job_display_name)
                      ? job.job_display_name
                      : job.job_hcp_number
                        ? `Job ${job.job_hcp_number}`
                        : 'Unknown job'
                  const hcp = job.job_hcp_number ? ` (Job: ${job.job_hcp_number})` : ''
                  const isExpanded = reportsExpandedJobs.has(key)
                  return (
                    <div key={key} style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-subtle)' }}>
                        {job.job_ledger_id ? (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0, paddingLeft: '0.5rem' }}>
                            {(() => {
                              const jid = job.job_ledger_id as string
                              const drive = (job.job_google_drive_link ?? '').trim()
                              const jpics = (job.job_job_pictures_link ?? '').trim()
                              const iconBtnBase: CSSProperties = {
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '0.25rem',
                                flexShrink: 0,
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                borderRadius: 4,
                                color: 'inherit',
                              }
                              return (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      drive
                                        ? openInExternalBrowser(drive)
                                        : showToast(JOBS_REPORTS_TAB_TOAST_NO_CUSTOMER_FILES, 'warning', undefined, undefined, 'center')
                                    }
                                    title={
                                      drive
                                        ? 'Open Customer Files'
                                        : JOBS_REPORTS_TAB_TOAST_NO_CUSTOMER_FILES
                                    }
                                    aria-label={
                                      drive
                                        ? 'Open Customer Files link'
                                        : 'Customer Files not linked; contact Dispatch'
                                    }
                                    style={{
                                      ...iconBtnBase,
                                      color: drive ? 'var(--text-link)' : 'var(--text-red-600)',
                                    }}
                                  >
                                    <Folder size={18} strokeWidth={2} aria-hidden />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      jpics
                                        ? openInExternalBrowser(jpics)
                                        : showToast(JOBS_REPORTS_TAB_TOAST_NO_CUSTOMER_PICTURES, 'warning', undefined, undefined, 'center')
                                    }
                                    title={
                                      jpics
                                        ? 'Open Customer Pictures'
                                        : JOBS_REPORTS_TAB_TOAST_NO_CUSTOMER_PICTURES
                                    }
                                    aria-label={
                                      jpics
                                        ? 'Open Customer Pictures link'
                                        : 'Customer Pictures not linked; contact Dispatch'
                                    }
                                    style={{
                                      ...iconBtnBase,
                                      color: jpics ? 'var(--text-link)' : 'var(--text-red-600)',
                                    }}
                                  >
                                    <Images size={18} strokeWidth={2} aria-hidden />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      tryOpenEditJob(jid, {
                                        initialJob: jobs.find((jRow) => jRow.id === jid),
                                        onSaved: () => {
                                          void loadJobs()
                                          void loadReports()
                                        },
                                      })
                                    }
                                    title="Edit job"
                                    aria-label="Edit job"
                                    style={{
                                      ...iconBtnBase,
                                      color: 'var(--text-link)',
                                    }}
                                  >
                                    <Pencil size={18} strokeWidth={2} aria-hidden />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const hLabel = (job.job_hcp_number ?? '').trim() || '—'
                                      const nameLabel = (job.job_display_name ?? '').trim() || 'Job'
                                      jobDetailModal?.openJobDetail({
                                        jobId: jid,
                                        prefillRowLabel: `${hLabel} · ${nameLabel}`,
                                        prefillAddress: (job.job_address ?? '').trim() || null,
                                        onEditJobSaved: () => void loadJobs(),
                                      })
                                    }}
                                    title="Job preview"
                                    aria-label={`Job preview — ${displayName}`}
                                    style={{
                                      ...iconBtnBase,
                                      color: 'var(--text-link)',
                                    }}
                                  >
                                    <PanelRightOpen size={18} strokeWidth={2} aria-hidden />
                                  </button>
                                </>
                              )
                            })()}
                          </div>
                        ) : null}
                        <button
                          type="button"
                          onClick={() =>
                            setReportsExpandedJobs((prev) => {
                              const next = new Set(prev)
                              if (next.has(key)) next.delete(key)
                              else next.add(key)
                              return next
                            })
                          }
                          style={{
                            flex: 1,
                            minWidth: 0,
                            padding: '0.75rem 1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontSize: '0.875rem',
                          }}
                        >
                          <span
                            style={{
                              flex: 1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              minWidth: 0,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {displayName}
                            {hcp}
                          </span>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              flexShrink: 0,
                              marginLeft: 'auto',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                              {reps.length} report{reps.length !== 1 ? 's' : ''}
                            </span>
                            <span style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>▼</span>
                          </span>
                        </button>
                      </div>
                      {isExpanded && (
                        <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid var(--border)' }}>
                          {reps.map((r) => (
                            <div key={r.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                <div>
                                  <span style={{ fontWeight: 600 }}>{displayReportTemplateName(r.template_name, authRole)}</span>
                                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                                    {new Date(r.created_at).toLocaleString()} · {r.created_by_name}
                                  </span>
                                </div>
                                {myRole === 'dev' && (
                                  <button
                                    type="button"
                                    onClick={() => deleteReport(r.id)}
                                    disabled={reportsDeletingId === r.id}
                                    title="Delete"
                                    aria-label="Delete"
                                    style={{ padding: '0.25rem', cursor: reportsDeletingId === r.id ? 'not-allowed' : 'pointer', background: 'none', border: 'none', color: 'var(--text-red-600)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                  >
                                    {reportsDeletingId === r.id ? '…' : 'Delete'}
                                  </button>
                                )}
                              </div>
                              {r.field_values && Object.keys(r.field_values).length > 0 && (
                                <div style={{ fontSize: '0.875rem' }}>
                                  {Object.entries(r.field_values).map(([label, val]) =>
                                    val ? (
                                      <div key={label} style={{ marginBottom: '0.25rem' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>{label}:</span> {formatReportFieldValueInlineList(val)}
                                      </div>
                                    ) : null
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()
        )}
      </div>
      <NewReportModal
        open={newReportModalOpen}
        onClose={() => setNewReportModalOpen(false)}
        onSaved={() => { setNewReportModalOpen(false); loadReports(); }}
        authUserId={authUserId}
        userRole={authRole}
      />
      <RecurringEmailReportsModal
        open={recurringEmailReportsModalOpen}
        onClose={() => setRecurringEmailReportsModalOpen(false)}
        authUserId={authUserId ?? undefined}
        authRole={authRole}
        scopeMasterChoices={scopeMastersForRecurringReports}
      />
    </>
  )
}
