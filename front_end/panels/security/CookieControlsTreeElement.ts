// Copyright 2024 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
import * as IconButton from '../../ui/components/icon_button/icon_button.js';

import {SecurityPanelSidebarTreeElement} from './SecurityPanelSidebarTreeElement.js';

export class CookieControlsTreeElement extends SecurityPanelSidebarTreeElement {
  constructor(title: string) {
    super(title);
    this.setLeadingIcons([IconButton.Icon.create('gear', 'cookie-icon')]);
  }

  override onselect(): boolean {
    this.listItemElement.dispatchEvent(new CustomEvent('showFlagControls', {bubbles: true, composed: true}));
    return true;
  }
}