import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import {
  groupTeamProspects,
  nextTeamProspectRank,
  reorderActiveTeamProspects,
} from '../../lib/teamProspectRanking'

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
  last_contact: string | null
  created_at: string | null
  updated_at: string | null
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
}

const EMPTY_DRAFT: CandidateDraft = { name: '', phone_number: '', email: '', trade: '', source: '', notes: '' }

const inputStyle = { width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 } as const
const labelSpanStyle = { display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' } as const

function formatLastContact(iso: string | null): string {
  if (!iso) return 'Never contacted'
  const diffDays = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays === 0) return 'Contacted today'
  if (diffDays === 1) return 'Contacted 1 day ago'
  return `Contacted ${diffDays} days ago`
}

function CandidateFields({ draft, setDraft }: { draft: CandidateDraft; setDraft: (d: CandidateDraft) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <label>
        <span style={labelSpanStyle}>Name *</span>
        <input type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={inputStyle} />
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
        <input type="text" value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} style={inputStyle} />
      </label>
      <label>
        <span style={labelSpanStyle}>Notes</span>
        <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
      </label>
    </div>
  )
}

/** One draggable candidate row in the ranked active list. */
function SortableCandidateRow({
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
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.6rem',
        padding: '0.6rem 0.75rem',
        background: 'var(--surface)',
        borderRadius: 8,
        border: '1px solid var(--border)',
      }}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        title="Drag to re-rank"
        aria-label="Drag to re-rank"
        style={{ cursor: 'grab', background: 'none', border: 'none', color: 'var(--text-faint)', padding: '0.15rem 0', fontSize: '1rem', touchAction: 'none' }}
      >
        ⠿
      </button>
      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: '1.6rem', paddingTop: '0.1rem' }}>#{rank}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600 }}>{candidate.name}</span>
          {candidate.trade && (
            <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.5rem', borderRadius: 999, background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              {candidate.trade}
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.15rem' }}>
          {candidate.phone_number && <span>{candidate.phone_number}</span>}
          {candidate.email && <span>{candidate.email}</span>}
          {candidate.source && <span>via {candidate.source}</span>}
          <span>{formatLastContact(candidate.last_contact)}</span>
        </div>
        {candidate.notes && (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>{candidate.notes}</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button
          type="button"
          disabled={busy}
          onClick={onMarkContacted}
          title="Stamp last contact as now"
          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' }}
        >
          Talked today
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onEdit}
          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' }}
        >
          Edit
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onSetStatus('hired')}
          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' }}
        >
          Hired
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onSetStatus('passed')}
          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: 'none', color: 'var(--text-red-600)', border: '1px solid var(--border)', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' }}
        >
          Passed
        </button>
      </div>
    </li>
  )
}

/** Prospects → Team: prospective hires, drag-ranked (#1 = top candidate). */
export default function TeamProspectsTab({ authUserId, resolveMasterId }: Props) {
  const { showToast } = useToastContext()
  const [rows, setRows] = useState<TeamProspect[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [addDraft, setAddDraft] = useState<CandidateDraft>(EMPTY_DRAFT)
  const [editTarget, setEditTarget] = useState<TeamProspect | null>(null)
  const [editDraft, setEditDraft] = useState<CandidateDraft>(EMPTY_DRAFT)
  const [modalError, setModalError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const [hiredOpen, setHiredOpen] = useState(false)
  const [passedOpen, setPassedOpen] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('team_prospects')
      .select('*')
      .order('rank_order', { ascending: true })
    if (error) {
      showToast(`Failed to load candidates: ${error.message}`, 'error')
    } else {
      setRows((data ?? []) as TeamProspect[])
    }
    setLoading(false)
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  const { active, hired, passed } = groupTeamProspects(rows)

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
      rank_order: nextTeamProspectRank(rows),
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
    const { error } = await supabase
      .from('team_prospects')
      .update({
        name: editDraft.name.trim(),
        phone_number: editDraft.phone_number.trim() || null,
        email: editDraft.email.trim() || null,
        trade: editDraft.trade.trim() || null,
        source: editDraft.source.trim() || null,
        notes: editDraft.notes.trim() || null,
      })
      .eq('id', editTarget.id)
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
    if (status === 'active') payload.rank_order = nextTeamProspectRank(rows)
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

  async function handleDragEnd(event: DragEndEvent) {
    const { active: dragged, over } = event
    if (!over || dragged.id === over.id) return
    const fromIndex = active.findIndex((r) => r.id === dragged.id)
    const toIndex = active.findIndex((r) => r.id === over.id)
    const { next, updates } = reorderActiveTeamProspects(active, fromIndex, toIndex)
    if (updates.length === 0) return
    // Optimistic: show the new order immediately, then persist only changed rows
    setRows([...next, ...hired, ...passed])
    const results = await Promise.all(
      updates.map((u) => supabase.from('team_prospects').update({ rank_order: u.rank_order }).eq('id', u.id)),
    )
    const failed = results.find((r) => r.error)
    if (failed?.error) {
      showToast(`Failed to save ranking: ${failed.error.message}`, 'error')
      await load()
    }
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
    })
    setModalError(null)
    setConfirmingDelete(false)
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
              {c.trade && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.trade}</span>}
              <span style={{ flex: 1 }} />
              <button
                type="button"
                disabled={busy}
                onClick={() => openEdit(c)}
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' }}
              >
                Edit
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setStatus(c, 'active')}
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'none', color: 'var(--text-blue-500)', border: '1px solid var(--border)', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' }}
              >
                Back to active
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Prospective hires, ranked — drag to re-order. #1 is the top candidate.
        </p>
        <button
          type="button"
          onClick={() => {
            setAddDraft(EMPTY_DRAFT)
            setModalError(null)
            setAddOpen(true)
          }}
          style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
        >
          Add candidate
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : active.length === 0 ? (
        <p style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No candidates yet. Add the first person you&apos;d like on the crew.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={active.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {active.map((c, i) => (
                <SortableCandidateRow
                  key={c.id}
                  candidate={c}
                  rank={i + 1}
                  busy={busy}
                  onEdit={() => openEdit(c)}
                  onMarkContacted={() => markContacted(c)}
                  onSetStatus={(s) => setStatus(c, s)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {!loading && hired.length > 0 && bucketSection('Hired', hired, hiredOpen, setHiredOpen)}
      {!loading && passed.length > 0 && bucketSection('Passed', passed, passedOpen, setPassedOpen)}

      {addOpen &&
        modal(
          'Add candidate',
          <>
            <CandidateFields draft={addDraft} setDraft={setAddDraft} />
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
            <CandidateFields draft={editDraft} setDraft={setEditDraft} />
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
