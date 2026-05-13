"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Upload, Briefcase, BookOpen,
  ShieldCheck, LogOut, Settings,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const NAV = [
  { href: "/dashboard",           icon: LayoutDashboard, label: "Overview" },
  { href: "/dashboard/upload",    icon: Upload,          label: "Upload" },
  { href: "/dashboard/jobs",      icon: Briefcase,       label: "Jobs" },
  { href: "/dashboard/playbooks", icon: BookOpen,        label: "Playbooks" },
  { href: "/dashboard/settings",  icon: Settings,        label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside
      className="fixed top-0 left-0 h-screen w-[220px] flex flex-col border-r border-white/[0.06] z-40"
      style={{ background: "#0a0f1e" }}
    >
      {/* Logo */}
      <Link href="/" className="h-[64px] flex items-center px-5 border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors">
        <div className="flex items-center gap-2 font-semibold text-[15px] tracking-tight">
          <ShieldCheck className="w-5 h-5 text-blue-400" />
          ContractIQ
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                active
                  ? "bg-blue-600/20 text-blue-300 font-medium"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-blue-600/30 flex items-center justify-center text-xs font-semibold text-blue-300 shrink-0">
            {user?.displayName?.[0] ?? user?.email?.[0] ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-200 truncate">{user?.displayName ?? "User"}</p>
            <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-all duration-150"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
