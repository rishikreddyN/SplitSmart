import { NextResponse } from 'next/server';
import { db } from '@/db';
import { expenses, expenseSplits, groupMembers, users } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');

    if (!groupId) {
      return new Response('Group ID is required', { status: 400 });
    }

    // Check membership
    const membership = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)))
      .limit(1);

    if (membership.length === 0) {
      return new Response('Forbidden', { status: 403 });
    }

    // Fetch members
    const membersList = await db
      .select({
        id: users.id,
        name: users.name,
      })
      .from(groupMembers)
      .innerJoin(users, eq(groupMembers.userId, users.id))
      .where(eq(groupMembers.groupId, groupId));

    // Fetch expenses
    const groupExpenses = await db
      .select({
        id: expenses.id,
        paidBy: expenses.paidBy,
        description: expenses.description,
        amount: expenses.amount,
        category: expenses.category,
        date: expenses.date,
      })
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

    // Map member IDs to names
    const memberNameMap: Record<string, string> = {};
    membersList.forEach((m) => {
      memberNameMap[m.id] = m.name;
    });

    // Build CSV
    let csvContent = 'Date,Description,Category,Paid By,Total Amount';
    
    // Add columns for each member's share
    membersList.forEach((m) => {
      csvContent += `,Owed by ${m.name}`;
    });
    csvContent += '\n';

    groupExpenses.forEach((exp) => {
      const payerName = memberNameMap[exp.paidBy] || 'Unknown';
      const cleanDescription = exp.description.replace(/"/g, '""');
      
      let row = `${exp.date},"${cleanDescription}",${exp.category},"${payerName}",${exp.amount}`;

      // Append share for each member
      membersList.forEach((m) => {
        const split = allSplits.find((s) => s.expenseId === exp.id && s.userId === m.id);
        const share = split ? split.shareAmount : 0;
        row += `,${share}`;
      });

      csvContent += row + '\n';
    });

    // Return as downloadable file
    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="splitsmart_report_${groupId}.csv"`,
      },
    });

  } catch (error: any) {
    console.error('CSV Generation Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
