/** A single tally-parts ledger row (RPC `list_tally_parts_with_po`), shared across the Parts and Job-Summary tabs. */
export type TallyPartRow = {
  id: string
  job_id: string
  fixture_name: string
  part_id: string | null
  quantity: number
  created_by_user_id: string
  created_at: string
  price_at_time: number | null
  fixture_cost: number | null
  purchase_order_id: string | null
  purchase_order_name: string | null
  purchase_order_status: string | null
  hcp_number: string | null
  job_name: string | null
  job_address: string | null
  part_name: string | null
  part_manufacturer: string | null
  created_by_name: string | null
}
