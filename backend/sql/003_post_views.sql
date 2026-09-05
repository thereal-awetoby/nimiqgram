create table if not exists post_views (
  post_id uuid not null references posts(id) on delete cascade,
  viewer_wallet text not null references users(wallet),
  viewed_at timestamptz not null default now(),
  primary key (post_id, viewer_wallet)
);

create index if not exists post_views_post_idx on post_views(post_id, viewed_at desc);
