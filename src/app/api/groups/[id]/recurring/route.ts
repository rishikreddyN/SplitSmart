import { NextResponse } from 'next/server';
import { db } from '@/db';
import { recurringExpenses, groupMembers } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getSessionUser } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: groupId } = await params;

    // Check membership
    const membership = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)))
      .limit(1);

    if (membership.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { title, amount: rawAmount, frequency, category, nextDueDate } = await request.json();

    if (!title || !rawAmount || !frequency || !category || !nextDueDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const amount = parseFloat(rawAmount.toString());
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
    }

    if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
      return NextResponse.json({ error: 'Frequency must be daily, weekly, or monthly' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    await db.insert(recurringExpenses).values({
      id,
      groupId,
      title,
      amount,
      frequency,
      category,
      nextDueDate,
    });

    return NextResponse.json({
      success: true,
      recurringExpenseId: id,
      message: 'Recurring expense set up successfully',
    }, { status: 201 });

  } catch (error: any) {
    console.error('Create Recurring Expense Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
