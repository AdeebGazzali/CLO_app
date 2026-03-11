import React from 'react';
import { motion } from 'framer-motion';

export default function GenericModal({ children, title, onClose, zIndex }: { children: React.ReactNode; title: string; onClose: () => void; zIndex?: string }) {
    return (
        <div className={`fixed inset-0 ${zIndex ?? 'z-[60]'} flex items-end justify-center bg-black/80 backdrop-blur-sm sm:p-4`} onClick={onClose}>
            <motion.div
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="w-full sm:max-w-md bg-zinc-950 border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl relative"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors cursor-pointer bg-black/30 w-8 h-8 rounded-full flex justify-center items-center border border-zinc-800/50" onClick={onClose} title="Close">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </div>
                <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6 cursor-pointer" onClick={onClose} />
                <h2 className="text-xl font-bold text-white mb-6 pr-8">{title}</h2>
                {children}
            </motion.div>
        </div>
    );
}
