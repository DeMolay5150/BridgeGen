"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/simulator", label: "Simulator" },
  { href: "/governance", label: "Governance" },
  { href: "/fork", label: "Fork the Future" },
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
              {link.label}
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
        {/* usePathname suspends on routes with unknown dynamic params under Cache Components. */}
        <Suspense fallback={<NavLinks pathname={null} />}>
          <ActiveNavLinks />
        </Suspense>
      </nav>
    </header>
  );
}
