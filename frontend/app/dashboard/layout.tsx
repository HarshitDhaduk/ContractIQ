"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { LayoutSkeleton } from "@/components/Skeleton";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [user, loading, router]);

  if (loading || !user) {
    return <LayoutSkeleton />;
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-100">
      <Sidebar />
      <main className="ml-[220px] min-h-screen">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
