/**
 * Punch list #319 PR 2: a video's copy to Drive in pieces, against a stand-in Drive. It keeps what it is sent, answers
 * a piece that is not the last with how far it has got, and the last with the file's id, as Drive's own upload does.
 */
import { describe, expect, it } from 'vitest'
import { copyInPieces, type DrivePieceDoors } from '../../../supabase/functions/_shared/driveCopyInPieces'
import { DRIVE_PIECE_BYTES } from './drive'

function standIn(total: number, over: Partial<DrivePieceDoors> = {}) {
  const file = new Uint8Array(total)
  for (let i = 0; i < total; i += 4099) file[i] = (i % 251) + 1
  const drive = { uri: null as string | null, held: new Uint8Array(0), starts: 0 }
  const log: string[] = []
  const saved: Array<[string | null, number | null]> = []
  const doors: DrivePieceDoors = {
    start: async () => {
      drive.starts += 1
      drive.uri = `session-${drive.starts}`
      drive.held = new Uint8Array(0)
      log.push('start')
      return drive.uri
    },
    status: async (uri) => {
      log.push('status')
      if (uri !== drive.uri) return null
      return drive.held.length === total ? { id: 'FILE' } : { offset: drive.held.length }
    },
    put: async (uri, bytes, contentRange) => {
      const m = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(contentRange)!
      expect(uri).toBe(drive.uri)
      expect(Number(m[1])).toBe(drive.held.length)
      expect(Number(m[2]) - Number(m[1]) + 1).toBe(bytes.length)
      expect(Number(m[3])).toBe(total)
      const next = new Uint8Array(drive.held.length + bytes.length)
      next.set(drive.held)
      next.set(bytes, drive.held.length)
      drive.held = next
      log.push(`put ${bytes.length}`)
      return drive.held.length === total ? { id: 'FILE' } : { offset: drive.held.length }
    },
    read: async (start, end) => file.slice(start, end + 1),
    save: async (uri, offset) => {
      saved.push([uri, offset])
    },
    ...over,
  }
  return { file, drive, doors, log, saved }
}

const LATER = Date.now() + 60_000

/** Two big byte arrays hold the same bytes. A plain loop: a deep-equal over tens of megabytes is too slow to wait for. */
function same(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

describe('a video’s copy to Drive in pieces (punch list #319 PR 2)', () => {
  it('sends every byte once, in pieces of 8 MiB with the last one short, and keeps its place after each', async () => {
    const total = DRIVE_PIECE_BYTES * 2 + 1234
    const s = standIn(total)
    await expect(copyInPieces(total, null, s.doors, LATER)).resolves.toEqual({ id: 'FILE' })
    expect(s.log).toEqual(['start', `put ${DRIVE_PIECE_BYTES}`, `put ${DRIVE_PIECE_BYTES}`, 'put 1234'])
    expect(same(s.drive.held, s.file)).toBe(true)
    expect(s.saved).toEqual([
      ['session-1', 0],
      ['session-1', DRIVE_PIECE_BYTES],
      ['session-1', DRIVE_PIECE_BYTES * 2],
    ])
  })

  it('past the deadline it stops where it is, and the next run picks up at the piece Drive says', async () => {
    const total = DRIVE_PIECE_BYTES * 3
    const s = standIn(total)
    let clock = 0
    // The first run has time for one piece.
    const first = await copyInPieces(total, null, s.doors, 0, () => clock++)
    expect(first).toEqual({ paused: true })
    expect(s.drive.held.length).toBe(DRIVE_PIECE_BYTES)
    const uri = s.saved[s.saved.length - 1]![0]
    s.log.length = 0
    await expect(copyInPieces(total, uri, s.doors, LATER)).resolves.toEqual({ id: 'FILE' })
    expect(s.log).toEqual(['status', `put ${DRIVE_PIECE_BYTES}`, `put ${DRIVE_PIECE_BYTES}`])
    expect(s.drive.starts).toBe(1)
    expect(same(s.drive.held, s.file)).toBe(true)
  })

  it('an address Drive no longer knows starts the copy again', async () => {
    const total = DRIVE_PIECE_BYTES + 10
    const s = standIn(total)
    await expect(copyInPieces(total, 'a-week-old-address', s.doors, LATER)).resolves.toEqual({ id: 'FILE' })
    expect(s.log).toEqual(['status', 'start', `put ${DRIVE_PIECE_BYTES}`, 'put 10'])
  })

  it('an address whose file is already whole answers its id and sends nothing', async () => {
    const total = DRIVE_PIECE_BYTES + 10
    const s = standIn(total)
    await copyInPieces(total, null, s.doors, LATER)
    s.log.length = 0
    await expect(copyInPieces(total, 'session-1', s.doors, LATER)).resolves.toEqual({ id: 'FILE' })
    expect(s.log).toEqual(['status'])
  })

  it('a read that comes back short stops the copy, and so does a piece Drive did not keep', async () => {
    const total = DRIVE_PIECE_BYTES + 10
    const short = standIn(total, { read: async () => new Uint8Array(5) })
    await expect(copyInPieces(total, null, short.doors, LATER)).rejects.toThrow('Our copy of that file read short.')
    const stuck = standIn(total, { put: async () => ({ offset: 0 }) })
    await expect(copyInPieces(total, null, stuck.doors, LATER)).rejects.toThrow('Drive did not keep the piece.')
  })
})
