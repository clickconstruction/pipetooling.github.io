import type { CSSProperties } from 'react'
import { LIEN_WORD_CHANNELS, LIEN_WORD_CHANNEL_WORDS, leaderPresent, presenceLine, type LienWordChannel } from '../../lib/jobs/lienWord'

/**
 * "Who said it, when, and how" — the row the office fills to send a lien paper on the leader's
 * word (v2.3405), shared by the Lien desk's notice, affidavit and retainage footers and the
 * Put-a-GC-on-notice run (v2.3813). The last two channels are the declarations for when he is
 * beside them — *he is standing over me* / *he is typing it in* — and a line under the row says
 * what that record will read.
 */
export type LienWordRecordRowProps = {
  note: string
  onNote: (v: string) => void
  channel: LienWordChannel
  onChannel: (c: LienWordChannel) => void
  /** Distinct per surface so two rows on one page never share a radio group. */
  radioName: string
  /** Who is making the record — the signed-in office person's name. */
  recorderName: string | null | undefined
  actionLabel: string
  onAction: () => void
  actionDisabled: boolean
  /** Why the action is refused (shown as the hover), '' when it may go. */
  actionBlock?: string
  onCancel: () => void
  btn: (kind: 'primary' | 'green' | 'amber' | 'plain', disabled?: boolean) => CSSProperties
  /** Optional: the row opens from an item already with the leader, so the lead-in says so. */
  leadIn?: string
}

export function LienWordRecordRow({ note, onNote, channel, onChannel, radioName, recorderName, actionLabel, onAction, actionDisabled, actionBlock = '', onCancel, btn, leadIn }: LienWordRecordRowProps) {
  const line = presenceLine(channel, recorderName)
  return (
    <div data-lien-word-row style={{ display: 'grid', gap: '0.35rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem' }}>
        <span>{leadIn ?? 'Who said it, when, and how:'}</span>
        <input
          value={note}
          onChange={(ev) => onNote(ev.target.value)}
          placeholder="Robert, today 9:10"
          aria-label="Who said it and when"
          style={{ flex: '1 1 180px', padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.8125rem' }}
        />
        {LIEN_WORD_CHANNELS.map((c) => (
          <label
            key={c}
            style={{
              display: 'inline-flex',
              gap: 4,
              alignItems: 'center',
              padding: '3px 8px',
              border: `1px solid ${leaderPresent(c) ? 'var(--border-strong)' : 'var(--border)'}`,
              borderRadius: 6,
              background: channel === c ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
              cursor: 'pointer',
              ...(c === 'standing_over' ? { marginLeft: '0.35rem' } : {}),
            }}
          >
            <input type="radio" name={radioName} checked={channel === c} onChange={() => onChannel(c)} />
            {LIEN_WORD_CHANNEL_WORDS[c].pick}
          </label>
        ))}
        <button type="button" onClick={onAction} disabled={actionDisabled || Boolean(actionBlock)} style={btn('amber', actionDisabled || Boolean(actionBlock))} title={actionBlock || undefined}>
          {actionLabel}
        </button>
        <button type="button" onClick={onCancel} style={btn('plain')}>Cancel</button>
      </div>
      {line ? <div data-lien-word-presence style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{line}</div> : null}
      {actionBlock ? <div style={{ fontSize: '0.75rem', color: 'var(--text-red-600)' }}>{actionBlock}</div> : null}
    </div>
  )
}
