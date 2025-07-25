// Copyright 2021 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {assert} from 'chai';

import {
  click,
  clickElement,
  drainFrontendTaskQueue,
  enableExperiment,
  getBrowserAndPages,
  goToResource,
  hover,
  step,
  waitFor,
  waitForFunction,
  withControlOrMetaKey,
} from '../../shared/helper.js';
import {reloadDevTools} from '../helpers/cross-tool-helper.js';
import {getMenuItemAtPosition, getMenuItemTitleAtPosition, openFileQuickOpen} from '../helpers/quick_open-helpers.js';
import {
  addBreakpointForLine,
  addLogpointForLine,
  CODE_LINE_COLUMN_SELECTOR,
  getBreakpointHitLocation,
  isBreakpointSet,
  isEqualOrAbbreviation,
  openSourceCodeEditorForFile,
  PAUSE_INDICATOR_SELECTOR,
  RESUME_BUTTON,
  retrieveTopCallFrameWithoutResuming,
} from '../helpers/sources-helpers.js';

async function waitForTopCallFrameChanged(previousCallFrame: string, updatedCallFrame: string) {
  await waitForFunction(async () => {
    const actualTopCallFrame = await retrieveTopCallFrameWithoutResuming();
    assert.isTrue(actualTopCallFrame === previousCallFrame || actualTopCallFrame === updatedCallFrame);
    return actualTopCallFrame === updatedCallFrame;
  });
}

async function assertScriptLocation(expectedLocation: string) {
  const scriptLocation = await retrieveTopCallFrameWithoutResuming();
  assert.isOk(scriptLocation, 'Unable to retrieve script location for call frame');
  assert.isTrue(isEqualOrAbbreviation(scriptLocation, expectedLocation));
}

describe('The Sources Tab', function() {
  const CLICK_BREAKPOINT_SCRIPT = 'click-breakpoint.js';
  const CLICK_BREAKPOINT_HTML = 'click-breakpoint.html';

  it('sets and hits breakpoints in JavaScript', async () => {
    const {target} = getBrowserAndPages();
    await openSourceCodeEditorForFile(CLICK_BREAKPOINT_SCRIPT, CLICK_BREAKPOINT_HTML);
    await addBreakpointForLine(4);

    const scriptEvaluation = target.evaluate('f2();');

    const scriptLocation = await retrieveTopCallFrameWithoutResuming();
    assert.deepEqual(scriptLocation, `${CLICK_BREAKPOINT_SCRIPT}:4`);

    const breakpointLocation = await getBreakpointHitLocation();
    assert.deepEqual(breakpointLocation, scriptLocation);

    await click(RESUME_BUTTON);
    await scriptEvaluation;
  });

  it('can disable and re-enable breakpoints in JavaScript', async () => {
    const {target} = getBrowserAndPages();
    await openSourceCodeEditorForFile(CLICK_BREAKPOINT_SCRIPT, CLICK_BREAKPOINT_HTML);

    // After adding a breakpoint, we expect the script to pause. Resume afterwards.
    await addBreakpointForLine(4);
    await testScriptPauseAndResume();

    // Disable breakpoint. This time, we should not pause but be able to
    // run the script until the end.
    await click(`[aria-label="${CLICK_BREAKPOINT_SCRIPT}"] [aria-label="checked"] input`);
    await target.evaluate('f2();');

    // Re-enable breakpoint. Again, we should expect a pause and resume to finish the script.
    await click(`[aria-label="${CLICK_BREAKPOINT_SCRIPT}"] [aria-label="unchecked"] input`);
    await testScriptPauseAndResume();

    async function testScriptPauseAndResume() {
      const scriptEvaluation = target.evaluate('f2();');

      const scriptLocation = await retrieveTopCallFrameWithoutResuming();
      assert.deepEqual(scriptLocation, `${CLICK_BREAKPOINT_SCRIPT}:4`);

      await click(RESUME_BUTTON);
      await scriptEvaluation;
    }
  });

  it('can set and remove breakpoints in JavaScript', async () => {
    const {target} = getBrowserAndPages();
    await openSourceCodeEditorForFile(CLICK_BREAKPOINT_SCRIPT, CLICK_BREAKPOINT_HTML);
    await addBreakpointForLine(4);

    // Hover over breakpoint.
    await hover(`[aria-label="${CLICK_BREAKPOINT_SCRIPT}"] [aria-label="checked"]`);

    // Remove breakpoint.
    await click(`[aria-label="${CLICK_BREAKPOINT_SCRIPT}"] [aria-label="Remove breakpoint"]`);

    // Running the function should not pause anywhere.
    await target.evaluate('f2();');
  });

  it('doesn\'t synchronize breakpoints between scripts and source-mapped scripts', async () => {
    // Navigate to page with sourceURL annotation and set breakpoint in line 2.
    await openSourceCodeEditorForFile('breakpoint-conflict.js', 'breakpoint-conflict-source-url.html');
    await addBreakpointForLine(2);

    // Navigate to page with sourceMappingURL annotation and check that breakpoint did not sync.
    await openSourceCodeEditorForFile('breakpoint-conflict.js', 'breakpoint-conflict-source-map.html');
    assert.isFalse(await isBreakpointSet(2), 'Breakpoint found on line 2 which shouldn\'t be there');
  });

  it('stops at each breakpoint on resume (using F8) on target', async () => {
    const {target, frontend} = getBrowserAndPages();
    await step('navigate to page', async () => {
      await openSourceCodeEditorForFile(CLICK_BREAKPOINT_SCRIPT, CLICK_BREAKPOINT_HTML);
    });

    await step('add a breakpoint to line No.3, 4, and 9', async () => {
      await addBreakpointForLine(3);
      await addBreakpointForLine(4);
      await addBreakpointForLine(9);
    });

    let scriptEvaluation: Promise<void>;
    await step('trigger evaluation of script', async () => {
      scriptEvaluation = target.evaluate('f2();') as Promise<void>;
    });

    await step('wait for pause and check if we stopped at line 3', async () => {
      await waitFor(PAUSE_INDICATOR_SELECTOR);
      const scriptLocation = await retrieveTopCallFrameWithoutResuming();
      assert.deepEqual(scriptLocation, `${CLICK_BREAKPOINT_SCRIPT}:3`);
    });

    await step('resume and wait until we have hit the next breakpoint (3->4)', async () => {
      await target.keyboard.press('F8');
      await waitForTopCallFrameChanged(`${CLICK_BREAKPOINT_SCRIPT}:3`, `${CLICK_BREAKPOINT_SCRIPT}:4`);
    });

    await step('resume and wait until we have hit the next breakpoint (4->9)', async () => {
      await target.keyboard.press('F8');
      await waitForTopCallFrameChanged(`${CLICK_BREAKPOINT_SCRIPT}:4`, `${CLICK_BREAKPOINT_SCRIPT}:9`);
    });

    await step('resume and wait until script finishes execution', async () => {
      await frontend.keyboard.press('F8');
      await scriptEvaluation;
    });
  });

  it('can hit a breakpoint on the main thread on a fresh DevTools', async () => {
    await enableExperiment('instrumentation-breakpoints');
    await step('navigate to a page and open the Sources tab', async () => {
      await openSourceCodeEditorForFile('breakpoint-hit-on-first-load.js', 'breakpoint-hit-on-first-load.html');
    });

    await step('add a breakpoint to the beginning of the script', async () => {
      await addBreakpointForLine(1);
    });

    await step('Navigate to a different site to refresh devtools and remove back-end state', async () => {
      await reloadDevTools({removeBackendState: true, selectedPanel: {name: 'sources'}});
    });

    await step('Navigate back to test page', () => {
      void goToResource('sources/breakpoint-hit-on-first-load.html');
    });

    await step('wait for pause and check if we stopped at line 1', async () => {
      await waitFor(PAUSE_INDICATOR_SELECTOR);
      await assertScriptLocation('breakpoint-hit-on-first-load.js:1');
    });

    await step('Resume', async () => {
      await click(RESUME_BUTTON);
    });
  });

  it('can hit a breakpoint in an inline script on the main thread on a fresh DevTools', async () => {
    await enableExperiment('instrumentation-breakpoints');

    await step('navigate to a page and open the Sources tab', async () => {
      await openSourceCodeEditorForFile('breakpoint-hit-on-first-load.html', 'breakpoint-hit-on-first-load.html');
    });

    await step('add a breakpoint to the beginning of the inline script', async () => {
      await addBreakpointForLine(9);
    });

    await step('Navigate to a different site to refresh devtools and remove back-end state', async () => {
      await reloadDevTools({removeBackendState: true, selectedPanel: {name: 'sources'}});
    });

    await step('Navigate back to test page', () => {
      void goToResource('sources/breakpoint-hit-on-first-load.html');
    });

    await step('wait for pause and check if we stopped at line 9', async () => {
      await waitFor(PAUSE_INDICATOR_SELECTOR);
      await assertScriptLocation('breakpoint-hit-on-first-load.html:9');
    });

    await step('Resume', async () => {
      await click(RESUME_BUTTON);
    });
  });

  it('can hit a breakpoint in an inline script with sourceURL comment on the main thread on a fresh DevTools',
     async () => {
       await enableExperiment('instrumentation-breakpoints');
       const {frontend} = getBrowserAndPages();

       await step('navigate to a page and open the Sources tab', async () => {
         await openSourceCodeEditorForFile('breakpoint-hit-on-first-load.html', 'breakpoint-hit-on-first-load.html');
       });

       await step('open the hello.js file (inline script)', async () => {
         await openFileQuickOpen();
         await frontend.keyboard.type('hello.js');
         // TODO: it should actually wait for rendering to finish.
         await drainFrontendTaskQueue();

         const firstItemTitle = await getMenuItemTitleAtPosition(0);
         const firstItem = await getMenuItemAtPosition(0);
         assert.strictEqual(firstItemTitle, 'hello.js');
         await clickElement(firstItem);
       });

       await step('add a breakpoint to the beginning of the inline script with sourceURL', async () => {
         await addBreakpointForLine(2);
       });

       await step('Navigate to a different site to refresh devtools and remove back-end state', async () => {
         await reloadDevTools({removeBackendState: true, selectedPanel: {name: 'sources'}});
       });

       await step('Navigate back to test page', () => {
         void goToResource('sources/breakpoint-hit-on-first-load.html');
       });

       await step('wait for pause and check if we stopped at line 2', async () => {
         await waitFor(PAUSE_INDICATOR_SELECTOR);
         await assertScriptLocation('hello.js:2');
       });

       await step('Resume', async () => {
         await click(RESUME_BUTTON);
       });
     });

  it('shows a tooltip for logpoints', async () => {
    await openSourceCodeEditorForFile(CLICK_BREAKPOINT_SCRIPT, CLICK_BREAKPOINT_HTML);
    await addLogpointForLine(4, '14');

    const tooltip = await waitFor('.cm-breakpoint-logpoint devtools-tooltip');
    assert.strictEqual(await tooltip.evaluate(e => e.textContent), '14');
  });

  describe('The breakpoint edit dialog', () => {
    it('shows up on Ctrl/Meta + click if no breakpoint was set', async () => {
      await openSourceCodeEditorForFile(CLICK_BREAKPOINT_SCRIPT, CLICK_BREAKPOINT_HTML);
      const lineNumberColumn = await waitFor(CODE_LINE_COLUMN_SELECTOR);
      await withControlOrMetaKey(async () => {
        await click('text/4', {root: lineNumberColumn});
      });
      await waitFor('.sources-edit-breakpoint-dialog');
    });

    it('shows up on Ctrl/Meta + click if breakpoint was already set', async () => {
      await openSourceCodeEditorForFile(CLICK_BREAKPOINT_SCRIPT, CLICK_BREAKPOINT_HTML);
      await addBreakpointForLine(4);

      const lineNumberColumn = await waitFor(CODE_LINE_COLUMN_SELECTOR);
      await withControlOrMetaKey(async () => {
        await click('text/4', {root: lineNumberColumn});
      });
      await waitFor('.sources-edit-breakpoint-dialog');
    });
  });
});
