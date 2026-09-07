import { afterEach, describe, expect, it, vi } from 'vitest'

type Result = { data: unknown; error: { message: string } | null }
let result: Result = { data: null, error: null }
let throwOnRead = false
const chain: Array<{ method: string; args: unknown[] }> = []
vi.mock('./supabase', () => ({
  supabase: {
    from: (_table: string) => {
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') {
              return (resolve: (v: Result) => void, reject: (e: unknown) => void) => {
                if (throwOnRead) return reject(new Error('network'))
                resolve(result)
              }
            }
            return (...args: unknown[]) => {
              chain.push({ method: String(prop), args })
              return p
            }
          },
        },
      )
      return p
    },
  },
}))

import { getExtraTxCountyMappings, setExtraTxCountyMappings, suggestTxCountyForCity } from './txCountyLookup'
import { applyExtraTxCountyMappingsText, loadAndApplyExtraTxCountyMappings } from './txCountySettings'

afterEach(() => {
  setExtraTxCountyMappings({})
  chain.length = 0
  throwOnRead = false
  result = { data: null, error: null }
})

describe('applyExtraTxCountyMappingsText', () => {
  it('parses the stored text straight into the lookup module', () => {
    applyExtraTxCountyMappingsText('Devine = Medina\nSchertz = Bexar')
    expect(getExtraTxCountyMappings()).toEqual({ devine: 'Medina', schertz: 'Bexar' })
    expect(suggestTxCountyForCity('Schertz')).toBe('Bexar')
  })
})

describe('loadAndApplyExtraTxCountyMappings', () => {
  it('reads the org row by its settings key and applies it', async () => {
    result = { data: { value_text: 'Devine = Medina' }, error: null }
    await loadAndApplyExtraTxCountyMappings()
    expect(chain.find((s) => s.method === 'eq')?.args).toEqual(['key', 'tx_county_extra_mappings_v1'])
    expect(chain.some((s) => s.method === 'maybeSingle')).toBe(true)
    expect(suggestTxCountyForCity('Devine')).toBe('Medina')
  })
  it('a missing row applies an empty map; a read error or a throw leaves the built-ins working', async () => {
    setExtraTxCountyMappings({ stale: 'Nowhere' })
    result = { data: null, error: null }
    await loadAndApplyExtraTxCountyMappings()
    expect(getExtraTxCountyMappings()).toEqual({})

    setExtraTxCountyMappings({ stale: 'Nowhere' })
    result = { data: null, error: { message: 'rls' } }
    await loadAndApplyExtraTxCountyMappings()
    expect(getExtraTxCountyMappings()).toEqual({ stale: 'Nowhere' }) // untouched on error

    throwOnRead = true
    await expect(loadAndApplyExtraTxCountyMappings()).resolves.toBeUndefined()
    expect(suggestTxCountyForCity('Kyle')).toBe('Hays')
  })
})
