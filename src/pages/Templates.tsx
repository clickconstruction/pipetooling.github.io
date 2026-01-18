import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

type Template = { id: string; name: string; description: string | null }
type TemplateStep = { id: string; template_id: string; sequence_order: number; name: string }
type UserRole = 'owner' | 'master' | 'assistant'

export default function Templates() {
  const { user: authUser } = useAuth()
  const [myRole, setMyRole] = useState<UserRole | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [workflowModal, setWorkflowModal] = useState<{ templateId: string; templateName: string } | null>(null)
  const [workflowSteps, setWorkflowSteps] = useState<TemplateStep[]>([])
  const [workflowStepsLoading, setWorkflowStepsLoading] = useState(false)
  const [newStepName, setNewStepName] = useState('')
  const [addingStep, setAddingStep] = useState(false)
  const [deletingStepId, setDeletingStepId] = useState<string | null>(null)
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [editingStepName, setEditingStepName] = useState('')
  const [updatingStepId, setUpdatingStepId] = useState<string | null>(null)

  async function loadRoleAndTemplates() {
    if (!authUser?.id) {
      setLoading(false)
      return
    }
    const { data: me, error: eMe } = await supabase
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single()
    if (eMe) {
      setError(eMe.message)
      setLoading(false)
      return
    }
    const role = (me as { role: UserRole } | null)?.role ?? null
    setMyRole(role)
    if (role !== 'owner') {
      setLoading(false)
      return
    }
    const { data: list, error: eList } = await supabase
      .from('workflow_templates')
      .select('id, name, description')
      .order('name')
    if (eList) setError(eList.message)
    else setTemplates((list as Template[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadRoleAndTemplates()
  }, [authUser?.id])

  function openAdd() {
    setEditingId(null)
    setName('')
    setDescription('')
    setFormOpen(true)
    setError(null)
  }

  function openEdit(t: Template) {
    setEditingId(t.id)
    setName(t.name)
    setDescription(t.description ?? '')
    setFormOpen(true)
    setError(null)
  }

  function closeForm() {
    setFormOpen(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    if (editingId) {
      const { error: e } = await supabase
        .from('workflow_templates')
        .update({ name: name.trim(), description: description.trim() || null })
        .eq('id', editingId)
      if (e) setError(e.message)
      else {
        setTemplates((prev) =>
          prev.map((t) => (t.id === editingId ? { ...t, name: name.trim(), description: description.trim() || null } : t))
        )
        closeForm()
      }
    } else {
      const { data, error: e } = await supabase
        .from('workflow_templates')
        .insert({ name: name.trim(), description: description.trim() || null })
        .select('id, name, description')
        .single()
      if (e) setError(e.message)
      else if (data) {
        setTemplates((prev) => [...prev, data as Template].sort((a, b) => a.name.localeCompare(b.name)))
        closeForm()
      }
    }
    setSaving(false)
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Delete this template? Its steps will also be removed.')) return
    setDeletingId(id)
    setError(null)
    await supabase.from('workflow_template_steps').delete().eq('template_id', id)
    const { error: e } = await supabase.from('workflow_templates').delete().eq('id', id)
    if (e) setError(e.message)
    else setTemplates((prev) => prev.filter((t) => t.id !== id))
    setDeletingId(null)
  }

  async function openWorkflow(t: Template) {
    setWorkflowModal({ templateId: t.id, templateName: t.name })
    setWorkflowSteps([])
    setNewStepName('')
    setError(null)
    setWorkflowStepsLoading(true)
    const { data } = await supabase.from('workflow_template_steps').select('id, template_id, sequence_order, name').eq('template_id', t.id).order('sequence_order', { ascending: true })
    setWorkflowSteps((data as TemplateStep[]) ?? [])
    setWorkflowStepsLoading(false)
  }

  function closeWorkflow() {
    setWorkflowModal(null)
  }

  async function addWorkflowStep(e: React.FormEvent) {
    e.preventDefault()
    if (!workflowModal || !newStepName.trim()) return
    setAddingStep(true)
    setError(null)
    const maxOrder = workflowSteps.length === 0 ? 0 : Math.max(...workflowSteps.map((s) => s.sequence_order))
    const { data, error: err } = await supabase
      .from('workflow_template_steps')
      .insert({ template_id: workflowModal.templateId, sequence_order: maxOrder + 1, name: newStepName.trim() })
      .select('id, template_id, sequence_order, name')
      .single()
    setAddingStep(false)
    if (err) setError(err.message)
    else if (data) {
      setWorkflowSteps((prev) => [...prev, data as TemplateStep].sort((a, b) => a.sequence_order - b.sequence_order))
      setNewStepName('')
    }
  }

  async function deleteWorkflowStep(stepId: string) {
    if (!confirm('Remove this step from the template?')) return
    setDeletingStepId(stepId)
    setError(null)
    const { error: err } = await supabase.from('workflow_template_steps').delete().eq('id', stepId)
    if (err) setError(err.message)
    else setWorkflowSteps((prev) => prev.filter((s) => s.id !== stepId))
    setDeletingStepId(null)
  }

  function startEditStep(step: TemplateStep) {
    setEditingStepId(step.id)
    setEditingStepName(step.name)
    setError(null)
  }

  function cancelEditStep() {
    setEditingStepId(null)
    setEditingStepName('')
  }

  async function saveEditStep(stepId: string) {
    if (!editingStepName.trim()) {
      setError('Step name cannot be empty')
      return
    }
    setUpdatingStepId(stepId)
    setError(null)
    const { error: err } = await supabase.from('workflow_template_steps').update({ name: editingStepName.trim() }).eq('id', stepId)
    if (err) setError(err.message)
    else {
      setWorkflowSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, name: editingStepName.trim() } : s)))
      cancelEditStep()
    }
    setUpdatingStepId(null)
  }

  if (loading) return <p>Loading...</p>
  if (error && !myRole) return <p style={{ color: '#b91c1c' }}>{error}</p>
  if (myRole !== 'owner')
    return <p style={{ marginBottom: '1.5rem' }}>Only owners can edit templates.</p>

  return (
    <div>
      <h1 style={{ marginBottom: '1rem' }}>Templates</h1>
      <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
        Workflow templates are used when creating project workflows from a template. Only owners can add, edit, and delete templates.
      </p>
      <div style={{ marginBottom: '1rem' }}>
        <button type="button" onClick={openAdd} style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6 }}>
          Add template
        </button>
      </div>
      {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
      {templates.length === 0 ? (
        <p>No templates yet. Add one to use when creating workflows from a template.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {templates.map((t) => (
            <li
              key={t.id}
              style={{
                padding: '0.75rem 0',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 500 }}>{t.name}</div>
                {t.description && <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 2 }}>{t.description}</div>}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => openWorkflow(t)} style={{ padding: '4px 8px', fontSize: '0.875rem' }}>
                  Edit workflow
                </button>
                <button type="button" onClick={() => openEdit(t)} style={{ padding: '4px 8px', fontSize: '0.875rem' }}>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteTemplate(t.id)}
                  disabled={deletingId === t.id}
                  style={{ padding: '4px 8px', fontSize: '0.875rem', color: '#b91c1c' }}
                >
                  {deletingId === t.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {formOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>{editingId ? 'Edit template' : 'Add template'}</h2>
            <form onSubmit={handleSave}>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="tpl-name" style={{ display: 'block', marginBottom: 4 }}>Name *</label>
                <input
                  id="tpl-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={saving}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="tpl-desc" style={{ display: 'block', marginBottom: 4 }}>Description (optional)</label>
                <textarea
                  id="tpl-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={saving}
                  rows={3}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button type="button" onClick={closeForm} disabled={saving}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {workflowModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 360, maxWidth: 480, maxHeight: '80vh', overflow: 'auto' }}>
            <h2 style={{ marginTop: 0 }}>Workflow: {workflowModal.templateName}</h2>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>These steps are copied when a project uses &quot;Add workflow from template&quot; on the New project form.</p>
            <form onSubmit={addWorkflowStep} style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={newStepName}
                onChange={(e) => setNewStepName(e.target.value)}
                placeholder="Step name"
                disabled={addingStep}
                style={{ flex: 1, padding: '0.5rem' }}
              />
              <button type="submit" disabled={addingStep || !newStepName.trim()}>{addingStep ? 'Adding...' : 'Add step'}</button>
            </form>
            {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
            {workflowStepsLoading ? (
              <p>Loading steps...</p>
            ) : workflowSteps.length === 0 ? (
              <p style={{ color: '#6b7280' }}>No steps yet. Add steps above.</p>
            ) : (
              <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
                {workflowSteps.map((s) => (
                  <li key={s.id} style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    {editingStepId === s.id ? (
                      <>
                        <input
                          type="text"
                          value={editingStepName}
                          onChange={(e) => setEditingStepName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEditStep(s.id)
                            if (e.key === 'Escape') cancelEditStep()
                          }}
                          disabled={updatingStepId === s.id}
                          style={{ flex: 1, padding: '0.35rem', fontSize: '0.875rem' }}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => saveEditStep(s.id)}
                          disabled={updatingStepId === s.id || !editingStepName.trim()}
                          style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                        >
                          {updatingStepId === s.id ? '...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditStep}
                          disabled={updatingStepId === s.id}
                          style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <span>{s.name}</span>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button
                            type="button"
                            onClick={() => startEditStep(s)}
                            style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteWorkflowStep(s.id)}
                            disabled={deletingStepId === s.id}
                            style={{ padding: '2px 6px', fontSize: '0.75rem', color: '#b91c1c' }}
                          >
                            {deletingStepId === s.id ? '...' : 'Remove'}
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ol>
            )}
            <div style={{ marginTop: '1rem' }}>
              <button type="button" onClick={closeWorkflow}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
