"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard, Upload, Briefcase, BookOpen, Settings, LogOut, Shield,
} from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getReviewQueue } from "@/lib/api";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/upload", label: "Upload", icon: Upload },
  { href: "/dashboard/jobs", label: "Jobs", icon: Briefcase },
  { href: "/dashboard/playbooks", label: "Playbooks", icon: BookOpen },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout, idToken } = useAuth();

  const { data: queue } = useQuery({
    queryKey: ["review-queue"],
    queryFn: () => getReviewQueue(idToken),
    refetchInterval: 15000,
    enabled: !!idToken,
  });

  const pendingCount = queue?.total ?? 0;

  return (
    <nav className="w-60 shrink-0 flex flex-col border-r border-white/8 bg-[rgb(13,13,20)]">
      {/* Logo */}
      <div className="p-5 border-b border-white/8">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white text-lg tracking-tight">ContractIQ</span>
        </div>
      </div>

      {/* HITL Review Queue badge */}
      {pendingCount > 0 && (
        <Link href="/dashboard/jobs" className="mx-3 mt-3">
          <motion.div
            animate={{ opacity: [1, 0.7, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-300 text-sm"
          >
            <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
            <span className="font-semibold">{pendingCount} awaiting review</span>
          </motion.div>
        </Link>
      )}

      {/* Nav items */}
      <div className="flex-1 p-3 space-y-1 mt-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href}>
              <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}>
                <Icon className="w-4 h-4" />
                {label}
              </div>
            </Link>
          );
        })}
      </div>

      {/* User */}
      <div className="p-3 border-t border-white/8">
        <div className="flex items-center gap-2.5 px-2 mb-2">
          {user?.photoURL && (
            <img src={user.photoURL} className="w-7 h-7 rounded-full" alt="avatar" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{user?.displayName}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </nav>
  );
}
