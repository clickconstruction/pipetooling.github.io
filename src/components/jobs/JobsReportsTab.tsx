import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import NewReportModal from '../NewReportModal'
import { JobsReportsListView } from './JobsReportsListView'
import { useIsMobile } from '../../hooks/useIsMobile'
import RecurringEmailReportsModal from './RecurringEmailReportsModal'
import type { UserRole } from '../../hooks/useAuth'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { OpenEditJobOptions } from '../../contexts/JobFormModalContext'
import type { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import type { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
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
  const confirmDialog = useConfirmDialog()
  const isMobile = useIsMobile()
  const [reportsList, setReportsList] = useState<ReportWithJob[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportsSearch, setReportsSearch] = useState('')
  // vFEED: the page opens on the newest-first feed; By job / By person are one tap away.
  const [reportsViewMode, setReportsViewMode] = useState<'newest' | 'job' | 'person'>('newest')
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
    if (!(await confirmDialog({ message: 'Delete this report?', confirmLabel: 'Delete', danger: true }))) return
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
    if (!(await confirmDialog({ message: 'Delete this template?', confirmLabel: 'Delete', danger: true }))) return
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
      {/* vFEED: reports are narrow content — cap the column so desktop reads like the phone, centered. */}
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
        {/* vFEED toolbar: one obvious button (thumb-height on phones), search, then quiet view chips. */}
        <div style={{ marginBottom: '0.6rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setNewReportModalOpen(true)}
            style={{
              font: 'inherit',
              fontWeight: 650,
              fontSize: isMobile ? '1.05rem' : undefined,
              padding: isMobile ? '0' : '0.5rem 1rem',
              height: isMobile ? 50 : undefined,
              width: isMobile ? '100%' : undefined,
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: isMobile ? 12 : 6,
              cursor: 'pointer',
            }}
          >
            ＋ New report
          </button>
          <input
            type="text"
            placeholder="Search job, number, or person"
            value={reportsSearch}
            onChange={(e) => setReportsSearch(e.target.value)}
            style={{ flex: '1 1 180px', minWidth: 0, padding: '0.55rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 10, font: 'inherit', fontSize: '0.95rem' }}
          />
          {canManageTemplates && !isMobile ? (
            <>
              <button
                type="button"
                onClick={() => setRecurringEmailReportsModalOpen(true)}
                style={{ font: 'inherit', padding: '0.5rem 0.9rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 10, cursor: 'pointer', color: 'var(--text-strong)' }}
              >
                Recurring Email Reports
              </button>
              <button
                type="button"
                onClick={openReportTemplatesModal}
                title="Manage templates"
                aria-label="Manage report templates"
                style={{ font: 'inherit', padding: '0.5rem 0.9rem', background: 'var(--bg-muted)', color: 'var(--text-700)', border: '1px solid var(--border-strong)', borderRadius: 10, cursor: 'pointer' }}
              >
                Templates
              </button>
            </>
          ) : null}
        </div>
        <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {(
            [
              ['newest', 'Newest'],
              ['job', 'By job'],
              ['person', 'By person'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setReportsViewMode(key)}
              aria-pressed={reportsViewMode === key}
              style={{
                font: 'inherit',
                fontSize: '0.875rem',
                fontWeight: reportsViewMode === key ? 600 : 400,
                padding: '0.4rem 0.95rem',
                borderRadius: 999,
                border: reportsViewMode === key ? '1px solid #2563eb' : '1px solid var(--border-strong)',
                background: reportsViewMode === key ? '#2563eb' : 'var(--surface)',
                color: reportsViewMode === key ? 'white' : 'var(--text-700)',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
          {canManageTemplates && isMobile ? (
            <>
              <button type="button" onClick={() => setRecurringEmailReportsModalOpen(true)} style={{ font: 'inherit', fontSize: '0.8rem', marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-link)', cursor: 'pointer', padding: '0.3rem 0.2rem' }}>
                Email reports
              </button>
              <button type="button" onClick={openReportTemplatesModal} style={{ font: 'inherit', fontSize: '0.8rem', background: 'none', border: 'none', color: 'var(--text-link)', cursor: 'pointer', padding: '0.3rem 0.2rem' }}>
                Templates
              </button>
            </>
          ) : null}
        </div>
        {reportTemplatesModalOpen && (
          <div style={{ position: 'fixed', padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, maxWidth: 400, width: '90%', maxHeight: 'min(90vh, 100%)', overflow: 'auto' }}>
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
            return (
              <JobsReportsListView
                rows={filtered}
                viewMode={reportsViewMode}
                authRole={authRole}
                isDev={myRole === 'dev'}
                deletingId={reportsDeletingId}
                onDelete={(id) => void deleteReport(id)}
                onOpenFiles={(row) => {
                  const drive = (row.job_google_drive_link ?? '').trim()
                  if (drive) openInExternalBrowser(drive)
                  else showToast(JOBS_REPORTS_TAB_TOAST_NO_CUSTOMER_FILES, 'warning', undefined, undefined, 'center')
                }}
                onOpenPictures={(row) => {
                  const jpics = (row.job_job_pictures_link ?? '').trim()
                  if (jpics) openInExternalBrowser(jpics)
                  else showToast(JOBS_REPORTS_TAB_TOAST_NO_CUSTOMER_PICTURES, 'warning', undefined, undefined, 'center')
                }}
                onEditJob={(jobId) =>
                  tryOpenEditJob(jobId, {
                    initialJob: jobs.find((jRow) => jRow.id === jobId),
                    onSaved: () => {
                      void loadJobs()
                      void loadReports()
                    },
                  })
                }
                onPreviewJob={(row) => {
                  const jid = row.job_ledger_id
                  if (!jid) return
                  const hLabel = (row.job_hcp_number ?? '').trim() || '—'
                  const nameLabel = (row.job_display_name ?? '').trim() || 'Job'
                  jobDetailModal?.openJobDetail({
                    jobId: jid,
                    prefillRowLabel: `${hLabel} · ${nameLabel}`,
                    prefillAddress: (row.job_address ?? '').trim() || null,
                    onEditJobSaved: () => void loadJobs(),
                  })
                }}
              />
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
