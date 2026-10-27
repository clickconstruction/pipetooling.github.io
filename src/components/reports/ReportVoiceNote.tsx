import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useVoiceNote, type VoiceNoteWindow } from '../../hooks/useVoiceNote'
import { DRAFT_WORDS, draftRequest, type VoiceDraftHost } from '../../lib/reports/voiceDraft'
import { mergeHeard, notesFieldLabel, speechLang, voiceButtonWords, voicePressLabel, type VoiceState } from '../../lib/reports/voiceNote'

/**
 * Talk it through (punch list #186, item 1; PR 1 v2.5912, PR 2 v2.5916): the button over Report type on both report
 * forms. A press listens; when the words are in, the form either drafts the report from them (`draft` given: the
 * words, the job's lines and the text fields go to `report-draft`, and the host puts the draft on the form) or puts
 * the words under what the Notes field holds (`notesFieldLabel`, `mergeHeard`). A draft that cannot be made, for want
 * of a key or an answer, falls back to the words in Notes, and the button says which happened. The tech reads either
 * before Save report. Draws nothing on a report type with no text field. `win` and `onLine` are the smoke's seams.
 */

type DraftPhase = { kind: 'drafting' } | { kind: 'drafted'; cents: number | null } | { kind: 'fell'; words: string } | null

export function ReportVoiceNote({
  fields,
  onHeard,
  draft,
  win,
  onLine,
  lang,
}: {
  fields: ReadonlyArray<{ label: string; input_type?: string | null }>
  /** The words heard, to put into the field: the host merges with `mergeHeard` through this. */
  onHeard: (fieldLabel: string, merge: (existing: string) => string) => void
  /** When given, the words are drafted into the fields first; the plain words are the fallback. */
  draft?: VoiceDraftHost
  win?: VoiceNoteWindow | null
  onLine?: () => boolean
  /** The phone's language; the smoke's seam. */
  lang?: string
}) {
  const field = useMemo(() => notesFieldLabel(fields), [fields])
  const [phase, setPhase] = useState<DraftPhase>(null)
  const latest = useRef({ draft, onHeard, field, fields, lang })
  latest.current = { draft, onHeard, field, fields, lang }
  // A draft that lands after the form closed is dropped, so a reset form never fills with an old note.
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const voice = useVoiceNote(
    (text) => {
      const { draft: host, onHeard: heard, field: notes, fields: fs, lang: phoneLang } = latest.current
      if (!notes) return
      if (!host) {
        heard(notes, (existing) => mergeHeard(existing, text))
        return
      }
      setPhase({ kind: 'drafting' })
      const said = { text, lang: speechLang(phoneLang ?? (typeof navigator === 'undefined' ? null : navigator.language)) }
      void host
        .request(draftRequest({ transcript: text, lang: said.lang, jobName: host.jobName, lines: host.lines, picks: host.picks, fields: fs }))
        .then((answer) => {
          if (!alive.current) return
          if (answer.ok) {
            host.onDraft(answer.draft, said)
            setPhase({ kind: 'drafted', cents: answer.cents })
          } else {
            heard(notes, (existing) => mergeHeard(existing, text))
            setPhase({ kind: 'fell', words: answer.reason === 'noKey' ? DRAFT_WORDS.noKey : DRAFT_WORDS.failed })
          }
        })
    },
    win,
    onLine,
  )
  if (!field) return null

  // The button's state: the draft's phase over the recognizer's own, once the words are in.
  const state: VoiceState = phase && voice.state.kind === 'done' ? { kind: phase.kind === 'drafting' ? 'drafting' : 'drafted', seconds: voice.state.seconds } : voice.state
  const hint =
    phase && voice.state.kind === 'done' ? (phase.kind === 'drafted' ? DRAFT_WORDS.drafted(voice.state.seconds, phase.cents) : phase.kind === 'fell' ? `Heard, but not drafted. ${phase.words}` : undefined) : undefined
  const press = () => {
    if (state.kind === 'drafting') return
    if (voice.state.kind !== 'listening') setPhase(null)
    voice.press()
  }
  return <VoiceNoteButton state={state} field={field} onPress={press} hint={hint} />
}

/** The button itself: the microphone, the title and the line under it, in the state's color. */
export function VoiceNoteButton({ state, field, onPress, hint }: { state: VoiceState; field: string; onPress: () => void; hint?: string }) {
  const words = voiceButtonWords(state, field)
  const look = lookFor(state)
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={voicePressLabel(state)}
      aria-pressed={state.kind === 'listening'}
      aria-busy={state.kind === 'drafting'}
      data-testid="report-voice-note"
      data-voice-kind={state.kind}
      style={{ ...buttonStyle, background: look.bg, borderColor: look.border }}
    >
      <span aria-hidden style={{ ...micStyle, background: look.mic }}>
        {state.kind === 'listening' ? '●' : state.kind === 'drafting' ? '…' : '🎙'}
      </span>
      <span style={{ display: 'grid', minWidth: 0, textAlign: 'left' }}>
        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: look.title }}>{words.title}</span>
        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', whiteSpace: 'normal' }}>{hint ?? words.hint}</span>
      </span>
    </button>
  )
}

function lookFor(state: VoiceState): { bg: string; border: string; mic: string; title: string } {
  switch (state.kind) {
    case 'listening':
      return { bg: 'var(--bg-red-tint)', border: 'var(--border-red)', mic: 'var(--text-red-700)', title: 'var(--text-red-700)' }
    case 'unavailable':
    case 'offline':
    case 'denied':
    case 'failed':
      return { bg: 'var(--bg-muted)', border: 'var(--border)', mic: 'var(--text-muted)', title: 'var(--text-strong)' }
    default:
      return { bg: 'var(--bg-blue-tint)', border: 'var(--border-blue)', mic: 'var(--text-blue-700)', title: 'var(--text-blue-700)' }
  }
}

const buttonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  padding: '10px 12px',
  marginBottom: '1rem',
  borderRadius: 10,
  border: '1px solid',
  font: 'inherit',
  cursor: 'pointer',
  color: 'inherit',
}

const micStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 999,
  color: 'var(--surface)',
  display: 'grid',
  placeItems: 'center',
  fontSize: 16,
  flex: 'none',
}
