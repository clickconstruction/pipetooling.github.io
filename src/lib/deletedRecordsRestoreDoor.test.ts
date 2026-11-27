import { describe, expect, it } from 'vitest'
import { RESTORE_BUNDLE_FUNCTION, RESTORE_TEST_PERSON_FUNCTION, restoreFunctionFor } from './deletedRecordsRestoreDoor'

describe('restoreFunctionFor (punch list #443, row 12)', () => {
  it('a person with a copy of the users row goes to the test person’s put-back', () => {
    expect(restoreFunctionFor({ kind: 'person', tables: ['people', 'salary_work_schedule_templates', 'users'] })).toBe(RESTORE_TEST_PERSON_FUNCTION)
    expect(restoreFunctionFor({ kind: 'person', tables: ['users', 'people'] })).toBe('restore_deleted_test_person')
  })

  it('a person with no users copy keeps the old function: deleted before the migration, or a name that does not start with ZZ', () => {
    expect(restoreFunctionFor({ kind: 'person', tables: ['people'] })).toBe(RESTORE_BUNDLE_FUNCTION)
    expect(restoreFunctionFor({ kind: 'person', tables: ['people', 'people_labels'] })).toBe('restore_deleted_records')
    expect(restoreFunctionFor({ kind: 'person', tables: [] })).toBe(RESTORE_BUNDLE_FUNCTION)
  })

  it('every other kind keeps the old function, a users copy or not', () => {
    for (const kind of ['job', 'bid', 'partial', 'customer', 'pay stub', 'clock session', 'users', 'people', 'Person', '']) {
      expect(restoreFunctionFor({ kind, tables: ['users', 'people'] })).toBe(RESTORE_BUNDLE_FUNCTION)
    }
    expect(restoreFunctionFor({ kind: 'job', tables: ['jobs_ledger', 'jobs_ledger_invoices'] })).toBe(RESTORE_BUNDLE_FUNCTION)
  })

  it('a table name that only holds the word is not the users table', () => {
    expect(restoreFunctionFor({ kind: 'person', tables: ['people', 'users_archive', 'app_users'] })).toBe(RESTORE_BUNDLE_FUNCTION)
  })

  it('a bundle with no table list keeps the old function', () => {
    expect(restoreFunctionFor({ kind: 'person', tables: null })).toBe(RESTORE_BUNDLE_FUNCTION)
    expect(restoreFunctionFor({ kind: 'person', tables: undefined })).toBe(RESTORE_BUNDLE_FUNCTION)
  })
})
