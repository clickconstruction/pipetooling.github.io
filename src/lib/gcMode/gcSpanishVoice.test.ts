/**
 * The Spanish voice (round five; mock-up `to-dos/gc-mode/mockups/spanish-voice.md`): one word for
 * each thing a trade reads about. Every Spanish string a trade can read, the same ones
 * PORTAL_SPANISH.md lists, is scanned for the words retired and kept out and for the tú forms,
 * as whole words, ignoring case and accents.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { SPANISH_TERMS, TU_MARKERS, offWords, saysWord, spanishCorpus } from './gcSpanishVoice'
import { portalString } from './gcPortalI18n'
import { buildingWord } from './gcBuildingWords'

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const corpus = spanishCorpus((file) => readFileSync(resolve(ROOT, file), 'utf8'))

describe('the Spanish voice', () => {
  it('reads every string the list does, each with its English and its Spanish', () => {
    expect(corpus.length).toBeGreaterThan(900)
    expect(corpus.filter((r) => !r.en.trim() || !r.es.trim())).toEqual([])
  })

  it('no string says a retired word, a word kept out or a tú form', () => {
    const found = corpus.flatMap((r) => offWords(r.es).map((o) => `${r.en} → "${o.word}" (${o.term}, ${o.why}): ${r.es}`))
    expect(found).toEqual([])
  })

  it('each one word is in use, but the one kept for when it comes', () => {
    const unused = SPANISH_TERMS.filter((t) => !t.notYet && !corpus.some((r) => (t.seen ?? [t.es]).some((w) => saysWord(r.es, w)))).map((t) => t.en)
    expect(unused).toEqual([])
    expect(SPANISH_TERMS.filter((t) => t.notYet).map((t) => t.en)).toEqual(['the dates to meet'])
  })

  it('where the short word stays for another sense, the strings about the thing say the one word', () => {
    // Cambio stays for a change a trade asks for; certificado once seguro is named; so these are pinned by name.
    expect(buildingWord('signChange').es).toBe('Firmar la orden de cambio')
    expect(portalString('term3').es).toContain('una orden de cambio por escrito')
    expect(portalString('sendCert').es).toBe('Enviar su certificado de seguro')
    expect(portalString('certFile').es).toBe('Una foto o PDF del certificado de seguro')
    expect(portalString('reasonCrew').es).toBe('cuadrilla')
  })

  it('the scan reads whole words, ignoring case and accents', () => {
    expect(saysWord('Su BITÁCORA de obra', 'bitácora')).toBe(true)
    expect(saysWord('Su bitacora', 'bitácora')).toBe(true)
    expect(saysWord('Dos retrasos', 'retraso')).toBe(true)
    expect(saysWord('Nada facturado todavía', 'factura')).toBe(false)
    expect(saysWord('Las facturas', 'factura')).toBe(true)
    expect(saysWord('Estas semanas', 'tu')).toBe(false)
    expect(saysWord('¿Puedes enviarla?', 'puedes')).toBe(true)
    // Estás is not scanned: without its accent it is estas, "these", which the portal says.
    expect(TU_MARKERS).not.toContain('estás')
  })
})
