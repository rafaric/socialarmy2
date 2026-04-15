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
    const filtered = selectedFriends.filter((f) => f.value !== friend.value);
    setSelectedFriends(filtered);
    onSelect(filtered);
  }

  return (
    <div ref={containerRef} className="relative w-52">
      <Command shouldFilter={false}>
        <div className="flex items-center border border-gray-300 rounded-md px-2 py-1 bg-white focus-within:ring-2 focus-within:ring-purple-400">
          <Command.Input
            className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
            placeholder="Buscar amigos..."
            value={inputValue}
            onValueChange={(val) => {
              setInputValue(val);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
        </div>

        {open && filtered.length > 0 && (
          <Command.List className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-md max-h-48 overflow-y-auto">
            {filtered.map((friend) => (
              <Command.Item
                key={friend.value}
                value={friend.label}
                className="px-3 py-2 text-sm cursor-pointer hover:bg-purple-50 hover:text-purple-700"
                onSelect={() => handleSelect(friend)}
              >
                {friend.label}
              </Command.Item>
            ))}
          </Command.List>
        )}
      </Command>

      {/* Selected tags */}
      {selectedFriends.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedFriends.map((friend) => (
            <span
              key={friend.value}
              className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-xs font-medium px-2 py-0.5 rounded-full"
            >
              {friend.label}
              <button
                type="button"
                onClick={() => handleRemove(friend)}
                className="hover:text-purple-900 leading-none"
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
