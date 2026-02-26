import { useState } from 'react';
import { Info } from 'lucide-react';

interface ZoneTooltipProps {
    zone: string;
}

export default function ZoneTooltip({ zone }: ZoneTooltipProps) {
    const [isOpen, setIsOpen] = useState(false);

    // Max HR: 187
    const zoneDescriptions: Record<string, { desc: string; hr: string; color: string; border: string }> = {
        'Zone 1': { desc: 'Very Light / Recovery (50-60%)', hr: '93 - 112 bpm', color: 'text-blue-400 bg-blue-900/20', border: 'border-blue-500/30' },
        'Zone 2': { desc: 'Light / Aerobic Base (60-70%)', hr: '112 - 130 bpm', color: 'text-emerald-400 bg-emerald-900/20', border: 'border-emerald-500/30' },
        'Zone 3': { desc: 'Moderate / Tempo (70-80%)', hr: '130 - 149 bpm', color: 'text-amber-400 bg-amber-900/20', border: 'border-amber-500/30' },
        'Zone 4': { desc: 'Hard / Maximum (80-100%)', hr: '149 - 187 bpm', color: 'text-rose-400 bg-rose-900/20', border: 'border-rose-500/30' },
        'Zone 5': { desc: 'Hard / Maximum (80-100%)', hr: '149 - 187 bpm', color: 'text-rose-400 bg-rose-900/20', border: 'border-rose-500/30' },
    };

    const zoneDetails = zoneDescriptions[zone] || { desc: 'Unknown Zone', hr: 'N/A', color: 'text-zinc-400 bg-zinc-800', border: 'border-zinc-700' };

    return (
        <div className="relative inline-block" onMouseEnter={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)}>
            <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider transition-colors cursor-help ${zoneDetails.color} ${zoneDetails.border}`}
            >
                {zone}
                <Info className="w-3 h-3 opacity-70" />
            </button>

            {isOpen && (
                <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-zinc-900 border border-zinc-700 p-3 rounded-xl shadow-2xl pointer-events-none animate-in fade-in zoom-in-95 duration-200">
                    <div className="text-zinc-100 text-xs font-bold mb-1">{zone} Profile</div>
                    <div className="text-zinc-400 text-[10px] leading-relaxed mb-2">{zoneDetails.desc}</div>
                    <div className="flex items-center justify-between border-t border-zinc-800 pt-2">
                        <span className="text-[10px] text-zinc-500 font-medium">Target HR</span>
                        <span className="text-xs font-mono font-bold text-white tracking-widest">{zoneDetails.hr}</span>
                    </div>
                    {/* Tooltip Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-zinc-700"></div>
                </div>
            )}
        </div>
    );
}
