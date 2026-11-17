import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('TORIWEAR Uncaught UI Error Boundary:', error, errorInfo);
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 text-center select-none font-sans">
          <div className="w-14 h-14 rounded-2xl bg-red-600/10 border border-red-500/20 flex items-center justify-center mb-4 text-[#FF2028] font-mono text-2xl font-bold">
            !
          </div>
          <h2 className="font-heading text-2xl font-bold tracking-wider text-white uppercase mb-2">
            SOMETHING WENT UNEXPECTED
          </h2>
          <p className="text-xs text-neutral-400 font-mono max-w-md mb-6 leading-relaxed">
            The page encountered a temporary display issue. Click below to refresh your view smoothly.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-6 py-2.5 bg-[#FF2028] hover:bg-[#e02642] text-white font-mono text-xs font-bold uppercase rounded-xl transition cursor-pointer shadow-lg shadow-red-600/25"
            >
              Reload Page
            </button>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/';
              }}
              className="px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white font-mono text-xs font-bold uppercase rounded-xl border border-neutral-700 transition cursor-pointer"
            >
              Return Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
