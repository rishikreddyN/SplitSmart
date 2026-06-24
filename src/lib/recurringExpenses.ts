import { db } from '@/db';
import { recurringExpenses, expenses, expenseSplits, groupMembers, groups } from '@/db/schema';
import { eq, and, lte } from 'drizzle-orm';

/**
 * Checks and processes all due recurring expenses for a group.
 * Generates actual expenses and updates the next due date.
 */
export async function processDueRecurringExpenses(groupId: string) {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // Find all recurring expenses in the group that are due (nextDueDate <= today)
    const dueRecurring = await db
      .select()
      .from(recurringExpenses)
      .where(and(eq(recurringExpenses.groupId, groupId), lte(recurringExpenses.nextDueDate, todayStr)));

    if (dueRecurring.length === 0) return;

    // Fetch group members to split the cost
    const members = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId));

    if (members.length === 0) return;

    // Fetch group creator/admin to default as paidBy if not specified
    const groupData = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
    const defaultPayerId = groupData[0]?.createdBy || members[0].userId;

    for (const rec of dueRecurring) {
      let currentDueDate = new Date(rec.nextDueDate);
      const today = new Date(todayStr);

      // In case multiple cycles have passed, create an expense for each cycle
      while (currentDueDate <= today) {
        const dateStr = currentDueDate.toISOString().split('T')[0];

        // 3. Compute the NEXT due date FIRST
        let nextDate = new Date(currentDueDate);
        if (rec.frequency === 'daily') {
          nextDate.setDate(nextDate.getDate() + 1);
        } else if (rec.frequency === 'weekly') {
          nextDate.setDate(nextDate.getDate() + 7);
        } else if (rec.frequency === 'monthly') {
          nextDate.setMonth(nextDate.getMonth() + 1);
        } else {
          // Prevent infinite loop if invalid frequency
          break;
        }

        // 4. Advance the nextDueDate in DB BEFORE inserting the expense.
        //    This acts as an atomic guard — if this request races with another,
        //    the second fetch won't see this cycle as due anymore.
        const nextDateStr = nextDate.toISOString().split('T')[0];
        await db
          .update(recurringExpenses)
          .set({ nextDueDate: nextDateStr })
          .where(
            and(
              eq(recurringExpenses.id, rec.id),
              // Only update if nextDueDate still matches what we selected — prevents double-fire
              eq(recurringExpenses.nextDueDate, rec.nextDueDate)
            )
          );

        const newExpenseId = crypto.randomUUID();

        // 1. Create the expense
        await db.insert(expenses).values({
          id: newExpenseId,
          groupId,
          paidBy: defaultPayerId,
          description: `[Recurring] ${rec.title}`,
          amount: rec.amount,
          category: rec.category,
          date: dateStr,
        });

        // 2. Create equal splits for all members
        const count = members.length;
        const baseShare = Math.floor((rec.amount / count) * 100) / 100;
        const sum = baseShare * count;
        const diff = Math.round((rec.amount - sum) * 100) / 100;

        for (let idx = 0; idx < members.length; idx++) {
          const m = members[idx];
          let share = baseShare;
          if (idx === 0) {
            share = Math.round((share + diff) * 100) / 100;
          }

          await db.insert(expenseSplits).values({
            id: crypto.randomUUID(),
            expenseId: newExpenseId,
            userId: m.userId,
            shareAmount: share,
            splitType: 'equal',
          });
        }

        currentDueDate = nextDate;
      }
    }
  } catch (error) {
    console.error('Error processing recurring expenses:', error);
  }
}
