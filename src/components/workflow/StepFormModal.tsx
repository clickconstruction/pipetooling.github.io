import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { Database } from '../../types/database'

type Step = Database['public']['Tables']['project_workflow_steps']['Row']

/**
 * Add/Edit step modal for the Workflow page, with the assignee autocomplete
 * (masters + subs from users/people, superintendents scoped via adopted
 * masters) and the nested Add Person sub-modal. Verbatim move out of
 * src/pages/Workflow.tsx per docs/WORKFLOW_PAGE_ARCHITECTURE.md — preserve
 * quirks: the non-interactive first "change order:" chip, checkDuplicateName
 * scanning the whole people+users tables client-side, new people defaulting
 * to kind 'sub' ('helper' when the viewer is helpers), and the 200ms
 * dropdown blur timeout.
 */
export function StepFormModal({
  viewerRole,
  step,
  dependsOnStepId,
  insertAfterStepId,
  steps,
  onSave,
  onClose,
  onCopy,
  toDatetimeLocal,
  fromDatetimeLocal,
}: {
  viewerRole: 'dev' | 'master_technician' | 'assistant' | 'subcontractor' | 'helpers' | 'superintendent' | null
  step: Step | null
  dependsOnStepId: string | null
  insertAfterStepId: string | null
  steps: Step[]
  onSave: (p: { name: string; assigned_to_name: string; started_at: string | null; ended_at: string | null; depends_on_step_id?: string | null; insertAfterStepId?: string | null }) => void
  onClose: () => void
  onCopy?: () => void
  toDatetimeLocal: (iso: string | null) => string
  fromDatetimeLocal: (v: string) => string | null
}) {
  const { user: authUser } = useAuth()
  const [name, setName] = useState(step?.name ?? '')
  const [assigned_to_name, setAssignedToName] = useState(step?.assigned_to_name ?? '')
  const [started_at, setStartedAt] = useState(toDatetimeLocal(step?.started_at ?? null))
  const [ended_at, setEndedAt] = useState(toDatetimeLocal(step?.ended_at ?? null))
  const [depends_on_step_id, setDependsOnStepId] = useState(dependsOnStepId ?? '')
  const [insert_after_step_id, setInsertAfterStepId] = useState(insertAfterStepId ?? '')

  // Autocomplete state
  const [mastersAndSubs, setMastersAndSubs] = useState<Array<{name: string, source: 'user' | 'people'}>>([])
  const [assignedSearch, setAssignedSearch] = useState(step?.assigned_to_name ?? '')
  const [filteredMastersSubs, setFilteredMastersSubs] = useState<Array<{name: string, source: 'user' | 'people'}>>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [showAddPerson, setShowAddPerson] = useState(false)
  const [newPerson, setNewPerson] = useState({name: '', email: '', phone: '', notes: ''})
  const [savingPerson, setSavingPerson] = useState(false)
  const [addPersonError, setAddPersonError] = useState<string | null>(null)

  // Load masters and subs when modal opens
  useEffect(() => {
    loadMastersAndSubs()
    // Initialize search with existing assigned_to_name
    if (step?.assigned_to_name) {
      setAssignedSearch(step.assigned_to_name)
      setAssignedToName(step.assigned_to_name)
    } else {
      setAssignedSearch('')
      setAssignedToName('')
    }
  }, [step, authUser?.id])

  async function loadMastersAndSubs() {
    if (!authUser?.id) return

    const { data: me } = await supabase.from('users').select('role').eq('id', authUser.id).single()
    const role = (me as { role: string } | null)?.role

    let usersRes: { data: Array<{ name: string | null; role: string }> | null }
    let peopleRes: { data: Array<{ name: string; kind: string }> | null }

    if (role === 'superintendent') {
      const { data: adopted } = await supabase
        .from('master_superintendents')
        .select('master_id')
        .eq('superintendent_id', authUser.id)
      const adoptedMasterIds = (adopted ?? []).map((r) => r.master_id)
      ;[usersRes, peopleRes] = await Promise.all([
        supabase.from('users').select('name, role').in('role', ['master_technician', 'subcontractor', 'helpers', 'primary']),
        adoptedMasterIds.length > 0
          ? supabase.from('people').select('name, kind').is('archived_at', null).in('master_user_id', adoptedMasterIds).in('kind', ['master_technician', 'sub', 'helper'])
          : { data: [] as Array<{ name: string; kind: string }> },
      ])
    } else {
      ;[usersRes, peopleRes] = await Promise.all([
        supabase.from('users').select('name, role').in('role', ['master_technician', 'subcontractor', 'helpers', 'primary']),
        supabase.from('people').select('name, kind').is('archived_at', null).eq('master_user_id', authUser.id).in('kind', ['master_technician', 'sub', 'helper']),
      ])
    }

    const fromUsers = ((usersRes.data as Array<{name: string | null, role: string}> | null) ?? [])
      .filter((u): u is {name: string, role: string} => !!u.name)
      .map(u => ({ name: u.name, source: 'user' as const }))

    const fromPeople = ((peopleRes.data as Array<{name: string, kind: string}> | null) ?? [])
      .map(p => ({ name: p.name, source: 'people' as const }))

    // Combine and deduplicate by name (case-insensitive)
    const nameMap = new Map<string, {name: string, source: 'user' | 'people'}>()
    const allPeople: Array<{name: string, source: 'user' | 'people'}> = [...fromUsers, ...fromPeople]
    for (const item of allPeople) {
      const key = item.name.toLowerCase()
      if (!nameMap.has(key)) {
        nameMap.set(key, item)
      }
    }

    const combined = Array.from(nameMap.values()).sort((a, b) => a.name.localeCompare(b.name))
    setMastersAndSubs(combined)
  }

  function handleAssignedSearchChange(value: string) {
    setAssignedSearch(value)
    setAssignedToName(value)

    if (!value.trim()) {
      setShowDropdown(false)
      setFilteredMastersSubs([])
      return
    }

    const searchLower = value.toLowerCase()
    const filtered = mastersAndSubs.filter(item =>
      item.name.toLowerCase().includes(searchLower)
    )

    setFilteredMastersSubs(filtered)
    setShowDropdown(true)
  }

  function handleSelectPerson(personName: string) {
    setAssignedSearch(personName)
    setAssignedToName(personName)
    setShowDropdown(false)
  }

  function handleAddNewPersonClick() {
    const trimmedName = assignedSearch.trim()
    if (!trimmedName) return
    setNewPerson({
      name: trimmedName,
      email: '',
      phone: '',
      notes: ''
    })
    setShowAddPerson(true)
    setShowDropdown(false)
  }

  async function checkDuplicateName(nameToCheck: string): Promise<boolean> {
    const trimmedName = nameToCheck.trim().toLowerCase()
    if (!trimmedName) return false

    const [peopleRes, usersRes] = await Promise.all([
      supabase.from('people').select('id, name').is('archived_at', null),
      supabase.from('users').select('id, name')
    ])

    const hasDuplicateInPeople = peopleRes.data?.some(p => p.name?.toLowerCase() === trimmedName) ?? false
    const hasDuplicateInUsers = usersRes.data?.some(u => u.name?.toLowerCase() === trimmedName) ?? false

    return hasDuplicateInPeople || hasDuplicateInUsers
  }

  async function handleSaveNewPerson(e: React.FormEvent) {
    e.preventDefault()
    if (!authUser?.id) return

    setSavingPerson(true)
    setAddPersonError(null)

    const trimmedName = newPerson.name.trim()
    if (!trimmedName) {
      setAddPersonError('Name is required')
      setSavingPerson(false)
      return
    }

    // Check for duplicate names
    const isDuplicate = await checkDuplicateName(trimmedName)
    if (isDuplicate) {
      setAddPersonError(`A person or user with the name "${trimmedName}" already exists. Names must be unique.`)
      setSavingPerson(false)
      return
    }

    const offRosterKind: 'sub' | 'helper' = viewerRole === 'helpers' ? 'helper' : 'sub'
    // Create new person (default to helper/sub for helpers/subcontractor field users)
    const { error: err } = await supabase
      .from('people')
      .insert({
        master_user_id: authUser.id,
        kind: offRosterKind,
        name: trimmedName,
        email: newPerson.email.trim() || null,
        phone: newPerson.phone.trim() || null,
        notes: newPerson.notes.trim() || null,
      })
      .select('name')
      .single()

    if (err) {
      setAddPersonError(err.message)
      setSavingPerson(false)
      return
    }

    // Refresh masters/subs list
    await loadMastersAndSubs()

    // Set the assigned name to the new person
    setAssignedToName(trimmedName)
    setAssignedSearch(trimmedName)

    // Close modal and reset form
    setShowAddPerson(false)
    setNewPerson({name: '', email: '', phone: '', notes: ''})
    setSavingPerson(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      name,
      assigned_to_name,
      started_at: fromDatetimeLocal(started_at),
      ended_at: fromDatetimeLocal(ended_at),
      ...(step ? { depends_on_step_id: depends_on_step_id || null } : {}),
      ...(!step ? { insertAfterStepId: insert_after_step_id || null } : {}),
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
      <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 360 }}>
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
              <button type="button" className="wf-btn-secondary" style={{ whiteSpace: 'nowrap' }}>
                change order:
              </button>
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
                  onClick={() => setName((prev: string | undefined) => (prev ? `${prev}, ${phrase}` : phrase))}
                  className="wf-btn-secondary"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {phrase}
                </button>
              ))}
            </div>
          </div>
          {!step && steps.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="step-insert-after" style={{ display: 'block', marginBottom: 4 }}>Add after step</label>
              <select
                id="step-insert-after"
                value={insert_after_step_id}
                onChange={(e) => setInsertAfterStepId(e.target.value)}
                style={{ width: '100%', padding: '0.5rem' }}
              >
                <option value="">Add at the end</option>
                <option value="__beginning__">Add at the beginning</option>
                {steps.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          <div style={{ marginBottom: '1rem', position: 'relative' }}>
            <label htmlFor="step-person" style={{ display: 'block', marginBottom: 4 }}>Assigned to</label>
            <input
              id="step-person"
              type="text"
              value={assignedSearch}
              onChange={(e) => handleAssignedSearchChange(e.target.value)}
              onFocus={() => {
                if (assignedSearch.trim()) {
                  handleAssignedSearchChange(assignedSearch)
                }
              }}
              onBlur={() => {
                // Delay hiding dropdown to allow clicks
                setTimeout(() => setShowDropdown(false), 200)
              }}
              placeholder="Search masters and subs..."
              style={{ width: '100%', padding: '0.5rem' }}
            />
            {showDropdown && (filteredMastersSubs.length > 0 || assignedSearch.trim()) && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  marginTop: '2px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  zIndex: 20,
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}
              >
                {filteredMastersSubs.map((item, idx) => (
                  <button
                    key={`${item.name}-${idx}`}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleSelectPerson(item.name)
                    }}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      textAlign: 'left',
                      background: 'var(--surface)',
                      border: 'none',
                      borderBottom: idx < filteredMastersSubs.length - 1 ? '1px solid var(--border)' : 'none',
                      cursor: 'pointer',
                      color: 'var(--text-strong)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-subtle)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--surface)'
                    }}
                  >
                    {item.name}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                      ({item.source === 'user' ? 'user' : 'not user'})
                    </span>
                  </button>
                ))}
                {filteredMastersSubs.length === 0 && assignedSearch.trim() && (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleAddNewPersonClick()
                    }}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      textAlign: 'left',
                      background: 'var(--bg-blue-tint)',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-link)',
                      fontWeight: 500
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#dbeafe'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#eff6ff'
                    }}
                  >
                    Add &quot;{assignedSearch.trim()}&quot;
                  </button>
                )}
              </div>
            )}
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
            <button type="submit" className="wf-btn-modal-primary">Save</button>
            {onCopy && (
              <button type="button" onClick={onCopy} className="wf-btn-modal-primary">
                Copy
              </button>
            )}
            <button type="button" onClick={onClose} className="wf-btn-modal-secondary">Cancel</button>
          </div>
        </form>
      </div>

      {showAddPerson && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h3 style={{ marginTop: 0 }}>Add Person</h3>
            {addPersonError && (
              <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem', fontSize: '0.875rem' }}>{addPersonError}</p>
            )}
            <form onSubmit={handleSaveNewPerson}>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="new-person-name" style={{ display: 'block', marginBottom: 4 }}>Name *</label>
                <input
                  id="new-person-name"
                  type="text"
                  value={newPerson.name}
                  onChange={(e) => setNewPerson((p) => ({ ...p, name: e.target.value }))}
                  required
                  disabled={savingPerson}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="new-person-email" style={{ display: 'block', marginBottom: 4 }}>Email</label>
                <input
                  id="new-person-email"
                  type="email"
                  value={newPerson.email}
                  onChange={(e) => setNewPerson((p) => ({ ...p, email: e.target.value }))}
                  disabled={savingPerson}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="new-person-phone" style={{ display: 'block', marginBottom: 4 }}>Phone</label>
                <input
                  id="new-person-phone"
                  type="tel"
                  value={newPerson.phone}
                  onChange={(e) => setNewPerson((p) => ({ ...p, phone: e.target.value }))}
                  disabled={savingPerson}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="new-person-notes" style={{ display: 'block', marginBottom: 4 }}>Notes</label>
                <textarea
                  id="new-person-notes"
                  value={newPerson.notes}
                  onChange={(e) => setNewPerson((p) => ({ ...p, notes: e.target.value }))}
                  disabled={savingPerson}
                  rows={2}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={savingPerson} className="wf-btn-modal-primary">
                  {savingPerson ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddPerson(false)
                    setNewPerson({name: '', email: '', phone: '', notes: ''})
                    setAddPersonError(null)
                  }}
                  disabled={savingPerson}
                  className="wf-btn-modal-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
