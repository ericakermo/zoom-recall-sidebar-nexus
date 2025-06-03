
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ZoomSessionProvider } from "@/context/ZoomSessionContext";
import { SidebarProvider } from "@/components/ui/sidebar";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Calendar from "./pages/Calendar";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Meeting from "./pages/Meeting";
import Meetings from "./pages/Meetings";
import JoinMeeting from "./pages/JoinMeeting";
import ZoomSample from "./pages/ZoomSample";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ZoomSessionProvider>
        <TooltipProvider>
          <SidebarProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Dashboard />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/calendar"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Calendar />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Profile />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Settings />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/meeting/:meetingId"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Meeting />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/meetings"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Meetings />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/join"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <JoinMeeting />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/zoom-sample"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <ZoomSample />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </SidebarProvider>
        </TooltipProvider>
      </ZoomSessionProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
