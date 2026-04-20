'use strict';

import { useContext } from 'react';
import { SectionContentContext } from '../page-common';

export function usePageHelpers() {
  const sectionContent = useContext(SectionContentContext);

  return {
    navigateTo: (path) => sectionContent?.navigateTo(path),
    navigateBack: () => sectionContent?.navigateBack(),
    setFlashMessage: (severity, text) => sectionContent?.setFlashMessage(severity, text),
    navigateToWithFlashMessage: (path, severity, text) =>
      sectionContent?.navigateToWithFlashMessage(path, severity, text),
    registerBeforeUnloadHandlers: (handlers) =>
      sectionContent?.registerBeforeUnloadHandlers(handlers),
    deregisterBeforeUnloadHandlers: (handlers) =>
      sectionContent?.deregisterBeforeUnloadHandlers(handlers),
  };
}
