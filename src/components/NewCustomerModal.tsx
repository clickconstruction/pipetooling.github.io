import { useNewCustomerModal } from '../contexts/NewCustomerModalContext'
import NewCustomerForm from './NewCustomerForm'

export default function NewCustomerModal() {
  const modalContext = useNewCustomerModal()

  if (!modalContext?.isOpen) return null

  return (
    <div style={{ position: 'fixed', padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
      <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1rem 2rem 2rem', borderRadius: 8, maxWidth: '500px', width: '90%', maxHeight: 'min(90vh, 100%)', overflow: 'auto' }}>
        <NewCustomerForm
          showQuickFill
          mode="modal"
          initialValues={modalContext.initialValues}
          sourceProspect={modalContext.sourceProspect}
          conversionLane={modalContext.conversionLane}
          onCancel={modalContext.closeModal}
          onCreated={(c, meta) => {
            if (typeof modalContext.onCreated === 'function') {
              modalContext.onCreated(c, meta)
            }
            modalContext.closeModal()
          }}
        />
      </div>
    </div>
  )
}
