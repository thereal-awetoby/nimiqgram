alter table red_packets drop constraint if exists red_packets_status_check;
alter table red_packets add constraint red_packets_status_check
  check (status in ('draft', 'active', 'closed', 'expired', 'refunding'));