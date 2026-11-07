/**
 * The band on a New row's left edge (punch list #258, v2.6507): the desk that finishes the row, Dispatch or Estimating,
 * as a strip the row's full height in the header's own fill with the header's icon small and white at its middle
 * (`lib/messages/deskMarks.ts`). No words on the row; the hover and the label read the desk's word then why
 * (`rowDesk.ts`'s `deskTitle`). Not a press: a press on it opens the thread, as a press anywhere on the row does. The
 * row sets its own left padding by `width`, 22 at a desk and 18 on a phone, so the band and the words never overlap.
 * Since v2.6616 (PR 2) the same band sits on a Needs a reply row and on the thread's folded sort card, read by
 * `rowDesk.ts`'s `deskReadOf` from the sender and the line.
 */
import { DESK_BAND, DESK_MARKS } from '../../lib/messages/deskMarks'
import { deskTitle, type Desk } from '../../lib/messages/rowDesk'

export function DeskBand({ read, phone, radius = 7 }: { read: { desk: Desk; why: string }; phone: boolean; /** The host's corner, so the band's left corners match it: the row's 7, the thread's folded sort card's 9 (PR 2 of #258). */ radius?: number }) {
  const mark = DESK_MARKS[read.desk]
  const size = phone ? DESK_BAND.phone : DESK_BAND.desk
  const title = deskTitle(read)
  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      data-desk-band={read.desk}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: size.width,
        borderRadius: `${radius}px 0 0 ${radius}px`,
        display: 'grid',
        placeItems: 'center',
        background: mark.fill,
        color: mark.ink,
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox={mark.icon.viewBox} width={size.icon} height={size.icon} fill="currentColor" aria-hidden="true">
        <path d={mark.icon.path} />
      </svg>
    </span>
  )
}
