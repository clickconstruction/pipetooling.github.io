import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  askLegalConfirmCap,
  LEGAL_CONFIRMS_PER_FIRM_PER_HOUR,
  LEGAL_CONFIRMS_PER_PERSON_PER_HOUR,
  legalConfirmCapKeys,
  legalConfirmCapProblem,
  legalConfirmTwinMessage,
} from '../../../supabase/functions/_shared/legalPortalActs'
import { firmFacingErrorLine } from '../../../supabase/functions/_shared/legalPortalErrors'

/** The throttle as the tests need it: a count per key for the hour, and how many times each key was recorded. */
function throttle(start: Record<string, number> = {}) {
  const counts = new Map(Object.entries(start))
  const count = async (key: string, record: boolean): Promise<number> => {
    if (record) counts.set(key, (counts.get(key) ?? 0) + 1)
    return counts.get(key) ?? 0
  }
  return { counts, count }
}

const FIRM = 'f1'
const ANN = 'r-ann'
const keys = legalConfirmCapKeys(FIRM, ANN)

describe('the cap on confirmation emails (punch list #85, a review residual)', () => {
  it('a person is sent three in an hour and a firm twenty-four, and each refusal says which', () => {
    expect(LEGAL_CONFIRMS_PER_PERSON_PER_HOUR).toBe(3)
    expect(LEGAL_CONFIRMS_PER_FIRM_PER_HOUR).toBe(24)
    expect(legalConfirmCapProblem({ toPerson: 2, fromFirm: 23 }, 'ann@firm.example.com')).toBeNull()
    expect(legalConfirmCapProblem({ toPerson: 3, fromFirm: 0 }, 'ann@firm.example.com')).toBe('3 confirmation emails to ann@firm.example.com in the last hour is the limit. Try again in an hour.')
    expect(legalConfirmCapProblem({ toPerson: 0, fromFirm: 24 }, 'ann@firm.example.com')).toBe('24 confirmation emails to your firm in the last hour is the limit. Try again in an hour.')
    // Both reached: the person's limit is the one said.
    expect(legalConfirmCapProblem({ toPerson: 3, fromFirm: 24 }, 'ann@firm.example.com')).toMatch(/^3 confirmation emails to ann@/)
    expect(legalConfirmCapProblem({ toPerson: 3, fromFirm: 0 }, ' ')).toMatch(/to this person in the last hour/)
  })

  it('keeps a key for the person and a key for the firm that no caller’s address can equal', () => {
    expect(keys).toEqual({ firm: 'confirm-firm:f1', person: 'confirm:r-ann' })
    expect(legalConfirmCapKeys(FIRM, null)).toEqual({ firm: 'confirm-firm:f1', person: null })
  })

  it('the first three to a person go and the fourth is refused in words', async () => {
    const t = throttle()
    for (let i = 0; i < 3; i++) expect(await askLegalConfirmCap(t.count, FIRM, ANN, 'ann@firm.example.com')).toBeNull()
    expect(await askLegalConfirmCap(t.count, FIRM, ANN, 'ann@firm.example.com')).toBe('3 confirmation emails to ann@firm.example.com in the last hour is the limit. Try again in an hour.')
    // Another person at the same firm is not held by Ann's limit.
    expect(await askLegalConfirmCap(t.count, FIRM, 'r-bo', 'bo@firm.example.com')).toBeNull()
  })

  it('a refused press is not counted, so pressing again cannot push the hour out', async () => {
    const t = throttle({ [keys.person!]: 3, [keys.firm]: 3 })
    for (let i = 0; i < 5; i++) expect(await askLegalConfirmCap(t.count, FIRM, ANN, 'ann@firm.example.com')).not.toBeNull()
    expect(t.counts.get(keys.person!)).toBe(3)
    expect(t.counts.get(keys.firm)).toBe(3)
  })

  it('the firm’s limit holds an add, which has no person to count yet', async () => {
    const t = throttle({ [keys.firm]: 23 })
    expect(await askLegalConfirmCap(t.count, FIRM, null, 'new@firm.example.com')).toBeNull()
    expect(t.counts.get(keys.firm)).toBe(24)
    expect(await askLegalConfirmCap(t.count, FIRM, null, 'next@firm.example.com')).toBe('24 confirmation emails to your firm in the last hour is the limit. Try again in an hour.')
    expect([...t.counts.keys()]).toEqual([keys.firm])
  })

  it('of ten presses that ask in the same instant, three go', async () => {
    // Every press reads the count before any press records: the first step passes all ten, the second holds seven.
    const counts = new Map<string, number>()
    const waiting: Array<() => void> = []
    let asked = 0
    const count = async (key: string, record: boolean): Promise<number> => {
      if (!record) {
        asked++
        await new Promise<void>((go) => waiting.push(go))
        return 0
      }
      counts.set(key, (counts.get(key) ?? 0) + 1)
      return counts.get(key) ?? 0
    }
    const presses = Array.from({ length: 10 }, () => askLegalConfirmCap(count, FIRM, ANN, 'ann@firm.example.com'))
    while (asked < 20) await new Promise((r) => setTimeout(r, 0))
    waiting.forEach((go) => go())
    const answers = await Promise.all(presses)
    expect(answers.filter((a) => a === null)).toHaveLength(3)
    expect(answers.filter((a) => a !== null).every((a) => a!.startsWith('3 confirmation emails to ann@'))).toBe(true)
  })

  it('a throttle that cannot answer reads as none, so the portal never closes on it', async () => {
    // askGuessGate answers zero when the count is missing or fails.
    expect(await askLegalConfirmCap(async () => 0, FIRM, ANN, 'ann@firm.example.com')).toBeNull()
  })

  it('the page draws each refusal as it is written, and none reads as a failure of the system', () => {
    const capped = legalConfirmCapProblem({ toPerson: 3, fromFirm: 0 }, 'ann@firm.example.com')!
    expect(firmFacingErrorLine(429, { error: capped })).toBe(capped)
    const twin = legalConfirmTwinMessage('ann@firm.example.com')
    expect(twin).toBe('A confirmation email to ann@firm.example.com went a moment ago. Check that inbox before sending another.')
    expect(firmFacingErrorLine(409, { error: twin })).toBe(twin)
    for (const words of [capped, twin, legalConfirmCapProblem({ toPerson: 0, fromFirm: 24 }, 'x@y.example.com')!]) expect(words).not.toMatch(/[—–;()]/)
  })
})

describe('submit-legal-portal holds both acts to the cap', () => {
  const src = readFileSync('supabase/functions/submit-legal-portal/index.ts', 'utf8')
  const add = src.slice(src.indexOf("if (kind === 'recipient_add')"), src.indexOf('const rid = str(body.recipientId'))
  const resend = src.slice(src.indexOf('// recipient_resend'), src.indexOf("if (!matterId) return jsonResponse({ error: 'Missing matter' }"))

  it('an add asks before the person is written, and a capped add answers 429 with the words', () => {
    const ask = add.indexOf('askLegalConfirmCap(countConfirms, link.firm_id, null, email)')
    expect(ask).toBeGreaterThan(-1)
    expect(ask).toBeLessThan(add.indexOf(".insert({ firm_id: link.firm_id"))
    expect(add).toContain('if (capped) return jsonResponse({ error: capped }, 429)')
    // The add's own email is the new person's first of the hour.
    expect(add).toContain('await countConfirms(legalConfirmCapKeys(link.firm_id, newId).person!, true)')
  })

  it('a resend asks for the person and the firm before anything is sent', () => {
    const ask = resend.indexOf('askLegalConfirmCap(countConfirms, link.firm_id, r.id, r.email)')
    expect(ask).toBeGreaterThan(-1)
    expect(ask).toBeLessThan(resend.indexOf('sendConfirm('))
    expect(resend).toContain('if (capped) return jsonResponse({ error: capped }, 429)')
    expect(resend).toContain("if (sent === 'twin') return jsonResponse({ error: legalConfirmTwinMessage(r.email) }, 409)")
  })

  it('the count is the portal’s own throttle, and the new link is written only over the one this call read', () => {
    expect(src).toContain('(await askGuessGate(admin, key, record)).misses')
    expect(src).toContain("(prevHash ? swap.eq('confirm_token_hash', prevHash) : swap.is('confirm_token_hash', null)).select('id')")
    expect(src).toContain("if (!swapErr && ((won ?? []) as unknown[]).length === 0) return 'twin'")
    // Nothing is sent before the swap is won.
    const send = src.slice(src.indexOf('const sendConfirm = async'), src.indexOf("if (kind === 'recipient_add')"))
    expect(send.indexOf("return 'twin'")).toBeLessThan(send.indexOf('sendEmailViaResend('))
  })
})
