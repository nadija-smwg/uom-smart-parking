import { ParkingAtlas } from "@/components/parking-atlas";

export default function Landing() {
  return <ParkingAtlas demo={process.env.APP_ENV !== "pilot"} />;
}
