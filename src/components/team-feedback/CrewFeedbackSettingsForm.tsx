/**
 * People → Feedback → Settings (dev, v2.2824). The whole form: cadence, the Dashboard button,
 * how far back the deck looks for teammates, the intro and thank-you copy, and the four
 * open-card headings. The ten scripted questions are not here any more; see Retired questions.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { DEFAULT_OPEN_PROMPTS, parseOpenPrompts } from '../../lib/people/crewReview'
import type { TeamFeedbackSettingsRow } from '../../lib/teamFeedback'
import { DEFAULT_CREW_DECK_INTRO_COPY } from './CrewReviewDeck'

type Props = {
  row: TeamFeedbackSettingsRow | null
  onSaved: (row: TeamFeedbackSettingsRow) => void
}

export default function CrewFeedbackSettingsForm({ row, onSaved }: Props) {
  const { showToast } = useToastContext()
  const [cadence, setCadence] = useState('14')
  const [lookback, setLookback] = useState('14')
  const [homeEntry, setHomeEntry] = useState(false)
  const [intro, setIntro] = useState('')
  const [thanks, setThanks] = useState('')
  const [prompts, setPrompts] = useState<string[]>([...DEFAULT_OPEN_PROMPTS])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!row) return
    setCadence(String(row.cadence_days))
    setLookback(String(row.crew_lookback_days ?? 14))
    setHomeEntry(row.home_entry_enabled)
    setIntro(row.intro_copy ?? '')
    setThanks(row.thank_you_copy ?? '')
    setPrompts([...parseOpenPrompts(row.open_prompts)])
  }, [row])

  async function save() {
    const cadenceDays = Number(cadence)
    const lookbackDays = Number(lookback)
    if (!Number.isInteger(cadenceDays) || cadenceDays < 1 || cadenceDays > 365) {
      showToast('Cadence must be 1–365 days', 'error')
      return
    }
    if (!Number.isInteger(lookbackDays) || lookbackDays < 1 || lookbackDays > 90) {
      showToast('Lookback must be 1–90 days', 'error')
      return
    }
    const cleanPrompts = prompts.map((p) => p.trim())
    if (cleanPrompts.some((p) => !p)) {
      showToast('Each open-card heading needs words', 'error')
      return
    }
    const isDefaultPrompts = cleanPrompts.every((p, i) => p === DEFAULT_OPEN_PROMPTS[i])
    setSaving(true)
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase
            .from('team_feedback_settings')
            .update({
              cadence_days: cadenceDays,
              crew_lookback_days: lookbackDays,
              home_entry_enabled: homeEntry,
              intro_copy: intro.trim() || null,
              thank_you_copy: thanks.trim() || null,
              open_prompts: isDefaultPrompts ? null : cleanPrompts,
              updated_at: new Date().toISOString(),
            })
            .eq('id', 1)
            .select('*')
            .single(),
        'update team_feedback_settings',
      )
      onSaved(data as unknown as TeamFeedbackSettingsRow)
      showToast('Team feedback settings saved', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!row) return <p style={{ color: 'var(--text-muted)', margin: '0.75rem 0' }}>Loading…</p>

  return (
    <div style={{ display: 'grid', gap: '0.85rem', marginTop: '0.75rem', maxWidth: 640 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <label style={labelStyle}>
          <span>Ask every (days)</span>
          <input type="number" min={1} max={365} value={cadence} onChange={(e) => setCadence(e.target.value)} style={inputStyle} />
          <small style={helpStyle}>How long after someone finishes or skips before the deck is dealt again at clock-out.</small>
        </label>
        <label style={labelStyle}>
          <span>Worked-with lookback (days)</span>
          <input type="number" min={1} max={90} value={lookback} onChange={(e) => setLookback(e.target.value)} style={inputStyle} />
          <small style={helpStyle}>Clock sessions (pending or approved) on the same job, same day, inside this window make someone a teammate card.</small>
        </label>
      </div>
      <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.875rem' }}>
        <input type="checkbox" checked={homeEntry} onChange={(e) => setHomeEntry(e.target.checked)} />
        <span>
          Show a <strong>Rate your crew</strong> button on the Dashboard (opens the deck any time, no intro)
        </span>
      </label>
      <label style={labelStyle}>
        <span>Intro copy</span>
        <textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={2} placeholder={DEFAULT_CREW_DECK_INTRO_COPY} style={inputStyle} />
      </label>
      <label style={labelStyle}>
        <span>Thank-you copy</span>
        <textarea value={thanks} onChange={(e) => setThanks(e.target.value)} rows={2} placeholder="Thanks. That took two minutes and it matters." style={inputStyle} />
      </label>
      <div style={labelStyle}>
        <span>Open-card headings</span>
        {prompts.map((p, i) => (
          <input key={i} type="text" value={p} onChange={(e) => setPrompts((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))} style={inputStyle} />
        ))}
        <small style={helpStyle}>Four headings on the last card. The first three are the questions the old wizard asked; the fourth is the free box.</small>
      </div>
      <div>
        <button type="button" onClick={() => void save()} disabled={saving} style={saveButtonStyle}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </div>
  )
}

const labelStyle = { display: 'grid', gap: '0.3rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-700)' } as const
const helpStyle = { fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.75rem' } as const
const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.45rem 0.6rem',
  font: 'inherit',
  fontSize: '0.875rem',
  fontWeight: 400,
  background: 'var(--surface)',
  color: 'var(--text-base)',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
} as const
const saveButtonStyle = {
  padding: '0.5rem 1rem',
  borderRadius: 6,
  border: 'none',
  background: 'var(--text-link)',
  color: 'white',
  fontWeight: 700,
  cursor: 'pointer',
} as const
