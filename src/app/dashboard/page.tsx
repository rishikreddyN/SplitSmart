import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth';
import { db } from '@/db';
import { groups, groupMembers, expenses, expenseSplits, settlements, notifications, users } from '@/db/schema';
import { eq, inArray, desc, and } from 'drizzle-orm';
import { Wallet, Compass, Home, Users, Ticket, Tag, ChevronRight, ArrowDownRight, ArrowUpRight, ShieldCheck, Heart } from 'lucide-react';
import GroupActions from './GroupActions';
import HeaderActions from './HeaderActions';

// Helper to get group icon
function getGroupIcon(type: string) {
  switch (type) {
    case 'roommates':
      return <Home className="w-5 h-5 text-violet-400" />;
    case 'travel':
      return <Compass className="w-5 h-5 text-cyan-400" />;
    case 'family':
      return <Heart className="w-5 h-5 text-rose-400" />;
    case 'event':
      return <Ticket className="w-5 h-5 text-amber-400" />;
    default:
      return <Tag className="w-5 h-5 text-gray-400" />;
  }
}

export default async function DashboardPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect('/login');
  }

  // 1. Fetch memberships
  const memberships = await db
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.userId, user.id));

  const groupIds = memberships.map((m) => m.groupId);

  // 2. Fetch groups
  const userGroupList = groupIds.length > 0
    ? await db.select().from(groups).where(inArray(groups.id, groupIds))
    : [];

  // 3. Compute balances per group & overall balance
  let overallBalance = 0;
  const groupsWithDetails = await Promise.all(
    userGroupList.map(async (group) => {
      // Fetch members count
      const mCount = await db
        .select()
        .from(groupMembers)
        .where(eq(groupMembers.groupId, group.id));

      // Fetch expenses
      const expList = await db
        .select()
        .from(expenses)
        .where(eq(expenses.groupId, group.id));

      const expIds = expList.map((e) => e.id);

      // Fetch splits for this user
      let userOwed = 0;
      if (expIds.length > 0) {
        const userSplits = await db
          .select()
          .from(expenseSplits)
          .where(and(inArray(expenseSplits.expenseId, expIds), eq(expenseSplits.userId, user.id)));
        userOwed = userSplits.reduce((sum, s) => sum + s.shareAmount, 0);
      }

      // User paid expenses
      const userPaid = expList
        .filter((e) => e.paidBy === user.id)
        .reduce((sum, e) => sum + e.amount, 0);

      // Fetch settlements
      const setList = await db
        .select()
        .from(settlements)
        .where(eq(settlements.groupId, group.id));

      const userPaidSettlements = setList
        .filter((s) => s.payerId === user.id)
        .reduce((sum, s) => sum + s.amount, 0);

      const userReceivedSettlements = setList
        .filter((s) => s.receiverId === user.id)
        .reduce((sum, s) => sum + s.amount, 0);

      // Group net balance
      const groupNetBalance = (userPaid + userPaidSettlements) - (userOwed + userReceivedSettlements);
      const roundedGroupBalance = Math.round(groupNetBalance * 100) / 100;
      overallBalance += roundedGroupBalance;

      return {
        ...group,
        memberCount: mCount.length,
        userBalance: roundedGroupBalance,
      };
    })
  );

  // 4. Fetch notifications
  const recentNotifications = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(10);

  const roundedOverallBalance = Math.round(overallBalance * 100) / 100;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-900 bg-[#070b13]/80 sticky top-0 z-20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/15">
              <Wallet className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold tracking-tight text-white">
              Split<span className="text-cyan-400">Smart</span>
            </span>
          </div>

          <HeaderActions user={user} initialNotifications={recentNotifications} />
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-7xl mx-auto w-full px-6 py-8 flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Columns (Balances & Quick Controls) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Welcome & Global Balance Card */}
          <div className="glass-panel p-6 md:p-8 rounded-3xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1 z-10">
              <h2 className="text-2xl font-extrabold text-white">Hey, {user.name.split(' ')[0]} 👋</h2>
              <p className="text-sm text-gray-400">Here is your expense overview across all groups.</p>
            </div>

            <div className="z-10 flex items-center gap-4 bg-gray-950/40 p-4 rounded-2xl border border-white/5 w-full md:w-auto">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                roundedOverallBalance > 0.05
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : roundedOverallBalance < -0.05
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  : 'bg-gray-805/50 text-gray-400 border border-gray-800'
              }`}>
                {roundedOverallBalance > 0.05 ? (
                  <ArrowUpRight className="w-6 h-6" />
                ) : roundedOverallBalance < -0.05 ? (
                  <ArrowDownRight className="w-6 h-6" />
                ) : (
                  <ShieldCheck className="w-6 h-6" />
                )}
              </div>
              <div>
                <p className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider">Total Balance</p>
                <p className={`text-xl font-bold ${
                  roundedOverallBalance > 0.05
                    ? 'text-emerald-400'
                    : roundedOverallBalance < -0.05
                    ? 'text-rose-400'
                    : 'text-gray-300'
                }`}>
                  {roundedOverallBalance > 0.05
                    ? `Owed ₹${roundedOverallBalance}`
                    : roundedOverallBalance < -0.05
                    ? `You owe ₹${Math.abs(roundedOverallBalance)}`
                    : 'All settled up'}
                </p>
              </div>
            </div>
          </div>

          {/* Group Creation/Joining widgets */}
          <GroupActions />

          {/* Groups list */}
          <div className="space-y-4">
            <h3 className="font-bold text-lg text-white">Your Groups</h3>
            {groupsWithDetails.length === 0 ? (
              <div className="glass-panel p-10 rounded-3xl text-center border border-dashed border-gray-800">
                <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">You don&apos;t belong to any groups yet</p>
                <p className="text-xs text-gray-500 mt-1">Create one above or ask your friend for an invite code.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {groupsWithDetails.map((group) => (
                  <Link
                    key={group.id}
                    href={`/groups/${group.id}`}
                    className="glass-card p-5 rounded-2xl flex flex-col justify-between h-40 group text-left"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-950 flex items-center justify-center">
                          {getGroupIcon(group.type)}
                        </div>
                        <div>
                          <h4 className="font-bold text-white group-hover:text-cyan-400 transition">
                            {group.name}
                          </h4>
                          <span className="text-[10px] text-gray-500 capitalize">
                            {group.type} &bull; {group.memberCount} members
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-600 group-hover:translate-x-0.5 transition" />
                    </div>

                    <p className="text-xs text-gray-400 line-clamp-1 mt-2">
                      {group.description || 'No description provided.'}
                    </p>

                    <div className="border-t border-gray-900 pt-3 flex items-center justify-between text-xs mt-3">
                      <span className="text-gray-500 font-medium">Balance:</span>
                      <span className={`font-bold ${
                        group.userBalance > 0.05
                          ? 'text-emerald-400'
                          : group.userBalance < -0.05
                          ? 'text-rose-400'
                          : 'text-gray-400'
                      }`}>
                        {group.userBalance > 0.05
                          ? `+₹${group.userBalance}`
                          : group.userBalance < -0.05
                          ? `-₹${Math.abs(group.userBalance)}`
                          : 'Settled'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (Recent Notifications & Activity) */}
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-3xl h-full flex flex-col">
            <h3 className="font-bold text-lg text-white mb-4">Activity Log</h3>
            <div className="space-y-4 flex-1 overflow-y-auto max-h-[500px] custom-scrollbar">
              {recentNotifications.length === 0 ? (
                <div className="text-center py-10 text-sm text-gray-500">
                  No recent activities recorded.
                </div>
              ) : (
                recentNotifications.map((n) => (
                  <div key={n.id} className="flex gap-3 text-xs leading-relaxed border-b border-gray-900 pb-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.isRead === 0 ? 'bg-cyan-400' : 'bg-gray-700'}`} />
                    <div className="space-y-0.5">
                      <p className="text-gray-300">{n.message}</p>
                      {n.createdAt && (
                        <span className="text-[10px] text-gray-600 block">
                          {new Date(n.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
