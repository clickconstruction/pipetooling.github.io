import { describe, expect, it, vi } from 'vitest'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * scripts/pg-logs.sh, run against a stand-in endpoint (v2.6318). The freeze runbook's way to read
 * Postgres logs when no MCP is connected asks the Management API's unified `logs` table, which cuts
 * a result without saying so (24 hours from the start, 1000 rows, backslashes read twice). A stub
 * `curl` answers with a canned body and writes down what it was asked, so no real call is made: the
 * script must stop before the call on a window or limit it cannot read whole, send the regex so it
 * arrives as typed, and show a refused call as an error, never as an empty result.
 */
vi.setConfig({ testTimeout: 30_000 }) // each case starts bash and two pythons; a slow runner needs more than 5 s for a few
const SCRIPT = join(__dirname, '..', '..', '..', 'scripts', 'pg-logs.sh')
const START = '2026-11-01T10:00:00Z'
const END = '2026-11-01T11:00:00Z'

type Bed = { dir: string; bin: string; log: string; body: string }

function bed(body: string): Bed {
  const dir = mkdtempSync(join(tmpdir(), 'pt-pglogs-'))
  const bin = join(dir, 'bin')
  mkdirSync(bin)
  const log = join(dir, 'curl.log')
  const bodyFile = join(dir, 'body.json')
  writeFileSync(bodyFile, body)
  // every argument on its own line, a marker between calls, then the canned body
  writeFileSync(
    join(bin, 'curl'),
    `#!/bin/sh\nfor a in "$@"; do printf '%s\\n' "$a"; done >> "$CURL_LOG"\nprintf -- '--call-end--\\n' >> "$CURL_LOG"\ncat "$CURL_BODY"\n`,
  )
  chmodSync(join(bin, 'curl'), 0o755)
  return { dir, bin, log, body: bodyFile }
}

function run(b: Bed, args: string[], env: Record<string, string | undefined> = { SUPABASE_MGMT_TOKEN: 'tok-test' }) {
  const r = spawnSync('/bin/bash', [SCRIPT, ...args], {
    cwd: b.dir, // no .env.local here unless a test writes one
    env: { PATH: `${b.bin}:/usr/local/bin:/usr/bin:/bin`, CURL_LOG: b.log, CURL_BODY: b.body, ...env },
    encoding: 'utf8',
  })
  return { out: r.stdout, err: r.stderr, status: r.status }
}

function calls(b: Bed): string[][] {
  if (!existsSync(b.log)) return []
  return readFileSync(b.log, 'utf8')
    .split('--call-end--\n')
    .filter(Boolean)
    .map((c) => c.split('\n').slice(0, -1))
}

/** The one curl call a run made; fails the test when there was none, or more. */
function onlyCall(b: Bed): string[] {
  const all = calls(b)
  const call = all[0]
  if (all.length !== 1 || !call) throw new Error(`expected one curl call, saw ${all.length}`)
  return call
}

/** The value of one `--data-urlencode name=value` pair of a recorded curl call. */
function param(call: string[], name: string): string | undefined {
  const pair = call.find((a, k) => call[k - 1] === '--data-urlencode' && a.startsWith(`${name}=`))
  return pair?.slice(name.length + 1)
}

const ROWS = JSON.stringify({
  result: [
    { timestamp: '2026-11-01T10:42:09.250000', severity_text: 'ERROR', event_message: 'canceling statement\ndue to statement timeout' },
    { timestamp: '2026-11-01T10:41:00.000000', severity_text: null, event_message: 'no severity here' },
    { timestamp: '2026-11-01T10:40:31.500000', severity_text: 'LOG', event_message: 'checkpoint starting: time' },
  ],
})

describe('scripts/pg-logs.sh, run against a stand-in endpoint (v2.6318)', () => {
  it('asks the unified logs endpoint for the Postgres source, newest first, and prints oldest first', () => {
    const b = bed(ROWS)
    const r = run(b, [START, END])
    expect(r.status).toBe(0)
    expect(r.err).toBe('rows: 3\n')
    expect(r.out.split('\n').filter(Boolean)).toEqual([
      '2026-11-01 10:40:31 LOG checkpoint starting: time',
      '2026-11-01 10:41:00 - no severity here',
      '2026-11-01 10:42:09 ERROR canceling statement due to statement timeout',
    ])
    const call = onlyCall(b)
    expect(call).toContain('https://api.supabase.com/v1/projects/yewfzhbofbbyvkvtaatw/analytics/endpoints/logs')
    expect(call).toContain('Authorization: Bearer tok-test')
    expect(param(call, 'iso_timestamp_start')).toBe(START)
    expect(param(call, 'iso_timestamp_end')).toBe(END)
    expect(param(call, 'sql')).toMatch(
      /^select timestamp, severity_text, event_message from logs where source = 'postgres_logs' and match\(event_message, unhex\('2e'\)\) order by timestamp desc limit 200$/,
    )
  })

  it('sends the regex as hex, so a backslash, a quote or a flag reaches it as typed', () => {
    const b = bed(ROWS)
    const re = String.raw`(?i)it's \d+|a\\b`
    expect(run(b, [START, END, re]).status).toBe(0)
    const sql = param(onlyCall(b), 'sql')
    expect(sql).toContain(`unhex('${Buffer.from(re).toString('hex')}')`)
    expect(sql).not.toContain("it's")
    expect(sql).not.toContain('\\')
  })

  it('reads the token from .env.local when the environment has none', () => {
    const b = bed(ROWS)
    writeFileSync(join(b.dir, '.env.local'), 'OTHER=1\nSUPABASE_MGMT_TOKEN="from-file"\n')
    expect(run(b, [START, END], {}).status).toBe(0)
    expect(onlyCall(b)).toContain('Authorization: Bearer from-file')
  })

  it.each([
    ['no .env.local', null],
    ['a .env.local with no token line', 'OTHER=1\n'],
  ])('stops with a plain line, before any call, on %s', (_name, file) => {
    const b = bed(ROWS)
    if (file != null) writeFileSync(join(b.dir, '.env.local'), file)
    const r = run(b, [START, END], {})
    expect(r.status).toBe(2)
    expect(r.err).toContain('SUPABASE_MGMT_TOKEN missing')
    expect(calls(b)).toEqual([])
  })

  describe('stops before any call on what the endpoint would cut without saying so', () => {
    it.each([
      ['a window over 24 hours', ['2026-10-26T00:00:00Z', '2026-11-01T00:00:00Z'], 'over 24 hours'],
      ['a window of 24 hours and a second', ['2026-11-01T00:00:00Z', '2026-11-02T00:00:01Z'], 'over 24 hours'],
      ['an end before the start', [END, START], 'iso_end must be after iso_start'],
      ['a time with an offset, which the endpoint refuses', ['2026-11-01T10:00:00+00:00', END], 'ending in Z'],
      ['a time with no zone', ['2026-11-01T10:00:00', '2026-11-01T11:00:00'], 'ending in Z'],
      ['a start that is not a time', ['yesterday', END], 'ending in Z'],
      ['a limit over 1000', [START, END, '.', '1001'], 'over 1000'],
      ['a limit too long to be a number of rows', [START, END, '.', '99999999999'], 'over 1000'],
      ['a limit that is not a number', [START, END, '.', 'ten'], 'whole number'],
    ])('%s', (_name, args, words) => {
      const b = bed(ROWS)
      const r = run(b, args)
      expect(r.status).toBe(2)
      expect(r.err).toContain(words)
      expect(r.out).toBe('')
      expect(calls(b)).toEqual([])
    })

    it('but takes exactly 24 hours, a limit of 1000 and a limit with leading zeros', () => {
      const b = bed(ROWS)
      expect(run(b, ['2026-11-01T00:00:00Z', '2026-11-02T00:00:00Z', '.', '1000']).status).toBe(0)
      expect(run(b, [START, END, '.', '0200']).status).toBe(0)
      expect(calls(b).map((c) => param(c, 'sql')?.match(/limit (\d+)$/)?.[1])).toEqual(['1000', '200'])
    })
  })

  it('says so when the rows reach the limit, so older matches are not mistaken for none', () => {
    const b = bed(ROWS)
    expect(run(b, [START, END, '.', '3']).err).toBe('rows: 3\nrows hit the limit, so older matches are cut: narrow the window or the regex\n')
    expect(run(b, [START, END, '.', '4']).err).toBe('rows: 3\n')
  })

  describe('shows a refused call as an error, never as an empty result', () => {
    it.each([
      ['a refused query', '{"error":"Field \\"level\\" does not exist."}', 'ERROR: Field "level" does not exist.'],
      ['a refused timestamp', '{"message":"iso_timestamp_start: Invalid ISO datetime"}', 'ERROR: iso_timestamp_start: Invalid ISO datetime'],
      ['a bad token', '{"message":"Invalid access token"}', 'ERROR: Invalid access token'],
      ['the rate limit', '{"message":"ThrottlerException: Too Many Requests"}', '10 calls a minute: wait a minute and retry'],
      ['no answer at all', '', 'no JSON back from the endpoint'],
      ['a page that is not JSON', '<html>502 Bad Gateway</html>', 'no JSON back from the endpoint: <html>502 Bad Gateway</html>'],
    ])('%s', (_name, body, words) => {
      const r = run(bed(body), [START, END])
      expect(r.status).toBe(1)
      expect(r.err).toContain(words)
      expect(r.out).toBe('')
    })

    it('but a good answer with no rows is rows: 0', () => {
      const r = run(bed('{"result":[]}'), [START, END])
      expect(r.status).toBe(0)
      expect(r.err).toBe('rows: 0\n')
      expect(r.out).toBe('')
    })
  })
})
