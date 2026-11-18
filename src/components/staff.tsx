"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api, campusTime, mutation } from "@/lib/api";
import { categories, kinds, roles, states, type Report, type Role, type Session, type Space, type Zone } from "@/lib/contracts";

type OfficerSpace = { id: string; code: string; state: string; occupied: boolean; zone_open: boolean };
type OfficerData = { sessions: Session[]; reports: Report[]; spaces: OfficerSpace[] };
type Account = { id: string; name: string; registration: string; role: Role; verified: boolean; suspended: boolean; max_sessions: number };
type Inventory = {
  zones: Zone[]; spaces: Space[]; access: { zone_id: string; role: string; kind: string }[];
  grants: { zone_id: string; user_id: string; name: string; kind: string; expires_at: string }[];
};
type Notices = {
  notices: { id: string; title: string; body: string; audience: Role[]; state: string; expires_at: string | null }[];
  rules: { id: string; title: string; body: string; active: boolean }[];
};
type Audit = {
  id: string; action: string; actor_name: string | null; reason: string | null; at: string;
  actor: string; target: string; zone_code: string | null; details: Record<string, string | number | boolean>;
};
type Metric = { code: string; name: string; occupied: number; inventory: number; sessions_30d: number; average_minutes_30d: number };
type Save = (path: string, value: unknown, method?: string, key?: string) => Promise<void>;
const formData = (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  return new FormData(event.currentTarget);
};
const value = (data: FormData, key: string) => String(data.get(key) ?? "");
const checked = (data: FormData, key: string) => data.has(key);
const date = (input: string) => {
  const text = input.trim();
  if (!text) return null;
  const result = new Date(text);
  if (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(text) || !Number.isFinite(+result)) {
    throw new Error("Enter a date and time with Z or an offset such as +05:30.");
  }
  return result.toISOString();
};

export function Staff({ admin, online, liveAt, onChanged }: {
  admin: boolean; online: boolean; liveAt?: string; onChanged: () => void;
}) {
  const [tab, setTab] = useState("Officer desk");
  const [query, setQuery] = useState("");
  const [accountQuery, setAccountQuery] = useState("");
  const [officer, setOfficer] = useState<OfficerData>();
  const [inventory, setInventory] = useState<Inventory>();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [notices, setNotices] = useState<Notices>();
  const [audit, setAudit] = useState<Audit[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [zoneId, setZoneId] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const requests = useRef(new Map<string,string>());
  const writing = useRef(false);
  const reading = useRef<AbortController | null>(null);
  const changed = useRef(onChanged);
  changed.current = onChanged;
  const officerUpdatedAt = tab === "Officer desk" ? liveAt : undefined;

  const load = useCallback(async () => {
    reading.current?.abort();
    if (!navigator.onLine) return;
    const controller = new AbortController();
    reading.current = controller;
    const { signal } = controller;
    const get = async <T,>(path: string) => {
      const data = await api<T>(path,{ signal });
      signal.throwIfAborted();
      return data;
    };
    try {
      const q = (term: string) => "?q=" + encodeURIComponent(term);
      switch (tab) {
        case "Officer desk": setOfficer(await get<OfficerData>("officer/overview" + q(query))); break;
        case "Inventory": setInventory(await get<Inventory>("admin/inventory")); break;
        case "Accounts": setAccounts(await get<Account[]>("admin/accounts" + q(accountQuery))); break;
        case "Announcements": setNotices(await get<Notices>("admin/notices")); break;
        case "Audit and analytics": {
          const [log, rows] = await Promise.all([get<Audit[]>("admin/audit"),get<Metric[]>("admin/analytics")]);
          signal.throwIfAborted();
          setAudit(log); setMetrics(rows); break;
        }
      }
    } catch (error) {
      if (!signal.aborted) setMessage(error instanceof Error ? error.message : "Operations could not be loaded.");
    }
  }, [tab,query,accountQuery]);

  const latestLoad = useRef(load);
  useEffect(() => { latestLoad.current = load; }, [load]);
  useEffect(() => {
    const timeout = online ? setTimeout(() => void load(), 180) : undefined;
    return () => { reading.current?.abort(); clearTimeout(timeout); };
  }, [load, officerUpdatedAt, online]);

  const save: Save = async (path, payload, method = "POST", key) => {
    if (writing.current) throw new Error("Wait for the current update to finish.");
    if (!navigator.onLine) throw new Error("Reconnect before saving this change.");
    writing.current = true;
    setBusy(true); setMessage("");
    try {
      await api(path,mutation(payload,method,key));
      setMessage("Saved.");
      await latestLoad.current();
      changed.current();
    } finally { writing.current = false; setBusy(false); }
  };
  const submit = (task: () => Promise<void>) =>
    void Promise.resolve().then(task).catch((error: unknown) => {
      if (error instanceof Error) setMessage(error.message);
    });
  const disable = !online || busy;
  const zone = inventory?.zones.find((row) => row.id === zoneId);
  const space = inventory?.spaces.find((row) => row.id === spaceId && row.zone_id === zoneId);

  return <section className="stack">
    <nav className="actions" aria-label="Operations sections">
      {(admin ? ["Officer desk","Inventory","Accounts","Announcements","Audit and analytics"] : ["Officer desk"])
        .map((page) => <button key={page} aria-pressed={tab === page} onClick={() => { setTab(page); setMessage(""); }}>{page}</button>)}
      <button disabled={!online || busy} onClick={() => void load()}>Refresh</button>
    </nav>
    {message && <p className="card" role="status">{message}</p>}

    {tab === "Officer desk" && <>
      <label className="card">Search by zone or space code<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Z01-001" /></label>
      <div className="panel-grid">
        <div className="card"><h2>Active and stale sessions</h2>
          {officer?.sessions.length === 0 && <p>No active sessions found.</p>}
          {officer?.sessions.map((row) => <details key={row.id} className="record">
            <summary>{row.code} · {row.user_name}{row.stale ? " · Needs review" : ""}</summary>
            <p>{row.plate ?? row.kind} · {campusTime(row.started_at)}</p>
            {row.verified_at && <p>Verified {campusTime(row.verified_at)}</p>}
            <form onSubmit={(event) => {
              const why = value(formData(event),"reason");
              const action = row.id + ":" + why;
              const key = requests.current.get(action) ?? crypto.randomUUID();
              requests.current.set(action,key);
              submit(async () => {
                await save("officer/sessions/" + row.id + "/correct",{ reason:why },"POST",key);
                requests.current.delete(action);
              });
            }}><Reason /><button disabled={disable}>End incorrect session</button></form>
          </details>)}</div>
        <div className="card"><h2>Incident reports</h2>{officer?.reports.length === 0 && <p>No matching reports.</p>}
          {officer?.reports.map((row) => <details key={row.id} className="record">
            <summary>{row.space ?? row.zone} · {row.kind.replace("_"," ")} · {row.status}</summary>
            <p>{row.description}</p>
            {row.status === "resolved" ? <p>{row.resolution}</p> :
              <form onSubmit={(event) => {
                const resolution = value(formData(event),"reason");
                submit(() => save("officer/reports/" + row.id,{resolution},"PATCH"));
              }}><Reason /><button disabled={disable}>Resolve report</button></form>}
          </details>)}</div>
        <div className="card"><h2>Verify a space</h2>{officer?.spaces.length === 0 && <p>No matching spaces.</p>}
          {officer?.spaces.map((row) => <details key={row.id} className="record">
            <summary>{row.code} · {row.occupied && "Reported occupied · "}
              {row.zone_open ? row.state.replace("_"," ") : "Zone closed"}</summary>
            <form onSubmit={(event) => {
              const data = formData(event);
              submit(() => save("officer/spaces/" + row.id + "/verify",Object.fromEntries(data)));
            }}><label>Action<select name="state"><option value="unchanged">Record verification</option>
              <option disabled={row.state === "closed"} value="blocked">Block space</option>
              <option disabled={row.state === "closed"} value="under_review">Mark under review</option>
              <option disabled={row.state === "closed"} value="open">Clear block</option>
            </select></label><Reason /><button disabled={disable}>Record check</button></form>
          </details>)}</div>
      </div>
    </>}

    {tab === "Inventory" && inventory && <>
      <div className="card">
        <label>Parking zone<select value={zoneId} onChange={(event) => { setZoneId(event.target.value); setSpaceId(""); }}>
          <option value="">Create new zone</option>
          {inventory.zones.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}
        </select></label>
      </div>
      <div className="panel-grid">
        <div className="card"><h2>{zone ? "Edit zone" : "New zone"}</h2>
          <ZoneForm key={zone ? zone.id + ":" + zone.version : "new"} row={zone} disabled={disable} save={save} submit={submit} />
        </div>
        {zone && <div className="card stack"><h2>Spaces</h2>
          <p>{zone.inventory} published spaces</p>
          <label>Parking space<select value={spaceId} onChange={(event) => setSpaceId(event.target.value)}><option value="">Create space</option>
            {inventory.spaces.filter((row) => row.zone_id === zone.id).map((row) =>
              <option value={row.id} key={row.id}>{row.code} · {row.state}</option>)}</select></label>
          <SpaceForm key={space ? space.id + ":" + space.version : zone.id} zone={zone} row={space} disabled={disable} save={save} submit={submit} />
        </div>}
        {zone && <div className="card stack"><h2>Eligibility</h2>
          <p>{inventory.access.filter((row) => row.zone_id === zone.id).map((row) => row.role + " / " + row.kind).join(" · ") || "No role rules."}</p>
          <form onSubmit={(event) => {
            const data = formData(event);
            submit(() => save("admin/access",{ zoneId:zone.id, role:value(data,"role"),kind:value(data,"kind"),
              allowed:value(data,"direction")==="allow",reason:value(data,"reason") }));
          }}><RoleField /><KindField /><AccessField /><Reason /><button disabled={disable}>Apply role rule</button></form>
          <details><summary>Account-specific exception</summary>
            {(inventory.grants ?? []).filter((row) => row.zone_id === zone.id).map((row) =>
              <p className="record" key={row.user_id + ":" + row.kind}>
                {row.name} · {row.kind} · {+new Date(row.expires_at) <= Date.now() ? "Expired" : "Expires"} {campusTime(row.expires_at)}
              </p>)}
            <form onSubmit={(event) => {
              const data = formData(event);
              submit(() => save("admin/grants",{ zoneId:zone.id,userId:value(data,"user"),kind:value(data,"kind"),
                allowed:value(data,"direction")==="allow",expiresAt:date(value(data,"expiry"))??undefined,reason:value(data,"reason") }));
            }}><label>Account ID<input name="user" required placeholder="Copy the ID from Accounts" /></label><KindField />
              <label>Expiry with timezone<input name="expiry" placeholder="2027-01-31T18:00:00+05:30" /></label>
              <AccessField /><Reason /><button disabled={disable}>Apply account exception</button></form>
          </details>
        </div>}
      </div>
    </>}

    {tab === "Accounts" && <div className="card">
      <h2>Accounts</h2><label>Search name<input value={accountQuery} onChange={(event) => setAccountQuery(event.target.value)} /></label>
      {accounts.map((row) => <details className="record" key={row.id + row.role + row.verified + row.suspended + row.max_sessions}>
        <summary>{row.name} · {row.role} · {row.suspended ? "Suspended" : row.verified ? "Verified" : "Pending"}</summary>
        <p className="small">Account ID {row.id} · {row.registration} registration</p>
        <form onSubmit={(event) => {
          const data = formData(event);
          submit(() => save("admin/accounts/" + row.id,{ role:value(data,"role"),verified:checked(data,"verified"),suspended:checked(data,"suspended"),
            max_sessions:Number(value(data,"max")),reason:value(data,"reason") },"PATCH"));
        }}><RoleField initial={row.role} /><label>Maximum concurrent sessions<input name="max" type="number" min="1" max="10" defaultValue={row.max_sessions} required /></label>
          <Check name="verified" label="Verified affiliation" initial={row.verified} /><Check name="suspended" label="Suspended" initial={row.suspended} />
          <Reason /><button disabled={disable}>Save account</button></form>
      </details>)}
    </div>}

    {tab === "Announcements" && notices && <div className="panel-grid">
      <div className="card"><h2>Announcements</h2>
        <NoticeForm disabled={disable} save={save} submit={submit} />
        {notices.notices.map((row) => <details key={row.id + row.state} className="record"><summary>{row.title} · {row.state}</summary>
          <NoticeForm row={row} disabled={disable} save={save} submit={submit} /></details>)}
      </div>
      <div className="card"><h2>Parking rules</h2>
        <RuleForm disabled={disable} save={save} submit={submit} />
        {notices.rules.map((row) => <details key={row.id} className="record"><summary>{row.title}</summary>
          <RuleForm row={row} disabled={disable} save={save} submit={submit} /></details>)}
      </div>
    </div>}

    {tab === "Audit and analytics" && <div className="panel-grid">
      <div className="card"><h2>Parking activity</h2><p>Counts reflect manually reported sessions.</p>
        <p><a href="/api/v1/admin/analytics/csv" download>Download zone summary CSV</a></p>
        {metrics.map((row) => <article key={row.code} className="record"><h3>{row.code} · {row.name}</h3>
          <p>{row.occupied} occupied / {row.inventory} spaces · {row.sessions_30d} sessions in 30 days</p>
          <p>Average completed session in period: {row.average_minutes_30d} min</p></article>)}</div>
      <div className="card"><h2>Audit history</h2>
        {audit.map((row) => <article key={row.id} className="record"><strong>{row.action} · {row.actor_name ?? "Account " + row.actor}</strong>
          {row.zone_code && <p>{row.zone_code}{typeof row.details.state === "string" && " · " + row.details.state.replace("_"," ")}</p>}
          <p>{row.reason}</p><time dateTime={row.at}>{campusTime(row.at)}</time>
          <details><summary>Change details</summary>
            <p className="small">Target {row.target}</p>
            {Object.entries(row.details).filter(([, entry]) => entry !== "").map(([key, entry]) =>
              <p key={key}>{key.replaceAll("_"," ")} · {typeof entry === "boolean" ? entry ? "Yes" : "No" : entry}</p>)}
          </details>
        </article>)}</div>
    </div>}
  </section>;
}

const Reason = () => <label>Reason<textarea name="reason" required minLength={3} maxLength={500} /></label>;
const Check = ({ name,label,initial }: { name:string; label:string; initial:boolean }) =>
  <label className="check"><input type="checkbox" name={name} defaultChecked={initial} />{label}</label>;
const RoleField = ({ initial = "visitor" }: { initial?: Role }) =>
  <label>Role<select name="role" defaultValue={initial}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label>;
const KindField = () => <label>Vehicle type<select name="kind">{kinds.map((kind) => <option key={kind}>{kind}</option>)}</select></label>;
const AccessField = () => <label>Action<select name="direction"><option value="allow">Allow</option><option value="remove">Remove allowance</option></select></label>;
type Editor = { disabled: boolean; save: Save; submit: (task: () => Promise<void>) => void };

function ZoneForm({ row,disabled,save,submit }: Editor & { row?: Zone }) {
  return <form onSubmit={(event) => {
    const data = formData(event);
    submit(() => save("admin/zones" + (row ? "/" + row.id : ""), {
      code:value(data,"code"),name:value(data,"name"),category:value(data,"category"),geometry:JSON.parse(value(data,"geometry")),
      proposed_capacity:Number(value(data,"capacity")),instructions:value(data,"instructions"),open:checked(data,"open"),
      published:checked(data,"published"),verified:checked(data,"verified"),version:row?.version ?? 0,reason:value(data,"reason"),
    },row ? "PATCH" : "POST"));
  }}>
    <label>Zone code<input name="code" defaultValue={row?.code} placeholder="Z28" required readOnly={!!row} /></label>
    <label>Name<input name="name" defaultValue={row?.name} required maxLength={100} /></label>
    <label>Display category<select name="category" defaultValue={row?.category}>{categories.map((kind) => <option key={kind}>{kind}</option>)}</select></label>
    <label>Proposed capacity<input name="capacity" type="number" min="0" max="500" defaultValue={row?.proposed_capacity ?? 0} required /></label>
    <label>Local map geometry<textarea name="geometry" defaultValue={JSON.stringify(row?.geometry ?? { type:"box",x:500,y:500,w:30,h:15,r:0 },null,2)} required /></label>
    <label>Parking instructions<textarea name="instructions" defaultValue={row?.instructions} maxLength={1000} /></label>
    <Check name="open" label="Open for parking" initial={row?.open ?? false} />
    <Check name="published" label="Published to the map" initial={row?.published ?? false} />
    <Check name="verified" label="Field verified" initial={row?.verified ?? false} />
    <Reason /><button disabled={disabled}>Save zone</button>
  </form>;
}

function SpaceForm({ zone,row,disabled,save,submit }: Editor & { zone:Zone; row?:Space }) {
  return <form onSubmit={(event) => {
    const data = formData(event);
    submit(() => save("admin/spaces" + (row ? "/" + row.id : ""), {
      zone_id:zone.id,code:value(data,"code"),x:Number(value(data,"x")),y:Number(value(data,"y")),state:value(data,"state"),
      published:checked(data,"published"),verified:checked(data,"verified"),version:row?.version ?? 0,reason:value(data,"reason"),
    },row ? "PATCH" : "POST"));
  }}>
    <label>Space code<input name="code" defaultValue={row?.code} placeholder={zone.code + "-001"} required readOnly={!!row} /></label>
    <label>Local X<input name="x" type="number" step="any" defaultValue={row?.x} required /></label>
    <label>Local Y<input name="y" type="number" step="any" defaultValue={row?.y} required /></label>
    <label>State<select name="state" defaultValue={row?.state ?? "closed"}>{states.map((state) => <option key={state}>{state}</option>)}</select></label>
    <Check name="published" label="Published to the map" initial={row?.published ?? false} />
    <Check name="verified" label="Field verified" initial={row?.verified ?? false} />
    <Reason /><button disabled={disabled}>Save space</button>
  </form>;
}

function NoticeForm({ row,disabled,save,submit }: Editor & { row?:Notices["notices"][number] }) {
  return <form onSubmit={(event) => {
    const data = formData(event);
    submit(() => save("admin/notices" + (row ? "/" + row.id : ""), {
      title:value(data,"title"),body:value(data,"body"),audience:data.getAll("audience"),state:value(data,"state"),
      expiresAt:date(value(data,"expiry")),reason:value(data,"reason"),
    },row ? "PATCH" : "POST"));
  }}>
    <label>Title<input name="title" defaultValue={row?.title} required maxLength={120} /></label>
    <label>Message<textarea name="body" defaultValue={row?.body} required maxLength={2000} /></label>
    <label>Audience (empty selection means all)<select name="audience" multiple defaultValue={row?.audience ?? []}>
      {roles.map((role) => <option key={role}>{role}</option>)}</select></label>
    <label>Status<select name="state" defaultValue={row?.state ?? "draft"}>{["draft","published","archived"].map((state) => <option key={state}>{state}</option>)}</select></label>
    <label>Expiry with timezone<input name="expiry" defaultValue={row?.expires_at ?? ""} placeholder="Optional ISO date and time" /></label>
    <Reason /><button disabled={disabled}>Save announcement</button>
  </form>;
}

function RuleForm({ row,disabled,save,submit }: Editor & { row?:Notices["rules"][number] }) {
  return <form onSubmit={(event) => {
    const data = formData(event);
    submit(() => save("admin/rules" + (row ? "/" + row.id : ""), {
      title:value(data,"title"),body:value(data,"body"),active:checked(data,"active"),reason:value(data,"reason"),
    },row ? "PATCH" : "POST"));
  }}>
    <label>Title<input name="title" defaultValue={row?.title} required maxLength={120} /></label>
    <label>Rule<textarea name="body" defaultValue={row?.body} required maxLength={2000} /></label>
    <Check name="active" label="Published" initial={row?.active ?? false} />
    <Reason /><button disabled={disabled}>Save rule</button>
  </form>;
}
