import React, { useEffect, useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { useFinanceStore } from '../../store/useFinanceStore';

export const Toast: React.FC = () => {
  const { undoQueue, undoLastDelete, dismissUndo } = useFinanceStore();
  const currentUndo = undoQueue[0];
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!currentUndo) {
      setProgress(100);
      return;
    }

    const duration = 6000; // 6 seconds
    const intervalTime = 50;
    const step = (intervalTime / duration) * 100;

    setProgress(100);
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          dismissUndo(currentUndo.id);
          return 0;
        }
        return prev - step;
      });
    }, intervalTime);

    return () => clearInterval(interval);
  }, [currentUndo?.id, dismissUndo]);

  if (!currentUndo) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex max-w-sm flex-col overflow-hidden rounded-xl border border-neutral-200 bg-neutral-900 text-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-800">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex flex-col text-xs">
          <span className="font-medium text-neutral-100">Item deleted</span>
          <span className="text-neutral-400">Can be recovered within 30 days</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => undoLastDelete()}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition-colors whitespace-nowrap shadow-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Undo
          </button>
          <button
            onClick={() => dismissUndo(currentUndo.id)}
            className="p-1 text-neutral-400 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {/* Visual countdown progress line */}
      <div className="h-1 w-full bg-neutral-800 dark:bg-neutral-700">
        <div
          className="h-full bg-indigo-500 transition-all duration-50 linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
