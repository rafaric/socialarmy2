import Image from "next/image";

type AvatarSize = "sm" | "md" | "lg";

interface AvatarProps {
  url?: string | null;
  size?: AvatarSize;
  ring?: boolean;
}

const sizeMap: Record<AvatarSize, { wrapper: string; ring: string; px: number }> = {
  sm: { wrapper: "w-9 h-9",   ring: "p-[2px]", px: 36  },
  md: { wrapper: "w-11 h-11", ring: "p-[2px]", px: 44  },
  lg: { wrapper: "w-20 h-20", ring: "p-[3px]", px: 80  },
};

function Placeholder({ className }: { className: string }) {
  return (
    <div
      className={`${className} flex items-center justify-center`}
      style={{ background: "linear-gradient(135deg, var(--accent), var(--bg-surface))" }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-1/2 h-1/2 text-white/60" aria-hidden="true" focusable="false">
        <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
      </svg>
    </div>
  );
}

const Avatar = ({ url, size = "lg", ring = false }: AvatarProps) => {
  const s = sizeMap[size];

  const inner = url ? (
    <Image
      src={url}
      alt="avatar"
      width={s.px}
      height={s.px}
      className={`${s.wrapper} object-cover rounded-full`}
      sizes={`${s.px}px`}
    />
  ) : (
    <Placeholder className={`${s.wrapper} rounded-full`} />
  );

  if (ring) {
    return (
      <div
        className={`rounded-full shrink-0 ${s.ring}`}
        style={{
          background: "linear-gradient(135deg, var(--accent), var(--accent-gold))",
          boxShadow: "0 0 12px var(--accent-glow)",
        }}
      >
        <div className="rounded-full overflow-hidden bg-[var(--bg-deep)]">
          {inner}
        </div>
      </div>
    );
  }

  return <div className={`rounded-full overflow-hidden shrink-0 ${s.wrapper}`}>{inner}</div>;
};

export default Avatar;
