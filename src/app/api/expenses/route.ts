import { NextResponse } from 'next/server';
import { db } from '@/db';
import { expenses, expenseSplits, groupMembers, notifications, users } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getSessionUser } from '@/lib/auth';

interface SplitInput {
  userId: string;
  value: number; // percentage, custom amount, shares, or itemized price
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      groupId,
      description,
      amount: rawAmount,
      category,
      date,
      paidBy,
      splitType,
      splits,
    } = await request.json() as {
      groupId: string;
      description: string;
      amount: number;
      category: string;
      date: string;
      paidBy: string;
      splitType: 'equal' | 'percent' | 'amount' | 'shares' | 'itemized';
      splits: SplitInput[];
    };

    // Validation
    if (!groupId || !description || !rawAmount || !category || !date || !paidBy || !splitType || !splits || splits.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const amount = parseFloat(rawAmount.toString());
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
    }

    // Verify payer and current user belong to the group
    const payerMembership = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, paidBy)))
      .limit(1);

    if (payerMembership.length === 0) {
      return NextResponse.json({ error: 'Payer must be a group member' }, { status: 400 });
    }

    const userMembership = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)))
      .limit(1);

    if (userMembership.length === 0) {
      return NextResponse.json({ error: 'Forbidden. You are not in this group.' }, { status: 403 });
    }

    // Calculate share amounts based on splitType
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

      // Adjust rounding discrepancy
      let diff = Math.round((amount - sum) * 100) / 100;
      if (diff !== 0 && computedSplits.length > 0) {
        computedSplits[0].shareAmount = Math.round((computedSplits[0].shareAmount + diff) * 100) / 100;
      }

    } else if (splitType === 'amount' || splitType === 'itemized') {
      const totalSum = splits.reduce((sum, s) => sum + s.value, 0);
      if (Math.abs(totalSum - amount) > 0.05) {
        return NextResponse.json({ error: `Custom split amounts must sum to the total expense amount. Total: ${amount}, Splitted: ${totalSum}` }, { status: 400 });
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

      // Adjust rounding discrepancy
      let diff = Math.round((amount - sum) * 100) / 100;
      if (diff !== 0 && computedSplits.length > 0) {
        computedSplits[0].shareAmount = Math.round((computedSplits[0].shareAmount + diff) * 100) / 100;
      }
    }

    // Insert Expense
    const expenseId = crypto.randomUUID();
    await db.insert(expenses).values({
      id: expenseId,
      groupId,
      paidBy,
      description,
      amount,
      category,
      date,
    });

    // Insert Expense Splits
    for (const split of computedSplits) {
      await db.insert(expenseSplits).values({
        id: crypto.randomUUID(),
        expenseId,
        userId: split.userId,
        shareAmount: split.shareAmount,
        splitType,
      });
    }

    // Fetch payer name
    const payerNameResult = await db.select({ name: users.name }).from(users).where(eq(users.id, paidBy)).limit(1);
    const payerName = payerNameResult[0]?.name || 'Someone';

    // Notify other group members
    const otherMembers = await db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id))); // notify others

    const allGroupMembers = await db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId));

    for (const m of allGroupMembers) {
      if (m.userId !== user.id) {
        await db.insert(notifications).values({
          id: crypto.randomUUID(),
          userId: m.userId,
          message: `${payerName} added "${description}" of ₹${amount} in your group.`,
        }).catch(err => console.error("Notification failed:", err));
      }
    }

    return NextResponse.json({
      success: true,
      expenseId,
      message: 'Expense added successfully',
    }, { status: 201 });

  } catch (error: any) {
    console.error('Create Expense Route Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
