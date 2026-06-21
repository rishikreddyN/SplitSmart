import { NextResponse } from 'next/server';
import { db } from '@/db';
import { settlements, groupMembers, notifications, users } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getSessionUser } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { groupId, payerId, receiverId, amount: rawAmount, status } = await request.json();

    if (!groupId || !payerId || !receiverId || !rawAmount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const amount = parseFloat(rawAmount.toString());
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
    }

    // Verify current user belongs to group
    const userMembership = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)))
      .limit(1);

    if (userMembership.length === 0) {
      return NextResponse.json({ error: 'Forbidden. You are not in this group.' }, { status: 403 });
    }

    // Verify payer belongs to group
    const payerMembership = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, payerId)))
      .limit(1);

    // Verify receiver belongs to group
    const receiverMembership = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, receiverId)))
      .limit(1);

    if (payerMembership.length === 0 || receiverMembership.length === 0) {
      return NextResponse.json({ error: 'Payer and Receiver must be members of the group' }, { status: 400 });
    }

    // Record settlement
    const settlementId = crypto.randomUUID();
    await db.insert(settlements).values({
      id: settlementId,
      groupId,
      payerId,
      receiverId,
      amount,
      status: status || 'completed',
      settledAt: new Date().toISOString(),
    });

    // Fetch names
    const payerNameResult = await db.select({ name: users.name }).from(users).where(eq(users.id, payerId)).limit(1);
    const payerName = payerNameResult[0]?.name || 'Someone';

    const receiverNameResult = await db.select({ name: users.name }).from(users).where(eq(users.id, receiverId)).limit(1);
    const receiverName = receiverNameResult[0]?.name || 'Someone';

    // Notify receiver
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      userId: receiverId,
      message: `${payerName} recorded a settlement of ₹${amount} paid to you.`,
    }).catch(err => console.error("Notification creation failed:", err));

    // Notify payer if recorded by someone else
    if (user.id !== payerId) {
      await db.insert(notifications).values({
        id: crypto.randomUUID(),
        userId: payerId,
        message: `${user.name} recorded a settlement of ₹${amount} paid by you to ${receiverName}.`,
      }).catch(err => console.error("Notification creation failed:", err));
    }

    return NextResponse.json({
      success: true,
      settlementId,
      message: 'Settlement recorded successfully',
    }, { status: 201 });

  } catch (error: any) {
    console.error('Record Settlement Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
