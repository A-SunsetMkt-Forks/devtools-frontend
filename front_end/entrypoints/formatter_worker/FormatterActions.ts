// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

export const enum FormatterActions {
  FORMAT = 'format',
  PARSE_CSS = 'parseCSS',
  JAVASCRIPT_SUBSTITUTE = 'javaScriptSubstitute',
  JAVASCRIPT_SCOPE_TREE = 'javaScriptScopeTree',
}

export const enum FormattableMediaTypes {
  APPLICATION_JAVASCRIPT = 'application/javascript',
  APPLICATION_JSON = 'application/json',
  APPLICATION_MANIFEST_JSON = 'application/manifest+json',
  TEXT_CSS = 'text/css',
  TEXT_HTML = 'text/html',
  TEXT_JAVASCRIPT = 'text/javascript',
}

export const FORMATTABLE_MEDIA_TYPES: string[] = [
  FormattableMediaTypes.APPLICATION_JAVASCRIPT,
  FormattableMediaTypes.APPLICATION_JSON,
  FormattableMediaTypes.APPLICATION_MANIFEST_JSON,
  FormattableMediaTypes.TEXT_CSS,
  FormattableMediaTypes.TEXT_HTML,
  FormattableMediaTypes.TEXT_JAVASCRIPT,
];

export interface FormatMapping {
  original: number[];
  formatted: number[];
}

export interface FormatResult {
  content: string;
  mapping: FormatMapping;
}

export const enum DefinitionKind {
  NONE = 0,
  LET = 1,
  VAR = 2,
  FIXED = 3,
}

export interface ScopeTreeNode {
  variables: Array<{name: string, kind: DefinitionKind, offsets: number[]}>;
  start: number;
  end: number;
  children: ScopeTreeNode[];
}
