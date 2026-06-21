import { NextResponse } from 'next/server';
import { db } from '@/db';
import { expenses, expenseSplits, groupMembers } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getSessionUser } from '@/lib/auth';

interface SplitInput {
  userId: string;
  value: number; // percentage, custom amount, shares, or itemized price
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: expenseId } = await params;

    // Fetch existing expense
    const existingExpense = await db.select().from(expenses).where(eq(expenses.id, expenseId)).limit(1);
    if (existingExpense.length === 0) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }
    const exp = existingExpense[0];

    // Check user membership and role in the group
    const membership = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, exp.groupId), eq(groupMembers.userId, user.id)))
      .limit(1);

    if (membership.length === 0) {
      return NextResponse.json({ error: 'Forbidden. You are not in this group.' }, { status: 403 });
    }

    const userRole = membership[0].role;
    // Authorized if user is Group Admin OR user is the Payer
    const isAuthorized = userRole === 'admin' || exp.paidBy === user.id;
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden. Only the payer or group admin can edit this expense.' }, { status: 403 });
    }

    const {
      description,
      amount: rawAmount,
      category,
      date,
      paidBy,
      splitType,
      splits,
    } = await request.json() as {
      description: string;
      amount: number;
      category: string;
      date: string;
      paidBy: string;
      splitType: 'equal' | 'percent' | 'amount' | 'shares' | 'itemized';
      splits: SplitInput[];
    };

    if (!description || !rawAmount || !category || !date || !paidBy || !splitType || !splits || splits.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const amount = parseFloat(rawAmount.toString());
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
    }

    // Verify payer is in the group
    const payerMembership = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, exp.groupId), eq(groupMembers.userId, paidBy)))
      .limit(1);

    if (payerMembership.length === 0) {
      return NextResponse.json({ error: 'Payer must be a group member' }, { status: 400 });
    }

    // Recalculate splits
    const computedSplits: { userId: string; shareAmount: number }[] = [];

    if (splitType === 'equal') {
      const count = splits.length;
      const baseShare = Math.floor((amount / count) * 100) / 100;
      let sum = baseShare * count;
      let diff = Math.round((amount - sum) * 100) / 100;

      splits.forEach((s, idx) => {
        let share = baseShare;
        if (idx === 0) {
          share = Math.round((share + diff) * 100) / 100;
        }
        computedSplits.push({ userId: s.userId, shareAmount: share });
      });

    } else if (splitType === 'percent') {
      const totalPercent = splits.reduce((sum, s) => sum + s.value, 0);
      if (Math.abs(totalPercent - 100) > 0.1) {
        return NextResponse.json({ error: `Percentages must sum to 100%. Got ${totalPercent}%` }, { status: 400 });
      }

      let sum = 0;
      splits.forEach((s) => {
        const share = Math.round((amount * s.value / 100) * 100) / 100;
        sum += share;
        computedSplits.push({ userId: s.userId, shareAmount: share });
      });

      let diff = Math.round((amount - sum) * 100) / 100;
      if (diff !== 0 && computedSplits.length > 0) {
        computedSplits[0].shareAmount = Math.round((computedSplits[0].shareAmount + diff) * 100) / 100;
      }

    } else if (splitType === 'amount' || splitType === 'itemized') {
      const totalSum = splits.reduce((sum, s) => sum + s.value, 0);
      if (Math.abs(totalSum - amount) > 0.05) {
        return NextResponse.json({ error: `Custom split amounts must sum to total amount. Total: ${amount}, Splitted: ${totalSum}` }, { status: 400 });
      }

      splits.forEach((s) => {
        computedSplits.push({ userId: s.userId, shareAmount: Math.round(s.value * 100) / 100 });
      });

    } else if (splitType === 'shares') {
      const totalShares = splits.reduce((sum, s) => sum + s.value, 0);
      if (totalShares <= 0) {
        return NextResponse.json({ error: 'Total shares must be greater than zero' }, { status: 400 });
      }

      let sum = 0;
      splits.forEach((s) => {
        const share = Math.floor((amount * s.value / totalShares) * 100) / 100;
        sum += share;
        computedSplits.push({ userId: s.userId, shareAmount: share });
      });

      let diff = Math.round((amount - sum) * 100) / 100;
      if (diff !== 0 && computedSplits.length > 0) {
        computedSplits[0].shareAmount = Math.round((computedSplits[0].shareAmount + diff) * 100) / 100;
      }
    }

    // Update Expense
    await db
      .update(expenses)
      .set({
        paidBy,
        description,
        amount,
        category,
        date,
      })
      .where(eq(expenses.id, expenseId));

    // Re-create splits: delete old, insert new
    await db.delete(expenseSplits).where(eq(expenseSplits.expenseId, expenseId));

    for (const split of computedSplits) {
      await db.insert(expenseSplits).values({
        id: crypto.randomUUID(),
        expenseId,
        userId: split.userId,
        shareAmount: split.shareAmount,
        splitType,
      });
    }

    return NextResponse.json({ success: true, message: 'Expense updated successfully' });

  } catch (error: any) {
    console.error('Update Expense Route Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: expenseId } = await params;

    // Fetch existing expense
    const existingExpense = await db.select().from(expenses).where(eq(expenses.id, expenseId)).limit(1);
    if (existingExpense.length === 0) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }
    const exp = existingExpense[0];

    // Check user membership and role
    const membership = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, exp.groupId), eq(groupMembers.userId, user.id)))
      .limit(1);

    if (membership.length === 0) {
      return NextResponse.json({ error: 'Forbidden. You are not in this group.' }, { status: 403 });
    }

    const userRole = membership[0].role;
    // Authorized if user is Admin OR user is the Payer
    const isAuthorized = userRole === 'admin' || exp.paidBy === user.id;
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden. Only the payer or group admin can delete this expense.' }, { status: 403 });
    }

    // Delete expense (foreign keys cascade will delete splits, but we delete them manually just in case)
    await db.delete(expenseSplits).where(eq(expenseSplits.expenseId, expenseId));
    await db.delete(expenses).where(eq(expenses.id, expenseId));

    return NextResponse.json({ success: true, message: 'Expense deleted successfully' });

  } catch (error: any) {
    console.error('Delete Expense Route Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
