alter table rally_cries
  add column active boolean not null default true,
  add column archived_at timestamptz;

alter table supporting_outcomes
  add column active boolean not null default true,
  add column archived_at timestamptz;
