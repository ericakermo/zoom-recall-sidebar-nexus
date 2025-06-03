
import { useCallback, useRef } from 'react';

interface LoadingStep {
  step: string;
  timestamp: number;
  details?: any;
  success?: boolean;
  error?: string;
}

export function useZoomLoadingLogger() {
  const loadingStepsRef = useRef<LoadingStep[]>([]);
  const startTimeRef = useRef<number>(Date.now());

  const logStep = useCallback((step: string, details?: any, success?: boolean, error?: string) => {
    const timestamp = Date.now();
    const elapsed = timestamp - startTimeRef.current;
    
    const logEntry: LoadingStep = {
      step,
      timestamp: elapsed,
      details,
      success,
      error
    };
    
    loadingStepsRef.current.push(logEntry);
    
    const status = success === true ? '✅' : success === false ? '❌' : '🔄';
    const errorText = error ? ` - ERROR: ${error}` : '';
    
    console.log(`${status} [ZOOM-LOADER] ${step} (${elapsed}ms)${errorText}`, details || '');
    
    // Log full timeline every 5 steps for debugging
    if (loadingStepsRef.current.length % 5 === 0) {
      console.log('📊 [ZOOM-LOADER] Loading timeline:', loadingStepsRef.current);
    }
  }, []);

  const getLoadingReport = useCallback(() => {
    const totalTime = Date.now() - startTimeRef.current;
    const failedSteps = loadingStepsRef.current.filter(step => step.success === false);
    const successfulSteps = loadingStepsRef.current.filter(step => step.success === true);
    
    return {
      totalSteps: loadingStepsRef.current.length,
      totalTime,
      successfulSteps: successfulSteps.length,
      failedSteps: failedSteps.length,
      steps: loadingStepsRef.current,
      lastError: failedSteps[failedSteps.length - 1]?.error
    };
  }, []);

  const reset = useCallback(() => {
    loadingStepsRef.current = [];
    startTimeRef.current = Date.now();
    console.log('🔄 [ZOOM-LOADER] Logger reset');
  }, []);

  return {
    logStep,
    getLoadingReport,
    reset,
    steps: loadingStepsRef.current
  };
}
