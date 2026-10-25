import { useCallback, useContext, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { emailNextLine } from '../../lib/quickfill/nextLine'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { useGcFollowUpNeeds } from '../../hooks/useGcFollowUpNeeds'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { canSetEmailCount } from '../../lib/emailIn/countCard'
import { canOpenMessages } from '../../lib/gc/access'
import { emailStation, READ_AGAIN, WORD_PLACEHOLDER, type StationBox, type StationLabel } from '../../lib/quickfill/emailStation'
import { supabaseEmailStationIo, type EmailStationData, type EmailStationIo } from '../../lib/quickfill/emailStationIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { QuickfillRoundScreenContext } from './quickfillRoundContext'

/**
 * Quickfill → Email. Since v2.5827 (punch list #159) the station reads Gmail's own labels: for each box the viewer may
 * see (the shared boxes, their own, everyone's for the lead), one row per label with the live count, the oldest thread's
 * age, the threads past the limit with the day they arrived and a door into Gmail, and the rest as a number; what moved
 * since the last look; what is counted and who sees it; and the note a mark saves, which the station reports so the
 * Roller's Looked keeps it too (the metric's `markNote`, v2.5825's `getMarkNote`). The model is `lib/quickfill/emailStation.ts`, the reads
 * `emailStationIo.ts`. Until the app counts a box the viewer can see, the station is the three hand-typed rows it was
 * (v2.2185: Inbox · Follow Up · Next Actions, one mark, the `email-inbox` id kept so history and order carry over),
 * with the reason above them.
 */

const NOTE_MAX_CHARS = 10_000

type MarkPalette = { bg: string; border: string }

export const QUICKFILL_EMAIL_ROWS = [
  { key: 'inbox', label: 'Inbox', linkLabel: 'Open Gmail', href: 'https://mail.google.com/mail/u/0/#inbox', placeholder: 'Still in inbox — one per line, or free text' },
  { key: 'follow-up', label: 'Follow Up', linkLabel: 'Open label', href: 'https://mail.google.com/mail/u/0/#label/Follow+Up', placeholder: 'Still in Follow Up' },
  { key: 'next-actions', label: 'Next Actions', linkLabel: 'Open label', href: 'https://mail.google.com/mail/u/0/#label/Next+Actions', placeholder: 'Still in Next Actions' },
] as const

type RowKey = (typeof QUICKFILL_EMAIL_ROWS)[number]['key']

/** The note the by-hand mark saves: "Inbox: …" / "Follow Up: …" for each non-empty row. Exported for the test. */
export function composeEmailMarkNote(notes: Record<RowKey, string>): string {
  const parts: string[] = []
  for (const r of QUICKFILL_EMAIL_ROWS) {
    const t = notes[r.key].trim()
    if (t) parts.push(`${r.label}: ${t}`)
  }
  const joined = parts.join('\n')
  return joined.length > NOTE_MAX_CHARS ? joined.slice(0, NOTE_MAX_CHARS) : joined
}

export function countEmailNoteLines(notes: Record<RowKey, string>): number {
  let n = 0
  for (const r of QUICKFILL_EMAIL_ROWS) n += notes[r.key].split(/\r?\n/).filter((l) => l.trim().length > 0).length
  return n
}

const DEFAULT_IO = supabaseEmailStationIo()
const EMPTY_NOTES: Record<RowKey, string> = { inbox: '', 'follow-up': '', 'next-actions': '' }

const linkStyle: CSSProperties = { color: 'var(--text-link)', fontWeight: 600, fontSize: '0.8125rem', textDecoration: 'none' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem' }
const countChip = (n: number): CSSProperties => ({
  display: 'inline-flex',
  minWidth: 22,
  height: 22,
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 7px',
  borderRadius: 999,
  fontSize: '0.78rem',
  fontWeight: 700,
  background: n === 0 ? 'var(--bg-green-100)' : 'var(--bg-blue-tint)',
  color: n === 0 ? 'var(--text-green-800)' : 'var(--text-link)',
})
const ageChip: CSSProperties = { display: 'inline-flex', justifyContent: 'center', minWidth: 34, padding: '0 6px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, background: 'var(--bg-red-100)', color: 'var(--text-red-800)' }

function MarkButton({ palette, onClick, children }: { palette: MarkPalette; onClick: () => void; children: string }) {
  return (
    <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'center' }}>
      <button type="button" onClick={onClick} style={{ padding: '0.5rem 0.75rem', borderRadius: 6, background: palette.bg, border: `1px solid ${palette.border}`, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}>
        {children}
      </button>
    </div>
  )
}

/** One label's row: the count, the oldest, the door; the threads past the limit; the rest as a number. */
function LabelRow({ label, limitDays, first, narrow }: { label: StationLabel; limitDays: number; first: boolean; narrow: boolean }) {
  const rowStyle: CSSProperties = { padding: '0.45rem 0.75rem', borderTop: first ? 'none' : '1px solid var(--border)' }
  const head: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }
  const name = <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{label.label}</span>
  if (label.kind === 'missing') {
    return (
      <div style={rowStyle} data-email-label={label.label} data-email-label-missing>
        <div style={head}>
          {name}
          <span style={{ ...countChip(1), background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }}>?</span>
        </div>
        <div style={{ marginTop: '0.35rem', fontSize: '0.8125rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', borderRadius: 6, padding: '0.35rem 0.55rem' }}>
          {label.words}{' '}
          {label.href && (
            <a href={label.href} target="_blank" rel="noopener noreferrer" style={linkStyle}>
              Gmail labels →
            </a>
          )}
        </div>
      </div>
    )
  }
  if (label.kind === 'waiting' || label.kind === 'error') {
    return (
      <div style={rowStyle} data-email-label={label.label}>
        <div style={head}>
          {name}
          <span style={muted}>{label.kind === 'waiting' ? 'Not counted yet.' : label.words}</span>
        </div>
      </div>
    )
  }
  const f = label.facts
  return (
    <div style={rowStyle} data-email-label={label.label}>
      <div style={head}>
        {name}
        <span style={countChip(label.shown)}>{label.shown}</span>
        {label.shown === 0 ? (
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-green-800)' }}>clean</span>
        ) : f.oldestDays != null ? (
          <span style={muted}>
            oldest <b style={{ color: f.oldestDays > limitDays ? 'var(--text-red-700)' : 'inherit' }}>{f.oldestDays}d</b>
          </span>
        ) : null}
        {label.href && label.shown > 0 && (
          <a href={label.href} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, marginLeft: 'auto' }}>
            Open in Gmail →
          </a>
        )}
      </div>
      {f.past.map((t) => (
        <div key={t.threadId} style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap', padding: '0.3rem 0 0 0.25rem', fontSize: '0.8125rem' }} data-email-thread={t.threadId}>
          <span style={ageChip}>{t.days}d</span>
          {!narrow && <span style={{ ...muted, whiteSpace: 'nowrap' }}>{t.arrivedWords}</span>}
          <span style={{ flex: '1 1 12rem', minWidth: 0 }}>
            <b style={{ fontWeight: 600 }}>{t.from}</b> <span style={{ color: 'var(--text-700)' }}>· {t.subject}</span>
          </span>
          {t.href && (
            <a href={t.href} target="_blank" rel="noopener noreferrer" style={linkStyle}>
              Open →
            </a>
          )}
        </div>
      ))}
      {f.newer > 0 && f.past.length > 0 && <div style={{ ...muted, padding: '0.25rem 0 0 0.25rem' }}>+{f.newer} newer than {limitDays} days</div>}
      {label.cut && <div style={{ ...muted, padding: '0.25rem 0 0 0.25rem' }}>The newest {f.count} of {label.shown} are listed.</div>}
    </div>
  )
}

function BoxCard({ box, limitDays, narrow }: { box: StationBox; limitDays: number; narrow: boolean }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: '0.6rem', overflow: 'hidden' }} data-email-box={box.title}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', padding: '0.45rem 0.75rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <b style={{ fontSize: '0.875rem' }}>{box.title}</b>
        <span style={muted}>{box.who}</span>
        <span style={{ ...muted, marginLeft: 'auto', fontSize: '0.75rem' }}>{box.readWords}</span>
      </div>
      {box.problem && <div style={{ padding: '0.4rem 0.75rem', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>The last count stopped: {box.problem}</div>}
      {box.labels.map((l, i) => (
        <LabelRow key={l.label} label={l} limitDays={limitDays} first={i === 0} narrow={narrow} />
      ))}
    </div>
  )
}

export function QuickfillEmailSection({
  metricSectionId,
  markButtonPalette,
  onConfirmMark,
  lastMarkedAt = null,
  io = DEFAULT_IO,
  nowIso,
}: {
  metricSectionId: string
  markButtonPalette: MarkPalette
  onConfirmMark: (trimmedNote: string) => void
  /** The station's last mark, anyone's: what "since the last look" counts from. */
  lastMarkedAt?: string | null
  io?: EmailStationIo
  nowIso?: string
}) {
  const { showToast } = useToastContext()
  const { user, role } = useAuth()
  const [data, setData] = useState<EmailStationData | null>(null)
  const [loadProblem, setLoadProblem] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [word, setWord] = useState('')
  const [notes, setNotes] = useState<Record<RowKey, string>>(EMPTY_NOTES)
  const messages = useGcFollowUpNeeds(canOpenMessages(role))
  // Inside the Roller or a phone round the screen owns the mark (its Looked saves the reported note), so the station
  // draws no button of its own there.
  const inRound = useContext(QuickfillRoundScreenContext)
  const narrow = useNarrowViewport640()

  const load = useCallback(
    () =>
      io.load().then(
        (d) => {
          setData(d)
          setLoadProblem(null)
        },
        (e: unknown) => setLoadProblem(formatErrorMessage(e)),
      ),
    [io],
  )
  useEffect(() => {
    void load()
  }, [load])

  const now = nowIso ?? new Date().toISOString()
  const model = useMemo(
    () =>
      emailStation({
        on: data?.on ?? false,
        limitDays: data?.limitDays ?? 3,
        leadId: data?.leadId ?? null,
        rows: data?.rows ?? [],
        threads: data?.threads ?? [],
        names: data?.names ?? {},
        viewerId: user?.id ?? null,
        nowIso: now,
        sinceIso: lastMarkedAt,
        word,
      }),
    // `now` moves every render; the model follows the data, the viewer, the last look and the word.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, user?.id, lastMarkedAt, word],
  )
  const live = model.mode === 'live'
  const lines = useMemo(() => countEmailNoteLines(notes), [notes])
  const handNote = useMemo(() => composeEmailMarkNote(notes), [notes])
  // The count, and the note a plain mark saves (the Roller's and the round's Looked): the live list, or the typed rows.
  useReportQuickfillSectionMetric(metricSectionId, live ? model.open : lines, data === null && loadProblem === null, undefined, live ? model.note : handNote, live ? emailNextLine(model.boxes, model.limitDays) : null)

  const readAgain = async () => {
    setReading(true)
    try {
      await io.readAgain(model.boxes.map((b) => b.watchId))
      await load()
    } catch (e) {
      showToast(formatErrorMessage(e), 'error')
    } finally {
      setReading(false)
    }
  }

  function markByHand() {
    if (!handNote) {
      showToast('Say what is still in Inbox, Follow Up, or Next Actions (or "clear") before marking.', 'warning')
      return
    }
    onConfirmMark(handNote)
    setNotes(EMPTY_NOTES)
  }

  if (!live) {
    return (
      <section style={{ borderRadius: 8, padding: '0.75rem 1rem 1rem', background: 'var(--bg-page)' }} data-email-station="by-hand">
        {data && model.byHandWhy && (
          <p style={{ ...muted, margin: '0 0 0.5rem' }} data-email-by-hand-why>
            {model.byHandWhy}
          </p>
        )}
        {QUICKFILL_EMAIL_ROWS.map((r, i) => {
          const taId = `quickfill-email-${r.key}-textarea`
          return (
            <div key={r.key} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap', padding: '0.55rem 0', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
              <div style={{ flex: '0 0 8.5rem', minWidth: 0 }}>
                <label htmlFor={taId} style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
                  {r.label}
                </label>
                <a href={r.href} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                  {r.linkLabel} →
                </a>
              </div>
              <textarea
                id={taId}
                value={notes[r.key]}
                onChange={(e) => setNotes((prev) => ({ ...prev, [r.key]: e.target.value }))}
                placeholder={r.placeholder}
                rows={2}
                style={{ flex: '1 1 14rem', minWidth: 0, boxSizing: 'border-box', padding: '0.5rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: '0.875rem', fontFamily: 'inherit', resize: 'vertical', minHeight: '2.6rem' }}
              />
            </div>
          )
        })}
        {!inRound && (
          <MarkButton palette={markButtonPalette} onClick={markByHand}>
            Mark Email up to date!
          </MarkButton>
        )}
      </section>
    )
  }

  const settingsDoor = canSetEmailCount(role) ? '/settings?tab=settings-phone-texts' : model.boxes.some((b) => b.mine) ? '/settings?tab=settings-account' : null
  return (
    <section style={{ borderRadius: 8, padding: '0.75rem 1rem 1rem', background: 'var(--bg-page)' }} data-email-station="live">
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }} data-email-count-line>
        <span>
          {model.open} open
          {model.past > 0 && (
            <>
              {' · '}
              <b style={{ color: 'var(--text-red-700)' }}>
                {model.past} past {model.limitDays} days
              </b>
            </>
          )}
          {model.readWords && ` · ${model.readWords}`}
        </span>
        <button type="button" onClick={() => void readAgain()} disabled={reading} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', fontWeight: 600, fontSize: '0.8125rem', cursor: reading ? 'default' : 'pointer' }}>
          {reading ? 'Reading…' : READ_AGAIN}
        </button>
        {messages && messages.count > 0 && (
          <Link to="/messages" style={{ ...linkStyle, marginLeft: 'auto' }} data-email-messages-line>
            In Messages: {messages.title} →
          </Link>
        )}
      </div>
      {model.boxes.map((b) => (
        <BoxCard key={b.watchId} box={b} limitDays={model.limitDays} narrow={narrow} />
      ))}
      {model.since && (
        <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--text-700)', padding: '0.15rem 0.1rem 0' }} data-email-since>
          <span>{model.since.words}:</span>
          <b style={{ color: 'var(--text-link)' }}>+{model.since.newSince} new</b>
          <b style={{ color: 'var(--text-green-800)' }}>{model.since.clearedSince} cleared</b>
          <b>{model.since.stillSince} still here</b>
        </div>
      )}
      <input
        type="text"
        aria-label={WORD_PLACEHOLDER}
        placeholder={WORD_PLACEHOLDER}
        value={word}
        onChange={(e) => setWord(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', marginTop: '0.6rem', padding: '0.45rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit', fontSize: '0.875rem' }}
      />
      <p style={{ ...muted, margin: '0.6rem 0 0', lineHeight: 1.45 }} data-email-stance>
        {model.stance.join(' ')}
        {settingsDoor && (
          <>
            {' '}
            <Link to={settingsDoor} style={linkStyle}>
              Change in Settings
            </Link>
          </>
        )}
      </p>
      {!inRound && (
        <MarkButton
          palette={markButtonPalette}
          onClick={() => {
            onConfirmMark(model.note)
            setWord('')
          }}
        >
          {`Looked · ${model.open} open`}
        </MarkButton>
      )}
    </section>
  )
}
