// Copyright 2019 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Platform from '../../core/platform/platform.js';
import * as Persistence from '../persistence/persistence.js';

const {urlString} = Platform.DevToolsPath;

describe('PlatformFileSystem', () => {
  it('can be instantiated successfully', () => {
    const platformFileSystem = new Persistence.PlatformFileSystem.PlatformFileSystem(urlString`Test Path`, 'Test Type');
    assert.strictEqual(platformFileSystem.path(), 'Test Path', 'path was not set or retrieved correctly');
    assert.strictEqual(platformFileSystem.type(), 'Test Type', 'Type was not set or retrieved correctly');
  });

  // TODO continue writing tests here or use another describe block
});
