
import React, { useState, useEffect, useRef } from 'react';
import Layout from './components/Layout';
import { User, UserRole, UserStatus, SensorData, CropRecommendation, AdBanner } from './types';
import { MOCK_SENSORS, TRANSLATIONS, getSystemInstruction } from './constants';
import { getCropRecommendation, diagnosePlantDisease, searchMarketTrends } from './services/geminiService';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";

// --- Mock Data ---
const MOCK_CAMPAIGNS: AdBanner[] = [
  { id: '1', title: 'Sustainable Wheat Farming Workshop', imageUrl: 'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?q=80&w=2070&auto=format&fit=crop', targetUrl: '#', clicks: 1240 },
  { id: '2', title: 'New Government MSP for Monsoon Crops', imageUrl: 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?q=80&w=2070&auto=format&fit=crop', targetUrl: '#', clicks: 850 },
  { id: '3', title: 'Bio-Fertilizer Subsidy Program 2024', imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=2070&auto=format&fit=crop', targetUrl: '#', clicks: 2100 },
];

const MOCK_DOCS = [
  { n: 'District Soil Assessment.pdf', s: '5.4 MB', i: 'fa-file-pdf', c: 'text-rose-500' },
  { n: 'Aggregate NPK Logs.csv', s: '12.1 MB', i: 'fa-file-csv', c: 'text-emerald-500' },
  { n: 'National Subsidy Rules.docx', s: '1.2 MB', i: 'fa-file-word', c: 'text-blue-500' },
];

// --- Audio Utilities for Live API ---
function encode(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const SensorCard: React.FC<{ label: string; value: string | number; unit: string; icon: string; colorKey: string }> = ({ label, value, unit, icon, colorKey }) => {
  const colorMap: any = {
    'blue-500': 'text-blue-500 bg-blue-50',
    'purple-500': 'text-purple-500 bg-purple-50',
    'orange-500': 'text-orange-500 bg-orange-50',
    'rose-500': 'text-rose-500 bg-rose-50',
    'emerald-500': 'text-emerald-500 bg-emerald-50',
    'amber-500': 'text-amber-500 bg-amber-50',
  };
  const colors = colorMap[colorKey] || 'text-emerald-500 bg-emerald-50';
  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 relative group overflow-hidden transition-all hover:shadow-md">
      <div className={`absolute -right-4 -bottom-4 text-6xl opacity-5 ${colors.split(' ')[0]} group-hover:scale-125 transition-transform duration-700`}>
        <i className={`fas ${icon}`}></i>
      </div>
      <div className="flex justify-between items-start mb-6">
        <div className={`p-4 rounded-2xl ${colors}`}><i className={`fas ${icon} text-xl`}></i></div>
        <div className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase rounded-md tracking-widest">Live</div>
      </div>
      <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">{label}</h3>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-black text-slate-800">{value}</span>
        <span className="text-slate-400 text-sm font-medium">{unit}</span>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  // Global States
  const [farmers, setFarmers] = useState<User[]>(() => {
    const saved = localStorage.getItem('agri_farmers_v7');
    return saved ? JSON.parse(saved) : [
      { id: '1', name: 'Rajesh Kumar', phone: '9876543210', role: UserRole.FARMER, status: UserStatus.APPROVED, joinedAt: '2023-10-12', password: 'password' },
    ];
  });
  useEffect(() => localStorage.setItem('agri_farmers_v7', JSON.stringify(farmers)), [farmers]);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [language, setLanguage] = useState('en');
  const [sensors] = useState<SensorData>(MOCK_SENSORS);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [authState, setAuthState] = useState<'login' | 'applying' | 'success'>('login');
  const [applyForm, setApplyForm] = useState({ name: '', phone: '', password: '', area: '', location: '' });

  // Feature specific states
  const [diagnosisImage, setDiagnosisImage] = useState<string | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<string | null>(null);
  const [marketQuery, setMarketQuery] = useState('Rice');
  const [marketIntel, setMarketIntel] = useState<{text: string, sources: any[]} | null>(null);
  const [isMarketSearching, setIsMarketSearching] = useState(false);
  const [recs, setRecs] = useState<CropRecommendation[]>([]);
  const [isPredicting, setIsPredicting] = useState(false);
  const [manualParams, setManualParams] = useState({ n: 45, p: 50, k: 35, ph: 6.5, moisture: 20, temp: 25 });
  const [predMode, setPredMode] = useState<'iot' | 'manual'>('iot');

  // Voice States
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [liveTransInput, setLiveTransInput] = useState('');
  const [liveTransOutput, setLiveTransOutput] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);

  const sessionRef = useRef<any>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const t = TRANSLATIONS[language];
  const langDisplay = language === 'en' ? 'English' : language === 'hi' ? 'Hindi' : 'Marathi';

  const stopVoice = () => {
    setIsVoiceActive(false); setIsAiSpeaking(false); setIsThinking(false);
    setLiveTransInput(''); setLiveTransOutput(''); setAudioLevel(0);
    if (sessionRef.current) sessionRef.current.close();
    if (inputCtxRef.current) inputCtxRef.current.close();
    if (outputCtxRef.current) outputCtxRef.current.close();
    sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    sourcesRef.current.clear();
  };

  const startVoice = async () => {
    try {
      setIsVoiceActive(true);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      inputCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      inputAnalyserRef.current = inputCtxRef.current.createAnalyser();
      inputAnalyserRef.current.fftSize = 256;
      outputAnalyserRef.current = outputCtxRef.current.createAnalyser();
      outputAnalyserRef.current.fftSize = 256;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            const source = inputCtxRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputCtxRef.current!.createScriptProcessor(4096, 1, 1);
            source.connect(inputAnalyserRef.current!);
            const dataArray = new Uint8Array(256);
            const update = () => {
              if (!isVoiceActive) return;
              let level = 0;
              if (isAiSpeaking && outputAnalyserRef.current) {
                outputAnalyserRef.current.getByteFrequencyData(dataArray);
                level = dataArray.reduce((a, b) => a + b) / dataArray.length;
              } else if (inputAnalyserRef.current) {
                inputAnalyserRef.current.getByteFrequencyData(dataArray);
                level = dataArray.reduce((a, b) => a + b) / dataArray.length;
              }
              setAudioLevel(level);
              requestAnimationFrame(update);
            };
            update();
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtxRef.current!.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
              setIsAiSpeaking(true); setIsThinking(false);
              const base64 = msg.serverContent.modelTurn.parts[0].inlineData.data;
              const ctx = outputCtxRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const buffer = await decodeAudioData(decode(base64), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputAnalyserRef.current!);
              outputAnalyserRef.current!.connect(ctx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => { 
                sourcesRef.current.delete(source); 
                if (sourcesRef.current.size === 0) setIsAiSpeaking(false); 
              };
            }
            if (msg.serverContent?.inputTranscription) { 
              setLiveTransInput(msg.serverContent.inputTranscription.text); 
              setIsThinking(true); 
            }
            if (msg.serverContent?.outputTranscription) {
              setLiveTransOutput(prev => prev + msg.serverContent!.outputTranscription!.text);
            }
            if (msg.serverContent?.turnComplete) {
              setIsThinking(false);
              setTimeout(() => { 
                if (!isAiSpeaking) { 
                  setLiveTransInput(''); 
                  setLiveTransOutput(''); 
                } 
              }, 6000);
            }
            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsAiSpeaking(false);
            }
          },
          onclose: () => stopVoice(),
          onerror: () => stopVoice()
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          inputAudioTranscription: {}, outputAudioTranscription: {},
          systemInstruction: getSystemInstruction(langDisplay) + 
            " You are an AI Agronomist Advisor. BE PROACTIVE. Introduce yourself. Greet the farmer warmly. Offer to check NPK, diagnose a crop, or give market trends. Use the latest sensor telemetry provided if applicable.",
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) { stopVoice(); }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginPhone === 'admin' && loginPass === 'admin') {
      setCurrentUser({ id: 'adm-0', name: 'System Admin', phone: 'admin', role: UserRole.ADMIN, status: UserStatus.APPROVED, joinedAt: new Date().toISOString() });
      setActiveTab('dashboard'); return;
    }
    const user = farmers.find(f => f.phone === loginPhone);
    if (user && user.status === UserStatus.APPROVED && (loginPass === (user.password || 'password'))) {
      setCurrentUser(user); setActiveTab('dashboard');
    } else alert("Invalid credentials or account pending approval.");
  };

  const handleFarmerAction = (id: string, status: UserStatus) => {
    setFarmers(prev => prev.map(f => f.id === id ? { ...f, status } : f));
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      name: applyForm.name, phone: applyForm.phone, password: applyForm.password,
      role: UserRole.FARMER, status: UserStatus.PENDING, farmArea: parseFloat(applyForm.area),
      joinedAt: new Date().toISOString()
    };
    setFarmers(prev => [...prev, newUser]);
    setAuthState('success');
  };

  const generateFriendlyPassword = () => {
    const words = ["Soil", "Seed", "Rain", "Farm", "Leaf", "Root", "Green", "Crop"];
    const p = words[Math.floor(Math.random()*words.length)] + "-" + Math.floor(1000 + Math.random()*9000);
    setApplyForm({...applyForm, password: p});
  };

  // Content rendering logic
  const renderFarmerContent = () => {
    switch(activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-10 animate-in fade-in duration-700">
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div><h2 className="text-4xl font-black text-slate-800 tracking-tight">Farm Health</h2><p className="text-slate-400 font-bold">IoT-Linked Telemetry Dashboard</p></div>
              <button onClick={() => { setIsSyncing(true); setTimeout(() => setIsSyncing(false), 1500); }} className="px-8 py-4 bg-white border border-slate-100 rounded-2xl font-black text-slate-700 hover:bg-slate-50 flex items-center gap-3 shadow-sm transition-all active:scale-95">
                <i className={`fas fa-sync-alt ${isSyncing ? 'animate-spin text-emerald-500' : ''}`}></i> {isSyncing ? t.syncing : t.sync}
              </button>
            </header>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
              <SensorCard label={t.nitrogen} value={sensors.n} unit="ppm" icon="fa-vial" colorKey="blue-500" />
              <SensorCard label={t.phosphorus} value={sensors.p} unit="ppm" icon="fa-flask-vial" colorKey="purple-500" />
              <SensorCard label={t.potassium} value={sensors.k} unit="ppm" icon="fa-atom" colorKey="orange-500" />
              <SensorCard label={t.soilPh} value={sensors.ph} unit="pH" icon="fa-droplet-degree" colorKey="rose-500" />
              <SensorCard label={t.moisture} value={sensors.moisture} unit="%" icon="fa-droplet" colorKey="emerald-500" />
              <SensorCard label={t.temp} value={sensors.temp} unit="°C" icon="fa-temperature-three-quarters" colorKey="amber-500" />
            </div>
          </div>
        );
      case 'doctor':
        return (
          <div className="max-w-4xl mx-auto space-y-10 animate-in zoom-in duration-500">
            <header className="text-center"><h2 className="text-4xl font-black text-slate-800">Crop Doctor</h2><p className="text-slate-400 font-bold">AI Visual Health Analysis</p></header>
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8 text-center">
              {diagnosisImage ? (
                <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl max-w-lg mx-auto">
                  <img src={diagnosisImage} className="w-full h-80 object-cover" />
                  <button onClick={() => setDiagnosisImage(null)} className="absolute top-4 right-4 bg-white/90 p-3 rounded-full text-rose-500 shadow-lg hover:bg-white transition-all"><i className="fas fa-times"></i></button>
                </div>
              ) : (
                <label className="w-full h-80 border-4 border-dashed border-slate-100 rounded-[3rem] flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-50 transition-all group">
                  <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-200 text-3xl mb-4 group-hover:scale-110 transition-transform"><i className="fas fa-camera"></i></div>
                  <span className="font-black text-slate-300 uppercase tracking-widest text-sm">Upload leaf photo</span>
                  <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onloadend = () => setDiagnosisImage(r.result as string); r.readAsDataURL(f); } }} className="hidden" />
                </label>
              )}
              <button onClick={async () => { if (!diagnosisImage) return; setIsDiagnosing(true); try { const res = await diagnosePlantDisease(diagnosisImage.split(',')[1], langDisplay); setDiagnosisResult(res); } catch(e) { alert("Error analyzing image."); } finally { setIsDiagnosing(false); } }} disabled={isDiagnosing || !diagnosisImage} className="w-full py-6 bg-[#10b981] text-white rounded-[2rem] font-black shadow-xl disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-95">
                {isDiagnosing ? 'Analyzing health...' : 'Run Diagnostics'}
              </button>
              {diagnosisResult && (
                <div className="p-10 bg-slate-50 rounded-[3rem] text-left border border-slate-100 animate-in slide-in-from-top-4">
                  <h4 className="font-black text-2xl mb-6 text-slate-800">Expert Analysis Report</h4>
                  <div className="prose prose-emerald max-w-none text-slate-600 font-bold text-lg leading-relaxed whitespace-pre-wrap">{diagnosisResult}</div>
                </div>
              )}
            </div>
          </div>
        );
      case 'prediction':
        return (
          <div className="space-y-10 animate-in slide-in-from-right-6 duration-700">
            <header className="flex justify-between items-center"><div><h2 className="text-4xl font-black text-slate-800">Predictor</h2><p className="text-slate-400 font-bold">Optimal crop selection based on data</p></div><div className="flex bg-slate-100 p-2 rounded-2xl"><button onClick={() => setPredMode('iot')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${predMode === 'iot' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>IoT Auto</button><button onClick={() => setPredMode('manual')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${predMode === 'manual' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>Manual</button></div></header>
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 grid grid-cols-2 md:grid-cols-3 gap-8 shadow-sm">
              {[{ id: 'n', l: 'Nitrogen' }, { id: 'p', l: 'Phosphorus' }, { id: 'k', l: 'Potassium' }, { id: 'ph', l: 'pH' }, { id: 'moisture', l: 'Moisture' }, { id: 'temp', l: 'Temp' }].map(f => (
                <div key={f.id} className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2">{f.l}</label><input disabled={predMode === 'iot'} type="number" value={predMode === 'iot' ? sensors[f.id as keyof SensorData] as number : manualParams[f.id as keyof typeof manualParams]} onChange={e => setManualParams({...manualParams, [f.id]: parseFloat(e.target.value)})} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 font-black outline-none focus:ring-4 focus:ring-emerald-100 transition-all" /></div>
              ))}
              <button onClick={async () => { setIsPredicting(true); try { const r = await getCropRecommendation(predMode === 'iot' ? sensors : manualParams, langDisplay); setRecs(r); } catch(e) { alert("Prediction failed."); } finally { setIsPredicting(false); } }} className="md:col-span-3 py-6 bg-[#10b981] text-white rounded-[2rem] font-black shadow-xl mt-4 hover:scale-[1.01] active:scale-95 transition-all">
                {isPredicting ? 'Consulting ML Models...' : 'Predict Best Crops'}
              </button>
            </div>
            <div className="grid md:grid-cols-3 gap-8">{recs.map((r, i) => (
              <div key={i} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:translate-y-[-4px] transition-all duration-500">
                <div className="w-16 h-16 bg-emerald-50 rounded-3xl flex items-center justify-center text-[#10b981] text-2xl mb-6 font-black">{Math.round(r.confidence * 100)}%</div>
                <h4 className="text-3xl font-black text-slate-800 mb-4">{r.crop}</h4>
                <p className="text-slate-500 text-sm font-bold leading-relaxed mb-8">{r.suitabilityReason}</p>
                <div className="p-5 bg-emerald-50 rounded-2xl font-black text-emerald-800 text-xs italic leading-snug">"{r.seasonalOutlook}"</div>
              </div>
            ))}</div>
          </div>
        );
      case 'market':
        return (
          <div className="space-y-10 animate-in fade-in duration-700">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6"><div><h2 className="text-4xl font-black text-slate-800">Market Intel</h2><p className="text-slate-400 font-bold">Grounded analysis of Mandi trends</p></div><div className="flex gap-4"><input value={marketQuery} onChange={e => setMarketQuery(e.target.value)} className="px-8 py-4 bg-white border border-slate-100 rounded-[1.5rem] font-black shadow-sm outline-none focus:ring-4 focus:ring-emerald-100 transition-all" /><button onClick={async () => { setIsMarketSearching(true); try { setMarketIntel(await searchMarketTrends(marketQuery, langDisplay)); } catch(e) { alert("Search failed."); } finally { setIsMarketSearching(false); } }} className="w-16 h-16 bg-[#10b981] text-white rounded-[1.5rem] flex items-center justify-center font-black shadow-xl hover:scale-105 active:scale-95 transition-all"><i className={`fas ${isMarketSearching ? 'fa-spinner animate-spin' : 'fa-search'}`}></i></button></div></header>
            {marketIntel && (
              <div className="grid lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-sm space-y-8 animate-in slide-in-from-left-6"><h3 className="text-2xl font-black text-slate-800">Commodity Report</h3><div className="prose prose-emerald max-w-none text-slate-600 font-bold text-xl whitespace-pre-wrap leading-relaxed">{marketIntel.text}</div></div>
                <div className="bg-slate-900 p-10 rounded-[3.5rem] text-white shadow-2xl h-fit sticky top-12"><h4 className="text-[10px] font-black uppercase text-emerald-400 tracking-widest mb-8">Grounding Citations</h4><div className="space-y-4">{marketIntel.sources.map((s:any, i:number) => <a key={i} href={s.web?.uri} target="_blank" className="block p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all text-xs font-black leading-snug">{s.web?.title}</a>)}</div></div>
              </div>
            )}
          </div>
        );
      case 'chat':
        return (
          <div className="h-[calc(100vh-220px)] flex flex-col animate-in fade-in duration-700">
            <header className="mb-8 flex items-center gap-6">
              <div className="w-16 h-16 bg-[#10b981] text-white rounded-3xl flex items-center justify-center text-3xl shadow-lg shadow-emerald-500/20"><i className="fas fa-headset"></i></div>
              <div><h2 className="text-3xl font-black text-slate-800">AI Advisor</h2><div className="flex items-center gap-2 mt-1"><div className={`w-2 h-2 rounded-full ${isVoiceActive ? (isAiSpeaking ? 'bg-emerald-400 animate-pulse' : isThinking ? 'bg-amber-400 animate-pulse' : 'bg-red-500 animate-ping') : 'bg-emerald-500'}`}></div><span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{isVoiceActive ? (isAiSpeaking ? 'Speaking...' : isThinking ? 'Thinking...' : 'Listening...') : `${langDisplay} Mode`}</span></div></div>
              <button onClick={isVoiceActive ? stopVoice : startVoice} className={`ml-auto px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl transition-all ${isVoiceActive ? 'bg-red-500 text-white shadow-red-500/20' : 'bg-white text-[#10b981] border-2 border-[#10b981]'}`}>{isVoiceActive ? 'End Call' : 'Start Consultation'}</button>
            </header>
            <div className="flex-1 bg-white rounded-[3.5rem] shadow-2xl border border-slate-100 flex flex-col overflow-hidden relative p-12 items-center justify-center">
              {isVoiceActive ? (
                <div className="w-full max-w-2xl space-y-16 flex flex-col items-center">
                  <div className="relative">
                    <div className={`absolute inset-0 rounded-full blur-[120px] transition-all duration-1000 scale-[2.5] ${isAiSpeaking ? 'bg-emerald-500/40' : 'bg-red-500/10'}`}></div>
                    <div className={`relative w-64 h-64 rounded-full flex items-center justify-center border-[12px] overflow-hidden transition-all duration-500 ${isAiSpeaking ? 'bg-[#064e3b] border-emerald-500/50' : isThinking ? 'bg-slate-800 border-amber-500/50' : 'bg-slate-900 border-white/10'}`}>
                      <div className="flex items-end gap-2 px-8 h-36">{[...Array(24)].map((_, i) => <div key={i} className={`w-2 rounded-full transition-all duration-100 ${isAiSpeaking ? 'bg-emerald-400' : 'bg-red-400'}`} style={{ height: `${Math.max(10, (audioLevel / 100) * (i % 4 === 0 ? 100 : 70) * (Math.random() * 0.5 + 0.5))}%` }}></div>)}</div>
                    </div>
                  </div>
                  <div className="w-full space-y-6">
                    {liveTransInput && <div className="p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] text-slate-600 font-bold italic shadow-sm animate-in slide-in-from-bottom-2"><span className="text-[10px] uppercase font-black text-slate-400 block mb-2 tracking-widest">You:</span>{liveTransInput}</div>}
                    {liveTransOutput && <div className="p-10 bg-emerald-50 border border-emerald-100 rounded-[3rem] text-emerald-900 font-black text-2xl leading-snug shadow-md animate-in slide-in-from-bottom-4"><span className="text-[10px] uppercase font-black text-emerald-400 block mb-2 tracking-widest">Advisor:</span>{liveTransOutput}</div>}
                    {!liveTransInput && !liveTransOutput && <p className="text-slate-400 font-black uppercase tracking-widest text-xs animate-pulse">Consultant is listening...</p>}
                  </div>
                </div>
              ) : <div className="opacity-10 text-center"><i className="fas fa-seedling text-[15rem] mb-6"></i><p className="text-4xl font-black text-slate-800">Ready for Consultation</p></div>}
            </div>
          </div>
        );
      default: return null;
    }
  };

  const renderAdminContent = () => {
    switch(activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-12 animate-in fade-in duration-500">
            <header><h2 className="text-4xl font-black text-slate-800 tracking-tight">System Status</h2><p className="text-slate-400 font-bold">Network Analytics & Stats Overview</p></header>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-xl transition-all"><div><h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Enrolled Farmers</h3><span className="text-6xl font-black text-slate-800">{farmers.length}</span></div><div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center text-emerald-500 text-3xl"><i className="fas fa-users"></i></div></div>
              <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-xl transition-all"><div><h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Queue Approvals</h3><span className="text-6xl font-black text-slate-800">{farmers.filter(f => f.status === UserStatus.PENDING).length}</span></div><div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center text-amber-500 text-3xl"><i className="fas fa-clock"></i></div></div>
              <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-xl transition-all"><div><h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">IoT Active Nodes</h3><span className="text-6xl font-black text-slate-800">12</span></div><div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-500 text-3xl"><i className="fas fa-wifi"></i></div></div>
            </div>
            <div className="bg-white p-12 rounded-[4rem] shadow-sm border border-slate-100 h-96 hover:shadow-2xl transition-all duration-700">
              <h3 className="font-black text-2xl mb-10 text-slate-800">Network Growth Trend</h3>
              <ResponsiveContainer width="100%" height="80%">
                <AreaChart data={[{d:'Mon',u:10},{d:'Tue',u:25},{d:'Wed',u:18},{d:'Thu',u:32},{d:'Fri',u:45},{d:'Sat',u:38},{d:'Sun',u:52}]}>
                  <Tooltip cursor={{stroke: '#10b981', strokeWidth: 2}} contentStyle={{borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 800}} />
                  <Area type="monotone" dataKey="u" stroke="#10b981" strokeWidth={5} fill="#10b981" fillOpacity={0.05} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      case 'farmers':
        return (
          <div className="space-y-10 animate-in slide-in-from-left-8 duration-700">
            <header><h2 className="text-4xl font-black text-slate-800">Farmer Directory</h2><p className="text-slate-400 font-bold">Manage network enrollment and status</p></header>
            <div className="bg-white rounded-[3.5rem] shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100 font-black text-[10px] uppercase tracking-widest text-slate-400"><tr><th className="px-10 py-8">Farmer Identity</th><th className="px-10 py-8">Contact</th><th className="px-10 py-8">Status</th><th className="px-10 py-8 text-right">Verification</th></tr></thead>
                <tbody className="divide-y divide-slate-50">{farmers.map(f => (
                  <tr key={f.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-10 py-8 font-black text-slate-800 text-lg">{f.name}</td>
                    <td className="px-10 py-8 font-bold text-slate-500">{f.phone}</td>
                    <td className="px-10 py-8"><span className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border ${f.status === UserStatus.APPROVED ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : f.status === UserStatus.PENDING ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>{f.status}</span></td>
                    <td className="px-10 py-8 text-right space-x-3">{f.status === UserStatus.PENDING && <><button onClick={() => handleFarmerAction(f.id, UserStatus.APPROVED)} className="px-5 py-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-500 hover:text-white transition-all font-black text-xs uppercase tracking-widest">Approve</button><button onClick={() => handleFarmerAction(f.id, UserStatus.REJECTED)} className="px-5 py-3 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-500 hover:text-white transition-all font-black text-xs uppercase tracking-widest">Reject</button></>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        );
      case 'ads':
        return (
          <div className="space-y-12 animate-in fade-in duration-500">
            <header className="flex justify-between items-center"><h2 className="text-4xl font-black text-slate-800 tracking-tight">Campaign Manager</h2><button className="px-8 py-4 bg-[#10b981] text-white rounded-2xl font-black text-sm shadow-xl hover:scale-105 transition-all">Launch Awareness Hub</button></header>
            <div className="grid md:grid-cols-3 gap-10">
              {MOCK_CAMPAIGNS.map(ad => (
                <div key={ad.id} className="bg-white rounded-[3rem] overflow-hidden shadow-sm border border-slate-100 group hover:shadow-2xl hover:translate-y-[-8px] transition-all duration-700">
                   <div className="h-56 overflow-hidden relative"><img src={ad.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" /><div className="absolute top-6 right-6 px-4 py-2 bg-white/90 backdrop-blur rounded-xl text-[10px] font-black text-emerald-600 uppercase tracking-widest">Live</div></div>
                   <div className="p-10 font-black text-slate-800 text-xl leading-snug">{ad.title}<div className="flex items-center gap-4 mt-8"><i className="fas fa-eye text-emerald-500"></i><span className="text-sm font-bold text-slate-400">{ad.clicks} Reach</span></div></div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'private':
        return (
          <div className="space-y-12 animate-in fade-in duration-500">
            <header className="flex justify-between items-center"><h2 className="text-4xl font-black text-slate-800 tracking-tight">Private Repository</h2><button className="px-8 py-4 bg-[#064e3b] text-white rounded-2xl font-black text-sm shadow-xl">Secure Upload</button></header>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {MOCK_DOCS.map((d, i) => (
                <div key={i} className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm flex items-center gap-8 group hover:bg-slate-50 transition-all cursor-pointer">
                  <div className={`w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center ${d.c} text-3xl group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-inner`}><i className={`fas ${d.i}`}></i></div>
                  <div className="flex-1 overflow-hidden"><p className="font-black text-slate-800 text-lg truncate mb-1">{d.n}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d.s}</p></div>
                </div>
              ))}
            </div>
          </div>
        );
      default: return null;
    }
  };

  // Auth UI
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#064e3b] flex items-center justify-center p-6 font-sans relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-emerald-500/10 blur-[150px] rounded-full animate-pulse"></div>
        <div className="w-full max-w-lg bg-white rounded-[4rem] shadow-2xl overflow-hidden p-16 relative z-10 border border-emerald-900/10">
          {authState === 'login' && (
            <form onSubmit={handleLogin} className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
              <div className="text-center mb-10">
                <div className="bg-emerald-50 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 text-[#10b981] text-4xl shadow-inner shadow-emerald-500/10"><i className="fas fa-seedling"></i></div>
                <h2 className="text-4xl font-black text-slate-800 tracking-tight">AgriSmart AI</h2>
                <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] mt-4">Precision Agriculture Network</p>
              </div>
              <div className="space-y-6">
                <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-6">Login Identifier</label><input value={loginPhone} onChange={e => setLoginPhone(e.target.value)} placeholder={t.loginPlaceholder} className="w-full px-10 py-6 bg-slate-50 border border-slate-100 rounded-3xl font-black outline-none focus:ring-4 focus:ring-emerald-100 transition-all" /></div>
                <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-6">Passkey</label><input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} placeholder={t.passwordPlaceholder} className="w-full px-10 py-6 bg-slate-50 border border-slate-100 rounded-3xl font-black outline-none focus:ring-4 focus:ring-emerald-100 transition-all" /></div>
              </div>
              <button type="submit" className="w-full py-6 bg-[#10b981] text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-emerald-500/30 hover:scale-[1.02] active:scale-95 transition-all mt-6 tracking-tight">Access Dashboard</button>
              <div className="pt-10 border-t border-slate-50 text-center">
                <p className="text-slate-400 font-bold text-sm">New to the precision network?</p>
                <button type="button" onClick={() => setAuthState('applying')} className="text-[#10b981] font-black text-sm uppercase tracking-widest mt-4 hover:underline transition-all">{t.applyNow}</button>
                <div className="mt-8"><button type="button" onClick={() => { setLoginPhone('admin'); setLoginPass('admin'); }} className="text-slate-300 text-[10px] font-bold uppercase tracking-widest hover:text-slate-500 transition-all">Quick Admin Entry (admin/admin)</button></div>
              </div>
            </form>
          )}

          {authState === 'applying' && (
            <form onSubmit={handleApply} className="space-y-8 animate-in slide-in-from-right-8 duration-700">
              <div className="text-center mb-6"><h2 className="text-4xl font-black text-slate-800 tracking-tight">{t.applyTitle}</h2><p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2">Network Enrollment Program</p></div>
              <div className="grid grid-cols-1 gap-5 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                {[
                  { label: t.fullName, value: applyForm.name, key: 'name', type: 'text' },
                  { label: t.phone, value: applyForm.phone, key: 'phone', type: 'tel' },
                  { label: t.farmArea, value: applyForm.area, key: 'area', type: 'number' },
                  { label: t.location, value: applyForm.location, key: 'location', type: 'text' }
                ].map(field => (
                  <div key={field.key} className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-6">{field.label}</label><input required type={field.type} value={field.value} onChange={e => setApplyForm({...applyForm, [field.key]: e.target.value})} className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] font-black outline-none focus:ring-4 focus:ring-emerald-100 transition-all" /></div>
                ))}
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-6"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t.yourLoginPass}</label><button type="button" onClick={generateFriendlyPassword} className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Auto-Gen</button></div>
                  <input required value={applyForm.password} onChange={e => setApplyForm({...applyForm, password: e.target.value})} className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] font-black outline-none focus:ring-4 focus:ring-emerald-100 transition-all" />
                </div>
              </div>
              <button type="submit" className="w-full py-6 bg-[#10b981] text-white rounded-[2.5rem] font-black text-xl shadow-2xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all mt-4">Submit Application</button>
              <button type="button" onClick={() => setAuthState('login')} className="w-full text-slate-400 font-black text-xs uppercase tracking-widest transition-all">Back to Login</button>
            </form>
          )}

          {authState === 'success' && (
            <div className="text-center py-10 animate-in zoom-in duration-700">
              <div className="bg-emerald-500 w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-10 text-white text-5xl shadow-2xl shadow-emerald-500/40"><i className="fas fa-check"></i></div>
              <h2 className="text-4xl font-black text-slate-800 mb-6 tracking-tight">Application Logged</h2>
              <p className="text-slate-500 font-bold leading-relaxed mb-10 text-lg">Your credentials are being validated. Review may take 24-48 hours.</p>
              <div className="p-10 bg-slate-50 rounded-[3rem] border border-slate-100 mb-12 text-left">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Network ID</p><p className="text-3xl font-black text-slate-800 mb-6">{applyForm.phone}</p>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Private Passkey</p><p className="text-3xl font-black text-emerald-600 tracking-[0.2em] font-mono">{applyForm.password}</p>
              </div>
              <button onClick={() => setAuthState('login')} className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-slate-900/30">Return to Portal</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Layout userRole={currentUser.role} onLogout={() => { stopVoice(); setCurrentUser(null); setAuthState('login'); }} activeTab={activeTab} setActiveTab={setActiveTab} language={language} setLanguage={setLanguage}>
      {currentUser.role === UserRole.ADMIN ? renderAdminContent() : renderFarmerContent()}
    </Layout>
  );
};

export default App;
