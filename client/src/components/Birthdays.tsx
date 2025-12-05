import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Cake, Plus, Trash2, Gift, PartyPopper } from "lucide-react";

type BirthdayReminder = {
  id: number;
  connectionId: string;
  createdBy: number;
  personName: string;
  birthMonth: number;
  birthDay: number;
  birthYear: number | null;
  relation: string | null;
  notifyDaysBefore: number[];
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type User = {
  id: number;
  name: string;
  role: string;
  connectionId: string;
};

export function Birthdays({ user, onClose }: { 
  user: User; 
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showForm, setShowForm] = useState(false);
  const [personName, setPersonName] = useState("");
  const [birthMonth, setBirthMonth] = useState("1");
  const [birthDay, setBirthDay] = useState("1");
  const [birthYear, setBirthYear] = useState("");
  const [relation, setRelation] = useState("");
  const [notes, setNotes] = useState("");

  const isParent = user.role === "parent";

  const { data: birthdays = [], isLoading } = useQuery<BirthdayReminder[]>({
    queryKey: ["/api/birthdays", user.connectionId],
    queryFn: async () => {
      const res = await fetch(`/api/birthdays/${user.connectionId}?peerId=${user.id}`);
      if (!res.ok) throw new Error("Failed to fetch birthdays");
      return res.json();
    },
    enabled: !!user.connectionId
  });

  const { data: upcomingBirthdays = [] } = useQuery<BirthdayReminder[]>({
    queryKey: ["/api/birthdays/upcoming", user.connectionId],
    queryFn: async () => {
      const res = await fetch(`/api/birthdays/upcoming/${user.connectionId}?days=30&peerId=${user.id}`);
      if (!res.ok) throw new Error("Failed to fetch upcoming birthdays");
      return res.json();
    },
    enabled: !!user.connectionId
  });

  const createBirthday = useMutation({
    mutationFn: async (data: { personName: string; birthMonth: number; birthDay: number; birthYear: number | null; relation: string; notes: string }) => {
      const res = await fetch("/api/birthdays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: user.connectionId,
          createdBy: user.id,
          notifyDaysBefore: [0, 1, 7],
          ...data
        })
      });
      if (!res.ok) throw new Error("Failed to create birthday");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/birthdays"] });
      toast({ title: t("birthdays.birthdayAdded") });
      resetForm();
    }
  });

  const deleteBirthday = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/birthdays/${id}?peerId=${user.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete birthday");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/birthdays"] });
      toast({ title: t("birthdays.birthdayDeleted") });
    }
  });

  const resetForm = () => {
    setPersonName("");
    setBirthMonth("1");
    setBirthDay("1");
    setBirthYear("");
    setRelation("");
    setNotes("");
    setShowForm(false);
  };

  const handleSubmit = () => {
    if (!personName.trim()) return;
    createBirthday.mutate({
      personName: personName.trim(),
      birthMonth: parseInt(birthMonth),
      birthDay: parseInt(birthDay),
      birthYear: birthYear ? parseInt(birthYear) : null,
      relation: relation.trim(),
      notes: notes.trim()
    });
  };

  const getDaysUntil = (month: number, day: number) => {
    const today = new Date();
    const thisYear = new Date(today.getFullYear(), month - 1, day);
    const nextYear = new Date(today.getFullYear() + 1, month - 1, day);
    const nextBirthday = thisYear >= today ? thisYear : nextYear;
    return Math.floor((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getAge = (year: number | null, month: number, day: number) => {
    if (!year) return null;
    const today = new Date();
    const thisYearBirthday = new Date(today.getFullYear(), month - 1, day);
    let age = today.getFullYear() - year;
    if (today < thisYearBirthday) age--;
    return age + 1;
  };

  const getDaysLabel = (days: number) => {
    if (days === 0) return t("birthdays.today");
    if (days === 1) return t("birthdays.tomorrow");
    return t("birthdays.inDays", { days });
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onClose} className="gap-2" data-testid="button-back-birthdays">
            <ChevronLeft className="h-4 w-4" />
            {t("common.back")}
          </Button>
          {isParent && (
            <Button onClick={() => setShowForm(!showForm)} className="gap-2" data-testid="button-new-birthday">
              <Plus className="h-4 w-4" />
              {t("birthdays.newReminder")}
            </Button>
          )}
        </div>
        <h1 className="text-2xl font-bold text-center">{t("birthdays.title")}</h1>
      </div>

      {showForm && isParent && (
        <Card className="bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950/20 dark:to-rose-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-pink-500" />
              {t("birthdays.newReminder")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("birthdays.personName")}</Label>
                <Input
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder={t("birthdays.personNamePlaceholder")}
                  data-testid="input-birthday-name"
                />
              </div>
              <div>
                <Label>{t("birthdays.relationLabel")}</Label>
                <Input
                  value={relation}
                  onChange={(e) => setRelation(e.target.value)}
                  placeholder={t("birthdays.relationPlaceholder")}
                  data-testid="input-birthday-relation"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>{t("birthdays.birthMonth")}</Label>
                <Select value={birthMonth} onValueChange={setBirthMonth}>
                  <SelectTrigger data-testid="select-birth-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(m => (
                      <SelectItem key={m} value={m.toString()}>
                        {t(`birthdays.months.${m}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("birthdays.birthDay")}</Label>
                <Select value={birthDay} onValueChange={setBirthDay}>
                  <SelectTrigger data-testid="select-birth-day">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {days.map(d => (
                      <SelectItem key={d} value={d.toString()}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("birthdays.birthYear")}</Label>
                <Select value={birthYear} onValueChange={setBirthYear}>
                  <SelectTrigger data-testid="select-birth-year">
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">-</SelectItem>
                    {years.map(y => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t("birthdays.notesLabel")}</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("birthdays.notesPlaceholder")}
                data-testid="input-birthday-notes"
              />
            </div>
            <Button 
              onClick={handleSubmit} 
              disabled={!personName.trim() || createBirthday.isPending}
              className="w-full"
              data-testid="button-add-birthday"
            >
              {t("birthdays.addReminder")}
            </Button>
          </CardContent>
        </Card>
      )}

      {upcomingBirthdays.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <PartyPopper className="h-5 w-5 text-yellow-500" />
            {t("birthdays.upcoming")}
          </h2>
          <div className="grid gap-2">
            {upcomingBirthdays.map((b) => {
              const daysUntil = getDaysUntil(b.birthMonth, b.birthDay);
              const age = getAge(b.birthYear, b.birthMonth, b.birthDay);
              const isToday = daysUntil === 0;
              
              return (
                <Card 
                  key={b.id} 
                  className={`${isToday ? "border-yellow-400 bg-yellow-50/50 dark:bg-yellow-950/20" : ""}`}
                  data-testid={`card-upcoming-${b.id}`}
                >
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center text-xl ${isToday ? "bg-yellow-200 dark:bg-yellow-800" : "bg-pink-100 dark:bg-pink-900/30"}`}>
                          {isToday ? "🎉" : "🎂"}
                        </div>
                        <div>
                          <div className="font-medium">{b.personName}</div>
                          <div className="text-sm text-muted-foreground">
                            {b.relation && <span>{b.relation} • </span>}
                            {age && <span>{t("birthdays.turnsAge", { age })} • </span>}
                            <span className={isToday ? "text-yellow-600 font-bold" : ""}>{getDaysLabel(daysUntil)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t("birthdays.allBirthdays")}</h2>
        
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : birthdays.length === 0 ? (
          <Card className="py-12 text-center text-muted-foreground">
            <Cake className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t("birthdays.empty")}</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {birthdays.map((b) => {
              const daysUntil = getDaysUntil(b.birthMonth, b.birthDay);
              const age = getAge(b.birthYear, b.birthMonth, b.birthDay);
              
              return (
                <Card key={b.id} className="hover:bg-muted/50 transition-colors" data-testid={`card-birthday-${b.id}`}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                          <Cake className="h-5 w-5 text-pink-600" />
                        </div>
                        <div>
                          <div className="font-medium">{b.personName}</div>
                          <div className="text-sm text-muted-foreground">
                            {t(`birthdays.months.${b.birthMonth}`)} {b.birthDay}
                            {b.birthYear && <span> • {b.birthYear}</span>}
                            {b.relation && <span> • {b.relation}</span>}
                          </div>
                          {b.notes && (
                            <div className="text-xs text-muted-foreground mt-1">{b.notes}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{getDaysLabel(daysUntil)}</span>
                        {isParent && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteBirthday.mutate(b.id)}
                            className="text-red-500 hover:text-red-600"
                            data-testid={`button-delete-birthday-${b.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
