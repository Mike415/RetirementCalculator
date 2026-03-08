/**
 * Project Retire — Main App
 * Design: "Horizon" — Warm Modernist Financial Planning
 * Forest green sidebar, warm off-white content, Playfair Display headings
 *
 * Routing: each page has its own URL path so it survives refresh and
 * can be bookmarked or linked to directly.
 */

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PlannerProvider } from "@/contexts/PlannerContext";
import { CloudSyncProvider } from "@/contexts/CloudSyncContext";
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
import SocialSecurity from "./pages/SocialSecurity";
import AlternativeIncome from "./pages/AlternativeIncome";
import OneTimeEvents from "./pages/OneTimeEvents";
import Scenarios from "./pages/Scenarios";
import Distribution from "./pages/Distribution";
import Billing from "./pages/Billing";
import FAQ from "./pages/FAQ";
import Plans from "./pages/Plans";
import NotFound from "./pages/NotFound";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import OnboardingModal, { isFirstVisit } from "./components/OnboardingModal";
import { cn } from "@/lib/utils";
import { Route, Switch, Redirect, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";

function PlannerApp() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => isFirstVisit());
  // make sure to consider if you need authentication for certain routes
  return (
    <div className="flex h-[100dvh] bg-[#FAFAF8] overflow-hidden">
      {showOnboarding && <OnboardingModal onDismiss={() => setShowOnboarding(false)} />}
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
        <Sidebar className="h-full" onNavigate={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header — flex-shrink-0 keeps it out of the scroll container so it is always visible */}
        <div className="lg:hidden flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-[#1B4332] text-white">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <h1 className="font-bold text-sm">Project Retire</h1>
        </div>

        {/* Page content — overscroll-contain prevents the whole-page bounce on iOS when scrolling past the end */}
        <main className="flex-1 overflow-y-auto overscroll-contain">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
            <Switch>
              <Route path="/" component={() => <Redirect to="/overview" />} />
              <Route path="/overview" component={Overview} />
              <Route path="/accounts" component={Accounts} />
              <Route path="/income" component={Income} />
              <Route path="/alt-income" component={AlternativeIncome} />
              <Route path="/home" component={HomeMortgage} />
              <Route path="/assumptions" component={Assumptions} />
              <Route path="/budget" component={Budget} />
              <Route path="/social-security" component={SocialSecurity} />
              <Route path="/events" component={OneTimeEvents} />
              <Route path="/scenarios" component={Scenarios} />
              <Route path="/distribution" component={Distribution} />
              <Route path="/projections" component={Projections} />
              <Route path="/billing" component={Billing} />
              <Route path="/faq" component={FAQ} />
              <Route path="/plans" component={Plans} />
              <Route component={NotFound} />
            </Switch>
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      {/* Use hash-based routing so all navigation works on GitHub Pages
          without needing server-side rewrites or a base path prefix.
          URLs look like: /RetirementCalculator/#/overview */}
      <Router hook={useHashLocation}>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <PlannerProvider>
              <CloudSyncProvider>
                <Toaster />
                <PlannerApp />
              </CloudSyncProvider>
            </PlannerProvider>
          </TooltipProvider>
        </ThemeProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
