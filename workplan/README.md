# UoM Smart Parking implementation workplan

This manual contains a complete source listing for the student-project demo. Phases 1–6 establish the baseline, and Phase 7 applies the hosted interface. The campus geometry follows the UoM HTML reference. Phase 1 records the Dantora-inspired interface, the campus illustration brief, and the Leeward daylight map direction. [Phase 1 design brief](01-foundation.md#visual-design-brief)

| Phase | Read and implement |
| --- | --- |
| 1 | [Next.js foundation, environment, and authentication](01-foundation.md) |
| 2 | [PostgreSQL, access control, and transaction rules](02-postgresql.md) |
| 3 | [Campus data, proposed inventory, and the 2D map](03-campus-map.md) |
| 4 | [Driver screens, parking sessions, and live updates](04-driver-live-parking.md) |
| 5 | [Officer and administrator operations](05-operations.md) |
| 6 | [PWA, verification, CI/CD, and Vercel hosting](06-testing-and-hosting.md) |
| 7 | [Animated Parking Atlas and hosted UI verification](07-animated-parking-atlas.md) |

Apply the [Phase 7 Parking Atlas implementation](07-animated-parking-atlas.md) to the reconstructed baseline for the current interface. It includes a motion preview, all ten source blocks, and the two additional package versions. [HTML feature audit](../docs/campus-map-feature-audit.md)

See [the product architecture](../docs/ARCHITECTURE.md) for the full campus-pilot vision. [Phase 3](03-campus-map.md#public-campus-references) records the public UoM references and the Google Maps link for campus-level directions. The demo uses the 27 proposed zones and 440 planned spaces from the supplied project materials. The named A3 planning PDF and verified field inventory are still pending. Campus-internal GPS routing, scheduled announcements, push notifications, and expanded analytics follow the demo.

The app uses **six account roles and three permission levels**. Students, lecturers, university staff, and visitors share the Driver experience. Security Officers use the officer desk, and Administrators manage the system. Parking eligibility depends on the account's role or a specific grant, the selected vehicle, and the zone's rules. See the [permission matrix](05-operations.md#roles-and-permissions).

## CI and production deployment

GitHub Actions runs app and PostgreSQL checks for pull requests and changes to `main`. Vercel deploys `main` automatically. The production smoke job matches Vercel's status to the pushed commit and checks the live HTTPS site. [GitHub Actions](https://github.com/nadija-smwg/uom-smart-parking/actions/workflows/check.yml) · [Production site](https://uom-smart-parking.vercel.app/) · [Phase 6 release workflow](06-testing-and-hosting.md#continuous-integration-and-deployment)

## Materialize the complete application

This repository already contains the application at its root. To reconstruct it from the workplan in a separate app directory, paste the following block into PowerShell. It writes the source blocks to `smart_parkind/` and checks for path conflicts before writing. The numbered phases are cumulative, and the build uses files from all six.

```powershell
$plan = (Resolve-Path -LiteralPath 'workplan').Path
$target = [IO.Path]::GetFullPath((Join-Path (Get-Location).Path 'smart_parkind'))
$prefix = $target + [IO.Path]::DirectorySeparatorChar
$pattern = '(?ms)^<!-- file: (?<path>[^\r\n]+) -->\r?\n\r?\n```[^\r\n]*\r?\n(?<body>.*?)^```[ \t]*\r?$'
$files = [Collections.Generic.Dictionary[string,string]]::new([StringComparer]::OrdinalIgnoreCase)
$phases = @(Get-ChildItem -LiteralPath $plan -Filter '*.md' | Where-Object Name -like '0[1-6]-*.md' | Sort-Object Name)
if ($phases.Count -ne 6) { throw 'Expected all six workplan phases.' }

foreach ($phase in $phases) {
  $content = [IO.File]::ReadAllText($phase.FullName)
  $matches = [regex]::Matches($content, $pattern)
  if (!$matches.Count) { throw "No source files found in $($phase.Name)." }
  foreach ($match in $matches) {
    $relative = $match.Groups['path'].Value
    if (($relative -split '/') -contains '..' -or $relative -notmatch '^[a-zA-Z0-9._/\[\]-]+$') {
      throw "Invalid source path $relative."
    }
    $path = [IO.Path]::GetFullPath((Join-Path $target $relative))
    if (!$path.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw "Invalid path $path." }
    if ($files.ContainsKey($path)) { throw "Duplicate source path $relative." }
    $files.Add($path, ($match.Groups['body'].Value -replace "`r`n", "`n"))
  }
}
foreach ($path in $files.Keys) {
  if (Test-Path -LiteralPath $path) {
    if (([IO.File]::ReadAllText($path) -replace "`r`n", "`n") -cne $files[$path]) {
      throw "Existing content differs at $path. Use a fresh app directory or review the differences."
    }
  }
}
foreach ($path in $files.Keys) {
  [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($path)) | Out-Null
  [IO.File]::WriteAllText($path, $files[$path], [Text.UTF8Encoding]::new($false))
}
Write-Output "Wrote $($files.Count) files to $target"
```

Copy the supplied HTML from `docs/` into the reconstructed app’s `docs/` directory for the geometry regression test. Copy the bundled campus illustration to `smart_parkind/public/campus-evening.webp`. From `smart_parkind/`, install packages, then configure Supabase and the local environment before running the app. A database URI, SMTP account, and Vercel project are deployment inputs supplied by the operator. The phases explain where each is used. [Bundled campus illustration](../public/campus-evening.webp)

## Validation on 18 November 2026

- All seven Markdown files passed local link, heading-anchor, and code-fence checks. The README extractor reconstructed all 50 source files. The campus fixture matched the supplied HTML and architecture appendix for all 30 building entries, 16 road entries, 27 zone geometries, and 440 proposed spaces.
- Dependency installation, the campus fixture tests, TypeScript, and the Next.js production build passed. Local HTTP checks covered the campus directions URL, PWA manifest and fallback, sign-in redirect, and anonymous API denial.
- PostgreSQL and authenticated HTTP checks covered sample inventory, a limited runtime login, campus role approval, an officer's admin access denial, late-signup notice delivery and read state, duplicate plates, visitor eligibility, simultaneous claims, request replay, limits, closures, and officer correction. The checks used real local PostgreSQL, a simulated Supabase Auth endpoint, and a local stand-in for the Realtime event sink.
- The production PWA and local confirmation and recovery email flows passed the [Phase 6 release checks](06-testing-and-hosting.md#release-verification). That section records GitHub, Vercel, and the remaining hosted checks.

## UI verification on 19 November 2026

The redesigned screens passed Chrome checks at 1440, 390, and 320 CSS pixels. The checks covered form navigation, mobile and desktop navigation, map selection, and pinch-to-zoom. The production build, TypeScript checks, campus tests, and two-driver claim and release flow passed using an isolated database. See the campus map phase for validation of the current 2D plan. [Map verification](03-campus-map.md#map-verification)
