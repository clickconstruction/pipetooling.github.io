/**
 * Messages → My email (punch list #230 PR 3): the card on Settings → Your account, **My email in Messages** (the
 * mock-up's section 4). Its one switch, *Show my mail on the My email tab*, is on by default for every office member
 * (the owner's word, 2026-11-01); the person turns it off here. The card says what the tab reads and what it keeps
 * every time it is drawn, and holds the Gmail labels the person leaves out (a *Personal* label), each once whatever its
 * case, as `my_mail_set` saves them: twenty at most, each as long as Gmail lets a label be. Inbox and Sent are what
 * the tab reads, and Drafts, Spam and Trash are never read, so none of those is a label to leave out. Pure.
 */
import { MY_MAIL_GMAIL_LABEL } from './contract'

/** How many labels a person may leave out (`my_mail_set`'s own limit). */
export const MY_MAIL_HIDDEN_MAX = 20

/** The longest Gmail label (`my_mail_set`'s own limit). */
export const MY_MAIL_LABEL_MAX = 225

export const MY_MAIL_CARD_WORDS = {
  title: 'My email in Messages',
  switch: 'Show my mail on the My email tab',
  on: 'On',
  off: 'Off',
  reads: (address: string): string =>
    address.trim()
      ? `Reads ${address.trim()}, your Inbox and Sent, live. Nothing is kept until you tag a conversation.`
      : 'Reads your own Inbox and Sent, live. Nothing is kept until you tag a conversation.',
  tag: 'A tag copies that conversation onto the job, where the office team reads it.',
  untag: 'Untag takes it back, unless the office already put it on a legal matter.',
  never: 'Never read: Drafts, Spam, Trash, and any label you name here.',
  gmailLabel: `Nothing writes to your Gmail except the label ${MY_MAIL_GMAIL_LABEL} on a tagged mail.`,
  onlyYou: 'Only you see this tab. Nobody on the team reads your mail through the app.',
  hidden: 'Labels left out',
  addLabel: '+ a label',
  labelBox: 'A Gmail label to leave out',
  labelHint: 'Personal',
  leaveOut: 'Leave it out',
  cancel: 'Cancel',
  showAgain: (label: string): string => `Show ${label} again`,
  saved: 'Saved.',
  notSaved: 'Your mail switch was not saved.',
  loading: 'Reading your mail switch…',
  notRead: 'Your mail switch could not be read.',
  wait: 'The switch arrives with the next database update. Until then your mail shows on the tab.',
  tooMany: 'Leave out twenty labels at most.',
  tooLong: `A Gmail label is ${MY_MAIL_LABEL_MAX} characters at most.`,
  readAnyway: 'Inbox and Sent are what this tab reads.',
  neverAnyway: 'Drafts, Spam and Trash are never read.',
  already: (label: string): string => `${label} is left out already.`,
} as const

const fold = (label: string): string => label.trim().toLowerCase()

/** The labels as `my_mail_set` keeps them: trimmed, the empty ones dropped, each once whatever its case, in the order given. */
export function cleanHiddenLabels(labels: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of labels) {
    const label = raw.trim()
    if (!label || seen.has(fold(label))) continue
    seen.add(fold(label))
    out.push(label)
  }
  return out
}

/** The labels the tab reads, and the ones it never reads, by the names Gmail shows. */
const READ = new Set(['inbox', 'sent', 'sent mail'])
const NEVER = new Set(['draft', 'drafts', 'spam', 'trash', 'bin', 'chat', 'chats'])

/** Why a label cannot be left out, in words, or null. A blank label is no label and asks nothing. */
export function hiddenLabelProblem(labels: readonly string[], label: string): string | null {
  const name = label.trim()
  if (!name) return null
  if (READ.has(fold(name))) return MY_MAIL_CARD_WORDS.readAnyway
  if (NEVER.has(fold(name))) return MY_MAIL_CARD_WORDS.neverAnyway
  if (name.length > MY_MAIL_LABEL_MAX) return MY_MAIL_CARD_WORDS.tooLong
  const kept = cleanHiddenLabels(labels)
  if (kept.some((l) => fold(l) === fold(name))) return MY_MAIL_CARD_WORDS.already(kept.find((l) => fold(l) === fold(name)) ?? name)
  if (kept.length >= MY_MAIL_HIDDEN_MAX) return MY_MAIL_CARD_WORDS.tooMany
  return null
}

/** The labels with one more left out, at the end; the same list when the label cannot be. */
export function withHiddenLabel(labels: readonly string[], label: string): string[] {
  const kept = cleanHiddenLabels(labels)
  return label.trim() && !hiddenLabelProblem(kept, label) ? [...kept, label.trim()] : kept
}

/** The labels with one shown again, whatever its case. */
export function withoutHiddenLabel(labels: readonly string[], label: string): string[] {
  return cleanHiddenLabels(labels).filter((l) => fold(l) !== fold(label))
}
