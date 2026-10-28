import { describe, expect, it } from 'vitest'
import { KEPT_READ_SCHEMA } from './keptRead'
import { clearKeptReads, readKeptRead, writeKeptRead } from './keptReadStore'

/**
 * The store is best-effort (#183 PR 2, v2.6031): with no IndexedDB, as in this node suite, a
 * private window or an old WebView, every call resolves quietly and the page loads as it always
 * did. The IndexedDB path itself is walked live on the dev server (the fragment's Verified).
 */
describe('keptReadStore without IndexedDB', () => {
  it('reads nothing, writes nowhere and clears nothing, and never throws', async () => {
    expect(typeof indexedDB).toBe('undefined')
    await expect(readKeptRead('u1:pipeline:all')).resolves.toBeNull()
    await expect(writeKeptRead({ key: 'u1:pipeline:all', schema: KEPT_READ_SCHEMA, scopes: [], readAt: 1, rows: [] })).resolves.toBeUndefined()
    await expect(clearKeptReads()).resolves.toBeUndefined()
  })
})
