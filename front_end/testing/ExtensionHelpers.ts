// Copyright 2022 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type {Chrome} from '../../extension-api/ExtensionAPI.js';
import * as Host from '../core/host/host.js';
import * as Extensions from '../models/extensions/extensions.js';

import {describeWithEnvironment, setupActionRegistry} from './EnvironmentHelpers.js';
import {describeWithMockConnection} from './MockConnection.js';

interface ExtensionContext {
  chrome: Partial<Chrome.DevTools.Chrome>;
  extensionDescriptor: Extensions.ExtensionAPI.ExtensionDescriptor;
}

export function getExtensionOrigin() {
  return window.location.origin;
}

export function describeWithDevtoolsExtension(
    title: string, extension: Partial<Host.InspectorFrontendHostAPI.ExtensionDescriptor>,
    fn: (this: Mocha.Suite, context: ExtensionContext) => void) {
  const extensionDescriptor = {
    startPage: `${getExtensionOrigin()}/blank.html`,
    name: 'TestExtension',
    exposeExperimentalAPIs: true,
    allowFileAccess: false,
    ...extension,
  };
  const context: ExtensionContext = {
    extensionDescriptor,
    chrome: {},
  };

  function setup() {
    const server = Extensions.ExtensionServer.ExtensionServer.instance({forceNew: true});
    sinon.stub(server, 'addExtensionFrame');

    sinon.stub(Host.InspectorFrontendHost.InspectorFrontendHostInstance, 'setInjectedScriptForOrigin')
        .callsFake((origin, _script) => {
          if (origin === getExtensionOrigin()) {
            const chrome: Partial<Chrome.DevTools.Chrome> = {};
            (window as {chrome?: Partial<Chrome.DevTools.Chrome>}).chrome = chrome;
            self.injectedExtensionAPI(extensionDescriptor, 'main', 'dark', [], () => {}, 1, window);
            context.chrome = chrome;
          }
        });
    server.addExtension(extensionDescriptor);
  }

  function cleanup() {
    const chrome: Partial<Chrome.DevTools.Chrome> = {};
    (window as {chrome?: Partial<Chrome.DevTools.Chrome>}).chrome = chrome;
    context.chrome = chrome;
  }

  return describeWithMockConnection(`with-extension-${title}`, function() {
    beforeEach(cleanup);
    beforeEach(setup);
    afterEach(cleanup);

    describeWithEnvironment(title, function() {
      setupActionRegistry();
      fn.call(this, context);
    });
  });
}

describeWithDevtoolsExtension.only = function(
    title: string, extension: Partial<Host.InspectorFrontendHostAPI.ExtensionDescriptor>,
    fn: (this: Mocha.Suite, context: ExtensionContext) => void) {
  // eslint-disable-next-line mocha/no-exclusive-tests
  return describe.only('.only', function() {
    return describeWithDevtoolsExtension(title, extension, fn);
  });
};
