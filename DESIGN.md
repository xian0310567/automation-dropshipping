# Design

## Source of truth
- Status: Active
- Last refreshed: 2026-05-15
- Primary product surfaces: public auth, protected operations dashboard, order/CS triage, product stock monitoring, price/margin monitoring, supplier/market status
- 2026-05-15 shadcn refresh: `design/coupang-ownerclan-ops.pen` now uses a fixed shadcn-style LNB, compact cards/tables, Korean operator copy, and frame `Ro2UR` for `12 상품·재고 모니터링`.
- 2026-05-15 interaction refresh: the implementation now uses generated shadcn/ui primitives (`Button`, `Card`, `Badge`, `Input`, `Table`, `Tooltip`) plus Motion for active-nav movement, staggered card entry, mobile card taps, and row hover feedback.
- Evidence reviewed: `README.md`, `docs/operations.md`, `docs/order-cs-automation-todo.md`, `docs/auth.md`, `src/app/page.tsx`, `src/app/(app)/app/page.tsx`, `src/app/(app)/app/onboarding/page.tsx`, `src/app/globals.css`

## Brand
- Personality: calm consignment-operations control tower, precise, Korean-first, action-oriented
- Trust signals: tenant/workspace context, masked sensitive data, recent sync times, supplier/market status, human-readable work history
- Avoid: marketing-style hero layouts, decorative dashboards, vague warning copy, developer-only concepts such as internal execution stages, safety gates, request identifiers, API-signature checks, or test-run labels

## Product goals
- Goals: help operators decide what must be handled today, reduce CS and fulfillment mistakes, catch stock/price/margin risks early, make supplier and market issues visible in business language
- Non-goals: Item Winner detection, product deletion, fully autonomous refund/cancellation/CS execution
- Success signals: faster daily triage, fewer missed SLA items, fewer unsafe approvals, clearer alternate handling when a supplier or market action is unavailable

## Personas and jobs
- Primary personas: seller owner, operations manager, CS operator, read-only stakeholder
- User jobs: review urgent CS, prepare Ownerclan fulfillment work, resolve tracking failures, inspect cancellation/return risk, monitor stockouts, mapping gaps, supplier cost changes, and margin drops
- Key contexts of use: repeated daily dashboard work, time-sensitive CS windows, supplier stock changes, Coupang sales-state changes, workspace-scoped access

## Information architecture
- Primary navigation: 오늘 처리, 주문, CS, 취소·반품, 상품·재고, 가격·마진, 공급사·마켓, 작업 이력, 온보딩
- Core routes/screens: `/`, `/sign-up`, `/sign-in`, `/app`, `/app/onboarding`
- Content hierarchy: urgent queue first, then order/CS risk, then stock and margin risk, then supplier/market status and work history

## Screen inventory
- `design/coupang-ownerclan-ops.pen`: 16-frame design package.
- `00 디자인 브리프`: operator-facing service role, removed developer-only terms, UX direction, visual principles.
- `01 오늘 처리 대시보드 - 데스크톱`: daily operations overview, urgent queue, supplier/market health.
- `02 승인 상세 패널`: confirmation surface for customer-impacting or outbound fulfillment actions.
- `03 로그인 - 운영 워크스페이스`: Korean-first protected workspace entry.
- `04 회원가입·초대 시작`: workspace creation, role framing, invite-start flow.
- `05 온보딩 - 연동 준비`: workspace, Coupang, Ownerclan, notification, first sync readiness.
- `06 주문 목록 - 발주·송장 상태`: order triage with fulfillment, waybill, cancellation-risk states.
- `07 주문 상세 - 발주 승인 검토`: supplier-order approval with risk, mapping, and audit context.
- `08 CS 인박스 - SLA 우선순위`: SLA-first inquiry queue and draft-review entry.
- `09 CS 상세 - 답변 초안 승인`: message thread, order context, Korean reply draft, policy check.
- `10 취소·반품 - 위험 처리`: cancellation/return risk triage before refund or supplier/market action.
- `11 공급사·마켓 상태`: Coupang order sync, Ownerclan stock check, waybill readiness, and operator-facing recovery actions.
- `12 상품·재고 모니터링`: stockout risk, option mapping gaps, supplier stock signals, and selling-state actions.
- `13 작업 이력·알림`: human-readable history for order, stock, price, CS, return, and notification events.
- `14 모바일 오늘 처리`: compact mobile triage view for urgent CS and approval checks.
- `15 가격·마진 모니터링`: supplier-cost movement, Coupang sale price, delivery-cost impact, and price-change candidates.

## Design principles
- Principle 1: Show the next operational decision before showing raw data.
- Principle 2: Show implementation safety indirectly through operational status, not through developer-control labels.
- Principle 3: Make customer-impacting or sales-impacting actions deliberate, with clear consequences before action.
- Principle 4: The protected app LNB is fixed across every `/app/**` route; page-specific priorities appear as content cards, never as a changing navigation surface.
- Tradeoffs: compact density is preferred for desktop operators, but stock, margin, SLA, and return-risk copy must remain readable.

## Visual language
- Color: neutral work surface with teal for selected/healthy state, amber for approval/policy attention, rose for SLA/customer-impact risk, blue for system information
- Typography: sans-serif UI text, tabular/mono numerals for metrics and limits
- Spacing/layout rhythm: shadcn-like density, compact cards, stable app shell, small table rows, and no oversized dashboard hero inside the working app
- Shape/radius/elevation: 6-8px radius, thin borders, minimal shadow
- Motion: operational but visible; use quick spring/transform feedback for nav, cards, table rows, tap states, sync controls, and confirmations while keeping text immediately readable.
- Imagery/iconography: lucide-style operational icons, no decorative illustrations

## Components
- Existing components to reuse: current App Router page shells, lucide icons, shadcn/ui generated primitives under `src/components/ui`
- New/changed components: shadcn-backed task queue row, KPI card, status badge, action button, search input, data table, supplier/market status row, product-risk row, margin-risk row, work-history row
- Variants and states: neutral, selected, urgent, approval required, safe, failed, disabled, read-only
- Token/component ownership: keep Tailwind/CSS variables close to existing `globals.css` direction unless a formal token layer is added later

## Accessibility
- Target standard: WCAG AA
- Keyboard/focus behavior: every queue row and approval action must be reachable with visible focus
- Contrast/readability: warning/danger labels must not rely on color alone
- Screen-reader semantics: queues should expose status, deadline, and action labels
- Reduced motion and sensory considerations: no auto-flashing urgency indicators; animation favors transform/background feedback over opacity fades so urgent text remains immediately legible.

## Responsive behavior
- Supported breakpoints/devices: desktop-first operations dashboard, tablet stacked panels, mobile card queue for urgent review
- Layout adaptations: desktop uses table plus right rail; mobile uses cards and bottom navigation
- Touch/hover differences: mobile actions must include visible labels, not hover-only controls

## Interaction states
- Loading: show sync progress and last successful sync time
- Empty: explain the next scheduled sync or setup step
- Error: state cause, operational impact, and recovery action
- Success: show responsible user, timestamp, and business outcome
- Disabled: explain missing permission, missing account setup, or unavailable supplier/market state
- Offline/slow network, if applicable: keep read-only queue visible and mark outbound actions as unavailable in operator language

## Content voice
- Tone: direct, calm, specific
- Terminology: use `오늘 처리`, `보류`, `품절 임박`, `매핑 누락`, `마진 하락`, `송장 대기`, `확인 필요`, `SLA`
- Microcopy rules: buttons use verbs; warnings include the consequence; customer-impacting or sales-impacting actions mention the result before execution; hide internal implementation terms from the user-facing UI

## Implementation constraints
- Framework/styling system: Next.js App Router, React, Tailwind CSS v4, shadcn/ui, lucide-react, Motion for React
- Design-token constraints: prefer shadcn CSS variables and generated component APIs before adding local styling
- Performance constraints: dashboard should render quickly from server-prepared operations data, keep motion scoped to client UI components, and avoid heavyweight client-only charts
- Compatibility constraints: Clerk production auth, local development session support, tenant-scoped data
- Test/screenshot expectations: browser-visible Next.js changes require Playwright E2E coverage and `pnpm test:e2e`

## Open questions
- [ ] Production onboarding policy / owner / affects public self-serve versus invite-first copy
- [ ] Final supplier/market readiness contracts / owner / affects exact operational status labels
- [ ] Mobile approval scope / owner / affects whether high-risk approval is desktop-only
