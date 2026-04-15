type AvatarSize = "sm" | "md" | "lg";

interface AvatarProps {
  url?: string;
  size?: AvatarSize;
}

const sizeMap: Record<AvatarSize, string> = {
  sm: "w-10",
  md: "w-12",
  lg: "w-20",
};

const Avatar = ({ url, size }: AvatarProps) => {
  const src = url || "https://via.placeholder.com/50x50";
  const sizeClass = size ? sizeMap[size] : "w-20";

  return (
    <div className="rounded-full overflow-hidden flex cursor-pointer">
      <img src={src} alt="avatar" className={sizeClass} />
    </div>
  );
};

export default Avatar;
