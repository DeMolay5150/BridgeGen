"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountMenu } from "@/components/auth/account-menu";
import { cn } from "@/lib/utils";

/** `short` replaces the label below the md breakpoint so the bar fits a phone. */
const LINKS: { href: string; label: string; short?: string }[] = [
  { href: "/simulator", label: "Simulator" },
  { href: "/governance", label: "Governance" },
  { href: "/fork", label: "Fork the Future", short: "Fork" },
  { href: "/room", label: "Decision Room", short: "Room" },
  { href: "/red-team", label: "Red Team" },
  { href: "/pricing", label: "Pricing" },
];

function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <ul className="-mr-2 flex min-w-0 items-center gap-0.5 overflow-x-auto sm:mr-0 sm:gap-1">
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname?.startsWith(`${link.href}/`);
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "block whitespace-nowrap rounded-md px-2 py-1.5 text-sm transition-colors hover:text-foreground sm:px-3",
                active ? "bg-muted text-foreground" : "text-muted-foreground",
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
        className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-4 md:px-8"
      >
        <Link href="/" className="shrink-0 font-mono text-xs uppercase tracking-widest text-metric">
          BridgeGen
        </Link>
        <div className="flex min-w-0 flex-1 justify-end">
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
