import { Alert, Badge, Button, Select, Spinner, TextInput } from 'flowbite-react';
import { CalendarDays, GitBranch, Plus, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { FormEvent, useState } from 'react';

import {
  useCreateCommitmentMutation,
  useGetCurrentWeekQuery,
  useGetManagerDashboardQuery,
} from './api/cadence-api';
import type { ChessLayer, CommitmentStatus } from './types';

const statusColor: Record<CommitmentStatus, string> = {
  DRAFT: 'gray',
  LOCKED: 'info',
  RECONCILING: 'warning',
  RECONCILED: 'success',
  CARRIED_FORWARD: 'purple',
};

const sampleOutcomeIds = {
  executionSignals: '11111111-1111-4111-8111-111111111111',
  hiringPlans: '22222222-2222-4222-8222-222222222222',
};

const sampleCommitments = [
  {
    id: 'sample-1',
    ownerName: 'Mira Petrova',
    title: 'Prepare Q2 operating partner cadence review',
    plannedValue: 'Portfolio review pack ready for IC pre-read',
    status: 'LOCKED' as CommitmentStatus,
    chessLayer: 'QUEEN' as ChessLayer,
    dueDate: '2026-06-05',
    confidence: 82,
    rcdo: {
      rallyCry: 'Raise portfolio operating velocity',
      definingObjective: 'Standardize weekly execution signals',
      supportingOutcomeId: sampleOutcomeIds.executionSignals,
      supportingOutcome: 'Every priority commitment maps to an RCDO outcome',
    },
  },
  {
    id: 'sample-2',
    ownerName: 'Nikolay Ivanov',
    title: 'Reconcile weekly hiring commitments',
    plannedValue: 'All overdue actions assigned to an accountable owner',
    actualValue: '18 of 21 reconciled',
    status: 'RECONCILING' as CommitmentStatus,
    chessLayer: 'ROOK' as ChessLayer,
    dueDate: '2026-06-05',
    confidence: 71,
    rcdo: {
      rallyCry: 'Build leadership bench strength',
      definingObjective: 'Improve hiring execution quality',
      supportingOutcomeId: sampleOutcomeIds.hiringPlans,
      supportingOutcome: 'Critical hiring plans are visible weekly',
    },
  },
];

export function App() {
  const { data, isFetching, isError, refetch } = useGetCurrentWeekQuery();
  const { data: managerPage } = useGetManagerDashboardQuery({ page: 0, size: 5 });
  const [createCommitment, createState] = useCreateCommitmentMutation();
  const [title, setTitle] = useState('');
  const [supportingOutcomeId, setSupportingOutcomeId] = useState(sampleOutcomeIds.executionSignals);

  const commitments = data?.commitments ?? sampleCommitments;
  const weekState = data?.state ?? 'DRAFT';
  const teamTotal = managerPage?.totalElements ?? commitments.length;

  async function submitCommitment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      return;
    }

    await createCommitment({
      title,
      plannedValue: 'New weekly commitment awaiting lock',
      supportingOutcomeId,
      chessLayer: 'KNIGHT',
      dueDate: new Date().toISOString().slice(0, 10),
    });
    setTitle('');
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">Cadence</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">
                  Weekly commitments tied to RCDO outcomes
                </h1>
              </div>
              <Badge color={statusColor[weekState]} size="sm">
                {weekState.replace('_', ' ')}
              </Badge>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Metric icon={<CalendarDays size={18} />} label="Week state" value={weekState.replace('_', ' ')} />
              <Metric icon={<GitBranch size={18} />} label="Team records" value={String(teamTotal)} />
              <Metric icon={<RefreshCw size={18} />} label="Lifecycle" value="Draft to reconcile" />
            </div>
          </div>

          <form className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" onSubmit={submitCommitment}>
            <h2 className="text-base font-semibold text-slate-950">Add commitment</h2>
            <div className="mt-4 flex flex-col gap-3">
              <TextInput
                aria-label="Commitment title"
                placeholder="Commitment title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <Select
                aria-label="Supporting outcome"
                value={supportingOutcomeId}
                onChange={(event) => setSupportingOutcomeId(event.target.value)}
              >
                <option value={sampleOutcomeIds.executionSignals}>Execution signals mapped weekly</option>
                <option value={sampleOutcomeIds.hiringPlans}>Critical hiring plans visible</option>
              </Select>
              <Button type="submit" disabled={createState.isLoading}>
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>
          </form>
        </section>

        {isError ? (
          <Alert color="warning">Backend API is not connected yet, so the remote is showing fixture data.</Alert>
        ) : null}

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-950">Current commitments</h2>
            <Button color="light" size="xs" onClick={() => void refetch()}>
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
                  <th className="px-6 py-3">Chess layer</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {commitments.map((commitment) => (
                  <tr key={commitment.id} className="bg-white">
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-950">{commitment.ownerName}</td>
                    <td className="px-6 py-4">
                      <div className="max-w-md">
                        <p className="font-medium text-slate-950">{commitment.title}</p>
                        <p className="text-sm text-slate-500">{commitment.plannedValue}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-sm text-sm">
                        <p className="font-medium text-slate-800">{commitment.rcdo.supportingOutcome}</p>
                        <p className="text-slate-500">{commitment.rcdo.definingObjective}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">{commitment.chessLayer}</td>
                    <td className="px-6 py-4">
                      <Badge color={statusColor[commitment.status]}>{commitment.status.replace('_', ' ')}</Badge>
                    </td>
                    <td className="px-6 py-4">{commitment.confidence}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

export default App;
