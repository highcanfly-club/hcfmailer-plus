'use strict';

import axios from './axios';
import i18n from './i18n';
import { getSandboxUrl } from './urls';

// Widths are in stored pixels, i.e. twice the width the image has in a 600 px wide email (sharp on high-density screens)
export const DEFAULT_MAX_WIDTH = 1200;
export const SIZE_PRESETS = [
  { key: 'full', labelKey: 'aiSizeFull', maxWidth: 1200 },
  { key: 'half', labelKey: 'aiSizeHalf', maxWidth: 600 },
  { key: 'third', labelKey: 'aiSizeThird', maxWidth: 400 },
  { key: 'quarter', labelKey: 'aiSizeQuarter', maxWidth: 300 },
  { key: 'icon', labelKey: 'aiSizeIcon', maxWidth: 128 },
  { key: 'custom', labelKey: 'aiSizeCustom', maxWidth: null }
];

// The sandboxes are not React-hosted everywhere, so labels are resolved at call time through the shared i18n instance
export const sizePresetLabel = preset => i18n.t(preset.labelKey);

// The server clamps to 16..2400 px and never enlarges an image
export function sanitizeMaxWidth(value) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? DEFAULT_MAX_WIDTH : Math.min(2400, Math.max(16, n));
}

export async function uploadTemplateImage(editorType, entityTypeId, entityId, file, maxWidth) {
  if (!entityTypeId || !entityId) {
    throw new Error(i18n.t('aiSaveTemplateFirst'));
  }
  const form = new FormData();
  form.append('files[]', file);
  const res = await axios.post(getSandboxUrl(`${editorType}/upload/${entityTypeId}/${entityId}`), form, {
    params: { maxWidth: sanitizeMaxWidth(maxWidth) }
  });
  const url = res.data && res.data.files && res.data.files[0] && res.data.files[0].url;
  if (!url) {
    throw new Error(i18n.t('aiUploadFailed'));
  }
  return url;
}

// Plain-DOM size picker (used by the CKEditor 5 and GrapesJS sandboxes). Returns { element, getMaxWidth }.
export function createSizeSelector(doc = document) {
  const wrap = doc.createElement('div');
  wrap.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px;font:13px sans-serif;background:#f4f5f7;border-bottom:1px solid #ddd;';
  const label = doc.createElement('label');
  label.textContent = i18n.t('aiUploadSizeLabel');
  const select = doc.createElement('select');
  SIZE_PRESETS.forEach((p) => {
    const o = doc.createElement('option');
    o.value = p.key;
    o.textContent = sizePresetLabel(p);
    select.appendChild(o);
  });
  const custom = doc.createElement('input');
  custom.type = 'number';
  custom.min = '16';
  custom.max = '2400';
  custom.value = String(DEFAULT_MAX_WIDTH);
  custom.style.cssText = 'width:80px;display:none;';
  const unit = doc.createElement('span');
  unit.textContent = 'px';
  unit.style.display = 'none';
  select.addEventListener('change', () => {
    const isCustom = select.value === 'custom';
    custom.style.display = unit.style.display = isCustom ? '' : 'none';
  });
  wrap.append(label, select, custom, unit);

  return {
    element: wrap,
    getMaxWidth: () => {
      const preset = SIZE_PRESETS.find((p) => p.key === select.value);
      return preset && preset.maxWidth ? preset.maxWidth : sanitizeMaxWidth(custom.value);
    }
  };
}
