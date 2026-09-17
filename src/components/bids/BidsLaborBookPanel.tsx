/**
 * Bids → Labor: the Labor book panel and its two book dialogs (Pricing decomposition PR 3,
 * v2.3550). Moved verbatim out of `BidsLaborTab` (region L6 of
 * `docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`): the book chips with the browsed book's
 * entries table, the New / Edit book form, and the entry form with its *Reads as* and
 * *Hours are per* selectors.
 *
 * Every write stays in the tab — this component only renders and reports. Two book
 * selections stay separate on purpose (map quirk 15): `browsedVersionId` is the book being
 * read here; the bid's applied book (`selectedLaborBookVersionId`) is the HOURS section's and
 * is not touched from this panel. The add-missing-fixture dialog stays in the tab too: it
 * belongs to the apply-hours flow, which re-runs `applyLaborBookHoursToEstimate` after saving.
 */
import type { FormEvent } from 'react'
import { asLaborEntryKind, asLaborUnit, LABOR_UNIT_WORDS, type LaborEntryKind, type LaborUnit } from '../../lib/bids/laborBookMatch'
import type { LaborBookEntryWithFixture, LaborBookVersion } from '../../lib/bids/bidPricingEngineTypes'

export type LaborBookPanelBook = {
  sectionOpen: boolean
  onToggleSection: () => void
  versions: LaborBookVersion[]
  entries: LaborBookEntryWithFixture[]
  /** The book being READ in this panel — not the bid's applied book (map quirk 15). */
  browsedVersionId: string | null
  onBrowseVersion: (versionId: string) => void
  onAddBook: () => void
  onEditBook: (version: LaborBookVersion) => void
  onAddEntry: () => void
  onEditEntry: (entry: LaborBookEntryWithFixture) => void
}

export type LaborBookVersionForm = {
  open: boolean
  editing: LaborBookVersion | null
  nameInput: string
  onNameChange: (value: string) => void
  saving: boolean
  onSubmit: (e: FormEvent) => void | Promise<void>
  onClose: () => void
  /** Resolves true when the delete went through, so the form closes itself. */
  onDelete: (version: LaborBookVersion) => Promise<boolean>
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

export function BidsLaborBookPanel({
  book,
  versionForm,
  entryForm,
}: {
  book: LaborBookPanelBook
  versionForm: LaborBookVersionForm
  entryForm: LaborBookEntryForm
}) {
  // Local consts so the `editing && …` guards narrow inside the delete callbacks, the way
  // they did when this JSX lived in the tab.
  const editingVersion = versionForm.editing
  const editingEntry = entryForm.editing
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
        {book.versions.map((v) => (
          <span
            key={v.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.35rem 0.5rem',
              background: book.browsedVersionId === v.id ? 'var(--bg-blue-200)' : 'var(--bg-muted)',
              border: book.browsedVersionId === v.id ? '1px solid #3b82f6' : '1px solid var(--border-strong)',
              borderRadius: 4,
            }}
          >
            <button
              type="button"
              onClick={() => book.onBrowseVersion(v.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: book.browsedVersionId === v.id ? 600 : 400, padding: 0 }}
            >
              {v.name}
            </button>
            <button
              type="button"
              onClick={() => book.onEditBook(v)}
              style={{ padding: '0.15rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
              title="Edit book name"
            >
              ✎
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={book.onAddBook}
          style={{ marginLeft: 'auto', padding: '0.35rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
        >
          Add book
        </button>
      </div>
      {book.browsedVersionId && (
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
                  <th style={{ padding: '0.5rem', width: 60, borderBottom: '1px solid var(--border)' }} />
                </tr>
              </thead>
              <tbody>
                {book.entries.map((entry) => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.5rem' }}>
                      {entry.fixture_types?.name ?? ''}
                      {asLaborEntryKind(entry.kind) === 'task' ? (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '0.35rem', border: '1px solid var(--border)', borderRadius: 999, padding: '0 6px' }}>task · fixed hours</span>
                      ) : asLaborUnit(entry.unit) === 'per_100ft' ? (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '0.35rem', border: '1px solid var(--border)', borderRadius: 999, padding: '0 6px' }}>per 100 ft</span>
                      ) : null}
                      {entry.alias_names?.length ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>also: {entry.alias_names.join(', ')}</span>
                      ) : null}
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(entry.rough_in_hrs)}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(entry.top_out_hrs)}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(entry.trim_set_hrs)}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <button type="button" onClick={() => book.onEditEntry(entry)} style={{ padding: '0.15rem', background: 'none', border: 'none', cursor: 'pointer' }} title="Edit">✎</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={book.onAddEntry}
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
  {versionForm.open && (
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
      onClick={versionForm.onClose}
    >
      <div role="dialog" aria-modal="true"
        style={{ background: 'var(--surface)', borderRadius: 8, padding: '1.5rem', minWidth: 320, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 1rem' }}>{editingVersion ? 'Edit book' : 'New book'}</h3>
        <form onSubmit={versionForm.onSubmit}>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Name</label>
          <input
            type="text"
            value={versionForm.nameInput}
            onChange={(e) => versionForm.onNameChange(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
            placeholder="e.g. Default"
          />
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              {editingVersion && editingVersion.name !== 'Default' && (
                <button
                  type="button"
                  onClick={async () => {
                    if (await versionForm.onDelete(editingVersion)) versionForm.onClose()
                  }}
                  style={{ padding: '0.5rem 1rem', background: 'var(--bg-red-tint)', color: 'var(--text-red-800)', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
                >
                  Delete version
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={versionForm.onClose} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={versionForm.saving} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{versionForm.saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )}
  {entryForm.open && book.browsedVersionId && (
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
