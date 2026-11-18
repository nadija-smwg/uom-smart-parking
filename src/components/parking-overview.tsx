import { CampusPlate } from "./campus-plate";
import { ArrowRight, ArrowUpRight, Bell, Bike, CarFront, History, MapPin, SquareParking } from "lucide-react";
import { campusTime } from "@/lib/api";
import { categories, categoryDisplay, type Notice, type Session, type Zone } from "@/lib/contracts";

export function ParkingOverview({ name, zones, vehicleCount, active, notices, onFind, onMap, onSessions, onNotices }: {
  name: string;
  zones?: Zone[];
  vehicleCount: number;
  active: Session[];
  notices: Notice[];
  onFind: () => void;
  onMap: () => void;
  onSessions: () => void;
  onNotices: () => void;
}) {
  const available = zones?.reduce((sum, row) => sum + row.available, 0);

  return <div className="dashboard atlas-board">
    <header className="board-head">
      <div><p className="atlas-mono">Welcome, {name}</p><h1>Parking board</h1></div>
      <button className="atlas-key orange" onClick={onFind}>Find Parking <ArrowRight size={18} /></button>
    </header>
    <section className="board-ledger" aria-label="Parking at a glance">
      <div className="board-count">
        <h2>Available spaces</h2>
        <strong className="board-value" key={available ?? "pending"}>{available ?? "—"}</strong>
        <p>{zones ? "Across " + zones.length + " published zones" : "Waiting for campus availability"}</p>
      </div>
      <dl className="board-small-counts">
        <div><dt>Active sessions</dt><dd>{zones ? active.length : "—"}</dd></div>
        <div><dt>Registered vehicles</dt><dd>{zones ? vehicleCount : "—"}</dd></div>
      </dl>
      <button className="board-map" onClick={onMap} aria-label="View campus">
        <CampusPlate />
        <span>View campus <ArrowUpRight size={17} /></span>
      </button>
    </section>

    <div className="overview-grid">
      <section className="card availability-card">
        <div className="panel-heading">
          <div><h2>Campus availability</h2><p className="muted small">Based on manually reported parking activity.</p></div>
          <button className="text-action" onClick={onMap}>Open map <ArrowRight size={16} aria-hidden="true" /></button>
        </div>
        {zones ? <ul className="availability-list">
          {categories.map((category) => {
            const rows = zones.filter((zone) => zone.category === category);
            const available = rows.reduce((sum, zone) => sum + zone.available, 0);
            const total = rows.reduce((sum, zone) => sum + zone.inventory, 0);
            const { label, color } = categoryDisplay[category];
            const Icon = category === "bicycles" ? Bike : category === "cars" ? CarFront : SquareParking;
            return <li key={category}>
              <span className="category-icon" style={{ color }}><Icon size={17} aria-hidden="true" /></span>
              <div className="availability-row">
                <div><span>{label}</span><span className="muted small"><strong>{available}</strong> of {total} open</span></div>
                <progress max={Math.max(total, 1)} value={available} aria-label={label + " availability"} />
              </div>
            </li>;
          })}
        </ul> : <p className="muted">Waiting for parking availability.</p>}
      </section>

      <div className="dashboard-secondary">
        <section className="card">
          <div className="panel-heading"><h2>Active parking</h2>
            <button className="text-action" onClick={onSessions}>{active.length ? "Manage active parking" : "View sessions"}
              <ArrowRight size={16} aria-hidden="true" />
            </button></div>
          {active.length ? active.map((session) => <div className="dashboard-record" key={session.id}>
            <span className="feature-icon"><MapPin size={18} aria-hidden="true" /></span>
            <div><h3>{session.zone_name}</h3><p className="small muted">{session.code} · {session.plate ?? session.kind}</p></div>
          </div>) : <div className="dashboard-record">
            <span className="feature-icon" data-tone="blue"><History size={18} aria-hidden="true" /></span>
            <p className="small muted">{zones ? "No active sessions. Your current parking space will appear here." : "Loading your parking sessions…"}</p>
          </div>}
        </section>
        <section className="card">
          <div className="panel-heading"><h2>Recent notices</h2>
            <button className="text-action" onClick={onNotices}>View notices <ArrowRight size={16} aria-hidden="true" /></button></div>
          {notices.length ? notices.slice(0, 3).map((notice) => <article className="dashboard-record" key={notice.id}>
            <span className="feature-icon" data-tone="sand"><Bell size={17} aria-hidden="true" /></span>
            <div><h3>{notice.title}</h3><p className="small muted">{campusTime(notice.published_at)}</p></div>
          </article>) : <div className="dashboard-record">
            <span className="feature-icon" data-tone="sand"><Bell size={17} aria-hidden="true" /></span>
            <p className="small muted">{zones ? "No current notices." : "Loading campus notices…"}</p>
          </div>}
        </section>
      </div>
    </div>
  </div>;
}
