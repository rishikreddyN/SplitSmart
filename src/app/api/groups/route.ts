import { NextResponse } from 'next/server';
import { db } from '@/db';
import { groups, groupMembers, users, expenses } from '@/db/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import { getSessionUser } from '@/lib/auth';

// GET /api/groups - Get all groups for the logged-in user
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find group IDs the user belongs to
    const userGroups = await db
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .where(eq(groupMembers.userId, user.id));

    if (userGroups.length === 0) {
      return NextResponse.json({ groups: [] });
    }

    const groupIds = userGroups.map((g) => g.groupId);

    // Fetch details of those groups
    const groupList = await db
      .select()
      .from(groups)
      .where(inArray(groups.id, groupIds));

    // For each group, calculate total expenses and count members
    const result = await Promise.all(
      groupList.map(async (group) => {
        // Count members
        const membersCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(groupMembers)
          .where(eq(groupMembers.groupId, group.id));

        // Sum expenses
        const expenseSum = await db
          .select({ sum: sql<number>`sum(${expenses.amount})` })
          .from(expenses)
          .where(eq(expenses.groupId, group.id));

        return {
          ...group,
          memberCount: membersCount[0]?.count || 0,
          totalExpenses: expenseSum[0]?.sum || 0,
        };
      })
    );

    return NextResponse.json({ groups: result });

  } catch (error: any) {
    console.error('Fetch Groups Route Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/groups - Create a new group
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, description, type, tripBudget } = await request.json();

    if (!name || !type) {
      return NextResponse.json({ error: 'Name and Type are required' }, { status: 400 });
    }

    const groupId = crypto.randomUUID();
    const parsedBudget = tripBudget ? parseFloat(tripBudget) : 0;

    // Insert group
    await db.insert(groups).values({
      id: groupId,
      name,
      description: description || '',
      type,
      createdBy: user.id,
      tripBudget: isNaN(parsedBudget) ? 0 : parsedBudget,
    });

    // Add creator as Admin
    await db.insert(groupMembers).values({
      id: crypto.randomUUID(),
      groupId,
      userId: user.id,
      role: 'admin',
    });

    // Record notification
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      userId: user.id,
      message: `You created group "${name}".`,
    }).catch(err => console.error("Notification creation failed:", err));

    return NextResponse.json({
      group: {
        id: groupId,
        name,
        description,
        type,
        tripBudget: parsedBudget,
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('Create Group Route Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Import notifications schema inside the code to make notifications writing successful
import { notifications } from '@/db/schema';
