import { Alert, Badge, Button, Checkbox, Select, Spinner, Textarea, TextInput } from 'flowbite-react';
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Edit3,
  GitBranch,
  Layers3,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Users,
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
  CommitmentStatus,
  ManagerReviewDecision,
  RcdoLink,
  ReconciliationUpdate,
  WeeklyCommitment,
  WeeklyCommitmentDraft,
  WeeklyCommitmentWeek,
} from './types';

type WorkspaceMode = 'contributor' | 'director';

type CommitmentFormState = Omit<WeeklyCommitmentDraft, 'ownerName'> & {
  ownerName: string;
};

type ReconciliationDraft = Pick<ReconciliationUpdate, 'actualValue' | 'carryForward'>;

type ReviewDraft = {
  decision: ManagerReviewDecision;
  note: string;
};

type Notice = {
  color: 'success' | 'warning' | 'info';
  message: string;
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

const chessLayers: ChessLayer[] = ['KING', 'QUEEN', 'ROOK', 'BISHOP', 'KNIGHT', 'PAWN'];

const ownerOptions = ['Mira Petrova', 'Nikolay Ivanov', 'Tara Singh', 'Avery Chen'];

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
    confidence: 82,
    rcdo: outcomeOptions[0],
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
    confidence: 71,
    rcdo: outcomeOptions[1],
  },
  {
    id: 'sample-3',
    ownerName: 'Tara Singh',
    title: 'Close launch quality gates for onboarding refresh',
    plannedValue: 'Open launch risks are named with owner and mitigation',
    status: 'DRAFT',
    chessLayer: 'BISHOP',
    dueDate: '2026-06-04',
    confidence: 64,
    rcdo: outcomeOptions[2],
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
};

export function App() {
  const { data, isFetching, isError, refetch } = useGetCurrentWeekQuery();
  const { data: managerPage, isError: isManagerError } = useGetManagerDashboardQuery({ page: 0, size: 20 });
  const [createCommitment, createState] = useCreateCommitmentMutation();
  const [updateCommitment, updateState] = useUpdateCommitmentMutation();
  const [updateReconciliation, reconciliationState] = useUpdateReconciliationMutation();
  const [reviewCommitment, reviewState] = useReviewCommitmentMutation();
  const [lockCurrentWeek, lockState] = useLockCurrentWeekMutation();
  const [workspaceWeek, setWorkspaceWeek] = useState<WeeklyCommitmentWeek>(sampleWeek);
  const [mode, setMode] = useState<WorkspaceMode>('contributor');
  const [formState, setFormState] = useState<CommitmentFormState>(defaultFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reconciliationDrafts, setReconciliationDrafts] = useState<Record<string, ReconciliationDraft>>({});
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const [notice, setNotice] = useState<Notice | null>(null);

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

  const commitments = workspaceWeek.commitments;
  const weekState = workspaceWeek.state;
  const teamTotal = managerPage?.totalElements ?? commitments.length;
  const isWriting =
    createState.isLoading ||
    updateState.isLoading ||
    reconciliationState.isLoading ||
    reviewState.isLoading ||
    lockState.isLoading;

  const summary = useMemo(() => {
    const reconciled = commitments.filter(
      (commitment) => commitment.status === 'RECONCILED' || commitment.status === 'CARRIED_FORWARD',
    ).length;
    const atRisk = commitments.filter(
      (commitment) =>
        commitment.confidence < 70 &&
        commitment.status !== 'RECONCILED' &&
        commitment.status !== 'CARRIED_FORWARD',
    ).length;
    const reviewed = commitments.filter((commitment) => commitment.managerReview).length;

    return {
      reconciled,
      atRisk,
      reviewed,
      carryForward: commitments.filter((commitment) => commitment.status === 'CARRIED_FORWARD').length,
    };
  }, [commitments]);

  const ownerRollup = useMemo(
    () =>
      ownerOptions
        .map((ownerName) => {
          const ownedCommitments = commitments.filter((commitment) => commitment.ownerName === ownerName);

          return {
            ownerName,
            total: ownedCommitments.length,
            locked: ownedCommitments.filter((commitment) => commitment.status === 'LOCKED').length,
            reconciled: ownedCommitments.filter(
              (commitment) => commitment.status === 'RECONCILED' || commitment.status === 'CARRIED_FORWARD',
            ).length,
            atRisk: ownedCommitments.filter((commitment) => commitment.confidence < 70).length,
          };
        })
        .filter((rollup) => rollup.total > 0),
    [commitments],
  );

  async function submitCommitment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formState.title.trim() || !formState.plannedValue.trim()) {
      return;
    }

    const payload: WeeklyCommitmentDraft = {
      ...formState,
      title: formState.title.trim(),
      plannedValue: formState.plannedValue.trim(),
    };

    if (editingId) {
      const existingCommitment = commitments.find((commitment) => commitment.id === editingId);

      if (!existingCommitment) {
        return;
      }

      try {
        const savedCommitment = await updateCommitment({ commitmentId: editingId, ...payload }).unwrap();
        mergeCommitment(savedCommitment);
        setNotice({ color: 'success', message: 'Commitment updated in Cadence.' });
      } catch {
        mergeCommitment(commitmentFromDraft(payload, existingCommitment));
        setNotice({
          color: 'warning',
          message: 'Commitment updated in the alpha workspace while the remote edit endpoint is unavailable.',
        });
      }
    } else {
      try {
        const savedCommitment = await createCommitment(payload).unwrap();
        mergeCommitment(savedCommitment);
        setNotice({ color: 'success', message: 'Commitment created in Cadence.' });
      } catch {
        mergeCommitment(commitmentFromDraft(payload));
        setNotice({
          color: 'warning',
          message: 'Commitment created in the alpha workspace while the Cadence API is unavailable.',
        });
      }
    }

    resetForm();
  }

  async function saveReconciliation(commitment: WeeklyCommitment) {
    const draft = reconciliationDraftFor(commitment);
    const payload: ReconciliationUpdate = {
      commitmentId: commitment.id,
      actualValue: draft.actualValue.trim(),
      carryForward: draft.carryForward,
    };

    try {
      const savedCommitment = await updateReconciliation(payload).unwrap();
      mergeCommitment(savedCommitment);
      setNotice({ color: 'success', message: 'Reconciliation saved in Cadence.' });
    } catch {
      mergeCommitment({
        ...commitment,
        actualValue: payload.actualValue,
        status: payload.carryForward ? 'CARRIED_FORWARD' : 'RECONCILED',
      });
      setNotice({
        color: 'warning',
        message: 'Reconciliation saved in the alpha workspace while the remote lifecycle endpoint is unavailable.',
      });
    }
  }

  async function recordReview(commitment: WeeklyCommitment) {
    const draft = reviewDraftFor(commitment);

    try {
      const savedCommitment = await reviewCommitment({
        commitmentId: commitment.id,
        decision: draft.decision,
        note: draft.note.trim(),
      }).unwrap();
      mergeCommitment(savedCommitment);
      setNotice({ color: 'success', message: 'Manager review saved in Cadence.' });
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
        message: 'Manager review saved in the alpha workspace while the remote review endpoint is unavailable.',
      });
    }
  }

  async function lockWeek() {
    try {
      const nextWeek = await lockCurrentWeek().unwrap();
      setWorkspaceWeek(nextWeek);
      setNotice({ color: 'success', message: 'Week locked in Cadence.' });
    } catch {
      setWorkspaceWeek((current) => ({
        ...current,
        state: 'LOCKED',
        commitments: current.commitments.map((commitment) =>
          commitment.status === 'DRAFT' ? { ...commitment, status: 'LOCKED' } : commitment,
        ),
      }));
      setNotice({
        color: 'warning',
        message: 'Week locked in the alpha workspace while the remote lock endpoint is unavailable.',
      });
    }
  }

  function mergeCommitment(commitment: WeeklyCommitment) {
    setWorkspaceWeek((current) => {
      const exists = current.commitments.some((existingCommitment) => existingCommitment.id === commitment.id);

      return {
        ...current,
        commitments: exists
          ? current.commitments.map((existingCommitment) =>
              existingCommitment.id === commitment.id ? commitment : existingCommitment,
            )
          : [commitment, ...current.commitments],
      };
    });
  }

  function startEdit(commitment: WeeklyCommitment) {
    setEditingId(commitment.id);
    setFormState({
      ownerName: commitment.ownerName,
      title: commitment.title,
      plannedValue: commitment.plannedValue,
      supportingOutcomeId: commitment.rcdo.supportingOutcomeId,
      chessLayer: commitment.chessLayer,
      dueDate: commitment.dueDate,
    });
    setMode('contributor');
  }

  function resetForm() {
    setEditingId(null);
    setFormState(defaultFormState);
  }

  function updateReconciliationDraft(commitmentId: string, patch: Partial<ReconciliationDraft>) {
    setReconciliationDrafts((current) => ({
      ...current,
      [commitmentId]: {
        actualValue: current[commitmentId]?.actualValue ?? '',
        carryForward: current[commitmentId]?.carryForward ?? false,
        ...patch,
      },
    }));
  }

  function updateReviewDraft(commitmentId: string, patch: Partial<ReviewDraft>) {
    setReviewDrafts((current) => ({
      ...current,
      [commitmentId]: {
        decision: current[commitmentId]?.decision ?? 'APPROVED',
        note: current[commitmentId]?.note ?? '',
        ...patch,
      },
    }));
  }

  function reconciliationDraftFor(commitment: WeeklyCommitment): ReconciliationDraft {
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
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Cadence</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">
                Weekly commitments tied to RCDO outcomes
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div
                className="flex overflow-hidden rounded-lg border border-slate-200 bg-slate-100 p-1"
                role="group"
                aria-label="Workspace view"
              >
                <button
                  type="button"
                  aria-pressed={mode === 'contributor'}
                  className={`min-h-9 rounded-md px-3 text-sm font-medium ${
                    mode === 'contributor' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'
                  }`}
                  onClick={() => setMode('contributor')}
                >
                  Contributor
                </button>
                <button
                  type="button"
                  aria-pressed={mode === 'director'}
                  className={`min-h-9 rounded-md px-3 text-sm font-medium ${
                    mode === 'director' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'
                  }`}
                  onClick={() => setMode('director')}
                >
                  Director
                </button>
              </div>
              <StatusBadge status={weekState} />
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-4">
            <Metric icon={<CalendarDays size={18} />} label="Week state" value={formatStatus(weekState)} />
            <Metric icon={<GitBranch size={18} />} label="Team records" value={String(teamTotal)} />
            <Metric icon={<CheckCircle2 size={18} />} label="Reconciled" value={`${summary.reconciled}/${commitments.length}`} />
            <Metric icon={<ShieldCheck size={18} />} label="Director reviewed" value={String(summary.reviewed)} />
          </div>
        </section>

        {notice ? <Alert color={notice.color}>{notice.message}</Alert> : null}

        {isError || isManagerError ? (
          <Alert color="warning">Cadence API is unavailable; the alpha workspace is using fixture-backed writes.</Alert>
        ) : null}

        {mode === 'contributor' ? (
          <ContributorWorkspace
            commitments={commitments}
            editingId={editingId}
            formState={formState}
            isWriting={isWriting}
            onCancelEdit={resetForm}
            onFormChange={(patch) => setFormState((current) => ({ ...current, ...patch }))}
            onSaveReconciliation={(commitment) => void saveReconciliation(commitment)}
            onSubmit={submitCommitment}
            reconciliationDraftFor={reconciliationDraftFor}
            updateReconciliationDraft={updateReconciliationDraft}
          />
        ) : (
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
        )}

        <CommitmentTable
          commitments={commitments}
          isFetching={isFetching}
          onEdit={startEdit}
          onRefetch={() => void refetch()}
        />
      </main>
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
  updateReconciliationDraft: (commitmentId: string, patch: Partial<ReconciliationDraft>) => void;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
      <form className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" onSubmit={onSubmit}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-950">
            {editingId ? 'Edit commitment' : 'Create commitment'}
          </h2>
          {editingId ? (
            <Button color="light" size="xs" type="button" onClick={onCancelEdit}>
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
              onChange={(event) => onFormChange({ ownerName: event.target.value })}
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
              onChange={(event) => onFormChange({ dueDate: event.target.value })}
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
              onChange={(event) => onFormChange({ chessLayer: event.target.value as ChessLayer })}
            >
              {chessLayers.map((layer) => (
                <option key={layer} value={layer}>
                  {layer}
                </option>
              ))}
            </Select>
          </Field>

          <div className="sm:col-span-2">
            <Field label="Supporting outcome" htmlFor="commitment-supporting-outcome">
              <Select
                id="commitment-supporting-outcome"
                aria-label="Supporting outcome"
                value={formState.supportingOutcomeId}
                onChange={(event) => onFormChange({ supportingOutcomeId: event.target.value })}
              >
                {outcomeOptions.map((outcome) => (
                  <option key={outcome.supportingOutcomeId} value={outcome.supportingOutcomeId}>
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
                onChange={(event) => onFormChange({ plannedValue: event.target.value })}
              />
            </Field>
          </div>
        </div>

        <Button className="mt-4 w-full" type="submit" disabled={isWriting}>
          {editingId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
          {editingId ? 'Save commitment' : 'Add commitment'}
        </Button>
      </form>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Reconciliation queue</h2>
            <p className="mt-1 text-sm text-slate-500">Actual value and next-week carry decisions</p>
          </div>
          <ClipboardCheck className="h-5 w-5 text-slate-500" />
        </div>
        <div className="divide-y divide-slate-200 px-5">
          {commitments.map((commitment) => {
            const draft = reconciliationDraftFor(commitment);

            return (
              <div key={commitment.id} className="grid gap-3 py-4 lg:grid-cols-[1fr_1fr_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-950">{commitment.title}</p>
                    <StatusBadge status={commitment.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{commitment.ownerName}</p>
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
  ownerRollup: Array<{ ownerName: string; total: number; locked: number; reconciled: number; atRisk: number }>;
  recordReview: (commitment: WeeklyCommitment) => void;
  reviewDraftFor: (commitment: WeeklyCommitment) => ReviewDraft;
  summary: { reconciled: number; atRisk: number; reviewed: number; carryForward: number };
  updateReviewDraft: (commitmentId: string, patch: Partial<ReviewDraft>) => void;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Team roll-up</h2>
            <p className="mt-1 text-sm text-slate-500">Owner coverage, risk, and reconciliation progress</p>
          </div>
          <Button size="xs" type="button" disabled={isWriting} onClick={lockWeek}>
            <Send className="mr-2 h-4 w-4" />
            Lock week
          </Button>
        </div>

        <div className="grid gap-4 px-5 py-4 sm:grid-cols-3">
          <Metric icon={<Users size={18} />} label="At risk" value={String(summary.atRisk)} />
          <Metric icon={<Layers3 size={18} />} label="Carry forward" value={String(summary.carryForward)} />
          <Metric icon={<ShieldCheck size={18} />} label="Reviewed" value={String(summary.reviewed)} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Owner</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Locked</th>
                <th className="px-5 py-3">Reconciled</th>
                <th className="px-5 py-3">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {ownerRollup.map((rollup) => (
                <tr key={rollup.ownerName}>
                  <td className="whitespace-nowrap px-5 py-3 font-medium text-slate-950">{rollup.ownerName}</td>
                  <td className="px-5 py-3">{rollup.total}</td>
                  <td className="px-5 py-3">{rollup.locked}</td>
                  <td className="px-5 py-3">{rollup.reconciled}</td>
                  <td className="px-5 py-3">{rollup.atRisk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Manager review</h2>
            <p className="mt-1 text-sm text-slate-500">Commitment decisions for the team cadence</p>
          </div>
          <ShieldCheck className="h-5 w-5 text-slate-500" />
        </div>

        <div className="divide-y divide-slate-200 px-5">
          {commitments.map((commitment) => {
            const draft = reviewDraftFor(commitment);

            return (
              <div key={commitment.id} className="grid gap-3 py-4 xl:grid-cols-[1fr_0.8fr_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-950">{commitment.title}</p>
                    <StatusBadge status={commitment.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {commitment.ownerName} - {commitment.rcdo.supportingOutcome}
                  </p>
                  {commitment.managerReview ? (
                    <p className="mt-2 text-sm text-slate-700">
                      {reviewLabel[commitment.managerReview.decision]}: {commitment.managerReview.note || 'No note'}
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
                  className="self-start"
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
  onRefetch,
}: {
  commitments: WeeklyCommitment[];
  isFetching: boolean;
  onEdit: (commitment: WeeklyCommitment) => void;
  onRefetch: () => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-950">Current commitments</h2>
        <Button aria-label="Refresh commitments" color="light" size="xs" onClick={onRefetch}>
          {isFetching ? <Spinner size="sm" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-6 py-3">Owner</th>
              <th className="px-6 py-3">Commitment</th>
              <th className="px-6 py-3">RCDO link</th>
              <th className="px-6 py-3">Layer</th>
              <th className="px-6 py-3">Due</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Confidence</th>
              <th className="px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {commitments.map((commitment) => (
              <tr key={commitment.id} className="bg-white align-top">
                <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-950">{commitment.ownerName}</td>
                <td className="px-6 py-4">
                  <div className="max-w-md">
                    <p className="font-medium text-slate-950">{commitment.title}</p>
                    <p className="text-sm text-slate-500">{commitment.plannedValue}</p>
                    {commitment.actualValue ? (
                      <p className="mt-2 text-sm text-slate-700">Actual: {commitment.actualValue}</p>
                    ) : null}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="max-w-sm text-sm">
                    <p className="font-medium text-slate-800">{commitment.rcdo.supportingOutcome}</p>
                    <p className="text-slate-500">{commitment.rcdo.definingObjective}</p>
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4">{commitment.chessLayer}</td>
                <td className="whitespace-nowrap px-6 py-4">{commitment.dueDate}</td>
                <td className="px-6 py-4">
                  <StatusBadge status={commitment.status} />
                </td>
                <td className="whitespace-nowrap px-6 py-4">{commitment.confidence}%</td>
                <td className="px-6 py-4">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Field({ children, htmlFor, label }: { children: ReactNode; htmlFor: string; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="border-l border-slate-200 pl-3">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: CommitmentStatus }) {
  return <Badge color={statusColor[status]}>{formatStatus(status)}</Badge>;
}

function commitmentFromDraft(draft: WeeklyCommitmentDraft, existingCommitment?: WeeklyCommitment): WeeklyCommitment {
  const rcdo = outcomeOptions.find((outcome) => outcome.supportingOutcomeId === draft.supportingOutcomeId) ?? outcomeOptions[0];

  return {
    id: existingCommitment?.id ?? `local-${Date.now()}`,
    ownerName: draft.ownerName ?? existingCommitment?.ownerName ?? ownerOptions[0],
    title: draft.title,
    plannedValue: draft.plannedValue,
    actualValue: existingCommitment?.actualValue,
    status: existingCommitment?.status ?? 'DRAFT',
    chessLayer: draft.chessLayer,
    dueDate: draft.dueDate,
    confidence: existingCommitment?.confidence ?? 68,
    rcdo,
    managerReview: existingCommitment?.managerReview,
  };
}

function formatStatus(status: CommitmentStatus) {
  return status.replace('_', ' ');
}

export default App;
