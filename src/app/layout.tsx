import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "leaflet/dist/leaflet.css";
import "@fontsource/barlow-condensed/latin-800.css";
import "./globals.css";
import "./atlas.css";
import { InstallSupport } from "@/components/install-support";

export const metadata: Metadata = {
  title: "UoM Smart Parking",
  description: "Find eligible parking at the University of Moratuwa campus.",
  applicationName: "UoM Smart Parking",
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="atlas-site">{children}<InstallSupport /></body></html>;
}
