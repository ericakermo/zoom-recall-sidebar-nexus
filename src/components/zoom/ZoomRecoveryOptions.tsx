
import { AlertTriangle, RefreshCw, Home, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ZoomRecoveryOptionsProps {
  error: string;
  retryCount: number;
  maxRetries: number;
  onRetry: () => void;
  onGoHome: () => void;
  onRefreshPage: () => void;
  isRetrying?: boolean;
  loadingReport?: any;
}

export function ZoomRecoveryOptions({
  error,
  retryCount,
  maxRetries,
  onRetry,
  onGoHome,
  onRefreshPage,
  isRetrying = false,
  loadingReport
}: ZoomRecoveryOptionsProps) {
  const canRetry = retryCount < maxRetries;
  
  const getErrorCategory = (error: string) => {
    if (error.includes('Container') || error.includes('element')) return 'container';
    if (error.includes('authentication') || error.includes('signature')) return 'auth';
    if (error.includes('network') || error.includes('timeout')) return 'network';
    if (error.includes('Meeting not found') || error.includes('Invalid meeting')) return 'meeting';
    return 'general';
  };

  const getRecoveryAdvice = (category: string) => {
    switch (category) {
      case 'container':
        return 'The meeting interface failed to load properly. Try refreshing the page.';
      case 'auth':
        return 'Authentication failed. Check your meeting permissions and try again.';
      case 'network':
        return 'Network connectivity issues detected. Check your internet connection.';
      case 'meeting':
        return 'Meeting details are invalid. Verify the meeting ID and time.';
      default:
        return 'An unexpected error occurred. Try the recovery options below.';
    }
  };

  const errorCategory = getErrorCategory(error);
  const advice = getRecoveryAdvice(errorCategory);

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <CardTitle className="text-red-600">Meeting Connection Failed</CardTitle>
        <CardDescription>{advice}</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Error Details */}
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600 font-medium">Error Details:</p>
          <p className="text-xs text-red-500 mt-1 break-words">{error}</p>
          {retryCount > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Attempt {retryCount + 1} of {maxRetries + 1}
            </p>
          )}
        </div>

        {/* Recovery Actions */}
        <div className="space-y-2">
          {canRetry && (
            <Button 
              onClick={onRetry} 
              disabled={isRetrying}
              className="w-full"
              variant="default"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry Connection ({retryCount + 1}/{maxRetries + 1})
                </>
              )}
            </Button>
          )}
          
          <Button 
            onClick={onRefreshPage} 
            variant="outline" 
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Page
          </Button>
          
          <Button 
            onClick={onGoHome} 
            variant="ghost" 
            className="w-full"
          >
            <Home className="h-4 w-4 mr-2" />
            Back to Calendar
          </Button>
        </div>

        {/* Debug Info (only shown if available) */}
        {loadingReport && process.env.NODE_ENV === 'development' && (
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
              Debug Information
            </summary>
            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-32">
              {JSON.stringify(loadingReport, null, 2)}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
