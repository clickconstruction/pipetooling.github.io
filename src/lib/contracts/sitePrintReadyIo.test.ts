/**
 * Whether the signer's page can show a site's address (punch list #439, part 3e): the app asks the signer's function
 * for its sample paper and reads whether the answer knows the rule. A yes is kept, a no is asked again.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { forgetSignerPageShowsSite, readSignerPageShowsSite } from './sitePrintReadyIo'

let reply: { status: number; body: unknown } = { status: 200, body: {} }
const asked: string[] = []

beforeEach(() => {
  asked.length = 0
  forgetSignerPageShowsSite()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      asked.push(String(url))
      return new Response(JSON.stringify(reply.body), { status: reply.status })
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

describe('readSignerPageShowsSite', () => {
  it('asks the signer’s function for its sample paper, and nothing else', async () => {
    reply = { status: 200, body: { id: 'sample', document_name: 'Sample agreement', site_address: null } }
    expect(await readSignerPageShowsSite()).toBe(true)
    expect(asked).toHaveLength(1)
    expect(asked[0]).toMatch(/\/functions\/v1\/get-contract-for-signer\?token=sample$/)
  })

  it('is no for a function older than the box, and asks again the next time', async () => {
    reply = { status: 200, body: { id: 'sample', document_name: 'Sample agreement' } }
    expect(await readSignerPageShowsSite()).toBe(false)
    expect(await readSignerPageShowsSite()).toBe(false)
    expect(asked).toHaveLength(2)
    // The function is deployed: the next look says yes.
    reply = { status: 200, body: { id: 'sample', site_address: null } }
    expect(await readSignerPageShowsSite()).toBe(true)
  })

  it('keeps a yes for the session', async () => {
    reply = { status: 200, body: { site_address: null } }
    expect(await readSignerPageShowsSite()).toBe(true)
    reply = { status: 500, body: { error: 'Internal error' } }
    expect(await readSignerPageShowsSite()).toBe(true)
    expect(asked).toHaveLength(1)
  })

  it('throws when the function does not answer with a paper', async () => {
    reply = { status: 500, body: { error: 'Internal error' } }
    await expect(readSignerPageShowsSite()).rejects.toThrow('The signer’s page answered 500.')
  })
})
