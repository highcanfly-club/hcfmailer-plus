'use strict';

import { useEffect, useContext } from 'react';
import { SectionContentContext } from '../page-common';
import mailtrainConfig from 'mailtrainConfig';
import { getUrl } from '../urls';

export function useRequiresAuthenticatedUser() {
  const sectionContent = useContext(SectionContentContext);

  useEffect(() => {
    if (!mailtrainConfig.isAuthenticated) {
      if (mailtrainConfig.authMethod === 'cas') {
        window.location.href = getUrl('cas/login?next=' + encodeURIComponent(window.location.pathname));
      } else {
        sectionContent.navigateTo('/login?next=' + encodeURIComponent(window.location.pathname));
      }
    }
  }, [sectionContent]);
}
