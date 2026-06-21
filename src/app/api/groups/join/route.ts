import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { db } from '@/db';
import { groups, groupMembers, notifications } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code } = await request.json();
    if (!code) {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
    }

    // Check if group exists
    const groupResult = await db.select().from(groups).where(eq(groups.id, code)).limit(1);
    if (groupResult.length === 0) {
      return NextResponse.json({ error: 'Invalid invite code. Group not found.' }, { status: 404 });
    }
    const group = groupResult[0];

    // Check if user is already a member
    const existingMembership = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, code), eq(groupMembers.userId, user.id)))
      .limit(1);

    if (existingMembership.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'You are already a member of this group.',
        groupId: code,
      });
    }

    // Add user as a member
    await db.insert(groupMembers).values({
      id: crypto.randomUUID(),
      groupId: code,
      userId: user.id,
      role: 'member',
    });

    // Notify the user
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      userId: user.id,
      message: `You joined the group "${group.name}".`,
    }).catch(err => console.error("Notification creation failed:", err));

    return NextResponse.json({
      success: true,
      message: 'Joined group successfully!',
      groupId: code,
    });

  } catch (error: any) {
    console.error('Join Group Route Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
