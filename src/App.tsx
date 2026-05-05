import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthView } from './components/AuthView';
import { MainView } from './components/MainView';
import { Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, privateKey, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary">
        <Loader2 className="animate-spin text-accent" size={48} />
      </div>
    );
  }

  return (user && privateKey) ? <MainView /> : <AuthView />;
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
