'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Link as LinkIcon, Loader2, Home, Compass, Users, Ticket, Tag } from 'lucide-react';

export default function GroupActions() {
  const router = useRouter();
  
  // Create Group Modal State
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupType, setGroupType] = useState('roommates');
  const [description, setDescription] = useState('');
  const [tripBudget, setTripBudget] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Join Group Modal State
  const [showJoin, setShowJoin] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName) {
      setCreateError('Group name is required');
      return;
    }

    setCreateLoading(true);
    setCreateError('');

    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupName,
          type: groupType,
          description,
          tripBudget: tripBudget ? parseFloat(tripBudget) : 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create group');
      }

      setShowCreate(false);
      setGroupName('');
      setDescription('');
      setTripBudget('');
      
      router.refresh();
      router.push(`/groups/${data.group.id}`);

    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode) {
      setJoinError('Invite code is required');
      return;
    }

    setJoinLoading(true);
    setJoinError('');

    try {
      const res = await fetch('/api/groups/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inviteCode.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to join group');
      }

      setShowJoin(false);
      setInviteCode('');
      
      router.refresh();
      router.push(`/groups/${data.groupId}`);

    } catch (err: any) {
      setJoinError(err.message);
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-8">
      {/* Create Button */}
      <button
        onClick={() => setShowCreate(true)}
        className="flex-1 py-4 px-6 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 transition shadow-lg shadow-violet-500/10 cursor-pointer"
      >
        <Plus className="w-5 h-5" />
        Create a Group
      </button>

      {/* Join Button */}
      <button
        onClick={() => setShowJoin(true)}
        className="flex-1 py-4 px-6 bg-gray-900/60 hover:bg-gray-900/80 border border-gray-800 text-gray-300 font-semibold rounded-2xl flex items-center justify-center gap-2 transition cursor-pointer"
      >
        <LinkIcon className="w-5 h-5 text-cyan-400" />
        Join a Group
      </button>

      {/* Create Group Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl border border-white/5 shadow-2xl relative">
            <h3 className="text-xl font-bold text-white mb-4">Create New Group</h3>
            
            <form onSubmit={handleCreateGroup} className="space-y-4">
              {createError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-sm">
                  {createError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Group Name
                </label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Goa Trip, Room 302"
                  className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl focus:border-violet-500 text-white outline-none text-sm transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Group Type
                </label>
                <select
                  value={groupType}
                  onChange={(e) => setGroupType(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl focus:border-violet-500 text-white outline-none text-sm transition"
                >
                  <option value="roommates">Roommates</option>
                  <option value="travel">Travel / Trip</option>
                  <option value="family">Family</option>
                  <option value="event">Event / Party</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Shared expenses for PG apartment"
                  className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl focus:border-violet-500 text-white outline-none text-sm transition"
                />
              </div>

              {groupType === 'travel' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Trip Budget (Optional, ₹)
                  </label>
                  <input
                    type="number"
                    value={tripBudget}
                    onChange={(e) => setTripBudget(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl focus:border-violet-500 text-white outline-none text-sm transition"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 bg-gray-800 text-gray-300 font-semibold rounded-xl hover:bg-gray-700 transition text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-xl hover:opacity-95 transition text-sm disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                >
                  {createLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Creating...
                    </>
                  ) : (
                    'Create'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Group Modal */}
      {showJoin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl border border-white/5 shadow-2xl relative">
            <h3 className="text-xl font-bold text-white mb-4">Join Group</h3>
            
            <form onSubmit={handleJoinGroup} className="space-y-4">
              {joinError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-sm">
                  {joinError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Invite Code / Group ID
                </label>
                <input
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Paste the invitation code here"
                  className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl focus:border-violet-500 text-white outline-none text-sm transition"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowJoin(false)}
                  className="flex-1 py-2.5 bg-gray-800 text-gray-300 font-semibold rounded-xl hover:bg-gray-700 transition text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joinLoading}
                  className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-xl hover:opacity-95 transition text-sm disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                >
                  {joinLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Joining...
                    </>
                  ) : (
                    'Join'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
