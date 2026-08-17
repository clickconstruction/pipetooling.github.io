import { useEditCustomerModal } from '../contexts/EditCustomerModalContext'
import EditCustomerForm from './EditCustomerForm'

export default function EditCustomerModal() {
  const modalContext = useEditCustomerModal()

  if (!modalContext?.isOpen || !modalContext.customerId) return null

  return (
    <div style={{ position: 'fixed', padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
      <div style={{ background: 'var(--surface)', padding: '1rem 2rem 2rem', borderRadius: 8, maxWidth: '560px', width: '92%', maxHeight: 'min(90vh, 100%)', overflow: 'auto' }}>
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
      </div>
    </div>
  )
}
