/**
 * Which function puts a Recently deleted bundle back (punch list #443, row 12). Pure.
 *
 * Every bundle goes back through `restore_deleted_records`, which inserts the bundle's rows parent first. One kind
 * cannot: a deleted person. A People record may not stand without its users row (`people_needs_users_row`), and
 * `users` carries no archive trigger. Since `20261127022551`, `delete_fresh_person` writes a copy of a test person's
 * users row into the person's own bundle, and `restore_deleted_test_person` puts the users row, the People record,
 * the pay row and the workday template back together. So a person's bundle that holds a users copy goes to that
 * function, and every other bundle keeps the old one. A person deleted before the migration, or a person whose name
 * does not start with ZZ, has no users copy and keeps the old function, whose refusal says why it cannot go back.
 */

export const RESTORE_BUNDLE_FUNCTION = 'restore_deleted_records'
export const RESTORE_TEST_PERSON_FUNCTION = 'restore_deleted_test_person'

export type RestoreFunctionName = typeof RESTORE_BUNDLE_FUNCTION | typeof RESTORE_TEST_PERSON_FUNCTION

/** The part of a bundle the rule reads: `list_deleted_records`' kind and its table names. */
export type RestoreDoorBundle = { kind: string; tables: readonly string[] | null | undefined }

/** A person's bundle with a copy of the users row goes to the test person's put-back. Every other bundle keeps the old function. */
export function restoreFunctionFor(bundle: RestoreDoorBundle): RestoreFunctionName {
  const tables = Array.isArray(bundle.tables) ? bundle.tables : []
  return bundle.kind === 'person' && tables.includes('users') ? RESTORE_TEST_PERSON_FUNCTION : RESTORE_BUNDLE_FUNCTION
}
