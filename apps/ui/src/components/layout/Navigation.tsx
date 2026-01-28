import { cn } from "@/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";

const navItems = [
  { path: "/mint" as const, label: "Mint" },
  { path: "/swap" as const, label: "Swap" },
];

export function Navigation() {
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  return (
    <nav className="flex items-center gap-1">
      {navItems.map((item) => {
        const isActive =
          pathname === item.path || (item.path === "/mint" && pathname === "/");

        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
