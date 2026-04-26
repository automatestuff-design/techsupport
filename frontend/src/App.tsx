import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import {
  Search,
  FileText,
  Brain,
  Plus,
  LogOut,
} from "lucide-react";
import { useAuth } from "./contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import SearchPage from "./pages/SearchPage";
import TranscriptsPage from "./pages/TranscriptsPage";
import TranscriptDetailPage from "./pages/TranscriptDetailPage";
import TranscriptFormPage from "./pages/TranscriptFormPage";
import KnowledgePage from "./pages/KnowledgePage";

const navItems = [
  { to: "/", label: "Search", icon: Search, end: true },
  { to: "/transcripts", label: "Transcripts", icon: FileText },
  { to: "/knowledge", label: "Knowledge Base", icon: Brain },
];

function AuthenticatedApp() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-brand-600 sticky top-0 z-10 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <span className="text-white font-bold text-lg tracking-tight">
                TechSupport<span className="text-gold-400">AI</span>
              </span>
              <nav className="flex items-center gap-1">
                {navItems.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-brand-700 text-white"
                          : "text-brand-100 hover:bg-brand-500 hover:text-white"
                      }`
                    }
                  >
                    <Icon size={16} />
                    {label}
                  </NavLink>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <NavLink
                to="/transcripts/new"
                className="flex items-center gap-2 text-sm py-1.5 px-4 rounded-lg font-medium bg-gold-400 text-brand-900 hover:bg-gold-300 transition-colors"
              >
                <Plus size={16} />
                Add Transcript
              </NavLink>
              <div className="flex items-center gap-2 text-brand-100 text-sm">
                <span className="hidden sm:block truncate max-w-[160px]">{user?.email}</span>
                <button
                  onClick={signOut}
                  title="Sign out"
                  className="p-1.5 rounded-lg hover:bg-brand-500 transition-colors"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/transcripts" element={<TranscriptsPage />} />
          <Route path="/transcripts/new" element={<TranscriptFormPage />} />
          <Route path="/transcripts/:id" element={<TranscriptDetailPage />} />
          <Route path="/transcripts/:id/edit" element={<TranscriptFormPage />} />
          <Route path="/knowledge" element={<KnowledgePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-50 flex items-center justify-center">
        <div className="text-brand-600 text-sm">Loading…</div>
      </div>
    );
  }

  if (!session) return <LoginPage />;
  return <AuthenticatedApp />;
}
