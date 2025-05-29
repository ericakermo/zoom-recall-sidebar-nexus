
import { Loader2 } from 'lucide-react';

interface ZoomLoadingOverlayProps {
  isLoading: boolean;
  currentStep: string;
  meetingNumber: string;
  retryCount: number;
  maxRetries: number;
}

export function ZoomLoadingOverlay({
  isLoading,
  currentStep,
  meetingNumber,
  retryCount,
  maxRetries
}: ZoomLoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div className="absolute inset-0 bg-gray-900 flex items-center justify-center z-50">
      <div className="text-center text-white">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
        <p className="text-lg">{currentStep}</p>
        <p className="text-sm text-gray-400 mt-2">Meeting ID: {meetingNumber}</p>
        {retryCount > 0 && (
          <p className="text-xs text-yellow-400 mt-1">
            Retry attempt {retryCount}/{maxRetries}
          </p>
        )}
      </div>
    </div>
  );
}
