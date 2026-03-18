import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import SignalsPage from "./pages/SignalsPage";
import OrdersPage from "./pages/OrdersPage";
import RiskPage from "./pages/RiskPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import AllocationPage from "./pages/AllocationPage";
import SettingsPage from "./pages/SettingsPage";
import { useAuth } from "./hooks/useAuth";

function ProtectedLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-slate-900 p-6">
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/signals" element={<SignalsPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/risk" element={<RiskPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/allocation" element={<AllocationPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          isAuthenticated ? (
            <ProtectedLayout />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}
