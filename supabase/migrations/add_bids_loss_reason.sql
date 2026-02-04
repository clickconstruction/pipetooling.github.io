-- Adds a short “why we lost” field for lost bids
alter table public.bids
add column if not exists loss_reason text;

