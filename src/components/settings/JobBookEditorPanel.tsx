import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import type { Database } from '../../types/database'

type JobBookRow = Database['public']['Tables']['job_book_entries']['Row']
type ServiceTypeMini = { id: string; name: string }

/** Column width matches this header only (not longest option). +4ch for padding/chevron. */
const SERVICE_TYPE_COLUMN_HEADER = 'Service type'
const SERVICE_TYPE_COLUMN_WIDTH = `${SERVICE_TYPE_COLUMN_HEADER.length + 4}ch`

function SortableJobBookRow({
  r,
  serviceTypes,
  reordering,
  setRows,
  persistField,
  onRequestDelete,
  setWorkInputRef,
}: {
  r: JobBookRow
  serviceTypes: ServiceTypeMini[]
  reordering: boolean
  setRows: Dispatch<SetStateAction<JobBookRow[]>>
  persistField: (id: string, patch: Partial<JobBookRow>) => void | Promise<void>
  onRequestDelete: (id: string) => void
  setWorkInputRef: (id: string, el: HTMLInputElement | null) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: r.id })
  const trStyle: CSSProperties = {
    borderTop: '1px solid var(--border)',
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <tr ref={setNodeRef} style={trStyle}>
      <td style={{ padding: 8, verticalAlign: 'top' }}>
        <input
          ref={(el) => setWorkInputRef(r.id, el)}
          type="text"
          value={r.work_label}
          onChange={(e) =>
            setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, work_label: e.target.value } : x)))
          }
          onBlur={(e) => {
            const v = e.target.value.trim()
            if (!v) return
            void persistField(r.id, { work_label: v })
          }}
          style={{ width: '100%', minWidth: 200, padding: '0.35rem 0.5rem', boxSizing: 'border-box' }}
        />
      </td>
      <td style={{ padding: 8, verticalAlign: 'top' }}>
        <input
          type="number"
          className="no-spinner"
          min={0}
          step={0.01}
          value={Number(r.unit_cost)}
          onFocus={(e) => {
            if (Number(r.unit_cost) === 0) e.currentTarget.select()
          }}
          onChange={(e) => {
            const n = parseFloat(e.target.value)
            setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, unit_cost: Number.isFinite(n) ? n : 0 } : x)))
          }}
          onBlur={(e) => {
            const n = Math.max(0, parseFloat(e.target.value) || 0)
            void persistField(r.id, { unit_cost: n })
          }}
          style={{ width: '100%', padding: '0.35rem 0.5rem' }}
        />
      </td>
      <td
        style={{
          padding: 8,
          verticalAlign: 'top',
          minWidth: SERVICE_TYPE_COLUMN_WIDTH,
          maxWidth: SERVICE_TYPE_COLUMN_WIDTH,
          width: '1%',
        }}
      >
        <select
          value={r.service_type_id ?? ''}
          onChange={(e) => {
            const v = e.target.value
            const service_type_id = v === '' ? null : v
            setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, service_type_id } : x)))
            void persistField(r.id, { service_type_id })
          }}
          style={{ width: '100%', padding: '0.35rem 0.5rem', boxSizing: 'border-box' }}
        >
          <option value="">All types</option>
          {serviceTypes.map((st) => (
            <option key={st.id} value={st.id}>
              {st.name}
            </option>
          ))}
        </select>
      </td>
      <td style={{ padding: '6px 4px', verticalAlign: 'middle' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            justifyContent: 'center',
          }}
        >
          <button
            type="button"
            {...attributes}
            {...listeners}
            disabled={reordering}
            title="Drag to reorder"
            aria-label="Drag to reorder"
            style={{
              padding: '0.15rem',
              margin: 0,
              cursor: reordering ? 'not-allowed' : 'grab',
              touchAction: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              lineHeight: 0,
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={18} height={18} fill="currentColor" aria-hidden>
              <path d="M342.6 41.4C330.1 28.9 309.8 28.9 297.3 41.4L201.3 137.4C188.8 149.9 188.8 170.2 201.3 182.7C213.8 195.2 234.1 195.2 246.6 182.7L288 141.3L288 498.7L246.6 457.4C234.1 444.9 213.8 444.9 201.3 457.4C188.8 469.9 188.8 490.2 201.3 502.7L297.3 598.7C303.3 604.7 311.4 608.1 319.9 608.1C328.4 608.1 336.5 604.7 342.5 598.7L438.5 502.7C451 490.2 451 469.9 438.5 457.4C426 444.9 405.7 444.9 393.2 457.4L351.8 498.8L351.8 141.3L393.2 182.7C405.7 195.2 426 195.2 438.5 182.7C451 170.2 451 149.9 438.5 137.4L342.5 41.4z" />
            </svg>
          </button>
          {/* Font Awesome Free v7.2.0 trash-can — license: fontawesome.com/license/free */}
          <button
            type="button"
            onClick={() => onRequestDelete(r.id)}
            title="Delete"
            aria-label="Delete this Job Book line"
            style={{
              padding: '0.15rem',
              margin: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              color: 'var(--text-red-700)',
              cursor: 'pointer',
              lineHeight: 0,
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={18} height={18} fill="currentColor" aria-hidden>
              <path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  )
}

export type JobBookEditorPanelProps = {
  /** When true, load and show editor; when false, idle (e.g. modal closed). */
  active: boolean
  onDbError: (message: string) => void
  /** Intro copy for Collect Payment context (Settings default; optional in modal). */
  showIntro?: boolean
  /** When true with `showIntro`, omits the parenthetical about the job's linked bid (e.g. Jobs modal). */
  hideIntroLinkedBidPhrase?: boolean
}

export default function JobBookEditorPanel({
  active,
  onDbError,
  showIntro = false,
  hideIntroLinkedBidPhrase = false,
}: JobBookEditorPanelProps) {
  const deleteConfirmTitleId = useId()
  const [loading, setLoading] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [rows, setRows] = useState<JobBookRow[]>([])
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeMini[]>([])
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingFocusWorkRowId, setPendingFocusWorkRowId] = useState<string | null>(null)
  const workInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const setWorkInputRef = useCallback((id: string, el: HTMLInputElement | null) => {
    if (el) workInputRefs.current[id] = el
    else delete workInputRefs.current[id]
  }, [])

  const dragSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [entriesList, stList] = await Promise.all([
        withSupabaseRetry(
          async () =>
            supabase
              .from('job_book_entries')
              .select('*')
              .order('sequence_order', { ascending: true })
              .order('created_at', { ascending: true }),
          'job_book_entries select editor',
        ),
        withSupabaseRetry(
          async () =>
            supabase.from('service_types').select('id, name').order('sequence_order', { ascending: true }),
          'service_types select job book editor',
        ),
      ])
      setRows((entriesList ?? []) as JobBookRow[])
      setServiceTypes((stList ?? []) as ServiceTypeMini[])
    } catch (e) {
      onDbError(formatErrorMessage(e, 'Could not load Job Book'))
    } finally {
      setLoading(false)
    }
  }, [onDbError])

  useEffect(() => {
    if (!active) return
    void load()
  }, [active, load])

  useEffect(() => {
    if (deleteConfirmId == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setDeleteConfirmId(null)
      setDeletingId(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [deleteConfirmId])

  useEffect(() => {
    if (!active) {
      setDeleteConfirmId(null)
      setDeletingId(null)
      setPendingFocusWorkRowId(null)
    }
  }, [active])

  useLayoutEffect(() => {
    if (pendingFocusWorkRowId == null) return
    const id = pendingFocusWorkRowId
    const focusWork = () => {
      const el = workInputRefs.current[id]
      if (!el) return false
      el.focus()
      el.select()
      return true
    }
    focusWork()
    const raf = requestAnimationFrame(() => {
      focusWork()
      setPendingFocusWorkRowId(null)
    })
    return () => cancelAnimationFrame(raf)
  }, [pendingFocusWorkRowId])

  const onDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const a = String(active.id)
      const o = String(over.id)
      const oldIndex = rows.findIndex((r) => r.id === a)
      const newIndex = rows.findIndex((r) => r.id === o)
      if (oldIndex < 0 || newIndex < 0) return
      const reordered = arrayMove(rows, oldIndex, newIndex)
      const withSeq = reordered.map((row, i) => ({ ...row, sequence_order: i }))
      setRows(withSeq)
      setReordering(true)
      try {
        await Promise.all(
          withSeq.map((row, i) =>
            withSupabaseRetry(
              async () => supabase.from('job_book_entries').update({ sequence_order: i }).eq('id', row.id),
              `job_book_entries reorder ${row.id}`,
            ),
          ),
        )
      } catch (e) {
        onDbError(formatErrorMessage(e, 'Could not reorder'))
        void load()
      } finally {
        setReordering(false)
      }
    },
    [rows, load, onDbError],
  )

  async function addRow() {
    const nextSeq = rows.length
    try {
      const inserted = await withSupabaseRetry(
        async () =>
          supabase
            .from('job_book_entries')
            .insert({
              work_label: 'New line',
              unit_cost: 0,
              sequence_order: nextSeq,
              service_type_id: null,
            })
            .select('*')
            .single(),
        'job_book_entries insert',
      )
      if (inserted) {
        const row = inserted as JobBookRow
        setRows((prev) => [...prev, row])
        setPendingFocusWorkRowId(row.id)
      }
    } catch (e) {
      onDbError(formatErrorMessage(e, 'Could not add row'))
    }
  }

  async function persistField(id: string, patch: Partial<JobBookRow>) {
    try {
      await withSupabaseRetry(
        async () => supabase.from('job_book_entries').update(patch).eq('id', id),
        'job_book_entries update',
      )
    } catch (e) {
      onDbError(formatErrorMessage(e, 'Could not save'))
      void load()
    }
  }

  function cancelDeleteConfirm() {
    setDeleteConfirmId(null)
    setDeletingId(null)
  }

  async function performDelete(id: string) {
    setDeletingId(id)
    try {
      await withSupabaseRetry(
        async () => supabase.from('job_book_entries').delete().eq('id', id),
        'job_book_entries delete',
      )
      setRows((prev) => prev.filter((r) => r.id !== id))
      cancelDeleteConfirm()
    } catch (e) {
      onDbError(formatErrorMessage(e, 'Could not delete'))
      cancelDeleteConfirm()
    }
  }

  const pendingDeleteLabel = (() => {
    if (deleteConfirmId == null) return ''
    const raw = rows.find((r) => r.id === deleteConfirmId)?.work_label?.trim() ?? ''
    if (!raw) return ''
    const max = 80
    return raw.length > max ? `${raw.slice(0, max)}\u2026` : raw
  })()

  if (!active) return null

  const tableHead = (
    <thead>
      <tr style={{ background: 'var(--bg-muted)', textAlign: 'left' }}>
        <th style={{ padding: 8 }}>Work</th>
        <th style={{ padding: 8, width: 120 }}>Cost ($)</th>
        <th
          style={{
            padding: 8,
            minWidth: SERVICE_TYPE_COLUMN_WIDTH,
            maxWidth: SERVICE_TYPE_COLUMN_WIDTH,
            width: '1%',
            whiteSpace: 'nowrap',
          }}
        >
          {SERVICE_TYPE_COLUMN_HEADER}
        </th>
        <th aria-label="Reorder and delete" style={{ padding: '6px 4px', width: 48 }} />
      </tr>
    </thead>
  )

  return (
    <>
      {showIntro ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem', marginTop: '0.5rem' }}>
          Subcontractors can add these read-only lines to a job from <strong>Collect Payment</strong> when the job has no
          Specific Work yet. Leave <strong>Service type</strong> empty for lines that apply to every job; otherwise restrict
          the line to one type
          {hideIntroLinkedBidPhrase ? '.' : ' (from the job\u2019s linked bid).'}
        </p>
      ) : null}
      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            {rows.length > 0 ? (
              <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragEnd={(e) => void onDragEnd(e)}>
                <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                  {tableHead}
                  <SortableContext items={rows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
                    <tbody>
                      {rows.map((r) => (
                        <SortableJobBookRow
                          key={r.id}
                          r={r}
                          serviceTypes={serviceTypes}
                          reordering={reordering}
                          setRows={setRows}
                          persistField={persistField}
                          onRequestDelete={setDeleteConfirmId}
                          setWorkInputRef={setWorkInputRef}
                        />
                      ))}
                    </tbody>
                  </SortableContext>
                </table>
              </DndContext>
            ) : (
              <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                {tableHead}
                <tbody />
              </table>
            )}
          </div>
          <button
            type="button"
            onClick={() => void addRow()}
            style={{
              marginTop: '0.75rem',
              padding: '0.35rem 0.75rem',
              fontSize: '0.875rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Add line
          </button>
        </>
      )}
      {deleteConfirmId != null ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 70,
          }}
          onClick={cancelDeleteConfirm}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={deleteConfirmTitleId}
            style={{
              background: 'var(--surface)',
              padding: '1.5rem',
              borderRadius: 8,
              minWidth: 320,
              maxWidth: 400,
              width: 'min(400px, calc(100vw - 2rem))',
              boxSizing: 'border-box',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={deleteConfirmTitleId} style={{ margin: '0 0 0.75rem', fontSize: '1.25rem' }}>
              Delete Job Book line?
            </h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
              {pendingDeleteLabel ? (
                <>
                  Remove <strong>{pendingDeleteLabel}</strong> from the catalog? This cannot be undone.
                </>
              ) : (
                <>Remove this line from the catalog? This cannot be undone.</>
              )}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={cancelDeleteConfirm}
                disabled={deletingId != null}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid var(--border-strong)',
                  background: 'var(--surface)',
                  borderRadius: 4,
                  cursor: deletingId != null ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingId != null}
                onClick={() => void performDelete(deleteConfirmId)}
                style={{
                  padding: '0.5rem 1rem',
                  background: deletingId == null ? '#dc2626' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: deletingId == null ? 'pointer' : 'not-allowed',
                }}
              >
                {deletingId != null ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
