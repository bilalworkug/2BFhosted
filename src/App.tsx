import { useState } from "react";
import { AuthProvider, useAuth, useLabels } from "./auth";
import { ToastProvider } from "./Toast";
import { LoginScreen } from "./LoginScreen";
import { useLanguage, LanguageProvider } from "./LanguageContext";
import type { UserRole } from "./supabase";
import {
  LogOut,
  Search,
  LayoutDashboard,
  Box,
  ShoppingCart,
  Layers,
  ShieldCheck,
  BarChart3,
  Settings,
  PackagePlus,
  PackageMinus,
  Bell,
  Menu,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Logo } from "./Logo";
import { ProductionScreen } from "./screens/ProductionScreen";
import { ReceivingScreen } from "./screens/ReceivingScreen";
import { WithdrawalScreen } from "./screens/WithdrawalScreen";
import { SalesScreen } from "./screens/SalesScreen";
import { StockScreen } from "./screens/StockScreen";
import { QAScreen } from "./screens/QAScreen";
import { ReportsScreen } from "./screens/ReportsScreen";
import { CheckerScreen } from "./screens/CheckerScreen";
import { AdminDashboard } from "./screens/AdminDashboard";
import { DamageScreen } from "./screens/DamageScreen";
import { OrderTrackerScreen } from "./screens/OrderTrackerScreen";

type View = "home" | "production" | "receiving" | "withdrawal" | "sales" | "stock" | "qa" | "reports" | "checker" | "admin" | "damage" | "tracker";

function getDefaultView(role: UserRole): View {
  return "admin"; // Always open the main Dashboard by default
}

function Shell() {
  const { profile, loading, signOut } = useAuth();
  const { strings, language, setLanguage } = useLanguage();
  const { roleLabel } = useLabels();
  // Initialize view based on user role when profile is available
  const [view, setView] = useState<View>(() => profile ? getDefaultView(profile.role) : "admin");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [trackerQuery, setTrackerQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><p className="text-slate-500">{strings.common.loading}</p></div>;
  if (!profile) return <LoginScreen />;

  // In case profile loaded after initial render and view is still home (if they didn't manually navigate)
  // We can just rely on the lazy initializer above, but if we want to ensure it, it's fine.
  
  const role = profile.role;
  const navGroups = [
    {
      title: "Overview",
      items: [
        { key: "admin", label: "Dashboard", icon: LayoutDashboard },
        { key: "tracker", label: strings.tracker.title, icon: Search },
        { key: "checker", label: strings.nav.checker, icon: Search },
      ]
    },
    {
      title: "Operations",
      items: [
        { key: "production", label: strings.roles.production, icon: Box },
        { key: "qa", label: strings.roles.qa_officer, icon: ShieldCheck },
      ]
    },
    {
      title: "Warehouse & Logistics",
      items: [
        { key: "receiving", label: strings.roles.warehouse_receiving, icon: PackagePlus },
        { key: "withdrawal", label: strings.roles.warehouse_withdrawal, icon: PackageMinus },
        { key: "stock", label: strings.roles.stock_manager, icon: Layers },
        { key: "damage", label: strings.damage.title, icon: AlertTriangle },
      ]
    },
    {
      title: "Business",
      items: [
        { key: "sales", label: strings.roles.sales, icon: ShoppingCart },
        { key: "reports", label: strings.roles.report_viewer, icon: BarChart3 },
      ]
    }
  ];

  const getInitials = (fullName: string) => {
    return fullName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  };

  return (
    <div className="flex h-screen bg-[#F5F7FA] overflow-hidden font-sans">
      {/* Sidebar (Desktop) */}
      <aside className={`w-64 bg-[#1460A5] text-white flex flex-col shrink-0 transition-transform duration-300 absolute inset-y-0 z-50 sm:relative sm:translate-x-0 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Logo Area */}
        <div className="h-16 flex items-center gap-3 px-6 shrink-0 border-b border-white/10">
          <Logo size={32} />
          <div className="font-bold text-lg tracking-tight truncate">{strings.app.name}</div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-6 scrollbar-hide">
          {navGroups.map((group, i) => (
            <div key={i} className="space-y-1.5">
              <h4 className="px-4 text-[10px] font-bold text-blue-300/80 uppercase tracking-wider mb-2">{group.title}</h4>
              {group.items.map(n => {
                const Icon = n.icon;
                const isActive = view === n.key;
                return (
                  <button
                    key={n.key}
                    onClick={() => { setView(n.key as View); setMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? "bg-[#257BC7] text-white shadow-inner"
                        : "text-blue-100 hover:bg-[#1A6EB8] hover:text-white"
                    }`}
                  >
                    <Icon size={18} className={isActive ? "text-white" : "text-blue-200"} />
                    {n.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Profile Block */}
        <div className="p-4 shrink-0 border-t border-white/10">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0D4D87] overflow-hidden group cursor-default">
            <div className="w-9 h-9 rounded-full bg-blue-400/30 flex items-center justify-center text-sm font-bold shrink-0 ring-1 ring-blue-300/30">
              {getInitials(profile.full_name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{profile.full_name}</div>
              <div className="text-[10px] text-blue-200 uppercase tracking-wide truncate">{roleLabel(role)}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Overlay for mobile sidebar */}
        {mobileMenuOpen && (
          <div className="absolute inset-0 bg-slate-900/50 z-40 sm:hidden" onClick={() => setMobileMenuOpen(false)} />
        )}

        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <button className="sm:hidden text-slate-500 hover:text-slate-700" onClick={() => setMobileMenuOpen(true)}>
              <Menu size={24} />
            </button>
            <div className="hidden sm:flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 w-64 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
              <Search size={16} className="text-slate-400 shrink-0" />
              <input 
                type="text" 
                placeholder="Search order..." 
                value={globalSearch}
                onChange={e => setGlobalSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && globalSearch.trim()) {
                    setTrackerQuery(globalSearch.trim());
                    setView("tracker");
                    setGlobalSearch("");
                  }
                }}
                className="bg-transparent border-none outline-none text-sm w-full ml-2 text-slate-700 placeholder-slate-400" 
              />
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <button 
              onClick={() => setRefreshKey(k => k + 1)}
              title="Refresh Current View"
              className="text-slate-400 hover:text-blue-600 transition-colors"
            >
              <RefreshCw size={20} />
            </button>
            <button 
              onClick={() => setLanguage(language === "en" ? "am" : "en")}
              className="text-sm font-semibold text-slate-500 hover:text-blue-600 bg-slate-100 px-3 py-1.5 rounded-full transition-colors"
            >
              {language === "en" ? "አማ" : "En"}
            </button>
            <button onClick={() => alert("No new notifications")} className="text-slate-400 hover:text-slate-600 relative">
              <Bell size={20} />
              <span className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></span>
            </button>
            <div className="w-px h-6 bg-slate-200 hidden sm:block" />
            <button onClick={signOut} className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-rose-600 transition-colors">
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Scrollable Screen Content */}
        <main key={refreshKey} className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-6xl mx-auto">
            {view === "production" && (role === "production" ? <ProductionScreen /> : <AdminDashboard role={role} onNavigate={setView} />)}
            {view === "receiving" && (role === "warehouse_receiving" ? <ReceivingScreen /> : <AdminDashboard role={role} onNavigate={setView} />)}
            { view === "withdrawal" && (role === "warehouse_withdrawal" ? <WithdrawalScreen /> : <AdminDashboard role={role} onNavigate={setView} />)}
            {view === "sales" && <SalesScreen />}
            {view === "damage" && <DamageScreen />}
            {view === "stock" && <StockScreen />}
            {view === "qa" && <QAScreen />}
            {view === "reports" && <ReportsScreen />}
            {view === "checker" && <CheckerScreen />}
            {view === "admin" && <AdminDashboard role={role} onNavigate={setView} />}
            {view === "tracker" && <OrderTrackerScreen initialQuery={trackerQuery} />}
          </div>
        </main>
      </div>
    </div>
  );
}

function Home({ role, onNavigate, activeNav }: { role: UserRole; onNavigate: (v: View) => void, activeNav: any[] }) {
  const { strings } = useLanguage();
  const { roleLabel } = useLabels();
  const cards = activeNav.filter(n => n.key !== "home");
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Welcome Card */}
      <div className="bg-gradient-to-r from-[#1460A5] to-[#1e76c7] rounded-3xl p-8 sm:p-10 shadow-lg text-white relative overflow-hidden">
        {/* Decorative background shapes */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-white opacity-5 mix-blend-overlay"></div>
        <div className="absolute bottom-0 right-20 -mb-20 w-48 h-48 rounded-full bg-white opacity-5 mix-blend-overlay"></div>
        
        <div className="relative z-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Welcome back, {roleLabel(role)}</h1>
          <p className="text-blue-100 mt-2 text-sm sm:text-base max-w-xl">{strings.app.tagline}</p>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-4 px-1">Quick Access</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(c => {
            const Icon = c.icon;
            return (
              <button key={c.key} onClick={() => onNavigate(c.key)}
                className="group text-left rounded-2xl border border-slate-200 bg-white p-5 hover:border-blue-400 hover:shadow-md transition-all duration-300 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm">
                    <Icon size={24} />
                  </div>
                  <div className="text-base font-bold text-slate-800 group-hover:text-blue-700 transition-colors">{c.label}</div>
                  <div className="text-sm text-slate-500 mt-1 line-clamp-2">Access the {c.label.toLowerCase()} module and features.</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function canUseChecker(role: UserRole): boolean { return true; }
function isAdmin(role: UserRole): boolean { return role.endsWith("_admin") || role === "super_admin"; }

export default function App() {
  return (
    <LanguageProvider>
      <ToastProvider>
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </ToastProvider>
    </LanguageProvider>
  );
}
