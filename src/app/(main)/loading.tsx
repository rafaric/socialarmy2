export default function MainLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando contenido">
      {[1, 2, 3].map((i) => (
        <div key={i} className="glass-card p-5 animate-pulse">
          {/* Header skeleton */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-white/10 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-white/10 rounded w-1/3" />
              <div className="h-2 bg-white/5 rounded w-1/4" />
            </div>
          </div>
          {/* Content skeleton */}
          <div className="space-y-2 mb-4">
            <div className="h-3 bg-white/10 rounded w-full" />
            <div className="h-3 bg-white/10 rounded w-5/6" />
            <div className="h-3 bg-white/10 rounded w-4/6" />
          </div>
          {/* Actions skeleton */}
          <div className="flex gap-3 pt-3 border-t border-white/5">
            <div className="h-7 bg-white/5 rounded-lg w-16" />
            <div className="h-7 bg-white/5 rounded-lg w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
