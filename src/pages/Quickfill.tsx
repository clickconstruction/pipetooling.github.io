import { ReceivablesSection } from '../components/quickfill/ReceivablesSection'
import { SupplyHousesSection } from '../components/quickfill/SupplyHousesSection'
import { HoursSection } from '../components/quickfill/HoursSection'

export default function Quickfill() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>Quickfill</h1>
      <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        Reference and update Jobs Receivables, Materials Supply Houses & External Subs, and People Hours in one place.
      </p>
      <HoursSection />
      <ReceivablesSection />
      <SupplyHousesSection />
    </div>
  )
}
