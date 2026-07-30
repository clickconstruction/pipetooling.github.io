import { describe, expect, it } from 'vitest'
import { cascadePersonNameInPayTables } from './cascadePersonName'

// Table coverage is pinned in combinePeople.test.ts — since v2.1112 the
// cascade loops over the shared NAME_KEYED_TABLES inventory, so there is no
// second list to drift. These tests pin the no-op guards (they return before
// any network call, so they are safe to run against the real client module).
describe('cascadePersonNameInPayTables guards', () => {
  it('no-ops on empty old or new name', async () => {
    await expect(cascadePersonNameInPayTables('', 'New Name')).resolves.toBeUndefined()
    await expect(cascadePersonNameInPayTables('Old Name', '')).resolves.toBeUndefined()
    await expect(cascadePersonNameInPayTables('   ', 'New Name')).resolves.toBeUndefined()
  })

  it('no-ops when the trimmed names are identical', async () => {
    await expect(cascadePersonNameInPayTables(' Behar Kraja ', 'Behar Kraja')).resolves.toBeUndefined()
  })
})
