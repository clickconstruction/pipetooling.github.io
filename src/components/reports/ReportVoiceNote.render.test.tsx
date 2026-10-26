// @vitest-environment jsdom
/**
 * Talk it through (punch list #186, item 1, PR 1, v2.5912): a press listens, the recognizer's final words land under
 * the Notes field as one paragraph when it ends, the next press stops it, a browser with no speech says to use the
 * keyboard's microphone, no signal says so, a refused microphone says so, and a report type with no text field draws
 * nothing. The recognizer is a fake on the window the component is handed.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SpeechRecognizer } from '../../hooks/useVoiceNote'
import { ReportVoiceNote } from './ReportVoiceNote'

afterEach(cleanup)

const FIELDS = [
  { label: 'How complete is the job?', input_type: 'percent_0_100' },
  { label: 'Notes', input_type: 'long_text' },
]

/** A recognizer the test drives by hand: `made` is the newest one. */
function fakeRecognizer() {
  const made: FakeRec[] = []
  class FakeRec implements SpeechRecognizer {
    lang = ''
    continuous = false
    interimResults = true
    maxAlternatives = 0
    started = 0
    stopped = 0
    onresult: SpeechRecognizer['onresult'] = null
    onend: SpeechRecognizer['onend'] = null
    onerror: SpeechRecognizer['onerror'] = null
    constructor() {
      made.push(this)
    }
    start() {
      this.started += 1
    }
    stop() {
      this.stopped += 1
      this.onend?.()
    }
    abort() {
      this.stopped += 1
    }
    say(...parts: string[]) {
      const results = parts.map((transcript) => Object.assign([{ transcript }], { isFinal: true }))
      this.onresult?.({ resultIndex: 0, results })
    }
  }
  return { ctor: FakeRec, made }
}

describe('ReportVoiceNote', () => {
  it('listens on a press, hands the words to the field when it ends, and stops on the next press', () => {
    const { ctor, made } = fakeRecognizer()
    const onHeard = vi.fn()
    render(<ReportVoiceNote fields={FIELDS} onHeard={onHeard} win={{ SpeechRecognition: ctor }} onLine={() => true} />)
    const button = screen.getByTestId('report-voice-note')
    expect(button.getAttribute('data-voice-kind')).toBe('idle')
    expect(screen.getByText('Talk it through')).toBeTruthy()
    fireEvent.click(button)
    expect(made).toHaveLength(1)
    expect(made[0].started).toBe(1)
    expect(made[0].continuous).toBe(true)
    expect(made[0].interimResults).toBe(false)
    expect(button.getAttribute('data-voice-kind')).toBe('listening')
    expect(screen.getByRole('button', { name: 'Stop listening' })).toBeTruthy()
    act(() => made[0].say('rough-in is done', 'we set the tub'))
    fireEvent.click(button)
    expect(made[0].stopped).toBe(1)
    expect(onHeard).toHaveBeenCalledTimes(1)
    const [field, merge] = onHeard.mock.calls[0] as [string, (existing: string) => string]
    expect(field).toBe('Notes')
    expect(merge('')).toBe('Rough-in is done we set the tub.')
    expect(merge('Typed first.')).toBe('Typed first.\n\nRough-in is done we set the tub.')
    expect(button.getAttribute('data-voice-kind')).toBe('done')
    expect(screen.getByText('Talk it through again')).toBeTruthy()
  })

  it('says nothing was heard when the recognizer ends with no words', () => {
    const { ctor, made } = fakeRecognizer()
    const onHeard = vi.fn()
    render(<ReportVoiceNote fields={FIELDS} onHeard={onHeard} win={{ webkitSpeechRecognition: ctor }} onLine={() => true} />)
    fireEvent.click(screen.getByTestId('report-voice-note'))
    act(() => made[0].onend?.())
    expect(onHeard).not.toHaveBeenCalled()
    expect(screen.getByText('Nothing was heard')).toBeTruthy()
  })

  it('names a refused microphone', () => {
    const { ctor, made } = fakeRecognizer()
    render(<ReportVoiceNote fields={FIELDS} onHeard={vi.fn()} win={{ SpeechRecognition: ctor }} onLine={() => true} />)
    fireEvent.click(screen.getByTestId('report-voice-note'))
    act(() => {
      made[0].onerror?.({ error: 'not-allowed' })
      made[0].onend?.()
    })
    expect(screen.getByText('The microphone is off for this app')).toBeTruthy()
  })

  it('points at the keyboard’s microphone with no speech in the browser, and says no signal offline', () => {
    render(<ReportVoiceNote fields={FIELDS} onHeard={vi.fn()} win={{}} onLine={() => true} />)
    expect(screen.getByText('Use the microphone on your keyboard')).toBeTruthy()
    expect(screen.getByText('This phone has no speech for the app. Tap Notes, then the microphone key.')).toBeTruthy()
    cleanup()
    const { ctor, made } = fakeRecognizer()
    render(<ReportVoiceNote fields={FIELDS} onHeard={vi.fn()} win={{ SpeechRecognition: ctor }} onLine={() => false} />)
    fireEvent.click(screen.getByTestId('report-voice-note'))
    expect(made).toHaveLength(0)
    expect(screen.getByText('No signal')).toBeTruthy()
  })

  it('draws nothing on a report type with no text field', () => {
    const { ctor } = fakeRecognizer()
    const { container } = render(<ReportVoiceNote fields={[{ label: 'Signature', input_type: 'signature_png' }]} onHeard={vi.fn()} win={{ SpeechRecognition: ctor }} onLine={() => true} />)
    expect(container.innerHTML).toBe('')
  })
})
