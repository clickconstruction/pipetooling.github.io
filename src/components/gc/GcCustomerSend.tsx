import { useState, type Dispatch } from 'react'
import { customerPortalLink, customerReminderEmail, paperDayChoices, type CustomerStep, type GcAction, type GcCustomer, type GcState } from '../../lib/gcMode/gcModel'
import { SendView } from './GcPaperSend'

/**
 * GC mode design spike: remind a customer to sign a change order, from its window's Documents
 * (the owner, 2026-10-04). The same send as a trade's paper: who it goes to, the day, a line of
 * your own, and the email as they will get it.
 */
export function GcCustomerSend({
  state,
  customer,
  step,
  dispatch,
  onDone,
  onCancel,
}: {
  state: GcState
  customer: GcCustomer
  step: CustomerStep
  dispatch: Dispatch<GcAction>
  onDone: () => void
  onCancel: () => void
}) {
  const days = paperDayChoices(state.today)
  const [by, setBy] = useState(days[1]?.on ?? state.today)
  const [note, setNote] = useState('')
  const project = state.projects.find((p) => p.id === step.projectId)
  const co = project?.changeOrders?.find((c) => c.id === step.changeOrderId)
  if (!project || !co) return null
  return (
    <SendView
      title={step.title}
      history={step.history}
      to={`${customer.contact || customer.name}, by email${customer.portalOn ? ', with their portal link' : ''}`}
      dayWord={step.dayWord}
      today={state.today}
      by={by}
      onBy={setBy}
      note={note}
      onNote={setNote}
      email={customerReminderEmail(customer, project, co, by, note)}
      link={customer.portalOn ? customerPortalLink(customer.id) : null}
      recipient={customer.name}
      attached={{ name: `Change order ${co.number}`, how: customer.portalOn ? 'They read it and sign it in their portal.' : 'With the email, to sign and send back.' }}
      sendLabel={step.sendLabel}
      dayNote="The job's Who to call shows them late after this day. Signing it clears it."
      onSend={() => {
        dispatch({ type: 'remindCustomer', customerId: customer.id, projectId: project.id, changeOrderId: co.id, by, note })
        onDone()
      }}
      onCancel={onCancel}
    />
  )
}
