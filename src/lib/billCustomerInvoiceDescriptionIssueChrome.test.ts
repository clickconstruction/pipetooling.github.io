import { describe, expect, it } from 'vitest'
import type { CSSProperties } from 'react'
import { mergeBillCustomerInvoiceDescriptionIssueChrome } from './billCustomerInvoiceDescriptionIssueChrome'

describe('mergeBillCustomerInvoiceDescriptionIssueChrome', () => {
  const base: CSSProperties = {
    flex: '1 1 auto',
    minWidth: 0,
    padding: '0.35rem 0.45rem',
  }

  it('returns base unchanged when flagged is false', () => {
    const out = mergeBillCustomerInvoiceDescriptionIssueChrome(base, false)
    expect(out).toEqual(base)
    expect(out).not.toHaveProperty('background')
  })

  it('merges issue chrome onto base when flagged is true', () => {
    const out = mergeBillCustomerInvoiceDescriptionIssueChrome(base, true)
    expect(out).toEqual({
      ...base,
      background: 'var(--bg-red-tint)',
      borderTop: '1px solid var(--border-red)',
      borderBottom: '1px solid var(--border-red)',
      borderLeft: '3px solid #dc2626',
      borderRight: '1px solid var(--border-red)',
    })
  })
})
