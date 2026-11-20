import { Suspense } from 'react'
import { useEditCustomerModal } from '../contexts/EditCustomerModalContext'
import { lazyWindow } from '../lib/lazyWindow'

// The form is a chunk of its own (`lazyWindow`): this shell is mounted in the Layout and draws nothing until a
// customer is opened for editing.
const EditCustomerForm = lazyWindow(() => import('./EditCustomerForm'))

export default function EditCustomerModal() {
  const modalContext = useEditCustomerModal()

  if (!modalContext?.isOpen || !modalContext.customerId) return null

  return (
    <div style={{ position: 'fixed', padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
      <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1rem 2rem 2rem', borderRadius: 8, maxWidth: '900px', width: '94%', maxHeight: 'min(90vh, 100%)', overflow: 'auto' }}>
        <Suspense fallback={<p style={{ margin: '1rem 0', color: 'var(--text-muted)' }}>Opening the customer…</p>}>
        <EditCustomerForm
          customerId={modalContext.customerId}
          onSaved={async () => {
            if (typeof modalContext.onSaved === 'function') {
              await Promise.resolve(modalContext.onSaved())
            }
            modalContext.closeModal()
          }}
          onCancel={modalContext.closeModal}
          onDeleted={modalContext.onDeleted ?? undefined}
          onMerged={modalContext.onMerged ?? undefined}
        />
        </Suspense>
      </div>
    </div>
  )
}
