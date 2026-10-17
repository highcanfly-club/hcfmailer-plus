import React from 'react';

import { Stack, useTheme } from '@mui/material';

import { useInspectorDrawerOpen } from '../documents/editor/EditorContext';

import InspectorDrawer, { INSPECTOR_DRAWER_WIDTH } from './InspectorDrawer';
import TemplatePanel from './TemplatePanel';

export default function App() {
  const inspectorDrawerOpen = useInspectorDrawerOpen();
  const { transitions } = useTheme();
  const marginRightTransition = transitions.create('margin-right', {
    easing: !inspectorDrawerOpen ? transitions.easing.sharp : transitions.easing.easeOut,
    duration: !inspectorDrawerOpen ? transitions.duration.leavingScreen : transitions.duration.enteringScreen,
  });

  return (
    <>
      <InspectorDrawer />

      <Stack
        sx={{
          height: '100%',
          marginRight: inspectorDrawerOpen ? `${INSPECTOR_DRAWER_WIDTH}px` : 0,
          transition: marginRightTransition,
        }}
      >
        <TemplatePanel />
      </Stack>
    </>
  );
}
