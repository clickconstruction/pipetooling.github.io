import { describe, expect, it } from 'vitest'
import { parseJobSettingsPaper } from './jobPaperSettingsIo'
import {
  GC_VIEW_LABEL,
  gcViewChoices,
  gcViewLabel,
  pageMarksWords,
} from './jobPaperGcView'

describe('jobPaperGcView · what the GC sees, as the office sets it', () => {
  it('lists the three ways, least shown first', () => {
    expect(GC_VIEW_LABEL).toBe('What the GC sees')
    expect(gcViewChoices()).toEqual([
      { key: 'count', label: 'How many have signed' },
      {
        key: 'businesses',
        label: 'How many, and each sub business with its day',
      },
      {
        key: 'names',
        label: 'How many, each sub business, and every signer by name',
      },
    ])
    expect(gcViewLabel('names')).toBe(
      'How many, each sub business, and every signer by name',
    )
  })

  it('names what the press saves when only the page’s own marks moved', () => {
    expect(pageMarksWords({ basis: false, gcView: false })).toBeNull()
    expect(pageMarksWords({ basis: true, gcView: false })?.press).toBe(
      'Save the basis',
    )
    expect(pageMarksWords({ basis: false, gcView: true })).toEqual({
      press: 'Save what the GC sees',
      line: 'This marks the GC’s page, never the paper. Nobody signs again.',
      done: 'What the GC sees is set. Nobody signs again.',
    })
    expect(pageMarksWords({ basis: true, gcView: true })?.press).toBe(
      'Save the basis and what the GC sees',
    )
  })

  it('reads the row’s setting, and a row nobody set as the businesses', () => {
    const row = { id: 'row-1', settings: { photos: 'ask' } }
    expect(parseJobSettingsPaper(row, 0)?.gcView).toBe('businesses')
    expect(parseJobSettingsPaper({ ...row, gc_view: null }, 0)?.gcView).toBe(
      'businesses',
    )
    expect(parseJobSettingsPaper({ ...row, gc_view: 'count' }, 0)?.gcView).toBe(
      'count',
    )
    expect(parseJobSettingsPaper({ ...row, gc_view: 'names' }, 2)?.gcView).toBe(
      'names',
    )
    expect(
      parseJobSettingsPaper({ ...row, gc_view: 'everything' }, 0)?.gcView,
    ).toBe('businesses')
  })
})
