import { useState } from 'react'
import { developmentPickerOptions, type JobFormDevelopmentRow } from '../../lib/jobs/jobDevelopments'
import DevelopmentHouseIcon from '../icons/DevelopmentHouseIcon'

/**
 * The Development picker on the Bid form's Links row (punch list #208, v2.6019), beside Project:
 * the same select and inline *+ New development* as Edit Job's `JobFormDevelopmentEditor`, over
 * the same kernel (`developmentPickerOptions`), drawn small to sit in the header cluster the
 * Project link lives in. A development is a group for finding and reviewing, like the job's;
 * pricing, the cover letter and the robots read nothing from it.
 */
export function BidFormDevelopmentPicker({
  developmentId,
  setDevelopmentId,
  developments,
  onCreateDevelopment,
  canCreate,
}: {
  /** '' = none. */
  developmentId: string
  setDevelopmentId: (v: string) => void
  developments: JobFormDevelopmentRow[]
  /** Inserts a name-only development; resolves the new id, or null on failure (the hook toasts). */
  onCreateDevelopment: (name: string) => Promise<string | null>
  /** Office roles may add one; an estimator picks from the list. */
  canCreate: boolean
}) {
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  async function submitNew() {
    if (creating) return
    setCreating(true)
    try {
      const id = await onCreateDevelopment(newName)
      if (id) {
        setDevelopmentId(id)
        setNewName('')
        setNewOpen(false)
      }
    } finally {
      setCreating(false)
    }
  }

  const selectStyle = {
    width: '100%',
    padding: '0.2rem 0.45rem',
    fontSize: '0.75rem',
    border: `1px solid ${developmentId ? 'var(--border-strong)' : 'var(--border)'}`,
    borderRadius: 4,
    background: 'var(--surface)',
    color: developmentId ? 'var(--text-strong)' : 'var(--text-muted)',
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  }

  return (
    <div
      className="bid-form-development-link"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.15rem', minWidth: 0, maxWidth: '15rem', flex: '1 1 auto' }}
      title="Development — the site this bid is one piece of, so its bids and jobs read as one thing. A group for finding and reviewing."
    >
      <label
        htmlFor="bid-form-development-select"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-faint)' }}
      >
        <DevelopmentHouseIcon size={10} style={{ flexShrink: 0 }} />
        Development
      </label>
      <div style={{ width: '100%', minWidth: 0 }}>
        <select
          id="bid-form-development-select"
          value={developmentId}
          onChange={(e) => setDevelopmentId(e.target.value)}
          style={selectStyle}
        >
          <option value="">None</option>
          {developmentPickerOptions(developments, developmentId || null).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      {canCreate ? (
        newOpen ? (
          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', width: '100%' }}>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void submitNew()
                }
                if (e.key === 'Escape') {
                  e.stopPropagation()
                  setNewOpen(false)
                  setNewName('')
                }
              }}
              placeholder="Development name…"
              aria-label="New development name"
              autoFocus
              style={{ flex: '1 1 7rem', minWidth: '6rem', padding: '0.2rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.75rem', fontFamily: 'inherit' }}
            />
            <button
              type="button"
              onClick={() => void submitNew()}
              disabled={creating}
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', border: 'none', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', borderRadius: 4, cursor: creating ? 'default' : 'pointer', fontWeight: 500, opacity: creating ? 0.6 : 1, fontFamily: 'inherit' }}
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => {
                setNewOpen(false)
                setNewName('')
              }}
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', background: 'var(--bg-subtle)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-700)', fontFamily: 'inherit' }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            style={{ padding: '0.1rem 0.45rem', fontSize: '0.7rem', border: '1px dashed var(--border-strong)', background: 'none', borderRadius: 4, cursor: 'pointer', color: 'var(--text-link)', fontWeight: 500, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
          >
            + New development
          </button>
        )
      ) : null}
    </div>
  )
}
