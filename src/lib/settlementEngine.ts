export interface MemberBalance {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  netBalance: number;
}

export interface SuggestedTransaction {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
}

/**
 * Greedy Settlement Algorithm
 * Minimizes the number of transactions to settle all debts in a group.
 * 
 * Net balance represents:
 * - Positive (> 0): Creditor (should receive money)
 * - Negative (< 0): Debtor (should pay money)
 */
export function calculateSettlementSuggestions(
  members: { id: string; name: string; email: string; avatarUrl: string | null }[],
  balances: Record<string, number>
): SuggestedTransaction[] {
  // Map members to their current balance, rounding to 2 decimal places
  const memberBalances: MemberBalance[] = members.map((m) => ({
    userId: m.id,
    name: m.name,
    email: m.email,
    avatarUrl: m.avatarUrl,
    netBalance: Math.round((balances[m.id] || 0) * 100) / 100,
  }));

  // Separate debtors and creditors
  // We use a threshold of 0.01 to ignore negligible balances
  const debtors = memberBalances
    .filter((mb) => mb.netBalance < -0.01)
    .sort((a, b) => a.netBalance - b.netBalance); // most negative first (e.g., -50 before -20)

  const creditors = memberBalances
    .filter((mb) => mb.netBalance > 0.01)
    .sort((a, b) => b.netBalance - a.netBalance); // most positive first (e.g., +50 before +20)

  const suggestions: SuggestedTransaction[] = [];

  let dIdx = 0;
  let cIdx = 0;

  // Working copies of balances to mutate during the greedy process
  const workingDebtors = debtors.map((d) => ({ ...d, netBalance: Math.abs(d.netBalance) }));
  const workingCreditors = creditors.map((c) => ({ ...c }));

  while (dIdx < workingDebtors.length && cIdx < workingCreditors.length) {
    const debtor = workingDebtors[dIdx];
    const creditor = workingCreditors[cIdx];

    // Find the transaction amount
    const amount = Math.min(debtor.netBalance, creditor.netBalance);
    const roundedAmount = Math.round(amount * 100) / 100;

    if (roundedAmount > 0) {
      suggestions.push({
        fromUserId: debtor.userId,
        fromUserName: debtor.name,
        toUserId: creditor.userId,
        toUserName: creditor.name,
        amount: roundedAmount,
      });

      // Update balances
      debtor.netBalance -= roundedAmount;
      creditor.netBalance -= roundedAmount;
    }

    // Move indices if settled
    if (debtor.netBalance < 0.01) {
      dIdx++;
    }
    if (creditor.netBalance < 0.01) {
      cIdx++;
    }
  }

  return suggestions;
}
