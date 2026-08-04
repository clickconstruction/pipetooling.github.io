import { describe, expect, it } from 'vitest'
import { resolvePartFormSaveTarget } from './partFormSaveTarget'

function input(partial: Partial<Parameters<typeof resolvePartFormSaveTarget>[0]> = {}) {
  return {
    capturedRoughLineId: null,
    addPartsToTemplateModalOpen: false,
    editTemplateModalOpen: false,
    livePickerLineId: null,
    ...partial,
  }
}

describe('resolvePartFormSaveTarget', () => {
  it('THE REGRESSION: a captured rough line still routes after the blur race nulls the live picker id', () => {
    expect(resolvePartFormSaveTarget(input({ capturedRoughLineId: 'line-1', livePickerLineId: null }))).toEqual({
      kind: 'roughLine',
      lineId: 'line-1',
    })
  })

  it('without a capture and with the live id gone, it falls through to the assembly draft (the old broken path)', () => {
    expect(resolvePartFormSaveTarget(input())).toEqual({ kind: 'assemblyDraftItem' })
  })

  it('keeps the live picker id as a fallback when nothing was captured', () => {
    expect(resolvePartFormSaveTarget(input({ livePickerLineId: 'line-2' }))).toEqual({ kind: 'roughLine', lineId: 'line-2' })
  })

  it('a captured line wins over both assembly modals (its capture is explicit)', () => {
    expect(
      resolvePartFormSaveTarget(
        input({ capturedRoughLineId: 'line-3', addPartsToTemplateModalOpen: true, editTemplateModalOpen: true }),
      ),
    ).toEqual({ kind: 'roughLine', lineId: 'line-3' })
  })

  it('routes the two assembly modals when no line was captured, add-parts first', () => {
    expect(resolvePartFormSaveTarget(input({ addPartsToTemplateModalOpen: true, editTemplateModalOpen: true }))).toEqual({
      kind: 'addPartsToTemplate',
    })
    expect(resolvePartFormSaveTarget(input({ editTemplateModalOpen: true }))).toEqual({ kind: 'editTemplateItem' })
  })

  it('treats blank/whitespace ids as absent', () => {
    expect(resolvePartFormSaveTarget(input({ capturedRoughLineId: '   ', livePickerLineId: '  ' }))).toEqual({
      kind: 'assemblyDraftItem',
    })
  })
})
