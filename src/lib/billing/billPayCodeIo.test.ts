import { beforeEach, describe, expect, it, vi } from 'vitest'
import { billPayCode, forgetBillPayCodes, payCodeFromAnswer } from './billPayCodeIo'

const ID = '8f3c2a1e-6b7d-4c9a-9e21-5d0f7a3b1c44'

describe('billPayCode — the bill’s short code, asked once', () => {
  beforeEach(() => forgetBillPayCodes())

  it('asks bill_pay_code once per bill and hands the code back lower-cased', async () => {
    const rpc = vi.fn(async () => ({ data: 'ABC2DEF3GH', error: null }))
    expect(await billPayCode(ID, { rpc })).toBe('abc2def3gh')
    expect(await billPayCode(ID.toUpperCase(), { rpc })).toBe('abc2def3gh')
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('bill_pay_code', { p_invoice_id: ID })
  })

  it('a refusal or a bad answer is null, not cached, and never thrown', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: 'Only the office can make a bill’s link.' } }))
    expect(await billPayCode(ID, { rpc })).toBeNull()
    expect(await billPayCode(ID, { rpc })).toBeNull()
    expect(rpc).toHaveBeenCalledTimes(2)
    const throwing = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(await billPayCode(ID, { rpc: throwing })).toBeNull()
  })

  it('never asks for something that is not a bill id', async () => {
    const rpc = vi.fn(async () => ({ data: 'abc2def3gh', error: null }))
    expect(await billPayCode('inv-1', { rpc })).toBeNull()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('payCodeFromAnswer keeps only a ten-letter code', () => {
    expect(payCodeFromAnswer({ data: 'abc2def3gh', error: null })).toBe('abc2def3gh')
    expect(payCodeFromAnswer({ data: 'abc1def0gh', error: null })).toBeNull()
    expect(payCodeFromAnswer({ data: 'abc2def3gh', error: { message: 'x' } })).toBeNull()
    expect(payCodeFromAnswer({ data: 42, error: null })).toBeNull()
  })
})
