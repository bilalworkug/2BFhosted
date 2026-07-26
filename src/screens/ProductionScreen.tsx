import { useEffect, useState, useMemo } from "react";
import { supabase } from "../supabase";
import type { Product, Box } from "../supabase";
import { useToast } from "../Toast";
import { useLanguage } from "../LanguageContext";
import { useAuth } from "../auth";
import { CheckCircle2, AlertTriangle, Package, Activity, Box as BoxIcon, RefreshCw, Clock, ArrowRight, Calendar, Hash, AlignLeft, Barcode, Save, Wand2, LayoutDashboard, Target, TrendingUp, Search } from "lucide-react";
import { playScanSuccess, playScanAlreadyExists, playScanError } from "../audio";

type Tab = "dashboard" | "scan" | "database";

interface ResultBanner { type: "success" | "info" | "error"; message: string; detail?: string; }

/* ───────── UI COMPONENTS for Dashboard ───────── */

const CircularGauge = ({ value, label, sublabel, color, max = 100 }: { value: number; label: string; sublabel: string; color: string; max?: number }) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const r = 40;
  const c = Math.PI * (r * 2);
  const offset = ((100 - pct) / 100) * c;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32 flex flex-col items-center justify-center mb-2">
        <svg className="absolute inset-0 w-full h-full -rotate-90">
          <circle cx="64" cy="64" r={r} fill="none" stroke="#F1F5F9" strokeWidth="8" />
          <circle 
            cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="8" 
            strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" 
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <span className="text-2xl font-black text-slate-800">{value}</span>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">{sublabel}</span>
    </div>
  );
};

const TopProductRow = ({ rank, name, value, trendData, color }: { rank: number; name: string; value: number; trendData: number[]; color: string }) => {
  const points = trendData.map((v, i) => `${(i / (trendData.length - 1)) * 60},${24 - (v / 100) * 24}`).join(" ");
  return (
    <div className="flex items-center gap-4 py-2 border-b border-slate-50 last:border-b-0">
      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-amber-50 text-amber-600 shrink-0 border border-amber-200">
        #{rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-800 truncate">{name}</div>
        <div className="text-xs text-slate-400">Daily yield</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-bold text-slate-800">{value} units</div>
        <svg width="60" height="24" className="ml-auto mt-1">
          <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="60" cy={24 - (trendData[trendData.length-1] / 100) * 24} r="2" fill={color} />
        </svg>
      </div>
    </div>
  );
};

const ComplianceBar = ({ category, count, pct, color }: { category: string; count: number; pct: number; color: string }) => (
  <div className="flex items-center gap-4 py-1.5">
    <div className="w-24 shrink-0">
      <div className="text-sm font-semibold text-slate-800 truncate">{category}</div>
      <div className="text-[10px] text-slate-400">Target: 500</div>
    </div>
    <div className="w-12 shrink-0 text-right text-sm font-bold text-slate-700">{count}</div>
    <div className="flex-1 h-8 bg-slate-100 relative overflow-hidden flex items-center">
      <div className="absolute top-0 left-0 bottom-0 transition-all duration-1000 flex items-center px-2" style={{ width: `${Math.max(pct, 15)}%`, backgroundColor: color }}>
        <span className="text-[10px] font-bold text-white/90">{pct}%</span>
      </div>
    </div>
  </div>
);

const CycleNode = ({ time, label, isLast }: { time: string; label: string; isLast?: boolean }) => (
  <div className="flex items-center">
    <div className="flex flex-col items-center">
      <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center shadow-sm relative z-10">
        <span className="text-sm font-bold text-slate-700">{time}</span>
      </div>
      <span className="text-[10px] font-semibold text-slate-500 mt-2 uppercase text-center w-20">{label}</span>
    </div>
    {!isLast && (
      <div className="w-12 sm:w-20 h-px bg-slate-300 relative -mt-5">
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-400"></div>
      </div>
    )}
  </div>
);

const DefectBar = ({ label, count, total, color }: { label: string; count: number; total: number; color: string }) => {
  const h = 120;
  const pct = Math.max((count / Math.max(total, 1)) * 100, 5);
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[10px] font-bold text-slate-500">{count}</span>
      <div className="w-10 sm:w-16 bg-slate-100 rounded-sm relative flex items-end" style={{ height: h }}>
        <div className="w-full rounded-sm transition-all duration-1000" style={{ height: `${pct}%`, backgroundColor: color }}></div>
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></span>
        <span className="text-[10px] font-semibold text-slate-600">{label}</span>
      </div>
    </div>
  );
};


/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export function ProductionScreen() {
  const { profile } = useAuth();
  const notify = useToast();
  const { strings } = useLanguage();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState<string>("");
  const [batchNumber, setBatchNumber] = useState("");
  const [manufacturingDate, setManufacturingDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [barcode, setBarcode] = useState("");
  const [count, setCount] = useState(0);
  const [banner, setBanner] = useState<ResultBanner | null>(null);
  const [recentBoxes, setRecentBoxes] = useState<(Box & { product?: Product })[]>([]);

  // Analytics State
  const [totalBoxes, setTotalBoxes] = useState(0);
  const [inStock, setInStock] = useState(0);
  const [qaHold, setQaHold] = useState(0);
  const [productYields, setProductYields] = useState<Record<string, number>>({});

  const loadData = async () => {
    // Load products
    const { data: prodData } = await supabase.from("products").select("*").eq("is_active", true).order("product_code");
    setProducts(prodData as Product[] || []);
    if (prodData && prodData.length > 0 && !productId) setProductId(prodData[0].id);

    // Load recent scans for this user
    if (profile) {
      const { data: boxData } = await supabase
        .from("boxes")
        .select("*")
        .eq("logged_by_user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (boxData && prodData) {
        const enriched = boxData.map((b: any) => ({ ...b, product: prodData.find((p: any) => p.id === b.product_id) }));
        setRecentBoxes(enriched);
        setCount(boxData.filter((b: any) => new Date(b.created_at).toDateString() === new Date().toDateString()).length);
      }
    }

    // Load overall analytics for dashboard
    const { count: tCount } = await supabase.from("boxes").select("*", { count: "exact", head: true });
    const { count: iCount } = await supabase.from("boxes").select("*", { count: "exact", head: true }).eq("status", "in_stock");
    const { count: qCount } = await supabase.from("boxes").select("*", { count: "exact", head: true }).in("status", ["qa_hold", "damaged_pending"]);
    
    setTotalBoxes(tCount || 0);
    setInStock(iCount || 0);
    setQaHold(qCount || 0);

    // Get yields per product
    const { data: yields } = await supabase.from("boxes").select("product_id").order("created_at", { ascending: false }).limit(500);
    const yMap: Record<string, number> = {};
    yields?.forEach((y: any) => { yMap[y.product_id] = (yMap[y.product_id] || 0) + 1; });
    setProductYields(yMap);
  };

  useEffect(() => {
    loadData();
    let sub: any = null;
    if (profile) {
      sub = supabase
        .channel("custom-all-channel")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "boxes" },
          (payload: any) => {
            if (payload.new && payload.new.logged_by_user_id === profile.id) {
               loadData();
            }
          }
        )
        .subscribe();
    }
    return () => { if (sub) sub.unsubscribe(); };
  }, [profile]);

  const generateBarcode = () => {
    const prod = products.find(p => p.id === productId);
    const prefix = prod ? prod.product_code : "BOX";
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    setBarcode(`${prefix}-${timestamp}-${random}`);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !batchNumber || !manufacturingDate || !expiryDate || !barcode) {
      notify("error", "Please fill in all required fields.");
      return;
    }
    if (new Date(expiryDate) <= new Date(manufacturingDate)) {
      notify("error", "Expiry date must be after the manufacturing date.");
      return;
    }

    setBanner(null);
    const { data, error } = await supabase.rpc("log_box", { 
      p_code: barcode, p_product_id: productId, p_batch_number: batchNumber,
      p_manufacturing_date: manufacturingDate, p_expiry_date: expiryDate, p_notes: notes
    });
    
    if (error) { 
      playScanError();
      setBanner({ type: "error", message: error.message }); 
      notify("error", error.message); 
      return; 
    }
    const r = data as any;
    if (r.exists) {
      playScanAlreadyExists();
      setBanner({ type: "info", message: strings.scan.alreadyLogged, detail: `${r.box.product_code} — ${r.box.product_name} • ${r.box.status}` });
      notify("info", r.message);
    } else {
      playScanSuccess();
      setBanner({ type: "success", message: strings.scan.newBox, detail: `${r.box.product_code} — ${r.box.product_name}` });
      notify("success", r.message);
      setBarcode("");
      loadData();
    }
  };

  const topProducts = useMemo(() => {
    return products
      .map(p => ({ p, count: productYields[p.id] || 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [products, productYields]);

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="text-blue-600 w-7 h-7" />
            {strings.production.title}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Monitor yields, log new packages, and track history.</p>
        </div>
        <button 
          onClick={loadData} 
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="flex bg-slate-200/50 p-1.5 rounded-2xl w-fit">
        {([
          ["dashboard", "Dashboard", LayoutDashboard],
          ["scan", "Log Production", Barcode],
          ["database", "Recent Scans", Clock],
        ] as const).map(([t, label, Icon]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              tab === t ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-800 hover:bg-slate-200/50"
            }`}>
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* ═════════════════════════════════════════════════════════
           DASHBOARD TAB (Complex Analytical View)
         ═════════════════════════════════════════════════════════ */}
      {tab === "dashboard" && (
        <div className="space-y-6 animate-slide-down">
          
          {/* Top Row: Circular Gauges & Ranked Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gauges */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="bg-[#4F6BF6] text-white py-2 px-4 rounded-t-xl -mx-6 -mt-6 mb-6 text-sm font-bold uppercase tracking-wider text-center">
                Production Output Stats
              </div>
              <div className="flex flex-wrap items-center justify-around gap-4 pt-4">
                <CircularGauge value={totalBoxes} label="Yield" sublabel="Total output" color="#3B82F6" max={Math.max(1000, totalBoxes)} />
                <CircularGauge value={inStock} label="Stocked" sublabel="Cleared QA" color="#10B981" max={Math.max(100, totalBoxes)} />
                <CircularGauge value={qaHold} label="Pending" sublabel="In transit/QA" color="#EF4444" max={Math.max(50, totalBoxes)} />
              </div>
            </div>

            {/* Ranked List */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Top Products by Yield</h3>
                <span className="text-[10px] font-bold text-slate-400">7-Day Trend</span>
              </div>
              <div className="flex-1 flex flex-col justify-center">
                {topProducts.length > 0 ? topProducts.map((tp, i) => (
                  <TopProductRow 
                    key={tp.p.id} rank={i + 1} name={tp.p.name} value={tp.count} 
                    trendData={[40, 60, 50, 80, 70, 90, tp.count > 0 ? 100 : 20]} 
                    color={i === 0 ? "#10B981" : i === 1 ? "#3B82F6" : "#F59E0B"} 
                  />
                )) : (
                  <div className="text-center text-sm text-slate-400">No production data yet.</div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Row: Bar Charts & Cycle Diagrams */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Horizontal Bars */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">Rate of Target Compliance by Category</h3>
              <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-2 border-b border-slate-100 pb-2">
                <span className="w-24 shrink-0">Category</span>
                <span className="w-12 shrink-0 text-right">Yield</span>
                <span className="flex-1 text-center">Achievement Share</span>
              </div>
              <div className="space-y-3 pt-2">
                <ComplianceBar category="Biscuits" count={Math.floor(totalBoxes * 0.6)} pct={75} color="#10B981" />
                <ComplianceBar category="Pasta" count={Math.floor(totalBoxes * 0.25)} pct={47} color="#F59E0B" />
                <ComplianceBar category="Macaroni" count={Math.floor(totalBoxes * 0.1)} pct={74} color="#3B82F6" />
                <ComplianceBar category="Flour" count={Math.floor(totalBoxes * 0.05)} pct={22} color="#EF4444" />
              </div>
            </div>

            {/* Cycle Diagram & Grouped Bars */}
            <div className="space-y-6 flex flex-col">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 text-center">Avg. Production Cycle Time (in Hours)</h3>
                <div className="flex items-center justify-center overflow-x-auto pb-4">
                  <CycleNode time="0.5h" label="Mixing" />
                  <CycleNode time="2.1h" label="Baking" />
                  <CycleNode time="0.3h" label="Packaging" />
                  <CycleNode time="1.0h" label="QA Check" isLast />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex-1">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 text-center">Defect Rates (Classification)</h3>
                <div className="flex items-end justify-center gap-6 sm:gap-10 pt-4">
                  <DefectBar label="Minor" count={qaHold} total={totalBoxes} color="#10B981" />
                  <DefectBar label="Moderate" count={Math.floor(qaHold * 0.6)} total={totalBoxes} color="#3B82F6" />
                  <DefectBar label="Critical" count={Math.floor(qaHold * 0.1)} total={totalBoxes} color="#EF4444" />
                  <div className="flex flex-col justify-center ml-4 space-y-3">
                    <div className="text-[10px] font-bold flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Minor (16%)</div>
                    <div className="text-[10px] font-bold flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Moderate (48%)</div>
                    <div className="text-[10px] font-bold flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Critical (36%)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ═════════════════════════════════════════════════════════
           SCAN LOG TAB
         ═════════════════════════════════════════════════════════ */}
      {tab === "scan" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-down">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <BoxIcon size={20} className="text-slate-400" />
                Configure & Scan
              </h3>
              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-2">{strings.scan.selectProduct}</label>
                    <select 
                      value={productId} 
                      onChange={e => setProductId(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer"
                      required
                    >
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.product_code} — {p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1"><Hash size={14}/> Batch Number *</label>
                    <input 
                      type="text" value={batchNumber} onChange={e => setBatchNumber(e.target.value)}
                      placeholder="e.g. BATCH-2023-01" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1"><Calendar size={14}/> Manufacturing Date *</label>
                    <input type="date" value={manufacturingDate} onChange={e => setManufacturingDate(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" required />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1"><Calendar size={14}/> Expiry Date *</label>
                    <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" required />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1"><AlignLeft size={14}/> Notes (Optional)</label>
                    <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any production notes..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1"><Barcode size={14}/> Barcode *</label>
                    <div className="flex gap-2">
                      <input type="text" value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Scan or generate barcode" className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono" required />
                      <button type="button" onClick={generateBarcode} className="px-4 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-2xl transition-colors flex items-center gap-2 whitespace-nowrap">
                        <Wand2 size={16} /> Generate
                      </button>
                    </div>
                  </div>
                </div>
                <div className="pt-2">
                  <button type="submit" className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white text-base font-bold rounded-2xl transition-all shadow-md shadow-blue-500/20 active:scale-[0.98] flex items-center justify-center gap-2">
                    <Save size={20} /> Save Registration
                  </button>
                </div>
              </form>
            </div>

            {banner && (
              <div className={`animate-slide-down rounded-2xl p-5 border shadow-sm ${
                banner.type === "success" ? "bg-emerald-50 border-emerald-200" : banner.type === "info" ? "bg-amber-50 border-amber-200" : "bg-rose-50 border-rose-200"
              }`}>
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-xl shrink-0 ${banner.type === "success" ? "bg-emerald-100 text-emerald-600" : banner.type === "info" ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"}`}>
                    {banner.type === "success" ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
                  </div>
                  <div className="pt-0.5">
                    <p className={`text-base font-bold ${banner.type === "success" ? "text-emerald-900" : banner.type === "info" ? "text-amber-900" : "text-rose-900"}`}>{banner.message}</p>
                    {banner.detail && <p className={`text-sm mt-1 font-medium ${banner.type === "success" ? "text-emerald-700" : banner.type === "info" ? "text-amber-700" : "text-rose-700"}`}>{banner.detail}</p>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Stats Area */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-[#1460A5] to-[#124B82] rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg h-full flex flex-col justify-between min-h-[300px]">
              <div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-10 rounded-full -mt-10 -mr-10 pointer-events-none"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-6 text-blue-100 bg-white/10 w-fit px-3 py-1.5 rounded-full border border-white/20 backdrop-blur-sm text-xs font-semibold">
                  <Activity size={14} /> Live Session
                </div>
                <h3 className="text-blue-100 text-sm font-medium mb-1 uppercase tracking-wider">{strings.production.sessionCount}</h3>
                <div className="text-6xl font-extrabold tracking-tight mb-2">{count}</div>
                <p className="text-sm text-blue-200">Boxes successfully logged today.</p>
              </div>
              <div className="relative z-10 mt-10 pt-6 border-t border-white/10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/50 border border-blue-400 flex items-center justify-center font-bold text-sm shrink-0">
                  {profile?.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-blue-200">Logged in operator</div>
                  <div className="font-bold text-sm truncate">{profile?.full_name}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════
           DATABASE TAB
         ═════════════════════════════════════════════════════════ */}
      {tab === "database" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-slide-down">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Clock size={20} className="text-blue-500" />
              Recent Scans Database
            </h3>
          </div>
          <div className="overflow-x-auto">
            {recentBoxes.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Time</th>
                    <th className="px-6 py-4">Barcode Code</th>
                    <th className="px-6 py-4">Product</th>
                    <th className="px-6 py-4 text-right">Live Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentBoxes.map((box) => (
                    <tr key={box.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                        {new Date(box.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-900 font-medium whitespace-nowrap">{box.code}</td>
                      <td className="px-6 py-4 text-slate-700 whitespace-nowrap">
                        {box.product ? `${box.product.product_code} — ${box.product.name}` : 'Unknown'}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {box.status === 'logged' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                            <BoxIcon size={12} /> Waiting for Warehouse
                          </span>
                        ) : box.status === 'in_stock' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={12} /> Moved to Warehouse
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {strings.status[box.status as keyof typeof strings.status] || box.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center text-slate-400">
                <BoxIcon size={48} className="mx-auto mb-4 text-slate-200" />
                <p className="text-base font-medium text-slate-500">No boxes scanned recently.</p>
                <p className="text-sm mt-1">Start scanning to build your production database.</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
