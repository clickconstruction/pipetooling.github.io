import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DatabaseError, databaseErrorFromResult, formatErrorMessage } from '../../utils/errorHandling'
import { plainWordsFailures } from '../plainWords'
import {
  PAPER_HOLDER_NAMING_CODE,
  PAPER_HOLDER_NAMING_NEXT,
  PAPER_HOLDER_NAMING_REASON,
  PAPER_HOLDER_NAMING_WORDS,
  paperHolderNamingRefusal,
} from './paperHolderNaming'

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261123184149_estimator_reach.sql'), 'utf8')

describe('naming a contact that holds a paper', () => {
  it('finds the refusal on the error the app throws, on a plain Supabase error and on a string', () => {
    const fromDb = { code: '42501', message: PAPER_HOLDER_NAMING_CODE, details: PAPER_HOLDER_NAMING_REASON }
    expect(paperHolderNamingRefusal(databaseErrorFromResult(fromDb, 'name the number'))).toBe(PAPER_HOLDER_NAMING_WORDS)
    expect(paperHolderNamingRefusal(fromDb)).toBe(PAPER_HOLDER_NAMING_WORDS)
    expect(paperHolderNamingRefusal(new Error(`Failed to add them to the list: ${PAPER_HOLDER_NAMING_CODE}`))).toBe(PAPER_HOLDER_NAMING_WORDS)
    expect(paperHolderNamingRefusal(PAPER_HOLDER_NAMING_CODE)).toBe(PAPER_HOLDER_NAMING_WORDS)
  })

  it('finds it when only the details carry the code', () => {
    expect(paperHolderNamingRefusal(new DatabaseError('Failed to name the number', '42501', PAPER_HOLDER_NAMING_CODE))).toBe(PAPER_HOLDER_NAMING_WORDS)
  })

  it('leaves every other failure to its own words', () => {
    expect(paperHolderNamingRefusal({ code: 'P0001', message: 'namedAlready', details: 'This contact is named already.' })).toBeNull()
    expect(paperHolderNamingRefusal(new Error('Failed to fetch'))).toBeNull()
    expect(paperHolderNamingRefusal(null)).toBeNull()
    expect(paperHolderNamingRefusal(undefined)).toBeNull()
    expect(paperHolderNamingRefusal(42)).toBeNull()
  })

  it('reads as words through the app’s own error words', () => {
    const refused = new Error(PAPER_HOLDER_NAMING_WORDS)
    expect(formatErrorMessage(refused, 'The number was not named.')).toBe(PAPER_HOLDER_NAMING_WORDS)
  })

  it('says the reason and the next step in plain words', () => {
    expect(PAPER_HOLDER_NAMING_WORDS).toBe('They hold a paper, so only the office says who they are. Ask a leader, an assistant or the controller to name them.')
    expect(plainWordsFailures(PAPER_HOLDER_NAMING_WORDS)).toEqual([])
    expect(PAPER_HOLDER_NAMING_NEXT.startsWith('Ask ')).toBe(true)
  })

  it('holds the code and the sentence the migration raises, on both of its guards', () => {
    const raised = migration.match(/RAISE EXCEPTION '([A-Za-z]+)' USING ERRCODE = '42501',\s+DETAIL = '([^']+)';/g) ?? []
    expect(raised).toHaveLength(2)
    for (const r of raised) {
      expect(r).toContain(`RAISE EXCEPTION '${PAPER_HOLDER_NAMING_CODE}'`)
      expect(r).toContain(`DETAIL = '${PAPER_HOLDER_NAMING_REASON}'`)
    }
  })
})
