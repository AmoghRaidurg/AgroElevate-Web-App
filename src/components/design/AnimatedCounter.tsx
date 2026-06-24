import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}

/** Smoothly animates numeric dashboard metrics without layout shift. */
export function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 600,
  className,
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState(0);
  const frame = useRef<number>();
  const start = useRef<number>();
  const from = useRef(0);

  useEffect(() => {
    from.current = display;
    start.current = undefined;

    const step = (ts: number) => {
      if (start.current === undefined) start.current = ts;
      const progress = Math.min((ts - start.current) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      const next = from.current + (value - from.current) * eased;
      setDisplay(next);
      if (progress < 1) frame.current = requestAnimationFrame(step);
    };

    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate from last rendered value
  }, [value, duration]);

  const formatted =
    decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString();

  return (
    <span className={cn('tabular-nums', className)}>
      {prefix}{formatted}{suffix}
    </span>
  );
}
