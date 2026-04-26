import { Routes, Route, NavLink } from "react-router-dom";
import {
  Search,
  FileText,
  Brain,
  History,
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
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <span className="text-blue-600 font-bold text-lg tracking-tight">
                TechSupport<span className="text-gray-900">AI</span>
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
                          ? "bg-blue-50 text-blue-700"
                          : "text-gray-600 hover:bg-gray-100"
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
              className="btn-primary flex items-center gap-2 text-sm py-1.5"
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
