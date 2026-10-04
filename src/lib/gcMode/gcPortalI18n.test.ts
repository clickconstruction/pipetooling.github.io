/**
 * GC mode — design spike: the portal's English and Spanish words (gcPortalI18n.ts). Every key has
 * both languages with the same blanks, and what the portal writes in Spanish leaves no blank unfilled.
 */
import { describe, expect, it } from 'vitest'
import {
  gcReducer,
  initialGcState,
  pDate,
  PORTAL_KEYS,
  portalHome,
  portalMessages,
  portalPromiseLine,
  portalString,
  pt,
  pWeekday,
} from './gcModel'

const blanks = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('the portal in two languages', () => {
  it('has English and Spanish for every key, with the same blanks', () => {
    const wrong = PORTAL_KEYS.filter((key) => {
      const { en, es } = portalString(key)
      return en.trim() === '' || es.trim() === '' || blanks(en).join() !== blanks(es).join()
    })
    expect(wrong).toEqual([])
  })

  it('fills the blanks', () => {
    expect(pt('es', 'todoDraw', { gc: 'Click', amount: '$92,000', project: 'Fair Oaks' })).toBe('Puede pedirle a Click $92,000 de Fair Oaks.')
  })

  it('writes dates the Spanish way', () => {
    expect(pDate('es', '2026-10-08')).toBe('8 oct')
    expect(pWeekday('es', '2026-10-08')).toBe('jue 8 oct')
    expect(pWeekday('en', '2026-10-08')).toBe('Thu Oct 8')
  })

  const state = initialGcState()
  const companies = state.partners.map((p) => p.id)

  it('leaves no blank unfilled on any company home in Spanish', () => {
    const left = companies.flatMap((id) => portalHome(state, id, 'es').todos.map((t) => t.text)).filter((text) => /\{\w+\}/.test(text))
    expect(left).toEqual([])
  })

  it('leaves no blank unfilled in any message in Spanish', () => {
    const left = companies
      .flatMap((id) => portalMessages(state, id, 'es').flatMap((m) => [m.subject, ...m.lines]))
      .filter((text) => /\{\w+\}/.test(text))
    expect(left).toEqual([])
  })

  it('tells Voltage what needs it in Spanish', () => {
    expect(portalHome(state, 'voltage', 'es').todos.map((t) => t.text)).toEqual([
      'Cambiaron los planos de Electrical en Boerne Retail Shell. Confirme su precio o cámbielo.',
      'Su seguro venció el 15 sep. Envíe un certificado nuevo.',
    ])
  })

  it('writes the invitation in Spanish, by email', () => {
    const invite = portalMessages(state, 'voltage', 'es').find((m) => m.kind === 'invite' && m.projectId === 'boerne')
    expect(invite?.subject).toBe('Click Construction lo invita a cotizar Electrical en Boerne Retail Shell')
    expect(invite?.lines).toContain('Su precio vence el jue 8 oct.')
  })

  it('reads a passed promise in Spanish', () => {
    const invite = state.projects.find((p) => p.id === 'boerne')?.packages.find((k) => k.id === 'site')?.invites.find((i) => i.partnerId === 'hillside')
    if (!invite) throw new Error('no ask')
    expect(portalPromiseLine(invite, state.today, 'Click', 'es')?.text).toBe(
      'Le dijo a Click que su precio llegaría a más tardar el mié 30 sep. Esa fecha pasó hace 2 días. Envíe su precio o dé un nuevo día.',
    )
  })

  it('keeps the company’s language on its record, and sends its messages in it', () => {
    const spanish = gcReducer(state, { type: 'tradeSetLanguage', partnerId: 'hillside', lang: 'es' })
    expect(spanish.partners.find((p) => p.id === 'hillside')?.lang).toBe('es')
    expect(spanish.log[0]?.text).toBe('Hillside Excavation chose Spanish for its portal and messages.')
    expect(portalMessages(spanish, 'hillside')[0]?.lines[0]).toBe('Hola Greg:')
    expect(portalMessages(state, 'hillside')[0]?.lines[0]).toBe('Hello Greg,')
    expect(gcReducer(spanish, { type: 'tradeSetLanguage', partnerId: 'hillside', lang: 'es' })).toBe(spanish)
  })

  it('lets the office set a company’s language, on the same record', () => {
    const set = gcReducer(state, { type: 'setPartnerLanguage', partnerId: 'comal', lang: 'es' })
    expect(set.partners.find((p) => p.id === 'comal')?.lang).toBe('es')
    expect(set.log[0]).toMatchObject({ who: 'office', text: "Set Comal Iron's language to Spanish: its portal and messages." })
    expect(portalMessages(set, 'comal')[0]?.lines[0]).toBe('Hola Ray:')
    expect(gcReducer(set, { type: 'setPartnerLanguage', partnerId: 'comal', lang: 'es' })).toBe(set)
  })
})
