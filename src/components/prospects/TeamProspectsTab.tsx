import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCorners,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import {
  UNSORTED_ROLE_KEY,
  groupTeamProspects,
  moveTeamProspectAcrossRoles,
  nextTeamProspectRank,
  reorderActiveTeamProspects,
  roleKeyOf,
  type TeamProspectRankUpdate,
} from '../../lib/teamProspectRanking'
import { distinctTeamProspectSources, summarizeTeamProspectSources } from '../../lib/teamProspectSourceSummary'

export type TeamProspect = {
  id: string
  master_user_id: string
  created_by: string
  name: string
  phone_number: string | null
  email: string | null
  trade: string | null
  source: string | null
  notes: string | null
  status: string
  rank_order: number
  role_id: string | null
  last_contact: string | null
  created_at: string | null
  updated_at: string | null
}

export type TeamProspectRole = {
  id: string
  name: string
  position: number
  created_at: string | null
}

type Props = {
  authUserId: string
  resolveMasterId: () => Promise<string | null>
}

type CandidateDraft = {
  name: string
  phone_number: string
  email: string
  trade: string
  source: string
  notes: string
  role_id: string // '' = Unsorted
}

const EMPTY_DRAFT: CandidateDraft = { name: '', phone_number: '', email: '', trade: '', source: '', notes: '', role_id: '' }

const inputStyle = { width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 } as const
const labelSpanStyle = { display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' } as const
const smallButtonStyle = (busy: boolean) => ({
  padding: '0.25rem 0.5rem',
  fontSize: '0.75rem',
  background: 'none',
  color: 'var(--text-muted)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  cursor: busy ? 'not-allowed' : 'pointer',
}) as const

function dropId(roleKey: string): string {
  return `drop:${roleKey}`
}

/** Kanban boards: `closestCorners` alone keeps favoring the source column; prefer pointer placement first. */
const boardCollisionDetection: CollisionDetection = (args) => {
  const pointer = pointerWithin(args)
  if (pointer.length > 0) return pointer
  const rect = rectIntersection(args)
  if (rect.length > 0) return rect
  return closestCorners(args)
}

function formatLastContact(iso: string | null): string {
  if (!iso) return 'Never contacted'
  const diffDays = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays === 0) return 'Contacted today'
  if (diffDays === 1) return 'Contacted 1 day ago'
  return `Contacted ${diffDays} days ago`
}

function CandidateFields({
  draft,
  setDraft,
  roles,
  knownSources,
}: {
  draft: CandidateDraft
  setDraft: (d: CandidateDraft) => void
  roles: TeamProspectRole[]
  knownSources: string[]
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <label>
        <span style={labelSpanStyle}>Name *</span>
        <input type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={inputStyle} />
      </label>
      <label>
        <span style={labelSpanStyle}>Role column</span>
        <select value={draft.role_id} onChange={(e) => setDraft({ ...draft, role_id: e.target.value })} style={inputStyle}>
          <option value="">Unsorted</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </label>
      <label>
        <span style={labelSpanStyle}>Phone Number</span>
        <input type="text" value={draft.phone_number} onChange={(e) => setDraft({ ...draft, phone_number: e.target.value })} style={inputStyle} />
      </label>
      <label>
        <span style={labelSpanStyle}>Email</span>
        <input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} style={inputStyle} />
      </label>
      <label>
        <span style={labelSpanStyle}>Trade (plumber, apprentice, office…)</span>
        <input type="text" value={draft.trade} onChange={(e) => setDraft({ ...draft, trade: e.target.value })} style={inputStyle} />
      </label>
      <label>
        <span style={labelSpanStyle}>Source (referral, job board, walk-in…)</span>
        {/* Reuse existing spellings so the Source success stats don't fragment */}
        <input type="text" list="team-prospect-source-options" value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} style={inputStyle} />
        <datalist id="team-prospect-source-options">
          {knownSources.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </label>
      <label>
        <span style={labelSpanStyle}>Notes</span>
        <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
      </label>
    </div>
  )
}

/** One draggable candidate card in a role column. */
function SortableCandidateCard({
  candidate,
  rank,
  busy,
  onEdit,
  onMarkContacted,
  onSetStatus,
}: {
  candidate: TeamProspect
  rank: number
  busy: boolean
  onEdit: () => void
  onMarkContacted: () => void
  onSetStatus: (status: 'hired' | 'passed') => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: candidate.id })
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        padding: '0.5rem 0.6rem',
        background: 'var(--surface)',
        borderRadius: 8,
        border: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          title="Drag to re-rank or move to another role"
          aria-label="Drag to re-rank or move to another role"
          style={{ cursor: 'grab', background: 'none', border: 'none', color: 'var(--text-faint)', padding: 0, fontSize: '1rem', touchAction: 'none' }}
        >
          ⠿
        </button>
        <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>#{rank}</span>
        <span style={{ fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere' }}>{candidate.name}</span>
        {candidate.trade && (
          <span style={{ fontSize: '0.7rem', padding: '0.05rem 0.4rem', borderRadius: 999, background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {candidate.trade}
          </span>
        )}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '0.25rem 0 0 1.35rem' }}>
        {candidate.phone_number && <span>{candidate.phone_number}</span>}
        {candidate.email && <span style={{ overflowWrap: 'anywhere' }}>{candidate.email}</span>}
        {candidate.source && <span>via {candidate.source}</span>}
        <span>{formatLastContact(candidate.last_contact)}</span>
      </div>
      {candidate.notes && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 1.35rem', whiteSpace: 'pre-wrap' }}>{candidate.notes}</div>
      )}
      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', margin: '0.4rem 0 0 1.35rem' }}>
        <button type="button" disabled={busy} onClick={onMarkContacted} title="Stamp last contact as now" style={smallButtonStyle(busy)}>
          Talked today
        </button>
        <button type="button" disabled={busy} onClick={onEdit} style={smallButtonStyle(busy)}>
          Edit
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onSetStatus('hired')}
          style={{ ...smallButtonStyle(busy), background: '#16a34a', color: 'white', border: 'none' }}
        >
          Hired
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onSetStatus('passed')}
          style={{ ...smallButtonStyle(busy), color: 'var(--text-red-600)' }}
        >
          Passed
        </button>
      </div>
    </li>
  )
}

/** One role column: droppable header + sortable card list + per-column Add. */
function RoleColumn({
  roleKey,
  title,
  candidates,
  referencedCount,
  busy,
  confirmingDeleteRole,
  onRequestDeleteRole,
  onConfirmDeleteRole,
  onCancelDeleteRole,
  onAddCandidate,
  renderCard,
}: {
  roleKey: string
  title: string
  candidates: TeamProspect[]
  /** Rows of ANY status referencing this role — a real role is deletable only at zero. Null for the virtual Unsorted column. */
  referencedCount: number | null
  busy: boolean
  confirmingDeleteRole: boolean
  onRequestDeleteRole: () => void
  onConfirmDeleteRole: () => void
  onCancelDeleteRole: () => void
  onAddCandidate: () => void
  renderCard: (candidate: TeamProspect, rank: number) => ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId(roleKey) })
  const isRealRole = referencedCount !== null
  const deletable = isRealRole && referencedCount === 0
  return (
    <section
      style={{
        flex: '0 0 300px',
        maxWidth: 300,
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: isOver ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.6rem', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontWeight: 700, fontSize: '0.9375rem', minWidth: 0, overflowWrap: 'anywhere' }}>{title}</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({candidates.length})</span>
        <span style={{ flex: 1 }} />
        {isRealRole && !confirmingDeleteRole && (
          <button
            type="button"
            disabled={busy || !deletable}
            onClick={onRequestDeleteRole}
            title={deletable ? 'Delete this role column' : `Delete every candidate in this role first (${referencedCount} still assigned, including Hired/Passed)`}
            aria-label={`Delete role ${title}`}
            style={{
              background: 'none',
              border: 'none',
              color: deletable ? 'var(--text-red-600)' : 'var(--text-faint)',
              cursor: busy || !deletable ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
              padding: '0 0.15rem',
            }}
          >
            ✕
          </button>
        )}
        {isRealRole && confirmingDeleteRole && (
          <span style={{ display: 'flex', gap: '0.3rem' }}>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirmDeleteRole}
              style={{ padding: '0.15rem 0.45rem', fontSize: '0.7rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' }}
            >
              Delete role
            </button>
            <button type="button" disabled={busy} onClick={onCancelDeleteRole} style={{ ...smallButtonStyle(busy), fontSize: '0.7rem' }}>
              Cancel
            </button>
          </span>
        )}
      </header>
      <div ref={setNodeRef} style={{ flex: 1, padding: '0.5rem', minHeight: 60 }}>
        <SortableContext items={candidates.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {candidates.map((c, i) => renderCard(c, i + 1))}
          </ul>
        </SortableContext>
        {candidates.length === 0 && (
          <p style={{ margin: 0, padding: '0.5rem 0.25rem', fontSize: '0.8125rem', color: 'var(--text-faint)' }}>
            {roleKey === UNSORTED_ROLE_KEY ? 'Nothing unsorted.' : 'No candidates yet — add one below or drag a card here.'}
          </p>
        )}
      </div>
      <footer style={{ padding: '0.5rem' }}>
        <button
          type="button"
          disabled={busy}
          onClick={onAddCandidate}
          style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.8125rem', background: 'none', color: 'var(--text-blue-500)', border: '1px dashed var(--border-strong)', borderRadius: 6, cursor: busy ? 'not-allowed' : 'pointer' }}
        >
          + Add candidate
        </button>
      </footer>
    </section>
  )
}

/** Prospects → Team: prospective hires on a board — one drag-ranked column per role being hired for. */
export default function TeamProspectsTab({ authUserId, resolveMasterId }: Props) {
  const { showToast } = useToastContext()
  const [rows, setRows] = useState<TeamProspect[]>([])
  const [roles, setRoles] = useState<TeamProspectRole[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [addDraft, setAddDraft] = useState<CandidateDraft>(EMPTY_DRAFT)
  const [editTarget, setEditTarget] = useState<TeamProspect | null>(null)
  const [editDraft, setEditDraft] = useState<CandidateDraft>(EMPTY_DRAFT)
  const [modalError, setModalError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const [addingRole, setAddingRole] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [confirmDeleteRoleId, setConfirmDeleteRoleId] = useState<string | null>(null)

  const [hiredOpen, setHiredOpen] = useState(false)
  const [passedOpen, setPassedOpen] = useState(false)
  const [sourcesOpen, setSourcesOpen] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const load = useCallback(async () => {
    const [candidatesRes, rolesRes] = await Promise.all([
      supabase.from('team_prospects').select('*').order('rank_order', { ascending: true }),
      supabase.from('team_prospect_roles').select('*').order('position', { ascending: true }).order('created_at', { ascending: true }),
    ])
    if (candidatesRes.error || rolesRes.error) {
      showToast(`Failed to load candidates: ${(candidatesRes.error ?? rolesRes.error)!.message}`, 'error')
    } else {
      setRows((candidatesRes.data ?? []) as TeamProspect[])
      setRoles((rolesRes.data ?? []) as TeamProspectRole[])
    }
    setLoading(false)
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  const { activeByRole, hired, passed } = groupTeamProspects(rows)
  const roleNameById = new Map(roles.map((r) => [r.id, r.name]))
  const referencedCountByRole = new Map<string, number>()
  for (const r of rows) {
    if (!r.role_id) continue
    referencedCountByRole.set(r.role_id, (referencedCountByRole.get(r.role_id) ?? 0) + 1)
  }
  const unsortedActive = activeByRole[UNSORTED_ROLE_KEY] ?? []
  const sourceSummary = summarizeTeamProspectSources(rows)
  const knownSources = distinctTeamProspectSources(rows)

  async function persistRankUpdates(updates: TeamProspectRankUpdate[]) {
    const results = await Promise.all(
      updates.map((u) => {
        const payload: { rank_order: number; role_id?: string | null } = { rank_order: u.rank_order }
        if ('role_id' in u) payload.role_id = u.role_id ?? null
        return supabase.from('team_prospects').update(payload).eq('id', u.id)
      }),
    )
    const failed = results.find((r) => r.error)
    if (failed?.error) {
      showToast(`Failed to save ranking: ${failed.error.message}`, 'error')
      await load()
    }
  }

  function applyListsToRows(lists: TeamProspect[][]) {
    const changed = new Map<string, TeamProspect>()
    for (const list of lists) for (const row of list) changed.set(row.id, row)
    setRows((prev) => prev.map((r) => changed.get(r.id) ?? r))
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active: dragged, over } = event
    if (!over) return
    const draggedId = String(dragged.id)
    const draggedRow = rows.find((r) => r.id === draggedId)
    if (!draggedRow || draggedRow.status === 'hired' || draggedRow.status === 'passed') return
    const sourceKey = roleKeyOf(draggedRow)

    const overStr = String(over.id)
    let destKey: string
    let overCandidateId: string | null = null
    if (overStr.startsWith('drop:')) {
      destKey = overStr.slice('drop:'.length)
    } else {
      overCandidateId = overStr
      const overRow = rows.find((r) => r.id === overStr)
      if (!overRow) return
      destKey = roleKeyOf(overRow)
    }

    const sourceList = activeByRole[sourceKey] ?? []
    if (sourceKey === destKey) {
      if (!overCandidateId || overCandidateId === draggedId) return
      const fromIndex = sourceList.findIndex((r) => r.id === draggedId)
      const toIndex = sourceList.findIndex((r) => r.id === overCandidateId)
      const { next, updates } = reorderActiveTeamProspects(sourceList, fromIndex, toIndex)
      if (updates.length === 0) return
      applyListsToRows([next])
      await persistRankUpdates(updates)
    } else {
      const destList = activeByRole[destKey] ?? []
      const destIndex = overCandidateId ? destList.findIndex((r) => r.id === overCandidateId) : destList.length
      const destRoleId = destKey === UNSORTED_ROLE_KEY ? null : destKey
      const { source, dest, updates } = moveTeamProspectAcrossRoles(
        sourceList,
        destList,
        draggedId,
        destIndex < 0 ? destList.length : destIndex,
        destRoleId,
      )
      if (updates.length === 0) return
      applyListsToRows([source, dest])
      await persistRankUpdates(updates)
    }
  }

  async function saveNewCandidate() {
    if (busy) return
    if (!addDraft.name.trim()) {
      setModalError('Name is required.')
      return
    }
    setBusy(true)
    setModalError(null)
    const masterId = await resolveMasterId()
    if (!masterId) {
      setModalError('Unable to determine owner.')
      setBusy(false)
      return
    }
    const roleId = addDraft.role_id || null
    const { error } = await supabase.from('team_prospects').insert({
      master_user_id: masterId,
      created_by: authUserId,
      name: addDraft.name.trim(),
      phone_number: addDraft.phone_number.trim() || null,
      email: addDraft.email.trim() || null,
      trade: addDraft.trade.trim() || null,
      source: addDraft.source.trim() || null,
      notes: addDraft.notes.trim() || null,
      status: 'active',
      role_id: roleId,
      rank_order: nextTeamProspectRank(rows, roleId),
    })
    setBusy(false)
    if (error) {
      setModalError(error.message)
      return
    }
    setAddOpen(false)
    setAddDraft(EMPTY_DRAFT)
    await load()
  }

  async function saveEdit() {
    if (!editTarget || busy) return
    if (!editDraft.name.trim()) {
      setModalError('Name is required.')
      return
    }
    setBusy(true)
    setModalError(null)
    const newRoleId = editDraft.role_id || null
    const roleChanged = newRoleId !== (editTarget.role_id ?? null)
    const payload: Record<string, string | number | null> = {
      name: editDraft.name.trim(),
      phone_number: editDraft.phone_number.trim() || null,
      email: editDraft.email.trim() || null,
      trade: editDraft.trade.trim() || null,
      source: editDraft.source.trim() || null,
      notes: editDraft.notes.trim() || null,
    }
    if (roleChanged) {
      // Moving via the modal appends to the bottom of the target column
      payload.role_id = newRoleId
      payload.rank_order = nextTeamProspectRank(rows, newRoleId)
    }
    const { error } = await supabase.from('team_prospects').update(payload).eq('id', editTarget.id)
    setBusy(false)
    if (error) {
      setModalError(error.message)
      return
    }
    setEditTarget(null)
    await load()
  }

  async function deleteCandidate() {
    if (!editTarget || busy) return
    setBusy(true)
    const { error } = await supabase.from('team_prospects').delete().eq('id', editTarget.id)
    setBusy(false)
    if (error) {
      setModalError(error.message)
      return
    }
    setEditTarget(null)
    await load()
  }

  async function setStatus(candidate: TeamProspect, status: 'active' | 'hired' | 'passed') {
    if (busy) return
    setBusy(true)
    const payload: { status: string; rank_order?: number } = { status }
    if (status === 'active') payload.rank_order = nextTeamProspectRank(rows, candidate.role_id)
    const { error } = await supabase.from('team_prospects').update(payload).eq('id', candidate.id)
    setBusy(false)
    if (error) {
      showToast(`Failed to update: ${error.message}`, 'error')
      return
    }
    await load()
  }

  async function markContacted(candidate: TeamProspect) {
    if (busy) return
    setBusy(true)
    const { error } = await supabase
      .from('team_prospects')
      .update({ last_contact: new Date().toISOString() })
      .eq('id', candidate.id)
    setBusy(false)
    if (error) {
      showToast(`Failed to update: ${error.message}`, 'error')
      return
    }
    await load()
  }

  async function addRole() {
    const name = newRoleName.trim()
    if (!name || busy) return
    setBusy(true)
    const masterId = await resolveMasterId()
    if (!masterId) {
      showToast('Unable to determine owner.', 'error')
      setBusy(false)
      return
    }
    const maxPosition = roles.reduce((m, r) => Math.max(m, r.position), 0)
    const { error } = await supabase.from('team_prospect_roles').insert({
      master_user_id: masterId,
      created_by: authUserId,
      name,
      position: maxPosition + 1,
    })
    setBusy(false)
    if (error) {
      showToast(`Failed to add role: ${error.message}`, 'error')
      return
    }
    setNewRoleName('')
    setAddingRole(false)
    await load()
  }

  async function deleteRole(roleId: string) {
    if (busy) return
    setBusy(true)
    const { error } = await supabase.from('team_prospect_roles').delete().eq('id', roleId)
    setBusy(false)
    setConfirmDeleteRoleId(null)
    if (error) {
      // FK RESTRICT backstop — the UI already disables delete while candidates reference the role
      const friendly = (error as { code?: string }).code === '23503'
        ? 'This role still has candidates (including Hired/Passed). Delete each of them first.'
        : error.message
      showToast(`Failed to delete role: ${friendly}`, 'error')
      return
    }
    await load()
  }

  function openEdit(candidate: TeamProspect) {
    setEditTarget(candidate)
    setEditDraft({
      name: candidate.name,
      phone_number: candidate.phone_number ?? '',
      email: candidate.email ?? '',
      trade: candidate.trade ?? '',
      source: candidate.source ?? '',
      notes: candidate.notes ?? '',
      role_id: candidate.role_id ?? '',
    })
    setModalError(null)
    setConfirmingDelete(false)
  }

  function openAdd(roleId: string | null) {
    setAddDraft({ ...EMPTY_DRAFT, role_id: roleId ?? '' })
    setModalError(null)
    setAddOpen(true)
  }

  const modal = (title: string, body: ReactNode, onClose: () => void) => (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onClick={() => !busy && onClose()}
    >
      <div
        style={{ background: 'var(--surface)', borderRadius: 8, padding: '1.5rem', maxWidth: 420, width: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 1rem 0' }}>{title}</h3>
        {modalError && <p style={{ color: 'var(--text-red-600)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{modalError}</p>}
        {body}
      </div>
    </div>
  )

  const bucketSection = (
    label: string,
    list: TeamProspect[],
    open: boolean,
    setOpen: (v: boolean) => void,
  ) => (
    <section style={{ marginTop: '1rem' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.9375rem', padding: 0 }}
      >
        {open ? '▾' : '▸'} {label} ({list.length})
      </button>
      {open && (
        <ul style={{ listStyle: 'none', margin: '0.5rem 0 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {list.map((c) => (
            <li key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0.75rem', background: 'var(--bg-subtle)', borderRadius: 6, border: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600 }}>{c.name}</span>
              {c.role_id && roleNameById.has(c.role_id) && (
                <span style={{ fontSize: '0.7rem', padding: '0.05rem 0.4rem', borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  {roleNameById.get(c.role_id)}
                </span>
              )}
              {c.trade && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.trade}</span>}
              <span style={{ flex: 1 }} />
              <button type="button" disabled={busy} onClick={() => openEdit(c)} style={smallButtonStyle(busy)}>
                Edit
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setStatus(c, 'active')}
                style={{ ...smallButtonStyle(busy), color: 'var(--text-blue-500)' }}
              >
                Back to active
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )

  const renderCard = (c: TeamProspect, rank: number) => (
    <SortableCandidateCard
      key={c.id}
      candidate={c}
      rank={rank}
      busy={busy}
      onEdit={() => openEdit(c)}
      onMarkContacted={() => markContacted(c)}
      onSetStatus={(s) => setStatus(c, s)}
    />
  )

  const boardEmpty = roles.length === 0 && rows.length === 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          One column per role you&apos;re hiring for — drag cards to re-rank (#1 is the top candidate) or to move between roles.
        </p>
        {addingRole ? (
          <span style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input
              type="text"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRole() } }}
              placeholder="Role name (e.g. Plumber)"
              autoFocus
              style={{ padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
            />
            <button
              type="button"
              disabled={busy || !newRoleName.trim()}
              onClick={addRole}
              style={{ padding: '0.45rem 0.8rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: busy || !newRoleName.trim() ? 'not-allowed' : 'pointer' }}
            >
              Add
            </button>
            <button type="button" disabled={busy} onClick={() => { setAddingRole(false); setNewRoleName('') }} style={smallButtonStyle(busy)}>
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setAddingRole(true)}
            style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
          >
            + Add role
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : boardEmpty ? (
        <p style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No roles yet. Add a column for each role you&apos;re hiring for, then add candidates to it.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={boardCollisionDetection} onDragEnd={handleDragEnd}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'stretch', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            {roles.map((role) => (
              <RoleColumn
                key={role.id}
                roleKey={role.id}
                title={role.name}
                candidates={activeByRole[role.id] ?? []}
                referencedCount={referencedCountByRole.get(role.id) ?? 0}
                busy={busy}
                confirmingDeleteRole={confirmDeleteRoleId === role.id}
                onRequestDeleteRole={() => setConfirmDeleteRoleId(role.id)}
                onConfirmDeleteRole={() => deleteRole(role.id)}
                onCancelDeleteRole={() => setConfirmDeleteRoleId(null)}
                onAddCandidate={() => openAdd(role.id)}
                renderCard={renderCard}
              />
            ))}
            {unsortedActive.length > 0 && (
              <RoleColumn
                roleKey={UNSORTED_ROLE_KEY}
                title="Unsorted"
                candidates={unsortedActive}
                referencedCount={null}
                busy={busy}
                confirmingDeleteRole={false}
                onRequestDeleteRole={() => {}}
                onConfirmDeleteRole={() => {}}
                onCancelDeleteRole={() => {}}
                onAddCandidate={() => openAdd(null)}
                renderCard={renderCard}
              />
            )}
          </div>
        </DndContext>
      )}

      {!loading && hired.length > 0 && bucketSection('Hired', hired, hiredOpen, setHiredOpen)}
      {!loading && passed.length > 0 && bucketSection('Passed', passed, passedOpen, setPassedOpen)}

      {!loading && sourceSummary.length > 0 && (
        <section style={{ marginTop: '1rem' }}>
          <button
            type="button"
            onClick={() => setSourcesOpen(!sourcesOpen)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.9375rem', padding: 0 }}
          >
            {sourcesOpen ? '▾' : '▸'} Source success ({sourceSummary.length})
          </button>
          {sourcesOpen && (
            <div style={{ marginTop: '0.5rem', border: '1px solid var(--border)', borderRadius: 8, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>Source</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>Candidates</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>Active</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>Hired</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>Passed</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }} title="Hired ÷ (Hired + Passed) — undecided candidates don't count against a source">
                      Hire rate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sourceSummary.map((s) => (
                    <tr key={s.key} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{s.label}</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.total}</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>{s.active}</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: s.hired > 0 ? '#16a34a' : undefined, fontWeight: s.hired > 0 ? 600 : undefined }}>{s.hired}</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>{s.passed}</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {s.hireRate === null ? '—' : `${Math.round(s.hireRate * 100)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {addOpen &&
        modal(
          'Add candidate',
          <>
            <CandidateFields draft={addDraft} setDraft={setAddDraft} roles={roles} knownSources={knownSources} />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={saveNewCandidate}
                disabled={busy}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' }}
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                disabled={busy}
                style={{ padding: '0.5rem 1rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </>,
          () => setAddOpen(false),
        )}

      {editTarget &&
        modal(
          'Edit candidate',
          <>
            <CandidateFields draft={editDraft} setDraft={setEditDraft} roles={roles} knownSources={knownSources} />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={saveEdit}
                disabled={busy}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' }}
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                disabled={busy}
                style={{ padding: '0.5rem 1rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <span style={{ flex: 1 }} />
              {confirmingDelete ? (
                <button
                  type="button"
                  onClick={deleteCandidate}
                  disabled={busy}
                  style={{ padding: '0.5rem 1rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' }}
                >
                  Confirm delete
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={busy}
                  style={{ padding: '0.5rem 1rem', background: 'none', color: 'var(--text-red-600)', border: '1px solid var(--border)', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' }}
                >
                  Delete
                </button>
              )}
            </div>
          </>,
          () => setEditTarget(null),
        )}
    </div>
  )
}
