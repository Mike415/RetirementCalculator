/**
 * Admin Portal — Analytics & User Management
 * Accessible only to users with role = "admin".
 * Two tabs: Analytics (charts + metrics) and Users (list + management).
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Users,
  BarChart2,
  TrendingUp,
  DollarSign,
  UserPlus,
  XCircle,
  RefreshCw,
  Eye,
  Search,
  ChevronLeft,
  ChevronRight,
  Shield,
  Loader2,
} from "lucide-react";

// ─── Date range helpers ───────────────────────────────────────────────────────

type RangeKey = "24h" | "7d" | "30d" | "1y" | "custom";

function getRange(key: RangeKey, custom?: { from: Date; to: Date }): { from: Date; to: Date } {
  const now = new Date();
  if (key === "custom" && custom) return custom;
  const from = new Date(now);
  if (key === "24h") from.setHours(from.getHours() - 24);
  else if (key === "7d") from.setDate(from.getDate() - 7);
  else if (key === "30d") from.setDate(from.getDate() - 30);
  else if (key === "1y") from.setFullYear(from.getFullYear() - 1);
  return { from, to: now };
}

function fmtCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtDate(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

// ─── Tier badge ───────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    free: "bg-gray-100 text-gray-700",
    basic: "bg-blue-100 text-blue-700",
    pro: "bg-emerald-100 text-emerald-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colors[tier] ?? "bg-gray-100 text-gray-700"}`}>
      {tier}
    </span>
  );
}

// ─── Metric card ─────────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-emerald-700",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-foreground mt-0.5">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── User detail modal ────────────────────────────────────────────────────────

function UserDetailModal({
  userId,
  onClose,
}: {
  userId: number;
  onClose: () => void;
}) {
  const { data, isLoading } = trpc.admin.users.detail.useQuery({ userId });
  const utils = trpc.useUtils();

  const setTier = trpc.admin.users.setTier.useMutation({
    onSuccess: () => {
      toast.success("Tier updated");
      utils.admin.users.list.invalidate();
      utils.admin.users.detail.invalidate({ userId });
    },
  });

  const setBeta = trpc.admin.users.setBeta.useMutation({
    onSuccess: () => {
      toast.success("Beta override updated");
      utils.admin.users.detail.invalidate({ userId });
    },
  });

  const setRole = trpc.admin.users.setRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated");
      utils.admin.users.list.invalidate();
      utils.admin.users.detail.invalidate({ userId });
    },
  });

  if (isLoading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!data) return null;
  const { user, planCount, stripeEvents, recentPageViews } = data;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-600" />
            {user.name ?? user.email ?? `User #${user.id}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Profile */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Email</p>
              <p className="font-medium">{user.email ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Signed up</p>
              <p className="font-medium">{fmtDate(user.createdAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Last signed in</p>
              <p className="font-medium">{fmtDate(user.lastSignedIn)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Saved plans</p>
              <p className="font-medium">{planCount}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Stripe customer</p>
              <p className="font-medium text-xs break-all">{user.stripeCustomerId ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Subscription ends</p>
              <p className="font-medium">{fmtDate(user.subscriptionEndsAt ?? null)}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Plan tier</p>
              <Select
                value={user.planTier}
                onValueChange={(v) => setTier.mutate({ userId, tier: v as "free" | "basic" | "pro" })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Role</p>
              <Select
                value={user.role}
                onValueChange={(v) => setRole.mutate({ userId, role: v as "user" | "admin" })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Beta override</p>
              <div className="flex items-center gap-2 h-8">
                <Switch
                  checked={user.betaOverride === true}
                  onCheckedChange={(checked) =>
                    setBeta.mutate({ userId, betaOverride: checked ? true : null })
                  }
                />
                <span className="text-xs text-muted-foreground">
                  {user.betaOverride === true ? "On" : user.betaOverride === false ? "Off" : "Global"}
                </span>
              </div>
            </div>
          </div>

          {/* Payment history */}
          {stripeEvents.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">Payment history</p>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stripeEvents.map((ev) => (
                      <TableRow key={ev.id}>
                        <TableCell className="text-xs">{ev.eventType}</TableCell>
                        <TableCell>{ev.tier ? <TierBadge tier={ev.tier} /> : "—"}</TableCell>
                        <TableCell className="text-xs">
                          {ev.amountCents ? fmtCents(ev.amountCents) : "—"}
                        </TableCell>
                        <TableCell className="text-xs">{fmtDate(ev.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Feature usage */}
          {recentPageViews.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">Feature usage (top pages)</p>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Page</TableHead>
                      <TableHead>Views</TableHead>
                      <TableHead>Last seen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentPageViews.map((pv) => (
                      <TableRow key={pv.path}>
                        <TableCell className="text-xs font-mono">{pv.path}</TableCell>
                        <TableCell>{pv.views}</TableCell>
                        <TableCell className="text-xs">{fmtDate(pv.lastSeen)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Analytics tab ────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const [rangeKey, setRangeKey] = useState<RangeKey>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const range = useMemo(() => {
    if (rangeKey === "custom" && customFrom && customTo) {
      return getRange("custom", { from: new Date(customFrom), to: new Date(customTo) });
    }
    return getRange(rangeKey);
  }, [rangeKey, customFrom, customTo]);

  const summary = trpc.admin.analytics.summary.useQuery({ from: range.from, to: range.to });
  const timeSeries = trpc.admin.analytics.timeSeries.useQuery({ from: range.from, to: range.to });

  const s = summary.data;

  // Merge time-series arrays by day
  const chartData = useMemo(() => {
    if (!timeSeries.data) return [];
    const { pvSeries, signupSeries, revSeries } = timeSeries.data;
    const map: Record<string, { day: string; views: number; uniqueVisitors: number; signups: number; revenueCents: number }> = {};
    for (const r of pvSeries) {
      map[r.day] = { day: r.day, views: r.views, uniqueVisitors: r.uniqueVisitors, signups: 0, revenueCents: 0 };
    }
    for (const r of signupSeries) {
      if (!map[r.day]) map[r.day] = { day: r.day, views: 0, uniqueVisitors: 0, signups: 0, revenueCents: 0 };
      map[r.day].signups = r.signups;
    }
    for (const r of revSeries) {
      if (!map[r.day]) map[r.day] = { day: r.day, views: 0, uniqueVisitors: 0, signups: 0, revenueCents: 0 };
      map[r.day].revenueCents = Number(r.revenueCents ?? 0);
    }
    return Object.values(map).sort((a, b) => a.day.localeCompare(b.day));
  }, [timeSeries.data]);

  return (
    <div className="space-y-6">
      {/* Date range picker */}
      <div className="flex flex-wrap items-center gap-2">
        {(["24h", "7d", "30d", "1y", "custom"] as RangeKey[]).map((k) => (
          <Button
            key={k}
            variant={rangeKey === k ? "default" : "outline"}
            size="sm"
            onClick={() => setRangeKey(k)}
            className={rangeKey === k ? "bg-[#1B4332] text-white hover:bg-[#1B4332]/90" : ""}
          >
            {k === "24h" ? "24 hrs" : k === "7d" ? "7 days" : k === "30d" ? "30 days" : k === "1y" ? "1 year" : "Custom"}
          </Button>
        ))}
        {rangeKey === "custom" && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 text-sm w-36"
            />
            <span className="text-muted-foreground text-sm">to</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 text-sm w-36"
            />
          </div>
        )}
      </div>

      {/* Metric cards */}
      {summary.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading metrics…
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <MetricCard icon={Eye} label="Page Views" value={s?.totalPageViews ?? 0} />
          <MetricCard icon={Users} label="Unique Visitors" value={s?.uniqueVisitors ?? 0} />
          <MetricCard icon={UserPlus} label="New Signups" value={s?.newSignups ?? 0} color="text-blue-600" />
          <MetricCard
            icon={DollarSign}
            label="Revenue"
            value={fmtCents(s?.revenueCents ?? 0)}
            color="text-emerald-700"
          />
          <MetricCard
            icon={RefreshCw}
            label="Resubscriptions"
            value={s?.resubCount ?? 0}
            sub={s?.resubRevenueCents ? fmtCents(s.resubRevenueCents) : undefined}
            color="text-blue-600"
          />
          <MetricCard
            icon={XCircle}
            label="Cancellations"
            value={s?.cancellations ?? 0}
            color="text-red-500"
          />
          <MetricCard
            icon={Users}
            label="Free Users"
            value={s?.usersByTier?.free ?? 0}
            color="text-gray-500"
          />
          <MetricCard
            icon={TrendingUp}
            label="Paying Users"
            value={(s?.usersByTier?.basic ?? 0) + (s?.usersByTier?.pro ?? 0)}
            sub={`Basic: ${s?.usersByTier?.basic ?? 0} · Pro: ${s?.usersByTier?.pro ?? 0}`}
            color="text-emerald-700"
          />
        </div>
      )}

      {/* Traffic chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Traffic & Signups</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="views" name="Page Views" stroke="#1B4332" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="uniqueVisitors" name="Unique Visitors" stroke="#6EE7B7" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="signups" name="Signups" stroke="#3B82F6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Revenue chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Revenue (USD)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `$${(v / 100).toFixed(0)}`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmtCents(v)} />
                <Bar dataKey="revenueCents" name="Revenue" fill="#1B4332" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Users by tier donut-style breakdown */}
      {s && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Users by Tier (current)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6">
              {["free", "basic", "pro"].map((tier) => {
                const n = s.usersByTier?.[tier] ?? 0;
                const total = Object.values(s.usersByTier ?? {}).reduce((a, b) => a + b, 0) || 1;
                const pct = Math.round((n / total) * 100);
                return (
                  <div key={tier} className="flex flex-col items-center gap-1">
                    <TierBadge tier={tier} />
                    <p className="text-2xl font-bold">{n}</p>
                    <p className="text-xs text-muted-foreground">{pct}%</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Users tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | "free" | "basic" | "pro">("all");
  const [page, setPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.admin.users.list.useQuery({
    search: search || undefined,
    tier: tierFilter,
    page,
    pageSize: 50,
  });

  const setTier = trpc.admin.users.setTier.useMutation({
    onSuccess: () => {
      toast.success("Tier updated");
      utils.admin.users.list.invalidate();
    },
  });

  const setBeta = trpc.admin.users.setBeta.useMutation({
    onSuccess: () => {
      toast.success("Beta override updated");
      utils.admin.users.list.invalidate();
    },
  });

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-8 h-9"
          />
        </div>
        <Select value={tierFilter} onValueChange={(v) => { setTierFilter(v as typeof tierFilter); setPage(1); }}>
          <SelectTrigger className="w-32 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tiers</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="basic">Basic</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">
          {data?.total ?? 0} users
        </span>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>User</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Beta</TableHead>
              <TableHead>Signed up</TableHead>
              <TableHead>Last seen</TableHead>
              <TableHead>Sub ends</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading…
                </TableCell>
              </TableRow>
            ) : data?.users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              data?.users.map((u) => (
                <TableRow key={u.id} className="hover:bg-muted/20">
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{u.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{u.email ?? "—"}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={u.planTier}
                      onValueChange={(v) => setTier.mutate({ userId: u.id, tier: v as "free" | "basic" | "pro" })}
                    >
                      <SelectTrigger className="h-7 w-24 text-xs border-0 p-0 shadow-none focus:ring-0">
                        <TierBadge tier={u.planTier} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={u.betaOverride === true}
                      onCheckedChange={(checked) =>
                        setBeta.mutate({ userId: u.id, betaOverride: checked ? true : null })
                      }
                      className="scale-75"
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(u.createdAt)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(u.lastSignedIn)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.subscriptionEndsAt ? fmtDate(u.subscriptionEndsAt) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setSelectedUserId(u.id)}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* User detail modal */}
      {selectedUserId !== null && (
        <UserDetailModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
      )}
    </div>
  );
}

// ─── Main admin page ──────────────────────────────────────────────────────────

export default function Admin() {
  const { data: me, isLoading: loading } = trpc.auth.me.useQuery();
  const { data: debugInfo } = trpc.auth.debug.useQuery();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"analytics" | "users">("analytics");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!me || me.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <Shield className="w-10 h-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Admin access required</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          This page is restricted to administrators. If you believe this is an error, contact support.
        </p>
        <Button variant="outline" onClick={() => navigate("/overview")}>
          Go to overview
        </Button>
        {debugInfo && (
          <div className="mt-4 p-3 bg-muted rounded text-xs text-left font-mono max-w-sm w-full">
            <div className="font-semibold mb-1 text-muted-foreground">Auth Debug Info</div>
            <div>hasAuthHeader: {String(debugInfo.hasAuthHeader)}</div>
            <div>clerkUserId: {debugInfo.clerkUserId ?? "null"}</div>
            <div>userId: {String(debugInfo.userId)}</div>
            <div>email: {debugInfo.email ?? "null"}</div>
            <div>role: {debugInfo.role ?? "null"}</div>
            <div>dbAvailable: {String((debugInfo as any).dbAvailable)}</div>
            <div>hasDatabaseUrl: {String((debugInfo as any).hasDatabaseUrl)}</div>
            <div>databaseName: {String((debugInfo as any).databaseName)}</div>
            <div>directLookup: {JSON.stringify((debugInfo as any).directLookup)}</div>
            <div>lookupError: {String((debugInfo as any).lookupError)}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1B4332] font-serif">Admin Portal</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Analytics & user management</p>
        </div>
        <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700">
          <Shield className="w-3 h-3 mr-1" />
          Admin
        </Badge>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-border pb-0">
        <button
          onClick={() => setTab("analytics")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "analytics"
              ? "border-[#1B4332] text-[#1B4332]"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          Analytics
        </button>
        <button
          onClick={() => setTab("users")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "users"
              ? "border-[#1B4332] text-[#1B4332]"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="w-4 h-4" />
          Users
        </button>
      </div>

      {/* Tab content */}
      {tab === "analytics" ? <AnalyticsTab /> : <UsersTab />}
    </div>
  );
}
