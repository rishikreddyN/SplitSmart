import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { db } from '@/db';
import { groups, groupMembers, users, expenses, expenseSplits, settlements, recurringExpenses } from '@/db/schema';
import { eq, and, inArray, sql, desc } from 'drizzle-orm';
import { processDueRecurringExpenses } from '@/lib/recurringExpenses';
import { calculateSettlementSuggestions } from '@/lib/settlementEngine';
import GroupClient from './GroupClient';

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();

  if (!user) {
    redirect('/login');
  }

  const { id: groupId } = await params;

  // 1. Check membership
  const membership = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)))
    .limit(1);

  if (membership.length === 0) {
    // If not a member, redirect to dashboard
    redirect('/dashboard');
  }

  // Process any due recurring expenses before fetching details
  await processDueRecurringExpenses(groupId);

  // 2. Fetch Group Meta
  const groupMeta = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (groupMeta.length === 0) {
    redirect('/dashboard');
  }
  const group = groupMeta[0];

  // 3. Fetch Members
  const membersList = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      role: groupMembers.role,
      joinedAt: groupMembers.joinedAt,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, groupId));

  // 4. Fetch Expenses
  const groupExpenses = await db
    .select()
    .from(expenses)
    .where(eq(expenses.groupId, groupId))
    .orderBy(desc(expenses.date), desc(expenses.createdAt));

  // Fetch splits for these expenses
  const expenseIds = groupExpenses.map((e) => e.id);
  let allSplits: any[] = [];
  if (expenseIds.length > 0) {
    allSplits = await db
      .select({
        id: expenseSplits.id,
        expenseId: expenseSplits.expenseId,
        userId: expenseSplits.userId,
        shareAmount: expenseSplits.shareAmount,
        splitType: expenseSplits.splitType,
        userName: users.name,
      })
      .from(expenseSplits)
      .innerJoin(users, eq(expenseSplits.userId, users.id))
      .where(inArray(expenseSplits.expenseId, expenseIds));
  }

  // 5. Fetch Settlements
  const groupSettlements = await db
    .select({
      id: settlements.id,
      payerId: settlements.payerId,
      payerName: sql<string>`(select name from users where id = ${settlements.payerId})`,
      payerAvatar: sql<string>`(select avatar_url from users where id = ${settlements.payerId})`,
      receiverId: settlements.receiverId,
      receiverName: sql<string>`(select name from users where id = ${settlements.receiverId})`,
      receiverAvatar: sql<string>`(select avatar_url from users where id = ${settlements.receiverId})`,
      amount: settlements.amount,
      status: settlements.status,
      settledAt: settlements.settledAt,
    })
    .from(settlements)
    .where(eq(settlements.groupId, groupId))
    .orderBy(desc(settlements.settledAt));

  // 6. Fetch Recurring Expenses
  const groupRecurring = await db
    .select()
    .from(recurringExpenses)
    .where(eq(recurringExpenses.groupId, groupId));

  // 7. Calculate Balances
  const balances: Record<string, number> = {};
  membersList.forEach((m) => {
    balances[m.id] = 0;
  });

  groupExpenses.forEach((exp) => {
    if (balances[exp.paidBy] !== undefined) {
      balances[exp.paidBy] += exp.amount;
    }
    const splits = allSplits.filter((s) => s.expenseId === exp.id);
    splits.forEach((split) => {
      if (balances[split.userId] !== undefined) {
        balances[split.userId] -= split.shareAmount;
      }
    });
  });

  groupSettlements.forEach((set) => {
    if (balances[set.payerId] !== undefined) {
      balances[set.payerId] += set.amount;
    }
    if (balances[set.receiverId] !== undefined) {
      balances[set.receiverId] -= set.amount;
    }
  });

  // Attach balances to member objects
  const membersWithBalances = membersList.map((m) => ({
    ...m,
    netBalance: Math.round((balances[m.id] || 0) * 100) / 100,
  }));

  // Compute suggestions
  const suggestions = calculateSettlementSuggestions(
    membersList.map((m) => ({ id: m.id, name: m.name, email: m.email, avatarUrl: m.avatarUrl })),
    balances
  );

  // Format expenses with splits
  const formattedExpenses = groupExpenses.map((exp) => {
    const splits = allSplits
      .filter((s) => s.expenseId === exp.id)
      .map((s) => ({
        userId: s.userId,
        userName: s.userName,
        shareAmount: s.shareAmount,
        splitType: s.splitType,
      }));
    const payerName = membersList.find((m) => m.id === exp.paidBy)?.name || 'Unknown';
    const payerAvatar = membersList.find((m) => m.id === exp.paidBy)?.avatarUrl || null;
    return {
      id: exp.id,
      paidBy: exp.paidBy,
      payerName,
      payerAvatar,
      description: exp.description,
      amount: exp.amount,
      category: exp.category,
      receiptUrl: exp.receiptUrl,
      date: exp.date,
      createdAt: exp.createdAt,
      splits,
    };
  });

  const totalExpenses = groupExpenses.reduce((sum, e) => sum + e.amount, 0);

  const initialData = {
    group: {
      id: group.id,
      name: group.name,
      description: group.description,
      type: group.type,
      tripBudget: group.tripBudget || 0,
    },
    currentUserRole: membership[0].role,
    members: membersWithBalances,
    expenses: formattedExpenses,
    settlements: groupSettlements,
    recurringExpenses: groupRecurring,
    suggestions,
    totalExpenses,
  };

  return (
    <GroupClient 
      groupId={groupId} 
      userId={user.id} 
      initialData={initialData} 
    />
  );
}
