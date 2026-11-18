create function app.claim(p_actor uuid, p_vehicle uuid, p_space uuid, p_key uuid, p_pilot boolean)
returns uuid language plpgsql set search_path = '' as $$
declare
  account app.profiles%rowtype;
  vehicle app.vehicles%rowtype;
  zone app.zones%rowtype;
  space app.spaces%rowtype;
  prior app.requests%rowtype;
  new_id uuid;
  f text := p_vehicle::text || ':' || p_space::text;
  z uuid;
begin
  insert into app.requests(actor,operation,request_key,fingerprint)
    values (p_actor,'claim',p_key,f) on conflict do nothing;
  select * into prior from app.requests
    where actor=p_actor and operation='claim' and request_key=p_key for update;
  select * into account from app.profiles where id=p_actor for no key update;
  if account.id is null or not account.verified or account.suspended then
    raise exception 'PARKING_FORBIDDEN' using errcode='P0001';
  end if;
  if prior.fingerprint <> f then raise exception 'REQUEST_REUSED' using errcode='P0001'; end if;
  if prior.result_id is not null then return prior.result_id; end if;

  select * into vehicle from app.vehicles where id=p_vehicle and user_id=p_actor and archived_at is null
    for no key update;
  if vehicle.id is null then raise exception 'PARKING_FORBIDDEN' using errcode='P0001'; end if;
  select zone_id into z from app.spaces where id=p_space;
  select * into zone from app.zones where id=z for no key update;
  select * into space from app.spaces where id=p_space for no key update;
  if space.id is null or not zone.open or not zone.published or not space.published
      or space.state <> 'open' or (p_pilot and (not zone.verified or not space.verified))
      or exists(select 1 from app.sessions where space_id=p_space and ended_at is null) then
    raise exception 'SPACE_UNAVAILABLE' using errcode='P0001';
  end if;
  if not (
    exists(select 1 from app.access_rules where zone_id=z and role=account.role and kind=vehicle.kind)
    or exists(select 1 from app.access_grants where zone_id=z and user_id=p_actor
      and kind=vehicle.kind and expires_at>clock_timestamp())
  ) then raise exception 'PARKING_FORBIDDEN' using errcode='P0001'; end if;
  if (select count(*) from app.sessions where user_id=p_actor and ended_at is null) >= account.max_sessions
      or exists(select 1 from app.sessions where vehicle_id=p_vehicle and ended_at is null) then
    raise exception 'ACTIVE_SESSION_LIMIT' using errcode='P0001';
  end if;
  insert into app.sessions(user_id,vehicle_id,space_id) values (p_actor,p_vehicle,p_space) returning id into new_id;
  insert into app.activity(actor,action,target,zone_id) values (p_actor,'session.start',new_id,z);
  update app.requests set result_id=new_id where actor=p_actor and operation='claim' and request_key=p_key;
  return new_id;
end; $$;

create function app.release(p_actor uuid, p_session uuid, p_key uuid, p_reason text)
returns uuid language plpgsql set search_path = '' as $$
declare
  account app.profiles%rowtype;
  current_session app.sessions%rowtype;
  prior app.requests%rowtype;
  z uuid;
  f text := p_session::text || ':' || coalesce(p_reason,'');
begin
  insert into app.requests(actor,operation,request_key,fingerprint)
    values (p_actor,'release',p_key,f) on conflict do nothing;
  select * into prior from app.requests
    where actor=p_actor and operation='release' and request_key=p_key for update;
  select * into account from app.profiles where id=p_actor for no key update;
  if account.id is null or not account.verified or account.suspended then
    raise exception 'PARKING_FORBIDDEN' using errcode='P0001';
  end if;
  select * into current_session from app.sessions where id=p_session;
  if current_session.id is null or (current_session.user_id <> p_actor and
      (account.role not in ('admin','officer') or coalesce(length(trim(p_reason)),0)<3)) then
    raise exception 'PARKING_FORBIDDEN' using errcode='P0001';
  end if;
  if prior.fingerprint <> f then raise exception 'REQUEST_REUSED' using errcode='P0001'; end if;
  if prior.result_id is not null then return prior.result_id; end if;

  perform id from app.vehicles where id=current_session.vehicle_id for no key update;
  select zone_id into z from app.spaces where id=current_session.space_id;
  perform id from app.zones where id=z for no key update;
  perform id from app.spaces where id=current_session.space_id for no key update;
  select * into current_session from app.sessions where id=p_session for no key update;
  if current_session.ended_at is null then
    update app.sessions set ended_at=clock_timestamp(), ended_by=p_actor,
      end_reason=coalesce(p_reason,'Driver departed') where id=p_session;
    insert into app.activity(actor,action,target,zone_id,reason)
      values (p_actor,'session.end',p_session,z,p_reason);
  end if;
  update app.requests set result_id=p_session where actor=p_actor and operation='release' and request_key=p_key;
  return p_session;
end; $$;

revoke all on function app.claim(uuid,uuid,uuid,uuid,boolean) from public;
revoke all on function app.release(uuid,uuid,uuid,text) from public;
grant execute on function app.claim(uuid,uuid,uuid,uuid,boolean) to parking_runtime;
grant execute on function app.release(uuid,uuid,uuid,text) to parking_runtime;
