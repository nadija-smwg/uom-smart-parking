import Link from "next/link";
import { campusDirectionsUrl } from "@/lib/contracts";

export default function Landing() {
  return <main className="welcome">
    <div>
      <p className="eyebrow">University of Moratuwa</p>
      <h1>UoM Smart Parking</h1>
      <p>Explore campus parking, check eligible spaces, and keep track of where you parked.</p>
      {process.env.APP_ENV !== "pilot" && <p className="tag">Student project · Demo data</p>}
      <div className="actions">
        <Link className="primary" href="/parking">Find parking</Link>
        <a href={campusDirectionsUrl} referrerPolicy="no-referrer">Campus directions (Google Maps)</a>
      </div>
    </div>
  </main>;
}
