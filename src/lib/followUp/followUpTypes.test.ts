import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ContactFollowUpRow as FromRows } from './followUpRows'
import type { ContactFollowUpRow } from './followUpTypes'

describe('followUpTypes.ts', () => {
  it('imports nothing, so the edge copy of the kernels can take its types', () => {
    const source = readFileSync(join(__dirname, 'followUpTypes.ts'), 'utf8')
    expect(source).not.toMatch(/^\s*(?:import|export)\b[^\n]*\bfrom\s*['"]/m)
  })

  it('is the row followUpRows.ts re-exports', () => {
    const row: ContactFollowUpRow = { state: 'waiting', snoozed_until: null, has_user_id: 'u-luis', has_since: '2026-10-12T14:04:00Z', has_how: 'rule' }
    const same: FromRows = row
    expect(same).toBe(row)
  })
})
