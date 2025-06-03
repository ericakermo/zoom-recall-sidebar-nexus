
import { useState, useCallback, useRef } from 'react';

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 8000,
  backoffMultiplier: 2
};

export function useZoomRetryLogic(config: Partial<RetryConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout>();

  const calculateDelay = useCallback((attempt: number) => {
    const delay = Math.min(
      finalConfig.baseDelay * Math.pow(finalConfig.backoffMultiplier, attempt),
      finalConfig.maxDelay
    );
    return delay;
  }, [finalConfig]);

  const executeWithRetry = useCallback(async <T>(
    operation: () => Promise<T>,
    operationName: string,
    onRetryStart?: (attempt: number, delay: number) => void
  ): Promise<T> => {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = calculateDelay(attempt - 1);
          console.log(`🔄 [RETRY-LOGIC] Retrying ${operationName} (attempt ${attempt}/${finalConfig.maxRetries}) after ${delay}ms`);
          
          setIsRetrying(true);
          setRetryCount(attempt);
          onRetryStart?.(attempt, delay);
          
          await new Promise(resolve => {
            retryTimeoutRef.current = setTimeout(resolve, delay);
          });
        }

        console.log(`⚡ [RETRY-LOGIC] Executing ${operationName} (attempt ${attempt + 1}/${finalConfig.maxRetries + 1})`);
        const result = await operation();
        
        if (attempt > 0) {
          console.log(`✅ [RETRY-LOGIC] ${operationName} succeeded after ${attempt} retries`);
        }
        
        setIsRetrying(false);
        setRetryCount(0);
        setLastError(null);
        return result;
      } catch (error: any) {
        lastError = error;
        const errorMessage = error.message || 'Unknown error';
        console.error(`❌ [RETRY-LOGIC] ${operationName} failed (attempt ${attempt + 1}):`, errorMessage);
        
        setLastError(errorMessage);
        
        // Don't retry on certain errors
        if (errorMessage.includes('Invalid meeting number') || 
            errorMessage.includes('Meeting not found') ||
            errorMessage.includes('Authentication failed')) {
          console.log(`🚫 [RETRY-LOGIC] Not retrying ${operationName} - non-retryable error`);
          break;
        }
      }
    }

    setIsRetrying(false);
    console.error(`💥 [RETRY-LOGIC] ${operationName} failed after ${finalConfig.maxRetries + 1} attempts`);
    throw new Error(`${operationName} failed after ${finalConfig.maxRetries + 1} attempts: ${lastError.message}`);
  }, [finalConfig, calculateDelay]);

  const reset = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    setRetryCount(0);
    setIsRetrying(false);
    setLastError(null);
    console.log('🔄 [RETRY-LOGIC] Reset retry state');
  }, []);

  const canRetry = retryCount < finalConfig.maxRetries;

  return {
    executeWithRetry,
    retryCount,
    isRetrying,
    lastError,
    canRetry,
    maxRetries: finalConfig.maxRetries,
    reset
  };
}
