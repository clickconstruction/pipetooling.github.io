/**
 * The small window behind **Name why it waits** (punch list #192, write A, v2.8723): six reasons, a line to type, and
 * **Mark it waiting**. It opens over the Build desk from a stalled row, and over a job's own window. The press is dead
 * until a reason is picked, and *Something else* needs words; the line under the press says which. Nothing is written
 * until the press: the write is the caller's (`onMark`), which closes the window when it lands and leaves it open
 * with the reason when it does not. The words and the rule are `src/lib/bridge/build/buildWaits.ts`.
 */
import { useState, type CSSProperties } from 'react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { PHONE_PRESS_MIN_HEIGHT } from '../../lib/phonePress'
import { BUILD_WAIT_NOTE_MAX, BUILD_WAIT_REASONS, EMPTY_BUILD_WAIT_DRAFT, buildWaitDraftHold, buildWaitWindowWords, type BuildWaitDraft, type BuildWaitReason } from '../../lib/bridge/build/buildWaits'
import { PhoneSheet } from '../PhoneSheet'

const reasonRow = (picked: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minHeight: PHONE_PRESS_MIN_HEIGHT,
  padding: '0 12px',
  borderRadius: 8,
  border: picked ? '2px solid #2563eb' : '1px solid var(--border-strong)',
  background: picked ? 'var(--bg-blue-tint, var(--bg-subtle))' : 'var(--surface)',
  color: 'var(--text-strong)',
  fontSize: '0.9375rem',
  fontWeight: picked ? 700 : 500,
  cursor: 'pointer',
})
const footBtn: CSSProperties = { minHeight: PHONE_PRESS_MIN_HEIGHT, padding: '0.55rem 0.75rem', fontSize: '0.9375rem', fontWeight: 700, borderRadius: 8, fontFamily: 'inherit' }

export function BuildWaitWindow({ label, leftUsd, busy, onMark, onClose, zIndex = 1100 }: { label: string; leftUsd: number | null; busy: boolean; onMark: (reason: BuildWaitReason, note: string) => void; onClose: () => void; zIndex?: number }) {
  const [draft, setDraft] = useState<BuildWaitDraft>(EMPTY_BUILD_WAIT_DRAFT)
  const words = buildWaitWindowWords(label, leftUsd)
  const hold = buildWaitDraftHold(draft)
  const dead = busy || hold !== null
  return (
    <PhoneSheet label={words.title} title={words.title} width={440} zIndex={zIndex} onClose={onClose} dataAttrs={{ 'data-build-wait-window': '1' }}>
      <div style={{ padding: '0.25rem 1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.4, color: 'var(--text-700)' }}>{words.lede}</p>
        <div role="radiogroup" aria-label="Why the job waits" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {BUILD_WAIT_REASONS.map((r) => {
            const picked = draft.reason === r.key
            return (
              <label key={r.key} style={reasonRow(picked)}>
                <input type="radio" name="build-wait-reason" value={r.key} checked={picked} disabled={busy} onChange={() => setDraft((d) => ({ ...d, reason: r.key }))} style={{ width: 18, height: 18, margin: 0, flex: 'none' }} />
                <span>{r.label}</span>
              </label>
            )
          })}
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {draft.reason === 'other' ? 'Say why the job waits' : words.noteLabel}
          <input
            type="text"
            value={draft.note}
            maxLength={BUILD_WAIT_NOTE_MAX}
            disabled={busy}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            data-testid="build-wait-note"
            style={{ minHeight: PHONE_PRESS_MIN_HEIGHT, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontSize: '1rem', fontFamily: 'inherit' }}
          />
        </label>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{words.foot}</p>
      </div>
      <div style={{ padding: '0.6rem 1rem 0.75rem', borderTop: '1px solid var(--border)', flex: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.7fr', gap: '0.5rem' }}>
          <button type="button" onClick={onClose} disabled={busy} style={{ ...footBtn, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: busy ? 'default' : 'pointer' }}>
            Cancel
          </button>
          <button
            type="button"
            disabled={dead}
            onClick={() => draft.reason && onMark(draft.reason, draft.note)}
            data-testid="build-wait-mark"
            style={{ ...footBtn, border: 'none', background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : '#fff', cursor: dead ? 'default' : 'pointer' }}
          >
            {busy ? words.busyLabel : words.confirmLabel}
          </button>
        </div>
        {hold && !busy ? (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }} data-testid="build-wait-hold">
            {hold}
          </div>
        ) : null}
      </div>
    </PhoneSheet>
  )
}
