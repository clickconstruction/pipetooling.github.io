import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PERSON_REPORT_ENTRY_SOURCES, PERSON_REPORT_SELECT, isPersonReportVerb, personReportAppliedWords, personReportAuthorLabel, personReportDefaultBody, personReportDryRun, personReportInput, personReportRpc, type PersonReportRow } from '../../../supabase/functions/_shared/devMcpPersonReport'
import { WRITE_VERBS, alreadyApplied, planHash, planReply, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const REPORTS_MIGRATION = readFileSync('supabase/migrations/20260824170000_person_reports.sql', 'utf8')

const REPORT = 'c1b2c3d4-0000-4000-8000-000000000077'
const PERSON = '11111111-2222-4333-8444-555555555555'
const HASH = 'a'.repeat(64)
const row: PersonReportRow = { id: REPORT, status: 'pending', subject_person_id: PERSON, occurred_date: '2026-10-25', created_at: '2026-10-27T01:30:00Z', author_name: ' Sam Boss ', content: 'Late twice this week.', resolution_note: null, resolved_at: null, filed_entry_id: null }
const person = { id: PERSON, name: 'Pat Doe' }

describe('the field-report verbs (file or dismiss a waiting report from the dev seat)', () => {
  it('are two write verbs on the allowlist with no wrapper RPC — they POST the queue\'s own file_person_report / dismiss_person_report, which the person_reports migration gates is_dev() or hr_agent', () => {
    expect(WRITE_VERBS.plan_person_report).toEqual({ rpc: null, step: 'plan' })
    expect(WRITE_VERBS.apply_person_report).toEqual({ rpc: null, step: 'apply' })
    expect(isPersonReportVerb('plan_person_report')).toBe(true)
    expect(isPersonReportVerb('plan_paper')).toBe(false)
    expect(planVerbFor('apply_person_report')).toBe('plan_person_report')
    expect(REPORTS_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.file_person_report(')
    expect(REPORTS_MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.dismiss_person_report(p_report_id uuid, p_reason text)')
    expect(REPORTS_MIGRATION.match(/IF NOT \(public\.is_dev\(\) OR current_user = 'hr_agent'\) THEN/g)?.length).toBe(2)
    expect(REPORTS_MIGRATION).toContain("IF r.status <> 'pending' THEN") // idempotent: an already-resolved report answers `already`
    // The dry run's columns are the table's.
    for (const c of PERSON_REPORT_SELECT.split(',')) expect(Object.keys(CATALOG_TABLES.person_reports!.columns)).toContain(c)
  })

  it('the shape: a file carries its tightened words and source only when given, a dismissal needs its reason, and the rest is refused in words', () => {
    const file = writeRpcBody('plan_person_report', { report: { report_id: REPORT.toUpperCase(), action: 'file' } })
    expect(file).toMatchObject({ ok: true, rpc: null, step: 'plan', target: REPORT, body: { p: { action: 'file', report_id: REPORT } } })
    expect(file.ok && file.body.p).not.toHaveProperty('content')
    const tightened = personReportInput('apply_person_report', { report: { report_id: REPORT, action: 'file', content: ' Late Tue and Thu. ', source: 'Incident' } })
    expect(tightened).toEqual({ ok: true, p: { action: 'file', report_id: REPORT, content: 'Late Tue and Thu.', source: 'incident' }, target: REPORT })
    const dismiss = personReportInput('plan_person_report', { report: { report_id: REPORT, action: 'dismiss', reason: ' Duplicate of the 10-24 report. ' } })
    expect(dismiss).toEqual({ ok: true, p: { action: 'dismiss', report_id: REPORT, reason: 'Duplicate of the 10-24 report.' }, target: REPORT })
    const bad = (input: Record<string, unknown>) => {
      const r = personReportInput('plan_person_report', input)
      return r.ok ? '' : r.error
    }
    expect(bad({})).toContain('needs report')
    expect(bad({ report: { report_id: 'nope', action: 'file' } })).toContain('needs report')
    expect(bad({ report: { report_id: REPORT, action: 'archive' } })).toContain('needs report')
    expect(bad({ report: { report_id: REPORT, action: 'file', source: 'gossip' } })).toContain('needs report')
    expect(bad({ report: { report_id: REPORT, action: 'file', content: 'x'.repeat(20001) } })).toContain('needs report')
    expect(bad({ report: { report_id: REPORT, action: 'dismiss' } })).toContain('needs a reason')
    expect(bad({ report: { report_id: REPORT, action: 'dismiss', reason: 'x'.repeat(2001) } })).toContain('needs a reason')
    const noHash = writeRpcBody('apply_person_report', { report: { report_id: REPORT, action: 'file' } })
    expect(noHash.ok ? '' : noHash.error).toContain('needs plan_hash')
    expect(PERSON_REPORT_ENTRY_SOURCES).toContain('report')
  })

  it('the dry run shows the report as it stands and the entry as file_person_report composes it — the preamble with the submitted day in the company\'s calendar, the reporter as author', () => {
    const dry = personReportDryRun({ action: 'file', report_id: REPORT }, row, person, calendarYmdInAppTzFromIso)
    expect(dry.ok).toBe(true)
    const reply = dry.ok ? dry.reply : {}
    expect(reply.report).toEqual({ id: REPORT, status: 'pending', occurred_date: '2026-10-25', submitted_on: '2026-10-26', author_name: ' Sam Boss ', content: 'Late twice this week.', person })
    // 2026-10-27T01:30Z is the evening of the 26th in Chicago: the day the RPC's to_char AT TIME ZONE gives.
    expect(reply.after).toEqual({ report_status: 'filed', entry: { entry_date: '2026-10-25', source: 'report', content: 'Field report from Sam Boss (submitted 2026-10-26): Late twice this week.', author_label: 'Field report — Sam Boss', words_tightened: false } })
    expect(String(reply.then)).toContain('file_person_report')
    expect(personReportDefaultBody({ author_name: '  ', created_at: row.created_at, content: 'x' }, '2026-10-26')).toBe('Field report from a master technician (submitted 2026-10-26): x')
    expect(personReportAuthorLabel({ author_name: '' })).toBe('Field report — unknown author')
    const tightened = personReportDryRun({ action: 'file', report_id: REPORT, content: 'Late Tue and Thu.', source: 'incident' }, row, null, calendarYmdInAppTzFromIso)
    expect(tightened.ok && (tightened.reply.after as { entry: Record<string, unknown> }).entry).toEqual({ entry_date: '2026-10-25', source: 'incident', content: 'Late Tue and Thu.', author_label: 'Field report — Sam Boss', words_tightened: true })
    expect(tightened.ok && (tightened.reply.report as { person: unknown }).person).toEqual({ id: PERSON, name: '' })
    const dismiss = personReportDryRun({ action: 'dismiss', report_id: REPORT, reason: 'Duplicate.' }, row, person, calendarYmdInAppTzFromIso)
    expect(dismiss.ok && dismiss.reply.after).toEqual({ report_status: 'dismissed', resolution_note: 'Duplicate.' })
    expect(dismiss.ok && String(dismiss.reply.then)).toContain('dismiss_person_report')
  })

  it('a report no longer waiting is refused in words, with where it went', () => {
    const filed = personReportDryRun({ action: 'file', report_id: REPORT }, { ...row, status: 'filed', resolved_at: '2026-10-28T15:00:00Z', filed_entry_id: 'e1' }, person, calendarYmdInAppTzFromIso)
    expect(filed).toEqual({ ok: false, refused: expect.stringContaining('was filed on 2026-10-28 as entry e1') })
    const dismissed = personReportDryRun({ action: 'dismiss', report_id: REPORT, reason: 'x' }, { ...row, status: 'dismissed', resolution_note: 'Duplicate.' }, person, calendarYmdInAppTzFromIso)
    expect(dismissed).toEqual({ ok: false, refused: expect.stringContaining('was dismissed — Duplicate.') })
  })

  it('the plan hash commits to the report as it stands and what would be written: the same report hashes the same, a changed report or ask does not', async () => {
    const p = { action: 'file' as const, report_id: REPORT }
    const dry = personReportDryRun(p, row, person, calendarYmdInAppTzFromIso)
    const a = await planHash('plan_person_report', p, dry.ok ? dry.reply : {})
    const again = personReportDryRun(p, { ...row }, person, calendarYmdInAppTzFromIso)
    expect(await planHash('apply_person_report', p, again.ok ? again.reply : {})).toBe(a)
    const edited = personReportDryRun(p, { ...row, content: 'Late three times this week.' }, person, calendarYmdInAppTzFromIso)
    expect(await planHash('apply_person_report', p, edited.ok ? edited.reply : {})).not.toBe(a)
    const other = { ...p, content: 'Late Tue and Thu.' }
    const otherDry = personReportDryRun(other, row, person, calendarYmdInAppTzFromIso)
    expect(await planHash('apply_person_report', other, otherDry.ok ? otherDry.reply : {})).not.toBe(a)
  })

  it('the apply POSTs the queue\'s own RPC with its arguments, and the words after read the RPC\'s answer', () => {
    expect(personReportRpc({ action: 'file', report_id: REPORT })).toEqual({ rpc: 'file_person_report', body: { p_report_id: REPORT } })
    expect(personReportRpc({ action: 'file', report_id: REPORT, content: 'Late Tue and Thu.', source: 'incident' })).toEqual({ rpc: 'file_person_report', body: { p_report_id: REPORT, p_content: 'Late Tue and Thu.', p_source: 'incident' } })
    expect(personReportRpc({ action: 'dismiss', report_id: REPORT, reason: 'Duplicate.' })).toEqual({ rpc: 'dismiss_person_report', body: { p_report_id: REPORT, p_reason: 'Duplicate.' } })
    expect(personReportAppliedWords({ action: 'file', report_id: REPORT }, { already: false, status: 'filed', entry_id: 'e1' }, 'Pat Doe')).toContain('the HR entry e1 on Pat Doe\'s file')
    expect(personReportAppliedWords({ action: 'dismiss', report_id: REPORT, reason: 'x' }, { already: false, status: 'dismissed' }, 'Pat Doe')).toContain('Dismissed')
    expect(personReportAppliedWords({ action: 'file', report_id: REPORT }, { already: true, status: 'dismissed' }, '')).toContain('already dismissed')
    expect(planReply('plan_person_report', { dry_run: true }, HASH).next).toContain('apply_person_report')
    expect(alreadyApplied('apply_person_report', { target: REPORT, at: '2026-11-02T00:00:00Z' })).toContain('off the queue')
  })

  it('the server declares both verbs in their own case after the plan-part block, reads the report as the dev before the hash, POSTs the queue\'s RPC by the kernel\'s choice, and refuses them through view_as', () => {
    expect(SERVER).toContain("name: 'plan_person_report'")
    expect(SERVER).toContain("name: 'apply_person_report'")
    expect(SERVER).toContain("case 'plan_person_report':\n    case 'apply_person_report': {")
    expect(SERVER.indexOf("case 'plan_person_report':")).toBeGreaterThan(SERVER.indexOf("case 'apply_paper': {"))
    expect(SERVER.indexOf("case 'plan_person_report':")).toBeLessThan(SERVER.indexOf("case 'plan_cost_batch':"))
    expect(SERVER).toContain('personReportDryRun(p, report, person, calendarYmdInAppTzFromIso)')
    expect(SERVER).toContain('const call = personReportRpc(p)')
    expect(SERVER).toContain('await restPost(session, `rpc/${call.rpc}`, call.body)')
    expect(SERVER).toContain("const SERVER_VERSION = '0.44.0'")
    expect(README).toContain('`plan_person_report(report)` · `apply_person_report(report, plan_hash)`')
  })
})
