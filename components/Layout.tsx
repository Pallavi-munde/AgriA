
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
        { id: 'dashboard', icon: 'fa-chart-pie', label: 'Overview' },
        { id: 'farmers', icon: 'fa-user-group', label: 'Farmers' },
        { id: 'ads', icon: 'fa-bullhorn', label: 'Campaigns' },
        { id: 'private', icon: 'fa-vault', label: 'Repository' }
      ]
    : [
        { id: 'dashboard', icon: 'fa-leaf', label: 'Health' },
        { id: 'doctor', icon: 'fa-microscope', label: 'Crop Doctor' },
        { id: 'prediction', icon: 'fa-brain-circuit', label: 'Predictor' },
        { id: 'market', icon: 'fa-indian-rupee-sign', label: 'Market' },
        { id: 'chat', icon: 'fa-message', label: 'Advisor' }
      ];

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col md:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-72 flex-col bg-[#064e3b] text-white p-8 sticky top-0 h-screen shadow-2xl">
        <div className="flex items-center gap-4 mb-16">
          <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/20">
            <i className="fas fa-seedling text-[#10b981] text-2xl"></i>
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">AgriSmart AI</h1>
            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Precision Farm Suite</p>
          </div>
        </div>

        <nav className="flex-1 space-y-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-500 group ${
                activeTab === tab.id 
                  ? 'bg-[#10b981] text-white shadow-lg shadow-emerald-500/20' 
                  : 'text-emerald-100 hover:bg-white/5'
              }`}
            >
              <i className={`fas ${tab.icon} w-6 text-lg group-hover:scale-110 transition-transform`}></i>
              <span className="font-bold text-sm">{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-8 border-t border-white/10">
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-4 px-5 py-4 text-emerald-100 hover:text-white hover:bg-red-500/10 rounded-2xl transition-all"
          >
            <i className="fas fa-power-off w-6"></i>
            <span className="font-bold text-sm">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="md:hidden bg-[#064e3b] text-white p-5 flex justify-between items-center sticky top-0 z-50 shadow-lg">
        <div className="flex items-center gap-3">
          <i className="fas fa-seedling text-emerald-400 text-xl"></i>
          <span className="font-black text-lg">AgriSmart</span>
        </div>
        <button onClick={onLogout} className="p-2 bg-white/10 rounded-xl">
          <i className="fas fa-power-off text-sm"></i>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
        <div className="max-w-7xl mx-auto p-5 md:p-12">
          {children}
        </div>
      </main>

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-6 left-6 right-6 bg-emerald-900/90 backdrop-blur-xl border border-white/10 rounded-3xl flex justify-around p-3 z-50 shadow-2xl">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center p-3 rounded-2xl transition-all ${
              activeTab === tab.id ? 'bg-[#10b981] text-white scale-110 shadow-lg shadow-emerald-500/30' : 'text-emerald-200/60'
            }`}
          >
            <i className={`fas ${tab.icon} text-lg mb-1`}></i>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default Layout;
