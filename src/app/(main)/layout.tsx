import NavigationCard from "@/components/NavigationCard";
import EraSelector from "@/components/EraSelector";
import EventsCard from "@/components/EventsCard";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      {/* Top bar (mobile) */}
      <header className="md:hidden fixed top-0 inset-x-0 z-50 glass-card rounded-none border-x-0 border-t-0 px-4 py-3 flex items-center justify-between mb-0">
        <span className="font-monotone text-base text-gold tracking-widest">ARMY</span>
        <span className="text-[10px] tracking-[0.25em] text-[color:var(--text-muted)] uppercase">social</span>
      </header>

      <div className="flex max-w-6xl mx-auto px-4 pt-16 md:pt-10 gap-6">
        {/* Sidebar izquierdo */}
        <aside className="hidden md:flex md:flex-col w-56 shrink-0 sticky top-8 h-fit gap-3">
          <NavigationCard />
          <EraSelector />
        </aside>

        {/* Mobile nav (bottom) */}
        <div className="md:hidden fixed bottom-0 inset-x-0 z-50">
          <NavigationCard />
        </div>

        {/* Main content */}
        <main id="main-content" className="flex-1 min-w-0 pb-24 md:pb-8">
          {children}
        </main>

        {/* Sidebar derecho */}
        <aside className="hidden xl:flex xl:flex-col w-64 shrink-0 sticky top-8 h-fit gap-3">
          <EventsCard />
        </aside>
      </div>
    </div>
  );
}
