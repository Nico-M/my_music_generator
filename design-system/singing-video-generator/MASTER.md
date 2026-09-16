# Design System Master File — Kinetic Luster Edition

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** VocalBeat AI / Singing Video Generator  
**Design System:** Kinetic Luster (`asset-stub-assets_bcf45a5090fd4f8a995c8063c258181d`)  
**Theme:** Light Porcelain & Electric Violet Studio  
**Aesthetic:** Airy Luminance, Zero-Gravity White Canvas, Electric Precision Accents  

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable | Usage |
|------|-----|--------------|-------|
| Background Canvas | `#FAF8FF` | `--color-bg` | Airy light background canvas |
| Surface (Pure White) | `#FFFFFF` | `--color-surface` | Primary cards, panels, modals |
| Surface Low (Porcelain) | `#F2F3FF` | `--color-surface-2` | Secondary containers, inactive tabs, wells |
| Surface Container | `#EAEDFF` | `--color-surface-container` | Active tabs, pill chips |
| Surface High | `#E2E7FF` | `--color-surface-high` | Badges, highlighted chips |
| Border / Outline | `#E2E8F0` | `--color-border` | Clean hairline dividers and strokes |
| Text Primary | `#131B2E` | `--color-text` | Deep navy-slate, crisp 4.5:1+ contrast |
| Text Muted | `#464554` | `--color-text-muted` | Secondary descriptions and subtitles |
| Text Subtle | `#767586` | `--color-text-subtle` | Micro labels, timestamps, placeholders |
| Primary (Electric Violet) | `#4648D4` | `--color-primary` | Main CTAs, selected states, key indicators |
| Primary Light | `#6063EE` | `--color-primary-light` | Primary button hover |
| Secondary (Coral Rose) | `#DC2C4F` | `--color-secondary` | High-energy badges, beat markers, hot tags |
| Accent / Tertiary (Sky Cyan)| `#0EA5E9` | `--color-accent` | Waveforms, playhead accents, auxiliary glows |
| Danger / Error | `#BA1A1A` | `--color-danger` | Destructive actions, error alerts |
| Warning | `#F59E0B` | `--color-warning` | Warning tags and status |

---

### Typography

- **Primary Font:** Plus Jakarta Sans
- **Headline Font:** Plus Jakarta Sans
- **Mono / Code Font:** Fira Code
- **Mood:** Modern, crisp, airy, energetic, creator-focused, effortless
- **Google Fonts:** `https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap`

---

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Micro gaps, chip paddings |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Container gaps |
| `--space-2xl` | `48px` / `3rem` | Hero padding |

---

### Elevation & Depth

| Level | Value | Usage |
|-------|-------|-------|
| Surface Tier 0 | None (flat `#FAF8FF`) | Main page canvas |
| Surface Tier 1 | `#F2F3FF` + `#E2E8F0` border | Recessed controls, audio well |
| Surface Tier 2 | `0 1px 4px rgba(70,72,212,0.05), 0 1px 2px rgba(19,27,46,0.04)` | Cards, floating panels |
| Surface Hover | `0 8px 24px -4px rgba(70,72,212,0.12)` | Card hovers |
| Primary Glow | `0 2px 8px rgba(70,72,212,0.25)` | Primary CTAs |

---

## Component Specs

### Primary Button
```css
.btn-primary {
  background: #4648D4;
  color: #FFFFFF;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(70, 72, 212, 0.25);
  transition: all 200ms ease;
  cursor: pointer;
}
.btn-primary:hover {
  background: #6063EE;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(70, 72, 212, 0.35);
}
```

### Secondary Button
```css
.btn-secondary {
  background: #FFFFFF;
  color: #131B2E;
  border: 1px solid #E2E8F0;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 500;
  transition: all 200ms ease;
  cursor: pointer;
}
.btn-secondary:hover {
  color: #4648D4;
  border-color: #4648D4;
  background: #F2F3FF;
}
```

### Cards
```css
.card {
  background: #FFFFFF;
  border-radius: 12px;
  border: 1px solid #E2E8F0;
  box-shadow: 0 1px 4px rgba(70, 72, 212, 0.05);
  transition: all 200ms ease;
  cursor: pointer;
}
.card:hover {
  border-color: #E1E0FF;
  background: #F5F6FF;
  box-shadow: 0 8px 24px -4px rgba(70, 72, 212, 0.12);
  transform: translateY(-1px);
}
```
