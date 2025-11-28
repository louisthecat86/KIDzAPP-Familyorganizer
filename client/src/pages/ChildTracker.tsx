import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TrackerEntry {
  date: string;
  timestamp: string;
  earnedSats: number;
  btcPrice: number;
  totalSats: number;
  euroValue: number;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{
        backgroundColor: "#1e293b",
        border: "5px solid #22c55e",
        borderRadius: "12px",
        padding: "12px 16px",
        boxShadow: "0 8px 24px rgba(34, 197, 94, 0.6), inset 0 0 0 2px rgba(34, 197, 94, 0.3)",
        minWidth: "200px"
      }}>
        <p style={{ color: "#86efac", fontSize: "15px", fontWeight: "700", margin: "6px 0" }}>
          Euro : €{data.euroValue.toFixed(2)}
        </p>
        <p style={{ color: "#fbbf24", fontSize: "15px", fontWeight: "700", margin: "6px 0" }}>
          Satoshi : {data.totalSats.toLocaleString()}
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
        setTrackerData(data || []);
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
              <AreaChart data={trackerData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="trackerGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(16,185,129,0.15)" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 9, fill: "rgba(16,185,129,0.7)" }} 
                />
                <YAxis 
                  width={50} 
                  tick={{ fontSize: 9, fill: "rgba(16,185,129,0.7)" }} 
                  tickFormatter={(value) => `€${Number(value).toFixed(0)}`} 
                />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="euroValue" 
                  stroke="#10b981" 
                  fill="url(#trackerGradient)" 
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Summary */}
          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border/50">
            <p>✓ {trackerData.length} genehmigte Aufgaben</p>
            <p>⚡ Verdient: {trackerData.reduce((sum, e) => sum + e.earnedSats, 0).toLocaleString()} Satoshi</p>
            <p>€ Aktueller BTC-Preis: €{latestEntry.btcPrice.toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
