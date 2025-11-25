import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  CheckCircle, 
  Circle, 
  Clock, 
  Coins, 
  LogOut, 
  Plus, 
  Upload, 
  User as UserIcon, 
  Sparkles, 
  Trophy, 
  Bitcoin,
  Info,
  Copy,
  Link as LinkIcon
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// --- Types ---
type UserRole = "parent" | "child";

type User = {
  id: number;
  name: string;
  role: UserRole;
  connectionId: string;
};

type Task = {
  id: number;
  connectionId: string;
  title: string;
  description: string;
  sats: number;
  status: "open" | "assigned" | "submitted" | "approved";
  assignedTo?: number;
  proof?: string;
};

// --- API Functions ---
async function registerPeer(name: string, role: UserRole, connectionId: string): Promise<User> {
  const res = await fetch("/api/peers/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, role, connectionId }),
  });
  if (!res.ok) throw new Error("Failed to register peer");
  return res.json();
}

async function fetchTasks(connectionId: string): Promise<Task[]> {
  const res = await fetch(`/api/tasks/${connectionId}`);
  if (!res.ok) throw new Error("Failed to fetch tasks");
  return res.json();
}

async function createTask(task: Partial<Task>): Promise<Task> {
  const res = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error("Failed to create task");
  return res.json();
}

async function updateTask(id: number, updates: Partial<Task>): Promise<Task> {
  const res = await fetch(`/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update task");
  return res.json();
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [newTask, setNewTask] = useState({ title: "", description: "", sats: 50 });
  
  // Onboarding State
  const [onboardingStep, setOnboardingStep] = useState<"role-selection" | "setup" | "completed">("role-selection");
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load user from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("sats-user");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setOnboardingStep("completed");
      } catch (e) {
        console.error("Failed to parse user from storage", e);
      }
    }
  }, []);

  // Fetch tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", user?.connectionId],
    queryFn: () => fetchTasks(user!.connectionId),
    enabled: !!user?.connectionId,
  });

  // Mutations
  const createTaskMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Aufgabe erstellt", description: "Aufgabe wurde erfolgreich erstellt!" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Partial<Task> }) => updateTask(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  // --- Actions ---

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setOnboardingStep("setup");
  };

  const completeSetup = async (name: string, connectionId: string) => {
    try {
      const peer = await registerPeer(name, selectedRole!, connectionId);
      const newUser: User = {
        id: peer.id,
        name: peer.name,
        role: peer.role as UserRole,
        connectionId: peer.connectionId,
      };
      setUser(newUser);
      setOnboardingStep("completed");
      localStorage.setItem("sats-user", JSON.stringify(newUser));
      toast({ title: "Einrichtung erfolgreich", description: "Verbindung hergestellt!" });
    } catch (error) {
      toast({ title: "Fehler", description: "Konnte nicht verbinden. Bitte versuche es erneut.", variant: "destructive" });
    }
  };

  const logout = () => {
    setUser(null);
    setOnboardingStep("role-selection");
    setSelectedRole(null);
    localStorage.removeItem("sats-user");
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title || !user) return;

    createTaskMutation.mutate({
      connectionId: user.connectionId,
      title: newTask.title,
      description: newTask.description,
      sats: newTask.sats,
      status: "open",
    });
    setNewTask({ title: "", description: "", sats: 50 });
  };

  const acceptTask = (taskId: number) => {
    if (!user) return;
    updateTaskMutation.mutate({
      id: taskId,
      updates: { status: "assigned", assignedTo: user.id },
    });
    toast({ title: "Aufgabe angenommen", description: "Let's stack sats!" });
  };

  const submitProof = (taskId: number) => {
    updateTaskMutation.mutate({
      id: taskId,
      updates: { status: "submitted", proof: "proof_mock.jpg" },
    });
    toast({ title: "Beweis hochgeladen", description: "Warte auf Bestätigung." });
  };

  const approveTask = (taskId: number) => {
    updateTaskMutation.mutate({
      id: taskId,
      updates: { status: "approved" },
    });
    toast({ title: "Sats ausgezahlt!", description: "Transaktion gesendet." });
  };

  // --- Render Logic ---

  if (onboardingStep === "role-selection") {
    return <RoleSelectionPage onSelect={handleRoleSelect} />;
  }

  if (onboardingStep === "setup" && selectedRole) {
    return <SetupPage role={selectedRole} onComplete={completeSetup} onBack={() => setOnboardingStep("role-selection")} />;
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground">
      <NavBar user={user} onLogout={logout} />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={user.role}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {user.role === "parent" ? (
              <ParentDashboard 
                tasks={tasks} 
                newTask={newTask} 
                setNewTask={setNewTask} 
                onCreate={handleCreateTask} 
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
          </motion.div>
        </AnimatePresence>
      </main>
      <Toaster />
    </div>
  );
}

// --- Onboarding Pages ---

function RoleSelectionPage({ onSelect }: { onSelect: (role: UserRole) => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      
      <Card className="w-full max-w-4xl z-10 border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl">
        <div className="grid md:grid-cols-2 gap-0">
          <div className="p-10 bg-gradient-to-br from-primary/10 to-background flex flex-col justify-center border-r border-border/50">
            <div className="h-16 w-16 bg-primary/20 rounded-2xl flex items-center justify-center mb-6 text-primary">
              <Bitcoin className="h-10 w-10" />
            </div>
            <h1 className="text-4xl font-heading font-bold mb-4">Sats Earn</h1>
            <p className="text-muted-foreground text-lg">
              Die Bitcoin-App für die ganze Familie. Erledige Aufgaben, lerne Verantwortung und verdiene echte Sats.
            </p>
          </div>

          <div className="p-10 flex flex-col justify-center">
            <h2 className="text-2xl font-bold mb-6">Wähle deine Rolle</h2>
            <div className="grid gap-4">
              <Button 
                variant="outline" 
                className="h-auto p-6 justify-start text-left hover:border-primary hover:bg-primary/5 transition-all group"
                onClick={() => onSelect("parent")}
              >
                <div className="mr-4 h-12 w-12 rounded-full bg-secondary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <UserIcon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Eltern</h3>
                  <p className="text-sm text-muted-foreground">Wallet verwalten & Aufgaben erstellen</p>
                </div>
              </Button>

              <Button 
                variant="outline" 
                className="h-auto p-6 justify-start text-left hover:border-primary hover:bg-primary/5 transition-all group"
                onClick={() => onSelect("child")}
              >
                <div className="mr-4 h-12 w-12 rounded-full bg-secondary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Kind</h3>
                  <p className="text-sm text-muted-foreground">Aufgaben erledigen & Sats sammeln</p>
                </div>
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function SetupPage({ role, onComplete, onBack }: { role: UserRole, onComplete: (name: string, id: string) => void, onBack: () => void }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [generatedId] = useState(() => `BTC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`);

  const handleNext = () => {
    if (step === 1 && name) setStep(2);
    else if (step === 2) {
      if (role === "parent") {
        onComplete(name, generatedId);
      } else {
        if (connectionId) onComplete(name, connectionId);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg border-border/50 bg-card/90 backdrop-blur-xl">
        <CardHeader>
          <Button variant="ghost" size="sm" onClick={onBack} className="w-fit mb-2 -ml-2 text-muted-foreground">
            ← Zurück
          </Button>
          <CardTitle className="text-2xl">
            {role === "parent" ? "Eltern-Wallet einrichten" : "Verbindung herstellen"}
          </CardTitle>
          <CardDescription>
            Schritt {step} von 2: {step === 1 ? "Profil" : "Verbindung"}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Dein Name</Label>
                <Input 
                  placeholder={role === "parent" ? "z.B. Mama oder Papa" : "z.B. Luca"} 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>
              <div className="bg-primary/10 p-4 rounded-lg text-sm text-primary-foreground/80 flex gap-3">
                <Info className="h-5 w-5 flex-shrink-0 text-primary" />
                <p>
                  {role === "parent" 
                    ? "Als Elternteil verwaltest du die Satoshi-Belohnungen. Im nächsten Schritt verbindest du deine Lightning Wallet."
                    : "Gib deinen Namen ein, damit deine Eltern wissen, wer die Aufgaben erledigt hat."}
                </p>
              </div>
            </div>
          )}

          {step === 2 && role === "parent" && (
            <div className="space-y-6">
               <div className="space-y-4">
                <h3 className="font-medium text-foreground">1. LNbits Verbindung (Optional)</h3>
                <p className="text-sm text-muted-foreground">
                  Verbinde deine LNbits Instanz, um echte Zahlungen zu ermöglichen. Für den Testmodus kannst du dies überspringen.
                </p>
                <div className="grid gap-2">
                  <Input placeholder="LNbits URL (z.B. https://legend.lnbits.com)" className="bg-secondary" />
                  <Input placeholder="Admin Key" type="password" className="bg-secondary" />
                </div>
              </div>
              
              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium text-foreground">2. Familien-ID</h3>
                <p className="text-sm text-muted-foreground">
                  Gib diese ID deinem Kind, um die Apps zu koppeln.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-black p-3 rounded border border-primary/50 text-primary font-mono text-center text-lg tracking-widest">
                    {generatedId}
                  </code>
                  <Button size="icon" variant="outline" onClick={() => navigator.clipboard.writeText(generatedId)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && role === "child" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Familien-ID eingeben</Label>
                <Input 
                  placeholder="BTC-XXXXXX" 
                  value={connectionId}
                  onChange={(e) => setConnectionId(e.target.value.toUpperCase())}
                  className="bg-secondary border-border font-mono text-center uppercase tracking-widest"
                />
                <p className="text-xs text-muted-foreground text-center">
                  Frage deine Eltern nach der Familien-ID.
                </p>
              </div>
              <div className="flex justify-center">
                <LinkIcon className="h-12 w-12 text-muted-foreground opacity-20" />
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter>
          <Button className="w-full" onClick={handleNext} disabled={step === 1 ? !name : (role === "child" && !connectionId)}>
            {step === 1 ? "Weiter" : "Fertigstellen"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// --- Main App Components ---

function NavBar({ user, onLogout }: { user: User; onLogout: () => void }) {
  return (
    <header className="bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-[0_0_15px_rgba(247,147,26,0.5)]">
            <Bitcoin className="h-6 w-6" />
          </div>
          <span className="text-xl font-heading font-bold hidden sm:inline-block tracking-tight">
            Sats Earn
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 pl-4 pr-2 py-1.5 rounded-full bg-secondary border border-border">
            <span className="text-sm font-medium text-muted-foreground">
              {user.name}
            </span>
            <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold border border-primary/50">
              {user.name[0]}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onLogout} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}

function ParentDashboard({ tasks, newTask, setNewTask, onCreate, onApprove }: any) {
  return (
    <div className="space-y-8">
      <motion.section initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <Card className="border border-primary/20 shadow-[0_0_30px_-10px_rgba(247,147,26,0.15)] bg-card/50 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary via-accent to-primary" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Plus className="h-5 w-5" /> 
              Neue Aufgabe erstellen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="flex flex-col md:flex-row gap-4 items-end">
              <div className="space-y-2 flex-grow w-full">
                <Label htmlFor="title">Was ist zu tun?</Label>
                <Input 
                  id="title" 
                  placeholder="z.B. Rasen mähen..." 
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="bg-secondary border-border focus:border-primary"
                />
              </div>
              <div className="space-y-2 w-full md:w-48">
                <Label htmlFor="sats" className="flex items-center gap-1">
                  <Bitcoin className="h-4 w-4 text-primary" /> Belohnung
                </Label>
                <div className="relative">
                  <Input 
                    id="sats" 
                    type="number" 
                    placeholder="50" 
                    value={newTask.sats}
                    onChange={(e) => setNewTask({ ...newTask, sats: parseInt(e.target.value) || 0 })}
                    className="pl-8 font-mono bg-secondary border-border focus:border-primary"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-bold">⚡</span>
                </div>
              </div>
              <Button type="submit" className="w-full md:w-auto bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
                Erstellen
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.section>

      <section>
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="bg-secondary p-1 border border-border">
            <TabsTrigger value="active">Aktiv</TabsTrigger>
            <TabsTrigger value="review">Prüfung</TabsTrigger>
            <TabsTrigger value="completed">Erledigt</TabsTrigger>
          </TabsList>
          
          <div className="mt-6 space-y-4">
            <TabsContent value="active" className="space-y-4">
              {tasks.filter((t: Task) => t.status === "open" || t.status === "assigned").map((task: Task) => (
                <TaskCard key={task.id} task={task} variant="parent" />
              ))}
            </TabsContent>
            
            <TabsContent value="review" className="space-y-4">
               {tasks.filter((t: Task) => t.status === "submitted").map((task: Task) => (
                <TaskCard key={task.id} task={task} variant="parent">
                  <Button 
                    onClick={() => onApprove(task.id)} 
                    className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" /> Genehmigen & Zahlen
                  </Button>
                </TaskCard>
              ))}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              {tasks.filter((t: Task) => t.status === "approved").map((task: Task) => (
                <TaskCard key={task.id} task={task} variant="parent" />
              ))}
            </TabsContent>
          </div>
        </Tabs>
      </section>
    </div>
  );
}

function ChildDashboard({ user, tasks, onAccept, onSubmit }: any) {
  const myTasks = tasks.filter((t: Task) => t.assignedTo === user.id);
  const availableTasks = tasks.filter((t: Task) => t.status === "open");
  const earnedSats = myTasks.filter((t: Task) => t.status === "approved").reduce((acc: number, t: Task) => acc + t.sats, 0);

  return (
    <div className="space-y-10">
      <motion.section 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-black border border-border p-8"
      >
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest mb-2">Wallet Balance</p>
            <h2 className="text-5xl font-mono font-bold flex items-center gap-3 text-primary">
              {earnedSats.toLocaleString()} <span className="text-2xl opacity-50 text-white">SATS</span>
            </h2>
          </div>
          <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center border border-primary/30 shadow-[0_0_20px_rgba(247,147,26,0.2)]">
            <Bitcoin className="h-10 w-10 text-primary" />
          </div>
        </div>
      </motion.section>

      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Trophy className="text-primary" /> Meine Aufgaben
        </h2>
        <div className="grid gap-4">
          {myTasks.map((task: Task) => (
            <TaskCard key={task.id} task={task} variant="child">
              {task.status === "assigned" && (
                <Button onClick={() => onSubmit(task.id)} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Upload className="mr-2 h-4 w-4" /> Beweis senden
                </Button>
              )}
            </TaskCard>
          ))}
          {myTasks.length === 0 && (
             <div className="text-center py-8 border border-dashed border-border rounded-lg text-muted-foreground">
               Noch keine Aufgaben angenommen.
             </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Sparkles className="text-primary" /> Verfügbar
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {availableTasks.map((task: Task) => (
            <Card key={task.id} className="border-border bg-card hover:border-primary/50 transition-colors">
              <CardHeader>
                 <div className="flex justify-between items-start">
                    <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-transparent font-mono">
                      {task.sats} sats
                    </Badge>
                 </div>
                 <CardTitle className="mt-2">{task.title}</CardTitle>
                 <CardDescription>{task.description}</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button onClick={() => onAccept(task.id)} variant="outline" className="w-full hover:border-primary hover:text-primary">
                  Annehmen
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function TaskCard({ task, children, variant }: { task: Task; children?: React.ReactNode; variant: "parent" | "child" }) {
  const getStatusConfig = (status: Task["status"]) => {
    switch (status) {
      case "open": return { label: "OFFEN", color: "bg-secondary text-muted-foreground", icon: Circle };
      case "assigned": return { label: "IN ARBEIT", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Clock };
      case "submitted": return { label: "PRÜFUNG", color: "bg-purple-500/10 text-purple-400 border-purple-500/20", icon: Upload };
      case "approved": return { label: "ERLEDIGT", color: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle };
    }
  };

  const statusConfig = getStatusConfig(task.status);
  const StatusIcon = statusConfig.icon;

  return (
    <Card className="border-border bg-card/50">
      <CardContent className="p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="outline" className={`${statusConfig.color} border px-2 py-0.5 rounded text-[10px] font-bold tracking-wider`}>
              <StatusIcon className="h-3 w-3 mr-1.5" /> {statusConfig.label}
            </Badge>
            <span className="text-primary font-mono text-sm flex items-center gap-1">
              ⚡ {task.sats}
            </span>
          </div>
          <h3 className="font-bold text-lg">{task.title}</h3>
          <p className="text-muted-foreground text-sm">{task.description}</p>
        </div>
        {children && <div className="w-full sm:w-auto pt-2 sm:pt-0">{children}</div>}
      </CardContent>
    </Card>
  );
}
