import Link from "next/link";
import { logout } from "@/app/login/actions";

const links = [
  { href: "/", label: "Quarters" },
  { href: "/publishers", label: "Publishers" },
  { href: "/mappings", label: "Publisher Mapping" },
  { href: "/sources", label: "Sources" },
  { href: "/prices", label: "Prices" },
  { href: "/normalisation", label: "Normalisation" },
  { href: "/analytics", label: "Analytics" },
  { href: "/email", label: "Email" },
];

export function Nav() {
  return (
    <nav className="border-b border-neutral-200 bg-white">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-neutral-900">Meeple Design</span>
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-neutral-600 hover:text-neutral-900">
              {l.label}
            </Link>
          ))}
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm text-neutral-500 hover:text-neutral-900">
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}
