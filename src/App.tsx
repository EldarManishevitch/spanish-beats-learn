import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Music } from "lucide-react";
import Auth from "./pages/Auth";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import SongPage from "./pages/SongPage";
import SongPending from "./pages/SongPending";
import Vocab from "./pages/Vocab";
import ReviewRoom from "./pages/ReviewRoom";
import Conversations from "./pages/Conversations";
import Roleplay from "./pages/Roleplay";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound.tsx";
import ReggaetonSlangGuide from "./pages/ReggaetonSlangGuide";
import DominicanSlangGuide from "./pages/DominicanSlangGuide";
import HowToLearnSpanishWithMusic from "./pages/HowToLearnSpanishWithMusic";
import BestReggaetonSongsForSpanishLearners from "./pages/BestReggaetonSongsForSpanishLearners";

const queryClient = new QueryClient();

// Public landing for guests, authenticated dashboard for signed-in users.
// Keeps the URL `/` SEO-friendly for the marketing surface while preserving
// the existing protected dashboard behind the same path post-login.
const RootGate = () => {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Music className="h-10 w-10 text-primary animate-pulse" />
      </div>
    );
  }
  return session ? <Dashboard /> : <Landing />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reggaeton-slang-guide" element={<ReggaetonSlangGuide />} />
            <Route path="/dominican-slang-guide" element={<DominicanSlangGuide />} />
            <Route path="/guides/how-to-learn-spanish-with-music" element={<HowToLearnSpanishWithMusic />} />
            <Route path="/guides/best-reggaeton-songs-for-spanish-learners" element={<BestReggaetonSongsForSpanishLearners />} />
            <Route path="/" element={<RootGate />} />
            <Route path="/song/pending/:youtubeId" element={<ProtectedRoute><SongPending /></ProtectedRoute>} />
            <Route path="/song/:id" element={<ProtectedRoute><SongPage /></ProtectedRoute>} />
            <Route path="/vocab" element={<ProtectedRoute><Vocab /></ProtectedRoute>} />
            <Route path="/review" element={<ProtectedRoute><ReviewRoom /></ProtectedRoute>} />
            <Route path="/conversations" element={<ProtectedRoute><Conversations /></ProtectedRoute>} />
            <Route path="/roleplay" element={<ProtectedRoute><Roleplay /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
