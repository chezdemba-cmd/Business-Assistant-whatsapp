"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import { mobileBottomNav, isNavActive } from "@/lib/mobile-nav";

/**
 * Bottom navigation mobile (§4, §5). Visible ≤ 900 px (via .mobile-nav en CSS).
 * L'entrée centrale « FEREDRON » est l'action principale (icône micro).
 */
export function MobileNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = mobileBottomNav(role);

  return (
    <nav className="mobile-nav" aria-label="Navigation principale">
      {items.map((item) => {
        const active = isNavActive(item, pathname);
        return (
          <Link
            key={item.key}
            href={item.href}
            className={`mobile-nav__item${item.primary ? " mobile-nav__item--primary" : ""}`}
            data-active={active}
            aria-current={active ? "page" : undefined}
          >
            <span className="mobile-nav__icon" aria-hidden>
              {ICON[item.key] ?? "•"}
            </span>
            <span className="mobile-nav__label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

const ICON: Record<string, string> = {
  home: "⌂",
  conversations: "💬",
  orders: "🧾",
  feredron: "🎤",
  more: "☰",
};
