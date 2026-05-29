export type CommitmentStatus = 'DRAFT' | 'LOCKED' | 'RECONCILING' | 'RECONCILED' | 'CARRIED_FORWARD';

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
}

export interface WeeklyCommitmentDraft {
  title: string;
  plannedValue: string;
  supportingOutcomeId: string;
  chessLayer: ChessLayer;
  dueDate: string;
}

export interface ReconciliationUpdate {
  commitmentId: string;
  actualValue: string;
  carryForward: boolean;
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
