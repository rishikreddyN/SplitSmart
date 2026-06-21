import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { db } from '@/db';
import { groupMembers, notifications } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: groupId, memberId } = await params;

    // Check if the current user is an Admin of the group
    const currentUserMembership = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)))
      .limit(1);

    if (currentUserMembership.length === 0 || currentUserMembership[0].role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden. Admin role required.' }, { status: 403 });
    }

    // Verify member exists in this group
    const targetMember = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, memberId)))
      .limit(1);

    if (targetMember.length === 0) {
      return NextResponse.json({ error: 'Member not found in this group' }, { status: 404 });
    }

    // Prevent removing the sole admin of the group
    if (targetMember[0].role === 'admin') {
      const adminCountResult = await db
        .select()
        .from(groupMembers)
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.role, 'admin')));

      if (adminCountResult.length <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove the last remaining administrator from the group.' },
          { status: 400 }
        );
      }
    }

    // Delete membership
    await db
      .delete(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, memberId)));

    // Notify the removed user
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      userId: memberId,
      message: `You were removed from the group by the administrator.`,
    }).catch(err => console.error("Notification creation failed:", err));

    return NextResponse.json({ success: true, message: 'Member removed successfully' });

  } catch (error: any) {
    console.error('Remove Member Route Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
