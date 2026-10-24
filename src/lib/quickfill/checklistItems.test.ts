import { describe, expect, it } from 'vitest'
import { checklistRenameReady, renameChecklistItem } from './checklistItems'

const items = [
  { id: 'a', label: 'Open the window shades' },
  { id: 'b', label: 'Turn on the lights' },
  { id: 'c', label: 'Mop and sweep' },
]

describe('renameChecklistItem', () => {
  it('changes one box’s words and keeps its id and its place', () => {
    const next = renameChecklistItem(items, 'b', '  Turn on the lights in every room ')
    expect(next).toEqual([
      { id: 'a', label: 'Open the window shades' },
      { id: 'b', label: 'Turn on the lights in every room' },
      { id: 'c', label: 'Mop and sweep' },
    ])
    expect(items[1]!.label).toBe('Turn on the lights')
  })
  it('has nothing to save for empty words, the same words, or a box no longer listed', () => {
    expect(renameChecklistItem(items, 'b', '   ')).toBeNull()
    expect(renameChecklistItem(items, 'b', 'Turn on the lights ')).toBeNull()
    expect(renameChecklistItem(items, 'z', 'Water the plants')).toBeNull()
  })
})

describe('checklistRenameReady', () => {
  it('is ready only with new words', () => {
    expect(checklistRenameReady('Mop and sweep', 'Mop, sweep and dust')).toBe(true)
    expect(checklistRenameReady('Mop and sweep', ' Mop and sweep ')).toBe(false)
    expect(checklistRenameReady('Mop and sweep', '')).toBe(false)
  })
})
