import type { Metadata } from "next";
import { CompanyList } from "@/components/companies/company-list";

export const metadata: Metadata = {
  title: "Companies — BridgeGen",
  description: "Your saved client companies.",
};

export default function CompaniesPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 md:px-8 md:py-14">
      <header className="mb-8 grid gap-2">
        <p className="font-mono text-xs uppercase tracking-widest text-metric">Companies</p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-white md:text-3xl">
          Client companies
        </h1>
      </header>
      <CompanyList />
    </main>
  );
}
