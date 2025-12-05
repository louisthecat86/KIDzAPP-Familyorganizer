import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { ChevronLeft, MapPin, Navigation, Check } from "lucide-react";

type LocationPing = {
  id: number;
  connectionId: string;
  childId: number;
  latitude: string | null;
  longitude: string | null;
  accuracy: number | null;
  note: string | null;
  status: string;
  createdAt: Date;
};

type User = {
  id: number;
  name: string;
  role: string;
  connectionId: string;
};

type FamilyMember = {
  id: number;
  name: string;
  role: string;
};

export function LocationSharing({ user, familyMembers, onClose }: { 
  user: User; 
  familyMembers: FamilyMember[];
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const locale = i18n.language === "de" ? de : enUS;
  
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("arrived");
  const [useGps, setUseGps] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const isParent = user.role === "parent";

  const { data: pings = [], isLoading } = useQuery<LocationPing[]>({
    queryKey: ["/api/locations", user.connectionId],
    queryFn: async () => {
      const res = await fetch(`/api/locations/${user.connectionId}?limit=20&peerId=${user.id}`);
      if (!res.ok) throw new Error("Failed to fetch locations");
      return res.json();
    },
    enabled: !!user.connectionId,
    refetchInterval: 30000
  });

  const sendLocation = useMutation({
    mutationFn: async (data: { note: string; status: string; latitude?: number; longitude?: number; accuracy?: number }) => {
      const res = await fetch("/api/locations/arrive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: user.connectionId,
          childId: user.id,
          ...data
        })
      });
      if (!res.ok) throw new Error("Failed to send location");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      toast({ title: t("locationSharing.locationSent") });
      setNote("");
      setIsSending(false);
    },
    onError: () => {
      setIsSending(false);
    }
  });

  const handleSendLocation = async () => {
    setIsSending(true);
    
    if (useGps && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          sendLocation.mutate({
            note: note.trim(),
            status,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        () => {
          sendLocation.mutate({ note: note.trim(), status });
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      sendLocation.mutate({ note: note.trim(), status });
    }
  };

  const getMemberName = (memberId: number) => {
    const member = familyMembers.find(m => m.id === memberId);
    return member?.name || "Unknown";
  };

  const getStatusLabel = (s: string) => {
    const statusMap: Record<string, string> = {
      arrived: t("locationSharing.status.arrived"),
      left: t("locationSharing.status.left"),
      school: t("locationSharing.status.school"),
      friend: t("locationSharing.status.friend"),
      other: t("locationSharing.status.other")
    };
    return statusMap[s] || s;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onClose} className="gap-2" data-testid="button-back-location">
          <ChevronLeft className="h-4 w-4" />
          {t("common.back")}
        </Button>
        <h1 className="text-2xl font-bold">{t("locationSharing.title")}</h1>
        <div className="w-24" />
      </div>

      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            {t("locationSharing.arrivedButton")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t("locationSharing.status.arrived")}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="arrived">{t("locationSharing.arrived")}</SelectItem>
                <SelectItem value="left">{t("locationSharing.leftHome")}</SelectItem>
                <SelectItem value="school">{t("locationSharing.atSchool")}</SelectItem>
                <SelectItem value="friend">{t("locationSharing.atFriend")}</SelectItem>
                <SelectItem value="other">{t("locationSharing.onTheWay")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("locationSharing.noteLabel")}</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("locationSharing.notePlaceholder")}
              data-testid="input-location-note"
            />
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="use-gps" 
              checked={useGps} 
              onChange={(e) => setUseGps(e.target.checked)}
              className="rounded"
              data-testid="checkbox-use-gps"
            />
            <Label htmlFor="use-gps" className="flex items-center gap-1 cursor-pointer">
              <Navigation className="h-4 w-4" />
              {t("locationSharing.useGPS")}
            </Label>
          </div>
          <Button 
            onClick={handleSendLocation} 
            disabled={isSending}
            className="w-full gap-2 bg-green-600 hover:bg-green-700"
            data-testid="button-send-location"
          >
            <MapPin className="h-4 w-4" />
            {t("locationSharing.sendLocation")}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t("locationSharing.recentArrivals")}</h2>
        
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : pings.length === 0 ? (
          <Card className="py-12 text-center text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t("locationSharing.noArrivals")}</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {pings.map((ping) => (
              <Card key={ping.id} className="hover:bg-muted/50 transition-colors" data-testid={`card-ping-${ping.id}`}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <MapPin className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium">{getMemberName(ping.childId)}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <span>{getStatusLabel(ping.status)}</span>
                          {ping.note && <span>• {ping.note}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(ping.createdAt), { addSuffix: true, locale })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
