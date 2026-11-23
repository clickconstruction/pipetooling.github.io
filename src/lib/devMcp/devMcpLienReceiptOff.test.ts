/**
 * The dev seat's take-off of a wrong mail receipt, the pure half: plan_lien_receipt_off → apply_lien_receipt_off
 * (v2.7909). The kernel runs here against plain fixtures; the pins hold it to the receipt press's own Take off, and
 * the merge is held to the client's `lienSendsWithProof`, case by case, because the seat cannot import that file.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  LIEN_RECEIPT_OFF_FILE_WORDS,
  LIEN_RECEIPT_OFF_PLAN_MAX,
  LIEN_RECEIPT_OFF_VERBS,
  isLienReceiptOffVerb,
  lienReceiptFileReadFrom,
  lienReceiptFilesReading,
  lienReceiptOffAppliedWords,
  lienReceiptOffApplyInput,
  lienReceiptOffBatchClashes,
  lienReceiptOffDryRun,
  lienReceiptOffLanded,
  lienReceiptOffPlanInput,
  lienReceiptOffPlanReply,
  lienReceiptOffShape,
  lienSendsWithoutReceipt,
  readLienReceiptOffWorld,
  type LienReceiptOffPayload,
  type LienReceiptOffWorld,
} from '../../../supabase/functions/_shared/devMcpLienReceiptOff'
import { LIEN_SERVICE_FILING_COLS, LIEN_SERVICE_JOB_COLS, type LienServiceFiling } from '../../../supabase/functions/_shared/devMcpLienService'
import { WRITE_VERBS, alreadyApplied, isWriteVerb, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { lienSendsWithProof } from '../jobs/lienReceiptFile'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const KERNEL = readFileSync('supabase/functions/_shared/devMcpLienReceiptOff.ts', 'utf8')
const CLIENT = readFileSync('src/lib/jobs/lienReceiptFile.ts', 'utf8')
const KEEP_IO = readFileSync('src/lib/jobs/lienReceiptKeepIo.ts', 'utf8')
const DOOR = readFileSync('supabase/functions/_shared/driveTrash.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')

const JOB = '99999999-2222-4222-8222-222222222222'
const JOB_B = '99999999-3333-4333-8333-333333333333'
const GC = 'cccccccc-2222-4222-8222-222222222222'
const FILING = 'bbbbbbbb-2222-4222-8222-222222222222'
const HASH = 'a'.repeat(64)
const OWNER_FILE = '1ownOwnOwnOwnOwnOwnOwnOwnOwn'
const GC_FILE = '1gcGcGcGcGcGcGcGcGcGcGcGcGcG'
const OWNER_URL = `https://drive.google.com/file/d/${OWNER_FILE}/view`
const GC_URL = `https://drive.google.com/file/d/${GC_FILE}/view`
const BECAUSE = 'The file on record is the stamped lien, not a mail receipt.'

/** The 2026-11-18 shape: a receipt on each copy and nothing else, on a lien not yet mailed. */
const WRONG = [
  { recipient: 'owner', method: 'certified_mail', tracking: '', receipt_url: OWNER_URL },
  { recipient: 'original_contractor', method: 'certified_mail', tracking: '', receipt_url: GC_URL },
]

const filingRow = (over: Partial<LienServiceFiling> = {}): LienServiceFiling => ({ id: FILING, job_id: JOB, fields: { form: 'short', isSub: true }, filed_at: '2026-11-16', recording_number: 'ZZ-0001', county: 'Marlow', document_url: 'https://drive.google.com/file/d/1savedSavedSavedSavedSaved/view', serve_due: '2026-11-23', served_at: null, sends: WRONG, ...over })
const world = (over: Partial<LienReceiptOffWorld> = {}): LienReceiptOffWorld => ({
  job: { id: JOB, job_name: 'ZZ Test Maple Court', job_address: '14 Maple Ct, Marlow, TX 78000', hcp_number: '2291', click_number: '', gc_customer_id: GC },
  filing: filingRow(),
  ...over,
})
const receipt = (over: Record<string, unknown> = {}): Record<string, unknown> => ({ job_id: JOB, copies: ['owner', 'original_contractor'], because: BECAUSE, ...over })
const payload = (over: Record<string, unknown> = {}): LienReceiptOffPayload => {
  const shaped = lienReceiptOffShape(receipt(over))
  if (!shaped.ok) throw new Error(shaped.error)
  return shaped.p
}

describe('the pair', () => {
  it('is plan_lien_receipt_off and apply_lien_receipt_off, two verbs that name no RPC', () => {
    expect(LIEN_RECEIPT_OFF_VERBS).toEqual(['plan_lien_receipt_off', 'apply_lien_receipt_off'])
    expect(isLienReceiptOffVerb('plan_lien_receipt_off')).toBe(true)
    expect(isLienReceiptOffVerb('plan_lien_service')).toBe(false)
    expect(isWriteVerb('plan_lien_receipt_off') && isWriteVerb('apply_lien_receipt_off')).toBe(true)
    expect(WRITE_VERBS.plan_lien_receipt_off).toEqual({ rpc: null, step: 'plan' })
    expect(WRITE_VERBS.apply_lien_receipt_off).toEqual({ rpc: null, step: 'apply' })
  })

  it('goes through the writes door: a plan carries its filings, an apply carries one and its hash', () => {
    const plan = writeRpcBody('plan_lien_receipt_off', { receipts: [receipt(), receipt({ job_id: JOB_B, copies: ['owner'] })] })
    expect(plan).toMatchObject({ ok: true, rpc: null, step: 'plan', target: '2 filings' })
    const apply = writeRpcBody('apply_lien_receipt_off', { receipt: receipt(), plan_hash: HASH.toUpperCase() })
    expect(apply).toMatchObject({ ok: true, rpc: null, step: 'apply', target: JOB, planHash: HASH })
    expect(alreadyApplied('apply_lien_receipt_off', { target: JOB, at: '2026-11-19T12:00:00Z' })).toContain('The receipt is off the filing')
  })
})

describe('the shape', () => {
  it('takes a job, the copies named and a reason', () => {
    expect(payload()).toEqual({ action: 'lien_receipt_off', job_id: JOB, copies: ['owner', 'original_contractor'], because: BECAUSE })
  })

  it('reads contractor as the original contractor, once, the owner first', () => {
    expect(payload({ copies: ['Contractor', 'original_contractor', 'OWNER'] }).copies).toEqual(['owner', 'original_contractor'])
    expect(payload({ copies: ['contractor'] }).copies).toEqual(['original_contractor'])
  })

  it('never takes a receipt off by default: the copies are named', () => {
    for (const copies of [undefined, [], 'owner']) {
      const out = lienReceiptOffShape(receipt({ copies }))
      expect(out).toMatchObject({ ok: false })
      expect((out as { error: string }).error).toContain('a receipt is never taken off by default')
    }
    expect((lienReceiptOffShape(receipt({ copies: ['customer'] })) as { error: string }).error).toContain('"customer", which is no copy')
  })

  it('wants the reason, one line of 10 to 300 characters', () => {
    expect(lienReceiptOffShape(receipt({ because: 'wrong' }))).toMatchObject({ ok: false })
    expect(lienReceiptOffShape(receipt({ because: 'x'.repeat(301) }))).toMatchObject({ ok: false })
    expect(lienReceiptOffShape(receipt({ because: undefined }))).toMatchObject({ ok: false })
    expect(payload({ because: '  The stamped   lien,\n not a receipt.  ' }).because).toBe('The stamped lien, not a receipt.')
  })

  it('refuses a job id that is not one', () => {
    expect((lienReceiptOffShape(receipt({ job_id: 'JP2291' })) as { error: string }).error).toContain('find_job')
    expect(lienReceiptOffShape(null)).toMatchObject({ ok: false })
  })
})

describe('the inputs', () => {
  it('a plan takes receipt or receipts, never both, never none, never more than the cap', () => {
    expect(lienReceiptOffPlanInput({ receipt: receipt() })).toMatchObject({ ok: true, target: JOB })
    expect(lienReceiptOffPlanInput({ receipts: [receipt(), { job_id: 'no' }] })).toMatchObject({ ok: true, target: '2 filings', receipts: [{ ok: true }, { ok: false }] })
    expect(lienReceiptOffPlanInput({ receipt: receipt(), receipts: [receipt()] })).toMatchObject({ ok: false })
    expect(lienReceiptOffPlanInput({})).toMatchObject({ ok: false })
    expect(LIEN_RECEIPT_OFF_PLAN_MAX).toBe(20)
    expect((lienReceiptOffPlanInput({ receipts: Array.from({ length: 21 }, () => receipt()) }) as { error: string }).error).toContain('at most 20 filings')
  })

  it('an apply takes one filing and its own hash', () => {
    expect(lienReceiptOffApplyInput({ receipt: receipt(), plan_hash: HASH })).toMatchObject({ ok: true, target: JOB, planHash: HASH })
    expect(lienReceiptOffApplyInput({ receipts: [receipt()], plan_hash: HASH })).toMatchObject({ ok: false })
    expect(lienReceiptOffApplyInput({ receipt: receipt(), plan_hash: 'nope' })).toMatchObject({ ok: false })
    expect(lienReceiptOffApplyInput({ receipt: { job_id: JOB }, plan_hash: HASH })).toMatchObject({ ok: false })
  })
})

describe('the world', () => {
  it('reads the job and its live filed affidavit, the one plan_lien_service records on', async () => {
    const asked: string[] = []
    const reads = {
      rows: async (table: string, query: string) => {
        asked.push(`${table}?${query}`)
        return table === 'jobs_ledger' ? [world().job as unknown as Record<string, unknown>] : [filingRow() as unknown as Record<string, unknown>]
      },
    }
    const out = await readLienReceiptOffWorld(reads, { job_id: JOB })
    expect(out.filing?.id).toBe(FILING)
    expect(asked).toEqual([`jobs_ledger?select=${LIEN_SERVICE_JOB_COLS}&id=eq.${JOB}`, `job_lien_filings?select=${LIEN_SERVICE_FILING_COLS}&job_id=eq.${JOB}&kind=eq.affidavit&voided_at=is.null&filed_at=not.is.null&order=created_at.desc&limit=1`])
  })

  it('reads no filing for a job it cannot see', async () => {
    const out = await readLienReceiptOffWorld({ rows: async () => [] }, { job_id: JOB })
    expect(out).toEqual({ job: null, filing: null })
  })
})

describe('the take-off is the client’s own merge', () => {
  const CASES: Array<[string, unknown]> = [
    ['a receipt and nothing else, on both copies', WRONG],
    ['a receipt beside a mail number', [{ recipient: 'owner', method: 'certified_mail', tracking: '9589 0710 5270 0000 0000 11', receipt_url: OWNER_URL }]],
    ['a receipt on a copy with its day', [{ recipient: 'owner', method: 'certified_mail', tracking: '', sent_on: '2026-11-18', receipt_url: OWNER_URL }, { recipient: 'original_contractor', method: 'certified_mail', tracking: 'GC-28', sent_on: '2026-11-18' }]],
    ['a receipt on a copy a mail provider carries', [{ recipient: 'owner', method: 'certified_mail', tracking: '', via: 'docsmit', piece_id: 'p-1', receipt_url: OWNER_URL }]],
    ['no receipt on the copy', [{ recipient: 'owner', method: 'certified_mail', tracking: 'OWN-11' }]],
    ['no send for the copy', [{ recipient: 'original_contractor', method: 'certified_mail', tracking: '', receipt_url: GC_URL }]],
    ['nothing at all', null],
    ['rows that are not sends', [null, 'x', { recipient: 'owner' }, { recipient: 'owner', method: 'hand', tracking: '', receipt_url: OWNER_URL }]],
  ]
  for (const [name, sends] of CASES) {
    it(name, () => {
      for (const copy of ['owner', 'original_contractor'] as const) {
        expect(lienSendsWithoutReceipt(sends, copy)).toEqual(lienSendsWithProof(sends, copy, { receiptUrl: '' }))
      }
    })
  }

  it('a receipt taken off an unserved lien leaves the filing as it was: no send at all', () => {
    expect(lienSendsWithoutReceipt(lienSendsWithoutReceipt(WRONG, 'owner'), 'original_contractor')).toEqual([])
  })

  it('keeps the number, the day and the other copy', () => {
    const sends = [{ recipient: 'owner', method: 'certified_mail', tracking: 'OWN-11', sent_on: '2026-11-18', receipt_url: OWNER_URL }, { recipient: 'original_contractor', method: 'certified_mail', tracking: 'GC-28', sent_on: '2026-11-18', receipt_url: GC_URL }]
    expect(lienSendsWithoutReceipt(sends, 'owner')).toEqual([{ recipient: 'owner', method: 'certified_mail', tracking: 'OWN-11', sent_on: '2026-11-18' }, sends[1]])
  })

  it('is held to the press: the client takes a receipt off with an empty link, and writes sends alone', () => {
    expect(CLIENT).toContain("`receiptUrl: ''` takes the receipt off")
    expect(KEEP_IO).toContain(".update({ sends: JSON.parse(JSON.stringify(sends)) })")
    expect(KERNEL).toContain("lienSendsWithProof(sends, copy, { receiptUrl: '' })")
  })
})

describe('the dry run', () => {
  it('says what comes off, what becomes of each file, and the sends it would write', () => {
    const dry = lienReceiptOffDryRun(payload(), world())
    if (!dry.ok) throw new Error(dry.refused)
    expect(dry.write).toEqual({ filingId: FILING, servedAt: null, sends: [], takes: [{ of: 'owner', url: OWNER_URL, driveFileId: OWNER_FILE }, { of: 'original_contractor', url: GC_URL, driveFileId: GC_FILE }] })
    expect(dry.reply).toMatchObject({
      action: 'lien_receipt_off',
      job: { id: JOB, label: 'JP2291', name: 'ZZ Test Maple Court' },
      filing: { id: FILING, recording_number: 'ZZ-0001', county: 'Marlow', filed_on: '2026-11-16', serve_by: '2026-11-23', served_on: null },
      copies: 'two: the owner and the original contractor',
      because: BECAUSE,
      takes_off: [{ copy: 'owner', who: 'Owner of record', receipt: OWNER_URL, file: LIEN_RECEIPT_OFF_FILE_WORDS.drive }, { copy: 'original_contractor', who: 'Original contractor', receipt: GC_URL, file: LIEN_RECEIPT_OFF_FILE_WORDS.drive }],
      before: { proof: [{ copy: 'owner', tracking: null, receipt: OWNER_URL }, { copy: 'original_contractor', tracking: null, receipt: GC_URL }] },
      after: { proof: [] },
      writes: { filing: FILING, sends: [] },
      says: 'JP2291: the receipt comes off the owner’s copy and the original contractor’s copy.',
    })
    expect(dry.reply).not.toHaveProperty('leaves_no_receipt')
    expect(String(dry.reply.keeps)).toContain('This pair cannot write the day.')
  })

  it('takes one copy and leaves the other', () => {
    const dry = lienReceiptOffDryRun(payload({ copies: ['owner'] }), world())
    if (!dry.ok) throw new Error(dry.refused)
    expect(dry.write.sends).toEqual([WRONG[1]])
    expect(dry.reply.after).toEqual({ proof: [{ copy: 'original_contractor', tracking: null, receipt: GC_URL }] })
    expect(dry.reply.says).toBe('JP2291: the receipt comes off the owner’s copy.')
  })

  it('on a lien recorded as mailed, says the copy is left with no receipt, and holds the write to that day', () => {
    const sends = WRONG.map((s) => ({ ...s, tracking: `${s.recipient}-1`, sent_on: '2026-11-18' }))
    const dry = lienReceiptOffDryRun(payload(), world({ filing: filingRow({ served_at: '2026-11-18', sends }) }))
    if (!dry.ok) throw new Error(dry.refused)
    expect(dry.write.servedAt).toBe('2026-11-18')
    expect(dry.write.sends).toEqual([{ recipient: 'owner', method: 'certified_mail', tracking: 'owner-1', sent_on: '2026-11-18' }, { recipient: 'original_contractor', method: 'certified_mail', tracking: 'original_contractor-1', sent_on: '2026-11-18' }])
    expect(String(dry.reply.leaves_no_receipt)).toContain('recorded as mailed on 2026-11-18')
    expect(String(dry.reply.leaves_no_receipt)).toContain('have no receipt on record')
    expect(dry.reply.after).toEqual({ proof: [{ copy: 'owner', tracking: 'owner-1', receipt: null }, { copy: 'original_contractor', tracking: 'original_contractor-1', receipt: null }] })
  })

  it('says a link that is no Drive file is only forgotten', () => {
    const dry = lienReceiptOffDryRun(payload({ copies: ['owner'] }), world({ filing: filingRow({ sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '', receipt_url: 'https://example.test/receipt.jpg' }] }) }))
    if (!dry.ok) throw new Error(dry.refused)
    expect(dry.write.takes).toEqual([{ of: 'owner', url: 'https://example.test/receipt.jpg', driveFileId: null }])
    expect((dry.reply.takes_off as Array<{ file: string }>)[0]!.file).toBe(LIEN_RECEIPT_OFF_FILE_WORDS.link)
  })

  it('refuses a job it cannot see, and a job with no filed affidavit', () => {
    expect(lienReceiptOffDryRun(payload(), world({ job: null, filing: null }))).toEqual({ ok: false, refused: `No job ${JOB} is visible to you — find_job resolves a number or a name.` })
    const none = lienReceiptOffDryRun(payload(), world({ filing: null }))
    expect(none).toMatchObject({ ok: false })
    expect((none as { refused: string }).refused).toContain('JP2291: no filed lien affidavit is on record')
  })

  it('refuses a named copy that carries no receipt, and says what is there', () => {
    const one = lienReceiptOffDryRun(payload(), world({ filing: filingRow({ sends: [WRONG[0]] }) }))
    expect((one as { refused: string }).refused).toBe('JP2291: the original contractor’s copy carries no receipt on the filing, so there is nothing to take off. Send copies: ["owner"] to take off what is there.')
    const none = lienReceiptOffDryRun(payload(), world({ filing: filingRow({ sends: [] }) }))
    expect((none as { refused: string }).refused).toBe('JP2291: the owner’s copy and the original contractor’s copy carry no receipt on the filing, so there is nothing to take off. Nothing on this filing changes.')
  })

  it('says one copy on a job contracted with the owner', () => {
    const dry = lienReceiptOffDryRun(payload({ copies: ['owner'] }), world({ filing: filingRow({ fields: { form: 'short', isSub: false }, sends: [WRONG[0]] }) }))
    if (!dry.ok) throw new Error(dry.refused)
    expect(dry.reply.copies).toBe('one: the owner (the job was contracted with the owner)')
  })
})

describe('a call of several', () => {
  it('refuses both entries that name one job', () => {
    const clashes = lienReceiptOffBatchClashes([payload({ copies: ['owner'] }), null, payload({ copies: ['contractor'] }), payload({ job_id: JOB_B })])
    expect([...clashes.keys()].sort()).toEqual([0, 2])
    expect(clashes.get(2)).toContain('entry 1')
    expect(clashes.get(0)).toContain('name both copies in one entry')
  })

  it('counts each verdict and says what to do next', () => {
    const reply = lienReceiptOffPlanReply([{ entry: 1, status: 'ready' }, { entry: 2, status: 'refused' }])
    expect(reply.receipts).toBe('2 filings: 1 ready, 1 refused.')
    expect(String(reply.next)).toContain('apply_lien_receipt_off with receipt (that entry as you sent it)')
    expect(String(reply.next)).toContain('A refused entry says why.')
    expect(lienReceiptOffPlanReply([{ entry: 1, status: 'ready' }]).receipts).toBe('1 filing: 1 ready.')
  })
})

describe('what the files on record are', () => {
  const SHA_A = 'a1'.repeat(32)
  const SHA_B = 'b2'.repeat(32)
  const file = (over: Record<string, unknown> = {}) => ({ name: 'Lien affidavit, mail receipt, owner, 2026-11-18.pdf', size_bytes: 480_137, sha256: SHA_A, trashed: false, ...over })

  it('reads a Drive answer, and says why one was not read', () => {
    expect(lienReceiptFileReadFrom(200, { name: 'r.pdf', size: '480137', sha256Checksum: SHA_A.toUpperCase(), trashed: false })).toEqual({ name: 'r.pdf', size_bytes: 480_137, sha256: SHA_A, trashed: false })
    expect(lienReceiptFileReadFrom(200, { name: 'doc' })).toEqual({ name: 'doc', size_bytes: null, sha256: null, trashed: false })
    expect(lienReceiptFileReadFrom(404, {})).toEqual({ unread: 'Drive holds no such file, or the app’s account cannot see it.' })
    expect(lienReceiptFileReadFrom(500, {})).toEqual({ unread: 'Drive answered 500, so the file was not read.' })
  })

  it('names the two tells: one file on both copies, a receipt the size of the lien', () => {
    const out = lienReceiptFilesReading([{ of: 'owner', file: file() }, { of: 'original_contractor', file: file() }], file({ name: 'stamped.pdf', size_bytes: 480_116, sha256: SHA_B }))
    expect(out.reading).toEqual([
      'Both copies carry the same file, byte for byte. Each envelope has its own mail receipt.',
      'the owner’s copy and the original contractor’s copy: the receipt on record is the size of the filing’s saved copy (480137 and 480137 bytes against 480116). It may be the lien, not a mail receipt.',
    ])
    expect(out.files).toEqual([{ copy: 'owner', name: file().name, size_bytes: 480_137, sha256: `${SHA_A.slice(0, 12)}…` }, { copy: 'original_contractor', name: file().name, size_bytes: 480_137, sha256: `${SHA_A.slice(0, 12)}…` }])
    expect(out.read_from).toBe('File facts alone, through the read-only Drive door. No file was opened.')
  })

  it('says so when the receipt is the saved copy itself', () => {
    const out = lienReceiptFilesReading([{ of: 'owner', file: file() }], file({ name: 'stamped.pdf' }))
    expect(out.reading).toEqual(['the owner’s copy: the receipt on record is the filing’s saved copy, byte for byte. It is the lien, not a mail receipt.'])
  })

  it('claims nothing it did not read', () => {
    const real = lienReceiptFilesReading([{ of: 'owner', file: file({ size_bytes: 91_000 }) }, { of: 'original_contractor', file: file({ size_bytes: 88_000, sha256: SHA_B }) }], file({ size_bytes: 480_116, sha256: 'c3'.repeat(32) }))
    expect(real.reading).toEqual(['Nothing in the file facts says these are not mail receipts. Open each before it is taken off.'])
    const unread = lienReceiptFilesReading([{ of: 'owner', file: { unread: 'Drive is not set up on this project, so the file was not read.' } }], null)
    expect(unread.reading).toEqual([])
    expect(unread.files).toEqual([{ copy: 'owner', unread: 'Drive is not set up on this project, so the file was not read.' }])
    expect(unread).not.toHaveProperty('saved_copy')
    expect(lienReceiptFilesReading([{ of: 'owner', file: file({ trashed: true }) }], null).files).toEqual([{ copy: 'owner', name: file().name, size_bytes: 480_137, sha256: `${SHA_A.slice(0, 12)}…`, trashed: 'already in Drive’s trash' }])
  })
})

describe('the apply’s words', () => {
  const dry = lienReceiptOffDryRun(payload(), world())
  if (!dry.ok) throw new Error(dry.refused)
  const write = dry.write

  it('a file is moved only once the filing no longer names its receipt', () => {
    expect(lienReceiptOffLanded(null, write)).toBe(false)
    expect(lienReceiptOffLanded({ served_at: null, sends: WRONG }, write)).toBe(false)
    expect(lienReceiptOffLanded({ served_at: null, sends: [WRONG[1]] }, write)).toBe(false)
    expect(lienReceiptOffLanded({ served_at: null, sends: [] }, write)).toBe(true)
    expect(DOOR).toContain('Never a file a lien record of that job still names')
  })

  it('says each receipt and what became of its file', () => {
    const out = lienReceiptOffAppliedWords(payload(), 'JP2291', write, { back: { served_at: null, sends: [] }, files: [{ of: 'owner', url: OWNER_URL, result: 'trashed' }, { of: 'original_contractor', url: GC_URL, result: { left: 'A lien record still uses it.' } }] })
    expect(out).toMatchObject({
      action: 'lien_receipt_off',
      ok: true,
      filing_id: FILING,
      took_off: [{ copy: 'owner', receipt_was: OWNER_URL, file: 'in Drive’s trash, where Drive keeps it 30 days' }, { copy: 'original_contractor', receipt_was: GC_URL, file: 'left where it is: A lien record still uses it.' }],
      served_on: null,
      proof: [],
      next: 'JP2291: the owner’s copy and the original contractor’s copy carry no receipt now. The day served and the mail numbers are as they were.',
    })
    expect(String(out.files_left)).toContain('no longer shows on the filing')
    const link = lienReceiptOffAppliedWords(payload(), 'JP2291', write, { back: { served_at: null, sends: [] }, files: [{ of: 'owner', url: 'https://example.test/r.jpg', result: 'link' }] })
    expect((link.took_off as Array<{ file: string }>)[0]!.file).toBe('not a Drive file: the link is forgotten')
    expect(link).not.toHaveProperty('files_left')
  })

  it('says nothing was written when no row came back, or the receipt is still there', () => {
    const none = lienReceiptOffAppliedWords(payload(), 'JP2291', write, { back: null, files: [] })
    expect(none).toMatchObject({ ok: false })
    expect(String(none.why)).toContain('its day served changed since the plan')
    const still = lienReceiptOffAppliedWords(payload(), 'JP2291', write, { back: { served_at: null, sends: [WRONG[1]] }, files: [] })
    expect(still).toMatchObject({ ok: false })
    expect(String(still.why)).toBe('JP2291: the filing still names a receipt on the original contractor’s copy after the write. No file was moved. Plan again.')
  })
})

describe('the server and the docs', () => {
  const at = SERVER.indexOf("    case 'plan_lien_receipt_off':")
  const HANDLER = SERVER.slice(at, SERVER.indexOf("    case 'plan_notice_numbers':", at))

  it('the handler writes sends alone, held to the day served the plan read', () => {
    expect(at).toBeGreaterThan(0)
    expect(HANDLER).toContain("const target = `id=eq.${write.filingId}&kind=eq.affidavit&voided_at=is.null&served_at=${write.servedAt ? `eq.${write.servedAt}` : 'is.null'}&select=id`")
    expect(HANDLER).toContain("await restRows(session, 'PATCH', 'job_lien_filings', target, { sends: write.sends }, 'return=representation')")
    expect(HANDLER.match(/restRows\(/g)).toHaveLength(1)
    expect(HANDLER).not.toContain('served_at: write')
    expect(HANDLER).toContain("if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)")
  })

  it('a file goes to the trash through drive-link’s own door, and only after the read back', () => {
    expect(HANDLER).toContain("await invokeAsDev(session, 'drive-link', { action: 'trash', job: { jobs_ledger_id: p.job_id }, driveFileId: t.driveFileId })")
    expect(HANDLER.indexOf('lienReceiptOffLanded(outBack, write)')).toBeLessThan(HANDLER.indexOf("action: 'trash'"))
    expect(HANDLER.indexOf("'PATCH'")).toBeLessThan(HANDLER.indexOf('lienReceiptOffLanded(outBack, write)'))
    expect(HANDLER).not.toContain("action: 'put'")
  })

  it('the plan reads file facts through the read-only Drive token, beside the hash and never in it', () => {
    expect(HANDLER).toContain('googleServiceToken(saJson, [DRIVE_READONLY_SCOPE])')
    expect(HANDLER).toContain("{ fields: 'name,size,sha256Checksum,trashed', supportsAllDrives: 'true' }")
    expect(HANDLER.indexOf('await planHash(name, r.p, dry.reply)')).toBeLessThan(HANDLER.indexOf('files_on_record: lienReceiptFilesReading(files, saved)'))
  })

  it('is listed, logged and documented', () => {
    expect(SERVER).toContain("const SERVER_VERSION = '0.132.0'")
    expect(SERVER).toContain("name: 'plan_lien_receipt_off',")
    expect(SERVER).toContain("name: 'apply_lien_receipt_off',")
    expect(SERVER).toContain("if (name === 'apply_lien_receipt_off') return { receipt: args.receipt ?? null, plan_hash:")
    expect(SERVER).toContain('plan_lien_receipt_off → apply_lien_receipt_off (a wrong mail receipt taken off a filed affidavit')
    expect(SERVER).toContain('Writes are one hundred and fifty-six verbs and nothing else:')
    expect(README).toContain('`plan_lien_receipt_off(receipt \\| receipts)` · `apply_lien_receipt_off(receipt, plan_hash)`')
    expect(README).toContain('one hundred and fifty-six `plan_` / `apply_` / `revert_` verbs')
    expect(EDGE).toContain('**v2.7909 (server 0.113.0)')
  })
})
