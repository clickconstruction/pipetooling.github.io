import { supabase } from './supabase'

/**
 * Combine people (v2.982): fold a duplicate roster identity ("Behar Kraja
 * (Rough In)") into the real one. Works at every phase of the person_id
 * migration (docs/PERSON_IDENTITY_PLAN.md): repoints person_id rows where the
 * column exists AND rewrites the name-keyed rows, then archives (never
 * deletes) the duplicate. Preview first — the modal shows exactly what will
 * be rewritten.
 */

/** Sub-sheet assigned_to_name separator (shared source of truth — components import from here). */
export const LABOR_ASSIGNED_DELIMITER = ' | '

/** Name-keyed pay/labor tables (person_name column). */
const NAME_KEYED_TABLES = [
  'people_pay_config',
  'people_hours',
  'people_team_members',
  'people_hours_display_order',
  'people_crew_jobs',
  'people_crew_bids',
  'pay_stubs',
  'pay_stub_days',
  'person_offsets',
  'hours_reviewed',
] as const

/** Tables that already carry person_id (repointed as well — belt and braces). */
const PERSON_ID_TABLES = ['people_pay_config', 'people_hours', 'people_crew_jobs', 'pay_stubs', 'people_team_members'] as const

/**
 * Replace one exact name segment in a " | "-delimited assigned list
 * (case-insensitive match, trims segments, drops a duplicate if the new name
 * is already present). Returns null when nothing changed.
 */
export function replaceNameInAssignedList(text: string | null | undefined, oldName: string, newName: string): string | null {
  const raw = (text ?? '').trim()
  if (!raw) return null
  const oldNorm = oldName.trim().toLowerCase()
  const newTrimmed = newName.trim()
  const segments = raw.split(LABOR_ASSIGNED_DELIMITER).map((s) => s.trim()).filter(Boolean)
  if (!segments.some((s) => s.toLowerCase() === oldNorm)) return null
  const out: string[] = []
  for (const seg of segments) {
    const replaced = seg.toLowerCase() === oldNorm ? newTrimmed : seg
    if (!out.some((s) => s.toLowerCase() === replaced.toLowerCase())) out.push(replaced)
  }
  return out.join(LABOR_ASSIGNED_DELIMITER)
}

export type CombinePreviewLine = { table: string; nameRows: number; idRows: number }

export type CombinePreview = {
  lines: CombinePreviewLine[]
  laborSheets: number
  totalRows: number
}

export async function previewCombinePeople(sourcePersonId: string, sourceName: string): Promise<CombinePreview> {
  const name = sourceName.trim()
  const lines: CombinePreviewLine[] = []
  for (const table of NAME_KEYED_TABLES) {
    const { count: nameCount } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('person_name', name)
    let idCount = 0
    if ((PERSON_ID_TABLES as readonly string[]).includes(table)) {
      const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('person_id', sourcePersonId)
      idCount = count ?? 0
    }
    lines.push({ table, nameRows: nameCount ?? 0, idRows: idCount })
  }
  const laborSheets = await findAssignedLaborSheets(name)
  const totalRows = lines.reduce((s, l) => s + Math.max(l.nameRows, l.idRows), 0) + laborSheets.length
  return { lines, laborSheets: laborSheets.length, totalRows }
}

async function findAssignedLaborSheets(name: string): Promise<Array<{ id: string; assigned_to_name: string | null }>> {
  const { data } = await supabase
    .from('people_labor_jobs')
    .select('id, assigned_to_name')
    .ilike('assigned_to_name', `%${name}%`)
  const norm = name.trim().toLowerCase()
  return ((data ?? []) as Array<{ id: string; assigned_to_name: string | null }>).filter((row) =>
    (row.assigned_to_name ?? '')
      .split(LABOR_ASSIGNED_DELIMITER)
      .some((s) => s.trim().toLowerCase() === norm),
  )
}

export type CombineResult = { renamedRows: number; repointedRows: number; sheetsRewritten: number; accountMoved: boolean }

/**
 * Execute the combine. Caller has already confirmed via preview. Throws with a
 * readable message on any failure; earlier steps are idempotent re-runs.
 */
export async function executeCombinePeople(args: {
  source: { id: string; name: string; account_user_id: string | null }
  target: { id: string; name: string; account_user_id: string | null }
  /** Skip the archive step when the caller owns archiving (e.g. the tab's archivePerson flow, which also refreshes). */
  skipArchive?: boolean
}): Promise<CombineResult> {
  const { source, target } = args
  const sourceName = source.name.trim()
  const targetName = target.name.trim()
  if (source.id === target.id) throw new Error('Pick a different person to combine into.')
  if (source.account_user_id && target.account_user_id && source.account_user_id !== target.account_user_id) {
    throw new Error('Both people are linked to app accounts — merge the accounts first (Settings → Merge users).')
  }

  let renamedRows = 0
  let repointedRows = 0

  // 1. Name-keyed rows → target name.
  if (sourceName.toLowerCase() !== targetName.toLowerCase()) {
    for (const table of NAME_KEYED_TABLES) {
      const { data, error } = await supabase.from(table).update({ person_name: targetName }).eq('person_name', sourceName).select('person_name')
      if (error) throw new Error(`${table}: ${error.message}`)
      renamedRows += (data ?? []).length
    }
  }

  // 2. person_id rows → target person (where the migration columns exist).
  for (const table of PERSON_ID_TABLES) {
    const { data, error } = await supabase.from(table).update({ person_id: target.id }).eq('person_id', source.id).select('person_id')
    if (error) throw new Error(`${table} (person_id): ${error.message}`)
    repointedRows += (data ?? []).length
  }

  // 3. Sub sheets: exact-segment rewrite of the delimited assigned list.
  let sheetsRewritten = 0
  const sheets = await findAssignedLaborSheets(sourceName)
  for (const sheet of sheets) {
    const next = replaceNameInAssignedList(sheet.assigned_to_name, sourceName, targetName)
    if (next == null) continue
    const { error } = await supabase.from('people_labor_jobs').update({ assigned_to_name: next }).eq('id', sheet.id)
    if (error) throw new Error(`people_labor_jobs: ${error.message}`)
    sheetsRewritten++
  }

  // 4. Carry the account link when only the duplicate had one.
  let accountMoved = false
  if (source.account_user_id && !target.account_user_id) {
    const { error: clearErr } = await supabase.from('people').update({ account_user_id: null }).eq('id', source.id)
    if (clearErr) throw new Error(`unlink source account: ${clearErr.message}`)
    const { error: setErr } = await supabase.from('people').update({ account_user_id: source.account_user_id }).eq('id', target.id)
    if (setErr) throw new Error(`link target account: ${setErr.message}`)
    accountMoved = true
  }

  // 5. Archive (never delete) the duplicate roster row — unless the caller archives.
  if (!args.skipArchive) {
    const { error: archiveErr } = await supabase.from('people').update({ archived_at: new Date().toISOString() }).eq('id', source.id)
    if (archiveErr) throw new Error(`archive duplicate: ${archiveErr.message}`)
  }

  return { renamedRows, repointedRows, sheetsRewritten, accountMoved }
}
