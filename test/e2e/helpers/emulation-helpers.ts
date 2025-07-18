// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
import type * as puppeteer from 'puppeteer-core';

import {
  $,
  click,
  clickElement,
  getBrowserAndPages,
  goToResource,
  waitFor,
} from '../../shared/helper.js';
import {getBrowserAndPagesWrappers} from '../../shared/non_hosted_wrappers.js';

import {
  reloadDevTools,
} from './cross-tool-helper.js';

const DEVICE_TOOLBAR_TOGGLER_SELECTOR = '[aria-label="Toggle device toolbar"]';
const DEVICE_TOOLBAR_SELECTOR = '.device-mode-toolbar';
const DEVICE_TOOLBAR_OPTIONS_SELECTOR = '.device-mode-toolbar .device-mode-toolbar-options';
const MEDIA_QUERY_INSPECTOR_SELECTOR = '.media-inspector-view';
const DEVICE_LIST_DROPDOWN_SELECTOR = '.toolbar-button';
const ZOOM_LIST_DROPDOWN_SELECTOR = '[aria-label*="Zoom"]';
const SURFACE_DUO_MENU_ITEM_SELECTOR = '[aria-label*="Surface Duo"]';
const FOLDABLE_DEVICE_MENU_ITEM_SELECTOR = '[aria-label*="Asus Zenbook Fold"]';
const EDIT_MENU_ITEM_SELECTOR = '[aria-label*="Edit"]';
const TEST_DEVICE_MENU_ITEM_SELECTOR = '[aria-label*="Test device, unchecked"]';
const DUAL_SCREEN_BUTTON_SELECTOR = '[aria-label="Toggle dual-screen mode"]';
const DEVICE_POSTURE_DROPDOWN_SELECTOR = '[aria-label="Device posture"]';
const SCREEN_DIM_INPUT_SELECTOR = '[title="Width"]';
const AUTO_AUTO_ADJUST_ZOOM_SELECTOR = '[aria-label*="Auto-adjust zoom"]';

export const reloadDockableFrontEnd = async () => {
  await reloadDevTools({canDock: true});
};

export const deviceModeIsEnabled = async (inspectedPage = getBrowserAndPagesWrappers().inspectedPage) => {
  // Check the userAgent string to see whether emulation is really enabled.
  const userAgent = await inspectedPage.evaluate(() => navigator.userAgent);
  return userAgent.includes('Mobile');
};

export const clickDeviceModeToggler = async (devToolsPage = getBrowserAndPagesWrappers().devToolsPage) => {
  const deviceToolbarToggler = await devToolsPage.waitFor(DEVICE_TOOLBAR_TOGGLER_SELECTOR);
  await devToolsPage.clickElement(deviceToolbarToggler);
};

export const openDeviceToolbar = async (
    devToolsPage = getBrowserAndPagesWrappers().devToolsPage,
    inspectedPage = getBrowserAndPagesWrappers().inspectedPage) => {
  if (await deviceModeIsEnabled(inspectedPage)) {
    return;
  }
  await clickDeviceModeToggler(devToolsPage);
  await devToolsPage.waitFor(DEVICE_TOOLBAR_SELECTOR);
};

export const showMediaQueryInspector = async () => {
  const inspector = await $(MEDIA_QUERY_INSPECTOR_SELECTOR);
  if (inspector) {
    return;
  }
  await click(DEVICE_TOOLBAR_OPTIONS_SELECTOR);
  const {frontend} = getBrowserAndPages();
  await frontend.keyboard.press('ArrowDown');
  await frontend.keyboard.press('Enter');
  await waitFor(MEDIA_QUERY_INSPECTOR_SELECTOR);
};

export const startEmulationWithDualScreenPage = async () => {
  await reloadDockableFrontEnd();
  await goToResource('emulation/dual-screen-inspector.html');
  await waitFor('.tabbed-pane-left-toolbar');
  await openDeviceToolbar();
};

export const getButtonDisabled = async (spanButton: puppeteer.ElementHandle<HTMLButtonElement>) => {
  return await spanButton.evaluate(e => {
    return e.disabled;
  });
};

export const clickDevicesDropDown = async (devToolsPage = getBrowserAndPagesWrappers().devToolsPage) => {
  const toolbar = await devToolsPage.waitFor(DEVICE_TOOLBAR_SELECTOR);
  await devToolsPage.click(DEVICE_LIST_DROPDOWN_SELECTOR, {root: toolbar});
};

export const clickDevicePostureDropDown = async () => {
  const toolbar = await waitFor(DEVICE_TOOLBAR_SELECTOR);
  await click(DEVICE_POSTURE_DROPDOWN_SELECTOR, {root: toolbar});
};

export const clickZoomDropDown = async () => {
  const toolbar = await waitFor(DEVICE_TOOLBAR_SELECTOR);
  await click(ZOOM_LIST_DROPDOWN_SELECTOR, {root: toolbar});
};

export const clickWidthInput = async () => {
  const toolbar = await waitFor(DEVICE_TOOLBAR_SELECTOR);
  await click(SCREEN_DIM_INPUT_SELECTOR, {root: toolbar});
};

export const selectToggleButton = async () => {
  // button that toggles between single and double screen.
  const toggleButton = await $(DUAL_SCREEN_BUTTON_SELECTOR) as puppeteer.ElementHandle<HTMLButtonElement>;
  return toggleButton;
};

export const selectEdit = async () => {
  await clickDevicesDropDown();
  await click(EDIT_MENU_ITEM_SELECTOR);
  await waitForNotExpanded(DEVICE_LIST_DROPDOWN_SELECTOR);
};

export const selectDevice = async (name: string, devToolsPage = getBrowserAndPagesWrappers().devToolsPage) => {
  await clickDevicesDropDown(devToolsPage);
  await devToolsPage.click(`[aria-label*="${name}, unchecked"]`);
  await waitForNotExpanded(DEVICE_LIST_DROPDOWN_SELECTOR, devToolsPage);
};

export const selectTestDevice = async () => {
  await clickDevicesDropDown();
  await click(TEST_DEVICE_MENU_ITEM_SELECTOR);
  await waitForNotExpanded(DEVICE_LIST_DROPDOWN_SELECTOR);
};

// Test if span button works when emulating a dual screen device.
export const selectDualScreen = async () => {
  await clickDevicesDropDown();
  await click(SURFACE_DUO_MENU_ITEM_SELECTOR);
  await waitForNotExpanded(DEVICE_LIST_DROPDOWN_SELECTOR);
};

export const selectFoldableDevice = async () => {
  await clickDevicesDropDown();
  await click(FOLDABLE_DEVICE_MENU_ITEM_SELECTOR);
  await waitForNotExpanded(DEVICE_LIST_DROPDOWN_SELECTOR);
};

const waitForNotExpanded = async (selector: string, devToolsPage = getBrowserAndPagesWrappers().devToolsPage) => {
  const toolbar = await devToolsPage.waitFor(DEVICE_TOOLBAR_SELECTOR);
  const dropdown = await devToolsPage.waitFor(selector, toolbar);
  await devToolsPage.waitForFunction(async () => {
    const expanded = await dropdown.evaluate(el => el.getAttribute('aria-expanded'));
    return expanded === null;
  });
};

export const waitForZoomDropDownNotExpanded = async () => {
  await waitForNotExpanded(ZOOM_LIST_DROPDOWN_SELECTOR);
};

export const clickDevicePosture = async (name: string) => {
  await clickDevicePostureDropDown();
  await click(`[aria-label*="${name}, unchecked"]`);
  await waitForNotExpanded(DEVICE_POSTURE_DROPDOWN_SELECTOR);
};

export const getDevicePostureDropDown = async () => {
  // dropdown menu for the posture selection.
  const dropdown = await $(DEVICE_POSTURE_DROPDOWN_SELECTOR) as puppeteer.ElementHandle<HTMLButtonElement>;
  return dropdown;
};

export const clickToggleButton = async () => {
  // make sure the toggle button is clickable.
  const toggleButton = await selectToggleButton();
  await clickElement(toggleButton);
};

export const getWidthOfDevice = async () => {
  // Read the width of spanned duo to make sure spanning works.
  const widthInput = await waitFor(SCREEN_DIM_INPUT_SELECTOR);
  return await widthInput.evaluate(e => (e as HTMLInputElement).value);
};

export const getZoom = async () => {
  // Read the width of spanned duo to make sure spanning works.
  const widthInput = await waitFor(ZOOM_LIST_DROPDOWN_SELECTOR);
  return await widthInput.evaluate(e => (e as HTMLInputElement).innerText);
};

export const toggleAutoAdjustZoom = async () => {
  await clickZoomDropDown();
  await click(AUTO_AUTO_ADJUST_ZOOM_SELECTOR);
  await waitForZoomDropDownNotExpanded();
};

const IPAD_MENU_ITEM_SELECTOR = '[aria-label*="iPad"]';

// Test if span button is clickable when emulating a non-dual-screen device.
export const selectNonDualScreenDevice = async () => {
  await clickDevicesDropDown();
  await click(IPAD_MENU_ITEM_SELECTOR);
  await waitForNotExpanded(DEVICE_LIST_DROPDOWN_SELECTOR);
};
