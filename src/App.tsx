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
            <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 max-w-md mx-auto relative shadow-2xl font-sans selection:bg-indigo-500/30">

                {/* Top Bar */}
                <div className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-md p-4 border-b border-zinc-900 flex justify-between items-center">
                    <h1 className="text-xl font-black tracking-tighter italic">
                        <span className="text-indigo-500">CLO</span>System
                    </h1>
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
                        <span className="text-xs font-bold text-white">AD</span>
                    </div>
                </div>

                {/* Main Content Area */}
                <main className="p-4 min-h-[calc(100vh-140px)]">
                    {activeTab === 'daily' && <CommandCenter />}
                    {activeTab === 'fitness' && <FitnessCenter />}
                    {activeTab === 'coach' && <CoachEngine />}
                    {activeTab === 'wallet' && <WealthArchitecture />}
                </main>

                {/* Bottom Navigation */}
                <nav className="fixed bottom-0 w-full max-w-md bg-[#0a0a0a]/95 border-t border-zinc-800 backdrop-blur-lg pb-safe z-50">
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
        </AuthCheck>
    );
}
