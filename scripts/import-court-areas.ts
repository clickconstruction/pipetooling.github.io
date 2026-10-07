#!/usr/bin/env vite-node
/**
 * Import the counties' published justice precinct lines into the office's court map
 * (v2.4770, step 4 of the justice-court plan). Dev-run, once per county and again after
 * a redistricting:
 *
 *   npx vite-node scripts/import-court-areas.ts            # every source
 *   npx vite-node scripts/import-court-areas.ts Bexar Hays  # named counties
 *   npx vite-node scripts/import-court-areas.ts --dry-run   # fetch and report, write nothing
 *
 * Signs in as the owner the way the pay scripts do (scripts/lib/paySession.ts); the write
 * goes through the app's own policies (the office cohort). For each county: fetch the
 * layer as GeoJSON in WGS84, fold its features into one row per precinct, retire the
 * county's earlier imported rows, insert the new ones. Hand-drawn rows are never touched.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { signInAsOwner } from './lib/paySession'
import { COURT_AREA_IMPORT_SOURCES, courtAreaImportUrl, courtAreaRowsFromGeoJson } from '../src/lib/legal/courtAreasImport'

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const wanted = args.filter((a) => !a.startsWith('--')).map((a) => a.toLowerCase())
  const sources = COURT_AREA_IMPORT_SOURCES.filter((s) => wanted.length === 0 || wanted.includes(s.county.toLowerCase()))
  if (sources.length === 0) throw new Error(`No source matches ${wanted.join(', ')}. Known: ${COURT_AREA_IMPORT_SOURCES.map((s) => s.county).join(', ')}`)
  const today = new Date().toISOString().slice(0, 10)
  const db = dryRun ? null : await signInAsOwner()
  for (const src of sources) {
    const url = courtAreaImportUrl(src)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${src.county}: ${res.status} from ${url}`)
    const fc = (await res.json()) as unknown
    const { rows, skipped } = courtAreaRowsFromGeoJson(src, fc, today)
    console.log(`${src.county}: ${rows.length} precinct${rows.length === 1 ? '' : 's'} (${rows.map((r) => r.precinct).join(', ')}), ${skipped} feature${skipped === 1 ? '' : 's'} skipped`)
    if (rows.length === 0) throw new Error(`${src.county}: the layer answered no precincts — field ${src.precinctField} may have moved`)
    if (!db) continue
    const client = db as unknown as SupabaseClient // court_areas is not in the generated types until the push lands
    const retire = await client.from('court_areas').update({ active: false, updated_at: new Date().toISOString() }).eq('county', src.county).eq('source', 'imported').eq('active', true)
    if (retire.error) throw new Error(`${src.county}: could not retire the earlier import — ${retire.error.message}`)
    const insert = await client.from('court_areas').insert(rows)
    if (insert.error) throw new Error(`${src.county}: could not insert — ${insert.error.message}`)
    console.log(`${src.county}: written`)
  }
  console.log(dryRun ? 'dry run — nothing written' : 'done — run the classification from the Map page (Classify now) or wait for the night')
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
