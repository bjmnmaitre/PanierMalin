// hooks/useAsync.ts
// Async data fetching with loading, error, and retry support

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Async state
 */
export interface AsyncState<T> {
  status: 'idle' | 'pending' | 'success' | 'error';
  data: T | null;
  error: Error | null;
  isLoading: boolean;
}

/**
 * Async function type
 */
export type AsyncFunction<T> = () => Promise<T>;

/**
 * useAsync hook - Handle async operations cleanly
 *
 * @example
 * const { data, isLoading, error } = useAsync(() => api.getProducts());
 *
 * @example
 * const { data, execute } = useAsync(async () => {
 *   return await fetchData();
 * }, false); // false = don't run immediately, call execute() manually
 */
export function useAsync<T>(
  asyncFunction: AsyncFunction<T>,
  immediate = true
) {

  const [state, setState] = useState<AsyncState<T>>({
    status: 'idle',
    data: null,
    error: null,
    isLoading: false,
  });

  const mountedRef = useRef(true);

  // Execute the async function
  const execute = useCallback(async () => {
    setState({
      status: 'pending',
      data: null,
      error: null,
      isLoading: true,
    });

    try {
      const response = await asyncFunction();

      if (mountedRef.current) {
        setState({
          status: 'success',
          data: response,
          error: null,
          isLoading: false,
        });
      }

      return response;
    } catch (error) {
      if (mountedRef.current) {
        setState({
          status: 'error',
          data: null,
          error: error instanceof Error ? error : new Error(String(error)),
          isLoading: false,
        });
      }
      return undefined;
    }
  }, [asyncFunction]);

  // Execute on mount if immediate, and handle unmount cleanup
  useEffect(() => {
    mountedRef.current = true;

    if (immediate) {
      execute();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [immediate, execute]);

  return {
    ...state,
    execute,
  };
}

export default useAsync;