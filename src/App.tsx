import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/Sidebar';
import DashboardOverview from './components/DashboardOverview';
import TaskList from './components/TaskList';
import ClientList from './components/ClientList';
import Settings from './components/Settings';
import WebhookSimulator from './components/WebhookSimulator';
import SoapNotes from './components/SoapNotes';
import { LogIn, ShieldAlert, Loader2, ExternalLink, Github } from 'lucide-react';
import { cn } from './lib/utils';

const Login: React.FC = () => {
  const { login, demoLogin, loading } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-500">
        <div className="p-10 text-center space-y-6">
          <div className="w-20 h-20 bg-emerald-500 text-white rounded-3xl flex items-center justify-center mx-auto shadow-lg rotate-3 hover:rotate-0 transition-transform duration-300">
            <ShieldAlert className="w-10 h-10" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Flexion & Flow</h1>
            <p className="text-slate-500 mt-2 font-medium">Practice Management Dashboard</p>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={login}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-bold transition-all shadow-xl hover:shadow-2xl active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign in with Google
                </>
              )}
            </button>
            
            <button
              onClick={demoLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 py-4 rounded-2xl font-bold transition-all shadow-sm hover:shadow-md active:scale-95 disabled:opacity-50"
            >
              Bypass Login (Demo Mode)
            </button>
          </div>

          <div className="pt-6 border-t border-slate-100 grid grid-cols-2 gap-4">
            <a 
              href="https://github.com/dyllz92/Flexion-and-Flow-Dashboard" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
            >
              <Github className="w-4 h-4" />
              Source Code
            </a>
            <a 
              href="#" 
              className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Documentation
            </a>
          </div>
        </div>
        <div className="bg-slate-900 p-4 text-center">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Authorized Personnel Only</p>
        </div>
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { isAdmin, user, logout } = useAuth();

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl border border-slate-200 text-center space-y-6">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Access Denied</h2>
          <p className="text-slate-500">
            Your account (<strong>{user?.email}</strong>) does not have administrator privileges. 
            Please contact the system owner to request access.
          </p>
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-all"
            >
              Try Again
            </button>
            <button 
              onClick={() => logout()}
              className="w-full bg-white border border-slate-200 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-50 transition-all"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 ml-64 p-8">
        <header className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-sm font-bold text-emerald-600 uppercase tracking-widest mb-1">System Hub</h2>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              {activeTab === 'dashboard' && 'Practice Overview'}
              {activeTab === 'tasks' && 'Task Management'}
              {activeTab === 'clients' && 'Client Directory'}
              {activeTab === 'settings' && 'System Settings'}
              {activeTab === 'bookings' && 'Bookings (Coming Soon)'}
              {activeTab === 'soap' && 'SOAP Note Generator'}
              {activeTab === 'analytics' && 'Advanced Analytics'}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-sm font-bold text-slate-900">{user?.displayName || 'Admin'}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center font-bold shadow-lg">
              {user?.displayName?.charAt(0) || user?.email?.charAt(0)}
            </div>
          </div>
        </header>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              <DashboardOverview />
              <WebhookSimulator />
            </div>
          )}
          {activeTab === 'tasks' && <TaskList />}
          {activeTab === 'clients' && <ClientList />}
          {activeTab === 'settings' && <Settings />}
          {activeTab === 'soap' && <SoapNotes />}
          {(['bookings', 'analytics', 'invoices', 'messages'].includes(activeTab)) && (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200 border-dashed">
              <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-3xl flex items-center justify-center mb-6">
                <Loader2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Module Coming Soon</h3>
              <p className="text-slate-500 mt-2 max-w-xs text-center">
                We're currently building the {activeTab} module. Check back soon for updates!
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading Flexion & Flow...</p>
        </div>
      </div>
    );
  }

  return user ? <Dashboard /> : <Login />;
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
