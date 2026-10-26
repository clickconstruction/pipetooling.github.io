import { useMemo, type CSSProperties } from 'react'
import { useVoiceNote, type VoiceNoteWindow } from '../../hooks/useVoiceNote'
import { mergeHeard, notesFieldLabel, voiceButtonWords, voicePressLabel, type VoiceState } from '../../lib/reports/voiceNote'

/**
 * Talk it through (punch list #186, item 1, PR 1, v2.5912): the button over Report type on both report forms. A press
 * listens; the words land under what the Notes field holds (`notesFieldLabel`, `mergeHeard`), and the tech reads them
 * before Save report. Draws nothing on a report type with no text field. `win` and `onLine` are the smoke's seams.
 */
export function ReportVoiceNote({
  fields,
  onHeard,
  win,
  onLine,
}: {
  fields: ReadonlyArray<{ label: string; input_type?: string | null }>
  /** The words heard, to put into the field: the host merges with `mergeHeard` through this. */
  onHeard: (fieldLabel: string, merge: (existing: string) => string) => void
  win?: VoiceNoteWindow | null
  onLine?: () => boolean
}) {
  const field = useMemo(() => notesFieldLabel(fields), [fields])
  const voice = useVoiceNote(
    (text) => {
      if (field) onHeard(field, (existing) => mergeHeard(existing, text))
    },
    win,
    onLine,
  )
  if (!field) return null
  return <VoiceNoteButton state={voice.state} field={field} onPress={voice.press} />
}

/** The button itself: the microphone, the title and the line under it, in the state's color. */
export function VoiceNoteButton({ state, field, onPress }: { state: VoiceState; field: string; onPress: () => void }) {
  const words = voiceButtonWords(state, field)
  const look = lookFor(state)
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={voicePressLabel(state)}
      aria-pressed={state.kind === 'listening'}
      data-testid="report-voice-note"
      data-voice-kind={state.kind}
      style={{ ...buttonStyle, background: look.bg, borderColor: look.border }}
    >
      <span aria-hidden style={{ ...micStyle, background: look.mic }}>
        {state.kind === 'listening' ? '●' : '🎙'}
      </span>
      <span style={{ display: 'grid', minWidth: 0, textAlign: 'left' }}>
        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: look.title }}>{words.title}</span>
        <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary, var(--text-muted))', whiteSpace: 'normal' }}>{words.hint}</span>
      </span>
    </button>
  )
}

function lookFor(state: VoiceState): { bg: string; border: string; mic: string; title: string } {
  switch (state.kind) {
    case 'listening':
      return { bg: 'var(--bg-red-tint, var(--bg-red-50))', border: 'var(--border-red-soft, var(--border))', mic: 'var(--text-red-700)', title: 'var(--text-red-700)' }
    case 'unavailable':
    case 'offline':
    case 'denied':
    case 'failed':
      return { bg: 'var(--bg-muted)', border: 'var(--border)', mic: 'var(--text-muted)', title: 'var(--text-strong)' }
    default:
      return { bg: 'var(--bg-blue-tint)', border: 'var(--border-blue-soft, var(--border))', mic: 'var(--text-blue-700)', title: 'var(--text-blue-700)' }
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
