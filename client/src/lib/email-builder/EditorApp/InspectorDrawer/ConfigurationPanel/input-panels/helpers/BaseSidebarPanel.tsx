import React from 'react';

import { Box, Stack, Typography } from '@mui/material';

type SidebarPanelProps = {
  title: string;
  children: React.ReactNode;
};
export default function BaseSidebarPanel({ title, children }: SidebarPanelProps) {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        {title}
      </Typography>
      <Stack spacing={5} sx={{ mb: 3 }}>
        {children}
      </Stack>
    </Box>
  );
}
