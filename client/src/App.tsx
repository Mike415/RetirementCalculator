/**
 * Retirement Planner — Main App
 * Design: "Horizon" — Warm Modernist Financial Planning
 * Forest green sidebar, warm off-white content, Playfair Display headings
 */

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PlannerProvider, usePlanner } from "@/contexts/PlannerContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Sidebar from "./components/Sidebar";
import Overview from "./pages/Overview";
import Accounts from "./pages/Accounts";
import Income from "./pages/Income";
import HomeMortgage from "./pages/HomeMortgage";
import Assumptions from "./pages/Assumptions";
import Budget from "./pages/Budget";
import Projections from "./pages/Projections";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

function PlannerApp() {
  const { activeTab } = usePlanner();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const renderPage = () => {
    switch (activeTab) {
      case "overview": return <Overview />;
      case "accounts": return <Accounts />;
      case "income": return <Income />;
      case "home": return <HomeMortgage />;
      case "assumptions": return <Assumptions />;
      case "budget": return <Budget />;
      case "projections": return <Projections />;
      default: return <Overview />;
    }
  };

  return (
    <div className="flex h-screen bg-[#FAFAF8] overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-60 transform transition-transform duration-200 lg:relative lg:translate-x-0 lg:z-auto lg:flex-shrink-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar className="h-full" />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-[#1B4332] text-white flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <h1 className="font-bold text-sm">Retirement Planner</h1>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <PlannerProvider>
            <Toaster />
            <PlannerApp />
          </PlannerProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
