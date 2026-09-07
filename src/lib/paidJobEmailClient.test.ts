import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Client helpers for the paid-job-email edge function (preview, test send,
 * test push, real send) shared by the Stages "Paid notifications" modal and
 * the Job Detail ✉ modal. Pins each mode's body, the result reading, and the
 * error text — which must come from the function's response body, not
 * supabase-js's generic non-2xx message.
 */
const invoke = vi.fn(async (_name: string, _opts: unknown): Promise<{ data: unknown; error: unknown }> => ({ data: {}, error: null }))
vi.mock('./supabase', () => ({ supabase: { functions: { invoke: (name: string, opts: unknown) => invoke(name, opts) } } }))

import { fetchPaidJobEmailPreview, openHtmlInNewTab, sendPaidJobEmailTest, sendPaidJobEmailTo, sendReadyToBillPushTest } from './paidJobEmailClient'

const body = () => (invoke.mock.calls[0]![1] as { body: unknown }).body
const httpError = (json: unknown) => ({ message: 'Edge Function returned a non-2xx status code', context: new Response(JSON.stringify(json), { status: 400 }) })

beforeEach(() => {
  invoke.mockClear()
  invoke.mockResolvedValue({ data: {}, error: null })
})

describe('openHtmlInNewTab', () => {
  const write = vi.fn()
  const close = vi.fn()
  const open = vi.fn()
  const createObjectURL = vi.fn(() => 'blob:fake')
  const revokeObjectURL = vi.fn()
  beforeEach(() => {
    write.mockClear()
    close.mockClear()
    open.mockReset()
    createObjectURL.mockClear()
    revokeObjectURL.mockClear()
    ;(globalThis as unknown as { window: unknown }).window = { open }
    ;(globalThis as unknown as { URL: unknown }).URL = Object.assign(URL, { createObjectURL, revokeObjectURL })
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())
  it('writes the HTML into a fresh tab when one opens', () => {
    open.mockReturnValueOnce({ document: { write, close } })
    openHtmlInNewTab('<p>hi</p>')
    expect(open).toHaveBeenCalledWith('', '_blank')
    expect(write).toHaveBeenCalledWith('<p>hi</p>')
    expect(close).toHaveBeenCalledTimes(1)
    expect(createObjectURL).not.toHaveBeenCalled()
  })
  it('falls back to a Blob URL when the popup is blocked, revoking it a minute later', () => {
    open.mockReturnValueOnce(null)
    openHtmlInNewTab('<p>hi</p>')
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect((createObjectURL.mock.calls[0]! as unknown[])[0]).toBeInstanceOf(Blob)
    expect(open).toHaveBeenLastCalledWith('blob:fake', '_blank')
    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60_000)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake')
  })
})

describe('fetchPaidJobEmailPreview', () => {
  it('asks for a preview of the variant (paid by default, Ready to Bill when asked) and returns the HTML', async () => {
    invoke.mockResolvedValueOnce({ data: { html: '<p>paid</p>' }, error: null })
    expect(await fetchPaidJobEmailPreview('j1', 'detailed')).toBe('<p>paid</p>')
    expect(invoke).toHaveBeenCalledWith('paid-job-email', { body: { mode: 'preview', job_id: 'j1', variant: 'detailed' } })
    invoke.mockClear()
    invoke.mockResolvedValueOnce({ data: { html: '<p>rtb</p>' }, error: null })
    expect(await fetchPaidJobEmailPreview('j1', 'summary', 'ready_to_bill')).toBe('<p>rtb</p>')
    expect(body()).toEqual({ mode: 'preview', job_id: 'j1', variant: 'summary', kind: 'ready_to_bill' })
  })
  it('surfaces the function’s own error text — from the response body on a non-2xx, from the data on a 2xx — else the generic message, else the fallback; and refuses an empty preview', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: httpError({ error: 'Job has no customer email' }) })
    await expect(fetchPaidJobEmailPreview('j1', 'detailed')).rejects.toThrow('Job has no customer email')
    invoke.mockResolvedValueOnce({ data: null, error: httpError('not json at all') })
    await expect(fetchPaidJobEmailPreview('j1', 'detailed')).rejects.toThrow('Edge Function returned a non-2xx status code')
    invoke.mockResolvedValueOnce({ data: null, error: { message: '' } })
    await expect(fetchPaidJobEmailPreview('j1', 'detailed')).rejects.toThrow('Preview failed')
    invoke.mockResolvedValueOnce({ data: { error: 'Template missing' }, error: null })
    await expect(fetchPaidJobEmailPreview('j1', 'detailed')).rejects.toThrow('Template missing')
    invoke.mockResolvedValueOnce({ data: { html: '' }, error: null })
    await expect(fetchPaidJobEmailPreview('j1', 'detailed')).rejects.toThrow('Preview returned no HTML')
  })
})

describe('test sends', () => {
  it('a test email goes to the caller by default, or to a chosen user for Ready to Bill', async () => {
    await sendPaidJobEmailTest('j1')
    expect(body()).toEqual({ mode: 'test_send', job_id: 'j1' })
    invoke.mockClear()
    await sendPaidJobEmailTest('j1', 'ready_to_bill', 'u2')
    expect(body()).toEqual({ mode: 'test_send', job_id: 'j1', kind: 'ready_to_bill', recipient_user_id: 'u2' })
    invoke.mockResolvedValueOnce({ data: { error: 'No address on file' }, error: null })
    await expect(sendPaidJobEmailTest('j1')).rejects.toThrow('No address on file')
    invoke.mockResolvedValueOnce({ data: null, error: { message: '' } })
    await expect(sendPaidJobEmailTest('j1')).rejects.toThrow('Test send failed')
  })
  it('a test push reports how many devices it reached, zero when the function says nothing', async () => {
    invoke.mockResolvedValueOnce({ data: { push_sent: 3 }, error: null })
    expect(await sendReadyToBillPushTest('j1', 'u2')).toBe(3)
    expect(body()).toEqual({ mode: 'test_push', job_id: 'j1', recipient_user_id: 'u2' })
    invoke.mockResolvedValueOnce({ data: {}, error: null })
    expect(await sendReadyToBillPushTest('j1')).toBe(0)
    invoke.mockResolvedValueOnce({ data: null, error: { message: '' } })
    await expect(sendReadyToBillPushTest('j1')).rejects.toThrow('Test push failed')
  })
})

describe('sendPaidJobEmailTo', () => {
  it('sends the real email to a chosen user and reports which variant their role got', async () => {
    invoke.mockResolvedValueOnce({ data: { variant: 'summary' }, error: null })
    expect(await sendPaidJobEmailTo('j1', 'u2')).toBe('summary')
    expect(body()).toEqual({ mode: 'send_to', job_id: 'j1', recipient_user_id: 'u2' })
    invoke.mockResolvedValueOnce({ data: { variant: 'detailed' }, error: null })
    expect(await sendPaidJobEmailTo('j1', 'u2')).toBe('detailed')
    invoke.mockResolvedValueOnce({ data: {}, error: null })
    expect(await sendPaidJobEmailTo('j1', 'u2')).toBe('detailed')
    invoke.mockResolvedValueOnce({ data: null, error: httpError({ error: 'Recipient has no email' }) })
    await expect(sendPaidJobEmailTo('j1', 'u2')).rejects.toThrow('Recipient has no email')
    invoke.mockResolvedValueOnce({ data: null, error: { message: '' } })
    await expect(sendPaidJobEmailTo('j1', 'u2')).rejects.toThrow('Send failed')
  })
})
