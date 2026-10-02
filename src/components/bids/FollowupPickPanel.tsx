import { useState, type CSSProperties } from 'react'
import {
  FOLLOWUP_QUICK_PICKS,
  FOLLOWUP_REASONS,
  followupDateIsPickable,
  followupDateLabel,
  followupQuickPickYmd,
  type FollowupPick,
} from '../../lib/bids/bidNextFollowup'
import { ymdAddDays } from '../../utils/dateUtils'

/**
 * The three questions after a call (v2.4420, punch list #80): **Call again**, **Ask for** and
 * **Waiting on**. Presentational: the caller holds the pick and does the write.
 *
 * Only **Call again** matters. No day picked saves the contact as it always was, and the bid
 * comes back in seven days. Who to ask for and what the bid waits on belong to a day, so those
 * two rows show once a day is picked.
 */

export type FollowupPickPerson = { id: string; name: string; phone: string | null; note: string | null }

type Props = {
  todayYmd: string
  value: FollowupPick
  onChange: (next: FollowupPick) => void
  /** People already on the customer. */
  people: ReadonlyArray<FollowupPickPerson>
  /** Add a person to the customer for good; absent = the bid has no customer to add one to. */
  onAddPerson?: (name: string, phone: string) => Promise<FollowupPickPerson | null>
  saving: boolean
  /** False = the questions only, inside a form that has its own Save (Edit Bid → Log contact…). */
  actions?: boolean
  saveLabel?: string
  onSave?: () => void
  onCancel?: () => void
  /** Said beside Save while no day is picked. */
  noDayHint: string
  /** Offer **No date**: the bid has a day and this takes it away. */
  onRemove?: () => void
}

const rowStyle: CSSProperties = { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.4rem' }
const labelStyle: CSSProperties = { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)', width: '5.4rem', flex: '0 0 auto' }

function chipStyle(on: boolean, dashed = false): CSSProperties {
  return {
    font: 'inherit',
    fontSize: '0.75rem',
    padding: '0.2rem 0.6rem',
    borderRadius: 999,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    border: on ? '1px solid #3b82f6' : `1px ${dashed ? 'dashed' : 'solid'} var(--border-strong)`,
    background: on ? '#3b82f6' : 'var(--surface)',
    color: on ? '#fff' : dashed ? 'var(--text-muted)' : 'var(--text-700)',
    fontWeight: on ? 600 : 400,
  }
}

export function FollowupPickPanel({ todayYmd, value, onChange, people, onAddPerson, saving, actions = true, saveLabel = 'Save', onSave, onCancel, noDayHint, onRemove }: Props) {
  const [dateOpen, setDateOpen] = useState(false)
  const [personOpen, setPersonOpen] = useState(false)
  const [personName, setPersonName] = useState('')
  const [personPhone, setPersonPhone] = useState('')
  const [addingPerson, setAddingPerson] = useState(false)

  const quick = FOLLOWUP_QUICK_PICKS.map((q) => ({ ...q, ymd: followupQuickPickYmd(q.key, todayYmd) }))
  const matchesQuick = quick.some((q) => q.ymd === value.ymd)
  const customPicked = value.ymd != null && !matchesQuick

  const setDay = (ymd: string | null) => {
    // Who and why belong to a day: clearing the day clears them.
    onChange(ymd ? { ...value, ymd } : { ymd: null, personId: null, personName: null, reason: null })
  }

  async function addPerson() {
    const name = personName.trim()
    if (!name || !onAddPerson || addingPerson) return
    setAddingPerson(true)
    try {
      const made = await onAddPerson(name, personPhone.trim())
      if (made) {
        onChange({ ...value, personId: made.id, personName: made.name })
        setPersonOpen(false)
        setPersonName('')
        setPersonPhone('')
      }
    } finally {
      setAddingPerson(false)
    }
  }

  const inputStyle: CSSProperties = { font: 'inherit', fontSize: '0.75rem', padding: '0.22rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-strong)' }

  return (
    <div role="group" aria-label="When to call again" style={actions ? { marginTop: '0.5rem', borderTop: '1px dashed var(--border-strong)', paddingTop: '0.35rem' } : undefined}>
      <div style={rowStyle}>
        <span style={labelStyle}>Call again</span>
        {quick.map((q) => (
          <button key={q.key} type="button" aria-pressed={value.ymd === q.ymd} title={followupDateLabel(q.ymd, todayYmd)} onClick={() => setDay(value.ymd === q.ymd ? null : q.ymd)} style={chipStyle(value.ymd === q.ymd)}>
            {q.label}
          </button>
        ))}
        {customPicked ? (
          <button type="button" aria-pressed title="Change the day" onClick={() => setDateOpen(true)} style={chipStyle(true)}>
            {followupDateLabel(value.ymd!, todayYmd)}
          </button>
        ) : null}
        {dateOpen ? (
          <input
            type="date"
            aria-label="Day to call again"
            autoFocus
            min={ymdAddDays(todayYmd, 1)}
            value={value.ymd ?? ''}
            onChange={(e) => {
              const ymd = e.target.value
              if (followupDateIsPickable(ymd, todayYmd)) setDay(ymd)
              else if (!ymd) setDay(null)
            }}
            onBlur={() => setDateOpen(false)}
            style={inputStyle}
          />
        ) : (
          <button type="button" onClick={() => setDateOpen(true)} style={chipStyle(false, true)}>
            pick a date
          </button>
        )}
        {onRemove ? (
          <button type="button" disabled={saving} onClick={onRemove} style={{ ...chipStyle(false, true), color: 'var(--text-red-800)' }}>
            No date
          </button>
        ) : null}
      </div>

      {value.ymd ? (
        <>
          <div style={rowStyle}>
            <span style={labelStyle}>Ask for</span>
            <button type="button" aria-pressed={value.personId == null} onClick={() => onChange({ ...value, personId: null, personName: null })} style={chipStyle(value.personId == null)}>
              Main line
            </button>
            {people.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={value.personId === p.id}
                title={[p.phone, p.note].filter(Boolean).join(' · ') || undefined}
                onClick={() => onChange({ ...value, personId: p.id, personName: p.name })}
                style={chipStyle(value.personId === p.id)}
              >
                {p.name}
              </button>
            ))}
            {onAddPerson && !personOpen ? (
              <button type="button" onClick={() => setPersonOpen(true)} style={chipStyle(false, true)}>
                + person
              </button>
            ) : null}
            {onAddPerson && personOpen ? (
              <span style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  aria-label="Person's name"
                  placeholder="Name"
                  autoFocus
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void addPerson()
                    else if (e.key === 'Escape') setPersonOpen(false)
                  }}
                  style={{ ...inputStyle, width: '9rem' }}
                />
                <input
                  type="tel"
                  aria-label="Person's phone"
                  placeholder="Phone"
                  value={personPhone}
                  onChange={(e) => setPersonPhone(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void addPerson()
                    else if (e.key === 'Escape') setPersonOpen(false)
                  }}
                  style={{ ...inputStyle, width: '8rem' }}
                />
                <button type="button" disabled={!personName.trim() || addingPerson} onClick={() => void addPerson()} style={{ ...chipStyle(false), opacity: !personName.trim() || addingPerson ? 0.6 : 1 }}>
                  {addingPerson ? 'Adding…' : 'Add to this customer'}
                </button>
              </span>
            ) : null}
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Waiting on</span>
            {FOLLOWUP_REASONS.map((r) => (
              <button key={r.key} type="button" aria-pressed={value.reason === r.key} onClick={() => onChange({ ...value, reason: value.reason === r.key ? null : r.key })} style={chipStyle(value.reason === r.key)}>
                {r.label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {!actions ? (
        <div style={{ ...rowStyle, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <span style={labelStyle} aria-hidden />
          {value.ymd ? `Out of the queue until ${followupDateLabel(value.ymd, todayYmd)}.` : noDayHint}
        </div>
      ) : (
      <div style={rowStyle}>
        <span style={labelStyle} aria-hidden />
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.28rem 0.9rem', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Saving…' : saveLabel}
        </button>
        <button type="button" disabled={saving} onClick={onCancel} style={{ font: 'inherit', fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}>
          Cancel
        </button>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {value.ymd ? `Out of the queue until ${followupDateLabel(value.ymd, todayYmd)}.` : noDayHint}
        </span>
      </div>
      )}
    </div>
  )
}
