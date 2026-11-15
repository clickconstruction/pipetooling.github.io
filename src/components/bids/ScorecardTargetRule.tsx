/**
 * Bid Board → Pricing rules → **The score's target** (team scorecard, punch list #360, PR 3): the profit on each paid
 * field hour the owner wants on top of break-even, the one number the hurdle is built from. It sits beside what a
 * GC's difficulty costs because both are rules the office sets for pricing; unlike the price list it is one setting
 * and not a version, so it has its own press. The owner and a dev set it; the rest of the board reads it.
 */
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useToastContext } from '../../contexts/ToastContext'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { HURDLE_TARGET_WORDS as W, canSetHurdleTarget, hurdleTargetFromText, usdPerHour, type HurdleSetting } from '../../lib/scorecard/hurdle'
import { loadScorecardSettings, saveHurdleSetting } from '../../lib/scorecard/loadScorecard'
import { formatErrorMessage } from '../../utils/errorHandling'

export type ScorecardTargetIo = { load: () => Promise<HurdleSetting>; save: (s: HurdleSetting) => Promise<void> }

const DEFAULT_IO: ScorecardTargetIo = { load: async () => (await loadScorecardSettings()).setting, save: saveHurdleSetting }

const MUTED: CSSProperties = { margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.45 }
const NUM: CSSProperties = { font: 'inherit', fontWeight: 700, width: '4.2rem', textAlign: 'right', padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-base)' }

export default function ScorecardTargetRule({ role, canSeeScores = false, io = DEFAULT_IO }: { role: string | null | undefined; /** Draws the door to the Scores tab for the people who have it. */ canSeeScores?: boolean; io?: ScorecardTargetIo }) {
  const { showToast } = useToastContext()
  const canSet = canSetHurdleTarget(role)
  const [setting, setSetting] = useState<HurdleSetting | null>(null)
  const [unread, setUnread] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let live = true
    io.load()
      .then((s) => {
        if (live) setSetting(s)
      })
      .catch(() => {
        if (live) setUnread(true)
      })
    return () => {
      live = false
    }
  }, [io])

  const shown = text ?? (setting ? String(setting.targetProfitPerHourUsd) : '')
  const parsed = hurdleTargetFromText(shown)
  const changed = text != null && 'setting' in parsed && parsed.setting.targetProfitPerHourUsd !== setting?.targetProfitPerHourUsd
  const dead = saving || !changed

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (dead || !('setting' in parsed)) return
    setSaving(true)
    try {
      await io.save(parsed.setting)
      setSetting(parsed.setting)
      setText(null)
      showToast(W.saved(parsed.setting), 'success')
    } catch (err) {
      showToast(formatErrorMessage(err, W.failed), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section data-testid="scorecard-target-rule" aria-label={W.title} style={{ borderTop: '1px solid var(--border)', paddingTop: '0.9rem', display: 'grid', gap: '0.5rem' }}>
      <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-strong)' }}>{W.title}</h3>
      <p style={MUTED}>{W.lead}</p>
      {unread ? <p style={{ ...MUTED, color: 'var(--text-amber-800)' }}>{W.unread}</p> : null}
      {canSet ? (
        <form onSubmit={(e) => void save(e)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem 0.6rem', flexWrap: 'wrap', fontSize: '0.875rem', color: 'var(--text-700)' }}>
          <span>$</span>
          <input type="number" min={0} max={1000} step={1} value={shown} onChange={(e) => setText(e.target.value)} style={NUM} aria-label={W.inputLabel} disabled={setting == null && !unread} />
          <span>{W.label.charAt(0).toLowerCase() + W.label.slice(1)}</span>
          <button
            type="submit"
            disabled={dead}
            aria-disabled={dead}
            title={'problem' in parsed && text != null ? parsed.problem : undefined}
            style={{ font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, height: 36, padding: '0 0.9rem', border: 0, borderRadius: 8, background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : '#fff', cursor: dead ? 'default' : 'pointer', marginLeft: 'auto' }}
          >
            {saving ? W.saving : W.save}
          </button>
        </form>
      ) : (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-700)' }} data-testid="scorecard-target-read">
          {setting ? <b>{usdPerHour(setting.targetProfitPerHourUsd)}</b> : '—'} {W.label.charAt(0).toLowerCase() + W.label.slice(1)}. <span style={{ color: 'var(--text-muted)' }}>{W.readOnly}</span>
        </p>
      )}
      {canSeeScores ? (
        <Link to="/people?tab=scores" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-link)', textDecoration: 'none' }}>
          {W.scoresDoor}
        </Link>
      ) : null}
    </section>
  )
}
