alter table posts add column if not exists media_url text;
alter table posts add column if not exists media_type text;

create table if not exists follows (
  follower_wallet text not null references users(wallet) on delete cascade,
  followed_wallet text not null references users(wallet) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_wallet, followed_wallet),
  check (follower_wallet <> followed_wallet)
);

create index if not exists follows_followed_idx on follows(followed_wallet, created_at desc);