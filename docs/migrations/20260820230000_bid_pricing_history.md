# 20260820230000_bid_pricing_history

_(apply via `supabase db push` after the v2.1912 merge — additive function; the Workbench history strip renders nothing until it exists, so either order is safe)_

- **Purpose**: Win/loss calibration data for the Pricing Workbench (v2.1912). New RPC `bid_pricing_history(p_service_type_id uuid)` — decided bids (won/lost, `bid_value > 0`) of a service type with an **estimated cost** assembled from the same stored inputs the client cost model reads: labor hours × `labor_rate`, driving (hours ÷ `hours_per_trip` × `driving_cost_rate` × `bids.distance_from_office`), travel (people × nights × rates), estimator time (flat or per-count with the client's `|| 10` fallback), the five direct-cost row families (stage amounts clamped ≥ 0), and linked-PO materials (`purchase_order_items.price_at_time × quantity` across the three stage POs). Clocked team labor is NOT included (client-side session data), so margins skew slightly low and the UI labels them "estimated". `LANGUAGE sql STABLE SECURITY INVOKER` — RLS decides which bids appear; no policy changes.
- **Category**: Bids / analytics
