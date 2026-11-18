create policy "parking broadcast receive"
on realtime.messages for select to authenticated
using ((select realtime.topic()) = 'parking-campus' and extension = 'broadcast');

create function app.broadcast_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.zone_id is not null and new.action in (
    'session.start', 'session.end', 'zone.save', 'space.save', 'rules.access', 'grant.save'
  ) then
    perform realtime.send(
      jsonb_build_object('zoneId',new.zone_id,'at',new.at),
      'parking.changed','parking-campus',true
    );
  end if;
  return new;
end; $$;
revoke all on function app.broadcast_activity() from public;
create trigger activity_parking_broadcast after insert on app.activity
for each row execute function app.broadcast_activity();
