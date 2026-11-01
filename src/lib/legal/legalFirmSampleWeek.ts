/**
 * The sample inbox on the firm portal's Notifications tab (punch list #233, v2.6280): a made-up week
 * of the seven events the office sends, drawn through the real builders in `_shared/legalEmails.ts`,
 * so what the add card shows under a rule is what the person will get: the same subjects, the same
 * frame, the same stop link. The accounts are invented and the caption says so; one of them is
 * handled by the person being added, so *Only theirs* narrows to it, and a fee the office saw sits
 * dim under *Each event*, because that one rides the digest only (`legalTriggerSendsNow`). Pure.
 */
import { buildLegalDigestEmail, buildLegalNowEmail, legalTriggerSendsNow, type LegalEmail, type LegalNowTrigger } from '../legalEmails'
import { WEEKDAY_LABELS } from './legalMatters'

/** The inbox's own words, held to plain words by `legalFirmSampleWeek.test.ts`. */
export const FIRM_INBOX_WORDS = {
  sample: 'a sample week',
  digestOnly: 'weekly digest only',
  opened: 'Opened',
} as const

/** The caption over the list: *What lands in Dana's inbox*; *their* until a name is typed. */
export function firmInboxCaption(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? ''
  return first ? `What lands in ${first}'s inbox` : 'What lands in their inbox'
}

export type FirmInboxRule = { mode: 'now' | 'digest'; scope: 'all' | 'mine'; digestWeekday: number }
export type FirmInboxLine = { key: string; day: string; subject: string; dim: boolean }
export type FirmSampleInbox = { lines: FirmInboxLine[]; firstKey: string | null; email: (key: string) => LegalEmail | null }

type SampleMatter = { payer: string; stage: string; theirs: boolean; daysAgo: number }
/** Three invented accounts, never a firm's real matter: a sample *Referral withdrawn* on a real one would read as news. */
const SAMPLE_MATTERS: readonly SampleMatter[] = [
  { payer: 'Ridgeway Builders', stage: 'referred', theirs: true, daysAgo: 6 },
  { payer: 'Cedar Bend Homes', stage: 'demand', theirs: false, daysAgo: 20 },
  { payer: 'Northline Builders', stage: 'suit', theirs: false, daysAgo: 32 },
]
type SampleEvent = { daysAgo: number; trigger: LegalNowTrigger; payer: string; note?: string; body?: string; question?: string; amount?: number; reason?: string }
/** One line per event the builders know, oldest first; the fee last, since it never sends on its own. */
const SAMPLE_WEEK: readonly SampleEvent[] = [
  { daysAgo: 6, trigger: 'referred', payer: 'Ridgeway Builders', note: 'Signed subcontract on file. The GC disputes the change order.' },
  { daysAgo: 5, trigger: 'ask', payer: 'Ridgeway Builders', body: 'Do you have the signed change order for the add?' },
  { daysAgo: 4, trigger: 'answer', payer: 'Cedar Bend Homes', question: 'Was the final bill sent certified?', body: 'Yes, certified mail. The green card is on the Paper tab.' },
  { daysAgo: 3, trigger: 'note', payer: 'Northline Builders', body: 'The GC called. They say a check went out Friday.' },
  { daysAgo: 2, trigger: 'applied', payer: 'Cedar Bend Homes', amount: 4200 },
  { daysAgo: 2, trigger: 'pulled', payer: 'Northline Builders', reason: 'paid in full' },
  { daysAgo: 2, trigger: 'fee_seen', payer: 'Ridgeway Builders', amount: 450 },
]

function dayBefore(preparedOn: string, daysAgo: number): Date {
  const d = new Date(`${preparedOn}T18:00:00Z`)
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d
}

/** The day's short name, Mon to Sun, from the sample's instant. */
function dayLabel(d: Date): string {
  const dow = d.getUTCDay()
  return WEEKDAY_LABELS[dow === 0 ? 7 : dow] ?? 'Mon'
}

export function firmSampleInbox(i: { companyName: string; firmName: string; otherHandling: string; name: string; rule: FirmInboxRule; preparedOn: string }): FirmSampleInbox {
  const who = i.name.trim() || 'you'
  const handlingOf = (payer: string): string => (SAMPLE_MATTERS.find((m) => m.payer === payer)?.theirs ? who : i.otherHandling)
  const sees = (payer: string): boolean => i.rule.scope === 'all' || Boolean(SAMPLE_MATTERS.find((m) => m.payer === payer)?.theirs)
  const matters = SAMPLE_MATTERS.filter((m) => sees(m.payer))
  const events = SAMPLE_WEEK.filter((e) => sees(e.payer))
  const links = { portalUrl: '#', unsubscribeUrl: '#' }
  const keyOf = (e: SampleEvent) => `${e.trigger}:${e.payer}`
  if (i.rule.mode === 'digest') {
    const mail = buildLegalDigestEmail({
      companyName: i.companyName,
      recipientName: who,
      matters: matters.map((m) => ({ payerName: m.payer, stage: m.stage, handlingName: handlingOf(m.payer), releasedAt: dayBefore(i.preparedOn, m.daysAgo).toISOString() })),
      events: events.map((e) => ({ createdAt: dayBefore(i.preparedOn, e.daysAgo).toISOString(), trigger: e.trigger, payer: e.payer, body: e.body ?? null, reason: e.reason ?? null, amount: e.amount ?? null })),
      ...links,
    })
    const wd = i.rule.digestWeekday >= 1 && i.rule.digestWeekday <= 7 ? i.rule.digestWeekday : 1
    return { lines: [{ key: 'digest', day: WEEKDAY_LABELS[wd] ?? 'Mon', subject: mail.subject, dim: false }], firstKey: 'digest', email: (key) => (key === 'digest' ? mail : null) }
  }
  const now = (e: SampleEvent): LegalEmail =>
    buildLegalNowEmail({ companyName: i.companyName, firmName: i.firmName, trigger: e.trigger, payer: e.payer, handling: handlingOf(e.payer), note: e.note ?? null, body: e.body ?? null, question: e.question ?? null, amount: e.amount ?? null, reason: e.reason ?? null, ...links })
  const lines = events.map((e) => ({ key: keyOf(e), day: dayLabel(dayBefore(i.preparedOn, e.daysAgo)), subject: now(e).subject, dim: !legalTriggerSendsNow(e.trigger) }))
  return {
    lines,
    firstKey: lines.find((l) => !l.dim)?.key ?? null,
    email: (key) => {
      const e = events.find((x) => keyOf(x) === key)
      return e && legalTriggerSendsNow(e.trigger) ? now(e) : null
    },
  }
}
