import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Database } from '../types/database'

type Step = Database['public']['Tables']['project_workflow_steps']['Row']
type StepStatus = Step['status']
type Project = Database['public']['Tables']['projects']['Row']
type Workflow = Database['public']['Tables']['project_workflows']['Row']

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocal(value: string): string | null {
  const v = value.trim()
  if (!v) return null
  return new Date(v).toISOString()
}

function formatDatetime(iso: string | null): string {
  if (!iso) return 'unknown'
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

function personDisplay(name: string | null): string {
  return (name && name.trim()) ? name.trim() : 'unknown'
}

export default function Workflow() {
  const { projectId } = useParams()
  const { user: authUser } = useAuth()
  const [project, setProject] = useState<Project | null>(null)
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [stepForm, setStepForm] = useState<{ open: boolean; step: Step | null; depends_on_step_id?: string | null }>({ open: false, step: null })
  const [rejectStep, setRejectStep] = useState<{ step: Step; reason: string } | null>(null)
  const [assignPersonStep, setAssignPersonStep] = useState<Step | null>(null)
  const [roster, setRoster] = useState<{ name: string }[]>([])
  const [userSubscriptions, setUserSubscriptions] = useState<Record<string, { notify_when_started: boolean; notify_when_complete: boolean; notify_when_reopened: boolean }>>({})

  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [creatingFromTemplate, setCreatingFromTemplate] = useState(false)

  async function ensureWorkflow(pid: string) {
    const { data: wfs } = await supabase.from('project_workflows').select('*').eq('project_id', pid)
    if (wfs && wfs.length > 0) {
      setWorkflow(wfs[0] as Workflow)
      return (wfs[0] as Workflow).id
    }
    const { data: proj } = await supabase.from('projects').select('name').eq('id', pid).single()
    const name = (proj as { name?: string } | null)?.name ? `${(proj as { name: string }).name} workflow` : 'Workflow'
    const { data: inserted } = await supabase.from('project_workflows').insert({ project_id: pid, name, status: 'draft' }).select().single()
    const w = inserted as Workflow
    setWorkflow(w)
    return w.id
  }

  async function loadProject(pid: string) {
    const { data, error: e } = await supabase.from('projects').select('*').eq('id', pid).single()
    if (e) {
      setError(e.message)
      setLoading(false)
      return
    }
    setProject(data as Project)
  }

  async function loadSteps(wfId: string) {
    const { data, error: e } = await supabase
      .from('project_workflow_steps')
      .select('*')
      .eq('workflow_id', wfId)
      .order('sequence_order', { ascending: true })
    if (e) {
      setError(e.message)
      return
    }
    const stepData = (data as Step[]) ?? []
    setSteps(stepData)
    
    // Load user subscriptions for these steps
    if (authUser?.id && stepData.length > 0) {
      const stepIds = stepData.map((s) => s.id)
      const { data: subs } = await supabase
        .from('step_subscriptions')
        .select('step_id, notify_when_started, notify_when_complete, notify_when_reopened')
        .eq('user_id', authUser.id)
        .in('step_id', stepIds)
      if (subs) {
        const subsMap: Record<string, { notify_when_started: boolean; notify_when_complete: boolean; notify_when_reopened: boolean }> = {}
        subs.forEach((sub) => {
          subsMap[sub.step_id] = {
            notify_when_started: sub.notify_when_started,
            notify_when_complete: sub.notify_when_complete,
            notify_when_reopened: sub.notify_when_reopened,
          }
        })
        setUserSubscriptions(subsMap)
      }
    }
  }

  useEffect(() => {
    if (!projectId) {
      setLoading(false)
      return
    }
    (async () => {
      await loadProject(projectId)
      const wfId = await ensureWorkflow(projectId)
      if (wfId) await loadSteps(wfId)
      setLoading(false)
    })()
  }, [projectId])

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('workflow_templates').select('id, name').order('name')
      setTemplates((data as { id: string; name: string }[]) ?? [])
    })()
  }, [])

  useEffect(() => {
    if (!authUser?.id) return
    ;(async () => {
      const [peopleRes, usersRes] = await Promise.all([
        supabase.from('people').select('name').eq('master_user_id', authUser.id).order('name'),
        supabase.from('users').select('name').in('role', ['assistant', 'master', 'subcontractor']),
      ])
      const fromPeople = (peopleRes.data as { name: string }[] | null) ?? []
      const fromUsers = (usersRes.data as { name: string }[] | null) ?? []
      const names = [...fromUsers.map((r) => r.name), ...fromPeople.map((r) => r.name)].filter(Boolean).sort()
      setRoster(names.map((name) => ({ name })))
    })()
  }, [authUser?.id])

  async function refreshSteps() {
    if (workflow?.id) {
      await loadSteps(workflow.id)
    }
  }

  async function openAddStep() {
    setStepForm({ open: true, step: null })
  }

  async function openEditStep(step: Step) {
    const { data: deps } = await supabase.from('workflow_step_dependencies').select('depends_on_step_id').eq('step_id', step.id).limit(1)
    const depends_on_step_id = (deps as { depends_on_step_id: string }[] | null)?.[0]?.depends_on_step_id ?? null
    setStepForm({ open: true, step, depends_on_step_id })
  }

  function closeStepForm() {
    setStepForm({ open: false, step: null })
  }

  async function createFromTemplate() {
    if (!workflow || !selectedTemplateId) return
    setCreatingFromTemplate(true)
    const { data: tSteps } = await supabase.from('workflow_template_steps').select('sequence_order, name').eq('template_id', selectedTemplateId).order('sequence_order', { ascending: true })
    if (tSteps && tSteps.length > 0) {
      for (const t of tSteps as { sequence_order: number; name: string }[]) {
        await supabase.from('project_workflow_steps').insert({
          workflow_id: workflow.id,
          sequence_order: t.sequence_order,
          name: t.name,
          status: 'pending',
        })
      }
    }
    setCreatingFromTemplate(false)
    await refreshSteps()
  }

  async function saveStep(p: { name: string; assigned_to_name: string; started_at: string | null; ended_at: string | null; depends_on_step_id?: string | null }) {
    if (!workflow) return
    if (stepForm.step) {
      await supabase.from('project_workflow_steps').update({
        name: p.name.trim(),
        assigned_to_name: p.assigned_to_name.trim() || null,
        started_at: p.started_at,
        ended_at: p.ended_at,
      }).eq('id', stepForm.step.id)
      await supabase.from('workflow_step_dependencies').delete().eq('step_id', stepForm.step.id)
      if (p.depends_on_step_id) {
        await supabase.from('workflow_step_dependencies').insert({ step_id: stepForm.step.id, depends_on_step_id: p.depends_on_step_id })
      }
    } else {
      const maxOrder = steps.length === 0 ? 0 : Math.max(...steps.map((s) => s.sequence_order))
      await supabase.from('project_workflow_steps').insert({
        workflow_id: workflow.id,
        sequence_order: maxOrder + 1,
        name: p.name.trim(),
        assigned_to_name: p.assigned_to_name.trim() || null,
        started_at: p.started_at,
        ended_at: p.ended_at,
        status: 'pending',
      })
    }
    await refreshSteps()
    closeStepForm()
  }

  async function updateStepStatus(step: Step, status: StepStatus, extra?: { ended_at?: string; rejection_reason?: string }) {
    const up: Record<string, unknown> = { status }
    if (extra?.ended_at) up.ended_at = extra.ended_at
    if (extra?.rejection_reason != null) up.rejection_reason = extra.rejection_reason
    await supabase.from('project_workflow_steps').update(up).eq('id', step.id)
    await refreshSteps()
  }

  async function markStarted(step: Step) {
    await supabase.from('project_workflow_steps').update({ started_at: new Date().toISOString(), status: 'in_progress' }).eq('id', step.id)
    await refreshSteps()
  }

  async function markCompleted(step: Step) {
    await updateStepStatus(step, 'completed', { ended_at: new Date().toISOString() })
    await refreshSteps()
  }

  async function markApproved(step: Step) {
    await updateStepStatus(step, 'approved', { ended_at: new Date().toISOString() })
    await refreshSteps()
  }

  async function reopenStep(step: Step) {
    await supabase.from('project_workflow_steps').update({ status: 'pending', ended_at: null }).eq('id', step.id)
    await refreshSteps()
  }

  async function updateNotifyAssigned(step: Step, field: 'notify_assigned_when_started' | 'notify_assigned_when_complete' | 'notify_assigned_when_reopened', value: boolean) {
    await supabase.from('project_workflow_steps').update({ [field]: value }).eq('id', step.id)
    await refreshSteps()
  }

  async function updateNotifyMe(step: Step, field: 'notify_when_started' | 'notify_when_complete' | 'notify_when_reopened', value: boolean) {
    if (!authUser?.id) return
    const current = userSubscriptions[step.id]
    const payload = {
      step_id: step.id,
      user_id: authUser.id,
      notify_when_started: field === 'notify_when_started' ? value : (current?.notify_when_started ?? false),
      notify_when_complete: field === 'notify_when_complete' ? value : (current?.notify_when_complete ?? false),
      notify_when_reopened: field === 'notify_when_reopened' ? value : (current?.notify_when_reopened ?? false),
    }
    if (current) {
      await supabase.from('step_subscriptions').update(payload).eq('step_id', step.id).eq('user_id', authUser.id)
    } else {
      await supabase.from('step_subscriptions').insert(payload)
    }
    setUserSubscriptions((prev) => ({ ...prev, [step.id]: payload }))
  }

  async function submitReject() {
    if (!rejectStep) return
    await supabase.from('project_workflow_steps').update({
      status: 'rejected',
      rejection_reason: rejectStep.reason.trim() || null,
      ended_at: new Date().toISOString(),
    }).eq('id', rejectStep.step.id)
    setRejectStep(null)
    await refreshSteps()
  }

  async function deleteStep(step: Step) {
    if (!confirm('Delete this step?')) return
    setError(null)
    await supabase.from('workflow_step_dependencies').delete().eq('step_id', step.id)
    await supabase.from('workflow_step_dependencies').delete().eq('depends_on_step_id', step.id)
    const { error: delErr } = await supabase.from('project_workflow_steps').delete().eq('id', step.id)
    if (delErr) {
      setError(delErr.message)
      return
    }
    await refreshSteps()
  }

  async function assignPerson(step: Step, name: string | null) {
    const { error: err } = await supabase.from('project_workflow_steps').update({ assigned_to_name: name }).eq('id', step.id)
    if (err) setError(err.message)
    else await refreshSteps()
    setAssignPersonStep(null)
  }

  if (loading) return <p>Loading...</p>
  if (error) return <p style={{ color: '#b91c1c' }}>{error}</p>
  if (!project || !workflow) return <p>Project or workflow not found.</p>

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/projects">{"\u2190"} Projects</Link>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1>{project.name}{" \u2013 "}Workflow</h1>
        <button type="button" onClick={openAddStep} style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6 }}>
          Add step
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {steps.length === 0 ? (
          <div>
            <p style={{ marginBottom: '1rem' }}>No steps yet. Add a step or create from a template.</p>
            {templates.length > 0 && (
              <div style={{ padding: '1rem', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: '1rem', maxWidth: 400 }}>
                <strong style={{ display: 'block', marginBottom: 8 }}>Create from template</strong>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    style={{ padding: '0.5rem', flex: 1, minWidth: 160 }}
                  >
                    <option value="">Select a template</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={createFromTemplate}
                    disabled={!selectedTemplateId || creatingFromTemplate}
                    style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6 }}
                  >
                    {creatingFromTemplate ? 'Creating...' : 'Create from template'}
                  </button>
                </div>
              </div>
            )}
            <p>Or <button type="button" onClick={openAddStep} style={{ padding: 0, background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', textDecoration: 'underline', font: 'inherit' }}>add a step</button> to build from scratch.</p>
          </div>
        ) : (
          steps.map((s, i) => (
            <div key={s.id}>
              <div
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: '1rem',
                  marginBottom: '0.25rem',
                  background: s.status === 'rejected' ? '#fef2f2' : s.status === 'approved' || s.status === 'completed' ? '#f0fdf4' : '#fff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: 4 }}>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <div style={{ fontSize: '0.875rem', color: '#374151', whiteSpace: 'nowrap' }}>{personDisplay(s.assigned_to_name)}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.8125rem', color: '#6b7280', gap: 6 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        <div>Notify ASSIGNED PERSON when stage</div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!s.notify_assigned_when_started} onChange={(e) => updateNotifyAssigned(s, 'notify_assigned_when_started', e.target.checked)} />
                          started
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!s.notify_assigned_when_complete} onChange={(e) => updateNotifyAssigned(s, 'notify_assigned_when_complete', e.target.checked)} />
                          complete
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!s.notify_assigned_when_reopened} onChange={(e) => updateNotifyAssigned(s, 'notify_assigned_when_reopened', e.target.checked)} />
                          re-opened
                        </label>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, marginTop: 4 }}>
                        <div>Notify ME when stage</div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!userSubscriptions[s.id]?.notify_when_started} onChange={(e) => updateNotifyMe(s, 'notify_when_started', e.target.checked)} />
                          started
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!userSubscriptions[s.id]?.notify_when_complete} onChange={(e) => updateNotifyMe(s, 'notify_when_complete', e.target.checked)} />
                          complete
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!userSubscriptions[s.id]?.notify_when_reopened} onChange={(e) => updateNotifyMe(s, 'notify_when_reopened', e.target.checked)} />
                          re-opened
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: 8 }}>
                  Start: {formatDatetime(s.started_at)}{" \u00B7 "}End: {formatDatetime(s.ended_at)}
                </div>
                <div style={{ fontSize: '0.875rem', marginBottom: 8 }}>Status: {s.status}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => setAssignPersonStep(s)} style={{ padding: '4px 8px', fontSize: '0.875rem' }}>Add person</button>
                  <button type="button" onClick={() => openEditStep(s)} style={{ padding: '4px 8px', fontSize: '0.875rem' }}>Edit</button>
                  {s.status === 'pending' && <button type="button" onClick={() => markStarted(s)} style={{ padding: '4px 8px', fontSize: '0.875rem' }}>Start</button>}
                  {(s.status === 'pending' || s.status === 'in_progress') && <button type="button" onClick={() => markCompleted(s)} style={{ padding: '4px 8px', fontSize: '0.875rem' }}>Complete</button>}
                  {(s.status === 'pending' || s.status === 'in_progress') && <button type="button" onClick={() => markApproved(s)} style={{ padding: '4px 8px', fontSize: '0.875rem' }}>Approve</button>}
                  {(s.status === 'pending' || s.status === 'in_progress') && <button type="button" onClick={() => setRejectStep({ step: s, reason: '' })} style={{ padding: '4px 8px', fontSize: '0.875rem', color: '#E87600' }}>Reject</button>}
                  {(s.status === 'completed' || s.status === 'approved') && <button type="button" onClick={() => reopenStep(s)} style={{ padding: '4px 8px', fontSize: '0.875rem' }}>Re-open</button>}
                  <button type="button" onClick={() => deleteStep(s)} style={{ padding: '4px 8px', fontSize: '0.875rem', color: '#b91c1c' }}>Delete</button>
                </div>
                {s.rejection_reason && <div style={{ marginTop: 8, fontSize: '0.875rem', color: '#b91c1c' }}>Rejection: {s.rejection_reason}</div>}
              </div>
              {i < steps.length - 1 && <div style={{ textAlign: 'center', marginBottom: '0.25rem', color: '#9ca3af' }}>{"\u2193"}</div>}
            </div>
          ))
        )}
      </div>

      {stepForm.open && (
        <StepFormModal
          step={stepForm.step}
          dependsOnStepId={stepForm.depends_on_step_id ?? null}
          steps={steps}
          onSave={saveStep}
          onClose={closeStepForm}
          toDatetimeLocal={toDatetimeLocal}
          fromDatetimeLocal={fromDatetimeLocal}
        />
      )}

      {rejectStep && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h3 style={{ marginTop: 0 }}>Reject step: {rejectStep.step.name}</h3>
            <label style={{ display: 'block', marginBottom: 4 }}>Reason</label>
            <textarea
              value={rejectStep.reason}
              onChange={(e) => setRejectStep((r) => r ? { ...r, reason: e.target.value } : null)}
              rows={3}
              style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
              placeholder="Rejection reason (optional)"
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={submitReject} style={{ padding: '0.5rem 1rem', color: '#E87600' }}>Reject</button>
              <button type="button" onClick={() => setRejectStep(null)} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {assignPersonStep && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 280, maxWidth: 400, maxHeight: '80vh', overflow: 'auto', color: '#111827' }}>
            <h3 style={{ marginTop: 0, color: '#111827' }}>Add person to: {assignPersonStep.name}</h3>
            <p style={{ fontSize: '0.875rem', color: '#111827', marginBottom: '1rem' }}>Choose from your roster (People and signed-up users).</p>
            {roster.length === 0 ? (
              <p style={{ color: '#111827', marginBottom: '1rem' }}>No people in your roster yet. Add them on the People page.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '1rem' }}>
                {roster.map((r, i) => (
                  <button
                    key={`${r.name}-${i}`}
                    type="button"
                    onClick={() => assignPerson(assignPersonStep, r.name)}
                    style={{ padding: '0.5rem 0.75rem', textAlign: 'left', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', color: '#111827' }}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => assignPerson(assignPersonStep, null)} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', color: '#111827' }}>Clear</button>
              <button type="button" onClick={() => setAssignPersonStep(null)} style={{ padding: '0.5rem 1rem', color: '#111827' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StepFormModal({
  step,
  dependsOnStepId,
  steps,
  onSave,
  onClose,
  toDatetimeLocal,
  fromDatetimeLocal,
}: {
  step: Step | null
  dependsOnStepId: string | null
  steps: Step[]
  onSave: (p: { name: string; assigned_to_name: string; started_at: string | null; ended_at: string | null; depends_on_step_id?: string | null }) => void
  onClose: () => void
  toDatetimeLocal: (iso: string | null) => string
  fromDatetimeLocal: (v: string) => string | null
}) {
  const [name, setName] = useState(step?.name ?? '')
  const [assigned_to_name, setAssignedToName] = useState(step?.assigned_to_name ?? '')
  const [started_at, setStartedAt] = useState(toDatetimeLocal(step?.started_at ?? null))
  const [ended_at, setEndedAt] = useState(toDatetimeLocal(step?.ended_at ?? null))
  const [depends_on_step_id, setDependsOnStepId] = useState(dependsOnStepId ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      name,
      assigned_to_name,
      started_at: fromDatetimeLocal(started_at),
      ended_at: fromDatetimeLocal(ended_at),
      ...(step ? { depends_on_step_id: depends_on_step_id || null } : {}),
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 360 }}>
        <h2 style={{ marginTop: 0 }}>{step ? 'Edit step' : 'Add step'}</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="step-name" style={{ display: 'block', marginBottom: 4 }}>Step (plain text) *</label>
            <input
              id="step-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. deliver materials: rough in"
              style={{ width: '100%', padding: '0.5rem' }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: 6 }}>
              {[
                'initial walkthrough',
                'check work walkthrough',
                'customer walkthrough',
                'send bill',
                'wait on payment',
                'rough in',
                'top out',
                'trim',
              ].map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => setName((prev) => (prev ? `${prev}, ${phrase}` : phrase))}
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                >
                  {phrase}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="step-person" style={{ display: 'block', marginBottom: 4 }}>Person</label>
            <input
              id="step-person"
              type="text"
              value={assigned_to_name}
              onChange={(e) => setAssignedToName(e.target.value)}
              placeholder="e.g. Subcontractor Joey, Mike"
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="step-start" style={{ display: 'block', marginBottom: 4 }}>Start time</label>
            <input
              id="step-start"
              type="datetime-local"
              value={started_at}
              onChange={(e) => setStartedAt(e.target.value)}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="step-end" style={{ display: 'block', marginBottom: 4 }}>End time</label>
            <input
              id="step-end"
              type="datetime-local"
              value={ended_at}
              onChange={(e) => setEndedAt(e.target.value)}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
          {step && steps.length > 1 && (
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="step-depends" style={{ display: 'block', marginBottom: 4 }}>Depends on (for branching)</label>
              <select
                id="step-depends"
                value={depends_on_step_id}
                onChange={(e) => setDependsOnStepId(e.target.value)}
                style={{ width: '100%', padding: '0.5rem' }}
              >
                <option value="">None</option>
                {steps.filter((s) => s.id !== step.id).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" style={{ padding: '0.5rem 1rem' }}>Save</button>
            <button type="button" onClick={onClose} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}
