import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
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
import { de, enUS } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import i18n from "./i18n";
import deTranslations from "./i18n/locales/de.json";
import enTranslations from "./i18n/locales/en.json";
import { LineChart, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, Line, Area, ResponsiveContainer } from "recharts";
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
  BookOpen,
  Zap,
  Flame,
  TrendingUp,
  Globe,
  Moon,
  Sun,
  Laptop,
  AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PhotoUpload } from "@/components/PhotoUpload";
import { ProofViewer } from "@/components/ProofViewer";
import kidzappLogo from "@/assets/kidzapp-logo.png";

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
  donationAddress?: string;
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

// --- Password Validation Function (returns translation keys) ---
function validatePassword(password: string): { valid: boolean; error: string } {
  if (password.length < 8) {
    return { valid: false, error: "errors.passwordMinLength" };
  }
  if (password.length > 12) {
    return { valid: false, error: "errors.passwordMaxLength" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "errors.passwordUppercase" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "errors.passwordNumber" };
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
    throw new Error(data.error || "Registration failed");
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
    throw new Error(data.error || "Login failed");
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
    throw new Error(data.error || "Connection failed");
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
    throw new Error(data.error || "Payout failed");
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
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [newTask, setNewTask] = useState({ title: "", description: "", sats: 50, isRequired: false, bypassRatio: false });
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
  const [newItem, setNewItem] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Shopping List Functions
  const addItem = async () => {
    if (!newItem.trim()) return;
    try {
      const res = await fetch("/api/shopping-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: user?.connectionId,
          createdBy: user?.id,
          item: newItem,
          quantity: newQuantity || null
        })
      });
      if (res.ok) {
        setNewItem("");
        setNewQuantity("");
        queryClient.invalidateQueries({ queryKey: ["shopping-list"] });
        toast({ title: "✓", description: t('shoppingList.itemAdded') });
      }
    } catch (error) {
      toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
    }
  };

  const toggleComplete = async (id: number, completed: boolean) => {
    try {
      const res = await fetch(`/api/shopping-list/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !completed })
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["shopping-list"] });
      }
    } catch (error) {
      console.error("Error toggling item:", error);
    }
  };

  const deleteItem = async (id: number, createdBy: number) => {
    if (user?.role === "child" && createdBy !== user?.id) {
      toast({ title: "Fehler", description: t('shoppingList.canOnlyDeleteOwn'), variant: "destructive" });
      return;
    }
    try {
      const res = await fetch(`/api/shopping-list/${id}`, { method: "DELETE" });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["shopping-list"] });
        toast({ title: "✓", description: t('shoppingList.itemDeleted') });
      }
    } catch (error) {
      toast({ title: "Fehler", description: (error as Error).message, variant: "destructive" });
    }
  };

  useEffect(() => {
    // Load user
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

  const { data: shoppingListItems = [] } = useQuery({
    queryKey: ["shopping-list", user?.connectionId],
    queryFn: async () => {
      const res = await fetch(`/api/shopping-list/${user!.connectionId}`);
      if (!res.ok) throw new Error("Failed to fetch shopping list");
      return res.json();
    },
    enabled: !!user?.connectionId,
    refetchInterval: 30000,
  });

  const createTaskMutation = useMutation({
    mutationFn: createTask,
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: t('tasks.created'), description: t('tasks.waitingForApproval') });
      setNewTask({ title: "", description: "", sats: 50, isRequired: false, bypassRatio: false });
      setCurrentView("dashboard");
    },
    onError: (error) => {
      toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
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
      toast({ title: t('tasks.deleted'), description: t('tasks.deletedSuccess') });
    },
    onError: (error) => {
      toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
    }
  });

  const createEventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setNewEvent({ title: "", description: "", location: "", startDate: "", endDate: "" });
      toast({ title: t('calendar.eventCreated'), description: t('calendar.calendarUpdated') });
    },
    onError: (error) => {
      toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
    }
  });

  const deleteEventMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast({ title: t('calendar.eventDeleted'), description: t('calendar.eventRemoved') });
    },
    onError: (error) => {
      toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
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
    refetchInterval: 30000,
    enabled: user?.role === "parent" && !!user?.connectionId
  });

  const { data: parentChildren = [] } = useQuery({
    queryKey: ["parent-children", user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/parent/${user!.id}/children`);
      if (!res.ok) throw new Error("Failed to fetch children");
      return res.json();
    },
    refetchInterval: 30000,
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
      toast({ title: t('common.success'), description: t('family.allowanceAdded') });
      queryClient.invalidateQueries({ queryKey: ["allowances"] });
      setAllowanceChildId(null);
      setAllowanceSats("");
      setAllowanceFrequency("weekly");
    } catch (error) {
      toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsCreatingAllowance(false);
    }
  };

  const handleDeleteAllowance = async (allowanceId: number) => {
    try {
      const res = await fetch(`/api/allowances/${allowanceId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete allowance");
      toast({ title: t('common.success'), description: t('family.allowanceDeleted') });
      queryClient.invalidateQueries({ queryKey: ["allowances"] });
    } catch (error) {
      toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
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
    toast({ title: t('auth.welcomeBack'), description: `${t('dashboard.hello')} ${newUser.name}` });
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

    // Wenn Pflicht-Aufgabe, dann sats=0, sonst sats muss > 0 sein
    const satValue = newTask.isRequired ? 0 : newTask.sats;
    if (satValue < 0) {
      toast({ title: t('common.error'), description: t('tasks.rewardMustBePositive'), variant: "destructive" });
      return;
    }

    // bypassRatio nur für bezahlte Aufgaben
    const bypass = !newTask.isRequired ? newTask.bypassRatio : false;

    createTaskMutation.mutate({
      connectionId: user.connectionId,
      createdBy: user.id,
      title: newTask.title,
      description: newTask.description,
      sats: satValue,
      isRequired: newTask.isRequired,
      bypassRatio: bypass,
      status: "open",
    });
  };

  const acceptTask = (taskId: number) => {
    if (!user) return;
    
    // Manuell API aufrufen statt Mutation, um 423-Fehler zu prüfen
    const performAccept = async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "assigned", assignedTo: user.id }),
        });
        
        if (res.status === 423) {
          const data = await res.json();
          toast({ 
            title: "🔒 Aufgabe gesperrt", 
            description: `${data.error} (${data.completed}/${data.required} erledigt)`,
            variant: "destructive",
            duration: 5000
          });
          return;
        }
        
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to accept task");
        }
        
        const result = await res.json();
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        toast({ title: t('tasks.accepted'), description: t('tasks.letsStackSats') });
      } catch (error) {
        console.error("Accept task error:", error);
        toast({ 
          title: t('common.error'), 
          description: (error as Error).message,
          variant: "destructive"
        });
      }
    };
    
    performAccept();
  };

  const submitProof = (taskId: number) => {
    updateTaskMutation.mutate({
      id: taskId,
      updates: { status: "submitted", proof: "proof_mock.jpg" },
    });
    toast({ title: t('tasks.proofUploaded'), description: t('tasks.waitingForApproval') });
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
      toast({ title: t('tasks.satsPaid'), description: t('tasks.transactionSent') });
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
                title: t('education.levelBonus'), 
                description: t('education.levelBonusDesc', { level: bonusData.level, sats: bonusData.sats }),
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
    if (window.confirm(t('tasks.confirmDelete'))) {
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
    if (window.confirm(t('calendar.confirmDelete'))) {
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
      className="min-h-screen text-foreground font-sans selection:bg-primary selection:text-primary-foreground flex bg-cover bg-center bg-no-repeat bg-fixed theme-bg"
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
                  shoppingListItems={shoppingListItems}
                />
              ) : (
                <ChildDashboard 
                  user={user}
                  setUser={setUser}
                  tasks={tasks}
                  events={events}
                  newEvent={newEvent}
                  setNewEvent={setNewEvent}
                  currentView={currentView}
                  setCurrentView={setCurrentView}
                  onAccept={acceptTask} 
                  onSubmit={submitProof}
                  onCreateEvent={handleCreateEvent}
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
      {/* Shopping List View - Available to both parents and children */}
      {currentView === "shopping-list" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="w-full"
        >
          <div className="px-4 py-8">
            <div className="max-w-2xl mx-auto space-y-6">
              <h1 className="text-3xl font-bold mb-6">{t('shoppingList.title')}</h1>

              {/* Add Item Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('shoppingList.newItem')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <input
                    type="text"
                    placeholder={t('shoppingList.itemPlaceholder')}
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addItem()}
                    data-testid="input-shopping-item"
                    className="w-full px-3 py-2 border border-input bg-background rounded-md"
                  />
                  <input
                    type="text"
                    placeholder={t('shoppingList.quantityLabel')}
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    data-testid="input-shopping-quantity"
                    className="w-full px-3 py-2 border border-input bg-background rounded-md"
                  />
                  <Button onClick={addItem} className="w-full bg-primary hover:bg-primary/90" data-testid="button-add-shopping-item">
                    {t('shoppingList.addButton')}
                  </Button>
                </CardContent>
              </Card>

              {/* Shopping List */}
              <div className="space-y-3">
                {shoppingListItems.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center text-muted-foreground">
                      {t('shoppingList.empty')}
                    </CardContent>
                  </Card>
                ) : (
                  shoppingListItems.map((item: any) => (
                    <Card key={item.id} className={item.completed ? "bg-green-500/10 border-green-500/30" : ""}>
                      <CardContent className="p-4 flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={() => toggleComplete(item.id, item.completed)}
                          className="w-5 h-5 cursor-pointer"
                          data-testid={`checkbox-shopping-${item.id}`}
                        />
                        <div className="flex-1">
                          <p className={`font-semibold ${item.completed ? "line-through text-muted-foreground" : ""}`} data-testid={`text-shopping-item-${item.id}`}>
                            {item.item}
                          </p>
                          {item.quantity && <p className="text-sm text-muted-foreground">{item.quantity}</p>}
                        </div>
                        {(user.role === "parent" || item.createdBy === user.id) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteItem(item.id, item.createdBy)}
                            className="text-red-600 hover:bg-red-500/20"
                            data-testid={`button-delete-shopping-${item.id}`}
                          >
                            🗑️
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
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
                <ChevronLeft className="h-4 w-4" /> {t('common.back')}
              </Button>
            </div>

            <Card className="border-2 border-primary/40 bg-primary/5 w-full max-w-md">
              <CardHeader>
                <CardTitle>{t('allowance.addNew')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="allowance-child">{t('sidebar.child')}</Label>
                  <select
                    id="allowance-child"
                    value={allowanceChildId || ""}
                    onChange={(e) => setAllowanceChildId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    data-testid="select-allowance-child"
                  >
                    <option value="">{t('common.selectChild')}</option>
                    {parentChildren.map((child: any) => (
                      <option key={child.id} value={child.id}>{child.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="allowance-sats">{t('family.amount')} (Sats)</Label>
                  <Input
                    id="allowance-sats"
                    type="number"
                    placeholder={t('tasks.amountPlaceholder')}
                    value={allowanceSats}
                    onChange={(e) => setAllowanceSats(e.target.value)}
                    data-testid="input-allowance-sats"
                  />
                </div>

                <div>
                  <Label htmlFor="allowance-freq">{t('family.frequency')}</Label>
                  <select
                    id="allowance-freq"
                    value={allowanceFrequency}
                    onChange={(e) => setAllowanceFrequency(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    data-testid="select-allowance-frequency"
                  >
                    <option value="daily">{t('common.daily')}</option>
                    <option value="weekly">{t('common.weekly')}</option>
                    <option value="biweekly">{t('common.biweekly')}</option>
                    <option value="monthly">{t('common.monthly')}</option>
                  </select>
                </div>

                <Button
                  onClick={handleCreateAllowance}
                  disabled={!allowanceChildId || !allowanceSats || isCreatingAllowance}
                  className="w-full bg-primary hover:bg-primary/90"
                  data-testid="button-create-allowance"
                >
                  {isCreatingAllowance ? t('common.saving') : t('common.add')}
                </Button>
              </CardContent>
            </Card>

            {allowances.length > 0 && (
              <Card className="w-full max-w-md border border-border/50 bg-card/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{t('allowance.activePayments')} ({allowances.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {allowances.map((allowance: any) => {
                    const child = parentChildren.find((c: any) => c.id === allowance.childId);
                    const freqLabel = allowance.frequency === "daily" ? t('common.daily') :
                                      allowance.frequency === "weekly" ? t('common.weekly') :
                                      allowance.frequency === "biweekly" ? t('common.biweekly') : t('common.monthly');

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
                            <p className="font-semibold">{child?.name || t('common.unknown')}</p>
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
  const { t, i18n } = useTranslation();
  
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
      title: t('tasks.statusApproved'),
      description: `${task.title} - ${task.sats} Sats ${child ? `${t('allowance.paidTo')} ${child.name}` : t('wallet.earned')}`,
      timestamp: taskTimestamp,
      sats: task.sats,
    });
  });

  allowances.forEach((allowance: any) => {
    const child = parentChildren.find((c: any) => c.id === allowance.childId);
    const freqLabels: Record<string, string> = {
      daily: t('common.daily'),
      weekly: t('common.weekly'),
      biweekly: t('common.biweekly'),
      monthly: t('common.monthly'),
    };
    notifications.push({
      id: `allowance-${allowance.id}`,
      type: "allowance",
      title: t('activities.allowanceActive'),
      description: `${allowance.sats} Sats ${freqLabels[allowance.frequency] || allowance.frequency} ${t('allowance.paidTo')} ${child?.name || t('sidebar.child')}`,
      timestamp: new Date(allowance.createdAt || Date.now()),
      sats: allowance.sats,
    });
  });

  const recentMessages = messages.slice(-5);
  recentMessages.forEach((msg: any) => {
    notifications.push({
      id: `message-${msg.id}`,
      type: "message",
      title: t('activities.newMessage'),
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
            <ChevronLeft className="h-4 w-4" /> {t('common.back')}
          </Button>
        </div>

        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{t('activities.title')}</h2>
              <p className="text-sm text-muted-foreground">{t('activities.recentEvents')}</p>
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <div className="h-16 w-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
                <Bell className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">{t('activities.noActivities')}</p>
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
                    {formatDistanceToNow(notification.timestamp, { addSuffix: true, locale: i18n.language === 'de' ? de : enUS })}
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
  const { t } = useTranslation();
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
      const childName = childrenWithAllowances.find((c: any) => c.child.id === childId)?.child.name || t('sidebar.child');
      toast({ title: t('common.success'), description: `${sats} Sats ${t('allowance.paidTo')} ${childName}!` });
      queryClient.invalidateQueries({ queryKey: ["children-with-allowances"] });
    } catch (error) {
      toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsProcessingPayout(false);
    }
  };

  const handleDeleteAllowance = async (allowanceId: number) => {
    if (!confirm(t('allowance.confirmDelete'))) return;
    
    try {
      const res = await fetch(`/api/allowances/${allowanceId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete allowance");
      toast({ title: t('common.success'), description: t('allowance.deleted') });
      refetchAllowances();
    } catch (error) {
      toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
    }
  };

  const handleAdHocPayout = async () => {
    if (!adHocChildId || !adHocSats) {
      toast({ title: t('common.error'), description: t('allowance.selectChildAndAmount'), variant: "destructive" });
      return;
    }
    
    setIsProcessingPayout(true);
    try {
      const child = allChildren.find((c: any) => c.id === adHocChildId);
      if (!child?.lightningAddress) {
        throw new Error(t('allowance.noLightningAddress'));
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
        throw new Error(error.error || t('wallet.paymentFailed'));
      }
      toast({ title: t('common.success'), description: `${adHocSats} Sats ${t('allowance.paidTo')} ${child.name}!` });
      setAdHocChildId(null);
      setAdHocSats("");
      setAdHocMessage("");
      queryClient.invalidateQueries({ queryKey: ["children-with-allowances"] });
    } catch (error) {
      toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
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
            <ChevronLeft className="h-4 w-4" /> {t('common.back')}
          </Button>
        </div>


        {payoutTab === null ? (
          <div className="flex flex-col items-center justify-center gap-8 py-8 w-full">
            <h2 className="text-2xl font-bold text-center">{t('allowance.whatToDo')}</h2>
            <div className="flex flex-col gap-3 w-80 items-stretch">
              <Button 
                onClick={() => setPayoutTab("plans")}
                className="h-32 text-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 border-0"
                data-testid="button-choose-scheduled"
              >
                <div className="flex flex-col items-center gap-3">
                  <span className="text-3xl">📅</span>
                  <span className="text-base">{t('sidebar.allowance.scheduled')}</span>
                </div>
              </Button>
              <Button 
                onClick={() => setPayoutTab("instant")}
                className="h-32 text-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 border-0"
                data-testid="button-choose-instant"
              >
                <div className="flex flex-col items-center gap-3">
                  <span className="text-3xl">⚡</span>
                  <span className="text-base">{t('sidebar.allowance.instant')}</span>
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
                    + {t('allowance.addNew')}
                  </Button>
                </div>
                {childrenWithAllowances.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">{t('allowance.noActivePayments')}</p>
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
                            <p className="text-xs text-muted-foreground">⚡ {item.child.lightningAddress || t('wallet.noAddress')}</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {item.allowances.map((allowance: any) => (
                          <div key={allowance.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded">
                            <div>
                              <p className="font-semibold text-primary">{allowance.sats} Sats</p>
                              <p className="text-xs text-muted-foreground">
                                {allowance.frequency === "daily" ? t('common.daily') : 
                                 allowance.frequency === "weekly" ? t('common.weekly') :
                                 allowance.frequency === "biweekly" ? t('common.biweekly') : t('common.monthly')}
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
                                {isProcessingPayout ? "..." : t('wallet.pay')}
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
                  <Label htmlFor="adhoc-child" className="text-sm font-semibold mb-2 block">{t('allowance.selectChildLabel')}</Label>
                  <select
                    id="adhoc-child"
                    value={adHocChildId || ""}
                    onChange={(e) => setAdHocChildId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    data-testid="select-adhoc-child"
                  >
                    <option value="">{t('common.selectChild')}</option>
                    {allChildren.map((child: any) => (
                      <option key={child.id} value={child.id}>
                        {child.name} {child.lightningAddress ? "✓" : "⚠️"}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">⚠️ = {t('allowance.noLightningAddress')}</p>
                </div>

                <div>
                  <Label htmlFor="adhoc-sats" className="text-sm font-semibold mb-2 block">{t('family.amount')} (Sats)</Label>
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
                  <Label htmlFor="adhoc-message" className="text-sm font-semibold mb-2 block">{t('chat.message')} ({t('chat.optional')})</Label>
                  <Input
                    id="adhoc-message"
                    type="text"
                    placeholder={t('chat.messagePlaceholder')}
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
                  {isProcessingPayout ? `⏳ ${t('common.sending')}` : `💚 ${t('common.sendNow')}`}
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
  const { t } = useTranslation();
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showWalletSubmenu, setShowWalletSubmenu] = useState(false);
  const [showCalendarSubmenu, setShowCalendarSubmenu] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<"ansicht" | "wallet" | "peers" | "dataManagement" | null>(null);
  const [walletTab, setWalletTab] = useState("lnbits");
  
  const [showTasksSubmenu, setShowTasksSubmenu] = useState(false);
  
  const menuItems = [
    { id: "dashboard", label: user.role === "parent" ? t('nav.dashboard') : t('sidebar.myDashboard'), icon: Home, badge: 0 },
    ...(user.role === "parent" ? [{ id: "tasks", label: t('nav.tasks'), icon: CheckCircle, badge: tasksNotificationCount, submenu: true }] : []),
    ...(user.role === "parent" ? [{ id: "children-overview", label: t('sidebar.childrenOverview'), icon: Users, badge: 0 }] : []),
    { id: "calendar", label: t('nav.calendar'), icon: Calendar, badge: 0 },
    { id: "chat", label: t('sidebar.familyChat'), icon: MessageSquare, badge: chatNotificationCount },
    { id: "shopping-list", label: t('nav.shoppingList'), icon: Home, badge: 0 },
    { id: "notifications", label: t('sidebar.activities'), icon: Bell, badge: 0 },
    { id: "leaderboard", label: t('sidebar.leaderboard'), icon: Trophy, badge: 0 },
    ...(user.role === "child" ? [{ id: "bitcoin-education", label: t('sidebar.bitcoinLearn'), icon: BookOpen, badge: 0 }] : []),
  ];

  const handleSettingsClick = (tab: "ansicht" | "wallet" | "peers" | "dataManagement") => {
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
        className="fixed right-0 top-0 h-screen w-64 bg-white/15 dark:bg-black/30 backdrop-blur-xl border-l border-white/50 dark:border-white/20 z-40 flex flex-col pointer-events-none shadow-2xl"
        style={{ pointerEvents: sidebarOpen ? "auto" : "none" }}
      >
        <div className="p-3 md:p-4 border-b border-white/20 space-y-2 md:space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-7 w-7 md:h-8 md:w-8 bg-yellow-400/30 rounded-lg flex items-center justify-center text-amber-600 text-base md:text-lg">
              ⚡
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="md:hidden text-foreground h-8 w-8"
              data-testid="button-close-sidebar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1 md:space-y-2">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{t('family.title')}</p>
            <h2 className="text-xl md:text-2xl font-bold text-foreground">{user.familyName || t('family.title')}</h2>
            <div className="flex items-center gap-2 pt-1 md:pt-2">
              <div className="h-7 w-7 md:h-8 md:w-8 rounded-full bg-violet-500/30 text-violet-700 flex items-center justify-center font-bold text-xs md:text-sm">
                {user.name[0]}
              </div>
              <div>
                <p className="text-xs md:text-sm font-medium text-foreground">{user.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user.role === "child" ? t('sidebar.child') : t('sidebar.parent')}</p>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 md:p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            
            // Tasks Dropdown (Parent only)
            if (item.id === "tasks" && user.role === "parent") {
              const isTasksActive = currentView === "tasks" || currentView === "recurring-tasks";
              return (
                <div key={item.id}>
                  <button
                    onClick={() => setShowTasksSubmenu(!showTasksSubmenu)}
                    className={`w-full px-3 md:px-4 py-1.5 md:py-2 rounded-xl flex items-center gap-2 transition-colors text-sm md:text-base ${
                      isTasksActive
                        ? "bg-violet-500/40 text-foreground font-medium"
                        : "text-foreground hover:bg-white/20 dark:bg-black/20"
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
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="ml-3 md:ml-4 mt-0.5 md:mt-1 space-y-0.5 md:space-y-1">
                      <button
                        onClick={() => {
                          setCurrentView("tasks");
                          setSidebarOpen(false);
                        }}
                        className={`w-full px-3 md:px-4 py-1 md:py-2 rounded-lg text-xs md:text-sm transition-colors text-left ${
                          currentView === "tasks"
                            ? "bg-violet-500/40 text-foreground font-medium"
                            : "text-foreground hover:bg-white/20 dark:bg-black/20"
                        }`}
                        data-testid="submenu-tasks-normal"
                      >
                        {t('sidebar.normalTasks')}
                      </button>
                      <button
                        onClick={() => {
                          setCurrentView("recurring-tasks");
                          setSidebarOpen(false);
                        }}
                        className={`w-full px-3 md:px-4 py-1 md:py-2 rounded-lg text-xs md:text-sm transition-colors text-left ${
                          currentView === "recurring-tasks"
                            ? "bg-violet-500/40 text-foreground font-medium"
                            : "text-foreground hover:bg-white/20 dark:bg-black/20"
                        }`}
                        data-testid="submenu-tasks-recurring"
                      >
                        {t('sidebar.recurringTasks')}
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
                    className={`w-full px-3 md:px-4 py-1.5 md:py-2 rounded-xl flex items-center gap-2 transition-colors text-sm md:text-base ${
                      isCalendarActive
                        ? "bg-violet-500/40 text-foreground font-medium"
                        : "text-foreground hover:bg-white/20 dark:bg-black/20"
                    }`}
                    data-testid="menu-item-calendar"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                    <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${showCalendarSubmenu ? "rotate-180" : ""}`} />
                  </button>
                  
                  {showCalendarSubmenu && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="ml-3 md:ml-4 mt-0.5 md:mt-1 space-y-0.5 md:space-y-1">
                      <button
                        onClick={() => {
                          setCurrentView("calendar-create");
                          setSidebarOpen(false);
                        }}
                        className={`w-full px-4 py-2 rounded-lg text-sm transition-colors text-left ${
                          currentView === "calendar-create"
                            ? "bg-violet-500/40 text-foreground font-medium"
                            : "text-foreground hover:bg-white/20 dark:bg-black/20"
                        }`}
                        data-testid="submenu-calendar-create"
                      >
                        {t('sidebar.createEvent')}
                      </button>
                      <button
                        onClick={() => {
                          setCurrentView("calendar-view");
                          setSidebarOpen(false);
                        }}
                        className={`w-full px-4 py-2 rounded-lg text-sm transition-colors text-left ${
                          currentView === "calendar-view"
                            ? "bg-violet-500/40 text-foreground font-medium"
                            : "text-foreground hover:bg-white/20 dark:bg-black/20"
                        }`}
                        data-testid="submenu-calendar-view"
                      >
                        {t('sidebar.viewEvents')}
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
                className={`w-full px-3 md:px-4 py-1.5 md:py-2 rounded-xl flex items-center gap-2 transition-colors text-sm md:text-base ${
                  isActive
                    ? "bg-violet-500/40 text-foreground font-medium"
                    : "text-foreground hover:bg-white/20 dark:bg-black/20"
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

        <div className="p-2 md:p-4 border-t border-white/20">
          <div className="relative">
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className="w-full px-3 md:px-4 py-1.5 md:py-2 rounded-xl flex items-center gap-2 transition-colors text-foreground hover:bg-white/20 dark:bg-black/20 text-sm md:text-base"
              data-testid="menu-item-settings"
            >
              <Settings className="h-4 w-4" />
              <span>{t('settings.title')}</span>
              <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${showSettingsMenu ? "rotate-180" : ""}`} />
            </button>
            
            {showSettingsMenu && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="ml-3 md:ml-4 mt-0.5 md:mt-1 space-y-0.5 md:space-y-1 relative z-50">
                <button
                  onClick={() => { handleSettingsClick("ansicht"); setSidebarOpen(false); }}
                  className="w-full px-3 md:px-4 py-1 md:py-2 rounded-lg text-xs md:text-sm text-foreground hover:bg-white/20 dark:bg-black/20 transition-colors text-left"
                  data-testid="submenu-ansicht"
                >
                  {t('sidebar.view')}
                </button>

                {user.role === "parent" ? (
                  <div>
                    <button
                      onClick={() => setShowWalletSubmenu(!showWalletSubmenu)}
                      className="w-full px-3 md:px-4 py-1 md:py-2 rounded-lg text-xs md:text-sm text-foreground hover:bg-white/20 dark:bg-black/20 transition-colors text-left flex items-center justify-between"
                      data-testid="submenu-wallet"
                    >
                      <span>{t('sidebar.walletSettings')}</span>
                      <ChevronDown className={`h-3 w-3 transition-transform ${showWalletSubmenu ? "rotate-180" : ""}`} />
                    </button>
                    
                    {showWalletSubmenu && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="ml-4 md:ml-6 mt-0.5 md:mt-1 space-y-0.5 md:space-y-1">
                        <button
                          onClick={() => { setWalletTab("lnbits"); handleSettingsClick("wallet"); setSidebarOpen(false); }}
                          className="w-full px-3 md:px-4 py-0.5 md:py-2 rounded-lg text-xs text-foreground hover:bg-white/20 dark:bg-black/20 transition-colors text-left"
                          data-testid="submenu-wallet-lnbits"
                        >
                          {t('sidebar.lnbitsConnection')}
                        </button>
                        <button
                          onClick={() => { setWalletTab("nwc"); handleSettingsClick("wallet"); setSidebarOpen(false); }}
                          className="w-full px-3 md:px-4 py-0.5 md:py-2 rounded-lg text-xs text-foreground hover:bg-white/20 dark:bg-black/20 transition-colors text-left"
                          data-testid="submenu-wallet-nwc"
                        >
                          {t('sidebar.nwcConnection')}
                        </button>
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => { handleSettingsClick("wallet"); setSidebarOpen(false); }}
                    className="w-full px-3 md:px-4 py-1 md:py-2 rounded-lg text-xs md:text-sm text-foreground hover:bg-white/20 dark:bg-black/20 transition-colors text-left"
                    data-testid="submenu-wallet-child"
                  >
                    {t('sidebar.walletSettings')}
                  </button>
                )}

                <button
                  onClick={() => { handleSettingsClick("peers"); setSidebarOpen(false); }}
                  className="w-full px-3 md:px-4 py-1 md:py-2 rounded-lg text-xs md:text-sm text-foreground hover:bg-white/20 dark:bg-black/20 transition-colors text-left"
                  data-testid="submenu-peers"
                >
                  {t('sidebar.peers')}
                </button>

                {user.role === "parent" && (
                  <button
                    onClick={() => { setCurrentView("level-bonus-settings"); setSidebarOpen(false); setShowSettingsMenu(false); }}
                    className="w-full px-3 md:px-4 py-1 md:py-2 rounded-lg text-xs md:text-sm text-foreground hover:bg-white/20 dark:bg-black/20 transition-colors text-left"
                    data-testid="submenu-level-bonus"
                  >
                    {t('sidebar.levelBonus')}
                  </button>
                )}

                {user.role === "parent" && (
                  <button
                    onClick={() => { handleSettingsClick("dataManagement"); setSidebarOpen(false); }}
                    className="w-full px-3 md:px-4 py-1 md:py-2 rounded-lg text-xs md:text-sm text-destructive hover:bg-destructive/20 transition-colors text-left"
                    data-testid="submenu-data-management"
                  >
                    {t('dataManagement.title')}
                  </button>
                )}
              </motion.div>
            )}
          </div>
        </div>

        {user.role === "parent" && (
          <div className="p-2 md:p-4 border-t border-white/20">
            <button
              onClick={() => { setCurrentView("donate"); setSidebarOpen(false); }}
              className="w-full px-3 md:px-4 py-1.5 md:py-2 rounded-xl flex items-center gap-2 transition-colors text-foreground hover:bg-white/20 dark:bg-black/20 text-sm md:text-base"
              data-testid="menu-item-donate"
            >
              <span className="text-base md:text-lg">🧡</span>
              <span>{t('nav.donate')}</span>
            </button>
          </div>
        )}

        <div className="p-2 md:p-4 border-t border-white/20">
          <Button
            variant="outline"
            size="sm"
            onClick={onLogout}
            className="w-full gap-2 bg-red-500/20 border-red-500/40 text-red-700 hover:bg-red-500/30 hover:text-red-800 text-xs md:text-sm px-2 md:px-3 py-1 md:py-2"
            data-testid="button-logout-sidebar"
          >
            <LogOut className="h-4 w-4" /> {t('auth.logout')}
          </Button>
        </div>
      </motion.aside>
    </>
  );
}

function RoleSelectionPage({ onSelect }: { onSelect: (role: UserRole) => void }) {
  const { t, i18n } = useTranslation();
  
  const toggleLanguage = () => {
    const newLang = i18n.language === 'de' ? 'en' : 'de';
    i18n.changeLanguage(newLang);
  };
  
  return (
    <div 
      className="min-h-screen flex flex-col items-center p-6 bg-cover bg-center bg-no-repeat theme-bg"
      style={{ backgroundImage: 'url(/background.png)' }}
    >
      <button
        onClick={toggleLanguage}
        className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 bg-white/30 dark:bg-black/30 backdrop-blur-md border border-white/50 dark:border-white/20 rounded-xl hover:bg-white/5 dark:bg-black/30 transition-all text-foreground font-medium text-sm"
        data-testid="button-language-toggle"
      >
        <Globe className="h-4 w-4" />
        {i18n.language === 'de' ? '🇩🇪 DE' : '🇬🇧 EN'}
      </button>
      
      {/* Logo */}
      <div className="pt-8 mb-4">
        <img 
          src={kidzappLogo}
          alt="KID⚡APP - Family Organizer" 
          className="max-w-[280px] w-full h-auto drop-shadow-lg"
        />
      </div>
      
      {/* Center content - pushed more to middle */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md gap-4 -mt-12">
        
        {/* Info Box */}
        <div className="bg-white/15 dark:bg-black/20 backdrop-blur-md border border-white/50 dark:border-white/20 rounded-2xl p-5 w-full shadow-lg">
          <h3 className="text-lg font-bold mb-3 text-foreground">{t('landing.howItWorks')}</h3>
          <div className="space-y-2 text-foreground text-sm">
            <div className="flex gap-2">
              <span className="text-violet-600 flex-shrink-0">•</span>
              <span>{t('landing.step1')}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-violet-600 flex-shrink-0">•</span>
              <span>{t('landing.step2')}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-violet-600 flex-shrink-0">•</span>
              <span>{t('landing.step3')}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-violet-600 flex-shrink-0">•</span>
              <span>{t('landing.step4')}</span>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="w-full space-y-3">
        <button 
          className="w-full p-4 bg-white/25 dark:bg-black/30 backdrop-blur-md border border-white/40 dark:border-white/20 rounded-2xl hover:bg-white/35 dark:bg-black/40 hover:border-white/60 transition-all flex items-center gap-4 group shadow-xl"
          onClick={() => onSelect("parent")}
          data-testid="button-select-parent"
        >
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
            <UserIcon className="h-6 w-6 text-white" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-lg text-foreground tracking-wide">{t('auth.parent').toUpperCase()}</h3>
            <p className="text-sm text-foreground">{t('landing.parentDesc')}</p>
          </div>
          <span className="ml-auto text-amber-600 text-xl opacity-0 group-hover:opacity-100 transition-opacity">⚡</span>
        </button>

        <button 
          className="w-full p-4 bg-white/25 dark:bg-black/30 backdrop-blur-md border border-white/40 dark:border-white/20 rounded-2xl hover:bg-white/35 dark:bg-black/40 hover:border-white/60 transition-all flex items-center gap-4 group shadow-xl"
          onClick={() => onSelect("child")}
          data-testid="button-select-child"
        >
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-lg text-foreground tracking-wide">{t('auth.child').toUpperCase()}</h3>
            <p className="text-sm text-foreground">{t('landing.childDesc')}</p>
          </div>
          <span className="ml-auto text-amber-600 text-xl opacity-0 group-hover:opacity-100 transition-opacity">⚡</span>
        </button>
        </div>

        {/* Legal Disclaimers Section - Accordion */}
        <div className="w-full max-w-2xl mt-12 mb-6">
          <Accordion type="single" collapsible className="bg-white/10 dark:bg-black/20 backdrop-blur-md border border-white/30 dark:border-white/10 rounded-2xl overflow-hidden">
            <AccordionItem value="legal" className="border-none">
              <AccordionTrigger className="hover:bg-white/10 dark:bg-black/20 px-6 py-4 text-foreground font-bold text-lg data-testid-trigger-legal-info">
                📋 {t('landing.legalDisclaimer')}
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6 space-y-3 bg-white/5 dark:bg-black/10">
                <div className="bg-red-500/10 border-l-4 border-red-500 pl-4 py-3 rounded">
                  <p className="font-bold text-red-900">⚠️ {t('landing.bitcoinWarning')}</p>
                  <p className="text-sm text-foreground mt-1">{t('landing.bitcoinWarningDesc')}</p>
                </div>

                <div className="bg-blue-500/10 border-l-4 border-blue-500 pl-4 py-3 rounded">
                  <p className="font-bold text-blue-900">👨‍👩‍👧 {t('landing.parentalResponsibility')}</p>
                  <p className="text-sm text-foreground mt-1">{t('landing.parentalResponsibilityDesc')}</p>
                </div>

                <div className="bg-amber-500/10 border-l-4 border-amber-500 pl-4 py-3 rounded">
                  <p className="font-bold text-amber-900">📊 {t('landing.noGuarantee')}</p>
                  <p className="text-sm text-foreground mt-1">{t('landing.noGuaranteeDesc')}</p>
                </div>

                <div className="bg-green-500/10 border-l-4 border-green-500 pl-4 py-3 rounded">
                  <p className="font-bold text-green-900">👨‍👩‍👧‍👦 {t('landing.familyUse')}</p>
                  <p className="text-sm text-foreground mt-1">{t('landing.familyUseDesc')}</p>
                </div>

                <div className="bg-cyan-500/10 border-l-4 border-cyan-500 pl-4 py-3 rounded">
                  <p className="font-bold text-cyan-900">🔒 {t('landing.dataPrivacy')}</p>
                  <p className="text-sm text-foreground mt-1">{t('landing.dataPrivacyDesc')}</p>
                </div>

                <div className="bg-purple-500/10 border-l-4 border-purple-500 pl-4 py-3 rounded">
                  <p className="font-bold text-purple-900">{t('landing.childrenInfo')}</p>
                  <p className="text-sm text-foreground mt-1">{t('landing.childrenInfoDesc')}</p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </div>
  );
}

function AuthPage({ role, onComplete, onBack }: { role: UserRole; onComplete: (user: User) => void; onBack: () => void }) {
  const { t } = useTranslation();
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
      toast({ title: t('common.error'), description: t('auth.fillAllFields'), variant: "destructive" });
      return;
    }
    const passwordCheck = validatePassword(forgotPinNewPin);
    if (!passwordCheck.valid) {
      toast({ title: t('common.error'), description: t(passwordCheck.error), variant: "destructive" });
      return;
    }
    setIsForgotLoading(true);
    try {
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
      
      toast({ title: t('auth.passwordResetSuccess'), description: t('auth.loginWithNewPassword') });
      setShowForgotPin(false);
      setForgotPinName("");
      setForgotPinColor("");
      setForgotPinNewPin("");
      setPin(forgotPinNewPin);
      setName(forgotPinName.trim());
    } catch (error) {
      toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
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
        title: t('common.error'),
        description: t('auth.fillAllFields'),
        variant: "destructive"
      });
      return;
    }
    
    if (!isLogin) {
      const passwordCheck = validatePassword(trimmedPin);
      if (!passwordCheck.valid) {
        toast({
          title: t('common.error'),
          description: t(passwordCheck.error),
          variant: "destructive"
        });
        return;
      }
    }

    if (!isLogin && role === "parent" && parentMode === "new" && !trimmedFamilyName) {
      toast({
        title: t('common.error'),
        description: t('auth.enterFamilyName'),
        variant: "destructive"
      });
      return;
    }

    if (!isLogin && role === "parent" && parentMode === "new" && !favoriteColor.trim()) {
      toast({
        title: t('common.error'),
        description: t('auth.enterFavoriteColor'),
        variant: "destructive"
      });
      return;
    }

    if (!isLogin && role === "parent" && parentMode === "join" && !trimmedJoinParentId) {
      toast({
        title: t('common.error'),
        description: t('auth.enterFamilyId'),
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    try {
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
      
      toast({
        title: isLogin ? t('auth.welcomeBack') : t('auth.accountCreated'),
        description: isLogin ? t('auth.loggedIn') : t('auth.accountCreatedDesc')
      });
      onComplete(user);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: t('common.error'),
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
        className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat theme-bg"
        style={{ backgroundImage: 'url(/background.png)' }}
      >
        <div className="w-full max-w-lg">
          <div className="space-y-4 mb-8">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onBack} 
              className="w-fit mb-2 -ml-2 text-foreground hover:text-foreground hover:bg-white/20 dark:bg-black/20"
              data-testid="button-back"
            >
              ← {t('common.back')}
            </Button>
            <div>
              <h1 className="text-2xl font-bold mb-2 text-foreground">{t('auth.selectFamily')}</h1>
              <p className="text-foreground">{t('auth.selectFamilyDesc')}</p>
            </div>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => setParentMode("new")}
              className="w-full h-auto px-4 py-4 bg-white/5 dark:bg-black/30 backdrop-blur-xl border border-white/50 dark:border-white/20 rounded-2xl hover:bg-white/60 transition-all flex items-center text-left shadow-lg"
              data-testid="button-create-new-family"
            >
              <div className="mr-3 h-10 w-10 rounded-full bg-violet-500/30 flex items-center justify-center flex-shrink-0">
                <Plus className="h-5 w-5 text-violet-700" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{t('landing.newFamily')}</p>
                <p className="text-xs text-foreground">{t('landing.newFamilyDesc')}</p>
              </div>
            </button>
            <button
              onClick={() => setParentMode("join")}
              className="w-full h-auto px-4 py-4 bg-white/5 dark:bg-black/30 backdrop-blur-xl border border-white/50 dark:border-white/20 rounded-2xl hover:bg-white/60 transition-all flex items-center text-left shadow-lg"
              data-testid="button-join-family"
            >
              <div className="mr-3 h-10 w-10 rounded-full bg-cyan-500/30 flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-cyan-700" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{t('landing.joinFamily')}</p>
                <p className="text-xs text-foreground">{t('landing.joinFamilyDesc')}</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat theme-bg"
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
            className="w-fit mb-2 -ml-2 text-foreground hover:text-foreground hover:bg-white/20 dark:bg-black/20"
            data-testid="button-back"
          >
            ← {t('common.back')}
          </Button>
          <div>
            <h2 className="text-2xl font-bold mb-2 text-foreground">
              {isLogin ? t('auth.loginTitle') : t('auth.registerTitle')}
            </h2>
            <p className="text-foreground">
              {isLogin ? t('auth.loginDesc') : t('auth.registerDesc')}
            </p>
          </div>
        </div>

        <div className="bg-white/5 dark:bg-black/30 backdrop-blur-xl border border-white/50 dark:border-white/20 rounded-2xl p-6 shadow-xl space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && role === "parent" && parentMode === "new" && (
              <div className="space-y-2">
                <Label htmlFor="familyName" className="text-foreground">{t('auth.familyName')}</Label>
                <Input 
                  id="familyName"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  className="bg-white/5 dark:bg-black/30 border-white/60 focus:border-violet-500 focus:bg-white/70 text-foreground placeholder:text-gray-500"
                  disabled={isLoading}
                  autoComplete="off"
                  placeholder={t('auth.familyNamePlaceholder')}
                  data-testid="input-family-name"
                />
              </div>
            )}
            {!isLogin && role === "parent" && parentMode === "join" && (
              <div className="space-y-2">
                <Label htmlFor="joinParentId" className="text-foreground">{t('auth.familyCode')}</Label>
                <Input 
                  id="joinParentId"
                  value={joinParentId}
                  onChange={(e) => setJoinParentId(e.target.value.toUpperCase())}
                  className="bg-white/5 dark:bg-black/30 border-white/60 focus:border-violet-500 focus:bg-white/70 text-foreground placeholder:text-gray-500 font-mono text-center"
                  disabled={isLoading}
                  autoComplete="off"
                  placeholder={t('auth.familyCodePlaceholder')}
                  data-testid="input-join-parent-id"
                />
                <p className="text-xs text-muted-foreground">{t('auth.askParentForCode')}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground">{t('auth.yourName')}</Label>
              <Input 
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-white/5 dark:bg-black/30 border-white/60 focus:border-violet-500 focus:bg-white/70 text-foreground placeholder:text-gray-500"
                disabled={isLoading}
                autoFocus
                autoComplete="off"
                data-testid="input-name"
              />
            </div>
            {!isLogin && role === "parent" && parentMode === "new" && (
              <div className="space-y-2">
                <Label htmlFor="favoriteColor" className="text-foreground">{t('auth.favoriteColorLabel')}</Label>
                <Input 
                  id="favoriteColor"
                  value={favoriteColor}
                  onChange={(e) => setFavoriteColor(e.target.value)}
                  className="bg-white/5 dark:bg-black/30 border-white/60 focus:border-violet-500 focus:bg-white/70 text-foreground placeholder:text-gray-500"
                  disabled={isLoading}
                  autoComplete="off"
                  placeholder={t('auth.colorPlaceholder')}
                  data-testid="input-favorite-color"
                />
                <p className="text-xs text-muted-foreground">{t('auth.colorHint')}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="pin" className="text-foreground">{isLogin ? t('auth.password') : t('auth.passwordWithLength')}</Label>
              <Input 
                id="pin"
                type="password"
                placeholder={isLogin ? "••••••••" : t('auth.passwordPlaceholder')}
                value={pin}
                onChange={(e) => setPin(e.target.value.slice(0, 12))}
                className="bg-white/5 dark:bg-black/30 border-white/60 focus:border-violet-500 focus:bg-white/70 text-foreground placeholder:text-gray-400"
                disabled={isLoading}
                maxLength={12}
                autoComplete="off"
                data-testid="input-pin"
              />
              {!isLogin && (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className={pin.length >= 8 && pin.length <= 12 ? "text-green-600" : ""}>
                    {pin.length >= 8 && pin.length <= 12 ? "✓" : "○"} {pin.length}/8-12 {t('auth.characters')}
                  </p>
                  <p className={/[A-Z]/.test(pin) ? "text-green-600" : ""}>
                    {/[A-Z]/.test(pin) ? "✓" : "○"} {t('auth.requireUppercase')}
                  </p>
                  <p className={/[0-9]/.test(pin) ? "text-green-600" : ""}>
                    {/[0-9]/.test(pin) ? "✓" : "○"} {t('auth.requireNumber')}
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
                {isLoading ? t('common.loading') : isLogin ? t('auth.login') : t('auth.register')}
              </Button>
              <Button 
                type="button"
                variant="outline"
                className="w-full bg-white/30 dark:bg-black/30 border-white/40 dark:border-white/20 text-foreground hover:bg-white/40 dark:hover:bg-black/40"
                onClick={() => setIsLogin(!isLogin)}
                disabled={isLoading}
                data-testid="button-toggle-mode"
              >
                {isLogin ? t('auth.noAccount') : t('auth.haveAccount')}
              </Button>
              {isLogin && role === "parent" && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-xs text-muted-foreground hover:text-foreground hover:bg-white/20 dark:bg-black/20"
                  onClick={() => setShowForgotPin(true)}
                  disabled={isLoading}
                  data-testid="button-forgot-pin"
                >
                  {t('auth.forgotPassword')}
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
                {t('auth.resetPassword')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-5 pt-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-name" className="text-sm font-semibold">{t('auth.name')}</Label>
                <Input 
                  id="forgot-name"
                  value={forgotPinName}
                  onChange={(e) => setForgotPinName(e.target.value)}
                  className="bg-secondary/50 border-border focus:border-primary"
                  disabled={isForgotLoading}
                  placeholder={t('auth.enterYourName')}
                  data-testid="input-forgot-pin-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="forgot-color" className="text-sm font-semibold">{t('auth.favoriteColor')}</Label>
                <Input 
                  id="forgot-color"
                  placeholder={t('auth.colorPlaceholder')}
                  value={forgotPinColor}
                  onChange={(e) => setForgotPinColor(e.target.value)}
                  className="bg-secondary/50 border-border focus:border-primary"
                  disabled={isForgotLoading}
                  data-testid="input-forgot-pin-color"
                />
                <p className="text-xs text-muted-foreground">{t('auth.colorRegistrationHint')}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="forgot-new-pin" className="text-sm font-semibold">{t('auth.newPassword')}</Label>
                <Input 
                  id="forgot-new-pin"
                  type="password"
                  placeholder={t('auth.passwordLengthHint')}
                  value={forgotPinNewPin}
                  onChange={(e) => setForgotPinNewPin(e.target.value.slice(0, 12))}
                  className="bg-secondary/50 border-border focus:border-primary"
                  disabled={isForgotLoading}
                  maxLength={12}
                  data-testid="input-forgot-pin-new"
                />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className={forgotPinNewPin.length >= 8 && forgotPinNewPin.length <= 12 ? "text-green-500" : ""}>
                    {forgotPinNewPin.length >= 8 && forgotPinNewPin.length <= 12 ? "✓" : "○"} {forgotPinNewPin.length}/8-12 {t('auth.characters')}
                  </p>
                  <p className={/[A-Z]/.test(forgotPinNewPin) ? "text-green-500" : ""}>
                    {/[A-Z]/.test(forgotPinNewPin) ? "✓" : "○"} {t('auth.requireUppercase')}
                  </p>
                  <p className={/[0-9]/.test(forgotPinNewPin) ? "text-green-500" : ""}>
                    {/[0-9]/.test(forgotPinNewPin) ? "✓" : "○"} {t('auth.requireNumber')}
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
                  {isForgotLoading ? t('common.loading') : t('auth.resetPasswordButton')}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowForgotPin(false)}
                  disabled={isForgotLoading}
                  className="flex-1 border-border hover:bg-secondary/50"
                  data-testid="button-cancel-forgot-pin"
                >
                  {t('common.cancel')}
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
  const { t } = useTranslation();
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
      refetchInterval: 30000
    });

    const parents = connectedPeers.filter((p: any) => p.role === "parent");
    const children = connectedPeers.filter((p: any) => p.role === "child");

    const handleUnlinkChild = async (childId: number, childName: string) => {
      if (!window.confirm(t('family.confirmRemoveChild', { name: childName }))) return;
      
      try {
        const res = await fetch("/api/peers/unlink", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ childId })
        });
        if (!res.ok) throw new Error("Failed to unlink");
        queryClient.invalidateQueries({ queryKey: ["peers", user.connectionId] });
        toast({ title: t('common.success'), description: t('family.childUnlinked', { name: childName }) });
      } catch (error) {
        toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
      }
    };

    const handleResetPin = async (childId: number) => {
      const passwordCheck = validatePassword(resetPinValue);
      if (!passwordCheck.valid) {
        toast({ title: t('common.error'), description: t(passwordCheck.error), variant: "destructive" });
        return;
      }

      try {
        const res = await fetch(`/api/peers/${childId}/reset-pin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parentId: user.id, newPin: resetPinValue }),
        });
        if (!res.ok) throw new Error(t('errors.passwordChangeFailed'));
        setResetPinChildId(null);
        setResetPinValue("");
        queryClient.invalidateQueries({ queryKey: ["peers", user.connectionId] });
        toast({ title: t('common.success'), description: t('settings.passwordReset') });
      } catch (error) {
        toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
      }
    };

    const handleCopyConnectionId = async () => {
      try {
        await navigator.clipboard.writeText(user.connectionId);
        toast({ title: t('common.copied'), description: t('auth.connectionIdCopied') });
      } catch (error) {
        toast({ title: t('common.error'), description: t('errors.couldNotCopyId'), variant: "destructive" });
      }
    };

    return (
      <div className="space-y-6">
        {/* Eltern Hierarchie */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase">{t('settings.familyStructure')}</h3>
          
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
                            {child.lightningAddress ? `⚡ ${child.lightningAddress}` : `⚠️ ${t('wallet.noAddress')}`}
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
                        <p className="text-xs font-semibold">{t('settings.newPasswordFor')} {child.name}:</p>
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
                            {t('settings.changePassword')}
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
                            {t('common.cancel')}
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
              <p>{t('dashboard.noChildrenConnected')}</p>
              <p className="text-xs mt-1">{t('dashboard.shareCodeWithChildren')}</p>
            </div>
          )}
        </div>

        {/* Connection ID Box */}
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">{t('settings.pairingIdForChildren')}</p>
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
          <p className="text-xs text-muted-foreground mt-2">{t('settings.shareIdWithChildren')}</p>
        </div>

        {/* Password Change Section for Parent */}
        <div className="space-y-3">
          <Button
            variant="outline"
            onClick={() => setShowParentPinChange(!showParentPinChange)}
            className="w-full text-sm"
            data-testid="button-toggle-parent-pin-change"
          >
            {showParentPinChange ? t('settings.cancelPasswordChange') : `🔑 ${t('settings.changeMyPassword')}`}
          </Button>
          
          {showParentPinChange && (
            <div className="p-3 rounded-lg border-2 border-amber-500/50 bg-amber-500/10 space-y-2">
              <div className="space-y-2">
                <Label htmlFor="old-pin">{t('settings.oldPassword')}</Label>
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
                <Label htmlFor="new-pin">{t('auth.newPassword')} (8-12)</Label>
                <Input
                  id="new-pin"
                  type="password"
                  maxLength={12}
                  placeholder="8-12"
                  value={newParentPin}
                  onChange={(e) => setNewParentPin(e.target.value.slice(0, 12))}
                  className="text-sm"
                  data-testid="input-new-parent-pin"
                />
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p className={newParentPin.length >= 8 && newParentPin.length <= 12 ? "text-green-500" : ""}>
                    {newParentPin.length >= 8 && newParentPin.length <= 12 ? "✓" : "○"} {t('settings.lengthCheck', { length: newParentPin.length })}
                  </p>
                  <p className={/[A-Z]/.test(newParentPin) ? "text-green-500" : ""}>
                    {/[A-Z]/.test(newParentPin) ? "✓" : "○"} {t('settings.uppercase')}
                  </p>
                  <p className={/[0-9]/.test(newParentPin) ? "text-green-500" : ""}>
                    {/[0-9]/.test(newParentPin) ? "✓" : "○"} {t('settings.number')}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    const passwordCheck = validatePassword(newParentPin);
                    if (!oldParentPin || !passwordCheck.valid) {
                      toast({ title: t('common.error'), description: passwordCheck.error ? t(passwordCheck.error) : t('settings.fillBothPasswordFields'), variant: "destructive" });
                      return;
                    }
                    setIsSavingPin(true);
                    try {
                      const res = await fetch(`/api/peers/${user.id}/change-pin`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ oldPin: oldParentPin, newPin: newParentPin }),
                      });
                      if (!res.ok) throw new Error(t('errors.passwordChangeFailed'));
                      setShowParentPinChange(false);
                      setOldParentPin("");
                      setNewParentPin("");
                      toast({ title: t('common.success'), description: t('settings.passwordChanged') });
                    } catch (error) {
                      toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
                    } finally {
                      setIsSavingPin(false);
                    }
                  }}
                  className="flex-1 bg-primary hover:bg-primary/90 text-xs h-7"
                  disabled={isSavingPin || !validatePassword(newParentPin).valid}
                  data-testid="button-confirm-parent-pin-change"
                >
                  {isSavingPin ? t('common.loading') : t('settings.changePassword')}
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
                  {t('common.cancel')}
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
      refetchInterval: 30000
    });

    const parent = connectedPeers
      .filter((p: any) => p.role === "parent")
      .sort((a: any, b: any) => a.id - b.id)[0];

    const handleUnlink = async () => {
      if (!window.confirm(t('family.confirmLeaveFamily'))) return;
      
      try {
        const res = await fetch("/api/peers/unlink", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ childId: user.id })
        });
        if (!res.ok) throw new Error("Failed to unlink");
        setUser(await res.json());
        queryClient.invalidateQueries({ queryKey: ["peers"] });
        toast({ title: t('peers.unlinkSuccess'), description: t('peers.unlinkSuccessDesc') });
      } catch (error) {
        toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
      }
    };

    return (
      <div className="space-y-3">
        {parent ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase">{t('dashboard.connectedWith')}</p>
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
            <p>{t('dashboard.notConnectedToFamily')}</p>
            <p className="text-xs mt-1">{t('dashboard.connectWithParents')}</p>
          </div>
        )}
      </div>
    );
  }
}

function DataManagementContent({ user, setUser, onClose }: any) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmCode, setConfirmCode] = useState("");
  const [activeConfirm, setActiveConfirm] = useState<string | null>(null);
  const [lastParentInfo, setLastParentInfo] = useState<{ isLastParent: boolean; childrenCount: number } | null>(null);
  
  useEffect(() => {
    const checkLastParent = async () => {
      try {
        const res = await fetch(`/api/account/${user.id}/is-last-parent`);
        if (res.ok) {
          const data = await res.json();
          setLastParentInfo(data);
        }
      } catch (error) {
        console.error("Failed to check last parent status:", error);
      }
    };
    if (user.role === 'parent') {
      checkLastParent();
    }
  }, [user.id, user.role]);

  const handleCleanup = async (type: "chat" | "photos" | "events" | "shopping") => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/cleanup/${type}/${user.connectionId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast({ 
        title: t('dataManagement.deleted'), 
        description: data.deleted > 0 
          ? t('dataManagement.itemsDeleted', { count: data.deleted })
          : t('dataManagement.noItemsToDelete')
      });
    } catch (error) {
      toast({ title: t('dataManagement.error'), description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    if (confirmCode !== "DELETE-ALL") {
      toast({ title: t('dataManagement.error'), description: "Invalid confirmation code", variant: "destructive" });
      return;
    }
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/cleanup/all/${user.connectionId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerId: user.id, confirmationCode: "DELETE-ALL" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast({ title: t('dataManagement.allDataDeleted') });
      setActiveConfirm(null);
      setConfirmCode("");
    } catch (error) {
      toast({ title: t('dataManagement.error'), description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResetAccount = async () => {
    if (confirmCode !== "RESET-ACCOUNT") {
      toast({ title: t('dataManagement.error'), description: "Invalid confirmation code", variant: "destructive" });
      return;
    }
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/account/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerId: user.id, confirmationCode: "RESET-ACCOUNT" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast({ title: t('dataManagement.accountReset') });
      setActiveConfirm(null);
      setConfirmCode("");
    } catch (error) {
      toast({ title: t('dataManagement.error'), description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmCode !== "DELETE-ACCOUNT-FOREVER") {
      toast({ title: t('dataManagement.error'), description: "Invalid confirmation code", variant: "destructive" });
      return;
    }
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/account/${user.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationCode: "DELETE-ACCOUNT-FOREVER" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast({ title: t('dataManagement.accountDeleted') });
      localStorage.removeItem("sats-user");
      setUser(null);
      onClose();
    } catch (error) {
      toast({ title: t('dataManagement.error'), description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-300">
        <p className="text-sm font-semibold flex items-center gap-2">
          <span>✓</span> {t('dataManagement.preservedData')}
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase">{t('dataManagement.cleanupSection')}</h3>
        
        <div className="grid gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCleanup("chat")}
            disabled={isDeleting}
            className="justify-start h-auto py-2 text-xs overflow-hidden"
            data-testid="button-cleanup-chat"
          >
            <div className="text-left flex-1 min-w-0">
              <p className="font-medium truncate">{t('dataManagement.cleanupChat')}</p>
              <p className="text-xs text-muted-foreground truncate">{t('dataManagement.cleanupChatDesc')}</p>
            </div>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCleanup("photos")}
            disabled={isDeleting}
            className="justify-start h-auto py-2 text-xs overflow-hidden"
            data-testid="button-cleanup-photos"
          >
            <div className="text-left flex-1 min-w-0">
              <p className="font-medium truncate">{t('dataManagement.cleanupPhotos')}</p>
              <p className="text-xs text-muted-foreground truncate">{t('dataManagement.cleanupPhotosDesc')}</p>
            </div>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCleanup("events")}
            disabled={isDeleting}
            className="justify-start h-auto py-2 text-xs overflow-hidden"
            data-testid="button-cleanup-events"
          >
            <div className="text-left flex-1 min-w-0">
              <p className="font-medium truncate">{t('dataManagement.cleanupEvents')}</p>
              <p className="text-xs text-muted-foreground truncate">{t('dataManagement.cleanupEventsDesc')}</p>
            </div>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCleanup("shopping")}
            disabled={isDeleting}
            className="justify-start h-auto py-2 text-xs overflow-hidden"
            data-testid="button-cleanup-shopping"
          >
            <div className="text-left flex-1 min-w-0">
              <p className="font-medium truncate">{t('dataManagement.cleanupShopping')}</p>
              <p className="text-xs text-muted-foreground truncate">{t('dataManagement.cleanupShoppingDesc')}</p>
            </div>
          </Button>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-destructive uppercase flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {t('dataManagement.dangerZone')}
        </h3>

        {activeConfirm === "deleteAll" && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 space-y-3">
            <p className="text-sm text-destructive font-medium">{t('dataManagement.deleteAllWarning')}</p>
            <p className="text-xs">{t('dataManagement.typeToConfirm', { code: 'DELETE-ALL' })}</p>
            <Input
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value)}
              placeholder="DELETE-ALL"
              className="font-mono text-xs"
              data-testid="input-confirm-delete-all"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setActiveConfirm(null); setConfirmCode(""); }}
                data-testid="button-cancel-delete-all"
              >
                {t('dataManagement.cancel')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteAll}
                disabled={confirmCode !== "DELETE-ALL" || isDeleting}
                data-testid="button-confirm-delete-all"
              >
                {isDeleting ? "..." : t('dataManagement.confirm')}
              </Button>
            </div>
          </div>
        )}

        {activeConfirm !== "deleteAll" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveConfirm("deleteAll")}
            className="w-full justify-start h-auto py-2 border-destructive/50 hover:bg-destructive/10 text-xs overflow-hidden"
            data-testid="button-delete-all"
          >
            <div className="text-left flex-1 min-w-0">
              <p className="font-medium text-destructive truncate">{t('dataManagement.deleteAllData')}</p>
              <p className="text-xs text-muted-foreground truncate">{t('dataManagement.deleteAllDataDesc')}</p>
            </div>
          </Button>
        )}

        {activeConfirm === "resetAccount" && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-3">
            <p className="text-sm text-amber-700 dark:text-amber-300">{t('dataManagement.permanentAction')}</p>
            <p className="text-xs">{t('dataManagement.typeToConfirm', { code: 'RESET-ACCOUNT' })}</p>
            <Input
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value)}
              placeholder="RESET-ACCOUNT"
              className="font-mono text-xs"
              data-testid="input-confirm-reset"
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setActiveConfirm(null); setConfirmCode(""); }}>
                {t('dataManagement.cancel')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleResetAccount}
                disabled={confirmCode !== "RESET-ACCOUNT" || isDeleting}
              >
                {isDeleting ? "..." : t('dataManagement.confirm')}
              </Button>
            </div>
          </div>
        )}

        {activeConfirm !== "resetAccount" && activeConfirm !== "deleteAll" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveConfirm("resetAccount")}
            className="w-full justify-start h-auto py-2 text-xs overflow-hidden"
            data-testid="button-reset-account"
          >
            <div className="text-left flex-1 min-w-0">
              <p className="font-medium truncate">{t('dataManagement.resetAccount')}</p>
              <p className="text-xs text-muted-foreground truncate">{t('dataManagement.resetAccountDesc')}</p>
            </div>
          </Button>
        )}

        {activeConfirm === "deleteAccount" && (
          <div className="p-3 rounded-lg bg-destructive/20 border-2 border-destructive space-y-3">
            <p className="text-sm text-destructive font-bold">{t('dataManagement.deleteAccountWarning')}</p>
            {lastParentInfo?.isLastParent && lastParentInfo.childrenCount > 0 && (
              <div className="p-2 rounded bg-amber-500/20 border border-amber-500">
                <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                  {t('dataManagement.lastParentWarning', { count: lastParentInfo.childrenCount })}
                </p>
              </div>
            )}
            <p className="text-xs">{t('dataManagement.typeToConfirm', { code: 'DELETE-ACCOUNT-FOREVER' })}</p>
            <Input
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value)}
              placeholder="DELETE-ACCOUNT-FOREVER"
              className="font-mono text-xs border-destructive"
              data-testid="input-confirm-delete-account"
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setActiveConfirm(null); setConfirmCode(""); }}>
                {t('dataManagement.cancel')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteAccount}
                disabled={confirmCode !== "DELETE-ACCOUNT-FOREVER" || isDeleting}
                data-testid="button-confirm-delete-account"
              >
                {isDeleting ? "..." : t('dataManagement.confirm')}
              </Button>
            </div>
          </div>
        )}

        {activeConfirm !== "deleteAccount" && activeConfirm !== "resetAccount" && activeConfirm !== "deleteAll" && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setActiveConfirm("deleteAccount")}
            className="w-full justify-start h-auto py-2 text-xs overflow-hidden"
            data-testid="button-delete-account"
          >
            <div className="text-left flex-1 min-w-0">
              <p className="font-medium truncate">{t('dataManagement.deleteAccount')}</p>
              <p className="text-xs opacity-80 truncate">{t('dataManagement.deleteAccountDesc')}</p>
            </div>
          </Button>
        )}
      </div>
    </div>
  );
}

function SettingsModal({ user, setUser, activeTab, walletTab, setWalletTab, onClose, layoutView, setLayoutView }: any) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
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
          title: t('wallet.connectionSuccess'), 
          description: `${t('wallet.worksWith')} ${data.workingEndpoint}` 
        });
      } else {
        useToastFn({ 
          title: t('wallet.connectionFailed'), 
          description: data.error, 
          variant: "destructive" 
        });
      }
    } catch (error) {
      useToastFn({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
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
        title: t('wallet.lnbitsSaved'), 
        description: t('wallet.walletConnectionActive'),
        duration: 3000
      });
      
      // Close modal after 1 second so user can see toast
      setTimeout(() => onClose(), 1500);
    } catch (error) {
      useToastFn({ 
        title: t('wallet.saveError'), 
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
        title: t('wallet.lnbitsDisconnected'), 
        description: t('wallet.walletConnectionRemoved'),
        duration: 3000
      });
    } catch (error) {
      useToastFn({ 
        title: t('common.error'), 
        description: (error as Error).message, 
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const saveNwc = async () => {
    if (!editNwcConnectionString || !editNwcConnectionString.startsWith("nostr+walletconnect://")) {
      useToastFn({ title: t('common.error'), description: t('errors.nwcRequired'), variant: "destructive" });
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
      useToastFn({ title: t('wallet.nwcConnected'), description: t('wallet.nwcActive'), duration: 3000 });
      setTimeout(() => onClose(), 1500);
    } catch (error) {
      useToastFn({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
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
      useToastFn({ title: t('wallet.nwcDisconnected'), description: t('wallet.nwcRemoved'), duration: 3000 });
    } catch (error) {
      useToastFn({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLayoutChange = (layout: string) => {
    setLayoutView(layout);
    if (user?.id) {
      localStorage.setItem(`layoutView_${user.id}`, layout);
    }
    useToastFn({ title: t('wallet.viewUpdated'), description: layout === "one-column" ? t('wallet.dashboardOneColumn') : t('wallet.dashboardTwoColumns') });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>
            {activeTab === "ansicht" && t('sidebar.view')}
            {activeTab === "wallet" && t('sidebar.walletSettings')}
            {activeTab === "peers" && t('sidebar.peers')}
            {activeTab === "dataManagement" && t('dataManagement.title')}
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
                        useToastFn({ title: t('wallet.familyNameUpdated'), duration: 2000 });
                      } catch (error) {
                        useToastFn({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                    disabled={!editFamilyName.trim() || isSaving}
                    className="w-full"
                    data-testid="button-save-family-name"
                  >
                    {isSaving ? t('common.saving') : t('common.save')}
                  </Button>
                </div>
              )}
              <Label>{t('settings.dashboardView')}</Label>
              <div className="space-y-2">
                <Button
                  variant={layoutView === "one-column" ? "default" : "outline"}
                  className="w-full justify-start text-left"
                  onClick={() => handleLayoutChange("one-column")}
                  data-testid="button-layout-one-column"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold">{t('settings.singleColumn')}</span>
                    <span className="text-xs text-muted-foreground">{t('settings.boxesArrangedVertically')}</span>
                  </div>
                </Button>
                <Button
                  variant={layoutView === "two-column" ? "default" : "outline"}
                  className="w-full justify-start text-left"
                  onClick={() => handleLayoutChange("two-column")}
                  data-testid="button-layout-two-column"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold">{t('settings.twoColumn')}</span>
                    <span className="text-xs text-muted-foreground">{t('settings.boxesArrangedHorizontally')}</span>
                  </div>
                </Button>
              </div>

              <Separator className="my-4" />

              <div className="space-y-3 pt-2">
                <Label className="text-sm font-semibold">Theme</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={theme === "light" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("light")}
                    className="flex flex-col gap-1 h-auto py-3"
                    data-testid="button-theme-light"
                  >
                    <Sun className="h-4 w-4" />
                    <span className="text-xs">Light</span>
                  </Button>
                  <Button
                    variant={theme === "dark" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("dark")}
                    className="flex flex-col gap-1 h-auto py-3"
                    data-testid="button-theme-dark"
                  >
                    <Moon className="h-4 w-4" />
                    <span className="text-xs">Dark</span>
                  </Button>
                  <Button
                    variant={theme === "system" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("system")}
                    className="flex flex-col gap-1 h-auto py-3"
                    data-testid="button-theme-system"
                  >
                    <Laptop className="h-4 w-4" />
                    <span className="text-xs">System</span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {theme === "system" ? "System theme wird automatisch angewendet" : `Aktuell: ${theme === "light" ? "Light Mode" : "Dark Mode"}`}
                </p>
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
                    <Label htmlFor="lightning-address">{t('wallet.lightningAddress')}</Label>
                    <Input 
                      id="lightning-address"
                      placeholder="name@example.com"
                      value={editLnbitsUrl || ""}
                      onChange={(e) => setEditLnbitsUrl(e.target.value)}
                      className="font-mono text-xs"
                      data-testid="input-lightning-address"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('wallet.formatExample')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('common.status')}: {user.lightningAddress ? "✓ " + t('common.configured') : "✗ " + t('common.notConfigured')}
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
                        useToastFn({ title: t('wallet.lightningAddressSaved'), duration: 3000 });
                        setTimeout(() => onClose(), 1500);
                      } catch (error) {
                        useToastFn({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                    disabled={isSaving || !editLnbitsUrl}
                    data-testid="button-save-lightning-address"
                  >
                    {isSaving ? "⏳ " + t('common.saving') : "💾 " + t('common.save')}
                  </Button>
                </div>
              ) : (
                <>
                  {walletTab === "lnbits" && (
                  <div className="space-y-4 mt-4 border-2 border-primary/40 bg-primary/5 rounded-lg p-4">
                    {user.hasLnbitsConfigured ? (
                      <div className="space-y-3">
                        <div className="p-3 rounded-lg border border-green-500/30 bg-green-500/10">
                          <p className="text-sm font-semibold text-green-300">✓ {t('wallet.lnbitsConnected')}</p>
                          <p className="text-sm text-muted-foreground mt-1">{t('settings.walletConfigured')}</p>
                        </div>
                        <Button
                          onClick={deleteLNbits}
                          variant="destructive"
                          size="sm"
                          disabled={isSaving}
                          className="w-full"
                          data-testid="button-disconnect-lnbits"
                        >
                          {t('common.disconnect')}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="lnbits-url">{t('wallet.lnbitsInstanceUrl')}</Label>
                          <Input 
                            id="lnbits-url"
                            placeholder={t('wallet.lnbitsUrlPlaceholder')}
                            value={editLnbitsUrl}
                            onChange={(e) => setEditLnbitsUrl(e.target.value)}
                            className="font-mono text-xs"
                            data-testid="input-lnbits-url"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lnbits-key">{t('wallet.lnbitsKey')}</Label>
                          <div className="flex gap-2">
                            <Input 
                              id="lnbits-key"
                              placeholder={t('wallet.lnbitsKey')}
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
                          {t('wallet.testConnection')}
                        </Button>
                        <Button 
                          onClick={saveLNbits}
                          className="w-full bg-primary hover:bg-primary/90"
                          disabled={isSaving || !editLnbitsUrl || !editLnbitsAdminKey}
                          data-testid="button-save-lnbits"
                        >
                          {isSaving ? t('common.saving') : `LNbits ${t('common.connect')}`}
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
                          <p className="text-sm font-semibold text-green-300">{t('wallet.nwcConnected')}</p>
                          <p className="text-sm text-muted-foreground mt-1">{t('wallet.nwcConfigured')}</p>
                        </div>
                        <Button
                          onClick={deleteNwc}
                          variant="destructive"
                          size="sm"
                          disabled={isSaving}
                          className="w-full"
                          data-testid="button-delete-nwc"
                        >
                          {t('wallet.disconnectNwc')}
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
                            {t('wallet.getConnectionString')}
                          </p>
                        </div>
                        <Button 
                          onClick={saveNwc}
                          disabled={isSaving || !editNwcConnectionString || !editNwcConnectionString.startsWith("nostr+walletconnect://")}
                          className="w-full bg-cyan-600 hover:bg-cyan-600/90"
                          data-testid="button-setup-nwc"
                        >
                          {isSaving ? t('common.saving') : `NWC ${t('common.connect')}`}
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

          {activeTab === "dataManagement" && (
            <DataManagementContent user={user} setUser={setUser} onClose={onClose} />
          )}
        </CardContent>
        
        <CardFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={onClose}
            data-testid="button-cancel-settings"
          >
            {t('common.close')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function ParentEventsList({ events, onDeleteEvent }: any) {
  const { t } = useTranslation();
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
    const interval = setInterval(fetchRsvps, 30000); // Auto-refresh every 30 seconds
    return () => clearInterval(interval);
  }, [events]);

  return (
    <div className="grid gap-4">
      {events.length === 0 ? (
        <Card className="border-dashed border-border p-8 text-center">
          <p className="text-muted-foreground">{t('dashboard.noEventsPlanned')}</p>
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
                        📋 {t('calendar.rsvps')} ({rsvps.length})
                      </h4>
                      {rsvps.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">{t('calendar.noRsvps')}</p>
                      ) : (
                        <div className="space-y-2">
                          {accepted.length > 0 && (
                            <div className="bg-green-500/10 border border-green-500/30 rounded p-2">
                              <p className="text-xs text-green-400 font-medium" data-testid={`text-rsvp-accepted-${event.id}`}>
                                ✓ {t('common.accepted')} ({accepted.length}):
                              </p>
                              <p className="text-xs text-green-300 ml-4">
                                {accepted.map(r => r.childName).join(", ")}
                              </p>
                            </div>
                          )}
                          {declined.length > 0 && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
                              <p className="text-xs text-red-400 font-medium" data-testid={`text-rsvp-declined-${event.id}`}>
                                ✗ {t('common.declined')} ({declined.length}):
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

function ParentDashboard({ user, setUser, tasks, events, newTask, setNewTask, newEvent, setNewEvent, currentView, setCurrentView, onCreate, onCreateEvent, onApprove, onDelete, onDeleteEvent, approvingTaskId, queryClient, layoutView, setLayoutView, showSpendingStats, setShowSpendingStats, spendingStats, setSpendingStats, messages, setMessages, newMessage, setNewMessage, isLoadingMessage, setIsLoadingMessage, allowances, parentChildren, allowanceChildId, setAllowanceChildId, allowanceSats, setAllowanceSats, allowanceFrequency, setAllowanceFrequency, isCreatingAllowance, handleCreateAllowance, handleDeleteAllowance, shoppingListItems }: any) {
  const { t } = useTranslation();
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
  const [rsvps, setRsvps] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});

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
      toast({ title: t('wallet.lnbitsConnected'), description: t('wallet.lnbitsActive') });
    } catch (error) {
      toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
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
      toast({ title: t('wallet.nwcConnected'), description: t('wallet.nwcActive') });
    } catch (error) {
      toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
    }
  };

  const deleteNwc = async () => {
    try {
      const res = await fetch("/api/wallet/nwc", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerId: user.id }),
      });
      if (!res.ok) throw new Error(t('wallet.disconnectError'));
      setUser({ ...user, hasNwcConfigured: false, walletType: user.hasLnbitsConfigured ? "lnbits" : null });
      toast({ title: t('wallet.nwcDisconnected'), description: t('wallet.nwcRemoved') });
    } catch (error) {
      toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
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
      toast({ title: t('wallet.walletSwitched'), description: `${walletType === "nwc" ? "NWC" : "LNbits"} ${t('wallet.walletNowActive')}` });
    } catch (error) {
      toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
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
      toast({ title: t('wallet.lightningAddressSaved'), description: t('dashboard.receiveSatsDirect') });
    } catch (error) {
      toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
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
      refetchInterval: 30000
    });

    const handleShowSpendingStats = async () => {
      try {
        const res = await fetch(`/api/parent/${user.id}/spending-by-child/${user.connectionId}`);
        if (!res.ok) throw new Error("Failed to fetch spending stats");
        const data = await res.json();
        setSpendingStats(data);
        setShowSpendingStats(true);
      } catch (error) {
        toast({ title: t('common.error'), description: t('dashboard.failedToLoadSpending'), variant: "destructive" });
      }
    };
    
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-foreground">{t('nav.dashboard')}</h1>
        
        {user.role === "parent" && (
          <div 
            onClick={() => setCurrentView("allowance-payout")}
            data-testid="card-active-allowances"
            className="p-6 bg-gradient-to-br from-violet-500/30 to-cyan-500/30 backdrop-blur-md border border-white/50 dark:border-white/20 rounded-2xl cursor-pointer hover:bg-white/5 dark:bg-black/105 transition-all shadow-xl overflow-hidden relative"
          >
            <div className="text-center relative z-10">
              <div className="text-2xl font-bold text-foreground">{t('family.allowances')}</div>
              <div className="text-sm text-foreground mt-1">{t('dashboard.paymentsAndScheduled')}</div>
            </div>
          </div>
        )}
        
        {showConnectionCode && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}>
            <div className="bg-white/5 dark:bg-black/30 backdrop-blur-xl border border-white/50 dark:border-white/20 rounded-2xl p-5 shadow-xl">
              <div className="flex flex-row items-start justify-between pb-3">
                <div className="flex-1">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
                    <LinkIcon className="h-5 w-5 text-violet-600" /> {t('dashboard.connectionCodeTitle')}
                  </h3>
                  <p className="text-sm text-foreground">{t('dashboard.connectionCodeDesc')}</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={hideConnectionCode}
                  className="ml-2 text-foreground"
                  data-testid="button-hide-connection-code"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="bg-white/30 dark:bg-black/30 border border-white/40 dark:border-white/20 rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-widest">{t('dashboard.yourCode')}</p>
                <p className="text-3xl font-mono font-bold text-violet-700 tracking-wider break-words word-break mb-3" data-testid="text-connection-code">
                  {user.connectionId}
                </p>
                <p className="text-xs text-muted-foreground">{t('dashboard.findCodeInSettings')}</p>
              </div>
            </div>
          </motion.div>
        )}
        
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative overflow-hidden rounded-2xl bg-white/5 dark:bg-black/30 backdrop-blur-xl border border-white/50 dark:border-white/20 p-8 cursor-pointer hover:bg-white/5 dark:bg-black/105 transition-colors shadow-xl"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleShowSpendingStats();
          }}
        >
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex-1">
                <p className="text-foreground font-mono text-sm uppercase tracking-widest mb-2">{t('wallet.spent')}</p>
                <h2 className="text-5xl font-mono font-bold flex items-center gap-3 text-cyan-600" data-testid="text-sats-spent">
                  {(satsSpent || 0).toLocaleString()} <span className="text-2xl opacity-70 text-foreground">SATS</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-2">{t('dashboard.clickForBreakdown')}</p>
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
                  className="bg-white/5 dark:bg-black/30 backdrop-blur-xl border border-white/50 dark:border-white/20 rounded-2xl cursor-pointer hover:bg-white/5 dark:bg-black/105 transition-colors h-full shadow-lg p-6"
                  onClick={() => setCurrentView("tasks-open")}
                  data-testid="card-open-tasks"
                >
                  <div className="text-center">
                    <div className="text-3xl font-bold text-violet-600">{openTasks.length}</div>
                    <p className="text-sm text-foreground mt-2">{t('dashboard.openTasks')}</p>
                  </div>
                </div>,
                index * 0.1
              );
            } else if (cardId === "tasks-pending") {
              return createDraggableCard(
                cardId,
                <div 
                  className="bg-white/5 dark:bg-black/30 backdrop-blur-xl border border-white/50 dark:border-white/20 rounded-2xl cursor-pointer hover:bg-white/5 dark:bg-black/105 transition-colors h-full shadow-lg p-6"
                  onClick={() => setCurrentView("tasks-pending")}
                  data-testid="card-submitted-tasks"
                >
                  <div className="text-center">
                    <div className="text-3xl font-bold text-amber-500">{submittedTasks.length}</div>
                    <p className="text-sm text-foreground mt-2">{t('dashboard.pendingApproval')}</p>
                  </div>
                </div>,
                index * 0.1
              );
            } else if (cardId === "tasks-completed") {
              return createDraggableCard(
                cardId,
                <div 
                  className="bg-white/5 dark:bg-black/30 backdrop-blur-xl border border-white/50 dark:border-white/20 rounded-2xl cursor-pointer hover:bg-white/5 dark:bg-black/105 transition-colors h-full shadow-lg p-6"
                  onClick={() => setCurrentView("tasks-completed")}
                  data-testid="card-completed-tasks"
                >
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-500">{completedTasks.length}</div>
                    <p className="text-sm text-foreground mt-2">{t('dashboard.completedTasks')}</p>
                  </div>
                </div>,
                index * 0.1
              );
            } else if (cardId === "wallet-balance") {
              if (user.role !== "parent") return null;
              return createDraggableCard(
                cardId,
                <div className={`bg-white/5 dark:bg-black/30 backdrop-blur-xl border border-white/50 dark:border-white/20 rounded-2xl ${displayBalance !== null ? "hover:bg-white/5 dark:bg-black/105" : "opacity-60"} transition-colors h-full shadow-lg p-6`}>
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
                      <p className="text-sm text-foreground mt-2">{walletLabel}</p>
                    </div>
                  </div>
                </div>,
                index * 0.1
              );
            }
          })}
          
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} className="col-span-full">
            <div className="bg-white/5 dark:bg-black/30 backdrop-blur-xl border border-white/50 dark:border-white/20 rounded-2xl cursor-pointer hover:bg-white/5 dark:bg-black/105 transition-colors shadow-lg p-4" onClick={() => setCurrentView("calendar-view")} data-testid="card-calendar">
                <h3 className="text-sm font-bold mb-2 flex items-center gap-1 text-foreground">
                  <Calendar className="h-4 w-4 text-violet-600" /> {t('nav.calendar')}
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
                      .dark .rdp-head_cell {
                        color: rgb(200, 214, 229);
                      }
                      .rdp-cell {
                        color: rgb(51, 65, 85);
                        padding: 0;
                      }
                      .dark .rdp-cell {
                        color: rgb(226, 232, 240);
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
                      .dark .rdp-day {
                        color: rgb(226, 232, 240);
                      }
                      .rdp-day_selected {
                        background-color: rgb(124, 58, 237);
                        color: white;
                      }
                      .dark .rdp-day_selected {
                        background-color: rgb(168, 85, 247);
                        color: white;
                      }
                      .rdp-day_today {
                        color: rgb(124, 58, 237);
                        font-weight: bold;
                      }
                      .dark .rdp-day_today {
                        color: rgb(217, 119, 255);
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
                      .dark .rdp-caption {
                        color: rgb(226, 232, 240);
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
                      .dark .rdp-nav_button {
                        color: rgb(148, 163, 184);
                      }
                    `}</style>
                    <DayPicker
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      formatters={{
                        formatWeekdayName: (day) => t(`calendar.weekdaysShort.${day.getDay()}`),
                        formatCaption: (date) => `${t(`calendar.months.${date.getMonth()}`)} ${date.getFullYear()}`
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
                        <p className="text-xs text-muted-foreground text-center py-1">{t('dashboard.noEvents')}</p>
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
              <DialogTitle>{t('dashboard.spendingPerChild')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {spendingStats.length === 0 ? (
                <p className="text-muted-foreground text-center py-6">{t('dashboard.noSpendingsRecorded')}</p>
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
      const interval = setInterval(fetchMessages, 10000);
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
        toast({ title: t('common.error'), description: t('errors.messageSendFailed'), variant: "destructive" });
      } finally {
        setIsLoadingMessage(false);
      }
    };
    
    return (
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold mb-8 bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">Familienchat</h1>
        <div className="bg-white/10 dark:bg-black/20 backdrop-blur-xl border border-white/20 rounded-2xl shadow-xl">
          <div className="p-6">
            <div className="space-y-4">
              <div className="h-96 overflow-y-auto bg-black/20 backdrop-blur-sm rounded-xl p-4 space-y-3 border border-white/10">
                {messages.length === 0 ? (
                  <p className="text-white/60 text-center py-8">{t('chat.noMessages')}</p>
                ) : (
                  messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.fromPeerId === user.id ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-xs rounded-xl px-4 py-2 ${
                          msg.fromPeerId === user.id
                            ? "bg-gradient-to-r from-violet-500 to-cyan-500 text-white"
                            : "bg-white/15 dark:bg-black/20 backdrop-blur-sm border border-white/20 text-white"
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
                  placeholder={t('chat.placeholder')}
                  disabled={isLoadingMessage}
                  className="flex-1 bg-white/10 dark:bg-black/20 border-white/20 text-white placeholder:text-white/50"
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
      refetchInterval: 30000
    });

    const children = connectedPeers.filter((p: any) => p.role === "child");

    const handleUnlinkChild = async (childId: number, childName: string) => {
      if (!window.confirm(t('family.confirmRemoveChild', { name: childName }))) return;
      
      try {
        const res = await fetch("/api/peers/unlink", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ childId })
        });
        if (!res.ok) throw new Error("Failed to unlink");
        queryClient.invalidateQueries({ queryKey: ["peers", user.connectionId] });
        toast({ title: t('common.success'), description: t('family.childUnlinked', { name: childName }) });
      } catch (error) {
        toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
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
                        {child.lightningAddress ? `⚡ ${child.lightningAddress}` : `⚠️ ${t('wallet.noLightningAddress')}`}
                      </p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {child.lightningAddress && (
                          <Badge variant="secondary" className="text-xs">✓ {t('wallet.lightningConfigured')}</Badge>
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
            <p className="text-muted-foreground font-semibold">{t('dashboard.noChildrenConnected')}</p>
            <p className="text-xs text-muted-foreground mt-2">{t('family.shareConnectionCode')}</p>
          </Card>
        )}
      </div>
    );
  }

  if (currentView === "children-overview" && user.role === "parent") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('sidebar.childrenOverview')}</h1>
          <p className="text-foreground text-sm mt-2">{t('family.childrenOverviewDesc')}</p>
        </div>

        {parentChildren.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {parentChildren.map((child: any) => {
              const childTasks = tasks.filter((t: Task) => t.assignedTo === child.id);
              const openTasks = childTasks.filter((t: Task) => t.status === "open");
              const submittedTasks = childTasks.filter((t: Task) => t.status === "submitted");
              const approvedTasks = childTasks.filter((t: Task) => t.status === "approved");
              const totalSatsEarned = approvedTasks.reduce((sum: number, t: Task) => sum + t.sats, 0);
              
              const { data: childLearningProgress = null } = useQuery({
                queryKey: ["learning-progress", child.id],
                queryFn: async () => {
                  const res = await fetch(`/api/learning-progress/${child.id}`);
                  if (!res.ok) return null;
                  return res.json();
                },
                refetchInterval: 30000
              });
              
              return (
                <motion.div
                  key={child.id}
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-gradient-to-br from-violet-500/20 to-cyan-500/20 backdrop-blur-md border border-white/50 dark:border-white/20 rounded-2xl p-5 shadow-xl hover:shadow-2xl transition-all"
                  data-testid={`card-child-${child.id}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-white flex items-center justify-center font-bold text-lg">
                        {child.name[0].toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-foreground">{child.name}</h3>
                        <p className="text-xs text-muted-foreground">Kind</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-amber-600">{child.balance || 0}</p>
                      <p className="text-xs text-muted-foreground">Sats</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white/30 dark:bg-black/30 rounded-lg p-2">
                        <p className="text-lg font-bold text-foreground">{openTasks.length}</p>
                        <p className="text-xs text-muted-foreground">Offen</p>
                      </div>
                      <div className="bg-white/30 dark:bg-black/30 rounded-lg p-2">
                        <p className="text-lg font-bold text-orange-600">{submittedTasks.length}</p>
                        <p className="text-xs text-muted-foreground">Eingereicht</p>
                      </div>
                      <div className="bg-white/30 dark:bg-black/30 rounded-lg p-2">
                        <p className="text-lg font-bold text-green-600">{approvedTasks.length}</p>
                        <p className="text-xs text-muted-foreground">Vollendet</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/30 dark:border-white/10 text-sm text-muted-foreground">
                      <p>💰 {t('dashboard.earned')}: {totalSatsEarned} Sats</p>
                    </div>

                    {childLearningProgress && (
                      <div className="pt-2 border-t border-white/30 dark:border-white/10">
                        <p className="text-xs font-bold text-violet-600 mb-2">📚 Bitcoin Learning</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-violet-500/30 rounded p-2">
                            <p className="text-sm font-bold text-violet-900">{childLearningProgress.xp}</p>
                            <p className="text-xs text-violet-700">XP</p>
                          </div>
                          <div className="bg-cyan-500/30 rounded p-2">
                            <p className="text-sm font-bold text-cyan-900">Level {childLearningProgress.level}</p>
                            <p className="text-xs text-cyan-700">🏆</p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Streak: {childLearningProgress.streak} 🔥</p>
                      </div>
                    )}

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
                        {t('family.allowance')}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="flex-1"
                        onClick={() => setCurrentView("tasks")}
                        data-testid={`button-tasks-${child.id}`}
                      >
                        {t('dashboard.tasks')}
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
            <h3 className="text-lg font-semibold text-foreground mb-2">{t('dashboard.noChildrenConnected')}</h3>
            <p className="text-muted-foreground text-sm">{t('family.shareConnectionCode')}</p>
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

    const weekdays = [t('calendar.weekdays.0'), t('calendar.weekdays.1'), t('calendar.weekdays.2'), t('calendar.weekdays.3'), t('calendar.weekdays.4'), t('calendar.weekdays.5'), t('calendar.weekdays.6')];

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
        toast({ title: t('tasks.recurringCreated'), description: `${newRecurring.frequency === 'weekly' ? t('tasks.weekly') : newRecurring.frequency === 'daily' ? t('tasks.daily') : t('tasks.monthly')} ${t('tasks.recurringCreatedDesc')}` });
        setNewRecurring({ title: "", description: "", sats: "", frequency: "weekly", dayOfWeek: 3, time: "09:00" });
      } catch (error) {
        toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
      }
    };

    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('tasks.recurringTasks')}</h1>
          <p className="text-foreground text-sm mt-2">{t('tasks.recurringDescription')}</p>
        </div>

        <Card className="bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-white/50 dark:border-white/20 p-6">
          <h3 className="font-bold mb-4">{t('tasks.newRecurringTask')}</h3>
          <div className="space-y-3">
            <Input placeholder={t('tasks.taskTitlePlaceholder')} value={newRecurring.title} onChange={(e) => setNewRecurring({ ...newRecurring, title: e.target.value })} data-testid="input-recurring-title" />
            <Input placeholder={t('tasks.description')} value={newRecurring.description} onChange={(e) => setNewRecurring({ ...newRecurring, description: e.target.value })} data-testid="input-recurring-desc" />
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" placeholder={t('tasks.amount')} value={newRecurring.sats} onChange={(e) => setNewRecurring({ ...newRecurring, sats: e.target.value })} data-testid="input-recurring-sats" />
              <Select value={newRecurring.frequency} onValueChange={(v) => setNewRecurring({ ...newRecurring, frequency: v })}>
                <SelectTrigger data-testid="select-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">{t('common.daily')}</SelectItem>
                  <SelectItem value="weekly">{t('common.weekly')}</SelectItem>
                  <SelectItem value="monthly">{t('common.monthly')}</SelectItem>
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
            <Button onClick={handleCreateRecurring} className="w-full bg-violet-600 hover:bg-violet-700" data-testid="button-create-recurring">{t('common.create')}</Button>
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
                  <p className="text-sm text-muted-foreground mt-1">
                    {task.frequency === 'weekly' && weekdays[task.dayOfWeek]} 
                    {task.frequency === 'daily' && t('common.daily')}
                    {task.frequency === 'monthly' && `Monatlich am ${task.dayOfMonth || 'Tag'}`}
                    • {task.time}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => {
                  fetch(`/api/recurring-tasks/${task.id}`, { method: "DELETE" });
                  queryClient.invalidateQueries({ queryKey: ["recurring-tasks"] });
                }} data-testid={`button-delete-recurring-${task.id}`}>✕</Button>
              </div>
            </Card>
          )) : <p className="text-muted-foreground" data-testid="text-no-recurring">{t('tasks.noRecurringTasks')}</p>}
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
      refetchInterval: 30000
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
        <p className="text-muted-foreground mb-6">{t('leaderboard.description')}</p>
        
        {leaderboard.length === 0 ? (
          <Card className="border-dashed border-border p-8 text-center">
            <Trophy className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{t('leaderboard.noChildrenYet')}</p>
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
                        {entry.completedTasks} {entry.completedTasks !== 1 ? t('leaderboard.tasksCompletedPlural') : t('leaderboard.tasksCompleted')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary" data-testid={`text-leaderboard-sats-${entry.id}`}>
                        {entry.satsEarned}
                      </p>
                      <p className="text-xs text-muted-foreground">{t('leaderboard.satsEarned')}</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('leaderboard.currentBalance')}</span>
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

  if (currentView === "donate") {
    return <DonateView user={user} onClose={() => setCurrentView("dashboard")} />;
  }

  if (currentView === "nostr") {
    // For children: only show Lightning Address
    if (user.role === "child") {
      return (
        <div className="max-w-4xl">
          <h1 className="text-3xl font-bold mb-8">{t('settings.walletSettings')}</h1>
          <Card className="border-2 border-primary/40 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bitcoin className="h-5 w-5 text-primary" /> {t('wallet.lightningAddress')}
              </CardTitle>
              <CardDescription>{t('dashboard.receiveSatsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lightning-address">{t('wallet.lightningAddress')}</Label>
                <Input 
                  id="lightning-address"
                  placeholder="name@example.com"
                  value={lightningAddress}
                  onChange={(e) => setLightningAddress(e.target.value)}
                  className="font-mono text-xs"
                  data-testid="input-lightning-address"
                />
                <p className="text-xs text-muted-foreground">
                  {t('wallet.formatExample')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('common.status')}: {user.lightningAddress ? "✓ " + t('common.configured') : "✗ " + t('common.notConfigured')}
                </p>
              </div>
              <Button 
                onClick={setupLightningAddress}
                className="bg-primary hover:bg-primary/90"
                data-testid="button-setup-lightning-address"
              >
                {t('common.save')}
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    // For parents: show all tabs
    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">{t('settings.walletSettings')}</h1>
        <Tabs defaultValue="verbindung" className="w-full">
          <TabsList className="bg-secondary p-1 border border-border mb-6">
            <TabsTrigger value="verbindung">{t('wallet.connection')}</TabsTrigger>
            <TabsTrigger value="lnbits">LNbits</TabsTrigger>
            <TabsTrigger value="nwc">NWC</TabsTrigger>
            <TabsTrigger value="donation">{t('wallet.donationLink')}</TabsTrigger>
          </TabsList>

          <TabsContent value="verbindung">
            <Card>
              <CardHeader>
                <CardTitle>{t('wallet.connectionCodeTitle')}</CardTitle>
                <CardDescription>{t('wallet.shareCodeWithChildren')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-secondary border-2 border-primary/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-2 uppercase tracking-widest">Code:</p>
                  <p className="text-3xl font-mono font-bold text-primary tracking-wider break-words word-break" data-testid="text-connection-code-settings">
                    {user.connectionId}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground bg-blue-500/10 border border-blue-500/30 rounded p-3">
                  💡 {t('wallet.connectionCodeTip')}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lnbits">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('wallet.lnbitsWallet')}</CardTitle>
                  <CardDescription>{t('wallet.lnbitsDescription')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="lnbits-url">{t('wallet.lnbitsServerUrl')}</Label>
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
                    <Label htmlFor="lnbits-key">{t('wallet.lnbitsKey')}</Label>
                    <Input 
                      id="lnbits-key"
                      placeholder={t('wallet.adminKeyPlaceholder')}
                      type="password"
                      value={lnbitsAdminKey}
                      onChange={(e) => setLnbitsAdminKey(e.target.value)}
                      className="font-mono text-xs"
                      data-testid="input-lnbits-key"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('common.status')}: {user.hasLnbitsConfigured ? "✓ " + t('common.connected') : "✗ " + t('common.notConnected')}
                    </p>
                  </div>
                  <Button 
                    onClick={setupLNbits}
                    disabled={!lnbitsUrl || !lnbitsAdminKey}
                    className="bg-primary hover:bg-primary/90 w-full"
                    data-testid="button-setup-lnbits-settings"
                  >
                    {t('common.save')}
                  </Button>
                  {user.hasLnbitsConfigured && user.hasNwcConfigured && (
                    <Button 
                      onClick={() => setActiveWallet("lnbits")}
                      variant={user.walletType === "lnbits" ? "default" : "outline"}
                      className="w-full mt-2"
                      data-testid="button-set-active-lnbits"
                    >
                      {user.walletType === "lnbits" ? t('common.active') : t('common.setAsActive')}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="donation">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('wallet.donationLink')}</CardTitle>
                  <CardDescription>{t('wallet.receiveDonations')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="donation-addr">{t('wallet.donationAddress')}</Label>
                    <Input 
                      id="donation-addr"
                      placeholder={t('wallet.lightningAddressPlaceholder')}
                      value={user.donationAddress || ""}
                      onChange={(e) => setUser({ ...user, donationAddress: e.target.value })}
                      className="font-mono text-sm"
                      data-testid="input-donation-address"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('wallet.enterDonationAddress')}
                    </p>
                  </div>
                  <Button 
                    onClick={async () => {
                      if (!user.donationAddress) {
                        useToast()({ title: t('common.error'), description: t('donation.addressRequired'), variant: "destructive" });
                        return;
                      }
                      try {
                        const res = await fetch("/api/donation/set-address", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ peerId: user.id, donationAddress: user.donationAddress })
                        });
                        const data = await res.json();
                        if (res.ok) {
                          useToast()({ title: t('common.success'), description: t('donation.savedSuccess') });
                        }
                      } catch (error) {
                        useToast()({ title: t('common.error'), description: t('donation.saveError'), variant: "destructive" });
                      }
                    }}
                    className="bg-primary hover:bg-primary/90 w-full"
                    data-testid="button-save-donation-address"
                  >
                    {t('common.save')}
                  </Button>
                  {user.donationAddress && (
                    <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg space-y-2">
                      <p className="text-xs font-semibold text-primary">{t('wallet.yourDonationLink')}:</p>
                      <code className="text-xs break-all text-muted-foreground font-mono">
                        lightning:{user.donationAddress}
                      </code>
                      <Button 
                        onClick={() => {
                          navigator.clipboard.writeText(`lightning:${user.donationAddress}`);
                          useToast()({ title: t('donation.copied'), description: t('donation.copiedDesc') });
                        }}
                        size="sm"
                        variant="outline"
                        className="w-full"
                        data-testid="button-copy-donation-link"
                      >
                        <Copy className="h-4 w-4 mr-2" /> {t('wallet.copyDonationLink')}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="nwc">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('wallet.nwcTitle')}</CardTitle>
                  <CardDescription>{t('wallet.nwcDescription')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {user.hasNwcConfigured ? (
                    <div className="space-y-4">
                      <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <p className="text-sm font-semibold text-green-300">{t('wallet.nwcConnected')}</p>
                        <p className="text-xs text-muted-foreground mt-1">{t('wallet.nwcConfigured')}</p>
                      </div>
                      <Button 
                        onClick={deleteNwc}
                        variant="destructive"
                        className="w-full"
                        data-testid="button-delete-nwc"
                      >
                        {t('wallet.disconnectNwc')}
                      </Button>
                      {user.hasLnbitsConfigured && (
                        <Button 
                          onClick={() => setActiveWallet("nwc")}
                          variant={user.walletType === "nwc" ? "default" : "outline"}
                          className="w-full"
                          data-testid="button-set-active-nwc"
                        >
                          {user.walletType === "nwc" ? t('common.active') : t('common.setAsActive')}
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
                          {t('wallet.getConnectionString')}
                        </p>
                      </div>
                      <Button 
                        onClick={setupNwc}
                        disabled={!nwcConnectionString || !nwcConnectionString.startsWith("nostr+walletconnect://")}
                        className="bg-primary hover:bg-primary/90 w-full"
                        data-testid="button-setup-nwc"
                      >
                        {t('wallet.connectNwc')}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
              <Card className="bg-secondary/30">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">
                    <strong>{t('wallet.whatIsNwc')}</strong> {t('wallet.nwcExplanation')}
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
        <h1 className="text-3xl font-bold mb-8">{t('tasks.openTasks')}</h1>
        <section>
          <div className="space-y-4">
            {tasks.filter((t: Task) => t.status === "open" || t.status === "assigned").length === 0 ? (
              <Card className="border-dashed border-border p-8 text-center">
                <p className="text-muted-foreground">{t('tasks.noOpenTasks')}</p>
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
                    <Trash2 className="mr-2 h-4 w-4" /> {t('common.delete')}
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
        <h1 className="text-3xl font-bold mb-8">{t('dashboard.pendingApproval')}</h1>
        <section>
          <div className="space-y-4">
            {tasks.filter((t: Task) => t.status === "submitted").length === 0 ? (
              <Card className="border-dashed border-border p-8 text-center">
                <p className="text-muted-foreground">{t('tasks.noTasksForApproval')}</p>
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
                        <Trash2 className="mr-2 h-4 w-4" /> {t('common.delete')}
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
      refetchInterval: 30000
    });

    const getChildName = (childId?: number) => {
      if (!childId) return t('common.unknown');
      const child = connectedPeers.find((p: any) => p.id === childId);
      return child?.name || t('common.unknown');
    };

    const completedTasks = tasks.filter((t: Task) => t.status === "approved");

    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold mb-8">{t('tasks.completedTasks')}</h1>
        <section>
          <div className="space-y-4">
            {completedTasks.length === 0 ? (
              <Card className="border-dashed border-border p-8 text-center">
                <p className="text-muted-foreground">{t('tasks.noCompletedTasks')}</p>
              </Card>
            ) : (
              completedTasks.map((task: Task) => (
                <TaskCard key={task.id} task={task} variant="parent">
                  <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-green-500/10 border border-green-500/30 w-fit">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-xs font-semibold text-green-300">{t('dashboard.completedBy')}: {getChildName(task.assignedTo)}</span>
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
          <h1 className="text-3xl font-bold mb-8">{t('tasks.createNewTask')}</h1>
          <motion.section initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            <Card className="border-2 border-amber-500/40 bg-amber-500/5 shadow-lg overflow-hidden">
              <CardContent className="pt-8">
                <div className="text-center space-y-4">
                  <div className="text-4xl">⚡</div>
                  <h2 className="text-xl font-bold text-amber-300">{t('wallet.connectionRequired')}</h2>
                  <p className="text-sm text-amber-200/80 max-w-md mx-auto">
                    {t('dashboard.walletSetupRequired')}
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
        <h1 className="text-3xl font-bold mb-8">{t('tasks.createNewTask')}</h1>
        <motion.section initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <Card className="border border-primary/20 shadow-[0_0_30px_-10px_rgba(247,147,26,0.15)] bg-card/50 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary via-accent to-primary" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary" data-testid="text-create-task">
                <Plus className="h-5 w-5" /> {t('tasks.createNewTask')}
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
                  <Label htmlFor="title">{t('tasks.taskTitle')}</Label>
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

                {/* Pflicht-Aufgabe Toggle */}
                <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <Switch 
                    id="is-required"
                    checked={newTask.isRequired}
                    onCheckedChange={(checked) => setNewTask({ ...newTask, isRequired: checked })}
                    data-testid="toggle-required-task"
                  />
                  <Label htmlFor="is-required" className="cursor-pointer">{t('tasks.requiredTask')}</Label>
                </div>

                {/* Sofort Freischalten Toggle (für bezahlte Aufgaben) */}
                {!newTask.isRequired && (
                  <div className="flex items-center gap-3 p-3 bg-accent/10 rounded-lg border border-accent/30">
                    <Switch 
                      id="bypass-ratio"
                      checked={newTask.bypassRatio}
                      onCheckedChange={(checked) => setNewTask({ ...newTask, bypassRatio: checked })}
                      data-testid="toggle-bypass-ratio"
                    />
                    <Label htmlFor="bypass-ratio" className="cursor-pointer flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      {t('tasks.bypassRatio')}
                    </Label>
                  </div>
                )}

                {/* Konditionale Sats-Eingabe */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sats" className="flex items-center gap-1">
                      <Bitcoin className="h-4 w-4 text-primary" /> {newTask.isRequired ? t('tasks.noReward') : t('tasks.reward')}
                    </Label>
                    {!newTask.isRequired && (
                      <span className={`text-xs font-semibold ${isBalanceInsufficient ? "text-red-400" : "text-emerald-400"}`}>
                        ⚡ {availableBalance > 0 ? availableBalance.toLocaleString("de-DE", { maximumFractionDigits: 0 }) : "---"} Sats
                      </span>
                    )}
                  </div>
                  <Input 
                    id="sats"
                    type="number" 
                    placeholder="50" 
                    value={newTask.isRequired ? 0 : newTask.sats}
                    onChange={(e) => !newTask.isRequired && setNewTask({ ...newTask, sats: parseInt(e.target.value) || 0 })}
                    disabled={newTask.isRequired}
                    className={`font-mono bg-secondary focus:border-primary transition-colors ${
                      newTask.isRequired
                        ? "opacity-50 cursor-not-allowed"
                        : isBalanceInsufficient 
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
                        <p className="text-xs font-semibold text-red-300">{t('common.insufficientBalance')}</p>
                        <p className="text-xs text-red-200/70">{t('tasks.needMoreSats', { amount: Math.ceil(newTask.sats - availableBalance) })}</p>
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
                  {isBalanceInsufficient ? t('common.insufficientBalance') : t('common.create')}
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
        <h1 className="text-3xl font-bold mb-8">{t('calendar.createNewEvent')}</h1>
        <motion.section initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <Card className="border border-primary/20 shadow-[0_0_30px_-10px_rgba(247,147,26,0.15)] bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Plus className="h-5 w-5" /> {t('calendar.newFamilyEvent')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onCreateEvent} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="event-title">{t('calendar.event')}</Label>
                  <Input 
                    id="event-title"
                    placeholder={t('calendar.eventPlaceholder')} 
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    className="bg-secondary border-border"
                    data-testid="input-event-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-description">{t('calendar.description')}</Label>
                  <Input 
                    id="event-description"
                    placeholder={t('calendar.detailsPlaceholder')} 
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    className="bg-secondary border-border"
                    data-testid="input-event-description"
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="event-start-date">📅 {t('calendar.startDate')}</Label>
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
                    <Label htmlFor="event-end-date">📅 {t('calendar.endDateOptional')}</Label>
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
                    <MapPin className="h-4 w-4" /> {t('calendar.locationOptional')}
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
                  {t('calendar.addEvent')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.section>
      </div>
    );
  }

  if (currentView === "calendar-view") {
    const [eventRsvps, setEventRsvps] = useState<Record<number, any[]>>({});
    
    useEffect(() => {
      const fetchAllRsvps = async () => {
        const rsvpsData: Record<number, any[]> = {};
        for (const event of events) {
          try {
            const res = await fetch(`/api/events/${event.id}/rsvps`);
            if (res.ok) {
              rsvpsData[event.id] = await res.json();
              const myRsvp = rsvpsData[event.id].find((r: any) => r.peerId === user.id);
              if (myRsvp) {
                setRsvps(prev => ({ ...prev, [event.id]: myRsvp.response }));
              }
            }
          } catch (error) {
            console.error(`Failed to fetch RSVPs for event ${event.id}`, error);
          }
        }
        setEventRsvps(rsvpsData);
      };
      if (events.length > 0) fetchAllRsvps();
    }, [events, user.id]);

    const handleRsvp = async (eventId: number, response: string) => {
      setLoading({ ...loading, [eventId]: true });
      try {
        await fetch(`/api/events/${eventId}/rsvps`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ peerId: user.id, response }),
        });
        setRsvps({ ...rsvps, [eventId]: response });
        const updated = eventRsvps[eventId] ? eventRsvps[eventId].map((r: any) => r.peerId === user.id ? { ...r, response } : r) : [];
        setEventRsvps({ ...eventRsvps, [eventId]: updated });
        toast({
          title: response === "accepted" ? t('calendar.rsvpAccepted') : t('calendar.rsvpDeclined'),
          description: response === "accepted" ? t('calendar.rsvpAcceptedDesc') : t('calendar.rsvpDeclinedDesc')
        });
      } catch (error) {
        toast({
          title: t('common.error'),
          description: t('calendar.rsvpError'),
          variant: "destructive"
        });
      } finally {
        setLoading({ ...loading, [eventId]: false });
      }
    };

    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold mb-8">{t('calendar.title')}</h1>
        <section>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Calendar className="text-primary" /> {t('dashboard.allEvents')}
          </h2>
          <div className="grid gap-4">
            {events.length === 0 ? (
              <div className="bg-white/5 dark:bg-black/30 backdrop-blur-xl border border-white/50 dark:border-white/20 rounded-2xl p-8 text-center shadow-lg">
                <p className="text-foreground">{t('dashboard.noEventsPlanned')}</p>
              </div>
            ) : (
              events.map((event: FamilyEvent) => {
                const accepted = (eventRsvps[event.id] || []).filter((r: any) => r.response === "accepted");
                const declined = (eventRsvps[event.id] || []).filter((r: any) => r.response === "declined");
                const myRsvp = rsvps[event.id];
                
                return (
                  <div key={event.id} className="bg-white/5 dark:bg-black/30 backdrop-blur-xl border border-white/50 dark:border-white/20 rounded-2xl hover:bg-white/60 transition-colors shadow-lg">
                    <div className="p-5">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-foreground" data-testid={`text-event-title-view-${event.id}`}>{event.title}</h3>
                          <p className="text-xs text-foreground mt-2 flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {new Date(event.startDate).toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                          </p>
                          <p className="text-xs text-foreground flex items-center gap-1">
                            <span>⏰</span>
                            {new Date(event.startDate).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                            {event.endDate && ` - ${new Date(event.endDate).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`}
                          </p>
                          {event.description && <p className="text-muted-foreground text-sm mt-3">{event.description}</p>}
                          {event.location && (
                            <p className="text-sm text-foreground flex items-center gap-1 mt-2">
                              <MapPin className="h-4 w-4" /> {event.location}
                            </p>
                          )}
                          
                          <div className="flex gap-2 mt-4">
                            <Button
                              onClick={() => handleRsvp(event.id, "accepted")}
                              disabled={loading[event.id] || myRsvp === "accepted"}
                              className={`flex-1 ${myRsvp === "accepted" ? "bg-green-600 hover:bg-green-700" : "bg-violet-600 hover:bg-violet-700"} text-white`}
                              data-testid={`button-accept-event-view-${event.id}`}
                            >
                              {myRsvp === "accepted" ? `✓ ${t('common.accepted')}` : t('common.accept')}
                            </Button>
                            <Button
                              onClick={() => handleRsvp(event.id, "declined")}
                              disabled={loading[event.id] || myRsvp === "declined"}
                              variant={myRsvp === "declined" ? "default" : "destructive"}
                              className={`flex-1 ${myRsvp === "declined" ? "bg-red-600 hover:bg-red-700" : ""}`}
                              data-testid={`button-decline-event-view-${event.id}`}
                            >
                              {myRsvp === "declined" ? `✗ ${t('common.declined')}` : t('common.decline')}
                            </Button>
                          </div>
                          
                          {(accepted.length > 0 || declined.length > 0) && (
                            <div className="mt-4 space-y-2 border-t border-slate-300/30 pt-3">
                              {accepted.length > 0 && (
                                <p className="text-xs text-green-700 font-semibold">✓ {t('common.accepted')}: {accepted.map((r: any) => r.childName).join(", ")}</p>
                              )}
                              {declined.length > 0 && (
                                <p className="text-xs text-red-700 font-semibold">✗ {t('common.declined')}: {declined.map((r: any) => r.childName).join(", ")}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
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
        toast({ title: t('common.error'), description: t('errors.lnbitsRequired'), variant: "destructive" });
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
        toast({ title: t('common.success'), description: t('errors.lnbitsConnected') });
      } catch (error) {
        toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
      }
    };

    const handleSetupNwc = async () => {
      if (!editNwcConnectionString || !editNwcConnectionString.startsWith("nostr+walletconnect://")) {
        toast({ title: t('common.error'), description: t('errors.nwcRequired'), variant: "destructive" });
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
        toast({ title: t('common.success'), description: t('errors.nwcConnected') });
      } catch (error) {
        toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
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
        toast({ title: t('common.disconnected'), description: t('wallet.nwcRemoved') });
      } catch (error) {
        toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
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
        toast({ title: t('wallet.walletSwitched'), description: `${walletType === "nwc" ? "NWC" : "LNbits"} ${t('wallet.walletNowActive')}` });
      } catch (error) {
        toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
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
            {t('common.back')}
          </button>
          <h1 className="text-3xl font-bold">{t('sidebar.walletSettings')}</h1>
        </div>

        <Tabs defaultValue="lnbits" className="w-full">
          <TabsList className="bg-secondary p-1 border border-border mb-6">
            <TabsTrigger value="lnbits">LNbits</TabsTrigger>
            <TabsTrigger value="nwc">NWC</TabsTrigger>
            <TabsTrigger value="donation">{t('wallet.donationLink')}</TabsTrigger>
          </TabsList>

          <TabsContent value="lnbits">
            <Card className="border-2 border-primary/40 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {t('settings.lnbitsConnection')}
                </CardTitle>
                <CardDescription>{t('settings.lnbitsConnectionDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {user.hasLnbitsConfigured ? (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg border border-green-500/30 bg-green-500/10">
                      <p className="text-sm font-semibold text-green-300">{t('wallet.lnbitsConnected')}</p>
                      <p className="text-sm text-muted-foreground mt-1">{t('settings.walletConfigured')}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setUser({ ...user, hasLnbitsConfigured: false });
                          fetch("/api/wallet/disconnect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ peerId: user.id }) });
                          toast({ title: t('common.disconnected'), description: t('wallet.lnbitsRemoved') });
                        }}
                        variant="destructive"
                        size="sm"
                        data-testid="button-disconnect-lnbits"
                      >
                        {t('common.disconnect')}
                      </Button>
                      {user.hasNwcConfigured && (
                        <Button
                          onClick={() => handleSetActiveWallet("lnbits")}
                          variant={user.walletType === "lnbits" ? "default" : "outline"}
                          size="sm"
                          data-testid="button-set-active-lnbits"
                        >
                          {user.walletType === "lnbits" ? t('common.active') : t('common.setAsActive')}
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="lnbits-url">{t('wallet.lnbitsInstanceUrl')}</Label>
                      <Input 
                        id="lnbits-url"
                        placeholder={t('wallet.lnbitsUrlPlaceholder')}
                        value={editLnbitsUrl}
                        onChange={(e) => setEditLnbitsUrl(e.target.value)}
                        className="font-mono text-xs"
                        data-testid="input-lnbits-url"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lnbits-key">{t('wallet.lnbitsKey')}</Label>
                      <div className="flex gap-2">
                        <Input 
                          id="lnbits-key"
                          placeholder={t('wallet.lnbitsKey')}
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
                <CardDescription>{t('wallet.nwcDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {user.hasNwcConfigured ? (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg border border-green-500/30 bg-green-500/10">
                      <p className="text-sm font-semibold text-green-300">{t('wallet.nwcConnected')}</p>
                      <p className="text-sm text-muted-foreground mt-1">{t('wallet.nwcConfigured')}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleDeleteNwc}
                        variant="destructive"
                        size="sm"
                        data-testid="button-delete-nwc"
                      >
                        {t('wallet.disconnectNwc')}
                      </Button>
                      {user.hasLnbitsConfigured && (
                        <Button
                          onClick={() => handleSetActiveWallet("nwc")}
                          variant={user.walletType === "nwc" ? "default" : "outline"}
                          size="sm"
                          data-testid="button-set-active-nwc"
                        >
                          {user.walletType === "nwc" ? t('common.active') : t('common.setAsActive')}
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
                        {t('wallet.getConnectionString')}
                      </p>
                    </div>
                    <Button 
                      onClick={handleSetupNwc}
                      disabled={!editNwcConnectionString || !editNwcConnectionString.startsWith("nostr+walletconnect://")}
                      className="w-full bg-cyan-600 hover:bg-cyan-600/90"
                      data-testid="button-setup-nwc"
                    >
                      {t('wallet.connectNwc')}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card className="mt-4 bg-secondary/30">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">
                  <strong>{t('wallet.whatIsNwc')}</strong> {t('wallet.nwcFullDescription')}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {user.hasLnbitsConfigured && user.hasNwcConfigured && (
          <Card className="border border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4">
              <p className="text-sm text-amber-200">
                <strong>{t('wallet.activeWallet')}:</strong> {user.walletType === "nwc" ? "NWC (Nostr Wallet Connect)" : "LNbits"}
                <br />
                <span className="text-xs text-muted-foreground">
                  {t('wallet.switchWalletHint')}
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
        toast({ title: t('common.success'), description: t('errors.levelBonusSaved') });
        queryClient.invalidateQueries({ queryKey: ["level-bonus-settings"] });
      } catch (error) {
        toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
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
            {t('common.back')}
          </button>
          <h1 className="text-3xl font-bold">🏆 {t('dashboard.levelBonusSettings')}</h1>
        </div>
        
        <Card className="border-2 border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              ⭐ {t('dashboard.activateLevelBonus')}
            </CardTitle>
            <CardDescription>
              {t('dashboard.rewardChildrenBonus')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border">
              <div>
                <p className="font-semibold">{t('common.levelBonusActivated')}</p>
                <p className="text-sm text-muted-foreground">{t('dashboard.childrenReceiveBonus')}</p>
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
                  <p className="font-semibold mb-2">🎯 {t('common.preview')}</p>
                  <p className="text-sm">
                    {t('dashboard.yourChildrenReceive')} <span className="text-amber-600 font-bold">{bonusSats} Sats</span> {t('dashboard.bonus')}
                    {t('common.atLevel')} {Array.from({length: 5}, (_, i) => (i + 1) * milestoneInterval).join(", ")}...
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
                  <div className="text-xs text-muted-foreground">{l.tasks} {t('dashboard.tasks')}</div>
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

function ChildDashboard({ user, setUser, tasks, events, newEvent, setNewEvent, currentView, setCurrentView, onAccept, onSubmit, onCreateEvent, onDeleteEvent, queryClient, layoutView, setLayoutView, messages, setMessages, newMessage, setNewMessage, isLoadingMessage, setIsLoadingMessage }: any) {
  const [showLink, setShowLink] = useState(false);
  const [parentConnectionId, setParentConnectionId] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showTrackerChart, setShowTrackerChart] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [progressLoading, setProgressLoading] = useState(true);
  const [showQuiz, setShowQuiz] = useState<string | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<Record<string, boolean>>({});
  const [expandedQuizzes, setExpandedQuizzes] = useState<Record<string, boolean>>({});
  const [expandedLevels, setExpandedLevels] = useState<Record<string, boolean>>({ beginner: true, intermediate: false, advanced: false });
  const [selectedChallenge, setSelectedChallenge] = useState<any>(null);
  const [expandedChallengeQuestion, setExpandedChallengeQuestion] = useState<number | null>(null);
  const [challengeAnswers, setChallengAnswers] = useState<Record<number, string>>({});
  const [completedChallenges, setCompletedChallenges] = useState<Record<number, number>>({});
  const [educationTab, setEducationTab] = useState<"modules" | "converter" | "challenges" | "resources" | "glossar">("modules");
  const [glossarSearch, setGlossarSearch] = useState("");
  const [satoshiInput, setSatoshiInput] = useState("100000");
  const [bitcoinInput, setBitcoinInput] = useState("0.001");
  const [euroInput, setEuroInput] = useState("50");
  const [btcPrice, setBtcPrice] = useState<number | null>(null);
  const [xp, setXp] = useState(0);
  const [rsvps, setRsvps] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});
  const [serverProgress, setServerProgress] = useState<any>(null);
  const [dailyChallenge, setDailyChallenge] = useState<any>(null);
  const [graduationStatus, setGraduationStatus] = useState<{ graduated: boolean; bonusPaid: boolean; guardianLevel: number } | null>(null);
  const [showGraduationCelebration, setShowGraduationCelebration] = useState(false);
  const { toast } = useToast();
  
  // Load learning progress from server
  useEffect(() => {
    const fetchLearningProgress = async () => {
      try {
        const response = await fetch(`/api/learning-progress/${user.id}`);
        if (response.ok) {
          const data = await response.json();
          setServerProgress(data);
          
          if (data.graduatedAt) {
            const wasNewlyGraduated = !graduationStatus?.graduated;
            setGraduationStatus({ 
              graduated: true, 
              bonusPaid: data.graduationBonusClaimed || false,
              guardianLevel: data.guardianLevel || 1
            });
            if (wasNewlyGraduated) {
              setShowGraduationCelebration(true);
            }
          }
        }
      } catch (error) {
        console.error("[Learning Progress] Failed to fetch:", error);
      } finally {
        setProgressLoading(false);
      }
    };
    fetchLearningProgress();
  }, [user.id]);
  
  // Fetch BTC price for converter
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
    if (user.role === "child") {
      fetchBtcPrice();
    }
  }, [user.role]);
  
  const { t } = useTranslation();
  
  // Fetch daily challenge - 60+ questions with deterministic selection based on date
  useEffect(() => {
    const challengePool = [
      { type: "quiz", icon: "🧠", reward: 50, questionKey: "challenges.q1", optionKeys: ["challenges.q1a", "challenges.q1b", "challenges.q1c"], correct: 0 },
      { type: "quiz", icon: "🧠", reward: 45, questionKey: "challenges.q2", optionKeys: ["challenges.q2a", "challenges.q2b", "challenges.q2c"], correct: 0 },
      { type: "quiz", icon: "⚡", reward: 48, questionKey: "challenges.q3", optionKeys: ["challenges.q3a", "challenges.q3b", "challenges.q3c"], correct: 0 },
      { type: "quiz", icon: "🔒", reward: 55, questionKey: "challenges.q4", optionKeys: ["challenges.q4a", "challenges.q4b", "challenges.q4c"], correct: 0 },
      { type: "quiz", icon: "⛓️", reward: 50, questionKey: "challenges.q5", optionKeys: ["challenges.q5a", "challenges.q5b", "challenges.q5c"], correct: 0 },
      { type: "quiz", icon: "🪙", reward: 42, questionKey: "challenges.q6", optionKeys: ["challenges.q6a", "challenges.q6b", "challenges.q6c"], correct: 0 },
      { type: "quiz", icon: "🌐", reward: 47, questionKey: "challenges.q7", optionKeys: ["challenges.q7a", "challenges.q7b", "challenges.q7c"], correct: 0 },
      { type: "quiz", icon: "🔐", reward: 53, questionKey: "challenges.q8", optionKeys: ["challenges.q8a", "challenges.q8b", "challenges.q8c"], correct: 0 },
      { type: "quiz", icon: "📈", reward: 44, questionKey: "challenges.q9", optionKeys: ["challenges.q9a", "challenges.q9b", "challenges.q9c"], correct: 0 },
      { type: "quiz", icon: "🏦", reward: 46, questionKey: "challenges.q10", optionKeys: ["challenges.q10a", "challenges.q10b", "challenges.q10c"], correct: 0 },
      { type: "quiz", icon: "💡", reward: 51, questionKey: "challenges.q11", optionKeys: ["challenges.q11a", "challenges.q11b", "challenges.q11c"], correct: 0 },
      { type: "quiz", icon: "🔋", reward: 49, questionKey: "challenges.q12", optionKeys: ["challenges.q12a", "challenges.q12b", "challenges.q12c"], correct: 0 },
      { type: "quiz", icon: "🌍", reward: 43, questionKey: "challenges.q13", optionKeys: ["challenges.q13a", "challenges.q13b", "challenges.q13c"], correct: 0 },
      { type: "quiz", icon: "📊", reward: 52, questionKey: "challenges.q14", optionKeys: ["challenges.q14a", "challenges.q14b", "challenges.q14c"], correct: 0 },
      { type: "quiz", icon: "🔑", reward: 54, questionKey: "challenges.q15", optionKeys: ["challenges.q15a", "challenges.q15b", "challenges.q15c"], correct: 0 },
      { type: "quiz", icon: "⏰", reward: 45, questionKey: "challenges.q16", optionKeys: ["challenges.q16a", "challenges.q16b", "challenges.q16c"], correct: 0 },
      { type: "quiz", icon: "🎯", reward: 48, questionKey: "challenges.q17", optionKeys: ["challenges.q17a", "challenges.q17b", "challenges.q17c"], correct: 0 },
      { type: "quiz", icon: "💰", reward: 50, questionKey: "challenges.q18", optionKeys: ["challenges.q18a", "challenges.q18b", "challenges.q18c"], correct: 0 },
      { type: "quiz", icon: "🔄", reward: 46, questionKey: "challenges.q19", optionKeys: ["challenges.q19a", "challenges.q19b", "challenges.q19c"], correct: 0 },
      { type: "quiz", icon: "📱", reward: 44, questionKey: "challenges.q20", optionKeys: ["challenges.q20a", "challenges.q20b", "challenges.q20c"], correct: 0 },
      { type: "quiz", icon: "🏆", reward: 55, questionKey: "challenges.q21", optionKeys: ["challenges.q21a", "challenges.q21b", "challenges.q21c"], correct: 0 },
      { type: "quiz", icon: "🎓", reward: 47, questionKey: "challenges.q22", optionKeys: ["challenges.q22a", "challenges.q22b", "challenges.q22c"], correct: 0 },
      { type: "quiz", icon: "🌟", reward: 49, questionKey: "challenges.q23", optionKeys: ["challenges.q23a", "challenges.q23b", "challenges.q23c"], correct: 0 },
      { type: "quiz", icon: "🛡️", reward: 53, questionKey: "challenges.q24", optionKeys: ["challenges.q24a", "challenges.q24b", "challenges.q24c"], correct: 0 },
      { type: "quiz", icon: "🔍", reward: 45, questionKey: "challenges.q25", optionKeys: ["challenges.q25a", "challenges.q25b", "challenges.q25c"], correct: 0 },
      { type: "quiz", icon: "💎", reward: 51, questionKey: "challenges.q26", optionKeys: ["challenges.q26a", "challenges.q26b", "challenges.q26c"], correct: 0 },
      { type: "quiz", icon: "🎮", reward: 42, questionKey: "challenges.q27", optionKeys: ["challenges.q27a", "challenges.q27b", "challenges.q27c"], correct: 0 },
      { type: "quiz", icon: "📖", reward: 48, questionKey: "challenges.q28", optionKeys: ["challenges.q28a", "challenges.q28b", "challenges.q28c"], correct: 0 },
      { type: "quiz", icon: "🚀", reward: 54, questionKey: "challenges.q29", optionKeys: ["challenges.q29a", "challenges.q29b", "challenges.q29c"], correct: 0 },
      { type: "quiz", icon: "🧩", reward: 46, questionKey: "challenges.q30", optionKeys: ["challenges.q30a", "challenges.q30b", "challenges.q30c"], correct: 0 },
      { type: "quiz", icon: "⚙️", reward: 50, questionKey: "challenges.q31", optionKeys: ["challenges.q31a", "challenges.q31b", "challenges.q31c"], correct: 0 },
      { type: "quiz", icon: "🎪", reward: 43, questionKey: "challenges.q32", optionKeys: ["challenges.q32a", "challenges.q32b", "challenges.q32c"], correct: 0 },
      { type: "quiz", icon: "🏠", reward: 47, questionKey: "challenges.q33", optionKeys: ["challenges.q33a", "challenges.q33b", "challenges.q33c"], correct: 0 },
      { type: "quiz", icon: "🎭", reward: 52, questionKey: "challenges.q34", optionKeys: ["challenges.q34a", "challenges.q34b", "challenges.q34c"], correct: 0 },
      { type: "quiz", icon: "🔮", reward: 49, questionKey: "challenges.q35", optionKeys: ["challenges.q35a", "challenges.q35b", "challenges.q35c"], correct: 0 },
      { type: "quiz", icon: "📡", reward: 51, questionKey: "challenges.q36", optionKeys: ["challenges.q36a", "challenges.q36b", "challenges.q36c"], correct: 0 },
      { type: "quiz", icon: "🎨", reward: 44, questionKey: "challenges.q37", optionKeys: ["challenges.q37a", "challenges.q37b", "challenges.q37c"], correct: 0 },
      { type: "quiz", icon: "🧬", reward: 53, questionKey: "challenges.q38", optionKeys: ["challenges.q38a", "challenges.q38b", "challenges.q38c"], correct: 0 },
      { type: "quiz", icon: "🔊", reward: 45, questionKey: "challenges.q39", optionKeys: ["challenges.q39a", "challenges.q39b", "challenges.q39c"], correct: 0 },
      { type: "quiz", icon: "🎵", reward: 48, questionKey: "challenges.q40", optionKeys: ["challenges.q40a", "challenges.q40b", "challenges.q40c"], correct: 0 },
      { type: "quiz", icon: "🌈", reward: 50, questionKey: "challenges.q41", optionKeys: ["challenges.q41a", "challenges.q41b", "challenges.q41c"], correct: 0 },
      { type: "quiz", icon: "⭐", reward: 46, questionKey: "challenges.q42", optionKeys: ["challenges.q42a", "challenges.q42b", "challenges.q42c"], correct: 0 },
      { type: "quiz", icon: "🎁", reward: 52, questionKey: "challenges.q43", optionKeys: ["challenges.q43a", "challenges.q43b", "challenges.q43c"], correct: 0 },
      { type: "quiz", icon: "🔗", reward: 47, questionKey: "challenges.q44", optionKeys: ["challenges.q44a", "challenges.q44b", "challenges.q44c"], correct: 0 },
      { type: "quiz", icon: "📚", reward: 49, questionKey: "challenges.q45", optionKeys: ["challenges.q45a", "challenges.q45b", "challenges.q45c"], correct: 0 },
      { type: "quiz", icon: "🏅", reward: 54, questionKey: "challenges.q46", optionKeys: ["challenges.q46a", "challenges.q46b", "challenges.q46c"], correct: 0 },
      { type: "quiz", icon: "🎲", reward: 43, questionKey: "challenges.q47", optionKeys: ["challenges.q47a", "challenges.q47b", "challenges.q47c"], correct: 0 },
      { type: "quiz", icon: "🌙", reward: 51, questionKey: "challenges.q48", optionKeys: ["challenges.q48a", "challenges.q48b", "challenges.q48c"], correct: 0 },
      { type: "quiz", icon: "☀️", reward: 45, questionKey: "challenges.q49", optionKeys: ["challenges.q49a", "challenges.q49b", "challenges.q49c"], correct: 0 },
      { type: "quiz", icon: "🔥", reward: 55, questionKey: "challenges.q50", optionKeys: ["challenges.q50a", "challenges.q50b", "challenges.q50c"], correct: 0 },
      { type: "quiz", icon: "❄️", reward: 48, questionKey: "challenges.q51", optionKeys: ["challenges.q51a", "challenges.q51b", "challenges.q51c"], correct: 0 },
      { type: "quiz", icon: "🌊", reward: 46, questionKey: "challenges.q52", optionKeys: ["challenges.q52a", "challenges.q52b", "challenges.q52c"], correct: 0 },
      { type: "quiz", icon: "🌋", reward: 52, questionKey: "challenges.q53", optionKeys: ["challenges.q53a", "challenges.q53b", "challenges.q53c"], correct: 0 },
      { type: "quiz", icon: "🏔️", reward: 44, questionKey: "challenges.q54", optionKeys: ["challenges.q54a", "challenges.q54b", "challenges.q54c"], correct: 0 },
      { type: "quiz", icon: "🌳", reward: 50, questionKey: "challenges.q55", optionKeys: ["challenges.q55a", "challenges.q55b", "challenges.q55c"], correct: 0 },
      { type: "quiz", icon: "🍀", reward: 47, questionKey: "challenges.q56", optionKeys: ["challenges.q56a", "challenges.q56b", "challenges.q56c"], correct: 0 },
      { type: "quiz", icon: "🌸", reward: 53, questionKey: "challenges.q57", optionKeys: ["challenges.q57a", "challenges.q57b", "challenges.q57c"], correct: 0 },
      { type: "quiz", icon: "🍎", reward: 49, questionKey: "challenges.q58", optionKeys: ["challenges.q58a", "challenges.q58b", "challenges.q58c"], correct: 0 },
      { type: "quiz", icon: "🎈", reward: 51, questionKey: "challenges.q59", optionKeys: ["challenges.q59a", "challenges.q59b", "challenges.q59c"], correct: 0 },
      { type: "quiz", icon: "🎄", reward: 45, questionKey: "challenges.q60", optionKeys: ["challenges.q60a", "challenges.q60b", "challenges.q60c"], correct: 0 },
    ];
    
    const fetchDailyChallenge = async () => {
      const today = new Date().toDateString();
      try {
        const response = await fetch(`/api/daily-challenge/${user.id}/${today}`);
        if (response.ok) {
          const data = await response.json();
          if (data.completed) {
            const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
            const challengeIndex = (dayOfYear + user.id) % challengePool.length;
            setDailyChallenge({ ...challengePool[challengeIndex], completed: true, lockedUntil: data.completedAt });
            return;
          }
        }
      } catch (error) {
        console.error("Failed to fetch challenge:", error);
      }
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
      const challengeIndex = (dayOfYear + user.id) % challengePool.length;
      setDailyChallenge({ ...challengePool[challengeIndex], completed: false });
    };
    
    if (user.role === "child") {
      fetchDailyChallenge();
    }
  }, [user.id, user.role]);

  const { data: connectedPeers = [] } = useQuery({
    queryKey: ["peers", user.connectionId],
    queryFn: async () => {
      const res = await fetch(`/api/peers/connection/${user.connectionId}`);
      if (!res.ok) throw new Error("Failed to fetch peers");
      return res.json();
    },
    refetchInterval: 30000
  });

  const { data: unlockStatus } = useQuery({
    queryKey: ["unlock-status", user.id, user.connectionId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/unlock-status/${user.id}/${user.connectionId}`);
      if (!res.ok) throw new Error("Failed to fetch unlock status");
      return res.json();
    },
    refetchInterval: 30000,
    enabled: user.role === "child" && !!user.connectionId
  });

  const myTasks = tasks.filter((t: Task) => t.assignedTo === user.id);
  const availableTasks = tasks.filter((t: Task) => t.status === "open");
  const familyTasks = availableTasks.filter((t: Task) => t.isRequired);
  const paidTasks = availableTasks.filter((t: Task) => !t.isRequired);

  const handleLink = async () => {
    if (!parentConnectionId) return;
    setIsLinking(true);
    try {
      const updated = await linkChildToParent(user.id, parentConnectionId);
      setUser(updated);
      localStorage.setItem("sats-user", JSON.stringify(updated));
      toast({
        title: t('connection.connected'),
        description: t('connection.connectedToParents')
      });
      setShowLink(false);
    } catch (error) {
      toast({
        title: t('common.error'),
        description: (error as Error).message,
        variant: "destructive"
      });
    } finally {
      setIsLinking(false);
    }
  };

  if (currentView === "calendar-create") {
    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold mb-8">{t('calendar.createNewEvent')}</h1>
        <motion.section initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <Card className="border border-primary/20 shadow-[0_0_30px_-10px_rgba(247,147,26,0.15)] bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Plus className="h-5 w-5" /> {t('calendar.newFamilyEvent')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onCreateEvent} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="event-title">{t('calendar.event')}</Label>
                  <Input 
                    id="event-title"
                    placeholder={t('calendar.eventPlaceholder')} 
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    className="bg-secondary border-border"
                    data-testid="input-event-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-description">{t('calendar.description')}</Label>
                  <Input 
                    id="event-description"
                    placeholder={t('calendar.detailsPlaceholder')} 
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    className="bg-secondary border-border"
                    data-testid="input-event-description"
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="event-start-date">📅 {t('calendar.startDate')}</Label>
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
                    <Label htmlFor="event-end-date">📅 {t('calendar.endDateOptional')}</Label>
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
                    <MapPin className="h-4 w-4" /> {t('calendar.locationOptional')}
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
                  {t('calendar.addEvent')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.section>
      </div>
    );
  }

  if (currentView === "calendar-view") {
    const [eventRsvps, setEventRsvps] = useState<Record<number, any[]>>({});
    
    useEffect(() => {
      const fetchAllRsvps = async () => {
        const rsvpsData: Record<number, any[]> = {};
        for (const event of events) {
          try {
            const res = await fetch(`/api/events/${event.id}/rsvps`);
            if (res.ok) {
              rsvpsData[event.id] = await res.json();
              const myRsvp = rsvpsData[event.id].find((r: any) => r.peerId === user.id);
              if (myRsvp) {
                setRsvps(prev => ({ ...prev, [event.id]: myRsvp.response }));
              }
            }
          } catch (error) {
            console.error(`Failed to fetch RSVPs for event ${event.id}`, error);
          }
        }
        setEventRsvps(rsvpsData);
      };
      if (events.length > 0) fetchAllRsvps();
    }, [events, user.id]);

    const handleRsvp = async (eventId: number, response: string) => {
      setLoading({ ...loading, [eventId]: true });
      try {
        await fetch(`/api/events/${eventId}/rsvps`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ peerId: user.id, response }),
        });
        setRsvps({ ...rsvps, [eventId]: response });
        const updated = eventRsvps[eventId] ? eventRsvps[eventId].map((r: any) => r.peerId === user.id ? { ...r, response } : r) : [];
        setEventRsvps({ ...eventRsvps, [eventId]: updated });
        toast({
          title: response === "accepted" ? t('calendar.rsvpAccepted') : t('calendar.rsvpDeclined'),
          description: response === "accepted" ? t('calendar.rsvpAcceptedDesc') : t('calendar.rsvpDeclinedDesc')
        });
      } catch (error) {
        toast({
          title: t('common.error'),
          description: t('calendar.rsvpError'),
          variant: "destructive"
        });
      } finally {
        setLoading({ ...loading, [eventId]: false });
      }
    };

    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold mb-8">{t('calendar.title')}</h1>
        <section>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Calendar className="text-primary" /> {t('dashboard.allEvents')}
          </h2>
          <div className="grid gap-4">
            {events.length === 0 ? (
              <div className="bg-white/5 dark:bg-black/30 backdrop-blur-xl border border-white/50 dark:border-white/20 rounded-2xl p-8 text-center shadow-lg">
                <p className="text-foreground">{t('dashboard.noEventsPlanned')}</p>
              </div>
            ) : (
              events.map((event: FamilyEvent) => {
                const accepted = (eventRsvps[event.id] || []).filter((r: any) => r.response === "accepted");
                const declined = (eventRsvps[event.id] || []).filter((r: any) => r.response === "declined");
                const myRsvp = rsvps[event.id];
                
                return (
                  <div key={event.id} className="bg-white/5 dark:bg-black/30 backdrop-blur-xl border border-white/50 dark:border-white/20 rounded-2xl hover:bg-white/60 transition-colors shadow-lg">
                    <div className="p-5">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-foreground" data-testid={`text-event-title-view-${event.id}`}>{event.title}</h3>
                          <p className="text-xs text-foreground mt-2 flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {new Date(event.startDate).toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                          </p>
                          <p className="text-xs text-foreground flex items-center gap-1">
                            <span>⏰</span>
                            {new Date(event.startDate).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                            {event.endDate && ` - ${new Date(event.endDate).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`}
                          </p>
                          {event.description && <p className="text-muted-foreground text-sm mt-3">{event.description}</p>}
                          {event.location && (
                            <p className="text-sm text-foreground flex items-center gap-1 mt-2">
                              <MapPin className="h-4 w-4" /> {event.location}
                            </p>
                          )}
                          
                          <div className="flex gap-2 mt-4">
                            <Button
                              onClick={() => handleRsvp(event.id, "accepted")}
                              disabled={loading[event.id] || myRsvp === "accepted"}
                              className={`flex-1 ${myRsvp === "accepted" ? "bg-green-600 hover:bg-green-700" : "bg-violet-600 hover:bg-violet-700"} text-white`}
                              data-testid={`button-accept-event-view-${event.id}`}
                            >
                              {myRsvp === "accepted" ? `✓ ${t('common.accepted')}` : t('common.accept')}
                            </Button>
                            <Button
                              onClick={() => handleRsvp(event.id, "declined")}
                              disabled={loading[event.id] || myRsvp === "declined"}
                              variant={myRsvp === "declined" ? "default" : "destructive"}
                              className={`flex-1 ${myRsvp === "declined" ? "bg-red-600 hover:bg-red-700" : ""}`}
                              data-testid={`button-decline-event-view-${event.id}`}
                            >
                              {myRsvp === "declined" ? `✗ ${t('common.declined')}` : t('common.decline')}
                            </Button>
                          </div>
                          
                          {(accepted.length > 0 || declined.length > 0) && (
                            <div className="mt-4 space-y-2 border-t border-slate-300/30 pt-3">
                              {accepted.length > 0 && (
                                <p className="text-xs text-green-700 font-semibold">✓ {t('common.accepted')}: {accepted.map((r: any) => r.childName).join(", ")}</p>
                              )}
                              {declined.length > 0 && (
                                <p className="text-xs text-red-700 font-semibold">✗ {t('common.declined')}: {declined.map((r: any) => r.childName).join(", ")}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    );
  }

  if (currentView === "calendar") {

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
          title: response === "accepted" ? t('calendar.rsvpAccepted') : t('calendar.rsvpDeclined'),
          description: response === "accepted" ? t('calendar.rsvpAcceptedDesc') : t('calendar.rsvpDeclinedDesc')
        });
      } catch (error) {
        toast({
          title: t('common.error'),
          description: t('calendar.rsvpError'),
          variant: "destructive"
        });
      } finally {
        setLoading({ ...loading, [eventId]: false });
      }
    };

    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-8 text-foreground">{t('calendar.title')}</h1>
        <div className="grid gap-4">
          {events.length === 0 ? (
            <div className="bg-white/5 dark:bg-black/30 backdrop-blur-xl border border-white/50 dark:border-white/20 rounded-2xl p-8 text-center shadow-lg">
              <p className="text-foreground">{t('calendar.noEventsPlanned')}</p>
            </div>
          ) : (
            events.map((event: FamilyEvent) => (
              <div key={event.id} className="bg-white/5 dark:bg-black/30 backdrop-blur-xl border border-white/50 dark:border-white/20 rounded-2xl hover:bg-white/60 transition-colors shadow-lg">
                <div className="p-5">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-foreground" data-testid={`text-event-title-child-${event.id}`}>{event.title}</h3>
                      <p className="text-xs text-foreground mt-2 flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(event.startDate).toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                      </p>
                      <p className="text-xs text-foreground flex items-center gap-1">
                        <span>⏰</span>
                        {new Date(event.startDate).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                        {event.endDate && ` - ${new Date(event.endDate).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`}
                      </p>
                      {event.description && <p className="text-muted-foreground text-sm mt-3">{event.description}</p>}
                      {event.location && (
                        <p className="text-sm text-foreground flex items-center gap-1 mt-2">
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
                          {rsvps[event.id] === "accepted" ? `✓ ${t('common.accepted')}` : t('common.accept')}
                        </Button>
                        <Button
                          onClick={() => handleRsvp(event.id, "declined")}
                          disabled={loading[event.id] || rsvps[event.id] === "accepted"}
                          variant="destructive"
                          className="flex-1"
                          data-testid={`button-decline-event-${event.id}`}
                        >
                          {rsvps[event.id] === "declined" ? `✗ ${t('common.declined')}` : t('common.decline')}
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
      const interval = setInterval(fetchMessages, 10000);
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
        toast({ title: t('common.error'), description: t('errors.messageSendFailed'), variant: "destructive" });
      } finally {
        setIsLoadingMessage(false);
      }
    };
    
    return (
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold mb-8 text-foreground">{t('chat.title')}</h1>
        <div className="bg-white/5 dark:bg-black/30 backdrop-blur-xl border border-white/50 dark:border-white/20 rounded-2xl shadow-lg">
          <div className="p-6">
            <div className="space-y-4">
              <div className="h-96 overflow-y-auto bg-white/30 dark:bg-black/30 rounded-lg p-4 space-y-3">
                {messages.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">{t('chat.noMessages')}</p>
                ) : (
                  messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.fromPeerId === user.id ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-xs rounded-lg px-4 py-2 border ${
                          msg.fromPeerId === user.id
                            ? "bg-violet-600 text-white border-violet-500"
                            : "bg-white/5 dark:bg-black/30 text-foreground border-white/40 dark:border-white/20"
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
                  placeholder={t('chat.placeholder')}
                  disabled={isLoadingMessage}
                  className="flex-1 bg-white/5 dark:bg-black/30 border-white/60 text-foreground placeholder:text-gray-500"
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
      refetchInterval: 30000
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
      if (completedTasks >= 30) return { emoji: "👑", title: t('levels.level10'), color: "text-yellow-600" };
      if (completedTasks >= 27) return { emoji: "⭐", title: t('levels.level9'), color: "text-amber-600" };
      if (completedTasks >= 24) return { emoji: "🏆", title: t('levels.level8'), color: "text-purple-500" };
      if (completedTasks >= 21) return { emoji: "🎯", title: t('levels.level7'), color: "text-blue-600" };
      if (completedTasks >= 18) return { emoji: "🦸", title: t('levels.level6'), color: "text-blue-500" };
      if (completedTasks >= 15) return { emoji: "⚡", title: t('levels.level5'), color: "text-amber-600" };
      if (completedTasks >= 12) return { emoji: "🚀", title: t('levels.level4'), color: "text-amber-500" };
      if (completedTasks >= 9) return { emoji: "🤝", title: t('levels.level3'), color: "text-green-500" };
      if (completedTasks >= 6) return { emoji: "🔍", title: t('levels.level2'), color: "text-green-600" };
      if (completedTasks >= 3) return { emoji: "✨", title: t('levels.level1'), color: "text-muted-foreground" };
      return { emoji: "🌱", title: t('common.beginner'), color: "text-muted-foreground" };
    };

    const levels = [
      { level: 0, emoji: "🌱", title: t('common.beginner'), tasks: `0 ${t('common.tasks')}` },
      { level: 1, emoji: "✨", title: t('levels.level1'), tasks: `3 ${t('common.tasks')}` },
      { level: 2, emoji: "🔍", title: t('levels.level2'), tasks: `6 ${t('common.tasks')}` },
      { level: 3, emoji: "🤝", title: t('levels.level3'), tasks: `9 ${t('common.tasks')}` },
      { level: 4, emoji: "🚀", title: t('levels.level4'), tasks: `12 ${t('common.tasks')}` },
      { level: 5, emoji: "⚡", title: t('levels.level5'), tasks: `15 ${t('common.tasks')}` },
      { level: 6, emoji: "🦸", title: t('levels.level6'), tasks: `18 ${t('common.tasks')}` },
      { level: 7, emoji: "🎯", title: t('levels.level7'), tasks: `21 ${t('common.tasks')}` },
      { level: 8, emoji: "🏆", title: t('levels.level8'), tasks: `24 ${t('common.tasks')}` },
      { level: 9, emoji: "⭐", title: t('levels.level9'), tasks: `27 ${t('common.tasks')}` },
      { level: 10, emoji: "👑", title: t('levels.level10'), tasks: `30 ${t('common.tasks')}` },
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
        <h1 className="text-3xl font-bold mb-2">🏆 {t('leaderboard.title')}</h1>
        <p className="text-muted-foreground mb-6">{t('leaderboard.description')}</p>
        
        {/* Level Legend - Collapsible */}
        <Card className="mb-6 bg-primary/5 border border-primary/30">
          <button
            onClick={() => setShowLevels(!showLevels)}
            className="w-full flex items-center justify-between p-4 hover:bg-primary/10 transition-colors"
            data-testid="button-toggle-levels"
          >
            <h3 className="text-lg font-semibold">📋 {t('leaderboard.levelOverview')}</h3>
            <ChevronDown 
              className={`h-5 w-5 transition-transform ${showLevels ? "rotate-180" : ""}`}
            />
          </button>
          {showLevels && (
            <CardContent className="pt-0 pb-4">
              {bonusSettings && bonusSettings.isActive && (
                <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <p className="text-sm font-semibold text-amber-300 mb-1">🏆 {t('leaderboard.levelBonusActive')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('leaderboard.everyXLevels', { interval: bonusSettings.milestoneInterval })} <span className="text-amber-600 font-bold">{bonusSettings.bonusSats} Sats</span> {t('leaderboard.satsBonus')}
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
                        level.level === 1
                          ? "bg-blue-500/15 border-blue-500/60 ring-2 ring-blue-500/30"
                          : hasBonus 
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
                          {bonusPaid ? `✓ ${t('leaderboard.bonusReceived')}` : `+${bonusSettings?.bonusSats} ⚡`}
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
            <p className="text-muted-foreground">{t('leaderboard.noChildrenYet')}</p>
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
                        {entry.completedTasks} {entry.completedTasks !== 1 ? t('leaderboard.tasksCompletedPlural') : t('leaderboard.tasksCompleted')}
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
                      <p className="text-xs text-muted-foreground">{t('leaderboard.satsEarned')}</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('leaderboard.currentBalance')}</span>
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
      refetchInterval: 30000
    });

    const parent = connectedPeers
      .filter((p: any) => p.role === "parent")
      .sort((a: any, b: any) => a.id - b.id)[0];

    const handleUnlink = async () => {
      if (!window.confirm(t('family.confirmLeaveFamily'))) return;
      
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
        toast({ title: t('peers.unlinkSuccess'), description: t('peers.unlinkSuccessDesc') });
      } catch (error) {
        toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
      }
    };

    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">{t('peers.myFamily')}</h1>
        {parent ? (
          <Card className="border-2 border-primary/40 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> {t('peers.connectedWith')}
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
                    <p className="text-xs text-muted-foreground">👨‍👩‍👧 {t('peers.parent')}</p>
                  </div>
                </div>
              </div>
              <Button 
                variant="outline"
                onClick={handleUnlink}
                className="w-full text-destructive hover:text-destructive"
                data-testid="button-unlink-parent"
              >
                <X className="h-4 w-4 mr-2" /> {t('peers.unlinkFromFamily')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed border-border p-8 text-center">
            <Info className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{t('peers.notConnected')}</p>
            <p className="text-xs text-muted-foreground mt-2">{t('peers.connectHint')}</p>
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
      refetchInterval: 30000
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
        toast({ title: t('common.error'), description: t(passwordCheck.error), variant: "destructive" });
        return;
      }

      try {
        const res = await fetch(`/api/peers/${childId}/reset-pin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parentId: user.id, newPin: resetPinValue }),
        });
        if (!res.ok) throw new Error(t('errors.passwordChangeFailed'));
        setResetPinChildId(null);
        setResetPinValue("");
        queryClient.invalidateQueries({ queryKey: ["peers"] });
        toast({ title: t('common.success'), description: t('settings.passwordReset') });
      } catch (error) {
        toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
      }
    };

    const handleSaveLnbits = async () => {
      if (!editLnbitsUrl || !editLnbitsAdminKey) {
        toast({ title: t('common.error'), description: t('errors.lnbitsRequired'), variant: "destructive" });
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
        toast({ title: t('common.success'), description: t('errors.lnbitsConnected') });
      } catch (error) {
        toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
      }
    };

    return (
      <div className="max-w-4xl space-y-6">
        <h1 className="text-3xl font-bold mb-8">{t('settings.title')}</h1>
        
        <Card className="border-2 border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              ⚡ {t('settings.lnbitsConnection')}
            </CardTitle>
            <CardDescription>{t('settings.lnbitsConnectionDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {user.hasLnbitsConfigured ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg border border-green-500/30 bg-green-500/10">
                  <p className="text-sm font-semibold text-green-300">✓ {t('wallet.lnbitsConnected')}</p>
                  <p className="text-sm text-muted-foreground mt-1">{t('settings.walletConfigured')}</p>
                </div>
                <Button
                  onClick={() => {
                    setUser({ ...user, hasLnbitsConfigured: false });
                    fetch("/api/wallet/disconnect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ peerId: user.id }) });
                    toast({ title: t('common.disconnected'), description: t('wallet.lnbitsRemoved') });
                  }}
                  variant="destructive"
                  size="sm"
                  data-testid="button-disconnect-lnbits"
                >
                  {t('common.disconnect')}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="lnbits-url">{t('wallet.lnbitsInstanceUrl')}</Label>
                  <Input 
                    id="lnbits-url"
                    placeholder={t('wallet.lnbitsUrlPlaceholder')}
                    value={editLnbitsUrl}
                    onChange={(e) => setEditLnbitsUrl(e.target.value)}
                    className="font-mono text-xs"
                    data-testid="input-lnbits-url"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lnbits-key">{t('wallet.lnbitsKey')}</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="lnbits-key"
                      placeholder={t('wallet.lnbitsKey')}
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
                  👶 {t('settings.childManagement')}
                </CardTitle>
                <CardDescription>{t('settings.manageChildPasswords')}</CardDescription>
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
                          {t('settings.changePassword')}
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
                          {t('common.cancel')}
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
        <h1 className="text-3xl font-bold mb-8">{t('settings.title')}</h1>
        <Card className="border-2 border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bitcoin className="h-5 w-5 text-primary" /> {t('wallet.lightningAddress')}
            </CardTitle>
            <CardDescription>{t('dashboard.receiveSatsDescFull')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="child-lightning-address">{t('wallet.lightningAddress')}</Label>
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
                {t('common.status')}: {user.lightningAddress ? "✓ " + t('common.configured') : "✗ " + t('common.notConfigured')}
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
                    toast({ title: t('connection.lightningAddressSaved'), description: t('connection.receiveSatsDirect') });
                  }).catch(err => toast({ title: t('common.error'), description: err.message, variant: "destructive" }));
                }
              }}
              className="bg-primary hover:bg-primary/90"
              data-testid="button-save-child-lightning-address"
            >
              {t('common.save')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentView === "bitcoin-education" && user.role === "child") {
    
    const moduleIds = ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m10", "m11", "m12", "m13", "m14", "m15", "m16", "m17", "m18", "m19", "m20"];
    const levelColors: Record<string, string> = { beginner: "text-green-600", intermediate: "text-yellow-600", advanced: "text-red-600" };
    
    const currentLang = i18n.language?.startsWith('en') ? 'en' : 'de';
    const translations = currentLang === 'en' ? enTranslations : deTranslations;
    const allModules = (translations as any).education?.modules || {};
    
    // Helper: Deterministic shuffle using seeded random for consistent results
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };
    
    const shuffleWithTracking = (arr: string[], seed: number) => {
      const indexed = arr.map((val, idx) => ({ val, originalIdx: idx }));
      for (let i = indexed.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom(seed + i) * (i + 1));
        [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
      }
      const correctIdx = indexed.findIndex(item => item.originalIdx === 0);
      return { shuffled: indexed.map(item => item.val), correctIdx };
    };
    
    const modules = moduleIds.map((mid) => {
      const moduleData = allModules[mid] as { 
        title: string; 
        content: string[]; 
        quiz: Array<{ question: string; option0: string; option1: string; option2: string }> 
      } | undefined;
      
      const moduleNum = parseInt(mid.replace('m', ''));
      const level = moduleNum <= 5 ? "beginner" : moduleNum <= 10 ? "intermediate" : "advanced";
      
      return {
        id: mid,
        level,
        levelColor: levelColors[level],
        title: moduleData?.title || `Module ${mid}`,
        icon: ["₿", "⚡", "🔄", "📍", "📈", "⚡", "🔗", "⛏️", "🤖", "🏆", "🔐", "🔑", "🛡️", "💸", "💪", "☠️", "⚖️", "📉", "🪙", "🚀"][moduleIds.indexOf(mid)],
        content: Array.isArray(moduleData?.content) ? moduleData.content : [],
        quiz: Array.isArray(moduleData?.quiz) ? moduleData.quiz.map((q, qIdx) => {
          const seed = moduleNum * 1000 + qIdx;
          const { shuffled, correctIdx } = shuffleWithTracking([q.option0, q.option1, q.option2], seed);
          return {
            question: q.question,
            options: shuffled,
            correct: correctIdx
          };
        }) : []
      };
    });

    const handleQuizSubmit = async (moduleId: string) => {
      const module = modules.find(m => m.id === moduleId);
      if (!module) return;
      
      const score = module.quiz.filter((q, idx) => quizAnswers[`${moduleId}-${idx}`] === q.correct).length;
      const passScore = Math.ceil(module.quiz.length * 0.7);
      
      if (score >= passScore) {
        const completedModules = serverProgress?.completedModules || [];
        if (!completedModules.includes(moduleId)) {
          try {
            const response = await fetch(`/api/learning-progress/${user.id}/add-xp`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ xp: xpPerModule, moduleId })
            });
            if (response.ok) {
              const updatedProgress = await response.json();
              setServerProgress(updatedProgress);
              console.log("✅ Progress synced from server:", updatedProgress);
              toast({ title: t('education.quizPassed'), description: t('education.quizPassedDesc', { xp: xpPerModule, level: updatedProgress.level, score, total: module.quiz.length }) });
              setExpandedQuizzes({ ...expandedQuizzes, [moduleId]: false });
              setShowQuiz(null);
            } else {
              toast({ title: t('education.saveError'), description: t('education.saveErrorDesc'), variant: "destructive" });
            }
          } catch (error) {
            console.error("Failed to save XP to server:", error);
            toast({ title: t('education.saveError'), description: t('education.tryLater'), variant: "destructive" });
          }
        } else {
          toast({ title: t('education.quizAlreadyPassed'), description: t('education.quizAlreadyPassedDesc', { score, total: module.quiz.length }) });
          setExpandedQuizzes({ ...expandedQuizzes, [moduleId]: false });
          setShowQuiz(null);
        }
      } else {
        toast({ title: t('education.quizTryAgain'), description: t('education.quizTryAgainDesc', { required: passScore, total: module.quiz.length, score }), variant: "destructive" });
      }
      setQuizSubmitted({ ...quizSubmitted, [moduleId]: true });
    };

    const completedModules = serverProgress?.completedModules || [];
    
    const beginnerModules = modules.filter(m => m.level === "beginner");
    const intermediateModules = modules.filter(m => m.level === "intermediate");
    const advancedModules = modules.filter(m => m.level === "advanced");
    
    const achievements: Array<{ id: string; title: string; icon: string; condition: boolean; requirement: string }> = [
      { id: "first-module", title: t('education.achievementBeginner'), icon: "🌱", condition: completedModules.length >= 1, requirement: t('education.requirementFirstModule') },
      { id: "beginner-master", title: t('education.achievementBeginnerMaster'), icon: "⭐", condition: beginnerModules.length > 0 && beginnerModules.every(m => completedModules.includes(m.id)), requirement: t('education.requirementBeginnerMaster') },
      { id: "half-done", title: t('education.achievementLearner'), icon: "📚", condition: completedModules.length >= 10, requirement: t('education.requirementHalfDone') },
      { id: "intermediate-master", title: t('education.achievementIntermediateMaster'), icon: "🏅", condition: intermediateModules.length > 0 && intermediateModules.every(m => completedModules.includes(m.id)), requirement: t('education.requirementIntermediateMaster') },
      { id: "advanced-master", title: t('education.achievementAdvancedMaster'), icon: "🎖️", condition: advancedModules.length > 0 && advancedModules.every(m => completedModules.includes(m.id)), requirement: t('education.requirementAdvancedMaster') },
      { id: "all-done", title: t('education.achievementExpert'), icon: "👑", condition: modules.length > 0 && completedModules.length === modules.length, requirement: t('education.requirementAllDone') }
    ];

    const xpPerModule = 100;
    const userXp = serverProgress?.xp ?? (completedModules.length * xpPerModule);
    const userLevel = serverProgress?.level ?? (Math.floor(userXp / 300) + 1);
    const userStreak = serverProgress?.streak ?? 0;
    
    const isModuleUnlocked = (moduleId: string) => {
      const idx = modules.findIndex(m => m.id === moduleId);
      if (idx === 0) return true;
      const prevModule = modules[idx - 1];
      return completedModules.includes(prevModule.id);
    };
    
    const xpThresholds = [0, 100, 250, 500, 800, 1200, 1700, 2300, 3000, 4000, 5000];
    const maxLevel = xpThresholds.length;
    const clampedLevel = Math.min(userLevel, maxLevel);
    const currentLevelXp = xpThresholds[clampedLevel - 1] || 0;
    const nextLevelXp = xpThresholds[clampedLevel] || xpThresholds[xpThresholds.length - 1] + 500;
    const xpDiff = nextLevelXp - currentLevelXp;
    const xpProgress = xpDiff > 0 ? ((userXp - currentLevelXp) / xpDiff) * 100 : 100;
    
    const levelTitles = [t('education.levelNewbie'), t('education.levelBeginner'), t('education.levelLearner'), t('education.levelExplorer'), t('education.levelKnower'), t('education.levelExpert'), t('education.levelMaster'), t('education.levelGuru'), t('education.levelLegend'), t('education.levelSatoshi'), t('education.levelBitcoinHero')];
    
    return (
      <div className="max-w-6xl space-y-6">
        {/* Gamification Header Dashboard */}
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-foreground">{t('education.educationCenter')}</h1>
          
          {/* Progress Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Level & XP Card */}
            <div className="col-span-1 md:col-span-2 p-4 rounded-xl bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-indigo-500/10 border border-violet-500/20">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-full ${levelColors[userLevel - 1] || "bg-violet-500"} flex items-center justify-center text-white font-bold text-2xl shadow-lg ring-4 ring-white/50`}>
                  {userLevel}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-lg font-bold text-foreground">{levelTitles[userLevel - 1] || t('education.levelBeginner')}</span>
                      <span className="ml-2 text-sm text-muted-foreground">Level {userLevel}</span>
                    </div>
                    <span className="text-sm font-semibold text-violet-600">{userXp} XP</span>
                  </div>
                  <div className="relative h-4 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${Math.min(xpProgress, 100)}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white drop-shadow">{userXp} / {nextLevelXp} XP</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{t('education.xpToNextLevel', { xp: nextLevelXp - userXp, level: userLevel + 1 })}</p>
                </div>
              </div>
            </div>
            
            {/* Streak Card */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-2xl shadow-lg">
                  🔥
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{userStreak} {userStreak === 1 ? t('common.day') : t('common.days')}</p>
                  <p className="text-xs text-muted-foreground">{t('education.learningStreak')} {serverProgress?.longestStreak ? `(${t('education.record')}: ${serverProgress.longestStreak})` : ""}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-1">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className={`flex-1 h-2 rounded-full ${i < Math.min(userStreak, 7) ? "bg-orange-500" : "bg-slate-200"}`} />
                ))}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
              <p className="text-2xl font-bold text-green-600">{(serverProgress?.completedModules || []).length}</p>
              <p className="text-xs text-muted-foreground">{t('education.modulesPassed')}</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
              <p className="text-2xl font-bold text-blue-600">{achievements.filter(a => a.condition).length}/{achievements.length}</p>
              <p className="text-xs text-muted-foreground">{t('education.badges')}</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
              <p className="text-2xl font-bold text-amber-600">{(modules?.length || 0) - (serverProgress?.completedModules || []).length}</p>
              <p className="text-xs text-muted-foreground">{t('education.modulesRemaining')}</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="overflow-x-auto -mx-4 px-4 border-b">
            <div className="flex gap-1 min-w-max md:min-w-0">
              <button onClick={() => setEducationTab("modules")} className={`pb-3 px-3 md:px-4 font-medium text-xs md:text-sm border-b-2 transition-all whitespace-nowrap ${educationTab === "modules" ? "border-violet-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`} data-testid="tab-modules">📚 {t('education.tabModules')}</button>
              <button onClick={() => setEducationTab("converter")} className={`pb-3 px-3 md:px-4 font-medium text-xs md:text-sm border-b-2 transition-all whitespace-nowrap ${educationTab === "converter" ? "border-violet-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`} data-testid="tab-converter">🔄 {t('education.tabConverter')}</button>
              <button onClick={() => setEducationTab("challenges")} className={`pb-3 px-3 md:px-4 font-medium text-xs md:text-sm border-b-2 transition-all whitespace-nowrap ${educationTab === "challenges" ? "border-violet-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`} data-testid="tab-challenges">🎯 {t('education.tabChallenge')}</button>
              <button onClick={() => setEducationTab("resources")} className={`pb-3 px-3 md:px-4 font-medium text-xs md:text-sm border-b-2 transition-all whitespace-nowrap ${educationTab === "resources" ? "border-violet-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`} data-testid="tab-resources">🌐 {t('education.tabResources')}</button>
              <button onClick={() => setEducationTab("glossar")} className={`pb-3 px-3 md:px-4 font-medium text-xs md:text-sm border-b-2 transition-all whitespace-nowrap ${educationTab === "glossar" ? "border-violet-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`} data-testid="tab-glossar">📖 {t('education.tabGlossary')}</button>
            </div>
          </div>
        </div>

        {educationTab === "modules" && (
          <div className="space-y-8">
            {/* Graduation Celebration */}
            {graduationStatus?.graduated && (
              <div className="relative overflow-hidden rounded-2xl border-4 border-amber-400 bg-gradient-to-br from-amber-500/20 via-yellow-400/20 to-orange-500/20 p-6 shadow-2xl">
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-2 left-4 text-4xl animate-bounce" style={{ animationDelay: '0s' }}>🎉</div>
                  <div className="absolute top-8 right-8 text-3xl animate-bounce" style={{ animationDelay: '0.2s' }}>⚡</div>
                  <div className="absolute bottom-4 left-8 text-3xl animate-bounce" style={{ animationDelay: '0.4s' }}>🏆</div>
                  <div className="absolute bottom-8 right-4 text-4xl animate-bounce" style={{ animationDelay: '0.6s' }}>🎊</div>
                </div>
                <div className="relative z-10 text-center space-y-4">
                  <div className="inline-block px-4 py-2 rounded-full bg-amber-500 text-white text-sm font-bold">
                    {graduationStatus.guardianLevel === 3 ? t('education.graduation.masterBadge') : 
                     graduationStatus.guardianLevel === 2 ? t('education.graduation.ambassadorBadge') : 
                     t('education.graduation.guardianBadge')} 🛡️
                  </div>
                  <h2 className="text-3xl font-bold text-foreground">{t('education.graduation.title')}</h2>
                  <p className="text-lg text-amber-700 font-medium">{t('education.graduation.subtitle')}</p>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">{t('education.graduation.description')}</p>
                  
                  <div className="mt-4 p-4 rounded-xl bg-white/50 border-2 border-amber-300 max-w-sm mx-auto">
                    <h3 className="text-sm font-bold text-foreground mb-2">📜 {t('education.graduation.certificate')}</h3>
                    <p className="text-xs text-muted-foreground">{t('education.graduation.certificateDesc')}</p>
                    <div className="mt-3 text-lg font-bold text-amber-600">{user.name}</div>
                    <div className="text-xs text-muted-foreground">{new Date().toLocaleDateString()}</div>
                  </div>
                  
                  {!graduationStatus.bonusPaid ? (
                    <Button 
                      onClick={async () => {
                        try {
                          const response = await fetch(`/api/learning-progress/${user.id}/claim-graduation-bonus`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ bonusSats: 500 })
                          });
                          if (response.ok) {
                            const data = await response.json();
                            setGraduationStatus({ ...graduationStatus, bonusPaid: true });
                            toast({ 
                              title: t('education.graduation.bonusClaimed'), 
                              description: t('education.graduation.bonusDesc', { sats: 500 }) 
                            });
                            queryClient.invalidateQueries({ queryKey: ['sats-breakdown', user.id] });
                          }
                        } catch (error) {
                          console.error('Failed to claim bonus:', error);
                        }
                      }}
                      className="mt-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold px-8"
                    >
                      🎁 {t('education.graduation.claimBonus')} (+500 Sats)
                    </Button>
                  ) : (
                    <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-700 rounded-full font-semibold">
                      ✅ {t('education.graduation.bonusClaimed')}
                    </div>
                  )}
                  
                  <div className="mt-6 pt-4 border-t border-amber-300/50">
                    <p className="text-sm font-medium text-foreground">{t('education.graduation.masteryMode')}</p>
                    <p className="text-xs text-muted-foreground">{t('education.graduation.masteryModeDesc')}</p>
                    <div className="mt-2 flex items-center justify-center gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-violet-600">{serverProgress?.masteryStreakCount || 0}</p>
                        <p className="text-[10px] text-muted-foreground">{t('education.graduation.masteryStreak')}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">
                          {graduationStatus.guardianLevel < 2 ? t('education.graduation.nextLevel', { count: 10 - (serverProgress?.masteryStreakCount || 0) }) :
                           graduationStatus.guardianLevel < 3 ? t('education.graduation.nextLevel', { count: 30 - (serverProgress?.masteryStreakCount || 0) }) :
                           t('education.graduation.continueJourney')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Enhanced Achievements */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">{t('education.yourBadges')} 🏆</h2>
                <span className="text-sm text-muted-foreground">{t('education.unlockedOf', { count: achievements.filter(a => a.condition).length, total: achievements.length })}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {achievements.map((badge, index) => {
                  const unlockedBadges = achievements.filter(b => b.condition);
                  const lastUnlockedIndex = unlockedBadges.length > 0 ? achievements.indexOf(unlockedBadges[unlockedBadges.length - 1]) : -1;
                  const isFirstUnlocked = badge.condition && index === lastUnlockedIndex;
                  const isNextToUnlock = !badge.condition && index === achievements.findIndex(a => !a.condition);
                  
                  return (
                  <div 
                    key={badge.id} 
                    className={`p-4 rounded-xl border-2 transition-all text-center transform hover:scale-105 ${
                      isFirstUnlocked
                        ? "border-amber-400 bg-gradient-to-br from-amber-400/20 to-yellow-400/20 shadow-lg shadow-amber-500/20" 
                        : badge.condition 
                          ? "border-blue-400 bg-gradient-to-br from-blue-400/20 to-cyan-400/20 shadow-lg shadow-blue-500/20" 
                          : isNextToUnlock
                            ? "border-green-400 bg-gradient-to-br from-green-400/10 to-emerald-400/10 opacity-90"
                            : "border-slate-200 bg-slate-50/50 opacity-40 grayscale"
                    }`}
                  >
                    <div className={`text-4xl mb-2 ${isFirstUnlocked ? "animate-bounce" : ""}`} style={{ animationDuration: '2s' }}>
                      {badge.condition ? badge.icon : "🔒"}
                    </div>
                    <p className={`text-xs font-bold ${isFirstUnlocked ? "text-amber-700" : badge.condition ? "text-blue-700" : isNextToUnlock ? "text-green-700" : "text-muted-foreground"}`}>{badge.title}</p>
                    {isFirstUnlocked && (
                      <div className="mt-1 flex justify-center">
                        <span className="relative inline-flex items-center gap-1">
                          <span className="text-[10px] px-2 py-0.5 bg-amber-500 text-white rounded-full font-semibold">{t('education.unlocked')}</span>
                          <span className="text-lg">🟡</span>
                        </span>
                      </div>
                    )}
                    {badge.condition && !isFirstUnlocked && (
                      <div className="mt-1 flex justify-center">
                        <span className="text-[10px] px-2 py-0.5 bg-blue-500 text-white rounded-full font-semibold">{t('education.unlocked')}</span>
                      </div>
                    )}
                    {!badge.condition && (
                      <div className="mt-1">
                        <p className={`text-[9px] ${isNextToUnlock ? "text-green-600 font-semibold" : "text-muted-foreground"}`}>{badge.requirement}</p>
                      </div>
                    )}
                  </div>
                );
                })}
              </div>
            </div>

            {/* Learning Modules */}
            {["beginner", "intermediate", "advanced"].map(level => (
              <div key={level} className="space-y-3">
                <button onClick={() => setExpandedLevels({...expandedLevels, [level]: !expandedLevels[level]})} className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all ${expandedLevels[level] ? "bg-slate-100/50 border border-slate-200" : "bg-slate-50/50 border border-slate-100 hover:bg-slate-100/30"}`}>
                  <h3 className={`text-sm font-semibold uppercase tracking-wide ${level === "beginner" ? "text-green-600" : level === "intermediate" ? "text-yellow-600" : "text-red-600"}`}>{level === "beginner" ? t('education.levelBeginnerModule') : level === "intermediate" ? t('education.levelIntermediateModule') : t('education.levelAdvancedModule')} {t('education.level')}</h3>
                  <span className={`transition-transform ${expandedLevels[level] ? "rotate-180" : ""}`}>▼</span>
                </button>
                {expandedLevels[level] && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {modules.filter(m => m.level === level).map(module => {
                    const isPassed = completedModules.includes(module.id);
                    const isUnlocked = isModuleUnlocked(module.id);
                    const isQuizOpen = showQuiz === module.id && isUnlocked && (!quizSubmitted[module.id] || expandedQuizzes[module.id]);
                    const isQuizSubmitted = quizSubmitted[module.id];
                    const isQuizExpanded = expandedQuizzes[module.id];
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
                                  {!isUnlocked && <p className="text-xs text-red-600 font-semibold">{t('education.previousModuleFirst')}</p>}
                                </div>
                              </div>
                              <Badge variant="outline" className={`${module.levelColor} text-xs`}>{module.level}</Badge>
                            </div>
                            {isPassed && <span className="text-2xl">✅</span>}
                            {!isUnlocked && <span className="text-2xl">🔒</span>}
                          </div>
                        </CardHeader>
                        {isUnlocked ? (
                          isQuizSubmitted && !isQuizExpanded ? (
                            <>
                              <CardContent className="pb-3 text-center py-6"><p className="text-sm text-green-600 font-semibold mb-3">✅ {t('education.quizPassed')}</p></CardContent>
                              <CardFooter className="gap-2">
                                <Button onClick={() => setExpandedQuizzes({...expandedQuizzes, [module.id]: true})} className="flex-1 bg-blue-600 hover:bg-blue-700" size="sm">▼ {t('education.repeatQuiz')}</Button>
                              </CardFooter>
                            </>
                          ) : !isQuizOpen ? (
                            <>
                              <CardContent className="pb-3"><div className="space-y-2 mb-4">{module.content.map((text, idx) => (<p key={idx} className="text-sm text-muted-foreground">• {text}</p>))}</div></CardContent>
                              <CardFooter className="gap-2">
                                {!isPassed ? (
                                  <Button onClick={() => setShowQuiz(module.id)} className="flex-1 bg-blue-600 hover:bg-blue-700" size="sm" data-testid={`button-quiz-${module.id}`}>{t('education.startQuizButton')} →</Button>
                                ) : (
                                  <Button onClick={() => {setShowQuiz(module.id); setExpandedQuizzes({...expandedQuizzes, [module.id]: true});}} variant="outline" className="flex-1" size="sm">{t('education.repeatQuiz')}</Button>
                                )}
                              </CardFooter>
                            </>
                          ) : (
                            <CardContent className="space-y-4">
                              {modules.find(m => m.id === module.id)?.quiz.map((q, idx) => (
                                <div key={idx} className="space-y-2 pb-3 border-b last:border-0">
                                  <p className="text-sm font-semibold text-foreground">{idx + 1}. {q.question}</p>
                                  <div className="space-y-2">
                                    {q.options.map((option, optIdx) => (
                                      <label key={optIdx} className="flex items-center gap-3 p-2 rounded-lg border border-slate-200/50 hover:bg-slate-50/50 cursor-pointer">
                                        <input type="radio" name={`${module.id}-q${idx}`} checked={quizAnswers[`${module.id}-${idx}`] === optIdx} onChange={() => setQuizAnswers({...quizAnswers, [`${module.id}-${idx}`]: optIdx})} className="h-4 w-4" />
                                        <span className="text-sm text-foreground">{option}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              ))}
                              <div className="flex gap-2 pt-3">
                                <Button onClick={() => {setShowQuiz(null); if(isQuizExpanded) setExpandedQuizzes({...expandedQuizzes, [module.id]: false});}} variant="outline" className="flex-1" size="sm">{t('education.back')}</Button>
                                <Button onClick={() => handleQuizSubmit(module.id)} className="flex-1 bg-green-600 hover:bg-green-700" size="sm" data-testid={`button-submit-quiz-${module.id}`}>{t('education.submit')}</Button>
                              </div>
                            </CardContent>
                          )
                        ) : (
                          <CardContent className="pt-4 pb-4 text-center">
                            <p className="text-sm text-muted-foreground">🔒 {t('education.completePreviousModule')}</p>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
                )}
              </div>
            ))}
          </div>
        )}

        {educationTab === "converter" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-violet-500/50 bg-violet-500/5">
              <CardHeader><CardTitle className="text-base">⚡ {t('education.satoshiToBitcoin')}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div><Label className="text-xs">{t('education.satoshis')}</Label><Input type="number" value={satoshiInput} onChange={(e) => setSatoshiInput(e.target.value)} className="font-mono" data-testid="input-sats" /></div>
                <div className="p-3 rounded-lg bg-slate-100/50 text-center"><p className="text-xs text-muted-foreground mb-1">{t('education.bitcoin')}</p><p className="text-lg font-bold text-violet-600">{(parseFloat(satoshiInput) / 100000000).toFixed(8)} ₿</p></div>
              </CardContent>
            </Card>

            <Card className="border-cyan-500/50 bg-cyan-500/5">
              <CardHeader><CardTitle className="text-base">₿ Bitcoin → Euro</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div><Label className="text-xs">Bitcoin</Label><Input type="number" value={bitcoinInput} onChange={(e) => setBitcoinInput(e.target.value)} className="font-mono" data-testid="input-btc" /></div>
                <div className="p-3 rounded-lg bg-slate-100/50 text-center"><p className="text-xs text-muted-foreground mb-1">Euro (Live)</p><p className="text-lg font-bold text-cyan-600">€{btcPrice ? (parseFloat(bitcoinInput) * btcPrice).toFixed(2) : "...loading"}</p></div>
              </CardContent>
            </Card>

            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardHeader><CardTitle className="text-base">💶 Euro → Satoshis</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div><Label className="text-xs">Euro</Label><Input type="number" value={euroInput} onChange={(e) => setEuroInput(e.target.value)} className="font-mono" data-testid="input-eur" /></div>
                <div className="p-3 rounded-lg bg-slate-100/50 text-center"><p className="text-xs text-muted-foreground mb-1">Satoshis</p><p className="text-lg font-bold text-amber-600">{btcPrice ? Math.floor((parseFloat(euroInput) / btcPrice) * 100000000).toLocaleString() : "..."} sats</p></div>
              </CardContent>
            </Card>
          </div>
        )}

        {educationTab === "resources" && (
          <div className="space-y-6">
            <p className="text-muted-foreground">{t('education.resourcesIntro')}</p>
            
            <div className="space-y-6">
              <div className="border-2 border-green-500/30 rounded-xl p-4 bg-green-500/5">
                <h3 className="text-lg font-bold text-green-700 mb-3 flex items-center gap-2">🌱 {t('education.ageGroup69')}</h3>
                <p className="text-xs text-muted-foreground mb-3">{t('education.ageGroup69Desc')}</p>
                <div className="grid grid-cols-1 gap-2">
                  <a href="https://thebitcoinadviser.com/for-kids" target="_blank" rel="noopener noreferrer" className="block p-3 bg-white/5 dark:bg-black/30 rounded-lg hover:bg-white/80 transition-all">
                    <h4 className="font-semibold text-foreground text-sm">The Bitcoin Adviser – "For Your Kids"</h4>
                    <p className="text-xs text-muted-foreground">{t('education.resourceDesc15')}</p>
                  </a>
                  <a href="https://bitcoinsavvykids.com" target="_blank" rel="noopener noreferrer" className="block p-3 bg-white/5 dark:bg-black/30 rounded-lg hover:bg-white/80 transition-all">
                    <h4 className="font-semibold text-foreground text-sm">Bitcoin Savvy Kids – Early Kids</h4>
                    <p className="text-xs text-muted-foreground">{t('education.resourceDesc16')}</p>
                  </a>
                  <a href="https://www.kindersache.de" target="_blank" rel="noopener noreferrer" className="block p-3 bg-white/5 dark:bg-black/30 rounded-lg hover:bg-white/80 transition-all">
                    <h4 className="font-semibold text-foreground text-sm">Kindersache.de</h4>
                    <p className="text-xs text-muted-foreground">{t('education.resourceDesc17')}</p>
                  </a>
                </div>
              </div>

              <div className="border-2 border-blue-500/30 rounded-xl p-4 bg-blue-500/5">
                <h3 className="text-lg font-bold text-blue-700 mb-3 flex items-center gap-2">📚 {t('education.ageGroup1012')}</h3>
                <p className="text-xs text-muted-foreground mb-3">{t('education.ageGroup1012Desc')}</p>
                <div className="grid grid-cols-1 gap-2">
                  <a href="https://bitcoinsavvykids.com/middle" target="_blank" rel="noopener noreferrer" className="block p-3 bg-white/5 dark:bg-black/30 rounded-lg hover:bg-white/80 transition-all">
                    <h4 className="font-semibold text-foreground text-sm">Bitcoin Savvy Kids – Middle Kids</h4>
                    <p className="text-xs text-muted-foreground">{t('education.resourceDesc3')}</p>
                  </a>
                  <a href="https://thebitcoinadviser.com" target="_blank" rel="noopener noreferrer" className="block p-3 bg-white/5 dark:bg-black/30 rounded-lg hover:bg-white/80 transition-all">
                    <h4 className="font-semibold text-foreground text-sm">The Bitcoin Adviser</h4>
                    <p className="text-xs text-muted-foreground">{t('education.resourceDesc4')}</p>
                  </a>
                </div>
              </div>

              <div className="border-2 border-amber-500/30 rounded-xl p-4 bg-amber-500/5">
                <h3 className="text-lg font-bold text-amber-700 mb-3 flex items-center gap-2">🧠 {t('education.ageGroup1214')}</h3>
                <p className="text-xs text-muted-foreground mb-3">{t('education.ageGroup1214Desc')}</p>
                <div className="grid grid-cols-1 gap-2">
                  <a href="https://www.unicef.org/blockchain" target="_blank" rel="noopener noreferrer" className="block p-3 bg-white/5 dark:bg-black/30 rounded-lg hover:bg-white/80 transition-all">
                    <h4 className="font-semibold text-foreground text-sm">UNICEF Blockchain Learning Hub</h4>
                    <p className="text-xs text-muted-foreground">{t('education.resourceDesc5')}</p>
                  </a>
                  <a href="https://bitcoinsavvykids.com/teens" target="_blank" rel="noopener noreferrer" className="block p-3 bg-white/5 dark:bg-black/30 rounded-lg hover:bg-white/80 transition-all">
                    <h4 className="font-semibold text-foreground text-sm">Bitcoin Savvy Kids – Teens</h4>
                    <p className="text-xs text-muted-foreground">{t('education.resourceDesc6')}</p>
                  </a>
                </div>
              </div>

              <div className="border-2 border-red-500/30 rounded-xl p-4 bg-red-500/5">
                <h3 className="text-lg font-bold text-red-700 mb-3 flex items-center gap-2">🎓 {t('education.ageGroup1416')}</h3>
                <p className="text-xs text-muted-foreground mb-3">{t('education.ageGroup1416Desc2')}</p>
                <div className="grid grid-cols-1 gap-2">
                  <a href="https://www.unicef.org/blockchain" target="_blank" rel="noopener noreferrer" className="block p-3 bg-white/5 dark:bg-black/30 rounded-lg hover:bg-white/80 transition-all">
                    <h4 className="font-semibold text-foreground text-sm">UNICEF Blockchain Hub – Intermediate</h4>
                    <p className="text-xs text-muted-foreground">{t('education.resourceDesc7')}</p>
                  </a>
                  <a href="https://www.khanacademy.org/economics-finance-domain/core-finance/money-and-banking/bitcoin/v/bitcoin-what-is-it" target="_blank" rel="noopener noreferrer" className="block p-3 bg-white/5 dark:bg-black/30 rounded-lg hover:bg-white/80 transition-all">
                    <h4 className="font-semibold text-foreground text-sm">Khan Academy – Bitcoin Kurse</h4>
                    <p className="text-xs text-muted-foreground">{t('education.resourceDesc8')}</p>
                  </a>
                </div>
              </div>

              <div className="border-2 border-purple-500/30 rounded-xl p-4 bg-purple-500/5">
                <h3 className="text-lg font-bold text-purple-700 mb-3 flex items-center gap-2">🚀 {t('education.ageGroup1618')}</h3>
                <p className="text-xs text-muted-foreground mb-3">{t('education.ageGroup1618Desc2')}</p>
                <div className="grid grid-cols-1 gap-2">
                  <a href="https://www.unicef.org/blockchain" target="_blank" rel="noopener noreferrer" className="block p-3 bg-white/5 dark:bg-black/30 rounded-lg hover:bg-white/80 transition-all">
                    <h4 className="font-semibold text-foreground text-sm">UNICEF Blockchain – Full Curriculum</h4>
                    <p className="text-xs text-muted-foreground">{t('education.resourceDesc9')}</p>
                  </a>
                  <a href="https://ocw.mit.edu/courses/15-s12-blockchain-and-money-fall-2018/" target="_blank" rel="noopener noreferrer" className="block p-3 bg-white/5 dark:bg-black/30 rounded-lg hover:bg-white/80 transition-all">
                    <h4 className="font-semibold text-foreground text-sm">MIT – Blockchain & Money</h4>
                    <p className="text-xs text-muted-foreground">{t('education.resourceDesc10')}</p>
                  </a>
                  <a href="https://www.khanacademy.org/computing/computer-science" target="_blank" rel="noopener noreferrer" className="block p-3 bg-white/5 dark:bg-black/30 rounded-lg hover:bg-white/80 transition-all">
                    <h4 className="font-semibold text-foreground text-sm">Khan Academy – Computer Science</h4>
                    <p className="text-xs text-muted-foreground">{t('education.resourceDesc11')}</p>
                  </a>
                </div>
              </div>

              <div className="border-2 border-slate-500/30 rounded-xl p-4 bg-slate-500/5">
                <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">👨‍👩‍👧‍👦 {t('education.forParents')}</h3>
                <p className="text-xs text-muted-foreground mb-3">{t('education.forParentsDesc2')}</p>
                <div className="grid grid-cols-1 gap-2">
                  <a href="https://www.coin.space/teaching-kids-bitcoin" target="_blank" rel="noopener noreferrer" className="block p-3 bg-white/5 dark:bg-black/30 rounded-lg hover:bg-white/80 transition-all">
                    <h4 className="font-semibold text-foreground text-sm">Teaching Your Kids About Bitcoin</h4>
                    <p className="text-xs text-muted-foreground">{t('education.resourceDesc12')}</p>
                  </a>
                  <a href="https://bitcoinsavvykids.com/parents" target="_blank" rel="noopener noreferrer" className="block p-3 bg-white/5 dark:bg-black/30 rounded-lg hover:bg-white/80 transition-all">
                    <h4 className="font-semibold text-foreground text-sm">Bitcoin Savvy Kids – Elternbereich</h4>
                    <p className="text-xs text-muted-foreground">{t('education.resourceDesc13')}</p>
                  </a>
                  <a href="https://www.unicef.org/digital-safety" target="_blank" rel="noopener noreferrer" className="block p-3 bg-white/5 dark:bg-black/30 rounded-lg hover:bg-white/80 transition-all">
                    <h4 className="font-semibold text-foreground text-sm">UNICEF – Digital Safety for Children</h4>
                    <p className="text-xs text-muted-foreground">{t('education.resourceDesc14')}</p>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {educationTab === "challenges" && !selectedChallenge && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-foreground">{i18n.language === 'de' ? '🎯 Tägliche Bitcoin-Challenge' : '🎯 Daily Bitcoin Challenge'}</h2>
            <p className="text-sm text-muted-foreground">{i18n.language === 'de' ? 'Jeden Tag eine neue Frage! Beantworte sie richtig und verdiene XP.' : 'A new question every day! Answer correctly and earn XP.'}</p>
            
            {dailyChallenge ? (
              dailyChallenge.completed ? (
                <Card className="border-2 border-green-500/30 bg-green-500/10">
                  <CardContent className="pt-8 pb-8 text-center space-y-3">
                    <p className="text-4xl">✅</p>
                    <p className="text-lg font-bold text-foreground">{i18n.language === 'de' ? 'Heute schon abgeschlossen!' : 'Already completed today!'}</p>
                    <p className="text-sm text-muted-foreground">{i18n.language === 'de' ? 'Komm morgen zurück für die nächste Challenge! 🚀' : 'Come back tomorrow for the next challenge! 🚀'}</p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-2 border-violet-500/50 bg-gradient-to-br from-violet-500/10 to-cyan-500/10">
                  <CardContent className="pt-6 pb-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-4xl">{dailyChallenge.icon}</span>
                      <span className="px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded-full">+{dailyChallenge.reward} XP</span>
                    </div>
                    <h3 className="font-bold text-foreground text-lg">{t(dailyChallenge.questionKey)}</h3>
                    <div className="space-y-2">
                      {dailyChallenge.optionKeys.map((optKey: string, idx: number) => (
                        <button
                          key={idx}
                          onClick={async () => {
                            const isCorrect = idx === dailyChallenge.correct;
                            if (isCorrect) {
                              try {
                                await fetch(`/api/daily-challenge/complete`, { 
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ peerId: user.id, challengeType: 'daily' })
                                });
                                await fetch(`/api/learning-progress/${user.id}/add-xp`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ xp: dailyChallenge.reward })
                                });
                                setDailyChallenge({ ...dailyChallenge, completed: true });
                                queryClient.invalidateQueries({ queryKey: ['learningProgress', user.id] });
                                toast({ 
                                  title: i18n.language === 'de' ? '🎉 Richtig!' : '🎉 Correct!', 
                                  description: i18n.language === 'de' ? `+${dailyChallenge.reward} XP verdient!` : `+${dailyChallenge.reward} XP earned!` 
                                });
                              } catch (error) {
                                console.error('Failed to complete challenge:', error);
                              }
                            } else {
                              toast({ 
                                title: i18n.language === 'de' ? '❌ Falsch!' : '❌ Wrong!', 
                                description: i18n.language === 'de' ? 'Versuch es noch einmal!' : 'Try again!',
                                variant: 'destructive'
                              });
                            }
                          }}
                          className="w-full p-4 rounded-lg text-sm font-medium transition-all text-left bg-muted text-foreground border-2 border-border hover:border-violet-500/50 hover:bg-muted/80"
                        >
                          {t(optKey)}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            ) : (
              <Card className="border-2 border-border">
                <CardContent className="pt-8 pb-8 text-center">
                  <p className="text-muted-foreground">{i18n.language === 'de' ? 'Lade Challenge...' : 'Loading challenge...'}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}


        {educationTab === "glossar" && (
          <div className="space-y-4">
            <Input placeholder={t('education.glossarySearch')} value={glossarSearch} onChange={(e) => setGlossarSearch(e.target.value)} className="text-base" data-testid="input-glossar-search" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { term: "Bitcoin", def: "Digitale Währung, erste erfolgreiche Kryptowährung, dezentralisiert" },
                { term: "Satoshi", def: "Die kleinste Einheit von Bitcoin (100 Millionen pro Bitcoin)" },
                { term: "Blockchain", def: "Dezentralisierte Datenbank mit verketteten Blöcken von Transaktionen" },
                { term: "Mining", def: "Prozess, um neue Bitcoin zu erstellen und Transaktionen zu validieren" },
                { term: "Private Key", def: "Geheimer Schlüssel um dein Geld auszugeben - NIEMALS weitergeben!" },
                { term: "Public Address", def: "Öffentliche Wallet-Adresse um Geld zu empfangen - safe zu teilen" },
                { term: "Wallet", def: "Digitale Geldbörse um Bitcoin zu speichern und zu verwalten" },
                { term: "Transaction", def: "Überweisung von Bitcoin von einer Adresse zu einer anderen" },
                { term: "Lightning Network", def: "Schnelles Zahlungsnetzwerk ON TOP von Bitcoin - Sekunden statt Minuten" },
                { term: "Halving", def: "Event alle 4 Jahre, wo die Mining-Belohnung halbiert wird" },
                { term: "Proof of Work", def: "Sicherheitsmechanismus where Miners komplexe Aufgaben lösen" },
                { term: "Node", def: "Computer der die komplette Blockchain speichert und validiert" },
                { term: "Merkle Tree", def: "Datenstruktur die alle Transaktionen in einem Block verkettet" },
                { term: "Hash", def: "Eindeutige digitale Identität eines Blocks - ändert sich wenn Daten ändern" },
                { term: "Smart Contract", def: "Automatisierte Verträge auf der Blockchain" },
                { term: "UTXO", def: "Unspent Transaction Output - dein verfügbares Bitcoin Geld" },
                { term: "Fee", def: "Gebühr um eine Bitcoin-Transaktion ins Netzwerk zu senden" },
                { term: "Lightning Address", def: "Einfache Adresse im Lightning Format (z.B. name@wallet.com)" },
                { term: "DeFi", def: "Dezentralisierte Finanzierung - Finanzdienstleistungen ohne Bank" },
                { term: "Altcoin", def: "Alle Kryptowährungen außer Bitcoin (Ethereum, Cardano, etc)" }
              ]
                .filter(g => g.term.toLowerCase().includes(glossarSearch.toLowerCase()) || g.def.toLowerCase().includes(glossarSearch.toLowerCase()))
                .map((glossar, idx) => (
                  <Card key={idx} className="border-slate-200 hover:border-violet-300 transition-all">
                    <CardContent className="pt-4 pb-4">
                      <p className="font-bold text-foreground mb-2">{glossar.term}</p>
                      <p className="text-sm text-muted-foreground">{glossar.def}</p>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        )}

        {completedModules.length === modules.length && (
          <Card className="border-green-500/50 bg-gradient-to-r from-green-500/10 to-blue-500/10">
            <CardContent className="pt-8 pb-8 text-center">
              <p className="text-4xl mb-3">🏆👑🚀</p>
              <p className="text-2xl font-bold text-green-600 mb-2">{t('common.bitcoinMaster')}</p>
              <Badge className="bg-green-600">Level {userLevel} {t('common.expert')}</Badge>
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
      refetchInterval: 30000,
      enabled: user.role === "parent"
    });

    const [allowanceChildId, setAllowanceChildId] = useState<number | null>(null);
    const [allowanceSats, setAllowanceSats] = useState("");
    const [allowanceFrequency, setAllowanceFrequency] = useState("weekly");
    const [isCreatingAllowance, setIsCreatingAllowance] = useState(false);

    const handleCreateAllowance = async () => {
      if (!allowanceChildId || !allowanceSats) {
        toast({ title: t('common.error'), description: t('errors.childAndAmountRequired'), variant: "destructive" });
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
        toast({ title: t('common.success'), description: t('errors.allowanceCreated') });
      } catch (error) {
        toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
      } finally {
        setIsCreatingAllowance(false);
      }
    };

    const handleDeleteAllowance = async (allowanceId: number) => {
      if (!window.confirm(t('family.confirmDeleteAllowance'))) return;

      try {
        const res = await fetch(`/api/allowances/${allowanceId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete allowance");
        queryClient.invalidateQueries({ queryKey: ["allowances"] });
        toast({ title: t('common.success'), description: t('errors.allowanceDeleted') });
      } catch (error) {
        toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
      }
    };

    const [satsBreakdown, setSatsBreakdown] = useState<any>(null);
    const [showStatsModal, setShowStatsModal] = useState(false);

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
        <h1 className="text-3xl font-bold mb-4 text-foreground">Dashboard</h1>
        <motion.section 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative overflow-hidden rounded-2xl bg-white/5 dark:bg-black/30 backdrop-blur-xl border border-white/50 dark:border-white/20 p-8 shadow-xl"
        >
          <div className="relative z-10 space-y-6">
            <div className="flex items-start justify-between gap-1">
              <div className="flex-1">
                <p className="text-foreground font-mono text-sm uppercase tracking-widest mb-2">{t('dashboard.received')}</p>
                <h2 className="text-5xl font-mono font-bold flex items-center gap-3 text-cyan-600" data-testid="text-earned-sats">
                  {satsBreakdown ? satsBreakdown.totalSats.toLocaleString() : (user.balance || 0).toLocaleString()} <span className="text-2xl opacity-70 text-foreground">SATS</span>
                </h2>
                {satsBreakdown && (
                  <div className="flex gap-4 mt-3 text-xs flex-wrap">
                    <div>
                      <span className="text-muted-foreground">{t('dashboard.earned')}:</span>
                      <span className="font-mono text-yellow-600 ml-1">{satsBreakdown.taskSats.toLocaleString()}</span>
                    </div>
                    {(satsBreakdown.bonusSats || 0) > 0 && (
                      <div>
                        <span className="text-muted-foreground">Bonus:</span>
                        <span className="font-mono text-purple-600 ml-1">{satsBreakdown.bonusSats.toLocaleString()}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">{t('family.allowance')}:</span>
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
                    : 'bg-white/30 dark:bg-black/30 border-white/40 dark:border-white/20 text-foreground hover:text-foreground'
                }`}
                data-testid="toggle-tracker-chart"
              >
                <span className="text-[10px]">{showTrackerChart ? "▼" : "▶"}</span>
                <span>{t('dashboard.statistics')}</span>
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
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{t('wallet.lightningAddress')}</p>
                    <p className="text-xs font-mono text-violet-700 break-all" data-testid="text-child-lightning-address">{user.lightningAddress}</p>
                    <p className="text-xs text-muted-foreground mt-1">✓ {t('wallet.paymentsDirectHere')}</p>
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
                className="bg-white/5 dark:bg-black/30 backdrop-blur-xl border border-white/50 dark:border-white/20 rounded-2xl shadow-lg"
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
                        <p className="text-[10px] md:text-xs text-foreground mt-1 md:mt-2 uppercase tracking-widest">{t('dashboard.available')}</p>
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
                        <p className="text-[10px] md:text-xs text-foreground mt-1 md:mt-2 uppercase tracking-widest">{t('dashboard.inProgress')}</p>
                      </div>
                    </div>
                    
                    {/* {t('dashboard.pendingApproval')} - unten links */}
                    <div 
                      onClick={() => setCurrentView("tasks-pending")}
                      className="border border-amber-400/40 bg-amber-500/20 backdrop-blur-sm rounded-xl p-3 cursor-pointer hover:bg-amber-500/30 hover:border-amber-400/60 transition-all"
                      data-testid="card-pending-tasks"
                    >
                      <div className="text-center">
                        <div className="text-lg md:text-3xl font-bold text-amber-600">{submittedTasks.length}</div>
                        <p className="text-[10px] md:text-xs text-foreground mt-1 md:mt-2 uppercase tracking-widest">{t('dashboard.pendingApproval')}</p>
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
                        <p className="text-[10px] md:text-xs text-foreground mt-1 md:mt-2 uppercase tracking-widest">{t('dashboard.completed')}</p>
                      </div>
                    </div>
                  </div>

                  {/* Familienaufgaben vs Bezahlte Aufgaben - Unlock System */}
                  {unlockStatus && (
                    <div className="mt-4 pt-4 border-t border-white/20">
                      <div className="grid grid-cols-2 gap-3">
                        {/* Familienaufgaben Progress */}
                        <div 
                          onClick={() => setCurrentView("tasks-open")}
                          className="border border-pink-400/40 bg-pink-500/20 backdrop-blur-sm rounded-xl p-3 cursor-pointer hover:bg-pink-500/30 hover:border-pink-400/60 transition-all"
                          data-testid="card-family-tasks"
                        >
                          <div className="text-center">
                            <div className="text-lg md:text-2xl font-bold text-pink-600">
                              {unlockStatus.progressToNext}/3
                            </div>
                            <p className="text-[10px] md:text-xs text-foreground mt-1 uppercase tracking-widest">
                              {t('tasks.familyTasks')}
                            </p>
                            <div className="mt-2 h-1.5 bg-pink-200/50 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-pink-500 transition-all duration-500"
                                style={{ width: `${(unlockStatus.progressToNext / 3) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        
                        {/* Bezahlte Aufgaben - Lock Status */}
                        <div 
                          onClick={() => setCurrentView("tasks-open")}
                          className={`border backdrop-blur-sm rounded-xl p-3 cursor-pointer transition-all ${
                            unlockStatus.freeSlots > 0 
                              ? "border-orange-400/40 bg-orange-500/20 hover:bg-orange-500/30 hover:border-orange-400/60" 
                              : "border-gray-400/40 bg-gray-500/20 hover:bg-gray-500/30"
                          }`}
                          data-testid="card-paid-tasks"
                        >
                          <div className="text-center">
                            <div className={`text-lg md:text-2xl font-bold ${unlockStatus.freeSlots > 0 ? "text-orange-600" : "text-gray-500"}`}>
                              {unlockStatus.freeSlots > 0 ? (
                                <span>{unlockStatus.freeSlots} ⚡</span>
                              ) : (
                                <span>🔒</span>
                              )}
                            </div>
                            <p className="text-[10px] md:text-xs text-foreground mt-1 uppercase tracking-widest">
                              {t('tasks.paidTasks')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Learning Stats - Compact Trigger */}
            {user.role === "child" && (
              <>
                <motion.button 
                  initial={{ y: 20, opacity: 0 }} 
                  animate={{ y: 0, opacity: 1 }} 
                  transition={{ delay: 0.2 }}
                  onClick={() => setShowStatsModal(true)}
                  className="w-full rounded-2xl bg-white/5 dark:bg-black/30 backdrop-blur-xl border border-white/50 dark:border-white/20 p-6 text-center hover:bg-white/70 transition-all cursor-pointer shadow-lg"
                >
                  <div className="h-12 w-12 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <p className="text-lg font-bold text-foreground">{t('dashboard.learningStatistics')}</p>
                </motion.button>

                {/* Stats Modal */}
                {showStatsModal && (() => {
                  const completedModulesModal = serverProgress?.completedModules || [];
                  const achievements = [
                    { id: "first-module", cond: completedModulesModal.length >= 1 },
                    { id: "half-done", cond: completedModulesModal.length >= 10 },
                    { id: "all-done", cond: completedModulesModal.length === 20 },
                    { id: "beginner-master", cond: completedModulesModal.filter((m: string) => m.startsWith("m") && parseInt(m.slice(1)) <= 5).length === 5 },
                    { id: "advanced-master", cond: completedModulesModal.filter((m: string) => m.startsWith("m") && parseInt(m.slice(1)) >= 16).length === 5 }
                  ];
                  
                  // Calculate weekly stats
                  const weeklyCompleted = completedTasks.length;
                  const weeklySats = satsBreakdown?.taskSats || 0;
                  
                  return (
                    <Dialog open={showStatsModal} onOpenChange={setShowStatsModal}>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>{t('dashboard.yourLearningStatistics')}</DialogTitle>
                        </DialogHeader>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200/50 p-4 text-center">
                            <div className="h-8 w-8 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                              <BookOpen className="h-4 w-4 text-green-600" />
                            </div>
                            <p className="text-xs text-muted-foreground mb-1 font-medium">{t('education.modulesLabel')}</p>
                            <p className="text-2xl font-bold text-green-600">{completedModulesModal.length}/20</p>
                          </div>
                          
                          <div className="rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200/50 p-4 text-center">
                            <div className="h-8 w-8 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                              <Trophy className="h-4 w-4 text-purple-600" />
                            </div>
                            <p className="text-xs text-muted-foreground mb-1 font-medium">{t('education.badges')}</p>
                            <p className="text-2xl font-bold text-purple-600">{achievements.filter(a => a.cond).length}/5</p>
                          </div>
                          
                          <div className="rounded-lg bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200/50 p-4 text-center">
                            <div className="h-8 w-8 bg-violet-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                              <Flame className="h-4 w-4 text-violet-600" />
                            </div>
                            <p className="text-xs text-muted-foreground mb-1 font-medium">{t('dashboard.thisWeek')}</p>
                            <p className="text-2xl font-bold text-violet-600">{weeklyCompleted} {t('common.tasks')}</p>
                          </div>
                          
                          <div className="rounded-lg bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200/50 p-4 text-center">
                            <div className="h-8 w-8 bg-cyan-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                              <TrendingUp className="h-4 w-4 text-cyan-600" />
                            </div>
                            <p className="text-xs text-muted-foreground mb-1 font-medium">{t('education.sevenDays')}</p>
                            <p className="text-2xl font-bold text-cyan-600">{weeklySats.toLocaleString()} Sats</p>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  );
                })()}
              </>
            )}

            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
            <div 
              className="bg-white/5 dark:bg-black/30 backdrop-blur-xl border border-white/50 dark:border-white/20 rounded-2xl shadow-lg cursor-pointer hover:bg-white/60 transition-colors"
              onClick={() => setCurrentView("calendar")}
              data-testid="card-child-calendar"
            >
              <div className="p-2 md:p-4">
                <h3 className="text-sm font-bold mb-2 flex items-center gap-1 text-foreground">
                  <Calendar className="h-4 w-4 text-violet-600" /> {t('nav.calendar')}
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
                      .dark .rdp-head_cell {
                        color: rgb(200, 214, 229);
                      }
                      .rdp-cell {
                        color: rgb(51, 65, 85);
                        padding: 0;
                      }
                      .dark .rdp-cell {
                        color: rgb(226, 232, 240);
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
                      .dark .rdp-day {
                        color: rgb(226, 232, 240);
                      }
                      .rdp-day_selected {
                        background-color: rgb(124, 58, 237);
                        color: white;
                      }
                      .dark .rdp-day_selected {
                        background-color: rgb(168, 85, 247);
                        color: white;
                      }
                      .rdp-day_today {
                        color: rgb(124, 58, 237);
                        font-weight: bold;
                      }
                      .dark .rdp-day_today {
                        color: rgb(217, 119, 255);
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
                      .dark .rdp-caption {
                        color: rgb(226, 232, 240);
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
                      .dark .rdp-nav_button {
                        color: rgb(148, 163, 184);
                      }
                    `}</style>
                    <DayPicker
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      formatters={{
                        formatWeekdayName: (day) => t(`calendar.weekdaysShort.${day.getDay()}`),
                        formatCaption: (date) => `${t(`calendar.months.${date.getMonth()}`)} ${date.getFullYear()}`
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
                        <p className="text-xs text-muted-foreground text-center py-1">{t('dashboard.noEvents')}</p>
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
          <div className="bg-white/5 dark:bg-black/30 backdrop-blur-xl border border-white/50 dark:border-white/20 rounded-2xl p-6 -mt-2 shadow-lg">
            <div className="flex gap-4">
              <Info className="h-5 w-5 text-violet-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold mb-1 text-foreground">{t('connection.notConnected')}</h3>
                <p className="text-sm text-foreground mb-3">
                  {t('connection.connectToSeeTasksTitle')}
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
          <div className="bg-white/5 dark:bg-black/30 backdrop-blur-xl border border-white/50 dark:border-white/20 rounded-2xl p-6 shadow-lg">
            <h3 className="font-bold mb-4 text-foreground">{t('dashboard.connectWithParentsTitle')}</h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="parent-code" className="text-foreground">{t('dashboard.parentConnectionCode')}</Label>
                <Input 
                  id="parent-code"
                  placeholder={t('dashboard.connectionCodePlaceholder')}
                  value={parentConnectionId}
                  onChange={(e) => setParentConnectionId(e.target.value.toUpperCase())}
                  className="bg-white/5 dark:bg-black/30 border-white/60 text-foreground font-mono text-center"
                  data-testid="input-parent-code"
                />
                <p className="text-xs text-muted-foreground mt-1">{t('dashboard.askParentsForCode')}</p>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleLink}
                  disabled={!parentConnectionId || isLinking}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                  data-testid="button-confirm-link"
                >
                  {isLinking ? t('common.connecting') : t('common.connect')}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowLink(false)}
                  disabled={isLinking}
                  className="bg-white/30 dark:bg-black/30 border-white/40 dark:border-white/20 text-foreground"
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
          title: t('taskSubmission.success'),
          description: t('taskSubmission.taskSubmitted'),
        });
      } catch (error) {
        toast({
          title: t('common.error'),
          description: (error as Error).message,
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">{t('dashboard.inProgress')}</h1>
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
                  ✓ {t('dashboard.completed')}
                </Button>
                <div className="text-xs text-muted-foreground text-center">{t('tasks.orUploadPhoto')}</div>
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
              {t('tasks.noTasksInProgress')}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (currentView === "tasks-pending") {
    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">{t('dashboard.pendingApproval')}</h1>
        <div className="grid gap-4">
          {myTasks.filter((t: Task) => t.status === "submitted").map((task: Task) => (
            <TaskCard key={task.id} task={task} variant="child" />
          ))}
          {myTasks.filter((t: Task) => t.status === "submitted").length === 0 && (
            <div className="text-center py-8 border border-dashed border-border rounded-lg text-muted-foreground">
              {t('tasks.noTasksForApproval')}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (currentView === "tasks-completed") {
    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">{t('dashboard.completed')}</h1>
        <div className="grid gap-4">
          {myTasks.filter((t: Task) => t.status === "approved").map((task: Task) => (
            <TaskCard key={task.id} task={task} variant="child" />
          ))}
          {myTasks.filter((t: Task) => t.status === "approved").length === 0 && (
            <div className="text-center py-8 border border-dashed border-border rounded-lg text-muted-foreground">
              {t('tasks.noTasksCompleted')}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (currentView === "tasks-open") {
    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">{t('tasks.availableTasks')}</h1>
        
        {unlockStatus && (
          <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-pink-500/10 to-orange-500/10 border border-pink-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏠</span>
                <div>
                  <p className="font-medium text-foreground">{t('tasks.familyTasks')}: {unlockStatus.progressToNext}/3</p>
                  <div className="w-24 h-1.5 bg-pink-200/50 rounded-full mt-1">
                    <div className="h-full bg-pink-500 rounded-full transition-all" style={{ width: `${(unlockStatus.progressToNext / 3) * 100}%` }} />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {unlockStatus.freeSlots > 0 ? (
                  <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                    ✅ {unlockStatus.freeSlots} {t('tasks.paidTasks')} freigeschaltet
                  </Badge>
                ) : (
                  <Badge className="bg-gray-500/20 text-gray-600 border-gray-500/30">
                    🔒
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {availableTasks.map((task: Task) => {
            const isPaidTask = !task.isRequired;
            const isLocked = isPaidTask && unlockStatus && unlockStatus.freeSlots <= 0 && !task.bypassRatio;
            const isBypassed = isPaidTask && task.bypassRatio;
            
            return (
              <Card key={task.id} className={`border-border bg-card transition-colors ${isLocked ? "opacity-60" : "hover:border-primary/50"} ${isBypassed ? "ring-2 ring-green-500/50" : ""}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    {task.isRequired ? (
                      <Badge variant="secondary" className="bg-pink-500/20 text-pink-600 border-pink-500/30">
                        🏠 {t('tasks.familyTasks')}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className={`font-mono ${isLocked ? "bg-gray-500/10 text-gray-500" : isBypassed ? "bg-green-500/20 text-green-600" : "bg-primary/10 text-primary hover:bg-primary/20"} border-transparent`}>
                        {isLocked ? "🔒" : isBypassed ? "⚡✓" : "⚡"} {task.sats} sats
                      </Badge>
                    )}
                    {isBypassed && (
                      <Badge variant="secondary" className="bg-green-500/20 text-green-600 border-green-500/30 text-xs">
                        Sofort
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="mt-2">{task.title}</CardTitle>
                  <CardDescription>{task.description}</CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button 
                    onClick={() => !isLocked && onAccept(task.id)} 
                    variant="outline" 
                    className={`w-full ${isLocked ? "cursor-not-allowed opacity-50" : isBypassed ? "border-green-500/50 text-green-600 hover:border-green-500 hover:text-green-500" : "hover:border-primary hover:text-primary"}`}
                    disabled={isLocked}
                    data-testid={`button-accept-task-${task.id}`}
                  >
                    {isLocked ? `🔒` : t('tasks.accept')}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
          {availableTasks.length === 0 && (
            <div className="text-center py-8 border border-dashed border-border rounded-lg text-muted-foreground md:col-span-2">
              {t('tasks.noTasksAvailable')}
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
  const { t } = useTranslation();
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
          <p className="text-red-400 font-bold">{error || t('errors.noLiveData')}</p>
          <p className="text-xs text-muted-foreground mt-2">{t('errors.tryAgainLater')}</p>
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
          <span className="text-3xl">🎓</span> {t('education.compareSavings')}
        </h1>
        <Button onClick={() => setCurrentView("dashboard")} variant="ghost" data-testid="button-back-savings">
          {t('common.back')}
        </Button>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-500/5 border border-blue-500/30">
        <CardContent className="pt-6">
          <p className="text-sm">
            <span className="font-bold text-blue-400">{t('education.youHaveSats', { sats: sats.toLocaleString() })}</span> 
            <span className="text-muted-foreground"> (€{currentValueEur.toFixed(2)})</span>
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {t('education.compareSavingsDesc', { days })}
          </p>
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Timeframe Selector */}
        <Card className="border-border">
          <CardContent className="pt-6">
            <p className="text-xs font-bold text-muted-foreground mb-3 uppercase">{t('education.selectTimeframe')}</p>
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
                  {d} {t('common.days')}
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
                <p className="text-xs font-bold text-muted-foreground uppercase">{t('education.interestRate')}</p>
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
              <span>⚡</span> {t('education.bitcoinValueDevelopment')}
            </CardTitle>
            <CardDescription>{t('education.satoshiWealthInEuro')}</CardDescription>
          </CardHeader>
          <CardContent>
            {savingsChartData.length > 0 && (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={savingsChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.25)" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12, fill: "rgba(255,255,255,0.95)" }}
                    interval={Math.floor(savingsChartData.length / 5)}
                  />
                  <YAxis tick={{ fontSize: 12, fill: "rgba(255,255,255,0.95)" }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "rgba(0,0,0,0.9)", border: "1px solid rgba(255,255,255,0.4)", color: "rgba(255,255,255,0.95)" }}
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
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.25)" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12, fill: "rgba(255,255,255,0.95)" }}
                    interval={Math.floor(savingsChartData.length / 5)}
                  />
                  <YAxis tick={{ fontSize: 12, fill: "rgba(255,255,255,0.95)" }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "rgba(0,0,0,0.9)", border: "1px solid rgba(255,255,255,0.4)", color: "rgba(255,255,255,0.95)" }}
                    formatter={(value) => `€${(value as number).toFixed(2)}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="savingsValue" 
                    stroke="#60a5fa" 
                    strokeWidth={2.5}
                    dot={false}
                    name={t('education.savingsBook')}
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
                  <p className="text-xs text-muted-foreground mb-2">🏦 {t('education.savingsBook')}</p>
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
                <span className="text-muted-foreground"> {t('education.priceCanVary')}</span>
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
                <span className="text-muted-foreground"> {t('education.interestEarnsInterest')}</span>
              </span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TrackerChart({ userId }: { userId: number }) {
  const { t } = useTranslation();
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

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">{t('education.loading')}</div>;
  if (trackerData.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">{t('education.noApprovedTasks')}</p>;

  const latest = trackerData[trackerData.length - 1];
  const first = trackerData[0];
  const liveEuroValue = liveBtcPrice ? (latest.totalSats * liveBtcPrice) / 1e8 : latest.euroValue;
  const euroChange = latest.euroValue - first.euroValue;
  const satsChange = latest.totalSats - first.totalSats;
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground">{t('dashboard.yourEarnings')}</h3>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          data-testid="toggle-info"
        >
          {showInfo ? t('education.hide') : t('education.whatDoesMean')}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/5 border border-cyan-500/40 rounded-xl p-4">
          <p className="text-xs text-cyan-700 uppercase tracking-wide mb-1">{t('common.satoshi')}</p>
          <p className="text-2xl font-bold text-cyan-600">{latest.totalSats.toLocaleString()}</p>
          {satsChange > 0 && (
            <p className="text-xs text-cyan-600/70 mt-1">+{satsChange.toLocaleString()} {t('common.earned')}</p>
          )}
        </div>
        <div className="bg-gradient-to-br from-violet-500/20 to-violet-600/5 border border-violet-500/40 rounded-xl p-4">
          <p className="text-xs text-violet-700 uppercase tracking-wide mb-1">{t('common.euroValue')}</p>
          <p className="text-2xl font-bold text-violet-600">€{liveEuroValue.toFixed(2)}</p>
          <p className="text-xs text-violet-600/70 mt-1">{t('common.liveRate')}</p>
        </div>
      </div>

      <div className="flex justify-center gap-2">
        <button
          onClick={() => setShowEuro(!showEuro)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${
            showEuro 
              ? 'bg-violet-500/20 border-violet-500/50 text-violet-600' 
              : 'bg-white/30 dark:bg-black/30 border-slate-300/50 text-muted-foreground'
          }`}
          data-testid="toggle-euro"
        >
          {t('wallet.euro') || 'Euro'}
        </button>
        <button
          onClick={() => setShowSats(!showSats)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${
            showSats 
              ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-600' 
              : 'bg-white/30 dark:bg-black/30 border-slate-300/50 text-muted-foreground'
          }`}
          data-testid="toggle-sats"
        >
          {t('common.satoshi')}
        </button>
        <button
          onClick={() => setShowBtcPrice(!showBtcPrice)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${
            showBtcPrice 
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-600' 
              : 'bg-white/30 dark:bg-black/30 border-slate-300/50 text-muted-foreground'
          }`}
          data-testid="toggle-btc-price"
        >
          {t('common.rate')}
        </button>
      </div>

      <div className="h-48 bg-white/40 backdrop-blur-md rounded-xl p-3 border border-white/50 dark:border-white/20">
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
                      <p className="text-xs text-muted-foreground mb-2">{data.date}</p>
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
        <div className="bg-white/40 backdrop-blur-md border border-white/50 dark:border-white/20 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            {t('education.chartTitle')}
          </p>
          <div className="grid gap-2">
            <div className="flex items-center gap-3 bg-violet-500/15 rounded-lg px-3 py-2">
              <div className="w-4 h-1 bg-violet-500 rounded-full"></div>
              <span className="text-xs text-foreground"><span className="text-violet-600 font-medium">Violett</span> = {t('common.chartViolet')}</span>
            </div>
            <div className="flex items-center gap-3 bg-cyan-500/15 rounded-lg px-3 py-2">
              <div className="w-4 h-1 bg-cyan-500 rounded-full"></div>
              <span className="text-xs text-foreground"><span className="text-cyan-600 font-medium">Cyan</span> = {t('common.chartCyan')}</span>
            </div>
            <div className="flex items-center gap-3 bg-amber-500/15 rounded-lg px-3 py-2">
              <div className="w-4 h-1 rounded-full" style={{background: 'repeating-linear-gradient(90deg, #d97706 0px, #d97706 4px, transparent 4px, transparent 8px)'}}></div>
              <span className="text-xs text-foreground"><span className="text-amber-600 font-medium">Orange (gestrichelt)</span> = {t('common.chartAmber')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BitcoinValueWidget({ sats, setCurrentView, user }: { sats: number; setCurrentView?: (view: string) => void; user?: any }) {
  const { t } = useTranslation();
  const [btcPrice, setBtcPrice] = useState<{ usd: number; eur: number } | null>(null);
  const [interestRate, setInterestRate] = useState(0.2); // Start at 0.2% monthly
  const [dailySnapshots, setDailySnapshots] = useState<any[]>([]);
  const [monthlySnapshots, setMonthlySnapshots] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<"bitcoin" | "savingsBook">("bitcoin");

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
                {viewMode === "bitcoin" ? t('education.bitcoin') : t('education.savingsBook')}
              </p>
              {viewMode === "savingsBook" && (
                <span className="absolute text-[9px] text-muted-foreground/60 top-full -mt-1">{t('education.monthlyRate')}</span>
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
                onClick={() => setViewMode("savingsBook")}
                className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                  viewMode === "savingsBook"
                    ? "bg-blue-500/30 border-blue-500/60 text-blue-400 font-bold"
                    : "bg-blue-500/10 border-blue-500/20 text-blue-300 hover:bg-blue-500/20"
                }`}
                data-testid="button-toggle-sparbuch"
              >
                🏦 {t('education.savingsBook')}
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
                    {t('education.dataCollecting')}
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
                    {t('education.dataCollecting')}
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
            {t('education.compareSavingsBtn')}
          </Button>
        )}
      </div>
    </div>
  );
}

function TaskCard({ task, children, variant }: { task: Task; children?: React.ReactNode; variant: "parent" | "child" }) {
  const { t } = useTranslation();
  const [showLink, setShowLink] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const getStatusConfig = (status: Task["status"]) => {
    switch (status) {
      case "open": return { label: t('tasks.statusOpen'), color: "bg-secondary text-muted-foreground", icon: Circle };
      case "assigned": return { label: t('tasks.statusAssigned'), color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Clock };
      case "submitted": return { label: t('tasks.statusSubmitted'), color: "bg-purple-500/10 text-purple-400 border-purple-500/20", icon: Upload };
      case "approved": return { label: t('tasks.statusApproved'), color: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle };
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
              <p className="text-xs text-muted-foreground">{t('tasks.awaitingAssignmentInfo')}</p>
            </div>
          )}
          
          {task.withdrawLink && task.status === "approved" && variant === "child" && (
            <div className="mt-4 space-y-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-lg">💰</span>
                <p className="text-sm font-bold text-green-600">{t('common.withdraw')}! ({task.sats} {t('common.satsWaiting')})</p>
              </div>
              <p className="text-xs text-muted-foreground">{t('dashboard.copyLinkToReceive')}</p>
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
                      📋 {t('common.copy')}
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
                          💳 {t('common.open')}
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

function DonateView({ user, onClose }: { user: User; onClose: () => void }) {
  const { t } = useTranslation();
  const [donationAmount, setDonationAmount] = useState<string>("500");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDonate = async () => {
    if (!donationAmount || parseInt(donationAmount) <= 0) {
      toast({ title: t('common.error'), description: t('donation.validAmountRequired'), variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/donate/${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sats: parseInt(donationAmount) })
      });
      
      if (res.ok) {
        toast({ title: t('donation.thankYou'), description: `${donationAmount} ${t('donation.satsDonated')}` });
        setDonationAmount("500");
      } else {
        const error = await res.json();
        toast({ title: t('common.error'), description: error.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: t('common.error'), description: (error as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">🧡 Spende an Entwickler</h1>
      <Card className="border-2 border-purple-500/40 bg-purple-500/5">
        <CardHeader>
          <CardTitle>Unterstütze die App Entwicklung</CardTitle>
          <CardDescription>Deine Unterstützung hilft, die App zu verbessern</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Satoshi-Betrag</Label>
            <Input
              id="amount"
              type="number"
              placeholder="500"
              value={donationAmount}
              onChange={(e) => setDonationAmount(e.target.value)}
              className="font-mono text-sm"
              data-testid="input-donation-amount"
            />
            <p className="text-xs text-muted-foreground">Mindestens 100 Sats</p>
          </div>
          <Button
            onClick={handleDonate}
            disabled={loading || !donationAmount || parseInt(donationAmount) < 100}
            className="w-full bg-purple-600 hover:bg-purple-700"
            data-testid="button-donate"
          >
            {loading ? "Wird gesendet..." : `❤️ ${donationAmount || "0"} Sats spenden`}
          </Button>
          <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg text-xs text-muted-foreground">
            <p>🧡 Jede Spende hilft, diese App für Familien besser zu machen!</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
