export type CommitmentStatus =
  | 'DRAFT'
  | 'LOCKED'
  | 'APPROVED'
  | 'NEEDS_REVISION'
  | 'RECONCILING'
  | 'RECONCILED'
  | 'CARRIED_FORWARD';

export type ChessLayer =
  | 'KING'
  | 'QUEEN'
  | 'ROOK'
  | 'BISHOP'
  | 'KNIGHT'
  | 'PAWN';

export type CommitmentRisk = 'ON_TRACK' | 'AT_RISK' | 'BLOCKED';

export interface RcdoLink {
  rallyCry: string;
  definingObjective: string;
  supportingOutcomeId: string;
  supportingOutcome: string;
}

export interface WeeklyCommitment {
  id: string;
  ownerName: string;
  title: string;
  plannedValue: string;
  actualValue?: string;
  status: CommitmentStatus;
  chessLayer: ChessLayer;
  rcdo: RcdoLink;
  dueDate: string;
  risk: CommitmentRisk;
  managerReview?: ManagerReview;
  weeksCarried?: number;
  originWeekStart?: string;
  outcomeDeprioritized?: boolean;
  outcomeStatusNote?: string;
  auditEvents?: CommitmentAuditEvent[];
}

export interface WeeklyCommitmentDraft {
  ownerName?: string;
  title: string;
  plannedValue: string;
  supportingOutcomeId: string;
  chessLayer: ChessLayer;
  dueDate: string;
  risk: CommitmentRisk;
}

export interface WeeklyCommitmentUpdate extends WeeklyCommitmentDraft {
  commitmentId: string;
}

export interface ReconciliationUpdate {
  commitmentId: string;
  actualValue: string;
  carryForward: boolean;
}

export type ManagerReviewDecision =
  | 'APPROVED'
  | 'NEEDS_OWNER_UPDATE'
  | 'ESCALATED';

export interface ManagerReview {
  decision: ManagerReviewDecision;
  note: string;
  reviewedAt: string;
}

export interface CommitmentAuditEvent {
  id: string;
  actorName: string;
  fromStatus?: CommitmentStatus;
  toStatus: CommitmentStatus;
  changedFields: string;
  occurredAt: string;
}

export interface ManagerReviewUpdate {
  commitmentId: string;
  decision: ManagerReviewDecision;
  note: string;
}

export interface WeeklyCommitmentWeek {
  weekStart: string;
  state: CommitmentStatus;
  commitments: WeeklyCommitment[];
}

export interface ManagerCommitmentPage {
  content: WeeklyCommitment[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
