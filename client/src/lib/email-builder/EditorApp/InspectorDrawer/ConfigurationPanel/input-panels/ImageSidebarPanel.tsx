import React, { useState } from 'react';
import { ZodError } from 'zod';

import {
  VerticalAlignBottomOutlined,
  VerticalAlignCenterOutlined,
  VerticalAlignTopOutlined,
} from '@mui/icons-material';
import { Alert, Button, MenuItem, Stack, TextField, ToggleButton } from '@mui/material';
import { UploadFileOutlined } from '@mui/icons-material';
import { ImageProps, ImagePropsSchema } from '@usewaypoint/block-image';

import BaseSidebarPanel from './helpers/BaseSidebarPanel';
import RadioGroupInput from './helpers/inputs/RadioGroupInput';
import TextDimensionInput from './helpers/inputs/TextDimensionInput';
import TextInput from './helpers/inputs/TextInput';
import MultiStylePropertyPanel from './helpers/style-inputs/MultiStylePropertyPanel';
import i18n from '../../../../../i18n';
import { DEFAULT_MAX_WIDTH, SIZE_PRESETS, sanitizeMaxWidth, sizePresetLabel, uploadTemplateImage } from '../../../../../image-upload';
import { getUploadConfig } from '../../../../uploadConfig';

type ImageSidebarPanelProps = {
  data: ImageProps;
  setData: (v: ImageProps) => void;
};
export default function ImageSidebarPanel({ data, setData }: ImageSidebarPanelProps) {
  const [, setErrors] = useState<ZodError | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sizeKey, setSizeKey] = useState('full');
  const [customWidth, setCustomWidth] = useState(String(DEFAULT_MAX_WIDTH));

  const updateData = (d: unknown) => {
    const res = ImagePropsSchema.safeParse(d);
    if (res.success) {
      setData(res.data);
      setErrors(null);
    } else {
      setErrors(res.error);
    }
  };

  const uploadImage = async (file: File | undefined) => {
    if (!file) return;
    const { entityTypeId, entityId } = getUploadConfig();
    const preset = SIZE_PRESETS.find((p) => p.key === sizeKey);
    const maxWidth = preset && preset.maxWidth ? preset.maxWidth : sanitizeMaxWidth(customWidth);
    setUploading(true);
    setUploadError(null);
    try {
      const url = await uploadTemplateImage('emailbuilder', entityTypeId, entityId, file, maxWidth);
      // Stored width is 2x the display width: also set the displayed width so a small image stays small in the email
      const width = maxWidth >= DEFAULT_MAX_WIDTH ? data.props?.width ?? null : Math.round(maxWidth / 2);
      updateData({ ...data, props: { ...data.props, url, width } });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : i18n.t('aiUploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <BaseSidebarPanel title="Image block">
      <TextField select size="small" label={i18n.t('aiUploadSize')} value={sizeKey} onChange={(e) => setSizeKey(e.target.value)}>
        {SIZE_PRESETS.map((p) => (
          <MenuItem key={p.key} value={p.key}>
            {sizePresetLabel(p)}
          </MenuItem>
        ))}
      </TextField>
      {sizeKey === 'custom' && (
        <TextField
          size="small"
          type="number"
          label={i18n.t('aiMaxWidthPx')}
          value={customWidth}
          slotProps={{ htmlInput: { min: 16, max: 2400 } }}
          onChange={(e) => setCustomWidth(e.target.value)}
        />
      )}
      <Button component="label" variant="outlined" size="small" startIcon={<UploadFileOutlined />} disabled={uploading}>
        {uploading ? i18n.t('aiUploading') : i18n.t('aiUploadImage')}
        <input
          hidden
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(e) => {
            uploadImage(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </Button>
      {uploadError && <Alert severity="error">{uploadError}</Alert>}
      <TextInput
        key={data.props?.url ?? ''}
        label="Source URL"
        defaultValue={data.props?.url ?? ''}
        onChange={(v) => {
          const url = v.trim().length === 0 ? null : v.trim();
          updateData({ ...data, props: { ...data.props, url } });
        }}
      />

      <TextInput
        label="Alt text"
        defaultValue={data.props?.alt ?? ''}
        onChange={(alt) => updateData({ ...data, props: { ...data.props, alt } })}
      />
      <TextInput
        label="Click through URL"
        defaultValue={data.props?.linkHref ?? ''}
        onChange={(v) => {
          const linkHref = v.trim().length === 0 ? null : v.trim();
          updateData({ ...data, props: { ...data.props, linkHref } });
        }}
      />
      <Stack direction="row" spacing={2}>
        <TextDimensionInput
          label="Width"
          defaultValue={data.props?.width}
          onChange={(width) => updateData({ ...data, props: { ...data.props, width } })}
        />
        <TextDimensionInput
          label="Height"
          defaultValue={data.props?.height}
          onChange={(height) => updateData({ ...data, props: { ...data.props, height } })}
        />
      </Stack>

      <RadioGroupInput
        label="Alignment"
        defaultValue={data.props?.contentAlignment ?? 'middle'}
        onChange={(contentAlignment) => updateData({ ...data, props: { ...data.props, contentAlignment } })}
      >
        <ToggleButton value="top">
          <VerticalAlignTopOutlined fontSize="small" />
        </ToggleButton>
        <ToggleButton value="middle">
          <VerticalAlignCenterOutlined fontSize="small" />
        </ToggleButton>
        <ToggleButton value="bottom">
          <VerticalAlignBottomOutlined fontSize="small" />
        </ToggleButton>
      </RadioGroupInput>

      <MultiStylePropertyPanel
        names={['backgroundColor', 'textAlign', 'padding']}
        value={data.style}
        onChange={(style) => updateData({ ...data, style })}
      />
    </BaseSidebarPanel>
  );
}
