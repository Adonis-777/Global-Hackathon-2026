# Quantum² Design System Specification

> **Project:** Urban Waterlogging Nowcast — Hyderabad  
> **Visual Architecture:** Quantum² Design System  
> **Font Family:** Figtree Variable Font (`100` to `900`)

---

## 🎨 1. Color Tokens

| Token Name | Hex Code | Purpose / Usage |
| :--- | :--- | :--- |
| `--c-ink` / `quantum.ink` | `#000000` | Primary text, bold headers, dark pill CTA buttons |
| `--c-ink-soft` / `quantum.inkSoft` | `#2e2e2e` | Active tab text, secondary headings |
| `--c-muted` / `quantum.muted` | `#b8b8b8` | Captions, metadata, idle tabs, subtext |
| `--c-surface-nav` | `#000000` | Navigation bar fill (`border-radius: 26px`, 52px height) |
| `--c-surface-card` | `#f2f2f2` | Card container background (`border-radius: 16px`) |
| `--c-surface-panel` | `#ffffff` | Inner panel card row container (`border-radius: 8px`) |
| `--c-border-row` | `#ededed` | Subtle panel row and card border stroke |
| `--c-accent` / `quantum.accent` | `#38c6ec` | Primary branding, cyan scanner line, active indicators, highlights |
| `--c-band` | `#0db5ed` | Video band fallback & primary highlight gradient |
| `--c-danger` | `#ff3131` | High-risk flood markers, critical alert notifications |
| `--c-warning` | `#f6a825` | Moderate-risk flood markers, open question indicators |

---

## ✒️ 2. Typography & Letter Spacing

Primary Font Family: `'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

### Variable Weight Axis
- `--fw-light`: `388` (Captions, metadata, eyebrow subtitles)
- `--fw-regular`: `470` (Body copy, descriptions)
- `--fw-medium`: `500` (Item titles, nav links)
- `--fw-semibold`: `511` (Panel headings)
- `--fw-bold`: `577` (Buttons, key callouts, active badges)
- `--fw-black`: `783` (Display H1, wordmarks, brand titles)

### Tracking Tokens (Letter Spacing)
- `--tr-display`: `-0.0572em` (Hero H1)
- `--tr-title`: `-0.0570em` (Card titles)
- `--tr-heading`: `-0.0200em` (Panel headings)
- `--tr-body`: `-0.0475em` (Subcopy)
- `--tr-eyebrow`: `-0.0293em` (Section eyebrows)
- `--tr-ui`: `-0.0080em` (Nav links & UI controls)

---

## 🧱 3. Component Library Specifications (`shared/ui`)

### `QuantumNav` (`shared/ui/QuantumNav.tsx`)
- Floating black pill navbar (`52px` height, `26px` border-radius, background `#000000`).
- Quantum cyan vector logo (`26×25px`), wordmark superscript (`Quantum²`), desktop link bar, and `17px` rounded action CTA.
- Built-in responsive burger toggle & dropdown menu for compact/mobile viewports.

### `CyberCard` (`shared/ui/CyberCard.tsx`)
- Quantum surface card (`#f2f2f2` fill, `#ededed` border, `16px` radius).
- Soft drop shadow (`0 12px 40px rgba(2,72,105,0.12)`).
- `#38c6ec` vertical cyan accent bar & pulsing live status indicator.

### `CyberButton` (`shared/ui/CyberButton.tsx`)
- Pill-shaped buttons (`border-radius: 17px`).
- Variants: `primary` (black fill, white text, cyan hover), `accent` (`#38c6ec` cyan fill), `white` (`#ffffff` fill), `danger` (`#ff3131` fill), `ghost` (transparent fill).

### `CyberLabel` (`shared/ui/CyberLabel.tsx`)
- Figtree font label component supporting `default`, `highlight`, `muted`, and `eyebrow` tracking variants.

### `AlertNotification` (`shared/ui/AlertNotification.tsx`)
- Floating notification banner with animated pulse rings for emergency broadcasting.
