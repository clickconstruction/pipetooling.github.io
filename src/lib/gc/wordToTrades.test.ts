/**
 * Punch list #205, PR 6: a word to every trade on a job, on main's test state. Fair Oaks Shops, Building D has six
 * companies awarded a trade; a bidding job has none.
 */
import { describe, expect, it } from 'vitest'
import { initialGcState } from './schedule/testState'
import { andList, wordEmailKey, wordLines, wordRecipients, wordSubject } from './wordToTrades'

const s = initialGcState()
const fairOaks = s.projects.find((p) => p.id === 'fairoaksd')!

describe('who gets a word to every trade', () => {
  it('is every company awarded a trade on the job, each once, in the order of the trades', () => {
    const who = wordRecipients(s, fairOaks)
    expect(who.map((r) => [r.partner.company, r.trades])).toEqual([
      ['Tri-County Site', ['Sitework']],
      ['Guadalupe Flatwork', ['Concrete']],
      ['Iron Horse Fabrication', ['Structural steel']],
      ['Pecan Valley Electric', ['Electrical']],
      ['Summit Roofing', ['Roofing']],
      ['Cool Breeze Mechanical', ['HVAC']],
    ])
    expect(new Set(who.map((r) => r.partner.id)).size).toBe(who.length)
  })

  it('is nobody on a job with no award, and one company once when it holds two trades', () => {
    const none = { ...fairOaks, packages: fairOaks.packages.map((k) => ({ ...k, awardedInviteId: null })) }
    expect(wordRecipients(s, none)).toEqual([])
    const twice = { ...fairOaks, packages: fairOaks.packages.map((k, i) => (i === 1 ? { ...k, invites: fairOaks.packages[0]!.invites, awardedInviteId: fairOaks.packages[0]!.awardedInviteId } : k)) }
    expect(wordRecipients(s, twice)[0]).toMatchObject({ partner: { company: 'Tri-County Site' }, trades: ['Sitework', 'Concrete'] })
  })
})

describe('the email', () => {
  it('starts from a subject that names us and the job, and takes its lines from the paragraphs typed', () => {
    expect(wordSubject('Fair Oaks Shops, Building D')).toBe('A word from Click on Fair Oaks Shops, Building D')
    expect(wordLines('  The site is closed Friday for the pour.\n\n\nPark on the north lot\nfrom Monday.  \n\n')).toEqual(['The site is closed Friday for the pour.', 'Park on the north lot from Monday.'])
    expect(wordLines('   ')).toEqual([])
  })

  it('keys the same words the same, a changed word anew, under the sender’s 200 letters', async () => {
    const a = await wordEmailKey('fairoaksd', 'A word', 'The site is closed Friday.')
    const b = await wordEmailKey('fairoaksd', 'A word', 'The site is closed Friday.')
    const c = await wordEmailKey('fairoaksd', 'A word', 'The site is closed Saturday.')
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a.startsWith('word:fairoaksd:')).toBe(true)
    expect(a.length).toBeLessThan(200)
    expect(await wordEmailKey('other', 'A word', 'The site is closed Friday.')).not.toBe(a)
  })

  it('lists names with and', () => {
    expect(andList([])).toBe('')
    expect(andList(['Summit Roofing'])).toBe('Summit Roofing')
    expect(andList(['Summit Roofing', 'Cool Breeze Mechanical', 'Pecan Valley Electric'])).toBe('Summit Roofing, Cool Breeze Mechanical and Pecan Valley Electric')
  })
})
