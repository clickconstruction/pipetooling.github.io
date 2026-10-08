/**
 * The tests of `gcSpanishVoice.test.ts` on branch spike/gc-mode that read only these kernels, moved word for word. The ones that read
 * the prototype's corpus stay there; `spanishVoice.direct.test.ts` scans main's portal words.
 */
import { describe, expect, it } from 'vitest'
import { buildingWord } from './buildingWords'
import { portalString } from './portalI18n'
import { TU_MARKERS, saysWord } from './spanishVoice'

describe('the Spanish voice', () => {
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
