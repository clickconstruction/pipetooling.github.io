import React, { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../../lib/supabase'
import type { BidCountRow } from '../../types/bids'

export function SortableCountRow({ row, highlight, onUpdate, onDelete }: {
  row: BidCountRow
  highlight?: boolean
  onUpdate: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id })
  const dragHandle = (
    <span
      {...attributes}
      {...listeners}
      style={{ cursor: 'grab', display: 'inline-flex', padding: '0.25rem', color: '#9ca3af' }}
      title="Drag to reorder"
      aria-label="Drag to reorder"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
        <path d="M8 6h2v2H8V6zm0 4h2v2H8v-2zm0 4h2v2H8v-2zm4-8h2v2h-2V6zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2z" />
      </svg>
    </span>
  )
  return (
    <CountRow
      row={row}
      highlight={highlight}
      onUpdate={onUpdate}
      onDelete={onDelete}
      dragHandle={dragHandle}
      trRef={setNodeRef}
      trStyle={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    />
  )
}

export function CountRow({ row, highlight, onUpdate, onDelete, dragHandle, trRef, trStyle }: {
  row: BidCountRow
  highlight?: boolean
  onUpdate: () => void
  onDelete: () => void
  dragHandle?: React.ReactNode
  trRef?: React.Ref<HTMLTableRowElement>
  trStyle?: React.CSSProperties
}) {
  const [fixture, setFixture] = useState(row.fixture ?? '')
  const [count, setCount] = useState(String(row.count))
  const [groupTag, setGroupTag] = useState(row.group_tag ?? '')
  const [page, setPage] = useState(row.page ?? '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const num = parseFloat(count)
    if (isNaN(num)) { setSaving(false); return }
    const { error } = await supabase.from('bids_count_rows').update({ fixture: fixture.trim(), count: num, group_tag: groupTag.trim() || null, page: page.trim() || null }).eq('id', row.id)
    if (error) { setSaving(false); return }
    setEditing(false)
    onUpdate()
    setSaving(false)
  }

  async function remove() {
    if (!confirm('Remove this row?')) return
    await supabase.from('bids_count_rows').delete().eq('id', row.id)
    onDelete()
  }

  const rowStyle = highlight ? { borderBottom: '1px solid #e5e7eb', background: '#dcfce7' } : { borderBottom: '1px solid #e5e7eb' }
  const mergedStyle = { ...rowStyle, ...trStyle }
  if (editing) {
    return (
      <tr ref={trRef} style={mergedStyle}>
        {dragHandle != null && <td style={{ padding: '0.75rem', width: 32, verticalAlign: 'middle' }}>{dragHandle}</td>}
        <td style={{ padding: '0.75rem', width: 132, textAlign: 'center' }}>
          <input type="number" step="any" value={count} onChange={(e) => setCount(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'center' }} />
        </td>
        <td style={{ padding: '0.75rem', width: '50%' }}>
          <input type="text" value={fixture} onChange={(e) => setFixture(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
        </td>
        <td style={{ padding: '0.75rem' }}>
          <input type="text" value={groupTag} onChange={(e) => setGroupTag(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
        </td>
        <td style={{ padding: '0.75rem' }}>
          <input type="text" value={page} onChange={(e) => setPage(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
        </td>
        <td style={{ padding: '0.75rem' }}>
          <button type="button" onClick={save} disabled={saving} style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Save</button>
          <button type="button" onClick={() => setEditing(false)} style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
        </td>
      </tr>
    )
  }
  return (
    <tr ref={trRef} style={mergedStyle}>
      {dragHandle != null && <td style={{ padding: '0.75rem', width: 32, verticalAlign: 'middle' }}>{dragHandle}</td>}
      <td style={{ padding: '0.75rem', textAlign: 'center' }}>{row.count}</td>
      <td style={{ padding: '0.75rem' }}>{row.fixture ?? ''}</td>
      <td style={{ padding: '0.75rem' }}>{row.group_tag ?? '—'}</td>
      <td style={{ padding: '0.75rem' }}>{row.page ?? '—'}</td>
      <td style={{ padding: '0.75rem' }}>
        <button type="button" onClick={() => setEditing(true)} title="Edit" aria-label="Edit" style={{ marginRight: '0.25rem', padding: '0.25rem', cursor: 'pointer', background: 'none', border: 'none', color: '#6b7280', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden="true">
            <path d="M535.6 85.7C513.7 63.8 478.3 63.8 456.4 85.7L432 110.1L529.9 208L554.3 183.6C576.2 161.7 576.2 126.3 554.3 104.4L535.6 85.7zM236.4 305.7C230.3 311.8 225.6 319.3 222.9 327.6L193.3 416.4C190.4 425 192.7 434.5 199.1 441C205.5 447.5 215 449.7 223.7 446.8L312.5 417.2C320.7 414.5 328.2 409.8 334.4 403.7L496 241.9L398.1 144L236.4 305.7zM160 128C107 128 64 171 64 224L64 480C64 533 107 576 160 576L416 576C469 576 512 533 512 480L512 384C512 366.3 497.7 352 480 352C462.3 352 448 366.3 448 384L448 480C448 497.7 433.7 512 416 512L160 512C142.3 512 128 497.7 128 480L128 224C128 206.3 142.3 192 160 192L256 192C273.7 192 288 177.7 288 160C288 142.3 273.7 128 256 128L160 128z" />
          </svg>
        </button>
        <button type="button" onClick={remove} title="Delete" aria-label="Delete" style={{ padding: '0.25rem', cursor: 'pointer', background: 'none', border: 'none', color: '#991b1b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden="true">
            <path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z" />
          </svg>
        </button>
      </td>
    </tr>
  )
}
