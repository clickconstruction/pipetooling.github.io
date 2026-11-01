import { describe, expect, it } from 'vitest'
import { CALLS_AHEAD_LABEL_DESCRIPTION, GITHUB_LABEL_DESCRIPTION_MAX, callsAhead, callsAheadLabelCalls, ghFailureWords, labelAlreadyExists, namesCreatedIn, schemaCallsIn } from './callsAhead'

describe('schemaCallsIn', () => {
  it('reads a literal rpc name, through an `as never` cast or a template literal, with its line', () => {
    const src = [
      "import { supabase } from './supabase'",
      'export async function land(press: Press) {',
      "  const { data } = await supabase.rpc('land_field_press' as never, { p_id: press.id })",
      '  await supabase',
      '    .rpc(`insert_report`, {})',
      '  return data',
      '}',
    ].join('\n')
    expect(schemaCallsIn(src, 'landFieldPress.ts')).toEqual([
      { kind: 'rpc', name: 'land_field_press', line: 3 },
      { kind: 'rpc', name: 'insert_report', line: 5 },
    ])
  })

  it('reads a from() of a table, and not a bucket or a constructor', () => {
    const src = [
      "const rows = await supabase.from('clock_sessions').select('*')",
      "const file = supabase.storage.from('message-attachments').download(path)",
      "const chars = Array.from('abc')",
      "const bytes = Buffer.from('abc', 'base64')",
      "const more = await client.schema('monitoring').from('health_checks').select()",
    ].join('\n')
    expect(schemaCallsIn(src, 'io.ts')).toEqual([
      { kind: 'from', name: 'clock_sessions', line: 1 },
      { kind: 'from', name: 'health_checks', line: 5 },
    ])
  })

  it('leaves alone a name in a comment, a variable and a call with no argument', () => {
    const src = [
      '/**',
      " *   () => supabase.rpc('my_fn', { p_id: id }),",
      " *   operation: () => supabase.from('items').delete(),",
      ' */',
      "// supabase.rpc('also_not')",
      'const fn = pick()',
      'await supabase.rpc(fn as never, {})',
      'await supabase.rpc(`${prefix}_count`)',
      'const x = supabase.from()',
    ].join('\n')
    expect(schemaCallsIn(src, 'errorHandling.ts')).toEqual([])
  })

  it('reads a .tsx source too', () => {
    const src = "export function Card() {\n  const load = () => supabase.rpc('get_crew_day_payload')\n  return <button onClick={load}>Load</button>\n}\n"
    expect(schemaCallsIn(src, 'Card.tsx')).toEqual([{ kind: 'rpc', name: 'get_crew_day_payload', line: 2 }])
  })
})

describe('namesCreatedIn', () => {
  it('reads functions, tables and views, quoted or schema-qualified, each once, without comments', () => {
    const sql = [
      "SET lock_timeout = '3s';",
      '-- CREATE FUNCTION public.not_this()',
      '/* CREATE TABLE nor_this (id uuid); */',
      'CREATE OR REPLACE FUNCTION public.land_field_press(p_id uuid) RETURNS jsonb AS $$ BEGIN END $$ LANGUAGE plpgsql;',
      'CREATE FUNCTION "public"."Mark_Job_Paid"(p_job uuid) RETURNS void AS $$ BEGIN END $$ LANGUAGE plpgsql;',
      'create or replace function',
      '  monitoring.sample_connections() returns void as $$ begin end $$ language plpgsql;',
      'CREATE TABLE IF NOT EXISTS public.field_presses (id uuid primary key);',
      'CREATE UNLOGGED TABLE scratch_rows (id uuid);',
      'CREATE TABLE IF NOT EXISTS public.field_presses (id uuid primary key);',
      'CREATE OR REPLACE VIEW public.v_open_sessions AS SELECT 1;',
      'CREATE MATERIALIZED VIEW IF NOT EXISTS totals AS SELECT 1;',
      'REVOKE ALL ON FUNCTION public.land_field_press(uuid) FROM PUBLIC;',
      "COMMENT ON TABLE public.field_presses IS 'one row per press';",
    ].join('\n')
    expect(namesCreatedIn(sql)).toEqual([
      { kind: 'function', name: 'land_field_press' },
      { kind: 'function', name: 'mark_job_paid' },
      { kind: 'function', name: 'sample_connections' },
      { kind: 'table', name: 'field_presses' },
      { kind: 'table', name: 'scratch_rows' },
      { kind: 'view', name: 'v_open_sessions' },
      { kind: 'view', name: 'totals' },
    ])
  })

  it('reads nothing from a migration that only alters', () => {
    expect(namesCreatedIn("SET lock_timeout = '3s';\nALTER TABLE public.jobs_ledger ADD COLUMN IF NOT EXISTS memo text;\nCREATE INDEX IF NOT EXISTS jobs_memo_idx ON public.jobs_ledger (memo);\n")).toEqual([])
  })
})

describe('callsAhead', () => {
  const pending = new Map([
    ['supabase/migrations/20261029230000_field_presses.sql', namesCreatedIn('CREATE OR REPLACE FUNCTION public.land_field_press() RETURNS void AS $$ BEGIN END $$ LANGUAGE plpgsql;\nCREATE TABLE IF NOT EXISTS public.field_presses (id uuid);')],
    ['supabase/migrations/20261030040000_field_presses_notes_reports.sql', namesCreatedIn('CREATE OR REPLACE FUNCTION public.land_field_press() RETURNS void AS $$ BEGIN END $$ LANGUAGE plpgsql;\nCREATE OR REPLACE FUNCTION public.insert_report() RETURNS void AS $$ BEGIN END $$ LANGUAGE plpgsql;')],
  ])
  const applied = namesCreatedIn('CREATE FUNCTION public.insert_report() RETURNS void AS $$ BEGIN END $$ LANGUAGE plpgsql;\nCREATE TABLE public.clock_sessions (id uuid);')

  it('lists a call as missing when only pending migrations create its name, as replaced when prod has it too, and not at all when nothing pending touches it', () => {
    const calls = [
      {
        file: 'src/lib/offline/landFieldPress.ts',
        calls: [
          { kind: 'rpc' as const, name: 'land_field_press', line: 109 },
          { kind: 'from' as const, name: 'field_presses', line: 120 },
          { kind: 'rpc' as const, name: 'insert_report', line: 130 },
          { kind: 'from' as const, name: 'clock_sessions', line: 140 },
        ],
      },
    ]
    expect(callsAhead(calls, pending, applied)).toEqual([
      {
        file: 'src/lib/offline/landFieldPress.ts',
        call: { kind: 'rpc', name: 'land_field_press', line: 109 },
        migrations: ['supabase/migrations/20261029230000_field_presses.sql', 'supabase/migrations/20261030040000_field_presses_notes_reports.sql'],
        why: 'missing',
      },
      {
        file: 'src/lib/offline/landFieldPress.ts',
        call: { kind: 'from', name: 'field_presses', line: 120 },
        migrations: ['supabase/migrations/20261029230000_field_presses.sql'],
        why: 'missing',
      },
      {
        file: 'src/lib/offline/landFieldPress.ts',
        call: { kind: 'rpc', name: 'insert_report', line: 130 },
        migrations: ['supabase/migrations/20261030040000_field_presses_notes_reports.sql'],
        why: 'replaced',
      },
    ])
  })

  it('reads #6474: the one pending migration replaces a function the applied one created', () => {
    const only = new Map([['supabase/migrations/20261030040000_field_presses_notes_reports.sql', pending.get('supabase/migrations/20261030040000_field_presses_notes_reports.sql')!]])
    const prodHas = [...applied, ...pending.get('supabase/migrations/20261029230000_field_presses.sql')!]
    const calls = [{ file: 'src/lib/offline/landFieldPress.ts', calls: [{ kind: 'rpc' as const, name: 'land_field_press', line: 67 }] }]
    expect(callsAhead(calls, only, prodHas).map((a) => a.why)).toEqual(['replaced'])
  })

  it('reads a from() against a pending view, and an rpc against a pending table as nothing', () => {
    const views = new Map([['supabase/migrations/20261031000000_open_sessions_view.sql', namesCreatedIn('CREATE VIEW public.v_open_sessions AS SELECT 1;')]])
    const calls = [{ file: 'src/hooks/useOpen.ts', calls: [{ kind: 'from' as const, name: 'v_open_sessions', line: 4 }, { kind: 'rpc' as const, name: 'v_open_sessions', line: 5 }] }]
    expect(callsAhead(calls, views, []).map((a) => a.call.line)).toEqual([4])
  })

  it('is empty with nothing pending', () => {
    expect(callsAhead([{ file: 'a.ts', calls: [{ kind: 'rpc', name: 'land_field_press', line: 1 }] }], new Map(), applied)).toEqual([])
  })
})

describe('the label', () => {
  it('fits GitHub’s 100-character description cap, which refused the old 110-character one on every run', () => {
    expect(GITHUB_LABEL_DESCRIPTION_MAX).toBe(100)
    expect(CALLS_AHEAD_LABEL_DESCRIPTION.length).toBeLessThanOrEqual(GITHUB_LABEL_DESCRIPTION_MAX)
  })

  it('reads, makes and adds the label through REST, the name encoded in the read', () => {
    const calls = callsAheadLabelCalls('clickconstruction/pipetooling.github.io', 6635)
    expect(calls.read).toEqual(['api', 'repos/clickconstruction/pipetooling.github.io/labels/push%20right%20after%20the%20merge'])
    expect(calls.make).toEqual(['api', '-X', 'POST', 'repos/clickconstruction/pipetooling.github.io/labels', '-f', 'name=push right after the merge', '-f', 'color=D93F0B', '-f', `description=${CALLS_AHEAD_LABEL_DESCRIPTION}`])
    expect(calls.add).toEqual(['api', '-X', 'POST', 'repos/clickconstruction/pipetooling.github.io/issues/6635/labels', '-f', 'labels[]=push right after the merge'])
  })

  it('says GitHub’s reason for a failure, not the command line', () => {
    const tooLong = JSON.stringify({ message: 'Validation Failed', errors: [{ resource: 'Label', code: 'custom', field: 'description', message: 'description is too long (maximum is 100 characters)' }] })
    expect(ghFailureWords(tooLong, 'gh: Validation Failed (HTTP 422)', 'Command failed: gh api')).toBe('Validation Failed: description is too long (maximum is 100 characters)')
    const forbidden = JSON.stringify({ message: 'Resource not accessible by integration' })
    expect(ghFailureWords(forbidden, 'gh: Resource not accessible by integration (HTTP 403)', 'Command failed: gh api')).toBe('Resource not accessible by integration')
    expect(ghFailureWords(JSON.stringify({ message: 'Validation Failed', errors: [{ field: 'color', code: 'invalid' }] }), '', '')).toBe('Validation Failed: color invalid')
    expect(ghFailureWords('', '\ngh: not logged in\nmore', 'Command failed: gh api')).toBe('gh: not logged in')
    expect(ghFailureWords('', '', 'Command failed: gh api\nstderr')).toBe('Command failed: gh api')
  })

  it('carries on to the add when another run made the label first', () => {
    expect(labelAlreadyExists(JSON.stringify({ message: 'Validation Failed', errors: [{ resource: 'Label', code: 'already_exists', field: 'name' }] }))).toBe(true)
    expect(labelAlreadyExists(JSON.stringify({ message: 'Not Found' }))).toBe(false)
    expect(labelAlreadyExists('not json')).toBe(false)
  })
})
