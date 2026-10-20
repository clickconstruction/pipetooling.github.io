import { describe, expect, it } from 'vitest'
import { docsmitSecretStatusWords, sha512Hex } from './docsmitSecrets'

describe('Docsmit’s secrets from the Developer block (the Docsmit train, PR 9)', () => {
  it('hashes the password as Docsmit takes it: lowercase SHA-512 hex', async () => {
    expect(await sha512Hex('abc')).toBe('ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f')
    expect(await sha512Hex('')).toHaveLength(128)
  })

  it('says what is set, from where, and which Docsmit, never a value', () => {
    expect(docsmitSecretStatusWords(null)).toBe('Not read yet.')
    const s = { ready: true, set: { DOCSMIT_EMAIL: true, DOCSMIT_PASSWORD_SHA512: true, DOCSMIT_SOFTWARE_ID: true, DOCSMIT_BASE_URL: false }, source: { DOCSMIT_EMAIL: 'vault' as const, DOCSMIT_PASSWORD_SHA512: 'vault' as const, DOCSMIT_SOFTWARE_ID: 'env' as const, DOCSMIT_BASE_URL: 'none' as const }, email: 'bids@clickplumbing.com', base_url: 'https://secure.tracksmit.com/api/v1', env: 'tracksmit' as const }
    expect(docsmitSecretStatusWords(s)).toBe('Ready: email set (vault), password set (vault), software id set (env) · Tracksmit, the sandbox · bids@clickplumbing.com')
    expect(docsmitSecretStatusWords({ ...s, ready: false, set: { ...s.set, DOCSMIT_PASSWORD_SHA512: false }, env: 'prod' })).toBe('Not ready: email set (vault), password missing, software id set (env) · the live Docsmit · bids@clickplumbing.com')
  })
})
