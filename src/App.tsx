import { lazy, Suspense, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider } from "@/hooks/useAuth";
import { AiServiceProvider } from "@/hooks/useAiService";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import RoleRoute from "@/components/auth/RoleRoute";
import AppLayout from "@/components/layout/AppLayout";
import MarketingLayout from "@/components/layout/MarketingLayout";
import { PageLoading } from "@/components/design/skeletons";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import Suspended from "./pages/Suspended";
import PendingApproval from "./pages/PendingApproval";
import Marketplace from "./pages/Marketplace";

const Profile = lazy(() => import("./pages/Profile"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Wallet = lazy(() => import("./pages/Wallet"));
const Orders = lazy(() => import("./pages/Orders"));
const IntelligenceHub = lazy(() => import("./pages/intelligence/IntelligenceHub"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminPayments = lazy(() => import("./pages/admin/AdminPayments"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const withSuspense = (el: ReactNode) => (
  <Suspense fallback={<PageLoading message="Loading page…" />}>{el}</Suspense>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <AuthProvider>
    <AiServiceProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<MarketingLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/suspended" element={<Suspended />} />
              <Route path="/pending-approval" element={<PendingApproval />} />
            </Route>

            <Route element={<AppLayout />}>
              <Route path="/profile" element={<ProtectedRoute>{withSuspense(<Profile />)}</ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute>{withSuspense(<Dashboard />)}</ProtectedRoute>} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/marketplace/:id" element={withSuspense(<ProductDetail />)} />
              <Route path="/wallet" element={<ProtectedRoute>{withSuspense(<Wallet />)}</ProtectedRoute>} />
              <Route path="/orders" element={<ProtectedRoute>{withSuspense(<Orders />)}</ProtectedRoute>} />
              <Route path="/intelligence" element={<ProtectedRoute>{withSuspense(<IntelligenceHub />)}</ProtectedRoute>} />
              <Route path="/admin" element={<RoleRoute allowedRole="admin">{withSuspense(<Admin />)}</RoleRoute>} />
              <Route path="/admin/payments" element={<RoleRoute allowedRole="admin">{withSuspense(<AdminPayments />)}</RoleRoute>} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AiServiceProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
