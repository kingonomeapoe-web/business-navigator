import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { whoAmI } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    try {
      const identity = await whoAmI();
      if (!identity.isAdmin) throw redirect({ to: "/portal" });
      return { adminRole: identity.role };
    } catch (error) {
      if (error && typeof error === "object" && "to" in error) throw error;
      throw redirect({ to: "/portal" });
    }
  },
  component: () => <Outlet />,
});
