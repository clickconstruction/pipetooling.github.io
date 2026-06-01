/** Settings → How it works tab: static product/orientation copy.
 * Presentational and stateless; only the active-tab visibility gate arrives as a prop. */
export default function SettingsHowItWorksTab({ active }: { active: boolean }) {
  return (
    <div id="settings-how-it-works" style={{ display: active ? undefined : 'none' }}>
      <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem', background: '#f9fafb' }}>
        <div style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: '#374151', lineHeight: 1.6 }}>
          PipeTooling helps Masters better manage Projects with Subs.
          <br />
          Three types of People: Masters, Assistants, Subs
        </div>
        <h2 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '0.75rem', fontWeight: 600 }}>How It Works</h2>
        <ol style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem', color: '#374151', lineHeight: 1.6 }}>
          <li style={{ marginBottom: '0.5rem' }}>Master accounts have Customers</li>
          <li style={{ marginBottom: '0.5rem' }}>Customers can have Projects</li>
          <li style={{ marginBottom: '0.5rem' }}>Masters assign People to Project Stages</li>
          <li>When People complete Stages, Masters are updated</li>
        </ol>
        <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#374151' }}>
          <strong>Sharing</strong>:
          <ul style={{ margin: '0.25rem 0 0 1.25rem', padding: 0, listStyle: 'disc' }}>
            <li style={{ marginBottom: '0.5rem' }}>
              Masters can choose to adopt assistants in Settings
              <div style={{ marginLeft: '1.25rem', marginTop: '0.25rem' }}>
                → they can manage stages and see private notes but not financial totals
              </div>
            </li>
            <li>
              Masters can choose to share with other Masters
              <div style={{ marginLeft: '1.25rem', marginTop: '0.25rem' }}>
                → they have the same permissions as assistants
              </div>
            </li>
          </ul>
        </div>
        <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#374151' }}>
          <strong>Subcontractors</strong>:
          <ul style={{ margin: '0.25rem 0 0 1.25rem', padding: 0, listStyle: 'disc' }}>
            <li>Only see a stage when it is assigned to them</li>
            <li>Can only Start and Complete their stages</li>
            <li>Cannot see private notes or financials</li>
            <li>Cannot add, edit, delete, or assign stages</li>
          </ul>
          <div style={{ marginTop: '0.5rem' }}>
            When a Master or Assistant selects to Notify when a stage updates, that stage will show up in their Subscribed Stages on the Dashboard.
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: '2.5rem',
          padding: '1.5rem',
          backgroundColor: '#f9fafb',
          borderRadius: '0.5rem',
          border: '1px solid #e5e7eb',
        }}
      >
        <p style={{ margin: 0, lineHeight: '1.6', color: '#374151', fontSize: '0.9375rem' }}>
          PipeTooling is a web application designed to decrease the actions and thinking necessary for Plumbers,
          Electricians, and HVAC techs to engage and win work while reducing the comunication risk of completing that
          work with Assistance, Teammates, Subs, and Customers. Our mission is to reduce uncertainty so better and
          faster decisions can be made.
        </p>
      </div>
    </div>
  )
}
