import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import PersonCard from "@/components/PersonCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { LogOut, Church, CheckCircle2, Circle, ListChecks } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AssignedPerson {
  id: string;
  name: string;
  phone: string;
  gender: string;
  last_attendance_date: string | null;
}

interface Assignment {
  id: string;
  completed: boolean;
  completed_at: string | null;
  person: AssignedPerson;
}

function getWeekStartStr(): string {
  const today = new Date();
  const day = today.getDay();
  const diff = (day + 1) % 7;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - diff);
  return weekStart.toISOString().split("T")[0];
}

export default function MemberDashboard() {
  const { user, profile, signOut } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssignments = useCallback(async () => {
    if (!user) return;
    const weekStartStr = getWeekStartStr();
    console.log("[MemberDashboard] auth.uid:", user.id, "weekStartStr:", weekStartStr);

    const { data } = await supabase
      .from("weekly_assignments")
      .select("id, completed, completed_at, person_id, people(id, name, phone, gender, last_attendance_date)")
      .eq("servant_id", user.id)
      .eq("week_start_date", weekStartStr);

    if (data) {
      const mapped: Assignment[] = data
        .filter((d: any) => d.people)
        .map((d: any) => ({
          id: d.id,
          completed: d.completed,
          completed_at: d.completed_at,
          person: d.people as AssignedPerson,
        }));
      setAssignments(mapped);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const markCompleted = async (assignmentId: string) => {
    const { error } = await supabase
      .from("weekly_assignments")
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq("id", assignmentId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Marked as completed ✓",
      description: "You can undo this within 60 seconds.",
      action: (
        <Button variant="outline" size="sm" onClick={() => undoCompleted(assignmentId)}>
          Undo
        </Button>
      ),
    });
    fetchAssignments();
  };

  const undoCompleted = async (assignmentId: string) => {
    const { error } = await supabase
      .from("weekly_assignments")
      .update({ completed: false, completed_at: null })
      .eq("id", assignmentId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Completion undone" });
    fetchAssignments();
  };

  const total = assignments.length;
  const completedCount = assignments.filter((a) => a.completed).length;
  const remaining = total - completedCount;
  const progressPct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

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

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Progress Section */}
        {!loading && total > 0 && (
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-foreground">Weekly Progress</h2>
            </div>
            <Progress value={progressPct} className="h-3" />
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Total: <strong className="text-foreground">{total}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                <span className="text-muted-foreground">Done: <strong className="text-green-600">{completedCount}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Circle className="h-3.5 w-3.5 text-orange-500" />
                <span className="text-muted-foreground">Remaining: <strong className="text-orange-500">{remaining}</strong></span>
              </div>
            </div>
          </div>
        )}

        <h2 className="text-xl font-semibold text-foreground">Your Assignments This Week</h2>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : assignments.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No assignments for this week.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {assignments.map((a) => (
              <div key={a.id} className={`relative ${a.completed ? "opacity-75" : ""}`}>
                {a.completed && (
                  <Badge className="absolute top-2 right-2 z-10 bg-green-600 text-white border-0">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Done
                  </Badge>
                )}
                <PersonCard
                  name={a.person.name}
                  phone={a.person.phone}
                  gender={a.person.gender}
                  lastAttendanceDate={a.person.last_attendance_date}
                />
                {!a.completed ? (
                  <Button
                    variant="outline"
                    className="w-full mt-2 border-green-600 text-green-600 hover:bg-green-600 hover:text-white"
                    onClick={() => markCompleted(a.id)}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Mark as Completed
                  </Button>
                ) : a.completed_at && (Date.now() - new Date(a.completed_at).getTime()) < 60_000 ? (
                  <Button
                    variant="outline"
                    className="w-full mt-2 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
                    onClick={() => undoCompleted(a.id)}
                  >
                    Undo
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
