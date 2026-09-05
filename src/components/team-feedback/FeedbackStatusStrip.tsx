/** People → Feedback (v2.2835): the strip — switch, one sentence, three counts, Try the deck, gear. */
import type { CSSProperties } from 'react'
import type { FeedbackStats } from '../../lib/people/feedbackTabRows'

type Props = {
  enabled: boolean
  saving: boolean
  cadenceDays: number
  lastDeckAt: string | null
  stats: FeedbackStats
  onToggle: (next: boolean) => void
  onTryDeck: () => void
  onOpenSettings: () => void
  narrow: boolean
}

export default function FeedbackStatusStrip({ enabled, saving, cadenceDays, lastDeckAt, stats, onToggle, onTryDeck, onOpenSettings, narrow }: Props) {
  const sentence = enabled
    ? `Everyone who clocks out is dealt the deck every ${cadenceDays} days. Anonymous to everyone but you.`
    : `Nobody is dealt the deck. Turn it on and it starts at the next clock-out, every ${cadenceDays} days.`
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: narrow ? '0.5rem' : '0.9rem', flexWrap: 'wrap', padding: '0.25rem 0 0.75rem', borderBottom: '1px solid var(--border)' }}>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={enabled ? 'Team feedback is on' : 'Team feedback is off'}
        disabled={saving}
        onClick={() => onToggle(!enabled)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', padding: 0, cursor: saving ? 'wait' : 'pointer', font: 'inherit', fontWeight: 700, color: 'var(--text-strong)' }}
      >
        <span aria-hidden style={{ ...knobTrack, background: enabled ? 'var(--text-green-700)' : 'var(--border-strong)' }}>
          <span style={{ ...knob, left: enabled ? 21 : 3, background: 'var(--surface)' }} />
        </span>
        {enabled ? 'On' : 'Off'}
      </button>
      {!narrow && (
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '42ch' }}>
          {sentence}
          {!enabled && <span style={{ color: 'var(--text-faint)' }}> Last deck: {lastDeckAt ? new Date(lastDeckAt).toLocaleDateString() : 'never'}.</span>}
        </span>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', marginLeft: narrow ? 0 : 'auto', flexWrap: 'wrap' }}>
        <Stat n={stats.dueNow == null ? '—' : String(stats.dueNow)} label="due now" />
        <Stat n={String(stats.ratedThisMonth)} label="rated this month" />
        <Stat n={String(stats.wordsThisMonth)} label="words this month" />
      </div>
      <button type="button" onClick={onTryDeck} title="Deal yourself the deck with your real teammates. Nothing is saved." style={primary}>
        Try the deck
      </button>
      <button type="button" onClick={onOpenSettings} aria-label="Team feedback settings" title="Settings and the retired questions" style={gear}>
        ⚙
      </button>
    </div>
  )
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 7, padding: '0.3rem 0.65rem', minWidth: 78 }}>
      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{n}</div>
      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  )
}

const knobTrack: CSSProperties = { position: 'relative', display: 'inline-block', width: 40, height: 22, borderRadius: 999, transition: 'background 120ms' }
const knob: CSSProperties = { position: 'absolute', top: 3, width: 16, height: 16, borderRadius: 999, transition: 'left 120ms' }
const primary: CSSProperties = { padding: '0.45rem 0.85rem', borderRadius: 7, border: 'none', background: 'var(--text-link)', color: 'white', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }
const gear: CSSProperties = { background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer', padding: '0 0.25rem' }
