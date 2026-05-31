export type CommitmentStatus =
  | 'DRAFT'
  | 'LOCKED'
  | 'APPROVED'
  | 'NEEDS_REVISION'
  | 'RECONCILING'
  | 'RECONCILED'
  | 'CARRIED_FORWARD';

export type ChessLayer = 'KING' | 'QUEEN' | 'ROOK' | 'BISHOP' | 'KNIGHT' | 'PAWN';

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
  confidence: number;
  managerReview?: ManagerReview;
}

export interface WeeklyCommitmentDraft {
  ownerName?: string;
  title: string;
  plannedValue: string;
  supportingOutcomeId: string;
  chessLayer: ChessLayer;
  dueDate: string;
}

export interface WeeklyCommitmentUpdate extends WeeklyCommitmentDraft {
  commitmentId: string;
}

export interface ReconciliationUpdate {
  commitmentId: string;
  actualValue: string;
  carryForward: boolean;
}

export type ManagerReviewDecision = 'APPROVED' | 'NEEDS_OWNER_UPDATE' | 'ESCALATED';

export interface ManagerReview {
  decision: ManagerReviewDecision;
  note: string;
  reviewedAt: string;
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
