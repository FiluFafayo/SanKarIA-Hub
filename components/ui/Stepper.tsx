import React from 'react';

interface StepperProps {
  steps: string[];
  activeIndex: number;
}

export const Stepper: React.FC<StepperProps> = ({ steps, activeIndex }) => {
  return (
    <div className="flex items-center gap-2 p-space-sm">
      {steps.map((label, i) => (
        <div key={label} className={`flex items-center gap-2 ${i > 0 ? 'before:content-[\'\'] before:w-8 before:h-px before:bg-border-primary' : ''}`}>
          <div className={`w-8 h-8 rounded-full grid place-items-center text-xs ${i === activeIndex ? 'bg-amber-600 text-white' : 'bg-bg-secondary text-text-secondary border border-border-primary'}`}>{i+1}</div>
          <span className="text-xs text-text-secondary">{label}</span>
        </div>
      ))}
    </div>
  );
};

export default Stepper;