import { describe, expect, it } from 'vitest'
import { addLienMailedCopy, removeLienMailedCopy, type LienMailedCopiesIo, restoreLienMailedCopy } from './lienMailedCopiesIo'
import type { LienMailedCopy } from './lienMailedCopies'

function fakeIo(start: LienMailedCopy[] = [], opts: { putFails?: string; meanwhile?: LienMailedCopy } = {}) {
  let stored = [...start]
  const puts: Array<{ jobId: string; name: string; type: string; size: number }> = []
  const writes: LienMailedCopy[][] = []
  const io: LienMailedCopiesIo = {
    put: async (jobId, file) => {
      if (opts.putFails) throw new Error(opts.putFails)
      puts.push({ jobId, name: file.name, type: file.type, size: file.size })
      // Someone else adds a file while this one goes up.
      if (opts.meanwhile) stored = [...stored, opts.meanwhile]
      return { driveFileId: `drive-${puts.length}`, url: `https://drive.google.com/file/d/drive-${puts.length}/view` }
    },
    read: async () => [...stored],
    write: async (_itemId, list) => {
      writes.push(list)
      stored = [...list]
    },
    now: () => '2026-11-16T18:00:00.000Z',
  }
  return { io, puts, writes }
}

const file = () => new File(['%PDF-1.4 the scan'], 'SCAN0007.PDF', { type: 'application/pdf' })
const args = { itemId: 'it1', jobId: 'j650', jobNumber: '650', todayYmd: '2026-11-16', userId: 'u1' }

describe('addLienMailedCopy', () => {
  it('puts the file in the job’s folder under a name that says what it is, then the notice’s list takes the link', async () => {
    const f = fakeIo()
    const list = await addLienMailedCopy({ ...args, file: file() }, f.io)
    expect(f.puts).toEqual([{ jobId: 'j650', name: 'Lien notice as mailed · 650 · 2026-11-16.pdf', type: 'application/pdf', size: 17 }])
    expect(list).toEqual([{ url: 'https://drive.google.com/file/d/drive-1/view', driveFileId: 'drive-1', name: 'Lien notice as mailed · 650 · 2026-11-16.pdf', at: '2026-11-16T18:00:00.000Z', by: 'u1' }])
    expect(f.writes).toEqual([list])
  })

  it('a second file the same day takes the next name and both stay on the list', async () => {
    const f = fakeIo()
    await addLienMailedCopy({ ...args, file: file() }, f.io)
    const list = await addLienMailedCopy({ ...args, file: file() }, f.io)
    expect(list.map((c) => c.name)).toEqual(['Lien notice as mailed · 650 · 2026-11-16.pdf', 'Lien notice as mailed · 650 · 2026-11-16 · 2.pdf'])
  })

  it('keeps a file someone else added while this one was going up', async () => {
    const other: LienMailedCopy = { url: 'https://drive.google.com/file/d/other/view', driveFileId: 'other', name: 'the GC’s envelope.jpg', at: '2026-11-16T17:59:00.000Z', by: 'u2' }
    const f = fakeIo([], { meanwhile: other })
    const list = await addLienMailedCopy({ ...args, file: file() }, f.io)
    expect(list.map((c) => c.driveFileId)).toEqual(['other', 'drive-1'])
  })

  it('an upload that fails writes nothing and hands the reason on', async () => {
    const f = fakeIo([], { putFails: 'This job has no Drive folder yet.' })
    await expect(addLienMailedCopy({ ...args, file: file() }, f.io)).rejects.toThrow('This job has no Drive folder yet.')
    expect(f.writes).toEqual([])
  })
})

describe('a retainage notice’s file (v2.7525)', () => {
  it('goes up under a name that says it is the retainage notice', async () => {
    const { io, puts } = fakeIo()
    const list = await addLienMailedCopy({ ...args, file: file(), paper: 'retainage' }, io)
    expect(puts.map((p) => p.name)).toEqual(['Retainage notice as mailed · 650 · 2026-11-16.pdf'])
    expect(list.map((c) => c.name)).toEqual(['Retainage notice as mailed · 650 · 2026-11-16.pdf'])
  })
})

describe('removeLienMailedCopy (v2.7525)', () => {
  const kept = (n: number): LienMailedCopy => ({ url: `https://drive.google.com/file/d/f${n}/view`, driveFileId: `f${n}`, name: `scan ${n}.pdf`, at: '2026-11-16T18:00:00.000Z', by: 'u1' })

  it('writes the list without the one file, and puts nothing in Drive', async () => {
    const { io, puts, writes } = fakeIo([kept(1), kept(2), kept(3)])
    const list = await removeLienMailedCopy({ itemId: 'it1', copy: kept(2) }, io)
    expect(list.map((c) => c.driveFileId)).toEqual(['f1', 'f3'])
    expect(writes).toEqual([[kept(1), kept(3)]])
    expect(puts).toEqual([])
  })

  it('reads the list fresh, so a file someone else added since the row drew stays', async () => {
    // The row on screen showed one file; the notice has two by now.
    const { io, writes } = fakeIo([kept(1), kept(2)])
    await removeLienMailedCopy({ itemId: 'it1', copy: kept(1) }, io)
    expect(writes).toEqual([[kept(2)]])
  })

  it('a write that fails hands the reason on', async () => {
    const { io } = fakeIo([kept(1)])
    const failing = { ...io, write: async () => { throw new Error('new row violates row-level security policy') } }
    await expect(removeLienMailedCopy({ itemId: 'it1', copy: kept(1) }, failing)).rejects.toThrow('row-level security')
  })
})

describe('restoreLienMailedCopy (v2.7699, Put it back)', () => {
  const kept = (n: number): LienMailedCopy => ({ url: `https://drive.google.com/file/d/f${n}/view`, driveFileId: `f${n}`, name: `scan ${n}.pdf`, at: '2026-11-16T18:00:00.000Z', by: 'u1' })

  it('lists the taken-off file again beside what the notice has now, and puts nothing in Drive', async () => {
    // Someone added a file after the take-off: it stays, and the file put back joins it.
    const { io, puts, writes } = fakeIo([kept(3)])
    const list = await restoreLienMailedCopy({ itemId: 'it1', copy: kept(2) }, io)
    expect(list.map((c) => c.driveFileId).sort()).toEqual(['f2', 'f3'])
    expect(writes).toHaveLength(1)
    expect(puts).toEqual([])
  })

  it('never lists a file twice', async () => {
    const { io } = fakeIo([kept(2)])
    const list = await restoreLienMailedCopy({ itemId: 'it1', copy: kept(2) }, io)
    expect(list.map((c) => c.driveFileId)).toEqual(['f2'])
  })
})
