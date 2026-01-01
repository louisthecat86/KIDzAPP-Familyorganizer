import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TrackerEntry {
  date: string;
  timestamp: string;
  earnedSats?: number;
  btcPrice: number;
  btcPriceScaled: number;
  totalSats: number;
  euroValue: number;
}

interface EarningBreakdown {
  type: string;
  label: string;
  totalSats: number;
  count: number;
}

interface EarningsData {
  currentBalance: number;
  totalReceived: number;
  breakdown: EarningBreakdown[];
}

const getEarningIcon = (type: string): string => {
  const icons: Record<string, string> = {
    'task_payment': '✅',
    'manual_payment': '📱',
    'instant_payout': '⚡',
    'graduation_bonus': '🎓',
    'retry_payment': '🔄',
    'allowance': '📅',
    'level_bonus': '🏆',
  };
  return icons[type] || '💰';
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-950 border-2 border-blue-500 rounded p-2 shadow-xl" style={{ pointerEvents: 'none' }}>
        <p className="text-xs text-green-400">€ {data.euroValue?.toFixed(2)}</p>
        <p className="text-xs text-yellow-400">⚡ {data.totalSats}</p>
      </div>
    );
  }
  return null;
};

export function ChildTracker({ childId, currentBalance }: { childId: number; currentBalance?: number }) {
  const [trackerData, setTrackerData] = useState<TrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const [liveEuroValue, setLiveEuroValue] = useState<number | null>(null);
  const [earnings, setEarnings] = useState<EarningsData | null>(null);

  useEffect(() => {
    const fetchTrackerData = async () => {
      try {
        const response = await fetch(`/api/tracker/${childId}`);
        const data = await response.json();
        // Speichere original btcPrice UND skalierte Version für Chart
        const scaledData = data.map((entry: any) => ({
          ...entry,
          btcPriceScaled: entry.btcPrice / 1000
        }));
        setTrackerData(scaledData || []);
      } catch (error) {
        console.error("Failed to fetch tracker data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrackerData();
  }, [childId]);

  // Fetch earnings breakdown
  useEffect(() => {
    const fetchEarnings = async () => {
      try {
        const res = await fetch(`/api/child-earnings/${childId}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setEarnings(data);
          setLiveBalance(data.currentBalance);
        }
      } catch (error) {
        console.error("Failed to fetch earnings:", error);
      }
    };
    
    fetchEarnings();
  }, [childId]);

  // Fetch live Euro value based on current BTC price
  useEffect(() => {
    const fetchLiveEuroValue = async () => {
      if (liveBalance === null) return;
      try {
        const priceRes = await fetch('/api/bitcoin-price');
        if (priceRes.ok) {
          const priceData = await priceRes.json();
          const btcPrice = priceData.eur || 0;
          const euroValue = (liveBalance / 100000000) * btcPrice;
          setLiveEuroValue(euroValue);
        }
      } catch (error) {
        console.error("Failed to fetch BTC price:", error);
      }
    };
    
    fetchLiveEuroValue();
  }, [liveBalance]);

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

          {/* Stats - Use live balance for current values */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
              <p className="text-xs text-muted-foreground">Gesamt Satoshi</p>
              <p className="text-xl font-bold text-yellow-300">
                {(liveBalance !== null ? liveBalance : latestEntry.totalSats).toLocaleString()}
              </p>
              {liveBalance !== null && liveBalance !== latestEntry.totalSats && (
                <p className="text-xs text-green-400">+{(liveBalance - latestEntry.totalSats).toLocaleString()} seit letztem Snapshot</p>
              )}
            </div>
            <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
              <p className="text-xs text-muted-foreground">Euro-Wert</p>
              <p className="text-xl font-bold text-green-300">
                €{(liveEuroValue !== null ? liveEuroValue : latestEntry.euroValue).toFixed(2)}
              </p>
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
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#fff' }} />
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

          {/* Earnings Breakdown */}
          {earnings && earnings.breakdown.length > 0 && (
            <div className="pt-3 border-t border-border/50">
              <p className="text-sm font-semibold text-yellow-300 mb-2">💰 Alle erhaltenen Satoshi:</p>
              <div className="space-y-2">
                {earnings.breakdown.map((item) => (
                  <div key={item.type} className="flex justify-between items-center bg-slate-900/50 p-2 rounded">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{getEarningIcon(item.type)}</span>
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-yellow-300">{item.totalSats.toLocaleString()} sats</span>
                      <span className="text-xs text-muted-foreground ml-2">({item.count}x)</span>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center bg-yellow-500/20 border border-yellow-500/30 p-2 rounded mt-2">
                  <span className="text-sm font-semibold">Gesamt erhalten:</span>
                  <span className="text-lg font-bold text-yellow-300">{earnings.totalReceived.toLocaleString()} sats</span>
                </div>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border/50">
            <p>✓ {trackerData.length} Snapshots</p>
            <p className="text-blue-300 font-semibold">💙 BTC Preis aktuell: €{latestEntry.btcPrice ? latestEntry.btcPrice.toLocaleString('de-DE', {maximumFractionDigits: 0}) : 'N/A'}</p>
            
            {/* All data points with btcPrice */}
            <div className="mt-3 pt-3 border-t border-border/50">
              <p className="text-muted-foreground mb-2">Alle Datenpunkte:</p>
              <div className="space-y-1 max-h-32 overflow-y-auto text-xs">
                {trackerData.map((entry, idx) => (
                  <div key={idx} className="flex justify-between bg-slate-950/50 p-1 rounded">
                    <span className="text-muted-foreground">{entry.date}</span>
                    <span className="text-green-400">€{entry.euroValue.toFixed(2)}</span>
                    <span className="text-yellow-400">⚡{entry.totalSats}</span>
                    <span className="text-blue-400">₿€{entry.btcPrice?.toLocaleString('de-DE', {maximumFractionDigits: 0})}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
