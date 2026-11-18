"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Bell, CarFront, Compass, History, House, LogOut, Map as MapIcon, MapPin, Search, Shield, SquareParking, UserRound } from "lucide-react";
import { api, campusTime, mutation } from "@/lib/api";
import { browserAuth } from "@/lib/supabase-browser";
import { campusDirectionsUrl, categories, categoryDisplay, kinds, type Campus, type Category, type MapFocus, type Notice, type Profile, type Rule, type Session,
  type Space, type Vehicle, type Zone } from "@/lib/contracts";
import { campusFocus, rankEligibleSpaces, zoneFocus, zoneStatus } from "@/lib/map-geometry";
import { MapView } from "./map-view";
import { ParkingOverview } from "./parking-overview";
import { SiteBrand } from "./site-brand";
import { Staff } from "./staff";
import { useParkingUpdates } from "./realtime";

type Tab = "Home" | "Map" | "Find Parking" | "My Parking" | "Profile" | "Notices" | "Operations";
type Home = { vehicles: Vehicle[]; sessions: (Session & { vehicle_id: string; space_id: string })[]; notices: Notice[]; rules: Rule[] };
type HomeResponse = Home & { profile: Profile };
type Snapshot = { zones: Zone[]; spaces: Space[]; syncedAt: string };
const empty: Home = { vehicles: [], sessions: [], notices: [], rules: [] };
const tabs = [
  { name: "Home", icon: House },
  { name: "Map", icon: MapIcon },
  { name: "Find Parking", icon: Search },
  { name: "My Parking", icon: History },
  { name: "Notices", icon: Bell },
  { name: "Profile", icon: UserRound },
  { name: "Operations", icon: Shield },
] as const;
const fields = (form: HTMLFormElement) => Object.fromEntries(new FormData(form));

function canOpenOperations(profile: Profile) {
  return profile.verified && (profile.role === "admin" || profile.role === "officer");
}

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
  const [visibleCategories, setVisibleCategories] = useState<readonly Category[]>(categories);
  const [search, setSearch] = useState("");
  const [originId, setOriginId] = useState("main-gate");
  const [sort, setSort] = useState("distance");
  const [online, setOnline] = useState(true);
  const [syncProblem, setSyncProblem] = useState(true);
  const [syncedVehicle, setSyncedVehicle] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const previousNotices = useRef<Set<string> | null>(null);
  const [newNoticeId, setNewNoticeId] = useState("");
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
      const previous = previousNotices.current;
      const added = previous && data.notices.find((notice) => !notice.read_at && !previous.has(notice.id));
      if (added) setNewNoticeId(added.id);
      previousNotices.current = new Set(data.notices.map((notice) => notice.id));
      setHome(data);
      setProfile(data.profile);
      if (!canOpenOperations(data.profile))
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
  const staff = canOpenOperations(profile);
  const writes = online && !busy;
  const canClaim = writes && !syncProblem && syncedVehicle === vehicle && profile.verified;
  const active = home.sessions.filter((session) => !session.ended_at);
  const mySelectedSpot = active.find((session) => session.space_id === spaceId);
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
  const deselect = useCallback(() => {
    setZoneId("");
    setSpaceId("");
  }, []);
  function focusMap(target: MapFocus | null) {
    deselect();
    setFocus(target);
  }
  function overview() {
    focusMap(campus ? campusFocus(campus.size) : null);
  }
  function filterCategories(next: readonly Category[]) {
    setVisibleCategories(next);
    if (selectedZone && !next.includes(selectedZone.category)) overview();
  }
  const filter = visibleCategories.length === categories.length ? "" : visibleCategories.length === 1 ? visibleCategories[0] : "custom";
  const visibleZones = zones.filter((zone) => visibleCategories.includes(zone.category));
  const term = search.trim().toLowerCase();
  const matchingZones = visibleZones.filter((zone) => (zone.name + " " + zone.code).toLowerCase().includes(term));
  const matchingBuildings = term ? campus?.buildings.filter(([name]) => name.toLowerCase().includes(term)).slice(0, 6) : [];
  const matchingRoads = term ? campus?.roads.filter(([name]) => name.toLowerCase().includes(term)).slice(0, 6) : [];
  const choices = useMemo(() => {
    if (!snapshot || syncedVehicle !== vehicle) return [];
    const origin = campus?.origins.find((entry) => entry.id === originId);
    return rankEligibleSpaces(snapshot.spaces, origin, sort === "availability");
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
  function goToTab(next: Tab) {
    setTab(next);
    if (next === "Notices") setNewNoticeId("");
    window.scrollTo(0, 0);
  }
  async function signOut() {
    await browserAuth().auth.signOut();
    location.assign("/");
  }
  function showOnMap(id: string) {
    setVisibleCategories(categories);
    setSearch("");
    chooseSpace(id);
    goToTab("Map");
  }
  function findNearest() {
    const gate = campus?.origins.find((origin) => origin.id === "main-gate");
    if (!gate || !canClaim || !vehicle) return;
    const [nearest] = rankEligibleSpaces(spaces, gate);
    if (!nearest) { setMessage("No eligible spaces are currently open for this vehicle."); return; }
    showOnMap(nearest.id);
    setMessage("Nearest eligible space to the main entrance: " + nearest.code);
  }
  function showMySpot() {
    const session = active.find((item) => item.vehicle_id === vehicle) ?? (active.length === 1 ? active[0] : undefined);
    if (session) showOnMap(session.space_id);
    else goToTab("My Parking");
  }
  function endSession(id: string) {
    return run(() => withKey("end:" + id, "sessions/" + id + "/end", {}), "Parking session ended.");
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

  const initials = profile.name.trim().split(/\s+/).slice(0, 2).map((word) => Array.from(word)[0]).join("").toUpperCase();
  const unread = home.notices.filter((notice) => !notice.read_at).length;
  const newNotice = home.notices.find((notice) => notice.id === newNoticeId && !notice.read_at);

  return <div className="app-layout">
    <aside className="side-rail">
      <div className="rail-brand"><SiteBrand /></div>
      <nav className="app-nav" aria-label="Parking application">
        {tabs.filter(({ name }) => name !== "Operations" || staff).map(({ name, icon: Icon }) => <button key={name}
          aria-pressed={name === tab} aria-label={name} aria-description={name === "Notices" && unread ? unread + " unread notices" : undefined}
          onClick={() => goToTab(name)}>
          <span className="nav-icon"><Icon size={20} aria-hidden="true" />{name === "Notices" && unread > 0 && <span className="unread-count" aria-hidden="true">{unread}</span>}</span>
          <span className={name === "Operations" ? "operations-label" : undefined}>{name}</span>
          {name === "Operations" && <span className="operations-short">Ops</span>}
        </button>)}
      </nav>
      <div className="rail-footer">
        <div className="rail-user"><span className="user-avatar" aria-hidden="true">{initials || "U"}</span>
          <div><strong>{profile.name}</strong><span>{profile.role}</span></div></div>
        <button className="rail-sign-out" onClick={() => void signOut()}><LogOut size={17} aria-hidden="true" /> Sign out</button>
      </div>
    </aside>

    <main className="shell app-main">
      <header className="app-head">
        <div className="mobile-brand"><SiteBrand /></div>
        <div className="app-location"><MapPin size={17} aria-hidden="true" /> University of Moratuwa</div>
        <div className="app-sync" role="status">
          <span className="sync-dot" data-state={!online ? "offline" : syncProblem ? "waiting" : "updated"} />
          <div>
            <strong>{!online ? "Offline. Parking changes are paused." :
              syncProblem ? snapshot ? "Availability may be out of date." : "Checking availability…" : "Availability updated"}</strong>
            {snapshot && <time dateTime={snapshot.syncedAt}>Last refreshed {campusTime(snapshot.syncedAt)}</time>}
          </div>
        </div>
        <div className="app-head-actions">
          {demo && <span className="demo-label" title="Student project">Demo data</span>}
          <button className="mobile-sign-out" aria-label="Sign out" onClick={() => void signOut()}><LogOut size={18} aria-hidden="true" /></button>
        </div>
      </header>
      {online && syncProblem && <div className="app-alert"><button disabled={busy} onClick={() => void refresh()}>Refresh availability</button></div>}
      {!profile.verified && <p className="app-alert">Your campus role is waiting for administrator verification.</p>}
      {message && <p className="app-alert" role="status">{message}</p>}
      {tab !== "Notices" && newNotice && <div className="app-alert" role="status">New notice · {newNotice.title}{" "}
        <button className="text-action" onClick={() => goToTab("Notices")}>View notices</button></div>}

      {tab === "Home" ? <ParkingOverview name={profile.name} zones={snapshot?.zones} vehicleCount={home.vehicles.length}
        active={active} notices={home.notices} onFind={() => goToTab("Find Parking")} onMap={() => goToTab("Map")}
        onSessions={() => goToTab("My Parking")} onNotices={() => goToTab("Notices")} /> : <div className="page-intro">
        <h1>{tab === "Map" ? "Campus map" : tab}</h1>
        {(tab === "Map" || tab === "Find Parking") && <label className="vehicle-picker">
          <span><CarFront size={18} aria-hidden="true" /> Selected vehicle</span>
          <select value={vehicle} disabled={busy} onChange={(event) => setVehicleChoice(event.target.value)}>
            <option value="">Select a vehicle</option>{home.vehicles.map((row) =>
              <option key={row.id} value={row.id}>{row.plate || row.model || row.kind} · {row.kind}</option>)}
          </select>
        </label>}
      </div>}

      {tab === "Map" && <section className="map-grid">
        {campus ? <MapView campus={campus} zones={visibleZones} spaces={spaces} selected={zoneId} selectedSpace={spaceId} focus={focus}
          onZone={chooseZone} onSpace={chooseSpace} onOverview={overview} onDeselect={deselect} /> :
          <p className="card">{campusError ? "Campus map assets could not load. Use the zone list." : "Loading campus…"}</p>}
        <div className="card mobile-sheet stack">
          <div className="actions">
            <button disabled={!vehicle || !canClaim || !campus} onClick={findNearest}>Nearest free</button>
            {active.length > 0 && <button onClick={showMySpot}>My spot</button>}
          </div>
          {selectedZone && <section className="stack" aria-label="Selected parking zone">
            <div className="actions">
              <span className="tag" style={{ borderLeft: "5px solid " + categoryDisplay[selectedZone.category].color }}>
                {selectedZone.code} · {categoryDisplay[selectedZone.category].label}
              </span>
              {!selectedZone.open && <span className="tag">Closed</span>}
            </div>
            <h2>{selectedZone.name}</h2><p>{selectedZone.instructions}</p>
            <p className="small">Zone status · {zoneStatus(selectedZone).label}</p>
            <div className="zone-metrics">
              <span><strong>{selectedZone.available}</strong> Available</span>
              <span><strong>{selectedZone.occupied}</strong> Occupied</span>
              <span><strong>{selectedZone.proposed_capacity}</strong> Planned</span>
            </div>
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
              {mySelectedSpot ? <button className="primary" disabled={!writes || !profile.verified}
                onClick={() => void endSession(mySelectedSpot.id)}>I’ve left</button> :
              <button className="primary" disabled={!canClaim || !vehicle || parkedVehicles.has(vehicle) || !selectedSpace.eligible || !selectedSpace.available}
                onClick={() => void run(() => withKey("claim:" + vehicle + selectedSpace.id, "sessions",
                  { vehicleId: vehicle, spaceId: selectedSpace.id }), "Parking session started.")}>I’ve parked here</button>}
            </div>}
            <details><summary>Report a problem</summary><form onSubmit={sendReport}>
              <label>Problem<select name="kind"><option value="incorrect">Incorrect status</option><option value="blocked">Blocked space</option>
                <option value="unauthorized">Unauthorized parking</option><option value="wrong_category">Wrong vehicle category</option></select></label>
              <label>Details<textarea name="description" minLength={3} maxLength={800} required /></label>
              <button disabled={!writes || !profile.verified}>Send report</button>
            </form></details>
          </section>}
          <label>Search campus<span className="search-field"><Search size={17} aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Zone, building, or road" /></span></label>
          {matchingBuildings?.length ? <div className="actions" role="group" aria-label="Matching buildings">
            {matchingBuildings.map(([name, x, y, width, height]) => <button key={name} onClick={() => focusMap({
              point: [x + width / 2, y + height / 2], size: [Math.max(82, width), Math.max(82, height)],
            })}>{name}</button>)}
          </div> : null}
          {matchingRoads?.length ? <div className="actions" role="group" aria-label="Matching roads">
            {matchingRoads.map(([name, w, points]) => <button key={name} onClick={() => focusMap(zoneFocus({
              type: "strip", points, w,
            }))}>{name}</button>)}
          </div> : null}
          {campus && <details><summary>Road directory ({campus.roads.length})</summary>
            <div className="actions" role="group" aria-label="Road directory">{campus.roads.map(([name, w, points]) =>
              <button key={name} onClick={() => focusMap(zoneFocus({ type: "strip", points, w }))}>{name}</button>)}</div>
          </details>}
          <label>Parking category<select value={filter} onChange={(event) => filterCategories(event.target.value ? [event.target.value as Category] : categories)}>
            <option value="">All categories</option>{filter === "custom" && <option disabled value="custom">Custom selection</option>}{categories.map((category) =>
              <option value={category} key={category}>{categoryDisplay[category].label}</option>)}
          </select></label>
          <div className="zone-list" role="group" aria-label="Parking zones">{matchingZones.map((zone) => <button key={zone.id}
            aria-pressed={zone.id === zoneId} onClick={() => chooseZone(zone.id)}><span>{zone.code} · {zone.name}</span>
            <span className="zone-open" data-available={zone.open && zone.available > 0}>{zone.open ? zone.available + " open" : "Closed"}</span></button>)}</div>
          <details><summary>Map legend</summary>
            <p className="small muted">Green pins have spaces available. Amber means fewer than 40% are open. Red means full. Gray marks closed or unavailable zones.</p>
            {categories.map((category) => {
              const group = zones.filter((zone) => zone.category === category);
              const occupied = group.reduce((sum, zone) => sum + zone.occupied, 0);
              const inventory = group.reduce((sum, zone) => sum + zone.inventory, 0);
              return <label className="check" key={category}><input type="checkbox" checked={visibleCategories.includes(category)}
                onChange={(event) => filterCategories(event.target.checked ? [...visibleCategories, category] : visibleCategories.filter((item) => item !== category))} />
                <span style={{ borderLeft: "4px solid " + categoryDisplay[category].color, paddingLeft: ".5rem" }}>
                  {categoryDisplay[category].label} · {occupied} / {inventory} occupied
                  <progress className="legend-meter" aria-label={categoryDisplay[category].label + " occupancy"}
                    value={occupied} max={Math.max(1, inventory)} /></span></label>;
            })}
          </details>
          <a className="text-action campus-directions" href={campusDirectionsUrl} referrerPolicy="no-referrer"><Compass size={17} aria-hidden="true" /> Campus directions (Google Maps)</a>
        </div>
      </section>}

      {tab === "Find Parking" && <section className="card stack find-panel">
        <h2>Eligible spaces</h2>
        <div className="find-filters">
          <label>Starting point<select value={originId} onChange={(event) => setOriginId(event.target.value)}>
            {campus?.origins.map((origin) => <option key={origin.id} value={origin.id}>{origin.name}</option>)}
          </select></label>
          <label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="distance">Approximate distance</option><option value="availability">Most eligible spaces</option>
          </select></label>
        </div>
        <p className="muted">Distances use the schematic campus map. A space may be taken before you arrive.</p>
        {!vehicle ? <div className="empty-state"><span className="feature-icon"><CarFront size={22} aria-hidden="true" /></span>
          <p>Register or select a vehicle to see eligible spaces.</p>
          <button className="text-action" onClick={() => goToTab("Profile")}>Manage vehicles <ArrowRight size={16} aria-hidden="true" /></button>
        </div> :
          syncedVehicle !== vehicle ? <p role="status">Checking which spaces match your vehicle…</p> :
          choices.length ? choices.slice(0, 30).map((space) =>
            <div className="result-row" key={space.id}><span className="feature-icon"><MapPin size={18} aria-hidden="true" /></span>
              <div><h3>{space.zone_name}</h3><p className="small muted">{space.code}</p></div>
              <button onClick={() => showOnMap(space.id)}>Show on map <ArrowRight size={16} aria-hidden="true" /></button></div>) :
            <p>No eligible open spaces currently match this vehicle.</p>}
      </section>}

      {tab === "My Parking" && <section className="card stack"><h2>Parking sessions</h2>
        {!home.sessions.length && <div className="empty-state"><span className="feature-icon"><History size={22} aria-hidden="true" /></span>
          <p>No parking sessions yet.</p><button className="text-action" onClick={() => goToTab("Find Parking")}>
            Find parking <ArrowRight size={16} aria-hidden="true" /></button></div>}
        {home.sessions.map((session) => <div className="result-row" key={session.id}>
          <span className="feature-icon" data-tone={session.ended_at ? "blue" : "green"}><SquareParking size={18} aria-hidden="true" /></span>
          <div><h3>{session.code} · {session.zone_name}</h3>
            <p className="small muted">{session.plate ?? session.kind} · Parked {campusTime(session.started_at)}</p>
            {session.ended_at && <p className="small muted">Left {campusTime(session.ended_at)}</p>}
          </div>
          {!session.ended_at && <div className="actions">
            <button onClick={() => showOnMap(session.space_id)}>Show my spot</button>
            <button className="primary" disabled={!writes || !profile.verified} onClick={() => void endSession(session.id)}>I’ve left</button></div>}
        </div>)}
      </section>}

      {tab === "Profile" && <section className="panel-grid">
        <div className="card"><h2>Account details</h2><p className="account-role">{profile.role} · {profile.verified ? "Verified" : "Pending verification"}</p>
          <form onSubmit={(event) => {
            event.preventDefault();
            const data = fields(event.currentTarget);
            void run(async () => setProfile(await api<Profile>("profile", mutation(data, "PATCH"))), "Profile updated.");
          }}><label>Name<input name="name" defaultValue={profile.name} required maxLength={100} /></label>
            <button className="primary" disabled={!writes}>Save name</button></form>
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
        <div className="card"><h2>Campus notices</h2>{!home.notices.length && <p className="muted">No current notices.</p>}
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
    </main>
  </div>;
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
