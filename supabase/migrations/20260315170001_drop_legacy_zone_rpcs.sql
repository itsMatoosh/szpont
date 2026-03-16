-- Drop legacy enter_zone/exit_zone overloads from earlier migrations
-- that are superseded by the 3-arg / 2-arg versions accepting p_user_id.

drop function if exists enter_zone(uuid);
drop function if exists exit_zone();
