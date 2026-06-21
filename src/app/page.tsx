import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Wallet, Sparkles, BrainCircuit, Receipt, ArrowRight, Share2, ShieldCheck, History } from 'lucide-react';

export default async function LandingPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('splitsmart_session')?.value;

  if (token) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen relative flex flex-col justify-between overflow-hidden bg-[#090d16]">
      {/* Decorative gradient glowing circles */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white">
            Split<span className="text-cyan-400">Smart</span>
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-gray-300 hover:text-white transition">
            Sign In
          </Link>
          <Link
            href="/register"
            className="text-sm font-medium bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-700 hover:to-cyan-600 text-white px-4 py-2 rounded-xl transition shadow-lg shadow-violet-500/15"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 py-16 flex-1 flex flex-col lg:flex-row items-center justify-between gap-12 z-10 w-full">
        <div className="flex-1 text-center lg:text-left space-y-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-xs font-semibold text-violet-300">
            <Sparkles className="w-3.5 h-3.5" />
            AI-Powered Debt Settlement
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight">
            The Smartest Way to <br />
            <span className="text-gradient">Split Shared Bills</span>
          </h1>
          
          <p className="text-gray-400 text-lg max-w-xl mx-auto lg:mx-0">
            Ditch the calculators and awkward reminder messages. Track group expenses, split itemized receipts using Gemini AI, and settle up with the minimum number of transactions.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:opacity-95 transition shadow-lg shadow-violet-500/25"
            >
              Start Splitting Free <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-4 bg-gray-800/40 hover:bg-gray-800/60 border border-gray-700 text-gray-300 font-semibold rounded-xl flex items-center justify-center transition"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Hero Features grid (Premium visualization) */}
        <div className="flex-1 w-full max-w-lg lg:max-w-none grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="glass-card p-6 rounded-2xl flex flex-col justify-between h-48">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <BrainCircuit className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">AI Receipt Scan</h3>
              <p className="text-sm text-gray-400">Upload any receipt. Gemini extracts items, prices, tax, and totals in seconds.</p>
            </div>
          </div>

          <div className="glass-card p-6 rounded-2xl flex flex-col justify-between h-48">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Share2 className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Advanced Split Strategies</h3>
              <p className="text-sm text-gray-400">Equal, custom, percentage, shares, or itemized pizzas. Splitting made fair.</p>
            </div>
          </div>

          <div className="glass-card p-6 rounded-2xl flex flex-col justify-between h-48">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Min-Debt Engine</h3>
              <p className="text-sm text-gray-400">Greedy settlement calculations reduce transaction counts to keep balances clear.</p>
            </div>
          </div>

          <div className="glass-card p-6 rounded-2xl flex flex-col justify-between h-48">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <History className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Trip Timeline & Recurrence</h3>
              <p className="text-sm text-gray-400">Track budgets, chronological timelines for travel, and recurring subscription bills.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-6 text-xs text-gray-600 border-t border-gray-900 z-10 bg-[#070b13]">
        &copy; {new Date().getFullYear()} SplitSmart Inc. Built with Next.js 15, Drizzle ORM, and Gemini API.
      </footer>
    </div>
  );
}
