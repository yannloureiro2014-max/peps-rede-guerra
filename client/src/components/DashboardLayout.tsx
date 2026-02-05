import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { 
  LayoutDashboard, 
  LogOut, 
  Fuel, 
  ShoppingCart, 
  Ruler, 
  BarChart3, 
  FileText, 
  Bell, 
  Settings,
  Building2,
  Menu,
  X,
  Calculator,
  Users,
  Calendar,
  Shield,
  RefreshCw
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "./ui/button";

interface MenuItem {
  icon: any;
  label: string;
  path: string;
  adminOnly?: boolean;
}

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Fuel, label: "Estoque", path: "/estoque" },
  { icon: ShoppingCart, label: "Compras", path: "/compras" },
  { icon: Ruler, label: "Medições", path: "/medicoes" },
  { icon: BarChart3, label: "Vendas", path: "/vendas" },
  { icon: Calculator, label: "DRE", path: "/dre" },
  { icon: FileText, label: "Relatórios", path: "/relatorios" },
  { icon: Bell, label: "Alertas", path: "/alertas" },
  { icon: Building2, label: "Postos", path: "/postos" },
  { icon: Calendar, label: "Inicialização Mensal", path: "/inicializacao-mensal", adminOnly: true },
  { icon: RefreshCw, label: "Recalcular CMV", path: "/recalcular-cmv", adminOnly: true },
  { icon: Users, label: "Usuários", path: "/usuarios", adminOnly: true },
  { icon: Settings, label: "Configurações", path: "/configuracoes" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-slate-200"></div>
          <div className="h-4 w-32 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full bg-white rounded-2xl shadow-xl">
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center">
              <Fuel className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-center">
              PEPS - Rede Guerra
            </h1>
            <p className="text-sm text-muted-foreground text-center">
              Sistema de Gestão de Estoque e CMV para Postos de Combustíveis
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Entrar no Sistema
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar Desktop */}
      <aside 
        className={`hidden md:flex flex-col bg-white border-r border-slate-200 transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-16'
        }`}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Menu className="h-5 w-5 text-slate-600" />
          </button>
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <Fuel className="h-5 w-5 text-primary" />
              <span className="font-bold text-primary">PEPS</span>
            </div>
          )}
        </div>

        {/* Menu */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {menuItems
            .filter(item => !item.adminOnly || user?.role === 'admin_geral')
            .map((item) => {
              const isActive = location === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => setLocation(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    isActive 
                      ? 'bg-primary/10 text-primary border-r-2 border-primary' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <item.icon className={`h-5 w-5 ${isActive ? 'text-primary' : ''}`} />
                  {sidebarOpen && (
                    <span className="font-medium flex items-center gap-2">
                      {item.label}
                      {item.adminOnly && <Shield className="h-3 w-3 text-purple-500" />}
                    </span>
                  )}
                </button>
              );
            })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200">
          <div className={`flex items-center ${sidebarOpen ? 'gap-3' : 'justify-center'}`}>
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name || '-'}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email || '-'}</p>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <button
              onClick={logout}
              className="mt-3 w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-50">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 hover:bg-slate-100 rounded-lg"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <Fuel className="h-5 w-5 text-primary" />
          <span className="font-bold text-primary">PEPS</span>
        </div>
        <div className="w-9" /> {/* Spacer */}
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl">
            <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Fuel className="h-5 w-5 text-primary" />
                <span className="font-bold text-primary">PEPS</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="py-4">
              {menuItems
                .filter(item => !item.adminOnly || user?.role === 'admin_geral')
                .map((item) => {
                  const isActive = location === item.path;
                  return (
                    <button
                      key={item.path}
                      onClick={() => {
                        setLocation(item.path);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        isActive 
                          ? 'bg-primary/10 text-primary' 
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <item.icon className={`h-5 w-5 ${isActive ? 'text-primary' : ''}`} />
                      <span className="font-medium flex items-center gap-2">
                        {item.label}
                        {item.adminOnly && <Shield className="h-3 w-3 text-purple-500" />}
                      </span>
                    </button>
                  );
                })}
            </nav>
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.name || '-'}</p>
                  <p className="text-xs text-slate-500 truncate">{user?.email || '-'}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto md:pt-0 pt-14">
        <div className="p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
