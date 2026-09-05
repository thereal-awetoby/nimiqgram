create table if not exists bookmarks (
  wallet text not null references users(wallet) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wallet, post_id)
);

create index if not exists bookmarks_wallet_idx on bookmarks(wallet, created_at desc);
