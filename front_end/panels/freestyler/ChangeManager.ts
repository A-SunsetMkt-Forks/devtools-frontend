// Copyright 2024 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Common from '../../core/common/common.js';
import * as SDK from '../../core/sdk/sdk.js';
import type * as Protocol from '../../generated/protocol.js';

export type Change = {
  selector: string,
  styles: string,
};

export const AI_ASSISTANT_CSS_CLASS_NAME = 'ai-assistant-change';

/**
 * Keeps track of changes done by Freestyler. Currently, it is primarily
 * for stylesheet generation based on all changes.
 */
export class ChangeManager {
  readonly #stylesheetMutex = new Common.Mutex.Mutex();
  readonly #cssModelToStylesheetId =
      new Map<SDK.CSSModel.CSSModel, Map<Protocol.Page.FrameId, Protocol.CSS.StyleSheetId>>();
  readonly #stylesheetChanges = new Map<Protocol.CSS.StyleSheetId, Change[]>();

  async #getStylesheet(cssModel: SDK.CSSModel.CSSModel, frameId: Protocol.Page.FrameId):
      Promise<Protocol.CSS.StyleSheetId> {
    return await this.#stylesheetMutex.run(async () => {
      let frameToStylesheet = this.#cssModelToStylesheetId.get(cssModel);
      if (!frameToStylesheet) {
        frameToStylesheet = new Map();
        this.#cssModelToStylesheetId.set(cssModel, frameToStylesheet);
        cssModel.addEventListener(SDK.CSSModel.Events.ModelDisposed, this.#onCssModelDisposed, this);
      }
      let stylesheetId = frameToStylesheet.get(frameId);
      if (!stylesheetId) {
        const styleSheetHeader = await cssModel.createInspectorStylesheet(frameId);
        if (!styleSheetHeader) {
          throw new Error('inspector-stylesheet is not found');
        }
        stylesheetId = styleSheetHeader.id;
      }
      return stylesheetId;
    });
  }

  async #onCssModelDisposed(event: Common.EventTarget.EventTargetEvent<SDK.CSSModel.CSSModel>): Promise<void> {
    return await this.#stylesheetMutex.run(async () => {
      const cssModel = event.data;
      cssModel.removeEventListener(SDK.CSSModel.Events.ModelDisposed, this.#onCssModelDisposed, this);
      const stylesheetIds = Array.from(this.#cssModelToStylesheetId.get(cssModel)?.values() ?? []);
      // Empty stylesheets.
      const results = await Promise.allSettled(stylesheetIds.map(async id => {
        this.#stylesheetChanges.delete(id);
        await cssModel.setStyleSheetText(id, '', true);
      }));
      this.#cssModelToStylesheetId.delete(cssModel);
      const firstFailed = results.find(result => result.status === 'rejected');
      if (firstFailed) {
        throw new Error(firstFailed.reason);
      }
    });
  }

  async clear(): Promise<void> {
    const models = Array.from(this.#cssModelToStylesheetId.keys());
    const results = await Promise.allSettled(models.map(async model => {
      await this.#onCssModelDisposed({data: model});
    }));
    this.#cssModelToStylesheetId.clear();
    this.#stylesheetChanges.clear();
    const firstFailed = results.find(result => result.status === 'rejected');
    if (firstFailed) {
      throw new Error(firstFailed.reason);
    }
  }

  async addChange(cssModel: SDK.CSSModel.CSSModel, frameId: Protocol.Page.FrameId, change: Change): Promise<void> {
    const stylesheetId = await this.#getStylesheet(cssModel, frameId);
    const changes = this.#stylesheetChanges.get(stylesheetId) || [];
    changes.push(change);
    await cssModel.setStyleSheetText(stylesheetId, this.buildChanges(changes), true);
    this.#stylesheetChanges.set(stylesheetId, changes);
  }

  buildChanges(changes: Array<Change>): string {
    return `.${AI_ASSISTANT_CSS_CLASS_NAME} {
${
        changes
            .map(change => {
              return `  ${change.selector}& {
    ${change.styles}
  }`;
            })
            .join('\n')}
}`;
  }
}