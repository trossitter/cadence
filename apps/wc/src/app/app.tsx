import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Select,
  Spinner,
  Textarea,
  TextInput,
} from 'flowbite-react';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  Edit3,
  GitBranch,
  Gauge,
  Layers3,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import {
  useCreateCommitmentMutation,
  useGetCurrentWeekQuery,
  useGetManagerDashboardQuery,
  useLockCurrentWeekMutation,
  useReviewCommitmentMutation,
  useUpdateCommitmentMutation,
  useUpdateReconciliationMutation,
} from './api/cadence-api';
import type {
  ChessLayer,
  CommitmentAuditEvent,
  CommitmentRisk,
  CommitmentStatus,
  ManagerReviewDecision,
  RcdoLink,
  ReconciliationUpdate,
  WeeklyCommitment,
  WeeklyCommitmentDraft,
  WeeklyCommitmentWeek,
} from './types';

type WorkspaceMode = 'contributor' | 'director';

type DemoStageId =
  | 'live'
  | 'planning'
  | 'locking'
  | 'execution'
  | 'reconciliation'
  | 'review';

type DemoProjectionStageId = Exclude<DemoStageId, 'live'>;

type CommitmentFormState = Omit<WeeklyCommitmentDraft, 'ownerName'> & {
  ownerName: string;
};

type ReconciliationDraft = Pick<
  ReconciliationUpdate,
  'actualValue' | 'carryForward'
>;

type ReviewDraft = {
  decision: ManagerReviewDecision;
  note: string;
};

type Notice = {
  color: 'success' | 'warning' | 'info';
  message: string;
};

type DemoStage = {
  id: DemoStageId;
  label: string;
  phase: string;
  hint: string;
  state: CommitmentStatus;
  description: string;
};

type OwnerRollup = {
  ownerName: string;
  total: number;
  locked: number;
  reconciled: number;
  atRisk: number;
  openCount: number;
  openItems: Array<Pick<WeeklyCommitment, 'chessLayer' | 'id' | 'title'>>;
};

const statusColor: Record<CommitmentStatus, string> = {
  DRAFT: 'gray',
  LOCKED: 'info',
  APPROVED: 'success',
  NEEDS_REVISION: 'failure',
  RECONCILING: 'warning',
  RECONCILED: 'success',
  CARRIED_FORWARD: 'purple',
};

const reviewLabel: Record<ManagerReviewDecision, string> = {
  APPROVED: 'Approved',
  NEEDS_OWNER_UPDATE: 'Needs owner update',
  ESCALATED: 'Escalated',
};

const chessLayers: ChessLayer[] = [
  'KING',
  'QUEEN',
  'ROOK',
  'BISHOP',
  'KNIGHT',
  'PAWN',
];

const riskOptions: CommitmentRisk[] = ['ON_TRACK', 'AT_RISK', 'BLOCKED'];

const ownerOptions = [
  'Mira Petrova',
  'Nikolay Ivanov',
  'Tara Singh',
  'Avery Chen',
];

const capacityOpenItemThreshold = 6;

const demoStages: DemoStage[] = [
  {
    id: 'live',
    label: 'Live',
    phase: 'Current',
    hint: 'Actual',
    state: 'DRAFT',
    description: 'Current data and local edits',
  },
  {
    id: 'planning',
    label: 'Plan',
    phase: 'Day 1',
    hint: 'Typical Mon',
    state: 'DRAFT',
    description:
      'Owners draft commitments against RCDO outcomes on the first working planning window',
  },
  {
    id: 'locking',
    label: 'Lock',
    phase: 'Day 2',
    hint: 'Typical Tue',
    state: 'LOCKED',
    description:
      'The week locks after the planning window, adjusted for holidays or short weeks',
  },
  {
    id: 'execution',
    label: 'Execute',
    phase: 'Day 3',
    hint: 'Typical Wed',
    state: 'APPROVED',
    description: 'Execution pressure exposes risk and revision needs',
  },
  {
    id: 'reconciliation',
    label: 'Reconcile',
    phase: 'Day 4',
    hint: 'Typical Thu',
    state: 'RECONCILING',
    description: 'Owners compare planned value against actual proof',
  },
  {
    id: 'review',
    label: 'Review',
    phase: 'Day 5',
    hint: 'Typical Fri',
    state: 'RECONCILED',
    description: 'Directors approve, escalate, or carry work forward',
  },
];

const demoCommitmentStatuses: Record<
  DemoProjectionStageId,
  CommitmentStatus[]
> = {
  planning: ['DRAFT', 'DRAFT', 'DRAFT'],
  locking: ['LOCKED', 'LOCKED', 'LOCKED'],
  execution: ['APPROVED', 'LOCKED', 'NEEDS_REVISION'],
  reconciliation: ['RECONCILING', 'RECONCILING', 'LOCKED'],
  review: ['RECONCILED', 'RECONCILED', 'CARRIED_FORWARD'],
};

const demoRisk: Record<DemoProjectionStageId, CommitmentRisk[]> = {
  planning: ['ON_TRACK', 'ON_TRACK', 'AT_RISK'],
  locking: ['ON_TRACK', 'ON_TRACK', 'AT_RISK'],
  execution: ['ON_TRACK', 'AT_RISK', 'BLOCKED'],
  reconciliation: ['ON_TRACK', 'AT_RISK', 'BLOCKED'],
  review: ['ON_TRACK', 'ON_TRACK', 'BLOCKED'],
};

const demoActualValues: Record<
  DemoProjectionStageId,
  Array<string | undefined>
> = {
  planning: [undefined, undefined, undefined],
  locking: [undefined, undefined, undefined],
  execution: [
    'Pre-read outline is ready; financial appendix is in progress',
    undefined,
    undefined,
  ],
  reconciliation: [
    'Draft pack is ready; dependency notes need director review',
    '18 of 21 overdue hiring actions reconciled',
    'Launch risk remains open for data import validation',
  ],
  review: [
    'Portfolio review pack shipped before Friday director review',
    'All critical hiring actions assigned to named owners',
    'Data import validation carried into next week with owner and mitigation',
  ],
};

const demoManagerReviews: Record<
  DemoProjectionStageId,
  Array<WeeklyCommitment['managerReview']>
> = {
  planning: [undefined, undefined, undefined],
  locking: [undefined, undefined, undefined],
  execution: [
    {
      decision: 'APPROVED',
      note: 'Aligned to the operating velocity outcome.',
      reviewedAt: '2026-06-03T16:00:00.000Z',
    },
    undefined,
    {
      decision: 'NEEDS_OWNER_UPDATE',
      note: 'Narrow the blocker and name the escalation path.',
      reviewedAt: '2026-06-03T16:20:00.000Z',
    },
  ],
  reconciliation: [
    {
      decision: 'APPROVED',
      note: 'Ready for final reconciliation.',
      reviewedAt: '2026-06-04T15:45:00.000Z',
    },
    undefined,
    {
      decision: 'ESCALATED',
      note: 'Director support needed before next weekly lock.',
      reviewedAt: '2026-06-04T16:10:00.000Z',
    },
  ],
  review: [
    {
      decision: 'APPROVED',
      note: 'Business impact landed inside the week.',
      reviewedAt: '2026-06-05T17:00:00.000Z',
    },
    {
      decision: 'APPROVED',
      note: 'Hiring accountability is visible for the next planning window.',
      reviewedAt: '2026-06-05T17:15:00.000Z',
    },
    {
      decision: 'ESCALATED',
      note: 'Carry-forward scoped for the next working day with a named owner.',
      reviewedAt: '2026-06-05T17:30:00.000Z',
    },
  ],
};

const sampleOutcomeIds = {
  executionSignals: '11111111-1111-4111-8111-111111111111',
  hiringPlans: '22222222-2222-4222-8222-222222222222',
  launchQuality: '33333333-3333-4333-8333-333333333333',
};

const outcomeOptions: RcdoLink[] = [
  {
    rallyCry: 'Raise portfolio operating velocity',
    definingObjective: 'Standardize weekly execution signals',
    supportingOutcomeId: sampleOutcomeIds.executionSignals,
    supportingOutcome: 'Every priority commitment maps to an RCDO outcome',
  },
  {
    rallyCry: 'Build leadership bench strength',
    definingObjective: 'Improve hiring execution quality',
    supportingOutcomeId: sampleOutcomeIds.hiringPlans,
    supportingOutcome: 'Critical hiring plans are visible weekly',
  },
  {
    rallyCry: 'Ship dependable customer moments',
    definingObjective: 'Tighten launch quality gates',
    supportingOutcomeId: sampleOutcomeIds.launchQuality,
    supportingOutcome: 'Launch blockers have an accountable owner by Friday',
  },
];

function sampleAuditEvents(
  commitmentId: string,
  actorName: string,
  statuses: CommitmentStatus[],
): CommitmentAuditEvent[] {
  return statuses.map((status, index) => ({
    id: `${commitmentId}-event-${index + 1}`,
    actorName,
    fromStatus: index === 0 ? undefined : statuses[index - 1],
    toStatus: status,
    changedFields: JSON.stringify({
      status: [index === 0 ? null : statuses[index - 1], status],
    }),
    occurredAt: `2026-06-0${Math.min(index + 1, 5)}T14:00:00.000Z`,
  }));
}

const sampleCommitments: WeeklyCommitment[] = [
  {
    id: 'sample-1',
    ownerName: 'Mira Petrova',
    title: 'Prepare Q2 operating partner cadence review',
    plannedValue: 'Portfolio review pack ready for IC pre-read',
    actualValue: 'Draft pack is ready; dependency notes need director review',
    status: 'LOCKED',
    chessLayer: 'QUEEN',
    dueDate: '2026-06-05',
    risk: 'ON_TRACK',
    rcdo: outcomeOptions[0],
    weeksCarried: 0,
    originWeekStart: '2026-06-01',
    auditEvents: sampleAuditEvents('sample-1', 'Mira Petrova', [
      'DRAFT',
      'LOCKED',
    ]),
    managerReview: {
      decision: 'APPROVED',
      note: 'Strong enough for Friday review.',
      reviewedAt: '2026-05-30T14:15:00.000Z',
    },
  },
  {
    id: 'sample-2',
    ownerName: 'Nikolay Ivanov',
    title: 'Reconcile weekly hiring commitments',
    plannedValue: 'All overdue actions assigned to an accountable owner',
    actualValue: '18 of 21 reconciled',
    status: 'RECONCILING',
    chessLayer: 'ROOK',
    dueDate: '2026-06-05',
    risk: 'AT_RISK',
    rcdo: outcomeOptions[1],
    weeksCarried: 0,
    originWeekStart: '2026-06-01',
    auditEvents: sampleAuditEvents('sample-2', 'Nikolay Ivanov', [
      'DRAFT',
      'LOCKED',
      'RECONCILING',
    ]),
  },
  {
    id: 'sample-3',
    ownerName: 'Tara Singh',
    title: 'Close launch quality gates for onboarding refresh',
    plannedValue: 'Open launch risks are named with owner and mitigation',
    status: 'DRAFT',
    chessLayer: 'BISHOP',
    dueDate: '2026-06-04',
    risk: 'BLOCKED',
    rcdo: outcomeOptions[2],
    weeksCarried: 2,
    originWeekStart: '2026-05-18',
    outcomeDeprioritized: true,
    outcomeStatusNote: 'Supporting outcome archived after commitment lock',
    auditEvents: sampleAuditEvents('sample-3', 'Tara Singh', [
      'DRAFT',
      'LOCKED',
      'NEEDS_REVISION',
      'DRAFT',
    ]),
  },
];

const sampleWeek: WeeklyCommitmentWeek = {
  weekStart: '2026-06-01',
  state: 'DRAFT',
  commitments: sampleCommitments,
};

const defaultFormState: CommitmentFormState = {
  ownerName: ownerOptions[0],
  title: '',
  plannedValue: '',
  supportingOutcomeId: sampleOutcomeIds.executionSignals,
  chessLayer: 'KNIGHT',
  dueDate: '2026-06-05',
  risk: 'ON_TRACK',
};

function St6Wordmark() {
  return (
    <div className="st6-wordmark cadence-display" aria-label="ST6">
      <span className="st6-wordmark-text">ST</span>
      <span className="st6-wordmark-accent" aria-hidden="true" />
      <span className="st6-wordmark-six">6</span>
    </div>
  );
}

function demoStageById(stageId: DemoStageId) {
  return demoStages.find((stage) => stage.id === stageId) ?? demoStages[0];
}

function isDemoProjectionStageId(
  stageId: DemoStageId,
): stageId is DemoProjectionStageId {
  return stageId !== 'live';
}

function projectWeekForDemoStage(
  week: WeeklyCommitmentWeek,
  stageId: DemoStageId,
): WeeklyCommitmentWeek {
  const stage = demoStageById(stageId);

  if (!isDemoProjectionStageId(stage.id)) {
    return week;
  }

  const commitments =
    week.commitments.length > 0 ? week.commitments : sampleCommitments;
  const projectionStageId = stage.id;

  return {
    ...week,
    state: stage.state,
    commitments: commitments.map((commitment, index) =>
      projectCommitmentForDemoStage(commitment, index, projectionStageId),
    ),
  };
}

function projectCommitmentForDemoStage(
  commitment: WeeklyCommitment,
  index: number,
  stageId: DemoProjectionStageId,
): WeeklyCommitment {
  const status =
    demoCommitmentStatuses[stageId][
      index % demoCommitmentStatuses[stageId].length
    ];
  const risk = demoRisk[stageId][index % demoRisk[stageId].length];
  const actualValue =
    demoActualValues[stageId][index % demoActualValues[stageId].length];
  const managerReview =
    demoManagerReviews[stageId][index % demoManagerReviews[stageId].length];
  const weeksCarried =
    stageId === 'review' && index % 3 === 2
      ? 3
      : (commitment.weeksCarried ?? 0);
  const outcomeDeprioritized =
    stageId === 'review' && index % 3 === 2
      ? true
      : commitment.outcomeDeprioritized;

  return {
    ...commitment,
    actualValue,
    auditEvents: demoTimelineFor(commitment, stageId, status),
    managerReview,
    originWeekStart:
      weeksCarried > 0
        ? '2026-05-18'
        : (commitment.originWeekStart ?? '2026-06-01'),
    status,
    risk,
    weeksCarried,
    outcomeDeprioritized,
    outcomeStatusNote: outcomeDeprioritized
      ? (commitment.outcomeStatusNote ??
        'Supporting outcome archived after commitment lock')
      : commitment.outcomeStatusNote,
  };
}

function demoTimelineFor(
  commitment: WeeklyCommitment,
  stageId: DemoProjectionStageId,
  finalStatus: CommitmentStatus,
): CommitmentAuditEvent[] {
  const statusesByStage: Record<DemoProjectionStageId, CommitmentStatus[]> = {
    planning: ['DRAFT'],
    locking: ['DRAFT', 'LOCKED'],
    execution: ['DRAFT', 'LOCKED', finalStatus],
    reconciliation: ['DRAFT', 'LOCKED', 'APPROVED', 'RECONCILING'],
    review: ['DRAFT', 'LOCKED', 'APPROVED', 'RECONCILING', finalStatus],
  };

  return statusesByStage[stageId].map((status, index, statuses) => ({
    id: `${commitment.id}-${stageId}-event-${index + 1}`,
    actorName: index > 1 ? 'Rhea Patel' : commitment.ownerName,
    fromStatus: index === 0 ? undefined : statuses[index - 1],
    toStatus: status,
    changedFields: JSON.stringify({
      status: [index === 0 ? null : statuses[index - 1], status],
    }),
    occurredAt: `2026-06-0${Math.min(index + 1, 5)}T15:00:00.000Z`,
  }));
}

export function App() {
  const { data, isFetching, isError, refetch } = useGetCurrentWeekQuery();
  const { data: managerPage, isError: isManagerError } =
    useGetManagerDashboardQuery({ page: 0, size: 20 });
  const [createCommitment, createState] = useCreateCommitmentMutation();
  const [updateCommitment, updateState] = useUpdateCommitmentMutation();
  const [updateReconciliation, reconciliationState] =
    useUpdateReconciliationMutation();
  const [reviewCommitment, reviewState] = useReviewCommitmentMutation();
  const [lockCurrentWeek, lockState] = useLockCurrentWeekMutation();
  const [workspaceWeek, setWorkspaceWeek] =
    useState<WeeklyCommitmentWeek>(sampleWeek);
  const [mode, setMode] = useState<WorkspaceMode>('contributor');
  const [formState, setFormState] =
    useState<CommitmentFormState>(defaultFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reconciliationDrafts, setReconciliationDrafts] = useState<
    Record<string, ReconciliationDraft>
  >({});
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>(
    {},
  );
  const [notice, setNotice] = useState<Notice | null>(null);
  const [demoStage, setDemoStage] = useState<DemoStageId>('planning');
  const [timelineCommitmentId, setTimelineCommitmentId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (data) {
      setWorkspaceWeek(data);
    }
  }, [data]);

  useEffect(() => {
    if (!data && managerPage?.content.length) {
      setWorkspaceWeek((current) => ({
        ...current,
        commitments: managerPage.content,
      }));
    }
  }, [data, managerPage]);

  const displayWeek = useMemo(
    () => projectWeekForDemoStage(workspaceWeek, demoStage),
    [demoStage, workspaceWeek],
  );
  const commitments = displayWeek.commitments;
  const weekState = displayWeek.state;
  const teamTotal =
    demoStage === 'live'
      ? (managerPage?.totalElements ?? commitments.length)
      : commitments.length;
  const isWriting =
    createState.isLoading ||
    updateState.isLoading ||
    reconciliationState.isLoading ||
    reviewState.isLoading ||
    lockState.isLoading;

  const summary = useMemo(() => {
    const reconciled = commitments.filter(
      (commitment) =>
        commitment.status === 'RECONCILED' ||
        commitment.status === 'CARRIED_FORWARD',
    ).length;
    const atRisk = commitments.filter(
      (commitment) =>
        commitment.risk !== 'ON_TRACK' && !isTerminalStatus(commitment.status),
    ).length;
    const reviewed = commitments.filter(
      (commitment) => commitment.managerReview,
    ).length;

    return {
      reconciled,
      atRisk,
      reviewed,
      carryForward: commitments.filter(
        (commitment) => commitment.status === 'CARRIED_FORWARD',
      ).length,
    };
  }, [commitments]);

  const ownerRollup = useMemo(
    () =>
      ownerOptions
        .map((ownerName) => {
          const ownedCommitments = commitments.filter(
            (commitment) => commitment.ownerName === ownerName,
          );
          const openItems = ownedCommitments.filter(
            (commitment) => !isTerminalStatus(commitment.status),
          );

          return {
            ownerName,
            total: ownedCommitments.length,
            locked: ownedCommitments.filter(
              (commitment) => commitment.status === 'LOCKED',
            ).length,
            reconciled: ownedCommitments.filter(
              (commitment) =>
                commitment.status === 'RECONCILED' ||
                commitment.status === 'CARRIED_FORWARD',
            ).length,
            atRisk: ownedCommitments.filter(
              (commitment) => commitment.risk !== 'ON_TRACK',
            ).length,
            openCount: openItems.length,
            openItems: openItems.map((commitment) => ({
              chessLayer: commitment.chessLayer,
              id: commitment.id,
              title: commitment.title,
            })),
          };
        })
        .filter((rollup) => rollup.total > 0),
    [commitments],
  );

  const stuckCommitments = useMemo(
    () =>
      [...commitments]
        .filter((commitment) => carriedWeeks(commitment) >= 2)
        .sort((left, right) => carriedWeeks(right) - carriedWeeks(left)),
    [commitments],
  );

  const overloadedOwners = useMemo(
    () =>
      ownerRollup.filter(
        (rollup) => rollup.openCount > capacityOpenItemThreshold,
      ),
    [ownerRollup],
  );

  const deprioritizedCommitments = useMemo(
    () => commitments.filter((commitment) => commitment.outcomeDeprioritized),
    [commitments],
  );

  const timelineCommitment = useMemo(
    () =>
      commitments.find((commitment) => commitment.id === timelineCommitmentId),
    [commitments, timelineCommitmentId],
  );

  async function submitCommitment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formState.title.trim() || !formState.plannedValue.trim()) {
      return;
    }

    setDemoStage('live');

    const payload: WeeklyCommitmentDraft = {
      ...formState,
      title: formState.title.trim(),
      plannedValue: formState.plannedValue.trim(),
    };

    if (editingId) {
      const existingCommitment = commitments.find(
        (commitment) => commitment.id === editingId,
      );

      if (!existingCommitment) {
        return;
      }

      try {
        const savedCommitment = await updateCommitment({
          commitmentId: editingId,
          ...payload,
        }).unwrap();
        mergeCommitment(savedCommitment);
        setNotice({
          color: 'success',
          message: 'Commitment updated in Cadence.',
        });
      } catch {
        mergeCommitment(commitmentFromDraft(payload, existingCommitment));
        setNotice({
          color: 'warning',
          message:
            'Commitment updated in the alpha workspace while the remote edit endpoint is unavailable.',
        });
      }
    } else {
      try {
        const savedCommitment = await createCommitment(payload).unwrap();
        mergeCommitment(savedCommitment);
        setNotice({
          color: 'success',
          message: 'Commitment created in Cadence.',
        });
      } catch {
        mergeCommitment(commitmentFromDraft(payload));
        setNotice({
          color: 'warning',
          message:
            'Commitment created in the alpha workspace while the Cadence API is unavailable.',
        });
      }
    }

    resetForm();
  }

  async function saveReconciliation(commitment: WeeklyCommitment) {
    setDemoStage('live');

    const draft = reconciliationDraftFor(commitment);
    const payload: ReconciliationUpdate = {
      commitmentId: commitment.id,
      actualValue: draft.actualValue.trim(),
      carryForward: draft.carryForward,
    };

    try {
      const savedCommitment = await updateReconciliation(payload).unwrap();
      mergeCommitment(savedCommitment);
      setNotice({
        color: 'success',
        message: 'Reconciliation saved in Cadence.',
      });
    } catch {
      mergeCommitment({
        ...commitment,
        actualValue: payload.actualValue,
        status: payload.carryForward ? 'CARRIED_FORWARD' : 'RECONCILED',
      });
      setNotice({
        color: 'warning',
        message:
          'Reconciliation saved in the alpha workspace while the remote lifecycle endpoint is unavailable.',
      });
    }
  }

  async function recordReview(commitment: WeeklyCommitment) {
    setDemoStage('live');

    const draft = reviewDraftFor(commitment);

    try {
      const savedCommitment = await reviewCommitment({
        commitmentId: commitment.id,
        decision: draft.decision,
        note: draft.note.trim(),
      }).unwrap();
      mergeCommitment(savedCommitment);
      setNotice({
        color: 'success',
        message: 'Manager review saved in Cadence.',
      });
    } catch {
      mergeCommitment({
        ...commitment,
        managerReview: {
          decision: draft.decision,
          note: draft.note.trim(),
          reviewedAt: new Date().toISOString(),
        },
      });
      setNotice({
        color: 'warning',
        message:
          'Manager review saved in the alpha workspace while the remote review endpoint is unavailable.',
      });
    }
  }

  async function lockWeek() {
    setDemoStage('live');

    try {
      const nextWeek = await lockCurrentWeek().unwrap();
      setWorkspaceWeek(nextWeek);
      setNotice({ color: 'success', message: 'Week locked in Cadence.' });
    } catch {
      setWorkspaceWeek((current) => ({
        ...current,
        state: 'LOCKED',
        commitments: current.commitments.map((commitment) =>
          commitment.status === 'DRAFT'
            ? { ...commitment, status: 'LOCKED' }
            : commitment,
        ),
      }));
      setNotice({
        color: 'warning',
        message:
          'Week locked in the alpha workspace while the remote lock endpoint is unavailable.',
      });
    }
  }

  function mergeCommitment(commitment: WeeklyCommitment) {
    setWorkspaceWeek((current) => {
      const exists = current.commitments.some(
        (existingCommitment) => existingCommitment.id === commitment.id,
      );

      return {
        ...current,
        commitments: exists
          ? current.commitments.map((existingCommitment) =>
              existingCommitment.id === commitment.id
                ? commitment
                : existingCommitment,
            )
          : [commitment, ...current.commitments],
      };
    });
  }

  function startEdit(commitment: WeeklyCommitment) {
    setDemoStage('live');
    setEditingId(commitment.id);
    setFormState({
      ownerName: commitment.ownerName,
      title: commitment.title,
      plannedValue: commitment.plannedValue,
      supportingOutcomeId: commitment.rcdo.supportingOutcomeId,
      chessLayer: commitment.chessLayer,
      dueDate: commitment.dueDate,
      risk: commitment.risk,
    });
    setMode('contributor');
  }

  function resetForm() {
    setEditingId(null);
    setFormState(defaultFormState);
  }

  function updateReconciliationDraft(
    commitmentId: string,
    patch: Partial<ReconciliationDraft>,
  ) {
    setReconciliationDrafts((current) => ({
      ...current,
      [commitmentId]: {
        actualValue: current[commitmentId]?.actualValue ?? '',
        carryForward: current[commitmentId]?.carryForward ?? false,
        ...patch,
      },
    }));
  }

  function updateReviewDraft(
    commitmentId: string,
    patch: Partial<ReviewDraft>,
  ) {
    setReviewDrafts((current) => ({
      ...current,
      [commitmentId]: {
        decision: current[commitmentId]?.decision ?? 'APPROVED',
        note: current[commitmentId]?.note ?? '',
        ...patch,
      },
    }));
  }

  function reconciliationDraftFor(
    commitment: WeeklyCommitment,
  ): ReconciliationDraft {
    return (
      reconciliationDrafts[commitment.id] ?? {
        actualValue: commitment.actualValue ?? '',
        carryForward: commitment.status === 'CARRIED_FORWARD',
      }
    );
  }

  function reviewDraftFor(commitment: WeeklyCommitment): ReviewDraft {
    return (
      reviewDrafts[commitment.id] ?? {
        decision: commitment.managerReview?.decision ?? 'APPROVED',
        note: commitment.managerReview?.note ?? '',
      }
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f5f1] text-slate-950">
      <header className="border-b border-[#2d3944] bg-[#101820]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <St6Wordmark />
            <div>
              <p className="cadence-display text-sm font-black uppercase text-[#f6c044]">
                Cadence
              </p>
              <p className="text-sm font-medium text-[#b8c4d4]">
                Weekly execution tied to RCDO
              </p>
            </div>
          </div>
          <p className="text-right text-xs font-semibold uppercase text-[#8191a5]">
            Designed by Thalia
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-lg border border-[#202b35] bg-white shadow-sm shadow-black/10">
          <div className="h-1 bg-[linear-gradient(90deg,#d71920_0%,#d71920_48%,#f6c044_48%,#f6c044_62%,#6f86a7_62%,#6f86a7_100%)]" />
          <div className="flex flex-wrap items-start justify-between gap-5 bg-[#121c24] p-5 text-white">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2">
                <span className="cadence-display text-sm font-black uppercase tracking-wide text-[#f6c044]">
                  This week
                </span>
                <span className="rounded-full border border-[#324250] bg-[#0d151c] px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[#c2ccd8]">
                  {formatStatus(weekState)}
                </span>
              </div>
              <h1 className="cadence-display mt-1 text-3xl font-bold leading-tight text-white sm:text-4xl">
                Week of{' '}
                {new Date(
                  `${displayWeek.weekStart}T00:00:00`,
                ).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                })}
              </h1>
              <p className="mt-2 text-sm font-medium text-[#c2ccd8]">
                {commitments.length} commitments · {summary.reviewed} reviewed ·{' '}
                {summary.carryForward} carried
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div
                className="flex overflow-hidden rounded-lg border border-[#324250] bg-[#0d151c] p-1"
                role="group"
                aria-label="Workspace view"
              >
                <button
                  type="button"
                  aria-pressed={mode === 'contributor'}
                  className={`min-h-9 rounded-md px-3 text-sm font-semibold ${
                    mode === 'contributor'
                      ? 'bg-[#d71920] text-white shadow-sm'
                      : 'text-[#c7d2df] hover:text-white'
                  }`}
                  onClick={() => setMode('contributor')}
                >
                  Contributor
                </button>
                <button
                  type="button"
                  aria-pressed={mode === 'director'}
                  className={`min-h-9 rounded-md px-3 text-sm font-semibold ${
                    mode === 'director'
                      ? 'bg-[#f6c044] text-[#101820] shadow-sm'
                      : 'text-[#c7d2df] hover:text-white'
                  }`}
                  onClick={() => setMode('director')}
                >
                  Director
                </button>
              </div>
              <StatusBadge status={weekState} />
            </div>
          </div>

          <div className="grid gap-0 border-t border-[#27333d] bg-[#f8f8f4] sm:grid-cols-4">
            <Metric
              icon={<CalendarDays size={18} />}
              label="Week state"
              value={formatStatus(weekState)}
            />
            <Metric
              icon={<GitBranch size={18} />}
              label="Team records"
              value={String(teamTotal)}
            />
            <Metric
              icon={<CheckCircle2 size={18} />}
              label="Reconciled"
              value={`${summary.reconciled}/${commitments.length}`}
            />
            <Metric
              icon={<ShieldCheck size={18} />}
              label="Director reviewed"
              value={String(summary.reviewed)}
            />
          </div>
          <DemoWeekRail
            selectedStage={demoStage}
            onSelectStage={setDemoStage}
          />
        </section>

        {notice ? <Alert color={notice.color}>{notice.message}</Alert> : null}

        {isError || isManagerError ? (
          <Alert color="warning">
            Cadence API is unavailable; the alpha workspace is using
            fixture-backed writes.
          </Alert>
        ) : null}

        {mode === 'contributor' ? (
          <ContributorWorkspace
            commitments={commitments}
            editingId={editingId}
            formState={formState}
            isWriting={isWriting}
            onCancelEdit={resetForm}
            onFormChange={(patch) =>
              setFormState((current) => ({ ...current, ...patch }))
            }
            onSaveReconciliation={(commitment) =>
              void saveReconciliation(commitment)
            }
            onSubmit={submitCommitment}
            reconciliationDraftFor={reconciliationDraftFor}
            updateReconciliationDraft={updateReconciliationDraft}
          />
        ) : (
          <>
            <ExceptionDigest
              deprioritizedCommitments={deprioritizedCommitments}
              overloadedOwners={overloadedOwners}
              stuckCommitments={stuckCommitments}
              onOpenTimeline={(commitment) =>
                setTimelineCommitmentId(commitment.id)
              }
            />
            <DirectorWorkspace
              commitments={commitments}
              isWriting={isWriting}
              lockWeek={() => void lockWeek()}
              ownerRollup={ownerRollup}
              recordReview={(commitment) => void recordReview(commitment)}
              reviewDraftFor={reviewDraftFor}
              summary={summary}
              updateReviewDraft={updateReviewDraft}
            />
          </>
        )}

        <CommitmentTable
          commitments={commitments}
          isFetching={isFetching}
          onOpenTimeline={(commitment) =>
            setTimelineCommitmentId(commitment.id)
          }
          onEdit={startEdit}
          onRefetch={() => void refetch()}
        />
      </main>
      {timelineCommitment ? (
        <AuditTimelineDrawer
          commitment={timelineCommitment}
          onClose={() => setTimelineCommitmentId(null)}
        />
      ) : null}
    </div>
  );
}

function ContributorWorkspace({
  commitments,
  editingId,
  formState,
  isWriting,
  onCancelEdit,
  onFormChange,
  onSaveReconciliation,
  onSubmit,
  reconciliationDraftFor,
  updateReconciliationDraft,
}: {
  commitments: WeeklyCommitment[];
  editingId: string | null;
  formState: CommitmentFormState;
  isWriting: boolean;
  onCancelEdit: () => void;
  onFormChange: (patch: Partial<CommitmentFormState>) => void;
  onSaveReconciliation: (commitment: WeeklyCommitment) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  reconciliationDraftFor: (commitment: WeeklyCommitment) => ReconciliationDraft;
  updateReconciliationDraft: (
    commitmentId: string,
    patch: Partial<ReconciliationDraft>,
  ) => void;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
      <form
        className="rounded-lg border border-[#ccd3d8] bg-white p-5 shadow-sm shadow-black/5"
        onSubmit={onSubmit}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="cadence-display text-lg font-black uppercase text-[#101820]">
            {editingId ? 'Edit commitment' : 'Create commitment'}
          </h2>
          {editingId ? (
            <Button
              color="light"
              size="xs"
              type="button"
              onClick={onCancelEdit}
            >
              Cancel
            </Button>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Owner" htmlFor="commitment-owner">
            <Select
              id="commitment-owner"
              aria-label="Owner"
              value={formState.ownerName}
              onChange={(event) =>
                onFormChange({ ownerName: event.target.value })
              }
            >
              {ownerOptions.map((ownerName) => (
                <option key={ownerName} value={ownerName}>
                  {ownerName}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Due date" htmlFor="commitment-due-date">
            <TextInput
              id="commitment-due-date"
              aria-label="Due date"
              type="date"
              value={formState.dueDate}
              onChange={(event) =>
                onFormChange({ dueDate: event.target.value })
              }
            />
          </Field>

          <Field label="Commitment title" htmlFor="commitment-title">
            <TextInput
              id="commitment-title"
              aria-label="Commitment title"
              placeholder="Name the weekly promise"
              value={formState.title}
              onChange={(event) => onFormChange({ title: event.target.value })}
            />
          </Field>

          <Field label="Chess layer" htmlFor="commitment-chess-layer">
            <Select
              id="commitment-chess-layer"
              aria-label="Chess layer"
              value={formState.chessLayer}
              onChange={(event) =>
                onFormChange({ chessLayer: event.target.value as ChessLayer })
              }
            >
              {chessLayers.map((layer) => (
                <option key={layer} value={layer}>
                  {layer}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Risk" htmlFor="commitment-risk">
            <Select
              id="commitment-risk"
              aria-label="Risk"
              value={formState.risk}
              onChange={(event) =>
                onFormChange({ risk: event.target.value as CommitmentRisk })
              }
            >
              {riskOptions.map((risk) => (
                <option key={risk} value={risk}>
                  {formatRisk(risk)}
                </option>
              ))}
            </Select>
          </Field>

          <div className="sm:col-span-2">
            <Field
              label="Supporting outcome"
              htmlFor="commitment-supporting-outcome"
            >
              <Select
                id="commitment-supporting-outcome"
                aria-label="Supporting outcome"
                value={formState.supportingOutcomeId}
                onChange={(event) =>
                  onFormChange({ supportingOutcomeId: event.target.value })
                }
              >
                {outcomeOptions.map((outcome) => (
                  <option
                    key={outcome.supportingOutcomeId}
                    value={outcome.supportingOutcomeId}
                  >
                    {outcome.supportingOutcome}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Planned value" htmlFor="commitment-planned-value">
              <Textarea
                id="commitment-planned-value"
                aria-label="Planned value"
                rows={4}
                placeholder="Concrete value that should exist by the due date"
                value={formState.plannedValue}
                onChange={(event) =>
                  onFormChange({ plannedValue: event.target.value })
                }
              />
            </Field>
          </div>
        </div>

        <Button
          className="mt-4 w-full bg-[#d71920] font-semibold enabled:hover:bg-[#b6151b] focus:ring-[#f6c044]"
          type="submit"
          disabled={isWriting}
        >
          {editingId ? (
            <Save className="mr-2 h-4 w-4" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          {editingId ? 'Save commitment' : 'Add commitment'}
        </Button>
      </form>

      <section className="rounded-lg border border-[#ccd3d8] bg-white shadow-sm shadow-black/5">
        <div className="flex items-center justify-between gap-3 border-b border-[#d8dde1] px-5 py-4">
          <div>
            <h2 className="cadence-display text-lg font-black uppercase text-[#101820]">
              Reconciliation queue
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Actual value and next-week carry decisions
            </p>
          </div>
          <ClipboardCheck className="h-5 w-5 text-[#d71920]" />
        </div>
        <div className="divide-y divide-[#d8dde1] px-5">
          {commitments.map((commitment) => {
            const draft = reconciliationDraftFor(commitment);

            return (
              <div
                key={commitment.id}
                className="grid gap-3 py-4 lg:grid-cols-[1fr_1fr_auto]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-950">
                      {commitment.title}
                    </p>
                    <StatusBadge status={commitment.status} />
                    <RiskChip risk={commitment.risk} />
                    <CarryChip commitment={commitment} />
                    <OutcomeChip commitment={commitment} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {commitment.ownerName}
                  </p>
                </div>
                <Textarea
                  aria-label={`Actual value for ${commitment.title}`}
                  rows={2}
                  value={draft.actualValue}
                  onChange={(event) =>
                    updateReconciliationDraft(commitment.id, {
                      actualValue: event.target.value,
                      carryForward: draft.carryForward,
                    })
                  }
                />
                <div className="flex min-w-36 flex-col justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <Checkbox
                      aria-label={`Carry forward ${commitment.title}`}
                      checked={draft.carryForward}
                      onChange={(event) =>
                        updateReconciliationDraft(commitment.id, {
                          actualValue: draft.actualValue,
                          carryForward: event.target.checked,
                        })
                      }
                    />
                    Carry forward
                  </label>
                  <Button
                    aria-label={`Save reconciliation for ${commitment.title}`}
                    className="bg-[#101820] enabled:hover:bg-[#26333d] focus:ring-[#f6c044]"
                    size="xs"
                    type="button"
                    disabled={isWriting}
                    onClick={() => onSaveReconciliation(commitment)}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </section>
  );
}

function DemoWeekRail({
  onSelectStage,
  selectedStage,
}: {
  onSelectStage: (stage: DemoStageId) => void;
  selectedStage: DemoStageId;
}) {
  const selected = demoStageById(selectedStage);

  return (
    <div className="border-t border-[#d8dde1] bg-white px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[#667789]">
            <CalendarDays className="h-4 w-4 text-[#d71920]" />
            <p className="text-sm font-semibold uppercase">Week walkthrough</p>
          </div>
          <p className="mt-1 text-sm font-medium text-[#101820]">
            {selected.description}
          </p>
        </div>
        <div
          className="grid gap-2 sm:grid-cols-3 lg:min-w-[620px] lg:grid-cols-6"
          role="group"
          aria-label="Demo week day"
        >
          {demoStages.map((stage) => {
            const isSelected = stage.id === selectedStage;

            return (
              <button
                key={stage.id}
                type="button"
                aria-pressed={isSelected}
                className={`min-h-16 rounded-lg border px-3 py-2 text-left transition ${
                  isSelected
                    ? 'border-[#101820] bg-[#101820] text-white shadow-sm'
                    : 'border-[#d8dde1] bg-[#f8f8f4] text-[#344452] hover:border-[#d71920]'
                }`}
                onClick={() => onSelectStage(stage.id)}
              >
                <span className="cadence-display block text-lg font-black uppercase leading-none">
                  {stage.label}
                </span>
                <span
                  className={`mt-1 block text-xs font-semibold ${isSelected ? 'text-[#f6c044]' : 'text-[#667789]'}`}
                >
                  {stage.phase}
                </span>
                <span
                  className={`mt-1 block text-xs ${isSelected ? 'text-[#d8dde1]' : 'text-[#8a98a8]'}`}
                >
                  {stage.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ExceptionDigest({
  deprioritizedCommitments,
  onOpenTimeline,
  overloadedOwners,
  stuckCommitments,
}: {
  deprioritizedCommitments: WeeklyCommitment[];
  onOpenTimeline: (commitment: WeeklyCommitment) => void;
  overloadedOwners: OwnerRollup[];
  stuckCommitments: WeeklyCommitment[];
}) {
  return (
    <section className="rounded-lg border border-[#ccd3d8] bg-white shadow-sm shadow-black/5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d8dde1] px-5 py-4">
        <div>
          <h2 className="cadence-display text-lg font-black uppercase text-[#101820]">
            Weekly exception digest
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Manager-only signals that 15Five cannot connect
          </p>
        </div>
        <Gauge className="h-5 w-5 text-[#d71920]" />
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-3">
        <div>
          <h3 className="text-sm font-semibold text-[#101820]">Stuck work</h3>
          {stuckCommitments.length ? (
            <div className="mt-3 space-y-3">
              {stuckCommitments.slice(0, 3).map((commitment) => (
                <div
                  key={commitment.id}
                  className="rounded-lg border border-[#d8dde1] bg-[#f8f8f4] p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-950">
                      {commitment.title}
                    </p>
                    <CarryChip commitment={commitment} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {commitment.ownerName} · Origin{' '}
                    {commitment.originWeekStart ?? 'unknown'}
                  </p>
                  {auditEventsFor(commitment).length > 1 ? (
                    <button
                      type="button"
                      className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#d71920]"
                      onClick={() => onOpenTimeline(commitment)}
                    >
                      <Clock3 className="h-4 w-4" />
                      View timeline
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              No chronic carry-forward commitments this week.
            </p>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[#101820]">
            Capacity risk
          </h3>
          {overloadedOwners.length ? (
            <div className="mt-3 space-y-3">
              {overloadedOwners.map((owner) => (
                <CapacityMeter key={owner.ownerName} rollup={owner} />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              No owner is over the {capacityOpenItemThreshold}-item load flag.
            </p>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[#101820]">
            Strategic drift
          </h3>
          {deprioritizedCommitments.length ? (
            <div className="mt-3 space-y-3">
              {deprioritizedCommitments.slice(0, 3).map((commitment) => (
                <div
                  key={commitment.id}
                  className="rounded-lg border border-[#d8dde1] bg-[#f8f8f4] p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-950">
                      {commitment.title}
                    </p>
                    <OutcomeChip commitment={commitment} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {commitment.ownerName} -{' '}
                    {commitment.outcomeStatusNote ?? 'Outcome no longer active'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              No commitments point at archived RCDO outcomes.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function CapacityMeter({ rollup }: { rollup: OwnerRollup }) {
  const loadPercent = Math.min(
    100,
    Math.round((rollup.openCount / capacityOpenItemThreshold) * 100),
  );
  const barColor =
    rollup.openCount > capacityOpenItemThreshold + 2
      ? 'bg-[#d71920]'
      : rollup.openCount > capacityOpenItemThreshold
        ? 'bg-[#f6c044]'
        : 'bg-[#6f86a7]';

  return (
    <div className="rounded-lg border border-[#d8dde1] bg-[#f8f8f4] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-slate-950">{rollup.ownerName}</p>
        <span className="text-sm font-semibold text-[#344452]">
          {rollup.openCount}/{capacityOpenItemThreshold} open
        </span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-[#d8dde1]">
        <div
          className={`h-2 rounded-full ${barColor}`}
          style={{ width: `${loadPercent}%` }}
        />
      </div>
      {rollup.openItems.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {rollup.openItems.slice(0, 4).map((item) => (
            <span
              key={item.id}
              className="rounded border border-[#ccd3d8] bg-white px-2 py-0.5 text-xs text-[#344452]"
            >
              {item.chessLayer}
            </span>
          ))}
          {rollup.openItems.length > 4 ? (
            <span className="rounded border border-[#ccd3d8] bg-white px-2 py-0.5 text-xs text-[#344452]">
              +{rollup.openItems.length - 4}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DirectorWorkspace({
  commitments,
  isWriting,
  lockWeek,
  ownerRollup,
  recordReview,
  reviewDraftFor,
  summary,
  updateReviewDraft,
}: {
  commitments: WeeklyCommitment[];
  isWriting: boolean;
  lockWeek: () => void;
  ownerRollup: OwnerRollup[];
  recordReview: (commitment: WeeklyCommitment) => void;
  reviewDraftFor: (commitment: WeeklyCommitment) => ReviewDraft;
  summary: {
    reconciled: number;
    atRisk: number;
    reviewed: number;
    carryForward: number;
  };
  updateReviewDraft: (
    commitmentId: string,
    patch: Partial<ReviewDraft>,
  ) => void;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
      <section className="rounded-lg border border-[#ccd3d8] bg-white shadow-sm shadow-black/5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d8dde1] px-5 py-4">
          <div>
            <h2 className="cadence-display text-lg font-black uppercase text-[#101820]">
              Team roll-up
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Owner coverage, risk, and reconciliation progress
            </p>
          </div>
          <Button
            className="bg-[#d71920] font-semibold enabled:hover:bg-[#b6151b] focus:ring-[#f6c044]"
            size="xs"
            type="button"
            disabled={isWriting}
            onClick={lockWeek}
          >
            <Send className="mr-2 h-4 w-4" />
            Lock week
          </Button>
        </div>

        <div className="grid gap-4 px-5 py-4 sm:grid-cols-3">
          <Metric
            icon={<Users size={18} />}
            label="At risk"
            value={String(summary.atRisk)}
          />
          <Metric
            icon={<Layers3 size={18} />}
            label="Carry forward"
            value={String(summary.carryForward)}
          />
          <Metric
            icon={<ShieldCheck size={18} />}
            label="Reviewed"
            value={String(summary.reviewed)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f8f8f4] text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Owner</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Locked</th>
                <th className="px-5 py-3">Reconciled</th>
                <th className="px-5 py-3">Risk</th>
                <th className="px-5 py-3">Open load</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d8dde1]">
              {ownerRollup.map((rollup) => (
                <tr key={rollup.ownerName}>
                  <td className="whitespace-nowrap px-5 py-3 font-medium text-slate-950">
                    {rollup.ownerName}
                  </td>
                  <td className="px-5 py-3">{rollup.total}</td>
                  <td className="px-5 py-3">{rollup.locked}</td>
                  <td className="px-5 py-3">{rollup.reconciled}</td>
                  <td className="px-5 py-3">{rollup.atRisk}</td>
                  <td className="min-w-48 px-5 py-3">
                    <CapacityMeter rollup={rollup} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-[#ccd3d8] bg-white shadow-sm shadow-black/5">
        <div className="flex items-center justify-between gap-3 border-b border-[#d8dde1] px-5 py-4">
          <div>
            <h2 className="cadence-display text-lg font-black uppercase text-[#101820]">
              Manager review
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Commitment decisions for the team cadence
            </p>
          </div>
          <ShieldCheck className="h-5 w-5 text-[#f6c044]" />
        </div>

        <div className="divide-y divide-[#d8dde1] px-5">
          {commitments.map((commitment) => {
            const draft = reviewDraftFor(commitment);

            return (
              <div
                key={commitment.id}
                className="grid gap-3 py-4 xl:grid-cols-[1fr_0.8fr_auto]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-950">
                      {commitment.title}
                    </p>
                    <StatusBadge status={commitment.status} />
                    <RiskChip risk={commitment.risk} />
                    <CarryChip commitment={commitment} />
                    <OutcomeChip commitment={commitment} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {commitment.ownerName} - {commitment.rcdo.supportingOutcome}
                  </p>
                  {commitment.managerReview ? (
                    <p className="mt-2 text-sm text-slate-700">
                      {reviewLabel[commitment.managerReview.decision]}:{' '}
                      {commitment.managerReview.note || 'No note'}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-2 sm:grid-cols-[0.75fr_1fr]">
                  <Select
                    aria-label={`Review decision for ${commitment.ownerName}`}
                    value={draft.decision}
                    onChange={(event) =>
                      updateReviewDraft(commitment.id, {
                        decision: event.target.value as ManagerReviewDecision,
                        note: draft.note,
                      })
                    }
                  >
                    {Object.entries(reviewLabel).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                  <TextInput
                    aria-label={`Review note for ${commitment.ownerName}`}
                    placeholder="Review note"
                    value={draft.note}
                    onChange={(event) =>
                      updateReviewDraft(commitment.id, {
                        decision: draft.decision,
                        note: event.target.value,
                      })
                    }
                  />
                </div>

                <Button
                  aria-label={`Record review for ${commitment.ownerName}`}
                  className="self-start bg-[#101820] enabled:hover:bg-[#26333d] focus:ring-[#f6c044]"
                  size="xs"
                  type="button"
                  disabled={isWriting}
                  onClick={() => recordReview(commitment)}
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Record
                </Button>
              </div>
            );
          })}
        </div>
      </section>
    </section>
  );
}

function CommitmentTable({
  commitments,
  isFetching,
  onEdit,
  onOpenTimeline,
  onRefetch,
}: {
  commitments: WeeklyCommitment[];
  isFetching: boolean;
  onEdit: (commitment: WeeklyCommitment) => void;
  onOpenTimeline: (commitment: WeeklyCommitment) => void;
  onRefetch: () => void;
}) {
  return (
    <section className="rounded-lg border border-[#ccd3d8] bg-white shadow-sm shadow-black/5">
      <div className="flex items-center justify-between gap-3 border-b border-[#d8dde1] px-5 py-4">
        <h2 className="cadence-display text-lg font-black uppercase text-[#101820]">
          Current commitments
        </h2>
        <Button
          aria-label="Refresh commitments"
          color="light"
          size="xs"
          onClick={onRefetch}
        >
          {isFetching ? (
            <Spinner size="sm" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f8f8f4] text-xs uppercase text-slate-500">
            <tr>
              <th className="px-6 py-3">Owner</th>
              <th className="px-6 py-3">Commitment</th>
              <th className="px-6 py-3">RCDO link</th>
              <th className="px-6 py-3">Layer</th>
              <th className="px-6 py-3">Due</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Risk</th>
              <th className="px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#d8dde1]">
            {commitments.map((commitment) => (
              <tr
                key={commitment.id}
                className="bg-white align-top hover:bg-[#fffaf0]"
              >
                <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-950">
                  {commitment.ownerName}
                </td>
                <td className="px-6 py-4">
                  <div className="max-w-md">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-950">
                        {commitment.title}
                      </p>
                      <CarryChip commitment={commitment} />
                      <OutcomeChip commitment={commitment} />
                    </div>
                    <p className="text-sm text-slate-500">
                      {commitment.plannedValue}
                    </p>
                    {commitment.actualValue ? (
                      <p className="mt-2 text-sm text-slate-700">
                        Actual: {commitment.actualValue}
                      </p>
                    ) : null}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="max-w-sm text-sm">
                    <p className="font-medium text-slate-800">
                      {commitment.rcdo.supportingOutcome}
                    </p>
                    <p className="text-slate-500">
                      {commitment.rcdo.definingObjective}
                    </p>
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  {commitment.chessLayer}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  {commitment.dueDate}
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={commitment.status} />
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <RiskChip risk={commitment.risk} />
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-2">
                    {auditEventsFor(commitment).length > 1 ? (
                      <Button
                        aria-label={`Open audit timeline for ${commitment.title}`}
                        color="light"
                        size="xs"
                        type="button"
                        onClick={() => onOpenTimeline(commitment)}
                      >
                        <Clock3 className="h-4 w-4" />
                      </Button>
                    ) : null}
                    <Button
                      aria-label={`Edit ${commitment.title}`}
                      color="light"
                      size="xs"
                      type="button"
                      onClick={() => onEdit(commitment)}
                    >
                      <Edit3 className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AuditTimelineDrawer({
  commitment,
  onClose,
}: {
  commitment: WeeklyCommitment;
  onClose: () => void;
}) {
  const events = auditEventsFor(commitment);

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close audit timeline"
        className="absolute inset-0 bg-[#101820]/40"
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[#d8dde1] px-5 py-4">
          <div>
            <h2 className="cadence-display text-lg font-black uppercase text-[#101820]">
              Audit timeline
            </h2>
            <p className="mt-1 text-sm text-slate-500">{commitment.title}</p>
          </div>
          <Button
            aria-label="Close audit timeline"
            color="light"
            size="xs"
            type="button"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {events.length ? (
            <ol className="space-y-4">
              {events.map((event) => (
                <li key={event.id} className="border-l-2 border-[#d8dde1] pl-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {event.fromStatus ? (
                      <SignalChip
                        label={titleCaseStatus(event.fromStatus)}
                        tone="slate"
                      />
                    ) : null}
                    <SignalChip
                      label={titleCaseStatus(event.toStatus)}
                      tone={isPostLockEdit(event) ? 'amber' : 'slate'}
                    />
                  </div>
                  <p className="mt-2 text-sm font-medium text-[#101820]">
                    {event.actorName}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatDateTime(event.occurredAt)} ·{' '}
                    {changedFieldSummary(event.changedFields)}
                  </p>
                  {isPostLockEdit(event) ? (
                    <p className="mt-1 text-xs font-semibold text-[#a26300]">
                      Edited after lock
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-slate-500">
              No audit events recorded for this commitment yet.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function Field({
  children,
  htmlFor,
  label,
}: {
  children: ReactNode;
  htmlFor: string;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-[#344452]" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="border-l-2 border-[#d71920] px-4 py-3">
      <div className="flex items-center gap-2 text-[#667789]">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="cadence-display mt-1 text-xl font-black uppercase text-[#101820]">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: CommitmentStatus }) {
  return <Badge color={statusColor[status]}>{formatStatus(status)}</Badge>;
}

function RiskChip({ risk }: { risk: CommitmentRisk }) {
  const tone =
    risk === 'BLOCKED'
      ? 'border-[#f1b6b8] bg-[#fff1f1] text-[#9f1015]'
      : risk === 'AT_RISK'
        ? 'border-[#f3d78a] bg-[#fff8df] text-[#8a5b00]'
        : 'border-[#ccd3d8] bg-[#f8f8f4] text-[#344452]';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}
    >
      {formatRisk(risk)}
    </span>
  );
}

function CarryChip({ commitment }: { commitment: WeeklyCommitment }) {
  const weeks = carriedWeeks(commitment);

  if (weeks < 2) {
    return null;
  }

  const tone =
    weeks >= 4
      ? 'border-[#f1b6b8] bg-[#fff1f1] text-[#9f1015]'
      : weeks >= 3
        ? 'border-[#f3d78a] bg-[#fff8df] text-[#8a5b00]'
        : 'border-[#ccd3d8] bg-[#f8f8f4] text-[#344452]';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}
    >
      Carried {weeks} wks
    </span>
  );
}

function OutcomeChip({ commitment }: { commitment: WeeklyCommitment }) {
  if (!commitment.outcomeDeprioritized) {
    return null;
  }

  return (
    <span className="inline-flex items-center rounded-full border border-[#f3d78a] bg-[#fff8df] px-2 py-0.5 text-xs font-semibold text-[#8a5b00]">
      Outcome Deprioritized
    </span>
  );
}

function SignalChip({
  label,
  tone,
}: {
  label: string;
  tone: 'slate' | 'amber' | 'red';
}) {
  const toneClass =
    tone === 'red'
      ? 'border-[#f1b6b8] bg-[#fff1f1] text-[#9f1015]'
      : tone === 'amber'
        ? 'border-[#f3d78a] bg-[#fff8df] text-[#8a5b00]'
        : 'border-[#ccd3d8] bg-[#f8f8f4] text-[#344452]';

  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${toneClass}`}
    >
      {label}
    </span>
  );
}

function commitmentFromDraft(
  draft: WeeklyCommitmentDraft,
  existingCommitment?: WeeklyCommitment,
): WeeklyCommitment {
  const rcdo =
    outcomeOptions.find(
      (outcome) => outcome.supportingOutcomeId === draft.supportingOutcomeId,
    ) ?? outcomeOptions[0];

  return {
    id: existingCommitment?.id ?? `local-${Date.now()}`,
    ownerName:
      draft.ownerName ?? existingCommitment?.ownerName ?? ownerOptions[0],
    title: draft.title,
    plannedValue: draft.plannedValue,
    actualValue: existingCommitment?.actualValue,
    status: existingCommitment?.status ?? 'DRAFT',
    chessLayer: draft.chessLayer,
    dueDate: draft.dueDate,
    risk: draft.risk ?? existingCommitment?.risk ?? 'ON_TRACK',
    rcdo,
    managerReview: existingCommitment?.managerReview,
    weeksCarried: existingCommitment?.weeksCarried ?? 0,
    originWeekStart:
      existingCommitment?.originWeekStart ?? sampleWeek.weekStart,
    outcomeDeprioritized: existingCommitment?.outcomeDeprioritized ?? false,
    outcomeStatusNote: existingCommitment?.outcomeStatusNote,
    auditEvents:
      existingCommitment?.auditEvents ??
      sampleAuditEvents(
        existingCommitment?.id ?? 'local-draft',
        draft.ownerName ?? ownerOptions[0],
        ['DRAFT'],
      ),
  };
}

function formatStatus(status: CommitmentStatus) {
  return titleCaseStatus(status);
}

function formatRisk(risk: CommitmentRisk) {
  return titleCaseStatus(risk);
}

function titleCaseStatus(value: CommitmentStatus | CommitmentRisk) {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function isTerminalStatus(status: CommitmentStatus) {
  return status === 'RECONCILED' || status === 'CARRIED_FORWARD';
}

function carriedWeeks(commitment: WeeklyCommitment) {
  return commitment.weeksCarried ?? 0;
}

function auditEventsFor(commitment: WeeklyCommitment) {
  return commitment.auditEvents ?? [];
}

function isPostLockEdit(event: CommitmentAuditEvent) {
  const changedFields = changedFieldNames(event.changedFields);
  return (
    event.fromStatus !== undefined &&
    event.fromStatus !== 'DRAFT' &&
    changedFields.some((field) => field !== 'status')
  );
}

function changedFieldSummary(changedFields: string) {
  const names = changedFieldNames(changedFields);

  if (names.length === 0) {
    return 'No field changes recorded';
  }

  return `${names.map(formatFieldName).join(', ')} changed`;
}

function changedFieldNames(changedFields: string) {
  try {
    const parsed = JSON.parse(changedFields) as Record<string, unknown>;
    return Object.keys(parsed);
  } catch {
    return [];
  }
}

function formatFieldName(fieldName: string) {
  return fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default App;
