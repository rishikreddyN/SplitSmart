'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Users, Receipt, CreditCard, PieChart as ChartIcon, Settings, Plus, 
  Upload, Sparkles, AlertCircle, Loader2, ArrowUpRight, ArrowDownRight, Check, Trash2, 
  Download, Calendar, Bell, Wallet, Info, CheckCircle2, ChevronRight, Share2, Printer
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface Member {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  netBalance: number;
}

interface Split {
  userId: string;
  userName: string;
  shareAmount: number;
  splitType: string;
}

interface Expense {
  id: string;
  paidBy: string;
  payerName: string;
  payerAvatar: string | null;
  description: string;
  amount: number;
  category: string;
  receiptUrl: string | null;
  date: string;
  createdAt: string | null;
  splits: Split[];
}

interface Settlement {
  id: string;
  payerId: string;
  payerName: string;
  payerAvatar: string | null;
  receiverId: string;
  receiverName: string;
  receiverAvatar: string | null;
  amount: number;
  status: string;
  settledAt: string | null;
}

interface Recurring {
  id: string;
  title: string;
  amount: number;
  frequency: string;
  category: string;
  nextDueDate: string;
}

interface Suggestion {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
}

interface GroupData {
  group: {
    id: string;
    name: string;
    description: string | null;
    type: string;
    tripBudget: number;
  };
  currentUserRole: string;
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
  recurringExpenses: Recurring[];
  suggestions: Suggestion[];
  totalExpenses: number;
}

interface GroupClientProps {
  groupId: string;
  userId: string;
  initialData: GroupData;
}

const CATEGORY_COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f43f5e', '#fbbf24', '#3b82f6', '#ec4899', '#6b7280'];

export default function GroupClient({ groupId, userId, initialData }: GroupClientProps) {
  const router = useRouter();
  const [data, setData] = useState<GroupData>(initialData);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settle' | 'recurring' | 'analytics' | 'settings'>('dashboard');
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  
  // Modals state
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editExpenseId, setEditExpenseId] = useState<string | null>(null);
  const [ocrModalOpen, setOcrModalOpen] = useState(false);
  const [settleFormOpen, setSettleFormOpen] = useState(false);
  const [recurringModalOpen, setRecurringModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  // Expense Form State
  const [expDescription, setExpDescription] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('food');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expPaidBy, setExpPaidBy] = useState(userId);
  const [expSplitType, setExpSplitType] = useState<'equal' | 'percent' | 'amount' | 'shares' | 'itemized'>('equal');
  const [expSplits, setExpSplits] = useState<Record<string, number>>({});
  const [expenseError, setExpenseError] = useState('');
  const [expenseLoading, setExpenseLoading] = useState(false);

  // Settlement Form State
  const [setFrom, setSetFrom] = useState('');
  const [setTo, setSetTo] = useState('');
  const [setAmount, setSetAmount] = useState('');
  const [settleError, setSettleError] = useState('');
  const [settleLoading, setSettleLoading] = useState(false);

  // Recurring Form State
  const [recTitle, setRecTitle] = useState('');
  const [recAmount, setRecAmount] = useState('');
  const [recFrequency, setRecFrequency] = useState('monthly');
  const [recCategory, setRecCategory] = useState('utilities');
  const [recNextDueDate, setRecNextDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [recError, setRecError] = useState('');
  const [recLoading, setRecLoading] = useState(false);

  // OCR upload State
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState('');

  // Settings Form State
  const [groupName, setGroupName] = useState(data.group.name);
  const [groupDesc, setGroupDesc] = useState(data.group.description || '');
  const [groupType, setGroupType] = useState(data.group.type);
  const [tripBudget, setTripBudget] = useState(data.group.tripBudget.toString());
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  // Settle-up suggestion trigger
  const [quickSettleTarget, setQuickSettleTarget] = useState<Suggestion | null>(null);

  // Fetch updated group state
  const refreshData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`);
      if (!res.ok) throw new Error('Failed to fetch data');
      const fresh = await res.json();
      setData(fresh);
      setGroupName(fresh.group.name);
      setGroupDesc(fresh.group.description || '');
      setGroupType(fresh.group.type);
      setTripBudget(fresh.group.tripBudget.toString());
    } catch (err: any) {
      setGlobalError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle open expense modal (adds default split value)
  const openExpenseModal = (existingExp?: Expense) => {
    setExpenseError('');
    if (existingExp) {
      setEditExpenseId(existingExp.id);
      setExpDescription(existingExp.description);
      setExpAmount(existingExp.amount.toString());
      setExpCategory(existingExp.category);
      setExpDate(existingExp.date);
      setExpPaidBy(existingExp.paidBy);
      setExpSplitType(existingExp.splits[0]?.splitType as any || 'equal');
      
      const mappedSplits: Record<string, number> = {};
      existingExp.splits.forEach(s => {
        // Map according to splitType
        if (s.splitType === 'equal') mappedSplits[s.userId] = 1; // binary participation
        else if (s.splitType === 'percent') mappedSplits[s.userId] = Math.round((s.shareAmount / existingExp.amount * 100) * 100) / 100;
        else mappedSplits[s.userId] = s.shareAmount;
      });
      setExpSplits(mappedSplits);
    } else {
      setEditExpenseId(null);
      setExpDescription('');
      setExpAmount('');
      setExpCategory('food');
      setExpDate(new Date().toISOString().split('T')[0]);
      setExpPaidBy(userId);
      setExpSplitType('equal');
      
      // Default: check everyone in split
      const defSplits: Record<string, number> = {};
      data.members.forEach(m => {
        defSplits[m.id] = 1;
      });
      setExpSplits(defSplits);
    }
    setExpenseModalOpen(true);
  };

  // Set up splits helper defaults when splitType changes
  useEffect(() => {
    if (expenseModalOpen && !editExpenseId) {
      const defSplits: Record<string, number> = {};
      data.members.forEach(m => {
        if (expSplitType === 'equal') defSplits[m.id] = 1;
        else if (expSplitType === 'percent') defSplits[m.id] = Math.round((100 / data.members.length) * 100) / 100;
        else if (expSplitType === 'shares') defSplits[m.id] = 1;
        else defSplits[m.id] = 0;
      });
      setExpSplits(defSplits);
    }
  }, [expSplitType, data.members, expenseModalOpen, editExpenseId]);

  // Handle OCR scan upload
  const handleOcrScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ocrFile) {
      setOcrError('Please select a receipt image');
      return;
    }

    setOcrLoading(true);
    setOcrError('');

    const formData = new FormData();
    formData.append('file', ocrFile);

    try {
      const res = await fetch('/api/ocr/scan', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to scan receipt');

      const result = json.result;
      
      // Populate Expense modal fields
      setExpDescription(result.storeName || 'Gemini Scan');
      setExpAmount(result.total ? result.total.toString() : '');
      setExpDate(result.date || new Date().toISOString().split('T')[0]);
      setExpCategory('shopping'); // default fallback

      // If itemized items returned, we can pre-populate custom amounts!
      if (result.items && result.items.length > 0) {
        // Let's set it as custom itemized or amount split
        setExpSplitType('itemized');
        const customVals: Record<string, number> = {};
        // Just divide overall amount by members initially, but let user adjust
        data.members.forEach((m, idx) => {
          if (idx === 0) customVals[m.id] = result.total || 0;
          else customVals[m.id] = 0;
        });
        setExpSplits(customVals);
        
        // Print message so user knows item splits are pre-filled
        setExpenseError(`Scanned ${result.items.length} items totaling ₹${result.total}. Assigned total to you, feel free to distribute item amounts among members!`);
      }

      setOcrModalOpen(false);
      setOcrFile(null);
      setExpenseModalOpen(true);

    } catch (err: any) {
      setOcrError(err.message);
    } finally {
      setOcrLoading(false);
    }
  };

  // Submit expense (POST /api/expenses or PUT /api/expenses/:id)
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseError('');

    const amountNum = parseFloat(expAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setExpenseError('Please enter a valid amount');
      return;
    }

    // Format splits for API
    const splitPayload = Object.entries(expSplits).map(([uId, val]) => ({
      userId: uId,
      value: parseFloat(val.toString()) || 0,
    })).filter(s => s.value > 0 || expSplitType === 'amount' || expSplitType === 'itemized');

    if (splitPayload.length === 0) {
      setExpenseError('Please assign splits to at least one member');
      return;
    }

    setExpenseLoading(true);

    try {
      const url = editExpenseId ? `/api/expenses/${editExpenseId}` : '/api/expenses';
      const method = editExpenseId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          description: expDescription,
          amount: amountNum,
          category: expCategory,
          date: expDate,
          paidBy: expPaidBy,
          splitType: expSplitType,
          splits: splitPayload,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save expense');

      setExpenseModalOpen(false);
      refreshData();

    } catch (err: any) {
      setExpenseError(err.message);
    } finally {
      setExpenseLoading(false);
    }
  };

  // Handle Delete Expense
  const handleDeleteExpense = async (expId: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    
    try {
      const res = await fetch(`/api/expenses/${expId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete expense');
      }
      refreshData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Submit Settlement
  const handleSaveSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettleError('');

    const amt = parseFloat(setAmount);
    if (!setFrom || !setTo || isNaN(amt) || amt <= 0) {
      setSettleError('Please fill in all fields with a valid amount');
      return;
    }

    if (setFrom === setTo) {
      setSettleError('Payer and receiver cannot be the same person');
      return;
    }

    setSettleLoading(true);

    try {
      const res = await fetch('/api/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          payerId: setFrom,
          receiverId: setTo,
          amount: amt,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to record settlement');

      setSettleFormOpen(false);
      setSetAmount('');
      refreshData();

    } catch (err: any) {
      setSettleError(err.message);
    } finally {
      setSettleLoading(false);
    }
  };

  // Trigger Settle-Up suggestion click
  const triggerQuickSettle = (sug: Suggestion) => {
    setSetFrom(sug.fromUserId);
    setSetTo(sug.toUserId);
    setSetAmount(sug.amount.toString());
    setSettleFormOpen(true);
  };

  // Create Recurring Expense
  const handleSaveRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecError('');

    const amt = parseFloat(recAmount);
    if (!recTitle || isNaN(amt) || amt <= 0 || !recNextDueDate) {
      setRecError('Please enter a valid title, amount, and next due date');
      return;
    }

    setRecLoading(true);

    try {
      const res = await fetch(`/api/groups/${groupId}/recurring`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: recTitle,
          amount: amt,
          frequency: recFrequency,
          category: recCategory,
          nextDueDate: recNextDueDate,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save recurring bill');

      setRecurringModalOpen(false);
      setRecTitle('');
      setRecAmount('');
      refreshData();

    } catch (err: any) {
      setRecError(err.message);
    } finally {
      setRecLoading(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError('');
    setSettingsLoading(true);

    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupName,
          description: groupDesc,
          type: groupType,
          tripBudget: tripBudget ? parseFloat(tripBudget) : 0,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update settings');

      alert('Group updated successfully!');
      refreshData();

    } catch (err: any) {
      setSettingsError(err.message);
    } finally {
      setSettingsLoading(false);
    }
  };

  // Delete Group (cascade)
  const handleDeleteGroup = async () => {
    if (!confirm('WARNING: Deleting this group will permanently remove all member ties, expenses, settlements, and recurring bill configs. This cannot be undone. Do you want to proceed?')) return;

    try {
      const res = await fetch(`/api/groups/${groupId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete group');
      }
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Recharts Formatters
  const categoryChartData = Object.entries(
    data.expenses.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const memberChartData = data.members.map((m) => {
    // Total Paid
    const paid = data.expenses
      .filter((e) => e.paidBy === m.id)
      .reduce((sum, e) => sum + e.amount, 0);

    // Total Owed
    let owed = 0;
    data.expenses.forEach((e) => {
      const match = e.splits.find((s) => s.userId === m.id);
      if (match) owed += match.shareAmount;
    });

    return {
      name: m.name.split(' ')[0],
      Paid: paid,
      Owed: owed,
    };
  });

  // Trip Mode Budget Calculation
  const isTripMode = data.group.type === 'travel';
  const budgetLimit = data.group.tripBudget || 0;
  const budgetUtilization = budgetLimit > 0 ? (data.totalExpenses / budgetLimit) * 100 : 0;

  // Print friendly PDF page trigger
  const triggerPdfReport = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col print:bg-white print:text-black">
      
      {/* Header */}
      <header className="border-b border-gray-900 bg-[#070b13]/80 sticky top-0 z-20 backdrop-blur-md print:hidden">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="w-8 h-8 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-850 flex items-center justify-center text-gray-400 hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="font-bold text-lg text-white">
              {data.group.name}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setInviteModalOpen(true)}
              className="px-4 py-2 bg-gray-900 hover:bg-gray-850 border border-gray-800 rounded-xl text-xs font-semibold text-cyan-400 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" /> Invite
            </button>
            
            <button
              onClick={() => openExpenseModal()}
              className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-95 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-violet-500/10 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Expense
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full px-6 py-6 flex-1 flex flex-col gap-6 print:p-0 print:m-0">
        
        {/* Trip Mode Budget Bar (Travel type only) */}
        {isTripMode && budgetLimit > 0 && (
          <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-2 print:hidden">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-gray-400">Trip Budget Utilization</span>
              <span className={budgetUtilization > 100 ? 'text-rose-400' : 'text-cyan-400'}>
                ₹{Math.round(data.totalExpenses)} / ₹{budgetLimit} ({Math.round(budgetUtilization)}%)
              </span>
            </div>
            <div className="w-full bg-gray-950 rounded-full h-3.5 overflow-hidden border border-gray-850">
              <div 
                className={`h-full transition-all duration-500 rounded-full bg-gradient-to-r ${
                  budgetUtilization > 100 
                    ? 'from-rose-600 to-red-500 shadow-md shadow-red-500/20' 
                    : budgetUtilization > 80
                    ? 'from-amber-500 to-orange-500 shadow-md shadow-amber-500/10'
                    : 'from-violet-600 to-cyan-500 shadow-md shadow-cyan-500/10'
                }`}
                style={{ width: `${Math.min(budgetUtilization, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Tab Controls */}
        <div className="flex items-center gap-2 border-b border-gray-900 pb-px overflow-x-auto custom-scrollbar print:hidden">
          {(['dashboard', 'settle', 'recurring', 'analytics', 'settings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-4 text-xs font-semibold capitalize border-b-2 tracking-wide transition relative shrink-0 cursor-pointer ${
                activeTab === tab
                  ? 'border-violet-500 text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab === 'settle' ? 'Settle Up' : tab === 'recurring' ? 'Recurring Bills' : tab}
            </button>
          ))}
        </div>

        {/* PRINT ONLY HEADER */}
        <div className="hidden print:block space-y-3 mb-6 border-b border-gray-300 pb-4">
          <h1 className="text-3xl font-extrabold text-black">SplitSmart Group Report</h1>
          <p className="text-sm text-gray-600">Group Name: <span className="font-bold text-black">{data.group.name}</span></p>
          <p className="text-sm text-gray-600">Total Group Spending: <span className="font-bold text-black">₹{data.totalExpenses}</span></p>
          <p className="text-sm text-gray-600">Date Generated: {new Date().toLocaleDateString()}</p>
        </div>

        {/* TAB CONTENTS */}
        <div className="flex-1">

          {/* TAB 1: DASHBOARD */}
          {(activeTab === 'dashboard' || typeof window === 'undefined') && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Expenses List */}
              <div className="lg:col-span-2 space-y-4 print:w-full">
                <div className="flex items-center justify-between print:hidden">
                  <h3 className="font-bold text-base text-white">Expenses History</h3>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setOcrModalOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-cyan-950/20 hover:bg-cyan-950/40 border border-cyan-500/20 text-[10px] font-bold text-cyan-400 flex items-center gap-1 transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> AI Scan Receipt
                    </button>

                    <a
                      href={`/api/reports/csv?groupId=${groupId}`}
                      className="px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-850 border border-gray-800 text-[10px] font-bold text-gray-400 flex items-center gap-1 transition"
                    >
                      <Download className="w-3.5 h-3.5" /> CSV Report
                    </a>

                    <button
                      onClick={triggerPdfReport}
                      className="px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-850 border border-gray-800 text-[10px] font-bold text-gray-400 flex items-center gap-1 transition cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print PDF
                    </button>
                  </div>
                </div>

                {data.expenses.length === 0 ? (
                  <div className="glass-panel p-12 rounded-3xl text-center border border-dashed border-gray-850 print:border-gray-300">
                    <Receipt className="w-10 h-10 text-gray-650 mx-auto mb-3" />
                    <p className="text-gray-400 font-medium">No expenses yet</p>
                    <p className="text-xs text-gray-600 mt-1">Tap &quot;Add Expense&quot; above to log the first shared bill.</p>
                  </div>
                ) : (
                  <div className="space-y-3 print:space-y-2">
                    {data.expenses.map((exp) => (
                      <div
                        key={exp.id}
                        className="glass-panel p-4 rounded-2xl flex items-start justify-between group/item border border-white/5 print:border-gray-300 print:bg-white"
                      >
                        <div className="flex items-start gap-3">
                          {/* category letter/icon mockup */}
                          <div className="w-10 h-10 rounded-xl bg-gray-950 flex items-center justify-center shrink-0 uppercase font-black text-sm text-gradient print:border print:border-gray-250">
                            {exp.category.slice(0,2)}
                          </div>
                          
                          <div>
                            <h4 className="font-bold text-sm text-white print:text-black">{exp.description}</h4>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              Paid by <span className="font-semibold text-gray-400 print:text-gray-800">{exp.payerName}</span> &bull; {new Date(exp.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                            
                            {/* split tooltips/summaries inside exp card */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              {exp.splits.map(s => (
                                <span 
                                  key={s.userId} 
                                  className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                                    s.userId === userId 
                                      ? 'bg-violet-950/30 text-violet-300 border border-violet-500/10' 
                                      : 'bg-gray-950/40 text-gray-500'
                                  } print:border print:border-gray-200 print:text-black`}
                                >
                                  {s.userName.split(' ')[0]}: ₹{s.shareAmount}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span className="font-extrabold text-sm text-white print:text-black">₹{exp.amount}</span>
                          
                          {/* Admin edit/delete buttons */}
                          <div className="flex items-center gap-1.5 opacity-0 group-hover/item:opacity-100 transition print:hidden">
                            {(data.currentUserRole === 'admin' || exp.paidBy === userId) && (
                              <>
                                <button
                                  onClick={() => openExpenseModal(exp)}
                                  className="p-1.5 rounded-lg bg-gray-900 hover:bg-gray-850 text-gray-400 hover:text-white transition cursor-pointer"
                                  title="Edit Expense"
                                >
                                  <Settings className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteExpense(exp.id)}
                                  className="p-1.5 rounded-lg bg-gray-900 hover:bg-rose-950/30 text-gray-400 hover:text-rose-400 transition cursor-pointer"
                                  title="Delete Expense"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Members & Net Balances List */}
              <div className="space-y-4 print:hidden">
                <h3 className="font-bold text-base text-white">Group Members</h3>
                <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-4">
                  {data.members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        {member.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={member.avatarUrl} alt={member.name} className="w-8 h-8 rounded-full bg-gray-805" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-gray-500 font-bold">
                            {member.name[0]}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-white flex items-center gap-1">
                            {member.name}
                            {member.role === 'admin' && (
                              <span className="text-[8px] uppercase tracking-wider px-1 bg-violet-500/10 text-violet-300 rounded font-semibold border border-violet-500/10">Admin</span>
                            )}
                          </p>
                          <p className="text-[10px] text-gray-500">{member.email}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className={`font-bold ${
                          member.netBalance > 0.05 
                            ? 'text-emerald-400' 
                            : member.netBalance < -0.05 
                            ? 'text-rose-400' 
                            : 'text-gray-550'
                        }`}>
                          {member.netBalance > 0.05 
                            ? `+₹${member.netBalance}` 
                            : member.netBalance < -0.05 
                            ? `-₹${Math.abs(member.netBalance)}` 
                            : 'Settled'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SETTLE UP SUGGESTIONS */}
          {activeTab === 'settle' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Settle Up Recommendations */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="font-bold text-base text-white">Smart Debt Settlements</h3>
                
                {data.suggestions.length === 0 ? (
                  <div className="glass-panel p-12 rounded-3xl text-center border border-dashed border-gray-850">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                    <p className="text-white font-bold text-lg">No outstanding debts!</p>
                    <p className="text-xs text-gray-400 mt-1">Everyone in the group is fully settled up.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.suggestions.map((sug, idx) => (
                      <div
                        key={idx}
                        className="glass-panel p-4 rounded-2xl flex items-center justify-between border border-white/5 animate-fade-in"
                      >
                        <div className="flex items-center gap-3 text-xs">
                          <div className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center font-bold">
                            {sug.fromUserName[0]}
                          </div>
                          <div>
                            <span className="font-bold text-white">{sug.fromUserName}</span>
                            <span className="text-gray-500 px-2 font-medium">owes</span>
                            <span className="font-bold text-white">{sug.toUserName}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="font-extrabold text-sm text-emerald-400">₹{sug.amount}</span>
                          <button
                            onClick={() => triggerQuickSettle(sug)}
                            className="px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-lg text-[10px] hover:opacity-95 transition shadow-md shadow-violet-500/10 cursor-pointer"
                          >
                            Mark Paid
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Record Settlement Card Form */}
              <div className="space-y-4">
                <h3 className="font-bold text-base text-white">Record Cash Settlement</h3>
                <div className="glass-panel p-5 rounded-2xl border border-white/5">
                  <form onSubmit={handleSaveSettlement} className="space-y-4">
                    {settleError && (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs">
                        {settleError}
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                        Who Paid
                      </label>
                      <select
                        value={setFrom}
                        onChange={(e) => setSetFrom(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white outline-none"
                      >
                        <option value="">Select Debtor</option>
                        {data.members.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                        Who Received
                      </label>
                      <select
                        value={setTo}
                        onChange={(e) => setSetTo(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white outline-none"
                      >
                        <option value="">Select Creditor</option>
                        {data.members.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                        Amount (₹)
                      </label>
                      <input
                        type="number"
                        value={setAmount}
                        onChange={(e) => setSetAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={settleLoading}
                      className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold rounded-xl text-xs hover:opacity-95 transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {settleLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Recording...
                        </>
                      ) : (
                        'Record Settlement'
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RECURRING EXPENSES */}
          {activeTab === 'recurring' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* List Configs */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-white">Active Recurring Bills</h3>
                  <button
                    onClick={() => setRecurringModalOpen(true)}
                    className="px-3 py-1.5 bg-gray-900 hover:bg-gray-850 border border-gray-800 text-[10px] font-semibold text-white rounded-lg flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Recurring Config
                  </button>
                </div>

                {data.recurringExpenses.length === 0 ? (
                  <div className="glass-panel p-12 rounded-3xl text-center border border-dashed border-gray-850">
                    <Calendar className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400 font-medium">No recurring expenses set up</p>
                    <p className="text-xs text-gray-650 mt-1">Rent, Netflix, or WiFi? Automate them daily, weekly, or monthly.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.recurringExpenses.map((rec) => (
                      <div
                        key={rec.id}
                        className="glass-panel p-4 rounded-2xl flex items-center justify-between border border-white/5"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gray-950 flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-indigo-400" />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-white">{rec.title}</h4>
                            <p className="text-[10px] text-gray-500 capitalize">
                              {rec.frequency} &bull; Category: {rec.category}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="font-extrabold text-sm text-white">₹{rec.amount}</p>
                          <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-semibold border border-amber-500/10 mt-1 inline-block">
                            Next Due: {rec.nextDueDate}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Explainer / Budget Info */}
              <div className="space-y-4">
                <h3 className="font-bold text-base text-white">About Auto-Bills</h3>
                <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-3 text-xs leading-relaxed text-gray-400">
                  <div className="flex gap-2">
                    <Info className="w-5 h-5 text-cyan-400 shrink-0" />
                    <p>Recurring bills automatically generate actual group expenses whenever the dashboard is loaded on or after the scheduled **Next Due Date**.</p>
                  </div>
                  <p>Generated bills are split **equally** among all members currently in the group to save manual calculations.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: VISUAL ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              
              {/* Overall Totals */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="glass-panel p-5 rounded-2xl border border-white/5">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Total Group Spending</span>
                  <p className="text-2xl font-black text-white mt-1">₹{data.totalExpenses}</p>
                </div>

                <div className="glass-panel p-5 rounded-2xl border border-white/5">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Number of Expenses</span>
                  <p className="text-2xl font-black text-white mt-1">{data.expenses.length} transactions</p>
                </div>

                <div className="glass-panel p-5 rounded-2xl border border-white/5">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Settled Amount Total</span>
                  <p className="text-2xl font-black text-emerald-400 mt-1">
                    ₹{data.settlements.reduce((sum, s) => sum + s.amount, 0)}
                  </p>
                </div>
              </div>

              {/* Charts grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Category Pie Chart */}
                <div className="glass-panel p-6 rounded-2xl border border-white/5 flex flex-col items-center">
                  <h4 className="font-bold text-sm text-white self-start mb-4">Spending by Category</h4>
                  
                  {categoryChartData.length === 0 ? (
                    <div className="text-xs text-gray-600 py-16">No categories tracked. Log expenses to view breakdown.</div>
                  ) : (
                    <div className="w-full h-64 flex flex-col md:flex-row items-center justify-center gap-6">
                      <div className="w-48 h-48 shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={categoryChartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={75}
                              paddingAngle={2}
                              dataKey="value"
                            >
                              {categoryChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ background: '#090d16', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }} 
                              itemStyle={{ color: '#fff', fontSize: '12px' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Legend grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs flex-1">
                        {categoryChartData.map((entry, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-gray-400">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }} />
                            <span className="truncate max-w-[100px] capitalize">{entry.name}: ₹{entry.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Member Bar Chart (Paid vs Owed) */}
                <div className="glass-panel p-6 rounded-2xl border border-white/5">
                  <h4 className="font-bold text-sm text-white mb-4">Member Paid vs Owed</h4>
                  
                  {memberChartData.length === 0 ? (
                    <div className="text-xs text-gray-600 py-16 text-center">No member activity yet.</div>
                  ) : (
                    <div className="w-full h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={memberChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                          <XAxis dataKey="name" stroke="#6b7280" fontSize={10} />
                          <YAxis stroke="#6b7280" fontSize={10} />
                          <Tooltip 
                            contentStyle={{ background: '#090d16', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}
                            itemStyle={{ fontSize: '11px' }}
                          />
                          <Bar dataKey="Paid" fill="#10b981" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Owed" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

          {/* TAB 5: GROUP SETTINGS & ADMIN CONTROLS */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Group Metadata Form */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="font-bold text-base text-white">Edit Group Details</h3>
                <div className="glass-panel p-6 rounded-2xl border border-white/5">
                  <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
                    {settingsError && (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl">
                        {settingsError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                          Group Name
                        </label>
                        <input
                          type="text"
                          required
                          value={groupName}
                          onChange={(e) => setGroupName(e.target.value)}
                          disabled={data.currentUserRole !== 'admin'}
                          className="w-full px-3.5 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white outline-none disabled:opacity-50"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                          Group Type
                        </label>
                        <select
                          value={groupType}
                          onChange={(e) => setGroupType(e.target.value)}
                          disabled={data.currentUserRole !== 'admin'}
                          className="w-full px-3.5 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white outline-none disabled:opacity-50"
                        >
                          <option value="roommates">Roommates</option>
                          <option value="travel">Travel / Trip</option>
                          <option value="family">Family</option>
                          <option value="event">Event / Party</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                        Description
                      </label>
                      <input
                        type="text"
                        value={groupDesc}
                        onChange={(e) => setGroupDesc(e.target.value)}
                        disabled={data.currentUserRole !== 'admin'}
                        className="w-full px-3.5 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white outline-none disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                        Trip Budget Limit (₹)
                      </label>
                      <input
                        type="number"
                        value={tripBudget}
                        onChange={(e) => setTripBudget(e.target.value)}
                        disabled={data.currentUserRole !== 'admin'}
                        className="w-full px-3.5 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white outline-none disabled:opacity-50"
                      />
                    </div>

                    {data.currentUserRole === 'admin' && (
                      <button
                        type="submit"
                        disabled={settingsLoading}
                        className="py-2.5 px-6 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-xl hover:opacity-95 transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {settingsLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </button>
                    )}
                  </form>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="space-y-4">
                <h3 className="font-bold text-base text-white">Danger Zone</h3>
                <div className="glass-panel p-5 rounded-2xl border border-rose-500/10 bg-rose-950/5 space-y-3">
                  <p className="text-[10px] text-rose-300 font-semibold leading-relaxed">
                    Once you delete a group, all expense ledger values are lost. There is no undo.
                  </p>
                  
                  {data.currentUserRole === 'admin' ? (
                    <button
                      onClick={handleDeleteGroup}
                      className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-xs transition cursor-pointer"
                    >
                      Delete Group Permanent
                    </button>
                  ) : (
                    <div className="p-2.5 bg-gray-900 border border-gray-800 rounded-xl text-[10px] text-gray-500 text-center">
                      Only group creators or admins can delete this group.
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

        </div>

      </main>

      {/* MODAL 1: ADD / EDIT EXPENSE */}
      {expenseModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in print:hidden">
          <div className="glass-panel w-full max-w-lg p-6 rounded-3xl border border-white/5 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="text-lg font-bold text-white mb-4">
              {editExpenseId ? 'Edit Expense' : 'Add Share Bill'}
            </h3>

            <form onSubmit={handleSaveExpense} className="space-y-4 text-xs">
              {expenseError && (
                <div className="p-3 bg-violet-950/20 border border-violet-500/20 text-violet-300 rounded-xl leading-relaxed">
                  {expenseError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Bill Description
                  </label>
                  <input
                    type="text"
                    required
                    value={expDescription}
                    onChange={(e) => setExpDescription(e.target.value)}
                    placeholder="e.g. Dinner, Fuel, WiFi"
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Total Amount (₹)
                  </label>
                  <input
                    type="number"
                    required
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white outline-none font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white outline-none capitalize"
                  >
                    {['food', 'travel', 'accommodation', 'utilities', 'shopping', 'entertainment', 'groceries', 'other'].map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Paid By
                  </label>
                  <select
                    value={expPaidBy}
                    onChange={(e) => setExpPaidBy(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white outline-none"
                  >
                    {data.members.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Split Strategies Section */}
              <div className="border-t border-gray-850 pt-3">
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Split Type
                </label>
                <div className="flex flex-wrap gap-1 mb-4 bg-gray-950 p-1 rounded-xl border border-gray-850">
                  {(['equal', 'percent', 'amount', 'shares', 'itemized'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setExpSplitType(type)}
                      className={`py-1.5 px-3 rounded-lg text-[9px] font-bold uppercase transition flex-1 text-center cursor-pointer ${
                        expSplitType === type
                          ? 'bg-violet-600 text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <div className="space-y-3.5 max-h-48 overflow-y-auto custom-scrollbar p-1">
                  {data.members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-4">
                      <span className="font-bold text-gray-300 text-[11px] truncate max-w-[150px]">{m.name}</span>
                      
                      <div className="flex items-center gap-2">
                        {/* Split values input depending on type */}
                        {expSplitType === 'equal' && (
                          <input
                            type="checkbox"
                            checked={!!expSplits[m.id]}
                            onChange={(e) => setExpSplits({ ...expSplits, [m.id]: e.target.checked ? 1 : 0 })}
                            className="w-4 h-4 rounded border-gray-800 bg-gray-950 text-violet-600 accent-violet-600"
                          />
                        )}

                        {expSplitType === 'percent' && (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              value={expSplits[m.id] ?? 0}
                              onChange={(e) => setExpSplits({ ...expSplits, [m.id]: parseFloat(e.target.value) || 0 })}
                              placeholder="0"
                              className="w-16 px-2 py-1 bg-gray-950 border border-gray-800 rounded-lg text-white text-right outline-none"
                            />
                            <span className="text-gray-500 font-bold">%</span>
                          </div>
                        )}

                        {expSplitType === 'shares' && (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              value={expSplits[m.id] ?? 0}
                              onChange={(e) => setExpSplits({ ...expSplits, [m.id]: parseFloat(e.target.value) || 0 })}
                              placeholder="1"
                              className="w-16 px-2 py-1 bg-gray-950 border border-gray-800 rounded-lg text-white text-right outline-none"
                            />
                            <span className="text-gray-500 font-semibold text-[10px]">shares</span>
                          </div>
                        )}

                        {(expSplitType === 'amount' || expSplitType === 'itemized') && (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500 font-bold">₹</span>
                            <input
                              type="number"
                              value={expSplits[m.id] ?? 0}
                              onChange={(e) => setExpSplits({ ...expSplits, [m.id]: parseFloat(e.target.value) || 0 })}
                              placeholder="0.00"
                              className="w-20 px-2 py-1 bg-gray-950 border border-gray-800 rounded-lg text-white text-right outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t border-gray-850">
                <button
                  type="button"
                  onClick={() => setExpenseModalOpen(false)}
                  className="flex-1 py-2.5 bg-gray-800 text-gray-300 font-semibold rounded-xl hover:bg-gray-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={expenseLoading}
                  className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-xl hover:opacity-95 transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {expenseLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    'Save Expense'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: AI RECEIPT SCANNER */}
      {ocrModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in print:hidden">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl border border-white/5 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400" /> AI Receipt OCR Scan
            </h3>
            <p className="text-gray-400 text-[10px] leading-relaxed mb-4">
              Upload an image of your receipt. Gemini AI will analyze the store name, transaction date, total amount, and prefill details for review.
            </p>

            <form onSubmit={handleOcrScan} className="space-y-4 text-xs">
              {ocrError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl leading-relaxed">
                  {ocrError}
                </div>
              )}

              <div className="border border-dashed border-gray-800 rounded-2xl p-6 text-center bg-gray-950/40 relative cursor-pointer group hover:border-cyan-500/20 transition">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  required
                  onChange={(e) => setOcrFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                
                <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2 group-hover:text-cyan-400 transition" />
                <span className="font-bold text-gray-300 block mb-1">
                  {ocrFile ? ocrFile.name : 'Select Receipt Image'}
                </span>
                <span className="text-[10px] text-gray-500 block">PNG, JPG, or JPEG up to 5MB</span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setOcrModalOpen(false); setOcrFile(null); }}
                  className="flex-1 py-2.5 bg-gray-800 text-gray-300 font-semibold rounded-xl hover:bg-gray-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ocrLoading || !ocrFile}
                  className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-xl hover:opacity-95 transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {ocrLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> AI Analyzing...
                    </>
                  ) : (
                    'Scan Receipt'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD RECURRING EXPENSE */}
      {recurringModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in print:hidden">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl border border-white/5 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-4">Set Up Recurring Bill</h3>

            <form onSubmit={handleSaveRecurring} className="space-y-4 text-xs">
              {recError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl">
                  {recError}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Bill Title
                </label>
                <input
                  type="text"
                  required
                  value={recTitle}
                  onChange={(e) => setRecTitle(e.target.value)}
                  placeholder="e.g. WiFi Bill, Netflix subscription"
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    required
                    value={recAmount}
                    onChange={(e) => setRecAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Frequency
                  </label>
                  <select
                    value={recFrequency}
                    onChange={(e) => setRecFrequency(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white outline-none"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={recCategory}
                    onChange={(e) => setRecCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white outline-none capitalization"
                  >
                    {['utilities', 'food', 'travel', 'accommodation', 'shopping', 'entertainment', 'other'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Next Due Date
                  </label>
                  <input
                    type="date"
                    required
                    value={recNextDueDate}
                    onChange={(e) => setRecNextDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRecurringModalOpen(false)}
                  className="flex-1 py-2.5 bg-gray-800 text-gray-300 font-semibold rounded-xl hover:bg-gray-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recLoading}
                  className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-xl hover:opacity-95 transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {recLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Setting...
                    </>
                  ) : (
                    'Set Auto-Bill'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: INVITATION SHARE CODE */}
      {inviteModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in print:hidden">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl border border-white/5 shadow-2xl relative text-center">
            <h3 className="text-lg font-bold text-white mb-2">Invite Members</h3>
            <p className="text-xs text-gray-400 mb-4">Share this code or invite link. Your friends can enter this code in their dashboard to join this group.</p>

            <div className="bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm font-bold text-cyan-400 select-all mb-4">
              {groupId}
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(groupId);
                alert('Invite code copied to clipboard!');
                setInviteModalOpen(false);
              }}
              className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-xl text-xs hover:opacity-95 transition cursor-pointer"
            >
              Copy to Clipboard
            </button>
            
            <button
              onClick={() => setInviteModalOpen(false)}
              className="w-full py-2 bg-gray-850 hover:bg-gray-800 border border-gray-800 text-gray-400 font-semibold rounded-xl text-xs transition mt-2 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
