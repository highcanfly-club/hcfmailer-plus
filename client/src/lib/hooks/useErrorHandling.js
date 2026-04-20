'use strict';

import { useCallback, useContext } from 'react';
import { ParentErrorHandlerContext } from '../error-handling';

export function useErrorHandling() {
  const parentErrorHandler = useContext(ParentErrorHandlerContext);

  const handleError = useCallback((error) => {
    if (typeof parentErrorHandler === 'function') {
      parentErrorHandler(error);
    } else if (parentErrorHandler?.handleError) {
      // withErrorHandling mixin puts the class instance as context value
      parentErrorHandler.handleError(error);
    } else {
      throw error;
    }
  }, [parentErrorHandler]);

  return { handleError };
}
