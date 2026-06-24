import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

// POST /api/reset - Wipe all data from the database
export async function POST() {
  try {
    // Use raw SQL TRUNCATE to wipe all tables in cascade order
    await db.execute(sql`TRUNCATE TABLE notifications, settlements, expense_splits, expenses, recurring_expenses, group_members, groups, users CASCADE`);

    return NextResponse.json({ 
      success: true, 
      message: 'All data has been wiped. App is fresh.' 
    });
  } catch (error: any) {
    console.error('Reset Error:', error);
    return NextResponse.json({ error: error.message || 'Reset failed' }, { status: 500 });
  }
}
