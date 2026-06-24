import { NextResponse } from 'next/server';
import { db } from '@/db';
import { groups, groupMembers, users, expenses, expenseSplits, settlements, recurringExpenses } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSessionUser } from '@/lib/auth';
import { calculateSettlementSuggestions } from '@/lib/settlementEngine';
import { processDueRecurringExpenses } from '@/lib/recurringExpenses';

// Helper to check user membership and get their role
async function getMembership(groupId: string, userId: string) {
  const result = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  return result[0] || null;
}

// GET /api/groups/:id - Fetch full details for a group
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: groupId } = await params;

    // 1. Check membership
    const membership = await getMembership(groupId, user.id);
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Process recurring expenses
    await processDueRecurringExpenses(groupId);

    // 2. Fetch Group Meta
    const groupMeta = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
    if (groupMeta.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
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

    // 4. Fetch Expenses & Splits
    const groupExpenses = await db
      .select({
        id: expenses.id,
        paidBy: expenses.paidBy,
        description: expenses.description,
        amount: expenses.amount,
        category: expenses.category,
        receiptUrl: expenses.receiptUrl,
        date: expenses.date,
        createdAt: expenses.createdAt,
      })
      .from(expenses)
      .where(eq(expenses.groupId, groupId))
      .orderBy(sql`date(date) DESC, created_at DESC`);

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
      .orderBy(sql`settled_at DESC`);

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

    // Add paid expenses, subtract owed shares
    groupExpenses.forEach((exp) => {
      // Add paid amount (if payer is a group member)
      if (balances[exp.paidBy] !== undefined) {
        balances[exp.paidBy] += exp.amount;
      }
      // Subtract splits
      const splits = allSplits.filter((s) => s.expenseId === exp.id);
      splits.forEach((split) => {
        if (balances[split.userId] !== undefined) {
          balances[split.userId] -= split.shareAmount;
        }
      });
    });

    // Process settlements
    // When B settles ₹100 debt to A:
    // B (payer/debtor) balance goes from -100 toward 0 → += amount
    // A (receiver/creditor) balance goes from +200 toward +100 → -= amount
    groupSettlements.forEach((set) => {
      if (balances[set.payerId] !== undefined) {
        balances[set.payerId] += set.amount;
      }
      if (balances[set.receiverId] !== undefined) {
        balances[set.receiverId] -= set.amount;
      }
    });

    // 8. Attach balances to member objects
    const membersWithBalances = membersList.map((m) => ({
      ...m,
      netBalance: Math.round((balances[m.id] || 0) * 100) / 100,
    }));

    // 9. Compute settlement suggestions
    const suggestions = calculateSettlementSuggestions(
      membersList.map((m) => ({ id: m.id, name: m.name, email: m.email, avatarUrl: m.avatarUrl })),
      balances
    );

    // 10. Format expenses with their splits
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
        ...exp,
        payerName,
        payerAvatar,
        splits,
      };
    });

    // Calculate total group expenses sum
    const totalExpenses = groupExpenses.reduce((sum, e) => sum + e.amount, 0);

    return NextResponse.json({
      group,
      currentUserRole: membership.role,
      members: membersWithBalances,
      expenses: formattedExpenses,
      settlements: groupSettlements,
      recurringExpenses: groupRecurring,
      suggestions,
      totalExpenses,
    });

  } catch (error: any) {
    console.error('Fetch Group Detail Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/groups/:id - Update group (Admin only)
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: groupId } = await params;
    const membership = await getMembership(groupId, user.id);

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden. Admin role required.' }, { status: 403 });
    }

    const { name, description, type, tripBudget } = await request.json();

    if (!name || !type) {
      return NextResponse.json({ error: 'Name and Type are required' }, { status: 400 });
    }

    const parsedBudget = tripBudget ? parseFloat(tripBudget) : 0;

    await db
      .update(groups)
      .set({
        name,
        description: description || '',
        type,
        tripBudget: isNaN(parsedBudget) ? 0 : parsedBudget,
      })
      .where(eq(groups.id, groupId));

    return NextResponse.json({ success: true, message: 'Group updated successfully' });

  } catch (error: any) {
    console.error('Update Group Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/groups/:id - Delete group (Admin only)
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: groupId } = await params;
    const membership = await getMembership(groupId, user.id);

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden. Admin role required.' }, { status: 403 });
    }

    // Cascade deletes because of our schema constraints (ON DELETE CASCADE)
    await db.delete(groups).where(eq(groups.id, groupId));

    return NextResponse.json({ success: true, message: 'Group deleted successfully' });

  } catch (error: any) {
    console.error('Delete Group Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

import { inArray, sql } from 'drizzle-orm';
