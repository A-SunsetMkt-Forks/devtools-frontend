// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
'use strict';

const rule = require('../lib/lit-html-host-this.js');
const tsParser = require('@typescript-eslint/parser');
const ruleTester = new (require('eslint').RuleTester)({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parser: tsParser,
  },
});

ruleTester.run('lit-html-host-this', rule, {
  valid: [
    {
      code: 'LitHtml.render(someHtml, this.shadow, {host: this})',
      filename: 'front_end/components/datagrid.ts',
    },
    {
      code: 'NotLitHtmlButSimilar.render(foo, bar)',
      filename: 'front_end/components/datagrid.ts',
    },
  ],
  invalid: [
    {
      code: 'LitHtml.render(someHtml, this.shadow)',
      filename: 'front_end/components/datagrid.ts',
      errors: [{messageId: 'missingHostOption'}],
      output: 'LitHtml.render(someHtml, this.shadow, {host: this})',
    },
    {
      code: 'LitHtml.render(someHtml, this.shadow, { renderBefore: foo })',
      filename: 'front_end/components/datagrid.ts',
      errors: [{messageId: 'missingHostOption'}],
      output: 'LitHtml.render(someHtml, this.shadow, { renderBefore: foo, host: this })',
    },
    {
      code: 'LitHtml.render(someHtml, this.shadow, { renderBefore: foo, })',
      filename: 'front_end/components/datagrid.ts',
      errors: [{messageId: 'missingHostOption'}],
      output: 'LitHtml.render(someHtml, this.shadow, { renderBefore: foo, host: this, })',
    },
    {
      code: 'LitHtml.render(someHtml, this.shadow, { host: notThis })',
      filename: 'front_end/components/datagrid.ts',
      errors: [{messageId: 'invalidHostOption'}],
    },
  ],
});
