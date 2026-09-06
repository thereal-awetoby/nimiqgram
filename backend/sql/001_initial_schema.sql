create extension if not exists pgcrypto;

create table if not exists users (
  wallet text primary key,
  username text unique,
  bio text not null default '',
  avatar_url text,
  banner_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_wallet text not null references users(wallet),
  text text not null check (char_length(text) between 1 and 5000),
  media_url text,
  media_type text,
  created_at timestamptz not null default now()
);

create table if not exists likes (
  post_id uuid not null references posts(id) on delete cascade,
  wallet text not null references users(wallet),
  created_at timestamptz not null default now(),
  primary key (post_id, wallet)
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  author_wallet text not null references users(wallet),
  text text not null check (char_length(text) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists tips (
  id uuid primary key default gen_random_uuid(),
  from_wallet text not null references users(wallet),
  to_wallet text not null references users(wallet),
  post_id uuid references posts(id) on delete set null,
  amount_nim numeric(30, 6) not null check (amount_nim > 0),
  tx_hash text unique not null,
  status text not null default 'pending' check (status in ('pending', 'verified', 'failed')),
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_wallet text not null references users(wallet),
  actor_wallet text not null references users(wallet),
  type text not null check (type in ('like', 'comment', 'tip')),
  post_id uuid references posts(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists streaks (
  wallet text primary key references users(wallet),
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_activity_date date,
  badges jsonb not null default '[]'::jsonb
);

create index if not exists posts_created_at_idx on posts(created_at desc);
create index if not exists tips_created_at_idx on tips(created_at desc);
create index if not exists notifications_recipient_idx on notifications(recipient_wallet, created_at desc);
