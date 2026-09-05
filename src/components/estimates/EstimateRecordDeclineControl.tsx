import { useId, useState, type CSSProperties } from 'react'
import {
  ESTIMATE_DECLINE_CHANNELS,
  ESTIMATE_DECLINE_REASON_MAX,
  type EstimateDeclineChannel,
} from '../../../supabase/functions/_shared/estimateDecline'

/**
 * "Record a decline (phone / in person)" on a sent estimate (v2.2873, journey-map J17-N1):
 * the office hears "no" on the phone and had nowhere to put it — the row kept aging in
 * Sent wearing "nudge?". A quiet button opens a two-field form (how you heard, a short
 * note); Mark declined calls the parent's writer (the `record_estimate_decline` RPC).
 */
export type EstimateRecordDeclineControlProps = {
  busy: boolean
  onRecord: (note: string, channel: EstimateDeclineChannel) => void
  style?: CSSProperties
}

const CHANNEL_LABEL: Record<EstimateDeclineChannel, string> = {
  phone: 'Phone call',
  in_person: 'In person',
  email: 'Email',
  text: 'Text message',
  other: 'Other',
}

export default function EstimateRecordDeclineControl({ busy, onRecord, style }: EstimateRecordDeclineControlProps) {
  const [open, setOpen] = useState(false)
  const [channel, setChannel] = useState<EstimateDeclineChannel>('phone')
  const [note, setNote] = useState('')
  const noteId = useId()
  const channelId = useId()

  if (!open) {
    return (
      <div style={style} data-testid="estimate-record-decline-control">
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={busy}
          style={{
            padding: '0.35rem 0.65rem',
            fontSize: '0.8125rem',
            fontWeight: 500,
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            background: 'var(--surface)',
            color: 'var(--text-700)',
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
          title="The customer said no by phone or in person? Record it so the row stops asking for a nudge."
        >
          Record a decline (phone / in person)
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        ...style,
        padding: '0.75rem 0.9rem',
        border: '1px solid var(--border)',
        borderRadius: 6,
        background: 'var(--bg-muted)',
        maxWidth: 'min(520px, 100%)',
        boxSizing: 'border-box',
      }}
      data-testid="estimate-record-decline-form"
    >
      <div style={{ fontWeight: 600, color: 'var(--text-strong)' }}>Record a decline</div>
      <p style={{ margin: '0.25rem 0 0.6rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        This marks the estimate declined and moves it out of Sent. It cannot be un-declined from here — to quote again,
        start a New estimate.
      </p>
      <label htmlFor={channelId} style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-700)', marginBottom: '0.2rem' }}>
        How did you hear?
      </label>
      <select
        id={channelId}
        value={channel}
        onChange={(e) => setChannel(e.target.value as EstimateDeclineChannel)}
        disabled={busy}
        style={{ fontSize: '0.9rem', padding: '0.35rem 0.5rem', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)' }}
      >
        {ESTIMATE_DECLINE_CHANNELS.map((c) => (
          <option key={c} value={c}>
            {CHANNEL_LABEL[c]}
          </option>
        ))}
      </select>
      <label htmlFor={noteId} style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-700)', margin: '0.6rem 0 0.2rem' }}>
        Note <span style={{ color: 'var(--text-muted)' }}>(optional — what they said)</span>
      </label>
      <textarea
        id={noteId}
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, ESTIMATE_DECLINE_REASON_MAX))}
        maxLength={ESTIMATE_DECLINE_REASON_MAX}
        rows={2}
        disabled={busy}
        placeholder="Went with another bid; call back in the spring…"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          fontSize: '0.9rem',
          padding: '0.4rem 0.5rem',
          border: '1px solid var(--border-strong)',
          borderRadius: 4,
          background: 'var(--surface)',
          color: 'var(--text-strong)',
          resize: 'vertical',
        }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.6rem' }}>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={busy}
          style={{
            padding: '0.35rem 0.65rem',
            fontSize: '0.8125rem',
            fontWeight: 500,
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            background: 'var(--surface)',
            color: 'var(--text-700)',
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onRecord(note, channel)}
          disabled={busy}
          style={{
            padding: '0.35rem 0.65rem',
            fontSize: '0.8125rem',
            fontWeight: 600,
            border: 'none',
            borderRadius: 4,
            background: busy ? '#9ca3af' : '#b91c1c',
            color: 'white',
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
          aria-label="Mark this estimate declined"
        >
          {busy ? 'Saving…' : 'Mark declined'}
        </button>
      </div>
    </div>
  )
}
