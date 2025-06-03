
import { useState, useEffect, useCallback } from 'react';

interface ContainerReadinessOptions {
  containerId: string;
  checkInterval?: number;
  maxAttempts?: number;
  onReady?: () => void;
  onTimeout?: () => void;
}

export function useContainerReadiness({
  containerId,
  checkInterval = 50,
  maxAttempts = 100,
  onReady,
  onTimeout
}: ContainerReadinessOptions) {
  const [isReady, setIsReady] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const validateContainer = useCallback((element: HTMLElement): boolean => {
    const computedStyle = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    
    console.log('🔍 [CONTAINER-READINESS] Validating container:', {
      id: containerId,
      display: computedStyle.display,
      visibility: computedStyle.visibility,
      width: computedStyle.width,
      height: computedStyle.height,
      rect: rect
    });

    // Check if container is visible and has dimensions
    if (computedStyle.display === 'none') {
      console.warn('⚠️ [CONTAINER-READINESS] Container has display: none');
      return false;
    }

    if (computedStyle.visibility === 'hidden') {
      console.warn('⚠️ [CONTAINER-READINESS] Container has visibility: hidden');
      return false;
    }

    if (rect.width === 0 || rect.height === 0) {
      console.warn('⚠️ [CONTAINER-READINESS] Container has zero dimensions:', rect);
      return false;
    }

    return true;
  }, [containerId]);

  const checkReadiness = useCallback(() => {
    const element = document.getElementById(containerId);
    
    if (!element) {
      console.log(`⏳ [CONTAINER-READINESS] Waiting for ${containerId} (attempt ${attempts + 1}/${maxAttempts})`);
      setAttempts(prev => prev + 1);
      return false;
    }

    if (!validateContainer(element)) {
      setAttempts(prev => prev + 1);
      return false;
    }

    console.log(`✅ [CONTAINER-READINESS] Container ${containerId} is ready after ${attempts + 1} attempts`);
    setIsReady(true);
    onReady?.();
    return true;
  }, [containerId, attempts, maxAttempts, validateContainer, onReady]);

  useEffect(() => {
    if (isReady) return;

    if (attempts >= maxAttempts) {
      const errorMsg = `Container ${containerId} not ready after ${maxAttempts} attempts`;
      console.error(`❌ [CONTAINER-READINESS] ${errorMsg}`);
      setError(errorMsg);
      onTimeout?.();
      return;
    }

    const timeoutId = setTimeout(() => {
      if (!checkReadiness()) {
        // Will trigger another useEffect cycle due to attempts change
      }
    }, checkInterval);

    return () => clearTimeout(timeoutId);
  }, [attempts, maxAttempts, checkInterval, checkReadiness, isReady, onTimeout]);

  const reset = useCallback(() => {
    setIsReady(false);
    setAttempts(0);
    setError(null);
  }, []);

  return {
    isReady,
    attempts,
    error,
    reset
  };
}
