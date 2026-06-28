import { Component, type ErrorInfo, type ReactNode } from 'react';
import { GlassCard } from '@/components/design/GlassCard';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/** Prevents trader MI rendering errors from blanking the entire page. */
export class TraderMarketErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Unknown rendering error' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Trader Market Intelligence]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <GlassCard className="mt-6 p-6 border-amber-500/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Trader Market Intelligence could not render</p>
              <p className="text-sm text-muted-foreground mt-1">{this.state.message}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => this.setState({ hasError: false, message: '' })}
              >
                Try again
              </Button>
            </div>
          </div>
        </GlassCard>
      );
    }
    return this.props.children;
  }
}
