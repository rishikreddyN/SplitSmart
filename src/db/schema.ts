import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const groups = sqliteTable('groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull(), // 'travel', 'roommates', 'family', 'event', 'other'
  createdBy: text('created_by').references(() => users.id, { onDelete: 'cascade' }),
  tripBudget: real('trip_budget').default(0), // for Trip Mode budget utilization
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const groupMembers = sqliteTable('group_members', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'admin', 'member'
  joinedAt: text('joined_at').default(sql`CURRENT_TIMESTAMP`),
});

export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  paidBy: text('paid_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  amount: real('amount').notNull(),
  category: text('category').notNull(), // 'food', 'travel', 'accommodation', etc.
  receiptUrl: text('receipt_url'),
  date: text('date').notNull(), // YYYY-MM-DD
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const expenseSplits = sqliteTable('expense_splits', {
  id: text('id').primaryKey(),
  expenseId: text('expense_id').notNull().references(() => expenses.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  shareAmount: real('share_amount').notNull(),
  splitType: text('split_type').notNull(), // 'equal', 'percent', 'amount', 'shares', 'itemized'
});

export const settlements = sqliteTable('settlements', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  payerId: text('payer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  receiverId: text('receiver_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  amount: real('amount').notNull(),
  status: text('status').notNull(), // 'pending', 'completed'
  settledAt: text('settled_at'),
});

export const recurringExpenses = sqliteTable('recurring_expenses', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  amount: real('amount').notNull(),
  frequency: text('frequency').notNull(), // 'daily', 'weekly', 'monthly'
  category: text('category').notNull(),
  nextDueDate: text('next_due_date').notNull(), // YYYY-MM-DD
});

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  message: text('message').notNull(),
  isRead: integer('is_read').default(0).notNull(), // 0 = unread, 1 = read
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});
