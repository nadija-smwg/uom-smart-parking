# Campus map feature audit

The public Parking Atlas is a planning guide. Sign in, open **Map**, and select a registered vehicle to use the driver controls. The map uses the coordinate system from the supplied HTML. [HTML reference](<UoM Smart Parking – 3D Campus Map-4.html>) · [Campus fixture](../data/campus.json)

| HTML interaction | Where it works in the app |
| --- | --- |
| Campus, playground, buildings, roads, and parking bays | The public atlas and signed-in map share the planning geometry. A regression test compares every named road, its width and points, every building tuple, and all 27 box or strip geometries and their categories with the HTML. |
| Rotate, auto-orbit, tilt, top view, pan, wheel and pinch | The requested 2D plan opens in top view. **Overview** resets the view. Drag, wheel, pinch, and the zoom buttons navigate the map. The 3D orbit, tilt, building extrusion, and bobbing cones belong to the retired renderer. |
| Day/night and labels | **Night** switches the live map palette. **Labels** toggles names. Major landmarks appear at overview scale, additional named buildings appear on closer zoom, and a text search can focus a building. |
| Simulated traffic | **Demo traffic** animates two directions along the reference roads wide enough to carry the simulation. Reduced-motion users see stationary vehicle marks. This overlay is illustrative. |
| Road list and click-to-focus | **Road directory** lists all 16 roads. Selecting one frames its length. Road search also supports keyboard selection. |
| Vehicle/category shortcuts and independent visibility | **Parking category** shows one type or all types. **Map legend** toggles each category independently and shows its reported occupied count, inventory, and occupancy bar. **Selected vehicle** determines eligibility. |
| Availability pins and bay details | Each unselected zone has a status pin. Green indicates available spaces, amber indicates below 40% available, red indicates fully occupied, and gray indicates an operational closure or lack of usable inventory. Selecting a zone reveals counts, instructions, and individual spaces. Tapping the background clears the selection. |
| Nearest free | **Nearest free** focuses the closest eligible, available space to the schematic main entrance. **Find Parking** also ranks from other landmarks. Distance is measured in plan coordinates. |
| Park, locate my spot, leave | **I’ve parked here** starts a server-checked session for a specific vehicle and space. **My spot** returns to the active space. For multiple sessions, **My Parking → Show my spot** opens the chosen one. **I’ve left** works from that space or the session list. |
| Refresh, shared occupancy, restore after reload | Account-backed sessions persist across reloads and devices. The snapshot API supplies occupancy. Private change events, foreground refresh, and fallback polling keep the display current. Conflicting claims are resolved in PostgreSQL. |
| Notifications, unread badge, new-notice message | **Notices** shows published announcements for the signed-in audience. The badge counts unread items. A newly fetched unread notice prompts the driver, and **Mark as read** persists the read state per account. Notices refresh on focus, parking events, and polling, up to about a minute while connected and active. |
| Editor posts or deletes a notice | An administrator publishes or archives a notice in **Operations → Announcements**. Archiving removes it from the driver feed and retains its audit history. The HTML’s sample announcements and timed synthetic notice are replaced by published content. |
| Local-only fallback | The public atlas can be browsed without an account. The installed web app has an offline page. Signed-in parking writes resume after connectivity returns and eligibility is refreshed. |

## Inventory differences

Both plans total **440 spaces**. Four motorcycle zones differ by one space because the HTML apportions capacity from shape dimensions. The app follows the explicit proposed inventory in the project plan. These figures still require campus verification. [Architecture appendix](ARCHITECTURE.md#appendix-a-proposed-parking-inventory)

| Zone | HTML calculation | App plan |
| --- | ---: | ---: |
| Graduate Studies Bikes | 15 | 16 |
| Exam Hall Bikes A | 28 | 27 |
| Exam Hall Bikes B | 28 | 27 |
| NE Avenue Bikes | 27 | 28 |

## Verification

The campus tests compare the source geometry, category totals, status thresholds, and eligible-space ranking. A production browser run with local PostgreSQL and simulated authentication and Realtime exercised the map at desktop and phone widths. It checked the 27 pins, traffic motion and reduced motion, the road directory, independent filters, touch pan and pinch, nearest eligible space, return to an active space, and release from the map. Two driver sessions exercised concurrent claims, private history, reconnect and polling. These checks use isolated inventory. [Campus tests](../tests/campus.test.mjs) · [Hosting checks](../workplan/06-testing-and-hosting.md)
