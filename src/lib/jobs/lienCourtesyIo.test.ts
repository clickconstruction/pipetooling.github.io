/**
 * The courtesy notice's reads and press (punch list #243, PR 1): opening the window makes no
 * Messages contact, a send by email alone makes none, and a send with a text makes the GC's
 * contact at the press through the office's own door, then texts the number on it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CourtesyFacts } from './lienCourtesyNotice'

const db = vi.hoisted(() => ({
  invokes: [] as { name: string; body: Record<string, unknown> }[],
  updates: [] as { table: string; patch: unknown; id: unknown }[],
  reads: [] as { table: string; id: unknown }[],
  customerInfo: null as unknown,
  textsOn: true,
  /** The GC's own contact, as the finder sees it: null when there is none. */
  foundContactId: null as string | null,
  contacts: {} as Record<string, { id: string; channels: { id: string; kind: 'phone' | 'email'; value: string; optedOutAt: string | null }[] }>,
  made: [] as string[],
  makeRefusal: null as string | null,
  /** The record write's refusal (punch list #249, row 1): null when the update takes. */
  updateRefusal: null as string | null,
  /** Whose number the owner's is (`contact_for_channel`): null when nobody's; a thrown message when the read fails. */
  phoneHolderId: null as string | null,
  phoneAsked: [] as string[],
  phoneReadFails: null as string | null,
}))

vi.mock('../supabase', () => ({
  supabase: {
    functions: {
      invoke: async (name: string, { body }: { body: Record<string, unknown> }) => {
        db.invokes.push({ name, body })
        return name === 'quo-send' ? { data: { ok: true, messageId: 'q1' }, error: null } : { data: { success: true, resend_email_id: 're_1' }, error: null }
      },
    },
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, id: unknown) => ({
          maybeSingle: async () => {
            db.reads.push({ table, id })
            return { data: db.customerInfo == null ? null : { contact_info: db.customerInfo }, error: null }
          },
        }),
      }),
      update: (patch: unknown) => ({
        eq: async (_col: string, id: unknown) => {
          if (db.updateRefusal) return { data: null, error: { message: db.updateRefusal } }
          db.updates.push({ table, patch, id })
          return { data: null, error: null }
        },
      }),
    }),
  },
}))
vi.mock('../../utils/errorHandling', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/errorHandling')>()),
  withSupabaseRetry: async (op: () => PromiseLike<{ data: unknown; error: { message: string } | null }>) => {
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
}))
vi.mock('../quo/textsSwitchIo', () => ({ supabaseTextsSwitchIo: () => ({ load: async () => db.textsOn }) }))
vi.mock('../messages/messagesIo', () => ({
  findCustomerContactId: async () => db.foundContactId,
  loadContact: async (id: string) => {
    const c = db.contacts[id]
    return c ? { id: c.id, kind: 'customer', name: 'Ridgeway Builders', goesBy: null, company: '', record: { kind: 'customer' }, channels: c.channels, jobIds: [], defaultJobId: null } : null
  },
  contactForCustomer: async (customerId: string) => {
    if (db.makeRefusal) throw new Error(db.makeRefusal)
    db.made.push(customerId)
    return 'c-new'
  },
  findContactIdForPhone: async (phone: string) => {
    db.phoneAsked.push(phone)
    if (db.phoneReadFails) throw new Error(db.phoneReadFails)
    return db.phoneHolderId
  },
}))

import { loadCourtesyRecipients, sendCourtesyNotice, writeCourtesyRecord, type CourtesyRecipient } from './lienCourtesyIo'

const facts: CourtesyFacts = {
  jobNumber: '741',
  jobName: 'Riverbend Dental',
  propertyAddress: '2200 Riverbend Dr, Austin, TX 78704',
  county: 'Travis',
  gcName: 'Ridgeway Builders',
  claimantName: 'Click Plumbing and Electrical',
  claim: 4850,
  monthsWords: 'August 2026',
  noticeSentOn: '2026-10-14',
  lienDay: '2026-11-16',
  payLinks: [{ address: 'clicktooling.com/pay/8f3a', amount: 4850 }],
  contactPerson: 'R. Douglas, Master Plumber',
  phone: '(512) 555-0147',
}

const open = (owner: { ownerEmail?: string; ownerPhone?: string } = {}) =>
  loadCourtesyRecipients({ gcCustomerId: 'cu-ridgeway', gcName: 'Ridgeway Builders', gcEmail: 'dortiz@ridgeway.example', ownerName: 'Cibolo Crossing Ltd', ownerEmail: owner.ownerEmail ?? '', ownerPhone: owner.ownerPhone ?? '' })

const gc = (over: Partial<CourtesyRecipient> = {}): CourtesyRecipient => ({
  who: 'original_contractor',
  name: 'Ridgeway Builders',
  email: { address: 'dortiz@ridgeway.example', goes: true, reason: '' },
  text: { address: '(512) 555-0100', goes: true, reason: '' },
  contactId: null,
  textChannelId: null,
  ...over,
})
const owner: CourtesyRecipient = { who: 'owner', name: 'Cibolo Crossing Ltd', email: { address: '', goes: false, reason: 'no email on the property record' }, text: { address: '', goes: false, reason: 'no number on the property record' }, contactId: null, textChannelId: null }

const send = (recipients: CourtesyRecipient[]) => sendCourtesyNotice({ item: { id: 'it1', fields: {} }, jobId: 'j741', gcCustomerId: 'cu-ridgeway', facts, greeting: 'Hello Dana,', recipients, by: { userId: 'u1', name: 'Taunya' } })

beforeEach(() => {
  db.invokes = []
  db.updates = []
  db.reads = []
  db.customerInfo = null
  db.textsOn = true
  db.foundContactId = null
  db.contacts = {}
  db.made = []
  db.makeRefusal = null
  db.phoneHolderId = null
  db.phoneAsked = []
  db.phoneReadFails = null
})

describe('the owner of record (v2.6497): the record’s email and phone, a text only on a thread that already holds the number', () => {
  it('an email and a number on the record, nobody in Messages holding it: the email goes, the text does not and says why, nothing is asked past the finder', async () => {
    const [, o] = await open({ ownerEmail: 'office@novy.example', ownerPhone: '(512) 555-0142' })
    expect(db.phoneAsked).toEqual(['(512) 555-0142'])
    expect(db.made).toEqual([])
    expect(o).toMatchObject({ who: 'owner', email: { address: 'office@novy.example', goes: true }, text: { address: '(512) 555-0142', goes: false, reason: 'not in Messages, so the email goes alone' }, contactId: null, textChannelId: null })
  })
  it('no number on the record: the finder is not asked, and the plan says so', async () => {
    const [, o] = await open({ ownerEmail: 'office@novy.example' })
    expect(db.phoneAsked).toEqual([])
    expect(o!.text).toEqual({ address: '', goes: false, reason: 'no number on the property record' })
  })
  it('a contact already holds the number: the text is planned on that channel, and the press texts it without making anything', async () => {
    db.phoneHolderId = 'c-novy'
    db.contacts['c-novy'] = { id: 'c-novy', channels: [{ id: 'p-novy', kind: 'phone', value: '512-555-0142', optedOutAt: null }] }
    const [, o] = await open({ ownerPhone: '(512) 555-0142' })
    expect(o).toMatchObject({ text: { address: '(512) 555-0142', goes: true }, contactId: 'c-novy', textChannelId: 'p-novy' })
    const r = await send([gc({ text: { address: '', goes: false, reason: 'no number on the job' } }), o!])
    expect(db.made).toEqual([])
    const text = db.invokes.find((i) => i.name === 'quo-send')!
    expect(text.body).toMatchObject({ contactId: 'c-novy', channelId: 'p-novy', tie: { jobId: 'j741', column: 'jobs_ledger_id' } })
    expect(r.record?.to.map((t) => [t.who, t.channel, t.ok])).toEqual([['original_contractor', 'email', true], ['owner', 'text', true]])
  })
  it('the number sent STOP on its thread: held with the GC’s own words', async () => {
    db.phoneHolderId = 'c-novy'
    db.contacts['c-novy'] = { id: 'c-novy', channels: [{ id: 'p-novy', kind: 'phone', value: '(512) 555-0142', optedOutAt: '2026-10-01T00:00:00Z' }] }
    const [, o] = await open({ ownerPhone: '(512) 555-0142' })
    expect(o!.text).toEqual({ address: '(512) 555-0142', goes: false, reason: 'they sent STOP' })
  })
  it('the finder failing is the text’s reason, and the email still goes', async () => {
    db.phoneReadFails = 'the spine is away'
    const [, o] = await open({ ownerEmail: 'office@novy.example', ownerPhone: '(512) 555-0142' })
    expect(o).toMatchObject({ email: { goes: true }, text: { address: '(512) 555-0142', goes: false, reason: 'their Messages contact could not be read: the spine is away' } })
  })
})

describe('opening the window makes nothing', () => {
  it('a GC with no contact: the number on their record is planned for the text, no contact made, nothing to text from yet', async () => {
    db.customerInfo = { phone: '(512) 555-0100', email: 'office@ridgeway.example' }
    const [g, o] = await open()
    expect(db.made).toEqual([])
    expect(db.reads).toEqual([{ table: 'customers', id: 'cu-ridgeway' }])
    expect(g).toMatchObject({ who: 'original_contractor', email: { address: 'dortiz@ridgeway.example', goes: true }, text: { address: '(512) 555-0100', goes: true, reason: '' }, contactId: null, textChannelId: null })
    expect(o).toMatchObject({ who: 'owner', text: { goes: false } })
  })
  it('a GC with no contact and no number on their record: no text, and still nothing made', async () => {
    db.customerInfo = { email: 'office@ridgeway.example' }
    const [g] = await open()
    expect(db.made).toEqual([])
    expect(g!.text).toEqual({ address: '', goes: false, reason: 'no number on the job' })
  })
  it('a GC with a contact: its live number and channel are read, the record is not, and nothing is made', async () => {
    db.foundContactId = 'c1'
    db.contacts.c1 = { id: 'c1', channels: [{ id: 'p1', kind: 'phone', value: '(512) 555-0193', optedOutAt: null }] }
    const [g] = await open()
    expect(db.made).toEqual([])
    expect(db.reads).toEqual([])
    expect(g).toMatchObject({ text: { address: '(512) 555-0193', goes: true }, contactId: 'c1', textChannelId: 'p1' })
  })
})

describe('the press', () => {
  it('a send by email alone makes no contact', async () => {
    const r = await send([gc({ text: { address: '', goes: false, reason: 'no number on the job' } }), owner])
    expect(db.made).toEqual([])
    expect(db.invokes.map((i) => i.name)).toEqual(['send-lien-filing-email'])
    expect(r.record?.to).toEqual([expect.objectContaining({ channel: 'email', ok: true })])
    expect(db.updates).toHaveLength(1)
  })
  it('a send with a text makes the GC’s contact at the press and texts the number on it', async () => {
    db.contacts['c-new'] = { id: 'c-new', channels: [{ id: 'e-new', kind: 'email', value: 'office@ridgeway.example', optedOutAt: null }, { id: 'p-new', kind: 'phone', value: '512-555-0100', optedOutAt: null }] }
    const r = await send([gc(), owner])
    expect(db.made).toEqual(['cu-ridgeway'])
    const text = db.invokes.find((i) => i.name === 'quo-send')!
    expect(text.body).toMatchObject({ contactId: 'c-new', channelId: 'p-new', tie: { jobId: 'j741', column: 'jobs_ledger_id' } })
    expect(r.record?.to.map((t) => [t.channel, t.ok])).toEqual([['email', true], ['text', true]])
  })
  it('a GC who already has a contact is texted on it, and no second contact is made', async () => {
    await send([gc({ contactId: 'c1', textChannelId: 'p1' }), owner])
    expect(db.made).toEqual([])
    expect(db.invokes.find((i) => i.name === 'quo-send')!.body).toMatchObject({ contactId: 'c1', channelId: 'p1' })
  })
  it('a refusal to make the contact is the text’s reason; the email still goes and the record is written', async () => {
    db.makeRefusal = 'A training account cannot start a customer’s thread.'
    const r = await send([gc(), owner])
    expect(db.invokes.map((i) => i.name)).toEqual(['send-lien-filing-email'])
    expect(r.record?.to).toEqual([expect.objectContaining({ channel: 'email', ok: true }), expect.objectContaining({ channel: 'text', ok: false, reason: 'A training account cannot start a customer’s thread.' })])
  })
  it('a new contact that holds no number that can be texted names that as the reason', async () => {
    db.contacts['c-new'] = { id: 'c-new', channels: [{ id: 'e-new', kind: 'email', value: 'office@ridgeway.example', optedOutAt: null }] }
    const r = await send([gc(), owner])
    expect(db.made).toEqual(['cu-ridgeway'])
    expect(db.invokes.map((i) => i.name)).toEqual(['send-lien-filing-email'])
    expect(r.record?.to[1]).toMatchObject({ channel: 'text', ok: false, reason: 'their Messages contact holds no number that can be texted' })
  })
})

describe('the record did not take after the messages went (punch list #249, row 1)', () => {
  it('comes back with the record and the reason instead of throwing, writes nothing, and the record alone writes on the next press', async () => {
    db.updateRefusal = 'new row violates row-level security policy'
    try {
      const r = await send([gc({ text: { address: '', goes: false, reason: 'no number on the job' } }), owner])
      expect(db.invokes.map((i) => i.name)).toEqual(['send-lien-filing-email'])
      expect(r.record?.to).toEqual([expect.objectContaining({ channel: 'email', ok: true })])
      expect(r.recordError).toBe('new row violates row-level security policy')
      expect(db.updates).toHaveLength(0)
      db.updateRefusal = null
      await writeCourtesyRecord({ id: 'sent1', fields: { courtesy: [] } }, r.record!)
      expect(db.invokes).toHaveLength(1)
      expect(db.updates).toHaveLength(1)
      expect(db.updates[0]).toMatchObject({ table: 'job_lien_desk_items', id: 'sent1' })
      expect((db.updates[0]!.patch as { fields: { courtesy: unknown[] } }).fields.courtesy).toEqual([r.record])
    } finally {
      db.updateRefusal = null
    }
  })
})
