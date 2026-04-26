import { Routes, Route, NavLink } from "react-router-dom";
import {
  Search,
  FileText,
  Brain,
  Plus,
} from "lucide-react";
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

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
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
            <NavLink
              to="/transcripts/new"
              className="flex items-center gap-2 text-sm py-1.5 px-4 rounded-lg font-medium bg-gold-400 text-brand-900 hover:bg-gold-300 transition-colors"
            >
              <Plus size={16} />
              Add Transcript
            </NavLink>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/transcripts" element={<TranscriptsPage />} />
          <Route path="/transcripts/new" element={<TranscriptFormPage />} />
          <Route path="/transcripts/:id" element={<TranscriptDetailPage />} />
          <Route path="/transcripts/:id/edit" element={<TranscriptFormPage />} />
          <Route path="/knowledge" element={<KnowledgePage />} />
        </Routes>
      </main>
    </div>
  );
}
