
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ZoomErrorDisplayProps {
  error: string;
  meetingNumber: string;
  retryCount: number;
  maxRetries: number;
  onRetry: () => void;
}

export function ZoomErrorDisplay({
  error,
  meetingNumber,
  retryCount,
  maxRetries,
  onRetry
}: ZoomErrorDisplayProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
      <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg max-w-md">
        <p className="text-red-600 font-medium">Meeting Error</p>
        <p className="text-red-500 text-sm mt-1">{error}</p>
      </div>
      {retryCount < maxRetries && (
        <Button onClick={onRetry} className="mb-2">
          Retry ({retryCount + 1}/{maxRetries + 1})
        </Button>
      )}
      <p className="text-sm text-gray-600">
        Meeting ID: {meetingNumber}
      </p>
    </div>
  );
}
