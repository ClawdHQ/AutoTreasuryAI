'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Asset {
  symbol: string;
  address: string;
  balance: string;
  valueUSD: number;
  percentage: number;
}

interface Allocation {
  pancakeLP: number;
  venusLending: number;
  bnbStaking: number;
  idle: number;
}

interface Action {
  type: string;
  params: Record<string, unknown>;
  estimatedGas: string;
  priority: number;
}

interface Strategy {
  name: string;
  description: string;
  targetAllocation: Allocation;
  expectedAPR: number;
  riskLevel: 'low' | 'medium' | 'high';
  actions: Action[];
  reasoning: string;
}

interface TreasuryData {
  totalValue: number;
  change24h: number;
  currentAPR: number;
  riskScore: string;
  allocation: Allocation;
  assets: Asset[];
  aiStrategy: Strategy;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRiskLevel(score: string): 'Low' | 'Medium' | 'High' {
  const s = (score ?? '').toLowerCase();
  if (s === 'low') return 'Low';
  if (s === 'high') return 'High';
  return 'Medium';
}

// ─── Mock performance data for chart ─────────────────────────────────────────
const PERFORMANCE_MOCK = Array.from({ length: 30 }, (_, i) => ({
  day: `Day ${i + 1}`,
  value: 100000 + Math.round(Math.sin(i / 4) * 8000 + i * 300),
  apr: +(8 + Math.sin(i / 3) * 3).toFixed(2),
}));

// ─── Sub-components ───────────────────────────────────────────────────────────

interface OverviewCardProps {
  title: string;
  value: string | number;
  change?: number;
  subtext?: string;
  riskLevel?: string;
  icon: string;
}

function OverviewCard({ title, value, change, subtext, riskLevel, icon }: OverviewCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex justify-between items-start mb-2">
          <p className="text-sm text-gray-500">{title}</p>
          <span className="text-2xl">{icon}</span>
        </div>
        <p className="text-3xl font-bold mb-1">{value}</p>
        {change !== undefined && (
          <p className={`text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(2)}%
          </p>
        )}
        {subtext && <p className="text-xs text-gray-400">{subtext}</p>}
        {riskLevel && (
          <span
            className={`inline-block px-2 py-1 text-xs rounded mt-2 ${
              riskLevel === 'Low'
                ? 'bg-green-100 text-green-800'
                : riskLevel === 'Medium'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {riskLevel} Risk
          </span>
        )}
      </CardContent>
    </Card>
  );
}

interface AIStrategyCardProps {
  strategy: Strategy;
  currentAPR: number;
}

function AIStrategyCard({ strategy, currentAPR }: AIStrategyCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Card className="mb-8 border-2 border-blue-500 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💡</span>
          <CardTitle>AI Strategy Recommendation</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <p className="text-sm text-gray-500 mb-1">Strategy</p>
            <p className="text-lg font-semibold">{strategy.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Expected APR</p>
            <p className="text-lg font-semibold text-green-600">
              {strategy.expectedAPR.toFixed(2)}%
              {strategy.expectedAPR > currentAPR && (
                <span className="text-sm text-gray-500 ml-2">
                  (+{(strategy.expectedAPR - currentAPR).toFixed(2)}%)
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Risk Level</p>
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                strategy.riskLevel === 'low'
                  ? 'bg-green-100 text-green-800'
                  : strategy.riskLevel === 'medium'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {strategy.riskLevel.toUpperCase()}
            </span>
          </div>
        </div>

        <p className="text-gray-700 mb-4">{strategy.description}</p>

        <div className="flex gap-3">
          <Button onClick={() => setShowDetails(!showDetails)} variant="outline">
            {showDetails ? 'Hide Details' : 'View Details'}
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            Execute Strategy
          </Button>
        </div>

        {showDetails && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="font-semibold mb-2">Reasoning:</p>
            <p className="text-sm text-gray-700 mb-4">{strategy.reasoning}</p>

            <p className="font-semibold mb-2">Actions ({strategy.actions.length}):</p>
            <ol className="list-decimal list-inside space-y-2">
              {strategy.actions.map((action, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium">{action.type}</span>:{' '}
                  {JSON.stringify(action.params)}
                </li>
              ))}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const ALLOCATION_COLORS: Record<string, string> = {
  'PancakeSwap LP': '#FF6B9D',
  'Venus Lending': '#4ECDC4',
  'BNB Staking': '#F0B90B',
  Idle: '#95A5A6',
};

function AllocationChart({ allocation }: { allocation: Allocation }) {
  const data = [
    { name: 'PancakeSwap LP', value: allocation.pancakeLP },
    { name: 'Venus Lending', value: allocation.venusLending },
    { name: 'BNB Staking', value: allocation.bnbStaking },
    { name: 'Idle', value: allocation.idle },
  ].filter((d) => d.value > 0);

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={ALLOCATION_COLORS[entry.name] ?? '#8884d8'} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

type PerfRange = '7d' | '30d' | '90d';

function PerformanceChart() {
  const [range, setRange] = useState<PerfRange>('30d');
  const [mode, setMode] = useState<'value' | 'apr'>('value');

  const sliceMap: Record<PerfRange, number> = { '7d': 7, '30d': 30, '90d': 30 };
  const data = PERFORMANCE_MOCK.slice(-sliceMap[range]);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(['7d', '30d', '90d'] as PerfRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1 text-sm rounded ${
              range === r ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {r}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setMode('value')}
            className={`px-3 py-1 text-sm rounded ${
              mode === 'value' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            Value
          </button>
          <button
            onClick={() => setMode('apr')}
            className={`px-3 py-1 text-sm rounded ${
              mode === 'apr' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            APR
          </button>
        </div>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey={mode === 'value' ? 'value' : 'apr'}
              stroke="#4F46E5"
              dot={false}
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface AssetTableProps {
  assets: Asset[];
}

function AssetTable({ assets }: AssetTableProps) {
  type SortKey = 'symbol' | 'valueUSD' | 'percentage';
  const [sortKey, setSortKey] = useState<SortKey>('valueUSD');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = [...assets].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Asset Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {(['symbol', 'balance', 'valueUSD', 'percentage'] as const).map((col) => (
                  <th
                    key={col}
                    onClick={() =>
                      col !== 'balance' && handleSort(col as SortKey)
                    }
                    className={`text-left py-3 pr-4 font-semibold text-gray-600 ${
                      col !== 'balance' ? 'cursor-pointer hover:text-gray-900' : ''
                    }`}
                  >
                    {col === 'symbol'
                      ? 'Asset'
                      : col === 'valueUSD'
                      ? 'Value (USD)'
                      : col === 'percentage'
                      ? 'Allocation %'
                      : 'Amount'}
                    {sortKey === col && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((asset, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-3 pr-4 font-medium">{asset.symbol}</td>
                  <td className="py-3 pr-4 text-gray-600">{asset.balance}</td>
                  <td className="py-3 pr-4">${asset.valueUSD.toLocaleString()}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${Math.min(asset.percentage, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-12 text-right">
                        {asset.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-gray-400">
                    No assets found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivePositions() {
  const positions = [
    { type: 'PancakeSwap LP', pair: 'BNB/USDT', nftId: '#1234', feesEarned: '$42.50' },
    { type: 'Venus', asset: 'USDT', supplied: '$15,000', apr: '5.2%' },
    { type: 'BNB Staking', amount: '10 BNB', validator: 'Validator #7', rewards: '0.05 BNB' },
  ];

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Active Positions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {positions.map((pos, i) => (
            <div key={i} className="p-4 border rounded-lg bg-gray-50">
              <p className="text-xs font-semibold text-blue-600 uppercase mb-2">{pos.type}</p>
              {pos.pair && (
                <p className="text-sm font-medium mb-1">
                  {pos.pair} <span className="text-gray-400">#{pos.nftId}</span>
                </p>
              )}
              {pos.asset && <p className="text-sm font-medium mb-1">{pos.asset}</p>}
              {pos.supplied && <p className="text-xs text-gray-500">Supplied: {pos.supplied}</p>}
              {pos.feesEarned && <p className="text-xs text-gray-500">Fees: {pos.feesEarned}</p>}
              {pos.apr && <p className="text-xs text-green-600">APR: {pos.apr}</p>}
              {pos.amount && <p className="text-xs text-gray-500">{pos.amount}</p>}
              {pos.validator && <p className="text-xs text-gray-500">{pos.validator}</p>}
              {pos.rewards && <p className="text-xs text-green-600">Rewards: {pos.rewards}</p>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RecentActions() {
  const actions = [
    {
      type: 'Rebalance',
      description: 'Moved 10% from Idle to PancakeSwap LP',
      time: '2h ago',
      txHash: '0xabc123…',
      icon: '🔄',
    },
    {
      type: 'Reward Claimed',
      description: 'Claimed 0.05 BNB staking rewards',
      time: '6h ago',
      txHash: '0xdef456…',
      icon: '🎁',
    },
    {
      type: 'Deposit',
      description: 'Deposited 500 USDT to Venus',
      time: '1d ago',
      txHash: '0xghi789…',
      icon: '💰',
    },
  ];

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Recent Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {actions.map((action, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="flex-shrink-0 text-2xl">{action.icon}</div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">{action.type}</p>
                    <p className="text-xs text-gray-500">{action.description}</p>
                  </div>
                  <span className="text-xs text-gray-400">{action.time}</span>
                </div>
                <a
                  href={`https://bscscan.com/tx/${action.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline"
                >
                  {action.txHash} ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-48 bg-gray-200 rounded-lg animate-pulse mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="h-72 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-72 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const [treasuryData, setTreasuryData] = useState<TreasuryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;

    async function fetchData() {
      try {
        const response = await fetch(`/api/treasury/${address}`);
        if (!response.ok) throw new Error('Failed to fetch treasury data');
        const data = await response.json();
        setTreasuryData(data);
      } catch {
        // Silently fail; keep showing loading/stale data
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [address]);

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-96">
          <CardContent className="pt-6">
            <h2 className="text-2xl font-bold text-center mb-4">AutoTreasury AI</h2>
            <p className="text-gray-600 text-center mb-6">
              Connect your wallet to manage your treasury
            </p>
            <div className="flex justify-center">
              <ConnectButton />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading || !treasuryData) {
    return <LoadingState />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🤖</div>
            <div>
              <h1 className="text-xl font-bold">AutoTreasury AI</h1>
              <p className="text-sm text-gray-500">Autonomous Treasury Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/chat"
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition"
            >
              💬 Chat
            </a>
            <ConnectButton />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Overview Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <OverviewCard
            title="Total Value"
            value={`$${treasuryData.totalValue.toLocaleString()}`}
            change={treasuryData.change24h}
            icon="💰"
          />
          <OverviewCard
            title="Current APR"
            value={`${(treasuryData.currentAPR ?? 0).toFixed(2)}%`}
            subtext="Weighted average"
            icon="📈"
          />
          <OverviewCard
            title="Risk Score"
            value={getRiskLevel(treasuryData.riskScore)}
            riskLevel={getRiskLevel(treasuryData.riskScore)}
            icon="⚠️"
          />
          <OverviewCard
            title="AI Confidence"
            value="94%"
            subtext="Strategy quality"
            icon="🎯"
          />
        </div>

        {/* AI Strategy Recommendation */}
        <AIStrategyCard
          strategy={treasuryData.aiStrategy}
          currentAPR={treasuryData.currentAPR ?? 0}
        />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Current Allocation</CardTitle>
            </CardHeader>
            <CardContent>
              <AllocationChart allocation={treasuryData.allocation} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <PerformanceChart />
            </CardContent>
          </Card>
        </div>

        {/* Asset Breakdown */}
        <AssetTable assets={treasuryData.assets} />

        {/* Active Positions */}
        <ActivePositions />

        {/* Recent Actions */}
        <RecentActions />
      </main>
    </div>
  );
}
