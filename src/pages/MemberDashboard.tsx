import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import PersonCard from "@/components/PersonCard";
import { Button } from "@/components/ui/button";
import { LogOut, Church } from "lucide-react";

interface AssignedPerson {
  id: string;
  name: string;
  phone: string;
  gender: string;
  last_attendance_date: string | null;
}

export default function MemberDashboard() {
  const { user, profile, signOut } = useAuth();
  const [people, setPeople] = useState<AssignedPerson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAssignments = async () => {
      if (!user) return;
      // Get current week start (Monday)
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const weekStart = new Date(now.setDate(diff));
      const weekStartStr = weekStart.toISOString().split("T")[0];

      const { data } = await supabase
        .from("weekly_assignments")
        .select("person_id, people(id, name, phone, gender, last_attendance_date)")
        .eq("servant_id", user.id)
        .eq("week_start_date", weekStartStr);

      if (data) {
        const assigned = data
          .map((d: any) => d.people)
          .filter(Boolean) as AssignedPerson[];
        setPeople(assigned);
      }
      setLoading(false);
    };
    fetchAssignments();
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Church className="h-6 w-6 text-primary" />
            <h1 className="font-bold text-lg text-foreground">Follow-Up</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{profile?.name}</span>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        <h2 className="text-xl font-semibold mb-4 text-foreground">Your Assignments This Week</h2>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : people.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No assignments for this week.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {people.map((p) => (
              <PersonCard
                key={p.id}
                name={p.name}
                phone={p.phone}
                gender={p.gender}
                lastAttendanceDate={p.last_attendance_date}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
