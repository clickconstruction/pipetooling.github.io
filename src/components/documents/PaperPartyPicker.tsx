import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { PARTY_CHIPS, partyFindAsksCustomers, partyFindHint, partyRows, type PartyChip, type PartyCustomer, type PartyLists, type PartyPick, type PartyRosterPerson, type PartyRow } from '../../lib/documents/paperPartyPick'
import { readPartyShortLists, searchPartyCustomers, type PartyShortLists } from '../../lib/documents/paperPartyIo'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import OfflineRetryPanel from '../OfflineRetryPanel'

/**
 * Send a paper's second window: **Who is it with?** (punch list #403, step 3). It finds a person or a company: the
 * roster, the supply houses and their reps, and the customers with the people on file there. Its last row is **Someone
 * not in any list**. One pick names both the party and who signs, and the Send for signature window opens next.
 *
 * The short lists are read once when the window opens. A customer is asked of the database as the office types, once
 * the typing rests. Nothing is written here. People → Contracts keeps its own roster picker.
 */

const TAG: Record<PartyRow['tone'], CSSProperties> = {
  people: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
  outside: { background: 'var(--bg-teal-tint)', color: 'var(--text-teal-700)' },
  plain: { background: 'transparent', color: 'var(--text-700)', boxShadow: 'inset 0 0 0 1px var(--border-strong)' },
}
const tagBase: CSSProperties = { display: 'inline-block', fontSize: '0.6875rem', fontWeight: 600, padding: '0.05rem 0.45rem', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0 }
const chipBase: CSSProperties = { fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 500, padding: '0.25rem 0.6rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer', whiteSpace: 'nowrap' }
const chipOn: CSSProperties = { ...chipBase, fontWeight: 700, background: 'var(--bg-blue-tint)', border: '1px solid #3b82f6', color: 'var(--text-blue-700)' }

export function PaperPartyPicker({
  documentName,
  roster,
  busy,
  onPick,
  onClose,
}: {
  documentName: string
  /** The living roster, read with the Contract Book when Send a paper was pressed. */
  roster: ReadonlyArray<PartyRosterPerson>
  /** True while a pick is being read for the next window: the rows wait. */
  busy: boolean
  onPick: (pick: PartyPick) => void
  onClose: () => void
}) {
  const [typed, setTyped] = useState('')
  const [chip, setChip] = useState<PartyChip>('all')
  const [short, setShort] = useState<PartyShortLists | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [customers, setCustomers] = useState<PartyCustomer[]>([])
  const [finding, setFinding] = useState(false)

  // The lists the window holds whole, read when it opens. A read that fails says so and offers to read again.
  useEffect(() => {
    let live = true
    setFailure(null)
    readPartyShortLists().then(
      (read) => live && setShort(read),
      (e: unknown) => live && setFailure(recoveryFailureFromError(e, 'The customers and supply houses did not read.')),
    )
    return () => {
      live = false
    }
  }, [attempt])

  // Customers are too many to hold: the find box asks for them by name once the typing rests.
  useEffect(() => {
    if (!partyFindAsksCustomers(typed, chip)) {
      setCustomers([])
      setFinding(false)
      return
    }
    let live = true
    setFinding(true)
    const timer = setTimeout(() => {
      searchPartyCustomers(typed).then(
        (found) => {
          if (!live) return
          setCustomers(found)
          setFinding(false)
        },
        // The roster and the supply houses still list: a customer search that fails leaves them out, never the window.
        () => {
          if (!live) return
          setCustomers([])
          setFinding(false)
        },
      )
    }, 250)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [typed, chip])

  const lists = useMemo<PartyLists>(() => ({ roster, customerPeople: short?.customerPeople ?? [], supplyHouses: short?.supplyHouses ?? [], reps: short?.reps ?? [], customers }), [roster, short, customers])
  const rows = useMemo(() => partyRows(lists, typed, chip), [lists, typed, chip])
  const hint = partyFindHint(typed, chip)

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 714, paddingTop: 'var(--app-top-chrome, 0px)' }}
      onClick={() => {
        if (!busy) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Send ${documentName}: who is it with?`}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 8, padding: '1rem 1.1rem', width: 'min(92vw, 440px)', maxHeight: 'min(80vh, 100%)', overflow: 'auto', boxSizing: 'border-box', boxShadow: '0 10px 30px rgba(0,0,0,0.18)' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', lineHeight: 1.35 }}>Send {documentName}</h3>
          <button type="button" onClick={onClose} aria-label="Close" style={{ padding: '0.1rem 0.3rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.15rem', lineHeight: 1, color: 'var(--text-muted)', flexShrink: 0 }}>
            ×
          </button>
        </div>
        <p style={{ margin: '0.25rem 0 0.6rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Who is it with? Search a person or a company.</p>
        <input
          type="search"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Find a person or a company"
          aria-label="Find a person or a company"
          autoFocus
          style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.875rem', background: 'var(--surface)', color: 'var(--text-strong)' }}
        />
        <div role="group" aria-label="Who to list" style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', margin: '0.5rem 0 0.35rem' }}>
          {PARTY_CHIPS.map((c) => (
            <button key={c.key} type="button" aria-pressed={chip === c.key} style={chip === c.key ? chipOn : chipBase} onClick={() => setChip(c.key)}>
              {c.label}
            </button>
          ))}
        </div>
        {failure ? <OfflineRetryPanel failure={failure} onRetry={() => setAttempt((n) => n + 1)} surface="paper-party-picker" idempotent /> : null}
        {hint || finding ? (
          <p style={{ margin: '0.2rem 0', fontSize: '0.75rem', color: 'var(--text-muted)' }} data-testid="paper-party-hint">
            {finding ? 'Finding customers…' : hint}
          </p>
        ) : null}
        <div>
          {rows.map((row) => (
            <button
              key={row.key}
              type="button"
              disabled={busy}
              onClick={() => onPick(row.pick)}
              data-testid="paper-party-row"
              className="paper-party-row"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', width: '100%', padding: '0.5rem 0.55rem', border: 'none', borderBottom: '1px solid var(--border)', cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', textAlign: 'left', color: 'var(--text-strong)' }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600, overflowWrap: 'anywhere' }}>{row.title}</span>
                <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{row.sub}</span>
              </span>
              <span style={{ ...tagBase, ...TAG[row.tone] }}>{row.tag}</span>
            </button>
          ))}
        </div>
        <p style={{ margin: '0.6rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Someone typed in can be added to a list later, from their line on Agreements.</p>
      </div>
    </div>
  )
}

export default PaperPartyPicker
