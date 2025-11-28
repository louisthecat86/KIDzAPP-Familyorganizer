import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TrackerEntry {
  date: string;
  timestamp: string;
  earnedSats?: number;
  btcPrice: number;
  totalSats: number;
  euroValue: number;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    console.log("Tooltip data:", data);
    
    return (
      <div className="bg-slate-950 border-8 border-green-500 rounded-lg p-4 shadow-2xl min-w-fit" style={{ pointerEvents: 'none' }}>
        <p className="text-green-400 font-bold text-sm">
          Euro : €{data.euroValue?.toFixed(2) || "N/A"}
        </p>
        <p className="text-yellow-400 font-bold text-sm">
          Satoshi : {data.totalSats?.toLocaleString() || "N/A"}
        </p>
        <p className="text-blue-400 font-bold text-sm">
          BTC Preis : €{data.btcPrice ? data.btcPrice.toFixed(2) : "N/A"}
        </p>
      </div>
    );
  }
  return null;
};

export function ChildTracker({ childId }: { childId: number }) {
  const [trackerData, setTrackerData] = useState<TrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrackerData = async () => {
      try {
        const response = await fetch(`/api/tracker/${childId}`);
        const data = await response.json();
        // Skaliere btcPrice /1000 um in sichtbarem Bereich zu sein
        const scaledData = data.map((entry: any) => ({
          ...entry,
          btcPrice: entry.btcPrice / 1000
        }));
        console.log("🔵 TRACKER DATA WITH BTC PRICE:", scaledData);
        console.log("🔵 Last entry btcPrice:", scaledData[scaledData.length - 1]?.btcPrice);
        setTrackerData(scaledData || []);
      } catch (error) {
        console.error("Failed to fetch tracker data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrackerData();
  }, [childId]);

  if (loading) {
    return <div className="text-muted-foreground">Wird geladen...</div>;
  }

  if (trackerData.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Keine genehmigten Tasks noch.</p>
        </CardContent>
      </Card>
    );
  }

  const latestEntry = trackerData[trackerData.length - 1];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <span>📈</span>
            Verdienst-Tracker
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
              <p className="text-xs text-muted-foreground">Gesamt Satoshi</p>
              <p className="text-xl font-bold text-yellow-300">{latestEntry.totalSats.toLocaleString()}</p>
            </div>
            <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
              <p className="text-xs text-muted-foreground">Euro-Wert</p>
              <p className="text-xl font-bold text-green-300">€{latestEntry.euroValue.toFixed(2)}</p>
            </div>
          </div>

          {/* Chart */}
          <div className="h-64 -mx-6">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trackerData} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(16,185,129,0.15)" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 9, fill: "rgba(16,185,129,0.7)" }} 
                />
                <YAxis 
                  tick={{ fontSize: 9, fill: "rgba(34,197,94,1)" }} 
                />
                <Tooltip content={<CustomTooltip />} cursor={false} />
                <Line 
                  type="monotone" 
                  dataKey="euroValue" 
                  stroke="#22c55e" 
                  dot={false}
                  strokeWidth={3}
                  isAnimationActive={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="totalSats" 
                  stroke="#facc15" 
                  dot={false}
                  strokeWidth={3}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Summary */}
          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border/50">
            <p>✓ {trackerData.length} genehmigte Aufgaben</p>
            <p>⚡ Verdient: {trackerData.reduce((sum, e) => sum + (e.earnedSats || 0), 0).toLocaleString()} Satoshi</p>
            <p className="text-blue-300 font-semibold">💙 BTC Preis aktuell: €{(latestEntry.btcPrice * 1000).toLocaleString('de-DE', {maximumFractionDigits: 0})}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
