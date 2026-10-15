import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  PROSPECT_COMPANY_ROLES,
  PROSPECT_KINDS,
  PROSPECT_KIND_WORDS,
  benchDraftFromProspect,
  companyRoleChip,
  isProspectCompanyRole,
  isProspectKind,
  kindFromUrlKey,
  langLabel,
  parseTradesText,
  prospectBenchCommentText,
  prospectKindFacts,
  prospectLandedToast,
  tradesText,
  urlKeyForKind,
} from './prospectKinds'

describe('prospectKinds: the kind and its URL key', () => {
  it('reads the three keys and falls back to the customer deck for anything else', () => {
    expect(kindFromUrlKey('subs')).toBe('sub')
    expect(kindFromUrlKey('gc-leads')).toBe('gc_lead')
    expect(kindFromUrlKey('customers')).toBe('customer')
    expect(kindFromUrlKey(null)).toBe('customer')
    expect(kindFromUrlKey('team')).toBe('customer')
  })

  it('round-trips every kind through its key', () => {
    for (const kind of PROSPECT_KINDS) expect(kindFromUrlKey(urlKeyForKind(kind))).toBe(kind)
  })

  it('knows a kind from a stranger', () => {
    expect(isProspectKind('sub')).toBe(true)
    expect(isProspectKind('hire')).toBe(false)
    expect(isProspectKind(null)).toBe(false)
  })
})

describe('prospectKinds: the words', () => {
  it('names the last press for what happens, per kind', () => {
    expect(PROSPECT_KIND_WORDS.customer.lastPress).toBe('Converted ✓')
    expect(PROSPECT_KIND_WORDS.gc_lead.lastPress).toBe('Asked us ✓')
    expect(PROSPECT_KIND_WORDS.sub.lastPress).toBe('Add to the bench ✓')
    expect(PROSPECT_KIND_WORDS.sub.landed).toBe('On the bench')
    expect(PROSPECT_KIND_WORDS.gc_lead.landed).toBe('Asked us')
  })

  it('writes the kind cards in plain words', () => {
    for (const kind of PROSPECT_KINDS) {
      expect(plainWordsFailures(PROSPECT_KIND_WORDS[kind].card)).toEqual([])
    }
  })

  it('words a role for the chip, and nothing for no role', () => {
    expect(companyRoleChip('owner')).toBe('Owner')
    expect(companyRoleChip('ownersRep')).toBe("Owner's rep")
    expect(companyRoleChip('gc')).toBe('General contractor')
    expect(companyRoleChip(null)).toBeNull()
    expect(companyRoleChip('tenant')).toBeNull()
    for (const r of PROSPECT_COMPANY_ROLES) expect(isProspectCompanyRole(r.role)).toBe(true)
    expect(isProspectCompanyRole('tenant')).toBe(false)
  })

  it('names the language', () => {
    expect(langLabel('es')).toBe('Spanish')
    expect(langLabel(null)).toBeNull()
  })
})

describe('prospectKinds: trades text', () => {
  it('splits on commas, trims, drops blanks and doubles', () => {
    expect(parseTradesText(' Concrete, fire sprinkler,, HVAC ,concrete')).toEqual(['Concrete', 'fire sprinkler', 'HVAC'])
    expect(parseTradesText('')).toEqual([])
    expect(tradesText(['Concrete', 'HVAC'])).toBe('Concrete, HVAC')
    expect(tradesText(null)).toBe('')
  })
})

describe('prospectKinds: landing on the bench', () => {
  const sub = {
    company_name: ' Bexar Fire Protection ',
    contact_name: 'Tomás Reyna',
    phone_number: '(210) 555-0188',
    email: 'bids@bexarfire.example',
    address: '1800 Cibolo Trail, Boerne',
    trades: ['Fire sprinkler', 'HVAC'],
    max_miles: 40,
    lang: 'en' as const,
  }

  it("fills the bench's draft from the sub, new to us", () => {
    expect(benchDraftFromProspect(sub)).toEqual({
      name: 'Bexar Fire Protection',
      trades: ['Fire sprinkler', 'HVAC'],
      contactName: 'Tomás Reyna',
      phone: '(210) 555-0188',
      email: 'bids@bexarfire.example',
      address: '1800 Cibolo Trail, Boerne',
      maxMiles: 40,
      known: false,
      lang: 'en',
    })
  })

  it('falls back to the contact for a name, leaves miles null when not said, and skips a language not said', () => {
    const draft = benchDraftFromProspect({ ...sub, company_name: null, max_miles: null, lang: null, trades: null })
    expect(draft.name).toBe('Tomás Reyna')
    expect(draft.maxMiles).toBeNull()
    expect(draft.trades).toEqual([])
    expect('lang' in draft).toBe(false)
  })

  it('records the landing in the comment and the toast', () => {
    expect(prospectBenchCommentText('Bexar Fire Protection')).toBe('Added to the bench: Bexar Fire Protection (/gc?view=partners)')
    expect(prospectBenchCommentText('  ')).toBe('Added to the bench: the company (/gc?view=partners)')
    expect(prospectLandedToast('sub', 'Bexar Fire Protection', '')).toBe('Bexar Fire Protection is on the bench')
    expect(prospectLandedToast('gc_lead', 'Hill Country Developers', 'Hill Country Developers')).toBe(
      'Hill Country Developers asked us → Hill Country Developers',
    )
    expect(prospectLandedToast('customer', '', 'Ridgeway')).toBe('Prospect converted → Ridgeway')
  })
})

describe('prospectKinds: the facts under the name', () => {
  it('reads a sub by range, language and source', () => {
    expect(prospectKindFacts({ kind: 'sub', max_miles: 40, lang: 'en', source: "A GC's sub list" })).toEqual([
      'goes up to 40 mi',
      'English',
      "from A GC's sub list",
    ])
  })

  it('reads a GC lead by role and source, and a customer by source alone', () => {
    expect(prospectKindFacts({ kind: 'gc_lead', company_role: 'architect', source: 'PlanHub' })).toEqual(['Architect', 'from PlanHub'])
    expect(prospectKindFacts({ kind: 'customer', source: ' ' })).toEqual([])
    expect(prospectKindFacts({ kind: 'customer', source: 'A referral', max_miles: 30 })).toEqual(['from A referral'])
  })
})
