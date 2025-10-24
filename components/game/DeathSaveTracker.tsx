import React from 'react';

interface DeathSaveTrackerProps {
  successes: number;
  failures: number;
}

const Dot: React.FC<{ filled: boolean; isSuccess?: boolean }> = ({ filled, isSuccess = false }) => (
  <div className={`w-3 h-3 rounded-full border-2 ${isSuccess ? 'border-green-400' : 'border-red-500'} ${filled ? (isSuccess ? 'bg-green-400' : 'bg-red-500') : 'bg-transparent'}`}></div>
);

export const DeathSaveTracker: React.FC<DeathSaveTrackerProps> = ({ successes, failures }) => {
  return (
    <div className="flex flex-col items-start mt-1">
      <div className="flex gap-1.5 items-center">
        <span className="text-xs mr-1 text-green-400 font-semibold">Sukses:</span>
        <Dot filled={successes >= 1} isSuccess />
        <Dot filled={successes >= 2} isSuccess />
        <Dot filled={successes >= 3} isSuccess />
      </div>
      <div className="flex gap-1.5 items-center mt-0.5">
        <span className="text-xs mr-1 text-red-500 font-semibold">Gagal:</span>
        <Dot filled={failures >= 1} />
        <Dot filled={failures >= 2} />
        <Dot filled={failures >= 3} />
      </div>
    </div>
  );
};
