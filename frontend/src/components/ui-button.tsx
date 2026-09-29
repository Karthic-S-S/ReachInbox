import { type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "soft";
  size?: "default" | "icon";
};

export function Button({
  className,
  variant = "primary",
  size = "default",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        size === "icon" ? "size-10 rounded-md" : "h-11 rounded-full px-5",
        variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary-hover",
        variant === "outline" &&
          "border border-primary bg-background text-primary hover:bg-primary-soft",
        variant === "ghost" && "text-muted-foreground hover:bg-muted hover:text-foreground",
        variant === "soft" && "bg-primary-soft text-foreground hover:bg-primary-soft-strong",
        className,
      )}
      {...props}
    />
  );
}
