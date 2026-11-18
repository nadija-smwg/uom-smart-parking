# UoM Smart Parking Management System

**Architecture and product specification**  
**Status:** Proposed implementation baseline, 18 November 2026  
**First release:** Hosted, clearly labeled student-project demo for the University of Moratuwa campus

[Scope](#1-product-scope) · [Architecture](#2-architecture-and-stack) · [Roles](#3-roles-and-key-screens) · [Map and mobile](#4-campus-map-and-mobile-design) · [Parking workflow](#5-parking-domain-and-workflow) · [Data model](#6-data-model) · [API and live updates](#7-http-api-and-live-updates) · [Operations](#8-operations-notifications-and-data-protection) · [Hosting](#9-hosting-and-environments) · [Acceptance](#10-build-milestones-and-acceptance) · [Campus decisions](#11-decisions-pending-campus-input) · [Zone inventory](#appendix-a-proposed-parking-inventory)

## 1. Product scope

The system helps students, lecturers, staff, and visitors find eligible campus parking and report when they park and leave. Security officers verify parking status and handle incidents. Administrators manage parking inventory, eligibility, campus geometry, accounts, and announcements. The same web application serves phone, tablet, and desktop users.

Parking is **manually reported**. A database-confirmed session means the user reported parking in that space. Display this distinction to users and let officers verify or correct inaccurate status. The app starts as a demo with proposed geometry, sample users, and demo occupancy. A campus pilot requires a separate deployment and verified operational data.

| Release | Deliverables |
| --- | --- |
| Hosted demo | Responsive driver, officer, and admin experiences. Interactive 2D campus map, 27 proposed zones, individual demo spaces, vehicle registration, eligible-space search, manual parking sessions, live synchronization, reports, zone and space editing, targeted in-app notices, and PWA installation. |
| Campus pilot | Reconciled and physically verified parking inventory, university-approved access and verification rules, real email delivery, operational ownership, privacy controls, monitoring, and a tested restore procedure. |
| Follow-up | GPS-based navigation after geographic alignment, measured route distances where a routable campus network exists, opt-in push, scheduled announcements, and expanded analytics and exports. |

The first release uses one campus, one web app, and one database per environment. Parking actions follow the **find → park → leave** flow. The space becomes occupied in the app when parking confirmation commits.

## 2. Architecture and stack

| Concern | Choice | Rationale |
| --- | --- | --- |
| Application | Next.js App Router, React, TypeScript, and Tailwind CSS | One deployable project for the responsive UI, route handlers, and server-rendered screens. |
| Campus map | Leaflet with `CRS.Simple` | The 2D plan draws the supplied HTML's campus geometry and overlays live parking status. Local coordinates match the precision of the supplied reference. |
| Identity | Supabase Auth with email verification, password reset, and server-side session handling | Managed credential lifecycle with application roles and account state in PostgreSQL. |
| Database | Supabase PostgreSQL, SQL migrations, and a server-only pooled database connection | Transactions, row locks, and constraints protect claims and historical records. |
| Live updates | Supabase Realtime Broadcast over a private channel | Connected clients learn when to refresh availability. PostgreSQL owns current status. |
| Hosting | Vercel for Next.js, with a separate Supabase project per hosted environment | HTTPS, deploy previews, and isolation between demo and pilot. |
| Visual design | Moratuwa Parking Atlas | The public atlas, driver access page, and parking board use a printed campus plan, condensed headings, and an orange locator. [Phase 7](../workplan/07-animated-parking-atlas.md) |

```text
Phone, tablet, desktop
    ├─ Next.js UI and Leaflet campus map
    ├─ HTTPS → Next.js pages and /api/v1 route handlers
    │            ├─ Supabase Auth → validate the current identity
    │            └─ Server-side services → PostgreSQL
    └─ Private Supabase Realtime channel ← committed parking changes
```

Pages and route handlers call the same server-side domain services for authorization, eligibility, parking operations, and reporting. Render account pages and initial data on the server where appropriate. Load the 2D map and its controls in client components with a separate loading boundary from the app shell. Serve the versioned base campus geometry as a static asset. Fetch editable parking geometry and availability through the application API.

Use the following directory structure when implementation starts.

```text
src/app/               Pages, layouts, authentication callbacks, and /api/v1
src/components/        Shared UI and accessibility components
src/features/          Driver, map, parking, officer, admin, and notifications UI
src/server/            Session handling, policies, queries, and transactions
src/shared/            Public API schemas and coordinate types
public/campus/         Versioned base campus geometry and approved assets
supabase/migrations/   Versioned schema, privileges, and event triggers
supabase/seed.sql      Repeatable demo data for demo and test environments
tests/                 Domain, PostgreSQL integration, and browser coverage
```

[Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) · [Supabase server-side Auth](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs) · [Supabase serverless database connections](https://supabase.com/docs/guides/database/connecting-to-postgres/serverless-drivers)

## 3. Roles and key screens

Store one of **six account roles** in PostgreSQL and derive **three application permission levels** from it. The permission level controls which app actions the account can perform. Zone rules determine where an account can park with its selected vehicle.

| Permission level | Account roles | Access |
| --- | --- | --- |
| Driver | Student, Lecturer, University Staff, Visitor | Use the shared driver screens to manage own profile and vehicles, find eligible parking, start and end own sessions, view history, read notices, and report problems. |
| Security Officer | Security Officer | Use driver features and monitor all zones, review sessions and reports, verify or block spaces, and correct sessions with a recorded reason. |
| Administrator | Administrator | Use driver and officer features, assign roles, manage inventory and eligibility, close or reopen zones, publish notices, and view statistics and the audit log. |

Drivers may receive different zone rules for each account role. Visitors need an explicit rule or an active account-specific grant for the chosen vehicle type. Officers and administrators use the same parking eligibility checks for their own vehicles.

- **Public pages** support sign-in, campus registration, visitor registration, email verification, and password resets.
- **Driver pages** include Home, Map, Find Parking, My Parking, Profile/Vehicles, Notifications, and Parking Rules. Home shows availability by category, the driver's active session, and recent notices.
- **Officer pages** include Overview, the campus map and space-code search, active and stale sessions, verification, the report queue, and notices.
- **Admin pages** cover zones and spaces, the map editor, eligibility and rules, users, sessions and reports, announcements, analytics, and audit history.

Public registration offers Campus and Visitor. Email confirmation establishes ownership of the address. For campus registrations, an administrator verifies affiliation and assigns the role. Pending campus accounts can sign in and manage their profile. Parking actions require an active, verified account. Create the first administrator through the documented environment bootstrap. Existing administrators assign Security Officer and Administrator roles through audited account changes. Pilot officer and administrator accounts require TOTP. Suspension blocks access to protected pages and APIs. Any active session remains visible to officers for review.

Users can register multiple vehicles. Store type, optional make/model and color, and a registration number for motor vehicles. Bicycles can use a user-provided label without a plate. Preserve the displayed plate and normalize case and separators for duplicate checks. The demo assigns an active normalized registration number to one account. Handle a disputed or shared registration through admin review until the campus confirms a shared-vehicle policy. Prevent vehicle removal or reassignment while it has an active session and retain archived vehicle references for history.

## 4. Campus map and mobile design

The [supplied HTML](<./UoM Smart Parking – 3D Campus Map-4.html>) contains 30 building footprints, 16 named roads, the playground, and geometry for all 27 named parking zones. Extract the scene data and keep its recognizable arrangement and category colors. The HTML computes its own capacities and only tracks occupancy by bay. Use the explicit planning capacities in Appendix A and the new individual-space model for application behavior. The prompt names `UoM_Parking_Map_A3-2.pdf` as the allocation reference. The PDF was missing when this document was drafted.

### Map data and interaction

- **Shared coordinates.** Adopt the source diagram's local `x, y` coordinates, with `x` increasing right and `y` increasing down. Version the coordinate system and convert it at the Leaflet boundary. The map, zone list, and Find Parking use the same zone IDs, space IDs, and status.
- **Geometry.** Store base buildings, roads, landmarks, and playground as versioned geometry. Store editable zone polygons or centerlines with width, and space polygons or points, in PostgreSQL. Each editable geometry records its source, coordinate version, verification state, and last editor.
- **Default experience.** Open a top-down plan of the full campus. Support drag to pan, pinch and scroll zoom, overview reset, day and night themes, labels, campus search, and parking category filters.
- **Parking display.** At overview scale, show zone markers and availability summaries. Show individual spaces when zoomed in or when a zone is selected. Use separate icons, labels, and borders for availability. A detail panel includes space code, category, status, instructions, last update, and a confirmation button when the signed-in user and selected vehicle are eligible. Show session details only to its owner and authorized staff.
- **Find Parking.** Filter first by access, vehicle type, current operational state, and vacancy. Sort by available count at zone level or approximate distance from a selected entrance or landmark. Clearly label schematic distance and avoid expressing it in metres. Selecting a result focuses the map on that space. Demo guidance shows landmarks and the selected location. Campus directions require a verified road network and access restrictions.
- **Geographic accuracy.** Obtain approved footprints and geographic control points for the real campus, align the 2D plan, and verify road and stall positions on site. Offer **My Location** when alignment and HTTPS geolocation are available. Show location uncertainty, retain the landmark picker, and keep precise device location out of storage by default. This stage can add a geographic basemap if the team chooses one.

### Mobile, accessibility, and GetLayers handoff

Use the Parking Atlas palette for navigation, the selected zone, and primary actions. Keep vehicle-category colors separate from occupancy colors on the live map. [Campus map feature audit](campus-map-feature-audit.md)

On phone widths, keep search and vehicle filters near the top, put selected-zone details in a bottom sheet, and keep touch actions clear of the bottom navigation and safe areas. On wider screens use a side panel beside the map. Driver bottom navigation links to Home, Map, Find Parking, My Parking, and Profile. Add a keyboard-accessible list of zones and spaces for people who use a screen reader or prefer a list. Provide clear focus indicators, visible status text and icons, reduced-motion behavior, and touch targets around 44 CSS px. Test portrait and landscape starting at 360 CSS px wide.

Make the site installable with a web app manifest, icons, and a service worker. Cache the shell and safe public assets such as base geometry. Keep authenticated responses and personal data out of service worker caches. Mark an in-memory snapshot stale if refresh fails, show its last successful sync, and disable parking writes while offline. Refetch on reconnect before enabling claims. Keep a low-cost static loading view until the map renderer is ready.

[Leaflet local coordinates](https://leafletjs.com/examples-v1/crs-simple/crs-simple.html) · [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps) · [GetLayers docs](https://www.getlayers.ai/docs)

## 5. Parking domain and workflow

### Eligibility and status

Each zone has a display category and an explicit access policy made of allowed role and vehicle-type combinations. Cars and vans can share a display category and still be authorized independently. Account-specific grants can extend access to a named zone for an approved vehicle type, with an expiry and an approving administrator. Eligibility requires an active verified account, the account's active vehicle, and a matching rule or current grant. Every claim also requires both the zone and the space to be open and published. The pilot limits claims to verified zones and spaces. Reserved, unassigned, and university-fleet areas require explicit assignments from the university.

Store operational state separately from the reported occupancy derived from active sessions.

| Dimension | Values and meaning |
| --- | --- |
| Zone | `open` or `closed`. A closure applies to all spaces in the zone. |
| Space | `open`, `blocked`, `under_review`, `closed`, or `retired`. A published open space can become eligible. Draft and retired spaces are excluded from offered inventory. |
| Occupancy | `vacant` or `occupied`, derived from the presence of an active session. |
| Driver access | `eligible` or `restricted`, evaluated for the account and vehicle currently selected. |

Show **reported occupancy** and **operational state** so drivers can tell whether a vacant space is usable. An occupied space in a closed zone remains occupied until release. For headline counts, use mutually exclusive buckets so published inventory reconciles as `occupied + open vacant + unavailable vacant`. Show access restrictions in personalized results. Show proposal capacity alongside operational capacity, which comes from published non-retired space records. Admin capacity edits add, publish, or retire spaces and record why. Preserve space IDs and session history. Require the current session to end before retiring its space or unpublishing its inventory. Moving a space to a different zone requires retiring it and creating a new space code.

### Claim, release, and corrections

1. The driver selects a vehicle and space. The server returns current eligibility and status. This snapshot is advisory while the driver approaches the space.
2. **I've parked here** sends the vehicle and space IDs with a unique request key. The server validates the session and runs one database transaction. Recheck account state, vehicle ownership, access policy, zone and space state, and active-session limits under locks. Commit the session and audit event together. Return a conflict and refresh the space if someone else claimed it first.
3. The default permits one active session per account. An administrator can approve a documented per-account limit override. A vehicle and an individual parking space can each have only one active session regardless of that override.
4. **I've left** ends the user's session atomically. An officer or admin may correct a session with a reason. An occupied space released while blocked or closed becomes vacant but still unavailable. A verified discrepancy without a matching driver record is handled by blocking or reviewing the space with a report.
5. Stale sessions appear in an officer queue after a configurable age. Closing the app, losing connection, or reaching that age leaves the session active until an authorized release.

### Transaction rules

- Define active sessions with `ended_at IS NULL`. Add partial unique indexes on `space_id` and `vehicle_id` for active rows. Serialize claims for a user by locking that user's profile row and checking their configured active-session limit.
- Lock the request key first, then user rows ordered by ID, followed by vehicle, zone, space, and session. Order multiple records of the same type by ID. Concurrent administrative changes use the same order before changing eligibility, closing or editing inventory, suspending a user, or changing a vehicle. Zone-scoped policy changes lock the parent zone. Recheck actor permissions, eligibility, and inventory inside the transaction after taking the relevant locks.
- Scope request keys by authenticated actor and operation. Save a payload fingerprint and successful result with the mutation. A retry of the same payload returns the original success. Reject reuse with a different payload. Perform actor authorization on every request, including retries. Expose a repeatable outcome for legitimate release retries and create one audit event per change.
- Write an append-only activity event for claims, releases, overrides, verification, closures, map edits, eligibility changes, and privileged account actions. Include actor, timestamp, target, and the changed facts. Require a reason for officer and admin corrections and privileged overrides. Keep sensitive values out of event payloads when their IDs suffice.

[PostgreSQL partial indexes](https://www.postgresql.org/docs/current/indexes-partial.html) · [PostgreSQL row locks](https://www.postgresql.org/docs/current/explicit-locking.html)

## 6. Data model

Use UUIDs for relationships and stable human-readable codes for maps, signs, and officer lookup, such as `Z01` and `Z01-001`. Enforce foreign keys, checks, and unique codes. Use `timestamptz` for events, store them consistently, and render dates and operational reports in `Asia/Colombo`. Keep SQL migrations and deterministic demo fixtures in version control.

| Table | Core data and constraints |
| --- | --- |
| `profiles` | Primary key matches Supabase Auth user ID. Display name, role, affiliation verification, account state, and default or approved session limit. Auth owns credentials and verified email. |
| `vehicles` | Owner ID, vehicle type, display and normalized plate or bicycle label, optional model/color, and archive timestamp. Partial uniqueness for active normalized plates. |
| `parking_zones` | Stable zone code, name, display category, proposed capacity, geometry, instructions, publication/verification details, operational state, and timestamps. |
| `parking_spaces` | Unique space code, zone FK, geometry, publication/verification details, operational state, and timestamps. Zone category and access rules supply vehicle eligibility. |
| `zone_access_rules` | Zone FK, permitted role, and permitted vehicle type. Enforce unique role/type combinations per zone. |
| `zone_access_grants` | Zone FK, account FK, approved vehicle type, approving actor, validity interval, and revocation. |
| `parking_sessions` | User, vehicle, space, start, end, end actor, end reason, and last staff verification. Active-row uniqueness for the space and vehicle. Validate that end time follows start time. |
| `parking_rules` | Published policy text, optional zone or vehicle category, effective period, and revision. Zone access rules govern enforcement. Update linked policy text when access changes. |
| `parking_reports` | Reporter, zone, optional space, category, description, review state, reviewer, and resolution. Validate that any referenced space is in the referenced zone. Includes incorrect occupancy, wrong category, blocked spaces, and unauthorized parking. |
| `announcements` | Title, body, author, audience, draft/published/archived state, publication and expiry times. Use an audience join table for multiple targeted roles. |
| `notifications` | User-facing event with category, content, optional linked announcement, and creation time. |
| `user_notifications` | User and notification FKs, unique pair, and `read_at`. Retain unread counts and per-user read state. |
| `activity_logs` | Append-only actor, action, entity, timestamp, reason, and structured details. |
| `idempotency_keys` | Actor, operation, request key, fingerprint, stored outcome, and creation time. Unique actor/operation/key. |

Index spaces by zone, open sessions by owner and start date, reports by review state, and inbox rows by user and read state. Analytics use session intervals and inventory counts to show occupancy by zone and vehicle category, trends, peak hours, session duration, and report counts. Use date and category filters and role-gated CSV exports for aggregates. Record when a metric comes from manually reported sessions. Historical denominators must reflect inventory changes if presenting historical occupancy percentages.

## 7. HTTP API and live updates

Keep browser-facing endpoints under `/api/v1`. Validate request bodies and query parameters explicitly, derive actor identity from the server-validated session, and return only fields permitted for that role. Use pagination for history, reports, exports, and account search. Validate origin on session-cookie mutations and limit sensitive routes by account and network where appropriate.

| Operation | Interface |
| --- | --- |
| Current profile and vehicles | `GET /me`, `GET /vehicles`, `POST /vehicles`, `PATCH /vehicles/{id}`, `DELETE /vehicles/{id}` to archive |
| Map and search | `GET /campus/zones`, `GET /campus/zones/{id}/spaces`, `GET /parking/availability`, `GET /parking/search?vehicleId=…&originId=…&sort=…` |
| Sessions | `GET /parking/sessions?status=active`, `GET /parking/sessions?status=ended`, `POST /parking/sessions`, `POST /parking/sessions/{id}/end` |
| User rules and inbox | `GET /rules`, `GET /announcements`, `GET /notifications`, `POST /notifications/{id}/read` |
| Reports and verification | `POST /reports`, `GET /officer/reports`, `PATCH /officer/reports/{id}`, `GET /officer/sessions`, `POST /officer/spaces/{id}/verify`, `POST /officer/sessions/{id}/correct` |
| Administration | `/admin/zones`, `/admin/spaces`, `/admin/access-rules`, `/admin/users`, `/admin/announcements`, `/admin/analytics`, and `/admin/audit` under the API base. Use per-operation permission checks and version preconditions for concurrent map and rule edits. |

Use stable error codes, including `401 AUTH_REQUIRED`, `403 PARKING_FORBIDDEN`, `409 SPACE_UNAVAILABLE`, `409 ACTIVE_SESSION_LIMIT`, and `422 INVALID_INPUT`. Use record version checks so stale admin edits produce a conflict and UI reload. Sensitive responses use `Cache-Control: private, no-store`. Include timestamps on availability responses and stable object IDs on successful mutations.

A database trigger queues a small `parking.changed` broadcast in the same transaction as a parking or inventory change. Subscribers receive it after commit. The event contains only the affected zone ID and a change time. Scope the private campus channel to authenticated app users. Clients re-fetch authorized availability and their own session data on events, after a successful mutation, and on reconnect or tab focus. Coalesce repeated events, discard superseded fetch responses, and use polling if the subscription is unavailable. Use the latest server response to render state and display the last successful sync if refresh fails.

[Supabase Realtime Broadcast](https://supabase.com/docs/guides/realtime/broadcast) · [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization)

## 8. Operations, notifications, and data protection

- **Officer workflow.** Search by zone or space code, compare the listed session to physical conditions, verify occupancy, open or resolve reports, and release sessions with an explanation. Support accurate handoff between officers through timestamped notes and report status.
- **Admin workflow.** Add and edit zones and individual spaces, preview edits on both views, control capacity and eligibility, handle user approvals and suspensions, update rules, and publish targeted notices. Start with basic occupancy and report counts. Add richer trends and CSV exports once the underlying history is representative.
- **Announcements.** Publish rule changes, maintenance, closures, events, and other targeted notices to the in-app inbox. Create recipient and read-state records when publishing. Read access follows the recorded audience and current authorization. Draft creation, publishing, editing, and archiving are audited. Retain linkage when published messages change or expire. Later add scheduled publishing and opt-in push with preferences and endpoint cleanup.
- **Authorization.** Keep protected application tables in a schema outside the exposed Supabase Data API. Use a dedicated least-privilege application database role on the server. Separate migration and environment-bootstrap credentials from runtime credentials. Authorize each domain query and write explicitly since the database connection runs as the application role. Use Realtime channel policies for browser subscriptions and block client publication of parking events. Require MFA for privileged pilot accounts and audit role changes.
- **Privacy.** Ordinary map responses expose space status, never the identity or plate of its occupant. Owners can access their own history. Keep staff visibility tied to operational need. Minimize personal data in logs, notifications, exports, and diagnostic traces. Establish university-approved retention and deletion rules before a pilot. Preserve history with archiving or approved pseudonymization where applicable.
- **Resilience.** Monitor application errors, failed or delayed claims, database connection usage, email delivery, and freshness of live updates. Log request correlation IDs and safe error codes. Plan backward-compatible migrations where possible and rehearse database restoration. Document recovery for a stale session backlog and a realtime outage.

## 9. Hosting and environments

| Environment | Deployment and data |
| --- | --- |
| Local/test | Next.js development server and isolated Supabase environment. Repeatable synthetic fixtures. Run database and browser tests against test data. |
| Preview/demo | Vercel preview and a demo Supabase project. Clearly visible **Student project / Demo data** labeling. Sample accounts, proposed geometry, and synthetic occupancy. Keep privileged demo accounts invite-only. Preview deployments use demo or dedicated test credentials. |
| Campus pilot | Separate Vercel deployment and university-approved database and email settings. Verified inventory, administrator and officer onboarding, monitoring, backup retention and restore ownership, and clearly identified manual occupancy. |

Use Git-based deployments with a review check before merging changes. CI runs lint, type checks, tests, migration validation against an isolated database, and a Next.js build. Apply reviewed migrations before the app version that depends on them and use compatible schema changes during rollbacks. Confirm Vercel eligibility for the chosen team or institutional use. A personal non-commercial demo can evaluate Vercel Hobby and Supabase Free. Supabase Free projects may pause after inactivity, so use a campus-approved deployment plan with defined availability and backups for a pilot.

| Configuration | Visibility |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public project coordinates for Supabase sign-in and private channel subscription. |
| `DATABASE_URL` | Server-only pooled connection for the limited application role. Use a separate protected connection for migrations. |
| `APP_ORIGIN`, `APP_ENV`, `STALE_SESSION_HOURS` | Server configuration for approved redirects, deployment identity, and the review threshold. Any client-facing environment label is derived from explicit server configuration. |
| Auth redirect allowlist and SMTP | Configuration in Supabase for the correct local/hosted origins and sender domain. Keep provider secrets in the provider or host settings. |

[Vercel Next.js deployment](https://vercel.com/docs/frameworks/full-stack/nextjs) · [Vercel Hobby](https://vercel.com/docs/plans/hobby) · [Supabase inactivity policy](https://supabase.com/docs/guides/platform/free-project-pausing) · [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp) · [Supabase backups](https://supabase.com/docs/guides/platform/backups)

## 10. Build milestones and acceptance

| Milestone | Exit check |
| --- | --- |
| 1. Design and foundation | Approve Map, Find Parking, and My Parking designs for phone and desktop. Set up the Next.js app and migrations. Campus and visitor sign-in, verification, reset, and vehicle registration work. |
| 2. Campus map and inventory | The HTML's landmarks and all 27 proposed zones appear on the 2D plan. Load 440 proposed spaces with stable IDs. Verify filters, selection, availability counts, phone gestures, and the accessible zone list. |
| 3. End-to-end parking | A verified driver can find, park, and leave. Updates show on a second device. Races for the same space, same vehicle, and last user session slot each produce one valid winner. Verify claim retries, closure-versus-claim races, offline behavior, and reconnect reconciliation. |
| 4. Officers, admins, and announcements | Visitors cannot claim restricted spaces. An officer can verify, log, and correct a report without gaining admin access. Admin edits update both maps, announce closures, and leave audit records. Users see notices for their audience and can mark them read. |
| 5. Hosted demo | Deploy over HTTPS with synthetic data and clear labeling. Confirm installation where supported, navigation, touch controls, narrow layouts, and map performance on real Android Chrome and iPhone Safari devices. Run the driver flow on desktop as well. |
| 6. Pilot validation | Reconcile the A3 PDF and field inventory, approve roles and policies, verify signs and space IDs, configure real SMTP and operational monitoring, and rehearse a database restore before onboarding users. |

Use PostgreSQL integration tests for races and authorization-sensitive state changes. Run browser tests for cross-role flows, responsive layouts, empty/error states, copyable space IDs, notice targeting, and consistency across views. Track claim latency, map loading on representative phones, and cross-device visibility in the hosted demo. Establish pilot performance targets after measuring the demo and agree on recovery and support targets with the campus owner.

## 11. Decisions pending campus input

| Input | Effect on delivery |
| --- | --- |
| Obtain `UoM_Parking_Map_A3-2.pdf`. | Reconcile proposed names, zone outlines, capacities, and category assignments against the complete source. HTML and prompt data support the demo in the meantime. |
| Confirm pilot area, visitor zones, reserved and fleet access, campus email domains, and how campus roles are verified. | Configures enforceable eligibility and account approval. Demo permissions are labeled sample rules. |
| Identify the UoM contact who can verify markings, capacities, usable entrances, and any building or geographic data. | Determines when spaces can be published for campus use and when GPS can be offered. |
| Confirm any shared-vehicle use, stale-session review thresholds, space verification procedure, and escalation contacts. | Defines officer handoffs and policy overrides. |
| Approve campus branding and the public release owner, domain, budget, privacy retention, and hosting region. | Determines institutional deployment and ongoing support. The first hosted release remains a student demo. |

## Appendix A. Proposed parking inventory

The zone numbers, names, and capacities below come from the supplied master prompt. All 27 names match the supplied HTML. The category colors describe vehicle use. Availability uses separate markers and labels. These are planning values pending PDF reconciliation and campus verification.

| Code | Zone | Vehicle category | Proposed spaces |
| --- | --- | --- | ---: |
| Z01 | Playground Car Park | Cars/vans | 26 |
| Z02 | Mill Road Car Bay | Cars/vans | 4 |
| Z03 | Admin Car Park (E) | Cars/vans | 9 |
| Z04 | Admin Car Park (S) | Cars/vans | 17 |
| Z05 | Hostel Car Park | Cars/vans | 19 |
| Z06 | Boys Hostel Bay | Cars/vans | 4 |
| Z07 | Electronic Dept Car Park | Cars/vans | 8 |
| Z08 | Library Roadside Bay | Cars/vans | 2 |
| Z09 | Research Lane Bay | Cars/vans | 2 |
| Z10 | Main Street Roadside | Cars/vans | 9 |
| Z11 | Mill Road Bike Bay | Motorcycles | 15 |
| Z12 | Graduate Studies Bikes | Motorcycles | 16 |
| Z13 | Exam Hall Bikes A | Motorcycles | 27 |
| Z14 | Exam Hall Bikes B | Motorcycles | 27 |
| Z15 | Sumanadasa Front Bikes | Motorcycles | 74 |
| Z16 | Engineering Back Bikes | Motorcycles | 28 |
| Z17 | Research Lane Bikes | Motorcycles | 22 |
| Z18 | NE Avenue Bikes | Motorcycles | 28 |
| Z19 | Exam Hall Road Bikes | Motorcycles | 13 |
| Z20 | Bicycle Rack | Bicycles | 50 |
| Z21 | University Vehicles A | University vehicles | 12 |
| Z22 | University Vehicles B | University vehicles | 8 |
| Z23 | Reserved Bay 1 | Other/unassigned | 3 |
| Z24 | Reserved Bay 2 | Other/unassigned | 4 |
| Z25 | Reserved Bay 3 | Other/unassigned | 4 |
| Z26 | Reserved Bay 4 | Other/unassigned | 4 |
| Z27 | Playground Road Bay | Other/unassigned | 5 |
| | **Total** | | **440** |

Totals by category are 100 cars/vans (red), 250 motorcycles (blue), 50 bicycles (pink), 20 university vehicles (black or charcoal), and 20 other/unassigned (green).
