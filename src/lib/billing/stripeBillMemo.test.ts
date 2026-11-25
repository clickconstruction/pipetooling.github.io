/**
 * The memo a Stripe bill carries (punch list #343): the face of the bill and the made bill read one rule.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { stripeBillMemoWithServiceAddress } from '../../../supabase/functions/_shared/stripeBillMemo'

describe('stripeBillMemoWithServiceAddress', () => {
  it('leads with the service address, then a blank line, then the office memo', () => {
    expect(stripeBillMemoWithServiceAddress('100 Sample St, Austin, TX', 'Mail checks to PO Box 1.')).toBe('Service address: 100 Sample St, Austin, TX\n\nMail checks to PO Box 1.')
  })

  it('an address with no memo is the address line alone, and a memo with no address is the memo alone', () => {
    expect(stripeBillMemoWithServiceAddress(' 100 Sample St ', '')).toBe('Service address: 100 Sample St')
    expect(stripeBillMemoWithServiceAddress(null, '  Net 30.  ')).toBe('Net 30.')
    expect(stripeBillMemoWithServiceAddress('   ', 'Net 30.')).toBe('Net 30.')
  })

  it('nothing to say is null, so the bill carries no memo', () => {
    expect(stripeBillMemoWithServiceAddress(null, null)).toBeNull()
    expect(stripeBillMemoWithServiceAddress('', '  ')).toBeNull()
  })

  it('the function that makes the bill writes the same line the face reads', () => {
    const fn = readFileSync('supabase/functions/create-stripe-invoice/index.ts', 'utf8')
    const usesKernel = fn.includes('stripeBillMemoWithServiceAddress(')
    const writesItInline = fn.includes('`Service address: ${addr}`') && fn.includes(".join('\\n\\n')")
    expect(usesKernel || writesItInline).toBe(true)
  })
})
