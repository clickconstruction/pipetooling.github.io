import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A record on a mailed notice leaves its signature standing (v2.7565, punch list #370).
 *
 * The leader's signature is tied to a notice by the hash of its `fields`. The desk also writes four records of its own
 * into a mailed notice's `fields`: what they promised, the owner's call, the GC's written okay, each courtesy notice.
 * None is on the paper he signed. Until v2.7565 each one changed the hash, so a mailed, signed notice read as unsigned
 * from then on with its signature still on the row. No screen read a mailed notice's signature yet, so nobody saw it.
 *
 * This rule decides whether a legal paper reads as signed, so the file holds both sides: the four records are left
 * out, by the writers' own output, and every other change still voids a signature. Made-up people and amounts.
 */
const db = vi.hoisted(() => ({ updates: [] as Array<{ table: string; patch: Record<string, unknown>; id: unknown }> }))

vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      const call = { patch: null as Record<string, unknown> | null }
      const b: Record<string, unknown> = {}
      b.update = (patch: Record<string, unknown>) => {
        call.patch = patch
        return b
      }
      b.eq = (_col: string, id: unknown) => {
        if (call.patch) db.updates.push({ table, patch: call.patch, id })
        return b
      }
      b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(ok)
      return b
    },
  },
}))
vi.mock('../../utils/errorHandling', async () => {
  const actual = await vi.importActual<typeof import('../../utils/errorHandling')>('../../utils/errorHandling')
  return {
    ...actual,
    withSupabaseRetry: async (fn: () => PromiseLike<{ data: unknown; error: unknown }>) => {
      const { data, error } = await fn()
      if (error) throw error
      return data
    },
  }
})

import { LIEN_FIELDS_RECORD_KEYS, lienFieldsHash, lienRowUnsigned } from '../../../supabase/functions/_shared/lienFieldsHash'
import { lienSignatureAskable } from '../../../supabase/functions/_shared/lienApprovalPush'
import { writeCourtesyRecord } from './lienCourtesyIo'
import { COURTESY_FIELDS_KEY, PROMISE_FIELDS_KEY, parseCourtesyRecords, withCourtesyRecord, withPromiseRecord, type CourtesyPromise, type CourtesyRecord } from './lienCourtesyNotice'
import { noteGcAuthorizedDirectPay, noteOwnerCall, notePromiseOnNotice } from './lienDeskIo'
import { parseLienNoticeSentFacts } from './lienNoticeDraft'
import { fieldsRedrawn } from './lienNoticeRedraw'
import { LIEN_DESK_SIGNATURE_CLEAR, lienChipSigned, lienItemUnsigned, lienNoticeSignatureFromRow, lienSignatureStale, signatureColumnsOf } from './lienNoticeSignature'
import { fieldsWithTakeBack } from './lienRunTakeBack'
import { fieldsWithSignatureCleared, signAgainOffered, signatureClearedRecord } from './lienSignAgain'

/** The paper as the leader signed it: every key here is on the notice, its letter or its packet. */
const PAPER = {
  notice: {
    noticeDate: '2026-11-12',
    projectDescription: 'Plumbing rough-in and top-out',
    claimantName: 'Example Plumbing LLC',
    originalContractorName: 'Ridgeway Builders',
    claimAmount: '18400.00',
    contactPerson: 'Avery Stone, Owner',
    claimantAddress: '100 Example St, Austin, TX 78701',
    months: ['2026-09'],
  },
  gcEmail: 'ap@ridgeway.example',
  coverLetter: 'Please find the enclosed notice.',
  wording: { editedBy: 'Dana', editedAt: '2026-11-11T16:00:00Z' },
  payLines: { check: 'Mail a check to 100 Example St' },
  monthsDatedFromCreation: true,
}
/** What main's hash gave this paper before v2.7565. A draft with no record on it must hash as it always did, so no standing signature moves. */
const PAPER_HASH_BEFORE = '1eeeb101ac369794'

const SIGNED_AT = '2026-11-12T15:00:00.000Z'
const ITEM_ID = '4c2e91aa-0000-4000-8000-000000000000'
type Row = typeof LIEN_DESK_SIGNATURE_CLEAR & { id: string; kind: string; status: string; voided_at: string | null; printed_at: string | null; sent_at: string | null; fields: unknown }
/** A notice signed as `fields` stood, approved, printed and mailed. */
function mailed(fields: unknown, signedOver: unknown = fields): Row {
  return {
    id: ITEM_ID,
    kind: 'notice_53_056',
    status: 'sent',
    voided_at: null,
    printed_at: '2026-11-13T15:00:00.000Z',
    sent_at: '2026-11-13T18:00:00.000Z',
    ...LIEN_DESK_SIGNATURE_CLEAR,
    signed_at: SIGNED_AT,
    signed_by: 'u-avery',
    signer_printed_name: 'Avery Stone',
    signer_signature_mode: 'code',
    signed_fields_hash: lienFieldsHash(signedOver),
    fields,
  }
}
/** The same notice while it still waits in Approved · to print. */
function approved(fields: unknown, signedOver: unknown = fields): Row {
  return { ...mailed(fields, signedOver), status: 'approved', printed_at: null, sent_at: null }
}

const PROMISE: CourtesyPromise = { at: '2026-11-20T15:00:00.000Z', by: 'Dana', ymd: '2026-12-01', amount: 9200, note: 'The rest on the first.' }
const COURTESY: CourtesyRecord = {
  at: '2026-11-21T15:00:00.000Z',
  by: 'Dana',
  lienDay: '2026-12-15',
  claim: 18400,
  to: [{ who: 'original_contractor', name: 'Ridgeway Builders', channel: 'email', address: 'ap@ridgeway.example', ok: true, id: 'em_1', reason: '' }],
}
const OWNER_CALL = { at: '2026-11-22T15:00:00.000Z', name: 'Dana', owesGc: 'yes' as const, owesAmount: 12000, reserved: 'held' as const, originalContractCompletedOn: null, note: 'The owner’s manager called after the letter.' }
const GC_OKAY = { name: 'Jordan Reyes', note: 'By email, pay us directly.' }

/** Everything the four signature readers say about a row. */
function reads(row: Row) {
  const cols = signatureColumnsOf(row)
  const hash = lienFieldsHash(row.fields)
  return {
    functionUnsigned: lienRowUnsigned(row, row.fields),
    deskUnsigned: lienItemUnsigned(row),
    stale: lienSignatureStale(cols, hash),
    chip: lienChipSigned(cols, hash) === 'unsigned' ? 'unsigned' : 'signed',
    paper: lienNoticeSignatureFromRow(cols, { jobNumber: '4120', itemId: row.id, fieldsHash: hash })?.printedName ?? null,
  }
}
const STANDS = { functionUnsigned: false, deskUnsigned: false, stale: false, chip: 'signed', paper: 'Avery Stone' }
const GONE = { functionUnsigned: true, deskUnsigned: true, stale: true, chip: 'unsigned', paper: null }

beforeEach(() => {
  db.updates.length = 0
})

/** Runs the desk's four writes on a mailed notice, each over the last one's output, and returns the `fields` each one wrote. */
async function runTheFourWriters(start: Record<string, unknown>): Promise<Array<{ writer: string; fields: Record<string, unknown> }>> {
  const out: Array<{ writer: string; fields: Record<string, unknown> }> = []
  let fields = start
  const step = async (writer: string, write: (item: { id: string; fields: never }) => Promise<void>) => {
    const before = db.updates.length
    await write({ id: ITEM_ID, fields: fields as never })
    expect(db.updates.length).toBe(before + 1)
    const u = db.updates[before]!
    expect(u.table).toBe('job_lien_desk_items')
    expect(u.id).toBe(ITEM_ID)
    // A record is a write to `fields` and nothing else: no signature column is touched.
    expect(Object.keys(u.patch)).toEqual(['fields'])
    fields = JSON.parse(JSON.stringify(u.patch.fields)) as Record<string, unknown>
    out.push({ writer, fields })
  }
  await step('notePromiseOnNotice', (item) => notePromiseOnNotice(item, PROMISE))
  await step('noteOwnerCall', (item) => noteOwnerCall(item, OWNER_CALL))
  await step('noteGcAuthorizedDirectPay', (item) => noteGcAuthorizedDirectPay(item, GC_OKAY))
  await step('writeCourtesyRecord', (item) => writeCourtesyRecord(item, COURTESY))
  return out
}

describe('the record keys the hash leaves out', () => {
  it('are the four the desk writes on a mailed notice, by the constants the writers use', () => {
    expect([...LIEN_FIELDS_RECORD_KEYS].sort()).toEqual([COURTESY_FIELDS_KEY, 'gcAuthorizedDirectPay', 'ownerCall', PROMISE_FIELDS_KEY].sort())
    expect(new Set(LIEN_FIELDS_RECORD_KEYS).size).toBe(LIEN_FIELDS_RECORD_KEYS.length)
  })

  it('are exactly the keys the four writers add: a writer that renames its key, or a fifth key in the list, fails here', async () => {
    const written = await runTheFourWriters(PAPER)
    expect(written.map((w) => w.writer)).toEqual(['notePromiseOnNotice', 'noteOwnerCall', 'noteGcAuthorizedDirectPay', 'writeCourtesyRecord'])
    const added = Object.keys(written[written.length - 1]!.fields).filter((k) => !(k in PAPER))
    expect(added.sort()).toEqual([...LIEN_FIELDS_RECORD_KEYS].sort())
    // The readers of the records still find them: nothing was moved or dropped to make the hash stand.
    const last = written[written.length - 1]!.fields
    expect(parseLienNoticeSentFacts(last).ownerCall?.owesAmount).toBe(12000)
    expect(parseLienNoticeSentFacts(last).gcAuthorizedDirectPay?.name).toBe('Jordan Reyes')
    expect(parseCourtesyRecords(last[COURTESY_FIELDS_KEY])).toHaveLength(1)
    expect((last[PROMISE_FIELDS_KEY] as { ymd: string }).ymd).toBe('2026-12-01')
  })

  it('never name a line that comes with a cleared signature, or a key on the paper', () => {
    for (const key of ['runTakenBack', 'signatureCleared', 'redrawn', 'runClosedPaid', 'notice', 'gcEmail', 'coverLetter', 'wording', 'payLines', 'monthsDatedFromCreation', 'letterTwo', 'housesInLetter', 'affidavitForm', 'releaseId']) {
      expect(LIEN_FIELDS_RECORD_KEYS).not.toContain(key)
    }
  })
})

describe('a draft with no record on it hashes as it always did', () => {
  it('the paper, nothing at all, and the stage checklist’s answer keep the hashes main gave them', () => {
    expect(lienFieldsHash(PAPER)).toBe(PAPER_HASH_BEFORE)
    expect(lienFieldsHash(null)).toBe('77074ba420281929')
    expect(lienFieldsHash({ words: 'Is the slab poured?', pick: 'yes', note: '' })).toBe('5c68e1e18831036c')
  })

  it('is still blind to key order and to an undefined value, and nothing else', () => {
    const { notice, ...rest } = PAPER
    expect(lienFieldsHash({ ...rest, notice: { ...notice }, extra: undefined })).toBe(PAPER_HASH_BEFORE)
  })
})

describe('a mailed, signed notice', () => {
  it('with no record on it reads as signed by every reader', () => {
    expect(reads(mailed(PAPER))).toEqual(STANDS)
  })

  it('reads as signed after each of the four writes, one after another, by the writers’ own output', async () => {
    const written = await runTheFourWriters(PAPER)
    for (const w of written) {
      expect(lienFieldsHash(w.fields), w.writer).toBe(PAPER_HASH_BEFORE)
      expect(reads(mailed(w.fields, PAPER)), w.writer).toEqual(STANDS)
    }
  })

  it('reads as signed with each record alone, by the pure builders', () => {
    const each: Array<[string, Record<string, unknown>]> = [
      ['promise', withPromiseRecord(PAPER, PROMISE)],
      ['courtesy', withCourtesyRecord(PAPER, COURTESY)],
      ['ownerCall', { ...PAPER, ownerCall: OWNER_CALL }],
      ['gcAuthorizedDirectPay', { ...PAPER, gcAuthorizedDirectPay: { at: '2026-11-23T15:00:00.000Z', ...GC_OKAY } }],
    ]
    for (const [name, fields] of each) {
      expect(lienFieldsHash(fields), name).toBe(PAPER_HASH_BEFORE)
      expect(reads(mailed(fields, PAPER)), name).toEqual(STANDS)
    }
  })

  it('reads as signed when a record is written again: a later promise, a second courtesy notice, a second call', () => {
    let fields = withCourtesyRecord(withPromiseRecord(PAPER, PROMISE), COURTESY)
    fields = withPromiseRecord(fields, { ...PROMISE, at: '2026-12-02T15:00:00.000Z', ymd: '2026-12-15', amount: 4600 })
    fields = withCourtesyRecord(fields, { ...COURTESY, at: '2026-12-03T15:00:00.000Z' })
    fields = { ...fields, ownerCall: { ...OWNER_CALL, owesGc: 'no', owesAmount: null } }
    expect(parseCourtesyRecords(fields[COURTESY_FIELDS_KEY])).toHaveLength(2)
    expect(reads(mailed(fields, PAPER))).toEqual(STANDS)
  })

  it('a record with nothing in it is still a record: null and an empty list are left out too', () => {
    expect(lienFieldsHash({ ...PAPER, promise: null, courtesy: [], ownerCall: null, gcAuthorizedDirectPay: null })).toBe(PAPER_HASH_BEFORE)
  })

  it('still reads as unsigned when the paper under the records changed', async () => {
    const written = await runTheFourWriters(PAPER)
    const withRecords = written[written.length - 1]!.fields
    const edited = { ...withRecords, notice: { ...PAPER.notice, claimAmount: '18401.00' } }
    expect(reads(mailed(edited, PAPER))).toEqual(GONE)
  })

  it('signed while a record was already on it reads as signed, and as signed once the record goes or changes', () => {
    const atSigning = withPromiseRecord(PAPER, PROMISE)
    expect(reads(mailed(atSigning))).toEqual(STANDS)
    expect(reads(mailed(PAPER, atSigning))).toEqual(STANDS)
    expect(reads(mailed(withCourtesyRecord(atSigning, COURTESY), atSigning))).toEqual(STANDS)
  })
})

describe('every other change still voids a signature', () => {
  const changes: Array<[string, unknown]> = [
    ['the amount claimed', { ...PAPER, notice: { ...PAPER.notice, claimAmount: '18400.01' } }],
    ['the notice’s date', { ...PAPER, notice: { ...PAPER.notice, noticeDate: '2026-11-13' } }],
    ['the months', { ...PAPER, notice: { ...PAPER.notice, months: ['2026-09', '2026-10'] } }],
    ['the months dated from creation', { ...PAPER, monthsDatedFromCreation: undefined }],
    ['a notice field added', { ...PAPER, notice: { ...PAPER.notice, homesteadStatement: true } }],
    ['a notice field removed', { ...PAPER, notice: { ...PAPER.notice, contactPerson: undefined } }],
    ['the GC’s email', { ...PAPER, gcEmail: 'office@ridgeway.example' }],
    ['the cover letter', { ...PAPER, coverLetter: 'Please find the enclosed notice. Call us.' }],
    ['the cover letter removed', { ...PAPER, coverLetter: undefined }],
    ['the wording', { ...PAPER, wording: { editedBy: 'Dana', editedAt: '2026-11-12T16:00:00Z' } }],
    ['the pay lines', { ...PAPER, payLines: { check: 'Mail a check to 200 Example St' } }],
    ['a pay line added', { ...PAPER, payLines: { ...PAPER.payLines, card: 'Pay by card at the office' } }],
    ['letter two’s mark', { ...PAPER, letterTwo: { kind: 'unresponsive', afterItemId: 'it-1', afterSentAt: '2026-11-01T15:00:00Z' } }],
    ['the houses left out of the letter', { ...PAPER, housesInLetter: false }],
    ['the short affidavit form', { ...PAPER, affidavitForm: 'short' }],
    ['a release', { ...PAPER, releaseId: 'rel-1' }],
    ['an unknown new key', { ...PAPER, somethingNew: 'on the paper one day' }],
    ['an unknown new key holding nothing', { ...PAPER, somethingNew: null }],
    ['a record’s word deeper in the paper', { ...PAPER, notice: { ...PAPER.notice, promise: 'x' } }],
    ['a record’s word inside another key', { ...PAPER, payLines: { ...PAPER.payLines, courtesy: 'x' } }],
    ['a near miss of a record key', { ...PAPER, Promise: PROMISE }],
    ['another near miss', { ...PAPER, owner_call: OWNER_CALL }],
    ['the fields emptied', {}],
    ['the fields gone', null],
    ['a list in place of the fields', [PAPER]],
  ]
  for (const [name, fields] of changes) {
    it(`${name}`, () => {
      expect(lienFieldsHash(fields)).not.toBe(PAPER_HASH_BEFORE)
      expect(reads(approved(fields, PAPER))).toEqual(GONE)
      expect(reads(mailed(fields, PAPER))).toEqual(GONE)
      // The same change under a full set of records is still a change.
      if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
        const under = withCourtesyRecord(withPromiseRecord({ ...(fields as Record<string, unknown>), ownerCall: OWNER_CALL, gcAuthorizedDirectPay: { at: SIGNED_AT, ...GC_OKAY } }, PROMISE), COURTESY)
        expect(reads(mailed(under, PAPER))).toEqual(GONE)
      }
    })
  }

  it('every pair of changes above hashes apart, so no two edits read as one paper', () => {
    const hashes = changes.map(([, f]) => lienFieldsHash(f))
    expect(new Set(hashes).size).toBe(hashes.length)
  })

  it('the three lines that come with a cleared signature still change the hash', () => {
    const who = { userId: 'u-dana', userName: 'Dana' }
    const takenBack = fieldsWithTakeBack(PAPER, { at: '2026-11-14T15:00:00.000Z', by: 'u-dana', byName: 'Dana', printedAt: '2026-11-13T15:00:00.000Z' })
    const cleared = fieldsWithSignatureCleared(PAPER, signatureClearedRecord(approved(PAPER), who, '2026-11-14T15:00:00.000Z'))
    const redrawn = fieldsRedrawn(PAPER, PAPER.notice as never, { at: '2026-11-14T15:00:00.000Z', by: 'u-dana', byName: 'Dana', wasClaim: '18400.00', wasDate: '2026-11-12' })
    for (const [name, fields] of [['runTakenBack', takenBack], ['signatureCleared', cleared], ['redrawn', redrawn]] as const) {
      expect(Object.keys(fields), name).toContain(name)
      expect(lienFieldsHash(fields), name).not.toBe(PAPER_HASH_BEFORE)
      expect(reads(approved(fields, PAPER)), name).toEqual(GONE)
    }
    expect(lienFieldsHash({ ...PAPER, runClosedPaid: { at: '2026-11-14T15:00:00.000Z' } })).not.toBe(PAPER_HASH_BEFORE)
  })
})

describe('Sign it again (v2.7502) on a notice that carries a record', () => {
  const office = { office: true, leader: false }
  const withRecord = withPromiseRecord(PAPER, PROMISE)

  it('is offered while the signature stands: a record written since he signed does not hide the press', () => {
    expect(signAgainOffered({ item: approved(PAPER), ...office })).toBe(true)
    expect(signAgainOffered({ item: approved(withRecord, PAPER), ...office })).toBe(true)
    expect(signAgainOffered({ item: approved(withRecord), ...office })).toBe(true)
  })

  it('is not offered once the paper changed, record or no record: the notice already reads unsigned', () => {
    const edited = { ...withRecord, gcEmail: 'office@ridgeway.example' }
    expect(signAgainOffered({ item: approved(edited, PAPER), ...office })).toBe(false)
    // A mailed notice is past the press whatever its hash says.
    expect(signAgainOffered({ item: mailed(withRecord, PAPER), ...office })).toBe(false)
  })

  it('the clear takes the signature off, the record stays, and the next signature stands through a later record', () => {
    const row = approved(withRecord, PAPER)
    const clearedFields = fieldsWithSignatureCleared(row.fields, signatureClearedRecord(row, { userId: 'u-dana', userName: 'Dana' }, '2026-11-14T15:00:00.000Z'))
    expect(clearedFields[PROMISE_FIELDS_KEY]).toEqual(PROMISE)
    const cleared = { ...row, ...LIEN_DESK_SIGNATURE_CLEAR, fields: clearedFields }
    expect(lienItemUnsigned(cleared)).toBe(true)
    expect(lienRowUnsigned(cleared, cleared.fields)).toBe(true)
    expect(lienSignatureAskable(cleared)).toBe(true)
    expect(signAgainOffered({ item: cleared, ...office })).toBe(false)
    // Had the write left the columns on the row, the line it keeps would still void the old signature.
    expect(reads({ ...row, fields: clearedFields })).toEqual(GONE)

    // He signs the notice again as it now stands, and the desk writes another record afterwards.
    const resigned = approved(clearedFields)
    expect(reads(resigned)).toEqual(STANDS)
    expect(lienSignatureAskable(resigned)).toBe(false)
    expect(reads(mailed(withCourtesyRecord(clearedFields, COURTESY), clearedFields))).toEqual(STANDS)
  })
})

describe('the function’s reminder reads the same rule', () => {
  it('an approved notice signed before a record was written is not asked for again', () => {
    expect(lienSignatureAskable(approved(PAPER))).toBe(false)
    expect(lienSignatureAskable(approved(withPromiseRecord(PAPER, PROMISE), PAPER))).toBe(false)
    expect(lienSignatureAskable(approved({ ...PAPER, gcEmail: 'office@ridgeway.example' }, PAPER))).toBe(true)
  })
})
