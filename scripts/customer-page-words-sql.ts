/**
 * The seed block for `customer_page_words` (Messages, cut 8), from src/lib/portal/customerPageWordsSeed.ts.
 *
 *   npx vite-node scripts/customer-page-words-sql.ts                          # print the block
 *   npx vite-node scripts/customer-page-words-sql.ts -- --write <migration>   # replace the block in that file
 *
 * A change to the customer page's words in src/lib/portal/pageWords.ts ships with a new migration that holds a fresh
 * block written here, between the two markers; customerPageWords.test.ts fails until it does.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { customerPageWordsSeed, seedBlockOf } from '../src/lib/portal/customerPageWordsSeed'

const args = process.argv.slice(2)
const at = args.indexOf('--write')
if (at >= 0) {
  const file = args[at + 1]
  if (!file) throw new Error('--write needs the migration file')
  const sql = readFileSync(file, 'utf8')
  const block = seedBlockOf(sql)
  if (!block) throw new Error(`${file} has no seed block between the markers`)
  writeFileSync(file, sql.replace(block, () => customerPageWordsSeed()))
  console.log(`wrote the seed block into ${file}`)
} else {
  console.log(customerPageWordsSeed())
}
