import { describe, expect, it } from 'vitest'
import { KEEP_FILE_BYTES } from '../emailIn/emailLine'
import type { EmailAddress, EmailFile, EmailIn } from '../emailIn/gmailMessage'
import { MY_MAIL_GMAIL_LABEL, type MyMailJobChip } from './contract'
import { MY_MAIL_MAILBOX, planTag, type MyMailKnown, type MyMailPerson, type MyMailTagStep } from './tagPlan'

// Made-up people: Marisol Vega (the estimator whose box it is) and Rosa Diaz in the office; Dale Okafor at Ridgeway
// Builders, the customer on 4 Elm Ct.
const marisolAt: EmailAddress = { name: 'Marisol Vega', address: 'marisol@clickplumbing.example' }
const rosaAt: EmailAddress = { name: 'Rosa Diaz', address: 'rosa@clickplumbing.example' }
const daleAt: EmailAddress = { name: 'Dale Okafor', address: 'dale@ridgeway.example' }
const marisol: MyMailPerson = { userId: 'u-marisol', address: 'Marisol@ClickPlumbing.example', name: 'Marisol Vega' }
const elm: MyMailJobChip = { kind: 'pipeline', id: 'job-elm', key: 'pipeline:job-elm', num: 'JP1077', name: '4 Elm Ct' }
const harborKey = 'pipeline:job-harbor'

const known = (byMessageId: MyMailKnown['byMessageId'] = {}): MyMailKnown => ({
  byMessageId,
  team: { 'marisol@clickplumbing.example': { userId: 'u-marisol', name: 'Marisol Vega' }, 'rosa@clickplumbing.example': { userId: 'u-rosa', name: 'Rosa Diaz' } },
  boxes: ['bids@clickplumbing.example', 'team@clickplumbing.example', 'team@noreply.clicktooling.example'],
})

const file = (over: Partial<EmailFile>): EmailFile => ({ partId: '1', name: 'elm-ct-spec-sheet.pdf', mime: 'application/pdf', size: 212_000, attachmentId: 'att-spec', data: null, inline: false, ...over })

const email = (gmailId: string, over: Partial<EmailIn> = {}): EmailIn => ({
  gmailId,
  threadId: 't-elm',
  labels: ['INBOX'],
  at: '2026-11-01T15:12:00.000Z',
  from: daleAt,
  to: [marisolAt],
  cc: [],
  subject: 'Re: 4 Elm Ct water heater',
  text: 'Owner wants the 50-gal, not the 40.',
  links: [],
  files: [],
  headers: { 'message-id': `<${gmailId}@mail.example>` },
  ...over,
})

// The card's verify recipe: a three-mail conversation with one file. Dale writes with the spec sheet (and his logo),
// Marisol answers from her own box, Dale answers back.
const dale1 = email('g-dale-1', { files: [file({}), file({ partId: '2', name: 'logo.png', mime: 'image/png', size: 4_100, attachmentId: 'att-logo', inline: true })] })
const marisol1 = email('g-marisol-1', { labels: ['SENT'], at: '2026-11-01T16:30:00.000Z', from: marisolAt, to: [daleAt], text: '$340 more for the 50.' })
const dale2 = email('g-dale-2', { at: '2026-11-01T17:05:00.000Z', text: 'Go ahead with the 50.' })
const conversation = { threadId: 't-elm', messages: [dale1, marisol1, dale2] }

const kinds = (steps: MyMailTagStep[]) => steps.map((s) => (s.kind === 'skip' ? `skip:${s.why}` : s.kind === 'tie' ? `tie:${s.tie}` : `write:${s.direction}`))

describe('planTag: what a tag writes, mail by mail', () => {
  it('writes a three-mail conversation with one file: each line on the customer, Marisol’s own reply as ours', () => {
    const plan = planTag(conversation, marisol, elm, known())
    expect(plan.steps).toEqual([
      {
        kind: 'write',
        gmailId: 'g-dale-1',
        threadId: 't-elm',
        rfcMessageId: '<g-dale-1@mail.example>',
        direction: 'in',
        party: daleAt,
        whoUserId: null,
        whoText: "Dale Okafor <dale@ridgeway.example> to Marisol Vega's mail",
        subject: 'Re: 4 Elm Ct water heater',
        body: 'Owner wants the 50-gal, not the 40.',
        at: '2026-11-01T15:12:00.000Z',
        // The logo, a small picture in the body, is left out as the reader leaves it out.
        files: [{ partId: '1', attachmentId: 'att-spec', name: 'elm-ct-spec-sheet.pdf', mime: 'application/pdf', size: 212_000, keep: 'copy' }],
        links: [],
        emlName: 'g-dale-1.eml',
      },
      {
        kind: 'write',
        gmailId: 'g-marisol-1',
        threadId: 't-elm',
        rfcMessageId: '<g-marisol-1@mail.example>',
        direction: 'out',
        party: daleAt,
        whoUserId: 'u-marisol',
        whoText: "Marisol Vega <marisol@clickplumbing.example> to Dale Okafor <dale@ridgeway.example> · from Marisol Vega's mail",
        subject: 'Re: 4 Elm Ct water heater',
        body: '$340 more for the 50.',
        at: '2026-11-01T16:30:00.000Z',
        files: [],
        links: [],
        emlName: 'g-marisol-1.eml',
      },
      expect.objectContaining({ kind: 'write', gmailId: 'g-dale-2', direction: 'in', party: daleAt, whoUserId: null }),
    ])
    expect(plan.jobKey).toBe('pipeline:job-elm')
    expect(plan.jobColumns).toEqual({ bid_id: null, project_id: null, jobs_ledger_id: 'job-elm' })
    expect(plan.mailbox).toBe(MY_MAIL_MAILBOX)
    expect(plan.mailUserId).toBe('u-marisol')
    expect(plan.threadRow).toEqual({ user_id: 'u-marisol', gmail_thread_id: 't-elm', bid_id: null, project_id: null, jobs_ledger_id: 'job-elm', tagged_by: 'u-marisol' })
    expect(plan.label).toBe(MY_MAIL_GMAIL_LABEL)
    expect(plan.counts).toEqual({ lines: 3, tied: 0, files: 1, skipped: 0 })
  })

  it('ties a mail a line already holds and never writes it twice, leaving the office’s tie on another job where it is', () => {
    const plan = planTag(
      conversation,
      marisol,
      elm,
      known({
        '<g-dale-1@mail.example>': { messageId: 'm-1', jobKey: null },
        '<g-marisol-1@mail.example>': { messageId: 'm-2', jobKey: harborKey },
        '<g-dale-2@mail.example>': { messageId: 'm-3', jobKey: 'pipeline:job-elm' },
      }),
    )
    expect(plan.steps).toEqual([
      { kind: 'tie', gmailId: 'g-dale-1', rfcMessageId: '<g-dale-1@mail.example>', messageId: 'm-1', onJob: null, tie: true },
      { kind: 'tie', gmailId: 'g-marisol-1', rfcMessageId: '<g-marisol-1@mail.example>', messageId: 'm-2', onJob: harborKey, tie: false },
      { kind: 'tie', gmailId: 'g-dale-2', rfcMessageId: '<g-dale-2@mail.example>', messageId: 'm-3', onJob: 'pipeline:job-elm', tie: false },
    ])
    expect(plan.counts).toEqual({ lines: 0, tied: 1, files: 0, skipped: 0 })
  })

  it('moves the person’s own lines from an earlier tag onto the new job', () => {
    const plan = planTag(conversation, marisol, elm, known({ '<g-marisol-1@mail.example>': { messageId: 'm-2', jobKey: harborKey, mine: true } }))
    expect(plan.steps[1]).toEqual({ kind: 'tie', gmailId: 'g-marisol-1', rfcMessageId: '<g-marisol-1@mail.example>', messageId: 'm-2', onJob: harborKey, tie: true })
  })

  it('writes nothing more on a second tag of the same conversation', () => {
    const again = known({
      '<g-dale-1@mail.example>': { messageId: 'm-1', jobKey: 'pipeline:job-elm', mine: true },
      '<g-marisol-1@mail.example>': { messageId: 'm-2', jobKey: 'pipeline:job-elm', mine: true },
      '<g-dale-2@mail.example>': { messageId: 'm-3', jobKey: 'pipeline:job-elm', mine: true },
    })
    expect(planTag(conversation, marisol, elm, again).counts).toEqual({ lines: 0, tied: 0, files: 0, skipped: 0 })
  })

  it('never writes a draft, Spam, Trash or a chat, a copy of ours from a box or the app, or one Message-ID twice', () => {
    const plan = planTag(
      {
        threadId: 't-elm',
        messages: [
          email('g-draft', { labels: ['DRAFT'], from: marisolAt, to: [daleAt] }),
          email('g-trash', { labels: ['TRASH'] }),
          email('g-spam', { labels: ['SPAM'] }),
          email('g-chat', { labels: ['CHAT'] }),
          email('g-app', { from: { name: 'ClickTooling', address: 'team@noreply.clicktooling.example' } }),
          email('g-box', { from: { name: null, address: 'BIDS@clickplumbing.example' }, to: [daleAt] }),
          email('g-one', { headers: { 'message-id': '<same@ridgeway.example>' } }),
          email('g-two', { headers: { 'message-id': '<same@ridgeway.example>' } }),
          email('g-none', { headers: {} }),
        ],
      },
      marisol,
      elm,
      known(),
    )
    expect(kinds(plan.steps)).toEqual(['skip:draft', 'skip:spamOrTrash', 'skip:spamOrTrash', 'skip:chat', 'skip:noParty', 'skip:noParty', 'write:in', 'skip:twice', 'write:in'])
    expect(plan.steps[8]).toMatchObject({ kind: 'write', gmailId: 'g-none', rfcMessageId: null })
    expect(plan.counts).toEqual({ lines: 2, tied: 0, files: 0, skipped: 7 })
  })

  it('writes a note to self on the person’s own thread, coming in, as a teammate’s mail to the box is', () => {
    const plan = planTag({ threadId: 't-note', messages: [email('g-note', { from: marisolAt, to: [marisolAt], labels: ['SENT', 'INBOX'] })] }, marisol, elm, known())
    expect(plan.steps[0]).toMatchObject({ kind: 'write', direction: 'in', party: marisolAt, whoUserId: null, whoText: "Marisol Vega <marisol@clickplumbing.example> to Marisol Vega's mail" })
  })

  it('writes a teammate’s mail to the customer, the person copied, as ours to the customer under the teammate', () => {
    const plan = planTag({ threadId: 't-elm', messages: [email('g-rosa', { from: rosaAt, to: [marisolAt], cc: [daleAt] })] }, marisol, elm, known())
    expect(plan.steps[0]).toMatchObject({
      kind: 'write',
      direction: 'out',
      party: daleAt,
      whoUserId: 'u-rosa',
      whoText: "Rosa Diaz <rosa@clickplumbing.example> to Dale Okafor <dale@ridgeway.example> · from Marisol Vega's mail",
    })
  })

  it('lands the person’s mail to a teammate with the customer copied on the customer, and mail between teammates on the sender', () => {
    const toRosa = planTag({ threadId: 't-elm', messages: [email('g-cc', { from: marisolAt, to: [rosaAt], cc: [daleAt], labels: ['SENT'] })] }, marisol, elm, known())
    expect(toRosa.steps[0]).toMatchObject({ kind: 'write', direction: 'out', party: daleAt, whoUserId: 'u-marisol' })
    const between = planTag({ threadId: 't-elm', messages: [email('g-team', { from: rosaAt, to: [marisolAt] })] }, marisol, elm, known())
    expect(between.steps[0]).toMatchObject({ kind: 'write', direction: 'in', party: rosaAt, whoUserId: null })
  })

  it('names a file over 25 MB to leave in Gmail, keeps a file host’s link as a link, and writes no subject as none', () => {
    const big = email('g-big', {
      subject: '  ',
      files: [file({ name: 'elm-ct-plans.zip', mime: 'application/zip', size: KEEP_FILE_BYTES + 1 })],
      links: ['https://www.dropbox.com/scl/fi/abc/elm-ct-plans.pdf?dl=0', 'https://ridgeway.example/about'],
    })
    const step = planTag({ threadId: 't-elm', messages: [big] }, marisol, elm, known()).steps[0]
    expect(step).toMatchObject({
      kind: 'write',
      subject: null,
      files: [{ name: 'elm-ct-plans.zip', keep: 'tooBig' }],
      links: [{ name: 'elm-ct-plans.pdf', url: 'https://www.dropbox.com/scl/fi/abc/elm-ct-plans.pdf?dl=0', host: 'dropbox' }],
    })
  })

  it('never writes or ties a mail under a label the person leaves out, by Gmail’s id', () => {
    const personal = { ...dale2, labels: ['INBOX', 'Label_7'] }
    const plan = planTag({ threadId: 't-elm', messages: [dale1, personal] }, marisol, elm, { ...known({ '<g-dale-2@mail.example>': { messageId: 'm-3', jobKey: null } }), hidden: ['Label_7'] })
    expect(kinds(plan.steps)).toEqual(['write:in', 'skip:hidden'])
    expect(plan.counts).toEqual({ lines: 1, tied: 0, files: 1, skipped: 1 })
  })

  it('finds the person’s own line for a mail with no Message-ID by its Gmail id, and moves it with a tag onto another job', () => {
    const bare = { ...marisol1, headers: {} }
    const plan = planTag({ threadId: 't-elm', messages: [bare] }, marisol, elm, { ...known(), byGmailId: { 'g-marisol-1': { messageId: 'm-bare', jobKey: harborKey, mine: true } } })
    expect(plan.steps).toEqual([{ kind: 'tie', gmailId: 'g-marisol-1', rfcMessageId: null, messageId: 'm-bare', onJob: harborKey, tie: true }])
    expect(plan.counts).toEqual({ lines: 0, tied: 1, files: 0, skipped: 0 })
  })

  it('moves a box’s line the tag tied before (its row records it) with a tag onto another job, and never the office’s tie', () => {
    const plan = planTag(
      conversation,
      marisol,
      elm,
      known({
        '<g-dale-1@mail.example>': { messageId: 'm-1', jobKey: harborKey, tagTie: true },
        '<g-marisol-1@mail.example>': { messageId: 'm-2', jobKey: harborKey },
      }),
    )
    expect(kinds(plan.steps).slice(0, 2)).toEqual(['tie:true', 'tie:false'])
  })

  it('reads a mail in the person’s Sent as theirs from any address they sent it as: ours to the first one outside', () => {
    const alias = { name: 'Click Plumbing Estimating', address: 'estimating@clickplumbing.example' }
    const sent = email('g-alias', { labels: ['SENT'], from: alias, to: [daleAt], cc: [rosaAt] })
    expect(planTag({ threadId: 't-elm', messages: [sent] }, marisol, elm, known()).steps[0]).toMatchObject({
      kind: 'write',
      direction: 'out',
      party: daleAt,
      whoUserId: 'u-marisol',
      whoText: "Click Plumbing Estimating <estimating@clickplumbing.example> to Dale Okafor <dale@ridgeway.example> · from Marisol Vega's mail",
    })
    // Sent as a box: theirs, never a copy of ours to leave out.
    const asBids = email('g-as-bids', { labels: ['SENT'], from: { name: 'Bids', address: 'bids@clickplumbing.example' }, to: [daleAt] })
    expect(planTag({ threadId: 't-elm', messages: [asBids] }, marisol, elm, known()).steps[0]).toMatchObject({ kind: 'write', direction: 'out', party: daleAt, whoUserId: 'u-marisol' })
    // The same alias in the Inbox is someone writing in, as before.
    expect(planTag({ threadId: 't-elm', messages: [{ ...sent, labels: ['INBOX'] }] }, marisol, elm, known()).steps[0]).toMatchObject({ kind: 'write', direction: 'in', party: alias })
  })

  it('writes the person’s own note from an alias, with nobody outside, on their own thread', () => {
    const note = email('g-alias-note', { labels: ['SENT'], from: { name: 'Estimating', address: 'estimating@clickplumbing.example' }, to: [rosaAt] })
    expect(planTag({ threadId: 't-elm', messages: [note] }, marisol, elm, known()).steps[0]).toMatchObject({
      kind: 'write',
      direction: 'in',
      party: { name: 'Marisol Vega', address: 'Marisol@ClickPlumbing.example' },
      whoUserId: null,
    })
  })

  it('puts a bid or a GC project in its own column, and keys the job from its kind and id', () => {
    const bid = planTag(conversation, marisol, { kind: 'bid', id: 'bid-club', key: 'stale', num: 'BP523', name: 'Cedar Bend clubhouse' }, known())
    expect(bid.jobKey).toBe('bid:bid-club')
    expect(bid.job.key).toBe('bid:bid-club')
    expect(bid.threadRow).toMatchObject({ bid_id: 'bid-club', project_id: null, jobs_ledger_id: null })
    const project = planTag(conversation, marisol, { kind: 'project', id: 'proj-42', key: 'project:proj-42', num: '#42', name: 'Harbor clinic' }, known())
    expect(project.jobColumns).toEqual({ bid_id: null, project_id: 'proj-42', jobs_ledger_id: null })
  })
})
