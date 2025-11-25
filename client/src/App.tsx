import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Circle, Clock, Coins, LogOut, Plus, Upload, User as UserIcon, XCircle } from "lucide-react";

// --- Types ---
type User = {
  id: number;
  name: string;
  role: "parent" | "child";
};

type Task = {
  id: number;
  title: string;
  description: string;
  sats: number;
  status: "open" | "assigned" | "submitted" | "approved";
  assignedTo?: number;
  proof?: string; // Mock file name
};

// --- Mock Data & State ---
const MOCK_USERS: User[] = [
  { id: 1, name: "Mama", role: "parent" },
  { id: 2, name: "Luca", role: "child" },
];

const INITIAL_TASKS: Task[] = [
  { id: 1, title: "Staubsaugen", description: "Wohnzimmer komplett saugen", sats: 50, status: "open" },
  { id: 2, title: "Geschirrspüler", description: "Ausäumen und einräumen", sats: 30, status: "assigned", assignedTo: 2 },
  { id: 3, title: "Müll rausbringen", description: "Restmüll und Papier", sats: 20, status: "submitted", assignedTo: 2, proof: "garbage.jpg" },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [newTask, setNewTask] = useState({ title: "", description: "", sats: 50 });
  const { toast } = useToast();

  // --- Actions ---

  const login = (role: "parent" | "child") => {
    const u = MOCK_USERS.find((u) => u.role === role);
    if (u) {
      setUser(u);
      toast({ title: `Angemeldet als ${u.name}`, description: "Willkommen zurück!" });
    }
  };

  const logout = () => {
    setUser(null);
  };

  const createTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title) return;

    const task: Task = {
      id: Date.now(),
      title: newTask.title,
      description: newTask.description,
      sats: newTask.sats,
      status: "open",
    };

    setTasks([...tasks, task]);
    setNewTask({ title: "", description: "", sats: 50 });
    toast({ title: "Aufgabe erstellt", description: `${task.title} wurde hinzugefügt.` });
  };

  const acceptTask = (taskId: number) => {
    if (!user) return;
    setTasks(tasks.map(t => t.id === taskId ? { ...t, status: "assigned", assignedTo: user.id } : t));
    toast({ title: "Aufgabe angenommen", description: "Viel Erfolg!" });
  };

  const submitProof = (taskId: number) => {
    // Mock file upload
    setTasks(tasks.map(t => t.id === taskId ? { ...t, status: "submitted", proof: "proof_mock.jpg" } : t));
    toast({ title: "Beweis hochgeladen", description: "Warte auf Genehmigung." });
  };

  const approveTask = (taskId: number) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, status: "approved" } : t));
    toast({ title: "Aufgabe genehmigt", description: "Sats wurden gutgeschrieben!" }); // Mock payment
  };

  // --- Render Helpers ---

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-primary">Hausarbeiten App</CardTitle>
            <CardDescription>Bitte wähle dein Profil</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              className="w-full h-16 text-lg" 
              variant="outline" 
              onClick={() => login("parent")}
              data-testid="btn-login-parent"
            >
              <UserIcon className="mr-2 h-6 w-6" /> Eltern (Mama)
            </Button>
            <Button 
              className="w-full h-16 text-lg" 
              variant="outline" 
              onClick={() => login("child")}
              data-testid="btn-login-child"
            >
              <UserIcon className="mr-2 h-6 w-6" /> Kind (Luca)
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
              H
            </div>
            <h1 className="text-xl font-bold hidden md:block">Hausarbeiten</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              Angemeldet als <span className="font-medium text-foreground">{user.name}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} title="Abmelden">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {user.role === "parent" ? (
          <ParentDashboard 
            tasks={tasks} 
            newTask={newTask} 
            setNewTask={setNewTask} 
            onCreate={createTask} 
            onApprove={approveTask} 
          />
        ) : (
          <ChildDashboard 
            user={user}
            tasks={tasks} 
            onAccept={acceptTask} 
            onSubmit={submitProof} 
          />
        )}
      </main>
      <Toaster />
    </div>
  );
}

// --- Sub-Components ---

function ParentDashboard({ tasks, newTask, setNewTask, onCreate, onApprove }: any) {
  return (
    <div className="space-y-8">
      <section>
        <Card>
          <CardHeader>
            <CardTitle>Neue Aufgabe erstellen</CardTitle>
            <CardDescription>Vergib Aufgaben und Belohnungen.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="grid gap-4 md:grid-cols-[2fr_1fr_auto] items-end">
              <div className="space-y-2">
                <Label htmlFor="title">Titel</Label>
                <Input 
                  id="title" 
                  placeholder="z.B. Rasen mähen" 
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sats">Belohnung (Sats)</Label>
                <Input 
                  id="sats" 
                  type="number" 
                  placeholder="50" 
                  value={newTask.sats}
                  onChange={(e) => setNewTask({ ...newTask, sats: parseInt(e.target.value) || 0 })}
                />
              </div>
              <Button type="submit" className="w-full md:w-auto">
                <Plus className="mr-2 h-4 w-4" /> Erstellen
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Aufgaben Übersicht</h2>
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Aktiv</TabsTrigger>
            <TabsTrigger value="review">Zur Prüfung</TabsTrigger>
            <TabsTrigger value="completed">Erledigt</TabsTrigger>
          </TabsList>
          
          <TabsContent value="active" className="mt-4 space-y-4">
            {tasks.filter((t: Task) => t.status === "open" || t.status === "assigned").map((task: Task) => (
              <TaskCard key={task.id} task={task} />
            ))}
            {tasks.filter((t: Task) => t.status === "open" || t.status === "assigned").length === 0 && (
              <p className="text-muted-foreground text-center py-8">Keine aktiven Aufgaben.</p>
            )}
          </TabsContent>

          <TabsContent value="review" className="mt-4 space-y-4">
             {tasks.filter((t: Task) => t.status === "submitted").map((task: Task) => (
              <TaskCard key={task.id} task={task}>
                <Button onClick={() => onApprove(task.id)} className="w-full sm:w-auto" variant="default">
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Genehmigen
                </Button>
              </TaskCard>
            ))}
             {tasks.filter((t: Task) => t.status === "submitted").length === 0 && (
              <p className="text-muted-foreground text-center py-8">Keine Aufgaben zur Prüfung.</p>
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-4 space-y-4">
            {tasks.filter((t: Task) => t.status === "approved").map((task: Task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}

function ChildDashboard({ user, tasks, onAccept, onSubmit }: any) {
  const myTasks = tasks.filter((t: Task) => t.assignedTo === user.id);
  const availableTasks = tasks.filter((t: Task) => t.status === "open");

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between mb-4">
           <h2 className="text-xl font-semibold">Meine Aufgaben</h2>
           <Badge variant="secondary" className="text-base px-3 py-1">
             <Coins className="mr-2 h-4 w-4 text-yellow-500" />
             {myTasks.filter((t: Task) => t.status === "approved").reduce((acc: number, t: Task) => acc + t.sats, 0)} Sats verdient
           </Badge>
        </div>
       
        <div className="grid gap-4">
          {myTasks.map((task: Task) => (
            <TaskCard key={task.id} task={task}>
              {task.status === "assigned" && (
                <Button onClick={() => onSubmit(task.id)} variant="outline" className="w-full sm:w-auto">
                  <Upload className="mr-2 h-4 w-4" /> Beweis hochladen
                </Button>
              )}
            </TaskCard>
          ))}
          {myTasks.length === 0 && (
             <Card className="bg-muted/50 border-dashed">
               <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                 <p className="text-muted-foreground">Du hast noch keine Aufgaben angenommen.</p>
               </CardContent>
             </Card>
          )}
        </div>
      </section>

      <Separator />

      <section>
        <h2 className="text-xl font-semibold mb-4">Verfügbare Aufgaben</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {availableTasks.map((task: Task) => (
            <Card key={task.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base">{task.title}</CardTitle>
                  <Badge variant="secondary" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                    {task.sats} Sats
                  </Badge>
                </div>
                <CardDescription>{task.description}</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button onClick={() => onAccept(task.id)} className="w-full" size="sm">
                  Annehmen
                </Button>
              </CardFooter>
            </Card>
          ))}
           {availableTasks.length === 0 && (
              <p className="text-muted-foreground py-4">Gerade gibt es keine neuen Aufgaben.</p>
           )}
        </div>
      </section>
    </div>
  );
}

function TaskCard({ task, children }: { task: Task; children?: React.ReactNode }) {
  const getStatusBadge = (status: Task["status"]) => {
    switch (status) {
      case "open": return <Badge variant="outline">Offen</Badge>;
      case "assigned": return <Badge variant="secondary" className="bg-blue-50 text-blue-700">In Bearbeitung</Badge>;
      case "submitted": return <Badge variant="secondary" className="bg-purple-50 text-purple-700">Prüfung</Badge>;
      case "approved": return <Badge variant="secondary" className="bg-green-50 text-green-700">Erledigt</Badge>;
    }
  };

  return (
    <Card>
      <CardContent className="p-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">{task.title}</h3>
            {getStatusBadge(task.status)}
          </div>
          <p className="text-muted-foreground text-sm">{task.description}</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
            <span className="flex items-center gap-1">
              <Coins className="h-3 w-3" /> {task.sats} Sats
            </span>
            {task.proof && (
              <span className="flex items-center gap-1 text-blue-600">
                 <Upload className="h-3 w-3" /> Beweis vorhanden
              </span>
            )}
          </div>
        </div>
        {children && <div className="w-full sm:w-auto pt-2 sm:pt-0">{children}</div>}
      </CardContent>
    </Card>
  );
}
