/* hal0.dev — unified chrome.
 * Header + Footer are authored ONCE here and reused byte-for-byte by every
 * surface (landing, docs, blog, KB, benchmarks, profiles, forum). Sections
 * never fork the chrome; they pass `active` and, for Discourse, variant="forum".
 */
const DS = window.Hal0DesignSystem_692ad8;
const { Icon, Wordmark, Button, Chip, StatusDot, Kbd } = DS;

const P_HOME = "06%20Homepage.html";
const P_DOCS = "08%20Docs.html";
const P_WRITE = "04%20Blog%20and%20KB.html";
const P_BENCH = "02%20Benchmarks.html";
const P_PROF = "03%20Profiles.html";
const P_FORUM = "07%20Forum.html";
const P_SHEET = "01%20Unified%20Chrome.html";
const P_OG = "05%20OG%20Card%20Template.html";

const NAV = [
  { id: "learn", label: "learn", href: P_DOCS, sub: ["docs", "knowledge base", "blog"] },
  { id: "bench", label: "benchmarks", href: P_BENCH },
  { id: "profiles", label: "profiles", href: P_PROF },
  { id: "forum", label: "forum", href: P_FORUM, host: "forum.hal0.dev" },
];

/* Brand glyphs the hal0 icon family doesn't ship (third-party marks). */
function BrandIcon({ name, size = 15 }) {
  const p = {
    github: "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z",
    discord: "M13.55 3.11A13.2 13.2 0 0 0 10.3 2.1a9.2 9.2 0 0 0-.42.86 12.3 12.3 0 0 0-3.66 0 9 9 0 0 0-.42-.86 13.2 13.2 0 0 0-3.26 1.01C.46 6.2-.28 9.2.09 12.16a13.3 13.3 0 0 0 4.02 2.03c.32-.44.61-.91.86-1.4-.47-.18-.92-.4-1.35-.66.11-.08.22-.17.33-.26a9.5 9.5 0 0 0 8.1 0c.11.09.22.18.33.26-.43.26-.88.48-1.35.66.25.49.54.96.86 1.4a13.3 13.3 0 0 0 4.02-2.03c.44-3.43-.74-6.4-3.36-9.05zM5.35 10.35c-.8 0-1.46-.73-1.46-1.63s.64-1.63 1.46-1.63c.82 0 1.47.74 1.46 1.63 0 .9-.65 1.63-1.46 1.63zm5.3 0c-.8 0-1.46-.73-1.46-1.63s.64-1.63 1.46-1.63c.82 0 1.47.74 1.46 1.63 0 .9-.64 1.63-1.46 1.63z",
    rss: "M2.5 12.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM1 6.5v2.2c3.7 0 6.7 3 6.7 6.8h2.2C9.9 10.6 5.9 6.5 1 6.5zM1 1v2.2c6.4 0 11.6 5.2 11.6 11.6h2.2C14.8 7.2 8.6 1 1 1z",
  }[name];
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d={p} />
    </svg>
  );
}

/* Deterministic monogram stand-in for a GitHub avatar. */
function GhAvatar({ user, size = 18 }) {
  const init = (user || "?").replace(/^@/, "").slice(0, 2);
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.max(9, size * 0.42) }} title={user}>
      {init}
    </span>
  );
}

function toggleTheme() {
  const el = document.documentElement;
  el.dataset.theme = el.dataset.theme === "light" ? "dark" : "light";
}

function ThemeToggle() {
  const [light, setLight] = React.useState(document.documentElement.dataset.theme === "light");
  return (
    <button
      className="iconbtn"
      aria-label="Toggle theme"
      onClick={() => { toggleTheme(); setLight((v) => !v); }}
    >
      {light ? (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8 5.6 5.6 0 1 0 13.2 9.6z"/></svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="3"/><path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3.1 3.1l1.1 1.1M11.8 11.8l1.1 1.1M3.1 12.9l1.1-1.1M11.8 4.2l1.1-1.1"/></svg>
      )}
    </button>
  );
}

/* ── Header ────────────────────────────────────────────────────
 * variant: "site" (hal0.dev) | "forum" (forum.hal0.dev, Discourse controls)
 * compact: force the mobile layout regardless of viewport (specimen frames)
 */
function Header({ active, variant = "site", sticky = false, compact = false, desktop = false, ontop = false, user = null, drawerOpen, onToggleDrawer, onSearch }) {
  /* Pages don't have to own drawer state — only the specimen frames do. */
  const [selfOpen, setSelfOpen] = React.useState(false);
  const open = onToggleDrawer ? drawerOpen : selfOpen;
  const toggle = onToggleDrawer || (() => setSelfOpen(v => !v));
  const cls = ["hdr", sticky && "sticky", ontop && "ontop", compact && "mob", desktop && "desktop"].filter(Boolean).join(" ");
  return (
    <header className={cls}>
      <div className="wrap wide hdr-in">
        <a className="hdr-brand" href={P_HOME} aria-label="hal0 home">
          <Wordmark size={19} />
          {variant === "forum" && <span className="hdr-slug">forum</span>}
        </a>
        <nav className="hdr-nav">
          {NAV.map((n) => (
            <a key={n.id} href={n.href} className={active === n.id ? "on" : ""} aria-current={active === n.id ? "page" : undefined} title={n.host || undefined}>
              {n.label}
              {n.host && <span className="ext">↗</span>}
            </a>
          ))}
        </nav>
        <div className="hdr-right">
          {variant === "forum" ? (
            <>
              <button className="searchbtn desk" onClick={onSearch}>
                <Icon name="search" size={13} />
                <span>search topics</span>
                <span className="k">/</span>
              </button>
              <span className="hdr-sep desk" />
              <a className="iconbtn desk" href="#" aria-label="GitHub"><BrandIcon name="github" /></a>
              <ThemeToggle />
              <button className="iconbtn" aria-label="Notifications"><Icon name="bell" size={15} /><span className="pip" /></button>
              <button className="iconbtn" aria-label="Account" style={{ width: 30 }}><GhAvatar user="lemond" size={22} /></button>
              <button className="btn sm desk" style={{ marginLeft: 2 }}>new topic</button>
            </>
          ) : (
            <>
              <button className="searchbtn desk" onClick={onSearch}>
                <Icon name="search" size={13} />
                <span>search hal0</span>
                <span className="k">⌘K</span>
              </button>
              <span className="hdr-sep desk" />
              <a className="iconbtn" href="#" aria-label="GitHub"><BrandIcon name="github" /></a>
              <a className="iconbtn" href="#" aria-label="Discord"><BrandIcon name="discord" /></a>
              <ThemeToggle />
              {user && (
                <>
                  <span className="hdr-sep desk" />
                  <button className="iconbtn" aria-label="Notifications"><Icon name="bell" size={15} /><span className="pip" /></button>
                  <button className="iconbtn" aria-label="Account"><GhAvatar user={user} size={22} /></button>
                </>
              )}
            </>
          )}
          <button className="iconbtn hdr-burger" aria-label="Menu" aria-expanded={!!open} onClick={toggle}>
            <Icon name={open ? "close" : "menu"} size={16} />
          </button>
        </div>
      </div>
      {open && <Drawer active={active} />}
    </header>
  );
}

function Drawer({ active }) {
  return (
    <div className="drawer">
      {NAV.map((n) => (
        <a key={n.id} href={n.href} className={"row" + (active === n.id ? " on" : "")}>
          <span>{n.label}</span>
          <span className="mono" style={{ fontSize: 11, color: "var(--fg-4)" }}>{n.host || ""}</span>
        </a>
      ))}
      <div className="foot">
        <a className="iconbtn" href="#" aria-label="GitHub"><BrandIcon name="github" /></a>
        <a className="iconbtn" href="#" aria-label="Discord"><BrandIcon name="discord" /></a>
        <ThemeToggle />
        <button className="searchbtn" style={{ flex: 1, minWidth: 0 }}>
          <Icon name="search" size={13} /><span>search hal0</span>
        </button>
      </div>
    </div>
  );
}

/* ── Footer ──────────────────────────────────────────────────── */
const FOOTER_COLS = [
  { h: "learn", links: [["docs", P_DOCS], ["knowledge base", P_WRITE], ["blog", P_WRITE], ["changelog", "#"], ["releases", "#"]] },
  { h: "community", links: [["forum ↗", P_FORUM], ["discord ↗", "#"], ["github ↗", "#"], ["contributing", "#"], ["hello@hal0.dev", "mailto:hello@hal0.dev"]] },
  { h: "data", links: [["benchmarks", P_BENCH], ["profiles", P_PROF], ["share a run", P_BENCH], ["hardware notes", P_WRITE], ["roadmap", "#"]] },
];

function Footer() {
  return (
    <footer className="ftr">
      <div className="wrap wide">
        <div className="ftr-cols">
          <div className="ftr-brand">
            <Wordmark size={20} />
            <p className="site-sm" style={{ marginTop: 12 }}>
              Self-hosted AI inference for the box in your rack. Built and benchmarked by the
              Strix Halo community.
            </p>
            <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
              <a className="iconbtn" href="#" aria-label="GitHub"><BrandIcon name="github" /></a>
              <a className="iconbtn" href="#" aria-label="Discord"><BrandIcon name="discord" /></a>
              <a className="iconbtn" href="#" aria-label="RSS"><BrandIcon name="rss" size={13} /></a>
            </div>
          </div>
          {FOOTER_COLS.map((c) => (
            <div className="ftr-col" key={c.h}>
              <h4 className="label">{c.h}</h4>
              <ul>{c.links.map(([l, href]) => <li key={l}><a href={href}>{l}</a></li>)}</ul>
            </div>
          ))}
        </div>
        <div className="ftr-base">
          <span>Apache-2.0 · hal0 v0.5.0a1 · 1.0.0-RC.3</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <a href={P_SHEET}>component sheet</a>
            <span style={{ color: "var(--fg-5)" }}>·</span>
            <a href={P_OG}>og cards</a>
            <span style={{ color: "var(--fg-5)" }}>·</span>
            <StatusDot state="ready" /> <span>all systems steady</span>
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ── shared bits used across sections ─────────────────────────── */
function Fpill({ children, on, count, ...rest }) {
  return (
    <button className={"fpill" + (on ? " on" : "")} {...rest}>
      {children}{count != null && <span className="n num">{count}</span>}
    </button>
  );
}

function Attribution({ user, first }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {first ? (
        <span className="chip amber" title="First-party run on hal0 reference hardware">first-party</span>
      ) : (
        <>
          <GhAvatar user={user} size={16} />
          <span className="mono" style={{ fontSize: 11.5, color: "var(--fg-3)" }}>@{user}</span>
        </>
      )}
    </span>
  );
}

function SubNav({ items, active }) {
  return (
    <div className="subnav">
      <div className="wrap wide subnav-in">
        {items.map((i) => {
          const [label, href] = Array.isArray(i) ? i : [i, "#"];
          return <a key={label} href={href} className={label === active ? "on" : ""}>{label}</a>;
        })}
      </div>
    </div>
  );
}

Object.assign(window, { Header, Footer, Drawer, NAV, BrandIcon, GhAvatar, ThemeToggle, Fpill, Attribution, SubNav, toggleTheme, P_HOME, P_DOCS, P_WRITE, P_BENCH, P_PROF, P_FORUM, P_SHEET, P_OG });
