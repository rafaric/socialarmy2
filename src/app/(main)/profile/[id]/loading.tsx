export default function ProfileLoading() {
  return (
    <div className="glass-card overflow-hidden mb-5 animate-pulse" aria-busy="true" aria-label="Cargando perfil">
      {/* Cover */}
      <div className="h-44 md:h-56 bg-white/5" />

      {/* Avatar + name */}
      <div className="px-6 pb-6">
        <div className="flex items-end gap-4 -mt-10 mb-4">
          <div className="w-20 h-20 rounded-full bg-white/10 ring-4 ring-[var(--bg-surface)] shrink-0" />
          <div className="flex-1 space-y-2 pb-1">
            <div className="h-4 bg-white/10 rounded w-40" />
            <div className="h-3 bg-white/5 rounded w-24" />
          </div>
        </div>

        {/* Tabs skeleton */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-white/5 rounded-lg w-20" />
          ))}
        </div>

        {/* Content skeleton */}
        <div className="space-y-3">
          <div className="h-3 bg-white/10 rounded w-3/4" />
          <div className="h-3 bg-white/5 rounded w-1/2" />
          <div className="h-3 bg-white/5 rounded w-2/3" />
        </div>
      </div>
    </div>
  );
}
