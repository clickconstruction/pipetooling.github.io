import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { LIEN_WORD_CHANNELS, LIEN_WORD_CHANNEL_WORDS, leaderPresent, presenceLine, type LienWordChannel, type WordRecordPreview } from '../../lib/jobs/lienWord'

/**
 * "Who said it, when, and how" — the row the office fills to send a lien paper on the leader's
 * word (v2.3405), shared by the Lien desk's notice, affidavit and retainage footers and the
 * Put-a-GC-on-notice run (v2.3813). The last two channels are the declarations for when he is
 * beside them — *standing over me* / *typing it in*.
 *
 * v2.4856 (the owner's ask): one line, not three. The lead-in, the box, the channels, the blue
 * action and Cancel sit on one row with a short note after them; the long sentence is gone, and
 * *Preview the record ›* opens a card on hover or a press that shows the record in every place it
 * lands (`wordRecordPreview`), so the office can see the effect before pressing.
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
  /** The job's master, when the desk knows him: the chips and the note say his name (v2.4856). */
  leaderName?: string | null
  actionLabel: string
  onAction: () => void
  actionDisabled: boolean
  /** Why the action is refused (shown as the hover), '' when it may go. */
  actionBlock?: string
  onCancel: () => void
  btn: (kind: 'primary' | 'green' | 'amber' | 'plain', disabled?: boolean) => CSSProperties
  /** Optional: the row opens from an item already with the leader, so the lead-in says so. */
  leadIn?: string
  /** What the record will say where it lands; with it, the row offers *Preview the record ›*. */
  preview?: WordRecordPreview
}

const where: CSSProperties = { display: 'grid', gap: 2, padding: '6px 9px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)' }
const whereKey: CSSProperties = { fontSize: '0.68rem', color: 'var(--text-muted)' }
const whereValue: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-700)' }

export function LienWordRecordRow({ note, onNote, channel, onChannel, radioName, recorderName, leaderName, actionLabel, onAction, actionDisabled, actionBlock = '', onCancel, btn, leadIn, preview }: LienWordRecordRowProps) {
  const line = presenceLine(channel, recorderName, leaderName)
  const [peek, setPeek] = useState(false)
  const peekId = useId()
  const rowRef = useRef<HTMLDivElement | null>(null)
  // A press elsewhere, or Esc, puts the card away; the row and the window behind it never see the Esc.
  useEffect(() => {
    if (!peek) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setPeek(false)
    }
    const onPress = (e: MouseEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) setPeek(false)
    }
    window.addEventListener('keydown', onKey, true)
    document.addEventListener('mousedown', onPress)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('mousedown', onPress)
    }
  }, [peek])
  return (
    <div ref={rowRef} data-lien-word-row style={{ position: 'relative', display: 'grid', gap: '0.35rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem' }}>
        <span>{leadIn ?? 'Who said it, when, and how:'}</span>
        <input
          value={note}
          onChange={(ev) => onNote(ev.target.value)}
          placeholder={leaderName?.trim() ? `${leaderName.trim()}, today 9:10` : 'Robert, today 9:10'}
          aria-label="Who said it and when"
          style={{ flex: '1 1 150px', minWidth: 0, padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.8125rem' }}
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
              whiteSpace: 'nowrap',
              ...(c === 'standing_over' ? { marginLeft: '0.35rem' } : {}),
            }}
          >
            <input type="radio" name={radioName} checked={channel === c} onChange={() => onChannel(c)} />
            {LIEN_WORD_CHANNEL_WORDS[c].pick}
          </label>
        ))}
        <button type="button" onClick={onAction} disabled={actionDisabled || Boolean(actionBlock)} style={btn('primary', actionDisabled || Boolean(actionBlock))} title={actionBlock || undefined}>
          {actionLabel}
        </button>
        <button type="button" onClick={onCancel} style={btn('plain')}>Cancel</button>
        {line || preview ? (
          <span data-lien-word-presence style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', flex: '1 1 16rem', minWidth: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {line ? <span>{line}</span> : null}
            {preview ? (
              <button
                type="button"
                data-lien-word-peek
                aria-expanded={peek}
                aria-controls={peekId}
                onClick={() => setPeek((v) => !v)}
                onMouseEnter={() => setPeek(true)}
                onFocus={() => setPeek(true)}
                title="See the record in every place it will show"
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'help', color: 'var(--text-link)', font: 'inherit', fontSize: '0.75rem', textDecoration: 'underline dotted', whiteSpace: 'nowrap' }}
              >
                Preview the record ›
              </button>
            ) : null}
          </span>
        ) : null}
      </div>
      {actionBlock ? <div style={{ fontSize: '0.75rem', color: 'var(--text-red-600)' }}>{actionBlock}</div> : null}
      {preview && peek ? (
        <div
          id={peekId}
          role="tooltip"
          data-lien-word-preview
          onMouseLeave={() => setPeek(false)}
          style={{ position: 'absolute', right: 0, bottom: 'calc(100% + 8px)', width: 'min(34rem, calc(100vw - 2rem))', zIndex: 5, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 12px 30px rgba(0,0,0,0.18)', padding: '10px 12px', display: 'grid', gap: 8 }}
        >
          <div style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>What the record will say</div>
          <div style={where}>
            <span style={whereKey}>On this notice, in Ready to send</span>
            <span style={whereValue}>{preview.ready}</span>
            <span style={whereKey}>{preview.record}</span>
          </div>
          <div style={where}>
            <span style={whereKey}>On the desk's title bar, for the leader</span>
            <span style={whereValue}>{preview.strip}</span>
          </div>
          <div style={where}>
            <span style={whereKey}>In the queue row</span>
            <span style={whereValue}>{preview.row}</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', padding: '6px 9px', border: '1px dashed var(--border-strong)', borderRadius: 8 }}>{preview.paper}</div>
        </div>
      ) : null}
    </div>
  )
}
