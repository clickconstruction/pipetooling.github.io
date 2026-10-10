/**
 * The trades' signed waivers as the office sees them (P5a-2, `tradeFiles.ts`): the newest of each form on each draw,
 * the conditional first, labelled by the row's form.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { WAIVER_FILE_LABELS, waiverFilesByDraw, type WaiverFileRow } from './tradeFiles'

const row = (change: Partial<WaiverFileRow>): WaiverFileRow => ({
  record_id: 'd1',
  paper: 'conditional_progress',
  drive_url: 'https://drive.google.com/file/d/a/view',
  uploaded_at: '2026-10-10T18:00:00Z',
  ...change,
})

describe('the signed waivers on each draw (P5a-2)', () => {
  it('keeps the newest of each form, the conditional before the unconditional', () => {
    const files = waiverFilesByDraw([
      row({ paper: 'unconditional_progress', drive_url: 'https://drive.google.com/file/d/u/view', uploaded_at: '2026-10-20T15:00:00Z' }),
      row({}),
      row({ drive_url: 'https://drive.google.com/file/d/b/view', uploaded_at: '2026-10-11T09:00:00Z' }),
    ])
    expect(files.get('d1')).toEqual([
      { paper: 'conditional_progress', label: 'Conditional waiver PDF', url: 'https://drive.google.com/file/d/b/view' },
      { paper: 'unconditional_progress', label: 'Unconditional waiver PDF', url: 'https://drive.google.com/file/d/u/view' },
    ])
  })

  it('keeps each draw apart, and skips a row with no draw or no known form', () => {
    const files = waiverFilesByDraw([row({ record_id: 'd2', paper: 'unconditional_final' }), row({ record_id: null }), row({ paper: null }), row({ paper: 'their_own_form' })])
    expect([...files.keys()]).toEqual(['d2'])
    expect(files.get('d2')?.[0]?.label).toBe('Final release PDF')
  })

  it('labels each of the four forms in plain words', () => {
    expect(Object.values(WAIVER_FILE_LABELS)).toEqual(['Conditional waiver PDF', 'Unconditional waiver PDF', 'Conditional final release PDF', 'Final release PDF'])
    for (const words of Object.values(WAIVER_FILE_LABELS)) expect(plainWordsFailures(words), words).toEqual([])
  })
})
