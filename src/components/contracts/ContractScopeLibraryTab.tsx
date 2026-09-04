import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { generalConditionsCoverage, type SubScopeItem, type SubScopeItemKind } from '../../lib/subWorkOrders/subWorkOrder'

/**
 * Scope tab of the Contract library (Sub Work Orders train, PR 3 — v2.2787).
 * The lists a Sub Labor sheet's Work order box ticks from: standing scope
 * lines, exclusions and signing acknowledgements, one set per trade plus an
 * "All trades" set that every sheet gets. Edits change future work orders
 * only — sent ones keep their frozen wording (offer_scope_snapshot).
 *
 * The card at the bottom is the compliance hook for General Conditions:
 * which Contract Book documents are for subs, and how many active subs
 * signed the current version.
 */

type ServiceTypeRow = { id: string; name: string; sequence_order: number }
type SubDoc = { id: string; document_name: string; book_version_date: string | null }
type SignedRow = { person_id: string | null; applied_contract_template_document_id: string | null; applied_version_date: string | null }

const KIND_TITLE: Record<SubScopeItemKind, string> = { scope: 'Scope items', exclusion: 'Exclusions', acknowledgement: 'They confirm at signing' }
const KIND_HINT: Record<SubScopeItemKind, string> = {
  scope: 'Default items arrive pre-ticked on every new work order of this trade; "ask" items show unticked so the office decides per job.',
  exclusion: 'Standing exclusions, ticked the same way.',
  acknowledgement: 'One plain sentence each — the sub ticks every box before the signature button lights up.',
}
const KIND_PLACEHOLDER: Record<SubScopeItemKind, string> = {
  scope: 'e.g. Furnish and install all plumbing fixtures per contract documents',
  exclusion: 'e.g. Permit and inspection fees paid by the general contractor',
  acknowledgement: 'e.g. My insurance certificate stays current for the whole job.',
}

const fmtYmd = (ymd: string | null) => {
  if (!ymd) return ''
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export function ContractScopeLibraryTab({ onQuickSend, canEdit }: { onQuickSend: (documentName: string) => void; canEdit: boolean }) {
  const { showToast } = useToastContext()
  const [items, setItems] = useState<SubScopeItem[]>([])
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeRow[]>([])
  const [subDocs, setSubDocs] = useState<SubDoc[]>([])
  const [signedRows, setSignedRows] = useState<SignedRow[]>([])
  const [activeSubIds, setActiveSubIds] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null) // service_type_id, null = all trades
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')
  const [newLabel, setNewLabel] = useState<Record<SubScopeItemKind, string>>({ scope: '', exclusion: '', acknowledgement: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [iRes, sRes, dRes, pRes] = await Promise.all([
        supabase.from('sub_scope_items').select('*').is('archived_at', null).order('sequence_order', { ascending: true }),
        supabase.from('service_types').select('id, name, sequence_order').order('sequence_order', { ascending: true }),
        supabase.from('contract_template_documents').select('id, document_name, book_version_date').eq('audience', 'sub').order('sequence_order', { ascending: true }),
        supabase.from('people').select('id').eq('kind', 'sub').is('archived_at', null),
      ])
      if (iRes.error) throw iRes.error
      setItems((iRes.data ?? []) as SubScopeItem[])
      setServiceTypes((sRes.data ?? []) as ServiceTypeRow[])
      const docs = (dRes.data ?? []) as SubDoc[]
      setSubDocs(docs)
      setActiveSubIds(((pRes.data ?? []) as Array<{ id: string }>).map((p) => p.id))
      if (docs.length > 0) {
        const { data } = await supabase
          .from('person_contract_documents')
          .select('person_id, applied_contract_template_document_id, applied_version_date')
          .eq('status', 'signed')
          .in('applied_contract_template_document_id', docs.map((d) => d.id))
        setSignedRows((data ?? []) as SignedRow[])
      } else {
        setSignedRows([])
      }
    } catch (e) {
      showToast(`Could not load the scope library: ${formatErrorMessage(e)}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void load()
  }, [load])

  const lists = useMemo(() => {
    const count = (stId: string | null, kind: SubScopeItemKind) => items.filter((i) => i.service_type_id === stId && i.kind === kind).length
    return [
      { id: null as string | null, name: 'All trades', scope: count(null, 'scope'), exclusion: count(null, 'exclusion'), ack: count(null, 'acknowledgement') },
      ...serviceTypes.map((s) => ({ id: s.id as string | null, name: s.name, scope: count(s.id, 'scope'), exclusion: count(s.id, 'exclusion'), ack: count(s.id, 'acknowledgement') })),
    ]
  }, [items, serviceTypes])

  const selectedName = lists.find((l) => l.id === selected)?.name ?? 'All trades'
  const forKind = (kind: SubScopeItemKind) => items.filter((i) => i.service_type_id === selected && i.kind === kind).sort((a, b) => a.sequence_order - b.sequence_order || a.label.localeCompare(b.label))

  async function run(label: string, op: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true)
    try {
      const { error } = await op()
      if (error) throw error
      await load()
    } catch (e) {
      showToast(`Could not ${label}: ${formatErrorMessage(e)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function addItem(kind: SubScopeItemKind) {
    const label = newLabel[kind].trim()
    if (!label) return
    const seq = forKind(kind).reduce((m, i) => Math.max(m, i.sequence_order), 0) + 10
    await run('add the item', () =>
      supabase.from('sub_scope_items').insert({ service_type_id: selected, kind, label, is_default: kind !== 'scope' || true, sequence_order: seq }),
    )
    setNewLabel((prev) => ({ ...prev, [kind]: '' }))
  }

  async function saveLabel(item: SubScopeItem) {
    const label = editingLabel.trim()
    setEditingId(null)
    if (!label || label === item.label) return
    await run('rename the item', () => supabase.from('sub_scope_items').update({ label }).eq('id', item.id))
  }

  async function toggleDefault(item: SubScopeItem) {
    await run('change the default', () => supabase.from('sub_scope_items').update({ is_default: !item.is_default }).eq('id', item.id))
  }

  async function archive(item: SubScopeItem) {
    await run('remove the item', () => supabase.from('sub_scope_items').update({ archived_at: new Date().toISOString() }).eq('id', item.id))
  }

  async function move(item: SubScopeItem, dir: -1 | 1) {
    const list = forKind(item.kind)
    const idx = list.findIndex((i) => i.id === item.id)
    const other = list[idx + dir]
    if (!other) return
    // Swap sequence numbers (ties resolve by giving the moved row a distinct value).
    const a = item.sequence_order === other.sequence_order ? other.sequence_order + (dir > 0 ? 1 : -1) : other.sequence_order
    const b = item.sequence_order
    await run('reorder', async () => {
      const r1 = await supabase.from('sub_scope_items').update({ sequence_order: a }).eq('id', item.id)
      if (r1.error) return r1
      return supabase.from('sub_scope_items').update({ sequence_order: b }).eq('id', other.id)
    })
  }

  const rowStyle = { display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.35rem 0.45rem', borderBottom: '1px dotted var(--border)', fontSize: '0.875rem' } as const
  const tinyBtn = (title: string, disabled = false) =>
    ({
      border: '1px solid var(--border)',
      background: 'var(--surface)',
      borderRadius: 4,
      fontSize: '0.72rem',
      padding: '0.1rem 0.4rem',
      cursor: disabled ? 'not-allowed' : 'pointer',
      color: 'var(--text-700)',
      title,
    }) as const

  return (
    <div role="tabpanel" style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 240px) minmax(0, 1fr)', gap: '1rem' }}>
      <div>
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
          One list per trade. A sheet ticks from <strong>All trades</strong> plus its job&rsquo;s trade.
        </p>
        {lists.map((l) => {
          const on = l.id === selected
          const empty = l.scope + l.exclusion + l.ack === 0
          return (
            <button
              key={l.id ?? 'all'}
              type="button"
              onClick={() => setSelected(l.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '0.45rem 0.6rem',
                marginBottom: '0.3rem',
                border: `1px solid ${on ? 'var(--border-blue)' : 'var(--border)'}`,
                borderRadius: 6,
                background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
                cursor: 'pointer',
                color: 'inherit',
              }}
            >
              <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600 }}>{l.name}</span>
              <span style={{ display: 'block', fontSize: '0.72rem', color: empty ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>
                {empty ? 'empty' : `${l.scope} scope · ${l.exclusion} exclusion${l.exclusion === 1 ? '' : 's'} · ${l.ack} to confirm`}
              </span>
            </button>
          )
        })}
      </div>

      <div style={{ minWidth: 0 }}>
        {loading ? (
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading…</p>
        ) : (
          <>
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.85rem 1rem' }}>
              <p style={{ margin: '0 0 0.15rem', fontSize: '0.9375rem', fontWeight: 700 }}>{selectedName}</p>
              <p style={{ margin: '0 0 0.6rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Editing an item changes future work orders only. Sent ones keep their frozen wording.
              </p>
              {(['scope', 'exclusion', 'acknowledgement'] as SubScopeItemKind[]).map((kind) => {
                const list = forKind(kind)
                return (
                  <div key={kind} style={{ marginTop: '0.75rem' }}>
                    <p style={{ margin: '0 0 0.1rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-600)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{KIND_TITLE[kind]}</p>
                    <p style={{ margin: '0 0 0.35rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{KIND_HINT[kind]}</p>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 6 }}>
                      {list.length === 0 ? (
                        <p style={{ margin: 0, padding: '0.45rem 0.6rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Nothing here yet.</p>
                      ) : (
                        list.map((item, idx) => (
                          <div key={item.id} style={rowStyle}>
                            {editingId === item.id ? (
                              <input
                                autoFocus
                                value={editingLabel}
                                onChange={(e) => setEditingLabel(e.target.value)}
                                onBlur={() => void saveLabel(item)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') void saveLabel(item)
                                  if (e.key === 'Escape') setEditingId(null)
                                }}
                                style={{ flex: 1, minWidth: 0, padding: '0.25rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
                              />
                            ) : (
                              <span
                                style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere', cursor: canEdit ? 'text' : 'default' }}
                                title={canEdit ? 'Click to edit the wording' : undefined}
                                onClick={() => {
                                  if (!canEdit) return
                                  setEditingId(item.id)
                                  setEditingLabel(item.label)
                                }}
                              >
                                {item.label}
                              </span>
                            )}
                            {kind !== 'acknowledgement' && (
                              <button
                                type="button"
                                disabled={busy || !canEdit}
                                onClick={() => void toggleDefault(item)}
                                title={item.is_default ? 'Pre-ticked on new work orders — click to make it an "ask"' : 'Shown unticked — click to make it a default'}
                                style={{
                                  ...tinyBtn(''),
                                  fontWeight: 650,
                                  background: item.is_default ? 'var(--bg-green-tint)' : 'var(--bg-amber-tint)',
                                  color: item.is_default ? 'var(--text-green-800)' : 'var(--text-amber-800)',
                                  border: 'none',
                                }}
                              >
                                {item.is_default ? 'default' : 'ask'}
                              </button>
                            )}
                            {canEdit && (
                              <>
                                <button type="button" disabled={busy || idx === 0} onClick={() => void move(item, -1)} style={tinyBtn('Move up', idx === 0)} aria-label="Move up">↑</button>
                                <button type="button" disabled={busy || idx === list.length - 1} onClick={() => void move(item, 1)} style={tinyBtn('Move down', idx === list.length - 1)} aria-label="Move down">↓</button>
                                <button type="button" disabled={busy} onClick={() => void archive(item)} style={{ ...tinyBtn('Remove from the library'), color: 'var(--text-red-700)' }} aria-label="Remove">×</button>
                              </>
                            )}
                          </div>
                        ))
                      )}
                      {canEdit && (
                        <div style={{ display: 'flex', gap: '0.45rem', padding: '0.4rem 0.45rem' }}>
                          <input
                            value={newLabel[kind]}
                            onChange={(e) => setNewLabel((prev) => ({ ...prev, [kind]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void addItem(kind)
                            }}
                            placeholder={KIND_PLACEHOLDER[kind]}
                            disabled={busy}
                            style={{ flex: 1, minWidth: 0, padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem' }}
                          />
                          <button
                            type="button"
                            disabled={busy || !newLabel[kind].trim()}
                            onClick={() => void addItem(kind)}
                            style={{ padding: '0.35rem 0.7rem', fontSize: '0.8125rem', fontWeight: 600, border: 'none', borderRadius: 6, background: newLabel[kind].trim() ? '#3b82f6' : '#9ca3af', color: '#fff', cursor: newLabel[kind].trim() ? 'pointer' : 'not-allowed' }}
                          >
                            Add
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.85rem 1rem', marginTop: '1rem' }}>
              <p style={{ margin: '0 0 0.15rem', fontSize: '0.9375rem', fontWeight: 700 }}>Documents for subs</p>
              <p style={{ margin: '0 0 0.6rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Every work order names these by version date. Add one on the <strong>Documents</strong> tab with the audience set to <strong>Subs</strong> — General Conditions is the usual one.
              </p>
              {subDocs.length === 0 ? (
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>None yet — work orders will reference only the pay wording and the insurance requirement until one exists.</p>
              ) : (
                subDocs.map((d) => {
                  const cov = generalConditionsCoverage({
                    bookVersionDate: d.book_version_date,
                    activeSubIds,
                    signed: signedRows.filter((r) => r.applied_contract_template_document_id === d.id).map((r) => ({ personId: r.person_id, appliedVersionDate: r.applied_version_date })),
                  })
                  return (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0', borderTop: '1px solid var(--border)', fontSize: '0.875rem', flexWrap: 'wrap' }}>
                      <span style={{ flex: 1, minWidth: 160, fontWeight: 600 }}>{d.document_name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{d.book_version_date ? `v. ${fmtYmd(d.book_version_date)}` : 'no version date'}</span>
                      <span style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', color: cov.behind + cov.unsigned > 0 ? 'var(--text-amber-800)' : 'var(--text-green-800)', fontWeight: 600 }}>
                        {cov.current} of {cov.total} active subs on this version
                        {cov.behind > 0 ? ` · ${cov.behind} behind` : ''}
                        {cov.unsigned > 0 ? ` · ${cov.unsigned} never signed` : ''}
                      </span>
                      {cov.behind + cov.unsigned > 0 && (
                        <button
                          type="button"
                          onClick={() => onQuickSend(d.document_name)}
                          style={{ padding: '0.25rem 0.55rem', fontSize: '0.78rem', fontWeight: 600, border: 'none', borderRadius: 6, background: '#0ea5e9', color: '#fff', cursor: 'pointer' }}
                        >
                          Send to…
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ContractScopeLibraryTab
