import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) redirect("/");

  return (
    <div className="min-h-dvh">
      <header className="fixed top-0 inset-x-0 z-50 glass-card rounded-none border-x-0 border-t-0 px-6 py-3 flex items-center gap-6">
        <span className="font-monotone text-base text-gold tracking-widest">ARMY</span>
        <span className="text-[10px] tracking-[0.25em] text-[color:var(--text-muted)] uppercase">admin</span>
        <nav className="flex gap-4 ml-4">
          <Link href="/admin" className="text-sm text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors">
            Dashboard
          </Link>
          <Link href="/admin/cards" className="text-sm text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors">
            Cartas
          </Link>
        </nav>
        <Link href="/" className="ml-auto text-xs text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] transition-colors">
          ← Volver al feed
        </Link>
      </header>
      <div className="max-w-5xl mx-auto px-4 pt-20 pb-10">
        {children}
      </div>
    </div>
  );
}
