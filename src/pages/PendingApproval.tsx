import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Church, Clock, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function PendingApproval() {
  const { signOut, profile } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <Church className="mx-auto h-10 w-10 text-primary" />
          <CardTitle className="text-2xl">Account Pending</CardTitle>
          <CardDescription>
            Welcome{profile?.name ? `, ${profile.name}` : ""}! Your account is pending admin approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Clock className="h-5 w-5" />
            <p className="text-sm">Please wait for an administrator to approve your account.</p>
          </div>
          <Button variant="outline" className="w-full" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
