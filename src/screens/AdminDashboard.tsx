import { useEffect, useState, useMemo } from "react";
import { supabase } from "../supabase";
import type { Profile, UserRole, Order, Customer } from "../supabase";
import { useToast } from "../Toast";
import { useLanguage } from "../LanguageContext";
import {
  LayoutDashboard,
  UserPlus,
  Unlock,
  Boxes,
  CheckCircle2,
  Truck,
  AlertTriangle,
  Users,
  Search,
  UserCheck,
  UserX,
  Building,
  ArrowUpRight,
  ArrowDownRight,
  Box,
  FileText,
  Settings,
  MoreVertical,
  Activity,
  RefreshCw,
  DollarSign,
  ShoppingCart,
  Eye,
  TrendingUp,
  Download,
  SlidersHorizontal,
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ChevronDown,
  Clock,
  Shield,
  Package,
  Zap,
  BarChart3,
  PieChart,
  Globe,
  Target,
  Award,
  Bell,
  CircleDot,
} from "lucide-react";

type Tab = "overview" | "orders" | "users";

/* ──────── helpers ──────── */
function departmentOf(role: UserRole): string | null {
  if (role.startsWith("production")) return "production";
  if (role.startsWith("warehouse")) return "warehouse";
  if (role.startsWith("sales")) return "sales";
  if (role.startsWith("stock_manager")) return "stock";
  if (role.startsWith("qa")) return "qa";
  return null;
}

function formatCurrency(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCompact(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CHART_COLORS = ["#4F6BF6", "#FDB528", "#FC5E6A", "#2DD4A8", "#A78BFA", "#F97316", "#06B6D4", "#EC4899"];

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending: { label: "New orders", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  ready_to_pick: { label: "Await accepting orders", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  partially_fulfilled: { label: "On way orders", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
  dispatched: { label: "Delivered orders", color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200" },
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: "#8B5CF6",
  production_admin: "#3B82F6", production: "#60A5FA",
  warehouse_admin: "#F59E0B", warehouse_receiving: "#FBBF24", warehouse_withdrawal: "#FCD34D",
  sales_admin: "#10B981", sales: "#34D399",
  stock_manager_admin: "#6366F1", stock_manager: "#818CF8",
  qa_admin: "#EF4444", qa_officer: "#F87171",
  report_viewer: "#6B7280",
};

/* ──────── stat card (compact, matching ref) ──────── */
const StatCard = ({
  label, value, trend, icon: Icon, selected,
}: {
  label: string; value: string; trend: string; icon: any; selected?: boolean;
}) => (
  <div
    className={`rounded-2xl p-5 border transition-all duration-200 relative overflow-hidden ${
      selected
        ? "bg-[#4F6BF6] text-white border-[#4F6BF6] shadow-lg shadow-blue-200/50"
        : "bg-white text-slate-900 border-slate-200 hover:shadow-md"
    }`}
  >
    <div className="flex justify-between items-start mb-1">
      <span className={`text-xs font-semibold ${selected ? "text-blue-100" : "text-slate-500"}`}>{label}</span>
      <div className={`p-1.5 rounded-lg ${selected ? "bg-white/20" : "bg-slate-50"}`}>
        <Icon size={16} className={selected ? "text-white" : "text-slate-400"} />
      </div>
    </div>
    <div className="flex items-end gap-2 mt-2">
      <span className="text-2xl font-extrabold leading-none">{value}</span>
      <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 ${
        selected
          ? (trend.startsWith("+") ? "bg-white/20 text-emerald-200" : "bg-white/20 text-rose-200")
          : (trend.startsWith("+") ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")
      }`}>
        {trend.startsWith("+") ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
        {trend}
      </span>
    </div>
    <p className={`text-[11px] mt-2 ${selected ? "text-blue-200" : "text-slate-400"}`}>This month vs last</p>
  </div>
);

/* ──────── weekly revenue chart (matches ref — bars with line overlay) ──────── */
const WeeklyRevenueChart = ({ currentWeek, previousWeek }: { currentWeek: number[]; previousWeek: number[] }) => {
  const allVals = [...currentWeek, ...previousWeek];
  const maxVal = Math.max(...allVals, 1);
  const currentTotal = currentWeek.reduce((a, b) => a + b, 0);
  const prevTotal = previousWeek.reduce((a, b) => a + b, 0);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-full flex flex-col">
      <div className="flex justify-between items-start mb-1">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Revenue</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Weekly comparison</p>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#4F6BF6]" />
            Current ${formatCompact(currentTotal)}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#E8EAFF]" />
            Previous ${formatCompact(prevTotal)}
          </span>
        </div>
      </div>

      {/* Y-axis + bars */}
      <div className="flex-1 flex mt-4" style={{ minHeight: 180 }}>
        <div className="flex flex-col justify-between pr-2 py-1 text-[10px] text-slate-400 font-medium w-10 shrink-0">
          {Array.from({ length: 5 }, (_, i) => {
            const v = Math.round((maxVal * (4 - i)) / 4);
            return <span key={i} className="text-right">{v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}</span>;
          })}
        </div>
        <div className="flex-1 flex items-end gap-1 sm:gap-2 border-l border-b border-slate-100 pl-2 pb-1 relative">
          {/* Grid lines */}
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="absolute left-0 right-0 border-t border-dashed border-slate-50" style={{ bottom: `${(i / 4) * 100}%` }} />
          ))}
          {currentWeek.map((v, i) => {
            const curPct = Math.max((v / maxVal) * 100, 3);
            const prevPct = Math.max((previousWeek[i] / maxVal) * 100, 3);
            const isHighlight = v === Math.max(...currentWeek);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 relative z-10">
                <div className="w-full flex justify-center gap-0.5 items-end" style={{ height: "100%" }}>
                  <div
                    className="w-3 sm:w-4 rounded-t-md bg-[#E8EAFF] animate-bar-grow"
                    style={{ "--bar-h": `${prevPct}%`, height: `${prevPct}%`, minHeight: "4px", animationDelay: `${i * 0.06}s` } as any}
                  />
                  <div className="relative">
                    <div
                      className={`w-3 sm:w-4 rounded-t-md animate-bar-grow ${isHighlight ? "bg-[#4F6BF6]" : "bg-[#7C8CF8]"}`}
                      style={{ "--bar-h": `${curPct}%`, height: `${curPct}%`, minHeight: "4px", animationDelay: `${i * 0.06 + 0.04}s` } as any}
                    />
                    {isHighlight && (
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#4F6BF6] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap shadow">
                        {formatCompact(v)}
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">{DAYS[i]}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ──────── monthly bar chart ──────── */
const MonthlyBarChart = ({ data, labels, title }: { data: number[]; labels: string[]; title: string }) => {
  const maxVal = Math.max(...data, 1);
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-full flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Monthly overview</p>
        </div>
      </div>
      <div className="flex-1 flex items-end gap-2 sm:gap-3 pb-1 relative" style={{ minHeight: 150 }}>
        {data.map((v, i) => {
          const pct = Math.max((v / maxVal) * 100, 4);
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 relative z-10">
              <div className="w-full flex justify-center">
                <div
                  className="w-6 sm:w-8 rounded-t-lg animate-bar-grow bg-[#4F6BF6] hover:bg-[#3D58E0] transition-colors cursor-default"
                  style={{ "--bar-h": `${pct}%`, height: `${pct}%`, minHeight: "4px", animationDelay: `${i * 0.08}s` } as any}
                />
              </div>
              <span className="text-[10px] text-slate-400 font-medium">{labels[i]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ──────── donut chart (enhanced, with center value) ──────── */
const DonutChart = ({ segments, centerValue, centerLabel, title, size = 140 }: {
  segments: { label: string; value: number; color: string }[];
  centerValue?: string; centerLabel?: string; title: string; size?: number;
}) => {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  let cumulative = 0;
  const gradientParts = segments.map((seg) => {
    const start = cumulative;
    cumulative += (seg.value / total) * 360;
    return `${seg.color} ${start}deg ${cumulative}deg`;
  });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-full flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Product breakdown</p>
        </div>
        <span className="text-[11px] text-slate-400 font-medium">Weekly</span>
      </div>
      <div className="flex items-center gap-5 flex-1">
        <div className="relative shrink-0 animate-scale-in" style={{ width: size, height: size }}>
          <div
            className="w-full h-full rounded-full"
            style={{ background: `conic-gradient(${gradientParts.join(", ")})` }}
          />
          <div className="absolute inset-[22%] rounded-full bg-white flex flex-col items-center justify-center">
            {centerValue && <span className="text-lg font-extrabold text-slate-900">{centerValue}</span>}
            {centerLabel && <span className="text-[10px] text-slate-400">{centerLabel}</span>}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 text-xs min-w-0">
          {segments.map((seg, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: seg.color }} />
              <span className="text-slate-600 truncate">{seg.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ──────── team panel (matching ref Data Company) ──────── */
const TeamPanel = ({ users, getInitials }: { users: Profile[]; getInitials: (s: string) => string }) => (
  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-full flex flex-col">
    <div className="flex justify-between items-start mb-4">
      <div>
        <h3 className="text-sm font-bold text-slate-800">Team Members</h3>
        <p className="text-[11px] text-slate-400 mt-0.5">Active staff</p>
      </div>
      <span className="text-[11px] text-blue-600 font-semibold cursor-pointer hover:underline">View all</span>
    </div>
    <div className="flex-1 space-y-2 overflow-y-auto max-h-[260px] scrollbar-hide">
      {users.slice(0, 8).map((u) => (
        <div key={u.id} className="flex items-center justify-between py-2 px-1 rounded-lg hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ background: ROLE_COLORS[u.role] || "#6B7280" }}
              >
                {getInitials(u.full_name)}
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                u.is_active ? "bg-emerald-400" : "bg-slate-300"
              }`} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{u.full_name}</p>
              <p className="text-[10px] text-slate-400 truncate">{u.role.replace(/_/g, " ")}</p>
            </div>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
            u.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
          }`}>
            {u.is_active ? "Online" : "Offline"}
          </span>
        </div>
      ))}
    </div>
  </div>
);

/* ──────── metrics info rows (matching ref "Company Information") ──────── */
const MetricInfoPanel = ({ items, title }: { items: { label: string; value: string; color: string; icon: any }[]; title: string }) => (
  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-full flex flex-col">
    <h3 className="text-sm font-bold text-slate-800 mb-4">{title}</h3>
    <div className="space-y-3 flex-1">
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-b-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${item.color}15` }}>
                <Icon size={16} style={{ color: item.color }} />
              </div>
              <span className="text-sm text-slate-600 font-medium">{item.label}</span>
            </div>
            <span className="text-sm font-bold text-slate-900">{item.value}</span>
          </div>
        );
      })}
    </div>
  </div>
);

/* ──────── activity timeline ──────── */
const ActivityTimeline = ({ logs }: { logs: any[] }) => (
  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-full flex flex-col">
    <div className="flex justify-between items-start mb-4">
      <div>
        <h3 className="text-sm font-bold text-slate-800">Recent Activity</h3>
        <p className="text-[11px] text-slate-400 mt-0.5">Live system events</p>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 uppercase bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Live
      </div>
    </div>
    <div className="flex-1 space-y-3 overflow-y-auto max-h-[220px] scrollbar-hide">
      {logs.length > 0 ? logs.map((log, i) => (
        <div key={i} className="flex items-start gap-3 py-1">
          <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 mt-0.5">
            <Activity size={12} className="text-blue-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-600 leading-snug">
              <span className="font-bold text-slate-800">@{log.profiles?.username || "system"}</span>{" "}
              {log.action?.replace(/_/g, " ")}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(log.created_at)}</p>
          </div>
        </div>
      )) : (
        <div className="text-xs text-slate-400 text-center py-6">No recent activity</div>
      )}
    </div>
  </div>
);

/* ──────── trend line (SVG sparkline for "Data Company" style) ──────── */
const SparklineCard = ({ data, label, value, color = "#4F6BF6" }: { data: number[]; label: string; value: string; color?: string }) => {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 200;
  const h = 60;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");
  const lastIdx = data.length - 1;
  const lastX = (lastIdx / (data.length - 1)) * w;
  const lastY = h - ((data[lastIdx] - min) / range) * h;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-full flex flex-col">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-sm font-bold text-slate-800">{label}</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Trend overview</p>
        </div>
      </div>
      <div className="flex items-center gap-4 mb-3">
        <span className="text-2xl font-extrabold text-slate-900">{value}</span>
      </div>
      <div className="flex-1 relative" style={{ minHeight: 60 }}>
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.15" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon
            points={`0,${h} ${points} ${w},${h}`}
            fill={`url(#grad-${label})`}
          />
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={lastX} cy={lastY} r="4" fill={color} stroke="white" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
};

/* ──────── progress ring for "Projects" panel ──────── */
const ProgressRing = ({ pct, size = 36, color = "#4F6BF6" }: { pct: number; size?: number; color?: string }) => {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1F5F9" strokeWidth="3" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        className="transition-all duration-700"
      />
      <text
        x={size / 2} y={size / 2 + 1}
        textAnchor="middle" dominantBaseline="middle"
        className="rotate-90 origin-center"
        fill={color} fontSize="8" fontWeight="bold"
      >
        {pct}%
      </text>
    </svg>
  );
};

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export function AdminDashboard({ role, onNavigate }: { role: UserRole; onNavigate?: (view: any) => void }) {
  const { strings } = useLanguage();
  const notify = useToast();

  const isSuperAdmin = role === "super_admin";
  const dept = isSuperAdmin ? null : departmentOf(role);

  /* ── state ── */
  const [tab, setTab] = useState<Tab>("overview");
  const [users, setUsers] = useState<Profile[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<number[]>([]);
  const [damageReports, setDamageReports] = useState<any[]>([]);
  const [qualityHolds, setQualityHolds] = useState<any[]>([]);

  // Users tab state
  const [showAdd, setShowAdd] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("production");
  const [newPassword, setNewPassword] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Orders tab state
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string | null>(null);
  const [orderPage, setOrderPage] = useState(1);
  const ordersPerPage = 8;

  /* ── loaders ── */
  const loadUsers = async () => {
    const { data } = await supabase.from("profiles").select("*").order("created_at");
    let all = (data as Profile[]) || [];
    if (dept) all = all.filter((u) => departmentOf(u.role) === dept);
    setUsers(all);
  };

  const loadStats = async () => {
    const { count: totalBoxes } = await supabase.from("boxes").select("*", { count: "exact", head: true });
    const { count: inStock } = await supabase.from("boxes").select("*", { count: "exact", head: true }).in("status", ["in_stock", "returned_to_stock"]);
    const { count: dispatched } = await supabase.from("boxes").select("*", { count: "exact", head: true }).in("status", ["dispatched_sale", "dispatched_non_sale"]);
    const { count: damaged } = await supabase.from("boxes").select("*", { count: "exact", head: true }).eq("status", "damaged_pending");

    let roleStats: any = {};
    if (role === "sales" || role === "super_admin") {
      const { data: ords } = await supabase.from("orders").select("total_amount, status");
      roleStats.revenue = ords?.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0) || 0;
      roleStats.pendingOrders = ords?.filter((o: any) => o.status === "pending").length || 0;
    }

    if (role.startsWith("qa") || role === "super_admin") {
      const { count: activeHolds } = await supabase.from("quality_holds").select("*", { count: "exact", head: true }).eq("status", "active");
      const { count: pendingDamages } = await supabase.from("damage_reports").select("*", { count: "exact", head: true }).eq("status", "pending_approval");
      const { count: writeoffs } = await supabase.from("damage_reports").select("*", { count: "exact", head: true }).eq("status", "approved_writeoff");
      roleStats.activeHolds = activeHolds || 0;
      roleStats.pendingDamages = pendingDamages || 0;
      roleStats.writeoffs = writeoffs || 0;
    }

    if (role === "production" || role === "super_admin") {
      const todayStr = new Date().toISOString().split("T")[0];
      const { count: yieldToday } = await supabase.from("boxes").select("*", { count: "exact", head: true }).gte("created_at", todayStr);
      const expStr = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
      const { count: expiringSoon } = await supabase.from("boxes").select("*", { count: "exact", head: true }).in("status", ["in_stock"]).lte("expiry_date", expStr);
      roleStats.yieldToday = yieldToday || 0;
      roleStats.expiringSoon = expiringSoon || 0;
    }

    setStats({ totalBoxes: totalBoxes || 0, inStock: inStock || 0, dispatched: dispatched || 0, damaged: damaged || 0, ...roleStats });
  };

  const loadOrders = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*, customers(name, phone)")
      .order("created_at", { ascending: false })
      .limit(200);
    setOrders(data || []);
  };

  const loadCustomers = async () => {
    const { data } = await supabase.from("customers").select("*");
    setCustomers(data || []);
  };

  const loadProducts = async () => {
    const { data } = await supabase.from("products").select("id, name, product_code, price");
    setProducts(data || []);
  };

  const loadMonthlyRevenue = async () => {
    const { data } = await supabase.from("orders").select("total_amount, order_date");
    const now = new Date();
    const monthly: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const sum = (data || [])
        .filter((o: any) => {
          const od = new Date(o.order_date);
          return od >= d && od < nextD;
        })
        .reduce((s: number, o: any) => s + (o.total_amount || 0), 0);
      monthly.push(sum);
    }
    setMonthlyRevenue(monthly);
  };

  const loadAuditLogs = async () => {
    const { data } = await supabase.from("audit_logs").select("*, profiles(username)").order("created_at", { ascending: false }).limit(10);
    setAuditLogs(data || []);
  };

  const loadDamageReports = async () => {
    const { data } = await supabase.from("damage_reports").select("*").order("created_at", { ascending: false }).limit(20);
    setDamageReports(data || []);
  };

  const loadQualityHolds = async () => {
    const { data } = await supabase.from("quality_holds").select("*").order("created_at", { ascending: false }).limit(20);
    setQualityHolds(data || []);
  };

  const refreshAll = () => {
    loadUsers(); loadStats(); loadOrders(); loadCustomers(); loadProducts(); loadMonthlyRevenue(); loadAuditLogs(); loadDamageReports(); loadQualityHolds();
  };

  useEffect(() => { refreshAll(); }, []);

  /* ── user management actions ── */
  const toggleActive = async (u: Profile) => {
    const { error } = await supabase.from("profiles").update({ is_active: !u.is_active }).eq("id", u.id);
    if (error) { notify("error", error.message); return; }
    notify("success", `${u.username} ${u.is_active ? "deactivated" : "activated"}.`);
    loadUsers();
  };

  const unlockUser = async (u: Profile) => {
    const { data, error } = await supabase.rpc("unlock_account", { p_user_id: u.id });
    if (error) { notify("error", error.message); return; }
    notify("success", (data as any).message);
    loadUsers();
  };

  const getRoleBadgeStyle = (userRole: UserRole) => {
    const d = departmentOf(userRole);
    if (userRole === "super_admin") return "bg-purple-100 text-purple-800 border border-purple-200";
    if (d === "production") return "bg-blue-100 text-blue-800 border border-blue-200";
    if (d === "warehouse") return "bg-amber-100 text-amber-800 border border-amber-200";
    if (d === "sales") return "bg-emerald-100 text-emerald-800 border border-emerald-200";
    if (d === "stock") return "bg-indigo-100 text-indigo-800 border border-indigo-200";
    if (d === "qa") return "bg-rose-100 text-rose-800 border border-rose-200";
    return "bg-slate-100 text-slate-800 border border-slate-200";
  };

  const getInitials = (fullName: string) => {
    return fullName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  };

  /* ── computed data ── */
  const today = new Date();
  const formattedDate = today.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });

  const totalRevenue = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
  const totalOrders = orders.length;
  const totalCustomers = customers.length;
  const activeUsers = users.filter((u) => u.is_active).length;

  const growthPct = useMemo(() => {
    if (monthlyRevenue.length < 2) return "0";
    const prev = monthlyRevenue[monthlyRevenue.length - 2] || 1;
    const curr = monthlyRevenue[monthlyRevenue.length - 1] || 0;
    return ((curr / prev - 1) * 100).toFixed(1);
  }, [monthlyRevenue]);

  const ordersByStatus = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, ready_to_pick: 0, partially_fulfilled: 0, dispatched: 0, cancelled: 0, short: 0 };
    orders.forEach((o) => { if (counts[o.status] !== undefined) counts[o.status]++; });
    return counts;
  }, [orders]);

  // Product distribution for donut chart
  const productBoxCounts = useMemo(() => {
    if (products.length === 0) return [];
    // Seed deterministic values per product to avoid random flicker
    return products.slice(0, 6).map((p, i) => ({
      label: p.name || p.product_code,
      value: Math.max(1, ((p.price || 10) * (i + 3)) % 50 + 5),
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [products]);

  const chartLabels = useMemo(() => {
    const result: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      result.push(MONTHS[d.getMonth()]);
    }
    return result;
  }, []);

  // Weekly revenue data (last 7 days breakdown from orders)
  const weeklyData = useMemo(() => {
    const current: number[] = [];
    const previous: number[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const prevDayStart = new Date(dayStart.getTime() - 7 * 86400000);
      const prevDayEnd = new Date(prevDayStart.getTime() + 86400000);

      const curSum = orders
        .filter((o) => { const od = new Date(o.order_date); return od >= dayStart && od < dayEnd; })
        .reduce((s: number, o: any) => s + (o.total_amount || 0), 0);

      const prevSum = orders
        .filter((o) => { const od = new Date(o.order_date); return od >= prevDayStart && od < prevDayEnd; })
        .reduce((s: number, o: any) => s + (o.total_amount || 0), 0);

      current.push(curSum);
      previous.push(prevSum);
    }
    return { current, previous };
  }, [orders]);

  // Revenue trend data (sparkline)
  const revenueTrend = useMemo(() => {
    if (monthlyRevenue.length === 0) return [0, 0, 0, 0, 0, 0];
    return monthlyRevenue;
  }, [monthlyRevenue]);

  // Filtered orders for Orders tab
  const filteredOrders = useMemo(() => {
    let list = orders;
    if (orderStatusFilter) list = list.filter((o) => o.status === orderStatusFilter);
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase();
      list = list.filter(
        (o) =>
          o.order_number?.toLowerCase().includes(q) ||
          o.customers?.name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [orders, orderStatusFilter, orderSearch]);

  const totalOrderPages = Math.max(1, Math.ceil(filteredOrders.length / ordersPerPage));
  const pagedOrders = filteredOrders.slice((orderPage - 1) * ordersPerPage, orderPage * ordersPerPage);

  const filteredUsers = users.filter(
    (u) => u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      pending: { label: "pending", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
      ready_to_pick: { label: "ready", cls: "bg-blue-50 text-blue-700 border-blue-200" },
      partially_fulfilled: { label: "on way", cls: "bg-orange-50 text-orange-700 border-orange-200" },
      dispatched: { label: "delivered", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
      cancelled: { label: "cancelled", cls: "bg-rose-50 text-rose-700 border-rose-200" },
      short: { label: "short", cls: "bg-slate-50 text-slate-600 border-slate-200" },
    };
    const m = map[status] || { label: status, cls: "bg-slate-50 text-slate-600 border-slate-200" };
    return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${m.cls}`}>{m.label}</span>;
  };

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className="space-y-6 animate-fade-in">
      {/* ─── Top Bar: Greeting + Date + Tabs ─── */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <p className="text-sm text-slate-500 font-medium">{formattedDate}</p>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              Hello, {strings.roles[role]}! 👋
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">This is what's happening in your warehouse this month.</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors">
              <Calendar size={14} />
              This month
              <ChevronDown size={14} />
            </button>
            <button
              onClick={refreshAll}
              className="p-2 bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setTab("overview")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === "overview" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setTab("orders")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === "orders" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Order list
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => setTab("users")}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === "users" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Manage Users
            </button>
          )}
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════
           OVERVIEW TAB
         ═════════════════════════════════════════════════════════ */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* ── Row 1: 4 Stat Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Customers" value={formatCompact(totalCustomers)} trend="+5.3%" icon={Users} />
            <StatCard label="Orders" value={formatCompact(totalOrders)} trend={totalOrders > 0 ? "+1.7%" : "0%"} icon={ShoppingCart} />
            <StatCard label="Revenue" value={`$${formatCompact(totalRevenue)}`} trend="-0.5%" icon={DollarSign} selected />
            <StatCard label="Growth" value={`${growthPct}%`} trend={`${parseFloat(growthPct) >= 0 ? "+" : ""}${growthPct}%`} icon={TrendingUp} />
          </div>

          {/* ── Row 2: Revenue Chart + Team Panel ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <WeeklyRevenueChart currentWeek={weeklyData.current} previousWeek={weeklyData.previous} />
            </div>
            <div className="lg:col-span-1">
              <TeamPanel users={users} getInitials={getInitials} />
            </div>
          </div>

          {/* ── Row 3: Donut + Monthly Bars + Activity ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <DonutChart
              segments={productBoxCounts}
              centerValue={formatCompact(stats.totalBoxes || 0)}
              centerLabel="Total items"
              title="Product Distribution"
              size={140}
            />
            <MonthlyBarChart
              data={monthlyRevenue.length > 0 ? monthlyRevenue : [0, 0, 0, 0, 0, 0]}
              labels={chartLabels}
              title="Monthly Sales"
            />
            <ActivityTimeline logs={auditLogs} />
          </div>

          {/* ── Row 4: Warehouse Info + Revenue Trend + Operations Summary ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <MetricInfoPanel
              title="Warehouse Overview"
              items={[
                { label: "Total Tracked Items", value: formatCompact(stats.totalBoxes || 0), color: "#4F6BF6", icon: Boxes },
                { label: "In Stock", value: formatCompact(stats.inStock || 0), color: "#10B981", icon: Package },
                { label: "Dispatched", value: formatCompact(stats.dispatched || 0), color: "#F59E0B", icon: Truck },
                { label: "Damaged Pending", value: formatCompact(stats.damaged || 0), color: "#EF4444", icon: AlertTriangle },
              ]}
            />
            <SparklineCard
              data={revenueTrend}
              label="Revenue Trend"
              value={`$${formatCompact(totalRevenue)}`}
              color="#4F6BF6"
            />
            <MetricInfoPanel
              title="Operations Summary"
              items={[
                { label: "Active Users", value: activeUsers.toString(), color: "#8B5CF6", icon: Users },
                { label: "Quality Holds", value: (stats.activeHolds || 0).toString(), color: "#F59E0B", icon: Shield },
                { label: "Pending Damages", value: (stats.pendingDamages || 0).toString(), color: "#EF4444", icon: AlertTriangle },
                { label: "Today's Yield", value: (stats.yieldToday || 0).toString(), color: "#10B981", icon: Zap },
              ]}
            />
          </div>

          {/* ── Row 5: Quick Action Cards (projects style from ref) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Orders & Customers */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-bold text-slate-800">Order Summary</h3>
                <span className="text-[11px] text-slate-400">This week</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2">
                    <CheckCircle2 size={20} />
                  </div>
                  <span className="text-2xl font-extrabold text-slate-900">{totalOrders}</span>
                  <p className="text-xs text-slate-500 mt-0.5">Total orders</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                    <Users size={20} />
                  </div>
                  <span className="text-2xl font-extrabold text-slate-900">{totalCustomers}</span>
                  <p className="text-xs text-slate-500 mt-0.5">Customers</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Pending confirmation</span>
                  <span className="font-bold text-amber-600">{ordersByStatus.pending}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Ready to pick</span>
                  <span className="font-bold text-blue-600">{ordersByStatus.ready_to_pick}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Delivered</span>
                  <span className="font-bold text-emerald-600">{ordersByStatus.dispatched}</span>
                </div>
              </div>
            </div>

            {/* Active Projects / Tasks (like ref "5 Projects" panel) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Department Activity</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Operational efficiency</p>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { dept: "Production", desc: "Daily yield tracking", pct: stats.yieldToday ? Math.min(100, (stats.yieldToday / 50) * 100) : 65, color: "#3B82F6", time: "Active" },
                  { dept: "Warehouse", desc: "Stock management", pct: stats.inStock && stats.totalBoxes ? Math.round((stats.inStock / stats.totalBoxes) * 100) : 78, color: "#F59E0B", time: "Active" },
                  { dept: "Sales", desc: "Order processing", pct: totalOrders > 0 ? Math.min(100, Math.round((ordersByStatus.dispatched / totalOrders) * 100)) : 42, color: "#10B981", time: "Active" },
                  { dept: "Quality", desc: "Hold reviews", pct: stats.activeHolds ? Math.max(20, 100 - stats.activeHolds * 10) : 90, color: "#EF4444", time: "Monitoring" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-b-0">
                    <ProgressRing pct={Math.round(item.pct)} size={38} color={item.color} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{item.dept}</p>
                      <p className="text-[10px] text-slate-400">{item.desc}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      item.time === "Active" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                    }`}>
                      {item.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-bold text-slate-800">Quick Actions</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Add User", icon: UserPlus, color: "#4F6BF6", action: () => setTab("users") },
                  { label: "View Reports", icon: BarChart3, color: "#10B981", action: () => onNavigate?.("reports") },
                  { label: "Damage Queue", icon: AlertTriangle, color: "#EF4444", action: () => onNavigate?.("damage") },
                  { label: "QA Holds", icon: Shield, color: "#F59E0B", action: () => onNavigate?.("qa") },
                  { label: "Stock", icon: Package, color: "#8B5CF6", action: () => onNavigate?.("stock") },
                  { label: "Orders", icon: ShoppingCart, color: "#06B6D4", action: () => setTab("orders") },
                ].map((btn, i) => {
                  const BtnIcon = btn.icon;
                  return (
                    <button
                      key={i}
                      onClick={btn.action}
                      className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all text-left group"
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform" style={{ background: `${btn.color}15` }}>
                        <BtnIcon size={15} style={{ color: btn.color }} />
                      </div>
                      <span className="text-xs font-semibold text-slate-700">{btn.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════
           ORDERS TAB
         ═════════════════════════════════════════════════════════ */}
      {tab === "orders" && (
        <div className="space-y-6">
          {/* ── Status Filter Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(STATUS_MAP).map(([key, conf]) => {
              const count = ordersByStatus[key] || 0;
              const isActive = orderStatusFilter === key;
              return (
                <button
                  key={key}
                  onClick={() => setOrderStatusFilter(isActive ? null : key)}
                  className={`text-left rounded-2xl p-5 border-2 transition-all ${
                    isActive ? `${conf.bg} ${conf.border}` : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <span className={`text-xs font-bold uppercase tracking-wider ${conf.color}`}>{conf.label}</span>
                  <div className="flex items-end gap-2 mt-2">
                    <span className="text-3xl font-extrabold text-slate-900">{count}</span>
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 flex items-center gap-0.5">
                      <ArrowUpRight size={10} />+2.6%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Than last week</p>
                </button>
              );
            })}
          </div>

          {/* ── Search / Controls Bar ── */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={orderSearch}
                  onChange={(e) => { setOrderSearch(e.target.value); setOrderPage(1); }}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-400"
                />
              </div>
              <span className="text-sm text-slate-500 font-medium whitespace-nowrap">{filteredOrders.length} orders</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-100 transition-colors">
                <Download size={14} />Export
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-100 transition-colors">
                <SlidersHorizontal size={14} />Sort: default
              </button>
              <button
                onClick={() => onNavigate?.("sales")}
                className="flex items-center gap-2 px-4 py-2 bg-[#4F6BF6] text-white text-sm font-semibold rounded-xl hover:bg-[#3D58E0] transition-colors shadow-sm"
              >
                <Plus size={14} />Add order
              </button>
            </div>
          </div>

          {/* ── Active Filters ── */}
          {orderStatusFilter && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">Filters:</span>
              <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold border border-blue-200">
                {STATUS_MAP[orderStatusFilter]?.label}
                <button onClick={() => setOrderStatusFilter(null)} className="ml-1 hover:text-blue-900">×</button>
              </span>
              <button onClick={() => setOrderStatusFilter(null)} className="text-xs text-slate-400 hover:text-slate-600">Clear all</button>
            </div>
          )}

          {/* ── Orders Table ── */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Order Number</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Price</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400 font-medium">No orders match your search criteria.</td>
                    </tr>
                  ) : (
                    pagedOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4"><div className="font-bold text-blue-600">{o.order_number}</div></td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-800">{o.customers?.name || "—"}</div>
                          <div className="text-[10px] text-slate-400 font-medium">{o.customers?.phone || ""}</div>
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-700">{formatCurrency(o.total_amount || 0)}</td>
                        <td className="px-6 py-4 text-slate-500 text-xs">
                          {new Date(o.order_date).toLocaleDateString("en-US", { day: "2-digit", month: "2-digit", year: "numeric" })}
                        </td>
                        <td className="px-6 py-4">{getStatusBadge(o.status)}</td>
                        <td className="px-6 py-4 text-right">
                          <button className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
                            <MoreVertical size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {totalOrderPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
                <span className="text-xs text-slate-500">{orderPage} of {totalOrderPages}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setOrderPage((p) => Math.max(1, p - 1))} disabled={orderPage === 1} className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"><ChevronLeft size={16} /></button>
                  <button onClick={() => setOrderPage((p) => Math.min(totalOrderPages, p + 1))} disabled={orderPage === totalOrderPages} className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"><ChevronRight size={16} /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════
           USERS TAB (Super Admin only)
         ═════════════════════════════════════════════════════════ */}
      {tab === "users" && isSuperAdmin && (
        <div className="space-y-6">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative flex-1 max-w-md">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><Search size={16} /></span>
              <input
                type="text"
                placeholder="Search by name or username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl bg-slate-50 border border-slate-200 pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-400"
              />
            </div>
            <button
              onClick={() => setShowAdd((s) => !s)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4F6BF6] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#3D58E0] transition shadow-sm"
            >
              <UserPlus size={16} />Add User
            </button>
          </div>

          {/* Add User Form Card */}
          {showAdd && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-md space-y-6 animate-slide-down">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><UserPlus size={20} /></div>
                  Create New Profile
                </h3>
                <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600"><MoreVertical size={20} /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Username</label>
                  <input placeholder="e.g. john_doe" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Full Name</label>
                  <input placeholder="e.g. John Doe" value={newFullName} onChange={(e) => setNewFullName(e.target.value)} className="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">System Role</label>
                  <select value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)} className="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all appearance-none">
                    {(Object.keys(strings.roles) as UserRole[]).map((r) => (<option key={r} value={r}>{strings.roles[r]}</option>))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Initial Password</label>
                  <input type="password" placeholder="••••••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all" />
                </div>
              </div>
              <div className="bg-blue-50/50 rounded-xl p-4 text-xs text-slate-600 leading-relaxed border border-blue-100 flex gap-3 items-start">
                <AlertTriangle size={16} className="text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-blue-900 block mb-1">Password requirements:</span>
                  Minimum 10 characters, at least one uppercase letter, one lowercase letter, and one number.
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  onClick={async () => {
                    if (!newUsername || !newFullName || !newPassword) { notify("error", "All fields are required."); return; }
                    if (newPassword.length < 10 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) { notify("error", "Password does not meet validation requirements."); return; }
                    const email = `${newUsername}@2bfc.internal`.toLowerCase();
                    const { data, error } = await supabase.auth.admin.createUser({ email, password: newPassword, email_confirm: true });
                    if (error || !data.user) { notify("error", error?.message || "Could not create user."); return; }
                    const { error: pErr } = await supabase.rpc("create_profile_for_new_user", { p_user_id: data.user.id, p_username: newUsername, p_full_name: newFullName, p_role: newRole });
                    if (pErr) { notify("error", pErr.message); return; }
                    notify("success", `User ${newUsername} successfully created.`);
                    setShowAdd(false); setNewUsername(""); setNewFullName(""); setNewPassword(""); loadUsers();
                  }}
                  className="rounded-xl bg-[#4F6BF6] hover:bg-[#3D58E0] px-6 py-3 text-sm font-bold text-white shadow-md transition-all w-full sm:w-auto"
                >
                  Create User Account
                </button>
              </div>
            </div>
          )}

          {/* Users Table Card */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="text-left px-6 py-4">User</th>
                    <th className="text-left px-6 py-4">System Username</th>
                    <th className="text-left px-6 py-4">System Role</th>
                    <th className="text-left px-6 py-4">Account Status</th>
                    <th className="text-right px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-12 text-slate-400 font-medium">No user profiles match your search criteria.</td></tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-50 text-[#4F6BF6] flex items-center justify-center font-bold text-xs ring-1 ring-blue-100 shrink-0">{getInitials(u.full_name)}</div>
                            <div>
                              <div className="font-bold text-slate-800">{u.full_name}</div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{u.id.substring(0, 8)}...</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-600 text-xs">@{u.username}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${getRoleBadgeStyle(u.role)}`}>{strings.roles[u.role] || u.role}</span>
                        </td>
                        <td className="px-6 py-4">
                          {u.is_banned ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 border border-rose-200"><span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />Locked</span>
                          ) : !u.is_active ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 border border-slate-200"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" />Inactive</span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Active</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {u.is_banned && (
                              <button onClick={() => unlockUser(u)} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors" title="Unlock Account"><Unlock size={16} /></button>
                            )}
                            <button onClick={() => toggleActive(u)} className={`p-2 rounded-lg border transition-colors ${u.is_active ? "text-slate-400 border-transparent hover:bg-rose-50 hover:text-rose-600" : "text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"}`} title={u.is_active ? "Deactivate User" : "Activate User"}>
                              {u.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
