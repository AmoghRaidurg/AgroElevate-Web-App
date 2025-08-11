import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" lazy={() => import('./pages/Login').then(m => ({ Component: m.default }))} />
          <Route path="/register" lazy={() => import('./pages/Register').then(m => ({ Component: m.default }))} />
          <Route path="/dashboard" lazy={() => import('./pages/Dashboard').then(m => ({ Component: m.default }))} />
          <Route path="/marketplace" lazy={() => import('./pages/Marketplace').then(m => ({ Component: m.default }))} />
          <Route path="/admin" lazy={() => import('./pages/Admin').then(m => ({ Component: m.default }))} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
