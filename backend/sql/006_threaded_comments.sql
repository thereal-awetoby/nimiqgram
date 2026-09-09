alter table comments
  add column if not exists parent_comment_id uuid references comments(id) on delete cascade;

create index if not exists comments_post_parent_idx
  on comments(post_id, parent_comment_id, created_at);