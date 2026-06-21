# Product Requirement Document (PRD) - SplitSmart v2.0

## 1. Product Overview
**SplitSmart** is a modern, AI-powered group expense-sharing and debt-settlement platform designed for hostel residents, roommates, travelers, event organizers, and families. It automates receipt entry through AI, minimizes outstanding transactions via an intelligent settlement engine, supports advanced splitting methods, and provides rich spending analytics.

---

## 2. Target Audience
- **Roommates & PG Residents:** Managing recurring bills (rent, WiFi, utilities, groceries).
- **Travel Groups:** Tracking trip-related expenses with custom splits and budgets.
- **Event Organizers:** Organizing parties or get-togethers and dividing costs.
- **Families & Couples:** Sharing household expenses.

---

## 3. Product Goals & Success Metrics
### Primary Goals
- **Automate Expense Entry:** Leverage Gemini API to extract details from receipts.
- **Advanced Splitting:** Offer Equal, Percentage, Custom, Share-Based, and Itemized splits.
- **Intelligent Debt Settlement:** Minimize transactions needed to settle up.
- **Real-Time Balance Tracking:** Instantly update balances when expenses are added or settled.

### Success Metrics
- **Time to Value:** Users can create a group in under 3 minutes, and add an expense in under 2 minutes.
- **OCR Accuracy:** >90% extraction rate for clear receipt images.
- **Performance:** Settlement calculations under 100ms, dashboard load under 2 seconds.

---

## 4. User Roles & Permissions
- **Group Admin:**
  - Full CRUD control over the group, members, and expenses.
  - Archive/delete groups and invite members.
- **Group Member:**
  - View group details, balances, and history.
  - Add expenses and upload receipts.
  - View settle-up suggestions and record settlements.

---

## 5. Functional Modules

### Module 1: Authentication & User Profiles
- **Registration:** Name, email, and password (min 8 characters).
- **Login:** Secure JWT-based or session-based authentication with HTTP-only cookies.
- **Settings:** Profile edit, avatar upload, and notification preferences.

### Module 2: Group Management
- **Creation:** Set group name, description, and group type (Travel, Roommates, Family, Event, Other).
- **Invitations:** Create unique invite links and support direct email invites.
- **Dashboard:** Display total group expenses, user's net balance, members, recent activity, and quick settle-up actions.

### Module 3: Expense Management & Splitting Engine
- **Add Expense:** Description, amount, category, date, payer, split type, and optional receipt upload.
- **Expense Categories:** Food, Travel, Accommodation, Utilities, Shopping, Entertainment, Groceries, Other.
- **Splitting Strategies:**
  1. **Equal Split:** Divides the amount equally among all/selected members.
  2. **Percentage Split:** Assigns custom percentage shares (must sum to 100%).
  3. **Custom Amount Split:** Assigns specific dollar/rupee amounts to each member (must sum to total).
  4. **Share-Based Split:** Assigns numeric shares (proportional distribution).
  5. **Itemized Split:** Individual items (e.g., Pizza, Drink) assigned to specific users; tax/tip distributed proportionally.

### Module 4: Balance & Smart Settlement Engine
- **Real-Time Balances:** Track net balance = `Amount Paid - Amount Owed`.
- **Greedy Settlement Algorithm:**
  - Uses min-heap and max-heap structure to settle the largest debtors with the largest creditors first.
  - Minimizes the total number of transactions.
  - Example: Settle a 4-person group with 3 transactions instead of 6.

### Module 5: AI-Powered Receipt Scanner
- **OCR Workflow:** User uploads an image (JPG, PNG, JPEG) or PDF.
- **Gemini API Integration:** Extracts store name, transaction date, line items with prices, tax, and total.
- **Structured JSON output:** Returns data for review before the user saves the expense.

### Module 6: Analytics & Reports
- **Visual Analytics:** Categorized expenses (Pie chart), spending over time (Bar/Line chart), and member contributions.
- **Export Formats:** CSV (expense list, member summary) and PDF (full group summary report).

### Module 7: Recurring Expenses & Trip Mode
- **Recurring Bills:** Daily, weekly, or monthly subscription/utility auto-generation.
- **Trip Mode:** Tracks a trip budget, budget utilization bar, and a chronological daily timeline of expenses.

### Module 8: Notifications
- **In-App Notification Center:** Alert users of new expenses, updates, and settlement confirmation.

---

## 6. Database Schema (Draft)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  name VARCHAR NOT NULL,
  email VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR NOT NULL,
  avatar_url VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE groups (
  id UUID PRIMARY KEY,
  name VARCHAR NOT NULL,
  description TEXT,
  type VARCHAR NOT NULL, -- 'travel', 'roommates', etc.
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE group_members (
  id UUID PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR NOT NULL, -- 'admin', 'member'
  joined_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE expenses (
  id UUID PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  paid_by UUID REFERENCES users(id),
  description VARCHAR NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  category VARCHAR NOT NULL,
  receipt_url VARCHAR,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE expense_splits (
  id UUID PRIMARY KEY,
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  share_amount DECIMAL(12,2) NOT NULL,
  split_type VARCHAR NOT NULL -- 'equal', 'percent', 'amount', 'shares', 'itemized'
);

CREATE TABLE settlements (
  id UUID PRIMARY KEY,
  payer_id UUID REFERENCES users(id),
  receiver_id UUID REFERENCES users(id),
  amount DECIMAL(12,2) NOT NULL,
  status VARCHAR NOT NULL, -- 'pending', 'completed'
  settled_at TIMESTAMP
);

CREATE TABLE recurring_expenses (
  id UUID PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  title VARCHAR NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  frequency VARCHAR NOT NULL, -- 'daily', 'weekly', 'monthly'
  next_due_date DATE NOT NULL
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 7. API Architecture

### Authentication
- `POST /api/auth/register` - Create user
- `POST /api/auth/login` - Authenticate & set session cookie
- `POST /api/auth/logout` - Clear session cookie

### Groups
- `POST /api/groups` - Create new group
- `GET /api/groups` - List user groups
- `GET /api/groups/:id` - Fetch group details, members, balances, and suggestions
- `PUT /api/groups/:id` - Update group details
- `DELETE /api/groups/:id` - Archive/Delete group

### Members
- `POST /api/groups/:id/invite` - Generate invitation link or email
- `POST /api/groups/join` - Join group via link code
- `DELETE /api/groups/:id/members/:userId` - Remove member (Admin only)

### Expenses
- `POST /api/expenses` - Create expense (triggers split logic & updates balances)
- `PUT /api/expenses/:id` - Edit expense (re-computes balances)
- `DELETE /api/expenses/:id` - Delete expense (re-computes balances)

### Settlements
- `POST /api/settlements` - Record a payment between members

### Receipt AI
- `POST /api/ocr/scan` - Process receipt image & return JSON layout
