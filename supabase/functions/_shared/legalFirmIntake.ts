import { APP_CALENDAR_TZ } from './appTimeZone.ts'

/**
 * The firm's answers to Start here's questions (v2.4821, the owner's intake flow of 2026-10-07):
 * what else the firm wants with each matter, where it prefers to file, whether it e-files and serves
 * through the constable, and whether it signs off the Texas lien rules the app follows. The firm
 * sends them from its portal (`submit-legal-portal`, kind `intake`); they land on the firm's row
 * (`legal_firms.intake`), and the Legal desk's firm door shows a dot until someone in the office
 * reads them. One shape for the function, the portal and the desk; `src/lib/legal/legalFirmIntake.ts`
 * is the client's door.
 */

export type LegalFirmIntake = {
  needs: string
  fileWhere: string
  efile: '' | 'yes' | 'no'
  constable: '' | 'yes' | 'no' | 'depends'
  rules: '' | 'signed' | 'changes'
  rulesNote: string
}

export const EMPTY_LEGAL_FIRM_INTAKE: LegalFirmIntake = { needs: '', fileWhere: '', efile: '', constable: '', rules: '', rulesNote: '' }

/** The longest answer kept; the box asks for a line or a short note, not a brief. */
export const LEGAL_INTAKE_TEXT_MAX = 1000

const text = (v: unknown, max = LEGAL_INTAKE_TEXT_MAX): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
function pick<T extends string>(v: unknown, allowed: ReadonlyArray<T>): T | '' {
  return typeof v === 'string' && (allowed as ReadonlyArray<string>).includes(v) ? (v as T) : ''
}

/** Whatever arrived, as the shape: texts trimmed and capped, a choice that is not one of ours dropped. */
export function shapeLegalFirmIntake(raw: unknown): LegalFirmIntake {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const rules = pick(r.rules, ['signed', 'changes'] as const)
  return {
    needs: text(r.needs),
    fileWhere: text(r.fileWhere, 300),
    efile: pick(r.efile, ['yes', 'no'] as const),
    constable: pick(r.constable, ['yes', 'no', 'depends'] as const),
    rules,
    // A note on the rules travels only with "changes needed".
    rulesNote: rules === 'changes' ? text(r.rulesNote) : '',
  }
}

export function legalIntakeHasAnswers(i: LegalFirmIntake): boolean {
  return Boolean(i.needs || i.fileWhere || i.efile || i.constable || i.rules)
}

export type LegalIntakeQuestion =
  | { key: 'needs' | 'fileWhere' | 'rulesNote'; kind: 'text' | 'line'; label: string; placeholder: string }
  | { key: 'efile' | 'constable' | 'rules'; kind: 'choice'; label: string; choices: ReadonlyArray<readonly [string, string]> }

/** The questions, in order, in the firm's words. `rulesNote` shows only when the rules need changes. */
export function legalIntakeQuestions(short: string): LegalIntakeQuestion[] {
  return [
    { key: 'needs', kind: 'text', label: 'What else do you want with each matter?', placeholder: 'For example, the W-9 or the original bid.' },
    { key: 'fileWhere', kind: 'line', label: 'Where do you prefer to file when the rules give a choice?', placeholder: 'For example, a county and a precinct.' },
    { key: 'efile', kind: 'choice', label: 'Do you e-file?', choices: [['yes', 'Yes'], ['no', 'No']] },
    { key: 'constable', kind: 'choice', label: 'Do you serve papers through the constable?', choices: [['yes', 'Yes'], ['no', 'No'], ['depends', 'It depends']] },
    { key: 'rules', kind: 'choice', label: `Have you read the Texas lien rules ${short} follows?`, choices: [['signed', 'Signed off'], ['changes', 'Changes needed']] },
    { key: 'rulesNote', kind: 'line', label: 'What should change?', placeholder: 'Name the rule and what it should say.' },
  ]
}

/** The step's opening words. */
export function legalIntakeIntro(short: string): string {
  return `Five questions. Your answers go to ${short}. Change any of them later and send again.`
}

/** Each question with its answer, for the office; an unanswered one reads as a dash. */
export function legalIntakeAnswerRows(i: LegalFirmIntake, short: string): Array<{ key: string; question: string; answer: string }> {
  const rows: Array<{ key: string; question: string; answer: string }> = []
  for (const q of legalIntakeQuestions(short)) {
    if (q.key === 'rulesNote') {
      if (i.rules === 'changes') rows.push({ key: q.key, question: q.label, answer: i.rulesNote || '—' })
      continue
    }
    const raw = i[q.key]
    const answer = q.kind === 'choice' ? (q.choices.find(([v]) => v === raw)?.[1] ?? '') : raw
    rows.push({ key: q.key, question: q.label, answer: answer || '—' })
  }
  return rows
}

/** `Sent Oct 7 by Ann Sample.` — the day in the company's zone; '' when nothing was sent. */
export function legalIntakeSentWords(sentAt: string | null | undefined, by: string | null | undefined): string {
  if (!sentAt) return ''
  const d = new Date(sentAt)
  if (Number.isNaN(d.getTime())) return ''
  const day = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric' }).format(d)
  const who = (by ?? '').trim()
  return who ? `Sent ${day} by ${who}.` : `Sent ${day}.`
}

/** True while the office has not read the latest answers: the desk's firm door wears a dot. */
export function legalIntakeUnseen(row: { intake_sent_at?: string | null; intake_seen_at?: string | null } | null | undefined): boolean {
  if (!row?.intake_sent_at) return false
  if (!row.intake_seen_at) return true
  return new Date(row.intake_seen_at).getTime() < new Date(row.intake_sent_at).getTime()
}
