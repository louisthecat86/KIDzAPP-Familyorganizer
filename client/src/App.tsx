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
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Coins, 
  LogOut, 
  Plus, 
  Upload, 
  User as UserIcon, 
  Sparkles, 
  Trophy, 
  ArrowRight, 
  Home
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// --- Types ---
type User = {
  id: number;
  name: string;
  role: "parent" | "child";
  avatarColor: string;
};

type Task = {
  id: number;
  title: string;
  description: string;
  sats: number;
  status: "open" | "assigned" | "submitted" | "approved";
  assignedTo?: number;
  proof?: string;
};

// --- Mock Data & State ---
const MOCK_USERS: User[] = [
  { id: 1, name: "Mama", role: "parent", avatarColor: "bg-pink-200 text-pink-700" },
  { id: 2, name: "Luca", role: "child", avatarColor: "bg-blue-200 text-blue-700" },
];

const INITIAL_TASKS: Task[] = [
  { id: 1, title: "Staubsaugen", description: "Wohnzimmer komplett saugen", sats: 50, status: "open" },
  { id: 2, title: "Geschirrspüler", description: "Ausräumen und einräumen", sats: 30, status: "assigned", assignedTo: 2 },
  { id: 3, title: "Müll rausbringen", description: "Restmüll und Papier trennen", sats: 20, status: "submitted", assignedTo: 2, proof: "garbage.jpg" },
  { id: 4, title: "Zimmer aufräumen", description: "Alles Lego in die Kiste!", sats: 100, status: "open" },
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

    setTasks([task, ...tasks]);
    setNewTask({ title: "", description: "", sats: 50 });
    toast({ title: "✨ Aufgabe erstellt", description: `${task.title} ist jetzt verfügbar!` });
  };

  const acceptTask = (taskId: number) => {
    if (!user) return;
    setTasks(tasks.map(t => t.id === taskId ? { ...t, status: "assigned", assignedTo: user.id } : t));
    toast({ title: "🚀 Aufgabe angenommen", description: "Viel Erfolg bei der Arbeit!" });
  };

  const submitProof = (taskId: number) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, status: "submitted", proof: "proof_mock.jpg" } : t));
    toast({ title: "📸 Beweis hochgeladen", description: "Mama wird es sich bald ansehen." });
  };

  const approveTask = (taskId: number) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, status: "approved" } : t));
    toast({ title: "💰 Sats ausgezahlt!", description: "Das hast du super gemacht." });
  };

  // --- Render Helpers ---

  if (!user) {
    return <LoginPage onLogin={login} />;
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 font-sans">
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
          </motion.div>
        </AnimatePresence>
      </main>
      <Toaster />
    </div>
  );
}

// --- Pages & Complex Components ---

function LoginPage({ onLogin }: { onLogin: (role: "parent" | "child") => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-amber-50 dark:from-slate-900 dark:to-slate-800 p-6">
      <Card className="w-full max-w-4xl overflow-hidden shadow-2xl border-0 grid md:grid-cols-2 rounded-3xl">
        <div className="bg-primary p-10 text-primary-foreground flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
            <div className="h-16 w-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 shadow-inner">
              <Home className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-heading font-bold mb-4 leading-tight">
              Willkommen zu Hause!
            </h1>
            <p className="text-primary-foreground/80 text-lg font-medium">
              Erledige Aufgaben, sammle Sats und erreiche deine Ziele.
            </p>
          </div>
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-amber-400/20 rounded-full blur-3xl" />
        </div>

        <div className="p-10 flex flex-col justify-center">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Wer bist du?</h2>
            <p className="text-muted-foreground">Wähle dein Profil um zu starten</p>
          </div>
          
          <div className="grid gap-6">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onLogin("parent")}
              className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200 bg-white hover:border-primary/50 hover:shadow-lg transition-all group text-left"
            >
              <div className="h-14 w-14 rounded-full bg-pink-100 flex items-center justify-center text-2xl border-2 border-white shadow-sm group-hover:scale-110 transition-transform">
                👩‍💼
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-800 group-hover:text-primary transition-colors">Mama</h3>
                <p className="text-sm text-muted-foreground">Aufgaben verwalten</p>
              </div>
              <ArrowRight className="ml-auto text-slate-300 group-hover:text-primary transition-colors" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onLogin("child")}
              className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200 bg-white hover:border-primary/50 hover:shadow-lg transition-all group text-left"
            >
              <div className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center text-2xl border-2 border-white shadow-sm group-hover:scale-110 transition-transform">
                👦
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-800 group-hover:text-primary transition-colors">Luca</h3>
                <p className="text-sm text-muted-foreground">Sats verdienen</p>
              </div>
              <ArrowRight className="ml-auto text-slate-300 group-hover:text-primary transition-colors" />
            </motion.button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function NavBar({ user, onLogout }: { user: User; onLogout: () => void }) {
  return (
    <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b sticky top-0 z-50 transition-all">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-gradient-to-tr from-primary to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <Home className="h-6 w-6" />
          </div>
          <span className="text-xl font-heading font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 hidden sm:inline-block">
            Hausarbeiten
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 pl-4 pr-2 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {user.name}
            </span>
            <div className={`h-8 w-8 rounded-full ${user.avatarColor} flex items-center justify-center font-bold shadow-sm`}>
              {user.name[0]}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onLogout} className="text-slate-400 hover:text-destructive hover:bg-destructive/10 rounded-full">
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
      {/* Create Task Section */}
      <motion.section initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <Card className="border-none shadow-xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-purple-500 to-amber-500" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="text-amber-500 h-5 w-5" /> 
              Neue Aufgabe erstellen
            </CardTitle>
            <CardDescription>Vergib Aufgaben und setze Belohnungen fest.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="flex flex-col md:flex-row gap-4 items-end">
              <div className="space-y-2 flex-grow w-full">
                <Label htmlFor="title" className="font-medium">Was ist zu tun?</Label>
                <Input 
                  id="title" 
                  placeholder="z.B. Spülmaschine ausräumen..." 
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  required
                  className="h-12 text-lg"
                />
              </div>
              <div className="space-y-2 w-full md:w-48">
                <Label htmlFor="sats" className="font-medium flex items-center gap-1">
                  <Coins className="h-4 w-4 text-amber-500" /> Belohnung
                </Label>
                <div className="relative">
                  <Input 
                    id="sats" 
                    type="number" 
                    placeholder="50" 
                    value={newTask.sats}
                    onChange={(e) => setNewTask({ ...newTask, sats: parseInt(e.target.value) || 0 })}
                    className="h-12 pl-9 font-mono text-lg"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500 font-bold">⚡</span>
                </div>
              </div>
              <Button type="submit" className="h-12 px-6 w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20">
                <Plus className="mr-2 h-5 w-5" /> Erstellen
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.section>

      {/* Task Lists */}
      <section>
        <Tabs defaultValue="review" className="w-full">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-heading font-bold">Aufgaben Übersicht</h2>
            <TabsList className="bg-white dark:bg-slate-900 p-1 rounded-full border shadow-sm">
              <TabsTrigger value="review" className="rounded-full px-4">Prüfung</TabsTrigger>
              <TabsTrigger value="active" className="rounded-full px-4">Aktiv</TabsTrigger>
              <TabsTrigger value="completed" className="rounded-full px-4">Erledigt</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="active" className="space-y-4">
            <AnimatePresence>
              {tasks.filter((t: Task) => t.status === "open" || t.status === "assigned").map((task: Task) => (
                <TaskCard key={task.id} task={task} variant="parent" />
              ))}
            </AnimatePresence>
            {tasks.filter((t: Task) => t.status === "open" || t.status === "assigned").length === 0 && (
              <EmptyState message="Keine aktiven Aufgaben." icon="💤" />
            )}
          </TabsContent>

          <TabsContent value="review" className="space-y-4">
             <AnimatePresence>
               {tasks.filter((t: Task) => t.status === "submitted").map((task: Task) => (
                <TaskCard key={task.id} task={task} variant="parent">
                  <Button 
                    onClick={() => onApprove(task.id)} 
                    className="bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20 w-full sm:w-auto"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Genehmigen & Zahlen
                  </Button>
                </TaskCard>
              ))}
             </AnimatePresence>
             {tasks.filter((t: Task) => t.status === "submitted").length === 0 && (
              <EmptyState message="Alles erledigt! Keine Aufgaben zur Prüfung." icon="✨" />
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            <AnimatePresence>
              {tasks.filter((t: Task) => t.status === "approved").map((task: Task) => (
                <TaskCard key={task.id} task={task} variant="parent" />
              ))}
            </AnimatePresence>
          </TabsContent>
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
      {/* Hero Stats */}
      <motion.section 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-xl shadow-amber-500/20 p-8"
      >
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-amber-100 font-medium mb-1 text-lg">Dein Kontostand</p>
            <h2 className="text-5xl font-heading font-bold flex items-center gap-3">
              {earnedSats.toLocaleString()} <span className="text-3xl opacity-80">Sats</span>
            </h2>
          </div>
          <div className="h-20 w-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border-2 border-white/30">
            <Trophy className="h-10 w-10 text-white" />
          </div>
        </div>
        {/* Decorative circles */}
        <div className="absolute -right-10 -top-10 h-40 w-40 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -left-10 -bottom-10 h-40 w-40 bg-orange-600/20 rounded-full blur-2xl" />
      </motion.section>

      {/* My Tasks */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="h-8 w-1 bg-primary rounded-full" />
          <h2 className="text-2xl font-heading font-bold">Meine Missionen</h2>
        </div>
       
        <div className="grid gap-4">
          <AnimatePresence>
            {myTasks.map((task: Task) => (
              <TaskCard key={task.id} task={task} variant="child">
                {task.status === "assigned" && (
                  <Button onClick={() => onSubmit(task.id)} className="bg-primary hover:bg-primary/90 w-full sm:w-auto shadow-lg shadow-primary/20">
                    <Upload className="mr-2 h-4 w-4" /> Beweis hochladen
                  </Button>
                )}
              </TaskCard>
            ))}
          </AnimatePresence>
          {myTasks.length === 0 && (
             <EmptyState message="Du hast gerade keine aktiven Missionen." icon="🚀" />
          )}
        </div>
      </section>

      <Separator className="opacity-50" />

      {/* Available Tasks */}
      <section>
        <div className="flex items-center gap-3 mb-6">
           <div className="h-8 w-1 bg-emerald-500 rounded-full" />
           <h2 className="text-2xl font-heading font-bold">Verfügbare Aufgaben</h2>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          <AnimatePresence>
            {availableTasks.map((task: Task) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Card className="h-full flex flex-col border-slate-200 dark:border-slate-800 hover:shadow-lg transition-shadow overflow-hidden group">
                  <div className="h-2 w-full bg-slate-100 group-hover:bg-primary transition-colors" />
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-transparent">
                        <Coins className="h-3 w-3 mr-1" /> {task.sats}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg mt-2">{task.title}</CardTitle>
                    <CardDescription className="line-clamp-2">{task.description}</CardDescription>
                  </CardHeader>
                  <CardFooter className="mt-auto pt-4">
                    <Button onClick={() => onAccept(task.id)} variant="outline" className="w-full group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all">
                      Annehmen
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
           {availableTasks.length === 0 && (
              <div className="col-span-2">
                 <EmptyState message="Alles erledigt! Keine neuen Aufgaben." icon="🎉" />
              </div>
           )}
        </div>
      </section>
    </div>
  );
}

function TaskCard({ task, children, variant }: { task: Task; children?: React.ReactNode; variant: "parent" | "child" }) {
  const getStatusConfig = (status: Task["status"]) => {
    switch (status) {
      case "open": return { label: "Offen", color: "bg-slate-100 text-slate-600 border-slate-200", icon: Circle };
      case "assigned": return { label: "In Arbeit", color: "bg-blue-50 text-blue-700 border-blue-100", icon: Clock };
      case "submitted": return { label: "Prüfung", color: "bg-purple-50 text-purple-700 border-purple-100", icon: Upload };
      case "approved": return { label: "Erledigt", color: "bg-green-50 text-green-700 border-green-100", icon: CheckCircle2 };
    }
  };

  const statusConfig = getStatusConfig(task.status);
  const StatusIcon = statusConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      layout
    >
      <Card className="border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
        <CardContent className="p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="space-y-1">
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="outline" className={`${statusConfig.color} px-2.5 py-0.5 rounded-full border`}>
                <StatusIcon className="h-3 w-3 mr-1.5" /> {statusConfig.label}
              </Badge>
              <span className="text-amber-500 font-bold text-sm flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full">
                <Coins className="h-3 w-3" /> {task.sats}
              </span>
            </div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{task.title}</h3>
            <p className="text-muted-foreground text-sm">{task.description}</p>
            
            {task.proof && variant === "parent" && (
              <div className="mt-3 text-sm bg-slate-50 inline-block px-3 py-1 rounded-md border border-slate-100 text-slate-600">
                 📸 Beweisfoto angehängt: <span className="font-medium underline cursor-pointer">{task.proof}</span>
              </div>
            )}
          </div>
          {children && <div className="w-full sm:w-auto pt-2 sm:pt-0">{children}</div>}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function EmptyState({ message, icon }: { message: string; icon: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
      <span className="text-4xl mb-3 grayscale opacity-80">{icon}</span>
      <p className="text-muted-foreground font-medium">{message}</p>
    </div>
  );
}
