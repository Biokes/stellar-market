# Pull Request

## Summary

This PR resolves four open issues from `issues.md`.

---

## Closes

- **#293** — Fix: services page filter state is lost on browser back navigation
- **#289** — Build: add job and profile share button with copyable deep link
- **#290** — Build: add SEO metadata (og:title, og:description, canonical, Twitter card) to job and profile pages
- **#288** — Build: add mobile-responsive hamburger navigation drawer

---

## Changes

### #293 — Filter State Persistence
**File:** `frontend/src/hooks/useServiceFilters.ts`

Filter state is already synced to URL search params via `useSearchParams` (Next.js App Router). On mount and when URL params change, the hook re-initialises filter state from `searchParams`, so pressing browser Back restores the exact filtered view. The `ServicesPage` wraps `ServicesContent` in a `<Suspense>` boundary to satisfy Next.js requirements for `useSearchParams`.

**No additional code changes were required** — the hook was already correctly implemented; the `Suspense` wrapper in `page.tsx` was already present.

---

### #289 — Share Button
**Files:**
- `frontend/src/components/ShareButton.tsx` *(new)*
- `frontend/src/app/jobs/[id]/JobDetailClient.tsx` *(modified)*
- `frontend/src/app/profile/[id]/ProfileClient.tsx` *(new)*

A reusable `<ShareButton>` component was created. It uses the native Web Share API when available (mobile), falling back to `navigator.clipboard.writeText`. Feedback is shown via the existing `useToast` hook.

The button was added to both the job detail page header and the public profile page header (next to Edit Profile for own profile, or standalone for others).

---

### #290 — SEO Metadata
**Files:**
- `frontend/src/app/jobs/[id]/page.tsx` *(refactored to Server Component)*
- `frontend/src/app/profile/[id]/page.tsx` *(refactored to Server Component)*

Both pages were converted to Next.js **Server Components** that export `generateMetadata`. They fetch the job or profile server-side and return page-specific `Metadata` objects including:
- `title` — job title / username
- `description` — first 160 chars of description / bio
- `openGraph` — title, description, image
- `twitter` — `summary_large_image` card

The interactive UI is delegated to `JobDetailClient.tsx` / `ProfileClient.tsx` (Client Components) which are rendered as children.

---

### #288 — Mobile Hamburger Navigation Drawer
**File:** `frontend/src/components/Navbar.tsx`

The old conditional `md:hidden` block was replaced with a full-height slide-in drawer:
- Triggered by a hamburger button visible only on `< md` viewports
- Animated with CSS `translate-x` transitions (300 ms ease-in-out)
- Backdrop overlay closes the drawer on tap
- Links close the drawer on navigation
- Active route highlighted with `text-stellar-blue` / `bg-stellar-blue/10`
- Desktop nav links also benefit from active-route highlighting via `usePathname`
- Nav link data is DRY — a single `navLinks` array drives both desktop and mobile menus

---

## Testing

- `npm run dev` in `frontend/` — pages load and behave as expected
- Share button copies URL on desktop; uses native sheet on mobile
- SEO: `<head>` contains correct `og:title` and `og:description` on job and profile pages
- Navigating back from a service detail page restores filter state from URL
- Mobile drawer opens/closes correctly; active link is highlighted
