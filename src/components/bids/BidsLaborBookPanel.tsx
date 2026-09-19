/**
 * Bids → Labor: the Labor book panel and its entry dialog (Pricing decomposition PR 3,
 * v2.3550; one book per trade since the Labor refresh PR 6b, v2.3597). Region L6 of
 * `docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`.
 *
 * There is no picker: the trade's one book — 🤖 Robot Default — is the book, and a person
 * does not name or delete a book any more. The entries table carries a *Hours from* column
 * (`lib/bids/laborEntryProvenance.ts`: robot · human · override · learned · calibrated) and
 * *Reset to robot* where a person's number sits over the robot's. Every write stays in the
 * tab — this component only renders and reports. The add-missing-fixture dialog stays in the
 * tab too: it belongs to the apply-hours flow.
 */
import type { FormEvent } from 'react'
import { asLaborEntryKind, asLaborUnit, LABOR_UNIT_WORDS, type LaborEntryKind, type LaborUnit } from '../../lib/bids/laborBookMatch'
import { canResetToRobot, entryProvenance, stageHoursWords, type LaborBookRights, type ProvenanceKind } from '../../lib/bids/laborEntryProvenance'
import type { LaborBookEntryWithFixture } from '../../lib/bids/bidPricingEngineTypes'

export type LaborBookPanelBook = {
  sectionOpen: boolean
  onToggleSection: () => void
  /** The trade's one book; null while the trade has none (the robot seeds it). */
  book: { name: string; tradeName: string | null } | null
  /** "26 entries · 46 aliases · 9 overrides" (`bookSummaryWords`). */
  summaryWords: string
  entries: LaborBookEntryWithFixture[]
  rights: LaborBookRights
  userId: string | null
  nameOf: (userId: string) => string | null | undefined
  onAddEntry: () => void
  onEditEntry: (entry: LaborBookEntryWithFixture) => void
  /** Writes the robot's own numbers back onto the entry (the trigger clears the stamp). */
  onResetToRobot: (entry: LaborBookEntryWithFixture) => void | Promise<void>
  resettingId: string | null
}

export type LaborBookEntryForm = {
  open: boolean
  editing: LaborBookEntryWithFixture | null
  /** The tab's page-level error line, shown inside this dialog while it is open. */
  error: string | null
  fixtureName: string
  onFixtureNameChange: (value: string) => void
  fixtureTypes: Array<{ id: string; name: string }>
  aliasNames: string
  onAliasNamesChange: (value: string) => void
  kind: LaborEntryKind
  onKindChange: (kind: LaborEntryKind) => void
  unit: LaborUnit
  onUnitChange: (unit: LaborUnit) => void
  roughIn: string
  onRoughInChange: (value: string) => void
  topOut: string
  onTopOutChange: (value: string) => void
  trimSet: string
  onTrimSetChange: (value: string) => void
  saving: boolean
  onSubmit: (e: FormEvent) => void | Promise<void>
  onClose: () => void
  onDelete: (entry: LaborBookEntryWithFixture) => Promise<boolean>
}

const CHIP_TONE: Record<ProvenanceKind, { border: string; color: string }> = {
  robot: { border: '#7c5cff', color: 'var(--text-strong)' },
  human: { border: 'var(--border-strong)', color: 'var(--text-muted)' },
  override: { border: '#2563eb', color: 'var(--text-blue-700)' },
  learned: { border: '#16a34a', color: 'var(--text-green-700)' },
  calibrated: { border: '#f59e0b', color: 'var(--text-amber-700)' },
}

const tag = { fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '0.35rem', border: '1px solid var(--border)', borderRadius: 999, padding: '0 6px' } as const

export function BidsLaborBookPanel({ book, entryForm }: { book: LaborBookPanelBook; entryForm: LaborBookEntryForm }) {
  // A local const so the `editing && …` guard narrows inside the delete callback.
  const editingEntry = entryForm.editing
  const canEdit = book.rights.edit && book.book != null
  return (
    <>
  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginTop: '1.5rem' }}>
    <div>
      <button
        type="button"
        onClick={() => book.onToggleSection()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          margin: 0,
          marginBottom: book.sectionOpen ? '0.75rem' : 0,
          padding: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1rem',
          fontWeight: 600,
        }}
      >
        <span style={{ fontSize: '0.75rem' }}>{book.sectionOpen ? '▼' : '▶'}</span>
        Labor book
      </button>
      {book.sectionOpen && (
      <>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.875rem' }} data-testid="labor-book-head">
        {book.book ? (
          <>
            <b>{book.book.name}</b>
            {book.book.tradeName ? <span style={{ color: 'var(--text-muted)' }}>· {book.book.tradeName}</span> : null}
            <span style={{ color: 'var(--text-muted)' }}>· {book.summaryWords}</span>
          </>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>This trade has no labor book yet — the robot seeds one.</span>
        )}
        {canEdit ? (
          <button
            type="button"
            onClick={book.onAddEntry}
            style={{ marginLeft: 'auto', padding: '0.35rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
          >
            Add entry
          </button>
        ) : book.book && !book.rights.edit ? (
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>read-only for your role</span>
        ) : null}
      </div>
      {book.book && (
        <>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Entries (hrs per stage)</h4>
          <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'var(--bg-subtle)' }}>
                <tr>
                  <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Fixture or Tie-in</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Rough In (hrs)</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Top Out (hrs)</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Trim Set (hrs)</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Hours from</th>
                  <th style={{ padding: '0.5rem', width: 60, borderBottom: '1px solid var(--border)' }} />
                </tr>
              </thead>
              <tbody>
                {book.entries.map((entry) => {
                  const prov = entryProvenance(entry, book.nameOf)
                  const tone = CHIP_TONE[prov.kind]
                  const resettable = canResetToRobot(entry, book.rights, book.userId)
                  return (
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.5rem' }}>
                      {entry.fixture_types?.name ?? ''}
                      {asLaborEntryKind(entry.kind) === 'task' ? (
                        <span style={tag}>task · fixed hours</span>
                      ) : asLaborUnit(entry.unit) === 'per_100ft' ? (
                        <span style={tag}>per 100 ft</span>
                      ) : null}
                      {entry.alias_names?.length ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>also: {entry.alias_names.join(', ')}</span>
                      ) : null}
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(entry.rough_in_hrs)}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(entry.top_out_hrs)}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(entry.trim_set_hrs)}</td>
                    <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                      <span
                        title={prov.title || undefined}
                        data-testid="labor-hours-from"
                        style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600, border: `1px solid ${tone.border}`, color: tone.color }}
                      >
                        {prov.words}
                      </span>
                      {resettable && prov.robotHours ? (
                        <button
                          type="button"
                          onClick={() => void book.onResetToRobot(entry)}
                          disabled={book.resettingId === entry.id}
                          title={`Back to the robot's ${stageHoursWords(prov.robotHours)}`}
                          style={{ marginLeft: '0.4rem', background: 'none', border: 'none', padding: 0, color: 'var(--text-blue-700)', cursor: 'pointer', font: 'inherit', fontSize: '0.75rem', fontWeight: 600 }}
                        >
                          {book.resettingId === entry.id ? 'Resetting…' : 'Reset to robot'}
                        </button>
                      ) : null}
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      {canEdit ? <button type="button" onClick={() => book.onEditEntry(entry)} style={{ padding: '0.15rem', background: 'none', border: 'none', cursor: 'pointer' }} title="Edit">✎</button> : null}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      </>
      )}
    </div>
  </div>
  {entryForm.open && book.book && (
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
      onClick={entryForm.onClose}
    >
      <div role="dialog" aria-modal="true"
        style={{ background: 'var(--surface)', borderRadius: 8, padding: '1.5rem', minWidth: 360, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 1rem' }}>{editingEntry ? 'Edit entry' : 'New entry'}</h3>
        {entryForm.error && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', borderRadius: 4, fontSize: '0.875rem' }}>
            {entryForm.error}
          </div>
        )}
        <form onSubmit={entryForm.onSubmit}>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Fixture or Tie-in *</label>
          <input
            type="text"
            list="labor-fixture-types"
            value={entryForm.fixtureName}
            onChange={(e) => entryForm.onFixtureNameChange(e.target.value)}
            required
            placeholder="Type or select fixture type..."
            autoComplete="off"
            style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginBottom: '0.75rem', boxSizing: 'border-box' }}
          />
          <datalist id="labor-fixture-types">
            {entryForm.fixtureTypes.map(ft => (
              <option key={ft.id} value={ft.name} />
            ))}
          </datalist>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Additional names (optional)</label>
          <input
            type="text"
            value={entryForm.aliasNames}
            onChange={(e) => entryForm.onAliasNamesChange(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginBottom: '0.25rem', boxSizing: 'border-box' }}
            placeholder="e.g. WC, Commode"
          />
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>If any of these match a count row's Fixture or Tie-in, this labor rate is applied.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div>
              <label htmlFor="labor-entry-kind" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Reads as</label>
              <select id="labor-entry-kind" value={entryForm.kind} onChange={(e) => entryForm.onKindChange(asLaborEntryKind(e.target.value))} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', background: 'var(--surface)', color: 'inherit' }}>
                <option value="fixture">Fixture · hours × count</option>
                <option value="task">Task · fixed hours for the line</option>
              </select>
            </div>
            <div>
              <label htmlFor="labor-entry-unit" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Hours are per</label>
              <select id="labor-entry-unit" value={entryForm.kind === 'task' ? 'each' : entryForm.unit} disabled={entryForm.kind === 'task'} onChange={(e) => entryForm.onUnitChange(asLaborUnit(e.target.value))} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', background: 'var(--surface)', color: 'inherit' }}>
                <option value="each">{LABOR_UNIT_WORDS.each} (one piece)</option>
                <option value="per_100ft">{LABOR_UNIT_WORDS.per_100ft} (footage rows)</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Rough In (hrs)</label>
              <input type="number" min={0} step={0.01} value={entryForm.roughIn} onChange={(e) => entryForm.onRoughInChange(e.target.value)} aria-label="Rough In hours for this labor book entry" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Top Out (hrs)</label>
              <input type="number" min={0} step={0.01} value={entryForm.topOut} onChange={(e) => entryForm.onTopOutChange(e.target.value)} aria-label="Top Out hours for this labor book entry" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Trim Set (hrs)</label>
              <input type="number" min={0} step={0.01} value={entryForm.trimSet} onChange={(e) => entryForm.onTrimSetChange(e.target.value)} aria-label="Trim Set hours for this labor book entry" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }} />
            </div>
          </div>
          {editingEntry && entryProvenance(editingEntry, book.nameOf).robotHours ? (
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              The robot's own numbers, {stageHoursWords(entryProvenance(editingEntry, book.nameOf).robotHours!)}, stay under yours — Reset to robot brings them back.
            </p>
          ) : null}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              {editingEntry && (
                <button
                  type="button"
                  onClick={async () => {
                    if (await entryForm.onDelete(editingEntry)) entryForm.onClose()
                  }}
                  style={{ padding: '0.5rem 1rem', background: 'var(--bg-red-tint)', color: 'var(--text-red-800)', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
                >
                  Delete
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={entryForm.onClose} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={entryForm.saving} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{entryForm.saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )}    </>
  )
}
