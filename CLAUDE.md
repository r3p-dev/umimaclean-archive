# Umima Clean (skripsi)

Shoe, bag and helmet cleaning with pickup and delivery in Bandung Raya. UI language is Indonesian.

Stack: AdonisJS 7 + Inertia + React 19, PostgreSQL + PostGIS, Lucid, VineJS, Bouncer, Transmit, Fonnte (WhatsApp), Midtrans Core API (QRIS), Cloudflare Turnstile, npm. Frontend: Tailwind CSS v4, shadcn/ui on React Aria (`aria-vega`), Tabler icons.

## Agent rules

- Git: only read-only commands (`status`, `diff`, `log`, `show`). Never `add`, `rm`, `reset`, `restore`, `checkout`, `stash`, `commit`, `push`; ask the user to do it.
- Never send personal or identifying data (email, name, phone, tokens) to an outside service without asking first. Use a neutral User-Agent (`UmimaClean-skripsi/1.0`) and say which service and what is sent before any new kind of outside request.
- Stop and ask when something turns out different from the agreed plan.
- `database/schema.ts` is generated: rebuild it with `NODE_ENV=test node ace migration:fresh` and format it with Prettier; never edit or restore it by hand.

## Business rules

- Roles (`Role` enum): `customer` (Pelanggan), `staff` (Staf, one courier who also works the store) and `admin` (Owner). Everyone signs in with WhatsApp number + password; `/masuk` accepts only customers, `/staf/masuk` staff and owner.
- WhatsApp to customers: exactly five messages, all built in `app/helpers/whatsapp_text.ts` and sent by `OrderService`/`ReminderService` through `FonnteService`: order received, courier on the way, bill (walk-ins: "Rincian: …", online: "Rincian dan pembayaran: …"), payment reminder, cancelled by the store. Staff and owner get none. OTP codes are separate (`OtpService`). A failed or crashing send is logged and never fails the action.
- Payment reminders (`node ace orders:remind-payment`, every 15 minutes): online orders awaiting payment with no paid payment, first 24 hours after the bill, then every 2 days, only 10:00–15:00 Asia/Jakarta, until paid. Only a sent message is counted. Never calls Midtrans.
- Walk-ins (`source = store`) pay at the counter (cash or counter QRIS); they get no reminders. Helmets are shop-only: online orders cannot hold them (`Order.canHoldItem`).
- Midtrans is charged only when the customer presses pay (`PaymentService.startQris`); a QR lives 15 minutes. A cash or owner-recorded payment cancels the order's live QRIS at Midtrans after commit; a failed cancel becomes payment status `cancel_failed`, a QRIS settled after the order was paid becomes `refund_due` (database: one `paid` payment per order).
- Addresses: at most 3 per customer, one primary (partial unique index). Orders copy pickup and delivery into `order_addresses`.
- Order URL `/pesanan/:id`, shown as `UMC-00042` (`orderNumber` in `app/helpers/order.ts`). The signed-in customer sees it directly; anyone else types the last 4 digits of the order's phone (5 wrong tries per 15 minutes per IP and per order, 20 per order per 24 hours), which unlocks it for that session only.
- Service areas: the 80 BPS kecamatan of Kota Bandung, Kota Cimahi, Kabupaten Bandung and Kabupaten Bandung Barat in `service_areas` (seeded from `database/data/service_areas.geojson`). The owner switches them on/off in Pengaturan → Area layanan. Every pin is checked with `ServiceArea.contains` (PostGIS `ST_Contains` on active areas): address create/update, online order review and placement (saved addresses are re-checked), walk-in delivery. Orders already placed are not re-checked. The map pin asks `GET /area?lat&lng` for instant feedback. Address search, the nearby list and the pin's street label come from `GET /lokasi` and `GET /lokasi/titik` (signed-in users only, `PlaceService`) over the OpenStreetMap data in the `osm` schema (`database/osm/`, loaded by `node ace osm:import`, not by migrations); no outside geocoder is called.
- Courier queue order: `TaskService` plans it nearest first by OSRM travel time (within each pickup date and slot; deliveries as one queue), cached per courier and day and recomputed only on complete, skip, or a change in the queue's orders; skipped stops last; without OSRM the scheduled order with "Urutan belum dioptimasi".
- Order status changes only through `OrderService.transitionOrder` (checks `ORDER_TRANSITIONS`, appends `order_events`, logs staff/owner actions in `activity_logs`, broadcasts on Transmit after commit). Pickup slots have an owner-set capacity, re-checked under a Postgres advisory lock.

## Layers

- **Controller**: HTTP only. Validate, authorize with Bouncer, call services (injected with `@inject()`), render or redirect. Never imports `#models/*`; no business logic, no queries, no transactions.
- **Service**: a business process across models, transactions and outside APIs. One per domain, flat in `app/services/`.
- **Model**: entity rules (`order.canTransitionTo`) and reusable static queries or scopes (`ServiceArea.contains`, `User.isPhoneTaken`, `Order.findForOwner`); services call these instead of repeating the query. No repository layer.
- One home per query: a service method never just forwards to a model static. It either does the use case around it (checks, combines, writes: `OtpService.startPhoneChange`, `OrderService.findOrderDetailForOwner`) or the query lives only in that service.
- Chain rule: a service calls at most one other domain service (`TaskService`, `BillingService`, `PaymentService` → `OrderService`; `StaffService` → `AccountService`). The outside-API clients `FonnteService`, `MidtransGateway`, `OsrmGateway` and `TurnstileService` call nothing else.
- No abstract base classes, no repositories, no interfaces with one implementation.
- Role and ownership rules live in Bouncer: abilities in `app/abilities/main.ts`, policies `OrderPolicy`, `CustomerAddressPolicy`, `OtpFlowPolicy`.

## Services

- `AccountService`: sign in/out (login limit), `changePasswordWithCurrent` (profile), `resetPasswordAfterOtp` (forgot password), `signOutOtherDevices`, `endSessions` (remember-me tokens and tagged sessions, optionally keeping the current one).
- `AddressService`: the address book (max 3, primary, area check).
- `AreaService`: `checkAreaCoverage` for `GET /area`, owner `listAreasForOwner` and `setAreaActive` (logged).
- `BillingService`: price list (owner CRUD, soft delete) and the bill from an inspection.
- `FonnteService`: the only HTTP call to Fonnte; without `FONNTE_TOKEN` it logs the message (outside production).
- `MidtransGateway`: Midtrans Core API over `fetch` (charge, status, cancel, webhook signature).
- `OsrmGateway`: the self-hosted OSRM (`/route`, `/table`); without `OSRM_URL` it answers `null`.
- `OrderService`: order lifecycle (place, walk-in, cancel, owner bulk move/cancel), transitions, slots, guest tracking unlock, customer WhatsApp messages.
- `PlaceService`: address search, nearby places and point labels from the `osm` schema (raw SQL; answers empty when the schema is missing).
- `OtpService`: WhatsApp OTP codes, their limits and the OTP flow state in the session.
- `PaymentService`: QRIS start/refresh/webhook, counter payments, owner corrections.
- `ReminderService`: `sendDueReminders(now)` for the payment reminders.
- `ReportService`: owner reports, costs, activity log, customer list.
- `SettingService`: store settings (read, owner save, logged) and the privacy page facts.
- `StaffService`: owner-managed staff accounts.
- `TaskService`: courier trips (pickup and delivery), inspection start, washing, collection, staff counts and history, the route line (`GET /staf/rute`) and board km/ETA (one OSRM `/table` per board, 5-minute cache), falling back to `estimateLeg` (`app/helpers/route.ts`).
- `TurnstileService`: Cloudflare Turnstile check.

## Conventions

- No comments in any file, except the header comment of each migration and of each `database/osm/*` file, the `data-bleed` block in `inertia/components/ui/card.tsx` and the gap comment on the welcome CTA card.
- Validation messages live only in `start/validator.ts`: one generic message per rule plus `fields` labels; add a `field.rule` key only when the generic text would confuse the user. Validators are named `<action><Resource>Validator`.
- Errors: `throw new Exception('…', { status })` from `@adonisjs/core/exceptions` for HTTP errors (404 etc.); `fieldError(field, message, rule)` from `#validators/shared/field_error` for a business rule shown under a form field. No custom exception classes.
- Migrations: one `create` per table, never `alter`. Each starts with a header comment explaining the table, non-obvious columns, indexes and constraints.
- Seeders: one file per domain in `database/seeders/`, run in a fixed order from `database/seeders/main/index_seeder.ts` (user, address, service, setting, service_area, order, operating_cost).
- Client IP: `request.ip()` reads `X-Forwarded-For` only from `TRUSTED_PROXIES` (default `loopback,uniquelocal`, `config/app.ts`), so per-IP limits see the real client behind Traefik.
- Rate limits: HTTP endpoint limits are route middleware in `start/limiter.ts` (`GET /area`, 60 per minute per IP; `GET /lokasi*`, 240 per minute per user). Business limits stay in their service: login (`AccountService`, per phone and IP), OTP (`OtpService`: 60 s resend, 5 per number and 20 per IP per hour), tracking digits (`OrderService`, plus a daily cap per order), QRIS charges (`PaymentService`, 5 per order per 15 minutes).
- Enums: `app/enums/<name>_enum.ts` exports an `as const` object, a type with the same name and a `<Name>Label` map when the UI shows the value. DB columns are plain strings typed through `database/schema_rules.ts`; validators use `vine.enum(Object.values(X))`; the frontend imports `@enums/<name>_enum`.
- Style (Harminder Virk): full words (`ctx`, `lat`, `lng`, `db`, `props`, `ref` are fine); booleans `isX`/`hasX`/`canX`/`shouldX`; braces on every `if`; `for...of`; no `get`/`set` accessors; `#private` members (`protected` only for injected dependencies); `override` on every override. Export only what another file uses.
- Service and model method names say their entity (`createAddress`, `findOrderById`, `cancelOrdersByOwner`), not bare `create`/`find`/`list`; controllers keep the AdonisJS resource names (`index`, `show`, `store`, `update`, `destroy`). Shared service messages and limits live in `app/services/constants.ts`, shared service types in `app/services/types.ts`.
- Stored and wire names keep their spelling even when they break that style: DB columns, JSON settings (`PickupSlotSetting.on`) and HTTP/props fields (`remember`, `terms`, `logoutOthers`, `q`, `active`).
- File names snake_case; shadcn files in `inertia/components/ui/` stay kebab-case. Prettier (single quotes, no semicolons) on touched files.
- Tests: `tests/support/app.ts` swaps `FonnteService`, `TurnstileService` and `MidtransGateway` for fakes, resets the database before each test (keeping `spatial_ref_sys`) and seeds two fixture service areas. `tests/support/osm.ts` loads a small `osm` fixture once per run; `.env.test` leaves `OSRM_URL` empty (routing tests swap in a fake or a local HTTP server); browser tests abort every request to a non-local host.

## Frontend

- Read `docs/design-system.md` (git-ignored, local) before writing UI; artboards are in `docs/design/`.
- Tokens only in `inertia/css/app.css`; use token utilities, no raw colors. New scale tokens (`--text-*`, `--radius-*`, `--shadow-*`, `--spacing-*`) also go in `inertia/lib/shared/utils.ts`.
- Muted text: `text-foreground-secondary` for sentences meant to be read (descriptions, intro paragraphs), `text-muted-foreground` for metadata (dates, counts, captions, hints). `CardDescription` defaults to the metadata style; page-level descriptions use `text-foreground-secondary`.
- Components: shadcn primitives in `inertia/components/ui/`, the rest in `inertia/components/{atoms,molecules,organisms,templates}`. Pages own state and navigation; logic lives in `inertia/lib/<feature>/`, never in components.
- Pages by role: `inertia/pages/{auth,customer,staff,admin}/` (landing `pages/home.tsx`). Routes per role in `start/routes/{auth,customer,staff,admin}.ts`; shared ones in `start/routes.ts`. Run `node ace codegen` after changing routes.
- Layouts: `CustomerLayout`, `AccountLayout` (+ `ProfileShell`), `AuthLayout`, `FlowLayout`, `StaffLayout` + `StaffTopBar`, `AdminLayout` + `AdminPageHeader`; owner tables use `useDataTable`.
- Breakpoints: base, `sm:` (600px), `lg:` (1024px); no `md:` for layout. Icons from `@tabler/icons-react` only.
- Maps: Leaflet with the self-hosted PMTiles base map from `inertia/lib/location/base_map.ts` (`addBaseMap`, `MAP_ATTRIBUTION`); no outside tile or map service.
- Live updates: Transmit channels `orders/:id`, `staff/queues`, `admin/orders` (`start/transmit.ts`); pages call `useLiveReload`.
- Browser storage only for conveniences: the staff map-app preference and the unsent walk-in draft.

## Card conventions

- Compose `Card` slots directly: `CardHeader` (`CardTitle`, `CardDescription`, `CardAction`), `CardContent`, `CardFooter`. No wrapper components for card layouts.
- `CardTitle` renders a native heading through `as="h1"`…`"h6"`; never `role="heading"`/`aria-level`. Top-right items (badges, links, buttons) go in `CardAction`.
- `size="sm"` only for dense or secondary cards (queue rows, filter toolbars).
- Classes on slots: layout only (direction, alignment, wrap, grid placement, visibility, child widths), type tokens on `CardTitle`/`CardDescription` for page-level cards only, and `border-b`/`border-t` on `CardHeader`/`CardFooter`. No arbitrary values, no spacing overrides; the welcome CTA gap is the single documented exception.
- Edge-to-edge tables and media: `<CardContent data-bleed>` (see the comment in `inertia/components/ui/card.tsx`).
- List cards: inset list in `CardContent` (`<ul className="divide-y divide-border">`, rows `py-3 first:pt-0 last:pb-0`); `CardHeader className="border-b"` where a line under the title is wanted. Menus whose rows have full-width hover backgrounds use `data-bleed` instead, with rows padded `px-(--card-spacing)`.
- `Overline` only for headings outside cards, with the right element through `as`.
- Cards are border-only, no shadows.

## Commands

- `npm run dev` (http://localhost:3333)
- `node ace migration:fresh --seed` (dev database), `node ace db:seed`
- `node ace orders:remind-payment`, `node ace proofs:prune` (the `scheduler` service in `compose.yaml`, see `README.md`)
- `node ace osm:import` then `node ace osrm:build` (map data and routing files in `storage/`; the `osrm` service in `compose.yaml`, see `README.md`)
- `node ace tiles:extract` (map tiles in `public/tiles/`, needs the `pmtiles` CLI; the `tiles` volume of `web`, see `README.md`)
- `npm test` (unit, functional, browser; `.env.test`, port 3334), `npm run typecheck`, `npm run lint`
- TypeScript stays on 6.x (`@adonisjs/assembler` and `typescript-eslint` don't accept 7 yet).
