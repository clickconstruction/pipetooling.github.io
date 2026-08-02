import { useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../../lib/supabase'
import { STAGE_LABELS, type TakeoffStage } from '../../lib/bids/bidTakeoffHelpers'
import type {
  MaterialTemplateWithAssemblyType,
  TakeoffBookEntryWithItems,
  TakeoffBookVersion,
} from '../../lib/bids/bidPricingEngineTypes'
import type { BidWithBuilder } from '../../types/bidWithBuilder'

export type TakeoffBookAdminSectionProps = {
  selectedBidForTakeoff: BidWithBuilder | null
  selectedServiceTypeId: string
  setError: (message: string | null) => void
  materialTemplates: MaterialTemplateWithAssemblyType[]
  // Takeoff-book engine (useBidPricingEngine, parent-owned)
  takeoffBookVersions: TakeoffBookVersion[]
  takeoffBookEntries: TakeoffBookEntryWithItems[]
  setTakeoffBookEntries: Dispatch<SetStateAction<TakeoffBookEntryWithItems[]>>
  /** The version being BROWSED in this section (distinct from the bid's applied version). */
  takeoffBookEntriesVersionId: string | null
  setTakeoffBookEntriesVersionId: Dispatch<SetStateAction<string | null>>
  /** The version APPLIED to the bid (cleared by the delete-cascade quirk). */
  selectedTakeoffBookVersionId: string | null
  setSelectedTakeoffBookVersionId: Dispatch<SetStateAction<string | null>>
  loadTakeoffBookVersions: () => Promise<void>
  loadTakeoffBookEntries: (versionId: string) => Promise<void>
  saveBidSelectedTakeoffBookVersion: (bidId: string, versionId: string | null) => Promise<void>
  loadBids: (serviceTypeId?: string | null) => Promise<BidWithBuilder[]>
}

/**
 * Takeoff-book admin section (collapsible version chips + entries table) with
 * its version/entry form modals — extracted verbatim from BidsTakeoffTab.tsx
 * (T4 of the Takeoff decomposition; see BIDS_TAKEOFF_TAB_ARCHITECTURE.md).
 * Fully self-contained CRUD; the delete-cascade quirk (clearing the bid's
 * applied version) is preserved via the engine props.
 */
export function TakeoffBookAdminSection({
  selectedBidForTakeoff,
  selectedServiceTypeId,
  setError,
  materialTemplates,
  takeoffBookVersions,
  takeoffBookEntries,
  setTakeoffBookEntries,
  takeoffBookEntriesVersionId,
  setTakeoffBookEntriesVersionId,
  selectedTakeoffBookVersionId,
  setSelectedTakeoffBookVersionId,
  loadTakeoffBookVersions,
  loadTakeoffBookEntries,
  saveBidSelectedTakeoffBookVersion,
  loadBids,
}: TakeoffBookAdminSectionProps) {
  const [takeoffBookSectionOpen, setTakeoffBookSectionOpen] = useState(true)
  const [takeoffBookVersionFormOpen, setTakeoffBookVersionFormOpen] = useState(false)
  const [editingTakeoffBookVersion, setEditingTakeoffBookVersion] = useState<TakeoffBookVersion | null>(null)
  const [takeoffBookVersionNameInput, setTakeoffBookVersionNameInput] = useState('')
  const [savingTakeoffBookVersion, setSavingTakeoffBookVersion] = useState(false)
  const [takeoffBookEntryFormOpen, setTakeoffBookEntryFormOpen] = useState(false)
  const [editingTakeoffBookEntry, setEditingTakeoffBookEntry] = useState<TakeoffBookEntryWithItems | null>(null)
  const [takeoffBookEntryFixtureName, setTakeoffBookEntryFixtureName] = useState('')
  const [takeoffBookEntryAliasNames, setTakeoffBookEntryAliasNames] = useState('')
  const [takeoffBookEntryItemRows, setTakeoffBookEntryItemRows] = useState<Array<{ templateId: string; stage: TakeoffStage }>>([{ templateId: '', stage: 'rough_in' }])
  const [savingTakeoffBookEntry, setSavingTakeoffBookEntry] = useState(false)

  function openEditTakeoffBookVersion(v: TakeoffBookVersion) {
    setEditingTakeoffBookVersion(v)
    setTakeoffBookVersionNameInput(v.name)
    setTakeoffBookVersionFormOpen(true)
  }

  function closeTakeoffBookVersionForm() {
    setTakeoffBookVersionFormOpen(false)
    setEditingTakeoffBookVersion(null)
    setTakeoffBookVersionNameInput('')
  }

  async function saveTakeoffBookVersion(e: React.FormEvent) {
    e.preventDefault()
    const name = takeoffBookVersionNameInput.trim()
    if (!name) return
    setSavingTakeoffBookVersion(true)
    setError(null)
    if (editingTakeoffBookVersion) {
      const { error: err } = await supabase.from('takeoff_book_versions').update({ name }).eq('id', editingTakeoffBookVersion.id)
      if (err) setError(err.message)
      else {
        await loadTakeoffBookVersions()
        closeTakeoffBookVersionForm()
      }
    } else {
      const { error: err } = await supabase.from('takeoff_book_versions').insert({ name, service_type_id: selectedServiceTypeId })
      if (err) setError(err.message)
      else {
        await loadTakeoffBookVersions()
        closeTakeoffBookVersionForm()
      }
    }
    setSavingTakeoffBookVersion(false)
  }

  async function deleteTakeoffBookVersion(v: TakeoffBookVersion) {
    if (!confirm(`Delete takeoff book "${v.name}"? This will delete all entries in this version.`)) return
    const { error: err } = await supabase.from('takeoff_book_versions').delete().eq('id', v.id)
    if (err) setError(err.message)
    else {
      await loadTakeoffBookVersions()
      if (takeoffBookEntriesVersionId === v.id) {
        setTakeoffBookEntriesVersionId(null)
        setTakeoffBookEntries([])
      }
      if (selectedTakeoffBookVersionId === v.id) {
        setSelectedTakeoffBookVersionId(null)
        if (selectedBidForTakeoff?.selected_takeoff_book_version_id === v.id) {
          saveBidSelectedTakeoffBookVersion(selectedBidForTakeoff!.id, null)
          void loadBids()
        }
      }
    }
  }

  function openNewTakeoffBookVersion() {
    setEditingTakeoffBookVersion(null)
    setTakeoffBookVersionNameInput('')
    setTakeoffBookVersionFormOpen(true)
  }

  function openNewTakeoffBookEntry() {
    setEditingTakeoffBookEntry(null)
    setTakeoffBookEntryFixtureName('')
    setTakeoffBookEntryAliasNames('')
    setTakeoffBookEntryItemRows([{ templateId: '', stage: 'rough_in' }])
    setTakeoffBookEntryFormOpen(true)
  }

  function openEditTakeoffBookEntry(entry: TakeoffBookEntryWithItems) {
    setEditingTakeoffBookEntry(entry)
    setTakeoffBookEntryFixtureName(entry.fixture_name)
    setTakeoffBookEntryAliasNames((entry.alias_names ?? []).join(', '))
    setTakeoffBookEntryItemRows(
      entry.items.length > 0
        ? entry.items.map((i) => ({ templateId: i.template_id, stage: i.stage as TakeoffStage }))
        : [{ templateId: '', stage: 'rough_in' }]
    )
    setTakeoffBookEntryFormOpen(true)
  }

  function closeTakeoffBookEntryForm() {
    setTakeoffBookEntryFormOpen(false)
    setEditingTakeoffBookEntry(null)
    setTakeoffBookEntryFixtureName('')
    setTakeoffBookEntryAliasNames('')
    setTakeoffBookEntryItemRows([{ templateId: '', stage: 'rough_in' }])
  }

  async function saveTakeoffBookEntry(e: React.FormEvent) {
    e.preventDefault()
    const fixtureName = takeoffBookEntryFixtureName.trim()
    if (!fixtureName || !takeoffBookEntriesVersionId) return
    const aliasNames = takeoffBookEntryAliasNames
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const validRows = takeoffBookEntryItemRows.filter((r) => r.templateId.trim() !== '')
    if (validRows.length === 0) return
    setSavingTakeoffBookEntry(true)
    setError(null)
    if (editingTakeoffBookEntry) {
      const { error: updateErr } = await supabase
        .from('takeoff_book_entries')
        .update({ fixture_name: fixtureName, alias_names: aliasNames })
        .eq('id', editingTakeoffBookEntry.id)
      if (updateErr) {
        setError(updateErr.message)
        setSavingTakeoffBookEntry(false)
        return
      }
      const { error: deleteErr } = await supabase
        .from('takeoff_book_entry_items')
        .delete()
        .eq('entry_id', editingTakeoffBookEntry.id)
      if (deleteErr) {
        setError(deleteErr.message)
        setSavingTakeoffBookEntry(false)
        return
      }
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i]
        if (!row) continue
        const { error: insertErr } = await supabase.from('takeoff_book_entry_items').insert({
          entry_id: editingTakeoffBookEntry.id,
          template_id: row.templateId,
          stage: row.stage,
          sequence_order: i,
        })
        if (insertErr) {
          setError(insertErr.message)
          setSavingTakeoffBookEntry(false)
          return
        }
      }
      await loadTakeoffBookEntries(takeoffBookEntriesVersionId)
      closeTakeoffBookEntryForm()
    } else {
      const maxSeq = takeoffBookEntries.length === 0 ? 0 : Math.max(...takeoffBookEntries.map((e) => e.sequence_order), 0)
      const { data: insertedEntry, error: insertEntryErr } = await supabase
        .from('takeoff_book_entries')
        .insert({
          version_id: takeoffBookEntriesVersionId,
          fixture_name: fixtureName,
          alias_names: aliasNames,
          sequence_order: maxSeq + 1,
        })
        .select('id')
        .single()
      if (insertEntryErr || !insertedEntry) {
        setError(insertEntryErr?.message ?? 'Failed to create entry')
        setSavingTakeoffBookEntry(false)
        return
      }
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i]
        if (!row) continue
        const { error: insertItemErr } = await supabase.from('takeoff_book_entry_items').insert({
          entry_id: insertedEntry.id,
          template_id: row.templateId,
          stage: row.stage,
          sequence_order: i,
        })
        if (insertItemErr) {
          setError(insertItemErr.message)
          setSavingTakeoffBookEntry(false)
          return
        }
      }
      await loadTakeoffBookEntries(takeoffBookEntriesVersionId)
      closeTakeoffBookEntryForm()
    }
    setSavingTakeoffBookEntry(false)
  }

  async function deleteTakeoffBookEntry(entry: TakeoffBookEntryWithItems) {
    const n = entry.items.length
    if (!confirm(`Delete "${entry.fixture_name ?? ''}" and its ${n} template/stage pair(s) from this takeoff book?`)) return
    const { error: err } = await supabase.from('takeoff_book_entries').delete().eq('id', entry.id)
    if (err) setError(err.message)
    else if (takeoffBookEntriesVersionId) await loadTakeoffBookEntries(takeoffBookEntriesVersionId)
  }

  return (
    <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginTop: '1.5rem' }}>
            <div>
              <button
                type="button"
                onClick={() => setTakeoffBookSectionOpen((prev) => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  margin: 0,
                  marginBottom: takeoffBookSectionOpen ? '0.75rem' : 0,
                  padding: 0,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 600,
                }}
              >
                <span style={{ fontSize: '0.75rem' }}>{takeoffBookSectionOpen ? '▼' : '▶'}</span>
                Takeoff book
              </button>
              {takeoffBookSectionOpen && (
              <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
                {takeoffBookVersions.map((v) => (
                  <span
                    key={v.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.35rem 0.5rem',
                      background: takeoffBookEntriesVersionId === v.id ? 'var(--bg-blue-200)' : 'var(--bg-muted)',
                      border: takeoffBookEntriesVersionId === v.id ? '1px solid #3b82f6' : '1px solid var(--border-strong)',
                      borderRadius: 4,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => { setTakeoffBookEntriesVersionId(v.id); loadTakeoffBookEntries(v.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: takeoffBookEntriesVersionId === v.id ? 600 : 400, padding: 0 }}
                    >
                      {v.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditTakeoffBookVersion(v)}
                      style={{ padding: '0.15rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
                      title="Edit version name"
                    >
                      ✎
                    </button>
                    {v.name !== 'Default' && (
                      <button
                        type="button"
                        onClick={() => deleteTakeoffBookVersion(v)}
                        style={{ padding: '0.15rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-red-800)', fontSize: '0.875rem' }}
                        title="Delete version"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
                <button
                  type="button"
                  onClick={openNewTakeoffBookVersion}
                  style={{ marginLeft: 'auto', padding: '0.35rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  Add version
                </button>
              </div>
              {takeoffBookEntriesVersionId && (
                <>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Entries</h4>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ background: 'var(--bg-subtle)' }}>
                        <tr>
                          <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Fixture or Tie-in</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Assembly</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Stage</th>
                          <th style={{ padding: '0.5rem', width: 60, borderBottom: '1px solid var(--border)' }} />
                        </tr>
                      </thead>
                      <tbody>
                        {takeoffBookEntries.map((entry) => (
                          <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.5rem' }}>{entry.fixture_name ?? ''}{entry.alias_names?.length ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>also: {entry.alias_names.join(', ')}</span>
                            ) : null}</td>
                            <td style={{ padding: '0.5rem' }}>{entry.items.length === 0 ? '—' : entry.items.map((i) => materialTemplates.find((t) => t.id === i.template_id)?.name ?? i.template_id).join(', ')}</td>
                            <td style={{ padding: '0.5rem' }}>{entry.items.length === 0 ? '—' : entry.items.map((i) => STAGE_LABELS[i.stage as TakeoffStage] ?? i.stage).join(', ')}</td>
                            <td style={{ padding: '0.5rem' }}>
                              <button type="button" onClick={() => openEditTakeoffBookEntry(entry)} style={{ padding: '0.15rem', background: 'none', border: 'none', cursor: 'pointer' }} title="Edit">✎</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    onClick={openNewTakeoffBookEntry}
                    style={{ marginTop: '0.5rem', padding: '0.35rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                  >
                    Add entry
                  </button>
                </>
              )}
              </>
              )}
            </div>
          </div>
          {takeoffBookVersionFormOpen && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50,
              }}
              onClick={closeTakeoffBookVersionForm}
            >
              <div
                style={{ background: 'var(--surface)', borderRadius: 8, padding: '1.5rem', minWidth: 320, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ margin: '0 0 1rem' }}>{editingTakeoffBookVersion ? 'Edit version' : 'New version'}</h3>
                <form onSubmit={saveTakeoffBookVersion}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Name</label>
                  <input
                    type="text"
                    value={takeoffBookVersionNameInput}
                    onChange={(e) => setTakeoffBookVersionNameInput(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
                    placeholder="e.g. 2025 Standard"
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={closeTakeoffBookVersionForm} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                    <button type="submit" disabled={savingTakeoffBookVersion} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{savingTakeoffBookVersion ? 'Saving…' : 'Save'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {takeoffBookEntryFormOpen && takeoffBookEntriesVersionId && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50,
              }}
              onClick={closeTakeoffBookEntryForm}
            >
              <div
                style={{ background: 'var(--surface)', borderRadius: 8, padding: '1.5rem', minWidth: 360, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ margin: '0 0 1rem' }}>{editingTakeoffBookEntry ? 'Edit entry' : 'New entry'}</h3>
                <form onSubmit={saveTakeoffBookEntry}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Fixture or Tie-in</label>
                  <input
                    type="text"
                    value={takeoffBookEntryFixtureName}
                    onChange={(e) => setTakeoffBookEntryFixtureName(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginBottom: '0.75rem', boxSizing: 'border-box' }}
                    placeholder="e.g. Toilet"
                  />
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Additional names (optional)</label>
                  <input
                    type="text"
                    value={takeoffBookEntryAliasNames}
                    onChange={(e) => setTakeoffBookEntryAliasNames(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginBottom: '0.25rem', boxSizing: 'border-box' }}
                    placeholder="e.g. WC, Commode"
                  />
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>If any of these match a count row's Fixture or Tie-in, these assemblies and stages are applied.</p>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Assembly / Stage</label>
                    {takeoffBookEntryItemRows.map((row, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                        <select
                          value={row.templateId}
                          onChange={(e) => setTakeoffBookEntryItemRows((prev) => prev.map((r, i) => (i === idx ? { ...r, templateId: e.target.value } : r)))}
                          style={{ flex: '1 1 140px', minWidth: 120, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }}
                        >
                          <option value="">— Select assembly —</option>
                          {materialTemplates.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        <select
                          value={row.stage}
                          onChange={(e) => setTakeoffBookEntryItemRows((prev) => prev.map((r, i) => (i === idx ? { ...r, stage: e.target.value as TakeoffStage } : r)))}
                          style={{ flex: '0 0 auto', minWidth: 100, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }}
                        >
                          {(['rough_in', 'top_out', 'trim_set'] as const).map((s) => (
                            <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setTakeoffBookEntryItemRows((prev) => prev.filter((_, i) => i !== idx))}
                          disabled={takeoffBookEntryItemRows.length <= 1}
                          style={{ padding: '0.5rem', background: 'var(--bg-red-tint)', border: '1px solid #fecaca', borderRadius: 4, cursor: takeoffBookEntryItemRows.length <= 1 ? 'not-allowed' : 'pointer', color: 'var(--text-red-800)', opacity: takeoffBookEntryItemRows.length <= 1 ? 0.6 : 1 }}
                          title="Remove"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setTakeoffBookEntryItemRows((prev) => [...prev, { templateId: '', stage: 'rough_in' }])}
                      style={{ marginTop: '0.25rem', padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Add assembly & stage
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      {editingTakeoffBookEntry && (
                        <button
                          type="button"
                          onClick={async () => {
                            const n = editingTakeoffBookEntry.items?.length ?? 0
                            if (!confirm(`Delete "${editingTakeoffBookEntry.fixture_name ?? ''}" and its ${n} template/stage pair(s) from this takeoff book?`)) return
                            await deleteTakeoffBookEntry(editingTakeoffBookEntry)
                            closeTakeoffBookEntryForm()
                          }}
                          style={{ padding: '0.5rem 1rem', background: 'var(--bg-red-tint)', color: 'var(--text-red-800)', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" onClick={closeTakeoffBookEntryForm} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                      <button type="submit" disabled={savingTakeoffBookEntry || !takeoffBookEntryFixtureName.trim() || !takeoffBookEntryItemRows.some((r) => r.templateId.trim() !== '')} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{savingTakeoffBookEntry ? 'Saving…' : 'Save'}</button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
    </>
  )
}
