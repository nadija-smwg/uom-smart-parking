"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { api, campusTime, mutation } from "@/lib/api";
import { browserAuth } from "@/lib/supabase-browser";
import { campusDirectionsUrl, categories, categoryDisplay, kinds, type Campus, type MapFocus, type Notice, type Profile, type Rule, type Session,
  type Space, type Vehicle, type Zone } from "@/lib/contracts";
import { campusFocus, zoneFocus } from "@/lib/map-geometry";
import { MapView } from "./map-view";
import { Staff } from "./staff";
import { useParkingUpdates } from "./realtime";

type Tab = "Home" | "Map" | "Find Parking" | "My Parking" | "Profile" | "Notices" | "Operations";
type Home = { vehicles: Vehicle[]; sessions: (Session & { vehicle_id: string })[]; notices: Notice[]; rules: Rule[] };
type HomeResponse = Home & { profile: Profile };
type Snapshot = { zones: Zone[]; spaces: Space[]; syncedAt: string };
const empty: Home = { vehicles: [], sessions: [], notices: [], rules: [] };
const tabs: Tab[] = ["Home", "Map", "Find Parking", "My Parking", "Profile", "Notices"];
const fields = (form: HTMLFormElement) => Object.fromEntries(new FormData(form));

function status(space: Space, vehicle: string, syncedVehicle: string | null) {
  if (space.occupied) return "Occupied";
  if (!space.available) return space.state === "open" ? "Zone unavailable" : space.state.replace("_", " ");
  if (!vehicle) return "Available";
  if (syncedVehicle !== vehicle) return "Checking vehicle eligibility";
  return space.eligible ? "Available for your vehicle" : "Restricted for your vehicle";
}

export function ParkingApp({ initialProfile, demo }: { initialProfile: Profile; demo: boolean }) {
  const [profile, setProfile] = useState(initialProfile);
  const [tab, setTab] = useState<Tab>("Home");
  const [home, setHome] = useState<Home>(empty);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [campus, setCampus] = useState<Campus>();
  const [campusError, setCampusError] = useState(false);
  const [vehicleChoice, setVehicleChoice] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [originId, setOriginId] = useState("main-gate");
  const [sort, setSort] = useState("distance");
  const [online, setOnline] = useState(true);
  const [syncProblem, setSyncProblem] = useState(true);
  const [syncedVehicle, setSyncedVehicle] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const request = useRef<AbortController | null>(null);
  const keys = useRef(new Map<string, string>());
  const vehicle = vehicleChoice === "" ? "" : home.vehicles.find((row) => row.id === vehicleChoice)?.id ?? home.vehicles[0]?.id ?? "";

  const refresh = useCallback(async () => {
    request.current?.abort();
    if (!navigator.onLine) return;
    const current = new AbortController();
    request.current = current;
    try {
      const options = { signal: current.signal };
      const [data, currentMap] = await Promise.all([
        api<HomeResponse>("home", options),
        api<Snapshot>("campus" + (vehicle ? "?vehicle=" + encodeURIComponent(vehicle) : ""), options),
      ]);
      if (current.signal.aborted || !navigator.onLine) return;
      setHome(data);
      setProfile(data.profile);
      if (data.profile.role !== "admin" && data.profile.role !== "officer")
        setTab((currentTab) => currentTab === "Operations" ? "Home" : currentTab);
      setSnapshot(currentMap);
      setSyncedVehicle(vehicle);
      setSyncProblem(false);
    } catch {
      if (!current.signal.aborted) setSyncProblem(true);
    }
  }, [vehicle]);

  const latestRefresh = useRef(refresh);
  useEffect(() => {
    latestRefresh.current = refresh;
    void refresh();
    return () => request.current?.abort();
  }, [refresh]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/campus.json", { signal: controller.signal }).then((result) => {
      if (!result.ok) throw new Error("Campus assets unavailable");
      return result.json() as Promise<Campus>;
    }).then(setCampus).catch(() => { if (!controller.signal.aborted) setCampusError(true); });
    return () => controller.abort();
  }, []);
  const network = useCallback((connected: boolean) => {
    request.current?.abort();
    setOnline(connected);
    setSyncProblem(true);
  }, []);
  useParkingUpdates(() => void refresh(), network);

  const zones = snapshot?.zones ?? [];
  const spaces = snapshot?.spaces ?? [];
  const selectedZone = zones.find((zone) => zone.id === zoneId);
  const selectedSpace = spaces.find((space) => space.id === spaceId && space.zone_id === zoneId);
  const staff = profile.role === "admin" || profile.role === "officer";
  const writes = online && !busy;
  const canClaim = writes && !syncProblem && syncedVehicle === vehicle && profile.verified;
  const active = home.sessions.filter((session) => !session.ended_at);
  const parkedVehicles = new Set(active.map((session) => session.vehicle_id));
  const spaceStatus = (space: Space) => status(space, vehicle, syncedVehicle);
  const chooseZone = useCallback((id: string) => {
    const zone = snapshot?.zones.find((row) => row.id === id);
    if (!zone) return;
    setZoneId(id);
    setSpaceId("");
    setFocus(zoneFocus(zone.geometry));
  }, [snapshot]);
  const chooseSpace = useCallback((id: string) => {
    const space = snapshot?.spaces.find((row) => row.id === id);
    if (!space) return;
    setZoneId(space.zone_id);
    setSpaceId(id);
    setFocus({ point: [space.x, space.y], size: [42, 42] });
  }, [snapshot]);
  function focusMap(target: MapFocus | null) {
    setZoneId("");
    setSpaceId("");
    setFocus(target);
  }
  function overview() {
    focusMap(campus ? campusFocus(campus.size) : null);
  }
  const visibleZones = zones.filter((zone) => !filter || zone.category === filter);
  const term = search.trim().toLowerCase();
  const matchingZones = visibleZones.filter((zone) => (zone.name + " " + zone.code).toLowerCase().includes(term));
  const matchingBuildings = term ? campus?.buildings.filter(([name]) => name.toLowerCase().includes(term)).slice(0, 6) : [];
  const choices = useMemo(() => {
    if (!snapshot || syncedVehicle !== vehicle) return [];
    const origin = campus?.origins.find((entry) => entry.id === originId);
    const distance = (space: Space) => origin ? Math.hypot(space.x - origin.x, space.y - origin.y) : 0;
    const zoneCounts = new Map<string, number>();
    for (const space of snapshot.spaces) {
      if (space.available && space.eligible) zoneCounts.set(space.zone_id, (zoneCounts.get(space.zone_id) ?? 0) + 1);
    }
    return snapshot.spaces.filter((space) => space.available && space.eligible)
      .sort((a, b) => (sort === "availability" ? (zoneCounts.get(b.zone_id) ?? 0) - (zoneCounts.get(a.zone_id) ?? 0) : 0) ||
        distance(a) - distance(b) || a.code.localeCompare(b.code));
  }, [snapshot, campus, originId, sort, syncedVehicle, vehicle]);

  async function run(task: () => Promise<unknown>, confirmation: string) {
    if (submitting.current || !navigator.onLine) return;
    submitting.current = true;
    setBusy(true);
    setMessage("");
    try { await task(); setMessage(confirmation); }
    catch (error) {
      setMessage(error instanceof Error ? error.message : "The action failed.");
    } finally {
      setSyncProblem(true);
      await latestRefresh.current();
      submitting.current = false;
      setBusy(false);
    }
  }
  async function withKey(action: string, path: string, body: unknown) {
    const key = keys.current.get(action) ?? crypto.randomUUID();
    keys.current.set(action, key);
    await api(path, mutation(body, "POST", key));
    keys.current.delete(action);
  }
  function showOnMap(id: string) {
    setFilter("");
    chooseSpace(id);
    setTab("Map");
  }
  async function sendReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedZone) return;
    const form = event.currentTarget;
    const data = fields(form);
    await run(async () => {
      await api("reports", mutation({ ...data, zoneId: selectedZone.id, spaceId: selectedSpace?.id ?? null }));
      form.reset();
    }, "Report sent to parking staff.");
  }

  return <main className="shell">
    <header className="app-head">
      <div><p className="eyebrow">University of Moratuwa</p><h1>Smart Parking</h1>
        {demo && <span className="tag">Student project · Demo data</span>}</div>
      <button onClick={async () => { await browserAuth().auth.signOut(); location.assign("/"); }}>Sign out</button>
    </header>
    <nav className="actions app-nav" aria-label="Parking application">
      {[...tabs, ...(staff ? ["Operations" as const] : [])].map((name) => <button key={name}
        aria-pressed={name === tab} onClick={() => setTab(name)}>{name}
        {name === "Notices" && home.notices.some((notice) => !notice.read_at) && " •"}</button>)}
    </nav>
    <div className="small muted" role="status">
      {!online ? "Offline. Parking changes are paused. " :
        syncProblem && snapshot ? "Availability may be out of date. " : ""}
      {snapshot ? "Last refreshed " + campusTime(snapshot.syncedAt) :
        online ? "Waiting for parking availability." : ""}
    </div>
    {online && syncProblem && <button disabled={busy} onClick={() => void refresh()}>Refresh availability</button>}
    {!profile.verified && <p className="card">Your campus role is waiting for administrator verification.</p>}
    {message && <p className="card" role="status">{message}</p>}

    {tab === "Home" && <section className="stack">
      <div className="card"><h2>Welcome, {profile.name}</h2><p>Availability is based on manual parking reports.</p>
        <div className="actions"><button className="primary" onClick={() => setTab("Find Parking")}>Find Parking</button>
          <button onClick={() => setTab("Map")}>View campus</button></div></div>
      <div className="kpis">
        <div className="card"><strong>{home.vehicles.length}</strong>Registered vehicles</div>
        <div className="card"><strong>{active.length}</strong>Active sessions</div>
        {categories.map((category) => {
          const rows = zones.filter((zone) => zone.category === category);
          return <div className="card" key={category}><h3>{categoryDisplay[category].label}</h3>
            <strong>{rows.reduce((sum, row) => sum + row.available, 0)} available</strong>
            <p>{rows.reduce((sum, row) => sum + row.occupied, 0)} occupied · {rows.reduce((sum, row) => sum + row.inventory, 0)} total</p>
          </div>;
        })}
      </div>
      {active.length > 0 && <section className="card stack">
        <h2>Active parking</h2>
        {active.map((session) => <p key={session.id}>{session.code} · {session.zone_name} · {session.plate ?? session.kind}</p>)}
        <div><button onClick={() => setTab("My Parking")}>Manage active parking</button></div>
      </section>}
      <div className="card"><h2>Recent notices</h2>{home.notices.length
        ? home.notices.slice(0, 3).map((notice) => <p key={notice.id}>{notice.title}</p>) : <p>No current notices.</p>}</div>
    </section>}

    {(tab === "Map" || tab === "Find Parking") && <label className="card">Selected vehicle
      <select value={vehicle} disabled={busy} onChange={(event) => setVehicleChoice(event.target.value)}>
        <option value="">Select a vehicle</option>{home.vehicles.map((row) =>
          <option key={row.id} value={row.id}>{row.plate || row.model || row.kind} · {row.kind}</option>)}
      </select>
    </label>}

    {tab === "Map" && <section className="map-grid">
      {campus ? <MapView campus={campus} zones={visibleZones} spaces={spaces} selected={zoneId} selectedSpace={spaceId} focus={focus}
        onZone={chooseZone} onSpace={chooseSpace} onOverview={overview} /> :
        <p className="card">{campusError ? "Campus map assets could not load. Use the zone list." : "Loading campus…"}</p>}
      <div className="card mobile-sheet stack">
        {selectedZone && <section className="stack" aria-label="Selected parking zone">
          <div className="actions">
            <span className="tag" style={{ borderLeft: "5px solid " + categoryDisplay[selectedZone.category].color }}>
              {selectedZone.code} · {categoryDisplay[selectedZone.category].label}
            </span>
            {!selectedZone.open && <span className="tag">Closed</span>}
          </div>
          <h2>{selectedZone.name}</h2><p>{selectedZone.instructions}</p>
          <p>{selectedZone.available} available · {selectedZone.occupied} occupied · {selectedZone.proposed_capacity} planned</p>
          <label>Parking space<select value={spaceId} onChange={(event) => {
            if (event.target.value) chooseSpace(event.target.value);
            else chooseZone(selectedZone.id);
          }}>
            <option value="">Select a space</option>
            {spaces.filter((space) => space.zone_id === zoneId).map((space) =>
              <option key={space.id} value={space.id}>{space.code} · {spaceStatus(space)}</option>)}
          </select></label>
          {selectedSpace && <div className="record"><strong role="status">{selectedSpace.code} · {spaceStatus(selectedSpace)}</strong>
            <p className="small">Status updated {campusTime(selectedSpace.updated_at)}</p>
            {parkedVehicles.has(vehicle) && <p>This vehicle has an active session in My Parking.</p>}
            <button className="primary" disabled={!canClaim || !vehicle || parkedVehicles.has(vehicle) || !selectedSpace.eligible || !selectedSpace.available}
              onClick={() => void run(() => withKey("claim:" + vehicle + selectedSpace.id, "sessions",
                { vehicleId: vehicle, spaceId: selectedSpace.id }), "Parking session started.")}>I’ve parked here</button>
          </div>}
          <details><summary>Report a problem</summary><form onSubmit={sendReport}>
            <label>Problem<select name="kind"><option value="incorrect">Incorrect status</option><option value="blocked">Blocked space</option>
              <option value="unauthorized">Unauthorized parking</option><option value="wrong_category">Wrong vehicle category</option></select></label>
            <label>Details<textarea name="description" minLength={3} maxLength={800} required /></label>
            <button disabled={!writes || !profile.verified}>Send report</button>
          </form></details>
        </section>}
        <label>Search campus<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Zone or building name" /></label>
        {matchingBuildings?.length ? <div className="actions" role="group" aria-label="Matching buildings">
          {matchingBuildings.map(([name, x, y, width, height]) => <button key={name} onClick={() => focusMap({
            point: [x + width / 2, y + height / 2], size: [Math.max(82, width), Math.max(82, height)],
          })}>{name}</button>)}
        </div> : null}
        <label>Parking category<select value={filter} onChange={(event) => { setFilter(event.target.value); overview(); }}>
          <option value="">All categories</option>{categories.map((category) =>
            <option value={category} key={category}>{categoryDisplay[category].label}</option>)}
        </select></label>
        <div className="zone-list" role="group" aria-label="Parking zones">{matchingZones.map((zone) => <button key={zone.id}
          aria-pressed={zone.id === zoneId} onClick={() => chooseZone(zone.id)}><span>{zone.code} · {zone.name}</span>
          <span>{zone.open ? zone.available + " open" : "Closed"}</span></button>)}</div>
        <details><summary>Map legend</summary>
          <div className="actions">{categories.map((category) =>
            <span className="tag" key={category} style={{ borderLeft: "5px solid " + categoryDisplay[category].color }}>
              {categoryDisplay[category].label}
            </span>)}</div>
        </details>
        <a className="campus-directions" href={campusDirectionsUrl} referrerPolicy="no-referrer">Campus directions (Google Maps)</a>
      </div>
    </section>}

    {tab === "Find Parking" && <section className="card stack">
      <h2>Eligible spaces</h2>
      <div className="actions">
        <label>Starting point<select value={originId} onChange={(event) => setOriginId(event.target.value)}>
          {campus?.origins.map((origin) => <option key={origin.id} value={origin.id}>{origin.name}</option>)}
        </select></label>
        <label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="distance">Approximate distance</option><option value="availability">Most eligible spaces</option>
        </select></label>
      </div>
      <p className="muted">Distances use the schematic campus map. A space may be taken before you arrive.</p>
      {!vehicle ? <p>Register or select a vehicle to see eligible spaces.</p> :
        syncedVehicle !== vehicle ? <p role="status">Checking which spaces match your vehicle…</p> :
        choices.length ? choices.slice(0, 30).map((space) =>
          <div className="record actions" key={space.id}><strong>{space.code} · {space.zone_name}</strong>
            <button onClick={() => showOnMap(space.id)}>Show on map</button></div>) :
          <p>No eligible open spaces currently match this vehicle.</p>}
    </section>}

    {tab === "My Parking" && <section className="card stack"><h2>My Parking</h2>
      {!home.sessions.length && <p>No parking sessions yet.</p>}
      {home.sessions.map((session) => <div className="record" key={session.id}>
        <h3>{session.code} · {session.zone_name}</h3>
        <p>{session.plate ?? session.kind} · Parked {campusTime(session.started_at)}</p>
        {session.ended_at ? <p>Left {campusTime(session.ended_at)}</p> :
          <button className="primary" disabled={!writes || !profile.verified} onClick={() => void run(
            () => withKey("end:" + session.id, "sessions/" + session.id + "/end", {}), "Parking session ended.")}>I’ve left</button>}
      </div>)}
    </section>}

    {tab === "Profile" && <section className="panel-grid">
      <div className="card"><h2>Profile</h2><p>{profile.role} · {profile.verified ? "Verified" : "Pending verification"}</p>
        <form onSubmit={(event) => {
          event.preventDefault();
          const data = fields(event.currentTarget);
          void run(async () => setProfile(await api<Profile>("profile", mutation(data, "PATCH"))), "Profile updated.");
        }}><label>Name<input name="name" defaultValue={profile.name} required maxLength={100} /></label>
          <button disabled={!writes}>Save name</button></form>
      </div>
      <div className="card stack"><h2>Vehicles</h2>
        <VehicleForm disabled={!writes || !profile.verified} submit={(value) =>
          run(() => api("vehicles", mutation(value)), "Vehicle registered.")} />
        {home.vehicles.map((row) => <details className="record" key={row.id}>
          <summary>{row.plate || row.model || "Bicycle"} · {row.kind}</summary>
          {parkedVehicles.has(row.id) && <p>End this vehicle’s active session before editing or archiving it.</p>}
          <VehicleForm item={row} disabled={!writes || !profile.verified || parkedVehicles.has(row.id)} submit={(value) =>
            run(() => api("vehicles/" + row.id, mutation(value, "PATCH")), "Vehicle updated.")} />
          <button disabled={!writes || !profile.verified || parkedVehicles.has(row.id)} onClick={() => void run(() =>
            api("vehicles/" + row.id, { method: "DELETE" }), "Vehicle archived.")}>Archive vehicle</button>
        </details>)}
      </div>
    </section>}

    {tab === "Notices" && <section className="panel-grid">
      <div className="card"><h2>Notices</h2>{!home.notices.length && <p>No current notices.</p>}
        {home.notices.map((notice) => <article className="record" key={notice.id}><h3>{notice.title}</h3>
          <p>{notice.body}</p><p className="small">{campusTime(notice.published_at)}</p>
          {!notice.read_at && <button disabled={!writes} onClick={() => void run(() =>
            api("notifications/" + notice.id + "/read", mutation({})), "Marked as read.")}>Mark as read</button>}
        </article>)}</div>
      <div className="card"><h2>Parking rules</h2>{!home.rules.length && <p>No published rules.</p>}
        {home.rules.map((rule) => <article className="record" key={rule.id}><h3>{rule.title}</h3><p>{rule.body}</p></article>)}</div>
    </section>}

    {tab === "Operations" && staff && <Staff key={profile.role} admin={profile.role === "admin"} online={online}
      liveAt={snapshot?.syncedAt} onChanged={() => void refresh()} />}
  </main>;
}

function VehicleForm({ item, disabled, submit }: {
  item?: Vehicle; disabled: boolean; submit: (value: unknown) => Promise<void>;
}) {
  return <form onSubmit={(event) => { event.preventDefault(); if (!disabled) void submit(fields(event.currentTarget)); }}>
    <label>Vehicle type<select name="kind" defaultValue={item?.kind ?? "car"}>
      {kinds.map((kind) => <option key={kind}>{kind}</option>)}</select></label>
    <label>Registration number<input name="plate" defaultValue={item?.plate ?? ""} maxLength={25} /></label>
    <label>Model or bicycle label<input name="model" defaultValue={item?.model ?? ""} maxLength={100} /></label>
    <label>Color<input name="color" defaultValue={item?.color ?? ""} maxLength={40} /></label>
    <button disabled={disabled}>{item ? "Save changes" : "Register vehicle"}</button>
  </form>;
}
