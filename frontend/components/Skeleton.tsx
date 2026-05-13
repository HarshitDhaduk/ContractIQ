"use client";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div className={`relative overflow-hidden bg-[#171c2a] rounded-md ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="p-5 rounded-xl border border-white/[0.07] bg-white/[0.025] space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="w-24 h-4" />
        <Skeleton className="w-4 h-4 rounded-full" />
      </div>
      <Skeleton className="w-16 h-8" />
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <tr className="border-b border-white/[0.04]">
      <td className="px-4 py-4"><Skeleton className="w-20 h-4" /></td>
      <td className="px-4 py-4"><Skeleton className="w-12 h-4" /></td>
      <td className="px-4 py-4"><Skeleton className="w-24 h-4 rounded-full" /></td>
      <td className="px-4 py-4"><Skeleton className="w-32 h-4" /></td>
    </tr>
  );
}

export function LayoutSkeleton() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-100 flex">
      {/* Sidebar Skeleton */}
      <div className="w-[220px] min-h-screen border-r border-white/[0.06] bg-[#0a0f1e]/50 p-6 flex flex-col gap-6 fixed left-0 top-0">
        <Skeleton className="w-32 h-6 mb-4" />
        <div className="space-y-2">
          <Skeleton className="w-full h-10 rounded-lg" />
          <Skeleton className="w-full h-10 rounded-lg" />
          <Skeleton className="w-full h-10 rounded-lg" />
          <Skeleton className="w-full h-10 rounded-lg" />
        </div>
        <div className="mt-auto">
          <Skeleton className="w-full h-12 rounded-lg" />
        </div>
      </div>
      
      {/* Main Content Skeleton */}
      <main className="ml-[220px] min-h-screen w-full">
        <div className="p-8">
          <div className="mb-8 space-y-2">
            <Skeleton className="w-64 h-8" />
            <Skeleton className="w-96 h-4" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <div className="space-y-4">
            <Skeleton className="w-full h-32 rounded-xl" />
            <Skeleton className="w-full h-64 rounded-xl" />
          </div>
        </div>
      </main>
    </div>
  );
}

export function ContractSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="w-48 h-8" />
          <Skeleton className="w-32 h-4" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,380px] gap-6">
        <div className="space-y-6">
          <Skeleton className="w-full h-32 rounded-xl" />
          <Skeleton className="w-full h-[500px] rounded-xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="w-full h-64 rounded-xl" />
          <Skeleton className="w-full h-48 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function PlaybookSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-white/[0.04]">
          <Skeleton className="w-9 h-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="w-48 h-4" />
            <Skeleton className="w-32 h-3" />
          </div>
          <Skeleton className="w-16 h-3" />
        </div>
      ))}
    </div>
  );
}


