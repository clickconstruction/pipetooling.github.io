import { describe, expect, it } from 'vitest'
import {
  NO_SOURCE_LABEL,
  describeSourceVariants,
  distinctTeamProspectSources,
  normalizeSourceKey,
  normalizeTeamProspectSource,
  registrableHost,
  summarizeTeamProspectSources,
} from './teamProspectSourceSummary'

function row(source: string | null, status = 'active') {
  return { source, status }
}

const INDEED_URL_A =
  'https://employers.indeed.com/candidates/view?id=aWQ9YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXo&from=list&sid=1'
const INDEED_URL_B =
  'https://employers.indeed.com/candidates/view?id=aWQ9enl4d3Z1dHNycXBvbm1sa2ppaGdmZWRjYmE&from=list&sid=2'

describe('normalizeTeamProspectSource', () => {
  // raw input → [key, label]
  const matrix: Array<[string | null, string, string]> = [
    [INDEED_URL_A, 'indeed', 'Indeed'],
    [INDEED_URL_B, 'indeed', 'Indeed'],
    ['https://www.indeed.com/viewjob?jk=123', 'indeed', 'Indeed'],
    ['m.indeed.com/jobs?q=plumber', 'indeed', 'Indeed'],
    ['apply.indeed.com/x', 'indeed', 'Indeed'],
    ['indeed.com', 'indeed', 'Indeed'],
    ['Indeed ad', 'indeed', 'Indeed'],
    ['INDEED', 'indeed', 'Indeed'],
    ['  indeed  ', 'indeed', 'Indeed'],
    ['https://www.ziprecruiter.com/c/Acme/Job/Plumber/-in-Austin,TX', 'ziprecruiter', 'ZipRecruiter'],
    ['zip recruiter', 'ziprecruiter', 'ZipRecruiter'],
    ['https://austin.craigslist.org/trd/d/plumber/7712345678.html', 'craigslist', 'Craigslist'],
    ['craigslist', 'craigslist', 'Craigslist'],
    ['https://m.facebook.com/groups/austinplumbers/posts/1', 'facebook', 'Facebook'],
    ['FB marketplace', 'facebook', 'Facebook'],
    ['https://www.linkedin.com/in/some-plumber/', 'linkedin', 'LinkedIn'],
    ['Linked In', 'linkedin', 'LinkedIn'],
    ['https://app.joinhandshake.com/stu/jobs/1', 'handshake', 'Handshake'],
    ['handshake', 'handshake', 'Handshake'],
    ['Referral', 'referral', 'Referral'],
    ['referred by Marco', 'referral', 'Referral'],
    ['employee referral', 'referral', 'Referral'],
    ['walk-in', 'walk-in', 'Walk-in'],
    ['Walked in', 'walk-in', 'Walk-in'],
    ['walkin', 'walk-in', 'Walk-in'],
    ['https://jobs.example-plumbing.com/apply/42', 'example-plumbing.com', 'example-plumbing.com'],
    ['https://careers.acme.co.uk/roles/9', 'acme.co.uk', 'acme.co.uk'],
    ['job  board', 'job board', 'job board'],
    ['Trade school', 'trade school', 'Trade school'],
    [null, '', NO_SOURCE_LABEL],
    ['   ', '', NO_SOURCE_LABEL],
  ]

  it.each(matrix)('%s → key %s / label %s', (raw, key, label) => {
    expect(normalizeTeamProspectSource(raw)).toEqual({ key, label })
    expect(normalizeSourceKey(raw)).toBe(key)
  })

  it('does not mistake sentences with a dot for URLs', () => {
    expect(normalizeTeamProspectSource('Met at supply house. Good guy')).toEqual({
      key: 'met at supply house. good guy',
      label: 'Met at supply house. Good guy',
    })
  })
})

describe('registrableHost', () => {
  it('keeps the last two labels, or three under a ccTLD second level', () => {
    expect(registrableHost('employers.indeed.com')).toBe('indeed.com')
    expect(registrableHost('indeed.com')).toBe('indeed.com')
    expect(registrableHost('jobs.example.co.uk')).toBe('example.co.uk')
    expect(registrableHost('a.b.c.example.com.au')).toBe('example.com.au')
    expect(registrableHost('localhost')).toBe('localhost')
  })
})

describe('summarizeTeamProspectSources', () => {
  it('groups every pasted Indeed URL and hand-typed "Indeed" into one row', () => {
    const out = summarizeTeamProspectSources([
      row(INDEED_URL_A, 'hired'),
      row(INDEED_URL_B, 'passed'),
      row('Indeed'),
      row('indeed.com'),
      row('https://www.indeed.com/viewjob?jk=1', 'hired'),
    ])
    expect(out).toHaveLength(1)
    expect(out[0]!.label).toBe('Indeed')
    expect(out[0]!.total).toBe(5)
    expect(out[0]!.hired).toBe(2)
    expect(out[0]!.passed).toBe(1)
    expect(out[0]!.active).toBe(2)
    expect(out[0]!.hireRate).toBeCloseTo(2 / 3)
    expect(out[0]!.variants).toEqual([INDEED_URL_A, INDEED_URL_B, 'Indeed', 'indeed.com', 'https://www.indeed.com/viewjob?jk=1'])
  })

  it('groups case- and whitespace-insensitively, using the board label', () => {
    const out = summarizeTeamProspectSources([
      row('Referral', 'hired'),
      row('referral '),
      row('  REFERRAL', 'passed'),
    ])
    expect(out).toHaveLength(1)
    expect(out[0]!.label).toBe('Referral')
    expect(out[0]!.total).toBe(3)
    expect(out[0]!.active).toBe(1)
    expect(out[0]!.hired).toBe(1)
    expect(out[0]!.passed).toBe(1)
    expect(out[0]!.variants).toEqual(['Referral', 'referral', 'REFERRAL'])
  })

  it('keeps first-seen spelling for unrecognized free text and collapses inner whitespace', () => {
    const out = summarizeTeamProspectSources([row('Job  Board'), row('job board')])
    expect(out).toHaveLength(1)
    expect(out[0]!.label).toBe('Job Board')
    expect(out[0]!.total).toBe(2)
  })

  it('keeps unknown hosts apart from each other and from known boards', () => {
    const out = summarizeTeamProspectSources([
      row('https://jobs.acme.com/1'),
      row('https://acme.com/careers/2'),
      row('https://other.example.org/3'),
      row(INDEED_URL_A),
    ])
    expect(out.map((r) => r.label).sort()).toEqual(['Indeed', 'acme.com', 'example.org'])
    expect(out.find((r) => r.label === 'acme.com')!.total).toBe(2)
  })

  it('buckets blank/null sources under (no source) with no variants', () => {
    const out = summarizeTeamProspectSources([row(null), row('   '), row('')])
    expect(out).toHaveLength(1)
    expect(out[0]!.label).toBe(NO_SOURCE_LABEL)
    expect(out[0]!.total).toBe(3)
    expect(out[0]!.variants).toEqual([])
  })

  it('computes hire rate over decided candidates only', () => {
    const out = summarizeTeamProspectSources([
      row('indeed', 'hired'),
      row('indeed', 'passed'),
      row('indeed', 'passed'),
      row('indeed', 'active'),
    ])
    expect(out[0]!.hireRate).toBeCloseTo(1 / 3)
  })

  it('hire rate is null when nobody has been decided', () => {
    const out = summarizeTeamProspectSources([row('walk-in'), row('walk-in')])
    expect(out[0]!.hireRate).toBeNull()
  })

  it('treats unknown statuses as active (matches board grouping)', () => {
    const out = summarizeTeamProspectSources([row('x', 'weird_status')])
    expect(out[0]!.active).toBe(1)
  })

  it('sorts by hires desc, then total desc, then label', () => {
    const out = summarizeTeamProspectSources([
      row('small', 'hired'),
      row('big', 'hired'),
      row('big', 'hired'),
      row('busy'),
      row('busy'),
      row('busy'),
      row('alpha'),
      row('beta'),
    ])
    expect(out.map((r) => r.label)).toEqual(['big', 'small', 'busy', 'alpha', 'beta'])
  })

  it('returns empty for no rows', () => {
    expect(summarizeTeamProspectSources([])).toEqual([])
  })
})

describe('distinctTeamProspectSources', () => {
  it('offers one board label per group (not one entry per pasted URL), alphabetically, skipping blanks', () => {
    const out = distinctTeamProspectSources([
      row('Referral'),
      row('referral'),
      row(INDEED_URL_A),
      row(INDEED_URL_B),
      row('Indeed'),
      row(null),
      row('  '),
      row('walk-in'),
      row('Trade school'),
    ])
    expect(out).toEqual(['Indeed', 'Referral', 'Trade school', 'Walk-in'])
  })
})

describe('describeSourceVariants', () => {
  it('is null for a single spelling', () => {
    expect(describeSourceVariants(['Indeed'])).toBeNull()
    expect(describeSourceVariants([])).toBeNull()
  })

  it('counts, previews (truncated), and tails off with "and N more"', () => {
    const long = 'https://employers.indeed.com/candidates/view?id=' + 'x'.repeat(200)
    const text = describeSourceVariants(['Indeed', 'indeed.com', long, 'd', 'e', 'f', 'g'], 5, 60)!
    expect(text.startsWith('7 variants grouped here:\n')).toBe(true)
    expect(text).toContain('Indeed\nindeed.com\n')
    expect(text).toContain('…')
    expect(text).not.toContain('x'.repeat(100))
    expect(text.endsWith('…and 2 more')).toBe(true)
  })
})
