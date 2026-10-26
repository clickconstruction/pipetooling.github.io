import { useCallback, useEffect, useRef, useState } from 'react'
import { LISTEN_MAX_MS, SILENCE_STOP_MS, VOICE_IDLE, joinHeard, kindForError, speechLang, speechRecognitionOf, type VoiceState } from '../lib/reports/voiceNote'

/** The browser's speech recognizer, as much of it as the hook uses. `lib.dom` names its results and not the recognizer itself. */
export interface SpeechRecognizer {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
}

export type SpeechRecognizerCtor = new () => SpeechRecognizer

export interface VoiceNoteWindow {
  SpeechRecognition?: SpeechRecognizerCtor
  webkitSpeechRecognition?: SpeechRecognizerCtor
}

export interface VoiceNoteHandle {
  state: VoiceState
  /** Whether this browser can listen at all. */
  available: boolean
  /** The button's press: start listening, or stop and hand the words over. */
  press: () => void
}

/**
 * Talk it through (punch list #186, item 1, PR 1, v2.5912): runs the browser's speech recognizer for one note. A press
 * starts it in the phone's language, continuous, final results only; the next press, three seconds of quiet after the
 * last words, or two minutes stops it. The final results are joined once and handed to `onHeard` as one paragraph, so
 * the field gets a single addition the tech reads before Save report. A refused microphone, a lost network and an
 * empty note each have their own state for the button's words. `win` and `onLine` are the smokes' seams.
 */
export function useVoiceNote(
  onHeard: (text: string) => void,
  win: VoiceNoteWindow | null = typeof window === 'undefined' ? null : (window as unknown as VoiceNoteWindow),
  onLine: () => boolean = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false),
): VoiceNoteHandle {
  const ctor = speechRecognitionOf(win)
  const [state, setState] = useState<VoiceState>(ctor ? VOICE_IDLE : { kind: 'unavailable', seconds: 0 })
  const rec = useRef<SpeechRecognizer | null>(null)
  const heard = useRef<string[]>([])
  const startedAt = useRef(0)
  const silence = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longest = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tick = useRef<ReturnType<typeof setInterval> | null>(null)
  const failed = useRef<string | null>(null)
  const latest = useRef(onHeard)
  latest.current = onHeard

  const clearTimers = () => {
    if (silence.current) clearTimeout(silence.current)
    if (longest.current) clearTimeout(longest.current)
    if (tick.current) clearInterval(tick.current)
    silence.current = null
    longest.current = null
    tick.current = null
  }

  const stop = useCallback(() => {
    const r = rec.current
    if (!r) return
    try {
      r.stop()
    } catch {
      // Stopped already: its end handler finishes the note.
    }
  }, [])

  const finish = useCallback(() => {
    clearTimers()
    rec.current = null
    const secondsHeard = (Date.now() - startedAt.current) / 1000
    const text = joinHeard(heard.current)
    heard.current = []
    if (failed.current) {
      setState({ kind: kindForError(failed.current), seconds: 0 })
      failed.current = null
      return
    }
    if (!text) {
      setState({ kind: 'failed', seconds: 0 })
      return
    }
    latest.current(text)
    setState({ kind: 'done', seconds: secondsHeard })
  }, [])

  const start = useCallback(() => {
    if (!ctor) return
    if (!onLine()) {
      setState({ kind: 'offline', seconds: 0 })
      return
    }
    let r: SpeechRecognizer
    try {
      r = new ctor()
    } catch {
      setState({ kind: 'unavailable', seconds: 0 })
      return
    }
    r.lang = speechLang(typeof navigator === 'undefined' ? null : navigator.language)
    r.continuous = true
    r.interimResults = false
    r.maxAlternatives = 1
    heard.current = []
    failed.current = null
    const armSilence = () => {
      if (silence.current) clearTimeout(silence.current)
      silence.current = setTimeout(stop, SILENCE_STOP_MS * 2)
    }
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        if (result.isFinal && result[0]) heard.current.push(result[0].transcript)
      }
      if (silence.current) clearTimeout(silence.current)
      silence.current = setTimeout(stop, SILENCE_STOP_MS)
    }
    r.onerror = (e) => {
      // 'aborted' and 'no-speech' are the recognizer's own endings; the rest name a cause the button says.
      if (e.error !== 'aborted' && e.error !== 'no-speech') failed.current = e.error
    }
    r.onend = finish
    rec.current = r
    startedAt.current = Date.now()
    setState({ kind: 'listening', seconds: 0 })
    try {
      r.start()
    } catch {
      rec.current = null
      setState({ kind: 'failed', seconds: 0 })
      return
    }
    armSilence()
    longest.current = setTimeout(stop, LISTEN_MAX_MS)
    tick.current = setInterval(() => setState((s) => (s.kind === 'listening' ? { kind: 'listening', seconds: (Date.now() - startedAt.current) / 1000 } : s)), 1000)
  }, [ctor, finish, onLine, stop])

  const press = useCallback(() => {
    if (rec.current) stop()
    else start()
  }, [start, stop])

  useEffect(
    () => () => {
      clearTimers()
      const r = rec.current
      rec.current = null
      if (r) {
        r.onend = null
        try {
          r.abort()
        } catch {
          // Gone with the form.
        }
      }
    },
    [],
  )

  return { state, available: ctor !== null, press }
}
