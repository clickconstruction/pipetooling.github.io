import { describe, expect, it } from 'vitest'
import { subPortalGuide, type GuideContent } from './subPortalGuideStrings'
import { subPortalT, type SubPortalLang } from './subPortalI18n'

const EN = subPortalGuide('en')
const ES = subPortalGuide('es')

/** Shape signature: keys, array lengths and leaf types — everything but the words. */
function shape(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(shape)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, shape(x)]))
  return typeof v
}
function leaves(v: unknown, path = ''): Array<[string, string]> {
  if (typeof v === 'string') return [[path, v]]
  if (Array.isArray(v)) return v.flatMap((x, i) => leaves(x, `${path}[${i}]`))
  if (v && typeof v === 'object') return Object.entries(v as Record<string, unknown>).flatMap(([k, x]) => leaves(x, path ? `${path}.${k}` : k))
  return []
}

describe('subPortalGuide', () => {
  it('serves Spanish for es and English for anything else, as stable references', () => {
    expect(subPortalGuide('es')).toBe(ES)
    expect(subPortalGuide('en')).toBe(EN)
    expect(EN).not.toBe(ES)
    expect(EN.header).toBe('How this page works')
    expect(ES.header).toBe('Cómo funciona esta página')
  })

  it('the two languages have exactly the same shape — every key, every step, every fact, every coming-soon item', () => {
    expect(shape(ES)).toEqual(shape(EN))
    expect(EN.steps).toHaveLength(4)
    expect(EN.steps.map((s) => s.facts.length)).toEqual([2, 3, 3, 2])
    expect(EN.comingSoon.items).toHaveLength(2)
  })

  it('no line in either language is empty, padded, or carries an unfilled {placeholder}', () => {
    for (const g of [EN, ES]) {
      for (const [path, text] of leaves(g)) {
        expect(text, path).toBe(text.trim())
        expect(text.length, path).toBeGreaterThan(0)
        expect(text, path).not.toMatch(/\{[a-z_]+\}/)
      }
    }
  })

  it('only the "paid" step carries the green time chip, in both languages', () => {
    for (const g of [EN, ES]) {
      expect(g.steps.map((s) => s.time !== undefined)).toEqual([false, false, false, true])
      expect(g.steps[3]!.time!.length).toBeGreaterThan(0)
    }
  })

  it('the bottom line names the same button the page shows, and the demo confirm is the real confirm label', () => {
    for (const lang of ['en', 'es'] as SubPortalLang[]) {
      const g: GuideContent = subPortalGuide(lang)
      const button = subPortalT(lang, 'workDoneButton')
      expect(g.answer).toContain(button)
      expect(g.oneButton.body).toContain(button)
      expect(g.oneButton.demoConfirm).toBe(subPortalT(lang, 'workDoneConfirm'))
    }
  })

  it('the offers and documents sections name the headings and buttons the page actually uses', () => {
    for (const lang of ['en', 'es'] as SubPortalLang[]) {
      const g = subPortalGuide(lang)
      const newWorkHeading = subPortalT(lang, 'newWork')
      expect(g.offers.body).toContain(newWorkHeading.split(' ').slice(0, 2).join(' ')) // "New work" / "Trabajo nuevo"
      expect(g.documents.body).toContain(subPortalT(lang, 'signNow'))
    }
  })

  it('the four steps tell the money story in order: work → inspection → draw → paid', () => {
    expect(EN.steps.map((s) => s.title)).toEqual(['Work', 'Pre-inspection', 'Post-inspection: Trigger draw', "You're paid"])
    expect(ES.steps.map((s) => s.title)).toEqual(['Trabajo', 'Pre-inspección', 'Post-inspección: solicitar pago', 'Le pagamos'])
    // the first fact of every step is addressed to someone — You / Us / Then / Sometimes / a document state
    for (const g of [EN, ES]) for (const s of g.steps) for (const f of s.facts) expect(f.who.length).toBeGreaterThan(0)
  })
})
