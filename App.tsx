
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from './components/Layout';
import { User, UserRole, UserStatus, SensorData, CropRecommendation, MarketRate, AdBanner } from './types';
import { MOCK_SENSORS } from './constants';
import { getGeminiChatResponse, getCropRecommendation } from './services/geminiService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

// --- Components ---

const SensorCard: React.FC<{ label: string; value: string | number; unit: string; icon: string; color: string }> = ({ label, value, unit, icon, color }) => (
  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 group">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-xl ${color} bg-opacity-10 text-${color}`}>
        <i className={`fas ${icon} text-xl`}></i>
      </div>
      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
    </div>
    <h3 className="text-slate-500 text-sm font-medium mb-1">{label}</h3>
    <div className="flex items-baseline gap-1">
      <span className="text-2xl font-bold text-slate-800">{value}</span>
      <span className="text-slate-400 text-sm">{unit}</span>
    </div>
  </div>
);

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sensors, setSensors] = useState<SensorData>(MOCK_SENSORS);
  const [recommendations, setRecommendations] = useState<CropRecommendation[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'bot'; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [farmers, setFarmers] = useState<User[]>([
    { id: '1', name: 'Rajesh Kumar', phone: '9876543210', role: UserRole.FARMER, status: UserStatus.APPROVED, joinedAt: '2023-10-12' },
    { id: '2', name: 'Sunita Devi', phone: '9876543211', role: UserRole.FARMER, status: UserStatus.PENDING, joinedAt: '2023-11-05' },
    { id: '3', name: 'Amit Singh', phone: '9876543212', role: UserRole.FARMER, status: UserStatus.PENDING, joinedAt: '2023-11-20' },
  ]);
  const [ads, setAds] = useState<AdBanner[]>([
    { id: '1', title: 'Premium NPK Fertilizer', imageUrl: 'https://picsum.photos/seed/fertilizer/400/200', targetUrl: 'https://example.com/fertilizer', clicks: 124 },
    { id: '2', title: 'Hybrid Seeds - Monsoon', imageUrl: 'https://picsum.photos/seed/seeds/400/200', targetUrl: 'https://example.com/seeds', clicks: 89 },
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Auth Handlers ---

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const phone = formData.get('phone') as string;
    const password = formData.get('password') as string;

    // Mock login logic
    if (phone === 'admin' && password === 'admin') {
      setCurrentUser({ id: '0', name: 'Admin User', phone: '000', role: UserRole.ADMIN, status: UserStatus.APPROVED, joinedAt: '2023-01-01' });
    } else {
      const user = farmers.find(f => f.phone === phone);
      if (user) {
        if (user.status === UserStatus.APPROVED) {
          setCurrentUser(user);
        } else {
          alert("Your application is still PENDING admin approval. Please check back later!");
        }
      } else {
        alert("User not found. Please apply for membership.");
      }
    }
  };

  const handleApply = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newFarmer: User = {
      id: Math.random().toString(36).substr(2, 9),
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      role: UserRole.FARMER,
      status: UserStatus.PENDING,
      joinedAt: new Date().toISOString(),
    };
    setFarmers([...farmers, newFarmer]);
    alert("Application submitted! Our admin will verify your details.");
    setIsRegistering(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  // --- Farmer Actions ---

  const fetchRecommendations = async () => {
    setIsLoadingRecs(true);
    try {
      const recs = await getCropRecommendation(sensors);
      setRecommendations(recs);
    } catch (err) {
      alert("Failed to fetch AI recommendations.");
    } finally {
      setIsLoadingRecs(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    const newMsg = { role: 'user' as const, text: chatInput };
    setChatHistory(prev => [...prev, newMsg]);
    setChatInput('');
    
    const botResponse = await getGeminiChatResponse(chatInput, sensors);
    setChatHistory(prev => [...prev, { role: 'bot', text: botResponse || "Error" }]);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // --- Admin Actions ---

  const approveFarmer = (id: string) => {
    setFarmers(farmers.map(f => f.id === id ? { ...f, status: UserStatus.APPROVED } : f));
  };

  const rejectFarmer = (id: string) => {
    setFarmers(farmers.map(f => f.id === id ? { ...f, status: UserStatus.REJECTED } : f));
  };

  const deleteFarmer = (id: string) => {
    if (confirm("Permanently delete this farmer profile?")) {
      setFarmers(farmers.filter(f => f.id !== id));
    }
  };

  // --- View Rendering ---

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-emerald-900 px-4 py-12 bg-cover bg-center" style={{ backgroundImage: "url('https://picsum.photos/seed/farm/1920/1080?blur=10')" }}>
        <div className="bg-white/95 backdrop-blur-lg p-8 rounded-3xl shadow-2xl w-full max-w-md border border-white/20">
          <div className="text-center mb-10">
            <div className="bg-emerald-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <i className="fas fa-seedling text-white text-3xl"></i>
            </div>
            <h1 className="text-3xl font-bold text-slate-800">AgriSmart AI</h1>
            <p className="text-slate-500 mt-2">{isRegistering ? 'Join our precision farming network' : 'Welcome back, Farmer'}</p>
          </div>

          {isRegistering ? (
            <form onSubmit={handleApply} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Full Name</label>
                <input required name="name" type="text" placeholder="John Doe" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Phone Number</label>
                <input required name="phone" type="tel" placeholder="+91 XXXXX XXXXX" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Create Password</label>
                <input required name="password" type="password" placeholder="••••••••" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
              </div>
              <button type="submit" className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 active:scale-[0.98] transition-all mt-6">
                Apply for Membership
              </button>
              <p className="text-center text-slate-500 mt-4">
                Already have an account? <button type="button" onClick={() => setIsRegistering(false)} className="text-emerald-600 font-bold hover:underline">Log In</button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Phone Number</label>
                <div className="relative">
                   <i className="fas fa-phone absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                   <input required name="phone" type="text" placeholder="Registered Phone" className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
                <div className="relative">
                   <i className="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                   <input required name="password" type="password" placeholder="••••••••" className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                </div>
              </div>
              <button type="submit" className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 active:scale-[0.98] transition-all">
                Sign In
              </button>
              <div className="text-center">
                <p className="text-slate-500">New to AgriSmart? <button type="button" onClick={() => setIsRegistering(true)} className="text-emerald-600 font-bold hover:underline">Apply Now</button></p>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <Layout userRole={currentUser.role} onLogout={handleLogout} activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'dashboard' && currentUser.role === UserRole.FARMER && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-slate-800">Hello, {currentUser.name}!</h2>
              <p className="text-slate-500">Here's your real-time farm health summary.</p>
            </div>
            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-200 text-slate-600">
              <i className="fas fa-location-dot text-emerald-500"></i>
              <span className="text-sm font-semibold">Maharashtra Sector-4</span>
            </div>
          </header>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SensorCard label="Nitrogen" value={sensors.n} unit="mg/kg" icon="fa-flask" color="blue-500" />
            <SensorCard label="Phosphorus" value={sensors.p} unit="mg/kg" icon="fa-dna" color="purple-500" />
            <SensorCard label="Potassium" value={sensors.k} unit="mg/kg" icon="fa-atom" color="orange-500" />
            <SensorCard label="Soil pH" value={sensors.ph} unit="" icon="fa-vial" color="rose-500" />
            <SensorCard label="Moisture" value={sensors.moisture} unit="%" icon="fa-droplet" color="emerald-500" />
            <SensorCard label="Temperature" value={sensors.temp} unit="°C" icon="fa-temperature-half" color="amber-500" />
            <SensorCard label="Humidity" value={sensors.humidity} unit="%" icon="fa-cloud-sun" color="cyan-500" />
            <div className="bg-emerald-600 p-5 rounded-2xl shadow-lg flex flex-col justify-center items-center text-center text-white cursor-pointer hover:bg-emerald-700 transition-all">
               <i className="fas fa-rotate text-2xl mb-2"></i>
               <span className="font-bold">Sync IoT</span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg text-slate-800">Soil Nutrients History</h3>
                <div className="flex gap-2">
                  <span className="flex items-center gap-1 text-xs font-semibold text-slate-400"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> N</span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-slate-400"><span className="w-2 h-2 rounded-full bg-blue-500"></span> P</span>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={[
                    { name: 'Jan', n: 40, p: 35 },
                    { name: 'Feb', n: 42, p: 38 },
                    { name: 'Mar', n: 45, p: 40 },
                    { name: 'Apr', n: 48, p: 42 },
                    { name: 'May', n: 44, p: 41 },
                  ]}>
                    <defs>
                      <linearGradient id="colorN" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                    <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                    <Area type="monotone" dataKey="n" stroke="#10b981" fillOpacity={1} fill="url(#colorN)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-emerald-800 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden group">
               <div className="relative z-10">
                 <h3 className="text-xl font-bold mb-2">Membership Status</h3>
                 <div className="inline-flex items-center gap-2 bg-emerald-700/50 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-8">
                   <i className="fas fa-check-circle"></i> Active Member
                 </div>
                 <div className="space-y-4">
                   <div className="flex justify-between items-center text-sm">
                     <span className="text-emerald-200">Total Land Area</span>
                     <span className="font-bold">12.5 Acres</span>
                   </div>
                   <div className="flex justify-between items-center text-sm">
                     <span className="text-emerald-200">Next Soil Test</span>
                     <span className="font-bold">15 Jan, 2024</span>
                   </div>
                   <div className="flex justify-between items-center text-sm">
                     <span className="text-emerald-200">Current Crop</span>
                     <span className="font-bold">Rice (Paddy)</span>
                   </div>
                 </div>
                 <button className="w-full py-3 bg-white text-emerald-800 rounded-xl font-bold mt-8 hover:bg-emerald-50 transition-colors">
                   View Certificate
                 </button>
               </div>
               <i className="fas fa-certificate absolute -bottom-10 -right-10 text-9xl text-emerald-700/30 group-hover:scale-110 transition-transform duration-700"></i>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'dashboard' && currentUser.role === UserRole.ADMIN && (
        <div className="space-y-8 animate-in fade-in duration-500">
           <header>
             <h2 className="text-3xl font-bold text-slate-800">Admin Command Center</h2>
             <p className="text-slate-500">Monitor system health and farmer activity.</p>
           </header>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                 <div className="flex items-center gap-4 mb-4">
                   <div className="p-3 rounded-2xl bg-blue-50 text-blue-600"><i className="fas fa-users text-xl"></i></div>
                   <h3 className="font-bold">Total Farmers</h3>
                 </div>
                 <span className="text-4xl font-black text-slate-800">{farmers.length}</span>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                 <div className="flex items-center gap-4 mb-4">
                   <div className="p-3 rounded-2xl bg-amber-50 text-amber-600"><i className="fas fa-clock text-xl"></i></div>
                   <h3 className="font-bold">Pending Approval</h3>
                 </div>
                 <span className="text-4xl font-black text-slate-800">{farmers.filter(f => f.status === UserStatus.PENDING).length}</span>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                 <div className="flex items-center gap-4 mb-4">
                   <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600"><i className="fas fa-ad text-xl"></i></div>
                   <h3 className="font-bold">Total Ad Clicks</h3>
                 </div>
                 <span className="text-4xl font-black text-slate-800">{ads.reduce((acc, ad) => acc + ad.clicks, 0)}</span>
              </div>
           </div>

           <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-xl font-bold mb-6">Recent Applications</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-slate-400 text-xs uppercase tracking-widest font-bold">
                      <th className="pb-4">Farmer</th>
                      <th className="pb-4">Phone</th>
                      <th className="pb-4">Joined</th>
                      <th className="pb-4">Status</th>
                      <th className="pb-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 divide-y divide-slate-50">
                    {farmers.filter(f => f.status === UserStatus.PENDING).map(f => (
                      <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 font-semibold">{f.name}</td>
                        <td className="py-4">{f.phone}</td>
                        <td className="py-4 text-sm">{f.joinedAt.split('T')[0]}</td>
                        <td className="py-4">
                          <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-600 tracking-wider">Pending</span>
                        </td>
                        <td className="py-4 space-x-2">
                           <button onClick={() => approveFarmer(f.id)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><i className="fas fa-check"></i></button>
                           <button onClick={() => rejectFarmer(f.id)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><i className="fas fa-times"></i></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'prediction' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-slate-800">AI Crop Predictor</h2>
              <p className="text-slate-500">Using live IoT data and Gemini AI for precision forecasting.</p>
            </div>
            <button 
              onClick={fetchRecommendations}
              disabled={isLoadingRecs}
              className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/30"
            >
              {isLoadingRecs ? <i className="fas fa-spinner animate-spin"></i> : <i className="fas fa-wand-magic-sparkles"></i>}
              {isLoadingRecs ? 'Analyzing Soil...' : 'Run Prediction'}
            </button>
          </header>

          <div className="grid md:grid-cols-3 gap-6">
            {recommendations.length > 0 ? recommendations.map((rec, i) => (
              <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 border-t-4 border-t-emerald-500">
                <div className="flex justify-between items-start mb-4">
                   <h3 className="text-2xl font-bold text-slate-800">{rec.crop}</h3>
                   <div className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-full text-xs font-bold">{Math.round(rec.confidence * 100)}% Match</div>
                </div>
                <div className="space-y-4">
                  <p className="text-sm text-slate-600 leading-relaxed"><span className="font-bold text-slate-800">Reason:</span> {rec.suitabilityReason}</p>
                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <p className="text-xs text-slate-500 font-bold uppercase mb-2 tracking-widest"><i className="fas fa-calendar-alt mr-1"></i> Seasonal Outlook</p>
                    <p className="text-sm text-slate-700 italic">"{rec.seasonalOutlook}"</p>
                  </div>
                </div>
              </div>
            )) : (
              <div className="md:col-span-3 text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className="fas fa-microchip text-slate-300 text-3xl"></i>
                </div>
                <h3 className="text-xl font-bold text-slate-800">No predictions yet</h3>
                <p className="text-slate-400 max-w-xs mx-auto mt-2">Click the button above to analyze your soil data with AI.</p>
              </div>
            )}
          </div>
          
          <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 flex items-start gap-4">
             <div className="p-3 bg-white rounded-xl text-amber-500"><i className="fas fa-info-circle"></i></div>
             <div>
               <h4 className="font-bold text-amber-900">How it works?</h4>
               <p className="text-sm text-amber-800 mt-1">Our system sends real-time values from your ESP32 sensors (N, P, K, pH) to a Gemini Pro model trained on global agricultural datasets to ensure you get the best yield possible.</p>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="h-[calc(100vh-120px)] flex flex-col animate-in zoom-in duration-300">
          <header className="mb-6 flex items-center gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl"><i className="fas fa-robot text-xl"></i></div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">AI Agronomist</h2>
              <p className="text-sm text-slate-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Online Support
              </p>
            </div>
          </header>

          <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
             <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {chatHistory.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <i className="fas fa-comments text-5xl mb-4 text-slate-100"></i>
                    <p>Ask about pests, fertilizers, or crop symptoms.</p>
                  </div>
                )}
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                    <div className={`max-w-[80%] p-4 rounded-2xl ${msg.role === 'user' ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none shadow-sm'}`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef}></div>
             </div>

             <div className="p-4 border-t border-slate-50 bg-slate-50/50">
               <div className="flex gap-2">
                 <input 
                   value={chatInput}
                   onChange={(e) => setChatInput(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                   placeholder="Type your question..." 
                   className="flex-1 px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all shadow-inner bg-white" 
                 />
                 <button 
                   onClick={handleSendChat}
                   className="w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center hover:bg-emerald-700 active:scale-90 transition-all"
                 >
                   <i className="fas fa-paper-plane"></i>
                 </button>
               </div>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'market' && (
        <div className="space-y-8 animate-in fade-in duration-500">
           <header className="flex justify-between items-center">
             <div>
               <h2 className="text-3xl font-bold text-slate-800">Market Watch</h2>
               <p className="text-slate-500">Live wholesale Mandi rates for your region.</p>
             </div>
             <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 flex items-center gap-2">
               <i className="fas fa-filter"></i> Filters
             </button>
           </header>

           <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { name: 'Wheat', price: '₹2,450', unit: 'Quintal', trend: 'up' },
                { name: 'Rice (Basmati)', price: '₹3,800', unit: 'Quintal', trend: 'down' },
                { name: 'Cotton', price: '₹6,120', unit: 'Quintal', trend: 'up' },
                { name: 'Onion', price: '₹1,250', unit: 'Quintal', trend: 'stable' },
              ].map((m, i) => (
                <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-lg transition-all">
                   <div>
                     <h4 className="font-bold text-slate-800 group-hover:text-emerald-600 transition-colors">{m.name}</h4>
                     <p className="text-sm text-slate-400">Avg. Rate / {m.unit}</p>
                   </div>
                   <div className="text-right">
                     <p className="text-xl font-black text-slate-800">{m.price}</p>
                     <span className={`text-[10px] font-bold uppercase tracking-widest ${m.trend === 'up' ? 'text-emerald-500' : m.trend === 'down' ? 'text-rose-500' : 'text-slate-400'}`}>
                       <i className={`fas fa-caret-${m.trend === 'up' ? 'up' : m.trend === 'down' ? 'down' : 'right'} mr-1`}></i> {m.trend}
                     </span>
                   </div>
                </div>
              ))}
           </div>

           <div className="mt-8">
              <h3 className="font-bold text-xl mb-6">Promoted Agriculture Solutions</h3>
              <div className="grid md:grid-cols-2 gap-6">
                {ads.map(ad => (
                  <a key={ad.id} href={ad.targetUrl} target="_blank" className="block relative h-64 rounded-3xl overflow-hidden group">
                    <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-8 flex flex-col justify-end">
                      <span className="w-fit px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-bold text-white uppercase tracking-widest mb-2 border border-white/20">Sponsored</span>
                      <h4 className="text-2xl font-bold text-white mb-2">{ad.title}</h4>
                      <div className="flex items-center gap-2 text-emerald-400 font-bold group-hover:gap-4 transition-all">
                        Visit Official Site <i className="fas fa-arrow-right"></i>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
           </div>
        </div>
      )}

      {activeTab === 'farmers' && currentUser.role === UserRole.ADMIN && (
        <div className="space-y-8 animate-in slide-in-from-left-4 duration-500">
          <header className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold text-slate-800">Farmer Directory</h2>
              <p className="text-slate-500">Manage approved members and access their records.</p>
            </div>
            <button className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold flex items-center gap-2">
              <i className="fas fa-plus"></i> Manual Add
            </button>
          </header>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
             <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-4">
                <div className="relative flex-1">
                   <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                   <input placeholder="Search by name or phone..." className="w-full pl-12 pr-4 py-3 bg-white rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-left">
                  <thead>
                    <tr className="text-slate-400 text-xs uppercase tracking-widest font-bold border-b border-slate-50">
                      <th className="px-6 py-4">ID</th>
                      <th className="px-6 py-4">Farmer Name</th>
                      <th className="px-6 py-4">Phone</th>
                      <th className="px-6 py-4">Joined At</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {farmers.map(f => (
                      <tr key={f.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-xs font-mono text-slate-400">#{f.id}</td>
                        <td className="px-6 py-4 font-bold text-slate-800">{f.name}</td>
                        <td className="px-6 py-4 text-slate-600">{f.phone}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{f.joinedAt.split('T')[0]}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                            f.status === UserStatus.APPROVED ? 'bg-emerald-100 text-emerald-600' :
                            f.status === UserStatus.PENDING ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'
                          }`}>
                            {f.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-2">
                             <button className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"><i className="fas fa-edit"></i></button>
                             <button onClick={() => deleteFarmer(f.id)} className="p-2 text-slate-400 hover:text-rose-600 transition-colors"><i className="fas fa-trash"></i></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'ads' && currentUser.role === UserRole.ADMIN && (
        <div className="space-y-8 animate-in fade-in duration-500">
           <header className="flex justify-between items-center">
             <div>
               <h2 className="text-3xl font-bold text-slate-800">Marketing Hub</h2>
               <p className="text-slate-500">Manage dashboard banners and partner promotions.</p>
             </div>
             <button className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30">
               <i className="fas fa-cloud-upload-alt"></i> New Banner
             </button>
           </header>

           <div className="grid md:grid-cols-2 gap-8">
              {ads.map(ad => (
                <div key={ad.id} className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm flex flex-col">
                   <img src={ad.imageUrl} className="h-48 w-full object-cover" />
                   <div className="p-6">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-xl font-bold">{ad.title}</h4>
                        <div className="flex gap-2">
                          <button className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"><i className="fas fa-pencil"></i></button>
                          <button className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors"><i className="fas fa-trash"></i></button>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                         <div className="flex flex-col">
                           <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Total Clicks</span>
                           <span className="text-2xl font-black text-emerald-600">{ad.clicks}</span>
                         </div>
                         <div className="flex flex-col flex-1">
                           <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Target URL</span>
                           <span className="text-sm text-slate-500 truncate">{ad.targetUrl}</span>
                         </div>
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'private' && currentUser.role === UserRole.ADMIN && (
        <div className="space-y-8 animate-in zoom-in duration-300">
           <header>
             <h2 className="text-3xl font-bold text-slate-800">Admin Private Space</h2>
             <p className="text-slate-500">Secure storage for reports, CSVs, and internal documents.</p>
           </header>

           <div className="bg-slate-900 rounded-3xl p-10 text-white relative overflow-hidden">
              <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                 <div className="bg-white/10 p-8 rounded-3xl border border-white/20 backdrop-blur-md">
                    <i className="fas fa-shield-halved text-6xl text-emerald-400 mb-6"></i>
                    <h3 className="text-xl font-bold mb-2">Secure Repository</h3>
                    <p className="text-slate-400 text-sm">All files uploaded here are encrypted and accessible only to administrative accounts.</p>
                 </div>
                 <div className="flex-1 grid grid-cols-2 gap-4">
                    <button className="bg-white/5 p-6 rounded-2xl border border-white/10 hover:bg-white/10 transition-all text-center">
                       <i className="fas fa-file-csv text-2xl mb-2 text-emerald-400"></i>
                       <p className="text-xs font-bold uppercase tracking-widest">Export All Data</p>
                    </button>
                    <button className="bg-white/5 p-6 rounded-2xl border border-white/10 hover:bg-white/10 transition-all text-center">
                       <i className="fas fa-file-pdf text-2xl mb-2 text-rose-400"></i>
                       <p className="text-xs font-bold uppercase tracking-widest">Monthly Reports</p>
                    </button>
                    <button className="bg-white/5 p-6 rounded-2xl border border-white/10 hover:bg-white/10 transition-all text-center">
                       <i className="fas fa-cloud-arrow-up text-2xl mb-2 text-blue-400"></i>
                       <p className="text-xs font-bold uppercase tracking-widest">Upload Files</p>
                    </button>
                    <button className="bg-white/5 p-6 rounded-2xl border border-white/10 hover:bg-white/10 transition-all text-center">
                       <i className="fas fa-key text-2xl mb-2 text-amber-400"></i>
                       <p className="text-xs font-bold uppercase tracking-widest">API Logs</p>
                    </button>
                 </div>
              </div>
              <i className="fas fa-lock absolute -bottom-20 -right-20 text-[20rem] text-white/5"></i>
           </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
