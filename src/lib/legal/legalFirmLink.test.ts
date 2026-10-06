import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LEGAL_FIRM_LINK_KIND, LEGAL_FIRM_LINK_MAX_TO, legalFirmLinkAddresses, legalFirmLinkSentLine } from './legalFirmLink'

it('the function files its copy under the kind the card reads back', () => {
  expect(readFileSync('supabase/functions/legal-send-firm-link/index.ts', 'utf8')).toContain(`file: { kind: '${LEGAL_FIRM_LINK_KIND}', `)
})

describe('legalFirmLinkAddresses · v2.4624', () => {
  it('takes the address on file first, then each typed one, each once', () => {
    expect(legalFirmLinkAddresses({ onFile: 'ann@firm.example.com', useOnFile: true, typed: 'bo@firm.example.com, ANN@firm.example.com; cy@firm.example.com' })).toEqual({ emails: ['ann@firm.example.com', 'bo@firm.example.com', 'cy@firm.example.com'], error: null })
  })

  it('leaves the address on file out when it is not ticked', () => {
    expect(legalFirmLinkAddresses({ onFile: 'ann@firm.example.com', useOnFile: false, typed: 'bo@firm.example.com' }).emails).toEqual(['bo@firm.example.com'])
  })

  it('names the first address that is not an email', () => {
    expect(legalFirmLinkAddresses({ onFile: '', useOnFile: true, typed: 'bo@firm.example.com nope' })).toEqual({ emails: [], error: '“nope” is not an email address.' })
  })

  it('asks for an address when there is none, and holds the cap', () => {
    expect(legalFirmLinkAddresses({ onFile: '', useOnFile: true, typed: '  ' }).error).toBe('Pick the address on file or type one.')
    expect(legalFirmLinkAddresses({ onFile: 'a@x.co', useOnFile: true, typed: 'b@x.co c@x.co d@x.co' }).error).toBe(`Send to ${LEGAL_FIRM_LINK_MAX_TO} addresses at most.`)
  })
})

describe('legalFirmLinkSentLine · v2.4624', () => {
  const ymd = (iso: string) => iso.slice(0, 10)
  it('says nothing for a link not sent yet', () => {
    expect(legalFirmLinkSentLine([], ymd)).toBeNull()
  })

  it('reads the newest send, its addresses, its day and who sent it', () => {
    const line = legalFirmLinkSentLine(
      [
        { recipient_emails: ['ann@firm.example.com'], sent_at: '2026-10-01T15:00:00Z', sent_by_name: 'Taunya' },
        { recipient_emails: ['ann@firm.example.com', 'bo@firm.example.com'], sent_at: '2026-10-05T15:00:00Z', sent_by_name: 'Will' },
      ],
      ymd,
    )
    expect(line).toBe('Sent to ann@firm.example.com and bo@firm.example.com on 2026-10-05 by Will · sent 2 times')
  })

  it('reads a send with no sender name', () => {
    expect(legalFirmLinkSentLine([{ recipient_emails: ['ann@firm.example.com'], sent_at: '2026-10-05T15:00:00Z', sent_by_name: '' }], ymd)).toBe('Sent to ann@firm.example.com on 2026-10-05')
  })
})
