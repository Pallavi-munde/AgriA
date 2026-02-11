
import React from 'react';
import { UserRole } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  userRole?: UserRole;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, userRole, onLogout, activeTab, setActiveTab }) => {
  const tabs = userRole === UserRole.ADMIN 
    ? [
        { id: 'dashboard', icon: 'fa-chart-line', label: 'Admin Panel' },
        { id: 'farmers', icon: 'fa-users', label: 'Farmer CRUD' },
        { id: 'ads', icon: 'fa-ad', label: 'Market Ads' },
        { id: 'private', icon: 'fa-lock', label: 'Private Space' }
      ]
    : [
        { id: 'dashboard', icon: 'fa-leaf', label: 'Dashboard' },
        { id: 'prediction', icon: 'fa-brain', label: 'AI Predictor' },
        { id: 'market', icon: 'fa-store', label: 'Market Rates' },
        { id: 'chat', icon: 'fa-robot', label: 'AI Agronomist' }
      ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-64 flex-col bg-emerald-800 text-white p-6 sticky top-0 h-screen">
        <div className="flex items-center gap-3 mb-12">
          <div className="bg-white p-2 rounded-xl">
            <i className="fas fa-seedling text-emerald-600 text-xl"></i>
          </div>
          <h1 className="text-xl font-bold tracking-tight">AgriSmart AI</h1>
        </div>

        <nav className="flex-1 space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 ${
                activeTab === tab.id ? 'bg-white/15 text-white' : 'text-emerald-100 hover:bg-white/5'
              }`}
            >
              <i className={`fas ${tab.icon} w-5`}></i>
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </nav>

        <button 
          onClick={onLogout}
          className="mt-auto flex items-center gap-4 px-4 py-3 text-emerald-100 hover:text-white hover:bg-red-500/10 rounded-xl transition-colors"
        >
          <i className="fas fa-sign-out-alt w-5"></i>
          <span className="font-medium">Logout</span>
        </button>
      </aside>

      {/* Mobile Top Bar */}
      <header className="md:hidden bg-emerald-800 text-white p-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <i className="fas fa-seedling text-white text-lg"></i>
          <span className="font-bold">AgriSmart</span>
        </div>
        <button onClick={onLogout} className="p-2">
          <i className="fas fa-sign-out-alt"></i>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
        <div className="max-w-6xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 z-50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center p-2 rounded-lg transition-all ${
              activeTab === tab.id ? 'text-emerald-600' : 'text-slate-400'
            }`}
          >
            <i className={`fas ${tab.icon} text-lg mb-1`}></i>
            <span className="text-[10px] font-medium uppercase tracking-wider">{tab.label.split(' ')[0]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default Layout;
