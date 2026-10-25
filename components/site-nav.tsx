"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountMenu } from "@/components/auth/account-menu";
import { cn } from "@/lib/utils";

/** `short` replaces the label below the md breakpoint so the bar fits a phone. */
/** `hideOnPhone` drops a link below the sm breakpoint when it's reachable elsewhere (the landing page). */
const LINKS: { href: string; label: string; short?: string; hideOnPhone?: boolean }[] = [
  { href: "/simulator", label: "Simulator" },
  { href: "/governance", label: "Governance" },
  { href: "/fork", label: "Fork the Future", short: "Fork" },
  { href: "/room", label: "Decision Room", short: "Room" },
  { href: "/red-team", label: "Red Team" },
  { href: "/pricing", label: "Pricing", hideOnPhone: true },
];

function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    // On phones the row scrolls; the fade at the right edge says there's more.
    <ul className="flex min-w-0 items-center gap-0.5 overflow-x-auto [mask-image:linear-gradient(to_right,black_85%,transparent)] sm:gap-1 md:[mask-image:none]">
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname?.startsWith(`${link.href}/`);
        return (
          <li key={link.href} className={cn(link.hideOnPhone && "hidden sm:block")}>
            <Link
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "block whitespace-nowrap rounded-md px-2 py-1.5 text-sm transition-colors hover:text-foreground sm:px-3",
                active
                  ? "bg-muted font-medium text-foreground shadow-[inset_0_-2px_0_var(--metric)]"
                  : "text-muted-foreground",
              )}
            >
              {link.short ? (
                <>
                  <span className="md:hidden">{link.short}</span>
                  <span className="hidden md:inline">{link.label}</span>
                </>
              ) : (
                link.label
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ActiveNavLinks() {
  return <NavLinks pathname={usePathname()} />;
}

export function SiteNav() {
  return (
    <header className="border-b border-border">
      <nav
        aria-label="Main"
        className="mx-auto flex min-h-14 w-full max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 md:h-14 md:flex-nowrap md:py-0 md:px-8"
      >
        <Link href="/" className="shrink-0 font-mono text-xs uppercase tracking-widest text-metric">
          BridgeGen
        </Link>
        {/* Phones: the links get a full-width row of their own under the logo and account menu. */}
        <div className="order-last flex w-full min-w-0 md:order-none md:w-auto md:flex-1 md:justify-end">
          {/* usePathname suspends on routes with unknown dynamic params under Cache Components. */}
          <Suspense fallback={<NavLinks pathname={null} />}>
            <ActiveNavLinks />
          </Suspense>
        </div>
        <AccountMenu />
      </nav>
    </header>
  );
}
