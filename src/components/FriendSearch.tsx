import { useState, useEffect, useRef } from "react";
import { Command } from "cmdk";
import { supabase } from "@/lib/supabase/browser";
import { useAuthStore } from "@/store/useAuthStore";
import type { TaggedFriend } from "@/types";

interface FriendSelectorProps {
  onSelect: (friends: TaggedFriend[]) => void;
  selectedFriends: TaggedFriend[];
  setSelectedFriends: React.Dispatch<React.SetStateAction<TaggedFriend[]>>;
}

const FriendSelector = ({
  onSelect,
  selectedFriends,
  setSelectedFriends,
}: FriendSelectorProps) => {
  const { session } = useAuthStore();
  const [options, setOptions] = useState<TaggedFriend[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session?.user?.id) return;

    async function fetchFriends() {
      const { data: profiles, error } = await supabase.from("profiles").select("*");
      if (error) return;

      const { data: friends } = await supabase
        .from("friends")
        .select("friend_id")
        .eq("user_id", session!.user.id);

      const friendOptions: TaggedFriend[] = (profiles ?? [])
        .filter((p: { id: string }) =>
          (friends ?? []).some((f: { friend_id: string }) => f.friend_id === p.id)
        )
        .map((p: { id: string; name: string }) => ({ label: p.name, value: p.id }));

      setOptions(friendOptions);
    }

    fetchFriends();
  }, [session?.user?.id]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(inputValue.toLowerCase()) &&
      !selectedFriends.some((f) => f.value === opt.value)
  );

  function handleSelect(friend: TaggedFriend) {
    const next = [...selectedFriends, friend];
    setSelectedFriends(next);
    onSelect(next);
    setInputValue("");
    setOpen(false);
  }

  function handleRemove(friend: TaggedFriend) {
    const next = selectedFriends.filter((f) => f.value !== friend.value);
    setSelectedFriends(next);
    onSelect(next);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <Command shouldFilter={false}>
        <div className="army-input flex items-center px-3 py-2 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-[color:var(--text-muted)] shrink-0 mr-2">
            <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clipRule="evenodd" />
          </svg>
          <Command.Input
            className="flex-1 text-sm outline-none bg-transparent text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)]"
            placeholder="Buscar amigos..."
            value={inputValue}
            onValueChange={(val) => { setInputValue(val); setOpen(true); }}
            onFocus={() => setOpen(true)}
          />
        </div>

        {open && filtered.length > 0 && (
          <Command.List className="absolute z-50 mt-1 w-full glass-card py-1 max-h-48 overflow-y-auto">
            {filtered.map((friend) => (
              <Command.Item
                key={friend.value}
                value={friend.label}
                className="px-3 py-2.5 text-sm cursor-pointer text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-white/5 outline-none transition-colors"
                onSelect={() => handleSelect(friend)}
              >
                {friend.label}
              </Command.Item>
            ))}
          </Command.List>
        )}
      </Command>

      {selectedFriends.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedFriends.map((friend) => (
            <span
              key={friend.value}
              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
              style={{
                background: "var(--accent-glow)",
                color: "var(--accent-hover)",
                border: "1px solid var(--glass-border)",
              }}
            >
              {friend.label}
              <button
                type="button"
                onClick={() => handleRemove(friend)}
                className="hover:opacity-70 leading-none ml-0.5"
                aria-label={`Quitar ${friend.label}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default FriendSelector;
