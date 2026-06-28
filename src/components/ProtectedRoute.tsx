import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export const ProtectedRoute = ({ children, requireAdmin = false }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  const roles = useUserRoles();
  const rolesLoading = requireAdmin ? !!roles.loading : false;
  const isAdmin = requireAdmin ? !!roles.isAdmin : true;

  const isCallRoute = location.pathname === "/call";

  // Still loading auth (or roles when admin-only)
  if (loading || rolesLoading) {
    // For calls, avoid flashing gray/white
    if (isCallRoute) {
      return <div className="fixed inset-0 bg-black" />;
    }

    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Not signed in
  if (!user) {
    const from = location.pathname + location.search + location.hash;
    return <Navigate to="/auth" replace state={{ from }} />;
  }

  // Signed in, but admin required and not admin
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};