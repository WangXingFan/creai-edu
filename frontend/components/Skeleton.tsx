"use client";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`skeleton ${className}`} />;
}

export function SkeletonText({ className = "" }: SkeletonProps) {
  return <div className={`skeleton h-4 rounded ${className}`} />;
}

export function SkeletonCard({ className = "" }: SkeletonProps) {
  return (
    <div className={`card p-4 ${className}`}>
      <div className="flex items-center gap-4">
        <div className="flex-1 space-y-2.5">
          <div className="skeleton h-4 w-3/4 rounded" />
          <div className="skeleton h-3 w-1/3 rounded" />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="skeleton h-5 w-14 rounded-full" />
          <div className="skeleton h-7 w-8 rounded" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonReport() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="card p-6 space-y-4">
        <div className="flex justify-center">
          <div className="skeleton h-16 w-20 rounded-xl" />
        </div>
        <div className="skeleton h-3 w-16 mx-auto rounded" />
        <div className="space-y-2.5 pt-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="skeleton h-3 w-14 rounded" />
              <div className="flex-1 skeleton h-2 rounded" />
              <div className="skeleton h-3 w-6 rounded" />
            </div>
          ))}
        </div>
      </div>
      <div className="card p-5 space-y-3">
        <div className="skeleton h-3 w-16 rounded" />
        <div className="skeleton h-48 rounded-xl" />
      </div>
    </div>
  );
}

export function SkeletonMessage() {
  return (
    <div className="flex gap-3 p-4 rounded-2xl bg-white border border-border">
      <div className="skeleton h-9 w-9 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-24 rounded" />
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-5/6 rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
      </div>
    </div>
  );
}
