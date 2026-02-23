import { useAuth } from "@/hooks/useAuth";
import AdminDashboard from "./AdminDashboard";
import MemberDashboard from "./MemberDashboard";
import PendingApproval from "./PendingApproval";

export default function Index() {
  const { role, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // If not approved, show pending page
  if (!profile?.approved) {
    return <PendingApproval />;
  }

  if (role === "admin") return <AdminDashboard />;
  return <MemberDashboard />;
}
