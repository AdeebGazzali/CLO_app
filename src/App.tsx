import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Dumbbell, Users, Wallet } from 'lucide-react';
import AuthCheck from './components/AuthCheck';
import CommandCenter from './views/CommandCenter';
import FitnessCenter from './views/FitnessCenter';
import CoachEngine from './views/CoachEngine';
import WealthArchitecture from './views/WealthArchitecture';

export default function App() {
    const [activeTab, setActiveTab] = useState<'daily' | 'fitness' | 'coach' | 'wallet'>('daily');

    // Scroll to top on tab change
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [activeTab]);

    return (
        <AuthCheck>
            <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 w-full max-w-md md:max-w-[1440px] mx-auto relative md:shadow-2xl font-sans selection:bg-indigo-500/30 md:flex">

                {/* Desktop Sidebar (Hidden on mobile) */}
                <aside className="hidden md:flex flex-col w-64 border-r border-zinc-900 sticky top-0 h-screen p-6 bg-[#0a0a0a]/95 backdrop-blur-xl">
                    <div className="mb-10 pl-2">
                        <h1 className="text-2xl font-black tracking-tighter italic">
                            <span className="text-indigo-500">CLO</span>System
                        </h1>
                    </div>

                    <nav className="flex-1 space-y-2">
                        <button onClick={() => {
                            if (activeTab === 'daily') window.dispatchEvent(new Event('resetCalendarView'));
                            setActiveTab('daily');
                        }} className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${activeTab === 'daily' ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'}`}>
                            <CalendarIcon className="w-5 h-5" />
                            <span className="text-sm font-bold tracking-wide">Command Center</span>
                        </button>

                        <button onClick={() => setActiveTab('fitness')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${activeTab === 'fitness' ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'}`}>
                            <Dumbbell className="w-5 h-5" />
                            <span className="text-sm font-bold tracking-wide">Fitness Center</span>
                        </button>

                        <button onClick={() => setActiveTab('coach')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${activeTab === 'coach' ? 'bg-amber-500/10 text-amber-400' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'}`}>
                            <Users className="w-5 h-5" />
                            <span className="text-sm font-bold tracking-wide">Coach Engine</span>
                        </button>

                        <button onClick={() => setActiveTab('wallet')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${activeTab === 'wallet' ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'}`}>
                            <Wallet className="w-5 h-5" />
                            <span className="text-sm font-bold tracking-wide">Wealth Architecture</span>
                        </button>
                    </nav>

                    <div className="mt-auto flex items-center gap-3 p-2 border-t border-zinc-800/50 pt-6">
                        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 shrink-0">
                            <span className="text-sm font-bold text-white">AD</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="text-sm font-bold text-white block truncate">Adeeb Gazzali</span>
                            <span className="text-xs text-zinc-500 block">Operator</span>
                        </div>
                    </div>
                </aside>

                {/* Main View Area */}
                <div className="flex-1 flex flex-col min-w-0 max-w-full">
                    {/* Top Bar (Mobile Only) */}
                    <div className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-md p-4 border-b border-zinc-900 flex justify-between items-center md:hidden">
                        <h1 className="text-xl font-black tracking-tighter italic">
                            <span className="text-indigo-500">CLO</span>System
                        </h1>
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
                            <span className="text-xs font-bold text-white">AD</span>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <main className="p-4 md:p-8 min-h-[calc(100vh-140px)] md:min-h-screen relative overflow-x-hidden">
                        {activeTab === 'daily' && <CommandCenter />}
                        {activeTab === 'fitness' && <FitnessCenter />}
                        {activeTab === 'coach' && <CoachEngine />}
                        {activeTab === 'wallet' && <WealthArchitecture />}
                    </main>

                    {/* Bottom Navigation (Mobile Only) */}
                    <nav className="fixed bottom-0 w-full max-w-md bg-[#0a0a0a]/95 border-t border-zinc-800 backdrop-blur-lg pb-safe z-50 md:hidden">
                        <div className="flex justify-around items-center p-2">
                            <button onClick={() => {
                                if (activeTab === 'daily') {
                                    window.dispatchEvent(new Event('resetCalendarView'));
                                }
                                setActiveTab('daily');
                            }} className={`flex flex-col items-center p-2 rounded-xl transition ${activeTab === 'daily' ? 'text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'}`}>
                                <CalendarIcon className="w-6 h-6 mb-1" />
                                <span className="text-[10px] font-bold">Calendar</span>
                            </button>
                            <button onClick={() => setActiveTab('fitness')} className={`flex flex-col items-center p-2 rounded-xl transition ${activeTab === 'fitness' ? 'text-emerald-400' : 'text-zinc-600 hover:text-zinc-400'}`}>
                                <Dumbbell className="w-6 h-6 mb-1" />
                                <span className="text-[10px] font-bold">Fitness</span>
                            </button>
                            <button onClick={() => setActiveTab('coach')} className={`flex flex-col items-center p-2 rounded-xl transition ${activeTab === 'coach' ? 'text-amber-400' : 'text-zinc-600 hover:text-zinc-400'}`}>
                                <Users className="w-6 h-6 mb-1" />
                                <span className="text-[10px] font-bold">Coach</span>
                            </button>
                            <button onClick={() => setActiveTab('wallet')} className={`flex flex-col items-center p-2 rounded-xl transition ${activeTab === 'wallet' ? 'text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'}`}>
                                <Wallet className="w-6 h-6 mb-1" />
                                <span className="text-[10px] font-bold">Wallet</span>
                            </button>
                        </div>
                        <div className="h-5 bg-transparent" /> {/* Safe area spacer */}
                    </nav>
                </div>
            </div>
        </AuthCheck>
    );
}
