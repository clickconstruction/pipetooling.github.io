import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

type Customer = Database['public']['Tables']['customers']['Row']

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCustomers() {
      const { data, error: err } = await supabase
        .from('customers')
        .select('*')
        .order('name')
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      setCustomers(data ?? [])
      setLoading(false)
    }
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
                {c.address && <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{c.address}</div>}
              </div>
              <span style={{ display: 'flex', gap: '0.5rem' }}>
                <Link to={`/projects?customer=${c.id}`}>Projects</Link>
                <Link to={`/customers/${c.id}/edit`}>Edit</Link>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
