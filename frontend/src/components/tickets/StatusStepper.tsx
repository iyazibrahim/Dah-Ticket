import { TICKET_STATUSES, statusLabels, statusDescriptions, getStatusStepIndex } from '../../lib/ticketWorkflow';
import type { Ticket } from '../../types';

interface StatusStepperProps {
  status: Ticket['status'];
}

export default function StatusStepper({ status }: StatusStepperProps) {
  const currentIndex = getStatusStepIndex(status);

  return (
    <div className="w-full select-none">
      <div className="grid w-full" style={{ gridTemplateColumns: `repeat(${TICKET_STATUSES.length}, minmax(0, 1fr))` }}>
        {TICKET_STATUSES.map((step, index) => {
          const isPast = index < currentIndex;
          const isCurrent = index === currentIndex;
          const lineLeftActive = index > 0 && index <= currentIndex;
          const lineRightActive = index < currentIndex;

          return (
            <div key={step} className="flex flex-col items-center min-w-0">
              <div className="flex items-center w-full h-3">
                <div
                  className={`h-0.5 flex-1 ${index === 0 ? 'invisible' : lineLeftActive ? 'bg-primary' : 'bg-border'}`}
                />
                <div
                  className={`shrink-0 h-3.5 w-3.5 rounded-full ${
                    isCurrent
                      ? 'bg-primary ring-[3px] ring-primary/30'
                      : isPast
                        ? 'bg-primary'
                        : 'bg-muted border-2 border-border'
                  }`}
                />
                <div
                  className={`h-0.5 flex-1 ${index === TICKET_STATUSES.length - 1 ? 'invisible' : lineRightActive ? 'bg-primary' : 'bg-border'}`}
                />
              </div>
              <span
                className={`mt-2 text-[10px] leading-tight text-center truncate w-full px-0.5 ${
                  isCurrent
                    ? 'text-primary font-semibold'
                    : isPast
                      ? 'text-muted-foreground font-medium'
                      : 'text-muted-foreground/45'
                }`}
              >
                {statusLabels[step]}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground text-center">
        {statusDescriptions[status]}
      </p>
    </div>
  );
}
