import React, { useMemo } from 'react';

import { renderToStaticMarkup } from '@usewaypoint/email-builder';

import { useDocument } from '../../documents/editor/EditorContext';

export default function HtmlPanel() {
  const document = useDocument();
  const code = useMemo(() => renderToStaticMarkup(document, { rootBlockId: 'root' }), [document]);
  return (
    <pre
      style={{ margin: 0, padding: 16, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
      onClick={(ev) => {
        const s = window.getSelection();
        if (s !== null) {
          s.selectAllChildren(ev.currentTarget);
        }
      }}
    >
      {code}
    </pre>
  );
}
