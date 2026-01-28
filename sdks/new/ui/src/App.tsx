import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { MintPage } from "./pages/MintPage";
import { SwapPage } from "./pages/SwapPage";

// Root layout
const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-background dark">
      <Outlet />
    </div>
  ),
});

// Routes
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: MintPage,
});

const mintRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/mint",
  component: MintPage,
});

const swapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/swap",
  component: SwapPage,
});

// Route tree
const routeTree = rootRoute.addChildren([indexRoute, mintRoute, swapRoute]);

// Router instance
const router = createRouter({ routeTree });

// Type registration for TypeScript
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function App() {
  return <RouterProvider router={router} />;
}
