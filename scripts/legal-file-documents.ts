#!/usr/bin/env vite-node
/**
 * File documents (and, optionally, the narrative) on a legal matter from a folder (v2.4814) — the
 * session's door to what the Legal desk's Evidence and Narrative tabs do by hand. A dry run unless
 * --write is passed: it reads every file, checks it, and says what it would do.
 *
 *   npx vite-node scripts/legal-file-documents.ts <folder>/manifest.json            # dry run
 *   npx vite-node scripts/legal-file-documents.ts <folder>/manifest.json --write    # files them
 *
 * manifest.json (paths relative to the manifest's folder):
 *   { "matter_id": "<legal_matters.id>",
 *     "documents": [ { "file": "documents/report.pdf", "title": "Billing report", "shows": "One line on what it shows", "hold": "reason, to keep it back" } ],
 *     "narrative_file": "01 Narrative.md" }
 *
 * Signs in as the owner the way the pay and import scripts do (scripts/lib/paySession.ts); every
 * write goes through the app's own rules: the private bucket's policy and legal_matter_documents'
 * RLS (who added it is stamped by the database), and legal_set_narrative. A document already on the
 * matter with the same title, file name and size is skipped, so a re-run is safe. The firm sees what
 * is filed on its next open: run the dry run, read it, and write only what the owner asked for.
 */
import { readFileSync, statSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { signInAsOwner } from './lib/paySession'
import { LEGAL_MATTER_DOCUMENTS_BUCKET, legalDocumentMime, legalDocumentSizeWords, legalDocumentStoragePath } from '../src/lib/legal/legalMatterDocuments'
import { legalFilingAlreadyThere, legalFilingFileProblem, legalFilingNarrativeProblem, parseLegalFilingManifest } from '../src/lib/legal/legalFilingManifest'

async function main() {
  const args = process.argv.slice(2)
  const write = args.includes('--write')
  const manifestPath = args.find((a) => !a.startsWith('--'))
  if (!manifestPath) throw new Error('Pass the manifest: npx vite-node scripts/legal-file-documents.ts <folder>/manifest.json [--write]')
  const base = dirname(resolve(manifestPath))
  const parsed = parseLegalFilingManifest(JSON.parse(readFileSync(manifestPath, 'utf8')))
  if (!parsed.ok) throw new Error(`The manifest has problems:\n  ${parsed.problems.join('\n  ')}`)
  const { manifest } = parsed

  // Every file read and checked before anything is written.
  const files = manifest.documents.map((doc) => {
    const path = resolve(base, doc.file)
    const bytes = statSync(path).size
    const problem = legalFilingFileProblem(doc, bytes)
    if (problem) throw new Error(`${doc.file}: ${problem}`)
    return { doc, path, bytes, name: basename(path), mime: legalDocumentMime({ type: '', name: path }) }
  })
  const narrative = manifest.narrativeFile ? readFileSync(resolve(base, manifest.narrativeFile), 'utf8') : null
  if (narrative != null) {
    const problem = legalFilingNarrativeProblem(narrative)
    if (problem) throw new Error(`${manifest.narrativeFile}: ${problem}`)
  }

  const db = (await signInAsOwner()) as unknown as SupabaseClient // legal_matter_documents is not in the generated types until the push lands
  const { data: matter, error: matterErr } = await db.from('legal_matters').select('id, payer_name, stage, closed_at').eq('id', manifest.matterId).maybeSingle()
  if (matterErr) throw new Error(`Could not read the matter: ${matterErr.message}`)
  if (!matter) throw new Error(`No matter ${manifest.matterId}.`)
  const m = matter as { id: string; payer_name: string; stage: string; closed_at: string | null }
  console.log(`Matter: ${m.payer_name} · ${m.stage}${m.closed_at ? ' · closed' : ''}`)
  const { data: existingRows, error: existingErr } = await db.from('legal_matter_documents').select('title, original_name, size_bytes').eq('matter_id', m.id).is('voided_at', null)
  if (existingErr) throw new Error(`Could not read the matter's documents (is migration 20261007230000 pushed?): ${existingErr.message}`)
  const existing = (existingRows ?? []) as Array<{ title: string; original_name: string; size_bytes: number }>

  let filed = 0
  for (const f of files) {
    const line = `${f.doc.title} · ${f.name} · ${legalDocumentSizeWords(f.bytes)}${f.doc.hold ? ` · held: ${f.doc.hold}` : ''}`
    if (legalFilingAlreadyThere(existing, f.doc, f.bytes, f.name)) {
      console.log(`  skip (already on the matter): ${line}`)
      continue
    }
    if (!write) {
      console.log(`  would file: ${line}`)
      continue
    }
    const id = randomUUID()
    const path = legalDocumentStoragePath(m.id, id, f.name)
    const up = await db.storage.from(LEGAL_MATTER_DOCUMENTS_BUCKET).upload(path, readFileSync(f.path), { contentType: f.mime, upsert: false })
    if (up.error) throw new Error(`${f.name}: could not store it — ${up.error.message}`)
    const ins = await db.from('legal_matter_documents').insert({ id, matter_id: m.id, title: f.doc.title, shows: f.doc.shows, storage_path: path, mime: f.mime, size_bytes: f.bytes, original_name: f.name, held_reason: f.doc.hold })
    if (ins.error) {
      await db.storage.from(LEGAL_MATTER_DOCUMENTS_BUCKET).remove([path])
      throw new Error(`${f.name}: could not save the row — ${ins.error.message}`)
    }
    filed += 1
    console.log(`  filed: ${line}`)
  }

  if (narrative != null) {
    if (!write) console.log(`  would save the narrative: ${narrative.trim().length.toLocaleString('en-US')} characters from ${manifest.narrativeFile}`)
    else {
      const { data, error } = await db.rpc('legal_set_narrative', { p_matter_id: m.id, p_markdown: narrative })
      const err = error?.message ?? ((data as { error?: string } | null)?.error ?? null)
      if (err) throw new Error(`The narrative: ${err}`)
      console.log(`  saved the narrative: ${narrative.trim().length.toLocaleString('en-US')} characters`)
    }
  }
  console.log(write ? `Done: ${filed} document${filed === 1 ? '' : 's'} filed.` : 'Dry run — nothing written. Pass --write to file them.')
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
