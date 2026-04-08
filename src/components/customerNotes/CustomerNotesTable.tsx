import { useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { useCustomerContactsForCustomer, type CustomerContactRow } from '../../hooks/useCustomerContactsForCustomer'
import { ContactMethodQuickPicks, contactMethodFieldInputStyle } from '../shared/ContactMethodQuickPicks'
import {
  NOTE_CARD_BODY_PADDING_RIGHT_FOR_FLOATING_EDIT,
  NoteCardFloatingEditButton,
} from '../shared/NoteCardFloatingEditButton'
import { formatCompactNoteDateTime } from '../../utils/dateUtils'

export type { CustomerContactRow }

function CustomerNotesEntryRow({
  entry,
  onUpdated,
  isLastInList,
}: {
  entry: CustomerContactRow
  onUpdated: () => void
  isLastInList: boolean
}) {
  const { showToast } = useToastContext()
  const [contactMethod, setContactMethod] = useState(entry.contact_method ?? '')
  const [details, setDetails] = useState(entry.details ?? '')
  const [contactAt, setContactAt] = useState(entry.contact_date ? entry.contact_date.slice(0, 16) : '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const contactDateIso = contactAt ? new Date(contactAt).toISOString() : entry.contact_date
      await withSupabaseRetry(
        async () =>
          supabase
            .from('customer_contacts')
            .update({
              contact_method: contactMethod.trim() || null,
              details: details.trim() || null,
              contact_date: contactDateIso,
            })
            .eq('id', entry.id),
        'update customer contact'
      )
      setEditing(false)
      onUpdated()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save customer note'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!confirm('Remove this entry?')) return
    try {
      await withSupabaseRetry(
        async () => supabase.from('customer_contacts').delete().eq('id', entry.id),
        'delete customer contact'
      )
      onUpdated()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not delete customer note'), 'error')
    }
  }

  const cardBorder: CSSProperties = {
    padding: '0.75rem',
    borderBottom: isLastInList ? 'none' : '1px solid #e5e7eb',
  }

  if (editing) {
    return (
      <article aria-label="Edit customer note" style={{ ...cardBorder, background: '#ffffff' }}>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={4}
          style={{
            width: '100%',
            minHeight: '4rem',
            boxSizing: 'border-box',
            resize: 'vertical',
            ...contactMethodFieldInputStyle,
          }}
        />
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            gap: '0.5rem',
            marginTop: '0.5rem',
          }}
        >
          <div
            style={{
              flex: '1 1 200px',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <ContactMethodQuickPicks onPick={setContactMethod} />
            <input
              type="text"
              value={contactMethod}
              onChange={(e) => setContactMethod(e.target.value)}
              placeholder="Contact method"
              style={{ flex: '1 1 140px', minWidth: 0, boxSizing: 'border-box', ...contactMethodFieldInputStyle }}
            />
          </div>
          <input
            type="datetime-local"
            value={contactAt}
            onChange={(e) => setContactAt(e.target.value)}
            style={{ flex: '1 1 200px', minWidth: 0, ...contactMethodFieldInputStyle }}
          />
          <div style={{ display: 'flex', gap: '0.25rem', marginLeft: 'auto', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              style={{ padding: '0.25rem 0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              title="Delete"
              aria-label="Delete"
              style={{
                padding: '0.25rem',
                background: '#fee2e2',
                color: '#991b1b',
                border: '1px solid #fca5a5',
                borderRadius: 4,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="18" height="18" fill="currentColor" aria-hidden="true">
                <path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z" />
              </svg>
            </button>
          </div>
        </div>
      </article>
    )
  }

  const ariaLabel = entry.contact_date ? `Customer note ${formatCompactNoteDateTime(entry.contact_date)}` : 'Customer note'

  return (
    <article aria-label={ariaLabel} style={{ position: 'relative', ...cardBorder, background: '#ffffff' }}>
      <NoteCardFloatingEditButton onClick={() => setEditing(true)} />
      <div
        style={{
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
          marginBottom: '0.5rem',
          fontSize: '0.9375rem',
          lineHeight: 1.45,
          paddingRight: NOTE_CARD_BODY_PADDING_RIGHT_FOR_FLOATING_EDIT,
        }}
      >
        {entry.details != null && entry.details !== '' ? entry.details : '—'}
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.75rem 1rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem 1rem',
            alignItems: 'center',
            fontSize: '0.875rem',
            color: '#374151',
          }}
        >
          {entry.contact_method?.trim() ? (
            <span>
              <span style={{ color: '#6b7280', marginRight: '0.35rem' }}>Contact method</span>
              {entry.contact_method.trim()}
            </span>
          ) : null}
          <span>{entry.contact_date ? formatCompactNoteDateTime(entry.contact_date) : '—'}</span>
        </div>
      </div>
    </article>
  )
}

function CustomerNotesNewRow({
  customerId,
  onSaved,
  onCancel,
  isLastInList,
}: {
  customerId: string
  onSaved: () => void
  onCancel: () => void
  isLastInList: boolean
}) {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const [contactMethod, setContactMethod] = useState('')
  const [details, setDetails] = useState('')
  const [contactAt, setContactAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!authUser?.id) {
      showToast('You must be signed in to add a note.', 'error')
      return
    }
    setSaving(true)
    try {
      const contactDateIso = new Date(contactAt).toISOString()
      await withSupabaseRetry(
        async () =>
          supabase.from('customer_contacts').insert({
            customer_id: customerId,
            contact_date: contactDateIso,
            details: details.trim() || null,
            contact_method: contactMethod.trim() || null,
            created_by: authUser.id,
          }),
        'insert customer contact'
      )
      onSaved()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not add customer note'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <article aria-label="New customer note" style={{ padding: '0.75rem', borderBottom: isLastInList ? 'none' : '1px solid #e5e7eb', background: '#fafafa' }}>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Notes"
        rows={4}
        style={{
          width: '100%',
          minHeight: '4rem',
          boxSizing: 'border-box',
          resize: 'vertical',
          ...contactMethodFieldInputStyle,
        }}
      />
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          gap: '0.5rem',
          marginTop: '0.5rem',
        }}
      >
        <div
          style={{
            flex: '1 1 200px',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          <ContactMethodQuickPicks onPick={setContactMethod} />
          <input
            type="text"
            value={contactMethod}
            onChange={(e) => setContactMethod(e.target.value)}
            placeholder="Contact method"
            style={{ flex: '1 1 140px', minWidth: 0, boxSizing: 'border-box', ...contactMethodFieldInputStyle }}
          />
        </div>
        <input
          type="datetime-local"
          value={contactAt}
          onChange={(e) => setContactAt(e.target.value)}
          style={{ flex: '1 1 200px', minWidth: 0, ...contactMethodFieldInputStyle }}
        />
        <div style={{ display: 'flex', gap: '0.25rem', marginLeft: 'auto' }}>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            style={{ padding: '0.25rem 0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Add
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </article>
  )
}

export type CustomerNotesTableProps = {
  customerId: string
  customerName: string
  onMutated?: () => void
  onLoadError?: (message: string) => void
  /** Omit for default "Customer notes"; pass "" to hide section title row. */
  title?: string
  /** When true, add top margin/border like Builder Review when bid sections appear above. */
  hasBidsAbove?: boolean
  /** When set, table uses this data/refetch instead of loading via the internal hook (single source for parent preview + table). */
  contactsState?: { entries: CustomerContactRow[]; loading: boolean; refetch: () => Promise<void> }
}

export function CustomerNotesTable({
  customerId,
  customerName,
  onMutated,
  onLoadError,
  title,
  hasBidsAbove = false,
  contactsState,
}: CustomerNotesTableProps) {
  const headingLabel = title === undefined ? 'Customer notes' : title
  const [adding, setAdding] = useState(false)
  const internal = useCustomerContactsForCustomer(contactsState ? null : customerId, onLoadError)
  const entries = contactsState?.entries ?? internal.entries
  const loading = contactsState?.loading ?? internal.loading
  const refetch = contactsState?.refetch ?? internal.refetch

  async function handleUpdated() {
    await refetch()
    onMutated?.()
  }

  const sectionStyle: CSSProperties = {
    marginTop: hasBidsAbove ? '1rem' : 0,
    paddingTop: hasBidsAbove ? '1rem' : 0,
    borderTop: hasBidsAbove ? '1px solid #e5e7eb' : 'none',
  }

  return (
    <div style={sectionStyle} aria-label={`Customer notes for ${customerName}`}>
      {headingLabel ? (
        <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {headingLabel}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="14" height="14" fill="currentColor" aria-hidden="true">
            <path d="M160 544C124.7 544 96 515.3 96 480L96 160C96 124.7 124.7 96 160 96L480 96C515.3 96 544 124.7 544 160L544 373.5C544 390.5 537.3 406.8 525.3 418.8L418.7 525.3C406.7 537.3 390.4 544 373.4 544L160 544zM485.5 368L392 368C378.7 368 368 378.7 368 392L368 485.5L485.5 368z" />
          </svg>
        </div>
      ) : null}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden', background: '#f9fafb' }}>
        {loading && entries.length === 0 && !adding ? (
          <div style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>Loading…</div>
        ) : null}
        {!loading && entries.length === 0 && !adding ? (
          <div style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>No notes yet.</div>
        ) : null}
        {entries.map((entry, i) => (
          <CustomerNotesEntryRow
            key={entry.id}
            entry={entry}
            onUpdated={() => void handleUpdated()}
            isLastInList={i === entries.length - 1 && !adding}
          />
        ))}
        {adding ? (
          <CustomerNotesNewRow
            customerId={customerId}
            isLastInList
            onSaved={() => {
              setAdding(false)
              void handleUpdated()
            }}
            onCancel={() => setAdding(false)}
          />
        ) : null}
      </div>
      {!adding && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setAdding(true)}
            style={{ padding: '0.25rem 0.65rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Add row
          </button>
        </div>
      )}
    </div>
  )
}
