// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Marked from '../../third_party/marked/marked.js';

/**
 * The description that subclasses of `Issue` use define the issue appearance:
 * `file` specifies the markdown file, substitutions can be used to replace
 * placeholders with, e.g. URLs. The `links` property is used to specify the
 * links at the bottom of the issue.
 */
export interface MarkdownIssueDescription {
  file: string;
  substitutions?: Map<string, string>;
  links: Array<{link: string, linkTitle: string}>;
}

export interface LazyMarkdownIssueDescription {
  file: string;
  substitutions?: Map<string, () => string>;
  links: Array<{link: string, linkTitle: () => string}>;
}

/**
 * A lazy version of the description. Allows to specify a description as a
 * constant and at the same time delays resolution of the substitutions
 * and/or link titles to allow localization.
 */
export function resolveLazyDescription(lazyDescription: LazyMarkdownIssueDescription): MarkdownIssueDescription {
  function linksMap(currentLink: {link: string, linkTitle: () => string}): {link: string, linkTitle: string} {
    return {link: currentLink.link, linkTitle: currentLink.linkTitle()};
  }

  const substitutionMap = new Map();
  lazyDescription.substitutions?.forEach((value, key) => {
    substitutionMap.set(key, value());
  });

  const description = {
    file: lazyDescription.file,
    links: lazyDescription.links.map(linksMap),
    substitutions: substitutionMap,
  };
  return description;
}

/**
 * A loaded and parsed issue description. This is usually obtained by loading
 * a `MarkdownIssueDescription` via `createIssueDescriptionFromMarkdown`.
 */
export interface IssueDescription {
  title: string;
  markdown: Marked.Marked.Token[];
  links: Array<{link: string, linkTitle: string}>;
}

export async function getFileContent(url: URL): Promise<string> {
  try {
    const response = await fetch(url.toString());
    return await response.text();
  } catch {
    throw new Error(
        `Markdown file ${url.toString()} not found. Make sure it is correctly listed in the relevant BUILD.gn files.`);
  }
}

export async function getMarkdownFileContent(filename: string): Promise<string> {
  return await getFileContent(new URL(`descriptions/${filename}`, import.meta.url));
}

export async function createIssueDescriptionFromMarkdown(description: MarkdownIssueDescription):
    Promise<IssueDescription> {
  const rawMarkdown = await getMarkdownFileContent(description.file);
  const rawMarkdownWithPlaceholdersReplaced = substitutePlaceholders(rawMarkdown, description.substitutions);
  return createIssueDescriptionFromRawMarkdown(rawMarkdownWithPlaceholdersReplaced, description);
}

/**
 * This function is exported separately for unit testing.
 */
export function createIssueDescriptionFromRawMarkdown(
    markdown: string, description: MarkdownIssueDescription): IssueDescription {
  const markdownAst = Marked.Marked.lexer(markdown);
  const title = findTitleFromMarkdownAst(markdownAst);
  if (!title) {
    throw new Error('Markdown issue descriptions must start with a heading');
  }

  return {
    title,
    markdown: markdownAst.slice(1),
    links: description.links,
  };
}

const validPlaceholderMatchPattern = /\{(PLACEHOLDER_[a-zA-Z][a-zA-Z0-9]*)\}/g;
const validPlaceholderNamePattern = /PLACEHOLDER_[a-zA-Z][a-zA-Z0-9]*/;

/**
 * Replaces placeholders in markdown text with a string provided by the
 * `substitutions` map. To keep mental overhead to a minimum, the same
 * syntax is used as for l10n placeholders. Please note that the
 * placeholders require a mandatory 'PLACEHOLDER_' prefix.
 *
 * Example:
 *   const str = "This is markdown with `code` and two placeholders, namely {PLACEHOLDER_PH1} and {PLACEHOLDER_PH2}".
 *   const result = substitutePlaceholders(str, new Map([['PLACEHOLDER_PH1', 'foo'], ['PLACEHOLDER_PH2', 'bar']]));
 *
 * Exported only for unit testing.
 */
export function substitutePlaceholders(markdown: string, substitutions?: Map<string, string>): string {
  const unusedPlaceholders = new Set(substitutions ? substitutions.keys() : []);
  validatePlaceholders(unusedPlaceholders);

  const result = markdown.replace(validPlaceholderMatchPattern, (_, placeholder) => {
    const replacement = substitutions ? substitutions.get(placeholder) : undefined;
    if (replacement === undefined) {
      throw new Error(`No replacement provided for placeholder '${placeholder}'.`);
    }
    unusedPlaceholders.delete(placeholder);
    return replacement;
  });

  if (unusedPlaceholders.size > 0) {
    throw new Error(`Unused replacements provided: ${[...unusedPlaceholders]}`);
  }

  return result;
}

// Ensure that all provided placeholders match the naming pattern.
function validatePlaceholders(placeholders: Set<string>): void {
  const invalidPlaceholders = [...placeholders].filter(placeholder => !validPlaceholderNamePattern.test(placeholder));
  if (invalidPlaceholders.length > 0) {
    throw new Error(`Invalid placeholders provided in the substitutions map: ${invalidPlaceholders}`);
  }
}

export function findTitleFromMarkdownAst(markdownAst: Marked.Marked.Token[]): string|null {
  if (markdownAst.length === 0 || markdownAst[0].type !== 'heading' || markdownAst[0].depth !== 1) {
    return null;
  }
  return markdownAst[0].text;
}

export async function getIssueTitleFromMarkdownDescription(description: MarkdownIssueDescription):
    Promise<string|null> {
  const rawMarkdown = await getMarkdownFileContent(description.file);
  const markdownAst = Marked.Marked.lexer(rawMarkdown);
  return findTitleFromMarkdownAst(markdownAst);
}
