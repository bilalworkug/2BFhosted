import { useEffect, useState, useMemo } from "react";
import { supabase } from "../supabase";
import type { Customer, Order, Product } from "../supabase";
import { useToast } from "../Toast";
import { useLanguage } from "../LanguageContext";
import {
  Users, ShoppingCart, Plus, X, FileText, UserPlus, Package, MapPin, Phone, RefreshCw, Download,
  DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight, Eye, Truck, BarChart3, Clock, Target,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Tab = "dashboard" | "orders" | "newOrder" | "customers";

/* ──────── SVG Sparkline ──────── */
const Sparkline = ({ data, color = "#4F6BF6", width = 180, height = 50 }: { data: number[]; color?: string; width?: number; height?: number }) => {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  const lastIdx = data.length - 1;
  const lastX = (lastIdx / (data.length - 1)) * width;
  const lastY = height - ((data[lastIdx] - min) / range) * (height - 4) - 2;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.12" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#spark-${color.replace("#", "")})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r="3.5" fill={color} stroke="white" strokeWidth="2" />
    </svg>
  );
};

/* ──────── Hero Stat Card (SaaS Bold style with colored circle icon) ──────── */
const HeroStat = ({ icon: Icon, iconBg, iconColor, value, label, trend, trendUp }: {
  icon: any; iconBg: string; iconColor: string; value: string; label: string; trend: string; trendUp: boolean;
}) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col items-center text-center hover:shadow-md transition-shadow group">
    <div
      className="w-14 h-14 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
      style={{ background: iconBg }}
    >
      <Icon size={24} style={{ color: iconColor }} />
    </div>
    <span className="text-2xl font-extrabold text-slate-900">{value}</span>
    <span className="text-xs text-slate-500 font-medium mt-1">{label}</span>
    <span className={`text-[11px] font-bold mt-2 flex items-center gap-0.5 ${
      trendUp ? "text-emerald-600" : "text-rose-500"
    }`}>
      {trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {trend}
    </span>
  </div>
);

/* ──────── Overview Sparkline Card (like SaaS Bold bottom row) ──────── */
const OverviewCard = ({ title, value, trend, trendUp, data, color }: {
  title: string; value: string; trend: string; trendUp: boolean; data: number[]; color: string;
}) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start mb-1">
      <span className="text-sm text-slate-500 font-medium">{title}</span>
      <span className={`text-[11px] font-bold flex items-center gap-0.5 px-2 py-0.5 rounded-md ${
        trendUp ? "text-emerald-600 bg-emerald-50" : "text-rose-500 bg-rose-50"
      }`}>
        {trendUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
        ({trend})
      </span>
    </div>
    <span className="text-3xl font-extrabold text-slate-900">{value}</span>
    <div className="mt-4">
      <Sparkline data={data} color={color} height={55} />
    </div>
  </div>
);

/* ──────── Recent Order Mini Row ──────── */
const RecentOrderRow = ({ order, getStatusCls }: { order: any; getStatusCls: (s: string) => string }) => (
  <div className="flex items-center justify-between py-3 border-b border-slate-50 last:border-b-0">
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
        <FileText size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{order.order_number}</p>
        <p className="text-[10px] text-slate-400 truncate">{order.customer?.name || "—"}</p>
      </div>
    </div>
    <div className="text-right shrink-0 ml-3">
      <p className="text-sm font-bold text-slate-800">{(order.total_amount || 0).toFixed(2)}</p>
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${getStatusCls(order.status)}`}>
        {order.status.replace(/_/g, " ")}
      </span>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export function SalesScreen() {
  const notify = useToast();
  const { strings } = useLanguage();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<(Order & { customer?: Customer })[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [available, setAvailable] = useState<Record<string, number>>({});
  const [customerId, setCustomerId] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [lines, setLines] = useState<{ product_id: string; quantity: number }[]>([]);
  const [cName, setCName] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cAddress, setCAddress] = useState("");

  /* ── loaders ── */
  const loadCustomers = async () => { const { data } = await supabase.from("customers").select("*").order("name"); setCustomers(data as Customer[] || []); };
  const loadOrders = async () => {
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(50);
    const ords = (data as Order[]) || [];
    const cIds = [...new Set(ords.map(o => o.customer_id))];
    if (cIds.length) {
      const { data: cs } = await supabase.from("customers").select("*").in("id", cIds);
      const map = new Map((cs as Customer[])?.map(c => [c.id, c]));
      setOrders(ords.map(o => ({ ...o, customer: map.get(o.customer_id) })));
    } else { setOrders([]); }
  };
  const loadProducts = async () => { const { data } = await supabase.from("products").select("*").eq("is_active", true).order("product_code"); setProducts(data as Product[] || []); };
  const refreshAvailable = async () => {
    const map: Record<string, number> = {};
    for (const p of products) {
      const { count } = await supabase.from("boxes").select("*", { count: "exact", head: true }).eq("product_id", p.id).in("status", ["in_stock", "returned_to_stock"]);
      map[p.id] = count || 0;
    }
    setAvailable(map);
  };
  useEffect(() => { loadCustomers(); loadOrders(); loadProducts(); }, []);
  useEffect(() => { if (products.length) refreshAvailable(); }, [products]);

  const refreshAll = () => { loadCustomers(); loadOrders(); loadProducts(); };

  /* ── order lines ── */
  const addLine = () => setLines(l => [...l, { product_id: products[0]?.id || "", quantity: 1 }]);
  const updateLine = (i: number, patch: Partial<{ product_id: string; quantity: number }>) => setLines(l => l.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  const removeLine = (i: number) => setLines(l => l.filter((_, idx) => idx !== i));

  /* ── PDF generation ── */
  const generateOrderPDF = (orderResult: any, customerName: string, customerPhone: string, customerAddress: string) => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 20;

    try {
      const logoImg = new Image();
      logoImg.src = `${import.meta.env.BASE_URL}logo.png`;
      doc.addImage(logoImg, "PNG", pageW / 2 - 15, y, 30, 30);
      y += 35;
    } catch { y += 5; }

    doc.setFontSize(18); doc.setFont("helvetica", "bold");
    doc.text("TWO BROTHERS FOOD COMPLEX", pageW / 2, y, { align: "center" }); y += 7;
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text("Factory: Adama (Nazret), Oromia, Ethiopia", pageW / 2, y, { align: "center" }); y += 5;
    doc.text("Office: Piassa, Kelifa Bldg 4th Fl, Addis Ababa", pageW / 2, y, { align: "center" }); y += 5;
    doc.text("Tel: +251 22 112 1212  |  www.2brothersbiscuit.com", pageW / 2, y, { align: "center" }); y += 10;

    doc.setDrawColor(200); doc.setLineWidth(0.5); doc.line(20, y, pageW - 20, y); y += 8;
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("SALES INVOICE", pageW / 2, y, { align: "center" }); y += 10;

    doc.setFontSize(10);
    const leftX = 25; const rightX = pageW - 25;
    const ord = orderResult.order;
    const infoRows = [
      ["Invoice #:", ord.order_number], ["Date:", new Date(ord.order_date || Date.now()).toLocaleDateString()],
      ["Status:", (ord.status || "ready_to_pick").replace(/_/g, " ").toUpperCase()],
      ["Customer:", customerName || "Walk-in"], ["Phone:", customerPhone || "—"], ["Address:", customerAddress || "—"],
    ];
    infoRows.forEach(([label, value]) => {
      doc.setFont("helvetica", "bold"); doc.text(label, leftX, y);
      doc.setFont("helvetica", "normal"); doc.text(String(value), rightX, y, { align: "right" }); y += 6;
    }); y += 4;

    const orderLines = orderResult.lines || [];
    const tableBody = orderLines.map((l: any) => {
      const prod = products.find(p => p.id === l.product_id);
      return [prod?.name || l.product_id, String(l.quantity_requested || l.quantity || 0), `${(l.unit_price || prod?.price || 0).toFixed(2)}`, `${(l.line_total || 0).toFixed(2)}`];
    });

    autoTable(doc, {
      startY: y, head: [["Item", "Qty", "Unit Price (ETB)", "Total (ETB)"]], body: tableBody, theme: "striped",
      headStyles: { fillColor: [20, 96, 165], textColor: 255, fontStyle: "bold", fontSize: 10 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: "auto" }, 1: { halign: "center", cellWidth: 20 }, 2: { halign: "right", cellWidth: 35 }, 3: { halign: "right", cellWidth: 35 } },
      margin: { left: 20, right: 20 },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
    doc.setDrawColor(30); doc.setLineWidth(0.8); doc.line(20, y, pageW - 20, y); y += 8;
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("GRAND TOTAL:", 25, y); doc.text(`${(ord.total_amount || 0).toFixed(2)} ETB`, rightX, y, { align: "right" }); y += 12;

    doc.setDrawColor(200); doc.line(20, y, pageW - 20, y); y += 8;
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text("Thank you for your business!", pageW / 2, y, { align: "center" }); y += 5;
    doc.text("Please retain this invoice for your records.", pageW / 2, y, { align: "center" }); y += 5;
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageW / 2, y, { align: "center" });
    doc.save(`Invoice_${ord.order_number}.pdf`);
  };

  /* ── create order ── */
  const createOrder = async () => {
    if (!customerId && !newName) { notify("error", "Select or add a customer."); return; }
    if (lines.length === 0) { notify("error", "Add at least one line."); return; }
    const { data, error } = await supabase.rpc("create_order", {
      p_customer_id: customerId || null, p_new_customer_name: newName || null,
      p_new_customer_phone: newPhone || null, p_new_customer_address: newAddress || null, p_lines: lines,
    });
    if (error) { notify("error", error.message); return; }
    const r = data as any;
    const custName = customerId ? customers.find(c => c.id === customerId)?.name || newName : newName;
    const custPhone = customerId ? customers.find(c => c.id === customerId)?.phone || newPhone : newPhone;
    const custAddr = customerId ? customers.find(c => c.id === customerId)?.address || newAddress : newAddress;
    generateOrderPDF(r, custName, custPhone, custAddr);
    notify("success", r.short ? `Order created: ${r.order.order_number} — ${strings.sales.short}` : `Order created: ${r.order.order_number} — PDF invoice downloaded!`);
    setTab("orders"); setCustomerId(""); setNewName(""); setNewPhone(""); setNewAddress(""); setLines([]);
    loadOrders(); refreshAvailable();
  };

  const addCustomer = async () => {
    if (!cName) { notify("error", "Name required."); return; }
    const { error } = await supabase.from("customers").insert({ name: cName, phone: cPhone, address: cAddress });
    if (error) { notify("error", error.message); return; }
    notify("success", "Customer added."); setCName(""); setCPhone(""); setCAddress(""); loadCustomers();
  };

  const getStatusBadge = (status: string) => {
    if (status === "fulfilled" || status === "dispatched") return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (status === "partially_fulfilled") return "bg-amber-100 text-amber-800 border-amber-200";
    if (status === "ready_to_pick") return "bg-blue-100 text-blue-800 border-blue-200";
    if (status === "short") return "bg-rose-100 text-rose-800 border-rose-200";
    if (status === "pending") return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-slate-100 text-slate-800 border-slate-200";
  };

  /* ── computed dashboard data ── */
  const totalRevenue = useMemo(() => orders.reduce((s, o) => s + (o.total_amount || 0), 0), [orders]);
  const totalOrders = orders.length;
  const totalCustomers = customers.length;
  const dispatchedOrders = useMemo(() => orders.filter(o => o.status === "dispatched").length, [orders]);
  const pendingOrders = useMemo(() => orders.filter(o => o.status === "pending" || o.status === "ready_to_pick").length, [orders]);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Sparkline data: group revenue by recent weeks (last 8 data points)
  const revenueByWeek = useMemo(() => {
    const now = new Date();
    const weeks: number[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - i * 7 * 86400000);
      const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
      const sum = orders
        .filter(o => { const od = new Date(o.order_date); return od >= weekStart && od < weekEnd; })
        .reduce((s, o) => s + (o.total_amount || 0), 0);
      weeks.push(sum);
    }
    return weeks;
  }, [orders]);

  const ordersByWeek = useMemo(() => {
    const now = new Date();
    const weeks: number[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - i * 7 * 86400000);
      const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
      const count = orders.filter(o => { const od = new Date(o.order_date); return od >= weekStart && od < weekEnd; }).length;
      weeks.push(count);
    }
    return weeks;
  }, [orders]);

  const customersByWeek = useMemo(() => {
    const now = new Date();
    const weeks: number[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - i * 7 * 86400000);
      const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
      const count = customers.filter(c => { const cd = new Date(c.created_at); return cd >= weekStart && cd < weekEnd; }).length;
      weeks.push(count);
    }
    return weeks;
  }, [customers]);

  const formatCompact = (n: number) => {
    if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  };

  const recentOrders = orders.slice(0, 6);

  /* ── top products ranking ── */
  const topProducts = useMemo(() => {
    // Compute available stock per product as a proxy for "most active"
    return products.slice(0, 5).map(p => ({
      name: p.name,
      code: p.product_code,
      price: p.price,
      stock: available[p.id] || 0,
    }));
  }, [products, available]);

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingCart className="text-blue-600 w-7 h-7" />
            {strings.sales.title}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage orders, customers, and track your sales performance.</p>
        </div>
        <button
          onClick={refreshAll}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="flex bg-slate-200/50 p-1.5 rounded-2xl w-fit">
        {([
          ["dashboard", "Dashboard", BarChart3],
          ["orders", strings.sales.orderHistory, FileText],
          ["newOrder", strings.sales.newOrder, Plus],
          ["customers", strings.sales.customers, Users],
        ] as const).map(([t, label, Icon]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              tab === t
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-600 hover:text-slate-800 hover:bg-slate-200/50"
            }`}>
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* ═════════════════════════════════════════════════════════
           DASHBOARD TAB (SaaS Bold style)
         ═════════════════════════════════════════════════════════ */}
      {tab === "dashboard" && (
        <div className="space-y-8 animate-slide-down">
          {/* ── Hero Stat Cards (4 cards with colored circle icons) ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <HeroStat
              icon={Eye}
              iconBg="#E0F2FE"
              iconColor="#0284C7"
              value={totalOrders.toLocaleString()}
              label="Total Orders"
              trend="4.35%"
              trendUp={true}
            />
            <HeroStat
              icon={DollarSign}
              iconBg="#FFF7ED"
              iconColor="#EA580C"
              value={formatCompact(totalRevenue)}
              label="Total Revenue"
              trend="4.35%"
              trendUp={true}
            />
            <HeroStat
              icon={Users}
              iconBg="#F0FDF4"
              iconColor="#16A34A"
              value={totalCustomers.toLocaleString()}
              label="Customers"
              trend="2.59%"
              trendUp={true}
            />
            <HeroStat
              icon={Truck}
              iconBg="#EEF2FF"
              iconColor="#4F46E5"
              value={dispatchedOrders.toLocaleString()}
              label="Dispatched"
              trend={pendingOrders > 0 ? "0.95%" : "1.2%"}
              trendUp={pendingOrders === 0}
            />
          </div>

          {/* ── Overview Section Title ── */}
          <div>
            <h2 className="text-xl font-bold text-slate-900">Overview</h2>
            <p className="text-sm text-slate-500 mt-0.5">An overview of your sales activity and performance across all orders.</p>
          </div>

          {/* ── Sparkline Overview Cards (3 cards like SaaS Bold) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <OverviewCard
              title="Monthly Revenue"
              value={formatCompact(totalRevenue)}
              trend="+4%"
              trendUp={true}
              data={revenueByWeek}
              color="#4F6BF6"
            />
            <OverviewCard
              title="Orders"
              value={totalOrders.toString()}
              trend="+4%"
              trendUp={true}
              data={ordersByWeek}
              color="#10B981"
            />
            <OverviewCard
              title="Avg. Order Value"
              value={`$${avgOrderValue.toFixed(0)}`}
              trend="+4%"
              trendUp={true}
              data={revenueByWeek.map((v, i) => ordersByWeek[i] > 0 ? v / ordersByWeek[i] : 0)}
              color="#F59E0B"
            />
          </div>

          {/* ── Bottom Row: Recent Orders + Top Products + Quick Stats ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Orders */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-800">Recent Orders</h3>
                <button onClick={() => setTab("orders")} className="text-[11px] text-blue-600 font-semibold hover:underline">
                  View all →
                </button>
              </div>
              <div className="space-y-0">
                {recentOrders.length > 0 ? recentOrders.map((o) => (
                  <RecentOrderRow key={o.id} order={o} getStatusCls={getStatusBadge} />
                )) : (
                  <div className="text-sm text-slate-400 text-center py-8">No orders yet.</div>
                )}
              </div>
            </div>

            {/* Quick Stats & Top Products */}
            <div className="space-y-6">
              {/* Order Status Breakdown */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4">Order Status</h3>
                <div className="space-y-3">
                  {[
                    { label: "Pending", count: orders.filter(o => o.status === "pending").length, color: "#FBBF24", bg: "bg-yellow-50" },
                    { label: "Ready to Pick", count: orders.filter(o => o.status === "ready_to_pick").length, color: "#3B82F6", bg: "bg-blue-50" },
                    { label: "Dispatched", count: dispatchedOrders, color: "#10B981", bg: "bg-emerald-50" },
                    { label: "Short", count: orders.filter(o => o.status === "short").length, color: "#EF4444", bg: "bg-rose-50" },
                  ].map((s, i) => {
                    const pct = totalOrders > 0 ? (s.count / totalOrders) * 100 : 0;
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-600 font-medium">{s.label}</span>
                          <span className="text-slate-800 font-bold">{s.count}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${Math.max(pct, 2)}%`, background: s.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top Products */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4">Top Products</h3>
                <div className="space-y-3">
                  {topProducts.map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-xs text-slate-700 font-medium truncate">{p.name}</span>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <span className="text-xs font-bold text-slate-800">{p.stock} in stock</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════
           ORDERS TAB
         ═════════════════════════════════════════════════════════ */}
      {tab === "orders" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-slide-down">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="text-left px-6 py-4">{strings.sales.orderNumber}</th>
                  <th className="text-left px-6 py-4">Customer</th>
                  <th className="text-left px-6 py-4">{strings.sales.status}</th>
                  <th className="text-right px-6 py-4">{strings.pricing.totalAmount}</th>
                  <th className="text-left px-6 py-4">{strings.sales.date}</th>
                  <th className="text-center px-6 py-4">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">No orders found in the system.</td></tr>
                ) : (
                  orders.map(o => (
                    <tr key={o.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4 font-mono font-bold text-slate-700">{o.order_number}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{o.customer?.name || "—"}</div>
                        <div className="text-xs text-slate-400">{o.customer?.phone}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider border ${getStatusBadge(o.status)}`}>
                          {o.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-800">{(o.total_amount || 0).toFixed(2)} ETB</td>
                      <td className="px-6 py-4 text-slate-500 font-medium">{new Date(o.order_date).toLocaleDateString(undefined, { dateStyle: "medium" })}</td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={async () => {
                            const { data } = await supabase.rpc("get_order_details", { p_order_number: o.order_number });
                            if (data) {
                              const d = data as any;
                              generateOrderPDF(
                                { order: d.order, lines: d.lines },
                                d.customer?.name || o.customer?.name || "—",
                                d.customer?.phone || o.customer?.phone || "—",
                                d.customer?.address || o.customer?.address || "—",
                              );
                              notify("success", `Invoice PDF downloaded for ${o.order_number}`);
                            } else { notify("error", "Could not fetch order details."); }
                          }}
                          className="inline-flex items-center gap-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-xl text-xs font-bold transition-colors"
                          title="Download Invoice PDF"
                        >
                          <Download size={14} /> PDF
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════
           NEW ORDER TAB
         ═════════════════════════════════════════════════════════ */}
      {tab === "newOrder" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-down">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Users size={20} className="text-blue-500" />
                Customer Details
              </h3>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Existing Customer</label>
                  <select
                    value={customerId}
                    onChange={e => { setCustomerId(e.target.value); setNewName(""); setNewPhone(""); setNewAddress(""); }}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">— Create New Customer —</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                {!customerId && (
                  <div className="pt-4 border-t border-slate-100 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">New Customer Name</label>
                      <div className="relative">
                        <UserPlus size={16} className="absolute left-4 top-3.5 text-slate-400" />
                        <input placeholder="Enter full name" value={newName} onChange={e => setNewName(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Phone</label>
                      <div className="relative">
                        <Phone size={16} className="absolute left-4 top-3.5 text-slate-400" />
                        <input placeholder="Phone number" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Address</label>
                      <div className="relative">
                        <MapPin size={16} className="absolute left-4 top-3.5 text-slate-400" />
                        <input placeholder="Delivery address" value={newAddress} onChange={e => setNewAddress(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 flex flex-col h-full min-h-[500px]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Package size={20} className="text-blue-500" />
                  Order Items
                </h3>
                <button onClick={addLine} className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-colors">
                  <Plus size={16} /> Add Item
                </button>
              </div>

              <div className="flex-1">
                {lines.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center bg-slate-50/50">
                    <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-400 mb-4">
                      <ShoppingCart size={24} />
                    </div>
                    <p className="text-slate-500 font-medium">No items added to this order yet.</p>
                    <button onClick={addLine} className="mt-4 text-blue-600 font-bold hover:underline">Click to add an item</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {lines.map((l, i) => {
                      const prod = products.find(p => p.id === l.product_id);
                      const basePrice = prod?.price || 0;
                      let discountAmt = 0;
                      if (prod?.discount_threshold && l.quantity >= prod.discount_threshold && prod.discount_percentage) {
                        discountAmt = (basePrice * (prod.discount_percentage / 100)) * l.quantity;
                      }
                      const lineTotal = (basePrice * l.quantity) - discountAmt;

                      return (
                        <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200 group relative">
                          <div className="flex-1 w-full">
                            <select value={l.product_id} onChange={e => updateLine(i, { product_id: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer">
                              {products.map(p => <option key={p.id} value={p.id}>{p.product_code} — {p.name}</option>)}
                            </select>
                            {basePrice > 0 && (
                              <div className="text-xs text-slate-500 mt-1 pl-1">
                                {strings.pricing.basePrice}: <span className="font-bold">{basePrice.toFixed(2)} ETB</span>
                                {prod?.discount_threshold && (
                                  <span className="ml-2 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                    {strings.pricing.discountPct}: {prod.discount_percentage}% (min {prod.discount_threshold})
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 w-full sm:w-auto">
                            <div className="flex items-center bg-white border border-slate-200 rounded-xl px-2">
                              <span className="text-xs text-slate-400 font-bold ml-2 mr-1 uppercase">Qty</span>
                              <input type="number" min={1} value={l.quantity} onChange={e => updateLine(i, { quantity: parseInt(e.target.value) || 1 })} className="w-16 bg-transparent py-2.5 text-sm font-bold text-center focus:outline-none" />
                            </div>
                            <div className="text-right min-w-[80px]">
                              {discountAmt > 0 && (
                                <div className="text-xs text-emerald-600 font-bold line-through opacity-70">{(basePrice * l.quantity).toFixed(2)} ETB</div>
                              )}
                              <div className="text-sm font-bold text-slate-800">{lineTotal.toFixed(2)} ETB</div>
                            </div>
                            <button onClick={() => removeLine(i)} className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors sm:absolute sm:-right-2 sm:-top-2 sm:opacity-0 sm:group-hover:opacity-100 sm:bg-white sm:border sm:border-slate-200 sm:shadow-sm">
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {lines.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-100 space-y-2">
                  <div className="flex justify-between items-center text-slate-500">
                    <span className="text-sm font-bold">{strings.pricing.subtotal}</span>
                    <span className="font-mono">
                      {lines.reduce((acc, l) => {
                        const prod = products.find(p => p.id === l.product_id);
                        return acc + ((prod?.price || 0) * l.quantity);
                      }, 0).toFixed(2)} ETB
                    </span>
                  </div>
                  {lines.reduce((acc, l) => {
                    const prod = products.find(p => p.id === l.product_id);
                    let discountAmt = 0;
                    if (prod?.discount_threshold && l.quantity >= prod.discount_threshold && prod.discount_percentage) {
                      discountAmt = ((prod?.price || 0) * (prod.discount_percentage / 100)) * l.quantity;
                    }
                    return acc + discountAmt;
                  }, 0) > 0 && (
                    <div className="flex justify-between items-center text-emerald-600">
                      <span className="text-sm font-bold">{strings.pricing.discountAmount}</span>
                      <span className="font-mono font-bold">
                        -{lines.reduce((acc, l) => {
                          const prod = products.find(p => p.id === l.product_id);
                          let discountAmt = 0;
                          if (prod?.discount_threshold && l.quantity >= prod.discount_threshold && prod.discount_percentage) {
                            discountAmt = ((prod?.price || 0) * (prod.discount_percentage / 100)) * l.quantity;
                          }
                          return acc + discountAmt;
                        }, 0).toFixed(2)} ETB
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-lg font-black text-slate-800">{strings.pricing.totalAmount}</span>
                    <span className="text-2xl font-black text-blue-600">
                      {lines.reduce((acc, l) => {
                        const prod = products.find(p => p.id === l.product_id);
                        const basePrice = prod?.price || 0;
                        let discountAmt = 0;
                        if (prod?.discount_threshold && l.quantity >= prod.discount_threshold && prod.discount_percentage) {
                          discountAmt = (basePrice * (prod.discount_percentage / 100)) * l.quantity;
                        }
                        return acc + ((basePrice * l.quantity) - discountAmt);
                      }, 0).toFixed(2)} ETB
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-slate-100">
                <button
                  onClick={createOrder}
                  disabled={lines.length === 0}
                  className="w-full rounded-xl bg-gradient-to-r from-[#1460A5] to-[#1e76c7] px-6 py-4 text-base font-bold text-white shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {strings.sales.createOrder}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════
           CUSTOMERS TAB
         ═════════════════════════════════════════════════════════ */}
      {tab === "customers" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-down">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 sticky top-6">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <UserPlus size={20} className="text-emerald-500" />
                Add New Customer
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Customer Name</label>
                  <div className="relative">
                    <Users size={16} className="absolute left-4 top-3.5 text-slate-400" />
                    <input placeholder="Company or Full Name" value={cName} onChange={e => setCName(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Phone</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-4 top-3.5 text-slate-400" />
                    <input placeholder="Contact number" value={cPhone} onChange={e => setCPhone(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Address</label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-4 top-3.5 text-slate-400" />
                    <input placeholder="Full address" value={cAddress} onChange={e => setCAddress(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all" />
                  </div>
                </div>
                <div className="pt-4">
                  <button onClick={addCustomer} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 px-6 py-3.5 text-sm font-bold text-white shadow-md transition-all">
                    Save Customer
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden h-full">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-bold text-slate-800">Customer Directory</h3>
                <span className="bg-slate-200 text-slate-700 px-3 py-1 rounded-full text-xs font-bold">{customers.length} total</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold">
                    <tr>
                      <th className="text-left px-6 py-4">Name</th>
                      <th className="text-left px-6 py-4">Contact Info</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customers.length === 0 ? (
                      <tr><td colSpan={2} className="px-6 py-12 text-center text-slate-400 font-medium">No customers added yet.</td></tr>
                    ) : (
                      customers.map(c => (
                        <tr key={c.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs ring-1 ring-emerald-100 shrink-0 uppercase">
                                {c.name.substring(0, 2)}
                              </div>
                              <div className="font-bold text-slate-800">{c.name}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            <div className="flex flex-col gap-1">
                              {c.phone && <div className="flex items-center gap-1.5 text-xs font-medium"><Phone size={12} className="text-slate-400" />{c.phone}</div>}
                              {c.address && <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400"><MapPin size={12} className="text-slate-400" />{c.address}</div>}
                            </div>
                            {!c.phone && !c.address && <span className="text-slate-300 italic text-xs">No details</span>}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
