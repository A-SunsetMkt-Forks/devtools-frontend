// Copyright 2023 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview The sources panel (via DebuggerPausedMessage) and the
 * "browser_debugger" module both require localized CategorizedBreakpoint
 * names. We put them "upstream" into "panels/sources" so they are
 * available to both.
 */

import * as i18n from '../../core/i18n/i18n.js';
import type * as Platform from '../../core/platform/platform.js';
import * as SDK from '../../core/sdk/sdk.js';
import * as Protocol from '../../generated/protocol.js';

const UIStrings = {
  /**
   * @description Name of a breakpoint type.
   * https://github.com/WICG/turtledove/blob/main/FLEDGE.md#32-on-device-bidding
   */
  beforeBidderWorkletBiddingStart: 'Bidder Bidding Phase Start',

  /**
   * @description Name of a breakpoint type.
   * https://github.com/WICG/turtledove/blob/main/FLEDGE.md#52-buyer-reporting-on-render-and-ad-events
   */
  beforeBidderWorkletReportingStart: 'Bidder Reporting Phase Start',

  /**
   * @description Name of a breakpoint type.
   * https://github.com/WICG/turtledove/blob/main/FLEDGE.md#23-scoring-bids
   */
  beforeSellerWorkletScoringStart: 'Seller Scoring Phase Start',

  /**
   * @description Name of a breakpoint type.
   * https://github.com/WICG/turtledove/blob/main/FLEDGE.md#51-seller-reporting-on-render
   */
  beforeSellerWorkletReportingStart: 'Seller Reporting Phase Start',
  /**
   *@description Text in the Event Listener Breakpoints Panel of the JavaScript Debugger in the Sources Panel
   *@example {setTimeout} PH1
   */
  setTimeoutOrIntervalFired: '{PH1} fired',
  /**
   *@description Text in the Event Listener Breakpoints Panel of the JavaScript Debugger in the Sources Panel
   */
  scriptFirstStatement: 'Script First Statement',
  /**
   *@description Text in the Event Listener Breakpoints Panel of the JavaScript Debugger in the Sources Panel
   */
  scriptBlockedByContentSecurity: 'Script Blocked by Content Security Policy',
  /**
   *@description Text for the request animation frame event
   */
  requestAnimationFrame: 'Request Animation Frame',
  /**
   *@description Text to cancel the animation frame
   */
  cancelAnimationFrame: 'Cancel Animation Frame',
  /**
   *@description Text for the event that an animation frame is fired
   */
  animationFrameFired: 'Animation Frame Fired',
  /**
   *@description Text in the Event Listener Breakpoints Panel of the JavaScript Debugger in the Sources Panel
   */
  webglErrorFired: 'WebGL Error Fired',
  /**
   *@description Text in the Event Listener Breakpoints Panel of the JavaScript Debugger in the Sources Panel
   */
  webglWarningFired: 'WebGL Warning Fired',
  /**
   *@description Text in the Event Listener Breakpoints Panel of the JavaScript Debugger in the Sources Panel
   */
  setInnerhtml: 'Set `innerHTML`',
  /**
   *@description Name of a breakpoint type in the Sources Panel.
   */
  createCanvasContext: 'Create canvas context',
  /**
   *@description Name of a breakpoint type in the Sources Panel.
   */
  createAudiocontext: 'Create `AudioContext`',
  /**
   *@description Name of a breakpoint type in the Sources Panel. Close is a verb.
   */
  closeAudiocontext: 'Close `AudioContext`',
  /**
   *@description Name of a breakpoint type in the Sources Panel. Resume is a verb.
   */
  resumeAudiocontext: 'Resume `AudioContext`',
  /**
   *@description Name of a breakpoint type in the Sources Panel.
   */
  suspendAudiocontext: 'Suspend `AudioContext`',
  /**
   * @description Noun. Title for a checkbox that turns on breakpoints on Trusted Type sink violations.
   * "Trusted Types" is a Web API. A "Sink" (Noun, singular) is a special function, akin to a data sink, that expects
   * to receive data in a specific format. Should the data be in the wrong format, or something else
   * go wrong, its called a "sink violation".
   */
  sinkViolations: 'Sink Violations',
  /**
   *@description Title for a checkbox that turns on breakpoints on Trusted Type policy violations
   */
  policyViolations: 'Policy Violations',
} as const;
const str_ = i18n.i18n.registerUIStrings('panels/sources/CategorizedBreakpointL10n.ts', UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(undefined, str_);

export function getLocalizedBreakpointName(name: string): Platform.UIString.LocalizedString {
  const l10nLazyName = LOCALIZED_NAMES.get(name) ?? i18n.i18n.lockedLazyString(name);
  return l10nLazyName();
}

const LOCALIZED_INSTRUMENTATION_NAMES:
    Record<SDK.EventBreakpointsModel.InstrumentationNames, () => Platform.UIString.LocalizedString> = {
      [SDK.EventBreakpointsModel.InstrumentationNames.BEFORE_BIDDER_WORKLET_BIDDING_START]:
          i18nLazyString(UIStrings.beforeBidderWorkletBiddingStart),
      [SDK.EventBreakpointsModel.InstrumentationNames.BEFORE_BIDDER_WORKLET_REPORTING_START]:
          i18nLazyString(UIStrings.beforeBidderWorkletReportingStart),
      [SDK.EventBreakpointsModel.InstrumentationNames.BEFORE_SELLER_WORKLET_SCORING_START]:
          i18nLazyString(UIStrings.beforeSellerWorkletScoringStart),
      [SDK.EventBreakpointsModel.InstrumentationNames.BEFORE_SELLER_WORKLET_REPORTING_START]:
          i18nLazyString(UIStrings.beforeSellerWorkletReportingStart),
      [SDK.EventBreakpointsModel.InstrumentationNames.SET_TIMEOUT]: i18n.i18n.lockedLazyString('setTimeout'),
      [SDK.EventBreakpointsModel.InstrumentationNames.CLEAR_TIMEOUT]: i18n.i18n.lockedLazyString('clearTimeout'),
      [SDK.EventBreakpointsModel.InstrumentationNames.SET_TIMEOUT_CALLBACK]:
          i18nLazyString(UIStrings.setTimeoutOrIntervalFired, {PH1: 'setTimeout'}),
      [SDK.EventBreakpointsModel.InstrumentationNames.SET_INTERVAL]: i18n.i18n.lockedLazyString('setInterval'),
      [SDK.EventBreakpointsModel.InstrumentationNames.CLEAR_INTERVAL]: i18n.i18n.lockedLazyString('clearInterval'),
      [SDK.EventBreakpointsModel.InstrumentationNames.SET_INTERVAL_CALLBACK]:
          i18nLazyString(UIStrings.setTimeoutOrIntervalFired, {PH1: 'setInterval'}),
      [SDK.EventBreakpointsModel.InstrumentationNames.SCRIPT_FIRST_STATEMENT]:
          i18nLazyString(UIStrings.scriptFirstStatement),
      [SDK.EventBreakpointsModel.InstrumentationNames.SCRIPT_BLOCKED_BY_CSP]:
          i18nLazyString(UIStrings.scriptBlockedByContentSecurity),
      [SDK.EventBreakpointsModel.InstrumentationNames.SHARED_STORAGE_WORKLET_SCRIPT_FIRST_STATEMENT]:
          i18nLazyString(UIStrings.scriptFirstStatement),
      [SDK.EventBreakpointsModel.InstrumentationNames.REQUEST_ANIMATION_FRAME]:
          i18nLazyString(UIStrings.requestAnimationFrame),
      [SDK.EventBreakpointsModel.InstrumentationNames.CANCEL_ANIMATION_FRAME]:
          i18nLazyString(UIStrings.cancelAnimationFrame),
      [SDK.EventBreakpointsModel.InstrumentationNames.REQUEST_ANIMATION_FRAME_CALLBACK]:
          i18nLazyString(UIStrings.animationFrameFired),
      [SDK.EventBreakpointsModel.InstrumentationNames.WEBGL_ERROR_FIRED]: i18nLazyString(UIStrings.webglErrorFired),
      [SDK.EventBreakpointsModel.InstrumentationNames.WEBGL_WARNING_FIRED]: i18nLazyString(UIStrings.webglWarningFired),
      [SDK.EventBreakpointsModel.InstrumentationNames.ELEMENT_SET_INNER_HTML]: i18nLazyString(UIStrings.setInnerhtml),
      [SDK.EventBreakpointsModel.InstrumentationNames.CANVAS_CONTEXT_CREATED]:
          i18nLazyString(UIStrings.createCanvasContext),
      [SDK.EventBreakpointsModel.InstrumentationNames.GEOLOCATION_GET_CURRENT_POSITION]:
          i18n.i18n.lockedLazyString('getCurrentPosition'),
      [SDK.EventBreakpointsModel.InstrumentationNames.GEOLOCATION_WATCH_POSITION]:
          i18n.i18n.lockedLazyString('watchPosition'),
      [SDK.EventBreakpointsModel.InstrumentationNames.NOTIFICATION_REQUEST_PERMISSION]:
          i18n.i18n.lockedLazyString('requestPermission'),
      [SDK.EventBreakpointsModel.InstrumentationNames.DOM_WINDOW_CLOSE]: i18n.i18n.lockedLazyString('window.close'),
      [SDK.EventBreakpointsModel.InstrumentationNames.DOCUMENT_WRITE]: i18n.i18n.lockedLazyString('document.write'),
      [SDK.EventBreakpointsModel.InstrumentationNames.AUDIO_CONTEXT_CREATED]:
          i18nLazyString(UIStrings.createAudiocontext),
      [SDK.EventBreakpointsModel.InstrumentationNames.AUDIO_CONTEXT_CLOSED]:
          i18nLazyString(UIStrings.closeAudiocontext),
      [SDK.EventBreakpointsModel.InstrumentationNames.AUDIO_CONTEXT_RESUMED]:
          i18nLazyString(UIStrings.resumeAudiocontext),
      [SDK.EventBreakpointsModel.InstrumentationNames.AUDIO_CONTEXT_SUSPENDED]:
          i18nLazyString(UIStrings.suspendAudiocontext),
    };

const LOCALIZED_CSP_VIOLATION_TYPES:
    Record<Protocol.DOMDebugger.CSPViolationType, () => Platform.UIString.LocalizedString> = {
      [Protocol.DOMDebugger.CSPViolationType.TrustedtypePolicyViolation]: i18nLazyString(UIStrings.policyViolations),
      [Protocol.DOMDebugger.CSPViolationType.TrustedtypeSinkViolation]: i18nLazyString(UIStrings.sinkViolations),
    };

const LOCALIZED_NAMES = new Map<string, () => Platform.UIString.LocalizedString>([
  ...Object.entries(LOCALIZED_INSTRUMENTATION_NAMES),
  ...Object.entries(LOCALIZED_CSP_VIOLATION_TYPES),
]);
