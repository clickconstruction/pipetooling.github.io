import type { Dispatch } from 'react'
import { customerSendsFor, money, priceToOwner, weekdayDate, type GcAction, type GcProject, type GcState } from '../../lib/gcMode/gcModel'
import { PortalBlock, PortalNote } from './GcPortalUi'
import { Btn } from './gcUi'

/**
 * GC mode design spike: the customer signs our contract in their portal (the owner, 2026-10-04:
 * "they sign it in their portal"). Once the office sends it from the customer's window, this block
 * leads their portal until they sign: the job, the price, the day we asked for, and Sign. Nothing
 * shows before it is sent or after it is signed: "Your contract" below says the rest.
 */
export function GcCustomerContractSign({ state, project, dispatch }: { state: GcState; project: GcProject; dispatch: Dispatch<GcAction> }) {
  if (!project.ownerContractSentOn || project.ownerContractSignedOn) return null
  const sends = customerSendsFor(state, project.customerId, 'contract', project.id)
  const by = sends[sends.length - 1]?.by ?? null
  const price = priceToOwner(project)
  return (
    <div data-tour="gc-customer-contract-sign">
      <PortalBlock title="Your contract · to sign">
        <div style={{ display: 'grid', gap: '0.45rem', fontSize: '0.88rem' }}>
          <div>
            Our contract for <strong>{project.name}</strong>, {project.address}: <strong>{money(price.price)}</strong>.
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            It names the work, the price, and how billing works: a bill once a month for the work done, with part held until the end.
          </div>
          {by && <PortalNote tone="amber">Please sign it by {weekdayDate(by)}.</PortalNote>}
          <div>
            <Btn kind="primary" onClick={() => dispatch({ type: 'ownerSignContract', projectId: project.id })}>
              Sign the contract
            </Btn>
          </div>
        </div>
      </PortalBlock>
    </div>
  )
}
