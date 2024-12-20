// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
import * as LitHtml from '../../../ui/lit-html/lit-html.js';

import type {CellValue} from './DataGridUtils.js';

const {html} = LitHtml;

export const primitiveRenderer = (value: CellValue): LitHtml.TemplateResult => {
  return html`${value}`;
};

export const codeBlockRenderer = (value: CellValue): LitHtml.TemplateResult|typeof LitHtml.nothing => {
  if (!value) {
    return LitHtml.nothing;
  }
  const stringValue = String(value);
  return html`<code>${stringValue}</code>`;
};

export const iconRenderer = (icon: CellValue): LitHtml.TemplateResult|typeof LitHtml.nothing => {
  if (!icon) {
    return LitHtml.nothing;
  }
  return html`<div style="display: flex; justify-content: center;">${icon}</div>`;
};
