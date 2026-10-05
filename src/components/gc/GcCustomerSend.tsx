import { useState, type Dispatch } from 'react'
import { contractEmail, customerPortalLink, customerReminderEmail, paperDayChoices, type CustomerStep, type GcAction, type GcCustomer, type GcState } from '../../lib/gcMode/gcModel'
import { SendView } from './GcPaperSend'

/**
 * GC mode design spike: send a customer a paper from its window's Documents (the owner,
 * 2026-10-04): our contract to sign in their portal, or a reminder on a change order. The same
 * send as a trade's paper: who it goes to, the day, a line of your own, and the email as they
 * will get it.
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
  if (!project) return null
  const co = step.changeOrderId ? project.changeOrders?.find((c) => c.id === step.changeOrderId) : undefined
  if (step.paper === 'changeOrder' && !co) return null
  // Our contract: they sign in their portal, so it goes with their portal link (the first send turns it on).
  const contract = step.paper === 'contract'
  const portal = contract || customer.portalOn
  return (
    <SendView
      title={step.title}
      history={step.history}
      to={`${customer.contact || customer.name}, by email${portal ? ', with their portal link' : ''}`}
      dayWord={step.dayWord}
      today={state.today}
      by={by}
      onBy={setBy}
      note={note}
      onNote={setNote}
      email={contract || !co ? contractEmail(customer, project, step.mode === 'first', by, note) : customerReminderEmail(customer, project, co, by, note)}
      link={portal ? customerPortalLink(customer.id) : null}
      recipient={customer.name}
      attached={
        contract
          ? { name: `Our contract · ${project.name}`, how: 'They read it and sign it in their portal.' }
          : { name: `Change order ${co?.number ?? ''}`, how: customer.portalOn ? 'They read it and sign it in their portal.' : 'With the email, to sign and send back.' }
      }
      sendLabel={step.sendLabel}
      dayNote="The job's Who to call shows them late after this day. Signing it clears it."
      onSend={() => {
        if (contract) dispatch({ type: 'sendOwnerContract', projectId: project.id, by, note })
        else if (co) dispatch({ type: 'remindCustomer', customerId: customer.id, projectId: project.id, changeOrderId: co.id, by, note })
        onDone()
      }}
      onCancel={onCancel}
    />
  )
}
