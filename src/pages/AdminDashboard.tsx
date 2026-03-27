import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Users, UserCheck, UserX, Clock, ShieldCheck, ShieldX, FolderPlus, Layers,
} from "lucide-react";
import { validatePhone, capitalizeName } from "@/lib/validation";

interface Person {
  id: string;
  name: string;
  phone: string;
  gender: string;
  last_attendance_date: string | null;
  group_id: string | null;
}

interface PendingUser {
  id: string;
  name: string;
  gender: string;
  group_id: string | null;
}

interface Group {
  id: string;
  name: string;
  level: string;
  grade: string | null;
  gender: string;
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
  const [formGroupId, setFormGroupId] = useState("");
  const [formErrors, setFormErrors] = useState<{ name?: string; phone?: string }>({});
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Groups
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [gName, setGName] = useState("");
  const [gLevel, setGLevel] = useState("primary");
  const [gGrade, setGGrade] = useState("");
  const [gGender, setGGender] = useState("mixed");

  // Pending users
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);

  // Stats
  const [stats, setStats] = useState({
    total: 0, totalMale: 0, totalFemale: 0,
    presentThisWeek: 0, absentThisWeek: 0,
    absent1w: 0, absent3w: 0,
    approvedMembers: 0, pendingCount: 0,
  });

  const fetchGroups = useCallback(async () => {
    const { data } = await supabase.from("groups").select("*").order("level").order("name");
    if (data) setGroups(data);
  }, []);

  const fetchPeople = useCallback(async () => {
    let query = supabase.from("people").select("*").order("name");
    if (selectedGroupId !== "all") {
      query = query.eq("group_id", selectedGroupId);
    }
    const { data } = await query;
    if (data) setPeople(data);
    setLoading(false);
  }, [selectedGroupId]);

  const fetchPendingUsers = useCallback(async () => {
    const { data: pendingRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "pending");

    if (!pendingRoles || pendingRoles.length === 0) {
      setPendingUsers([]);
      return;
    }

    const pendingIds = pendingRoles.map((r) => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, gender, group_id")
      .in("id", pendingIds)
      .eq("approved", false);

    setPendingUsers(profiles || []);
  }, []);

  const computeStats = useCallback(async () => {
    let peopleQuery = supabase.from("people").select("id, gender, last_attendance_date");
    if (selectedGroupId !== "all") {
      peopleQuery = peopleQuery.eq("group_id", selectedGroupId);
    }
    const { data: allPeople } = await peopleQuery;
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

    let absent1w = 0, absent3w = 0, totalMale = 0, totalFemale = 0;
    for (const p of allPeople) {
      if (p.gender === "male") totalMale++;
      else totalFemale++;
      if (!p.last_attendance_date) {
        absent3w++; absent1w++;
      } else {
        const d = new Date(p.last_attendance_date);
        if (d < threeWeeksAgo) absent3w++;
        else if (d < oneWeekAgo) absent1w++;
      }
    }

    const { data: memberRoles } = await supabase.from("user_roles").select("user_id").eq("role", "member");
    const { data: pendingRoles } = await supabase.from("user_roles").select("user_id").eq("role", "pending");

    setStats({
      total: allPeople.length, totalMale, totalFemale,
      presentThisWeek: presentIds.size,
      absentThisWeek: allPeople.length - presentIds.size,
      absent1w, absent3w,
      approvedMembers: memberRoles?.length || 0,
      pendingCount: pendingRoles?.length || 0,
    });
  }, [selectedGroupId]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    fetchPeople();
    fetchPendingUsers();
    computeStats();
  }, [fetchPeople, fetchPendingUsers, computeStats]);

  // Group CRUD
  const openAddGroup = () => {
    setEditGroup(null);
    setGName(""); setGLevel("primary"); setGGrade(""); setGGender("mixed");
    setGroupDialogOpen(true);
  };
  const openEditGroup = (g: Group) => {
    setEditGroup(g);
    setGName(g.name); setGLevel(g.level); setGGrade(g.grade || ""); setGGender(g.gender);
    setGroupDialogOpen(true);
  };
  const saveGroup = async () => {
    if (!gName.trim()) { toast({ title: "Group name required", variant: "destructive" }); return; }
    if (editGroup) {
      const { error } = await supabase.from("groups").update({ name: gName.trim(), level: gLevel, grade: gGrade || null, gender: gGender }).eq("id", editGroup.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Group updated" });
    } else {
      const { error } = await supabase.from("groups").insert({ name: gName.trim(), level: gLevel, grade: gGrade || null, gender: gGender });
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Group created" });
    }
    setGroupDialogOpen(false);
    fetchGroups();
  };
  const deleteGroup = async (id: string) => {
    await supabase.from("groups").delete().eq("id", id);
    toast({ title: "Group deleted" });
    fetchGroups();
    if (selectedGroupId === id) setSelectedGroupId("all");
  };

  // Person CRUD
  const openAdd = () => {
    setEditPerson(null);
    setFormName(""); setFormPhone(""); setFormGender("male");
    setFormGroupId(selectedGroupId !== "all" ? selectedGroupId : "");
    setFormErrors({});
    setDialogOpen(true);
  };
  const openEdit = (p: Person) => {
    setEditPerson(p);
    setFormName(p.name); setFormPhone(p.phone);
    setFormGender(p.gender as "male" | "female");
    setFormGroupId(p.group_id || "");
    setFormErrors({});
    setDialogOpen(true);
  };
  const validateForm = (): boolean => {
    const errors: { name?: string; phone?: string } = {};
    if (!formName.trim()) errors.name = "Name is required.";
    const phoneErr = validatePhone(formPhone);
    if (phoneErr) errors.phone = phoneErr;
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  const savePerson = async () => {
    if (!validateForm()) return;
    const name = capitalizeName(formName);
    const phone = formPhone.trim();
    const payload = { name, phone, gender: formGender, group_id: formGroupId || null };

    if (editPerson) {
      const { error } = await supabase.from("people").update(payload).eq("id", editPerson.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Person updated" });
    } else {
      const { error } = await supabase.from("people").insert(payload);
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

  const approveUser = async (userId: string) => {
    const { error: roleErr } = await supabase.from("user_roles").update({ role: "member" as any }).eq("user_id", userId);
    if (roleErr) { toast({ title: "Error", description: roleErr.message, variant: "destructive" }); return; }
    const { error: profileErr } = await supabase.from("profiles").update({ approved: true }).eq("id", userId);
    if (profileErr) { toast({ title: "Error", description: profileErr.message, variant: "destructive" }); return; }
    toast({ title: "User approved!" });
    fetchPendingUsers();
    computeStats();
  };
  const rejectUser = async (userId: string) => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("profiles").delete().eq("id", userId);
    toast({ title: "User rejected and removed." });
    fetchPendingUsers();
    computeStats();
  };

  const generateAssignments = async () => {
    if (selectedGroupId === "all") {
      toast({ title: "Select a group first", description: "Assignments are generated per group.", variant: "destructive" });
      setConfirmGenerate(false);
      return;
    }
    setGenerating(true);
    try {
      const today = new Date();
      const day = today.getDay();
      const diff = day >= 6 ? day - 6 : day + 1;
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - diff);
      const weekStartStr = weekStart.toISOString().split("T")[0];

      // Delete existing assignments for this group + week
      await supabase
        .from("weekly_assignments")
        .delete()
        .eq("week_start_date", weekStartStr)
        .eq("group_id", selectedGroupId);

      // Get approved members in this group
      const { data: memberRoles } = await supabase.from("user_roles").select("user_id").eq("role", "member");
      if (!memberRoles || memberRoles.length === 0) {
        toast({ title: "No approved members found.", variant: "destructive" });
        setGenerating(false); setConfirmGenerate(false); return;
      }
      const memberIds = memberRoles.map((m) => m.user_id);
      const { data: memberProfiles } = await supabase
        .from("profiles")
        .select("id, gender")
        .in("id", memberIds)
        .eq("approved", true)
        .eq("group_id", selectedGroupId);

      const { data: allPeople } = await supabase
        .from("people")
        .select("id, gender")
        .eq("group_id", selectedGroupId);

      if (!memberProfiles?.length || !allPeople?.length) {
        toast({ title: "No members or people in this group.", variant: "destructive" });
        setGenerating(false); setConfirmGenerate(false); return;
      }

      const maleMembers = memberProfiles.filter((m) => m.gender === "male").map((m) => m.id);
      const femaleMembers = memberProfiles.filter((m) => m.gender === "female").map((m) => m.id);
      const malePeople = allPeople.filter((p) => p.gender === "male");
      const femalePeople = allPeople.filter((p) => p.gender === "female");

      const shuffle = <T,>(arr: T[]): T[] => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      };
      const assign = (ppl: { id: string }[], members: string[]) => {
        if (!members.length || !ppl.length) return [];
        const shuffled = shuffle(ppl);
        return shuffled.map((p, i) => ({
          servant_id: members[i % members.length],
          person_id: p.id,
          week_start_date: weekStartStr,
          group_id: selectedGroupId,
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

  const getGroupName = (gid: string | null) => {
    if (!gid) return "—";
    return groups.find((g) => g.id === gid)?.name || "—";
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
        {/* Group Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <Layers className="h-5 w-5 text-primary" />
          <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All Groups" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Groups</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name} ({g.level}{g.grade ? ` - ${g.grade}` : ""})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={openAddGroup}>
            <FolderPlus className="h-4 w-4 mr-1" />Add Group
          </Button>
        </div>

        {/* Group Management Cards */}
        {groups.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <div key={g.id} className="flex items-center gap-1 text-xs bg-secondary/60 rounded-md px-2 py-1">
                <span className="font-medium text-foreground">{g.name}</span>
                <span className="text-muted-foreground">({g.level})</span>
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => openEditGroup(g)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={() => deleteGroup(g.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <Card><CardContent className="p-3 text-center"><Users className="h-4 w-4 mx-auto text-primary mb-1" /><div className="text-xl font-bold">{stats.total}</div><div className="text-xs text-muted-foreground">Total</div></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><div className="text-xl font-bold">{stats.totalMale}</div><div className="text-xs text-muted-foreground">Male</div></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><div className="text-xl font-bold">{stats.totalFemale}</div><div className="text-xs text-muted-foreground">Female</div></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><UserCheck className="h-4 w-4 mx-auto text-[hsl(var(--success))] mb-1" /><div className="text-xl font-bold">{stats.presentThisWeek}</div><div className="text-xs text-muted-foreground">Present</div></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><UserX className="h-4 w-4 mx-auto text-destructive mb-1" /><div className="text-xl font-bold">{stats.absentThisWeek}</div><div className="text-xs text-muted-foreground">Absent</div></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><div className="text-xl font-bold">{stats.absent1w}</div><div className="text-xs text-muted-foreground">Absent 1w</div></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><div className="text-xl font-bold">{stats.absent3w}</div><div className="text-xs text-muted-foreground">Absent 3w+</div></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><ShieldCheck className="h-4 w-4 mx-auto text-primary mb-1" /><div className="text-xl font-bold">{stats.approvedMembers}</div><div className="text-xs text-muted-foreground">Members</div></CardContent></Card>
        </div>

        {/* Pending Requests */}
        {pendingUsers.length > 0 && (
          <Card className="border-[hsl(var(--destructive))]/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-5 w-5 text-destructive" />
                Pending Requests ({pendingUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div>
                    <p className="font-medium text-foreground">{u.name || "No name"}</p>
                    <p className="text-xs text-muted-foreground capitalize">{u.gender} · Group: {getGroupName(u.group_id)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => approveUser(u.id)}>
                      <ShieldCheck className="h-3.5 w-3.5 mr-1" />Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => rejectUser(u.id)}>
                      <ShieldX className="h-3.5 w-3.5 mr-1" />Reject
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

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
                  <p className="text-xs text-muted-foreground mb-1">Group: {getGroupName(p.group_id)}</p>
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

      {/* Add/Edit Person dialog */}
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
              {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="01012345678 or +1234567890" />
              {formErrors.phone && <p className="text-sm text-destructive">{formErrors.phone}</p>}
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
            <div className="space-y-2">
              <Label>Group</Label>
              <Select value={formGroupId} onValueChange={setFormGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name} ({g.level})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={savePerson}>{editPerson ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Group dialog */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editGroup ? "Edit Group" : "Add Group"}</DialogTitle>
            <DialogDescription>{editGroup ? "Update group details" : "Create a new group"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Group Name</Label>
              <Input value={gName} onChange={(e) => setGName(e.target.value)} placeholder="e.g. Youth Boys" />
            </div>
            <div className="space-y-2">
              <Label>Level</Label>
              <Select value={gLevel} onValueChange={setGLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="preparatory">Preparatory</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Grade (optional)</Label>
              <Input value={gGrade} onChange={(e) => setGGrade(e.target.value)} placeholder="e.g. 1st, 2nd" />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={gGender} onValueChange={setGGender}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveGroup}>{editGroup ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm assignment generation */}
      <AlertDialog open={confirmGenerate} onOpenChange={setConfirmGenerate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate Weekly Assignments?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedGroupId === "all"
                ? "Please select a specific group first to generate assignments."
                : `This will generate assignments for the selected group. Existing assignments for this week and group will be replaced.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={generateAssignments} disabled={generating || selectedGroupId === "all"}>
              {generating ? "Generating..." : "Generate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
