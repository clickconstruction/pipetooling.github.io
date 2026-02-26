import { CantReachSection } from '../components/quickfill/CantReachSection'
import { CrewJobsSection } from '../components/quickfill/CrewJobsSection'
import { JobsBillingReminderSection } from '../components/quickfill/JobsBillingReminderSection'
import { UnpricedFixturesSection } from '../components/quickfill/UnpricedFixturesSection'
import { ReceivablesSection } from '../components/quickfill/ReceivablesSection'
import { SupplyHousesSection } from '../components/quickfill/SupplyHousesSection'
import { HoursSection } from '../components/quickfill/HoursSection'

export default function Quickfill() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem', textAlign: 'center' }}>Quickfill</h1>
      <JobsBillingReminderSection />
      <UnpricedFixturesSection />
      <CantReachSection />
      <HoursSection />
      <CrewJobsSection />
      <ReceivablesSection />
      <SupplyHousesSection />
    </div>
  )
}
