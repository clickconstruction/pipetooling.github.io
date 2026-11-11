import { describe, expect, it } from 'vitest'
import { DEFAULT_CROP } from './person'
import { defaultTicks, teamCards, teamPressWords, type TeamCardRow } from './team'

const row = (id: string, name: string, over: Partial<TeamCardRow['facts']> = {}, photoPath: string | null = `${id}/photo-1.jpg`): TeamCardRow => ({
  id,
  role: 'assistant',
  facts: { name, card_name: null, title: 'Estimator', email: `${id}@example.com`, phone: '(512) 555-0100', ...over },
  photoPath,
  crop: DEFAULT_CROP,
})

const team = [row('m', 'Marisol Vega'), row('h', 'Hank Brewer', {}, null), row('l', 'Lucia Ferrante', { phone: null }), row('d', 'Dale', { card_name: 'Dale Okafor', title: null }), row('x', 'Xavier', { email: null })]

describe('the team’s cards', () => {
  const cards = teamCards(team, '(512) 555-0199')
  it('sorts by the name on the card', () => {
    expect(cards.map((c) => c.name)).toEqual(['Dale Okafor', 'Hank Brewer', 'Lucia Ferrante', 'Marisol Vega', 'Xavier'])
  })
  it('holds a person with no photo or no email, and nobody for a missing mobile or title', () => {
    expect(Object.fromEntries(cards.map((c) => [c.id, c.hold]))).toEqual({ d: null, h: 'No photo', l: null, m: null, x: 'No email' })
  })
  it('says which line will be left off', () => {
    expect(cards.find((c) => c.id === 'l')?.leftOff).toEqual(['No mobile, line left off'])
    expect(cards.find((c) => c.id === 'd')?.leftOff).toEqual(['No title, line left off'])
    expect(cards.find((c) => c.id === 'm')?.leftOff).toEqual([])
  })
  it('ticks everyone who is ready', () => {
    expect([...defaultTicks(cards)].sort()).toEqual(['d', 'l', 'm'])
  })
  it('counts what each press will do and what it holds', () => {
    const w = teamPressWords(cards, defaultTicks(cards))
    expect(w.cards.button).toBe('Make 3 cards · 2 are held ▸')
    expect(w.cards.dead).toBe(false)
    expect(w.footers).toBe('Download 3 footers')
    const one = teamPressWords(cards, new Set(['m']))
    expect(one.cards.button).toBe('Make 1 card · 2 are held ▸')
    expect(one.footers).toBe('Download 1 footer')
  })
  it('is dead when nothing is ticked, and says so', () => {
    const w = teamPressWords(cards, new Set())
    expect(w.cards.dead).toBe(true)
    expect(w.footers).toBe('Download footers')
  })
  it('reads plainly when nobody is held', () => {
    const ready = teamCards([row('m', 'Marisol Vega'), row('d', 'Dale Okafor')], '')
    expect(teamPressWords(ready, defaultTicks(ready)).cards.button).toBe('Make 2 cards')
  })
})
