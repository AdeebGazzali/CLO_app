import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { User } from '@supabase/supabase-js'

export default function AuthCheck({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null)
            setLoading(false)
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
        })

        return () => subscription.unsubscribe()
    }, [])

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-zinc-500">
                Loading System...
            </div>
        )
    }

    if (!user) {
        return <LoginScreen />
    }

    return <>{children}</>
}

function LoginScreen() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [mode, setMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN')
    const [error, setError] = useState<string | null>(null)

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            if (mode === 'SIGNUP') {
                const { error } = await supabase.auth.signUp({ email, password })
                if (error) throw error
                alert('Check your email for the confirmation link!')
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password })
                if (error) throw error
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-zinc-900/50 p-8 rounded-2xl border border-zinc-800">
                <h1 className="text-2xl font-black italic text-center mb-6 text-white">
                    <span className="text-indigo-500">CLO</span>System
                </h1>

                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Email</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-indigo-500 outline-none transition"
                            placeholder="clo@system.com"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-indigo-500 outline-none transition"
                            placeholder="••••••••"
                        />
                    </div>

                    {error && <div className="text-red-500 text-sm bg-red-900/20 p-2 rounded">{error}</div>}

                    <button
                        disabled={loading}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition disabled:opacity-50">
                        {loading ? 'Processing...' : (mode === 'LOGIN' ? 'Login' : 'Sign Up')}
                    </button>

                    <div className="text-center">
                        <button
                            type="button"
                            onClick={() => setMode(mode === 'LOGIN' ? 'SIGNUP' : 'LOGIN')}
                            className="text-xs text-zinc-500 hover:text-zinc-300">
                            {mode === 'LOGIN' ? 'Need an account? Sign Up' : 'Have an account? Login'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
