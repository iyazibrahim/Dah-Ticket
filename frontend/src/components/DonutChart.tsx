interface Props {
  percent: number;
  resolved: number;
  total: number;
  label: string;
  sublabel?: string;
  size?: 'xs' | 'sm' | 'md';
}

export default function DonutChart({ percent, resolved, total, label, sublabel, size = 'md' }: Props) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const stroke = (percent / 100) * circumference;
  const dim =
    size === 'xs' ? 'h-20 w-20' : size === 'sm' ? 'h-28 w-28 sm:h-32 sm:w-32' : 'h-32 w-32 sm:h-40 sm:w-40';
  const pctText = size === 'xs' ? 'text-sm' : 'text-lg sm:text-xl';

  return (
    <div className={`relative ${dim} mx-auto`}>
      <svg className={`${dim} -rotate-90`} viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="10" className="stroke-muted" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeDasharray={`${stroke} ${circumference}`}
          strokeLinecap="round"
          className="stroke-emerald-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
        <p className={`${pctText} font-bold text-foreground leading-none`}>{percent}%</p>
        {size !== 'xs' && (
          <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-1 leading-tight line-clamp-2">{label}</p>
        )}
        <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-none mt-0.5">
          {sublabel ?? `${resolved}/${total}`}
        </p>
      </div>
    </div>
  );
}
