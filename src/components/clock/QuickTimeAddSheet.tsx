/**
 * Quick time add — the composer (to-dos/quick-time-add, PR 2).
 *
 * Office staff add 5–30 minutes for an off-hours call or email without clocking in. One control
 * per idea: HOW LONG is one bar (＋5 accumulates; a cell jumps there; the bar is the meter and
 * the 30 ceiling is where it ends), WHAT IT WAS is a kind and a few words, WHEN is one line that
 * is right by default, and the button says the number back ("Add 10 min") so a slip is never
 * silent. Built short and anchored to the top: the words are typed with the keyboard up, which
 * takes the bottom half of a phone.
 *
 * The rules are the database's (`add_quick_time`); `quickTimeAdd.ts` mirrors them so the sheet
 * can say why before a round trip. The daily ceiling is left to the server — this client does
 * not read `quick_add_minutes`, so it is safe to deploy before the migration is pushed.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { DatabaseError, withSupabaseRetry } from '../../utils/errorHandling'
import { calendarYmdInAppTzFromIso, formatDenverTimeOnly } from '../../utils/dateUtils'
import {
  QUICK_ADD_AGO_CHOICES,
  quickAddDayWord,
  QUICK_ADD_CELLS,
  QUICK_ADD_KINDS,
  QUICK_ADD_MAX,
  QUICK_ADD_NOTE_MAX,
  isQuickAddLength,
  quickAddAgoLabel,
  quickAddButtonLabel,
  quickAddNote,
  quickAddRefusal,
  quickAddWindow,
  stepQuickAddMinutes,
  tapQuickAddCell,
  type QuickAddKind,
  type QuickAddSession,
} from '../../lib/clock/quickTimeAdd'

type Props = {
  open: boolean
  onClose: () => void
  /** Today's sessions as the clock already holds them — for the "never over existing hours" check. */
  sessions: readonly { clocked_in_at: string; clocked_out_at: string | null }[]
  /** After the entry is written: the host refreshes its sessions and says so. */
  onAdded: (added: { minutes: number; note: string }) => void
}

const dayOf = (ms: number) => calendarYmdInAppTzFromIso(new Date(ms).toISOString())
// "7:40 pm", as the RPC's own sentence writes times.
const formatTime = (ms: number) => formatDenverTimeOnly(ms).replace(' AM', ' am').replace(' PM', ' pm')

export default function QuickTimeAddSheet({ open, onClose, sessions, onAdded }: Props) {
  const [minutes, setMinutes] = useState(0)
  const [kind, setKind] = useState<QuickAddKind>('Call')
  const [words, setWords] = useState('')
  const [agoMinutes, setAgoMinutes] = useState(0)
  const [agoOpen, setAgoOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [serverSays, setServerSays] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const wordsRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    setMinutes(0)
    setKind('Call')
    setWords('')
    setAgoMinutes(0)
    setAgoOpen(false)
    setServerSays(null)
    setNowMs(Date.now())
    // "just now" has to keep meaning now while the sheet sits open.
    const t = window.setInterval(() => setNowMs(Date.now()), 30_000)
    return () => window.clearInterval(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  const endedAtMs = nowMs - agoMinutes * 60_000
  const asSessions: QuickAddSession[] = useMemo(
    () => sessions.map((s) => ({ clockedInMs: Date.parse(s.clocked_in_at), clockedOutMs: s.clocked_out_at ? Date.parse(s.clocked_out_at) : null })),
    [sessions],
  )
  // The ceiling is the server's to refuse: pass none here (see the header).
  const refusal = quickAddRefusal({ minutes, note: words, endedAtMs, nowMs, dayOf, formatTime, sessions: asSessions, dayTotalMinutes: 0, dailyCeilingMinutes: Number.POSITIVE_INFINITY })
  const lengthChosen = isQuickAddLength(minutes)
  const window_ = lengthChosen ? quickAddWindow(endedAtMs, minutes) : null
  // Before a length and words exist, the button's own label is the prompt — no amber line yet.
  const showRefusal = lengthChosen && words.trim().length >= 3 ? refusal : null

  const touch = () => setServerSays(null)

  async function save() {
    if (busy || refusal) return
    setBusy(true)
    setServerSays(null)
    const note = quickAddNote(kind, words)
    try {
      await withSupabaseRetry(
        // Not retried: a first attempt that landed would make the retry an overlap refusal.
        () => supabase.rpc('add_quick_time' as never, { p_minutes: minutes, p_note: note, p_ended_at: new Date(endedAtMs).toISOString() } as never),
        'add quick time',
        { maxRetries: 0 },
      )
      onAdded({ minutes, note })
      onClose()
    } catch (e) {
      setServerSays(e instanceof DatabaseError ? (e.serverMessage ?? e.message) : e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null
  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="quick-time-title" onClick={() => !busy && onClose()}>
      <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
          <b style={{ fontSize: '2.1rem', lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', minWidth: '2ch' }} aria-live="polite">
            {minutes}
          </b>
          <span id="quick-time-title" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            min · quick time
          </span>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" style={closeStyle}>
            ×
          </button>
        </div>

        <div role="group" aria-label="How long" style={barStyle}>
          {QUICK_ADD_CELLS.map((cell) => {
            const lit = cell <= minutes
            return (
              <button
                key={cell}
                type="button"
                aria-pressed={lit}
                aria-label={`${cell} minutes`}
                disabled={busy}
                onClick={() => { setMinutes((m) => tapQuickAddCell(m, cell)); touch() }}
                style={{ ...cellStyle, background: lit ? ACTION_BLUE : 'var(--bg-subtle)', borderColor: lit ? ACTION_BLUE : 'var(--border)', color: lit ? 'white' : 'var(--text-faint)' }}
              >
                {cell}
              </button>
            )
          })}
          <button type="button" disabled={busy || minutes >= QUICK_ADD_MAX} onClick={() => { setMinutes((m) => stepQuickAddMinutes(m, 1)); touch() }} style={{ ...plusStyle, opacity: minutes >= QUICK_ADD_MAX ? 0.35 : 1 }}>
            ＋5
          </button>
        </div>

        <div role="group" aria-label="What kind" style={kindStyle}>
          {QUICK_ADD_KINDS.map((k, i) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              disabled={busy}
              onClick={() => { setKind(k); touch(); wordsRef.current?.focus() }}
              style={{ ...kindButtonStyle, borderRight: i < QUICK_ADD_KINDS.length - 1 ? '1px solid var(--border)' : 'none', background: kind === k ? 'var(--bg-subtle)' : 'transparent', color: kind === k ? 'var(--text-strong)' : 'var(--text-muted)' }}
            >
              {k}
            </button>
          ))}
        </div>
        <input
          ref={wordsRef}
          type="text"
          value={words}
          maxLength={QUICK_ADD_NOTE_MAX - 10}
          disabled={busy}
          onChange={(e) => { setWords(e.target.value); touch() }}
          onKeyDown={(e) => { if (e.key === 'Enter') void save() }}
          placeholder="Who, and what about — Acme, the Oak St invoice"
          aria-label="Who, and what about"
          enterKeyHint="done"
          style={wordsStyle}
        />

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '9px 2px 0', minHeight: '1.4em' }}>
          {window_ ? (
            <>
              <b style={{ color: 'var(--text-strong)', fontWeight: 600 }}>
                {formatTime(window_.startMs)} – {formatTime(window_.endMs)}
              </b>{' '}
              {quickAddDayWord(window_, { dayOf, nowMs })} · Office · ended{' '}
              <button type="button" onClick={() => setAgoOpen((o) => !o)} aria-expanded={agoOpen} disabled={busy} style={agoLinkStyle}>
                {quickAddAgoLabel(agoMinutes)}
              </button>
            </>
          ) : (
            'Tap ＋5 to start.'
          )}
        </div>
        {agoOpen && window_ ? (
          <div role="group" aria-label="When it ended" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
            {QUICK_ADD_AGO_CHOICES.map((ago) => (
              <button key={ago} type="button" aria-pressed={agoMinutes === ago} disabled={busy} onClick={() => { setAgoMinutes(ago); setNowMs(Date.now()); touch() }} style={{ ...agoChipStyle, borderColor: agoMinutes === ago ? ACTION_BLUE : 'var(--border)', color: agoMinutes === ago ? 'var(--text-strong)' : 'var(--text-muted)' }}>
                {quickAddAgoLabel(ago)}
              </button>
            ))}
          </div>
        ) : null}

        {serverSays || showRefusal ? (
          <div role="alert" style={{ fontSize: '0.78rem', color: 'var(--text-amber-700)', marginTop: 8 }}>
            {serverSays ?? showRefusal}
          </div>
        ) : null}

        <button type="button" onClick={() => void save()} disabled={busy || refusal != null} style={{ ...goStyle, background: refusal == null ? ACTION_GREEN : 'var(--bg-muted)', color: refusal == null ? 'white' : 'var(--text-faint)', cursor: refusal == null && !busy ? 'pointer' : 'not-allowed' }}>
          {busy ? 'Adding…' : quickAddButtonLabel(minutes, words)}
        </button>
        <p style={{ margin: '8px 2px 0', fontSize: '0.72rem', color: 'var(--text-faint)' }}>It goes to approval like any hours entry, marked as a quick add.</p>
      </div>
    </div>
  )
}

// Saturated action colors stay literal (CLAUDE.md): the text tokens are pale in dark mode and read as disabled.
const ACTION_BLUE = '#2563eb'
const ACTION_BLUE_SOFT = '#3b82f6'
const ACTION_GREEN = '#16a34a'

// Anchored to the TOP: the keyboard takes the bottom half of a phone while the words are typed.
const overlayStyle: CSSProperties = { position: 'fixed', inset: 0, zIndex: 1001, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'calc(0.75rem + env(safe-area-inset-top, 0px)) 0.75rem 0.75rem' }
const sheetStyle: CSSProperties = { width: '100%', maxWidth: 400, background: 'var(--surface)', color: 'var(--text-base)', border: '1px solid var(--border)', borderRadius: 18, padding: 14, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)' }
const closeStyle: CSSProperties = { marginLeft: 'auto', border: 'none', background: 'transparent', color: 'var(--text-faint)', fontSize: '1.4rem', lineHeight: 1, cursor: 'pointer', padding: '0 2px' }
const barStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr) 64px', gap: 5, alignItems: 'stretch' }
const cellStyle: CSSProperties = { font: 'inherit', fontSize: '0.8rem', fontWeight: 700, border: '1px solid var(--border)', borderRadius: 9, padding: '15px 0', cursor: 'pointer' }
const plusStyle: CSSProperties = { font: 'inherit', fontSize: '0.95rem', fontWeight: 800, border: 'none', borderRadius: 9, background: ACTION_BLUE_SOFT, color: 'white', cursor: 'pointer' }
const kindStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', margin: '12px 0 6px', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }
const kindButtonStyle: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, border: 'none', padding: '10px 0', cursor: 'pointer' }
const wordsStyle: CSSProperties = { font: 'inherit', fontSize: '1rem', width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)' }
const agoLinkStyle: CSSProperties = { font: 'inherit', fontWeight: 600, border: 'none', background: 'transparent', color: 'var(--text-link)', padding: 0, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }
const agoChipStyle: CSSProperties = { font: 'inherit', fontSize: '0.75rem', border: '1px solid var(--border)', borderRadius: 999, background: 'transparent', padding: '6px 10px', cursor: 'pointer' }
const goStyle: CSSProperties = { font: 'inherit', fontSize: '1rem', fontWeight: 800, width: '100%', marginTop: 11, border: 'none', borderRadius: 11, padding: 15 }
