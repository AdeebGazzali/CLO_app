const fs = require('fs');
const path = 'c:\\Users\\adeeb\\Projects\\CLO_app\\src\\views\\CommandCenter.tsx';
let content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

const newBlock = `                                    <div className="space-y-2">
                                        {(() => {
                                            const todayStr = formatDate(currentDate);
                                            const todayHolidays = holidays
                                                .filter((h: any) => h.start === todayStr && (h.categories?.includes('Mercantile') || h.categories?.includes('Poya')))
                                                .map((h: any) => ({ id: \`holiday-\${h.uid}\`, activity: h.summary, type: 'HOLIDAY', is_priority: true, time_range: 'Anytime', completed: false, meta: {} }));
                                            const focusItems = [...todayHolidays, ...scheduleData.filter(b => b.is_priority || b.type === 'FITNESS')];
                                            if (focusItems.length === 0) {
                                                return (
                                                    <div
                                                        onClick={(e) => { e.stopPropagation(); setEditingEvent(null); setIsModalOpen(true); }}
                                                        className="flex flex-col items-center justify-center py-6 bg-zinc-900/20 rounded-xl border border-zinc-800/30 border-dashed gap-3 cursor-pointer hover:bg-zinc-800/40 transition-colors"
                                                    >
                                                        <span className="text-xs text-zinc-600 font-medium">
                                                            {scheduleData.length > 0 ? "No Priority Focus" : "Free Day"}
                                                        </span>
                                                        <button className="px-4 py-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all flex items-center gap-2 text-xs font-bold">
                                                            <Plus className="w-3.5 h-3.5" /> Quick Add
                                                        </button>
                                                    </div>
                                                );
                                            }
                                            return focusItems.slice(0, 4).map((block) => (
                                                <div key={block.id + '-mini'} onClick={() => setViewMode('day')} className="flex items-center gap-3 p-2.5 rounded-xl border border-zinc-800/30 bg-zinc-900/30 cursor-pointer hover:bg-zinc-800/50 transition-colors">
                                                    <div className={\`w-8 h-8 rounded-lg bg-zinc-800/80 flex items-center justify-center shrink-0 shadow-inner \${block.type === 'FITNESS'
                                                        ? block.activity.toUpperCase().includes('SWIM') ? 'text-cyan-400'
                                                            : block.activity.toUpperCase().includes('CYCLE') ? 'text-orange-400'
                                                                : block.activity.toUpperCase().includes('GYM') ? 'text-indigo-400'
                                                                    : 'text-emerald-400'
                                                        : block.type === 'HOLIDAY' ? 'text-pink-400'
                                                        : getColorForType(block.type).replace('border-', 'text-').replace('-500', '-400')
                                                        }\`}>
                                                        {block.type === 'FITNESS' ? (
                                                            block.activity.toUpperCase().includes('SWIM') ? <Waves className="w-4 h-4" /> :
                                                                block.activity.toUpperCase().includes('CYCLE') ? <Bike className="w-4 h-4" /> :
                                                                    block.activity.toUpperCase().includes('GYM') ? <Dumbbell className="w-4 h-4" /> :
                                                                        <Footprints className="w-4 h-4" />
                                                        ) : block.type === 'COACHING' ? <UsersIcon className="w-4 h-4" />
                                                            : <div className="w-2.5 h-2.5 rounded-full bg-current opacity-50" />
                                                        }
                                                    </div>
                                                    <div className="flex-[0.3] min-w-[50px]">
                                                        <span className="text-[11px] font-mono text-zinc-500 block leading-tight">{block.time_range === 'Anytime' ? '--:--' : block.time_range.split('-')[0] || block.time_range}</span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-bold text-sm text-zinc-300 truncate">{block.activity}</h3>
                                                        {block.type === 'FITNESS' && (block.meta?.run_type || block.meta?.distance_cmd) && (
                                                            <span className="text-[10px] text-zinc-500 block truncate mt-0.5">
                                                                {[block.meta.run_type, block.meta.distance_cmd].filter(Boolean).join(' \\u2022 ')}
                                                            </span>
                                                        )}
                                                        {block.type === 'COACHING' && block.location && (
                                                            <span className="text-[10px] text-zinc-500 block truncate mt-0.5">
                                                                {block.location}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ));
                                        })()}
                                    </div>`;

// Replace lines 485-529 (0-indexed 484-528) 
const before = lines.slice(0, 484);  // lines 1-484
const after = lines.slice(529);       // line 530 onwards
const result = [...before, newBlock, ...after].join('\n');
fs.writeFileSync(path, result, 'utf8');
console.log('DONE! Lines before:', lines.length, 'Lines after:', result.split('\n').length);
