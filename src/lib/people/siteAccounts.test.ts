import { describe, expect, it } from 'vitest'
import { plainSentence } from '../valuesInPlace'
import {
  SITE_ROLE_OPTIONS,
  countUnmatchedSiteAccounts,
  isFleetAddress,
  normalizeSiteEmail,
  parseSiteRoster,
  siteFlagTitle,
  siteRoleChange,
  siteRoleDoneWords,
  siteRoleIsOn,
  siteSeatActiveBody,
  siteSeatFor,
  siteSeatPress,
  siteSeatWords,
  unmatchedSiteWords,
  unreadSiteWords,
  type SiteAccount,
} from './siteAccounts'

const acct = (over: Partial<SiteAccount> & { id: string }): SiteAccount => ({ email: null, active: true, isTwin: false, roles: [], lastSignInAt: null, ...over })

describe('reading a site roster', () => {
  it("reads CountTooling's rows: its own id key, the three roles that stand together, no sign-in stamp", () => {
    const got = parseSiteRoster('count', {
      roster: [
        { ct_user_id: 'ct-1', email: 'zz.test.estimator@example.com', is_digital_twin: false, is_admin: true, is_overseer: true, is_lead: true, active: true },
        { ct_user_id: 'ct-2', email: 'twin-estimator-1@twins.counttooling.local', is_digital_twin: true, is_admin: false, active: false },
      ],
      count: 2,
    })
    expect(got).toEqual([
      { id: 'ct-1', email: 'zz.test.estimator@example.com', active: true, isTwin: false, roles: ['overseer', 'lead', 'admin'], lastSignInAt: null },
      { id: 'ct-2', email: 'twin-estimator-1@twins.counttooling.local', active: false, isTwin: true, roles: [], lastSignInAt: null },
    ])
  })

  it("reads TakeoffTooling's rows: a plain user has no role worth saying, and the sign-in stamp comes through", () => {
    const got = parseSiteRoster('takeoff', {
      roster: [
        { tt_user_id: 'tt-1', email: 'zz.test.estimator@example.com', role: 'user', is_digital_twin: false, active: true, last_sign_in_at: '2026-11-20T15:00:00Z' },
        { tt_user_id: 'tt-2', email: 'zz.test.dev@example.com', role: 'dev', is_digital_twin: false, active: true, last_sign_in_at: null },
      ],
    })
    expect(got.map((a) => [a.id, a.roles, a.lastSignInAt])).toEqual([
      ['tt-1', [], '2026-11-20T15:00:00Z'],
      ['tt-2', ['dev'], null],
    ])
  })

  it('a row with no id is left out, and an answer with no list throws its own reason', () => {
    expect(parseSiteRoster('takeoff', { roster: [{ email: 'zz.test.nobody@example.com' }, null, 7] })).toEqual([])
    expect(() => parseSiteRoster('takeoff', { error: 'Unknown or missing verb' })).toThrow('Unknown or missing verb')
    expect(() => parseSiteRoster('count', null)).toThrow('The site sent no list of accounts back.')
    expect(() => parseSiteRoster('count', { roster: 'nope' })).toThrow('The site sent no list of accounts back.')
  })
})

describe('whose seat is whose', () => {
  const accounts = [
    acct({ id: 'ct-1', email: 'zz.test.estimator@example.com' }),
    acct({ id: 'ct-2', email: 'twin-estimator-1@twins.counttooling.local', isTwin: true }),
    acct({ id: 'ct-3', email: 'zz.test.old.address@example.com', active: false }),
  ]

  it('the id on their row wins, and says when the site has them under another address', () => {
    const seat = siteSeatFor({ email: 'zz.test.new.address@example.com', linkedId: 'ct-3' }, accounts)
    expect(seat).toEqual({ kind: 'seat', account: accounts[2], matchedBy: 'link', addressDiffers: true })
    expect(siteSeatWords(seat)).toEqual({ status: 'retired', flags: ['address differs'] })
    expect(siteFlagTitle('address differs', 'CountTooling', seat)).toBe('CountTooling has them as zz.test.old.address@example.com.')
  })

  it('with no id on their row the address finds the seat, whatever its case, and the cell says so', () => {
    const seat = siteSeatFor({ email: ' ZZ.Test.Estimator@Example.com ' }, accounts)
    expect(seat).toMatchObject({ kind: 'seat', matchedBy: 'email', addressDiffers: false })
    expect(siteSeatWords(seat)).toEqual({ status: 'active', flags: ['by address'] })
  })

  it("a robot's seat is found across the fleet domains, and a linked robot's address does not read as changed", () => {
    expect(normalizeSiteEmail('twin-estimator-1@twins.pipetooling.local')).toBe(normalizeSiteEmail('Twin-Estimator-1@twins.takeofftooling.local'))
    const byAddress = siteSeatFor({ email: 'twin-estimator-1@twins.pipetooling.local' }, accounts)
    expect(byAddress).toMatchObject({ kind: 'seat', matchedBy: 'email' })
    const byLink = siteSeatFor({ email: 'twin-estimator-1@twins.pipetooling.local', linkedId: 'ct-2' }, accounts)
    expect(byLink).toMatchObject({ kind: 'seat', matchedBy: 'link', addressDiffers: false })
    expect(siteSeatWords(byLink)).toEqual({ status: 'active', flags: ['twin'] })
  })

  it('nobody matched is no seat, and an id that no account has is said', () => {
    expect(siteSeatWords(siteSeatFor({ email: 'zz.test.helper@example.com' }, accounts))).toEqual({ status: 'no seat', flags: [] })
    expect(siteSeatWords(siteSeatFor({ email: null }, accounts))).toEqual({ status: 'no seat', flags: [] })
    const gone = siteSeatFor({ email: 'zz.test.helper@example.com', linkedId: 'ct-9' }, accounts)
    expect(siteSeatWords(gone)).toEqual({ status: 'no seat', flags: ['link gone'] })
    expect(siteFlagTitle('link gone', 'CountTooling', gone)).toBe('Their row holds a CountTooling id that no account there has.')
  })

  it('an id that is gone still falls back to the address', () => {
    expect(siteSeatFor({ email: 'zz.test.estimator@example.com', linkedId: 'ct-9' }, accounts)).toMatchObject({ kind: 'seat', matchedBy: 'email' })
  })
})

describe('accounts that belong to nobody here', () => {
  const accounts = [acct({ id: 'a', email: 'zz.test.one@example.com' }), acct({ id: 'b', email: 'zz.test.two@example.com' }), acct({ id: 'c', email: null }), acct({ id: 'd', email: 'zz.test.outside@example.com' })]

  it('counts the ones no link and no address claims', () => {
    const people = [{ email: 'zz.test.one@example.com' }, { email: 'zz.test.renamed@example.com', linkedId: 'b' }, { email: null }]
    expect(countUnmatchedSiteAccounts(people, accounts)).toBe(2)
    expect(countUnmatchedSiteAccounts([], accounts)).toBe(4)
    expect(countUnmatchedSiteAccounts(people, [])).toBe(0)
  })

  it('says the count as a value, in the singular and the plural, and says the good state plainly', () => {
    expect(plainSentence(unmatchedSiteWords('TakeoffTooling', 3))).toBe('3 TakeoffTooling accounts match nobody here.')
    expect(plainSentence(unmatchedSiteWords('CountTooling', 1))).toBe('1 CountTooling account matches nobody here.')
    expect(unmatchedSiteWords('CountTooling', 0)).toBe('Every CountTooling account matches a person here.')
    expect(unmatchedSiteWords('CountTooling', 3)).not.toBe(plainSentence(unmatchedSiteWords('CountTooling', 3)))
  })

  it('a site that was not read says so with its reason', () => {
    expect(unreadSiteWords('TakeoffTooling', 'Unknown or missing verb')).toBe('TakeoffTooling could not be read. Unknown or missing verb')
  })
})

describe("the desk's presses for one seat", () => {
  const overseer = acct({ id: 'ct-1', roles: ['overseer'] })

  it('a CountTooling press flips the one flag and names no other', () => {
    expect(siteRoleIsOn('count', overseer, 'overseer')).toBe(true)
    expect(siteRoleIsOn('count', overseer, 'lead')).toBe(false)
    expect(siteRoleChange('count', overseer, 'lead')).toEqual({ body: { verb: 'set_flags', ct_user_id: 'ct-1', is_lead: true }, turnsOn: true })
    expect(siteRoleChange('count', overseer, 'overseer')).toEqual({ body: { verb: 'set_flags', ct_user_id: 'ct-1', is_overseer: false }, turnsOn: false })
  })

  it('a TakeoffTooling seat holds one role, a plain seat is a user, and pressing the role it holds sends nothing', () => {
    const plain = acct({ id: 'tt-1' })
    expect(siteRoleIsOn('takeoff', plain, 'user')).toBe(true)
    expect(siteRoleChange('takeoff', plain, 'user')).toBeNull()
    expect(siteRoleChange('takeoff', plain, 'admin')).toEqual({ body: { verb: 'set_role', tt_user_id: 'tt-1', role: 'admin' }, turnsOn: true })
    expect(siteRoleChange('takeoff', acct({ id: 'tt-2', roles: ['dev'] }), 'user')).toEqual({ body: { verb: 'set_role', tt_user_id: 'tt-2', role: 'user' }, turnsOn: true })
  })

  it('the roles that manage other accounts ask first, and the rest do not', () => {
    expect(SITE_ROLE_OPTIONS.count.options.filter((o) => o.confirm).map((o) => o.key)).toEqual(['admin'])
    expect(SITE_ROLE_OPTIONS.takeoff.options.filter((o) => o.confirm).map((o) => o.key)).toEqual(['admin', 'dev'])
  })

  it('says what a role change did', () => {
    const [seer, , admin] = SITE_ROLE_OPTIONS.count.options
    expect(siteRoleDoneWords('CountTooling', seer!, true, 'ZZ Test Estimator')).toBe('ZZ Test Estimator is now an overseer on CountTooling.')
    expect(siteRoleDoneWords('CountTooling', admin!, false, 'ZZ Test Estimator')).toBe('ZZ Test Estimator is no longer an admin on CountTooling.')
    expect(siteRoleDoneWords('TakeoffTooling', SITE_ROLE_OPTIONS.takeoff.options[0]!, true, 'ZZ Test Estimator')).toBe('ZZ Test Estimator is now a user on TakeoffTooling.')
  })

  it('offers one seat press: make, retire or bring back, each with its own id key', () => {
    expect(siteSeatPress({ kind: 'none', linkGone: false })).toBe('make')
    expect(siteSeatPress({ kind: 'seat', account: overseer, matchedBy: 'link', addressDiffers: false })).toBe('retire')
    expect(siteSeatPress({ kind: 'seat', account: acct({ id: 'ct-9', active: false }), matchedBy: 'email', addressDiffers: false })).toBe('bring back')
    expect(siteSeatActiveBody('count', 'ct-1', false)).toEqual({ verb: 'deactivate', ct_user_id: 'ct-1' })
    expect(siteSeatActiveBody('takeoff', 'tt-1', true)).toEqual({ verb: 'reactivate', tt_user_id: 'tt-1' })
  })

  it("knows a robot's or a sample's address, whose seat is never made from a desk", () => {
    expect(isFleetAddress('twin-estimator-1@twins.pipetooling.local')).toBe(true)
    expect(isFleetAddress('zz.test.estimator@example.com')).toBe(false)
    expect(isFleetAddress(null)).toBe(false)
  })
})
