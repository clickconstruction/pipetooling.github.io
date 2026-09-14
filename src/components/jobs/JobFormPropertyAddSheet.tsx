import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import CustomerPropertySheet from '../customers/CustomerPropertySheet'
import { emptyPropertyDraft, payloadFromDraft, type PropertyDraft } from '../../lib/customers/propertyDraft'
import type { CustomerAddressRow } from '../../lib/jobs/lienProperty'

/**
 * Add the job's address as a property on its customer, from the job form
 * (v2.3401). A GC entered as the customer only has the builder's office on
 * file, so the Property record picker had nothing to link — and the legal
 * record (county, legal description, owner of record) had no home. This is
 * Edit customer's property sheet (v2.3009) prefilled with the job address —
 * the lookup runs as it opens — and on Add the row is inserted on the
 * customer and handed back so the job links to it.
 *
 * Never sets `is_primary`: the primary row mirrors `customers.address` by
 * trigger, and a job site is not the customer's address.
 */

type Props = {
  customerId: string
  customerName: string
  jobAddress: string
  /** How many properties the customer already has — the new row sorts after them. */
  existingCount: number
  onAdded: (row: CustomerAddressRow) => void
  onCancel: () => void
}

export default function JobFormPropertyAddSheet({ customerId, customerName, jobAddress, existingCount, onAdded, onCancel }: Props) {
  const { showToast } = useToastContext()
  const [draft, setDraft] = useState<PropertyDraft>(() => emptyPropertyDraft(jobAddress))
  const [busy, setBusy] = useState(false)

  async function save() {
    if (busy || !draft.address.trim()) return
    setBusy(true)
    const { data, error } = await supabase
      .from('customer_addresses')
      .insert({ customer_id: customerId, ...payloadFromDraft(draft), sequence_order: existingCount })
      .select('*')
      .single()
    setBusy(false)
    if (error || !data) {
      showToast(`Could not save the property: ${error?.message ?? 'no row came back'}`, 'error')
      return
    }
    showToast(`Property added on ${customerName} and linked to this job`, 'success')
    onAdded(data as CustomerAddressRow)
  }

  return (
    <div data-testid="job-form-property-add-sheet" style={{ marginTop: '0.5rem' }}>
      <p style={{ margin: '0 0 0.4rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        Saves on <strong>{customerName}</strong>'s properties and links this job to it.
      </p>
      <CustomerPropertySheet
        draft={draft}
        onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
        isNew
        isPrimary={false}
        busy={busy}
        linkedJobCount={0}
        onDone={() => void save()}
        onCancel={onCancel}
      />
    </div>
  )
}
