import { letterRecipients, refusedWords, type LegalMatterPersonLike, type LetterRecipient } from '../../../lib/legal/legalMatterPeople'

/**
 * A letter's recipients from the matter's people (punch list #174, v2.6705), in the To chip's shape (#118): the To
 * rows as presses, the copies beside them, and the rows that refuse greyed with why — a *never* says its reason, a row
 * with no email and no address has nowhere to go. A press on a To fills the letter's recipient. Since v2.6741 each copy
 * chip is a press that puts the person on the letter's *Copies to* line or takes them off (every copy starts on).
 */
export default function LegalLetterRecipients({ people, pickedName, onPick, copies, onToggleCopy }: {
  people: ReadonlyArray<LegalMatterPersonLike>
  /** The recipient the letter names now, so its chip reads as the pick. */
  pickedName: string
  onPick: (person: LegalMatterPersonLike) => void
  /** v2.6741: the people on the letter's *Copies to* line, by id; with `onToggleCopy`, each copy chip is a press that puts them on or takes them off. */
  copies?: ReadonlySet<string>
  onToggleCopy?: (person: LegalMatterPersonLike) => void
}) {
  if (!people.length) return null
  const r = letterRecipients(people)
  const chip = (row: LetterRecipient, kind: 'to' | 'copy') => {
    const refused = row.refused != null
    const on = kind === 'to' && !refused && row.person.name.trim().toLowerCase() === pickedName.trim().toLowerCase()
    const base = { display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: 999, padding: '2px 10px', fontSize: '0.78rem', font: 'inherit', background: 'var(--surface)', color: 'var(--text-base)' } as const
    if (refused) return <span key={row.person.id} data-legal-recipient={row.person.id} data-legal-recipient-refused title={row.refused ?? undefined} style={{ ...base, color: 'var(--text-muted)', textDecoration: 'line-through' }}>{row.label}</span>
    if (kind === 'copy') {
      if (!onToggleCopy || row.person.use !== 'copies') return <span key={row.person.id} data-legal-recipient={row.person.id} style={base}>{row.label}</span>
      const onLetter = copies?.has(row.person.id) ?? false
      return (
        <button key={row.person.id} type="button" data-legal-recipient={row.person.id} data-legal-copy-on={onLetter ? 'yes' : 'no'} aria-pressed={onLetter} title={onLetter ? 'On the letter’s Copies to line. Press to take them off.' : 'Not on the letter. Press to put them on its Copies to line.'} onClick={() => onToggleCopy(row.person)} style={{ ...base, cursor: 'pointer', borderColor: onLetter ? 'var(--text-700)' : 'var(--border)', background: onLetter ? 'var(--bg-muted)' : 'var(--surface)', color: onLetter ? 'var(--text)' : 'var(--text-muted)', fontWeight: onLetter ? 600 : 400, textDecoration: onLetter ? 'none' : 'line-through' }}>
          {row.label}
        </button>
      )
    }
    return (
      <button key={row.person.id} type="button" data-legal-recipient={row.person.id} aria-pressed={on} onClick={() => onPick(row.person)} style={{ ...base, cursor: 'pointer', borderColor: on ? 'var(--text-blue-700)' : 'var(--border-blue)', background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: 'var(--text-blue-700)', fontWeight: on ? 600 : 400 }}>
        {row.label}
      </button>
    )
  }
  const refusals = refusedWords([...r.to, ...r.copies, ...r.never])
  return (
    <div data-legal-letter-recipients style={{ margin: '0 0 0.65rem', fontSize: '0.8rem', display: 'grid', gap: 6 }}>
      <span style={{ fontWeight: 500 }}>
        From the matter’s people{' '}
        <span style={{ display: 'inline-block', marginLeft: '0.3rem', padding: '0.05rem 0.45rem', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 700, background: 'var(--bg-blue-tint)', color: 'var(--text-link)' }}>Legal desk</span>
      </span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--text-muted)', minWidth: 44 }}>To</span>
        {r.to.length ? r.to.map((row) => chip(row, 'to')) : <span style={{ color: 'var(--text-muted)' }}>nobody marked for letters</span>}
      </div>
      {r.copies.length ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', minWidth: 44 }}>Copies</span>
          {r.copies.map((row) => chip(row, 'copy'))}
          {onToggleCopy ? <span data-legal-copies-count style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>{(() => { const n = r.copies.filter((row) => copies?.has(row.person.id)).length; return n ? `${n} on the letter’s Copies to line` : 'nobody on the letter’s Copies to line' })()}</span> : null}
        </div>
      ) : null}
      {r.never.length ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', minWidth: 44 }}>Never</span>
          {r.never.map((row) => chip(row, 'copy'))}
        </div>
      ) : null}
      {refusals.length ? <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>{refusals.join(' ')}</div> : null}
    </div>
  )
}
