import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Phone, Plus, Trash2, AlertCircle } from "lucide-react";

type EmergencyContact = {
  id: number;
  connectionId: string;
  createdBy: number;
  label: string;
  name: string;
  phone: string;
  notes: string | null;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
};

type User = {
  id: number;
  name: string;
  role: string;
  connectionId: string;
};

export function EmergencyContacts({ user, onClose }: { 
  user: User; 
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState("0");

  const isParent = user.role === "parent";

  const { data: contacts = [], isLoading } = useQuery<EmergencyContact[]>({
    queryKey: ["/api/emergency-contacts", user.connectionId],
    queryFn: async () => {
      const res = await fetch(`/api/emergency-contacts/${user.connectionId}`);
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return res.json();
    },
    enabled: !!user.connectionId
  });

  const createContact = useMutation({
    mutationFn: async (data: { label: string; name: string; phone: string; notes: string; priority: number }) => {
      const res = await fetch("/api/emergency-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: user.connectionId,
          createdBy: user.id,
          ...data
        })
      });
      if (!res.ok) throw new Error("Failed to create contact");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/emergency-contacts"] });
      toast({ title: t("emergencyContacts.contactAdded") });
      resetForm();
    }
  });

  const deleteContact = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/emergency-contacts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete contact");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/emergency-contacts"] });
      toast({ title: t("emergencyContacts.contactDeleted") });
    }
  });

  const resetForm = () => {
    setLabel("");
    setName("");
    setPhone("");
    setNotes("");
    setPriority("0");
    setShowForm(false);
  };

  const handleSubmit = () => {
    if (!label.trim() || !name.trim() || !phone.trim()) return;
    createContact.mutate({
      label: label.trim(),
      name: name.trim(),
      phone: phone.trim(),
      notes: notes.trim(),
      priority: parseInt(priority)
    });
  };

  const getPriorityBadge = (p: number) => {
    if (p >= 2) return <span className="text-red-500 text-sm">{t("emergencyContacts.priorityHigh")}</span>;
    if (p === 1) return <span className="text-yellow-500 text-sm">{t("emergencyContacts.priorityMedium")}</span>;
    return <span className="text-green-500 text-sm">{t("emergencyContacts.priorityLow")}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onClose} className="gap-2" data-testid="button-back-emergency">
          <ChevronLeft className="h-4 w-4" />
          {t("common.back")}
        </Button>
        <h1 className="text-2xl font-bold">{t("emergencyContacts.title")}</h1>
        {isParent && (
          <Button onClick={() => setShowForm(!showForm)} className="gap-2" data-testid="button-new-contact">
            <Plus className="h-4 w-4" />
            {t("emergencyContacts.newContact")}
          </Button>
        )}
        {!isParent && <div className="w-24" />}
      </div>

      {showForm && isParent && (
        <Card className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              {t("emergencyContacts.newContact")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("emergencyContacts.labelLabel")}</Label>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={t("emergencyContacts.labelPlaceholder")}
                  data-testid="input-contact-label"
                />
              </div>
              <div>
                <Label>{t("emergencyContacts.nameLabel")}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("emergencyContacts.namePlaceholder")}
                  data-testid="input-contact-name"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("emergencyContacts.phoneLabel")}</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t("emergencyContacts.phonePlaceholder")}
                  type="tel"
                  data-testid="input-contact-phone"
                />
              </div>
              <div>
                <Label>{t("emergencyContacts.priorityLabel")}</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger data-testid="select-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">{t("emergencyContacts.priorityHigh")}</SelectItem>
                    <SelectItem value="1">{t("emergencyContacts.priorityMedium")}</SelectItem>
                    <SelectItem value="0">{t("emergencyContacts.priorityLow")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t("emergencyContacts.notesLabel")}</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("emergencyContacts.notesPlaceholder")}
                data-testid="input-contact-notes"
              />
            </div>
            <Button 
              onClick={handleSubmit} 
              disabled={!label.trim() || !name.trim() || !phone.trim() || createContact.isPending}
              className="w-full"
              data-testid="button-add-contact"
            >
              {t("emergencyContacts.addContact")}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : contacts.length === 0 ? (
        <Card className="py-12 text-center text-muted-foreground">
          <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{t("emergencyContacts.empty")}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <Card key={contact.id} className="hover:bg-muted/50 transition-colors" data-testid={`card-contact-${contact.id}`}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <Phone className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{contact.label}</span>
                        {getPriorityBadge(contact.priority)}
                      </div>
                      <div className="text-sm text-foreground">{contact.name}</div>
                      <div className="text-sm text-muted-foreground">{contact.phone}</div>
                      {contact.notes && (
                        <div className="text-xs text-muted-foreground mt-1">{contact.notes}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => window.open(`tel:${contact.phone}`, "_self")}
                      className="gap-2 bg-green-600 hover:bg-green-700"
                      data-testid={`button-call-${contact.id}`}
                    >
                      <Phone className="h-4 w-4" />
                      {t("emergencyContacts.callNow")}
                    </Button>
                    {isParent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteContact.mutate(contact.id)}
                        className="text-red-500 hover:text-red-600"
                        data-testid={`button-delete-contact-${contact.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isParent && (
        <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="py-4 text-center text-sm text-muted-foreground">
            {t("emergencyContacts.parentOnly")}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
