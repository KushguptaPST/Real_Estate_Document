import { useEffect, useState } from 'react';
import { tasksApi } from '@/services/api';
import {
  CheckSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  IndianRupee,
  User,
  Plus,
  FileText,
} from 'lucide-react';
import { formatIndianPrice, formatIndianPriceFull } from '@/utils/currency';

interface TransactionTaskPanelProps {
  dealId: string;
  documents: any[];
}

export function TransactionTaskPanel({ dealId, documents }: TransactionTaskPanelProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extractingDocId, setExtractingDocId] = useState<string | null>(null);

  useEffect(() => {
    loadTasks();
  }, [dealId]);

  async function loadTasks() {
    try {
      setLoading(true);
      setError(null);
      const data = await tasksApi.list(dealId);
      setTasks(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load transaction tasks');
    } finally {
      setLoading(false);
    }
  }

  async function handleExtractTasks(docId: string) {
    try {
      setExtractingDocId(docId);
      await tasksApi.extractFromDoc(dealId, docId);
      loadTasks();
    } catch (err: any) {
      alert(err.message || 'Failed to extract tasks from document');
    } finally {
      setExtractingDocId(null);
    }
  }

  async function handleTaskStatusChange(taskId: string, status: 'COMPLETED' | 'IN_PROGRESS' | 'CANCELLED') {
    try {
      await tasksApi.reviewTask(dealId, taskId, { status });
      loadTasks();
    } catch (err: any) {
      alert(err.message || 'Failed to update task status');
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Section Header & Document Extraction Actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-indigo-600" />
            Transaction Obligations &amp; Milestone Tasks ({tasks.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Non-contingency obligations (escrow deposits, HOA disclosures, repair milestones) extracted from uploaded contract documents.
          </p>
        </div>

        {documents.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-semibold">Extract from doc:</span>
            {documents.map((doc) => (
              <button
                key={doc.id}
                onClick={() => handleExtractTasks(doc.id)}
                disabled={extractingDocId === doc.id}
                className="rounded-lg bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors flex items-center gap-1"
              >
                {extractingDocId === doc.id ? (
                  <Loader2 className="h-3 w-3 animate-spin text-indigo-600" />
                ) : (
                  <FileText className="h-3 w-3 text-indigo-500" />
                )}
                {doc.filename.slice(0, 15)}...
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Content States ── */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        </div>
      ) : error ? (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-center text-xs text-rose-700">
          <AlertCircle className="h-5 w-5 mx-auto mb-1" />
          {error}
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center bg-slate-50/50 text-xs text-slate-500">
          No non-contingency milestone tasks recorded. Click "Extract from doc" above to parse tasks.
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const isCompleted = task.status === 'COMPLETED';
            return (
              <div
                key={task.id}
                className={`rounded-2xl border p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isCompleted
                    ? 'bg-slate-50 border-slate-200 opacity-80'
                    : 'bg-white border-slate-200/80 shadow-xs hover:border-indigo-300'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        isCompleted
                          ? 'bg-emerald-100 text-emerald-800'
                          : task.isHumanReviewed
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {task.isHumanReviewed ? (isCompleted ? 'Completed' : 'Reviewed & Approved') : 'Pending Agent Review'}
                    </span>
                    <h3 className={`text-sm font-bold ${isCompleted ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                      {task.title}
                    </h3>
                  </div>

                  {task.description && (
                    <p className="text-xs text-slate-600 italic">"{task.description}"</p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                      Due: {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>

                    {task.amount && (
                      <span className="flex items-center gap-1 font-semibold text-emerald-600" title={formatIndianPriceFull(task.amount)}>
                        <IndianRupee className="h-3.5 w-3.5" /> {formatIndianPrice(task.amount)}
                      </span>
                    )}

                    {task.assignedTo && (
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-slate-400" /> {task.assignedTo}
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Task Action Buttons ── */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  {!isCompleted ? (
                    <button
                      onClick={() => handleTaskStatusChange(task.id, 'COMPLETED')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition-colors flex items-center gap-1 shadow-xs"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Mark Done
                    </button>
                  ) : (
                    <button
                      onClick={() => handleTaskStatusChange(task.id, 'IN_PROGRESS')}
                      className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-300 transition-colors"
                    >
                      Reopen
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
