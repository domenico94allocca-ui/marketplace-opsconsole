import Link from "next/link";

export function Sidebar({ email }: { email: string }) {
  const items = [
    { href: "/", label: "Dashboard" },
    { href: "/project", label: "Progetto" },
    { href: "/infra", label: "Infrastruttura" },
    { href: "/database", label: "Database" },
    { href: "/releases", label: "Codice & Release" },
    { href: "/backups", label: "Backup & Log" },
    { href: "/work", label: "Roadmap & Docs" },
  ];
  return (
    <aside className="w-64 bg-neutral-900 border-r border-neutral-800 p-5 flex flex-col">
      <div className="mb-8">
        <div className="text-xs text-neutral-500">BacoliOnLife</div>
        <div className="text-lg font-semibold text-brand-light">OpsConsole</div>
      </div>
      <nav className="flex flex-col gap-1">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className="px-3 py-2 rounded-md hover:bg-neutral-800 text-sm">{i.label}</Link>
        ))}
      </nav>
      <div className="mt-auto text-xs text-neutral-500 pt-4 border-t border-neutral-800">
        <div className="truncate" title={email}>{email}</div>
        <form action="/api/auth/logout" method="POST" className="mt-2">
          <button className="text-neutral-400 hover:text-err" type="submit">Esci</button>
        </form>
      </div>
    </aside>
  );
}
