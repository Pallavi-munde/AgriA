
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from './components/Layout';
import { User, UserRole, UserStatus, SensorData, CropRecommendation, MarketRate, AdBanner } from './types';
import { MOCK_SENSORS } from './constants';
import { getGeminiChatResponse, getCropRecommendation, diagnosePlantDisease, searchMarketTrends } from './services/geminiService';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// --- Sub Components ---

const SensorCard: React.FC<{ label: string; value: string | number; unit: string; icon: string; color: string }> = ({ label, value, unit, icon, color }) => (
  <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-500 group overflow-hidden relative">
    <div className={`absolute -right-4 -bottom-4 text-6xl opacity-5 text-${color} group-hover:scale-125 transition-transform duration-700`}>
      <i className={`fas ${icon}`}></i>
    </div>
    <div className="flex justify-between items-start mb-6">
      <div className={`p-4 rounded-2xl bg-${color}/10 text-${color}`}>
        <i className={`fas ${icon} text-xl`}></i>
      </div>
      <div className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase rounded-md tracking-widest">Live</div>
    </div>
    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">{label}</h3>
    <div className="flex items-baseline gap-1">
      <span className="text-3xl font-black text-slate-800">{value}</span>
      <span className="text-slate-400 text-sm font-medium">{unit}</span>
    </div>
  </div>
);

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sensors, setSensors] = useState<SensorData>(MOCK_SENSORS);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Crop Doctor State
  const [diagnosisImage, setDiagnosisImage] = useState<string | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<string | null>(null);

  // Market Search State
  const [marketSearchQuery, setMarketSearchQuery] = useState('Wheat');
  const [isSearchingMarket, setIsSearchingMarket] = useState(false);
  const [marketTrends, setMarketTrends] = useState<{text: string, sources: any[]} | null>(null);

  const [recommendations, setRecommendations] = useState<CropRecommendation[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'bot'; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  
  const [farmers, setFarmers] = useState<User[]>([
    { id: '1', name: 'Rajesh Kumar', phone: '9876543210', role: UserRole.FARMER, status: UserStatus.APPROVED, joinedAt: '2023-10-12' },
    { id: '2', name: 'Sunita Devi', phone: '9876543211', role: UserRole.FARMER, status: UserStatus.PENDING, joinedAt: '2023-11-05' },
    { id: '3', name: 'Amit Singh', phone: '9876543212', role: UserRole.FARMER, status: UserStatus.PENDING, joinedAt: '2023-11-20' },
  ]);

  const [ads] = useState<AdBanner[]>([
    { id: '1', title: 'Smart Irrigation Valve', imageUrl: 'https://images.unsplash.com/photo-1558449028-b53a39d100fc?auto=format&fit=crop&q=80&w=400', targetUrl: '#', clicks: 245 },
    { id: '2', title: 'Organic Pesticide Pack', imageUrl: 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&q=80&w=400', targetUrl: '#', clicks: 182 },
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Handlers ---

  const handleSyncIoT = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setSensors(prev => ({
        ...prev,
        moisture: Math.floor(Math.random() * (40 - 15) + 15),
        temp: Math.floor(Math.random() * (35 - 22) + 22),
        lastUpdated: new Date().toISOString()
      }));
      setIsSyncing(false);
    }, 1500);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setDiagnosisImage(reader.result as string);
        setDiagnosisResult(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRunDiagnosis = async () => {
    if (!diagnosisImage) return;
    setIsDiagnosing(true);
    try {
      const base64 = diagnosisImage.split(',')[1];
      const result = await diagnosePlantDisease(base64);
      setDiagnosisResult(result);
    } catch (err) {
      alert("Error diagnosing leaf. Please try again.");
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleMarketSearch = async () => {
    setIsSearchingMarket(true);
    try {
      const data = await searchMarketTrends(marketSearchQuery);
      setMarketTrends(data);
    } catch (err) {
      alert("Failed to search market trends.");
    } finally {
      setIsSearchingMarket(false);
    }
  };

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const phone = formData.get('phone') as string;
    const password = formData.get('password') as string;

    if (phone === 'admin' && password === 'admin') {
      setCurrentUser({ id: '0', name: 'Admin Master', phone: '000', role: UserRole.ADMIN, status: UserStatus.APPROVED, joinedAt: '2023-01-01' });
    } else {
      const user = farmers.find(f => f.phone === phone);
      if (user) {
        if (user.status === UserStatus.APPROVED) setCurrentUser(user);
        else alert("Account pending approval.");
      } else {
        alert("User not found.");
      }
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    const newMsg = { role: 'user' as const, text: chatInput };
    setChatHistory(prev => [...prev, newMsg]);
    setChatInput('');
    const botResponse = await getGeminiChatResponse(chatInput);
    setChatHistory(prev => [...prev, { role: 'bot', text: botResponse || "Error" }]);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // --- Views ---

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#064e3b] px-4 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
           <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-400 rounded-full blur-3xl animate-pulse"></div>
           <div className="absolute bottom-0 right-0 w-[40rem] h-[40rem] bg-emerald-300 rounded-full blur-[120px] opacity-20"></div>
        </div>
        
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-md relative z-10 border border-emerald-500/20">
          <div className="text-center mb-12">
            <div className="bg-[#10b981] w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/30">
              <i className="fas fa-seedling text-white text-4xl"></i>
            </div>
            <h1 className="text-4xl font-black text-slate-800 tracking-tight">AgriSmart AI</h1>
            <p className="text-slate-400 mt-2 font-medium">Precision Agriculture Redefined</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-400 tracking-widest ml-1">Phone Number</label>
              <input required name="phone" placeholder="Enter Phone or 'admin'" className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-emerald-100 outline-none transition-all font-bold" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-400 tracking-widest ml-1">Password</label>
              <input required name="password" type="password" placeholder="••••••••" className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-emerald-100 outline-none transition-all font-bold" />
            </div>
            <button type="submit" className="w-full py-5 bg-[#10b981] text-white rounded-2xl font-black shadow-xl shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all">
              Launch Dashboard
            </button>
          </form>
          <div className="mt-8 text-center">
             <p className="text-sm text-slate-400 font-bold">New to the network? <span className="text-emerald-600 cursor-pointer hover:underline">Apply Here</span></p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout userRole={currentUser.role} onLogout={() => setCurrentUser(null)} activeTab={activeTab} setActiveTab={setActiveTab}>
      
      {/* Farmer Dashboard */}
      {activeTab === 'dashboard' && currentUser.role === UserRole.FARMER && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
          <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h2 className="text-4xl font-black text-slate-800 tracking-tight">Farm Health</h2>
              <p className="text-slate-400 font-medium text-lg">Real-time IoT telemetry from Sector-4</p>
            </div>
            <button 
              onClick={handleSyncIoT}
              disabled={isSyncing}
              className="px-8 py-4 bg-white border-2 border-slate-100 rounded-2xl font-black text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-3 group shadow-sm"
            >
              <i className={`fas fa-sync-alt ${isSyncing ? 'animate-spin text-emerald-500' : 'group-hover:rotate-180 transition-transform duration-500'}`}></i>
              {isSyncing ? 'Linking ESP32...' : 'Sync IoT Sensors'}
            </button>
          </header>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <SensorCard label="Nitrogen" value={sensors.n} unit="ppm" icon="fa-vial-circle-check" color="blue-500" />
            <SensorCard label="Phosphorus" value={sensors.p} unit="ppm" icon="fa-flask-vial" color="purple-500" />
            <SensorCard label="Potassium" value={sensors.k} unit="ppm" icon="fa-atom" color="orange-500" />
            <SensorCard label="Soil pH" value={sensors.ph} unit="pH" icon="fa-droplet-degree" color="rose-500" />
            <SensorCard label="Moisture" value={sensors.moisture} unit="%" icon="fa-droplet" color="emerald-500" />
            <SensorCard label="Temperature" value={sensors.temp} unit="°C" icon="fa-temperature-three-quarters" color="amber-500" />
            <SensorCard label="Humidity" value={sensors.humidity} unit="%" icon="fa-cloud-sun" color="cyan-500" />
            <div className="bg-[#064e3b] p-8 rounded-[2rem] shadow-xl flex flex-col justify-center items-center text-center text-white cursor-pointer hover:bg-emerald-900 transition-all group overflow-hidden relative">
               <i className="fas fa-satellite-dish text-4xl mb-3 group-hover:scale-110 transition-transform"></i>
               <span className="font-black text-sm uppercase tracking-widest">Signal Strength</span>
               <span className="text-xs text-emerald-400 mt-1 font-bold">98% Stable</span>
               <div className="absolute top-0 right-0 p-3"><div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></div></div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-black text-xl text-slate-800">Moisture Index (24h)</h3>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Optimal</div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400"><div className="w-2 h-2 rounded-full bg-blue-300"></div> Excess</div>
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={[
                    { t: '06:00', m: 22 }, { t: '10:00', m: 28 }, { t: '14:00', m: 18 }, { t: '18:00', m: 25 }, { t: '22:00', m: 23 },
                  ]}>
                    <defs>
                      <linearGradient id="colorM" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="t" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}} />
                    <Tooltip contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '12px'}} />
                    <Area type="monotone" dataKey="m" stroke="#10b981" fillOpacity={1} fill="url(#colorM)" strokeWidth={4} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-6">
               <div className="bg-[#10b981] p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group">
                  <div className="relative z-10">
                    <h3 className="text-xl font-black mb-1">Crop Yield Forecast</h3>
                    <p className="text-emerald-100 text-sm mb-8 font-medium">Estimated for Monsoon 2024</p>
                    <div className="flex items-end justify-between">
                      <span className="text-5xl font-black">9.4</span>
                      <span className="text-xl font-bold pb-1 text-emerald-100">Tons / Acre</span>
                    </div>
                  </div>
                  <i className="fas fa-chart-line absolute -bottom-6 -right-6 text-[10rem] text-white/10 group-hover:rotate-12 transition-transform duration-700"></i>
               </div>
               
               <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-slate-800">Rainfall Alert</h4>
                    <p className="text-sm text-slate-400 font-medium">Expected in 4 hours</p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center text-xl">
                    <i className="fas fa-cloud-showers-heavy"></i>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Overview */}
      {activeTab === 'dashboard' && currentUser.role === UserRole.ADMIN && (
        <div className="space-y-10 animate-in fade-in duration-700">
           <header>
             <h2 className="text-4xl font-black text-slate-800 tracking-tight">Control Center</h2>
             <p className="text-slate-400 font-medium text-lg">System-wide agricultural monitoring</p>
           </header>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                 <div className="flex items-center gap-4 mb-6">
                   <div className="p-4 rounded-2xl bg-blue-50 text-blue-600 shadow-inner"><i className="fas fa-users-viewfinder text-xl"></i></div>
                   <h3 className="font-black text-slate-800">Total Enrolled</h3>
                 </div>
                 <span className="text-5xl font-black text-slate-800">{farmers.length}</span>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                 <div className="flex items-center gap-4 mb-6">
                   <div className="p-4 rounded-2xl bg-amber-50 text-amber-600 shadow-inner"><i className="fas fa-hourglass-half text-xl"></i></div>
                   <h3 className="font-black text-slate-800">Approvals</h3>
                 </div>
                 <span className="text-5xl font-black text-slate-800">{farmers.filter(f => f.status === UserStatus.PENDING).length}</span>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                 <div className="flex items-center gap-4 mb-6">
                   <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-600 shadow-inner"><i className="fas fa-database text-xl"></i></div>
                   <h3 className="font-black text-slate-800">IoT Nodes</h3>
                 </div>
                 <span className="text-5xl font-black text-slate-800">42</span>
              </div>
           </div>

           <div className="bg-[#064e3b] p-10 rounded-[3rem] text-white flex flex-col lg:flex-row gap-10 items-center overflow-hidden relative">
              <div className="flex-1 space-y-6 relative z-10">
                <h3 className="text-3xl font-black tracking-tight">Regional Soil Heatmap</h3>
                <p className="text-emerald-100/60 font-medium">Mapping average Nutrient levels across the district. Data aggregated from active IoT nodes.</p>
                <div className="space-y-4">
                  {['District A', 'District B', 'District C'].map((d, i) => (
                    <div key={d} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-emerald-400">
                        <span>{d}</span>
                        <span>{85 - i * 15}% Healthy</span>
                      </div>
                      <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                        <div className="bg-[#10b981] h-full" style={{ width: `${85 - i * 15}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="w-full lg:w-1/2 h-64 bg-white/5 rounded-[2rem] border border-white/10 flex items-center justify-center relative z-10">
                 <i className="fas fa-map-location-dot text-7xl text-white/20"></i>
              </div>
              <i className="fas fa-globe absolute -right-20 -bottom-20 text-[20rem] text-white/5"></i>
           </div>
        </div>
      )}

      {/* Crop Doctor - Vision Feature */}
      {activeTab === 'doctor' && (
        <div className="max-w-4xl mx-auto space-y-10 animate-in zoom-in duration-500">
          <header className="text-center">
            <h2 className="text-4xl font-black text-slate-800">AI Crop Doctor</h2>
            <p className="text-slate-400 font-medium text-lg mt-2">Upload a photo of a sick leaf for instant AI diagnosis.</p>
          </header>

          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
            <div className="flex flex-col items-center justify-center">
               {diagnosisImage ? (
                 <div className="relative w-full max-w-sm rounded-[2rem] overflow-hidden group shadow-2xl">
                    <img src={diagnosisImage} className="w-full h-80 object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                       <button onClick={() => setDiagnosisImage(null)} className="px-6 py-3 bg-white text-rose-600 rounded-xl font-bold">Clear Image</button>
                    </div>
                 </div>
               ) : (
                 <label className="w-full h-80 border-4 border-dashed border-slate-100 rounded-[2.5rem] flex flex-col items-center justify-center cursor-pointer hover:border-emerald-200 hover:bg-emerald-50 transition-all group">
                    <div className="w-20 h-20 rounded-full bg-slate-50 text-slate-300 flex items-center justify-center text-3xl mb-4 group-hover:scale-110 group-hover:bg-emerald-100 group-hover:text-emerald-500 transition-all">
                      <i className="fas fa-cloud-upload-alt"></i>
                    </div>
                    <span className="font-black text-slate-400 uppercase tracking-widest text-sm">Drop Leaf Photo Here</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                 </label>
               )}
            </div>

            <button 
              onClick={handleRunDiagnosis}
              disabled={!diagnosisImage || isDiagnosing}
              className="w-full py-5 bg-[#10b981] text-white rounded-2xl font-black shadow-xl shadow-emerald-500/30 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-3"
            >
              {isDiagnosing ? <i className="fas fa-spinner animate-spin"></i> : <i className="fas fa-microscope"></i>}
              {isDiagnosing ? 'Analyzing Plant Tissue...' : 'Generate Diagnosis Report'}
            </button>

            {diagnosisResult && (
              <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 animate-in slide-in-from-top-4">
                 <h4 className="text-xl font-black text-slate-800 mb-4 flex items-center gap-2">
                    <i className="fas fa-clipboard-check text-emerald-500"></i> Diagnosis Result
                 </h4>
                 <div className="prose prose-slate max-w-none text-slate-600 font-medium whitespace-pre-wrap">
                   {diagnosisResult}
                 </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Market - Grounded Search Feature */}
      {activeTab === 'market' && (
        <div className="space-y-10 animate-in fade-in duration-500">
           <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
             <div>
               <h2 className="text-4xl font-black text-slate-800 tracking-tight">Market Intelligence</h2>
               <p className="text-slate-400 font-medium text-lg">Real-time commodity search powered by Google</p>
             </div>
             <div className="flex gap-2">
               <input 
                 value={marketSearchQuery}
                 onChange={(e) => setMarketSearchQuery(e.target.value)}
                 placeholder="Search Commodity (e.g. Wheat)" 
                 className="px-6 py-4 bg-white border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-emerald-100 transition-all"
               />
               <button 
                 onClick={handleMarketSearch}
                 disabled={isSearchingMarket}
                 className="w-14 h-14 bg-[#10b981] text-white rounded-2xl flex items-center justify-center hover:shadow-lg transition-all"
               >
                 {isSearchingMarket ? <i className="fas fa-spinner animate-spin"></i> : <i className="fas fa-magnifying-glass"></i>}
               </button>
             </div>
           </header>

           {marketTrends && (
             <div className="grid lg:grid-cols-3 gap-8">
               <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                  <h3 className="text-2xl font-black text-slate-800">Intelligence Brief</h3>
                  <div className="prose prose-emerald whitespace-pre-wrap text-slate-600 font-medium leading-relaxed">
                    {marketTrends.text}
                  </div>
               </div>
               <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl h-fit sticky top-8">
                  <h4 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400 mb-6 flex items-center gap-2">
                    <i className="fas fa-shield-check"></i> Grounded Sources
                  </h4>
                  <div className="space-y-4">
                    {marketTrends.sources.length > 0 ? marketTrends.sources.map((source: any, i: number) => (
                      <a key={i} href={source.web?.uri} target="_blank" className="block p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group">
                         <p className="text-sm font-bold text-white mb-1 line-clamp-1 group-hover:text-emerald-400">{source.web?.title || 'External Report'}</p>
                         <p className="text-[10px] text-slate-500 font-bold truncate">{source.web?.uri}</p>
                      </a>
                    )) : (
                       <p className="text-slate-500 text-sm italic">General knowledge base used.</p>
                    )}
                  </div>
               </div>
             </div>
           )}

           <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { name: 'Wheat', price: '₹2,450', trend: 'up' },
                { name: 'Basmati Rice', price: '₹3,800', trend: 'down' },
                { name: 'Cotton', price: '₹6,120', trend: 'up' },
                { name: 'Turmeric', price: '₹1,250', trend: 'stable' },
              ].map((m, i) => (
                <div key={i} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between group">
                   <div>
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg. Rate</span>
                     <h4 className="font-black text-xl text-slate-800 mb-4">{m.name}</h4>
                   </div>
                   <div className="flex items-end justify-between">
                     <p className="text-2xl font-black text-slate-800">{m.price}</p>
                     <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${m.trend === 'up' ? 'bg-emerald-50 text-emerald-600' : m.trend === 'down' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>
                       <i className={`fas fa-arrow-trend-${m.trend === 'up' ? 'up' : m.trend === 'down' ? 'down' : 'up'}`}></i>
                     </div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* Prediction & Advisor - Keeping legacy logic but improving styles */}
      {activeTab === 'prediction' && (
         <div className="space-y-10 animate-in slide-in-from-right-10 duration-700">
            <header className="flex justify-between items-center">
               <div>
                 <h2 className="text-4xl font-black text-slate-800">Prediction Engine</h2>
                 <p className="text-slate-400 font-medium">Analyzing soil chemistry for optimal yield.</p>
               </div>
               <button 
                 onClick={async () => {
                   setIsLoadingRecs(true);
                   const res = await getCropRecommendation(sensors);
                   setRecommendations(res);
                   setIsLoadingRecs(false);
                 }}
                 disabled={isLoadingRecs}
                 className="px-8 py-4 bg-[#10b981] text-white rounded-2xl font-black shadow-xl shadow-emerald-500/30 flex items-center gap-3"
               >
                 {isLoadingRecs ? <i className="fas fa-dna animate-spin"></i> : <i className="fas fa-brain-circuit"></i>}
                 {isLoadingRecs ? 'Running Genomics...' : 'Run Simulation'}
               </button>
            </header>
            
            <div className="grid md:grid-cols-3 gap-8">
              {recommendations.length > 0 ? recommendations.map((r, i) => (
                <div key={i} className="bg-white p-8 rounded-[3rem] shadow-sm border-t-8 border-[#10b981] hover:shadow-2xl transition-all duration-500">
                   <div className="flex justify-between mb-4">
                     <h4 className="text-2xl font-black text-slate-800">{r.crop}</h4>
                     <span className="text-emerald-600 font-black">{Math.round(r.confidence * 100)}%</span>
                   </div>
                   <p className="text-slate-600 font-medium text-sm leading-relaxed mb-6">{r.suitabilityReason}</p>
                   <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                      <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-1">Outlook</p>
                      <p className="text-xs font-bold text-emerald-800 italic">"{r.seasonalOutlook}"</p>
                   </div>
                </div>
              )) : (
                <div className="md:col-span-3 py-32 text-center bg-white rounded-[3rem] border-4 border-dashed border-slate-100">
                   <i className="fas fa-wand-magic-sparkles text-6xl text-slate-100 mb-6"></i>
                   <h3 className="text-xl font-black text-slate-300">Ready to simulate</h3>
                </div>
              )}
            </div>
         </div>
      )}

      {/* Chat Tab - Agronomist Advisor */}
      {activeTab === 'chat' && (
        <div className="h-[calc(100vh-200px)] flex flex-col animate-in slide-in-from-right-10 duration-700">
          <header className="mb-8 flex items-center gap-5">
            <div className="w-16 h-16 bg-[#10b981] text-white rounded-3xl flex items-center justify-center text-3xl shadow-lg">
              <i className="fas fa-user-doctor"></i>
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-800">AI Agronomist</h2>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                <span className="text-sm font-bold text-emerald-600 uppercase tracking-widest">Active Consultant</span>
              </div>
            </div>
          </header>

          <div className="flex-1 bg-white rounded-[3rem] shadow-2xl border border-slate-100 flex flex-col overflow-hidden">
             <div className="flex-1 overflow-y-auto p-10 space-y-6">
                {chatHistory.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-20 grayscale">
                    <i className="fas fa-comment-medical text-9xl mb-6"></i>
                    <p className="text-xl font-black">Waiting for your question...</p>
                  </div>
                )}
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-3`}>
                    {msg.role === 'bot' && <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] text-emerald-600 font-black">AI</div>}
                    <div className={`max-w-[75%] p-6 rounded-[2rem] text-sm font-bold leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-[#064e3b] text-white rounded-br-none' : 'bg-slate-50 text-slate-800 rounded-bl-none'}`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef}></div>
             </div>

             <div className="p-6 border-t border-slate-50 bg-slate-50/50">
               <div className="flex gap-4">
                 <input 
                   value={chatInput}
                   onChange={(e) => setChatInput(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                   placeholder="Ask about fertilizer mix, pest signs, or irrigation..." 
                   className="flex-1 px-8 py-5 rounded-[2rem] border-2 border-slate-100 outline-none focus:ring-4 focus:ring-emerald-100 transition-all font-bold shadow-inner bg-white" 
                 />
                 <button 
                   onClick={handleSendChat}
                   className="w-16 h-16 bg-[#10b981] text-white rounded-[2rem] flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl shadow-emerald-500/30"
                 >
                   <i className="fas fa-paper-plane"></i>
                 </button>
               </div>
             </div>
          </div>
        </div>
      )}

      {/* Admin CRM Tabs */}
      {activeTab === 'farmers' && currentUser.role === UserRole.ADMIN && (
        <div className="space-y-8 animate-in slide-in-from-left-10 duration-700">
           <header className="flex justify-between items-center">
             <h2 className="text-4xl font-black text-slate-800 tracking-tight">Farmer Database</h2>
             <button className="px-8 py-4 bg-[#10b981] text-white rounded-2xl font-black shadow-lg">Export CSV</button>
           </header>
           
           <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100 font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">
                  <tr>
                    <th className="px-8 py-6">ID</th>
                    <th className="px-8 py-6">Name</th>
                    <th className="px-8 py-6">Phone</th>
                    <th className="px-8 py-6">Status</th>
                    <th className="px-8 py-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {farmers.map(f => (
                    <tr key={f.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-6 text-xs font-black text-slate-300">#{f.id}</td>
                      <td className="px-8 py-6 font-black text-slate-800">{f.name}</td>
                      <td className="px-8 py-6 font-bold text-slate-500">{f.phone}</td>
                      <td className="px-8 py-6">
                         <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${
                           f.status === UserStatus.APPROVED ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                         }`}>
                           {f.status}
                         </span>
                      </td>
                      <td className="px-8 py-6 text-right space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button className="p-3 bg-slate-100 rounded-xl text-slate-600 hover:bg-blue-100 hover:text-blue-600 transition-all"><i className="fas fa-pencil"></i></button>
                         <button className="p-3 bg-slate-100 rounded-xl text-slate-600 hover:bg-rose-100 hover:text-rose-600 transition-all"><i className="fas fa-trash"></i></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
           </div>
        </div>
      )}

    </Layout>
  );
};

export default App;
