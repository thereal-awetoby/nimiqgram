create table if not exists red_packets (
  id uuid primary key default gen_random_uuid(),
  creator_wallet text not null references users(wallet),
  post_id uuid unique references posts(id) on delete set null,
  escrow_address text not null,
  total_amount_nim numeric(30, 5) not null check (total_amount_nim > 0),
  remaining_amount_nim numeric(30, 5) not null check (remaining_amount_nim >= 0),
  claim_limit integer not null check (claim_limit > 0),
  claimed_count integer not null default 0 check (claimed_count >= 0),
  funding_tx_hash text unique,
  status text not null default 'draft' check (status in ('draft', 'active', 'closed', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists red_packet_claims (
  id uuid primary key default gen_random_uuid(),
  packet_id uuid not null references red_packets(id) on delete cascade,
  wallet text not null references users(wallet),
  amount_nim numeric(30, 5) not null check (amount_nim > 0),
  payout_tx_hash text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  created_at timestamptz not null default now(),
  unique (packet_id, wallet)
);

create index if not exists red_packets_status_expiry_idx on red_packets(status, expires_at);
create index if not exists red_packet_claims_packet_idx on red_packet_claims(packet_id, created_at);
