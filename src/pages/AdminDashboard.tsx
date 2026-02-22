import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  LogOut, Church, Plus, Pencil, Trash2, Search, CheckCircle, Shuffle,
  Users, UserCheck, UserX,
} from "lucide-react";

interface Person {
  id: string;
  name: string;
  phone: string;
  gender: string;
  last_attendance_date: string | null;
}

export default function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const { toast } = useToast();
  const [people, setPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPerson, setEditPerson] = useState<Person | null>(null);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formGender, setFormGender] = useState<"male" | "female">("male");
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Stats
  const [stats, setStats] = useState({ total: 0, presentThisWeek: 0, absentThisWeek: 0, absent1w: 0, absent3w: 0 });

  const fetchPeople = useCallback(async () => {
    const { data } = await supabase.from("people").select("*").order("name");
    if (data) setPeople(data);
    setLoading(false);
  }, []);

  const computeStats = useCallback(async () => {
    const { data: allPeople } = await supabase.from("people").select("id, last_attendance_date");
    if (!allPeople) return;

    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
    const weekStartStr = weekStart.toISOString().split("T")[0];

    const { data: attendanceThisWeek } = await supabase
      .from("attendance")
      .select("person_id")
      .gte("date", weekStartStr);

    const presentIds = new Set((attendanceThisWeek || []).map((a) => a.person_id));
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(today.getDate() - 7);
    const threeWeeksAgo = new Date(today);
    threeWeeksAgo.setDate(today.getDate() - 21);

    let absent1w = 0;
    let absent3w = 0;
    for (const p of allPeople) {
      if (!p.last_attendance_date) {
        absent3w++;
        absent1w++;
      } else {
        const d = new Date(p.last_attendance_date);
        if (d < threeWeeksAgo) absent3w++;
        else if (d < oneWeekAgo) absent1w++;
      }
    }

    setStats({
      total: allPeople.length,
      presentThisWeek: presentIds.size,
      absentThisWeek: allPeople.length - presentIds.size,
      absent1w,
      absent3w,
    });
  }, []);

  useEffect(() => {
    fetchPeople();
    computeStats();
  }, [fetchPeople, computeStats]);

  const openAdd = () => {
    setEditPerson(null);
    setFormName("");
    setFormPhone("");
    setFormGender("male");
    setDialogOpen(true);
  };

  const openEdit = (p: Person) => {
    setEditPerson(p);
    setFormName(p.name);
    setFormPhone(p.phone);
    setFormGender(p.gender as "male" | "female");
    setDialogOpen(true);
  };

  const savePerson = async () => {
    if (editPerson) {
      const { error } = await supabase.from("people").update({ name: formName, phone: formPhone, gender: formGender }).eq("id", editPerson.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Person updated" });
    } else {
      const { error } = await supabase.from("people").insert({ name: formName, phone: formPhone, gender: formGender });
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Person added" });
    }
    setDialogOpen(false);
    fetchPeople();
    computeStats();
  };

  const deletePerson = async (id: string) => {
    await supabase.from("people").delete().eq("id", id);
    toast({ title: "Person deleted" });
    fetchPeople();
    computeStats();
  };

  const markAttendance = async (personId: string) => {
    const { error } = await supabase.rpc("mark_attendance", { p_person_id: personId });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Attendance marked!" });
    fetchPeople();
    computeStats();
  };

  const generateAssignments = async () => {
    setGenerating(true);
    try {
      // Get current week start (Monday)
      const today = new Date();
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      const weekStart = new Date(today);
      weekStart.setDate(diff);
      const weekStartStr = weekStart.toISOString().split("T")[0];

      // Check if assignments already exist
      const { data: existing } = await supabase.from("weekly_assignments").select("id").eq("week_start_date", weekStartStr).limit(1);
      if (existing && existing.length > 0) {
        // Delete existing first
        await supabase.from("weekly_assignments").delete().eq("week_start_date", weekStartStr);
      }

      // Get all people and members with profiles
      const [{ data: allPeople }, { data: members }] = await Promise.all([
        supabase.from("people").select("id, gender"),
        supabase.from("user_roles").select("user_id").eq("role", "member"),
      ]);

      if (!allPeople || !members || members.length === 0) {
        toast({ title: "Error", description: "No members or people found.", variant: "destructive" });
        setGenerating(false);
        setConfirmGenerate(false);
        return;
      }

      // Get member profiles for gender
      const memberIds = members.map((m) => m.user_id);
      const { data: memberProfiles } = await supabase.from("profiles").select("id, gender").in("id", memberIds);

      if (!memberProfiles || memberProfiles.length === 0) {
        toast({ title: "Error", description: "No member profiles found.", variant: "destructive" });
        setGenerating(false);
        setConfirmGenerate(false);
        return;
      }

      const maleMembers = memberProfiles.filter((m) => m.gender === "male").map((m) => m.id);
      const femaleMembers = memberProfiles.filter((m) => m.gender === "female").map((m) => m.id);
      const malePeople = allPeople.filter((p) => p.gender === "male");
      const femalePeople = allPeople.filter((p) => p.gender === "female");

      // Shuffle
      const shuffle = <T,>(arr: T[]): T[] => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      };

      const assign = (people: { id: string }[], memberIds: string[]) => {
        if (memberIds.length === 0) return [] as { servant_id: string; person_id: string; week_start_date: string }[];
        const shuffled = shuffle(people);
        return shuffled.map((p, i) => ({
          servant_id: memberIds[i % memberIds.length],
          person_id: p.id,
          week_start_date: weekStartStr,
        }));
      };

      const assignments = [...assign(malePeople, maleMembers), ...assign(femalePeople, femaleMembers)];

      if (assignments.length > 0) {
        const { error } = await supabase.from("weekly_assignments").insert(assignments);
        if (error) {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        } else {
          toast({ title: "Assignments generated!", description: `${assignments.length} assignments created.` });
        }
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setGenerating(false);
    setConfirmGenerate(false);
  };

  const filtered = people.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Church className="h-6 w-6 text-primary" />
            <h1 className="font-bold text-lg text-foreground">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{profile?.name}</span>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card><CardContent className="p-4 text-center"><Users className="h-5 w-5 mx-auto text-primary mb-1" /><div className="text-2xl font-bold">{stats.total}</div><div className="text-xs text-muted-foreground">Total</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><UserCheck className="h-5 w-5 mx-auto text-[hsl(var(--success))] mb-1" /><div className="text-2xl font-bold">{stats.presentThisWeek}</div><div className="text-xs text-muted-foreground">Present</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><UserX className="h-5 w-5 mx-auto text-destructive mb-1" /><div className="text-2xl font-bold">{stats.absentThisWeek}</div><div className="text-xs text-muted-foreground">Absent</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold">{stats.absent1w}</div><div className="text-xs text-muted-foreground">Absent 1w</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold">{stats.absent3w}</div><div className="text-xs text-muted-foreground">Absent 3w+</div></CardContent></Card>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Person</Button>
          <Button variant="secondary" onClick={() => setConfirmGenerate(true)}>
            <Shuffle className="h-4 w-4 mr-2" />Generate Weekly Assignment
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search people..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>

        {/* People list */}
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No people found.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <Card key={p.id} className="transition-shadow hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-foreground">{p.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground capitalize">{p.gender}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{p.phone}</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    {p.last_attendance_date ? `Last: ${p.last_attendance_date}` : "No attendance"}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => markAttendance(p.id)}>
                      <CheckCircle className="h-3.5 w-3.5 mr-1" />Present
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deletePerson(p.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editPerson ? "Edit Person" : "Add Person"}</DialogTitle>
            <DialogDescription>{editPerson ? "Update person details" : "Add a new person to follow up"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="pgender" value="male" checked={formGender === "male"} onChange={() => setFormGender("male")} />
                  Male
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="pgender" value="female" checked={formGender === "female"} onChange={() => setFormGender("female")} />
                  Female
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={savePerson}>{editPerson ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm assignment generation */}
      <AlertDialog open={confirmGenerate} onOpenChange={setConfirmGenerate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate Weekly Assignments?</AlertDialogTitle>
            <AlertDialogDescription>
              This will randomly assign all people to committee members for this week. Existing assignments for this week will be replaced.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={generateAssignments} disabled={generating}>
              {generating ? "Generating..." : "Generate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
