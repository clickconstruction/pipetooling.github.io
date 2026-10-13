/**
 * Messages, cut 2's screens, PR C2: a team note's day to come back (the prototype's `noteBackHtml`), for cut 3's reply
 * box while it writes a note. The row comes back to Follow up that morning, with the note (`backToday`); words that are
 * not a day are kept and never bring it back (`noteBackToast` says so). The box passes the day to `addNote`. It draws
 * open: the box shows its own press beside *Add the note* (`NOTE_BACK_PRESS`, hover `NOTE_BACK_TIP` in `queue.ts`, the
 * prototype's `noteBackLink`) and mounts this once pressed or while a day is set; *No day ×* hands back null.
 */
import type { DayKept } from '../../lib/messages/owed'
import { dayLabel } from '../../lib/messages/owed'
import { DayPicker } from './DayPicker'

export function NoteBackDay({ value, onChange, todayYmd }: { value: DayKept | null; onChange: (back: DayKept | null) => void; todayYmd: string }) {
  const label = value?.ymd ? dayLabel(value.ymd) : value?.words?.trim() || null
  return (
    <div data-note-back-day style={{ display: 'grid', gap: '0.35rem', padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline', flexWrap: 'wrap', fontSize: '0.85rem' }}>
        <b>Bring it back</b>
        <span style={{ color: 'var(--text-muted)' }}>The row comes back to Follow up that morning, with this note.</span>
        {label && <span style={{ fontWeight: 600, color: 'var(--text-blue-800)' }}>{value?.ymd ? label : `${label} · no day`}</span>}
        {value && (
          <button type="button" onClick={() => onChange(null)} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', font: 'inherit' }}>
            No day ×
          </button>
        )}
      </div>
      <DayPicker todayYmd={todayYmd} chosen={value} onPick={(d) => onChange(d.ymd || d.words ? d : null)} typedLabel="A day to bring it back" />
    </div>
  )
}
