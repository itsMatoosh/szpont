-- Cascade-delete geofences when their parent zone is dropped.

alter table geofences
  drop constraint geofences_zone_id_fkey,
  add constraint geofences_zone_id_fkey
    foreign key (zone_id) references zones(id) on delete cascade;
