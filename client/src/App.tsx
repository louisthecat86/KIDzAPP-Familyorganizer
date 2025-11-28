import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { LineChart, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, Line, Area, ResponsiveContainer, defs, linearGradient, stop } from "recharts";
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
  Link as LinkIcon,
  Settings,
  Send,
  Copy,
  ExternalLink,
  Trash2,
  X,
  Calendar,
  MapPin,
  Menu,
  ChevronDown,
  ChevronLeft,
  Home,
  Users,
  MessageSquare,
  Eye,
  EyeOff,
  Bell,
  BookOpen
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PhotoUpload } from "@/components/PhotoUpload";
import { ProofViewer } from "@/components/ProofViewer";

function NotificationBadge({ count }: { count: number }) {
  return (
    <AnimatePresence mode="wait">
      {count > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold"
        >
          <motion.span
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            {count > 9 ? "9+" : count}
          </motion.span>
        </motion.span>
      )}
    </AnimatePresence>
  );
}

type Peer = {
  id: number;
  name: string;
  role: string;
  pin: string;
  connectionId: string;
  balance?: number;
  hasLnbitsConfigured?: boolean;
  createdAt: Date;
};

type UserRole = "parent" | "child";

type User = {
  id: number;
  name: string;
  role: UserRole;
  connectionId: string;
  familyName?: string;
  balance?: number;
  hasLnbitsConfigured?: boolean;
  lightningAddress?: string;
  favoriteColor?: string;
};

type Task = {
  id: number;
  connectionId: string;
  createdBy: number;
  title: string;
  description: string;
  sats: number;
  status: "open" | "assigned" | "submitted" | "approved";
  assignedTo?: number;
  proof?: string;
  escrowLocked?: boolean;
  paylink?: string;
  withdrawLink?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

type FamilyEvent = {
  id: number;
  connectionId: string;
  createdBy: number;
  title: string;
  description?: string;
  startDate: Date | string;
  endDate?: Date | string;
  location?: string;
  color: string;
  eventType: string;
};

// --- Password Validation Function ---
function validatePassword(password: string): { valid: boolean; error: string } {
  if (password.length < 8) {
    return { valid: false, error: "Passwort muss mindestens 8 Zeichen haben" };
  }
  if (password.length > 12) {
    return { valid: false, error: "Passwort darf maximal 12 Zeichen haben" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Passwort muss mindestens einen Großbuchstaben enthalten" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Passwort muss mindestens eine Zahl enthalten" };
  }
  return { valid: true, error: "" };
}

// --- Color Generation Function ---
const chatColors = [
  "bg-red-500/20 border-red-500/50 text-red-100",
  "bg-blue-500/20 border-blue-500/50 text-blue-100",
  "bg-green-500/20 border-green-500/50 text-green-100",
  "bg-purple-500/20 border-purple-500/50 text-purple-100",
  "bg-pink-500/20 border-pink-500/50 text-pink-100",
  "bg-yellow-500/20 border-yellow-500/50 text-yellow-100",
  "bg-indigo-500/20 border-indigo-500/50 text-indigo-100",
  "bg-teal-500/20 border-teal-500/50 text-teal-100",
];

function getMessageColor(senderName: string): string {
  let hash = 0;
  for (let i = 0; i < senderName.length; i++) {
    hash = ((hash << 5) - hash) + senderName.charCodeAt(i);
    hash = hash & hash;
  }
  const index = Math.abs(hash) % chatColors.length;
  return chatColors[index];
}

// --- API Functions ---
async function registerUser(name: string, role: UserRole, pin: string, familyName?: string, joinParentConnectionId?: string, favoriteColor?: string): Promise<User> {
  const res = await fetch("/api/peers/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, role, pin, familyName, joinParentConnectionId, favoriteColor }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Registrierung fehlgeschlagen");
  }
  return data;
}

async function loginUser(name: string, role: UserRole, pin: string): Promise<User> {
  const res = await fetch("/api/peers/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, role, pin }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Anmeldung fehlgeschlagen");
  }
  return data;
}

async function linkChildToParent(childId: number, parentConnectionId: string): Promise<User> {
  const res = await fetch("/api/peers/link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ childId, parentConnectionId }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Fehler beim Verbinden mit Eltern");
  }
  return data;
}


async function withdrawSats(peerId: number, sats: number, paymentRequest: string): Promise<any> {
  const res = await fetch("/api/withdraw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ peerId, sats, paymentRequest }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Auszahlung fehlgeschlagen");
  }
  return data;
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

async function deleteTask(id: number): Promise<void> {
  const res = await fetch(`/api/tasks/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete task");
}

async function fetchFamilyEvents(connectionId: string): Promise<FamilyEvent[]> {
  const res = await fetch(`/api/events/${connectionId}`);
  if (!res.ok) throw new Error("Failed to fetch events");
  return res.json();
}

async function createEvent(event: Partial<FamilyEvent>): Promise<FamilyEvent> {
  const res = await fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error("Failed to create event");
  return res.json();
}

async function deleteEvent(id: number): Promise<void> {
  const res = await fetch(`/api/events/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete event");
}


export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [newTask, setNewTask] = useState({ title: "", description: "", sats: 50 });
  const [newEvent, setNewEvent] = useState({ title: "", description: "", location: "", startDate: "", endDate: "" });
  const [currentView, setCurrentView] = useState<string>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mode, setMode] = useState<"role-select" | "auth" | "app">("role-select");
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [layoutView, setLayoutView] = useState("two-column");
  const [showSpendingStats, setShowSpendingStats] = useState(false);
  const [spendingStats, setSpendingStats] = useState<Array<{ childId: number; childName: string; satSpent: number }>>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoadingMessage, setIsLoadingMessage] = useState(false);
  const [approvingTaskId, setApprovingTaskId] = useState<number | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const stored = localStorage.getItem("sats-user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        setMode("app");
        const savedLayout = localStorage.getItem(`layoutView_${parsed.id}`);
        if (savedLayout) setLayoutView(savedLayout);
      } catch (e) {
        console.error("Failed to parse stored user", e);
      }
    }
    setSidebarOpen(false);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [user]);

  useEffect(() => {
    if (currentView === 'chat') {
      localStorage.setItem('lastMessageViewTime', Date.now().toString());
    }
  }, [currentView]);

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", user?.connectionId],
    queryFn: () => fetchTasks(user!.connectionId),
    enabled: !!user?.connectionId,
    refetchInterval: 15000,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events", user?.connectionId],
    queryFn: () => fetchFamilyEvents(user!.connectionId),
    enabled: !!user?.connectionId,
  });

  const createTaskMutation = useMutation({
    mutationFn: createTask,
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Aufgabe erstellt", description: "Warte auf Bestätigung" });
      setNewTask({ title: "", description: "", sats: 50 });
      setCurrentView("dashboard");
    },
    onError: (error) => {
      toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Partial<Task> }) => updateTask(id, updates),
    onSuccess: (updatedTask) => {
      // If task is approved, reduce parent balance by sats amount
      if (updatedTask.status === "approved") {
        setUser(prev => prev ? { ...prev, balance: (prev.balance || 0) - updatedTask.sats } : null);
        if (user) {
          const updatedUser = { ...user, balance: (user.balance || 0) - updatedTask.sats };
          localStorage.setItem("sats-user", JSON.stringify(updatedUser));
        }
      }
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["peers"] });
      queryClient.invalidateQueries({ queryKey: ["bitcoin-snapshots"] });
      queryClient.invalidateQueries({ queryKey: ["savings-snapshots"] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Aufgabe gelöscht", description: "Die Aufgabe wurde erfolgreich gelöscht" });
    },
    onError: (error) => {
      toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
    }
  });

  const createEventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setNewEvent({ title: "", description: "", location: "", startDate: "", endDate: "" });
      toast({ title: "Termin erstellt", description: "Der Familienkalender wurde aktualisiert" });
    },
    onError: (error) => {
      toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
    }
  });

  const deleteEventMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast({ title: "Termin gelöscht", description: "Der Termin wurde entfernt" });
    },
    onError: (error) => {
      toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
    }
  });

  // Allowances states
  const [allowanceChildId, setAllowanceChildId] = useState<number | null>(null);
  const [allowanceSats, setAllowanceSats] = useState("");
  const [allowanceFrequency, setAllowanceFrequency] = useState("weekly");
  const [isCreatingAllowance, setIsCreatingAllowance] = useState(false);

  const { data: allowances = [] } = useQuery({
    queryKey: ["allowances", user?.connectionId],
    queryFn: async () => {
      const res = await fetch(`/api/allowances/${user!.connectionId}`);
      if (!res.ok) throw new Error("Failed to fetch allowances");
      return res.json();
    },
    refetchInterval: 5000,
    enabled: user?.role === "parent" && !!user?.connectionId
  });

  const { data: parentChildren = [] } = useQuery({
    queryKey: ["parent-children", user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/parent/${user!.id}/children`);
      if (!res.ok) throw new Error("Failed to fetch children");
      return res.json();
    },
    refetchInterval: 5000,
    enabled: user?.role === "parent"
  });

  const handleCreateAllowance = async () => {
    if (!allowanceChildId || !allowanceSats || !user) return;
    setIsCreatingAllowance(true);
    try {
      const res = await fetch("/api/allowances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentId: user.id,
          childId: allowanceChildId,
          connectionId: user.connectionId,
          sats: parseInt(allowanceSats),
          frequency: allowanceFrequency
        }),
      });
      if (!res.ok) throw new Error("Failed to create allowance");
      toast({ title: "Erfolg", description: "Taschengeld hinzugefügt!" });
      queryClient.invalidateQueries({ queryKey: ["allowances"] });
      setAllowanceChildId(null);
      setAllowanceSats("");
      setAllowanceFrequency("weekly");
    } catch (error) {
      toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsCreatingAllowance(false);
    }
  };

  const handleDeleteAllowance = async (allowanceId: number) => {
    try {
      const res = await fetch(`/api/allowances/${allowanceId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete allowance");
      toast({ title: "Erfolg", description: "Taschengeld gelöscht!" });
      queryClient.invalidateQueries({ queryKey: ["allowances"] });
    } catch (error) {
      toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
    }
  };

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setMode("auth");
  };

  const handleAuthComplete = (newUser: User) => {
    setUser(newUser);
    setMode("app");
    setCurrentView("dashboard");
    localStorage.setItem("sats-user", JSON.stringify(newUser));
    toast({ title: "Willkommen!", description: `Hallo ${newUser.name}` });
  };

  const logout = () => {
    setUser(null);
    setMode("role-select");
    setSelectedRole(null);
    localStorage.removeItem("sats-user");
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title || !user) return;

    if (newTask.sats <= 0) {
      toast({ title: "Fehler", description: "Belohnung muss größer als 0 sein", variant: "destructive" });
      return;
    }

    createTaskMutation.mutate({
      connectionId: user.connectionId,
      createdBy: user.id,
      title: newTask.title,
      description: newTask.description,
      sats: newTask.sats,
      status: "open",
    });
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

  const approveTask = async (taskId: number) => {
    // Prevent double-click: If already approving this task, ignore
    if (approvingTaskId === taskId) {
      console.log(`[Frontend] Ignoring duplicate approval click for task ${taskId}`);
      return;
    }
    
    // Set approving state immediately to block further clicks
    setApprovingTaskId(taskId);
    
    try {
      updateTaskMutation.mutate({
        id: taskId,
        updates: { status: "approved" },
      });
      toast({ title: "🎉⚡ Sats ausgezahlt!", description: "Die Transaktion wurde erfolgreich gesendet! 🚀" });
    } finally {
      // Reset after a delay to allow mutation to complete
      setTimeout(() => setApprovingTaskId(null), 2000);
    }

    // Check for level bonus after approving task
    const task = tasks.find((t: Task) => t.id === taskId);
    if (task && task.assignedTo && user) {
      // Get updated completed tasks count
      const approvedTasks = tasks.filter((t: Task) => 
        t.assignedTo === task.assignedTo && 
        (t.status === "approved" || t.id === taskId)
      );
      const completedCount = approvedTasks.length;
      
      // Calculate current level (based on completed tasks)
      const getLevel = (completed: number) => {
        if (completed >= 30) return 10;
        if (completed >= 27) return 9;
        if (completed >= 24) return 8;
        if (completed >= 21) return 7;
        if (completed >= 18) return 6;
        if (completed >= 15) return 5;
        if (completed >= 12) return 4;
        if (completed >= 9) return 3;
        if (completed >= 6) return 2;
        if (completed >= 3) return 1;
        return 0;
      };
      
      const currentLevel = getLevel(completedCount);
      
      // Check and pay level bonus
      if (currentLevel > 0) {
        try {
          const bonusRes = await fetch("/api/level-bonus/check-and-pay", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              childId: task.assignedTo,
              currentLevel,
              connectionId: user.connectionId
            }),
          });
          
          if (bonusRes.ok) {
            const bonusData = await bonusRes.json();
            if (bonusData.bonusPaid) {
              toast({ 
                title: "🏆 Level-Bonus!", 
                description: `Level ${bonusData.level} erreicht: +${bonusData.sats} Sats Bonus!`,
                duration: 5000
              });
            }
          }
        } catch (error) {
          console.error("Level bonus check error:", error);
        }
      }
    }
  };

  const handleDeleteTask = (taskId: number) => {
    if (window.confirm("Aufgabe wirklich löschen?")) {
      deleteTaskMutation.mutate(taskId);
    }
  };

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title || !user || !newEvent.startDate) return;
    
    const startDate = new Date(newEvent.startDate);
    const endDate = newEvent.endDate ? new Date(newEvent.endDate) : undefined;
    
    createEventMutation.mutate({
      connectionId: user.connectionId,
      createdBy: user.id,
      title: newEvent.title,
      description: newEvent.description,
      location: newEvent.location,
      startDate: startDate,
      endDate: endDate,
      color: "primary",
      eventType: "appointment",
    });
  };

  const handleDeleteEvent = (eventId: number) => {
    if (window.confirm("Termin wirklich löschen?")) {
      deleteEventMutation.mutate(eventId);
    }
  };

  if (mode === "role-select") {
    return <RoleSelectionPage onSelect={handleRoleSelect} />;
  }

  if (mode === "auth" && selectedRole) {
    return (
      <AuthPage 
        role={selectedRole} 
        onComplete={handleAuthComplete}
        onBack={() => setMode("role-select")}
      />
    );
  }

  if (!user) return null;

  return (
    <div 
      className="min-h-screen text-foreground font-sans selection:bg-primary selection:text-primary-foreground flex bg-cover bg-center bg-no-repeat bg-fixed"
      style={{ backgroundImage: 'url(/background.png)' }}
    >
      <Sidebar 
        user={user} 
        setUser={setUser}
        currentView={currentView} 
        setCurrentView={setCurrentView}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onLogout={logout}
        layoutView={layoutView}
        setLayoutView={setLayoutView}
        side="right"
        tasksNotificationCount={tasks.filter((t: Task) => t.status === "submitted").length}
        chatNotificationCount={(() => {
          const lastMessageViewTime = localStorage.getItem('lastMessageViewTime') || '0';
          return messages?.filter((m: any) => 
            new Date(m.createdAt).getTime() > parseInt(lastMessageViewTime)
          ).length || 0;
        })()}
      />
      <main className="flex-1 overflow-auto relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="fixed right-4 top-4 z-50"
          data-testid="button-open-sidebar"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="px-4 py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${user.role}-${currentView}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {user.role === "parent" ? (
                <ParentDashboard
                  user={user}
                  setUser={setUser}
                  tasks={tasks}
                  events={events}
                  newTask={newTask} 
                  setNewTask={setNewTask}
                  newEvent={newEvent}
                  setNewEvent={setNewEvent}
                  currentView={currentView}
                  setCurrentView={setCurrentView}
                  onCreate={handleCreateTask}
                  onCreateEvent={handleCreateEvent}
                  onApprove={approveTask}
                  onDelete={handleDeleteTask}
                  onDeleteEvent={handleDeleteEvent}
                  approvingTaskId={approvingTaskId}
                  queryClient={queryClient}
                  layoutView={layoutView}
                  setLayoutView={setLayoutView}
                  showSpendingStats={showSpendingStats}
                  setShowSpendingStats={setShowSpendingStats}
                  spendingStats={spendingStats}
                  setSpendingStats={setSpendingStats}
                  messages={messages}
                  setMessages={setMessages}
                  newMessage={newMessage}
                  setNewMessage={setNewMessage}
                  isLoadingMessage={isLoadingMessage}
                  setIsLoadingMessage={setIsLoadingMessage}
                  allowances={allowances}
                  parentChildren={parentChildren}
                  allowanceChildId={allowanceChildId}
                  setAllowanceChildId={setAllowanceChildId}
                  allowanceSats={allowanceSats}
                  setAllowanceSats={setAllowanceSats}
                  allowanceFrequency={allowanceFrequency}
                  setAllowanceFrequency={setAllowanceFrequency}
                  isCreatingAllowance={isCreatingAllowance}
                  handleCreateAllowance={handleCreateAllowance}
                  handleDeleteAllowance={handleDeleteAllowance}
                />
              ) : (
                <ChildDashboard 
                  user={user}
                  setUser={setUser}
                  tasks={tasks}
                  events={events}
                  currentView={currentView}
                  setCurrentView={setCurrentView}
                  onAccept={acceptTask} 
                  onSubmit={submitProof}
                  onDeleteEvent={handleDeleteEvent}
                  queryClient={queryClient}
                  layoutView={layoutView}
                  setLayoutView={setLayoutView}
                  messages={messages}
                  setMessages={setMessages}
                  newMessage={newMessage}
                  setNewMessage={setNewMessage}
                  isLoadingMessage={isLoadingMessage}
                  setIsLoadingMessage={setIsLoadingMessage}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      {/* Allowances Management View */}
      {currentView === "allowances" && user.role === "parent" && (
        <motion.div
          key="allowances-view"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="w-full"
        >
          <div className="px-4 py-8 space-y-6 flex flex-col items-center">
            <div className="flex items-center gap-3 mb-8">
              <Button variant="outline" onClick={() => setCurrentView("allowance-payout")} className="gap-2" data-testid="button-back-to-dashboard">
                <ChevronLeft className="h-4 w-4" /> Zurück
              </Button>
            </div>

            <Card className="border-2 border-primary/40 bg-primary/5 w-full max-w-md">
              <CardHeader>
                <CardTitle>Neue Terminzahlung hinzufügen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="allowance-child">Kind</Label>
                  <select
                    id="allowance-child"
                    value={allowanceChildId || ""}
                    onChange={(e) => setAllowanceChildId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    data-testid="select-allowance-child"
                  >
                    <option value="">-- Kind wählen --</option>
                    {parentChildren.map((child: any) => (
                      <option key={child.id} value={child.id}>{child.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="allowance-sats">Betrag (Sats)</Label>
                  <Input
                    id="allowance-sats"
                    type="number"
                    placeholder="z.B. 100"
                    value={allowanceSats}
                    onChange={(e) => setAllowanceSats(e.target.value)}
                    data-testid="input-allowance-sats"
                  />
                </div>

                <div>
                  <Label htmlFor="allowance-freq">Turnus</Label>
                  <select
                    id="allowance-freq"
                    value={allowanceFrequency}
                    onChange={(e) => setAllowanceFrequency(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    data-testid="select-allowance-frequency"
                  >
                    <option value="daily">Täglich</option>
                    <option value="weekly">Wöchentlich</option>
                    <option value="biweekly">Zweiwöchentlich</option>
                    <option value="monthly">Monatlich</option>
                  </select>
                </div>

                <Button
                  onClick={handleCreateAllowance}
                  disabled={!allowanceChildId || !allowanceSats || isCreatingAllowance}
                  className="w-full bg-primary hover:bg-primary/90"
                  data-testid="button-create-allowance"
                >
                  {isCreatingAllowance ? "Wird gespeichert..." : "Hinzufügen"}
                </Button>
              </CardContent>
            </Card>

            {allowances.length > 0 && (
              <Card className="w-full max-w-md border border-border/50 bg-card/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Aktive Zahlungen ({allowances.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {allowances.map((allowance: any) => {
                    const child = parentChildren.find((c: any) => c.id === allowance.childId);
                    const freqLabels: Record<string, string> = {
                      daily: "Täglich",
                      weekly: "Wöchentlich",
                      biweekly: "Zweiwöchentlich",
                      monthly: "Monatlich",
                    };
                    const freqLabel = freqLabels[allowance.frequency as string] || allowance.frequency;

                    return (
                      <div
                        key={allowance.id}
                        className="p-4 rounded-xl border border-primary/20 bg-gradient-to-r from-violet-500/10 to-purple-500/10 flex items-center justify-between gap-3"
                        data-testid={`card-allowance-${allowance.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                            {child?.name?.[0] || "?"}
                          </div>
                          <div>
                            <p className="font-semibold">{child?.name || "Unbekannt"}</p>
                            <p className="text-sm text-primary font-medium">
                              {allowance.sats} Sats {freqLabel}
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleDeleteAllowance(allowance.id)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          data-testid={`button-delete-allowance-${allowance.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        </motion.div>
      )}

      {/* Allowance Payout View */}
      {currentView === "allowance-payout" && user.role === "parent" && (
        <AllowancePayoutView
          user={user}
          allowances={allowances}
          parentChildren={parentChildren}
          setCurrentView={setCurrentView}
          queryClient={queryClient}
        />
      )}

      {/* Notification Center View */}
      {currentView === "notifications" && (
        <NotificationCenterView
          user={user}
          tasks={tasks}
          messages={messages}
          allowances={allowances}
          parentChildren={parentChildren}
          setCurrentView={setCurrentView}
        />
      )}

      <Toaster />
    </div>
  );
}

function NotificationCenterView({ user, tasks, messages, allowances, parentChildren, setCurrentView }: any) {
  type NotificationItem = {
    id: string;
    type: "task" | "allowance" | "message";
    title: string;
    description: string;
    timestamp: Date;
    sats?: number;
  };

  const notifications: NotificationItem[] = [];

  const approvedTasks = tasks.filter((t: Task) => t.status === "approved");
  approvedTasks.forEach((task: Task) => {
    const child = parentChildren.find((c: any) => c.id === task.assignedTo);
    const taskTimestamp = task.updatedAt ? new Date(task.updatedAt) : 
                          task.createdAt ? new Date(task.createdAt) : new Date();
    notifications.push({
      id: `task-${task.id}`,
      type: "task",
      title: "Aufgabe genehmigt",
      description: `${task.title} - ${task.sats} Sats ${child ? `an ${child.name}` : "erhalten"}`,
      timestamp: taskTimestamp,
      sats: task.sats,
    });
  });

  allowances.forEach((allowance: any) => {
    const child = parentChildren.find((c: any) => c.id === allowance.childId);
    const freqLabels: Record<string, string> = {
      daily: "täglich",
      weekly: "wöchentlich",
      biweekly: "zweiwöchentlich",
      monthly: "monatlich",
    };
    notifications.push({
      id: `allowance-${allowance.id}`,
      type: "allowance",
      title: "Taschengeld aktiv",
      description: `${allowance.sats} Sats ${freqLabels[allowance.frequency] || allowance.frequency} für ${child?.name || "Kind"}`,
      timestamp: new Date(allowance.createdAt || Date.now()),
      sats: allowance.sats,
    });
  });

  const recentMessages = messages.slice(-5);
  recentMessages.forEach((msg: any) => {
    notifications.push({
      id: `message-${msg.id}`,
      type: "message",
      title: "Neue Nachricht",
      description: `${msg.senderName}: ${msg.content?.substring(0, 50)}${msg.content?.length > 50 ? "..." : ""}`,
      timestamp: new Date(msg.createdAt || Date.now()),
    });
  });

  notifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const getIcon = (type: "task" | "allowance" | "message") => {
    switch (type) {
      case "task":
        return (
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white">
            <CheckCircle className="h-5 w-5" />
          </div>
        );
      case "allowance":
        return (
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white">
            <Bitcoin className="h-5 w-5" />
          </div>
        );
      case "message":
        return (
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white">
            <MessageSquare className="h-5 w-5" />
          </div>
        );
    }
  };

  const getGradient = (type: "task" | "allowance" | "message") => {
    switch (type) {
      case "task":
        return "from-green-500/10 to-emerald-500/10";
      case "allowance":
        return "from-amber-500/10 to-orange-500/10";
      case "message":
        return "from-violet-500/10 to-purple-500/10";
    }
  };

  return (
    <motion.div
      key="notifications-view"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      <div className="px-4 py-8 space-y-6 flex flex-col items-center">
        <div className="flex items-center gap-3 mb-4 w-full max-w-md">
          <Button variant="outline" onClick={() => setCurrentView("dashboard")} className="gap-2" data-testid="button-back-to-dashboard">
            <ChevronLeft className="h-4 w-4" /> Zurück
          </Button>
        </div>

        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Aktivitäten</h2>
              <p className="text-sm text-muted-foreground">Deine letzten Ereignisse</p>
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <div className="h-16 w-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
                <Bell className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">Noch keine Aktivitäten vorhanden</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`p-4 rounded-xl border border-primary/20 bg-gradient-to-r ${getGradient(notification.type)} flex items-center gap-3`}
                  data-testid={`notification-${notification.id}`}
                >
                  {getIcon(notification.type)}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{notification.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{notification.description}</p>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(notification.timestamp, { addSuffix: true, locale: de })}
                  </p>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function AllowancePayoutView({ user, allowances, parentChildren, setCurrentView, queryClient }: any) {
  const { toast } = useToast();
  const [isProcessingPayout, setIsProcessingPayout] = useState(false);
  const [payoutTab, setPayoutTab] = useState<"plans" | "instant" | null>(null);
  const [adHocChildId, setAdHocChildId] = useState<number | null>(null);
  const [adHocSats, setAdHocSats] = useState("");
  const [adHocMessage, setAdHocMessage] = useState("");
  const paymentMethod = "lnbits";
  
  const { data: childrenWithAllowances = [], refetch: refetchAllowances } = useQuery({
    queryKey: ["children-with-allowances", user.id, user.connectionId],
    queryFn: async () => {
      const res = await fetch(`/api/parent/${user.id}/children-with-allowances/${user.connectionId}`);
      if (!res.ok) throw new Error("Failed to fetch children");
      return res.json();
    },
    enabled: user.role === "parent"
  });

  // Refetch when tab changes to "plans"
  useEffect(() => {
    if (payoutTab === "plans") {
      refetchAllowances();
    }
  }, [payoutTab, refetchAllowances]);

  const { data: allChildren = [] } = useQuery({
    queryKey: ["all-children", user.id],
    queryFn: async () => {
      const res = await fetch(`/api/parent/${user.id}/children`);
      if (!res.ok) throw new Error("Failed to fetch children");
      return res.json();
    },
    enabled: user.role === "parent"
  });

  const handlePayout = async (allowanceId: number, childId: number, sats: number) => {
    setIsProcessingPayout(true);
    try {
      const res = await fetch(`/api/parent/${user.id}/payout-allowance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowanceId, childId, sats, paymentMethod }),
      });
      if (!res.ok) throw new Error("Payout failed");
      const childName = childrenWithAllowances.find((c: any) => c.child.id === childId)?.child.name || "Kind";
      toast({ title: "Erfolg", description: `${sats} Sats an ${childName} gezahlt!` });
      queryClient.invalidateQueries({ queryKey: ["children-with-allowances"] });
    } catch (error) {
      toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsProcessingPayout(false);
    }
  };

  const handleDeleteAllowance = async (allowanceId: number) => {
    if (!confirm("Bist du sicher, dass du diese Terminzahlung löschen möchtest?")) return;
    
    try {
      const res = await fetch(`/api/allowances/${allowanceId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete allowance");
      toast({ title: "Erfolg", description: "Terminzahlung gelöscht!" });
      refetchAllowances();
    } catch (error) {
      toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
    }
  };

  const handleAdHocPayout = async () => {
    if (!adHocChildId || !adHocSats) {
      toast({ title: "Fehler", description: "Bitte Kind und Betrag auswählen", variant: "destructive" });
      return;
    }
    
    setIsProcessingPayout(true);
    try {
      const child = allChildren.find((c: any) => c.id === adHocChildId);
      if (!child?.lightningAddress) {
        throw new Error("Kind hat keine Lightning Adresse");
      }

      const res = await fetch(`/api/parent/${user.id}/payout-instant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          childId: adHocChildId, 
          sats: parseInt(adHocSats), 
          message: adHocMessage || undefined,
          paymentMethod 
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Zahlung fehlgeschlagen");
      }
      toast({ title: "Erfolg", description: `${adHocSats} Sats an ${child.name} gesendet!` });
      setAdHocChildId(null);
      setAdHocSats("");
      setAdHocMessage("");
      queryClient.invalidateQueries({ queryKey: ["children-with-allowances"] });
    } catch (error) {
      toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsProcessingPayout(false);
    }
  };

  return (
    <motion.div
      key="payout-view"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      <div className="px-4 py-8 space-y-6 flex flex-col items-center">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="outline" onClick={() => setCurrentView("dashboard")} className="gap-2" data-testid="button-back-to-dashboard">
            <ChevronLeft className="h-4 w-4" /> Zurück
          </Button>
        </div>


        {payoutTab === null ? (
          <div className="flex flex-col items-center justify-center gap-8 py-8 w-full">
            <h2 className="text-2xl font-bold text-center">Was möchtest du tun?</h2>
            <div className="flex flex-col gap-3 w-80 items-stretch">
              <Button 
                onClick={() => setPayoutTab("plans")}
                className="h-32 text-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 border-0"
                data-testid="button-choose-scheduled"
              >
                <div className="flex flex-col items-center gap-3">
                  <span className="text-3xl">📅</span>
                  <span className="text-base">Terminzahlung</span>
                </div>
              </Button>
              <Button 
                onClick={() => setPayoutTab("instant")}
                className="h-32 text-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 border-0"
                data-testid="button-choose-instant"
              >
                <div className="flex flex-col items-center gap-3">
                  <span className="text-3xl">⚡</span>
                  <span className="text-base">Sofortzahlung</span>
                </div>
              </Button>
            </div>
          </div>
        ) : (
          <>
            {payoutTab === "plans" && (
              <div className="space-y-4 w-full">
                <div className="text-center">
                  <Button 
                    onClick={() => setCurrentView("allowances")}
                    className="bg-primary hover:bg-primary/90"
                    data-testid="button-create-new-allowance"
                  >
                    + Neue Terminzahlung erstellen
                  </Button>
                </div>
                {childrenWithAllowances.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">Keine Kinder mit aktiven Zahlplänen vorhanden.</p>
                  </div>
                ) : (
                  childrenWithAllowances.map((item: any) => (
                    <div key={item.child.id} className="border border-border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
                            {item.child.name[0]}
                          </div>
                          <div>
                            <p className="font-semibold">{item.child.name}</p>
                            <p className="text-xs text-muted-foreground">⚡ {item.child.lightningAddress || "Keine Adresse"}</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {item.allowances.map((allowance: any) => (
                          <div key={allowance.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded">
                            <div>
                              <p className="font-semibold text-primary">{allowance.sats} Sats</p>
                              <p className="text-xs text-muted-foreground">
                                {allowance.frequency === "daily" ? "Täglich" : 
                                 allowance.frequency === "weekly" ? "Wöchentlich" :
                                 allowance.frequency === "biweekly" ? "Zweiwöchentlich" : "Monatlich"}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handlePayout(allowance.id, item.child.id, allowance.sats)}
                                disabled={!item.child.lightningAddress || isProcessingPayout}
                                size="sm"
                                className="bg-primary hover:bg-primary/90"
                                data-testid={`button-payout-${allowance.id}`}
                              >
                                {isProcessingPayout ? "..." : "Zahlen"}
                              </Button>
                              <Button
                                onClick={() => handleDeleteAllowance(allowance.id)}
                                size="sm"
                                variant="destructive"
                                data-testid={`button-delete-allowance-${allowance.id}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {payoutTab === "instant" && (
              <div className="space-y-4 max-w-md mx-auto w-full">
                <div>
                  <Label htmlFor="adhoc-child" className="text-sm font-semibold mb-2 block">Kind auswählen</Label>
                  <select
                    id="adhoc-child"
                    value={adHocChildId || ""}
                    onChange={(e) => setAdHocChildId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    data-testid="select-adhoc-child"
                  >
                    <option value="">-- Kind wählen --</option>
                    {allChildren.map((child: any) => (
                      <option key={child.id} value={child.id}>
                        {child.name} {child.lightningAddress ? "✓" : "⚠️"}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">⚠️ = Keine Lightning Adresse konfiguriert</p>
                </div>

                <div>
                  <Label htmlFor="adhoc-sats" className="text-sm font-semibold mb-2 block">Betrag (Sats)</Label>
                  <Input
                    id="adhoc-sats"
                    type="number"
                    placeholder="z.B. 500"
                    value={adHocSats}
                    onChange={(e) => setAdHocSats(e.target.value)}
                    data-testid="input-adhoc-sats"
                    className="text-lg"
                  />
                </div>

                <div>
                  <Label htmlFor="adhoc-message" className="text-sm font-semibold mb-2 block">Nachricht (optional)</Label>
                  <Input
                    id="adhoc-message"
                    type="text"
                    placeholder="z.B. Taschengeld extra"
                    value={adHocMessage}
                    onChange={(e) => setAdHocMessage(e.target.value)}
                    data-testid="input-adhoc-message"
                    className="text-sm"
                  />
                </div>

                <Button
                  onClick={handleAdHocPayout}
                  disabled={!adHocChildId || !adHocSats || isProcessingPayout}
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
                  data-testid="button-send-adhoc"
                >
                  {isProcessingPayout ? "⏳ Wird gesendet..." : "💚 Jetzt senden"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

function Sidebar({ user, setUser, currentView, setCurrentView, sidebarOpen, setSidebarOpen, onLogout, layoutView, setLayoutView, tasksNotificationCount = 0, chatNotificationCount = 0 }: any) {
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showWalletSubmenu, setShowWalletSubmenu] = useState(false);
  const [showCalendarSubmenu, setShowCalendarSubmenu] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<"ansicht" | "wallet" | "peers" | null>(null);
  const [walletTab, setWalletTab] = useState("lnbits");
  
  const [showTasksSubmenu, setShowTasksSubmenu] = useState(false);
  
  const menuItems = [
    { id: "dashboard", label: user.role === "parent" ? "Dashboard" : "Mein Dashboard", icon: Home, badge: 0 },
    ...(user.role === "parent" ? [{ id: "tasks", label: "Aufgaben", icon: CheckCircle, badge: tasksNotificationCount, submenu: true }] : []),
    ...(user.role === "parent" ? [{ id: "children-overview", label: "Kinder-Übersicht", icon: Users, badge: 0 }] : []),
    { id: "calendar", label: "Familienkalender", icon: Calendar, badge: 0 },
    { id: "chat", label: "Familienchat", icon: MessageSquare, badge: chatNotificationCount },
    { id: "notifications", label: "Aktivitäten", icon: Bell, badge: 0 },
    { id: "leaderboard", label: "Bestenliste", icon: Trophy, badge: 0 },
    ...(user.role === "child" ? [{ id: "bitcoin-education", label: "Bitcoin Lernen", icon: BookOpen, badge: 0 }] : []),
  ];

  const handleSettingsClick = (tab: "ansicht" | "wallet" | "peers") => {
    setActiveSettingsTab(tab);
  };

  return (
    <>
      {activeSettingsTab && (
        <SettingsModal 
          user={user} 
          setUser={setUser}
          activeTab={activeSettingsTab}
          walletTab={walletTab}
          setWalletTab={setWalletTab}
          onClose={() => setActiveSettingsTab(null)}
          layoutView={layoutView}
          setLayoutView={setLayoutView}
        />
      )}
      <motion.aside
        initial={{ x: 250 }}
        animate={{ x: sidebarOpen ? 0 : 250 }}
        transition={{ duration: 0.3 }}
        className="fixed right-0 top-0 h-screen w-64 bg-white/15 backdrop-blur-xl border-l border-white/50 z-40 flex flex-col pointer-events-none shadow-2xl"
        style={{ pointerEvents: sidebarOpen ? "auto" : "none" }}
      >
        <div className="p-4 border-b border-white/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-8 w-8 bg-yellow-400/30 rounded-lg flex items-center justify-center text-amber-600 text-lg">
              ⚡
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="md:hidden text-slate-800"
              data-testid="button-close-sidebar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-widest text-slate-600 font-semibold">Familie</p>
            <h2 className="text-2xl font-bold text-slate-900">{user.familyName || "Family"}</h2>
            <div className="flex items-center gap-2 pt-2">
              <div className="h-8 w-8 rounded-full bg-violet-500/30 text-violet-700 flex items-center justify-center font-bold text-sm">
                {user.name[0]}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">{user.name}</p>
                <p className="text-xs text-slate-600 capitalize">{user.role === "child" ? "Kind" : "Eltern"}</p>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            
            // Tasks Dropdown (Parent only)
            if (item.id === "tasks" && user.role === "parent") {
              const isTasksActive = currentView === "tasks" || currentView === "recurring-tasks";
              return (
                <div key={item.id}>
                  <button
                    onClick={() => setShowTasksSubmenu(!showTasksSubmenu)}
                    className={`w-full px-4 py-2 rounded-xl flex items-center gap-2 transition-colors ${
                      isTasksActive
                        ? "bg-violet-500/40 text-slate-900 font-medium"
                        : "text-slate-700 hover:bg-white/20"
                    }`}
                    data-testid="menu-item-tasks"
                  >
                    <div className="relative">
                      <Icon className="h-4 w-4" />
                      <NotificationBadge count={item.badge} />
                    </div>
                    <span>{item.label}</span>
                    <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${showTasksSubmenu ? "rotate-180" : ""}`} />
                  </button>
                  
                  {showTasksSubmenu && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="ml-4 mt-1 space-y-1">
                      <button
                        onClick={() => {
                          setCurrentView("tasks");
                          setSidebarOpen(false);
                        }}
                        className={`w-full px-4 py-2 rounded-lg text-sm transition-colors text-left ${
                          currentView === "tasks"
                            ? "bg-violet-500/40 text-slate-900 font-medium"
                            : "text-slate-700 hover:bg-white/20"
                        }`}
                        data-testid="submenu-tasks-normal"
                      >
                        Normale Aufgaben
                      </button>
                      <button
                        onClick={() => {
                          setCurrentView("recurring-tasks");
                          setSidebarOpen(false);
                        }}
                        className={`w-full px-4 py-2 rounded-lg text-sm transition-colors text-left ${
                          currentView === "recurring-tasks"
                            ? "bg-violet-500/40 text-slate-900 font-medium"
                            : "text-slate-700 hover:bg-white/20"
                        }`}
                        data-testid="submenu-tasks-recurring"
                      >
                        Wiederkehrende Aufgaben
                      </button>
                    </motion.div>
                  )}
                </div>
              );
            }
            
            // Calendar Dropdown
            if (item.id === "calendar") {
              const isCalendarActive = currentView === "calendar-create" || currentView === "calendar-view";
              return (
                <div key={item.id}>
                  <button
                    onClick={() => setShowCalendarSubmenu(!showCalendarSubmenu)}
                    className={`w-full px-4 py-2 rounded-xl flex items-center gap-2 transition-colors ${
                      isCalendarActive
                        ? "bg-violet-500/40 text-slate-900 font-medium"
                        : "text-slate-700 hover:bg-white/20"
                    }`}
                    data-testid="menu-item-calendar"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                    <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${showCalendarSubmenu ? "rotate-180" : ""}`} />
                  </button>
                  
                  {showCalendarSubmenu && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="ml-4 mt-1 space-y-1">
                      <button
                        onClick={() => {
                          setCurrentView("calendar-create");
                          setSidebarOpen(false);
                        }}
                        className={`w-full px-4 py-2 rounded-lg text-sm transition-colors text-left ${
                          currentView === "calendar-create"
                            ? "bg-violet-500/40 text-slate-900 font-medium"
                            : "text-slate-700 hover:bg-white/20"
                        }`}
                        data-testid="submenu-calendar-create"
                      >
                        Termin anlegen
                      </button>
                      <button
                        onClick={() => {
                          setCurrentView("calendar-view");
                          setSidebarOpen(false);
                        }}
                        className={`w-full px-4 py-2 rounded-lg text-sm transition-colors text-left ${
                          currentView === "calendar-view"
                            ? "bg-violet-500/40 text-slate-900 font-medium"
                            : "text-slate-700 hover:bg-white/20"
                        }`}
                        data-testid="submenu-calendar-view"
                      >
                        Termine ansehen
                      </button>
                    </motion.div>
                  )}
                </div>
              );
            }
            
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full px-4 py-2 rounded-xl flex items-center gap-2 transition-colors ${
                  isActive
                    ? "bg-violet-500/40 text-slate-900 font-medium"
                    : "text-slate-700 hover:bg-white/20"
                }`}
                data-testid={`menu-item-${item.id}`}
              >
                <div className="relative">
                  <Icon className="h-4 w-4" />
                  <NotificationBadge count={item.badge} />
                </div>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/20">
          <div className="relative">
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className="w-full px-4 py-2 rounded-xl flex items-center gap-2 transition-colors text-slate-700 hover:bg-white/20"
              data-testid="menu-item-settings"
            >
              <Settings className="h-4 w-4" />
              <span>Einstellungen</span>
              <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${showSettingsMenu ? "rotate-180" : ""}`} />
            </button>
            
            {showSettingsMenu && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="ml-4 mt-1 space-y-1 relative z-50">
                {/* Ansicht */}
                <button
                  onClick={() => { handleSettingsClick("ansicht"); setSidebarOpen(false); }}
                  className="w-full px-4 py-2 rounded-lg text-sm text-slate-700 hover:bg-white/20 transition-colors text-left"
                  data-testid="submenu-ansicht"
                >
                  Ansicht
                </button>

                {/* Wallet Einstellung - Parent or Child */}
                {user.role === "parent" ? (
                  <div>
                    <button
                      onClick={() => setShowWalletSubmenu(!showWalletSubmenu)}
                      className="w-full px-4 py-2 rounded-lg text-sm text-slate-700 hover:bg-white/20 transition-colors text-left flex items-center justify-between"
                      data-testid="submenu-wallet"
                    >
                      <span>Wallet Einstellung</span>
                      <ChevronDown className={`h-3 w-3 transition-transform ${showWalletSubmenu ? "rotate-180" : ""}`} />
                    </button>
                    
                    {showWalletSubmenu && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="ml-6 mt-1 space-y-1">
                        <button
                          onClick={() => { setWalletTab("lnbits"); handleSettingsClick("wallet"); setSidebarOpen(false); }}
                          className="w-full px-4 py-2 rounded-lg text-xs text-slate-700 hover:bg-white/20 transition-colors text-left"
                          data-testid="submenu-wallet-lnbits"
                        >
                          LNbits Anbindung
                        </button>
                        <button
                          onClick={() => { setWalletTab("nwc"); handleSettingsClick("wallet"); setSidebarOpen(false); }}
                          className="w-full px-4 py-2 rounded-lg text-xs text-slate-700 hover:bg-white/20 transition-colors text-left"
                          data-testid="submenu-wallet-nwc"
                        >
                          NWC Anbindung
                        </button>
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => { handleSettingsClick("wallet"); setSidebarOpen(false); }}
                    className="w-full px-4 py-2 rounded-lg text-sm text-slate-700 hover:bg-white/20 transition-colors text-left"
                    data-testid="submenu-wallet-child"
                  >
                    Wallet Einstellung
                  </button>
                )}

                {/* Peers */}
                <button
                  onClick={() => { handleSettingsClick("peers"); setSidebarOpen(false); }}
                  className="w-full px-4 py-2 rounded-lg text-sm text-slate-700 hover:bg-white/20 transition-colors text-left"
                  data-testid="submenu-peers"
                >
                  Peers
                </button>

                {/* Level-Bonus - nur für Eltern */}
                {user.role === "parent" && (
                  <button
                    onClick={() => { setCurrentView("level-bonus-settings"); setSidebarOpen(false); setShowSettingsMenu(false); }}
                    className="w-full px-4 py-2 rounded-lg text-sm text-slate-700 hover:bg-white/20 transition-colors text-left"
                    data-testid="submenu-level-bonus"
                  >
                    Level-Bonus
                  </button>
                )}
              </motion.div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-white/20">
          <Button
            variant="outline"
            size="sm"
            onClick={onLogout}
            className="w-full gap-2 bg-red-500/20 border-red-500/40 text-red-700 hover:bg-red-500/30 hover:text-red-800"
            data-testid="button-logout-sidebar"
          >
            <LogOut className="h-4 w-4" /> Abmelden
          </Button>
        </div>
      </motion.aside>
    </>
  );
}

function RoleSelectionPage({ onSelect }: { onSelect: (role: UserRole) => void }) {
  return (
    <div 
      className="min-h-screen flex flex-col items-center p-6 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: 'url(/background.png)' }}
    >
      {/* Logo */}
      <div className="pt-8 mb-4">
        <img 
          src="/logo-transparent.png" 
          alt="KID⚡APP - Family Organizer" 
          className="max-w-[340px] w-full h-auto"
        />
      </div>
      
      {/* Center content - pushed more to middle */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md gap-4 -mt-12">
        
        {/* Info Box */}
        <div className="bg-white/15 backdrop-blur-md border border-white/50 rounded-2xl p-5 w-full shadow-lg">
          <h3 className="text-lg font-bold mb-3 text-slate-900">So funktioniert's</h3>
          <div className="space-y-2 text-slate-800 text-sm">
            <div className="flex gap-2">
              <span className="text-violet-600 flex-shrink-0">•</span>
              <span>Eltern erstellen Aufgaben mit Sats-Belohnung</span>
            </div>
            <div className="flex gap-2">
              <span className="text-violet-600 flex-shrink-0">•</span>
              <span>Kinder erledigen Aufgaben & laden Foto-Beweis hoch</span>
            </div>
            <div className="flex gap-2">
              <span className="text-violet-600 flex-shrink-0">•</span>
              <span>Eltern bestätigen & zahlen sofort aus</span>
            </div>
            <div className="flex gap-2">
              <span className="text-violet-600 flex-shrink-0">•</span>
              <span>Familienkalender & Chat für direkten Austausch</span>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="w-full space-y-3">
        <button 
          className="w-full p-4 bg-white/25 backdrop-blur-md border border-white/40 rounded-2xl hover:bg-white/35 hover:border-white/60 transition-all flex items-center gap-4 group shadow-xl"
          onClick={() => onSelect("parent")}
          data-testid="button-select-parent"
        >
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
            <UserIcon className="h-6 w-6 text-white" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-lg text-slate-900 tracking-wide">ELTERN</h3>
            <p className="text-sm text-slate-700">Aufgaben & Wallet verwalten</p>
          </div>
          <span className="ml-auto text-amber-600 text-xl opacity-0 group-hover:opacity-100 transition-opacity">⚡</span>
        </button>

        <button 
          className="w-full p-4 bg-white/25 backdrop-blur-md border border-white/40 rounded-2xl hover:bg-white/35 hover:border-white/60 transition-all flex items-center gap-4 group shadow-xl"
          onClick={() => onSelect("child")}
          data-testid="button-select-child"
        >
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-lg text-slate-900 tracking-wide">KIND</h3>
            <p className="text-sm text-slate-700">Aufgaben erledigen & Sats verdienen</p>
          </div>
          <span className="ml-auto text-amber-600 text-xl opacity-0 group-hover:opacity-100 transition-opacity">⚡</span>
        </button>
        </div>
      </div>
    </div>
  );
}

function AuthPage({ role, onComplete, onBack }: { role: UserRole; onComplete: (user: User) => void; onBack: () => void }) {
  const [name, setName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [favoriteColor, setFavoriteColor] = useState("");
  const [joinParentId, setJoinParentId] = useState("");
  const [pin, setPin] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [parentMode, setParentMode] = useState<"new" | "join" | null>(null);
  const [showForgotPin, setShowForgotPin] = useState(false);
  const [forgotPinName, setForgotPinName] = useState("");
  const [forgotPinColor, setForgotPinColor] = useState("");
  const [forgotPinNewPin, setForgotPinNewPin] = useState("");
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const { toast } = useToast();

  const handleForgotPin = async () => {
    if (!forgotPinName.trim() || !forgotPinColor.trim() || !forgotPinNewPin) {
      toast({ title: "Fehler", description: "Bitte alle Felder ausfüllen", variant: "destructive" });
      return;
    }
    const passwordCheck = validatePassword(forgotPinNewPin);
    if (!passwordCheck.valid) {
      toast({ title: "Fehler", description: passwordCheck.error, variant: "destructive" });
      return;
    }
    setIsForgotLoading(true);
    try {
      // Secure password reset - verify and update in one step, no password returned
      const res = await fetch("/api/peers/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: forgotPinName.trim(), 
          favoriteColor: forgotPinColor.trim(), 
          role: "parent",
          newPassword: forgotPinNewPin
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast({ title: "✅ Passwort zurückgesetzt!", description: "Melde dich jetzt mit deinem neuen Passwort an" });
      setShowForgotPin(false);
      setForgotPinName("");
      setForgotPinColor("");
      setForgotPinNewPin("");
      setPin(forgotPinNewPin);
      setName(forgotPinName.trim());
    } catch (error) {
      toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const trimmedName = name.trim();
    const trimmedPin = pin.trim();
    const trimmedFamilyName = familyName.trim();
    const trimmedJoinParentId = joinParentId.trim();
    
    if (!trimmedName || !trimmedPin) {
      toast({
        title: "Fehler",
        description: "Bitte fülle alle Felder aus",
        variant: "destructive"
      });
      return;
    }
    
    // Validate password for registration only
    if (!isLogin) {
      const passwordCheck = validatePassword(trimmedPin);
      if (!passwordCheck.valid) {
        toast({
          title: "Fehler",
          description: passwordCheck.error,
          variant: "destructive"
        });
        return;
      }
    }

    if (!isLogin && role === "parent" && parentMode === "new" && !trimmedFamilyName) {
      toast({
        title: "Fehler",
        description: "Bitte gib den Familiennamen ein",
        variant: "destructive"
      });
      return;
    }

    if (!isLogin && role === "parent" && parentMode === "new" && !favoriteColor.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte gib deine Lieblingsfarbe ein",
        variant: "destructive"
      });
      return;
    }

    if (!isLogin && role === "parent" && parentMode === "join" && !trimmedJoinParentId) {
      toast({
        title: "Fehler",
        description: "Bitte gib die Familien-ID des anderen Elternteils ein",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    try {
      console.log("Versuche", isLogin ? "Login" : "Registrierung", { name: trimmedName, role, pin: trimmedPin });
      const response = isLogin 
        ? await loginUser(trimmedName, role, trimmedPin)
        : await registerUser(
            trimmedName, 
            role, 
            trimmedPin, 
            role === "parent" && parentMode === "new" ? trimmedFamilyName : undefined,
            role === "parent" && parentMode === "join" ? trimmedJoinParentId : undefined,
            role === "parent" ? favoriteColor : undefined
          );
      
      const user = response as User;

      
      console.log("Erfolg:", user);
      
      toast({
        title: isLogin ? "Willkommen!" : "Account erstellt! ✅",
        description: isLogin ? "Du bist angemeldet" : "Dein Account wurde erstellt!"
      });
      onComplete(user);
    } catch (error) {
      console.error("Fehler:", error);
      toast({
        title: "Fehler",
        description: (error as Error).message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };


  // Wenn Parent registriert sich und muss Modus wählen
  if (!isLogin && role === "parent" && parentMode === null) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/background.png)' }}
      >
        <div className="w-full max-w-lg">
          <div className="space-y-4 mb-8">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onBack} 
              className="w-fit mb-2 -ml-2 text-slate-700 hover:text-slate-900 hover:bg-white/20"
              data-testid="button-back"
            >
              ← Zurück
            </Button>
            <div>
              <h1 className="text-2xl font-bold mb-2 text-slate-900">Familie auswählen</h1>
              <p className="text-slate-700">Möchtest du eine neue Familie gründen oder einer bestehenden beitreten?</p>
            </div>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => setParentMode("new")}
              className="w-full h-auto px-4 py-4 bg-white/50 backdrop-blur-xl border border-white/50 rounded-2xl hover:bg-white/60 transition-all flex items-center text-left shadow-lg"
              data-testid="button-create-new-family"
            >
              <div className="mr-3 h-10 w-10 rounded-full bg-violet-500/30 flex items-center justify-center flex-shrink-0">
                <Plus className="h-5 w-5 text-violet-700" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">Neue Familie gründen</p>
                <p className="text-xs text-slate-700">Erstelle eine neue Familie</p>
              </div>
            </button>
            <button
              onClick={() => setParentMode("join")}
              className="w-full h-auto px-4 py-4 bg-white/50 backdrop-blur-xl border border-white/50 rounded-2xl hover:bg-white/60 transition-all flex items-center text-left shadow-lg"
              data-testid="button-join-family"
            >
              <div className="mr-3 h-10 w-10 rounded-full bg-cyan-500/30 flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-cyan-700" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">Familie beitreten</p>
                <p className="text-xs text-slate-700">Beitreten mit Familie-ID</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: 'url(/background.png)' }}
    >
      <div className="w-full max-w-lg">
        <div className="space-y-6 mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              if (!isLogin && role === "parent") {
                setParentMode(null);
              } else {
                onBack();
              }
            }}
            className="w-fit mb-2 -ml-2 text-slate-700 hover:text-slate-900 hover:bg-white/20"
            data-testid="button-back"
          >
            ← Zurück
          </Button>
          <div>
            <h2 className="text-2xl font-bold mb-2 text-slate-900">
              {isLogin ? "Anmelden" : "Registrieren"}
            </h2>
            <p className="text-slate-700">
              {isLogin ? "Melde dich mit Name und Passwort an" : "Erstelle einen Account mit Name und Passwort"}
            </p>
          </div>
        </div>

        <div className="bg-white/50 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-xl space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && role === "parent" && parentMode === "new" && (
              <div className="space-y-2">
                <Label htmlFor="familyName" className="text-slate-800">Familienname</Label>
                <Input 
                  id="familyName"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  className="bg-white/50 border-white/60 focus:border-violet-500 focus:bg-white/70 text-slate-900 placeholder:text-gray-500"
                  disabled={isLoading}
                  autoComplete="off"
                  placeholder="z.B. Familie Müller"
                  data-testid="input-family-name"
                />
              </div>
            )}
            {!isLogin && role === "parent" && parentMode === "join" && (
              <div className="space-y-2">
                <Label htmlFor="joinParentId" className="text-slate-800">Familien-ID</Label>
                <Input 
                  id="joinParentId"
                  value={joinParentId}
                  onChange={(e) => setJoinParentId(e.target.value.toUpperCase())}
                  className="bg-white/50 border-white/60 focus:border-violet-500 focus:bg-white/70 text-slate-900 placeholder:text-gray-500 font-mono text-center"
                  disabled={isLoading}
                  autoComplete="off"
                  placeholder="z.B. BTC-ABC123"
                  data-testid="input-join-parent-id"
                />
                <p className="text-xs text-slate-600">Frag das andere Elternteil nach der Familie-ID</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-800">Dein Name</Label>
              <Input 
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-white/50 border-white/60 focus:border-violet-500 focus:bg-white/70 text-slate-900 placeholder:text-gray-500"
                disabled={isLoading}
                autoFocus
                autoComplete="off"
                data-testid="input-name"
              />
            </div>
            {!isLogin && role === "parent" && parentMode === "new" && (
              <div className="space-y-2">
                <Label htmlFor="favoriteColor" className="text-slate-800">Lieblingsfarbe (für Passwort-Vergessen)</Label>
                <Input 
                  id="favoriteColor"
                  value={favoriteColor}
                  onChange={(e) => setFavoriteColor(e.target.value)}
                  className="bg-white/50 border-white/60 focus:border-violet-500 focus:bg-white/70 text-slate-900 placeholder:text-gray-500"
                  disabled={isLoading}
                  autoComplete="off"
                  placeholder="z.B. Blau"
                  data-testid="input-favorite-color"
                />
                <p className="text-xs text-slate-600">Du kannst damit dein Passwort später zurücksetzen</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="pin" className="text-slate-800">{isLogin ? "Passwort" : "Passwort (8-12 Zeichen)"}</Label>
              <Input 
                id="pin"
                type="password"
                placeholder={isLogin ? "••••••••" : "Min. 8 Zeichen, 1 Großbuchstabe, 1 Zahl"}
                value={pin}
                onChange={(e) => setPin(e.target.value.slice(0, 12))}
                className="bg-white/50 border-white/60 focus:border-violet-500 focus:bg-white/70 text-slate-900 placeholder:text-gray-400"
                disabled={isLoading}
                maxLength={12}
                autoComplete="off"
                data-testid="input-pin"
              />
              {!isLogin && (
                <div className="text-xs text-slate-600 space-y-1">
                  <p className={pin.length >= 8 && pin.length <= 12 ? "text-green-600" : ""}>
                    {pin.length >= 8 && pin.length <= 12 ? "✓" : "○"} {pin.length}/8-12 Zeichen
                  </p>
                  <p className={/[A-Z]/.test(pin) ? "text-green-600" : ""}>
                    {/[A-Z]/.test(pin) ? "✓" : "○"} Mindestens 1 Großbuchstabe
                  </p>
                  <p className={/[0-9]/.test(pin) ? "text-green-600" : ""}>
                    {/[0-9]/.test(pin) ? "✓" : "○"} Mindestens 1 Zahl
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-white/20 my-4"></div>

            <div className="space-y-2">
              <Button 
                type="submit"
                className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                disabled={isLoading || name.trim().length === 0 || pin.length === 0 || (!isLogin && !validatePassword(pin).valid) || (!isLogin && role === "parent" && parentMode === "new" && (!familyName.trim() || !favoriteColor.trim()))}
                data-testid={isLogin ? "button-login" : "button-register"}
              >
                {isLoading ? "Wird verarbeitet..." : isLogin ? "Anmelden" : "Registrieren"}
              </Button>
              <Button 
                type="button"
                variant="outline"
                className="w-full bg-white/30 border-white/40 text-slate-800 hover:bg-white/40"
                onClick={() => setIsLogin(!isLogin)}
                disabled={isLoading}
                data-testid="button-toggle-mode"
              >
                {isLogin ? "Noch kein Account? Registrieren" : "Bereits registriert? Anmelden"}
              </Button>
              {isLogin && role === "parent" && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-xs text-slate-600 hover:text-slate-900 hover:bg-white/20"
                  onClick={() => setShowForgotPin(true)}
                  disabled={isLoading}
                  data-testid="button-forgot-pin"
                >
                  Passwort vergessen?
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>

      {showForgotPin && (
        <Dialog open={showForgotPin} onOpenChange={setShowForgotPin}>
          <DialogContent className="sm:max-w-[450px] border-border bg-gradient-to-br from-gray-900 to-black shadow-2xl">
            <DialogHeader className="border-b border-border pb-4">
              <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
                  <span className="text-base">🔑</span>
                </div>
                Passwort zurücksetzen
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-5 pt-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-name" className="text-sm font-semibold">Name</Label>
                <Input 
                  id="forgot-name"
                  value={forgotPinName}
                  onChange={(e) => setForgotPinName(e.target.value)}
                  className="bg-secondary/50 border-border focus:border-primary"
                  disabled={isForgotLoading}
                  placeholder="Gib deinen Namen ein"
                  data-testid="input-forgot-pin-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="forgot-color" className="text-sm font-semibold">Lieblingsfarbe</Label>
                <Input 
                  id="forgot-color"
                  placeholder="z.B. Blau"
                  value={forgotPinColor}
                  onChange={(e) => setForgotPinColor(e.target.value)}
                  className="bg-secondary/50 border-border focus:border-primary"
                  disabled={isForgotLoading}
                  data-testid="input-forgot-pin-color"
                />
                <p className="text-xs text-muted-foreground">Die Farbe, die du bei der Registrierung angegeben hast</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="forgot-new-pin" className="text-sm font-semibold">Neues Passwort</Label>
                <Input 
                  id="forgot-new-pin"
                  type="password"
                  placeholder="8-12 Zeichen"
                  value={forgotPinNewPin}
                  onChange={(e) => setForgotPinNewPin(e.target.value.slice(0, 12))}
                  className="bg-secondary/50 border-border focus:border-primary"
                  disabled={isForgotLoading}
                  maxLength={12}
                  data-testid="input-forgot-pin-new"
                />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className={forgotPinNewPin.length >= 8 && forgotPinNewPin.length <= 12 ? "text-green-500" : ""}>
                    {forgotPinNewPin.length >= 8 && forgotPinNewPin.length <= 12 ? "✓" : "○"} {forgotPinNewPin.length}/8-12 Zeichen
                  </p>
                  <p className={/[A-Z]/.test(forgotPinNewPin) ? "text-green-500" : ""}>
                    {/[A-Z]/.test(forgotPinNewPin) ? "✓" : "○"} Mindestens 1 Großbuchstabe
                  </p>
                  <p className={/[0-9]/.test(forgotPinNewPin) ? "text-green-500" : ""}>
                    {/[0-9]/.test(forgotPinNewPin) ? "✓" : "○"} Mindestens 1 Zahl
                  </p>
                </div>
              </div>
              <div className="flex gap-3 pt-6 border-t border-border">
                <Button 
                  onClick={handleForgotPin}
                  disabled={isForgotLoading || !forgotPinName.trim() || !forgotPinColor.trim() || !validatePassword(forgotPinNewPin).valid}
                  className="flex-1 bg-primary hover:bg-primary/90 font-semibold"
                  data-testid="button-confirm-forgot-pin"
                >
                  {isForgotLoading ? "⏳ Wird verarbeitet..." : "✓ Passwort zurücksetzen"}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowForgotPin(false)}
                  disabled={isForgotLoading}
                  className="flex-1 border-border hover:bg-secondary/50"
                  data-testid="button-cancel-forgot-pin"
                >
                  Abbrechen
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function NavBar({ user, onLogout, onSettings }: { user: User; onLogout: () => void; onSettings?: () => void }) {
  return (
    <header className="bg-gradient-to-r from-gray-900 to-gray-950 backdrop-blur-md border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-[0_0_15px_rgba(247,147,26,0.5)]">
            <span className="text-lg">⚡</span>
          </div>
          <span className="text-xl font-heading font-bold hidden sm:inline-block tracking-tight">
            KID⚡APP
          </span>
        </div>

        <div className="flex items-center gap-4">
          {user.role === "child" && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-secondary border border-border">
              <Bitcoin className="h-4 w-4 text-primary" />
              <span className="text-sm font-mono font-bold text-primary" data-testid="text-balance">
                {(user.balance || 0).toLocaleString()} sats
              </span>
            </div>
          )}
          <div className="flex items-center gap-3 pl-4 pr-2 py-1.5 rounded-full bg-secondary border border-border">
            <span className="text-sm font-medium text-muted-foreground" data-testid="text-username">
              {user.name}
            </span>
            <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold border border-primary/50">
              {user.name[0]}
            </div>
          </div>
          {user.role === "parent" && onSettings && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onSettings} 
              className="text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
              data-testid="button-settings"
            >
              <Settings className="h-5 w-5" />
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onLogout} 
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
            data-testid="button-logout"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}

function ParentDashboardWithSettings({ user, setUser, currentView, onCreate, onCreateEvent, onApprove, onDelete, onDeleteEvent }: any) {
  const [showSettings, setShowSettings] = useState(false);
  
  return (
    <>
      {showSettings && <SettingsModal user={user} setUser={setUser} onClose={() => setShowSettings(false)} />}
      {currentView === "settings" && <SettingsModal user={user} setUser={setUser} onClose={() => {}} />}
    </>
  );
}

function PeersContent({ user, setUser, queryClient }: any) {
  const { toast } = useToast();
  const [resetPinChildId, setResetPinChildId] = useState<number | null>(null);
  const [resetPinValue, setResetPinValue] = useState("");
  const [showParentPinChange, setShowParentPinChange] = useState(false);
  const [oldParentPin, setOldParentPin] = useState("");
  const [newParentPin, setNewParentPin] = useState("");
  const [isSavingPin, setIsSavingPin] = useState(false);
  
  if (user.role === "parent") {
    // Parent view - show connected children
    const { data: connectedPeers = [] } = useQuery({
      queryKey: ["peers", user.connectionId],
      queryFn: async () => {
        const res = await fetch(`/api/peers/connection/${user.connectionId}`);
        if (!res.ok) throw new Error("Failed to fetch peers");
        return res.json();
      },
      refetchInterval: 2000
    });

    const parents = connectedPeers.filter((p: any) => p.role === "parent");
    const children = connectedPeers.filter((p: any) => p.role === "child");

    const handleUnlinkChild = async (childId: number, childName: string) => {
      if (!window.confirm(`Möchtest du ${childName} wirklich von der Familie trennen?`)) return;
      
      try {
        const res = await fetch("/api/peers/unlink", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ childId })
        });
        if (!res.ok) throw new Error("Failed to unlink");
        queryClient.invalidateQueries({ queryKey: ["peers", user.connectionId] });
        toast({ title: "Trennung erfolgreich", description: `${childName} wurde von der Familie getrennt` });
      } catch (error) {
        toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
      }
    };

    const handleResetPin = async (childId: number) => {
      const passwordCheck = validatePassword(resetPinValue);
      if (!passwordCheck.valid) {
        toast({ title: "Fehler", description: passwordCheck.error, variant: "destructive" });
        return;
      }

      try {
        const res = await fetch(`/api/peers/${childId}/reset-pin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parentId: user.id, newPin: resetPinValue }),
        });
        if (!res.ok) throw new Error("Passwort-Änderung fehlgeschlagen");
        setResetPinChildId(null);
        setResetPinValue("");
        queryClient.invalidateQueries({ queryKey: ["peers", user.connectionId] });
        toast({ title: "Erfolg", description: "Passwort wurde zurückgesetzt" });
      } catch (error) {
        toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
      }
    };

    const handleCopyConnectionId = async () => {
      try {
        await navigator.clipboard.writeText(user.connectionId);
        toast({ title: "Kopiert!", description: "Kopplungs-ID wurde in die Zwischenablage kopiert" });
      } catch (error) {
        toast({ title: "Fehler", description: "ID konnte nicht kopiert werden", variant: "destructive" });
      }
    };

    return (
      <div className="space-y-6">
        {/* Eltern Hierarchie */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase">👨‍👩‍👧 Familienstruktur</h3>
          
          {/* Eltern */}
          <div className="flex gap-3 justify-center">
            {parents.length > 0 ? (
              parents.map((parent: any, idx: number) => (
                <div key={parent.id} className="flex-1 max-w-xs">
                  <div className="p-3 rounded-lg bg-primary/10 border-2 border-primary/50 flex flex-col items-center text-center">
                    <div className="h-10 w-10 rounded-full bg-primary/30 text-primary flex items-center justify-center font-bold mb-2">
                      {parent.name[0]}
                    </div>
                    <p className="font-semibold text-sm">{parent.name}</p>
                    <p className="text-xs text-muted-foreground">Eltern</p>
                  </div>
                </div>
              ))
            ) : null}
          </div>

          {/* Verbindungslinie und Kinder */}
          {children.length > 0 && (
            <div className="space-y-3">
              {/* Verbindungslinie */}
              <div className="flex justify-center">
                <div className="h-6 w-0.5 bg-gradient-to-b from-primary/50 to-primary/20"></div>
              </div>

              {/* Kinder */}
              <div className="grid grid-cols-1 gap-3 pt-2">
                {children.map((child: any) => (
                  <div key={child.id} className="space-y-2">
                    <div className="p-3 rounded-lg bg-secondary border border-border/50 flex items-center justify-between group hover:bg-secondary/80 transition-colors">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {child.name[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{child.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {child.lightningAddress ? `⚡ ${child.lightningAddress}` : "⚠️ Keine Adresse"}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={() => setResetPinChildId(child.id)}
                          className="text-xs h-7"
                          data-testid={`button-reset-pin-${child.id}`}
                        >
                          🔑
                        </Button>
                        <Button 
                          variant="ghost"
                          size="icon"
                          onClick={() => handleUnlinkChild(child.id, child.name)}
                          className="text-destructive hover:text-destructive h-7 w-7"
                          data-testid={`button-unlink-child-${child.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {resetPinChildId === child.id && (
                      <div className="p-3 rounded-lg border-2 border-amber-500/50 bg-amber-500/10 space-y-2">
                        <p className="text-xs font-semibold">Neues Passwort für {child.name}:</p>
                        <Input
                          type="password"
                          maxLength={12}
                          placeholder="8-12 Zeichen"
                          value={resetPinValue}
                          onChange={(e) => setResetPinValue(e.target.value.slice(0, 12))}
                          className="text-sm"
                          data-testid="input-new-child-pin"
                        />
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <p className={resetPinValue.length >= 8 && resetPinValue.length <= 12 ? "text-green-500" : ""}>
                            {resetPinValue.length >= 8 && resetPinValue.length <= 12 ? "✓" : "○"} {resetPinValue.length}/8-12 Zeichen
                          </p>
                          <p className={/[A-Z]/.test(resetPinValue) ? "text-green-500" : ""}>
                            {/[A-Z]/.test(resetPinValue) ? "✓" : "○"} 1 Großbuchstabe
                          </p>
                          <p className={/[0-9]/.test(resetPinValue) ? "text-green-500" : ""}>
                            {/[0-9]/.test(resetPinValue) ? "✓" : "○"} 1 Zahl
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleResetPin(child.id)}
                            className="flex-1 bg-primary hover:bg-primary/90 text-xs h-7"
                            disabled={!validatePassword(resetPinValue).valid}
                            data-testid="button-confirm-reset-pin"
                          >
                            Passwort ändern
                          </Button>
                          <Button
                            onClick={() => {
                              setResetPinChildId(null);
                              setResetPinValue("");
                            }}
                            variant="outline"
                            className="flex-1 text-xs h-7"
                            data-testid="button-cancel-reset-pin"
                          >
                            Abbrechen
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {children.length === 0 && (
            <div className="text-center py-4 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
              <p>Noch keine Kinder verbunden</p>
              <p className="text-xs mt-1">Teile deinen Verbindungscode mit deinen Kindern</p>
            </div>
          )}
        </div>

        {/* Connection ID Box */}
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Kopplungs-ID für Kinder</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-secondary p-2 rounded font-mono break-all text-primary" data-testid="text-connection-id">
              {user.connectionId}
            </code>
            <Button 
              variant="ghost"
              size="icon"
              onClick={handleCopyConnectionId}
              className="h-8 w-8 flex-shrink-0"
              data-testid="button-copy-connection-id"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Teile diese ID mit deinen Kindern, um sie mit der Familie zu verbinden</p>
        </div>

        {/* Password Change Section for Parent */}
        <div className="space-y-3">
          <Button
            variant="outline"
            onClick={() => setShowParentPinChange(!showParentPinChange)}
            className="w-full text-sm"
            data-testid="button-toggle-parent-pin-change"
          >
            {showParentPinChange ? "Passwort-Änderung abbrechen" : "🔑 Mein Passwort ändern"}
          </Button>
          
          {showParentPinChange && (
            <div className="p-3 rounded-lg border-2 border-amber-500/50 bg-amber-500/10 space-y-2">
              <div className="space-y-2">
                <Label htmlFor="old-pin">Altes Passwort</Label>
                <Input
                  id="old-pin"
                  type="password"
                  maxLength={12}
                  placeholder="••••••••"
                  value={oldParentPin}
                  onChange={(e) => setOldParentPin(e.target.value)}
                  className="text-sm"
                  data-testid="input-old-parent-pin"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-pin">Neues Passwort (8-12 Zeichen)</Label>
                <Input
                  id="new-pin"
                  type="password"
                  maxLength={12}
                  placeholder="8-12 Zeichen"
                  value={newParentPin}
                  onChange={(e) => setNewParentPin(e.target.value.slice(0, 12))}
                  className="text-sm"
                  data-testid="input-new-parent-pin"
                />
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p className={newParentPin.length >= 8 && newParentPin.length <= 12 ? "text-green-500" : ""}>
                    {newParentPin.length >= 8 && newParentPin.length <= 12 ? "✓" : "○"} {newParentPin.length}/8-12 Zeichen
                  </p>
                  <p className={/[A-Z]/.test(newParentPin) ? "text-green-500" : ""}>
                    {/[A-Z]/.test(newParentPin) ? "✓" : "○"} 1 Großbuchstabe
                  </p>
                  <p className={/[0-9]/.test(newParentPin) ? "text-green-500" : ""}>
                    {/[0-9]/.test(newParentPin) ? "✓" : "○"} 1 Zahl
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    const passwordCheck = validatePassword(newParentPin);
                    if (!oldParentPin || !passwordCheck.valid) {
                      toast({ title: "Fehler", description: passwordCheck.error || "Bitte fülle beide Passwort-Felder aus", variant: "destructive" });
                      return;
                    }
                    setIsSavingPin(true);
                    try {
                      const res = await fetch(`/api/peers/${user.id}/change-pin`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ oldPin: oldParentPin, newPin: newParentPin }),
                      });
                      if (!res.ok) throw new Error("Passwort-Änderung fehlgeschlagen");
                      setShowParentPinChange(false);
                      setOldParentPin("");
                      setNewParentPin("");
                      toast({ title: "✅ Erfolg", description: "Dein Passwort wurde geändert" });
                    } catch (error) {
                      toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
                    } finally {
                      setIsSavingPin(false);
                    }
                  }}
                  className="flex-1 bg-primary hover:bg-primary/90 text-xs h-7"
                  disabled={isSavingPin || !validatePassword(newParentPin).valid}
                  data-testid="button-confirm-parent-pin-change"
                >
                  {isSavingPin ? "⏳ Wird gespeichert..." : "💾 Passwort ändern"}
                </Button>
                <Button
                  onClick={() => {
                    setShowParentPinChange(false);
                    setOldParentPin("");
                    setNewParentPin("");
                  }}
                  variant="outline"
                  className="flex-1 text-xs h-7"
                  disabled={isSavingPin}
                  data-testid="button-cancel-parent-pin-change"
                >
                  Abbrechen
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  } else {
    // Child view - show connected parent
    const { data: connectedPeers = [] } = useQuery({
      queryKey: ["peers", user.connectionId],
      queryFn: async () => {
        const res = await fetch(`/api/peers/connection/${user.connectionId}`);
        if (!res.ok) throw new Error("Failed to fetch peers");
        return res.json();
      },
      refetchInterval: 2000
    });

    const parent = connectedPeers
      .filter((p: any) => p.role === "parent")
      .sort((a: any, b: any) => a.id - b.id)[0];

    const handleUnlink = async () => {
      if (!window.confirm("Möchtest du dich wirklich von dieser Familie trennen?")) return;
      
      try {
        const res = await fetch("/api/peers/unlink", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ childId: user.id })
        });
        if (!res.ok) throw new Error("Failed to unlink");
        setUser(await res.json());
        queryClient.invalidateQueries({ queryKey: ["peers"] });
        toast({ title: "Trennung erfolgreich", description: "Du bist nicht mehr mit der Familie verbunden" });
      } catch (error) {
        toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
      }
    };

    return (
      <div className="space-y-3">
        {parent ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Verbunden mit</p>
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                {parent.name[0]}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">{parent.name}</p>
                <p className="text-xs text-muted-foreground">👨‍👩‍👧 Eltern</p>
              </div>
            </div>
            <Button 
              variant="outline"
              onClick={handleUnlink}
              className="w-full text-destructive hover:text-destructive text-sm h-8"
              data-testid="button-unlink-parent"
            >
              <X className="h-3 w-3 mr-2" /> Von Familie trennen
            </Button>
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <p>Nicht mit einer Familie verbunden</p>
            <p className="text-xs mt-1">Verbinde dich mit deinen Eltern</p>
          </div>
        )}
      </div>
    );
  }
}

function SettingsModal({ user, setUser, activeTab, walletTab, setWalletTab, onClose, layoutView, setLayoutView }: any) {
  const queryClient = useQueryClient();
  const [editLnbitsUrl, setEditLnbitsUrl] = useState("");
  const [editLnbitsAdminKey, setEditLnbitsAdminKey] = useState("");
  const [editNwcConnectionString, setEditNwcConnectionString] = useState("");
  const [editFamilyName, setEditFamilyName] = useState(user.familyName || "");
  const [showAdminKey, setShowAdminKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast: useToastFn } = useToast();

  // Sync state with user changes - credentials are never stored in user object
  useEffect(() => {
    setEditLnbitsUrl("");
    setEditLnbitsAdminKey("");
    setEditNwcConnectionString("");
    setEditFamilyName(user.familyName || "");
    setShowAdminKey(false);
  }, [user]);


  const testLNbits = async () => {
    if (!editLnbitsUrl || !editLnbitsAdminKey) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/wallet/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lnbitsUrl: editLnbitsUrl, lnbitsAdminKey: editLnbitsAdminKey }),
      });
      const data = await res.json();
      if (data.success) {
        useToastFn({ 
          title: "✓ Verbindung erfolgreich!", 
          description: `Funktioniert mit: ${data.workingEndpoint}` 
        });
      } else {
        useToastFn({ 
          title: "Verbindung fehlgeschlagen", 
          description: data.error, 
          variant: "destructive" 
        });
      }
    } catch (error) {
      useToastFn({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const saveLNbits = async () => {
    if (!editLnbitsUrl || !editLnbitsAdminKey) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/wallet/setup-lnbits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerId: user.id, lnbitsUrl: editLnbitsUrl, lnbitsAdminKey: editLnbitsAdminKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUser({ ...user, hasLnbitsConfigured: true });
      setEditLnbitsUrl("");
      setEditLnbitsAdminKey("");
      
      // Show success toast with longer duration
      useToastFn({ 
        title: "✅ LNbits erfolgreich gespeichert!", 
        description: "Wallet-Verbindung ist jetzt aktiv",
        duration: 3000
      });
      
      // Close modal after 1 second so user can see toast
      setTimeout(() => onClose(), 1500);
    } catch (error) {
      useToastFn({ 
        title: "❌ Fehler beim Speichern", 
        description: (error as Error).message, 
        variant: "destructive",
        duration: 5000
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteLNbits = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/wallet/lnbits", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUser({ ...user, hasLnbitsConfigured: false });
      
      useToastFn({ 
        title: "LNbits Verbindung getrennt", 
        description: "Die Wallet-Verbindung wurde entfernt",
        duration: 3000
      });
    } catch (error) {
      useToastFn({ 
        title: "Fehler", 
        description: (error as Error).message, 
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const saveNwc = async () => {
    if (!editNwcConnectionString || !editNwcConnectionString.startsWith("nostr+walletconnect://")) {
      useToastFn({ title: "Fehler", description: "Gültiger NWC Connection String erforderlich", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/wallet/setup-nwc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerId: user.id, nwcConnectionString: editNwcConnectionString }),
      });
      if (!res.ok) throw new Error("Failed to save NWC configuration");
      const updatedUser = { ...user, hasNwcConfigured: true, walletType: "nwc" };
      setUser(updatedUser);
      localStorage.setItem("sats-user", JSON.stringify(updatedUser));
      setEditNwcConnectionString("");
      useToastFn({ title: "NWC verbunden!", description: "Nostr Wallet Connect ist jetzt aktiv", duration: 3000 });
      setTimeout(() => onClose(), 1500);
    } catch (error) {
      useToastFn({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteNwc = async () => {
    setIsSaving(true);
    try {
      await fetch("/api/wallet/nwc", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerId: user.id }),
      });
      setUser({ ...user, hasNwcConfigured: false, walletType: user.hasLnbitsConfigured ? "lnbits" : null });
      useToastFn({ title: "NWC getrennt", description: "Nostr Wallet Connect wurde entfernt", duration: 3000 });
    } catch (error) {
      useToastFn({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLayoutChange = (layout: string) => {
    setLayoutView(layout);
    if (user?.id) {
      localStorage.setItem(`layoutView_${user.id}`, layout);
    }
    useToastFn({ title: "Ansicht aktualisiert", description: `Dashboard wird jetzt ${layout === "one-column" ? "einreihig" : "zweireihig"} angezeigt` });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>
            {activeTab === "ansicht" && "Ansicht"}
            {activeTab === "wallet" && "Wallet Einstellungen"}
            {activeTab === "peers" && "Peers"}
          </CardTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            data-testid="button-close-settings"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* ANSICHT TAB */}
          {activeTab === "ansicht" && (
            <div className="space-y-6">
              {user.role === "parent" && (
                <div className="space-y-2 pb-4 border-b border-border">
                  <Label htmlFor="family-name" className="text-sm font-semibold">Familienname</Label>
                  <Input 
                    id="family-name"
                    value={editFamilyName}
                    onChange={(e) => setEditFamilyName(e.target.value)}
                    placeholder="z.B. Familie Müller"
                    className="bg-secondary/50 border-border"
                    data-testid="input-family-name"
                  />
                  <Button 
                    type="button"
                    size="sm"
                    onClick={async () => {
                      if (!editFamilyName.trim()) return;
                      setIsSaving(true);
                      try {
                        const res = await fetch(`/api/peers/${user.id}/family-name`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ familyName: editFamilyName.trim() }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error);
                        setUser({ ...user, familyName: editFamilyName.trim() });
                        useToastFn({ title: "✅ Familienname aktualisiert!", duration: 2000 });
                      } catch (error) {
                        useToastFn({ title: "❌ Fehler", description: (error as Error).message, variant: "destructive" });
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                    disabled={!editFamilyName.trim() || isSaving}
                    className="w-full"
                    data-testid="button-save-family-name"
                  >
                    {isSaving ? "Wird gespeichert..." : "Speichern"}
                  </Button>
                </div>
              )}
              <Label>Dashboard Ansicht</Label>
              <div className="space-y-2">
                <Button
                  variant={layoutView === "one-column" ? "default" : "outline"}
                  className="w-full justify-start text-left"
                  onClick={() => handleLayoutChange("one-column")}
                  data-testid="button-layout-one-column"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold">Einreihig</span>
                    <span className="text-xs text-muted-foreground">Kästchen untereinander angeordnet</span>
                  </div>
                </Button>
                <Button
                  variant={layoutView === "two-column" ? "default" : "outline"}
                  className="w-full justify-start text-left"
                  onClick={() => handleLayoutChange("two-column")}
                  data-testid="button-layout-two-column"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold">Zweireihig</span>
                    <span className="text-xs text-muted-foreground">2 Kästchen nebeneinander</span>
                  </div>
                </Button>
              </div>
            </div>
          )}

          {/* WALLET TAB */}
          {activeTab === "wallet" && (
            <div className="w-full space-y-4">
              {user.role === "child" ? (
                // For children: only Lightning Address
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="lightning-address">Lightning Adresse</Label>
                    <Input 
                      id="lightning-address"
                      placeholder="name@example.com"
                      value={editLnbitsUrl || ""}
                      onChange={(e) => setEditLnbitsUrl(e.target.value)}
                      className="font-mono text-xs"
                      data-testid="input-lightning-address"
                    />
                    <p className="text-xs text-muted-foreground">
                      Format: name@domain.com
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Status: {user.lightningAddress ? "✓ Konfiguriert" : "✗ Nicht konfiguriert"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="default"
                    className="w-full"
                    onClick={async () => {
                      if (!editLnbitsUrl) return;
                      setIsSaving(true);
                      try {
                        const res = await fetch("/api/wallet/setup-child-address", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ peerId: user.id, lightningAddress: editLnbitsUrl }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error);
                        setUser({ ...user, lightningAddress: editLnbitsUrl });
                        useToastFn({ title: "✅ Lightning Adresse gespeichert!", duration: 3000 });
                        setTimeout(() => onClose(), 1500);
                      } catch (error) {
                        useToastFn({ title: "❌ Fehler", description: (error as Error).message, variant: "destructive" });
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                    disabled={isSaving || !editLnbitsUrl}
                    data-testid="button-save-lightning-address"
                  >
                    {isSaving ? "⏳ Speichern..." : "💾 Speichern"}
                  </Button>
                </div>
              ) : (
                <>
                  {walletTab === "lnbits" && (
                  <div className="space-y-4 mt-4 border-2 border-primary/40 bg-primary/5 rounded-lg p-4">
                    {user.hasLnbitsConfigured ? (
                      <div className="space-y-3">
                        <div className="p-3 rounded-lg border border-green-500/30 bg-green-500/10">
                          <p className="text-sm font-semibold text-green-300">✓ LNbits verbunden</p>
                          <p className="text-sm text-muted-foreground mt-1">Wallet ist konfiguriert und einsatzbereit</p>
                        </div>
                        <Button
                          onClick={deleteLNbits}
                          variant="destructive"
                          size="sm"
                          disabled={isSaving}
                          className="w-full"
                          data-testid="button-disconnect-lnbits"
                        >
                          Trennen
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="lnbits-url">LNbits Instanz URL</Label>
                          <Input 
                            id="lnbits-url"
                            placeholder="z.B. https://lnbits.example.com"
                            value={editLnbitsUrl}
                            onChange={(e) => setEditLnbitsUrl(e.target.value)}
                            className="font-mono text-xs"
                            data-testid="input-lnbits-url"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lnbits-key">Admin-Schlüssel</Label>
                          <div className="flex gap-2">
                            <Input 
                              id="lnbits-key"
                              placeholder="Admin-Schlüssel"
                              type={showAdminKey ? "text" : "password"}
                              value={editLnbitsAdminKey}
                              onChange={(e) => setEditLnbitsAdminKey(e.target.value)}
                              className="font-mono text-xs"
                              data-testid="input-lnbits-admin-key"
                            />
                            <Button
                              onClick={() => setShowAdminKey(!showAdminKey)}
                              variant="outline"
                              size="icon"
                              data-testid="button-toggle-admin-key"
                            >
                              {showAdminKey ? "🙈" : "👁️"}
                            </Button>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={testLNbits}
                          disabled={isSaving || !editLnbitsUrl || !editLnbitsAdminKey}
                          data-testid="button-test-lnbits"
                        >
                          Verbindung testen
                        </Button>
                        <Button 
                          onClick={saveLNbits}
                          className="w-full bg-primary hover:bg-primary/90"
                          disabled={isSaving || !editLnbitsUrl || !editLnbitsAdminKey}
                          data-testid="button-save-lnbits"
                        >
                          {isSaving ? "Wird gespeichert..." : "LNbits verbinden"}
                        </Button>
                      </div>
                    )}
                  </div>
                  )}
                  
                  {walletTab === "nwc" && (
                  <div className="space-y-4 mt-4 border-2 border-cyan-500/40 bg-cyan-500/5 rounded-lg p-4">
                    {user.hasNwcConfigured ? (
                      <div className="space-y-3">
                        <div className="p-3 rounded-lg border border-green-500/30 bg-green-500/10">
                          <p className="text-sm font-semibold text-green-300">NWC verbunden</p>
                          <p className="text-sm text-muted-foreground mt-1">Deine NWC Wallet ist konfiguriert und einsatzbereit</p>
                        </div>
                        <Button
                          onClick={deleteNwc}
                          variant="destructive"
                          size="sm"
                          disabled={isSaving}
                          className="w-full"
                          data-testid="button-delete-nwc"
                        >
                          NWC trennen
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="nwc-connection">NWC Connection String</Label>
                          <Input 
                            id="nwc-connection"
                            placeholder="nostr+walletconnect://..."
                            value={editNwcConnectionString}
                            onChange={(e) => setEditNwcConnectionString(e.target.value)}
                            className="font-mono text-xs"
                            data-testid="input-nwc-connection"
                          />
                          <p className="text-xs text-muted-foreground">
                            Den Connection String erhältst du von deiner NWC-kompatiblen Wallet (z.B. Alby, Mutiny)
                          </p>
                        </div>
                        <Button 
                          onClick={saveNwc}
                          disabled={isSaving || !editNwcConnectionString || !editNwcConnectionString.startsWith("nostr+walletconnect://")}
                          className="w-full bg-cyan-600 hover:bg-cyan-600/90"
                          data-testid="button-setup-nwc"
                        >
                          {isSaving ? "Wird gespeichert..." : "NWC verbinden"}
                        </Button>
                      </div>
                    )}
                  </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* PEERS TAB */}
          {activeTab === "peers" && (
            <PeersContent user={user} setUser={setUser} queryClient={queryClient} />
          )}
        </CardContent>
        
        <CardFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={onClose}
            data-testid="button-cancel-settings"
          >
            Schließen
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function ParentEventsList({ events, onDeleteEvent }: any) {
  const [rsvpData, setRsvpData] = useState<Record<number, any[]>>({});

  const fetchRsvps = () => {
    events.forEach(async (event: FamilyEvent) => {
      try {
        const res = await fetch(`/api/events/${event.id}/rsvps`);
        if (res.ok) {
          const rsvps = await res.json();
          setRsvpData(prev => ({ ...prev, [event.id]: rsvps }));
        }
      } catch (error) {
        console.error("Failed to fetch RSVPs:", error);
      }
    });
  };

  useEffect(() => {
    fetchRsvps();
    const interval = setInterval(fetchRsvps, 3000); // Auto-refresh every 3 seconds
    return () => clearInterval(interval);
  }, [events]);

  return (
    <div className="grid gap-4">
      {events.length === 0 ? (
        <Card className="border-dashed border-border p-8 text-center">
          <p className="text-muted-foreground">Noch keine Termine geplant</p>
        </Card>
      ) : (
        events.map((event: FamilyEvent) => {
          const rsvps = rsvpData[event.id] || [];
          const accepted = rsvps.filter(r => r.response === "accepted");
          const declined = rsvps.filter(r => r.response === "declined");

          return (
            <Card key={event.id} className="border-border bg-gradient-to-br from-gray-900 to-black hover:from-gray-800 hover:to-gray-950 transition-colors">
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg" data-testid={`text-event-title-${event.id}`}>{event.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      📅 {new Date(event.startDate).toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      {event.endDate && ` - ${new Date(event.endDate).toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`}
                    </p>
                    {event.description && <p className="text-muted-foreground text-sm mt-2">{event.description}</p>}
                    {event.location && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-2">
                        <MapPin className="h-4 w-4" /> {event.location}
                      </p>
                    )}
                    <div className="mt-4 p-4 bg-secondary/70 rounded-lg border border-border">
                      <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        📋 Rückmeldungen ({rsvps.length})
                      </h4>
                      {rsvps.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Noch keine Rückmeldungen erhalten</p>
                      ) : (
                        <div className="space-y-2">
                          {accepted.length > 0 && (
                            <div className="bg-green-500/10 border border-green-500/30 rounded p-2">
                              <p className="text-xs text-green-400 font-medium" data-testid={`text-rsvp-accepted-${event.id}`}>
                                ✓ Zusagen ({accepted.length}):
                              </p>
                              <p className="text-xs text-green-300 ml-4">
                                {accepted.map(r => r.childName).join(", ")}
                              </p>
                            </div>
                          )}
                          {declined.length > 0 && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
                              <p className="text-xs text-red-400 font-medium" data-testid={`text-rsvp-declined-${event.id}`}>
                                ✗ Absagen ({declined.length}):
                              </p>
                              <p className="text-xs text-red-300 ml-4">
                                {declined.map(r => r.childName).join(", ")}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteEvent(event.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    data-testid={`button-delete-event-${event.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

function ParentDashboard({ user, setUser, tasks, events, newTask, setNewTask, newEvent, setNewEvent, currentView, setCurrentView, onCreate, onCreateEvent, onApprove, onDelete, onDeleteEvent, approvingTaskId, queryClient, layoutView, setLayoutView, showSpendingStats, setShowSpendingStats, spendingStats, setSpendingStats, messages, setMessages, newMessage, setNewMessage, isLoadingMessage, setIsLoadingMessage, allowances, parentChildren, allowanceChildId, setAllowanceChildId, allowanceSats, setAllowanceSats, allowanceFrequency, setAllowanceFrequency, isCreatingAllowance, handleCreateAllowance, handleDeleteAllowance }: any) {
  const { toast } = useToast();
  const [lnbitsUrl, setLnbitsUrl] = useState("");
  const [lnbitsAdminKey, setLnbitsAdminKey] = useState("");
  const [nwcConnectionString, setNwcConnectionString] = useState("");
  const [lightningAddress, setLightningAddress] = useState(user.lightningAddress || "");
  const [showConnectionCode, setShowConnectionCode] = useState(() => {
    const stored = localStorage.getItem(`connectionCodeShown_${user.id}`);
    return !stored;
  });
  const [cardOrder, setCardOrder] = useState<string[]>(() => {
    const stored = localStorage.getItem(`cardOrder_${user.id}`);
    return stored ? JSON.parse(stored) : ["tasks-open", "tasks-pending", "tasks-completed", "sats-spent", "wallet-balance"];
  });
  const [draggedCard, setDraggedCard] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const hideConnectionCode = () => {
    setShowConnectionCode(false);
    localStorage.setItem(`connectionCodeShown_${user.id}`, "true");
  };

  const saveCardOrder = (newOrder: string[]) => {
    setCardOrder(newOrder);
    localStorage.setItem(`cardOrder_${user.id}`, JSON.stringify(newOrder));
  };

  const handleDragStart = (id: string) => {
    setDraggedCard(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetId: string) => {
    if (!draggedCard || draggedCard === targetId) {
      setDraggedCard(null);
      return;
    }
    const draggedIndex = cardOrder.indexOf(draggedCard);
    const targetIndex = cardOrder.indexOf(targetId);
    const newOrder = [...cardOrder];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedCard);
    saveCardOrder(newOrder);
    setDraggedCard(null);
  };

  const createDraggableCard = (cardId: string, content: React.ReactNode, delay: number) => (
    <motion.div
      key={cardId}
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay }}
      draggable
      onDragStart={() => handleDragStart(cardId)}
      onDragOver={handleDragOver}
      onDrop={() => handleDrop(cardId)}
      className={`cursor-move transition-opacity ${draggedCard === cardId ? "opacity-50" : ""}`}
    >
      {content}
    </motion.div>
  );


  const setupLNbits = async () => {
    if (!lnbitsUrl || !lnbitsAdminKey) return;
    try {
      const res = await fetch("/api/wallet/setup-lnbits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerId: user.id, lnbitsUrl, lnbitsAdminKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUser({ ...user, hasLnbitsConfigured: true, walletType: "lnbits" });
      setLnbitsUrl("");
      setLnbitsAdminKey("");
      toast({ title: "LNbits verbunden!", description: "LNbits Wallet ist jetzt aktiv" });
    } catch (error) {
      toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
    }
  };

  const setupNwc = async () => {
    if (!nwcConnectionString) return;
    try {
      const res = await fetch("/api/wallet/setup-nwc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerId: user.id, nwcConnectionString }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUser({ ...user, hasNwcConfigured: true, walletType: "nwc" });
      setNwcConnectionString("");
      toast({ title: "NWC verbunden!", description: "Nostr Wallet Connect ist jetzt aktiv" });
    } catch (error) {
      toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
    }
  };

  const deleteNwc = async () => {
    try {
      const res = await fetch("/api/wallet/nwc", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerId: user.id }),
      });
      if (!res.ok) throw new Error("Fehler beim Trennen");
      setUser({ ...user, hasNwcConfigured: false, walletType: user.hasLnbitsConfigured ? "lnbits" : null });
      toast({ title: "NWC getrennt", description: "Nostr Wallet Connect wurde entfernt" });
    } catch (error) {
      toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
    }
  };

  const setActiveWallet = async (walletType: string) => {
    try {
      const res = await fetch("/api/wallet/set-active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerId: user.id, walletType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUser({ ...user, walletType });
      toast({ title: "Aktive Wallet geändert", description: `${walletType === "nwc" ? "NWC" : "LNbits"} ist jetzt aktiv` });
    } catch (error) {
      toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
    }
  };

  const setupLightningAddress = async () => {
    if (!lightningAddress) return;
    try {
      const res = await fetch("/api/wallet/setup-child-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerId: user.id, lightningAddress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUser({ ...user, lightningAddress: data.lightningAddress });
      toast({ title: "Lightning Adresse gespeichert!", description: "Du erhältst nun Sats direkt" });
    } catch (error) {
      toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
    }
  };

  const { data: walletBalance = null } = useQuery({
    queryKey: ["wallet-balance", user.id],
    queryFn: async () => {
      const res = await fetch(`/api/parent/${user.id}/wallet-balance`);
      if (!res.ok) throw new Error("Failed to fetch wallet balance");
      return res.json();
    },
    refetchInterval: 10000
  });

  const activeWalletType = user.walletType || (user.hasNwcConfigured ? "nwc" : user.hasLnbitsConfigured ? "lnbits" : null);
  const displayBalance = activeWalletType === "nwc" ? walletBalance?.nwcBalance : walletBalance?.lnbitsBalance;
  const walletLabel = activeWalletType === "nwc" ? "NWC Wallet" : "LNbits Wallet";

  if (currentView === "dashboard") {
    const openTasks = tasks.filter((t: Task) => t.status === "open" || t.status === "assigned");
    const submittedTasks = tasks.filter((t: Task) => t.status === "submitted");
    const completedTasks = tasks.filter((t: Task) => t.status === "approved");
    
    // Filter für zukünftige Events (nur zukünftige werden angezeigt)
    const upcomingEvents = events.filter((e: FamilyEvent) => new Date(e.startDate) > new Date()).sort((a: FamilyEvent, b: FamilyEvent) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    
    const { data: satsSpent = 0 } = useQuery({
      queryKey: ["sats-spent", user.id, user.connectionId],
      queryFn: async () => {
        const res = await fetch(`/api/parent/${user.id}/sats-spent/${user.connectionId}`);
        if (!res.ok) throw new Error("Failed to fetch sats spent");
        const data = await res.json();
        return data.satsSpent;
      },
      refetchInterval: 5000
    });

    const handleShowSpendingStats = async () => {
      try {
        const res = await fetch(`/api/parent/${user.id}/spending-by-child/${user.connectionId}`);
        if (!res.ok) throw new Error("Failed to fetch spending stats");
        const data = await res.json();
        setSpendingStats(data);
        setShowSpendingStats(true);
      } catch (error) {
        toast({ title: "Fehler", description: "Ausgaben-Statistik konnte nicht geladen werden", variant: "destructive" });
      }
    };
    
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        
        {user.role === "parent" && (
          <div 
            onClick={() => setCurrentView("allowance-payout")}
            data-testid="card-active-allowances"
            className="p-6 bg-gradient-to-br from-violet-500/30 to-cyan-500/30 backdrop-blur-md border border-white/50 rounded-2xl cursor-pointer hover:bg-white/55 transition-all shadow-xl overflow-hidden relative"
          >
            <div className="text-center relative z-10">
              <div className="text-2xl font-bold text-slate-900">Taschengeld</div>
              <div className="text-sm text-slate-700 mt-1">Zahlungen & Terminzahlungen</div>
            </div>
          </div>
        )}
        
        {showConnectionCode && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}>
            <div className="bg-white/50 backdrop-blur-xl border border-white/50 rounded-2xl p-5 shadow-xl">
              <div className="flex flex-row items-start justify-between pb-3">
                <div className="flex-1">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                    <LinkIcon className="h-5 w-5 text-violet-600" /> Verbindungscode für Kinder
                  </h3>
                  <p className="text-sm text-slate-700">Gebe diesen Code deinen Kindern, damit sie sich verbinden können</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={hideConnectionCode}
                  className="ml-2 text-slate-700"
                  data-testid="button-hide-connection-code"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="bg-white/30 border border-white/40 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-600 mb-2 uppercase tracking-widest">Dein Code:</p>
                <p className="text-3xl font-mono font-bold text-violet-700 tracking-wider break-words word-break mb-3" data-testid="text-connection-code">
                  {user.connectionId}
                </p>
                <p className="text-xs text-slate-600">Später findest du diesen Code in den Wallet-Einstellungen</p>
              </div>
            </div>
          </motion.div>
        )}
        
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative overflow-hidden rounded-2xl bg-white/50 backdrop-blur-xl border border-white/50 p-8 cursor-pointer hover:bg-white/55 transition-colors shadow-xl"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleShowSpendingStats();
          }}
        >
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex-1">
                <p className="text-slate-700 font-mono text-sm uppercase tracking-widest mb-2">Ausgegeben</p>
                <h2 className="text-5xl font-mono font-bold flex items-center gap-3 text-cyan-600" data-testid="text-sats-spent">
                  {(satsSpent || 0).toLocaleString()} <span className="text-2xl opacity-70 text-slate-700">SATS</span>
                </h2>
                <p className="text-xs text-slate-600 mt-2">Klick zum Anzeigen der Aufschlüsselung pro Kind</p>
              </div>
            </div>
          </div>
        </motion.div>
        
        <div className={`grid ${layoutView === "one-column" ? "grid-cols-1" : "grid-cols-2"} gap-4`}>
          {cardOrder.map((cardId, index) => {
            if (cardId === "tasks-open") {
              return createDraggableCard(
                cardId,
                <div 
                  className="bg-white/50 backdrop-blur-xl border border-white/50 rounded-2xl cursor-pointer hover:bg-white/55 transition-colors h-full shadow-lg p-6"
                  onClick={() => setCurrentView("tasks-open")}
                  data-testid="card-open-tasks"
                >
                  <div className="text-center">
                    <div className="text-3xl font-bold text-violet-600">{openTasks.length}</div>
                    <p className="text-sm text-slate-700 mt-2">Offene Aufgaben</p>
                  </div>
                </div>,
                index * 0.1
              );
            } else if (cardId === "tasks-pending") {
              return createDraggableCard(
                cardId,
                <div 
                  className="bg-white/50 backdrop-blur-xl border border-white/50 rounded-2xl cursor-pointer hover:bg-white/55 transition-colors h-full shadow-lg p-6"
                  onClick={() => setCurrentView("tasks-pending")}
                  data-testid="card-submitted-tasks"
                >
                  <div className="text-center">
                    <div className="text-3xl font-bold text-amber-500">{submittedTasks.length}</div>
                    <p className="text-sm text-slate-700 mt-2">Zur Bestätigung</p>
                  </div>
                </div>,
                index * 0.1
              );
            } else if (cardId === "tasks-completed") {
              return createDraggableCard(
                cardId,
                <div 
                  className="bg-white/50 backdrop-blur-xl border border-white/50 rounded-2xl cursor-pointer hover:bg-white/55 transition-colors h-full shadow-lg p-6"
                  onClick={() => setCurrentView("tasks-completed")}
                  data-testid="card-completed-tasks"
                >
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-500">{completedTasks.length}</div>
                    <p className="text-sm text-slate-700 mt-2">Abgeschlossen</p>
                  </div>
                </div>,
                index * 0.1
              );
            } else if (cardId === "wallet-balance") {
              return createDraggableCard(
                cardId,
                <div className={`bg-white/50 backdrop-blur-xl border border-white/50 rounded-2xl ${displayBalance !== null ? "hover:bg-white/55" : "opacity-60"} transition-colors h-full shadow-lg p-6`}>
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-cyan-600 flex items-center justify-center gap-1">
                        {displayBalance !== null && displayBalance !== undefined ? (
                          <>
                            {(displayBalance / 1000).toLocaleString("de-DE", { maximumFractionDigits: 0 })} Sats
                          </>
                        ) : (
                          "---"
                        )}
                      </div>
                      <p className="text-sm text-slate-700 mt-2">{walletLabel}</p>
                    </div>
                  </div>
                </div>,
                index * 0.1
              );
            }
          })}
          
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} className="col-span-full">
            <div className="bg-white/50 backdrop-blur-xl border border-white/50 rounded-2xl cursor-pointer hover:bg-white/55 transition-colors shadow-lg p-4" onClick={() => setCurrentView("calendar-view")} data-testid="card-calendar">
                <h3 className="text-sm font-bold mb-2 flex items-center gap-1 text-slate-900">
                  <Calendar className="h-4 w-4 text-violet-600" /> Kalender
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="col-span-1">
                    <style>{`
                      .rdp {
                        --rdp-cell-size: 24px;
                        --rdp-accent-color: rgb(124, 58, 237);
                        --rdp-background-color: rgba(124, 58, 237, 0.15);
                        margin: 0;
                      }
                      @media (min-width: 768px) {
                        .rdp {
                          --rdp-cell-size: 30px;
                        }
                      }
                      .rdp-head_cell {
                        color: rgb(71, 85, 105);
                        font-weight: 600;
                        font-size: 0.5rem;
                      }
                      @media (min-width: 768px) {
                        .rdp-head_cell {
                          font-size: 0.6rem;
                        }
                      }
                      .rdp-cell {
                        color: rgb(51, 65, 85);
                        padding: 0;
                      }
                      .rdp-day {
                        color: rgb(30, 41, 59);
                        border-radius: 2px;
                        font-size: 0.6rem;
                        font-weight: 500;
                      }
                      @media (min-width: 768px) {
                        .rdp-day {
                          font-size: 0.7rem;
                        }
                      }
                      .rdp-day_selected {
                        background-color: rgb(124, 58, 237);
                        color: white;
                      }
                      .rdp-day_today {
                        color: rgb(124, 58, 237);
                        font-weight: bold;
                      }
                      .rdp-caption {
                        color: rgb(30, 41, 59);
                        font-weight: 600;
                        margin-bottom: 0.25rem;
                        font-size: 0.65rem;
                      }
                      @media (min-width: 768px) {
                        .rdp-caption {
                          font-size: 0.75rem;
                        }
                      }
                      .rdp-nav {
                        gap: 1px;
                      }
                      .rdp-nav_button {
                        width: 16px;
                        height: 16px;
                        padding: 0;
                        color: rgb(71, 85, 105);
                      }
                      @media (min-width: 768px) {
                        .rdp-nav_button {
                          width: 20px;
                          height: 20px;
                        }
                      }
                    `}</style>
                    <DayPicker
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      locale={{
                        months: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
                        weekdays: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
                        weekdaysShort: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"]
                      }}
                      modifiers={{
                        hasEvent: (date) => events.some(e => {
                          const eventDate = new Date(e.startDate);
                          return eventDate.toDateString() === date.toDateString();
                        })
                      }}
                      modifiersStyles={{
                        hasEvent: {
                          backgroundColor: "rgba(59, 130, 246, 0.2)",
                          fontWeight: "bold"
                        }
                      }}
                    />
                  </div>
                  
                  <div className="col-span-1">
                    <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase truncate">
                      {selectedDate.toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    <div className="space-y-1 max-h-32 md:max-h-40 overflow-y-auto">
                      {events
                        .filter(e => new Date(e.startDate).toDateString() === selectedDate.toDateString())
                        .map((event: FamilyEvent) => (
                          <div 
                            key={event.id} 
                            className="text-xs border-l border-primary/50 pl-1.5 py-0.5 bg-primary/5 rounded cursor-pointer hover:bg-primary/10 transition-colors"
                            data-testid={`text-calendar-event-${event.id}`}
                          >
                            <p className="font-semibold text-primary text-xs truncate">{event.title}</p>
                            <p className="text-muted-foreground text-xs">
                              ⏰ {new Date(event.startDate).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        ))}
                      {events.filter(e => new Date(e.startDate).toDateString() === selectedDate.toDateString()).length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-1">Keine Termine</p>
                      )}
                    </div>
                  </div>
                </div>
            </div>
          </motion.div>
        </div>

        <Dialog open={showSpendingStats} onOpenChange={setShowSpendingStats}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Ausgaben pro Kind</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {spendingStats.length === 0 ? (
                <p className="text-muted-foreground text-center py-6">Keine Ausgaben erfasst</p>
              ) : (
                spendingStats.map((stat) => (
                  <div key={stat.childId} className="p-3 rounded-lg border border-border bg-secondary/30 flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{stat.childName}</p>
                      <p className="text-xs text-muted-foreground">Sats bezahlt</p>
                    </div>
                    <p className="text-lg font-mono font-bold text-primary">{stat.satSpent.toLocaleString()}</p>
                  </div>
                ))
              )}
              {spendingStats.length > 0 && (
                <div className="pt-3 border-t border-border mt-3">
                  <p className="text-sm text-muted-foreground">Gesamt: <span className="text-primary font-bold">{spendingStats.reduce((sum, s) => sum + s.satSpent, 0).toLocaleString()} SATS</span></p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (currentView === "chat") {
    useEffect(() => {
      const fetchMessages = async () => {
        try {
          const res = await fetch(`/api/chat/${user.connectionId}`);
          if (res.ok) {
            const data = await res.json();
            setMessages(data);
          }
        } catch (error) {
          console.error("Failed to fetch messages:", error);
        }
      };
      fetchMessages();
      const interval = setInterval(fetchMessages, 2000);
      return () => clearInterval(interval);
    }, [user.connectionId]);
    
    const handleSendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newMessage.trim() || isLoadingMessage) return;
      setIsLoadingMessage(true);
      try {
        await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            connectionId: user.connectionId,
            fromPeerId: user.id,
            message: newMessage.trim(),
          }),
        });
        setNewMessage("");
        const res = await fetch(`/api/chat/${user.connectionId}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch (error) {
        toast({ title: "Fehler", description: "Nachricht konnte nicht gesendet werden", variant: "destructive" });
      } finally {
        setIsLoadingMessage(false);
      }
    };
    
    return (
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold mb-8 bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">Familienchat</h1>
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-xl">
          <div className="p-6">
            <div className="space-y-4">
              <div className="h-96 overflow-y-auto bg-black/20 backdrop-blur-sm rounded-xl p-4 space-y-3 border border-white/10">
                {messages.length === 0 ? (
                  <p className="text-white/60 text-center py-8">Noch keine Nachrichten</p>
                ) : (
                  messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.fromPeerId === user.id ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-xs rounded-xl px-4 py-2 ${
                          msg.fromPeerId === user.id
                            ? "bg-gradient-to-r from-violet-500 to-cyan-500 text-white"
                            : "bg-white/15 backdrop-blur-sm border border-white/20 text-white"
                        }`}
                      >
                        <p className="text-xs font-semibold mb-1 opacity-90">{msg.senderName}</p>
                        <p className="text-sm">{msg.message}</p>
                        <p className="text-xs opacity-60 mt-1">
                          {new Date(msg.createdAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Nachricht eingeben..."
                  disabled={isLoadingMessage}
                  className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                  data-testid="input-chat-message"
                />
                <Button
                  type="submit"
                  disabled={!newMessage.trim() || isLoadingMessage}
                  className="bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600 text-white border-0"
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === "peers") {
    const { data: connectedPeers = [] } = useQuery({
      queryKey: ["peers", user.connectionId],
      queryFn: async () => {
        const res = await fetch(`/api/peers/connection/${user.connectionId}`);
        if (!res.ok) throw new Error("Failed to fetch peers");
        return res.json();
      },
      refetchInterval: 2000
    });

    const children = connectedPeers.filter((p: any) => p.role === "child");

    const handleUnlinkChild = async (childId: number, childName: string) => {
      if (!window.confirm(`Möchtest du ${childName} wirklich von der Familie trennen?`)) return;
      
      try {
        const res = await fetch("/api/peers/unlink", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ childId })
        });
        if (!res.ok) throw new Error("Failed to unlink");
        queryClient.invalidateQueries({ queryKey: ["peers", user.connectionId] });
        toast({ title: "Trennung erfolgreich", description: `${childName} wurde von der Familie getrennt` });
      } catch (error) {
        toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
      }
    };

    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Familienmitglieder</h1>
        {children.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mt-6 mb-4">👶 Kinder ({children.length})</h2>
            {children.map((child: any) => (
              <Card key={child.id} className="border-border bg-card/50">
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-lg">
                      {child.name[0]}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">{child.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {child.lightningAddress ? `⚡ ${child.lightningAddress}` : "⚠️ Keine Lightning Adresse"}
                      </p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {child.lightningAddress && (
                          <Badge variant="secondary" className="text-xs">✓ Lightning konfiguriert</Badge>
                        )}
                        <Badge variant="outline" className="text-xs">💰 {child.balance || 0} sats</Badge>
                      </div>
                    </div>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnlinkChild(child.id, child.name)}
                      className="text-destructive hover:text-destructive"
                      data-testid={`button-unlink-child-${child.id}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed border-border p-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-semibold">Noch keine Kinder verbunden</p>
            <p className="text-xs text-muted-foreground mt-2">Teile deinen Verbindungscode mit deinen Kindern, um sie hinzuzufügen</p>
          </Card>
        )}
      </div>
    );
  }

  if (currentView === "children-overview" && user.role === "parent") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Kinder-Übersicht</h1>
          <p className="text-slate-700 text-sm mt-2">Alle deine Kinder auf einen Blick</p>
        </div>

        {parentChildren.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {parentChildren.map((child: any) => {
              const childTasks = tasks.filter((t: Task) => t.assignedTo === child.id);
              const openTasks = childTasks.filter((t: Task) => t.status === "open");
              const submittedTasks = childTasks.filter((t: Task) => t.status === "submitted");
              const approvedTasks = childTasks.filter((t: Task) => t.status === "approved");
              const totalSatsEarned = approvedTasks.reduce((sum: number, t: Task) => sum + t.sats, 0);
              
              return (
                <motion.div
                  key={child.id}
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-gradient-to-br from-violet-500/20 to-cyan-500/20 backdrop-blur-md border border-white/50 rounded-2xl p-5 shadow-xl hover:shadow-2xl transition-all"
                  data-testid={`card-child-${child.id}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-white flex items-center justify-center font-bold text-lg">
                        {child.name[0].toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-slate-900">{child.name}</h3>
                        <p className="text-xs text-slate-600">Kind</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-amber-600">{child.balance || 0}</p>
                      <p className="text-xs text-slate-600">Sats</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white/30 rounded-lg p-2">
                        <p className="text-lg font-bold text-slate-900">{openTasks.length}</p>
                        <p className="text-xs text-slate-600">Offen</p>
                      </div>
                      <div className="bg-white/30 rounded-lg p-2">
                        <p className="text-lg font-bold text-orange-600">{submittedTasks.length}</p>
                        <p className="text-xs text-slate-600">Eingereicht</p>
                      </div>
                      <div className="bg-white/30 rounded-lg p-2">
                        <p className="text-lg font-bold text-green-600">{approvedTasks.length}</p>
                        <p className="text-xs text-slate-600">Vollendet</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/30 text-sm text-slate-600">
                      <p>💰 Verdient: {totalSatsEarned} Sats</p>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button 
                        size="sm" 
                        className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
                        onClick={() => {
                          setAllowanceChildId(child.id);
                          setCurrentView("allowances");
                        }}
                        data-testid={`button-allowance-${child.id}`}
                      >
                        Taschengeld
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="flex-1"
                        onClick={() => setCurrentView("tasks")}
                        data-testid={`button-tasks-${child.id}`}
                      >
                        Aufgaben
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed border-border p-12 text-center">
            <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Keine Kinder verbunden</h3>
            <p className="text-slate-600 text-sm">Teile deinen Verbindungscode mit deinen Kindern, um sie hinzuzufügen</p>
          </Card>
        )}
      </div>
    );
  }

  if (currentView === "recurring-tasks" && user.role === "parent") {
    const { data: recurringTasks = [] } = useQuery({
      queryKey: ["recurring-tasks", user.connectionId],
      queryFn: async () => {
        const res = await fetch(`/api/recurring-tasks/${user.connectionId}`);
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      }
    });

    const [newRecurring, setNewRecurring] = useState({
      title: "",
      description: "",
      sats: "",
      frequency: "weekly",
      dayOfWeek: 3,
      time: "09:00"
    });

    const weekdays = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

    const handleCreateRecurring = async () => {
      try {
        const res = await fetch("/api/recurring-tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...newRecurring,
            sats: parseInt(newRecurring.sats as string) || 50,
            connectionId: user.connectionId,
            createdBy: user.id
          })
        });
        const data = await res.json();
        queryClient.invalidateQueries({ queryKey: ["recurring-tasks"] });
        toast({ title: "✅ Aufgabe erstellt", description: `${newRecurring.frequency} Aufgabe erstellt` });
        setNewRecurring({ title: "", description: "", sats: "", frequency: "weekly", dayOfWeek: 3, time: "09:00" });
      } catch (error) {
        toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
      }
    };

    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Wiederkehrende Aufgaben</h1>
          <p className="text-slate-700 text-sm mt-2">Automatisch jede Woche, täglich oder monatlich erstellt</p>
        </div>

        <Card className="bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-white/50 p-6">
          <h3 className="font-bold mb-4">Neue wiederholende Aufgabe</h3>
          <div className="space-y-3">
            <Input placeholder="Aufgabentitel" value={newRecurring.title} onChange={(e) => setNewRecurring({ ...newRecurring, title: e.target.value })} data-testid="input-recurring-title" />
            <Input placeholder="Beschreibung" value={newRecurring.description} onChange={(e) => setNewRecurring({ ...newRecurring, description: e.target.value })} data-testid="input-recurring-desc" />
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" placeholder="Betrag" value={newRecurring.sats} onChange={(e) => setNewRecurring({ ...newRecurring, sats: e.target.value })} data-testid="input-recurring-sats" />
              <Select value={newRecurring.frequency} onValueChange={(v) => setNewRecurring({ ...newRecurring, frequency: v })}>
                <SelectTrigger data-testid="select-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Täglich</SelectItem>
                  <SelectItem value="weekly">Wöchentlich</SelectItem>
                  <SelectItem value="monthly">Monatlich</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newRecurring.frequency === "weekly" && (
              <Select value={String(newRecurring.dayOfWeek)} onValueChange={(v) => setNewRecurring({ ...newRecurring, dayOfWeek: parseInt(v) })}>
                <SelectTrigger data-testid="select-weekday">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {weekdays.map((day, idx) => (
                    <SelectItem key={idx} value={String(idx)}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input type="time" value={newRecurring.time} onChange={(e) => setNewRecurring({ ...newRecurring, time: e.target.value })} data-testid="input-recurring-time" />
            <Button onClick={handleCreateRecurring} className="w-full bg-violet-600 hover:bg-violet-700" data-testid="button-create-recurring">Erstellen</Button>
          </div>
        </Card>

        <div className="space-y-3">
          {recurringTasks.length > 0 ? recurringTasks.map((task: any) => (
            <Card key={task.id} className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold">{task.title}</h4>
                    <span className="text-xs bg-violet-500/30 px-2 py-1 rounded text-violet-700 font-semibold" data-testid={`badge-sats-${task.id}`}>⚡ {task.sats} Sats</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    {task.frequency === 'weekly' && weekdays[task.dayOfWeek]} 
                    {task.frequency === 'daily' && 'Täglich'}
                    {task.frequency === 'monthly' && `Monatlich am ${task.dayOfMonth || 'Tag'}`}
                    • {task.time}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{task.description}</p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => {
                  fetch(`/api/recurring-tasks/${task.id}`, { method: "DELETE" });
                  queryClient.invalidateQueries({ queryKey: ["recurring-tasks"] });
                }} data-testid={`button-delete-recurring-${task.id}`}>✕</Button>
              </div>
            </Card>
          )) : <p className="text-slate-600" data-testid="text-no-recurring">Keine wiederholenden Aufgaben erstellt</p>}
        </div>
      </div>
    );
  }

  if (currentView === "leaderboard") {
    const { data: leaderboard = [] } = useQuery({
      queryKey: ["leaderboard", user.connectionId],
      queryFn: async () => {
        const res = await fetch(`/api/leaderboard/${user.connectionId}`);
        if (!res.ok) throw new Error("Failed to fetch leaderboard");
        return res.json();
      },
      refetchInterval: 2000
    });

    const getMedalEmoji = (position: number) => {
      if (position === 0) return "🥇";
      if (position === 1) return "🥈";
      if (position === 2) return "🥉";
      return `${position + 1}.`;
    };

    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-2">🏆 Bestenliste</h1>
        <p className="text-muted-foreground mb-6">Wer ist der beste Aufgabenerlediger in der Familie?</p>
        
        {leaderboard.length === 0 ? (
          <Card className="border-dashed border-border p-8 text-center">
            <Trophy className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Noch keine Kinder in der Familie</p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {leaderboard.map((entry: any, index: number) => (
              <Card 
                key={entry.id} 
                className={`border-2 transition-all ${
                  index === 0 
                    ? "border-yellow-500/50 bg-yellow-500/5" 
                    : index === 1 
                    ? "border-slate-400/50 bg-slate-400/5"
                    : index === 2
                    ? "border-orange-600/50 bg-orange-600/5"
                    : "border-border"
                }`}
              >
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <div className="text-3xl font-bold w-12 text-center">
                      {getMedalEmoji(index)}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-lg" data-testid={`text-leaderboard-name-${entry.id}`}>{entry.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {entry.completedTasks} Aufgabe{entry.completedTasks !== 1 ? "n" : ""} erledigt
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary" data-testid={`text-leaderboard-sats-${entry.id}`}>
                        {entry.satsEarned}
                      </p>
                      <p className="text-xs text-muted-foreground">Sats verdient</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Aktuelles Guthaben</span>
                      <span className="font-semibold" data-testid={`text-leaderboard-balance-${entry.id}`}>{entry.balance} Sats</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (currentView === "nostr") {
    // For children: only show Lightning Address
    if (user.role === "child") {
      return (
        <div className="max-w-4xl">
          <h1 className="text-3xl font-bold mb-8">Wallet-Einstellungen</h1>
          <Card className="border-2 border-primary/40 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bitcoin className="h-5 w-5 text-primary" /> Lightning Adresse
              </CardTitle>
              <CardDescription>Hinterlege deine Lightning Adresse um Sats zu erhalten</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lightning-address">Lightning Adresse</Label>
                <Input 
                  id="lightning-address"
                  placeholder="name@example.com"
                  value={lightningAddress}
                  onChange={(e) => setLightningAddress(e.target.value)}
                  className="font-mono text-xs"
                  data-testid="input-lightning-address"
                />
                <p className="text-xs text-muted-foreground">
                  Format: name@domain.com
                </p>
                <p className="text-xs text-muted-foreground">
                  Status: {user.lightningAddress ? "✓ Konfiguriert" : "✗ Nicht konfiguriert"}
                </p>
              </div>
              <Button 
                onClick={setupLightningAddress}
                className="bg-primary hover:bg-primary/90"
                data-testid="button-setup-lightning-address"
              >
                Speichern
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    // For parents: show all tabs
    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Wallet-Einstellungen</h1>
        <Tabs defaultValue="verbindung" className="w-full">
          <TabsList className="bg-secondary p-1 border border-border mb-6">
            <TabsTrigger value="verbindung">Verbindung</TabsTrigger>
            <TabsTrigger value="lnbits">LNbits</TabsTrigger>
            <TabsTrigger value="nwc">NWC</TabsTrigger>
          </TabsList>

          <TabsContent value="verbindung">
            <Card>
              <CardHeader>
                <CardTitle>Dein Verbindungscode</CardTitle>
                <CardDescription>Teile diesen Code mit deinen Kindern zum Verbinden</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-secondary border-2 border-primary/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-2 uppercase tracking-widest">Code:</p>
                  <p className="text-3xl font-mono font-bold text-primary tracking-wider break-words word-break" data-testid="text-connection-code-settings">
                    {user.connectionId}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground bg-blue-500/10 border border-blue-500/30 rounded p-3">
                  💡 Dieser Code wird für die Verbindung mit deinen Kindern benötigt. Teile ihn sicher mit ihnen.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lnbits">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>LNbits Wallet (für Aufgaben & Auszahlungen)</CardTitle>
                  <CardDescription>Verbinde dein LNbits Wallet für Zahlungen und Escrow</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="lnbits-url">LNbits Server URL</Label>
                    <Input 
                      id="lnbits-url"
                      placeholder="https://lnbits.example.com"
                      value={lnbitsUrl}
                      onChange={(e) => setLnbitsUrl(e.target.value)}
                      className="font-mono text-xs"
                      data-testid="input-lnbits-url"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lnbits-key">LNbits Admin Key</Label>
                    <Input 
                      id="lnbits-key"
                      placeholder="deine-admin-key..."
                      type="password"
                      value={lnbitsAdminKey}
                      onChange={(e) => setLnbitsAdminKey(e.target.value)}
                      className="font-mono text-xs"
                      data-testid="input-lnbits-key"
                    />
                    <p className="text-xs text-muted-foreground">
                      Status: {user.hasLnbitsConfigured ? "✓ Verbunden" : "✗ Nicht verbunden"}
                    </p>
                  </div>
                  <Button 
                    onClick={setupLNbits}
                    disabled={!lnbitsUrl || !lnbitsAdminKey}
                    className="bg-primary hover:bg-primary/90 w-full"
                    data-testid="button-setup-lnbits-settings"
                  >
                    Speichern
                  </Button>
                  {user.hasLnbitsConfigured && user.hasNwcConfigured && (
                    <Button 
                      onClick={() => setActiveWallet("lnbits")}
                      variant={user.walletType === "lnbits" ? "default" : "outline"}
                      className="w-full mt-2"
                      data-testid="button-set-active-lnbits"
                    >
                      {user.walletType === "lnbits" ? "Aktiv" : "Als aktiv setzen"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="nwc">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Nostr Wallet Connect (NWC)</CardTitle>
                  <CardDescription>Verbinde deine Wallet über das Nostr Wallet Connect Protokoll</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {user.hasNwcConfigured ? (
                    <div className="space-y-4">
                      <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <p className="text-sm font-semibold text-green-300">NWC verbunden</p>
                        <p className="text-xs text-muted-foreground mt-1">Deine NWC Wallet ist konfiguriert und einsatzbereit</p>
                      </div>
                      <Button 
                        onClick={deleteNwc}
                        variant="destructive"
                        className="w-full"
                        data-testid="button-delete-nwc"
                      >
                        NWC trennen
                      </Button>
                      {user.hasLnbitsConfigured && (
                        <Button 
                          onClick={() => setActiveWallet("nwc")}
                          variant={user.walletType === "nwc" ? "default" : "outline"}
                          className="w-full"
                          data-testid="button-set-active-nwc"
                        >
                          {user.walletType === "nwc" ? "Aktiv" : "Als aktiv setzen"}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="nwc-connection">NWC Connection String</Label>
                        <Input 
                          id="nwc-connection"
                          placeholder="nostr+walletconnect://..."
                          value={nwcConnectionString}
                          onChange={(e) => setNwcConnectionString(e.target.value)}
                          className="font-mono text-xs"
                          data-testid="input-nwc-connection"
                        />
                        <p className="text-xs text-muted-foreground">
                          Den Connection String erhältst du von deiner NWC-kompatiblen Wallet (z.B. Alby, Mutiny)
                        </p>
                      </div>
                      <Button 
                        onClick={setupNwc}
                        disabled={!nwcConnectionString || !nwcConnectionString.startsWith("nostr+walletconnect://")}
                        className="bg-primary hover:bg-primary/90 w-full"
                        data-testid="button-setup-nwc"
                      >
                        NWC verbinden
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
              <Card className="bg-secondary/30">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">
                    <strong>Was ist NWC?</strong> Nostr Wallet Connect ist ein offenes Protokoll, das es dir ermöglicht, 
                    deine Lightning Wallet sicher mit Apps zu verbinden. Unterstützte Wallets: Alby, Mutiny, Zeus und andere.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  if (currentView === "tasks-open") {
    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold mb-8">Offene Aufgaben</h1>
        <section>
          <div className="space-y-4">
            {tasks.filter((t: Task) => t.status === "open" || t.status === "assigned").length === 0 ? (
              <Card className="border-dashed border-border p-8 text-center">
                <p className="text-muted-foreground">Keine offenen Aufgaben</p>
              </Card>
            ) : (
              tasks.filter((t: Task) => t.status === "open" || t.status === "assigned").map((task: Task) => (
                <TaskCard key={task.id} task={task} variant="parent">
                  <Button 
                    onClick={() => onDelete(task.id)} 
                    className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
                    data-testid={`button-delete-task-${task.id}`}
                    size="sm"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Löschen
                  </Button>
                </TaskCard>
              ))
            )}
          </div>
        </section>
      </div>
    );
  }

  if (currentView === "tasks-pending") {
    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold mb-8">Zur Bestätigung</h1>
        <section>
          <div className="space-y-4">
            {tasks.filter((t: Task) => t.status === "submitted").length === 0 ? (
              <Card className="border-dashed border-border p-8 text-center">
                <p className="text-muted-foreground">Keine Aufgaben zur Bestätigung</p>
              </Card>
            ) : (
              tasks.filter((t: Task) => t.status === "submitted").map((task: Task) => (
                <TaskCard key={task.id} task={task} variant="parent">
                  <div className="flex flex-col gap-3 w-full">
                    {task.proof && (
                      <div className="p-3 rounded-lg border border-border bg-secondary/30">
                        <p className="text-xs text-muted-foreground mb-2">📸 Beweis eingereicht:</p>
                        <ProofViewer proof={task.proof} taskTitle={task.title} />
                      </div>
                    )}
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button 
                        onClick={() => onApprove(task.id)} 
                        className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        data-testid={`button-approve-task-${task.id}`}
                        size="sm"
                        disabled={approvingTaskId === task.id}
                      >
                        {approvingTaskId === task.id ? (
                          <>
                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            Wird genehmigt...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="mr-2 h-4 w-4" /> Genehmigen
                          </>
                        )}
                      </Button>
                      <Button 
                        onClick={() => onDelete(task.id)} 
                        className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white"
                        data-testid={`button-delete-task-${task.id}`}
                        size="sm"
                        disabled={approvingTaskId === task.id}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Löschen
                      </Button>
                    </div>
                  </div>
                </TaskCard>
              ))
            )}
          </div>
        </section>
      </div>
    );
  }

  if (currentView === "tasks-completed") {
    const { data: connectedPeers = [] } = useQuery({
      queryKey: ["peers", user.connectionId],
      queryFn: async () => {
        const res = await fetch(`/api/peers/connection/${user.connectionId}`);
        if (!res.ok) throw new Error("Failed to fetch peers");
        return res.json();
      },
      refetchInterval: 5000
    });

    const getChildName = (childId?: number) => {
      if (!childId) return "Unbekannt";
      const child = connectedPeers.find((p: any) => p.id === childId);
      return child?.name || "Unbekannt";
    };

    const completedTasks = tasks.filter((t: Task) => t.status === "approved");

    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold mb-8">Abgeschlossene Aufgaben</h1>
        <section>
          <div className="space-y-4">
            {completedTasks.length === 0 ? (
              <Card className="border-dashed border-border p-8 text-center">
                <p className="text-muted-foreground">Keine abgeschlossenen Aufgaben</p>
              </Card>
            ) : (
              completedTasks.map((task: Task) => (
                <TaskCard key={task.id} task={task} variant="parent">
                  <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-green-500/10 border border-green-500/30 w-fit">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-xs font-semibold text-green-300">Erledigt von: {getChildName(task.assignedTo)}</span>
                  </div>
                </TaskCard>
              ))
            )}
          </div>
        </section>
      </div>
    );
  }

  if (currentView === "tasks") {
    const isWalletConfigured = user.hasLnbitsConfigured || user.hasNwcConfigured;
    const availableBalance = displayBalance !== null ? displayBalance / 1000 : 0;
    const isBalanceInsufficient = displayBalance !== null && availableBalance < newTask.sats;
    const balancePercentage = displayBalance !== null && newTask.sats > 0 ? (availableBalance / newTask.sats) * 100 : 100;

    if (!isWalletConfigured) {
      return (
        <div className="space-y-8">
          <h1 className="text-3xl font-bold mb-8">Neue Aufgabe erstellen</h1>
          <motion.section initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            <Card className="border-2 border-amber-500/40 bg-amber-500/5 shadow-lg overflow-hidden">
              <CardContent className="pt-8">
                <div className="text-center space-y-4">
                  <div className="text-4xl">⚡</div>
                  <h2 className="text-xl font-bold text-amber-300">Wallet-Verbindung erforderlich</h2>
                  <p className="text-sm text-amber-200/80 max-w-md mx-auto">
                    Um Aufgaben mit Satoshi-Belohnungen zu erstellen, musst du zuerst dein LNbits-Konto oder Nostr Wallet Connect (NWC) verbinden.
                  </p>
                  <Button 
                    onClick={() => {
                      console.log("Button clicked - setCurrentView('wallet-settings')");
                      setCurrentView("wallet-settings");
                    }}
                    data-testid="button-open-lnbits-settings"
                    className="mt-4 bg-primary hover:bg-primary/90 cursor-pointer"
                  >
                    Zu Wallet-Einstellungen
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.section>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold mb-8">Neue Aufgabe erstellen</h1>
        <motion.section initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <Card className="border border-primary/20 shadow-[0_0_30px_-10px_rgba(247,147,26,0.15)] bg-card/50 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary via-accent to-primary" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary" data-testid="text-create-task">
                <Plus className="h-5 w-5" /> Neue Aufgabe erstellen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => {
                e.preventDefault();
                if (!isBalanceInsufficient) {
                  onCreate(e);
                }
              }} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Was ist zu tun?</Label>
                  <Input 
                    id="title"
                    placeholder="z.B. Rasen mähen..." 
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    className="bg-secondary border-border focus:border-primary"
                    autoComplete="off"
                    data-testid="input-task-title"
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sats" className="flex items-center gap-1">
                      <Bitcoin className="h-4 w-4 text-primary" /> Belohnung
                    </Label>
                    <span className={`text-xs font-semibold ${isBalanceInsufficient ? "text-red-400" : "text-emerald-400"}`}>
                      ⚡ {availableBalance > 0 ? availableBalance.toLocaleString("de-DE", { maximumFractionDigits: 0 }) : "---"} Sats
                    </span>
                  </div>
                  <Input 
                    id="sats"
                    type="number" 
                    placeholder="50" 
                    value={newTask.sats}
                    onChange={(e) => setNewTask({ ...newTask, sats: parseInt(e.target.value) || 0 })}
                    className={`font-mono bg-secondary focus:border-primary transition-colors ${
                      isBalanceInsufficient 
                        ? "border-red-500/50 focus:border-red-500" 
                        : "border-border"
                    }`}
                    autoComplete="off"
                    data-testid="input-task-sats"
                  />
                  {isBalanceInsufficient && displayBalance !== null && (
                    <motion.div 
                      initial={{ opacity: 0, y: -5 }} 
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg"
                    >
                      <span className="text-red-400 text-lg">⚠️</span>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-red-300">Unzureichende Balance</p>
                        <p className="text-xs text-red-200/70">Du benötigst {Math.ceil(newTask.sats - availableBalance)} Sats mehr</p>
                      </div>
                    </motion.div>
                  )}
                </div>

                <Button 
                  type="submit" 
                  disabled={isBalanceInsufficient}
                  className={`w-full font-bold transition-all ${
                    isBalanceInsufficient
                      ? "bg-gray-600 text-gray-300 cursor-not-allowed opacity-50"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                  data-testid="button-create-task"
                >
                  {isBalanceInsufficient ? "Unzureichende Balance" : "Erstellen"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.section>
      </div>
    );
  }

  if (currentView === "calendar-create") {
    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold mb-8">Neuen Termin anlegen</h1>
        <motion.section initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <Card className="border border-primary/20 shadow-[0_0_30px_-10px_rgba(247,147,26,0.15)] bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Plus className="h-5 w-5" /> Neuer Familientemin
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onCreateEvent} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="event-title">Termin</Label>
                  <Input 
                    id="event-title"
                    placeholder="z.B. Familienessen..." 
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    className="bg-secondary border-border"
                    data-testid="input-event-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-description">Beschreibung</Label>
                  <Input 
                    id="event-description"
                    placeholder="Details..." 
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    className="bg-secondary border-border"
                    data-testid="input-event-description"
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="event-start-date">📅 Startdatum</Label>
                    <Input 
                      id="event-start-date"
                      type="datetime-local"
                      value={newEvent.startDate}
                      onChange={(e) => setNewEvent({ ...newEvent, startDate: e.target.value })}
                      className="bg-secondary border-border"
                      data-testid="input-event-start-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event-end-date">📅 Enddatum (optional)</Label>
                    <Input 
                      id="event-end-date"
                      type="datetime-local"
                      value={newEvent.endDate}
                      onChange={(e) => setNewEvent({ ...newEvent, endDate: e.target.value })}
                      className="bg-secondary border-border"
                      data-testid="input-event-end-date"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-location" className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> Ort (optional)
                  </Label>
                  <Input 
                    id="event-location"
                    placeholder="z.B. Zuhause..." 
                    value={newEvent.location}
                    onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                    className="bg-secondary border-border"
                    data-testid="input-event-location"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={!newEvent.title || !newEvent.startDate}
                  data-testid="button-create-event"
                >
                  Termin hinzufügen
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.section>
      </div>
    );
  }

  if (currentView === "calendar-view") {
    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold mb-8">Familienkalender</h1>
        <section>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Calendar className="text-primary" /> Alle Termine
          </h2>
          <ParentEventsList events={events} onDeleteEvent={onDeleteEvent} />
        </section>
      </div>
    );
  }

  if (currentView === "wallet-settings" && user.role === "parent") {
    const [editLnbitsUrl, setEditLnbitsUrl] = useState("");
    const [editLnbitsAdminKey, setEditLnbitsAdminKey] = useState("");
    const [showAdminKey, setShowAdminKey] = useState(false);
    const [editNwcConnectionString, setEditNwcConnectionString] = useState("");

    const handleSaveLnbits = async () => {
      if (!editLnbitsUrl || !editLnbitsAdminKey) {
        toast({ title: "Fehler", description: "URL und Admin-Schlüssel erforderlich", variant: "destructive" });
        return;
      }

      try {
        const res = await fetch("/api/wallet/setup-parent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ peerId: user.id, lnbitsUrl: editLnbitsUrl, lnbitsAdminKey: editLnbitsAdminKey }),
        });
        if (!res.ok) throw new Error("Failed to save LNbits configuration");
        const data = await res.json();
        setUser(data);
        toast({ title: "Erfolg", description: "LNbits-Konto verbunden!" });
      } catch (error) {
        toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
      }
    };

    const handleSetupNwc = async () => {
      if (!editNwcConnectionString || !editNwcConnectionString.startsWith("nostr+walletconnect://")) {
        toast({ title: "Fehler", description: "Gültiger NWC Connection String erforderlich", variant: "destructive" });
        return;
      }

      try {
        const res = await fetch("/api/wallet/setup-nwc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ peerId: user.id, nwcConnectionString: editNwcConnectionString }),
        });
        if (!res.ok) throw new Error("Failed to save NWC configuration");
        const updatedUser = { ...user, hasNwcConfigured: true, walletType: "nwc" };
        setUser(updatedUser);
        localStorage.setItem("sats-user", JSON.stringify(updatedUser));
        setEditNwcConnectionString("");
        toast({ title: "Erfolg", description: "Nostr Wallet Connect verbunden!" });
      } catch (error) {
        toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
      }
    };

    const handleDeleteNwc = async () => {
      try {
        await fetch("/api/wallet/nwc", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ peerId: user.id }),
        });
        setUser({ ...user, hasNwcConfigured: false, walletType: user.hasLnbitsConfigured ? "lnbits" : null });
        toast({ title: "Getrennt", description: "NWC-Verbindung wurde entfernt" });
      } catch (error) {
        toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
      }
    };

    const handleSetActiveWallet = async (walletType: "lnbits" | "nwc") => {
      try {
        await fetch("/api/wallet/set-active", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ peerId: user.id, walletType }),
        });
        setUser({ ...user, walletType });
        toast({ title: "Aktive Wallet geändert", description: `${walletType === "nwc" ? "NWC" : "LNbits"} ist jetzt aktiv` });
      } catch (error) {
        toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
      }
    };

    return (
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center gap-3 mb-8">
          <button 
            onClick={() => setCurrentView("dashboard")} 
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-back-from-wallet-settings"
          >
            ← Zurück
          </button>
          <h1 className="text-3xl font-bold">Wallet Einstellungen</h1>
        </div>

        <Tabs defaultValue="lnbits" className="w-full">
          <TabsList className="bg-secondary p-1 border border-border mb-6">
            <TabsTrigger value="lnbits">LNbits</TabsTrigger>
            <TabsTrigger value="nwc">NWC</TabsTrigger>
          </TabsList>

          <TabsContent value="lnbits">
            <Card className="border-2 border-primary/40 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  LNbits Verbindung
                </CardTitle>
                <CardDescription>Verbinde dein LNbits-Konto um Aufgaben mit Satoshi-Belohnungen zu erstellen</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {user.hasLnbitsConfigured ? (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg border border-green-500/30 bg-green-500/10">
                      <p className="text-sm font-semibold text-green-300">LNbits verbunden</p>
                      <p className="text-sm text-muted-foreground mt-1">Wallet ist konfiguriert und einsatzbereit</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setUser({ ...user, hasLnbitsConfigured: false });
                          fetch("/api/wallet/disconnect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ peerId: user.id }) });
                          toast({ title: "Getrennt", description: "LNbits-Verbindung wurde entfernt" });
                        }}
                        variant="destructive"
                        size="sm"
                        data-testid="button-disconnect-lnbits"
                      >
                        Trennen
                      </Button>
                      {user.hasNwcConfigured && (
                        <Button
                          onClick={() => handleSetActiveWallet("lnbits")}
                          variant={user.walletType === "lnbits" ? "default" : "outline"}
                          size="sm"
                          data-testid="button-set-active-lnbits"
                        >
                          {user.walletType === "lnbits" ? "Aktiv" : "Als aktiv setzen"}
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="lnbits-url">LNbits Instanz URL</Label>
                      <Input 
                        id="lnbits-url"
                        placeholder="z.B. https://lnbits.example.com"
                        value={editLnbitsUrl}
                        onChange={(e) => setEditLnbitsUrl(e.target.value)}
                        className="font-mono text-xs"
                        data-testid="input-lnbits-url"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lnbits-key">Admin-Schlüssel</Label>
                      <div className="flex gap-2">
                        <Input 
                          id="lnbits-key"
                          placeholder="Admin-Schlüssel"
                          type={showAdminKey ? "text" : "password"}
                          value={editLnbitsAdminKey}
                          onChange={(e) => setEditLnbitsAdminKey(e.target.value)}
                          className="font-mono text-xs"
                          data-testid="input-lnbits-admin-key"
                        />
                        <Button
                          onClick={() => setShowAdminKey(!showAdminKey)}
                          variant="outline"
                          size="icon"
                          data-testid="button-toggle-admin-key"
                        >
                          {showAdminKey ? "🙈" : "👁️"}
                        </Button>
                      </div>
                    </div>
                    <Button 
                      onClick={handleSaveLnbits}
                      className="w-full bg-primary hover:bg-primary/90"
                      data-testid="button-save-lnbits"
                    >
                      LNbits verbinden
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="nwc">
            <Card className="border-2 border-cyan-500/40 bg-cyan-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Nostr Wallet Connect (NWC)
                </CardTitle>
                <CardDescription>Verbinde deine Wallet über das Nostr Wallet Connect Protokoll</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {user.hasNwcConfigured ? (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg border border-green-500/30 bg-green-500/10">
                      <p className="text-sm font-semibold text-green-300">NWC verbunden</p>
                      <p className="text-sm text-muted-foreground mt-1">Deine NWC Wallet ist konfiguriert und einsatzbereit</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleDeleteNwc}
                        variant="destructive"
                        size="sm"
                        data-testid="button-delete-nwc"
                      >
                        NWC trennen
                      </Button>
                      {user.hasLnbitsConfigured && (
                        <Button
                          onClick={() => handleSetActiveWallet("nwc")}
                          variant={user.walletType === "nwc" ? "default" : "outline"}
                          size="sm"
                          data-testid="button-set-active-nwc"
                        >
                          {user.walletType === "nwc" ? "Aktiv" : "Als aktiv setzen"}
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="nwc-connection">NWC Connection String</Label>
                      <Input 
                        id="nwc-connection"
                        placeholder="nostr+walletconnect://..."
                        value={editNwcConnectionString}
                        onChange={(e) => setEditNwcConnectionString(e.target.value)}
                        className="font-mono text-xs"
                        data-testid="input-nwc-connection"
                      />
                      <p className="text-xs text-muted-foreground">
                        Den Connection String erhältst du von deiner NWC-kompatiblen Wallet (z.B. Alby, Mutiny)
                      </p>
                    </div>
                    <Button 
                      onClick={handleSetupNwc}
                      disabled={!editNwcConnectionString || !editNwcConnectionString.startsWith("nostr+walletconnect://")}
                      className="w-full bg-cyan-600 hover:bg-cyan-600/90"
                      data-testid="button-setup-nwc"
                    >
                      NWC verbinden
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card className="mt-4 bg-secondary/30">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">
                  <strong>Was ist NWC?</strong> Nostr Wallet Connect ist ein offenes Protokoll, das es dir ermöglicht, 
                  Zahlungen direkt von deiner Wallet zu senden - ohne Server-Zwischenspeicherung. 
                  Unterstützte Wallets: Alby, Mutiny, und weitere.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {user.hasLnbitsConfigured && user.hasNwcConfigured && (
          <Card className="border border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4">
              <p className="text-sm text-amber-200">
                <strong>Aktive Wallet:</strong> {user.walletType === "nwc" ? "NWC (Nostr Wallet Connect)" : "LNbits"}
                <br />
                <span className="text-xs text-muted-foreground">
                  Du kannst zwischen beiden Wallets wechseln. Die aktive Wallet wird für alle Zahlungen verwendet.
                </span>
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (currentView === "level-bonus-settings" && user.role === "parent") {
    const [bonusSats, setBonusSats] = useState(210);
    const [milestoneInterval, setMilestoneInterval] = useState(5);
    const [isActive, setIsActive] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    const { data: settings } = useQuery({
      queryKey: ["level-bonus-settings", user.connectionId],
      queryFn: async () => {
        const res = await fetch(`/api/level-bonus/settings/${user.connectionId}`);
        if (!res.ok) throw new Error("Failed to fetch settings");
        return res.json();
      }
    });

    useEffect(() => {
      if (settings && !isLoaded) {
        setBonusSats(settings.bonusSats || 210);
        setMilestoneInterval(settings.milestoneInterval || 5);
        setIsActive(settings.isActive !== false);
        setIsLoaded(true);
      }
    }, [settings, isLoaded]);

    const handleSave = async () => {
      setIsSaving(true);
      try {
        const res = await fetch("/api/level-bonus/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parentId: user.id,
            connectionId: user.connectionId,
            bonusSats,
            milestoneInterval,
            isActive
          }),
        });
        if (!res.ok) throw new Error("Failed to save settings");
        toast({ title: "Erfolg", description: "Level-Bonus Einstellungen gespeichert!" });
        queryClient.invalidateQueries({ queryKey: ["level-bonus-settings"] });
      } catch (error) {
        toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
      } finally {
        setIsSaving(false);
      }
    };

    return (
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center gap-3 mb-8">
          <button 
            onClick={() => setCurrentView("dashboard")} 
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-back-from-level-bonus-settings"
          >
            ← Zurück
          </button>
          <h1 className="text-3xl font-bold">🏆 Level-Bonus Einstellungen</h1>
        </div>
        
        <Card className="border-2 border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              ⭐ Level-Bonus aktivieren
            </CardTitle>
            <CardDescription>
              Belohne deine Kinder mit einem Bonus, wenn sie bestimmte Level erreichen!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border">
              <div>
                <p className="font-semibold">Level-Bonus aktiviert</p>
                <p className="text-sm text-muted-foreground">Kinder erhalten Bonus-Sats bei Meilensteinen</p>
              </div>
              <Switch 
                checked={isActive} 
                onCheckedChange={setIsActive}
                data-testid="switch-level-bonus-active"
              />
            </div>

            {isActive && (
              <>
                <div className="space-y-3">
                  <Label htmlFor="bonus-sats" className="text-base font-semibold">Bonus-Betrag (Sats)</Label>
                  <div className="flex items-center gap-3">
                    <Input 
                      id="bonus-sats"
                      type="number"
                      min="1"
                      value={bonusSats}
                      onChange={(e) => setBonusSats(parseInt(e.target.value) || 0)}
                      className="w-32 text-lg font-bold text-center"
                      data-testid="input-level-bonus-sats"
                    />
                    <span className="text-xl text-amber-600 font-bold">⚡ Sats</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Dieser Betrag wird bei jedem Meilenstein gezahlt
                  </p>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="milestone-interval" className="text-base font-semibold">Meilenstein-Intervall</Label>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">Alle</span>
                    <Select 
                      value={String(milestoneInterval)} 
                      onValueChange={(v) => setMilestoneInterval(parseInt(v))}
                    >
                      <SelectTrigger className="w-24" data-testid="select-milestone-interval">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3">3</SelectItem>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground">Level</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Beispiel: Bei "alle 5 Level" gibt es Bonus bei Level 5, 10, 15, 20...
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30">
                  <p className="font-semibold mb-2">🎯 Vorschau</p>
                  <p className="text-sm">
                    Deine Kinder erhalten <span className="text-amber-600 font-bold">{bonusSats} Sats</span> Bonus
                    bei Level {Array.from({length: 5}, (_, i) => (i + 1) * milestoneInterval).join(", ")}...
                  </p>
                </div>
              </>
            )}

            <Button 
              onClick={handleSave}
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              disabled={isSaving}
              data-testid="button-save-level-bonus"
            >
              {isSaving ? "Speichere..." : "Einstellungen speichern"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              📖 So funktioniert das Level-System
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              {[
                { level: 1, tasks: 3, emoji: "✨" },
                { level: 2, tasks: 6, emoji: "🔍" },
                { level: 3, tasks: 9, emoji: "🤝" },
                { level: 4, tasks: 12, emoji: "🚀" },
                { level: 5, tasks: 15, emoji: "⚡" },
                { level: 6, tasks: 18, emoji: "🦸" },
                { level: 7, tasks: 21, emoji: "🎯" },
                { level: 8, tasks: 24, emoji: "🏆" },
                { level: 9, tasks: 27, emoji: "⭐" },
                { level: 10, tasks: 30, emoji: "👑" },
              ].map(l => (
                <div 
                  key={l.level} 
                  className={`p-2 rounded text-center ${l.level % milestoneInterval === 0 ? "bg-amber-500/20 border border-amber-500/50" : "bg-secondary/30"}`}
                >
                  <div className="text-lg">{l.emoji}</div>
                  <div className="font-semibold">Level {l.level}</div>
                  <div className="text-xs text-muted-foreground">{l.tasks} Aufgaben</div>
                  {l.level % milestoneInterval === 0 && (
                    <div className="text-xs text-amber-500 font-bold mt-1">+{bonusSats} ⚡</div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}

function ChildDashboard({ user, setUser, tasks, events, currentView, setCurrentView, onAccept, onSubmit, onDeleteEvent, queryClient, layoutView, setLayoutView, messages, setMessages, newMessage, setNewMessage, isLoadingMessage, setIsLoadingMessage }: any) {
  const [showLink, setShowLink] = useState(false);
  const [parentConnectionId, setParentConnectionId] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showTrackerChart, setShowTrackerChart] = useState(false);
  const { toast } = useToast();

  const { data: connectedPeers = [] } = useQuery({
    queryKey: ["peers", user.connectionId],
    queryFn: async () => {
      const res = await fetch(`/api/peers/connection/${user.connectionId}`);
      if (!res.ok) throw new Error("Failed to fetch peers");
      return res.json();
    },
    refetchInterval: 2000
  });

  const myTasks = tasks.filter((t: Task) => t.assignedTo === user.id);
  const availableTasks = tasks.filter((t: Task) => t.status === "open");

  const handleLink = async () => {
    if (!parentConnectionId) return;
    setIsLinking(true);
    try {
      const updated = await linkChildToParent(user.id, parentConnectionId);
      setUser(updated);
      localStorage.setItem("sats-user", JSON.stringify(updated));
      toast({
        title: "Verbunden! 🎉",
        description: "Du bist jetzt mit deinen Eltern verbunden"
      });
      setShowLink(false);
    } catch (error) {
      toast({
        title: "Fehler",
        description: (error as Error).message,
        variant: "destructive"
      });
    } finally {
      setIsLinking(false);
    }
  };

  if (currentView === "calendar") {
    const [rsvps, setRsvps] = useState<Record<number, string>>({});
    const [loading, setLoading] = useState<Record<number, boolean>>({});

    const handleRsvp = async (eventId: number, response: string) => {
      setLoading({ ...loading, [eventId]: true });
      try {
        await fetch(`/api/events/${eventId}/rsvps`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ peerId: user.id, response }),
        });
        setRsvps({ ...rsvps, [eventId]: response });
        toast({
          title: response === "accepted" ? "Zusage! 🎉" : "Absage bestätigt",
          description: response === "accepted" ? "Du nimmst am Termin teil!" : "Die Absage wurde registriert"
        });
      } catch (error) {
        toast({
          title: "Fehler",
          description: "RSVP konnte nicht gespeichert werden",
          variant: "destructive"
        });
      } finally {
        setLoading({ ...loading, [eventId]: false });
      }
    };

    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-8 text-slate-900">Familienkalender</h1>
        <div className="grid gap-4">
          {events.length === 0 ? (
            <div className="bg-white/50 backdrop-blur-xl border border-white/50 rounded-2xl p-8 text-center shadow-lg">
              <p className="text-slate-700">Noch keine Termine geplant</p>
            </div>
          ) : (
            events.map((event: FamilyEvent) => (
              <div key={event.id} className="bg-white/50 backdrop-blur-xl border border-white/50 rounded-2xl hover:bg-white/60 transition-colors shadow-lg">
                <div className="p-5">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-slate-900" data-testid={`text-event-title-child-${event.id}`}>{event.title}</h3>
                      <p className="text-xs text-slate-700 mt-2 flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(event.startDate).toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                      </p>
                      <p className="text-xs text-slate-700 flex items-center gap-1">
                        <span>⏰</span>
                        {new Date(event.startDate).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                        {event.endDate && ` - ${new Date(event.endDate).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`}
                      </p>
                      {event.description && <p className="text-slate-600 text-sm mt-3">{event.description}</p>}
                      {event.location && (
                        <p className="text-sm text-slate-700 flex items-center gap-1 mt-2">
                          <MapPin className="h-4 w-4" /> {event.location}
                        </p>
                      )}
                      <div className="flex gap-2 mt-4">
                        <Button
                          onClick={() => handleRsvp(event.id, "accepted")}
                          disabled={loading[event.id] || rsvps[event.id] === "declined"}
                          className={`flex-1 ${rsvps[event.id] === "accepted" ? "bg-green-600 hover:bg-green-700" : "bg-violet-600 hover:bg-violet-700"} text-white`}
                          data-testid={`button-accept-event-${event.id}`}
                        >
                          {rsvps[event.id] === "accepted" ? "✓ Zusage" : "Zusagen"}
                        </Button>
                        <Button
                          onClick={() => handleRsvp(event.id, "declined")}
                          disabled={loading[event.id] || rsvps[event.id] === "accepted"}
                          variant="destructive"
                          className="flex-1"
                          data-testid={`button-decline-event-${event.id}`}
                        >
                          {rsvps[event.id] === "declined" ? "✗ Absage" : "Absagen"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (currentView === "chat") {
    useEffect(() => {
      const fetchMessages = async () => {
        try {
          const res = await fetch(`/api/chat/${user.connectionId}`);
          if (res.ok) {
            const data = await res.json();
            setMessages(data);
          }
        } catch (error) {
          console.error("Failed to fetch messages:", error);
        }
      };
      fetchMessages();
      const interval = setInterval(fetchMessages, 2000);
      return () => clearInterval(interval);
    }, [user.connectionId]);
    
    const handleSendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newMessage.trim() || isLoadingMessage) return;
      setIsLoadingMessage(true);
      try {
        await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            connectionId: user.connectionId,
            fromPeerId: user.id,
            message: newMessage.trim(),
          }),
        });
        setNewMessage("");
        const res = await fetch(`/api/chat/${user.connectionId}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch (error) {
        toast({ title: "Fehler", description: "Nachricht konnte nicht gesendet werden", variant: "destructive" });
      } finally {
        setIsLoadingMessage(false);
      }
    };
    
    return (
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold mb-8 text-slate-900">Familienchat</h1>
        <div className="bg-white/50 backdrop-blur-xl border border-white/50 rounded-2xl shadow-lg">
          <div className="p-6">
            <div className="space-y-4">
              <div className="h-96 overflow-y-auto bg-white/30 rounded-lg p-4 space-y-3">
                {messages.length === 0 ? (
                  <p className="text-slate-600 text-center py-8">Noch keine Nachrichten</p>
                ) : (
                  messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.fromPeerId === user.id ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-xs rounded-lg px-4 py-2 border ${
                          msg.fromPeerId === user.id
                            ? "bg-violet-600 text-white border-violet-500"
                            : "bg-white/50 text-slate-800 border-white/40"
                        }`}
                      >
                        <p className="text-xs font-semibold mb-1">{msg.senderName}</p>
                        <p className="text-sm">{msg.message}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {new Date(msg.createdAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Nachricht eingeben..."
                  disabled={isLoadingMessage}
                  className="flex-1 bg-white/50 border-white/60 text-slate-900 placeholder:text-gray-500"
                  data-testid="input-chat-message"
                />
                <Button
                  type="submit"
                  disabled={!newMessage.trim() || isLoadingMessage}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === "leaderboard") {
    const [showLevels, setShowLevels] = useState(false);
    const { data: leaderboard = [] } = useQuery({
      queryKey: ["leaderboard", user.connectionId],
      queryFn: async () => {
        const res = await fetch(`/api/leaderboard/${user.connectionId}`);
        if (!res.ok) throw new Error("Failed to fetch leaderboard");
        return res.json();
      },
      refetchInterval: 2000
    });

    const { data: bonusSettings } = useQuery({
      queryKey: ["level-bonus-settings", user.connectionId],
      queryFn: async () => {
        const res = await fetch(`/api/level-bonus/settings/${user.connectionId}`);
        if (!res.ok) return null;
        return res.json();
      }
    });

    const { data: myPayouts = [] } = useQuery({
      queryKey: ["my-level-bonus-payouts", user.id],
      queryFn: async () => {
        const res = await fetch(`/api/level-bonus/payouts/${user.id}`);
        if (!res.ok) return [];
        return res.json();
      },
      enabled: user.role === "child"
    });

    const getMedalEmoji = (position: number) => {
      if (position === 0) return "🥇";
      if (position === 1) return "🥈";
      if (position === 2) return "🥉";
      return `${position + 1}.`;
    };

    const getAchievement = (completedTasks: number) => {
      if (completedTasks >= 30) return { emoji: "👑", title: "Level 10 – Großmeister der Blitze", color: "text-yellow-600" };
      if (completedTasks >= 27) return { emoji: "⭐", title: "Level 9 – Familienheld", color: "text-amber-600" };
      if (completedTasks >= 24) return { emoji: "🏆", title: "Level 8 – Wochenchampion", color: "text-purple-500" };
      if (completedTasks >= 21) return { emoji: "🎯", title: "Level 7 – Aufgabenprofi", color: "text-blue-600" };
      if (completedTasks >= 18) return { emoji: "🦸", title: "Level 6 – Superheld der Woche", color: "text-blue-500" };
      if (completedTasks >= 15) return { emoji: "⚡", title: "Level 5 – Blitzbringer", color: "text-amber-600" };
      if (completedTasks >= 12) return { emoji: "🚀", title: "Level 4 – Alltagsmeister", color: "text-amber-500" };
      if (completedTasks >= 9) return { emoji: "🤝", title: "Level 3 – Familienhelfer", color: "text-green-500" };
      if (completedTasks >= 6) return { emoji: "🔍", title: "Level 2 – Aufgabenentdecker", color: "text-green-600" };
      if (completedTasks >= 3) return { emoji: "✨", title: "Level 1 – Funkenstarter", color: "text-slate-500" };
      return { emoji: "🌱", title: "Anfänger", color: "text-slate-400" };
    };

    const levels = [
      { level: 0, emoji: "🌱", title: "Anfänger", tasks: "0 Aufgaben" },
      { level: 1, emoji: "✨", title: "Level 1 – Funkenstarter", tasks: "3 Aufgaben" },
      { level: 2, emoji: "🔍", title: "Level 2 – Aufgabenentdecker", tasks: "6 Aufgaben" },
      { level: 3, emoji: "🤝", title: "Level 3 – Familienhelfer", tasks: "9 Aufgaben" },
      { level: 4, emoji: "🚀", title: "Level 4 – Alltagsmeister", tasks: "12 Aufgaben" },
      { level: 5, emoji: "⚡", title: "Level 5 – Blitzbringer", tasks: "15 Aufgaben" },
      { level: 6, emoji: "🦸", title: "Level 6 – Superheld der Woche", tasks: "18 Aufgaben" },
      { level: 7, emoji: "🎯", title: "Level 7 – Aufgabenprofi", tasks: "21 Aufgaben" },
      { level: 8, emoji: "🏆", title: "Level 8 – Wochenchampion", tasks: "24 Aufgaben" },
      { level: 9, emoji: "⭐", title: "Level 9 – Familienheld", tasks: "27 Aufgaben" },
      { level: 10, emoji: "👑", title: "Level 10 – Großmeister der Blitze", tasks: "30 Aufgaben" },
    ];

    const hasBonusForLevel = (level: number) => {
      if (!bonusSettings || !bonusSettings.isActive || level === 0) return false;
      return level % bonusSettings.milestoneInterval === 0;
    };

    const isBonusPaid = (level: number) => {
      return myPayouts.some((p: any) => p.level === level);
    };

    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-2">🏆 Bestenliste</h1>
        <p className="text-muted-foreground mb-6">Wer ist der beste Aufgabenerlediger in der Familie?</p>
        
        {/* Level Legend - Collapsible */}
        <Card className="mb-6 bg-primary/5 border border-primary/30">
          <button
            onClick={() => setShowLevels(!showLevels)}
            className="w-full flex items-center justify-between p-4 hover:bg-primary/10 transition-colors"
            data-testid="button-toggle-levels"
          >
            <h3 className="text-lg font-semibold">📋 Level-Übersicht</h3>
            <ChevronDown 
              className={`h-5 w-5 transition-transform ${showLevels ? "rotate-180" : ""}`}
            />
          </button>
          {showLevels && (
            <CardContent className="pt-0 pb-4">
              {bonusSettings && bonusSettings.isActive && (
                <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <p className="text-sm font-semibold text-amber-300 mb-1">🏆 Level-Bonus aktiv!</p>
                  <p className="text-xs text-muted-foreground">
                    Alle {bonusSettings.milestoneInterval} Level gibt es <span className="text-amber-600 font-bold">{bonusSettings.bonusSats} Sats</span> Bonus!
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {levels.map((level) => {
                  const hasBonus = hasBonusForLevel(level.level);
                  const bonusPaid = isBonusPaid(level.level);
                  return (
                    <div 
                      key={level.level} 
                      className={`text-center p-2 rounded-lg border transition-colors ${
                        hasBonus 
                          ? bonusPaid 
                            ? "bg-green-500/10 border-green-500/50" 
                            : "bg-amber-500/10 border-amber-500/50"
                          : "bg-card/50 border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="text-2xl mb-1">{level.emoji}</div>
                      <p className="text-xs font-semibold line-clamp-2">{level.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{level.tasks}</p>
                      {hasBonus && (
                        <div className={`text-xs font-bold mt-1 ${bonusPaid ? "text-green-400" : "text-amber-400"}`}>
                          {bonusPaid ? "✓ Bonus erhalten" : `+${bonusSettings?.bonusSats} ⚡`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          )}
        </Card>
        
        {leaderboard.length === 0 ? (
          <Card className="border-dashed border-border p-8 text-center">
            <Trophy className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Noch keine Kinder in der Familie</p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {leaderboard.map((entry: any, index: number) => {
              const achievement = getAchievement(entry.completedTasks);
              return (
              <Card 
                key={entry.id} 
                className={`border-2 transition-all ${
                  index === 0 
                    ? "border-yellow-500/50 bg-yellow-500/5" 
                    : index === 1 
                    ? "border-slate-400/50 bg-slate-400/5"
                    : index === 2
                    ? "border-orange-600/50 bg-orange-600/5"
                    : "border-border"
                }`}
              >
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <div className="text-3xl font-bold w-12 text-center">
                      {getMedalEmoji(index)}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-lg" data-testid={`text-leaderboard-name-${entry.id}`}>{entry.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {entry.completedTasks} Aufgabe{entry.completedTasks !== 1 ? "n" : ""} erledigt
                      </p>
                      <div className="flex items-center gap-1 mt-2">
                        <span className={`text-2xl ${achievement.color}`}>{achievement.emoji}</span>
                        <span className="text-xs font-semibold text-foreground">{achievement.title}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary" data-testid={`text-leaderboard-sats-${entry.id}`}>
                        {entry.satsEarned}
                      </p>
                      <p className="text-xs text-muted-foreground">Sats verdient</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Aktuelles Guthaben</span>
                      <span className="font-semibold" data-testid={`text-leaderboard-balance-${entry.id}`}>{entry.balance} Sats</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
            })}
          </div>
        )}
      </div>
    );
  }

  if (currentView === "peers") {
    const { data: connectedPeers = [] } = useQuery({
      queryKey: ["peers", user.connectionId],
      queryFn: async () => {
        const res = await fetch(`/api/peers/connection/${user.connectionId}`);
        if (!res.ok) throw new Error("Failed to fetch peers");
        return res.json();
      },
      refetchInterval: 2000
    });

    const parent = connectedPeers
      .filter((p: any) => p.role === "parent")
      .sort((a: any, b: any) => a.id - b.id)[0];

    const handleUnlink = async () => {
      if (!window.confirm("Möchtest du dich wirklich von dieser Familie trennen?")) return;
      
      try {
        const res = await fetch("/api/peers/unlink", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ childId: user.id })
        });
        if (!res.ok) throw new Error("Failed to unlink");
        const updated = await res.json();
        setUser(updated);
        queryClient.invalidateQueries({ queryKey: ["peers"] });
        toast({ title: "Trennung erfolgreich", description: "Du bist nicht mehr mit der Familie verbunden" });
      } catch (error) {
        toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
      }
    };

    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Meine Familie</h1>
        {parent ? (
          <Card className="border-2 border-primary/40 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Verbunden mit
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
                    {parent.name[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{parent.name}</p>
                    <p className="text-xs text-muted-foreground">👨‍👩‍👧 Eltern</p>
                  </div>
                </div>
              </div>
              <Button 
                variant="outline"
                onClick={handleUnlink}
                className="w-full text-destructive hover:text-destructive"
                data-testid="button-unlink-parent"
              >
                <X className="h-4 w-4 mr-2" /> Von Familie trennen
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed border-border p-8 text-center">
            <Info className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Du bist noch nicht mit einer Familie verbunden</p>
            <p className="text-xs text-muted-foreground mt-2">Verbinde dich mit deinen Eltern über den Dashboard Bereich</p>
          </Card>
        )}
      </div>
    );
  }

  if (currentView === "settings" && user.role === "parent") {
    const { data: connectedPeers = [] } = useQuery({
      queryKey: ["peers", user.connectionId],
      queryFn: async () => {
        const res = await fetch(`/api/peers/connection/${user.connectionId}`);
        if (!res.ok) throw new Error("Failed to fetch peers");
        return res.json();
      },
      refetchInterval: 5000
    });

    const children = connectedPeers.filter((p: any) => p.role === "child");
    const [resetPinChildId, setResetPinChildId] = useState<number | null>(null);
    const [resetPinValue, setResetPinValue] = useState("");
    const [editLnbitsUrl, setEditLnbitsUrl] = useState("");
    const [editLnbitsAdminKey, setEditLnbitsAdminKey] = useState("");
    const [showAdminKey, setShowAdminKey] = useState(false);

    const handleResetPin = async (childId: number) => {
      const passwordCheck = validatePassword(resetPinValue);
      if (!passwordCheck.valid) {
        toast({ title: "Fehler", description: passwordCheck.error, variant: "destructive" });
        return;
      }

      try {
        const res = await fetch(`/api/peers/${childId}/reset-pin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parentId: user.id, newPin: resetPinValue }),
        });
        if (!res.ok) throw new Error("Passwort-Änderung fehlgeschlagen");
        setResetPinChildId(null);
        setResetPinValue("");
        queryClient.invalidateQueries({ queryKey: ["peers"] });
        toast({ title: "Erfolg", description: "Passwort wurde zurückgesetzt" });
      } catch (error) {
        toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
      }
    };

    const handleSaveLnbits = async () => {
      if (!editLnbitsUrl || !editLnbitsAdminKey) {
        toast({ title: "Fehler", description: "URL und Admin-Schlüssel erforderlich", variant: "destructive" });
        return;
      }

      try {
        const res = await fetch("/api/wallet/setup-parent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ peerId: user.id, lnbitsUrl: editLnbitsUrl, lnbitsAdminKey: editLnbitsAdminKey }),
        });
        if (!res.ok) throw new Error("Failed to save LNbits configuration");
        const data = await res.json();
        setUser(data);
        toast({ title: "Erfolg", description: "LNbits-Konto verbunden!" });
      } catch (error) {
        toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
      }
    };

    return (
      <div className="max-w-4xl space-y-6">
        <h1 className="text-3xl font-bold mb-8">Einstellungen</h1>
        
        <Card className="border-2 border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              ⚡ LNbits Verbindung
            </CardTitle>
            <CardDescription>Verbinde dein LNbits-Konto um Aufgaben mit Satoshi-Belohnungen zu erstellen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {user.hasLnbitsConfigured ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg border border-green-500/30 bg-green-500/10">
                  <p className="text-sm font-semibold text-green-300">✓ LNbits verbunden</p>
                  <p className="text-sm text-muted-foreground mt-1">Wallet ist konfiguriert und einsatzbereit</p>
                </div>
                <Button
                  onClick={() => {
                    setUser({ ...user, hasLnbitsConfigured: false });
                    fetch("/api/wallet/disconnect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ peerId: user.id }) });
                    toast({ title: "Getrennt", description: "LNbits-Verbindung wurde entfernt" });
                  }}
                  variant="destructive"
                  size="sm"
                  data-testid="button-disconnect-lnbits"
                >
                  Trennen
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="lnbits-url">LNbits Instanz URL</Label>
                  <Input 
                    id="lnbits-url"
                    placeholder="z.B. https://lnbits.example.com"
                    value={editLnbitsUrl}
                    onChange={(e) => setEditLnbitsUrl(e.target.value)}
                    className="font-mono text-xs"
                    data-testid="input-lnbits-url"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lnbits-key">Admin-Schlüssel</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="lnbits-key"
                      placeholder="Admin-Schlüssel"
                      type={showAdminKey ? "text" : "password"}
                      value={editLnbitsAdminKey}
                      onChange={(e) => setEditLnbitsAdminKey(e.target.value)}
                      className="font-mono text-xs"
                      data-testid="input-lnbits-admin-key"
                    />
                    <Button
                      onClick={() => setShowAdminKey(!showAdminKey)}
                      variant="outline"
                      size="icon"
                      data-testid="button-toggle-admin-key"
                    >
                      {showAdminKey ? "🙈" : "👁️"}
                    </Button>
                  </div>
                </div>
                <Button 
                  onClick={handleSaveLnbits}
                  className="w-full bg-primary hover:bg-primary/90"
                  data-testid="button-save-lnbits"
                >
                  LNbits verbinden
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        {children.length > 0 && (
          <>
            <Card className="border-2 border-primary/40 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  👶 Kinder-Verwaltung
                </CardTitle>
                <CardDescription>Verwalte Passwörter deiner Kinder</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {children.map((child: any) => (
                    <div key={child.id} className="p-3 rounded-lg border border-border bg-secondary/30 flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{child.name}</p>
                        <p className="text-xs text-muted-foreground">Passwort: ••••••••</p>
                      </div>
                      <Button
                        onClick={() => setResetPinChildId(child.id)}
                        variant="outline"
                        size="sm"
                        data-testid={`button-reset-pin-${child.id}`}
                      >
                        Passwort zurücksetzen
                      </Button>
                    </div>
                  ))}

                  {resetPinChildId && (
                    <div className="p-4 rounded-lg border-2 border-amber-500/50 bg-amber-500/10 space-y-3">
                      <p className="text-sm font-semibold">Neues Passwort eingeben:</p>
                      <Input
                        type="password"
                        maxLength={12}
                        placeholder="8-12 Zeichen"
                        value={resetPinValue}
                        onChange={(e) => setResetPinValue(e.target.value.slice(0, 12))}
                        className="text-lg"
                        data-testid="input-new-child-pin"
                      />
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p className={resetPinValue.length >= 8 && resetPinValue.length <= 12 ? "text-green-500" : ""}>
                          {resetPinValue.length >= 8 && resetPinValue.length <= 12 ? "✓" : "○"} {resetPinValue.length}/8-12 Zeichen
                        </p>
                        <p className={/[A-Z]/.test(resetPinValue) ? "text-green-500" : ""}>
                          {/[A-Z]/.test(resetPinValue) ? "✓" : "○"} 1 Großbuchstabe
                        </p>
                        <p className={/[0-9]/.test(resetPinValue) ? "text-green-500" : ""}>
                          {/[0-9]/.test(resetPinValue) ? "✓" : "○"} 1 Zahl
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleResetPin(resetPinChildId)}
                          className="flex-1 bg-primary hover:bg-primary/90"
                          disabled={!validatePassword(resetPinValue).valid}
                          data-testid="button-confirm-reset-pin"
                        >
                          Passwort ändern
                        </Button>
                        <Button
                          onClick={() => {
                            setResetPinChildId(null);
                            setResetPinValue("");
                          }}
                          variant="outline"
                          className="flex-1"
                          data-testid="button-cancel-reset-pin"
                        >
                          Abbrechen
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    );
  }

  if (currentView === "settings" && user.role === "child") {
    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Einstellungen</h1>
        <Card className="border-2 border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bitcoin className="h-5 w-5 text-primary" /> Lightning Adresse
            </CardTitle>
            <CardDescription>Hinterlege deine Lightning Adresse um Sats zu erhalten (z.B. skypilink@walletofsatoshi.com)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="child-lightning-address">Lightning Adresse</Label>
              <Input 
                id="child-lightning-address"
                placeholder="name@walletofsatoshi.com"
                defaultValue={user.lightningAddress || ""}
                className="font-mono text-xs"
                data-testid="input-child-lightning-address"
              />
              <p className="text-xs text-muted-foreground">
                Format: name@domain.com
              </p>
              <p className="text-xs text-muted-foreground">
                Status: {user.lightningAddress ? "✓ Konfiguriert" : "✗ Nicht konfiguriert"}
              </p>
            </div>
            <Button 
              onClick={() => {
                const addr = (document.getElementById("child-lightning-address") as HTMLInputElement)?.value;
                if (addr) {
                  fetch("/api/wallet/setup-child-address", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ peerId: user.id, lightningAddress: addr }),
                  }).then(r => r.json()).then(data => {
                    setUser(data);
                    toast({ title: "Lightning Adresse gespeichert!", description: "Du erhältst nun Sats direkt" });
                  }).catch(err => toast({ title: "Fehler", description: err.message, variant: "destructive" }));
                }
              }}
              className="bg-primary hover:bg-primary/90"
              data-testid="button-save-child-lightning-address"
            >
              Speichern
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentView === "bitcoin-education" && user.role === "child") {
    const [passedQuizzes, setPassedQuizzes] = useState<string[]>(() => {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem("passed-quizzes") : null;
      return saved ? JSON.parse(saved) : [];
    });
    const [showQuiz, setShowQuiz] = useState<string | null>(null);
    const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
    const [quizSubmitted, setQuizSubmitted] = useState<Record<string, boolean>>({});
    const [educationTab, setEducationTab] = useState<"modules" | "converter" | "challenges" | "resources">("modules");
    const [satoshiInput, setSatoshiInput] = useState("100000");
    const [bitcoinInput, setBitcoinInput] = useState("0.001");
    const [euroInput, setEuroInput] = useState("50");
    const [btcPrice, setBtcPrice] = useState<number | null>(null);
    const [xp, setXp] = useState(0);
    
    // Challenge pool with different types
    const challengePool = [
      { type: "quiz", title: "Bitcoin Quiz", description: "Beantworte eine Bitcoin Frage richtig", icon: "🧠", reward: 50, question: "Was sind die maximalen Bitcoin?", options: ["21 Millionen", "Unbegrenzt", "1 Milliarde"], correct: 0 },
      { type: "conversion", title: "Satoshi Konvertierung", description: "Konvertiere 100.000 Sats zu Bitcoin", icon: "🔄", reward: 40, challenge: "Wie viel Bitcoin sind 100.000 Satoshis?" },
      { type: "lightning", title: "Lightning Lektion", description: "Lerne über das Lightning Network", icon: "⚡", reward: 45, question: "Was ist das Hauptvorteil von Lightning?", options: ["Schnelle & billige Transaktionen", "Hohe Sicherheit", "Dezentralisierung"], correct: 0 },
      { type: "security", title: "Sicherheits-Challenge", description: "Teste dein Bitcoin Sicherheitswissen", icon: "🔒", reward: 55, question: "Was ist ein Private Key?", options: ["Dein Secret Password für die Wallet", "Die öffentliche Addresse", "Ein Bitcoin"], correct: 0 },
      { type: "fun", title: "Bitcoin Fun Challenge", description: "Finde die richtige Satoshi-Definition", icon: "🎮", reward: 35, question: "Wer ist Satoshi Nakamoto?", options: ["Der anonyme Bitcoin Erfinder", "Ein Unternehmer", "Ein YouTuber"], correct: 0 },
      { type: "blockchain", title: "Blockchain Basics", description: "Teste dein Blockchain Wissen", icon: "⛓️", reward: 48, question: "Wie lange dauert es einen Bitcoin Block zu erstellen?", options: ["Ca. 10 Minuten", "Ca. 1 Minute", "Ca. 1 Stunde"], correct: 0 }
    ];
    
    // Initialize daily challenge with default value
    const today = new Date().toDateString();
    const [dailyChallenge, setDailyChallenge] = useState<{ completed: boolean; reward: number; type: string; title: string; description: string; icon: string; [key: string]: any }>(() => {
      const lastChallengeDay = typeof localStorage !== 'undefined' ? localStorage.getItem("last-challenge-day") : null;
      if (lastChallengeDay !== today) {
        const selectedChallenge = challengePool[Math.floor(Math.random() * challengePool.length)];
        const newChallenge = { ...selectedChallenge, completed: false };
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem("last-challenge-day", today);
          localStorage.setItem("daily-challenge", JSON.stringify(newChallenge));
        }
        return newChallenge;
      } else {
        const saved = typeof localStorage !== 'undefined' ? localStorage.getItem("daily-challenge") : null;
        if (saved) return JSON.parse(saved);
        const selectedChallenge = challengePool[Math.floor(Math.random() * challengePool.length)];
        return { ...selectedChallenge, completed: false };
      }
    });
    
    useEffect(() => {
      const fetchBtcPrice = async () => {
        try {
          const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur');
          const data = await response.json();
          setBtcPrice(data.bitcoin.eur);
        } catch (error) {
          console.error("[BTC Price] Failed to fetch:", error);
        }
      };
      fetchBtcPrice();
    }, []);
    
    const modules = [
      { id: "m1", level: "Anfänger", levelColor: "text-green-600", title: "Was ist Bitcoin?", icon: "₿", content: ["Bitcoin ist digitales Geld - wie elektronische Münzen", "Es wurde 2009 von Satoshi Nakamoto erfunden", "Es gibt maximal 21 Millionen Bitcoin", "Bitcoin ist dezentralisiert - keine Bank kontrolliert es", "Jeder Bitcoin kann in 100.000.000 Satoshis aufgeteilt werden", "Das Bitcoin Netzwerk wird von tausenden Computern gesichert", "Transaktionen sind transparent und nicht rückgängig zu machen", "Bitcoin ist das erste erfolgreiche digitale Geld"], quiz: [{ question: "Wann wurde Bitcoin erfunden?", options: ["2009", "2015", "2001"], correct: 0 }, { question: "Wie viele Bitcoin gibt es maximal?", options: ["21 Millionen", "Unbegrenzt", "1 Milliarde"], correct: 0 }, { question: "Wer ist Satoshi Nakamoto?", options: ["Der anonyme Bitcoin Erfinder", "Ein YouTuber", "Ein Politiker"], correct: 0 }] },
      { id: "m2", level: "Anfänger", levelColor: "text-green-600", title: "Was sind Satoshis (Sats)?", icon: "⚡", content: ["Satoshis sind die kleinste Einheit von Bitcoin", "1 Bitcoin = 100.000.000 Satoshis (10^8)", "Ein Satoshi ist 0,00000001 Bitcoin", "Der Name ehrt Satoshi Nakamoto, den Bitcoin Erfinder", "Sats sind perfekt für kleine alltägliche Transaktionen", "Gerade du verdienst Sats mit deinen Aufgaben!", "Mit Sats vermeidest du große unhandliche Zahlen", "Sats machen Bitcoin praktisch für Kinder und kleine Payments"], quiz: [{ question: "1 Bitcoin = ? Satoshis", options: ["100.000.000", "1.000.000", "10.000"], correct: 0 }, { question: "Wie viel ist ein Satoshi?", options: ["0,00000001 Bitcoin", "0,01 Bitcoin", "0,1 Bitcoin"], correct: 0 }, { question: "Wer war Satoshi?", options: ["Bitcoin Erfinder", "Ein Astronaut", "Ein Sänger"], correct: 0 }] },
      { id: "m3", level: "Anfänger", levelColor: "text-green-600", title: "Wie funktioniert Bitcoin?", icon: "🔄", content: ["Bitcoin funktioniert ohne Mittelsmann oder Bank", "Du sendest Bitcoin direkt an andere Menschen", "Das Netzwerk bestätigt jede Transaktion automatisch", "Deine Adresse ist öffentlich, dein Key ist geheim", "Jede Transaktion wird in der Blockchain gespeichert", "Das Netzwerk prüft ob du genug Bitcoin hast", "Du brauchst keine Erlaubnis von niemand um zu zahlen", "Bitcoin ist zensurresistent - niemand kann es stoppen"], quiz: [{ question: "Wer bestätigt Bitcoin Transaktionen?", options: ["Das Netzwerk", "Eine Bank", "Der Staat"], correct: 0 }, { question: "Braucht du eine Bank für Bitcoin?", options: ["Nein, nie", "Ja immer", "Manchmal"], correct: 0 }, { question: "Wo werden Bitcoin Transaktionen gespeichert?", options: ["In der Blockchain", "In einer App", "Bei Amazon"], correct: 0 }] },
      { id: "m4", level: "Anfänger", levelColor: "text-green-600", title: "Adressen & Wallets", icon: "📍", content: ["Eine Bitcoin Adresse ist deine öffentliche Kontonummer", "Sie sieht aus wie: bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", "Du kannst deine Adresse jedem geben - sie ist öffentlich", "Ein Wallet ist deine digitale Geldbörse", "Dein Wallet speichert deine privaten Keys sicher", "Es gibt verschiedene Wallet-Typen: Mobile, Desktop, Hardware", "Lightning Adressen sehen anders aus als Bitcoin Adressen", "Deine Lightning Adresse ist zB: spikylip55@walletofsatoshi.com"], quiz: [{ question: "Kann ich meine Bitcoin Adresse öffentlich machen?", options: ["Ja, immer", "Nein, geheim halten", "Nur für Freunde"], correct: 0 }, { question: "Was ist ein Wallet?", options: ["Eine digitale Geldbörse", "Ein echtes Portemonnaie", "Ein Bank-Konto"], correct: 0 }, { question: "Sind Bitcoin Adressen wiederverwendbar?", options: ["Ja", "Nein", "Nur einmal"], correct: 0 }] },
      { id: "m5", level: "Anfänger", levelColor: "text-green-600", title: "Bitcoin Kurse verstehen", icon: "📈", content: ["Bitcoin hat einen Marktpreis wie Aktien", "Einen Tag kostet Bitcoin mehr, anderswo weniger", "Der Kurs schwankt weil Angebot & Nachfrage sich ändert", "Es gibt keine zentrale Stelle die den Kurs kontrolliert", "Der Preis ist fair weil der Markt es bestimmt", "Du kannst Bitcoin zu unterschiedlichen Preisen kaufen", "Jede Börse kann unterschiedliche Kurse haben", "Charts zeigen die Preisentwicklung über Zeit"], quiz: [{ question: "Wer setzt den Bitcoin Preis fest?", options: ["Der Markt (Angebot & Nachfrage)", "Die Regierung", "Eine Firma"], correct: 0 }, { question: "Kann der Bitcoin Preis schwanken?", options: ["Ja, täglich", "Nein, immer gleich", "Nur im Winter"], correct: 0 }, { question: "Warum gibt es verschiedene Kurse?", options: ["Verschiedene Börsen & Märkte", "Technische Fehler", "Zufall"], correct: 0 }] },
      { id: "m6", level: "Mittelstufe", levelColor: "text-yellow-600", title: "Lightning Network Basics", icon: "⚡", content: ["Lightning ist ein Netzwerk ÜBER Bitcoin für schnelle Zahlungen", "Normale Bitcoin Transaktionen dauern ~10 Minuten", "Lightning Transaktionen dauern Sekunden!", "Lightning Kanäle ermöglichen sofortige Payments", "Gebühren sind extrem niedrig - oft unter 1 Sat", "Du brauchst Lightning für tägliche Zahlungen", "Das ist wie der Unterschied zwischen Brief und E-Mail", "Lightning wurde erfunden um Bitcoin zu skalieren"], quiz: [{ question: "Wie schnell sind Lightning Transaktionen?", options: ["Sekunden", "Minuten", "Stunden"], correct: 0 }, { question: "Sind Lightning Gebühren hoch?", options: ["Nein, sehr niedrig", "Ja, teuer", "Kostenlos immer"], correct: 0 }, { question: "Wann wurde Lightning vorgeschlagen?", options: ["2015", "2009", "2020"], correct: 0 }] },
      { id: "m7", level: "Mittelstufe", levelColor: "text-yellow-600", title: "Blockchain Technologie", icon: "🔗", content: ["Eine Blockchain ist eine Kette von Blöcken", "Jeder Block speichert viele Transaktionen", "Blöcke sind kryptographisch miteinander verbunden", "Das macht Fälschungen unmöglich", "Das komplette Bitcoin Ledger ist öffentlich", "Tausende Nodes speichern die ganze Blockchain", "Ein neuer Block wird ca. alle 10 Minuten hinzugefügt", "Die Bitcoin Blockchain läuft seit 2009 ununterbrochen"], quiz: [{ question: "Warum ist Blockchain sicher?", options: ["Blöcke sind verkettet & verteilt", "Ist verschlüsselt", "Nur eine Person hat Zugriff"], correct: 0 }, { question: "Wie oft kommt ein neuer Block?", options: ["Alle 10 Minuten", "Jede Sekunde", "Jede Stunde"], correct: 0 }, { question: "Wer kontrolliert die Blockchain?", options: ["Das Netzwerk dezentral", "Eine Firma", "Ein Land"], correct: 0 }] },
      { id: "m8", level: "Mittelstufe", levelColor: "text-yellow-600", title: "Mining erklärt", icon: "⛏️", content: ["Mining ist das Erstellen neuer Bitcoin Blöcke", "Miners lösen komplexe mathematische Probleme", "Der erste Miner bekommt eine Belohnung in Bitcoin", "Das Netzwerk wird durch Mining gesichert", "Mining ist schwer und braucht viel Elektrizität", "Die Belohnung wird alle 4 Jahre halbiert (Halving)", "2024: Ein Block gibt 6.25 Bitcoin", "Früher waren es 50 Bitcoin pro Block (2009)", "Mining macht das Netzwerk dezentralisiert"], quiz: [{ question: "Was ist Mining?", options: ["Neue Blöcke erstellen & Bitcoin verdienen", "Mit einer Spitzhacke arbeiten", "Bitcoin abbauen"], correct: 0 }, { question: "Wann wird die Miner-Belohnung halbiert?", options: ["Alle 4 Jahre", "Täglich", "Nie"], correct: 0 }, { question: "Wie viel Bitcoin pro Block heute?", options: ["6.25", "50", "100"], correct: 0 }] },
      { id: "m9", level: "Mittelstufe", levelColor: "text-yellow-600", title: "Smart Contracts & DeFi", icon: "🤖", content: ["Smart Contracts sind automatische Verträge auf der Blockchain", "Sie führen sich selbst aus wenn Bedingungen erfüllt sind", "DeFi = Dezentralisierte Finanzierung", "DeFi Apps laufen auf Blockchains wie Bitcoin/Ethereum", "Du brauchst keine Bank für DeFi Dienste", "DeFi ist transparent - jeder kann den Code sehen", "Risiken: Code Fehler, Scams, Marktvolatilität", "DeFi Apps werden immer beliebter"], quiz: [{ question: "Was ist ein Smart Contract?", options: ["Automatischer digitaler Vertrag", "Ein normales Stück Papier", "Ein Anwalt"], correct: 0 }, { question: "DeFi braucht Banken?", options: ["Nein", "Ja", "Manchmal"], correct: 0 }, { question: "Ist DeFi transparent?", options: ["Ja, komplett", "Nein, geheim", "Teilweise"], correct: 0 }] },
      { id: "m10", level: "Mittelstufe", levelColor: "text-yellow-600", title: "Bitcoin vs Gold", icon: "🏆", content: ["Bitcoin wird oft mit Gold verglichen", "Beide sind selten: 21 Millionen Bitcoin, begrenzte Goldmenge", "Gold lagert man physisch, Bitcoin digital", "Bitcoin ist schneller zu senden als Gold", "Gold ist älter und bekannter als Bitcoin", "Bitcoin braucht kein Lagerhaus", "Gold ist greifbar, Bitcoin ist nur digital", "Beide sind gute Wertspeicher"], quiz: [{ question: "Ist Bitcoin wie Gold?", options: ["Ja, beides Wertspeicher", "Nein, ganz anders", "Nur ähnlich"], correct: 0 }, { question: "Wieviel Bitcoin gibt es maximal?", options: ["21 Millionen", "Unbegrenzt", "Unbekannt"], correct: 0 }, { question: "Kann man Bitcoin anfassen?", options: ["Nein, nur digital", "Ja, überall", "Manchmal"], correct: 0 }] },
      { id: "m11", level: "Fortgeschritten", levelColor: "text-red-600", title: "Kryptographie in Bitcoin", icon: "🔐", content: ["Bitcoin nutzt Kryptographie um sicher zu sein", "Öffentliche & private Keys basieren auf Mathematik", "SHA-256 ist der Hashing Algorithmus von Bitcoin", "ECDSA wird für digitale Signaturen benutzt", "Dein privater Key generiert deine öffentliche Adresse", "Das ist mathematisch einfach in eine Richtung", "Aber fast unmöglich umzukehren", "Das macht Bitcoin Adressen sicher"], quiz: [{ question: "Was ist SHA-256?", options: ["Bitcoin Hashing Algorithmus", "Eine Währung", "Ein Wallet"], correct: 0 }, { question: "Kann man aus der Adresse den privaten Key bekommen?", options: ["Nein, mathematisch unmöglich", "Ja, mit Zeit", "Nur mit Supercomputer"], correct: 0 }, { question: "Wofür werden private Keys genutzt?", options: ["Um Transaktionen zu signieren", "Um Bitcoin zu sehen", "Um Geld zu senden"], correct: 0 }] },
      { id: "m12", level: "Fortgeschritten", levelColor: "text-red-600", title: "Private & Public Keys", icon: "🔑", content: ["Dein privater Key ist dein Passwort - ABSOLUTE GEHEIM!", "Der private Key als lange Zahl: z.B. 48 Zeichen Hex", "Dein privater Key generiert deine öffentliche Adresse", "Öffentliche Adressen sind für alle sichtbar", "Mit deinem privaten Key kannst du Geld ausgeben", "Ohne Private Key: Niemand kann es für dich tun", "Wenn du deinen Key verlierst: Dein Geld ist für immer weg", "Es gibt keine 'Passwort zurücksetzen' Funktion"], quiz: [{ question: "Sollte man seinen privaten Key weitergeben?", options: ["NEIN, niemals", "Ja, mit Freunden", "Nur im Notfall"], correct: 0 }, { question: "Was passiert wenn du deinen Key verlierst?", options: ["Dein Geld ist weg", "Bitcoin sendet es zurück", "Die Bank hilft dir"], correct: 0 }, { question: "Kann man zwei verschiedene Private Keys zu einer Adresse haben?", options: ["Nein", "Ja", "Manchmal"], correct: 0 }] },
      { id: "m13", level: "Fortgeschritten", levelColor: "text-red-600", title: "Wallet Sicherheit", icon: "🛡️", content: ["Wallets speichern deine privaten Keys", "Es gibt verschiedene Sicherheitsstufen: Hot & Cold Wallets", "Hot Wallets sind online - schneller aber risikoreicher", "Cold Wallets sind offline - sicherer aber weniger praktisch", "Hardware Wallets sind Mini-Computer für deine Keys", "Multi-Sig Wallets brauchen 2 von 3 Keys um Geld zu senden", "Backup deine Seeds/Keys an mehreren sicheren Orten", "Nutze Passwörter die niemand erraten kann"], quiz: [{ question: "Was ist ein Hot Wallet?", options: ["Online Wallet", "Warmes Wallet", "Ein physisches Wallet"], correct: 0 }, { question: "Sind Hardware Wallets sicher?", options: ["Ja, sehr", "Nein", "Manchmal"], correct: 0 }, { question: "Was ist Multi-Sig?", options: ["Mehrere Keys für eine Transaktion", "Eine Signatur", "Ein Name"], correct: 0 }] },
      { id: "m14", level: "Fortgeschritten", levelColor: "text-red-600", title: "Bitcoin Transaktionen", icon: "💸", content: ["Eine Bitcoin Transaktion hat Inputs & Outputs", "Input: Woher kommt das Bitcoin Geld", "Output: Wohin geht das Bitcoin Geld", "Du brauchst einen Private Key um eine Transaktion zu signieren", "Die Gebühr (Fee) ist der Unterschied zwischen Input & Output", "Höhere Gebühr = schnellere Bestätigung", "Du zahlst für die Blocksize den die Transaktion nutzt", "Jede Transaktion ist permanent und nicht rückgängig"], quiz: [{ question: "Was ist Input einer Transaktion?", options: ["Woher das Geld kommt", "Wohin das Geld geht", "Die Gebühr"], correct: 0 }, { question: "Kann man eine Bitcoin Transaktion rückgängig machen?", options: ["Nein, permanent", "Ja, mit Passwort", "Nur die Bank kann"], correct: 0 }, { question: "Wer entscheidet die Transaktionsgebühr?", options: ["Du selbst", "Bitcoin Netzwerk", "Die Miner"], correct: 0 }] },
      { id: "m15", level: "Fortgeschritten", levelColor: "text-red-600", title: "Proof of Work", icon: "💪", content: ["Proof of Work ist der Consensus Mechanismus von Bitcoin", "Miners müssen eine schwere mathematische Aufgabe lösen", "Der erste der die Lösung findet bekommt Belohnung", "Die Aufgabe wird schwerer je mehr Miners es gibt", "Das macht Bitcoin Attacks sehr teuer", "Um 51% Attack zu machen braucht man 51% der Rechenpower", "Das ist nahezu unmöglich und sehr teuer", "Proof of Work schützt die Blockchain"], quiz: [{ question: "Was ist Proof of Work?", options: ["Miners lösen schwere Aufgaben", "Arbeitsnachweis auf Papier", "Ein Mining Job"], correct: 0 }, { question: "Wird die Mining Aufgabe leichter oder schwerer?", options: ["Schwerer mit mehr Miners", "Immer leicht", "Zufällig"], correct: 0 }, { question: "Was schützt Proof of Work?", options: ["Die Blockchain vor Attacks", "Die Wallets", "Die Addresses"], correct: 0 }] },
      { id: "m16", level: "Fortgeschritten", levelColor: "text-red-600", title: "51% Attack", icon: "☠️", content: ["Ein 51% Attack ist wenn jemand >50% der Mining Power kontrolliert", "Dann könnte diese Person Transaktionen ändern", "Sie könnte Bitcoin doppelt ausgeben", "Das ist theoretisch möglich aber praktisch fast unmöglich", "Kostet Milliarden von Euro an Hardware & Elektrizität", "Die Bitcoin Community würde das sofort merken", "Die angegriffene Chain würde geforkt (geteilt)", "Bitcoin ist dadurch extrem sicher"], quiz: [{ question: "Was braucht man für einen 51% Attack?", options: [">50% der Mining Power", "Den privaten Key", "Ein Wallet"], correct: 0 }, { question: "Ist ein 51% Attack wahrscheinlich?", options: ["Nein, sehr teuer", "Ja, leicht", "Unmöglich"], correct: 0 }, { question: "Was würde die Community bei 51% Attack tun?", options: ["Fork die Chain", "Weiter machen", "Panick verkaufen"], correct: 0 }] },
      { id: "m17", level: "Fortgeschritten", levelColor: "text-red-600", title: "Bitcoin Regulierung", icon: "⚖️", content: ["Verschiedene Länder regeln Bitcoin unterschiedlich", "Manche Länder verbieten Bitcoin, andere erlauben es", "El Salvador hat Bitcoin als gesetzliches Zahlungsmittel", "Länder wie Argentinien nutzen Bitcoin gegen Inflation", "Regulierung ist wichtig für Stabilität & Verbraucherschutz", "Aber zu viel Regulierung könnte Bitcoin schwächen", "Die Balance ist schwer zu finden", "Regulierung ändert sich ständig"], quiz: [{ question: "Welches Land hat Bitcoin als offizielles Zahlungsmittel?", options: ["El Salvador", "Deutschland", "USA"], correct: 0 }, { question: "Ist Bitcoin überall erlaubt?", options: ["Nein, variiert pro Land", "Ja überall", "Nur in USA"], correct: 0 }, { question: "Gibt es Regulierung für Bitcoin?", options: ["Ja, variiert", "Nein", "Nur in Europa"], correct: 0 }] },
      { id: "m18", level: "Fortgeschritten", levelColor: "text-red-600", title: "Bitcoin Halving", icon: "📉", content: ["Halving ist wenn die Miner Belohnung halbiert wird", "Passiert alle 4 Jahre oder ~210.000 Blöcke", "2009: 50 BTC pro Block → 2012: 25 BTC → 2016: 12.5 BTC → 2020: 6.25 BTC", "2024 war das Halving zu 3.125 BTC", "Irgendwann wird die Belohnung 0", "Das gibt es nur 64 Mal in der Bitcoin Geschichte", "Nach dem letzten Halving verdienen Miners nur durch Gebühren", "Halving reduziert die Inflation"], quiz: [{ question: "Was ist Halving?", options: ["Belohnung wird halbiert", "Der Preis wird halbiert", "Die Blockchain wird geteilt"], correct: 0 }, { question: "Wie oft gibt es Halving?", options: ["Alle 4 Jahre", "Täglich", "Jede Woche"], correct: 0 }, { question: "Was ist die nächste Belohnung nach Halving?", options: ["1.5625 BTC", "6.25 BTC", "3.125 BTC"], correct: 0 }] },
      { id: "m19", level: "Fortgeschritten", levelColor: "text-red-600", title: "Altcoins vs Bitcoin", icon: "🪙", content: ["Altcoins sind alle Kryptowährungen außer Bitcoin", "Es gibt Tausende von Altcoins", "Manche sind innovativ, manche sind Scams", "Bitcoin ist die älteste und sicherste", "Bitcoin hat die größte Netzwerk Kraft", "Andere Coins haben oft bessere Technologie aber weniger Sicherheit", "Diversifikation ist wichtig für Anfänger", "Bitcoin ist der safest bet für Anfänger"], quiz: [{ question: "Was ist ein Altcoin?", options: ["Alle Kryptowährungen außer Bitcoin", "Eine spezifische Währung", "Ein Scam"], correct: 0 }, { question: "Ist Bitcoin die sicherste Krypto?", options: ["Ja", "Nein, Ethereum ist besser", "Alle gleich"], correct: 0 }, { question: "Wie viele Altcoins gibt es?", options: ["Tausende", "Hundert", "Zehn"], correct: 0 }] },
      { id: "m20", level: "Fortgeschritten", levelColor: "text-red-600", title: "Zukunft des Bitcoin", icon: "🚀", content: ["Bitcoin wird immer wichtiger für die Weltwirtschaft", "2024: >50 Millionen Menschen besitzen Bitcoin", "Große Unternehmen halten Bitcoin als Vermögensanlage", "Länder könnten Bitcoin als Reservewährung nutzen", "Lightning macht Bitcoin praktisch für tägliche Nutzung", "Du lernst heute die Technologie der Zukunft", "Bitcoin könnte die Finanzwelt revolutionieren", "Die Zukunft ist spannend für Bitcoin Nutzer"], quiz: [{ question: "Wie viele Menschen besitzen Bitcoin 2024?", options: [">50 Millionen", "1 Million", "Niemand"], correct: 0 }, { question: "Welche großen Firmen halten Bitcoin?", options: ["MicroStrategy, Tesla, Marathon", "Keine", "Nur Banken"], correct: 0 }, { question: "Wird Bitcoin in Zukunft wichtiger?", options: ["Wahrscheinlich ja", "Nein", "Vielleicht"], correct: 0 }] }
    ];

    const handleQuizSubmit = (moduleId: string) => {
      const module = modules.find(m => m.id === moduleId);
      if (!module) return;
      
      const score = module.quiz.filter((q, idx) => quizAnswers[`${moduleId}-${idx}`] === q.correct).length;
      const passScore = Math.ceil(module.quiz.length * 0.7);
      
      if (score >= passScore) {
        const newPassedQuizzes = [...passedQuizzes, moduleId];
        setPassedQuizzes(newPassedQuizzes);
        localStorage.setItem("passed-quizzes", JSON.stringify(newPassedQuizzes));
        toast({ title: "🎉 Quiz bestanden!", description: `${score}/${module.quiz.length} richtig!` });
      } else {
        toast({ title: "Probier nochmal!", description: `Du brauchst ${passScore} von ${module.quiz.length}. Du hattest ${score}.`, variant: "destructive" });
      }
      setQuizSubmitted({ ...quizSubmitted, [moduleId]: true });
    };

    const achievements = [
      { id: "first-module", title: "Anfänger", icon: "🌱", condition: passedQuizzes.length >= 1 },
      { id: "half-done", title: "Lernender", icon: "📚", condition: passedQuizzes.length >= 10 },
      { id: "all-done", title: "Experte", icon: "👑", condition: passedQuizzes.length === modules.length },
      { id: "beginner-master", title: "Anfänger-Meister", icon: "🟢", condition: modules.filter(m => m.level === "Anfänger").every(m => passedQuizzes.includes(m.id)) },
      { id: "advanced-master", title: "Fortgeschritten-Meister", icon: "🔴", condition: modules.filter(m => m.level === "Fortgeschritten").every(m => passedQuizzes.includes(m.id)) }
    ];

    const xpPerModule = 100;
    const userXp = passedQuizzes.length * xpPerModule;
    const userLevel = Math.floor(userXp / 300) + 1;
    
    const isModuleUnlocked = (moduleId: string) => {
      const idx = modules.findIndex(m => m.id === moduleId);
      if (idx === 0) return true;
      const prevModule = modules[idx - 1];
      return passedQuizzes.includes(prevModule.id);
    };
    
    return (
      <div className="max-w-6xl space-y-6">
        {/* Header with XP + Level */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-4xl font-bold text-slate-900">Bitcoin Bildungszentrum 📚⚡</h1>
            <div className="text-center">
              <div className="text-4xl font-bold text-violet-600">{userLevel}</div>
              <p className="text-xs text-slate-600">Level</p>
              <p className="text-xs text-slate-600 mt-1">{userXp} XP</p>
            </div>
          </div>
          <div className="overflow-x-auto -mx-4 px-4 border-b">
            <div className="flex gap-1 min-w-max md:min-w-0">
              <button onClick={() => setEducationTab("modules")} className={`pb-3 px-3 md:px-4 font-medium text-xs md:text-sm border-b-2 transition-all whitespace-nowrap ${educationTab === "modules" ? "border-violet-500 text-slate-900" : "border-transparent text-slate-600 hover:text-slate-900"}`} data-testid="tab-modules">📚 Module</button>
              <button onClick={() => setEducationTab("converter")} className={`pb-3 px-3 md:px-4 font-medium text-xs md:text-sm border-b-2 transition-all whitespace-nowrap ${educationTab === "converter" ? "border-violet-500 text-slate-900" : "border-transparent text-slate-600 hover:text-slate-900"}`} data-testid="tab-converter">🔄 Konverter</button>
              <button onClick={() => setEducationTab("challenges")} className={`pb-3 px-3 md:px-4 font-medium text-xs md:text-sm border-b-2 transition-all whitespace-nowrap ${educationTab === "challenges" ? "border-violet-500 text-slate-900" : "border-transparent text-slate-600 hover:text-slate-900"}`} data-testid="tab-challenges">🎯 Challenge</button>
              <button onClick={() => setEducationTab("resources")} className={`pb-3 px-3 md:px-4 font-medium text-xs md:text-sm border-b-2 transition-all whitespace-nowrap ${educationTab === "resources" ? "border-violet-500 text-slate-900" : "border-transparent text-slate-600 hover:text-slate-900"}`} data-testid="tab-resources">🌐 Ressourcen</button>
            </div>
          </div>
        </div>

        {educationTab === "modules" && (
          <div className="space-y-8">
            {/* Achievements */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900">Deine Abzeichen 🏆</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {achievements.map(badge => (
                  <div key={badge.id} className={`p-4 rounded-lg border-2 transition-all text-center ${badge.condition ? "border-amber-400/50 bg-amber-400/10" : "border-slate-300/50 bg-slate-100/30 opacity-50"}`}>
                    <span className="text-3xl block mb-1">{badge.icon}</span>
                    <p className="text-xs font-semibold text-slate-700">{badge.title}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Learning Modules */}
            {["Anfänger", "Mittelstufe", "Fortgeschritten"].map(level => (
              <div key={level} className="space-y-3">
                <h3 className={`text-sm font-semibold uppercase tracking-wide ${level === "Anfänger" ? "text-green-600" : level === "Mittelstufe" ? "text-yellow-600" : "text-red-600"}`}>{level} Level</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {modules.filter(m => m.level === level).map(module => {
                    const isPassed = passedQuizzes.includes(module.id);
                    const isUnlocked = isModuleUnlocked(module.id);
                    const isQuizOpen = showQuiz === module.id && isUnlocked;
                    return (
                      <Card key={module.id} className={`transition-all ${isPassed ? "border-green-500/50 bg-green-500/5" : !isUnlocked ? "border-red-300/50 bg-red-50/50 opacity-60" : "border-slate-200"} ${isQuizOpen ? "ring-2 ring-blue-500/50" : ""}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-2xl">{isUnlocked ? module.icon : "🔒"}</span>
                                <div>
                                  <CardTitle className="text-base">{module.title}</CardTitle>
                                  {isPassed && <p className="text-xs text-green-600 font-semibold">+{xpPerModule} XP</p>}
                                  {!isUnlocked && <p className="text-xs text-red-600 font-semibold">Vorige Modul zuerst!</p>}
                                </div>
                              </div>
                              <Badge variant="outline" className={`${module.levelColor} text-xs`}>{module.level}</Badge>
                            </div>
                            {isPassed && <span className="text-2xl">✅</span>}
                            {!isUnlocked && <span className="text-2xl">🔒</span>}
                          </div>
                        </CardHeader>
                        {isUnlocked ? (
                          !isQuizOpen ? (
                            <>
                              <CardContent className="pb-3"><div className="space-y-2 mb-4">{module.content.map((text, idx) => (<p key={idx} className="text-sm text-slate-600">• {text}</p>))}</div></CardContent>
                              <CardFooter className="gap-2">
                                {!isPassed ? (
                                  <Button onClick={() => setShowQuiz(module.id)} className="flex-1 bg-blue-600 hover:bg-blue-700" size="sm" data-testid={`button-quiz-${module.id}`}>Quiz starten →</Button>
                                ) : (
                                  <Button onClick={() => setShowQuiz(module.id)} variant="outline" className="flex-1" size="sm">Quiz wiederholen</Button>
                                )}
                              </CardFooter>
                            </>
                          ) : (
                            <CardContent className="space-y-4">
                              {modules.find(m => m.id === module.id)?.quiz.map((q, idx) => (
                                <div key={idx} className="space-y-2 pb-3 border-b last:border-0">
                                  <p className="text-sm font-semibold text-slate-900">{idx + 1}. {q.question}</p>
                                  <div className="space-y-2">
                                    {q.options.map((option, optIdx) => (
                                      <label key={optIdx} className="flex items-center gap-3 p-2 rounded-lg border border-slate-200/50 hover:bg-slate-50/50 cursor-pointer">
                                        <input type="radio" name={`${module.id}-q${idx}`} checked={quizAnswers[`${module.id}-${idx}`] === optIdx} onChange={() => setQuizAnswers({...quizAnswers, [`${module.id}-${idx}`]: optIdx})} className="h-4 w-4" />
                                        <span className="text-sm text-slate-700">{option}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              ))}
                              <div className="flex gap-2 pt-3">
                                <Button onClick={() => setShowQuiz(null)} variant="outline" className="flex-1" size="sm">Zurück</Button>
                                <Button onClick={() => handleQuizSubmit(module.id)} className="flex-1 bg-green-600 hover:bg-green-700" size="sm" data-testid={`button-submit-quiz-${module.id}`}>Einreichen</Button>
                              </div>
                            </CardContent>
                          )
                        ) : (
                          <CardContent className="pt-4 pb-4 text-center">
                            <p className="text-sm text-slate-600">🔒 Schließ zuerst das vorherige Modul ab!</p>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {educationTab === "converter" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-violet-500/50 bg-violet-500/5">
              <CardHeader><CardTitle className="text-base">⚡ Satoshi → Bitcoin</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div><Label className="text-xs">Satoshis</Label><Input type="number" value={satoshiInput} onChange={(e) => setSatoshiInput(e.target.value)} className="font-mono" data-testid="input-sats" /></div>
                <div className="p-3 rounded-lg bg-slate-100/50 text-center"><p className="text-xs text-slate-600 mb-1">Bitcoin</p><p className="text-lg font-bold text-violet-600">{(parseFloat(satoshiInput) / 100000000).toFixed(8)} ₿</p></div>
              </CardContent>
            </Card>

            <Card className="border-cyan-500/50 bg-cyan-500/5">
              <CardHeader><CardTitle className="text-base">₿ Bitcoin → Euro</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div><Label className="text-xs">Bitcoin</Label><Input type="number" value={bitcoinInput} onChange={(e) => setBitcoinInput(e.target.value)} className="font-mono" data-testid="input-btc" /></div>
                <div className="p-3 rounded-lg bg-slate-100/50 text-center"><p className="text-xs text-slate-600 mb-1">Euro (Live)</p><p className="text-lg font-bold text-cyan-600">€{btcPrice ? (parseFloat(bitcoinInput) * btcPrice).toFixed(2) : "...loading"}</p></div>
              </CardContent>
            </Card>

            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardHeader><CardTitle className="text-base">💶 Euro → Satoshis</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div><Label className="text-xs">Euro</Label><Input type="number" value={euroInput} onChange={(e) => setEuroInput(e.target.value)} className="font-mono" data-testid="input-eur" /></div>
                <div className="p-3 rounded-lg bg-slate-100/50 text-center"><p className="text-xs text-slate-600 mb-1">Satoshis</p><p className="text-lg font-bold text-amber-600">{btcPrice ? Math.floor((parseFloat(euroInput) / btcPrice) * 100000000).toLocaleString() : "..."} sats</p></div>
              </CardContent>
            </Card>
          </div>
        )}

        {educationTab === "resources" && (
          <div className="space-y-4">
            <p className="text-slate-600 mb-6">Hier findest du die besten Bitcoin Ressourcen im Internet um noch mehr zu lernen:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <a href="https://bitcoin.org" target="_blank" rel="noopener noreferrer" className="block p-4 border border-blue-500/30 rounded-lg hover:bg-blue-500/5 transition-all">
                <div className="text-2xl mb-2">₿</div>
                <h3 className="font-semibold text-slate-900 mb-1">Bitcoin.org</h3>
                <p className="text-xs text-slate-600 mb-2">Die offizielle Bitcoin Website mit Anfänger-Guides und technischen Infos</p>
                <span className="text-xs text-blue-600 font-medium">→ Zur Website</span>
              </a>

              <a href="https://www.youtube.com/c/aantonop" target="_blank" rel="noopener noreferrer" className="block p-4 border border-purple-500/30 rounded-lg hover:bg-purple-500/5 transition-all">
                <div className="text-2xl mb-2">📺</div>
                <h3 className="font-semibold text-slate-900 mb-1">Andreas M. Antonopoulos</h3>
                <p className="text-xs text-slate-600 mb-2">Großartiger YouTuber erklärt Bitcoin & Kryptographie verständlich</p>
                <span className="text-xs text-purple-600 font-medium">→ YouTube Kanal</span>
              </a>

              <a href="https://lightning.network" target="_blank" rel="noopener noreferrer" className="block p-4 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/5 transition-all">
                <div className="text-2xl mb-2">⚡</div>
                <h3 className="font-semibold text-slate-900 mb-1">Lightning Network</h3>
                <p className="text-xs text-slate-600 mb-2">Offizielle Lightning Network Info - die Zukunft von Bitcoin Zahlungen</p>
                <span className="text-xs text-yellow-600 font-medium">→ Zur Website</span>
              </a>

              <a href="https://www.coinbase.com/learn" target="_blank" rel="noopener noreferrer" className="block p-4 border border-green-500/30 rounded-lg hover:bg-green-500/5 transition-all">
                <div className="text-2xl mb-2">📚</div>
                <h3 className="font-semibold text-slate-900 mb-1">Coinbase Learn</h3>
                <p className="text-xs text-slate-600 mb-2">Interaktive Lektionen zu Bitcoin, Krypto und Blockchain</p>
                <span className="text-xs text-green-600 font-medium">→ Zur Website</span>
              </a>

              <a href="https://en.wikipedia.org/wiki/Bitcoin" target="_blank" rel="noopener noreferrer" className="block p-4 border border-red-500/30 rounded-lg hover:bg-red-500/5 transition-all">
                <div className="text-2xl mb-2">📖</div>
                <h3 className="font-semibold text-slate-900 mb-1">Bitcoin Wikipedia</h3>
                <p className="text-xs text-slate-600 mb-2">Umfassende technische und historische Bitcoin Informationen</p>
                <span className="text-xs text-red-600 font-medium">→ Zur Website</span>
              </a>

              <a href="https://bitcoin-on-chain.glitch.me" target="_blank" rel="noopener noreferrer" className="block p-4 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/5 transition-all">
                <div className="text-2xl mb-2">📊</div>
                <h3 className="font-semibold text-slate-900 mb-1">Bitcoin Analytics</h3>
                <p className="text-xs text-slate-600 mb-2">Echte Bitcoin Blockchain Statistiken und Metriken live sehen</p>
                <span className="text-xs text-cyan-600 font-medium">→ Zur Website</span>
              </a>

              <a href="https://www.lopp.net/bitcoin.html" target="_blank" rel="noopener noreferrer" className="block p-4 border border-amber-500/30 rounded-lg hover:bg-amber-500/5 transition-all">
                <div className="text-2xl mb-2">🔗</div>
                <h3 className="font-semibold text-slate-900 mb-1">Jameson Lopp's Bitcoin Resources</h3>
                <p className="text-xs text-slate-600 mb-2">Die beste Sammlung von Bitcoin Links und Ressourcen</p>
                <span className="text-xs text-amber-600 font-medium">→ Zur Website</span>
              </a>

              <a href="https://www.thebookofbitcoin.com" target="_blank" rel="noopener noreferrer" className="block p-4 border border-violet-500/30 rounded-lg hover:bg-violet-500/5 transition-all">
                <div className="text-2xl mb-2">📕</div>
                <h3 className="font-semibold text-slate-900 mb-1">The Book of Bitcoin</h3>
                <p className="text-xs text-slate-600 mb-2">Kostenlos online lesbar - für Bitcoin Anfänger und Profis</p>
                <span className="text-xs text-violet-600 font-medium">→ Zur Website</span>
              </a>
            </div>
          </div>
        )}

        {educationTab === "challenges" && dailyChallenge ? (
          <div className="space-y-4">
            <Card className={`border-2 ${dailyChallenge.completed ? "border-green-500/50 bg-green-500/5" : "border-amber-500/50 bg-amber-500/5"}`}>
              <CardContent className="pt-8 pb-8 space-y-4">
                <div className="text-center">
                  <div className="text-5xl mb-3">{dailyChallenge.icon}</div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-1">{dailyChallenge.title}</h3>
                  <p className="text-slate-600 text-sm">{dailyChallenge.description}</p>
                </div>
                
                {/* Quiz Challenge */}
                {dailyChallenge.type === "quiz" && dailyChallenge.question && (
                  <div className="bg-slate-100/30 p-4 rounded-lg space-y-3">
                    <p className="font-semibold text-slate-900">{dailyChallenge.question}</p>
                    <div className="grid grid-cols-1 gap-2">
                      {dailyChallenge.options?.map((option: string, idx: number) => (
                        <button key={idx} className={`p-2 rounded border-2 text-sm font-medium transition-all ${idx === dailyChallenge.correct ? "border-green-500 bg-green-500/10 text-green-700" : "border-slate-300 hover:border-slate-400"}`}>
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Conversion Challenge */}
                {dailyChallenge.type === "conversion" && (
                  <div className="bg-slate-100/30 p-4 rounded-lg space-y-2">
                    <p className="font-semibold text-slate-900">{dailyChallenge.challenge}</p>
                    <p className="text-sm text-slate-600">💡 Tipp: 100.000 Sats = 0.001 BTC</p>
                  </div>
                )}
                
                {/* Lightning Challenge */}
                {dailyChallenge.type === "lightning" && dailyChallenge.question && (
                  <div className="bg-slate-100/30 p-4 rounded-lg space-y-3">
                    <p className="font-semibold text-slate-900">{dailyChallenge.question}</p>
                    <div className="grid grid-cols-1 gap-2">
                      {dailyChallenge.options?.map((option: string, idx: number) => (
                        <button key={idx} className={`p-2 rounded border-2 text-sm font-medium transition-all ${idx === dailyChallenge.correct ? "border-green-500 bg-green-500/10 text-green-700" : "border-slate-300 hover:border-slate-400"}`}>
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Security Challenge */}
                {dailyChallenge.type === "security" && dailyChallenge.question && (
                  <div className="bg-slate-100/30 p-4 rounded-lg space-y-3">
                    <p className="font-semibold text-slate-900">{dailyChallenge.question}</p>
                    <div className="grid grid-cols-1 gap-2">
                      {dailyChallenge.options?.map((option: string, idx: number) => (
                        <button key={idx} className={`p-2 rounded border-2 text-sm font-medium transition-all ${idx === dailyChallenge.correct ? "border-green-500 bg-green-500/10 text-green-700" : "border-slate-300 hover:border-slate-400"}`}>
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Fun & Blockchain Challenges */}
                {(dailyChallenge.type === "fun" || dailyChallenge.type === "blockchain") && dailyChallenge.question && (
                  <div className="bg-slate-100/30 p-4 rounded-lg space-y-3">
                    <p className="font-semibold text-slate-900">{dailyChallenge.question}</p>
                    <div className="grid grid-cols-1 gap-2">
                      {dailyChallenge.options?.map((option: string, idx: number) => (
                        <button key={idx} className={`p-2 rounded border-2 text-sm font-medium transition-all ${idx === dailyChallenge.correct ? "border-green-500 bg-green-500/10 text-green-700" : "border-slate-300 hover:border-slate-400"}`}>
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="bg-green-100/50 p-3 rounded-lg text-center">
                  <p className="text-xs text-slate-600 mb-1">Belohnung für diese Challenge</p>
                  <p className="text-2xl font-bold text-green-600">+{dailyChallenge.reward} Sats ⚡</p>
                </div>
                
                {!dailyChallenge.completed && (
                  <Button 
                    onClick={() => {
                      const newChallenge = { ...dailyChallenge, completed: true };
                      setDailyChallenge(newChallenge);
                      localStorage.setItem("daily-challenge", JSON.stringify(newChallenge));
                      toast({ title: "🎉 Challenge bestanden!", description: `+${dailyChallenge.reward} Sats verdient!` });
                    }}
                    className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg"
                    data-testid="button-complete-challenge"
                  >
                    Challenge bestanden
                  </Button>
                )}
                
                {dailyChallenge.completed && (
                  <div className="text-center p-4 bg-green-500/10 rounded-lg">
                    <p className="text-lg font-bold text-green-600">✅ Challenge bestanden!</p>
                    <p className="text-sm text-green-700 mt-1">Morgen wartet eine neue Challenge auf dich! 🚀</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {passedQuizzes.length === modules.length && (
          <Card className="border-green-500/50 bg-gradient-to-r from-green-500/10 to-blue-500/10">
            <CardContent className="pt-8 pb-8 text-center">
              <p className="text-4xl mb-3">🏆👑🚀</p>
              <p className="text-2xl font-bold text-green-600 mb-2">Bitcoin-Meister erreicht!</p>
              <Badge className="bg-green-600">Level {userLevel} Experte</Badge>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (currentView === "dashboard") {
    const assignedTasks = myTasks.filter((t: Task) => t.status === "assigned");
    const submittedTasks = myTasks.filter((t: Task) => t.status === "submitted");
    const completedTasks = myTasks.filter((t: Task) => t.status === "approved");
    const connectedParents = connectedPeers.filter((p: any) => p.role === "parent");

    // Parent-only: Taschengeld
    const parentChildren = connectedPeers.filter((p: any) => p.role === "child");
    const { data: allowances = [] } = useQuery({
      queryKey: ["allowances", user.connectionId],
      queryFn: async () => {
        const res = await fetch(`/api/allowances/${user.connectionId}`);
        if (!res.ok) throw new Error("Failed to fetch allowances");
        return res.json();
      },
      refetchInterval: 5000,
      enabled: user.role === "parent"
    });

    const [allowanceChildId, setAllowanceChildId] = useState<number | null>(null);
    const [allowanceSats, setAllowanceSats] = useState("");
    const [allowanceFrequency, setAllowanceFrequency] = useState("weekly");
    const [isCreatingAllowance, setIsCreatingAllowance] = useState(false);

    const handleCreateAllowance = async () => {
      if (!allowanceChildId || !allowanceSats) {
        toast({ title: "Fehler", description: "Kind und Betrag erforderlich", variant: "destructive" });
        return;
      }

      setIsCreatingAllowance(true);
      try {
        const res = await fetch("/api/allowances", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parentId: user.id,
            childId: allowanceChildId,
            connectionId: user.connectionId,
            sats: parseInt(allowanceSats),
            frequency: allowanceFrequency,
          }),
        });
        if (!res.ok) throw new Error("Failed to create allowance");
        setAllowanceChildId(null);
        setAllowanceSats("");
        setAllowanceFrequency("weekly");
        queryClient.invalidateQueries({ queryKey: ["allowances"] });
        toast({ title: "Erfolg", description: "Taschengeld eingerichtet!" });
      } catch (error) {
        toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
      } finally {
        setIsCreatingAllowance(false);
      }
    };

    const handleDeleteAllowance = async (allowanceId: number) => {
      if (!window.confirm("Taschengeld wirklich löschen?")) return;

      try {
        const res = await fetch(`/api/allowances/${allowanceId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete allowance");
        queryClient.invalidateQueries({ queryKey: ["allowances"] });
        toast({ title: "Erfolg", description: "Taschengeld gelöscht" });
      } catch (error) {
        toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
      }
    };

    const [satsBreakdown, setSatsBreakdown] = useState<any>(null);

    useEffect(() => {
      const fetchBreakdown = async () => {
        try {
          const res = await fetch(`/api/peers/${user.id}/sats-breakdown`);
          if (res.ok) {
            setSatsBreakdown(await res.json());
          }
        } catch (e) {
          console.error("Failed to fetch sats breakdown:", e);
        }
      };
      fetchBreakdown();
    }, [user.id]);

    return (
      <div className="max-w-4xl space-y-2">
        <h1 className="text-3xl font-bold mb-4 text-slate-900">Dashboard</h1>
        <motion.section 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative overflow-hidden rounded-2xl bg-white/50 backdrop-blur-xl border border-white/50 p-8 shadow-xl"
        >
          <div className="relative z-10 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-slate-700 font-mono text-sm uppercase tracking-widest mb-2">Erhaltene Sats</p>
                <h2 className="text-5xl font-mono font-bold flex items-center gap-3 text-cyan-600" data-testid="text-earned-sats">
                  {(user.balance || 0).toLocaleString()} <span className="text-2xl opacity-70 text-slate-700">SATS</span>
                </h2>
                {satsBreakdown && (
                  <div className="flex gap-4 mt-3 text-xs">
                    <div>
                      <span className="text-slate-600">Verdient:</span>
                      <span className="font-mono text-yellow-600 ml-1">{satsBreakdown.taskSats.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-600">Taschengeld:</span>
                      <span className="font-mono text-green-600 ml-1">{satsBreakdown.allowanceSats.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowTrackerChart(!showTrackerChart)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all flex-shrink-0 ${
                  showTrackerChart 
                    ? 'bg-violet-500/30 border-violet-500/50 text-violet-700' 
                    : 'bg-white/30 border-white/40 text-slate-700 hover:text-slate-900'
                }`}
                data-testid="toggle-tracker-chart"
              >
                <span className="text-[10px]">{showTrackerChart ? "▼" : "▶"}</span>
                <span>Statistik</span>
              </button>
            </div>

            {/* Tracker Chart */}
            {showTrackerChart && (
              <div className="pt-4 border-t border-border/50">
                <TrackerChart userId={user.id} />
              </div>
            )}

            {user.lightningAddress && (
              <div className="pt-4 border-t border-border/50">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-primary text-sm">⚡</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Lightning Adresse</p>
                    <p className="text-sm font-mono text-violet-700 break-all" data-testid="text-child-lightning-address">{user.lightningAddress}</p>
                    <p className="text-xs text-muted-foreground mt-1">✓ Zahlungen werden direkt hierhin gesendet</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.section>

        {connectedParents.length > 0 && (
          <div className="space-y-4">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
              <div 
                className="bg-white/50 backdrop-blur-xl border border-white/50 rounded-2xl shadow-lg"
                data-testid="card-task-overview"
              >
                <div className="pt-6 px-6 pb-6">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Verfügbar - oben links */}
                    <div 
                      onClick={() => setCurrentView("tasks-open")}
                      className="border border-blue-400/40 bg-blue-500/20 backdrop-blur-sm rounded-xl p-3 cursor-pointer hover:bg-blue-500/30 hover:border-blue-400/60 transition-all"
                      data-testid="card-available-tasks"
                    >
                      <div className="text-center">
                        <div className="text-lg md:text-3xl font-bold text-blue-600">{availableTasks.length}</div>
                        <p className="text-[10px] md:text-xs text-slate-700 mt-1 md:mt-2 uppercase tracking-widest">Verfügbar</p>
                      </div>
                    </div>
                    
                    {/* In Arbeit - oben rechts */}
                    <div 
                      onClick={() => setCurrentView("tasks-my")}
                      className="border border-violet-400/40 bg-violet-500/20 backdrop-blur-sm rounded-xl p-3 cursor-pointer hover:bg-violet-500/30 hover:border-violet-400/60 transition-all"
                      data-testid="card-my-tasks"
                    >
                      <div className="text-center">
                        <div className="text-lg md:text-3xl font-bold text-violet-600">{assignedTasks.length}</div>
                        <p className="text-[10px] md:text-xs text-slate-700 mt-1 md:mt-2 uppercase tracking-widest">In Arbeit</p>
                      </div>
                    </div>
                    
                    {/* Zur Bestätigung - unten links */}
                    <div 
                      onClick={() => setCurrentView("tasks-pending")}
                      className="border border-amber-400/40 bg-amber-500/20 backdrop-blur-sm rounded-xl p-3 cursor-pointer hover:bg-amber-500/30 hover:border-amber-400/60 transition-all"
                      data-testid="card-pending-tasks"
                    >
                      <div className="text-center">
                        <div className="text-lg md:text-3xl font-bold text-amber-600">{submittedTasks.length}</div>
                        <p className="text-[10px] md:text-xs text-slate-700 mt-1 md:mt-2 uppercase tracking-widest">Zur Bestätigung</p>
                      </div>
                    </div>
                    
                    {/* Erledigt - unten rechts */}
                    <div 
                      onClick={() => setCurrentView("tasks-completed")}
                      className="border border-green-400/40 bg-green-500/20 backdrop-blur-sm rounded-xl p-3 cursor-pointer hover:bg-green-500/30 hover:border-green-400/60 transition-all"
                      data-testid="card-completed-tasks"
                    >
                      <div className="text-center">
                        <div className="text-lg md:text-3xl font-bold text-green-600">{completedTasks.length}</div>
                        <p className="text-[10px] md:text-xs text-slate-700 mt-1 md:mt-2 uppercase tracking-widest">Erledigt</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
            <div 
              className="bg-white/50 backdrop-blur-xl border border-white/50 rounded-2xl shadow-lg cursor-pointer hover:bg-white/60 transition-colors"
              onClick={() => setCurrentView("calendar")}
              data-testid="card-child-calendar"
            >
              <div className="p-2 md:p-4">
                <h3 className="text-sm font-bold mb-2 flex items-center gap-1 text-slate-900">
                  <Calendar className="h-4 w-4 text-violet-600" /> Kalender
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="col-span-1">
                    <style>{`
                      .rdp {
                        --rdp-cell-size: 24px;
                        --rdp-accent-color: rgb(124, 58, 237);
                        --rdp-background-color: rgba(124, 58, 237, 0.15);
                        margin: 0;
                      }
                      @media (min-width: 768px) {
                        .rdp {
                          --rdp-cell-size: 30px;
                        }
                      }
                      .rdp-head_cell {
                        color: rgb(71, 85, 105);
                        font-weight: 600;
                        font-size: 0.5rem;
                      }
                      @media (min-width: 768px) {
                        .rdp-head_cell {
                          font-size: 0.6rem;
                        }
                      }
                      .rdp-cell {
                        color: rgb(51, 65, 85);
                        padding: 0;
                      }
                      .rdp-day {
                        color: rgb(30, 41, 59);
                        border-radius: 2px;
                        font-size: 0.6rem;
                        font-weight: 500;
                      }
                      @media (min-width: 768px) {
                        .rdp-day {
                          font-size: 0.7rem;
                        }
                      }
                      .rdp-day_selected {
                        background-color: rgb(124, 58, 237);
                        color: white;
                      }
                      .rdp-day_today {
                        color: rgb(124, 58, 237);
                        font-weight: bold;
                      }
                      .rdp-caption {
                        color: rgb(30, 41, 59);
                        font-weight: 600;
                        margin-bottom: 0.25rem;
                        font-size: 0.65rem;
                      }
                      @media (min-width: 768px) {
                        .rdp-caption {
                          font-size: 0.75rem;
                        }
                      }
                      .rdp-nav {
                        gap: 1px;
                      }
                      .rdp-nav_button {
                        width: 16px;
                        height: 16px;
                        padding: 0;
                        color: rgb(71, 85, 105);
                      }
                      @media (min-width: 768px) {
                        .rdp-nav_button {
                          width: 20px;
                          height: 20px;
                        }
                      }
                    `}</style>
                    <DayPicker
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      locale={{
                        months: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
                        weekdays: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
                        weekdaysShort: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"]
                      }}
                      modifiers={{
                        hasEvent: (date) => events.some(e => {
                          const eventDate = new Date(e.startDate);
                          return eventDate.toDateString() === date.toDateString();
                        })
                      }}
                      modifiersStyles={{
                        hasEvent: {
                          backgroundColor: "rgba(59, 130, 246, 0.2)",
                          fontWeight: "bold"
                        }
                      }}
                    />
                  </div>
                  
                  <div className="col-span-1">
                    <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase truncate">
                      {selectedDate.toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    <div className="space-y-1 max-h-32 md:max-h-40 overflow-y-auto">
                      {events
                        .filter(e => new Date(e.startDate).toDateString() === selectedDate.toDateString())
                        .map((event: FamilyEvent) => (
                          <div 
                            key={event.id} 
                            className="text-xs border-l border-primary/50 pl-1.5 py-0.5 bg-primary/5 rounded cursor-pointer hover:bg-primary/10 transition-colors"
                            data-testid={`text-dash-event-${event.id}`}
                          >
                            <p className="font-semibold text-primary text-xs truncate">{event.title}</p>
                            <p className="text-muted-foreground text-xs">
                              ⏰ {new Date(event.startDate).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        ))}
                      {events.filter(e => new Date(e.startDate).toDateString() === selectedDate.toDateString()).length === 0 && (
                        <p className="text-xs text-slate-600 text-center py-1">Keine Termine</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </motion.div>
          </div>
        )}

        {connectedParents.length === 0 && (
          <div className="bg-white/50 backdrop-blur-xl border border-white/50 rounded-2xl p-6 -mt-2 shadow-lg">
            <div className="flex gap-4">
              <Info className="h-5 w-5 text-violet-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold mb-1 text-slate-900">Noch nicht verbunden</h3>
                <p className="text-sm text-slate-700 mb-3">
                  Verbinde dich mit deinen Eltern, um Aufgaben zu sehen
                </p>
                <Button 
                  size="sm"
                  onClick={() => setShowLink(true)}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                  data-testid="button-link-parent"
                >
                  <LinkIcon className="h-4 w-4 mr-2" /> Mit Eltern verbinden
                </Button>
              </div>
            </div>
          </div>
        )}

        {showLink && (
          <div className="bg-white/50 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-lg">
            <h3 className="font-bold mb-4 text-slate-900">Mit Eltern verbinden</h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="parent-code" className="text-slate-800">Verbindungscode von Eltern</Label>
                <Input 
                  id="parent-code"
                  placeholder="z.B. BTC-XYZ123"
                  value={parentConnectionId}
                  onChange={(e) => setParentConnectionId(e.target.value.toUpperCase())}
                  className="bg-white/50 border-white/60 text-slate-900 font-mono text-center"
                  data-testid="input-parent-code"
                />
                <p className="text-xs text-slate-600 mt-1">Frage deine Eltern nach dem Code!</p>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleLink}
                  disabled={!parentConnectionId || isLinking}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                  data-testid="button-confirm-link"
                >
                  {isLinking ? "Wird verbunden..." : "Verbinden"}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowLink(false)}
                  disabled={isLinking}
                  className="bg-white/30 border-white/40 text-slate-800"
                  data-testid="button-cancel-link"
                >
                  Abbrechen
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  if (currentView === "tasks-my") {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handlePhotoUploadSuccess = (proof: string) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", user.connectionId] });
    };

    const handleQuickSubmit = async (taskId: number) => {
      setIsSubmitting(true);
      try {
        const res = await fetch(`/api/tasks/${taskId}/submit`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) throw new Error("Submission failed");

        queryClient.invalidateQueries({ queryKey: ["tasks", user.connectionId] });
        toast({
          title: "Erfolg",
          description: "Aufgabe eingereicht!",
        });
      } catch (error) {
        toast({
          title: "Fehler",
          description: (error as Error).message,
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">In Arbeit</h1>
        <div className="grid gap-4">
          {myTasks.filter((t: Task) => t.status === "assigned").map((task: Task) => (
            <TaskCard key={task.id} task={task} variant="child">
              <div className="space-y-3">
                <Button
                  onClick={() => handleQuickSubmit(task.id)}
                  disabled={isSubmitting}
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="sm"
                  data-testid={`button-submit-task-${task.id}`}
                >
                  ✓ Erledigt
                </Button>
                <div className="text-xs text-muted-foreground text-center">oder Foto hochladen:</div>
                <PhotoUpload 
                  taskId={task.id}
                  onUploadSuccess={handlePhotoUploadSuccess}
                  disabled={false}
                />
              </div>
            </TaskCard>
          ))}
          {myTasks.filter((t: Task) => t.status === "assigned").length === 0 && (
            <div className="text-center py-8 border border-dashed border-border rounded-lg text-muted-foreground">
              Keine Aufgaben in Arbeit
            </div>
          )}
        </div>
      </div>
    );
  }

  if (currentView === "tasks-pending") {
    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Zur Bestätigung</h1>
        <div className="grid gap-4">
          {myTasks.filter((t: Task) => t.status === "submitted").map((task: Task) => (
            <TaskCard key={task.id} task={task} variant="child" />
          ))}
          {myTasks.filter((t: Task) => t.status === "submitted").length === 0 && (
            <div className="text-center py-8 border border-dashed border-border rounded-lg text-muted-foreground">
              Keine Aufgaben zur Bestätigung
            </div>
          )}
        </div>
      </div>
    );
  }

  if (currentView === "tasks-completed") {
    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Erledigt</h1>
        <div className="grid gap-4">
          {myTasks.filter((t: Task) => t.status === "approved").map((task: Task) => (
            <TaskCard key={task.id} task={task} variant="child" />
          ))}
          {myTasks.filter((t: Task) => t.status === "approved").length === 0 && (
            <div className="text-center py-8 border border-dashed border-border rounded-lg text-muted-foreground">
              Noch keine Aufgaben erledigt
            </div>
          )}
        </div>
      </div>
    );
  }

  if (currentView === "tasks-open") {
    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Verfügbare Aufgaben</h1>
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
                <Button 
                  onClick={() => onAccept(task.id)} 
                  variant="outline" 
                  className="w-full hover:border-primary hover:text-primary"
                  data-testid={`button-accept-task-${task.id}`}
                >
                  Annehmen
                </Button>
              </CardFooter>
            </Card>
          ))}
          {availableTasks.length === 0 && (
            <div className="text-center py-8 border border-dashed border-border rounded-lg text-muted-foreground md:col-span-2">
              Keine Aufgaben verfügbar
            </div>
          )}
        </div>
      </div>
    );
  }

  // Savings Comparison View
  if (currentView === "savings-comparison") {
    return <SavingsComparisonPage sats={user.balance || 0} setCurrentView={setCurrentView} user={user} />;
  }

  return null;
}

function SavingsComparisonPage({ sats, setCurrentView }: { sats: number; setCurrentView: (view: string) => void }) {
  const [days, setDays] = useState<30 | 60 | 90>(30);
  const [interestRate, setInterestRate] = useState(0.5);
  const [btcHistoricalData, setBtcHistoricalData] = useState<any[]>([]);
  const [btcCurrentPrice, setBtcCurrentPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch historical BTC data
        const histRes = await fetch(`/api/btc-history?days=${days}`);
        if (!histRes.ok) throw new Error("Historische Daten konnten nicht geladen werden");
        const histData = await histRes.json();
        
        // Fetch current BTC price
        const priceRes = await fetch("/api/btc-price");
        if (!priceRes.ok) throw new Error("Bitcoin-Preis konnte nicht geladen werden");
        const priceData = await priceRes.json();
        
        setBtcHistoricalData(histData);
        setBtcCurrentPrice(priceData.eur);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [days]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-muted-foreground">Laden...</p>
        </div>
      </div>
    );
  }

  if (error || !btcCurrentPrice) {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
          <div className="text-3xl mb-2">⚠️</div>
          <p className="text-red-400 font-bold">{error || "Keine Live-Daten verfügbar"}</p>
          <p className="text-xs text-muted-foreground mt-2">Bitte später erneut versuchen</p>
        </div>
      </div>
    );
  }

  // Calculate values
  const btcAmount = sats / 100_000_000;
  const currentValueEur = btcAmount * btcCurrentPrice;
  const monthlyRate = interestRate / 100;
  
  // Generate savings account chart data using compound interest
  const savingsChartData = btcHistoricalData.map((item, index) => {
    // Days from start = index (assuming daily data)
    const months = (index / 30);
    const savingsValue = currentValueEur * Math.pow(1 + monthlyRate, months);
    return {
      ...item,
      savingsValue: Math.round(savingsValue * 100) / 100,
      bitcoinSatsValue: btcAmount * item.price,
    };
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <span className="text-3xl">🎓</span> Sparen vergleichen
        </h1>
        <Button onClick={() => setCurrentView("dashboard")} variant="ghost" data-testid="button-back-savings">
          ← Zurück
        </Button>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-500/5 border border-blue-500/30">
        <CardContent className="pt-6">
          <p className="text-sm">
            <span className="font-bold text-blue-400">Du hast {sats.toLocaleString()} Sats</span> 
            <span className="text-muted-foreground"> (€{currentValueEur.toFixed(2)})</span>
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Vergleiche deinen Bitcoin-Sparplan mit einem klassischen Sparbuch über {days} Tage
          </p>
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Timeframe Selector */}
        <Card className="border-border">
          <CardContent className="pt-6">
            <p className="text-xs font-bold text-muted-foreground mb-3 uppercase">Zeitraum wählen</p>
            <div className="flex gap-2">
              {[30, 60, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d as 30 | 60 | 90)}
                  className={`px-4 py-2 text-sm rounded font-bold transition-all ${
                    days === d
                      ? "bg-primary/20 text-primary border border-primary/50"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`button-days-${d}`}
                >
                  {d} Tage
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Interest Rate Slider */}
        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-xs font-bold text-muted-foreground uppercase">Zinssatz</p>
                <p className="text-sm font-mono font-bold text-blue-400" data-testid="text-interest-display">
                  {interestRate.toFixed(2)}% / Monat = {(interestRate * 12).toFixed(1)}% / Jahr
                </p>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={interestRate}
                onChange={(e) => setInterestRate(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg accent-blue-500"
                data-testid="slider-interest"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>5%</span>
                <span>10%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Bitcoin Chart */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>⚡</span> Bitcoin Wertentwicklung
            </CardTitle>
            <CardDescription>Dein Satoshi-Vermögen in Euro</CardDescription>
          </CardHeader>
          <CardContent>
            {savingsChartData.length > 0 && (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={savingsChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12, fill: "rgba(255,255,255,0.5)" }}
                    interval={Math.floor(savingsChartData.length / 5)}
                  />
                  <YAxis tick={{ fontSize: 12, fill: "rgba(255,255,255,0.5)" }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.2)" }}
                    formatter={(value) => `€${(value as number).toFixed(2)}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="bitcoinSatsValue" 
                    stroke="#fbbf24" 
                    strokeWidth={2.5}
                    dot={false}
                    name="Bitcoin Sats"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Savings Account Chart */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>🏦</span> Sparbuch mit Zinseszins
            </CardTitle>
            <CardDescription>Lineare Zinsentwicklung ({interestRate.toFixed(2)}% monatlich)</CardDescription>
          </CardHeader>
          <CardContent>
            {savingsChartData.length > 0 && (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={savingsChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12, fill: "rgba(255,255,255,0.5)" }}
                    interval={Math.floor(savingsChartData.length / 5)}
                  />
                  <YAxis tick={{ fontSize: 12, fill: "rgba(255,255,255,0.5)" }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.2)" }}
                    formatter={(value) => `€${(value as number).toFixed(2)}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="savingsValue" 
                    stroke="#60a5fa" 
                    strokeWidth={2.5}
                    dot={false}
                    name="Sparbuch"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Comparison Table */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>📊</span> Vergleich am Ende
          </CardTitle>
        </CardHeader>
        <CardContent>
          {savingsChartData.length > 0 && (() => {
            const finalData = savingsChartData[savingsChartData.length - 1];
            const bitcoinFinal = finalData.bitcoinSatsValue;
            const savingsFinal = finalData.savingsValue;
            const difference = bitcoinFinal - currentValueEur;
            const savingsDifference = savingsFinal - currentValueEur;

            return (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-2">⚡ Bitcoin</p>
                  <p className="text-2xl font-mono font-bold text-yellow-400">€{bitcoinFinal.toFixed(2)}</p>
                  <p className={`text-sm mt-2 font-bold ${difference >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {difference >= 0 ? "+" : ""}€{difference.toFixed(2)}
                  </p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-2">🏦 Sparbuch</p>
                  <p className="text-2xl font-mono font-bold text-blue-400">€{savingsFinal.toFixed(2)}</p>
                  <p className="text-sm mt-2 font-bold text-green-400">+€{savingsDifference.toFixed(2)}</p>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Educational Messages */}
      <div className="space-y-2">
        <Card className="bg-yellow-500/5 border border-yellow-500/30">
          <CardContent className="pt-4">
            <p className="text-sm flex items-start gap-2">
              <span className="text-lg mt-0.5">📚</span>
              <span>
                <span className="font-bold text-yellow-400">Bitcoin schwankt!</span>
                <span className="text-muted-foreground"> Der Kurs kann hoch und runter gehen. Langfristig kann Bitcoin aber stärker wachsen als Sparbuch-Zinsen.</span>
              </span>
            </p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/5 border border-green-500/30">
          <CardContent className="pt-4">
            <p className="text-sm flex items-start gap-2">
              <span className="text-lg mt-0.5">💡</span>
              <span>
                <span className="font-bold text-green-400">Zinseszins ist Zauberei!</span>
                <span className="text-muted-foreground"> Deine Zinsen verdienen wieder Zinsen. Mit höheren Zinsen wächst dein Geld immer schneller! 🚀</span>
              </span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TrackerChart({ userId }: { userId: number }) {
  const [trackerData, setTrackerData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEuro, setShowEuro] = useState(true);
  const [showSats, setShowSats] = useState(true);
  const [showBtcPrice, setShowBtcPrice] = useState(false);
  const [liveBtcPrice, setLiveBtcPrice] = useState<number | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    const fetchTrackerData = async () => {
      try {
        const response = await fetch(`/api/tracker/${userId}`);
        const data = await response.json();
        setTrackerData(data || []);
      } catch (error) {
        console.error("[Tracker] Failed to fetch:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTrackerData();
  }, [userId]);

  useEffect(() => {
    const fetchBtcPrice = async () => {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur');
        const data = await response.json();
        setLiveBtcPrice(data.bitcoin.eur);
      } catch (error) {
        console.error("[BTC Price] Failed to fetch:", error);
      }
    };
    fetchBtcPrice();
  }, []);

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Wird geladen...</div>;
  if (trackerData.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">Noch keine genehmigten Tasks</p>;

  const latest = trackerData[trackerData.length - 1];
  const first = trackerData[0];
  const liveEuroValue = liveBtcPrice ? (latest.totalSats * liveBtcPrice) / 1e8 : latest.euroValue;
  const euroChange = latest.euroValue - first.euroValue;
  const satsChange = latest.totalSats - first.totalSats;
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">Dein Verdienst</h3>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="text-xs text-slate-600 hover:text-slate-900 transition-colors"
          data-testid="toggle-info"
        >
          {showInfo ? "Ausblenden" : "Was bedeutet das?"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/5 border border-cyan-500/40 rounded-xl p-4">
          <p className="text-xs text-cyan-700 uppercase tracking-wide mb-1">Satoshi</p>
          <p className="text-2xl font-bold text-cyan-600">{latest.totalSats.toLocaleString()}</p>
          {satsChange > 0 && (
            <p className="text-xs text-cyan-600/70 mt-1">+{satsChange.toLocaleString()} verdient</p>
          )}
        </div>
        <div className="bg-gradient-to-br from-violet-500/20 to-violet-600/5 border border-violet-500/40 rounded-xl p-4">
          <p className="text-xs text-violet-700 uppercase tracking-wide mb-1">Euro-Wert</p>
          <p className="text-2xl font-bold text-violet-600">€{liveEuroValue.toFixed(2)}</p>
          <p className="text-xs text-violet-600/70 mt-1">Live-Kurs</p>
        </div>
      </div>

      <div className="flex justify-center gap-2">
        <button
          onClick={() => setShowEuro(!showEuro)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${
            showEuro 
              ? 'bg-violet-500/20 border-violet-500/50 text-violet-600' 
              : 'bg-white/30 border-slate-300/50 text-slate-500'
          }`}
          data-testid="toggle-euro"
        >
          Euro
        </button>
        <button
          onClick={() => setShowSats(!showSats)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${
            showSats 
              ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-600' 
              : 'bg-white/30 border-slate-300/50 text-slate-500'
          }`}
          data-testid="toggle-sats"
        >
          Satoshi
        </button>
        <button
          onClick={() => setShowBtcPrice(!showBtcPrice)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${
            showBtcPrice 
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-600' 
              : 'bg-white/30 border-slate-300/50 text-slate-500'
          }`}
          data-testid="toggle-btc-price"
        >
          Kurs
        </button>
      </div>

      <div className="h-48 bg-white/40 backdrop-blur-md rounded-xl p-3 border border-white/50">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trackerData.map(d => ({ 
            ...d, 
            btcPriceScaled: d.btcPrice ? d.btcPrice / 1000 : 0 
          }))} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <defs>
              <linearGradient id="trackerGradViolet" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="trackerGradCyan" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="trackerGradAmber" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d97706" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#d97706" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" vertical={false} />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10, fill: '#475569' }} 
              axisLine={{ stroke: 'rgba(100,116,139,0.2)' }}
              tickLine={false}
            />
            <YAxis 
              tick={{ fontSize: 10, fill: '#475569' }} 
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `€${v.toFixed(0)}`} 
            />
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              tick={{ fontSize: 10, fill: '#475569' }} 
              axisLine={false}
              tickLine={false}
              tickFormatter={v => v.toLocaleString()} 
            />
            {showBtcPrice && (
              <YAxis 
                yAxisId="btcPrice" 
                orientation="right" 
                tick={{ fontSize: 9, fill: '#d97706' }} 
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `${(v * 1000 / 1000).toFixed(0)}k`} 
              />
            )}
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length > 0) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-lg p-3 shadow-xl">
                      <p className="text-xs text-slate-500 mb-2">{data.date}</p>
                      <div className="space-y-1">
                        <p className="text-sm text-violet-600 font-medium">€{data.euroValue?.toFixed(2)}</p>
                        <p className="text-sm text-cyan-600 font-medium">⚡ {data.totalSats?.toLocaleString()} sats</p>
                        {showBtcPrice && (
                          <p className="text-sm text-amber-600 font-medium">₿ €{data.btcPrice?.toLocaleString('de-DE', {maximumFractionDigits: 0})}</p>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
              cursor={{ stroke: 'rgba(100,116,139,0.2)', strokeWidth: 1 }}
            />
            {showEuro && (
              <Area 
                type="monotone" 
                dataKey="euroValue" 
                stroke="#7c3aed" 
                strokeWidth={2}
                fill="url(#trackerGradViolet)" 
              />
            )}
            {showSats && (
              <Area 
                yAxisId="right" 
                type="monotone" 
                dataKey="totalSats" 
                stroke="#06b6d4" 
                strokeWidth={2}
                fill="url(#trackerGradCyan)" 
              />
            )}
            {showBtcPrice && (
              <Area 
                yAxisId="btcPrice" 
                type="monotone" 
                dataKey="btcPriceScaled" 
                stroke="#d97706" 
                strokeWidth={2}
                strokeDasharray="5 5"
                fill="url(#trackerGradAmber)" 
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {showInfo && (
        <div className="bg-white/40 backdrop-blur-md border border-white/50 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            So liest du das Diagramm:
          </p>
          <div className="grid gap-2">
            <div className="flex items-center gap-3 bg-violet-500/15 rounded-lg px-3 py-2">
              <div className="w-4 h-1 bg-violet-500 rounded-full"></div>
              <span className="text-xs text-slate-700"><span className="text-violet-600 font-medium">Violett</span> = Wert deiner Satoshi in Euro</span>
            </div>
            <div className="flex items-center gap-3 bg-cyan-500/15 rounded-lg px-3 py-2">
              <div className="w-4 h-1 bg-cyan-500 rounded-full"></div>
              <span className="text-xs text-slate-700"><span className="text-cyan-600 font-medium">Cyan</span> = Anzahl deiner Satoshi</span>
            </div>
            <div className="flex items-center gap-3 bg-amber-500/15 rounded-lg px-3 py-2">
              <div className="w-4 h-1 rounded-full" style={{background: 'repeating-linear-gradient(90deg, #d97706 0px, #d97706 4px, transparent 4px, transparent 8px)'}}></div>
              <span className="text-xs text-slate-700"><span className="text-amber-600 font-medium">Orange (gestrichelt)</span> = Bitcoin Kurs</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BitcoinValueWidget({ sats, setCurrentView, user }: { sats: number; setCurrentView?: (view: string) => void; user?: any }) {
  const [btcPrice, setBtcPrice] = useState<{ usd: number; eur: number } | null>(null);
  const [interestRate, setInterestRate] = useState(0.2); // Start at 0.2% monthly
  const [dailySnapshots, setDailySnapshots] = useState<any[]>([]);
  const [monthlySnapshots, setMonthlySnapshots] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<"bitcoin" | "sparbuch">("bitcoin");

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("[BitcoinValueWidget] fetchData called, user:", user?.id, "sats:", sats);
        const priceRes = await fetch("/api/btc-price");
        const priceData = await priceRes.json();
        setBtcPrice(priceData);

        // Daily snapshot save logic for Bitcoin
        if (user && user.id && sats > 0) {
          const lastSaveKey = `btc-snapshot-last-save-${user.id}`;
          const lastSave = localStorage.getItem(lastSaveKey);
          const now = new Date();
          const today = now.toDateString();
          
          // Only save once per day
          if (!lastSave || !lastSave.startsWith(today)) {
            const btcAmount = sats / 100_000_000;
            const valueEur = btcAmount * priceData.eur;
            
            await fetch("/api/bitcoin-snapshots", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                peerId: user.id,
                connectionId: user.connectionId,
                valueEur,
                satoshiAmount: sats
              })
            });
            localStorage.setItem(lastSaveKey, today);
          }
        }

        // Fetch daily snapshots for Bitcoin
        if (user && user.id) {
          const snapshotsRes = await fetch(`/api/bitcoin-snapshots/${user.id}`);
          if (snapshotsRes.ok) {
            const snapshots = await snapshotsRes.json();
            console.log("[Bitcoin Snapshots] Fetched from API:", snapshots);
            setDailySnapshots(snapshots);
          } else {
            console.log("[Bitcoin Snapshots] API returned error:", snapshotsRes.status);
          }
        }

        // Fetch monthly snapshots for Savings Account
        if (user && user.id) {
          const savingsRes = await fetch(`/api/savings-snapshots/${user.id}`);
          if (savingsRes.ok) {
            const snapshots = await savingsRes.json();
            console.log("[Savings Snapshots] Fetched from API:", snapshots);
            setMonthlySnapshots(snapshots);
          } else {
            console.log("[Savings Snapshots] API returned error:", savingsRes.status);
          }
        }

      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 300000); // Longer interval to avoid rate limits
    return () => clearInterval(interval);
  }, [sats, user]);

  if (!btcPrice) return null;

  // Calculate values in EUR
  const btcAmount = sats / 100_000_000;
  const currentValueEur = btcAmount * btcPrice.eur;
  
  // Bitcoin always shows CURRENT value (live), not snapshot value
  const bitcoinValueEur = currentValueEur;
  
  // Get current savings value from last monthly snapshot or start fresh
  const lastMonthlySaving = monthlySnapshots.length > 0 ? monthlySnapshots[monthlySnapshots.length - 1].value : 0;
  const savingsValueEur = lastMonthlySaving > 0 ? lastMonthlySaving : currentValueEur;

  // Use all daily snapshots for personalized Bitcoin chart without limit
  const today = new Date();
  const todayFormatted = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short' }).format(today);
  const btcChartData = dailySnapshots.length > 0 
    ? dailySnapshots
    : [{ date: todayFormatted, value: currentValueEur }];

  // Use all monthly snapshots for Savings chart without limit
  // Each month adds one new data point at month end
  const savingsChartData = monthlySnapshots.length > 0 
    ? monthlySnapshots
    : [{ date: todayFormatted, value: currentValueEur }];

  return (
    <div className="pt-4 border-t border-border/50">
      <div className="space-y-3">
        {/* Combined Card with Toggle */}
        <div className={`rounded-lg p-2 space-y-2 border ${
          viewMode === "bitcoin" 
            ? "bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/30" 
            : "bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/30"
        }`}>
          {/* Header with Toggle */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 relative">
              <span className="text-sm">{viewMode === "bitcoin" ? "⚡" : "🏦"}</span>
              <p className="text-xs text-muted-foreground font-bold">
                {viewMode === "bitcoin" ? "BITCOIN" : "SPARBUCH"}
              </p>
              {viewMode === "sparbuch" && (
                <span className="absolute text-[9px] text-muted-foreground/60 top-full -mt-1">0,2% monatlich</span>
              )}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setViewMode("bitcoin")}
                className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                  viewMode === "bitcoin"
                    ? "bg-yellow-500/30 border-yellow-500/60 text-yellow-400 font-bold"
                    : "bg-yellow-500/10 border-yellow-500/20 text-yellow-300 hover:bg-yellow-500/20"
                }`}
                data-testid="button-toggle-bitcoin"
              >
                ⚡ BTC
              </button>
              <button
                onClick={() => setViewMode("sparbuch")}
                className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                  viewMode === "sparbuch"
                    ? "bg-blue-500/30 border-blue-500/60 text-blue-400 font-bold"
                    : "bg-blue-500/10 border-blue-500/20 text-blue-300 hover:bg-blue-500/20"
                }`}
                data-testid="button-toggle-sparbuch"
              >
                🏦 Sparbuch
              </button>
            </div>
          </div>

          {/* Value Display */}
          <p className={`text-2xl font-mono font-bold ${
            viewMode === "bitcoin" ? "text-yellow-300" : "text-blue-300"
          }`} data-testid="text-sats-current-value">
            €{viewMode === "bitcoin" ? bitcoinValueEur.toFixed(2) : savingsValueEur.toFixed(2)}
          </p>

          {/* Chart Section */}
          <div className="space-y-2">
            {viewMode === "bitcoin" ? (
              <>
                {btcChartData && btcChartData.length > 0 ? (
                  <div className="h-20 -mx-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={btcChartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <defs>
                          <linearGradient id="btcGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#facc15" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#facc15" stopOpacity={0.01} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,193,7,0.15)" />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: "rgba(255,193,7,0.7)" }} />
                        <YAxis width={40} tick={{ fontSize: 9, fill: "rgba(255,193,7,0.7)" }} tickFormatter={(value) => `€${Number(value).toFixed(0)}`} />
                        <Tooltip 
                          contentStyle={{ fontSize: 11, background: "rgba(0,0,0,0.9)", border: "1px solid rgba(255,193,7,0.5)", borderRadius: "4px" }}
                          formatter={(value) => `€${Number(value).toFixed(2)}`}
                        />
                        <Area type="monotone" dataKey="value" stroke="#facc15" strokeWidth={2} fill="url(#btcGradient)" isAnimationActive={true} animationDuration={800} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-20 flex items-center justify-center text-xs text-muted-foreground">
                    Daten werden gesammelt...
                  </div>
                )}
              </>
            ) : (
              <>
                {savingsChartData && savingsChartData.length > 0 ? (
                  <div className="h-20 -mx-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={savingsChartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <defs>
                          <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.15)" />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: "rgba(59,130,246,0.7)" }} />
                        <YAxis width={40} tick={{ fontSize: 9, fill: "rgba(59,130,246,0.7)" }} tickFormatter={(value) => `€${Number(value).toFixed(0)}`} />
                        <Tooltip 
                          contentStyle={{ fontSize: 11, background: "rgba(0,0,0,0.9)", border: "1px solid rgba(59,130,246,0.5)", borderRadius: "4px" }}
                          formatter={(value) => `€${Number(value).toFixed(2)}`}
                        />
                        <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#savingsGradient)" isAnimationActive={true} animationDuration={800} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-20 flex items-center justify-center text-xs text-muted-foreground">
                    Daten werden gesammelt...
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Button */}
        {setCurrentView && (
          <Button 
            onClick={() => setCurrentView("savings-comparison")}
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold text-sm"
            data-testid="button-open-savings-comparison"
          >
            📊 Sparen vergleichen →
          </Button>
        )}
      </div>
    </div>
  );
}

function TaskCard({ task, children, variant }: { task: Task; children?: React.ReactNode; variant: "parent" | "child" }) {
  const [showLink, setShowLink] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const getStatusConfig = (status: Task["status"]) => {
    switch (status) {
      case "open": return { label: "OFFEN", color: "bg-secondary text-muted-foreground", icon: Circle };
      case "assigned": return { label: "IN ARBEIT", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Clock };
      case "submitted": return { label: "PRÜFUNG", color: "bg-purple-500/10 text-purple-400 border-purple-500/20", icon: Upload };
      case "approved": return { label: "ERLEDIGT", color: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle };
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusConfig = getStatusConfig(task.status);
  const StatusIcon = statusConfig.icon;

  return (
    <Card className="border-border bg-card/50" data-testid={`card-task-${task.id}`}>
      <CardContent className="p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-3 mb-2">
            {!(task.status === "approved" && children) && (
              <Badge variant="outline" className={`${statusConfig.color} border px-2 py-0.5 rounded text-[10px] font-bold tracking-wider`}>
                <StatusIcon className="h-3 w-3 mr-1.5" /> {statusConfig.label}
              </Badge>
            )}
            <span className="text-primary font-mono text-sm flex items-center gap-1" data-testid={`text-sats-${task.id}`}>
              ⚡ {task.sats}
            </span>
          </div>
          <h3 className="font-bold text-lg" data-testid={`text-title-${task.id}`}>{task.title}</h3>
          <p className="text-muted-foreground text-sm" data-testid={`text-description-${task.id}`}>{task.description}</p>
          
          {children && (
            <div className="mt-3 mb-2">
              {children}
            </div>
          )}

          {task.status === "open" && variant === "parent" && (
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-xs text-muted-foreground">Warte bis ein Kind die Aufgabe annimmt oder genehmige sie um die Zahlung zu aktivieren</p>
            </div>
          )}
          
          {task.withdrawLink && task.status === "approved" && variant === "child" && (
            <div className="mt-4 space-y-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-lg">💰</span>
                <p className="text-sm font-bold text-green-600">Abheben! ({task.sats} sats warten)</p>
              </div>
              <p className="text-xs text-muted-foreground">Kopiere diesen Link/Code und öffne ihn in deiner Lightning Wallet um deine Sats zu erhalten</p>
              {task.withdrawLink && (
                <>
                  <div className="bg-secondary p-3 rounded border border-border break-words word-break font-mono text-xs text-muted-foreground cursor-pointer hover:bg-secondary/80 transition overflow-x-auto max-w-full" onClick={() => handleCopy(task.withdrawLink!)}>
                    {task.withdrawLink}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm"
                      onClick={() => handleCopy(task.withdrawLink!)}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      data-testid={`button-copy-withdraw-${task.id}`}
                    >
                      📋 Kopieren
                    </Button>
                    {task.withdrawLink.startsWith("lnurl") && (
                      <a 
                        href={task.withdrawLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1"
                      >
                        <Button 
                          size="sm"
                          className="w-full bg-green-600 hover:bg-green-700 text-white"
                          data-testid={`link-withdraw-${task.id}`}
                        >
                          💳 Öffnen
                        </Button>
                      </a>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
