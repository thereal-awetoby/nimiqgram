create table if not exists comment_likes (
  comment_id uuid not null references comments(id) on delete cascade,
  wallet text not null references users(wallet) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, wallet)
);

create index if not exists comment_likes_comment_idx on comment_likes(comment_id);
