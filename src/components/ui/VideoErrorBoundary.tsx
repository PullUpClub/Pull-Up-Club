import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class VideoErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Check if this is a video embed related error
    const isVideoError = 
      error.message.includes('youtube') ||
      error.message.includes('vimeo') ||
      error.message.includes('iframe') ||
      error.message.includes('embed') ||
      errorInfo.componentStack?.includes('iframe');

    if (isVideoError) {
      console.warn('Video embed error (likely due to browser restrictions):', error.message);
    } else {
      console.error('Unexpected error in video component:', error, errorInfo);
    }
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="relative bg-gray-900 rounded-lg flex items-center justify-center w-full aspect-video">
          <div className="text-center p-6">
            <div className="text-amber-400 mb-4">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-sm font-medium">Video temporarily unavailable</p>
              <p className="text-xs text-gray-400 mt-1">This may be due to browser security settings</p>
            </div>
            <button 
              onClick={() => this.setState({ hasError: false })}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default VideoErrorBoundary; 