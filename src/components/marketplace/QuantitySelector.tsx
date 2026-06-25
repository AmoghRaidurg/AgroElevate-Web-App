import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const PRESETS = [1, 5, 20, 100, 500, 1000] as const;

interface QuantitySelectorProps {
  value: number;
  max: number;
  min?: number;
  unit?: string;
  onChange: (next: number) => void;
  onMaxExceeded?: (max: number) => void;
  className?: string;
  compact?: boolean;
}

function clampQty(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export function QuantitySelector({
  value,
  max,
  min = 1,
  unit = 'kg',
  onChange,
  onMaxExceeded,
  className,
  compact = false,
}: QuantitySelectorProps) {
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const apply = useCallback(
    (next: number) => {
      const clamped = clampQty(next, min, max);
      if (next > max) onMaxExceeded?.(max);
      onChange(clamped);
      setDraft(String(clamped));
    },
    [max, min, onChange, onMaxExceeded],
  );

  const commitDraft = () => {
    const parsed = parseInt(draft, 10);
    if (Number.isNaN(parsed)) {
      setDraft(String(value));
      return;
    }
    apply(parsed);
  };

  const presets = PRESETS.filter((p) => p <= max);

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex items-center flex-1 border border-border/60 rounded-lg bg-muted/20 overflow-hidden',
            compact ? 'h-9' : 'h-10',
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('shrink-0 rounded-none', compact ? 'h-9 w-9' : 'h-10 w-10')}
            onClick={() => apply(value - 1)}
            disabled={value <= min}
            aria-label="Decrease quantity"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitDraft();
                inputRef.current?.blur();
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                apply(value + 1);
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                apply(value - 1);
              }
            }}
            onWheel={(e) => {
              e.preventDefault();
              apply(value + (e.deltaY < 0 ? 1 : -1));
            }}
            className={cn(
              'border-0 bg-transparent text-center font-semibold tabular-nums focus-visible:ring-0 focus-visible:ring-offset-0 h-full',
              compact ? 'text-sm' : 'text-base',
            )}
            aria-label={`Quantity in ${unit}`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('shrink-0 rounded-none', compact ? 'h-9 w-9' : 'h-10 w-10')}
            onClick={() => apply(value + 1)}
            disabled={value >= max}
            aria-label="Increase quantity"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{unit}</span>
      </div>

      {!compact && presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <Button
              key={p}
              type="button"
              size="sm"
              variant={value === p ? 'secondary' : 'outline'}
              className="h-7 px-2.5 text-xs tabular-nums"
              onClick={() => apply(p)}
            >
              {p} {unit}
            </Button>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground tabular-nums">
        {max - value} {unit} remaining · max {max} {unit}
      </p>
    </div>
  );
}
