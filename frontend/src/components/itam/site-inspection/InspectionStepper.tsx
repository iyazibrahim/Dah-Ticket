import { Check } from 'lucide-react';
import type { InspectionStep } from './constants';

interface Props {
  activeStep: InspectionStep;
  hasLocationSelected: boolean;
  isScoped: boolean;
  onStepClick: (step: InspectionStep) => void;
}

const STEPS: { key: InspectionStep; n: number; label: string }[] = [
  { key: 'location', n: 1, label: 'Location' },
  { key: 'findings', n: 2, label: 'Findings' },
  { key: 'report', n: 3, label: 'Report' },
];

export default function InspectionStepper({
  activeStep,
  hasLocationSelected,
  isScoped,
  onStepClick,
}: Props) {
  const stepIndex = STEPS.findIndex((s) => s.key === activeStep);

  const isStepDisabled = (key: InspectionStep) => {
    if (key === 'location') return isScoped;
    if (key === 'findings' || key === 'report') return !hasLocationSelected;
    return false;
  };

  const isStepCompleted = (key: InspectionStep) => {
    const idx = STEPS.findIndex((s) => s.key === key);
    return idx < stepIndex;
  };

  return (
    <div className="flex items-center gap-2 mb-4">
      {STEPS.map((s, i) => {
        const disabled = isStepDisabled(s.key);
        const active = activeStep === s.key;
        const completed = isStepCompleted(s.key);

        return (
          <div key={s.key} className="flex items-center gap-2 flex-1 min-w-0">
            <button
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onStepClick(s.key)}
              className={`flex items-center gap-2 min-w-0 transition-opacity ${
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'
              }`}
            >
              <div
                className={`h-7 w-7 rounded-full text-xs font-semibold flex items-center justify-center shrink-0 ${
                  active
                    ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                    : completed
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {completed && !active ? <Check className="h-3.5 w-3.5" /> : s.n}
              </div>
              <span
                className={`text-xs truncate ${
                  active ? 'text-foreground font-semibold' : completed ? 'text-foreground font-medium' : 'text-muted-foreground'
                }`}
              >
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border min-w-2" />}
          </div>
        );
      })}
    </div>
  );
}
