import { useNavigate } from 'react-router-dom'
import ResponsiveModalShell from './ResponsiveModalShell'
import { useOutbox } from '../hooks/useOutbox'
import { DROP_LABEL, GOT_IT_LABEL, SEND_NOW_LABEL, dropPress, markDueNow, markSeen, outboxDoorSections, type OutboxDoorRow } from '../lib/offline/outbox'
import { outbox, type OutboxStateStore } from '../lib/offline/outboxState'
import { EmptyState } from './EmptyState'
import { emptyWords } from '../lib/emptyWords'

/**
 * The list behind the bar (punch list #163 PR 2): a tap on the bar opens it. Three sections, the
 * kernel's (`outboxDoorSections`): *Needs you* (a press the office refused, with its reason and
 * its door, or one that has waited since yesterday), *Waiting* (each press with when it was
 * pressed and the last try), *Sent today* (the pressed time and the sent time, so a tech who
 * missed the green line can still see that 7:58 went out at 8:11). Fix opens the press's door
 * and marks it seen, which is what takes the red off the bar; Send now makes a waiting press
 * due at once; Drop it removes a press nobody wants sent; Got it marks every sent press seen.
 */
export function OutboxDoor({ onClose, onSendNow, store = outbox }: { onClose: () => void; onSendNow: () => void; store?: OutboxStateStore }) {
  const presses = useOutbox(store)
  const navigate = useNavigate()
  const sections = outboxDoorSections(presses, Date.now())
  const sentUnseen = presses.filter((p) => p.state === 'sent' && !p.seen).map((p) => p.id)

  const fix = (row: OutboxDoorRow) => {
    store.replace(markSeen(store.presses(), [row.id]))
    onClose()
    if (row.door) navigate(row.door)
  }
  const sendNow = (row: OutboxDoorRow) => {
    store.replace(store.presses().map((p) => (p.id === row.id ? markDueNow(p) : p)))
    onSendNow()
  }
  const drop = (row: OutboxDoorRow) => {
    store.replace(dropPress(store.presses(), row.id))
  }
  const gotIt = () => {
    store.replace(markSeen(store.presses(), sentUnseen))
  }

  const empty = sections.needsYou.length === 0 && sections.waiting.length === 0 && sections.sentToday.length === 0

  return (
    <ResponsiveModalShell title="Waiting to send" onRequestClose={onClose} maxWidthDesktop={480}>
      <div className="outboxDoor">
        {empty ? <EmptyState main={emptyWords({ kind: 'waiting', who: 'the phone' }).main} tail="Every press has reached the office." compact /> : null}
        {sections.needsYou.length > 0 ? (
          <section>
            <h3>Needs you</h3>
            {sections.needsYou.map((row) => (
              <Row key={row.id} row={row} tone="red">
                {row.canSendNow ? (
                  <button type="button" className="outboxDoorBtn" onClick={() => sendNow(row)}>
                    {SEND_NOW_LABEL}
                  </button>
                ) : null}
                {row.door ? (
                  <button type="button" className="outboxDoorBtn outboxDoorBtnStrong" onClick={() => fix(row)}>
                    Fix
                  </button>
                ) : null}
                {row.canDrop ? (
                  <button type="button" className="outboxDoorBtn outboxDoorBtnQuiet" onClick={() => drop(row)}>
                    {DROP_LABEL}
                  </button>
                ) : null}
              </Row>
            ))}
          </section>
        ) : null}
        {sections.waiting.length > 0 ? (
          <section>
            <h3>Waiting</h3>
            {sections.waiting.map((row) => (
              <Row key={row.id} row={row} tone="amber">
                {row.canSendNow ? (
                  <button type="button" className="outboxDoorBtn" onClick={() => sendNow(row)}>
                    {SEND_NOW_LABEL}
                  </button>
                ) : null}
                {row.canDrop ? (
                  <button type="button" className="outboxDoorBtn outboxDoorBtnQuiet" onClick={() => drop(row)}>
                    {DROP_LABEL}
                  </button>
                ) : null}
              </Row>
            ))}
          </section>
        ) : null}
        {sections.sentToday.length > 0 ? (
          <section>
            <h3>
              Sent today
              {sentUnseen.length > 0 ? (
                <button type="button" className="outboxDoorBtn outboxDoorBtnStrong" style={{ marginLeft: 'auto' }} onClick={gotIt}>
                  {GOT_IT_LABEL}
                </button>
              ) : null}
            </h3>
            {sections.sentToday.map((row) => (
              <Row key={row.id} row={row} tone="green" />
            ))}
          </section>
        ) : null}
      </div>
    </ResponsiveModalShell>
  )
}

function Row({ row, tone, children }: { row: OutboxDoorRow; tone: 'red' | 'amber' | 'green'; children?: React.ReactNode }) {
  return (
    <div className="outboxDoorRow" data-tone={tone} data-testid={`outbox-row-${row.id}`}>
      <div className="outboxDoorRowWhat">
        <strong>{row.kind}</strong>
        {row.about ? <span> · {row.about}</span> : null}
      </div>
      <div className="outboxDoorRowWhen">
        {row.pressed} · {row.status}
      </div>
      {row.reason ? <div className="outboxDoorRowReason">{row.reason}</div> : null}
      {children ? <div className="outboxDoorRowActions">{children}</div> : null}
    </div>
  )
}

export default OutboxDoor
