import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/format'
import { type PersonOffsetInitialDraft, PersonOffsetFormModal } from '../pay/PersonOffsetFormModal'

/** Above Record payment / nested pay dialogs when opening PersonOffsetFormModal from Pay History. */
const Z_PEOPLE_OFFSET_FORM = 1210

type PersonOffset = { id: string; person_name: string; type: string; amount: number; description: string | null; occurred_date: string; pay_stub_id: string | null; created_at: string | null }

type Person = { id: string; master_user_id: string; kind: string; name: string; email: string | null; phone: string | null; notes: string | null }
type UserRow = { id: string; email: string | null; name: string; role: string; notes: string | null; phone: string | null }
type PayStubRow = { id: string; person_name: string; period_start: string; period_end: string; hours_total: number; gross_pay: number; created_at: string | null; paid_at: string | null; paid_by: string | null; paid_note: string | null }

export type PeopleOffsetsTabProps = {
  people: Person[]
  users: UserRow[]
  payStubs: PayStubRow[]
  loadPayStubs: () => Promise<unknown>
}

export default function PeopleOffsetsTab({ people, users, payStubs, loadPayStubs }: PeopleOffsetsTabProps) {
  const [offsets, setOffsets] = useState<PersonOffset[]>([])
  const [offsetsLoading, setOffsetsLoading] = useState(false)
  const [offsetsError, setOffsetsError] = useState<string | null>(null)
  const [offsetFormOpen, setOffsetFormOpen] = useState(false)
  const [offsetFormInitialCreateDraft, setOffsetFormInitialCreateDraft] = useState<PersonOffsetInitialDraft | null>(null)
  const [editingOffset, setEditingOffset] = useState<PersonOffset | null>(null)
  const [offsetApplyModalOpen, setOffsetApplyModalOpen] = useState(false)
  const [offsetToApply, setOffsetToApply] = useState<PersonOffset | null>(null)
  const [offsetApplyPayStubId, setOffsetApplyPayStubId] = useState('')
  const [offsetsTabSearch, setOffsetsTabSearch] = useState('')

  const offsetPersonNameOptions = useMemo(
    () =>
      [...new Set([...people.map((p) => p.name), ...users.map((u) => u.name)])]
        .filter((n): n is string => Boolean(n?.trim()))
        .sort((a, b) => a.localeCompare(b)),
    [people, users],
  )

  async function loadOffsets() {
    setOffsetsLoading(true)
    setOffsetsError(null)
    const { data, error } = await supabase.from('person_offsets').select('*').order('occurred_date', { ascending: false })
    setOffsetsLoading(false)
    if (error) setOffsetsError(error.message)
    else setOffsets((data ?? []) as PersonOffset[])
  }

  function openOffsetForm(o?: PersonOffset) {
    setOffsetFormInitialCreateDraft(null)
    setEditingOffset(o ?? null)
    setOffsetFormOpen(true)
  }

  function closeOffsetForm() {
    setOffsetFormOpen(false)
    setEditingOffset(null)
    setOffsetFormInitialCreateDraft(null)
    setOffsetsError(null)
  }

  async function deleteOffset(o: PersonOffset) {
    const delTypeLabel =
      o.type === 'backcharge' ? 'Backcharge' : o.type === 'damage' ? 'Damage' : o.type === 'employee_credit' ? 'Employee credit' : o.type
    if (!window.confirm(`Delete ${delTypeLabel} $${formatCurrency(o.amount)} for ${o.person_name}?`)) return
    const { error: err } = await supabase.from('person_offsets').delete().eq('id', o.id)
    if (err) setOffsetsError(err.message)
    else loadOffsets()
  }

  async function applyOffsetToPayStub() {
    if (!offsetToApply || !offsetApplyPayStubId) return
    if (offsetToApply.type === 'employee_credit') {
      setOffsetsError('Employee credit cannot be applied to a stub this way yet.')
      return
    }
    const { error: err } = await supabase.from('person_offsets').update({ pay_stub_id: offsetApplyPayStubId }).eq('id', offsetToApply.id)
    if (err) setOffsetsError(err.message)
    else {
      setOffsetApplyModalOpen(false)
      setOffsetToApply(null)
      setOffsetApplyPayStubId('')
      loadOffsets()
    }
  }

  async function unapplyOffset(o: PersonOffset) {
    const { error: err } = await supabase.from('person_offsets').update({ pay_stub_id: null }).eq('id', o.id)
    if (err) setOffsetsError(err.message)
    else loadOffsets()
  }

  const offsetsTabSearching = offsetsTabSearch.trim().length > 0
  const filteredOffsets = useMemo(() => {
    const q = offsetsTabSearch.trim().toLowerCase()
    if (!q) return offsets
    function offsetTypeLabel(o: PersonOffset): string {
      return o.type === 'backcharge'
        ? 'Backcharge'
        : o.type === 'damage'
          ? 'Damage'
          : o.type === 'employee_credit'
            ? 'Employee credit'
            : o.type
    }
    return offsets.filter((o) => {
      const stub = o.pay_stub_id ? payStubs.find((s) => s.id === o.pay_stub_id) : null
      const statusParts =
        o.pay_stub_id
          ? stub
            ? ['applied', `${stub.period_start} – ${stub.period_end}`, `applied (${stub.period_start} – ${stub.period_end})`]
            : ['applied']
          : ['pending']
      const blob = [
        o.person_name,
        o.type,
        offsetTypeLabel(o),
        o.description ?? '',
        o.occurred_date,
        String(o.amount),
        formatCurrency(o.amount),
        ...statusParts,
      ]
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [offsets, offsetsTabSearch, payStubs])

  useEffect(() => {
    const t = setTimeout(() => {
      loadOffsets()
      loadPayStubs()
    }, 80)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Offsets</h2>
          <button
            type="button"
            onClick={() => openOffsetForm()}
            style={{ padding: '0.5rem 1rem', border: '1px solid #3b82f6', borderRadius: 6, background: '#3b82f6', color: '#fff', fontWeight: 500, cursor: 'pointer' }}
          >
            + Add Offset
          </button>
        </div>
        <div style={{ marginBottom: '0.75rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="search"
            value={offsetsTabSearch}
            onChange={(e) => setOffsetsTabSearch(e.target.value)}
            placeholder="Search person, type, description, date, status…"
            aria-label="Search offsets"
            style={{
              flex: '1 1 220px',
              minWidth: 160,
              padding: '0.35rem 0.5rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              fontSize: '0.875rem',
            }}
          />
          {offsetsTabSearching ? (
            <button
              type="button"
              onClick={() => setOffsetsTabSearch('')}
              style={{
                padding: '0.35rem 0.5rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                background: 'var(--surface)',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Clear
            </button>
          ) : null}
        </div>
        {offsetsError && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{offsetsError}</p>}
        {offsetsLoading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : (
          <>
            {offsetsTabSearching && offsets.length > 0 && filteredOffsets.length === 0 ? (
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>No offsets match this search.</p>
            ) : null}
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead style={{ background: 'var(--bg-subtle)' }}>
                <tr>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Person</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Type</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Amount</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Description</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Date</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Status</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOffsets.map((o) => {
                  const stub = o.pay_stub_id ? payStubs.find((s) => s.id === o.pay_stub_id) : null
                  const offsetTypeLabel =
                    o.type === 'backcharge' ? 'Backcharge' : o.type === 'damage' ? 'Damage' : o.type === 'employee_credit' ? 'Employee credit' : o.type
                  return (
                    <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.75rem' }}>{o.person_name}</td>
                      <td style={{ padding: '0.75rem' }}>{offsetTypeLabel}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(o.amount)}</td>
                      <td style={{ padding: '0.75rem' }}>{o.description || '—'}</td>
                      <td style={{ padding: '0.75rem' }}>{o.occurred_date}</td>
                      <td style={{ padding: '0.75rem' }}>
                        {o.pay_stub_id ? (
                          stub ? `Applied (${stub.period_start} – ${stub.period_end})` : 'Applied'
                        ) : (
                          'Pending'
                        )}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          {o.pay_stub_id ? (
                            <button
                              type="button"
                              onClick={() => unapplyOffset(o)}
                              title="Unapply"
                              aria-label="Unapply from pay stub"
                              style={{ padding: '0.35rem', cursor: 'pointer', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                              </svg>
                            </button>
                          ) : o.type === 'employee_credit' ? (
                            <button
                              type="button"
                              disabled
                              title="Applying employee credit to Net Pay is not wired yet (future: Additional line on a pay stub)."
                              aria-label="Apply to pay stub unavailable for employee credit"
                              style={{
                                padding: '0.35rem',
                                cursor: 'not-allowed',
                                background: 'var(--bg-muted)',
                                border: '1px solid var(--border)',
                                borderRadius: 6,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--text-faint)',
                              }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                              </svg>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => { setOffsetToApply(o); setOffsetApplyPayStubId(''); setOffsetApplyModalOpen(true) }}
                              title="Apply to pay stub"
                              aria-label="Apply to pay stub"
                              style={{ padding: '0.35rem', cursor: 'pointer', background: 'var(--bg-blue-tint)', border: '1px solid #bfdbfe', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-link)' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                              </svg>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openOffsetForm(o)}
                            title="Edit"
                            aria-label="Edit"
                            style={{ padding: '0.35rem', cursor: 'pointer', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-700)' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={16} height={16} fill="currentColor" aria-hidden="true">
                              <path d="M362.7 19.3L314.3 67.7 444.3 197.7 492.7 149.3c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18.3 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteOffset(o)}
                            title="Delete"
                            aria-label="Delete"
                            style={{ padding: '0.35rem', cursor: 'pointer', background: 'var(--bg-red-tint)', border: '1px solid #fecaca', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-red-600)' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden="true">
                              <path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {offsets.length === 0 && (
              <p style={{ padding: '1rem', color: 'var(--text-muted)', margin: 0 }}>
                No offsets yet. Add backcharges, damages, or employee credits (e.g. from Record payment) to get started.
              </p>
            )}
          </div>
          </>
        )}
      </div>

      <PersonOffsetFormModal
        open={offsetFormOpen}
        onClose={closeOffsetForm}
        editingOffset={editingOffset}
        initialCreateDraft={offsetFormInitialCreateDraft}
        zIndex={Z_PEOPLE_OFFSET_FORM}
        personNameOptions={offsetPersonNameOptions}
        onSaved={async () => {
          void loadOffsets()
          setOffsetFormInitialCreateDraft(null)
          await loadPayStubs()
        }}
        onError={setOffsetsError}
      />

      {offsetApplyModalOpen && offsetToApply && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h3 style={{ marginTop: 0 }}>Apply offset to pay stub</h3>
            <p style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>Apply {offsetToApply.type} ${formatCurrency(offsetToApply.amount)} for {offsetToApply.person_name} to a pay stub:</p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Pay stub</label>
              <select value={offsetApplyPayStubId} onChange={(e) => setOffsetApplyPayStubId(e.target.value)} style={{ width: '100%', padding: '0.5rem' }}>
                <option value="">— Select —</option>
                {payStubs.filter((s) => s.person_name === offsetToApply.person_name).sort((a, b) => b.period_start.localeCompare(a.period_start)).map((s) => (
                  <option key={s.id} value={s.id}>{s.period_start} – {s.period_end} (${formatCurrency(s.gross_pay)})</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={applyOffsetToPayStub} disabled={!offsetApplyPayStubId} style={{ padding: '0.5rem 1rem' }}>Apply</button>
              <button type="button" onClick={() => { setOffsetApplyModalOpen(false); setOffsetToApply(null); setOffsetApplyPayStubId('') }} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
