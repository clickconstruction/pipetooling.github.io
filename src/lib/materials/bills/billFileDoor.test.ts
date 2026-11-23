import { describe, expect, it } from 'vitest'
import {
  BILLS_FOLDER_NAME,
  BILL_FILE_WORDS,
  BILL_FOLDER_LEVELS,
  insideBillsFolder,
  isBillReadAction,
  isBillsFolder,
  parseBillReadAsk,
  type DriveStep,
} from '../../../../supabase/functions/_shared/billFile'
import { fileIdOfLink } from '../../../../supabase/functions/_shared/billSweep'
import { twinRefusalWords } from '../../../../supabase/functions/_shared/driveLink'
import { plainWordsFailures } from '../../plainWords'

const INVOICE = '5b5ee5e4-3afa-4a3f-b2f9-185bb7808808'

/** A made-up Drive: each id with its name, the folder it sits in and its Shared Drive, if any. */
function drive(tree: Record<string, DriveStep>) {
  const asked: string[] = []
  return {
    asked,
    stepOf: async (id: string) => {
      asked.push(id)
      return tree[id] ?? null
    },
  }
}

describe('parseBillReadAsk (punch list #431): the door takes one bill', () => {
  it('reads the ask', () => {
    expect(parseBillReadAsk({ action: 'read_bill', invoiceId: INVOICE })).toEqual({ action: 'read_bill', invoiceId: INVOICE })
    expect(isBillReadAction({ action: 'read_bill' })).toBe(true)
  })
  it('refuses anything that is not a bill’s id, and any other action', () => {
    expect(parseBillReadAsk({ action: 'read_bill', invoiceId: 'not-a-uuid' })).toBeNull()
    expect(parseBillReadAsk({ action: 'read_bill' })).toBeNull()
    expect(parseBillReadAsk({ action: 'read', invoiceId: INVOICE })).toBeNull()
    expect(parseBillReadAsk(null)).toBeNull()
    expect(isBillReadAction({ action: 'read' })).toBe(false)
    expect(isBillReadAction(null)).toBe(false)
  })
})

describe('the bills folder fence', () => {
  it('a file straight inside the bills folder is a bill’s file', async () => {
    const d = drive({ file: { name: 'a.pdf', parent: 'bills', driveId: null }, bills: { name: BILLS_FOLDER_NAME, parent: 'root', driveId: null } })
    expect(await insideBillsFolder('file', d.stepOf, null)).toEqual({ inside: true, gone: false, seen: [BILLS_FOLDER_NAME] })
    // It stops at the folder: nothing above it is asked.
    expect(d.asked).toEqual(['file', 'bills'])
  })

  it('a file in a folder inside the bills folder is one too', async () => {
    const d = drive({
      file: { name: 'a.pdf', parent: 'oct', driveId: null },
      oct: { name: '2026-10', parent: 'bills', driveId: null },
      bills: { name: BILLS_FOLDER_NAME, parent: null, driveId: null },
    })
    expect(await insideBillsFolder('file', d.stepOf, null)).toEqual({ inside: true, gone: false, seen: ['2026-10', BILLS_FOLDER_NAME] })
  })

  it('a file anywhere else is refused, with the folders it sits under', async () => {
    const d = drive({
      file: { name: 'review.pdf', parent: 'person', driveId: null },
      person: { name: 'A person', parent: 'hr', driveId: null },
      hr: { name: 'HR files', parent: null, driveId: null },
    })
    expect(await insideBillsFolder('file', d.stepOf, null)).toEqual({ inside: false, gone: false, seen: ['A person', 'HR files'] })
  })

  it('a folder of that name inside a Shared Drive is not the bills folder', async () => {
    const d = drive({ file: { name: 'a.pdf', parent: 'fake', driveId: 'shared-1' }, fake: { name: BILLS_FOLDER_NAME, parent: null, driveId: 'shared-1' } })
    expect((await insideBillsFolder('file', d.stepOf, null)).inside).toBe(false)
  })

  it('with the folder’s id set, the id decides and the name does not', async () => {
    const tree = {
      file: { name: 'a.pdf', parent: 'renamed', driveId: null },
      renamed: { name: 'Bills 2026', parent: null, driveId: null },
      other: { name: 'b.pdf', parent: 'named', driveId: null },
      named: { name: BILLS_FOLDER_NAME, parent: null, driveId: null },
    }
    expect((await insideBillsFolder('file', drive(tree).stepOf, 'renamed')).inside).toBe(true)
    expect((await insideBillsFolder('other', drive(tree).stepOf, 'renamed')).inside).toBe(false)
    // A blank secret is no secret.
    expect((await insideBillsFolder('other', drive(tree).stepOf, '  ')).inside).toBe(true)
    expect(isBillsFolder('named', tree.named, null)).toBe(true)
  })

  it('a file Drive will not show is gone, and a folder it will not show ends the walk', async () => {
    expect(await insideBillsFolder('missing', drive({}).stepOf, null)).toEqual({ inside: false, gone: true, seen: [] })
    const d = drive({ file: { name: 'a.pdf', parent: 'hidden', driveId: null } })
    expect(await insideBillsFolder('file', d.stepOf, null)).toEqual({ inside: false, gone: false, seen: [] })
  })

  it('looks a fixed number of folders up and no further', async () => {
    const tree: Record<string, DriveStep> = { file: { name: 'a.pdf', parent: 'f1', driveId: null } }
    for (let i = 1; i <= BILL_FOLDER_LEVELS + 1; i += 1) tree[`f${i}`] = { name: `level ${i}`, parent: `f${i + 1}`, driveId: null }
    tree[`f${BILL_FOLDER_LEVELS + 2}`] = { name: BILLS_FOLDER_NAME, parent: null, driveId: null }
    const d = drive(tree)
    expect((await insideBillsFolder('file', d.stepOf, null)).inside).toBe(false)
    expect(d.asked).toHaveLength(BILL_FOLDER_LEVELS + 1)
  })
})

describe('the door’s words and the link it reads', () => {
  it('every sentence is plain words', () => {
    for (const words of Object.values(BILL_FILE_WORDS)) expect(plainWordsFailures(words)).toEqual([])
  })
  it('a digital twin is told it cannot read Drive', () => {
    expect(twinRefusalWords('read_bill')).toBe('A digital twin cannot read Drive.')
  })
  it('a pasted Drive link is read to its file, and anything else is no file', () => {
    expect(fileIdOfLink('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing')).toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz012345')
    expect(fileIdOfLink('https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz012345')).toBeNull()
    expect(fileIdOfLink('https://supplier.example/invoices/123')).toBeNull()
    expect(fileIdOfLink(null)).toBeNull()
  })
})
