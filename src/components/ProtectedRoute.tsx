import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Music } from "lucide-react";

export const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Music className="h-10 w-10 text-primary animate-pulse" />
      </div>
    );
  }
  if (!session) return <Navigate to="/auth" replace />;
  return children;
};
