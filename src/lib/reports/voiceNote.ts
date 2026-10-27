/**
 * Talk it through (punch list #186, item 1, PR 1, v2.5912): a tech talks a field report through instead of thumb-typing
 * it. The phone's own speech (the browser's `SpeechRecognition`, Safari on an iPhone, Chrome on Android) turns the
 * words into text, and the text goes into the report's Notes field for the tech to read and save. Nothing is written
 * until Save report, as before. With no speech in the browser, or no signal, the button says to use the microphone on
 * the keyboard, which types into Notes on its own. Pure: the hook `useVoiceNote` runs the recognizer and
 * `ReportVoiceNote` draws; this file holds the words, the states and the merges, held to the plain-words rule.
 */

export type VoiceKind = 'idle' | 'listening' | 'done' | 'drafting' | 'drafted' | 'unavailable' | 'offline' | 'denied' | 'failed'

export interface VoiceState {
  kind: VoiceKind
  /** Seconds heard so far while listening, or heard in all once done. */
  seconds: number
}

export const VOICE_IDLE: VoiceState = { kind: 'idle', seconds: 0 }

/** The button's words by state: its title and the line under it. The field is the Notes field's own label. */
export function voiceButtonWords(state: VoiceState, field: string): { title: string; hint: string } {
  switch (state.kind) {
    case 'listening':
      return { title: `Listening · ${clock(state.seconds)}`, hint: 'Say what was done, which lines, the parts and the next step. Tap to stop.' }
    case 'done':
      return { title: 'Talk it through again', hint: `Heard ${seconds(state.seconds)}. The words are in ${field}. Read them, then save.` }
    case 'drafting':
      return { title: 'Drafting…', hint: `Heard ${seconds(state.seconds)}. The report is being drafted from your words.` }
    case 'drafted':
      return { title: 'Talk it through again', hint: `Drafted from ${seconds(state.seconds)} of talk. Read it, then save.` }
    case 'unavailable':
      return { title: 'Use the microphone on your keyboard', hint: `This phone has no speech for the app. Tap ${field}, then the microphone key.` }
    case 'offline':
      return { title: 'No signal', hint: 'Use the microphone on your keyboard. The report waits to send.' }
    case 'denied':
      return { title: 'The microphone is off for this app', hint: 'Allow the microphone in your phone’s settings, or use the microphone on your keyboard.' }
    case 'failed':
      return { title: 'Nothing was heard', hint: 'Tap to try again, or use the microphone on your keyboard.' }
    default:
      return { title: 'Talk it through', hint: 'Say what was done, which lines, the parts and the next step. The words go into the report.' }
  }
}

/** The button's accessible name: what a press does. */
export function voicePressLabel(state: VoiceState): string {
  if (state.kind === 'listening') return 'Stop listening'
  if (state.kind === 'drafting') return 'Drafting'
  return 'Talk it through'
}

/** "0:14" */
export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** "14 seconds", "1 second" */
export function seconds(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  return `${s} second${s === 1 ? '' : 's'}`
}

/** The window's speech recognizer, by either of its names, or null where the browser has none. */
export function speechRecognitionOf<T>(win: { SpeechRecognition?: T; webkitSpeechRecognition?: T } | null | undefined): T | null {
  if (!win) return null
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null
}

/** The language the recognizer listens for: the phone's own, English when it says nothing. */
export function speechLang(navigatorLanguage: string | null | undefined): string {
  const l = (navigatorLanguage ?? '').trim()
  return l || 'en-US'
}

/** The field the words go into: the one named Notes, else the first long text field. Null when the type has none. */
export function notesFieldLabel(fields: ReadonlyArray<{ label: string; input_type?: string | null }>): string | null {
  const text = fields.filter((f) => (f.input_type ?? 'long_text') === 'long_text')
  const notes = text.find((f) => f.label.trim().toLowerCase() === 'notes')
  return (notes ?? text[0])?.label ?? null
}

/** The recognizer's final results as one paragraph: joined, the spaces tidied, a capital at the start, a stop at the end. */
export function joinHeard(parts: readonly string[]): string {
  const flat = parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!flat) return ''
  const capped = flat.charAt(0).toUpperCase() + flat.slice(1)
  return /[.!?]$/.test(capped) ? capped : `${capped}.`
}

/** The words heard, added under what the field already holds. */
export function mergeHeard(existing: string, heard: string): string {
  const was = existing.trim()
  const now = heard.trim()
  if (!now) return existing
  return was ? `${was}\n\n${now}` : now
}

/** What the recognizer's error means here. */
export function kindForError(error: string | null | undefined): VoiceKind {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'denied'
    case 'network':
      return 'offline'
    default:
      return 'failed'
  }
}

/** How long a quiet spell runs before listening stops on its own, in milliseconds. */
export const SILENCE_STOP_MS = 3000
/** The longest one note runs, in milliseconds: two minutes is a long report. */
export const LISTEN_MAX_MS = 120_000
