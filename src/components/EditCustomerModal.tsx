import { useEditCustomerModal } from '../contexts/EditCustomerModalContext'
import EditCustomerForm from './EditCustomerForm'

export default function EditCustomerModal() {
  const modalContext = useEditCustomerModal()

  if (!modalContext?.isOpen || !modalContext.customerId) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
      <div style={{ background: 'white', padding: '1rem 2rem 2rem', borderRadius: 8, maxWidth: '500px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
        <EditCustomerForm
          customerId={modalContext.customerId}
          onSaved={async () => {
            if (typeof modalContext.onSaved === 'function') {
              await Promise.resolve(modalContext.onSaved())
            }
            modalContext.closeModal()
          }}
          onCancel={modalContext.closeModal}
        />
      </div>
    </div>
  )
}
