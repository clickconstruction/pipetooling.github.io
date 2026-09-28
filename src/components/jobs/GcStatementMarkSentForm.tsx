import { useState } from 'react'
import { STATEMENT_SEND_CHANNELS, TEMPERATURES, type RoundMarkAction, type StatementSendChannel, type Temperature } from '../../lib/jobs/gcStatementRounds'

export type GcStatementMarkPayload = {
  action: Extract<RoundMarkAction, 'sent' | 'contacted'>
  channel: StatementSendChannel
  note: string
  temperature: Temperature | null
  expectedPayBy: string | null
  /** Whose word it is, when the form was told who could have said it; absent on a plain send. */
  wordFrom?: { userId: string; name: string } | null
  /** How the person entering it heard the word from its source; null when it is their own. */
  heardVia?: StatementSendChannel | null
}

export type GcMarkWordSource = { id: string; name: string }

/**
 * "Mark sent" / "Spoke with them" form (v2.2761 → v2.2813): how the contact
 * went, and — for a contact without a statement — the GC's temperature (a
 * pick plus the forced open answer to "what's their temperature?") and an
 * optional expected pay date. Shared by the round overlay's Sent it and the
 * per-GC Share → Mark… entry. The parent owns the write.
 *
 * Whose word (punch list #49): given `wordSources`, a contact asks who talked
 * to the GC — the account man by default — and, when that is not the person
 * typing, how she heard it from him. The mark then keeps both names.
 */
export default function GcStatementMarkSentForm({
  gcName,
  actorName,
  defaultChannel = 'email',
  defaultAction = 'sent',
  actorId,
  wordSources,
  defaultWordSourceId,
  busy,
  onSave,
  onCancel,
}: {
  gcName: string
  actorName: string
  defaultChannel?: StatementSendChannel
  defaultAction?: 'sent' | 'contacted'
  /** The person typing. With `wordSources`, turns on "Whose word is this?". */
  actorId?: string
  /** People the word could have come from — the office roster. */
  wordSources?: readonly GcMarkWordSource[]
  /** Who it most likely came from: the GC's account man. */
  defaultWordSourceId?: string | null
  busy: boolean
  onSave: (payload: GcStatementMarkPayload) => void
  onCancel: () => void
}) {
  const [action, setAction] = useState<'sent' | 'contacted'>(defaultAction)
  const [channel, setChannel] = useState<StatementSendChannel>(defaultAction === 'contacted' && defaultChannel === 'email' ? 'call' : defaultChannel)
  const [temperature, setTemperature] = useState<Temperature | null>(null)
  const [note, setNote] = useState('')
  const [payBy, setPayBy] = useState('')
  const [error, setError] = useState<string | null>(null)
  const asksSource = !!actorId && !!wordSources && wordSources.length > 0
  const [sourceId, setSourceId] = useState<string>(() => (asksSource && defaultWordSourceId && wordSources!.some((u) => u.id === defaultWordSourceId) ? defaultWordSourceId : (actorId ?? '')))
  const source = asksSource ? (wordSources!.find((u) => u.id === sourceId) ?? null) : null
  const fromSomeoneElse = asksSource && source != null && source.id !== actorId
  const sourceFirstName = (source?.name ?? '').split(/\s+/)[0] || 'them'
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const channelLabel = STATEMENT_SEND_CHANNELS.find((c) => c.value === channel)?.label ?? 'Email'
  const contacted = action === 'contacted'
  // Hearing it from the account man can be an email; reaching the GC yourself with no statement cannot.
  const channels = contacted && !fromSomeoneElse ? STATEMENT_SEND_CHANNELS.filter((c) => c.value !== 'email') : STATEMENT_SEND_CHANNELS
  const pick = (a: 'sent' | 'contacted') => {
    setAction(a)
    setError(null)
    if (a === 'contacted' && channel === 'email') setChannel('call')
  }
  const submit = () => {
    if (busy) return
    const trimmed = note.trim()
    if (contacted) {
      if (!temperature) {
        setError('Pick their temperature.')
        return
      }
      if (trimmed.length < 8) {
        setError("Say what their temperature is — a sentence, not a word. That's the whole point of the mark.")
        return
      }
    }
    const base = { action, channel, note: trimmed, temperature, expectedPayBy: payBy || null }
    if (!asksSource || !contacted) {
      onSave(base)
      return
    }
    onSave({ ...base, wordFrom: source ? { userId: source.id, name: source.name } : null, heardVia: fromSomeoneElse ? channel : null })
  }
  const segStyle = (on: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '0.35rem 0.6rem',
    fontSize: '0.8125rem',
    fontWeight: on ? 700 : 500,
    textAlign: 'center',
    borderRadius: 6,
    border: on ? '1px solid var(--text-blue-700)' : '1px solid var(--border-strong)',
    background: on ? 'var(--bg-blue-100)' : 'var(--surface)',
    color: on ? 'var(--text-blue-800)' : 'var(--text-700)',
    cursor: 'pointer',
  })
  const tempTone: Record<Temperature, { bg: string; fg: string; border: string }> = {
    hot: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-800)', border: 'var(--border-green)' },
    warm: { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)', border: 'var(--border-amber)' },
    cool: { bg: 'var(--bg-blue-tint)', fg: 'var(--text-blue-800)', border: 'var(--border-blue)' },
    cold: { bg: 'var(--bg-orange-tint)', fg: 'var(--text-red-700)', border: '#fecaca' },
  }
  return (
    <form
      aria-label={`Mark ${gcName} statement ${contacted ? 'contacted' : 'sent'}`}
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      style={{ border: '1px solid var(--border-blue)', background: 'var(--bg-blue-tint)', borderRadius: 8, padding: '0.6rem 0.75rem' }}
    >
      <div role="radiogroup" aria-label="What happened" style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.55rem' }}>
        <button type="button" role="radio" aria-checked={!contacted} onClick={() => pick('sent')} style={segStyle(!contacted)}>
          Statement sent
        </button>
        <button type="button" role="radio" aria-checked={contacted} onClick={() => pick('contacted')} style={segStyle(contacted)}>
          Spoke with them · no statement
        </button>
      </div>
      {asksSource && contacted ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <label htmlFor="gc-mark-word-from" style={{ fontSize: '0.78rem', fontWeight: 700 }}>
            Whose word is this?
          </label>
          <select
            id="gc-mark-word-from"
            value={sourceId}
            onChange={(e) => {
              setSourceId(e.target.value)
              if (e.target.value === actorId && channel === 'email') setChannel('call')
            }}
            style={{ font: 'inherit', fontSize: '0.8125rem', padding: '0.15rem 0.3rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'inherit' }}
          >
            {wordSources!.map((u) => (
              <option key={u.id} value={u.id}>
                {u.id === actorId ? `Mine — I talked to ${gcName}` : `${u.name}${u.id === defaultWordSourceId ? ' · account man' : ''}`}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{contacted && fromSomeoneElse ? `How did you hear it from ${sourceFirstName}?` : 'How'}</div>
      <div role="radiogroup" aria-label="How it went out" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        {channels.map((c) => {
          const active = c.value === channel
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setChannel(c.value)}
              style={{
                padding: '0.15rem 0.6rem',
                fontSize: '0.78rem',
                fontWeight: active ? 700 : 500,
                borderRadius: 999,
                border: active ? '1px solid var(--text-blue-700)' : '1px solid var(--border-strong)',
                background: active ? 'var(--bg-blue-100)' : 'var(--surface)',
                color: active ? 'var(--text-blue-800)' : 'var(--text-700)',
                cursor: 'pointer',
              }}
            >
              {c.label}
            </button>
          )
        })}
      </div>
      {contacted ? (
        <>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.3rem' }}>
            What’s their temperature? <span style={{ fontWeight: 400, color: 'var(--text-red-700)', fontSize: '0.72rem' }}>required</span>
          </div>
          <div role="radiogroup" aria-label="Temperature" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.5rem' }}>
            {TEMPERATURES.map((t) => {
              const on = temperature === t.value
              const tone = tempTone[t.value]
              return (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setTemperature(t.value)
                    setError(null)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '0.5rem',
                    textAlign: 'left',
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.8125rem',
                    borderRadius: 6,
                    border: on ? `1px solid ${tone.border}` : '1px solid var(--border)',
                    background: on ? tone.bg : 'var(--surface)',
                    color: on ? tone.fg : 'var(--text-base)',
                    fontWeight: on ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ minWidth: 44 }}>{t.label}</span>
                  <span style={{ fontWeight: 400, fontSize: '0.75rem', color: on ? tone.fg : 'var(--text-muted)' }}>· {t.hint}</span>
                </button>
              )
            })}
          </div>
        </>
      ) : null}
      <textarea
        value={note}
        onChange={(e) => {
          setNote(e.target.value)
          setError(null)
        }}
        maxLength={600}
        rows={contacted ? 3 : 2}
        placeholder={contacted ? 'Warm — Dave says the check run is the 10th, wants the 868 CO broken out on the next statement.' : 'Note for later — what you sent, what they said (optional)'}
        aria-label={contacted ? 'Temperature answer' : 'Note'}
        style={{ width: '100%', boxSizing: 'border-box', padding: '0.35rem 0.5rem', fontSize: '0.8125rem', font: 'inherit', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)', marginBottom: '0.5rem', resize: 'vertical' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <label htmlFor="gc-mark-pay-by" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          They expect to pay by
        </label>
        <input
          id="gc-mark-pay-by"
          type="date"
          value={payBy}
          onChange={(e) => setPayBy(e.target.value)}
          style={{ font: 'inherit', fontSize: '0.78rem', padding: '0.15rem 0.3rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'inherit' }}
        />
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>optional</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {contacted && fromSomeoneElse ? `Stamps ${source!.name}’s word — entered by ${actorName || 'you'}` : `Stamps ${actorName || 'you'}`} · {today} · {channelLabel.toLowerCase()}
          {contacted ? `${temperature ? ` · ${temperature}` : ''}. Counts for the week. Does not mark a statement sent.` : ''}
        </span>
        <button type="button" onClick={onCancel} disabled={busy} style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}>
          Cancel
        </button>
        <button type="submit" disabled={busy} style={{ padding: '0.3rem 0.8rem', fontSize: '0.78rem', fontWeight: 700, border: 'none', borderRadius: 4, background: '#2563eb', color: '#ffffff', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Saving…' : contacted ? 'Save · spoke with them' : 'Save mark'}
        </button>
      </div>
      {error ? <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: 'var(--text-red-700)' }}>{error}</p> : null}
    </form>
  )
}
