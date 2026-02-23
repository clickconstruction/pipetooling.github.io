import { useNewCustomerModal } from '../contexts/NewCustomerModalContext'
import NewCustomerForm from './NewCustomerForm'

export default function NewCustomerModal() {
  const modalContext = useNewCustomerModal()

  if (!modalContext?.isOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
      <div style={{ background: 'white', padding: '1rem 2rem 2rem', borderRadius: 8, maxWidth: '500px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
        <NewCustomerForm
          showQuickFill={false}
          mode="modal"
          onCancel={modalContext.closeModal}
          onCreated={(c) => {
            if (typeof modalContext.onCreated === 'function') {
              modalContext.onCreated(c)
            }
            modalContext.closeModal()
          }}
        />
      </div>
    </div>
  )
}
