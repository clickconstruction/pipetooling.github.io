import { describe, expect, it } from 'vitest'
import type { ContainerLine } from './onSite'
import { cleanPartName, listWords, partRenameMergeNote, partRenamePressLabel, partRenameScopeNote, partRenameVerdict, renamedPartWords, undonePartWords } from './partRename'

const line = (containerId: string, partName: string, partId: string | null = null): ContainerLine => ({ containerId, partKey: partId ? `id:${partId}` : `text:${partName.trim().toLowerCase()}`, partId, partName, manufacturer: null, onHand: 4, lastTouchedAt: null, lastTouchedBy: null, lastCountAt: null, lastCountBy: null, lastCountDiff: null, cannotFindSinceCount: 0 })
const nameOf = (id: string) => ({ c1: 'R74', c2: 'R12', c3: 'R9' })[id] ?? 'a box'
const job = [line('c1', '3:4 pex'), line('c2', '3:4 pex'), line('c1', 'Pex rolls red'), line('c1', 'Red pex rolls'), line('c3', 'Red pex rolls'), line('c2', 'Wax ring', 'p9')]

describe('partRenameVerdict', () => {
  it('takes a new name and says every box that holds the old one', () => {
    const v = partRenameVerdict(job[0]!, '  3/4   pex ', job, nameOf)
    expect(v).toEqual({ ok: true, from: '3:4 pex', to: '3/4 pex', boxes: ['R12', 'R74'], merges: [] })
    if (v.ok) {
      expect(partRenameScopeNote(v)).toBe('It changes in every box on this job that holds it: R12 and R74.')
      expect(partRenameMergeNote(v)).toBeNull()
    }
  })

  it('says when two lines of a box become one, and only for a box that holds the old name', () => {
    const v = partRenameVerdict(job[2]!, 'red pex rolls', job, nameOf)
    expect(v).toMatchObject({ ok: true, boxes: ['R74'], merges: ['R74'] })
    if (v.ok) {
      expect(partRenameScopeNote(v)).toBeNull()
      expect(partRenameMergeNote(v)).toBe('R74 already has a line named red pex rolls. The two become one line.')
    }
  })

  it('lets capitals alone be fixed without calling it a merge', () => {
    expect(partRenameVerdict(job[0]!, '3:4 PEX', job, nameOf)).toMatchObject({ ok: true, to: '3:4 PEX', merges: [] })
  })

  it('is quiet until something was typed that differs', () => {
    expect(partRenameVerdict(job[0]!, '   ', job, nameOf)).toEqual({ ok: false, reason: 'empty', words: '' })
    expect(partRenameVerdict(job[0]!, ' 3:4  pex ', job, nameOf)).toEqual({ ok: false, reason: 'same', words: '' })
  })

  it('refuses a parts-book part and a name past the limit, in words', () => {
    expect(partRenameVerdict(job[5]!, 'Wax rings', job, nameOf)).toEqual({ ok: false, reason: 'book', words: 'This part is from the parts book. Its name is the book’s.' })
    expect(partRenameVerdict(job[0]!, 'x'.repeat(161), job, nameOf)).toEqual({ ok: false, reason: 'long', words: 'A part name holds 160 characters. This one is 161.' })
  })
})

describe('the words', () => {
  it('names the act, lists boxes and says what happened', () => {
    expect(partRenamePressLabel(' 3/4  pex')).toBe('Rename to 3/4 pex')
    expect(partRenamePressLabel('  ')).toBe('Rename')
    expect(listWords(['R1'])).toBe('R1')
    expect(listWords(['R1', 'R2', 'R3'])).toBe('R1, R2 and R3')
    expect(cleanPartName('  a   b ')).toBe('a b')
    expect(renamedPartWords('3:4 pex', '3/4 pex')).toBe('3:4 pex is now 3/4 pex.')
    expect(undonePartWords('3:4 pex')).toBe('3:4 pex has its name back.')
  })
})
