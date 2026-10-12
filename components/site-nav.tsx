"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/simulator", label: "Simulator" },
  { href: "/governance", label: "Governance" },
];

function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <ul className="flex items-center gap-1">
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname?.startsWith(`${link.href}/`);
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors hover:text-foreground",
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
        <Link href="/" className="font-mono text-xs uppercase tracking-widest text-metric">
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
