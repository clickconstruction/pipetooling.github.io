import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { framesWaitingLine as appWaiting, signerNamesLine as appLine } from './jobContractSigners'
import { framesWaitingLine as edgeWaiting, signerNamesLine as edgeLine } from '../../../supabase/functions/_shared/jobContractSigners'

/** The edge functions name signers with the app's words (v2.4590): one file, two copies. */
describe('jobContractSigners app twin ≡ _shared', () => {
  it('the two files are byte-identical', () => {
    const app = readFileSync(fileURLToPath(new URL('./jobContractSigners.ts', import.meta.url)), 'utf8')
    const edge = readFileSync(fileURLToPath(new URL('../../../supabase/functions/_shared/jobContractSigners.ts', import.meta.url)), 'utf8')
    expect(edge).toBe(app)
  })

  it('and they say the same thing', () => {
    const half = { recipient_name: 'Sam Owner', signer_printed_name: 'Sam Owner', signer_consented_at: '2026-09-21T14:29:00Z', signed_at: null, co_signer_name: 'Alex Owner' }
    const both = { ...half, signed_at: '2026-09-21T15:00:00Z', co_signed_at: '2026-09-21T15:00:00Z', co_signer_printed_name: 'Alex Owner' }
    for (const row of [half, both]) {
      expect(edgeLine(row)).toBe(appLine(row))
      expect(edgeWaiting(row)).toBe(appWaiting(row))
    }
  })
})
