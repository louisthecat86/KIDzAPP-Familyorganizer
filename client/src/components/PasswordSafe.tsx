import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Lock, Plus, Trash2, Eye, EyeOff, Copy, ExternalLink, Key } from "lucide-react";

type PasswordEntry = {
  id: number;
  connectionId: string;
  createdBy: number;
  label: string;
  username: string | null;
  passwordEnc: string;
  url: string | null;
  notesEnc: string | null;
  category: string;
  lastRotatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type User = {
  id: number;
  name: string;
  role: string;
  connectionId: string;
};

export function PasswordSafe({ user, onClose }: { 
  user: User; 
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState("general");
  const [visiblePasswords, setVisiblePasswords] = useState<Record<number, string>>({});
  const [loadingReveal, setLoadingReveal] = useState<number | null>(null);

  const isParent = user.role === "parent";

  const { data: entries = [], isLoading } = useQuery<PasswordEntry[]>({
    queryKey: ["/api/password-safe", user.connectionId],
    queryFn: async () => {
      const res = await fetch(`/api/password-safe/${user.connectionId}?peerId=${user.id}`);
      if (!res.ok) throw new Error("Failed to fetch passwords");
      return res.json();
    },
    enabled: !!user.connectionId && isParent
  });

  const createEntry = useMutation({
    mutationFn: async (data: { label: string; username: string; password: string; url: string; notes: string; category: string }) => {
      const res = await fetch("/api/password-safe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: user.connectionId,
          createdBy: user.id,
          ...data
        })
      });
      if (!res.ok) throw new Error("Failed to create entry");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/password-safe"] });
      toast({ title: t("passwordSafe.entryAdded") });
      resetForm();
    }
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/password-safe/${id}?peerId=${user.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete entry");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/password-safe"] });
      toast({ title: t("passwordSafe.entryDeleted") });
    }
  });

  const revealPassword = async (id: number) => {
    if (visiblePasswords[id]) {
      setVisiblePasswords(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      return;
    }

    setLoadingReveal(id);
    try {
      const res = await fetch(`/api/password-safe/reveal/${id}?peerId=${user.id}`);
      if (!res.ok) throw new Error("Failed to reveal password");
      const data = await res.json();
      setVisiblePasswords(prev => ({ ...prev, [id]: data.password }));
    } catch (error) {
      toast({ title: t("passwordSafe.accessDenied"), variant: "destructive" });
    } finally {
      setLoadingReveal(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: t("passwordSafe.copied") });
  };

  const resetForm = () => {
    setLabel("");
    setUsername("");
    setPassword("");
    setUrl("");
    setNotes("");
    setCategory("general");
    setShowForm(false);
  };

  const handleSubmit = () => {
    if (!label.trim() || !password.trim()) return;
    createEntry.mutate({
      label: label.trim(),
      username: username.trim(),
      password: password.trim(),
      url: url.trim(),
      notes: notes.trim(),
      category
    });
  };

  const getCategoryIcon = (cat: string) => {
    const icons: Record<string, string> = {
      streaming: "🎬",
      gaming: "🎮",
      school: "📚",
      social: "💬",
      wifi: "📶",
      banking: "🏦",
      general: "🔑",
      other: "📦"
    };
    return icons[cat] || "🔑";
  };

  if (!isParent) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3">
          <Button variant="outline" onClick={onClose} className="gap-2 self-start" data-testid="button-back-passwords">
            <ChevronLeft className="h-4 w-4" />
            {t("common.back")}
          </Button>
          <h1 className="text-2xl font-bold text-center">{t("passwordSafe.title")}</h1>
        </div>
        <Card className="py-12 text-center">
          <Lock className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium text-muted-foreground">{t("passwordSafe.parentOnly")}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onClose} className="gap-2" data-testid="button-back-passwords">
            <ChevronLeft className="h-4 w-4" />
            {t("common.back")}
          </Button>
          <Button onClick={() => setShowForm(!showForm)} className="gap-2" data-testid="button-new-password">
            <Plus className="h-4 w-4" />
            {t("passwordSafe.newEntry")}
          </Button>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold">{t("passwordSafe.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("passwordSafe.subtitle")}</p>
        </div>
      </div>

      {showForm && (
        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-purple-500" />
              {t("passwordSafe.newEntry")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("passwordSafe.labelLabel")}</Label>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={t("passwordSafe.labelPlaceholder")}
                  data-testid="input-password-label"
                />
              </div>
              <div>
                <Label>{t("passwordSafe.categoryLabel")}</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">{t("passwordSafe.categories.general")}</SelectItem>
                    <SelectItem value="streaming">{t("passwordSafe.categories.streaming")}</SelectItem>
                    <SelectItem value="gaming">{t("passwordSafe.categories.gaming")}</SelectItem>
                    <SelectItem value="school">{t("passwordSafe.categories.school")}</SelectItem>
                    <SelectItem value="social">{t("passwordSafe.categories.social")}</SelectItem>
                    <SelectItem value="wifi">{t("passwordSafe.categories.wifi")}</SelectItem>
                    <SelectItem value="banking">{t("passwordSafe.categories.banking")}</SelectItem>
                    <SelectItem value="other">{t("passwordSafe.categories.other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("passwordSafe.usernameLabel")}</Label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t("passwordSafe.usernamePlaceholder")}
                  data-testid="input-password-username"
                />
              </div>
              <div>
                <Label>{t("passwordSafe.passwordLabel")}</Label>
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("passwordSafe.passwordPlaceholder")}
                  type="password"
                  data-testid="input-password-password"
                />
              </div>
            </div>
            <div>
              <Label>{t("passwordSafe.urlLabel")}</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t("passwordSafe.urlPlaceholder")}
                data-testid="input-password-url"
              />
            </div>
            <div>
              <Label>{t("passwordSafe.notesLabel")}</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("passwordSafe.notesPlaceholder")}
                data-testid="input-password-notes"
              />
            </div>
            <Button 
              onClick={handleSubmit} 
              disabled={!label.trim() || !password.trim() || createEntry.isPending}
              className="w-full"
              data-testid="button-add-password"
            >
              {t("passwordSafe.addEntry")}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : entries.length === 0 ? (
        <Card className="py-12 text-center text-muted-foreground">
          <Lock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{t("passwordSafe.empty")}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <Card key={entry.id} className="hover:bg-muted/50 transition-colors" data-testid={`card-password-${entry.id}`}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-2xl">
                      {getCategoryIcon(entry.category)}
                    </div>
                    <div>
                      <div className="font-semibold">{entry.label}</div>
                      {entry.username && (
                        <div className="text-sm text-muted-foreground">{entry.username}</div>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-sm bg-muted px-2 py-0.5 rounded">
                          {visiblePasswords[entry.id] || "••••••••"}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revealPassword(entry.id)}
                          disabled={loadingReveal === entry.id}
                          className="h-6 w-6 p-0"
                          data-testid={`button-reveal-${entry.id}`}
                        >
                          {visiblePasswords[entry.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        {visiblePasswords[entry.id] && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(visiblePasswords[entry.id])}
                            className="h-6 w-6 p-0"
                            data-testid={`button-copy-${entry.id}`}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(entry.url!, "_blank")}
                        data-testid={`button-open-url-${entry.id}`}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteEntry.mutate(entry.id)}
                      className="text-red-500 hover:text-red-600"
                      data-testid={`button-delete-password-${entry.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
