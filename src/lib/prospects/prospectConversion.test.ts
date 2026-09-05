import { describe, expect, it } from 'vitest'
import {
  canAccessProspectPipeline,
  customerDraftFromProspect,
  markProspectConverted,
  prospectChipLabel,
  prospectConvertedCommentText,
  prospectMatchesQuery,
  searchProspectsForCustomerForm,
  type ConvertibleProspect,
  type ProspectConversionClient,
} from './prospectConversion'

function prospect(overrides: Partial<ConvertibleProspect> = {}): ConvertibleProspect {
  return {
    id: 'p1',
    company_name: 'Acme Plumbing Supply',
    contact_name: 'Dana Reyes',
    phone_number: '(555) 010-2233',
    email: 'dana@acme.example',
    address: '12 Pipe Lane, Austin TX',
    prospect_fit_status: null,
    ...overrides,
  }
}

describe('canAccessProspectPipeline', () => {
  it('mirrors the Follow Up gate: staff roles in, estimator only with the flag', () => {
    expect(canAccessProspectPipeline('dev', false)).toBe(true)
    expect(canAccessProspectPipeline('master_technician', false)).toBe(true)
    expect(canAccessProspectPipeline('assistant', false)).toBe(true)
    expect(canAccessProspectPipeline('controller', false)).toBe(true)
    expect(canAccessProspectPipeline('estimator', false)).toBe(false)
    expect(canAccessProspectPipeline('estimator', true)).toBe(true)
    expect(canAccessProspectPipeline('subcontractor', true)).toBe(false)
    expect(canAccessProspectPipeline('helpers', true)).toBe(false)
    expect(canAccessProspectPipeline(null, true)).toBe(false)
    expect(canAccessProspectPipeline(undefined, true)).toBe(false)
  })
})

describe('prospectMatchesQuery', () => {
  it('matches company, contact, address and email case-insensitively by substring', () => {
    const p = prospect()
    expect(prospectMatchesQuery(p, 'acme')).toBe(true)
    expect(prospectMatchesQuery(p, 'REYES')).toBe(true)
    expect(prospectMatchesQuery(p, 'pipe lane')).toBe(true)
    expect(prospectMatchesQuery(p, 'dana@')).toBe(true)
    expect(prospectMatchesQuery(p, 'zebra')).toBe(false)
  })

  it('matches phone digits regardless of punctuation once three digits are typed', () => {
    const p = prospect()
    expect(prospectMatchesQuery(p, '555-010')).toBe(true)
    expect(prospectMatchesQuery(p, '5550102233')).toBe(true)
    expect(prospectMatchesQuery(p, '010 2233')).toBe(true)
    expect(prospectMatchesQuery(p, '(555)')).toBe(true)
    // Two digits are too loose to be a phone search — they only match as text.
    expect(prospectMatchesQuery(p, '55')).toBe(true) // literal "55" is in "(555)"
    expect(prospectMatchesQuery(p, '99')).toBe(false)
  })

  it('never matches a blank query or a converted prospect', () => {
    expect(prospectMatchesQuery(prospect(), '')).toBe(false)
    expect(prospectMatchesQuery(prospect(), '   ')).toBe(false)
    expect(prospectMatchesQuery(prospect({ prospect_fit_status: 'converted' }), 'acme')).toBe(false)
  })

  it('tolerates null fields', () => {
    const p = prospect({ company_name: null, contact_name: null, phone_number: null, email: null, address: null })
    expect(prospectMatchesQuery(p, 'anything')).toBe(false)
  })
})

describe('searchProspectsForCustomerForm', () => {
  const pool: ConvertibleProspect[] = [
    prospect({ id: 'a', company_name: 'Bayside Dental', contact_name: 'Ana Ortiz' }),
    prospect({ id: 'b', company_name: 'Ana & Sons Bakery', contact_name: 'Ana Ruiz' }),
    prospect({ id: 'c', company_name: 'Hilltop Cafe', contact_name: 'Ana Lee', prospect_fit_status: 'converted' }),
    prospect({ id: 'd', company_name: 'Anaheim Roofing', contact_name: 'Bob' }),
  ]

  it('puts company-name prefix hits first, keeps caller order otherwise, and drops converted rows', () => {
    expect(searchProspectsForCustomerForm(pool, 'ana').map((p) => p.id)).toEqual(['b', 'd', 'a'])
  })

  it('returns [] for a blank query and honours the limit', () => {
    expect(searchProspectsForCustomerForm(pool, '')).toEqual([])
    expect(searchProspectsForCustomerForm(pool, 'ana', 2).map((p) => p.id)).toEqual(['b', 'd'])
  })
})

describe('customerDraftFromProspect', () => {
  it('maps company → name, and carries address / phone / email', () => {
    expect(customerDraftFromProspect(prospect())).toEqual({
      name: 'Acme Plumbing Supply',
      address: '12 Pipe Lane, Austin TX',
      phone: '(555) 010-2233',
      email: 'dana@acme.example',
    })
  })

  it('falls back to the contact name when the prospect has no company, and omits blanks', () => {
    expect(customerDraftFromProspect(prospect({ company_name: '  ', address: null, email: '' }))).toEqual({
      name: 'Dana Reyes',
      phone: '(555) 010-2233',
    })
    expect(customerDraftFromProspect(prospect({ company_name: null, contact_name: null, address: null, phone_number: null, email: null }))).toEqual({})
  })
})

describe('prospectChipLabel / prospectConvertedCommentText', () => {
  it('labels the chip and names the customer in the comment with its path', () => {
    expect(prospectChipLabel(prospect())).toBe('Acme Plumbing Supply — Dana Reyes')
    expect(prospectChipLabel(prospect({ contact_name: null }))).toBe('Acme Plumbing Supply')
    expect(prospectChipLabel(prospect({ company_name: null }))).toBe('Dana Reyes')
    expect(prospectChipLabel(prospect({ company_name: null, contact_name: null }))).toBe('Unnamed prospect')
    expect(prospectConvertedCommentText('Acme Plumbing Supply', 'c-9')).toBe('Converted to customer Acme Plumbing Supply (/customers/c-9)')
    expect(prospectConvertedCommentText('   ', 'c-9')).toBe('Converted to customer record (/customers/c-9)')
  })
})

type Call = { table: string; op: 'update' | 'insert'; values: Record<string, unknown>; eq?: [string, string] }

function fakeClient(opts: { updateError?: string; insertError?: string } = {}) {
  const calls: Call[] = []
  const client: ProspectConversionClient = {
    from(table) {
      return {
        update(values) {
          const call: Call = { table, op: 'update', values }
          calls.push(call)
          return {
            eq(column, value) {
              call.eq = [column, value]
              return Promise.resolve({ error: opts.updateError ? { message: opts.updateError } : null })
            },
          }
        },
        insert(values) {
          calls.push({ table, op: 'insert', values })
          return Promise.resolve({ error: opts.insertError ? { message: opts.insertError } : null })
        },
      }
    },
  }
  return { client, calls }
}

describe('markProspectConverted', () => {
  it('flips the status and leaves a converted interaction naming the customer', async () => {
    const { client, calls } = fakeClient()
    const res = await markProspectConverted('p-1', 'c-7', 'Acme', 'u-1', client)
    expect(res).toEqual({ ok: true })
    expect(calls).toEqual([
      { table: 'prospects', op: 'update', values: { prospect_fit_status: 'converted' }, eq: ['id', 'p-1'] },
      {
        table: 'prospect_comments',
        op: 'insert',
        values: {
          prospect_id: 'p-1',
          created_by: 'u-1',
          comment_text: 'Converted to customer Acme (/customers/c-7)',
          interaction_type: 'converted',
        },
      },
    ])
  })

  it('stops before the comment when the status update fails, and reports the error', async () => {
    const { client, calls } = fakeClient({ updateError: 'RLS says no' })
    const res = await markProspectConverted('p-1', 'c-7', 'Acme', 'u-1', client)
    expect(res).toEqual({ ok: false, error: 'RLS says no' })
    expect(calls.map((c) => c.op)).toEqual(['update'])
  })

  it('reports a failed comment insert without throwing', async () => {
    const { client } = fakeClient({ insertError: 'comment failed' })
    await expect(markProspectConverted('p-1', 'c-7', 'Acme', 'u-1', client)).resolves.toEqual({ ok: false, error: 'comment failed' })
  })

  it('never throws even when the client does', async () => {
    const client = { from: () => { throw new Error('boom') } } as unknown as ProspectConversionClient
    await expect(markProspectConverted('p-1', 'c-7', 'Acme', 'u-1', client)).resolves.toEqual({ ok: false, error: 'boom' })
  })
})
