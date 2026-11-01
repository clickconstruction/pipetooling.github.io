/**
 * Messages → My email (punch list #230 PR 3): one mail of the person's own Inbox or Sent, as the mock-up's list draws
 * it (`to-dos/messages-my-email/mockup.html`, section 1). Its way (↓ in, ↑ out), who with the address under the name,
 * the subject with the files and Gmail's snippet under it, the day, and the last column (`myMail/list.ts`'s `rowEnd`):
 * a tagged conversation's job with ✓ and *open the line ›*, the guess with **Yes** and *other…*, *already in Messages
 * ✓* for a mail a box holds on a job, or **Tag…**. A press on the rest of the row opens the reader. On a phone the row
 * is one column, the last column under the words. Nothing on a row says unread or counts anything.
 */
import type { CSSProperties } from 'react'
import type { MyMailRow } from '../../../lib/myMail/contract'
import { chipWords, filesWords, MY_MAIL_LIST_WORDS, rowDay, rowEnd, wayOf, whoLine } from '../../../lib/myMail/list'
import { Btn } from '../../gc/gcUi'
import { chipStyle, mutedSmall as muted, oneLine } from './myMailStyles'

const W = MY_MAIL_LIST_WORDS

export interface MyMailListRowProps {
  row: MyMailRow
  phone: boolean
  nowIso: string
  /** This row's conversation is being tagged: its presses wait. */
  busy: boolean
  /** A folded row, drawn under its fold line once shown. */
  dim?: boolean
  /** The reader, for the whole mail. */
  onOpen: () => void
  /** Yes: the conversation onto the guess. */
  onYes: () => void
  /** other… or Tag…: the job picker. */
  onPick: () => void
}

/** The last column. */
function RowEnd({ row, busy, onOpen, onYes, onPick }: Pick<MyMailListRowProps, 'row' | 'busy' | 'onOpen' | 'onYes' | 'onPick'>) {
  const end = rowEnd(row)
  if (busy) return <span style={muted}>{W.tagging}</span>
  switch (end.kind) {
    case 'tagged':
      return (
        <>
          <span style={chipStyle(end.chip, true)} data-my-mail-chip="tagged">
            ✓ {chipWords(end.chip)}
          </span>
          <Btn kind="quiet" onClick={onOpen}>
            {W.openLine}
          </Btn>
        </>
      )
    case 'inMessages':
      return (
        <span style={{ ...muted, fontWeight: 600 }} data-my-mail-chip="in-messages">
          {W.inMessages}
        </span>
      )
    case 'guess':
      return (
        <>
          <span style={chipStyle(end.chip)} title={end.why} data-my-mail-chip="guess">
            {chipWords(end.chip)}?
          </span>
          <Btn kind="primary" onClick={onYes} title={end.why}>
            {W.yes}
          </Btn>
          <Btn kind="quiet" onClick={onPick}>
            {W.other}
          </Btn>
        </>
      )
    case 'tag':
      return (
        <>
          <span style={muted}>{W.noGuess}</span>
          <Btn onClick={onPick}>{W.tag}</Btn>
        </>
      )
  }
}

export function MyMailListRow({ row, phone, nowIso, busy, dim = false, onOpen, onYes, onPick }: MyMailListRowProps) {
  const who = whoLine(row)
  const way = wayOf(row)
  const open: CSSProperties = phone
    ? { display: 'grid', gridTemplateColumns: '16px minmax(0, 1fr) auto', gridTemplateAreas: '"way who day" "way subj subj"', rowGap: '0.15rem', columnGap: '0.5rem' }
    : { display: 'grid', gridTemplateColumns: '18px minmax(120px, 160px) minmax(0, 1fr) 64px', columnGap: '0.6rem', alignItems: 'center' }
  return (
    <div
      data-my-mail-row={row.gmailId}
      data-direction={row.direction}
      style={{
        display: 'grid',
        gridTemplateColumns: phone ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) auto',
        gap: phone ? '0.35rem' : '0.6rem',
        alignItems: 'center',
        padding: phone ? '0.5rem 0.6rem' : '0.55rem 0.7rem',
        borderTop: '1px solid var(--border)',
        background: dim ? 'var(--bg-subtle)' : 'var(--surface)',
        fontSize: '0.85rem',
        opacity: dim ? 0.85 : 1,
      }}
    >
      <button type="button" onClick={onOpen} data-testid="my-mail-open" style={{ ...open, border: 0, background: 'transparent', padding: 0, font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer', minWidth: 0 }}>
        <span role="img" aria-label={way.label} title={way.label} style={{ gridArea: phone ? 'way' : undefined, color: 'var(--text-muted)', textAlign: 'center' }}>
          {way.arrow}
        </span>
        <span style={{ gridArea: phone ? 'who' : undefined, minWidth: 0, fontWeight: 600 }}>
          <span style={oneLine}>{who.name}</span>
          {who.address ? <span style={{ ...oneLine, ...muted, fontWeight: 400 }}>{who.address}</span> : null}
        </span>
        <span style={{ gridArea: phone ? 'subj' : undefined, minWidth: 0 }}>
          <span style={{ ...oneLine, fontWeight: 600 }}>
            {row.subject}
            {row.files > 0 ? (
              <span aria-label={filesWords(row.files)} style={{ ...muted, fontWeight: 400, marginLeft: '0.4rem' }}>
                📎 {row.files}
              </span>
            ) : null}
          </span>
          <span style={{ ...oneLine, ...muted }}>{row.snippet}</span>
        </span>
        <span style={{ gridArea: phone ? 'day' : undefined, ...muted, textAlign: 'right', whiteSpace: 'nowrap' }}>{rowDay(row, nowIso)}</span>
      </button>
      <div data-my-mail-end style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', justifyContent: phone ? 'flex-start' : 'flex-end', flexWrap: 'wrap', minWidth: phone ? 0 : 170, paddingLeft: phone ? '1.5rem' : 0 }}>
        <RowEnd row={row} busy={busy} onOpen={onOpen} onYes={onYes} onPick={onPick} />
      </div>
    </div>
  )
}
