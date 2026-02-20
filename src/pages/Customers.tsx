import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import type { Json } from '../types/database'

type Customer = Database['public']['Tables']['customers']['Row']
type CustomerWithMaster = Customer & {
  master_user: { id: string; name: string | null; email: string | null } | null
}
type BidRow = Database['public']['Tables']['bids']['Row']

function extractContactInfo(ci: Json | null): { phone: string; email: string } {
  if (ci == null) return { phone: '', email: '' }
  if (typeof ci === 'object' && ci !== null) {
    const obj = ci as Record<string, unknown>
    return {
      phone: typeof obj.phone === 'string' ? obj.phone : '',
      email: typeof obj.email === 'string' ? obj.email : '',
    }
  }
  return { phone: '', email: '' }
}

export default function Customers() {
  const [customers, setCustomers] = useState<CustomerWithMaster[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewingBidsForCustomer, setViewingBidsForCustomer] = useState<string | null>(null)
  const [bidsForCustomer, setBidsForCustomer] = useState<BidRow[]>([])
  const [loadingBids, setLoadingBids] = useState(false)

  async function fetchCustomers() {
    const { data, error: err } = await supabase
      .from('customers')
      .select('*, users!customers_master_user_id_fkey(id, name, email)')
      .order('name')
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    const rows = (data ?? []) as Array<Customer & { users: { id: string; name: string | null; email: string | null } | null }>
    const customersWithMasters: CustomerWithMaster[] = rows.map((row) => {
      const { users, ...customer } = row
      return { ...customer, master_user: users ?? null }
    })
    setCustomers(customersWithMasters)
    setLoading(false)
  }

  async function loadBidsForCustomer(customerId: string) {
    setLoadingBids(true)
    const { data, error } = await supabase
      .from('bids')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
    
    if (!error && data) {
      setBidsForCustomer(data as BidRow[])
    }
    setLoadingBids(false)
  }

  function getBidStatus(bid: BidRow): string {
    if (!bid.bid_date_sent) return 'Unsent'
    if (bid.outcome === 'won') return 'Won'
    if (bid.outcome === 'lost') return 'Lost'
    if (bid.outcome === 'started_or_complete') return 'Started or Complete'
    return 'Pending'
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  if (loading) return <p>Loading customers…</p>
  if (error) return <p style={{ color: '#b91c1c' }}>{error}</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1>Customers</h1>
        <Link to="/customers/new" style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', borderRadius: 6, textDecoration: 'none' }}>
          Add customer
        </Link>
      </div>
      {customers.length === 0 ? (
        <p>No customers yet. <Link to="/customers/new">Add one</Link>.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {customers.map((c) => (
            <li
              key={c.id}
              style={{
                padding: '0.75rem 0',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <Link to={`/customers/${c.id}/edit`} style={{ fontWeight: 500 }}>{c.name}</Link>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {c.address && <span>{c.address}</span>}
                  {c.master_user && (
                    <span>
                      {c.address && <span> · </span>}
                      Master: {c.master_user.name || c.master_user.email || 'Unknown'}
                    </span>
                  )}
                  {c.address && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        color: '#2563eb',
                        textDecoration: 'none',
                        cursor: 'pointer',
                      }}
                      title={`View ${c.address} on map`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 640 640"
                        style={{ width: '16px', height: '16px', fill: 'currentColor' }}
                      >
                        <path d="M576 112C576 103.7 571.7 96 564.7 91.6C557.7 87.2 548.8 86.8 541.4 90.5L416.5 152.1L244 93.4C230.3 88.7 215.3 89.6 202.1 95.7L77.8 154.3C69.4 158.2 64 166.7 64 176L64 528C64 536.2 68.2 543.9 75.1 548.3C82 552.7 90.7 553.2 98.2 549.7L225.5 489.8L396.2 546.7C409.9 551.3 424.7 550.4 437.8 544.2L562.2 485.7C570.6 481.7 576 473.3 576 464L576 112zM208 146.1L208 445.1L112 490.3L112 191.3L208 146.1zM256 449.4L256 148.3L384 191.8L384 492.1L256 449.4zM432 198L528 150.6L528 448.8L432 494L432 198z" />
                      </svg>
                    </a>
                  )}
                  {(() => {
                    const contactInfo = extractContactInfo(c.contact_info)
                    const phone = contactInfo.phone?.trim()
                    const email = contactInfo.email?.trim()
                    return (
                      <>
                        {phone && (
                          <a
                            href={`tel:${phone}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              color: '#2563eb',
                              textDecoration: 'none',
                              cursor: 'pointer',
                            }}
                            title={`Call ${phone}`}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 640 640"
                              style={{ width: '16px', height: '16px', fill: 'currentColor' }}
                            >
                              <path d="M224.2 89C216.3 70.1 195.7 60.1 176.1 65.4L170.6 66.9C106 84.5 50.8 147.1 66.9 223.3C104 398.3 241.7 536 416.7 573.1C493 589.3 555.5 534 573.1 469.4L574.6 463.9C580 444.2 569.9 423.6 551.1 415.8L453.8 375.3C437.3 368.4 418.2 373.2 406.8 387.1L368.2 434.3C297.9 399.4 241.3 341 208.8 269.3L253 233.3C266.9 222 271.6 202.9 264.8 186.3L224.2 89z" />
                            </svg>
                          </a>
                        )}
                        {email && (
                          <a
                            href={`mailto:${email}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              color: '#2563eb',
                              textDecoration: 'none',
                              cursor: 'pointer',
                            }}
                            title={`Email ${email}`}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 640 640"
                              style={{ width: '16px', height: '16px', fill: 'currentColor' }}
                            >
                              <path d="M320 128C214 128 128 214 128 320C128 426 214 512 320 512C337.7 512 352 526.3 352 544C352 561.7 337.7 576 320 576C178.6 576 64 461.4 64 320C64 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320L576 352C576 405 533 448 480 448C450.7 448 424.4 434.8 406.8 414.1C384 435.1 353.5 448 320 448C249.3 448 192 390.7 192 320C192 249.3 249.3 192 320 192C347.9 192 373.7 200.9 394.7 216.1C400.4 211.1 407.8 208 416 208C433.7 208 448 222.3 448 240L448 352C448 369.7 462.3 384 480 384C497.7 384 512 369.7 512 352L512 320C512 214 426 128 320 128zM384 320C384 284.7 355.3 256 320 256C284.7 256 256 284.7 256 320C256 355.3 284.7 384 320 384C355.3 384 384 355.3 384 320z" />
                            </svg>
                          </a>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>
              <span className="customers-projects-bids-links" style={{ display: 'flex', gap: '0.5rem' }}>
                <Link to={`/projects?customer=${c.id}`}>Projects</Link>
                <button
                  onClick={() => {
                    setViewingBidsForCustomer(c.id)
                    loadBidsForCustomer(c.id)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    cursor: 'pointer',
                    padding: 0,
                    font: 'inherit',
                  }}
                >
                  Bids
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {viewingBidsForCustomer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => setViewingBidsForCustomer(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 8,
              padding: '1.5rem',
              maxWidth: '800px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>
                Bids for {customers.find(c => c.id === viewingBidsForCustomer)?.name}
              </h2>
              <button
                onClick={() => setViewingBidsForCustomer(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '0.25rem',
                }}
              >
                ×
              </button>
            </div>

            {loadingBids ? (
              <p>Loading bids...</p>
            ) : bidsForCustomer.length === 0 ? (
              <p>No bids found for this customer.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Project Name</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Bid Due Date</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem' }}>Bid Value</th>
                  </tr>
                </thead>
                <tbody>
                  {bidsForCustomer.map((bid) => (
                    <tr key={bid.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.5rem' }}>{bid.project_name || '—'}</td>
                      <td style={{ padding: '0.5rem' }}>
                        <span
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: 4,
                            fontSize: '0.875rem',
                            background:
                              bid.outcome === 'won'
                                ? '#dcfce7'
                                : bid.outcome === 'lost'
                                ? '#fee2e2'
                                : bid.outcome === 'started_or_complete'
                                ? '#dbeafe'
                                : '#f3f4f6',
                            color:
                              bid.outcome === 'won'
                                ? '#166534'
                                : bid.outcome === 'lost'
                                ? '#991b1b'
                                : bid.outcome === 'started_or_complete'
                                ? '#1e40af'
                                : '#374151',
                          }}
                        >
                          {getBidStatus(bid)}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        {bid.bid_due_date ? new Date(bid.bid_due_date).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                        {bid.bid_value != null
                          ? new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: 'USD',
                            }).format(bid.bid_value)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
