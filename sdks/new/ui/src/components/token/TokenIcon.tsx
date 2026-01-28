import { cn } from "@/lib/utils";

interface TokenIconProps {
  symbol: string;
  logoURI?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-5 h-5 text-xs",
  md: "w-8 h-8 text-sm",
  lg: "w-10 h-10 text-base",
};

export function TokenIcon({
  symbol,
  logoURI,
  size = "md",
  className,
}: TokenIconProps) {
  if (logoURI) {
    return (
      <img
        src={logoURI}
        alt={symbol}
        className={cn("rounded-full", sizeClasses[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full bg-muted flex items-center justify-center font-medium",
        sizeClasses[size],
        className
      )}
    >
      {symbol.slice(0, 2)}
    </div>
  );
}
