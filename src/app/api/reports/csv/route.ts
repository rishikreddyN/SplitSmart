import { NextResponse } from 'next/server';
import { db } from '@/db';
import { expenses, expenseSplits, groupMembers, users, settlements } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { getSessionUser } from '@/lib/auth';

interface CsvRow {
  date: string;
  description: string;
  category: string;
  paidBy: string;
  amount: number;
  shares: Record<string, number>;
}

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

    // Fetch settlements
    const groupSettlements = await db
      .select({
        id: settlements.id,
        payerId: settlements.payerId,
        receiverId: settlements.receiverId,
        amount: settlements.amount,
        settledAt: settlements.settledAt,
      })
      .from(settlements)
      .where(eq(settlements.groupId, groupId));

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

    const rows: CsvRow[] = [];

    groupExpenses.forEach((exp) => {
      const payerName = memberNameMap[exp.paidBy] || 'Unknown';
      const shares: Record<string, number> = {};
      membersList.forEach((m) => {
        const split = allSplits.find((s) => s.expenseId === exp.id && s.userId === m.id);
        shares[m.id] = split ? split.shareAmount : 0;
      });
      rows.push({
        date: exp.date,
        description: exp.description,
        category: exp.category,
        paidBy: payerName,
        amount: exp.amount,
        shares,
      });
    });

    groupSettlements.forEach((set) => {
      const payerName = memberNameMap[set.payerId] || 'Unknown';
      const receiverName = memberNameMap[set.receiverId] || 'Unknown';
      const shares: Record<string, number> = {};
      membersList.forEach((m) => {
        shares[m.id] = 0;
      });
      rows.push({
        date: set.settledAt ? set.settledAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
        description: `Settlement: ${payerName} paid ${receiverName}`,
        category: 'Settlement',
        paidBy: payerName,
        amount: set.amount,
        shares,
      });
    });

    // Sort rows by date descending
    rows.sort((a, b) => b.date.localeCompare(a.date));

    // Append rows to CSV content
    rows.forEach((row) => {
      const cleanDescription = row.description.replace(/"/g, '""');
      let csvLine = `${row.date},"${cleanDescription}",${row.category},"${row.paidBy}",${row.amount}`;
      membersList.forEach((m) => {
        const share = row.shares[m.id] || 0;
        csvLine += `,${share}`;
      });
      csvContent += csvLine + '\n';
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
