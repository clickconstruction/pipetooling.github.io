import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { lienPacketOutRefusal, lienPacketPageMarks, lienPacketReport, lienPacketRequestRefusal, parseLienPacketArgs, pickLienPacketJobs, type LienPacketReportInput } from './lienPacketPreview'
import type { LienServeHeld, LienServeJob } from './lienServePackets'

// Every name, address, number and path here is made up.
const job = (jobId: string, jobNumber: string, name: string): LienServeJob => ({ jobId, jobNumber, jobLabel: [jobNumber, name].filter(Boolean).join(' · '), isSub: true, filing: { id: `filing-${jobId}` } as LienServeJob['filing'] })
const ORTEGA = job('j1', '2340', 'Ortega Residence')
const PINE = job('j2', '2351', 'Pine Hollow Duplex')
const NAMED = job('j3', '', 'Sample Street Remodel')
const envelope = (recipient: 'owner' | 'original_contractor', name: string) => ({ recipient, name, address: '12 Example Pkwy, Buda, TX 78610' })
const ready = (j: LienServeJob, envelopes: number, copyPages: number, letter = true): LienPacketReportInput['ready'][number] => ({
  pages: envelopes * (copyPages + (letter ? 1 : 0)),
  ready: { job: j, letter, envelopes: [envelope('owner', 'Hollow Creek Holdings LLC'), envelope('original_contractor', 'Brightline Builders')].slice(0, envelopes), file: { kind: 'pdf', pages: copyPages, bytes: 90_000, sha256: 'ab' } },
})

describe('parseLienPacketArgs', () => {
  it('asks for every lien with the letter when nothing is typed', () => {
    expect(parseLienPacketArgs([])).toEqual({ args: { out: null, jobs: [], letter: true, alone: [], marks: false, help: false } })
  })

  it('reads the path, the job numbers however they are separated, and the boxes', () => {
    const got = parseLienPacketArgs(['--out', '/tmp/made-up/packet.pdf', '2340,2351', '2377', '--no-letter', '--alone', '2351', '--marks'])
    expect(got).toEqual({ args: { out: '/tmp/made-up/packet.pdf', jobs: ['2340', '2351', '2377'], letter: false, alone: ['2351'], marks: true, help: false } })
    expect(parseLienPacketArgs(['--out=/tmp/x.pdf', '--jobs', '2340 2351'])).toMatchObject({ args: { out: '/tmp/x.pdf', jobs: ['2340', '2351'] } })
  })

  it('refuses a flag it does not know and a flag with no value', () => {
    expect(parseLienPacketArgs(['--print'])).toEqual({ refused: '--print is not a flag this command knows.' })
    expect(parseLienPacketArgs(['--out'])).toMatchObject({ refused: expect.stringContaining('--out needs a path') })
    expect(parseLienPacketArgs(['--out', '--marks'])).toMatchObject({ refused: expect.stringContaining('--out needs a path') })
    expect(parseLienPacketArgs(['--alone'])).toEqual({ refused: '--alone needs one job number or more.' })
  })
})

describe('pickLienPacketJobs', () => {
  it('takes every lien when none is asked for', () => {
    expect(pickLienPacketJobs([ORTEGA, PINE], [])).toEqual({ picked: [ORTEGA, PINE], notOnList: [] })
  })

  it('takes the liens asked for in the list’s own order and names a number that is not on it', () => {
    expect(pickLienPacketJobs([ORTEGA, PINE], ['2351', '9999', '2340', '9999'])).toEqual({ picked: [ORTEGA, PINE], notOnList: ['9999'] })
  })

  it('finds a job with no HCP number by the other number it answers to', () => {
    const numbersOf = (j: LienServeJob) => (j === NAMED ? ['', 'C-881'] : [j.jobNumber])
    expect(pickLienPacketJobs([ORTEGA, NAMED], ['c-881'], numbersOf)).toEqual({ picked: [NAMED], notOnList: [] })
    // An empty number answers to nothing, so a blank never picks every job without one.
    expect(pickLienPacketJobs([NAMED], [''])).toEqual({ picked: [], notOnList: [''] })
  })
})

describe('lienPacketOutRefusal', () => {
  const MAIN = '/Users/sample/code/pipetooling'
  const WORKTREE = `${MAIN}/.claude/worktrees/made-up-branch`

  it('lets the file go outside the repo', () => {
    expect(lienPacketOutRefusal('/private/tmp/scratch/packet.pdf', [WORKTREE, MAIN])).toBeNull()
    // A folder beside the repo whose name only starts the same is outside it.
    expect(lienPacketOutRefusal(`${MAIN}-notes/packet.pdf`, [WORKTREE, MAIN])).toBeNull()
  })

  it('refuses a path inside this checkout, or inside the main checkout that holds every worktree', () => {
    expect(lienPacketOutRefusal(`${WORKTREE}/tmp/packet.pdf`, [WORKTREE, MAIN])).toContain('never written inside it')
    expect(lienPacketOutRefusal(`${MAIN}/docs/packet.pdf`, [`${WORKTREE}/`, `${MAIN}/`])).toContain(MAIN)
    expect(lienPacketOutRefusal(`${MAIN}/.claude/worktrees/another/packet.pdf`, [WORKTREE, MAIN])).toContain('Give --out a path outside the repo')
  })

  it('refuses a file that is not a PDF', () => {
    expect(lienPacketOutRefusal('/private/tmp/scratch/packet', [MAIN])).toContain('ends in .pdf')
    expect(lienPacketOutRefusal('/private/tmp/scratch/PACKET.PDF', [MAIN])).toBeNull()
  })
})

describe('lienPacketRequestRefusal', () => {
  const at = (path: string) => `https://made-up-project.supabase.co${path}`
  const ok = (method: string, path: string, body?: unknown) => expect(lienPacketRequestRefusal({ method, url: at(path), body })).toBeNull()
  const no = (method: string, path: string, body?: unknown) => expect(lienPacketRequestRefusal({ method, url: at(path), body })).toEqual(expect.any(String))

  it('lets rows be read and never written', () => {
    ok('GET', '/rest/v1/job_lien_filings?select=*')
    ok('HEAD', '/rest/v1/jobs_ledger')
    no('POST', '/rest/v1/sent_documents')
    no('PATCH', '/rest/v1/job_lien_filings?id=eq.made-up')
    no('PUT', '/rest/v1/app_settings')
    no('DELETE', '/rest/v1/job_lien_filings?id=eq.made-up')
  })

  it('calls the desk’s own readers and no other function of the database', () => {
    ok('POST', '/rest/v1/rpc/list_lien_affidavit_windows', '{"p_within_days":120}')
    ok('GET', '/rest/v1/rpc/some_stable_reader')
    expect(lienPacketRequestRefusal({ method: 'POST', url: at('/rest/v1/rpc/set_lien_mailed') })).toBe('the preview calls the desk’s readers alone, and set_lien_mailed is not one')
  })

  it('asks drive-link for a saved copy’s bytes and nothing else', () => {
    ok('POST', '/functions/v1/drive-link', JSON.stringify({ action: 'read', job: { jobs_ledger_id: 'made-up' }, driveFileId: 'file-1' }))
    no('POST', '/functions/v1/drive-link', JSON.stringify({ action: 'upload', driveFileId: 'file-1' }))
    no('POST', '/functions/v1/drive-link')
    no('POST', '/functions/v1/drive-link', 'not json')
    no('GET', '/functions/v1/drive-link')
  })

  it('signs in, and calls no other edge function', () => {
    ok('POST', '/functions/v1/dev-login', '{"email":"dev@example.com"}')
    ok('POST', '/auth/v1/verify')
    ok('POST', '/auth/v1/token?grant_type=refresh_token')
    ok('GET', '/auth/v1/user')
    expect(lienPacketRequestRefusal({ method: 'POST', url: at('/functions/v1/send-email'), body: '{}' })).toBe('the preview does not call the function send-email')
    no('GET', '/functions/v1/send-email')
    no('POST', '/auth/v1/logout')
  })

  it('refuses any other write, and an address that does not read', () => {
    expect(lienPacketRequestRefusal({ method: 'POST', url: at('/storage/v1/object/sent-copies/made-up.pdf') })).toBe('the preview reads and never writes: POST /storage/v1/object/sent-copies/made-up.pdf')
    ok('GET', '/storage/v1/object/public/made-up.png')
    expect(lienPacketRequestRefusal({ method: 'GET', url: 'not an address' })).toBe('the address did not read')
  })
})

describe('lienPacketReport', () => {
  const clock = { serveDue: '2026-11-21', daysLeft: 2, late: false, chip: '2 days left', words: 'by Nov 21' }
  const held: LienServeHeld = { job: PINE, clock, holds: [{ key: 'no_recording_number', words: 'no recording number yet', act: 'Type the number the clerk gave.', door: 'filing' }] }

  it('says where the file is, each lien’s pages by the file’s own numbers, and what was held', () => {
    const lines = lienPacketReport({
      path: '/private/tmp/scratch/packet.pdf',
      pages: 12,
      letter: true,
      ready: [ready(ORTEGA, 2, 2), ready(NAMED, 1, 4)],
      held: [held],
      notPrinted: [{ job: job('j4', '2377', 'Example Ridge Office'), reason: 'its stamped copy was not read. ' }],
      notOnList: ['9999'],
      numberOf: (jobId) => (jobId === 'j3' ? 'C-881' : jobId === 'j1' ? '2340' : ''),
    })
    expect(lines).toEqual([
      'Lien copies packet: 2 liens · 3 envelopes · 12 pages',
      '/private/tmp/scratch/packet.pdf',
      'Built by the Lien desk’s own print, with the cover letter. Nothing was saved, filed or marked as mailed.',
      '',
      'In the file:',
      '  page 1 · Mail sheet',
      '  pages 2–7 · 2340 · Ortega Residence · 2 envelopes, each a letter and 2 stamped pages',
      '  pages 8–12 · Sample Street Remodel (job C-881) · 1 envelope, each a letter and 4 stamped pages',
      '',
      'Held, not in the file:',
      '  2351 · Pine Hollow Duplex: no recording number yet.',
      '',
      'Left out by the print:',
      '  2377 · Example Ridge Office: its stamped copy was not read.',
      '',
      'Not on Filed liens: copies to mail: 9999',
    ])
  })

  it('counts a mail sheet of two pages, and says when no letter prints', () => {
    const lines = lienPacketReport({ path: '/private/tmp/scratch/packet.pdf', pages: 4, letter: false, ready: [ready(ORTEGA, 2, 1, false)], held: [], notPrinted: [], notOnList: [] })
    expect(lines[2]).toBe('Built by the Lien desk’s own print, with no cover letter. Nothing was saved, filed or marked as mailed.')
    expect(lines.slice(5)).toEqual(['  pages 1–2 · Mail sheet', '  pages 3–4 · 2340 · Ortega Residence · 2 envelopes, each 1 stamped page, no letter'])
  })

  it('says a filing that keeps no letter prints its copy alone, though the letter was asked for', () => {
    const lines = lienPacketReport({ path: '/private/tmp/scratch/packet.pdf', pages: 3, letter: true, ready: [ready(ORTEGA, 1, 2, false)], held: [], notPrinted: [], notOnList: [] })
    expect(lines[6]).toBe('  pages 2–3 · 2340 · Ortega Residence · 1 envelope, each 2 stamped pages, no letter')
  })

  it('says no file was written when nothing can print, with what was held', () => {
    expect(lienPacketReport({ path: '', pages: 0, letter: true, ready: [], held: [held], notPrinted: [], notOnList: [] })).toEqual([
      'No file was written: no lien on the list can print.',
      '',
      'Held, not in the file:',
      '  2351 · Pine Hollow Duplex: no recording number yet.',
    ])
  })
})

describe('lienPacketPageMarks', () => {
  /** A made-up PDF, one page for each line; `made` moves the date the file says it was made on. */
  async function pdf(lines: string[], made: Date): Promise<Uint8Array> {
    const doc = await PDFDocument.create()
    doc.setCreationDate(made)
    doc.setModificationDate(made)
    const font = await doc.embedFont(StandardFonts.Helvetica)
    for (const line of lines) doc.addPage([612, 792]).drawText(line, { x: 72, y: 700, size: 12, font })
    return doc.save()
  }

  it('gives the same pages the same marks whenever the file was made, and a changed page its own mark', async () => {
    const first = await lienPacketPageMarks(await pdf(['Mail sheet', 'Letter to Hollow Creek Holdings LLC', 'Stamped page'], new Date('2026-11-19T15:00:00Z')))
    const again = await lienPacketPageMarks(await pdf(['Mail sheet', 'Letter to Hollow Creek Holdings LLC', 'Stamped page'], new Date('2026-11-20T09:30:00Z')))
    const changed = await lienPacketPageMarks(await pdf(['Mail sheet', 'Letter to Brightline Builders', 'Stamped page'], new Date('2026-11-19T15:00:00Z')))
    expect(first).toHaveLength(3)
    expect(first.every((m) => /^[0-9a-f]{16}$/.test(m))).toBe(true)
    expect(again).toEqual(first)
    expect(changed[0]).toBe(first[0])
    expect(changed[1]).not.toBe(first[1])
    expect(changed[2]).toBe(first[2])
  })

  it('gives one scanned page the same mark in each envelope it is copied into', async () => {
    const scan = await PDFDocument.load(await pdf(['Stamped page'], new Date('2026-11-16T10:00:00Z')))
    const letters = await PDFDocument.load(await pdf(['Letter to the owner', 'Letter to the contractor'], new Date('2026-11-19T15:00:00Z')))
    const stack = await PDFDocument.create()
    for (const letter of [0, 1]) {
      stack.addPage((await stack.copyPages(letters, [letter]))[0]!)
      stack.addPage((await stack.copyPages(scan, [0]))[0]!)
    }
    const marks = await lienPacketPageMarks(await stack.save())
    expect(marks).toHaveLength(4)
    expect(marks[3]).toBe(marks[1])
    expect(marks[2]).not.toBe(marks[0])
  })
})
