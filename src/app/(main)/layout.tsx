import NavigationCard from "@/components/NavigationCard";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      {/* Top bar (mobile) */}
      <header className="md:hidden fixed top-0 inset-x-0 z-50 glass-card rounded-none border-x-0 border-t-0 px-4 py-3 flex items-center justify-between mb-0">
        <span className="font-monotone text-base text-gold tracking-widest">ARMY</span>
        <span className="text-[10px] tracking-[0.25em] text-[color:var(--text-muted)] uppercase">social</span>
      </header>

      <div className="flex max-w-6xl mx-auto px-4 pt-16 md:pt-10 gap-6">
        {/* Sidebar */}
        <aside className="hidden md:block w-56 shrink-0 sticky top-8 h-fit">
          <NavigationCard />
        </aside>

        {/* Mobile nav (bottom) */}
        <div className="md:hidden fixed bottom-0 inset-x-0 z-50">
          <NavigationCard />
        </div>

        {/* Main content */}
        <main className="flex-1 min-w-0 pb-24 md:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
