import { describe, expect, it } from 'vitest'
import { lienWaiverSignPayload, type LienWaiverSignOnPageHandle } from './lienWaiverSignPayload'

/** A signature line: drawing with ink or not, or typing. */
function line(mode: 'draw' | 'type', ink: string | null = null): LienWaiverSignOnPageHandle {
  return { mode, isEmpty: () => mode === 'draw' && !ink, toDataURL: () => (mode === 'draw' ? ink : null), clear: () => undefined }
}

describe('lienWaiverSignPayload (v2.4335)', () => {
  it('drawn on the line and agreed: the drawing is what is signed, under the printed name', () => {
    expect(lienWaiverSignPayload(line('draw', 'data:image/png;base64,INK'), '  Malachi Whites ', true)).toEqual({
      payload: { mode: 'draw', printedName: 'Malachi Whites', signaturePngBase64: 'data:image/png;base64,INK' },
    })
  })
  it('typed at my own desk and agreed: the name is the signature', () => {
    expect(lienWaiverSignPayload(line('type'), 'Robert Douglas', true)).toEqual({ payload: { mode: 'type', printedName: 'Robert Douglas' } })
  })
  it('nothing on the line yet: asks for the signature before the box', () => {
    expect(lienWaiverSignPayload(line('draw'), 'Malachi Whites', false)).toEqual({ error: 'Sign on the line first.' })
    expect(lienWaiverSignPayload(line('draw'), 'Malachi Whites', true)).toEqual({ error: 'Sign on the line first.' })
  })
  it('signed but the box not ticked', () => {
    expect(lienWaiverSignPayload(line('draw', 'data:image/png;base64,INK'), 'Malachi Whites', false)).toEqual({ error: 'Tick the box to agree first.' })
    expect(lienWaiverSignPayload(line('type'), 'Robert Douglas', false)).toEqual({ error: 'Tick the box to agree first.' })
  })
  it('no name to print under the line, or no line yet', () => {
    expect(lienWaiverSignPayload(line('draw', 'data:image/png;base64,INK'), '   ', true)).toEqual({ error: 'There is no name to print under the signature. Fill in Signed by on the waiver first.' })
    expect(lienWaiverSignPayload(null, 'Malachi Whites', true)).toEqual({ error: 'The signature line is not ready yet.' })
  })
})
