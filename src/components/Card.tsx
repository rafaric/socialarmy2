interface CardProps {
  children: React.ReactNode;
  noPadding?: boolean;
  type?: string;
  className?: string;
}

function Card({ children, noPadding, type, className = "" }: CardProps) {
  let base = "glass-card mb-5";

  if (!noPadding) {
    base += " py-4 md:px-8 px-5";
  }

  if (type) {
    base += " flex flex-col justify-around h-fit py-12 items-center gap-8 w-[80%] my-3 mx-auto";
  }

  return <div className={`${base} ${className}`}>{children}</div>;
}

export default Card;
