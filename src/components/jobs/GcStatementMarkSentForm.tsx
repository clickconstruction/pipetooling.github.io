import { useState } from 'react'
import { STATEMENT_SEND_CHANNELS, type StatementSendChannel } from '../../lib/jobs/gcStatementRounds'

/**
 * "Mark sent" form (v2.2761): how the statement went out + an optional note,
 * saved with who/when onto the week's round mark. Shared by the round
 * overlay's Sent it and the per-GC Share → Mark sent… entry. The parent owns
 * the write; this only collects channel + note.
 */
export default function GcStatementMarkSentForm({
  gcName,
  actorName,
  defaultChannel = 'email',
  busy,
  onSave,
  onCancel,
}: {
  gcName: string
  actorName: string
  defaultChannel?: StatementSendChannel
  busy: boolean
  onSave: (channel: StatementSendChannel, note: string) => void
  onCancel: () => void
}) {
  const [channel, setChannel] = useState<StatementSendChannel>(defaultChannel)
  const [note, setNote] = useState('')
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const channelLabel = STATEMENT_SEND_CHANNELS.find((c) => c.value === channel)?.label ?? 'Email'
  return (
    <form
      aria-label={`Mark ${gcName} statement sent`}
      onSubmit={(e) => {
        e.preventDefault()
        if (!busy) onSave(channel, note.trim())
      }}
      style={{ border: '1px solid var(--border-blue)', background: 'var(--bg-blue-tint)', borderRadius: 8, padding: '0.6rem 0.75rem' }}
    >
      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-blue-700)', marginBottom: '0.4rem' }}>Mark sent</div>
      <div role="radiogroup" aria-label="How it went out" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        {STATEMENT_SEND_CHANNELS.map((c) => {
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
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={300}
        placeholder="Note for later — what you sent, what they said (optional)"
        aria-label="Note"
        style={{ width: '100%', boxSizing: 'border-box', padding: '0.35rem 0.5rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)', marginBottom: '0.5rem' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Stamps {actorName || 'you'} · {today} · {channelLabel.toLowerCase()}
        </span>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          style={{ padding: '0.3rem 0.8rem', fontSize: '0.78rem', fontWeight: 700, border: 'none', borderRadius: 4, background: '#2563eb', color: '#ffffff', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}
        >
          {busy ? 'Saving…' : 'Save mark'}
        </button>
      </div>
    </form>
  )
}
