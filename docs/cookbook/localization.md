# Localization

## How to add a localizable string

When you introduce a new UI string or modify an existing one that will be
displayed to the users, or remove a string that is localized, follow these steps
so that it can be localized.

[TOC]

### Adding a string

Before proceeding, make sure you know the different
[localization APIs](#what-are-the-l10n-apis) and know which one you should use.

Code example:

```js
import * as i18n from '../i18n/i18n.js';

// at the top of example.js file, after import statements
const UIStrings = {
  /**
   * @description A string that is already added
   */
  alreadyAddedString:
    'Someone already created a "UIStrings = {}" and added this string',
  /**
   * @description This is an example description for my new string
   */
  addThisString: 'The new string I want to add',
  /**
   * @description This is an example description for my new
   * string with placeholder
   * @example {example for placeholder} PH1
   */
  addAnotherString: 'Another new string I want to add, with {PH1}',
} as const;
const str_ = i18n.i18n.registerUIStrings('example.js', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);

// ....

// in example.js file, where you want to call the string

const message1 = i18nString(UIStrings.addThisString);
console.log(message1); // The new string I want to add

const message2 = i18nString(UIStrings.addAnotherString, {
  PH1: 'a placeholder',
});
// Another new string I want to add, with a placeholder
console.log(message2);
```

1.  If there is already `UIStrings = {}` declared in the file, add your string
    to it. If there isn't `UIStrings = {}` in the file, create one and add your
    string, also register the new UIStrings into the `en-US.json` by adding:

    ```js
    // Filename should be relative to front_end folder
    const str_ = i18n.i18n.registerUIStrings('<filename>', UIStrings);
    const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);
    ```

2.  Add description and examples for placeholder (if any):

    1.  To specify the description, use `@description …` `@description This is an example description for my new string`
    2.  To specify an example for placeholder, use `@example {…} …` `@example {example for placeholder} PH1`
    3.  To distinguish messages with the same content, use `@meaning …`
        `@meaning This is an example meaning to differentiate this message from the other message with same content`

3.  Make sure your string is localizable:

    1.  Do not assume word order by using concatenation. Use the whole string.

    - ❌ `javascript 'Add' + 'breakpoint'`
    - ✔️ `javascript 'Add breakpoint'` or
    - ❌ `javascript let description = 'first part' if (condition) description +=' second part'`
    - ✔️ `javascript let description if (condition) description = 'first part second part' else description = 'first part'`

    2.  Use placeholder over concatenation. This is so that the translators can
        adjust variable order based on what works in another language. For
        example:
        - ❌ `javascript 'Check ' + title + ' for more information.'`
        - ✔️ `javascript 'Check {PH1} for more information.', {PH1: title}`
    3.  If your string contains <b>leading or trailing white space</b>, it's
        usually an indication that it's half of a sentence. This decreases
        localizability as it's essentially concatenating. Modify it so that it
        doesn't contain leading or trailing white space anymore if you can.
    4.  <b>Backticks</b> are only used for the text that should not be
        localized. They cannot be escaped as part of the string. Check if there
        are something should not be localized (see
        [locked terms](#phrases-that-are-fully-locked) for more details).

        ❌ Not localized

        - Numbers: 1, 1.23, 1.2e3, etc.
        - Application data: error codes, enums, database names, rgba, urls,
          etc.

        ✔️ Can be localized

        - Words and sentences
        - Punctuation
        - Units of measurement: kb/s, mph, etc.

4.  The following commands would add the new strings to `en-US.json`:

    - `git cl presubmit --upload`, or
    - `node third_party/i18n/collect-strings.js` under the DevTools src folder

5.  Strings containing possible plurals have a special format in ICU. This is
    because plurals work quite differently in other languages, e.g. special
    forms for two or three items.

    ❌ `javascript if (count === 1) { str = '1 breakpoint'; } else { str = '{n} breakpoints', {n: count}; }`

    ✔️ `javascript '{n, plural, =1 {# breakpoint} other {# breakpoints}}', {n:count};`

    - `#` is replaced with the value of `n`
    - `n` is a naming convention, but any name can be used
    - Nesting placeholders inside of plurals is allowed
    - Put the entire string within the plural switch, e.g. `{# breakpoints were found}`, not `{# breakpoints} were found`
    - Always provide the `=1` and the `other` case, even if they are the same
      for English.

### Modifying a string

1.  Update the string you want to modify in `UIStrings`
2.  Update the description and placeholders of the string if necessary

### Removing a string

1.  Remove your string and the metadata from `UIStrings`

## What are the l10n APIs?

Access localized strings in the DevTools frontend using the following
localization calls.

### i18nString

The basic API to make a string (with or without placeholder) localizable. The
first argument is the string reference in `UIStrings` The second argument is an
object for placeholders (if any)

```js
// at the top of example.js file, after import statements

const UIStrings = {
  /**
   * @description This is an example description for my new string with placeholder
   * @example {example for placeholder} PH1
   * @example {example 2 for placeholder 2} PH2
   */
  addAnotherString: 'Another new string I want to add, with {PH1} and {PH2}',
} as const;

message = i18nString(UIStrings.addAnotherString, {
  PH1: 'a placeholder',
  PH2: 'another placeholder',
});
```

### i18nLazyString

The `i18nString` function returns the translated string, with placeholders
resolved. To do this, it needs access to the translated strings for the user's
locale, which are not available until after DevTools has finished starting up.

Calls to `i18nString` in the module scope will therefore fail when the module is
imported.

```js
// Fails because i18nString runs at module-import time.
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.CONSOLE,
  title: i18nString(UIStrings.groupSimilarMessagesInConsole),
...

function notTopLevel() {
  console.log(extension.title);
}
```

`i18nLazyString` fixes this problem by providing the same API, but returning a
closure that returns a `LocalizedString`. It can be used in top-level calls;
just make sure use-sites know it's a function now.

```js
// Works because i18nLazyString defers the loading of the translated string until later.
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.CONSOLE,
  title: i18nLazyString(UIStrings.groupSimilarMessagesInConsole),
...

// Note we need to call title() now.
function notTopLevel() {
  console.log(extension.title());
}
```

### i18n.i18n.getFormatLocalizedString

This call returns a **span element**, not a string. It is used when you want to
construct a DOM element with a localizable string, or localizable content that
contains some other DOM element.

```js
// Create the string in UIString
/**
*@description Message in Coverage View of the Coverage tab
*@example {reload button icon} PH1
*@example {record button icon} PH2
*/
clickTheRecordButtonSToStart: 'Click the reload button {PH1} to reload or record button {PH2} start capturing coverage.',

// Element with localizable content containing two DOM elements that are buttons
const reloadButton = UI.createInlineButton(UI.Toolbar.createActionButton('coverage.start-with-reload'));
const recordButton = UI.createInlineButton(UI.Toolbar.createActionButton(this._toggleRecordAction));
message = i18n.i18n.getFormatLocalizedString(str_, UIStrings.clickTheReloadButtonSToReloadAnd, {PH1: reloadButton, PH2:recordButton });
```

### i18n.i18n.lockedString

This call is a named cast. Use it in places where a localized string is expected
but the term you want to use does not require translation. Instead of locking
the whole phrase or using a placeholder-only phrase, use `lockedString`.

```js
someFunctionRequiringALocalizedString(i18n.i18n.lockedString('HTTP'));
```

## How to write good descriptions

Good descriptions can improve localizability by providing more context to the
translators. There are some details that are very important to have in other
languages!

**Good description**:

```js
const UIStrings = {
  /**
   * @description Tooltip text that appears when hovering over the 'Focusable' attribute name under the Computed Properties section in the Accessibility pane of the Elements pane.
   */
  computedPropertyTooltip: 'If true, this element can receive focus.',
} as const;
```

**Bad description**:

```js
const UIStrings = {
  /**
   * @description Elements pane 'Focusable' tooltip.
   */
  computedPropertyTooltip: 'If true, this element can receive focus.',
} as const;
```

### What information should I provide in the message description?

- The type of UI element where the text is displayed. Is it regular text, a
  label, button text, a tooltip, a link, or an accessible label? Button text
  is often imperative i.e. a command to do something, which is important to
  know in some languages.
- _When_: What triggers the string and/or what is the result? What page or
  text comes before and after? e.g. "Status text while waiting for X", "Shown
  when the audit is finished and X error was encountered".
- What do the placeholders stand for? Placeholder examples are sent to
  translators, but extra information in the description will help too. e.g.
  "Total time in ms that the profile took to complete", "The CSS property name
  that is being edited"
- Is this a verb or a noun? Many words in English can be both, e.g. 'request',
  'address', 'change', 'display', 'increase'. Particularly if the string is
  short, this can be hard to guess. If it's an adjective, what does it refer
  to? This is important for inflection in some languages, where the ending of
  the adjective must change for gender or case.
- Explain or name any complex terms, e.g. "Trust Tokens are a web API -
  https://web.dev/trust-tokens/"
- Where is the text located? e.g. A table header in the Sources panel, a
  context-menu item in the Network panel. Many strings in the code base have
  _only_ the location, which is not the most important context.

## How to prevent a term being localized

Any text within the backticks will not be translated. For example, if the
'robots.txt' in string 'Requesting for robots.txt …' should not be translated:

```js
// in example.js file

import * as i18n from '../i18n/i18n.js';
const UIStrings = {
  /**
   * @description Example description. Note: "robots.txt" is a canonical filename and should not be translated.
   */
  requestMessage: 'Requesting for `robots.txt` …',
} as const;
const str_ = i18n.i18n.registerUIStrings('example.js', UIStrings);

const message = i18nString(UIStrings.requestMessage);
```

The string will rendered with robots.txt not translated and without the
backticks around it `js 'Requesting for robots.txt …'`

### Phrases that are fully locked

Any text that is fully locked should not go into the UIStrings object. To make
your intention clear or to make TypeScript happy, there are two methods
`i18n.i18n.lockedString` and `i18n.i18n.lockedLazyString` that can be used
instead of having fully locked phrases via `i18nString`.

### What should not be localized?

In general, branding related terms and code snippets are the ones to look for,
and Sometimes some technical terms. Some examples:

**Brandings:** Lighthouse, GitHub, DevTools, Chrome Data Saver, Safari,
BlackBerry Z30, Kindle Fire HDX, Pixel 2, Microsoft Lumia 550

**Code snippets:** localhost:9229, console.clear(), --memlog=all, url:a.com

**Technical terms:** DOM, DIV, aria...
