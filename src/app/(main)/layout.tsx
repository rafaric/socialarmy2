import NavigationCard from "@/components/NavigationCard";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="md:flex md:pl-4 mt-16 w-full md:max-w-6xl md:gap-7">
      <aside className="md:w-60 w-[100vw] sticky top-0 z-1">
        <NavigationCard />
      </aside>
      <main className="mx-auto md:w-[1000px]">{children}</main>
    </div>
  );
}