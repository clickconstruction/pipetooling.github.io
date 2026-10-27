import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  VOICE_IDLE,
  clock,
  joinHeard,
  kindForError,
  mergeHeard,
  notesFieldLabel,
  seconds,
  speechLang,
  speechRecognitionOf,
  voiceButtonWords,
  voicePressLabel,
  type VoiceKind,
} from './voiceNote'

const KINDS: VoiceKind[] = ['idle', 'listening', 'done', 'unavailable', 'offline', 'denied', 'failed']

describe('the button’s words', () => {
  it('says what a press does in every state, in plain words', () => {
    for (const kind of KINDS) {
      const w = voiceButtonWords({ kind, seconds: 14 }, 'Notes')
      expect(w.title).toBeTruthy()
      expect(plainWordsFailures(w.hint)).toEqual([])
    }
    expect(voiceButtonWords(VOICE_IDLE, 'Notes').title).toBe('Talk it through')
    expect(voiceButtonWords({ kind: 'listening', seconds: 74 }, 'Notes').title).toBe('Listening · 1:14')
    expect(voiceButtonWords({ kind: 'done', seconds: 22 }, 'Notes').hint).toBe('Heard 22 seconds. The words are in Notes. Read them, then save.')
    expect(voiceButtonWords({ kind: 'unavailable', seconds: 0 }, 'Work done').hint).toBe('This phone has no speech for the app. Tap Work done, then the microphone key.')
    expect(voicePressLabel(VOICE_IDLE)).toBe('Talk it through')
    expect(voicePressLabel({ kind: 'listening', seconds: 3 })).toBe('Stop listening')
  })

  it('prints a clock and a count of seconds', () => {
    expect(clock(0)).toBe('0:00')
    expect(clock(74.8)).toBe('1:14')
    expect(seconds(1)).toBe('1 second')
    expect(seconds(21.6)).toBe('22 seconds')
  })
})

describe('the recognizer', () => {
  it('is found by either of its names, else none', () => {
    const A = class {}
    expect(speechRecognitionOf({ SpeechRecognition: A })).toBe(A)
    expect(speechRecognitionOf({ webkitSpeechRecognition: A })).toBe(A)
    expect(speechRecognitionOf({})).toBeNull()
    expect(speechRecognitionOf(null)).toBeNull()
  })

  it('listens in the phone’s own language, English when it says nothing', () => {
    expect(speechLang('es-MX')).toBe('es-MX')
    expect(speechLang('')).toBe('en-US')
    expect(speechLang(undefined)).toBe('en-US')
  })

  it('reads a refused microphone, a lost network and anything else', () => {
    expect(kindForError('not-allowed')).toBe('denied')
    expect(kindForError('service-not-allowed')).toBe('denied')
    expect(kindForError('network')).toBe('offline')
    expect(kindForError('no-speech')).toBe('failed')
    expect(kindForError(undefined)).toBe('failed')
  })
})

describe('the words into the field', () => {
  it('goes into Notes, else the first long text field, and nowhere on a type with none', () => {
    expect(notesFieldLabel([{ label: 'How complete is the job?', input_type: 'percent_0_100' }, { label: 'Work done' }, { label: 'notes' }])).toBe('notes')
    expect(notesFieldLabel([{ label: 'Reason', input_type: 'long_text' }, { label: 'Note', input_type: 'long_text' }])).toBe('Reason')
    expect(notesFieldLabel([{ label: 'How complete is the job?', input_type: 'percent_0_100' }, { label: 'Signature', input_type: 'signature_png' }])).toBeNull()
  })

  it('joins what was heard into one tidy paragraph', () => {
    expect(joinHeard(['rough-in is done ', '  we set the tub', 'top-out tomorrow'])).toBe('Rough-in is done we set the tub top-out tomorrow.')
    expect(joinHeard(['Rough-in is done.'])).toBe('Rough-in is done.')
    expect(joinHeard(['', '  '])).toBe('')
  })

  it('adds the words under what the field already holds', () => {
    expect(mergeHeard('', 'Rough-in is done.')).toBe('Rough-in is done.')
    expect(mergeHeard('Typed first.  ', 'Rough-in is done.')).toBe('Typed first.\n\nRough-in is done.')
    expect(mergeHeard('Typed first.', '  ')).toBe('Typed first.')
  })
})
