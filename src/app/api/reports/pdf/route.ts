import { NextResponse } from 'next/server';
import { db } from '@/db';
import { groups, groupMembers, users, expenses, expenseSplits, settlements } from '@/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { getSessionUser } from '@/lib/auth';
import { calculateSettlementSuggestions } from '@/lib/settlementEngine';

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');

    if (!groupId) {
      return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
    }

    // Check membership
    const membership = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)))
      .limit(1);

    if (membership.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1. Fetch Group
    const groupResult = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
    if (groupResult.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }
    const group = groupResult[0];

    // 2. Fetch Members
    const membersList = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
      })
      .from(groupMembers)
      .innerJoin(users, eq(groupMembers.userId, users.id))
      .where(eq(groupMembers.groupId, groupId));

    // 3. Fetch Expenses
    const groupExpenses = await db
      .select()
      .from(expenses)
      .where(eq(expenses.groupId, groupId));

    // Fetch splits
    const expenseIds = groupExpenses.map((e) => e.id);
    let allSplits: any[] = [];
    if (expenseIds.length > 0) {
      allSplits = await db
        .select({
          expenseId: expenseSplits.expenseId,
          userId: expenseSplits.userId,
          shareAmount: expenseSplits.shareAmount,
        })
        .from(expenseSplits)
        .where(inArray(expenseSplits.expenseId, expenseIds));
    }

    // 4. Fetch Settlements
    const groupSettlements = await db
      .select()
      .from(settlements)
      .where(eq(settlements.groupId, groupId));

    // Calculate Balances
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

    groupSettlements
      .filter((set) => set.status === 'completed')
      .forEach((set) => {
        if (balances[set.payerId] !== undefined) {
          balances[set.payerId] += set.amount;
        }
        if (balances[set.receiverId] !== undefined) {
          balances[set.receiverId] -= set.amount;
        }
      });

    // Members summary with net balance
    const membersSummary = membersList.map((m) => ({
      name: m.name,
      email: m.email,
      netBalance: Math.round((balances[m.id] || 0) * 100) / 100,
    }));

    // Category breakdown
    const categoryBreakdown: Record<string, number> = {};
    groupExpenses.forEach((exp) => {
      categoryBreakdown[exp.category] = (categoryBreakdown[exp.category] || 0) + exp.amount;
    });

    const categories = Object.entries(categoryBreakdown).map(([name, value]) => ({
      name,
      amount: Math.round(value * 100) / 100,
    }));

    // Suggested settlements
    const suggestions = calculateSettlementSuggestions(
      membersList.map((m) => ({ id: m.id, name: m.name, email: m.email, avatarUrl: null })),
      balances
    );

    const totalExpenses = groupExpenses.reduce((sum, e) => sum + e.amount, 0);

    return NextResponse.json({
      groupName: group.name,
      groupType: group.type,
      totalExpenses,
      memberCount: membersList.length,
      members: membersSummary,
      categories,
      suggestions,
      expensesCount: groupExpenses.length,
      settlementsCount: groupSettlements.length,
    });

  } catch (error: any) {
    console.error('PDF Report API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
