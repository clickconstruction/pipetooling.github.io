import { describe, expect, it } from 'vitest'
import { HR_LINK_UNKNOWN_WORDS, dropHrPersonParams, hrPersonParams, readHrPersonLink } from './hrPersonLink'
import { claimPersonDeskLink } from './personDeskLink'

const MARCUS = '11111111-1111-4111-8111-111111111111'
const DANNY = '22222222-2222-4222-8222-222222222222'

describe('readHrPersonLink', () => {
  it('opens a person the reader can see', () => {
    expect(readHrPersonLink(MARCUS, [DANNY, MARCUS])).toEqual({ kind: 'open', personId: MARCUS })
  })
  it('reads no link when the address carries none', () => {
    expect(readHrPersonLink(null, [MARCUS])).toEqual({ kind: 'none' })
    expect(readHrPersonLink('  ', [MARCUS])).toEqual({ kind: 'none' })
  })
  it('names an id that matches no one, or a person the reader may not see, as unknown', () => {
    expect(readHrPersonLink('33333333-3333-4333-8333-333333333333', [MARCUS])).toEqual({ kind: 'unknown' })
    expect(readHrPersonLink(MARCUS, [])).toEqual({ kind: 'unknown' })
  })
})

describe('hrPersonParams', () => {
  it('writes the person a press on the roster opens, keeping the page tab', () => {
    const next = hrPersonParams(new URLSearchParams('tab=hr'), MARCUS)
    expect(next.toString()).toBe(`tab=hr&person=${MARCUS}`)
  })
  it('keeps the theme on the same person and drops it on another', () => {
    const prev = new URLSearchParams(`tab=hr&person=${MARCUS}&theme=t1`)
    expect(hrPersonParams(prev, MARCUS).get('theme')).toBe('t1')
    expect(hrPersonParams(prev, DANNY).get('theme')).toBeNull()
    expect(hrPersonParams(prev, DANNY).get('person')).toBe(DANNY)
  })
  it('back to the roster takes the person and the theme off', () => {
    expect(hrPersonParams(new URLSearchParams(`tab=hr&person=${MARCUS}&theme=t1`), null).toString()).toBe('tab=hr')
  })
  it('leaving HR takes its person and theme off the address', () => {
    expect(dropHrPersonParams(new URLSearchParams(`tab=hr&person=${MARCUS}&theme=t1&view=x`)).toString()).toBe('tab=hr&view=x')
  })
  it('the unknown line is one plain sentence pair', () => {
    expect(HR_LINK_UNKNOWN_WORDS).not.toMatch(/[—–;()]/)
  })
})

describe('claimPersonDeskLink', () => {
  it('leaves a bare HR id on the address for People → HR', () => {
    // The fault: the global handler stripped every person=, so the HR link lost its person.
    expect(claimPersonDeskLink(new URLSearchParams(`tab=hr&person=${MARCUS}`))).toBeNull()
  })
  it('leaves the pay Ledger’s name key alone', () => {
    expect(claimPersonDeskLink(new URLSearchParams('tab=pay_stubs&view=ledger&person=marcus%20reed'))).toBeNull()
  })
  it('claims a desk key and takes its params off the address', () => {
    const claim = claimPersonDeskLink(new URLSearchParams(`tab=users&person=p:${MARCUS}&section=paperwork&flow=bring_back`))
    expect(claim?.open).toEqual({ personId: MARCUS, section: 'paperwork', flow: 'bring_back' })
    expect(claim?.next.toString()).toBe('tab=users')
  })
  it('claims a login key', () => {
    const claim = claimPersonDeskLink(new URLSearchParams(`person=u:${DANNY}`))
    expect(claim?.open).toEqual({ userId: DANNY, section: null, flow: null })
    expect(claim?.next.toString()).toBe('')
  })
})
