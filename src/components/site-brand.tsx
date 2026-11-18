import Link from "next/link";
import { SquareParking } from "lucide-react";

export function SiteBrand() {
  return <Link href="/" className="site-brand">
    <span className="brand-icon"><SquareParking size={24} strokeWidth={2} aria-hidden="true" /></span>
    <span>UoM <strong>Smart Parking</strong></span>
  </Link>;
}
