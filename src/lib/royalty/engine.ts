import type { ResolvedRow } from "../mapping/resolve";

export type BalanceStatus = "payable" | "carried_forward" | "not_yet_due";

export interface PublisherSettings {
  id: string;
  royaltyRate: number; // e.g. 0.10
  paymentBasis: "quarterly" | "annual";
  annualDueQuarter: number; // 1-4, only relevant when paymentBasis === 'annual'
  rollForward: boolean;
  payoutThreshold: number | null; // only relevant when rollForward === true
}

export interface QuarterRef {
  year: number;
  quarter: number; // 1-4
}

export interface PublisherBalanceResult {
  publisherId: string;
  grossRevenue: number; // all transactions this quarter, incl. non-royalty-applicable
  unitsSold: number;
  royaltyRate: number;
  royaltyAccrued: number; // this quarter's royalty-eligible accrual only
  carriedIn: number;
  carriedOut: number;
  amountPayable: number;
  status: BalanceStatus;
}

/**
 * Computes one publisher's balance for one quarter.
 *
 * - Non-royalty-applicable transactions (unofficial products) still count
 *   toward grossRevenue/unitsSold for analytics, but contribute 0 to
 *   royaltyAccrued.
 * - Annual-basis publishers accrue every quarter but show 0 payable and
 *   status "not_yet_due" until their annualDueQuarter, at which point the
 *   full year's carried-in accrual becomes the candidate payable amount.
 * - Roll-forward publishers only pay out once carriedIn + this quarter's
 *   accrual clears payoutThreshold; otherwise the whole balance carries
 *   forward (this composes with annual: a due-quarter annual true-up can
 *   itself still be held back by a threshold).
 */
export function computePublisherBalance(
  settings: PublisherSettings,
  quarter: QuarterRef,
  transactions: ResolvedRow[],
  carriedIn: number
): PublisherBalanceResult {
  const grossRevenue = round2(sum(transactions.map((t) => t.totalNet)));
  const unitsSold = sum(transactions.map((t) => t.unitsSold));
  const royaltyEligibleRevenue = sum(
    transactions.filter((t) => t.royaltyApplicable === true).map((t) => t.totalNet)
  );
  const royaltyAccrued = round2(royaltyEligibleRevenue * settings.royaltyRate);

  const isAnnualAccrualOnly =
    settings.paymentBasis === "annual" && quarter.quarter !== settings.annualDueQuarter;

  if (isAnnualAccrualOnly) {
    return {
      publisherId: settings.id,
      grossRevenue,
      unitsSold,
      royaltyRate: settings.royaltyRate,
      royaltyAccrued,
      carriedIn,
      carriedOut: round2(carriedIn + royaltyAccrued),
      amountPayable: 0,
      status: "not_yet_due",
    };
  }

  const candidateAmount = round2(carriedIn + royaltyAccrued);
  const belowThreshold =
    settings.rollForward &&
    settings.payoutThreshold != null &&
    candidateAmount < settings.payoutThreshold;

  if (belowThreshold) {
    return {
      publisherId: settings.id,
      grossRevenue,
      unitsSold,
      royaltyRate: settings.royaltyRate,
      royaltyAccrued,
      carriedIn,
      carriedOut: candidateAmount,
      amountPayable: 0,
      status: "carried_forward",
    };
  }

  return {
    publisherId: settings.id,
    grossRevenue,
    unitsSold,
    royaltyRate: settings.royaltyRate,
    royaltyAccrued,
    carriedIn,
    carriedOut: 0,
    amountPayable: candidateAmount,
    status: "payable",
  };
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
