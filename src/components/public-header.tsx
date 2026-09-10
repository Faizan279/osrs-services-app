"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, Search, ShoppingCart, UserRound, X } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

const destinations = [
  ["Home", "/"],
  ["Skills", "/skills"],
  ["Bossing", "/bossing"],
  ["Infernal", "/infernal"],
  ["Quests", "/quests"],
  ["Diaries", "/diaries"],
  ["Gold", "/gold"],
  ["Items", "/products"],
  ["Accounts", "/accounts"],
  ["Misc", "/misc-gathering"],
] as const;

export function PublicHeader({ discordHref }: { discordHref: string }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    const menuButton = menuRef.current;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
      if (event.key !== "Tab") return;
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(
        "a[href],button:not([disabled])",
      );
      if (!nodes?.length) return;
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", keyboard);
      menuButton?.focus();
    };
  }, [mobileOpen]);
  const matches = destinations.filter(([name]) =>
    name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <header className="reference-header">
      <Link
        href="/"
        aria-label="OSRS Services home"
        className="reference-brand"
      >
        <BrandLogo priority forceRed />
        <span>YOUR OSRS BOOSTING PARTNER</span>
      </Link>
      <nav className="reference-nav" aria-label="Main navigation">
        {destinations.map(([name, href]) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
          >
            {name}
          </Link>
        ))}
      </nav>
      <div
        className="reference-header-search"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setSearchOpen(false);
        }}
      >
        <Search size={19} aria-hidden="true" />
        <input
          aria-label="Search services"
          placeholder="Search services..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setSearchOpen(false);
          }}
        />
        {searchOpen && search && (
          <div
            className="reference-search-results"
            onMouseDown={(e) => e.preventDefault()}
          >
            {matches.length ? (
              matches.map(([name, href]) => (
                <Link
                  href={href}
                  key={href}
                  onClick={() => {
                    setSearch("");
                    setSearchOpen(false);
                  }}
                >
                  {name}
                </Link>
              ))
            ) : (
              <p>No services found.</p>
            )}
          </div>
        )}
      </div>
      <Link href="/cart" aria-label="Cart" className="reference-header-icon">
        <ShoppingCart />
      </Link>
      <Link
        href="/account/login"
        aria-label="Sign in"
        className="reference-header-icon"
      >
        <UserRound />
      </Link>
      <button
        ref={menuRef}
        className="reference-menu-button"
        type="button"
        aria-label="Open mobile navigation"
        aria-expanded={mobileOpen}
        aria-controls="mobile-navigation-panel"
        onClick={() => setMobileOpen(true)}
      >
        <Menu />
      </button>
      {mobileOpen && (
        <div className="reference-mobile-overlay">
          <button
            className="reference-mobile-backdrop"
            aria-label="Close navigation backdrop"
            onClick={() => setMobileOpen(false)}
          />
          <div
            ref={panelRef}
            className="reference-mobile-panel"
            id="mobile-navigation-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
          >
            <button
              aria-label="Close mobile navigation"
              onClick={() => setMobileOpen(false)}
            >
              <X />
            </button>
            <nav>
              {destinations.map(([name, href]) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={pathname === href ? "page" : undefined}
                  onClick={() => setMobileOpen(false)}
                >
                  {name}
                </Link>
              ))}
              <Link href={discordHref} onClick={() => setMobileOpen(false)}>
                Contact support
              </Link>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
