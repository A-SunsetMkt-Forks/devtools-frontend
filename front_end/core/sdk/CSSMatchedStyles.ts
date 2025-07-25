// Copyright 2016 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Protocol from '../../generated/protocol.js';
import * as Platform from '../platform/platform.js';

import {CSSMetadata, cssMetadata, CSSWideKeyword} from './CSSMetadata.js';
import type {CSSModel} from './CSSModel.js';
import {CSSProperty} from './CSSProperty.js';
import * as PropertyParser from './CSSPropertyParser.js';
import type {Match, Matcher} from './CSSPropertyParser.js';
import {
  AnchorFunctionMatcher,
  AngleMatcher,
  AutoBaseMatcher,
  BaseVariableMatcher,
  BezierMatcher,
  BinOpMatcher,
  ColorMatcher,
  ColorMixMatcher,
  EnvFunctionMatcher,
  FlexGridMatcher,
  GridTemplateMatcher,
  LengthMatcher,
  LightDarkColorMatcher,
  LinearGradientMatcher,
  LinkableNameMatcher,
  MathFunctionMatcher,
  PositionAnchorMatcher,
  PositionTryMatcher,
  RelativeColorChannelMatcher,
  ShadowMatcher,
  StringMatcher,
  URLMatcher,
  VariableMatcher
} from './CSSPropertyParserMatchers.js';
import {
  CSSFontPaletteValuesRule,
  CSSFunctionRule,
  CSSKeyframeRule,
  CSSKeyframesRule,
  CSSPositionTryRule,
  CSSPropertyRule,
  CSSStyleRule,
} from './CSSRule.js';
import {CSSStyleDeclaration, Type} from './CSSStyleDeclaration.js';
import type {DOMNode} from './DOMModel.js';

function containsStyle(styles: CSSStyleDeclaration[]|Set<CSSStyleDeclaration>, query: CSSStyleDeclaration): boolean {
  if (!query.styleSheetId || !query.range) {
    return false;
  }
  for (const style of styles) {
    if (query.styleSheetId === style.styleSheetId && style.range && query.range.equal(style.range)) {
      return true;
    }
  }
  return false;
}

function containsCustomProperties(style: CSSStyleDeclaration): boolean {
  const properties = style.allProperties();
  return properties.some(property => cssMetadata().isCustomProperty(property.name));
}

function containsInherited(style: CSSStyleDeclaration): boolean {
  const properties = style.allProperties();
  for (let i = 0; i < properties.length; ++i) {
    const property = properties[i];
    // Does this style contain non-overridden inherited property?
    if (property.activeInStyle() && cssMetadata().isPropertyInherited(property.name)) {
      return true;
    }
  }
  return false;
}

function cleanUserAgentPayload(payload: Protocol.CSS.RuleMatch[]): Protocol.CSS.RuleMatch[] {
  for (const ruleMatch of payload) {
    cleanUserAgentSelectors(ruleMatch);
  }

  // Merge UA rules that are sequential and have similar selector/media.
  const cleanMatchedPayload = [];
  for (const ruleMatch of payload) {
    const lastMatch = cleanMatchedPayload[cleanMatchedPayload.length - 1];
    if (!lastMatch || ruleMatch.rule.origin !== 'user-agent' || lastMatch.rule.origin !== 'user-agent' ||
        ruleMatch.rule.selectorList.text !== lastMatch.rule.selectorList.text ||
        mediaText(ruleMatch) !== mediaText(lastMatch)) {
      cleanMatchedPayload.push(ruleMatch);
      continue;
    }
    mergeRule(ruleMatch, lastMatch);
  }
  return cleanMatchedPayload;

  function mergeRule(from: Protocol.CSS.RuleMatch, to: Protocol.CSS.RuleMatch): void {
    const shorthands = new Map<string, string>();
    const properties = new Map<string, string>();
    for (const entry of to.rule.style.shorthandEntries) {
      shorthands.set(entry.name, entry.value);
    }
    for (const entry of to.rule.style.cssProperties) {
      properties.set(entry.name, entry.value);
    }
    for (const entry of from.rule.style.shorthandEntries) {
      shorthands.set(entry.name, entry.value);
    }
    for (const entry of from.rule.style.cssProperties) {
      properties.set(entry.name, entry.value);
    }
    to.rule.style.shorthandEntries = [...shorthands.entries()].map(([name, value]) => ({name, value}));
    to.rule.style.cssProperties = [...properties.entries()].map(([name, value]) => ({name, value}));
  }

  function mediaText(ruleMatch: Protocol.CSS.RuleMatch): string|null {
    if (!ruleMatch.rule.media) {
      return null;
    }
    return ruleMatch.rule.media.map(media => media.text).join(', ');
  }

  function cleanUserAgentSelectors(ruleMatch: Protocol.CSS.RuleMatch): void {
    const {matchingSelectors, rule} = ruleMatch;
    if (rule.origin !== 'user-agent' || !matchingSelectors.length) {
      return;
    }
    rule.selectorList.selectors = rule.selectorList.selectors.filter((_, i) => matchingSelectors.includes(i));
    rule.selectorList.text = rule.selectorList.selectors.map(item => item.text).join(', ');
    ruleMatch.matchingSelectors = matchingSelectors.map((_, i) => i);
  }
}

/**
 * Return a mapping of the highlight names in the specified RuleMatch to
 * the indices of selectors in that selector list with that highlight name.
 *
 * For example, consider the following ruleset:
 * span::highlight(foo), div, #mySpan::highlight(bar), .highlighted::highlight(foo) {
 *   color: blue;
 * }
 *
 * For a <span id="mySpan" class="highlighted"></span>, a RuleMatch for that span
 * would have matchingSelectors [0, 2, 3] indicating that the span
 * matches all of the highlight selectors.
 *
 * For that RuleMatch, this function would produce the following map:
 * {
 *  "foo": [0, 3],
 *  "bar": [2]
 * }
 *
 * @param ruleMatch
 * @returns A mapping of highlight names to lists of indices into the selector
 * list associated with ruleMatch. The indices correspond to the selectors in the rule
 * associated with the key's highlight name.
 */
function customHighlightNamesToMatchingSelectorIndices(ruleMatch: Protocol.CSS.RuleMatch): Map<string, number[]> {
  const highlightNamesToMatchingSelectors = new Map<string, number[]>();

  for (let i = 0; i < ruleMatch.matchingSelectors.length; i++) {
    const matchingSelectorIndex = ruleMatch.matchingSelectors[i];
    const selectorText = ruleMatch.rule.selectorList.selectors[matchingSelectorIndex].text;
    const highlightNameMatch = selectorText.match(/::highlight\((.*)\)/);
    if (highlightNameMatch) {
      const highlightName = highlightNameMatch[1];
      const selectorsForName = highlightNamesToMatchingSelectors.get(highlightName);
      if (selectorsForName) {
        selectorsForName.push(matchingSelectorIndex);
      } else {
        highlightNamesToMatchingSelectors.set(highlightName, [matchingSelectorIndex]);
      }
    }
  }
  return highlightNamesToMatchingSelectors;
}

function queryMatches(style: CSSStyleDeclaration): boolean {
  if (!style.parentRule) {
    return true;
  }
  const parentRule = style.parentRule as CSSStyleRule;
  const queries = [...parentRule.media, ...parentRule.containerQueries, ...parentRule.supports, ...parentRule.scopes];
  for (const query of queries) {
    if (!query.active()) {
      return false;
    }
  }
  return true;
}

export interface CSSMatchedStylesPayload {
  cssModel: CSSModel;
  node: DOMNode;
  activePositionFallbackIndex: number;
  inlinePayload: Protocol.CSS.CSSStyle|null;
  attributesPayload: Protocol.CSS.CSSStyle|null;
  matchedPayload: Protocol.CSS.RuleMatch[];
  pseudoPayload: Protocol.CSS.PseudoElementMatches[];
  inheritedPayload: Protocol.CSS.InheritedStyleEntry[];
  inheritedPseudoPayload: Protocol.CSS.InheritedPseudoElementMatches[];
  animationsPayload: Protocol.CSS.CSSKeyframesRule[];
  parentLayoutNodeId: Protocol.DOM.NodeId|undefined;
  positionTryRules: Protocol.CSS.CSSPositionTryRule[];
  propertyRules: Protocol.CSS.CSSPropertyRule[];
  cssPropertyRegistrations: Protocol.CSS.CSSPropertyRegistration[];
  fontPaletteValuesRule: Protocol.CSS.CSSFontPaletteValuesRule|undefined;
  animationStylesPayload: Protocol.CSS.CSSAnimationStyle[];
  transitionsStylePayload: Protocol.CSS.CSSStyle|null;
  inheritedAnimatedPayload: Protocol.CSS.InheritedAnimatedStyleEntry[];
  functionRules: Protocol.CSS.CSSFunctionRule[];
}

export class CSSRegisteredProperty {
  #registration: Protocol.CSS.CSSPropertyRegistration|CSSPropertyRule;
  #cssModel: CSSModel;
  #style: CSSStyleDeclaration|undefined;
  constructor(cssModel: CSSModel, registration: CSSPropertyRule|Protocol.CSS.CSSPropertyRegistration) {
    this.#cssModel = cssModel;
    this.#registration = registration;
  }

  propertyName(): string {
    return this.#registration instanceof CSSPropertyRule ? this.#registration.propertyName().text :
                                                           this.#registration.propertyName;
  }

  initialValue(): string|null {
    return this.#registration instanceof CSSPropertyRule ? this.#registration.initialValue() :
                                                           this.#registration.initialValue?.text ?? null;
  }

  inherits(): boolean {
    return this.#registration instanceof CSSPropertyRule ? this.#registration.inherits() : this.#registration.inherits;
  }

  syntax(): string {
    return this.#registration instanceof CSSPropertyRule ? this.#registration.syntax() :
                                                           `"${this.#registration.syntax}"`;
  }

  parseValue(matchedStyles: CSSMatchedStyles, computedStyles: Map<string, string>|null):
      PropertyParser.BottomUpTreeMatching|null {
    const value = this.initialValue();
    if (!value) {
      return null;
    }

    return PropertyParser.matchDeclaration(
        this.propertyName(), value, matchedStyles.propertyMatchers(this.style(), computedStyles));
  }

  #asCSSProperties(): Protocol.CSS.CSSProperty[] {
    if (this.#registration instanceof CSSPropertyRule) {
      return [];
    }
    const {inherits, initialValue, syntax} = this.#registration;
    const properties = [
      {name: 'inherits', value: `${inherits}`},
      {name: 'syntax', value: `"${syntax}"`},
    ];
    if (initialValue !== undefined) {
      properties.push({name: 'initial-value', value: initialValue.text});
    }
    return properties;
  }

  style(): CSSStyleDeclaration {
    if (!this.#style) {
      this.#style = this.#registration instanceof CSSPropertyRule ?
          this.#registration.style :
          new CSSStyleDeclaration(
              this.#cssModel, null, {cssProperties: this.#asCSSProperties(), shorthandEntries: []}, Type.Pseudo);
    }
    return this.#style;
  }
}

export class CSSMatchedStyles {
  #cssModelInternal: CSSModel;
  #nodeInternal: DOMNode;
  #addedStyles = new Map<CSSStyleDeclaration, DOMNode>();
  #matchingSelectors = new Map<number, Map<string, boolean>>();
  #keyframesInternal: CSSKeyframesRule[] = [];
  #registeredProperties: CSSRegisteredProperty[];
  #registeredPropertyMap = new Map<string, CSSRegisteredProperty>();
  #nodeForStyleInternal = new Map<CSSStyleDeclaration, DOMNode|null>();
  #inheritedStyles = new Set<CSSStyleDeclaration>();
  #styleToDOMCascade = new Map<CSSStyleDeclaration, DOMInheritanceCascade>();
  #parentLayoutNodeId: Protocol.DOM.NodeId|undefined;
  #positionTryRules: CSSPositionTryRule[];
  #activePositionFallbackIndex: number;
  #mainDOMCascade?: DOMInheritanceCascade;
  #pseudoDOMCascades?: Map<Protocol.DOM.PseudoType, DOMInheritanceCascade>;
  #customHighlightPseudoDOMCascades?: Map<string, DOMInheritanceCascade>;
  #functionRules: CSSFunctionRule[];
  #functionRuleMap = new Map<string, CSSFunctionRule>();
  readonly #fontPaletteValuesRule: CSSFontPaletteValuesRule|undefined;
  #environmentVariables: Record<string, string> = {};

  static async create(payload: CSSMatchedStylesPayload): Promise<CSSMatchedStyles> {
    const cssMatchedStyles = new CSSMatchedStyles(payload);
    await cssMatchedStyles.init(payload);
    return cssMatchedStyles;
  }

  private constructor({
    cssModel,
    node,
    animationsPayload,
    parentLayoutNodeId,
    positionTryRules,
    propertyRules,
    cssPropertyRegistrations,
    fontPaletteValuesRule,
    activePositionFallbackIndex,
    functionRules,
  }: CSSMatchedStylesPayload) {
    this.#cssModelInternal = cssModel;
    this.#nodeInternal = node;
    this.#registeredProperties = [
      ...propertyRules.map(rule => new CSSPropertyRule(cssModel, rule)),
      ...cssPropertyRegistrations,
    ].map(r => new CSSRegisteredProperty(cssModel, r));
    if (animationsPayload) {
      this.#keyframesInternal = animationsPayload.map(rule => new CSSKeyframesRule(cssModel, rule));
    }
    this.#positionTryRules = positionTryRules.map(rule => new CSSPositionTryRule(cssModel, rule));
    this.#parentLayoutNodeId = parentLayoutNodeId;
    this.#fontPaletteValuesRule =
        fontPaletteValuesRule ? new CSSFontPaletteValuesRule(cssModel, fontPaletteValuesRule) : undefined;

    this.#activePositionFallbackIndex = activePositionFallbackIndex;
    this.#functionRules = functionRules.map(rule => new CSSFunctionRule(cssModel, rule));
  }

  private async init({
    matchedPayload,
    inheritedPayload,
    inlinePayload,
    attributesPayload,
    pseudoPayload,
    inheritedPseudoPayload,
    animationStylesPayload,
    transitionsStylePayload,
    inheritedAnimatedPayload,
  }: CSSMatchedStylesPayload): Promise<void> {
    matchedPayload = cleanUserAgentPayload(matchedPayload);
    for (const inheritedResult of inheritedPayload) {
      inheritedResult.matchedCSSRules = cleanUserAgentPayload(inheritedResult.matchedCSSRules);
    }

    this.#environmentVariables = await this.cssModel().getEnvironmentVariales();

    this.#mainDOMCascade = await this.buildMainCascade(
        inlinePayload, attributesPayload, matchedPayload, inheritedPayload, animationStylesPayload,
        transitionsStylePayload, inheritedAnimatedPayload);
    [this.#pseudoDOMCascades, this.#customHighlightPseudoDOMCascades] =
        this.buildPseudoCascades(pseudoPayload, inheritedPseudoPayload);

    for (const domCascade of Array.from(this.#customHighlightPseudoDOMCascades.values())
             .concat(Array.from(this.#pseudoDOMCascades.values()))
             .concat(this.#mainDOMCascade)) {
      for (const style of domCascade.styles()) {
        this.#styleToDOMCascade.set(style, domCascade);
      }
    }

    for (const prop of this.#registeredProperties) {
      this.#registeredPropertyMap.set(prop.propertyName(), prop);
    }

    for (const rule of this.#functionRules) {
      this.#functionRuleMap.set(rule.functionName().text, rule);
    }
  }

  private async buildMainCascade(
      inlinePayload: Protocol.CSS.CSSStyle|null,
      attributesPayload: Protocol.CSS.CSSStyle|null,
      matchedPayload: Protocol.CSS.RuleMatch[],
      inheritedPayload: Protocol.CSS.InheritedStyleEntry[],
      animationStylesPayload: Protocol.CSS.CSSAnimationStyle[],
      transitionsStylePayload: Protocol.CSS.CSSStyle|null,
      inheritedAnimatedPayload: Protocol.CSS.InheritedAnimatedStyleEntry[],
      ): Promise<DOMInheritanceCascade> {
    const nodeCascades: NodeCascade[] = [];

    const nodeStyles: CSSStyleDeclaration[] = [];

    function addAttributesStyle(this: CSSMatchedStyles): void {
      if (!attributesPayload) {
        return;
      }
      const style = new CSSStyleDeclaration(this.#cssModelInternal, null, attributesPayload, Type.Attributes);
      this.#nodeForStyleInternal.set(style, this.#nodeInternal);
      nodeStyles.push(style);
    }

    // Transition styles take precedence over animation styles & inline styles.
    if (transitionsStylePayload) {
      const style = new CSSStyleDeclaration(this.#cssModelInternal, null, transitionsStylePayload, Type.Transition);
      this.#nodeForStyleInternal.set(style, this.#nodeInternal);
      nodeStyles.push(style);
    }

    // Animation styles take precedence over inline styles.
    for (const animationsStyle of animationStylesPayload) {
      const style = new CSSStyleDeclaration(
          this.#cssModelInternal, null, animationsStyle.style, Type.Animation, animationsStyle.name);
      this.#nodeForStyleInternal.set(style, this.#nodeInternal);
      nodeStyles.push(style);
    }

    // Inline style takes precedence over regular and inherited rules.
    if (inlinePayload && this.#nodeInternal.nodeType() === Node.ELEMENT_NODE) {
      const style = new CSSStyleDeclaration(this.#cssModelInternal, null, inlinePayload, Type.Inline);
      this.#nodeForStyleInternal.set(style, this.#nodeInternal);
      nodeStyles.push(style);
    }

    // Add rules in reverse order to match the cascade order.
    let addedAttributesStyle;
    for (let i = matchedPayload.length - 1; i >= 0; --i) {
      const rule = new CSSStyleRule(this.#cssModelInternal, matchedPayload[i].rule);
      if ((rule.isInjected() || rule.isUserAgent()) && !addedAttributesStyle) {
        // Show element's Style Attributes after all author rules.
        addedAttributesStyle = true;
        addAttributesStyle.call(this);
      }
      this.#nodeForStyleInternal.set(rule.style, this.#nodeInternal);
      nodeStyles.push(rule.style);
      this.addMatchingSelectors(this.#nodeInternal, rule, matchedPayload[i].matchingSelectors);
    }

    if (!addedAttributesStyle) {
      addAttributesStyle.call(this);
    }
    nodeCascades.push(new NodeCascade(this, nodeStyles, false /* #isInherited */));

    // Walk the node structure and identify styles with inherited properties.
    let parentNode: (DOMNode|null) = this.#nodeInternal.parentNode;
    const traverseParentInFlatTree = async(node: DOMNode): Promise<DOMNode|null> => {
      if (node.hasAssignedSlot()) {
        return await node.assignedSlot?.deferredNode.resolvePromise() ?? null;
      }

      return node.parentNode;
    };

    for (let i = 0; parentNode && inheritedPayload && i < inheritedPayload.length; ++i) {
      const inheritedStyles = [];
      const entryPayload = inheritedPayload[i];
      const inheritedAnimatedEntryPayload = inheritedAnimatedPayload[i];
      const inheritedInlineStyle = entryPayload.inlineStyle ?
          new CSSStyleDeclaration(this.#cssModelInternal, null, entryPayload.inlineStyle, Type.Inline) :
          null;
      const inheritedTransitionsStyle = inheritedAnimatedEntryPayload?.transitionsStyle ?
          new CSSStyleDeclaration(
              this.#cssModelInternal, null, inheritedAnimatedEntryPayload?.transitionsStyle, Type.Transition) :
          null;
      const inheritedAnimationStyles =
          inheritedAnimatedEntryPayload?.animationStyles?.map(
              animationStyle => new CSSStyleDeclaration(
                  this.#cssModelInternal, null, animationStyle.style, Type.Animation, animationStyle.name)) ??
          [];
      if (inheritedTransitionsStyle && containsInherited(inheritedTransitionsStyle)) {
        this.#nodeForStyleInternal.set(inheritedTransitionsStyle, parentNode);
        inheritedStyles.push(inheritedTransitionsStyle);
        this.#inheritedStyles.add(inheritedTransitionsStyle);
      }

      for (const inheritedAnimationsStyle of inheritedAnimationStyles) {
        if (!containsInherited(inheritedAnimationsStyle)) {
          continue;
        }

        this.#nodeForStyleInternal.set(inheritedAnimationsStyle, parentNode);
        inheritedStyles.push(inheritedAnimationsStyle);
        this.#inheritedStyles.add(inheritedAnimationsStyle);
      }

      if (inheritedInlineStyle && containsInherited(inheritedInlineStyle)) {
        this.#nodeForStyleInternal.set(inheritedInlineStyle, parentNode);
        inheritedStyles.push(inheritedInlineStyle);
        this.#inheritedStyles.add(inheritedInlineStyle);
      }

      const inheritedMatchedCSSRules = entryPayload.matchedCSSRules || [];
      for (let j = inheritedMatchedCSSRules.length - 1; j >= 0; --j) {
        const inheritedRule = new CSSStyleRule(this.#cssModelInternal, inheritedMatchedCSSRules[j].rule);
        this.addMatchingSelectors(parentNode, inheritedRule, inheritedMatchedCSSRules[j].matchingSelectors);
        if (!containsInherited(inheritedRule.style)) {
          continue;
        }
        if (!containsCustomProperties(inheritedRule.style)) {
          if (containsStyle(nodeStyles, inheritedRule.style) ||
              containsStyle(this.#inheritedStyles, inheritedRule.style)) {
            continue;
          }
        }
        this.#nodeForStyleInternal.set(inheritedRule.style, parentNode);
        inheritedStyles.push(inheritedRule.style);
        this.#inheritedStyles.add(inheritedRule.style);
      }
      parentNode = await traverseParentInFlatTree(parentNode);
      nodeCascades.push(new NodeCascade(this, inheritedStyles, true /* #isInherited */));
    }

    return new DOMInheritanceCascade(this, nodeCascades, this.#registeredProperties);
  }

  /**
   * Pseudo rule matches received via the inspector protocol are grouped by pseudo type.
   * For custom highlight pseudos, we need to instead group the rule matches by highlight
   * name in order to produce separate cascades for each highlight name. This is necessary
   * so that styles of ::highlight(foo) are not shown as overriding styles of ::highlight(bar).
   *
   * This helper function takes a list of rule matches and generates separate NodeCascades
   * for each custom highlight name that was matched.
   */
  private buildSplitCustomHighlightCascades(
      rules: Protocol.CSS.RuleMatch[], node: DOMNode, isInherited: boolean,
      pseudoCascades: Map<string, NodeCascade[]>): void {
    const splitHighlightRules = new Map<string, CSSStyleDeclaration[]>();

    for (let j = rules.length - 1; j >= 0; --j) {
      const highlightNamesToMatchingSelectorIndices = customHighlightNamesToMatchingSelectorIndices(rules[j]);

      for (const [highlightName, matchingSelectors] of highlightNamesToMatchingSelectorIndices) {
        const pseudoRule = new CSSStyleRule(this.#cssModelInternal, rules[j].rule);
        this.#nodeForStyleInternal.set(pseudoRule.style, node);
        if (isInherited) {
          this.#inheritedStyles.add(pseudoRule.style);
        }
        this.addMatchingSelectors(node, pseudoRule, matchingSelectors);

        const ruleListForHighlightName = splitHighlightRules.get(highlightName);
        if (ruleListForHighlightName) {
          ruleListForHighlightName.push(pseudoRule.style);
        } else {
          splitHighlightRules.set(highlightName, [pseudoRule.style]);
        }
      }
    }

    for (const [highlightName, highlightStyles] of splitHighlightRules) {
      const nodeCascade = new NodeCascade(this, highlightStyles, isInherited, true /* #isHighlightPseudoCascade*/);
      const cascadeListForHighlightName = pseudoCascades.get(highlightName);
      if (cascadeListForHighlightName) {
        cascadeListForHighlightName.push(nodeCascade);
      } else {
        pseudoCascades.set(highlightName, [nodeCascade]);
      }
    }
  }

  private buildPseudoCascades(
      pseudoPayload: Protocol.CSS.PseudoElementMatches[],
      inheritedPseudoPayload: Protocol.CSS.InheritedPseudoElementMatches[]):
      [Map<Protocol.DOM.PseudoType, DOMInheritanceCascade>, Map<string, DOMInheritanceCascade>] {
    const pseudoInheritanceCascades = new Map<Protocol.DOM.PseudoType, DOMInheritanceCascade>();
    const customHighlightPseudoInheritanceCascades = new Map<string, DOMInheritanceCascade>();
    if (!pseudoPayload) {
      return [pseudoInheritanceCascades, customHighlightPseudoInheritanceCascades];
    }

    const pseudoCascades = new Map<Protocol.DOM.PseudoType, NodeCascade[]>();
    const customHighlightPseudoCascades = new Map<string, NodeCascade[]>();
    for (let i = 0; i < pseudoPayload.length; ++i) {
      const entryPayload = pseudoPayload[i];
      // PseudoElement nodes are not created unless "content" css property is set.
      const pseudoElement = this.#nodeInternal.pseudoElements().get(entryPayload.pseudoType)?.at(-1) || null;
      const pseudoStyles = [];
      const rules = entryPayload.matches || [];

      if (entryPayload.pseudoType === Protocol.DOM.PseudoType.Highlight) {
        this.buildSplitCustomHighlightCascades(
            rules, this.#nodeInternal, false /* #isInherited */, customHighlightPseudoCascades);
      } else {
        for (let j = rules.length - 1; j >= 0; --j) {
          const pseudoRule = new CSSStyleRule(this.#cssModelInternal, rules[j].rule);
          pseudoStyles.push(pseudoRule.style);
          const nodeForStyle =
              cssMetadata().isHighlightPseudoType(entryPayload.pseudoType) ? this.#nodeInternal : pseudoElement;
          this.#nodeForStyleInternal.set(pseudoRule.style, nodeForStyle);
          if (nodeForStyle) {
            this.addMatchingSelectors(nodeForStyle, pseudoRule, rules[j].matchingSelectors);
          }
        }
        const isHighlightPseudoCascade = cssMetadata().isHighlightPseudoType(entryPayload.pseudoType);
        const nodeCascade = new NodeCascade(
            this, pseudoStyles, false /* #isInherited */, isHighlightPseudoCascade /* #isHighlightPseudoCascade*/);
        pseudoCascades.set(entryPayload.pseudoType, [nodeCascade]);
      }
    }

    if (inheritedPseudoPayload) {
      let parentNode: (DOMNode|null) = this.#nodeInternal.parentNode;
      for (let i = 0; parentNode && i < inheritedPseudoPayload.length; ++i) {
        const inheritedPseudoMatches = inheritedPseudoPayload[i].pseudoElements;
        for (let j = 0; j < inheritedPseudoMatches.length; ++j) {
          const inheritedEntryPayload = inheritedPseudoMatches[j];
          const rules = inheritedEntryPayload.matches || [];

          if (inheritedEntryPayload.pseudoType === Protocol.DOM.PseudoType.Highlight) {
            this.buildSplitCustomHighlightCascades(
                rules, parentNode, true /* #isInherited */, customHighlightPseudoCascades);
          } else {
            const pseudoStyles = [];
            for (let k = rules.length - 1; k >= 0; --k) {
              const pseudoRule = new CSSStyleRule(this.#cssModelInternal, rules[k].rule);
              pseudoStyles.push(pseudoRule.style);
              this.#nodeForStyleInternal.set(pseudoRule.style, parentNode);
              this.#inheritedStyles.add(pseudoRule.style);
              this.addMatchingSelectors(parentNode, pseudoRule, rules[k].matchingSelectors);
            }

            const isHighlightPseudoCascade = cssMetadata().isHighlightPseudoType(inheritedEntryPayload.pseudoType);
            const nodeCascade = new NodeCascade(
                this, pseudoStyles, true /* #isInherited */, isHighlightPseudoCascade /* #isHighlightPseudoCascade*/);
            const cascadeListForPseudoType = pseudoCascades.get(inheritedEntryPayload.pseudoType);
            if (cascadeListForPseudoType) {
              cascadeListForPseudoType.push(nodeCascade);
            } else {
              pseudoCascades.set(inheritedEntryPayload.pseudoType, [nodeCascade]);
            }
          }
        }

        parentNode = parentNode.parentNode;
      }
    }

    // Now that we've built the arrays of NodeCascades for each pseudo type, convert them into
    // DOMInheritanceCascades.
    for (const [pseudoType, nodeCascade] of pseudoCascades.entries()) {
      pseudoInheritanceCascades.set(
          pseudoType, new DOMInheritanceCascade(this, nodeCascade, this.#registeredProperties));
    }

    for (const [highlightName, nodeCascade] of customHighlightPseudoCascades.entries()) {
      customHighlightPseudoInheritanceCascades.set(
          highlightName, new DOMInheritanceCascade(this, nodeCascade, this.#registeredProperties));
    }

    return [pseudoInheritanceCascades, customHighlightPseudoInheritanceCascades];
  }

  private addMatchingSelectors(
      this: CSSMatchedStyles, node: DOMNode, rule: CSSStyleRule, matchingSelectorIndices: number[]): void {
    for (const matchingSelectorIndex of matchingSelectorIndices) {
      const selector = rule.selectors[matchingSelectorIndex];
      if (selector) {
        this.setSelectorMatches(node, selector.text, true);
      }
    }
  }

  node(): DOMNode {
    return this.#nodeInternal;
  }

  cssModel(): CSSModel {
    return this.#cssModelInternal;
  }

  hasMatchingSelectors(rule: CSSStyleRule): boolean {
    return (rule.selectors.length === 0 || this.getMatchingSelectors(rule).length > 0) && queryMatches(rule.style);
  }

  getParentLayoutNodeId(): Protocol.DOM.NodeId|undefined {
    return this.#parentLayoutNodeId;
  }

  getMatchingSelectors(rule: CSSStyleRule): number[] {
    const node = this.nodeForStyle(rule.style);
    if (!node || typeof node.id !== 'number') {
      return [];
    }
    const map = this.#matchingSelectors.get(node.id);
    if (!map) {
      return [];
    }
    const result = [];
    for (let i = 0; i < rule.selectors.length; ++i) {
      if (map.get(rule.selectors[i].text)) {
        result.push(i);
      }
    }
    return result;
  }

  async recomputeMatchingSelectors(rule: CSSStyleRule): Promise<void> {
    const node = this.nodeForStyle(rule.style);
    if (!node) {
      return;
    }
    const promises = [];
    for (const selector of rule.selectors) {
      promises.push(querySelector.call(this, node, selector.text));
    }
    await Promise.all(promises);

    async function querySelector(this: CSSMatchedStyles, node: DOMNode, selectorText: string): Promise<void> {
      const ownerDocument = node.ownerDocument;
      if (!ownerDocument) {
        return;
      }
      // We assume that "matching" property does not ever change during the
      // MatchedStyleResult's lifetime.
      if (typeof node.id === 'number') {
        const map = this.#matchingSelectors.get(node.id);
        if (map?.has(selectorText)) {
          return;
        }
      }

      if (typeof ownerDocument.id !== 'number') {
        return;
      }
      const matchingNodeIds = await this.#nodeInternal.domModel().querySelectorAll(ownerDocument.id, selectorText);

      if (matchingNodeIds) {
        if (typeof node.id === 'number') {
          this.setSelectorMatches(node, selectorText, matchingNodeIds.indexOf(node.id) !== -1);
        } else {
          this.setSelectorMatches(node, selectorText, false);
        }
      }
    }
  }

  addNewRule(rule: CSSStyleRule, node: DOMNode): Promise<void> {
    this.#addedStyles.set(rule.style, node);
    return this.recomputeMatchingSelectors(rule);
  }

  private setSelectorMatches(node: DOMNode, selectorText: string, value: boolean): void {
    if (typeof node.id !== 'number') {
      return;
    }
    let map = this.#matchingSelectors.get(node.id);
    if (!map) {
      map = new Map();
      this.#matchingSelectors.set(node.id, map);
    }
    map.set(selectorText, value);
  }

  nodeStyles(): CSSStyleDeclaration[] {
    Platform.assertNotNullOrUndefined(this.#mainDOMCascade);
    return this.#mainDOMCascade.styles();
  }

  inheritedStyles(): CSSStyleDeclaration[] {
    return this.#mainDOMCascade?.styles().filter(style => this.isInherited(style)) ?? [];
  }

  animationStyles(): CSSStyleDeclaration[] {
    return this.#mainDOMCascade?.styles().filter(style => !this.isInherited(style) && style.type === Type.Animation) ??
        [];
  }

  transitionsStyle(): CSSStyleDeclaration|null {
    return this.#mainDOMCascade?.styles().find(style => !this.isInherited(style) && style.type === Type.Transition) ??
        null;
  }

  registeredProperties(): CSSRegisteredProperty[] {
    return this.#registeredProperties;
  }

  getRegisteredProperty(name: string): CSSRegisteredProperty|undefined {
    return this.#registeredPropertyMap.get(name);
  }

  getRegisteredFunction(name: string): string|undefined {
    const functionRule = this.#functionRuleMap.get(name);
    return functionRule ? functionRule.nameWithParameters() : undefined;
  }

  functionRules(): CSSFunctionRule[] {
    return this.#functionRules;
  }

  fontPaletteValuesRule(): CSSFontPaletteValuesRule|undefined {
    return this.#fontPaletteValuesRule;
  }

  keyframes(): CSSKeyframesRule[] {
    return this.#keyframesInternal;
  }

  positionTryRules(): CSSPositionTryRule[] {
    return this.#positionTryRules;
  }

  activePositionFallbackIndex(): number {
    return this.#activePositionFallbackIndex;
  }

  pseudoStyles(pseudoType: Protocol.DOM.PseudoType): CSSStyleDeclaration[] {
    Platform.assertNotNullOrUndefined(this.#pseudoDOMCascades);
    const domCascade = this.#pseudoDOMCascades.get(pseudoType);
    return domCascade ? domCascade.styles() : [];
  }

  pseudoTypes(): Set<Protocol.DOM.PseudoType> {
    Platform.assertNotNullOrUndefined(this.#pseudoDOMCascades);
    return new Set(this.#pseudoDOMCascades.keys());
  }

  customHighlightPseudoStyles(highlightName: string): CSSStyleDeclaration[] {
    Platform.assertNotNullOrUndefined(this.#customHighlightPseudoDOMCascades);
    const domCascade = this.#customHighlightPseudoDOMCascades.get(highlightName);
    return domCascade ? domCascade.styles() : [];
  }

  customHighlightPseudoNames(): Set<string> {
    Platform.assertNotNullOrUndefined(this.#customHighlightPseudoDOMCascades);
    return new Set(this.#customHighlightPseudoDOMCascades.keys());
  }

  nodeForStyle(style: CSSStyleDeclaration): DOMNode|null {
    return this.#addedStyles.get(style) || this.#nodeForStyleInternal.get(style) || null;
  }

  availableCSSVariables(style: CSSStyleDeclaration): string[] {
    const domCascade = this.#styleToDOMCascade.get(style);
    return domCascade ? domCascade.findAvailableCSSVariables(style) : [];
  }

  computeCSSVariable(style: CSSStyleDeclaration, variableName: string): CSSVariableValue|null {
    if (style.parentRule instanceof CSSKeyframeRule) {
      // The resolution of the variables inside of a CSS keyframe rule depends on where this keyframe rule is used.
      // So, we need to find the style with active CSS property `animation-name` that equals to the keyframe's name.
      const keyframeName = style.parentRule.parentRuleName();
      const activeStyle = this.#mainDOMCascade?.styles().find(searchStyle => {
        return searchStyle.allProperties().some(
            property => property.name === 'animation-name' && property.value === keyframeName &&
                this.#mainDOMCascade?.propertyState(property) === PropertyState.ACTIVE);
      });

      if (!activeStyle) {
        return null;
      }

      style = activeStyle;
    }

    const domCascade = this.#styleToDOMCascade.get(style);
    return domCascade ? domCascade.computeCSSVariable(style, variableName) : null;
  }

  resolveProperty(name: string, ownerStyle: CSSStyleDeclaration): CSSProperty|null {
    return this.#styleToDOMCascade.get(ownerStyle)?.resolveProperty(name, ownerStyle) ?? null;
  }

  resolveGlobalKeyword(property: CSSProperty, keyword: CSSWideKeyword): CSSValueSource|null {
    const resolved = this.#styleToDOMCascade.get(property.ownerStyle)?.resolveGlobalKeyword(property, keyword);
    return resolved ? new CSSValueSource(resolved) : null;
  }

  isInherited(style: CSSStyleDeclaration): boolean {
    return this.#inheritedStyles.has(style);
  }

  propertyState(property: CSSProperty): PropertyState|null {
    const domCascade = this.#styleToDOMCascade.get(property.ownerStyle);
    return domCascade ? domCascade.propertyState(property) : null;
  }

  resetActiveProperties(): void {
    Platform.assertNotNullOrUndefined(this.#mainDOMCascade);
    Platform.assertNotNullOrUndefined(this.#pseudoDOMCascades);
    Platform.assertNotNullOrUndefined(this.#customHighlightPseudoDOMCascades);
    this.#mainDOMCascade.reset();
    for (const domCascade of this.#pseudoDOMCascades.values()) {
      domCascade.reset();
    }

    for (const domCascade of this.#customHighlightPseudoDOMCascades.values()) {
      domCascade.reset();
    }
  }

  propertyMatchers(style: CSSStyleDeclaration, computedStyles: Map<string, string>|null): Array<Matcher<Match>> {
    return [
      new VariableMatcher(this, style),
      new ColorMatcher(() => computedStyles?.get('color') ?? null),
      new ColorMixMatcher(),
      new URLMatcher(),
      new AngleMatcher(),
      new LinkableNameMatcher(),
      new BezierMatcher(),
      new StringMatcher(),
      new ShadowMatcher(),
      new LightDarkColorMatcher(style),
      new GridTemplateMatcher(),
      new LinearGradientMatcher(),
      new AnchorFunctionMatcher(),
      new PositionAnchorMatcher(),
      new FlexGridMatcher(),
      new PositionTryMatcher(),
      new LengthMatcher(),
      new MathFunctionMatcher(),
      new AutoBaseMatcher(),
      new BinOpMatcher(),
      new RelativeColorChannelMatcher(),
      new EnvFunctionMatcher(this),
    ];
  }

  environmentVariable(name: string): string|undefined {
    return this.#environmentVariables[name];
  }
}

class NodeCascade {
  #matchedStyles: CSSMatchedStyles;
  readonly styles: CSSStyleDeclaration[];
  readonly #isInherited: boolean;
  readonly #isHighlightPseudoCascade: boolean;
  readonly propertiesState = new Map<CSSProperty, PropertyState>();
  readonly activeProperties = new Map<string, CSSProperty>();
  constructor(
      matchedStyles: CSSMatchedStyles, styles: CSSStyleDeclaration[], isInherited: boolean,
      isHighlightPseudoCascade = false) {
    this.#matchedStyles = matchedStyles;
    this.styles = styles;
    this.#isInherited = isInherited;
    this.#isHighlightPseudoCascade = isHighlightPseudoCascade;
  }

  computeActiveProperties(): void {
    this.propertiesState.clear();
    this.activeProperties.clear();

    for (let i = this.styles.length - 1; i >= 0; i--) {
      const style = this.styles[i];
      const rule = style.parentRule;
      // Compute cascade for CSSStyleRules only.
      if (rule && !(rule instanceof CSSStyleRule)) {
        continue;
      }
      if (rule && !this.#matchedStyles.hasMatchingSelectors(rule)) {
        continue;
      }

      for (const property of style.allProperties()) {
        // Do not pick non-inherited properties from inherited styles.
        const metadata = cssMetadata();

        // All properties are inherited for highlight pseudos.
        if (this.#isInherited && !this.#isHighlightPseudoCascade && !metadata.isPropertyInherited(property.name)) {
          continue;
        }

        // When a property does not have a range in an otherwise ranged CSSStyleDeclaration,
        // we consider it as a non-leading property (see computeLeadingProperties()), and most
        // of them are computed longhands. We exclude these from activeProperties calculation,
        // and use parsed longhands instead (see below).
        if (style.range && !property.range) {
          continue;
        }

        if (!property.activeInStyle()) {
          this.propertiesState.set(property, PropertyState.OVERLOADED);
          continue;
        }

        // If the custom property was registered with `inherits: false;`, inherited properties are invalid.
        if (this.#isInherited) {
          const registration = this.#matchedStyles.getRegisteredProperty(property.name);
          if (registration && !registration.inherits()) {
            this.propertiesState.set(property, PropertyState.OVERLOADED);
            continue;
          }
        }

        const canonicalName = metadata.canonicalPropertyName(property.name);
        this.updatePropertyState(property, canonicalName);
        for (const longhand of property.getLonghandProperties()) {
          if (metadata.isCSSPropertyName(longhand.name)) {
            this.updatePropertyState(longhand, longhand.name);
          }
        }
      }
    }
  }

  private updatePropertyState(propertyWithHigherSpecificity: CSSProperty, canonicalName: string): void {
    const activeProperty = this.activeProperties.get(canonicalName);
    if (activeProperty?.important && !propertyWithHigherSpecificity.important) {
      this.propertiesState.set(propertyWithHigherSpecificity, PropertyState.OVERLOADED);
      return;
    }

    if (activeProperty) {
      this.propertiesState.set(activeProperty, PropertyState.OVERLOADED);
    }
    this.propertiesState.set(propertyWithHigherSpecificity, PropertyState.ACTIVE);
    this.activeProperties.set(canonicalName, propertyWithHigherSpecificity);
  }
}

function isRegular(declaration: CSSProperty|CSSRegisteredProperty): declaration is CSSProperty {
  return 'ownerStyle' in declaration;
}
export class CSSValueSource {
  readonly declaration: CSSProperty|CSSRegisteredProperty;
  constructor(declaration: CSSProperty|CSSRegisteredProperty) {
    this.declaration = declaration;
  }

  get value(): string|null {
    return isRegular(this.declaration) ? this.declaration.value : this.declaration.initialValue();
  }
  get style(): CSSStyleDeclaration {
    return isRegular(this.declaration) ? this.declaration.ownerStyle : this.declaration.style();
  }
  get name(): string {
    return isRegular(this.declaration) ? this.declaration.name : this.declaration.propertyName();
  }
}

export interface CSSVariableValue {
  value: string;
  declaration: CSSValueSource;
}

class SCCRecordEntry {
  private rootDiscoveryTime: number;
  get isRootEntry(): boolean {
    return this.rootDiscoveryTime === this.discoveryTime;
  }
  updateRoot(neighbor: SCCRecordEntry): void {
    this.rootDiscoveryTime = Math.min(this.rootDiscoveryTime, neighbor.rootDiscoveryTime);
  }
  constructor(readonly nodeCascade: NodeCascade, readonly name: string, private readonly discoveryTime: number) {
    this.rootDiscoveryTime = discoveryTime;
  }
}

class SCCRecord {
  #time = 0;
  #stack: SCCRecordEntry[] = [];
  #entries = new Map<NodeCascade, Map<string, SCCRecordEntry>>();

  get(nodeCascade: NodeCascade, variable: string): SCCRecordEntry|undefined {
    return this.#entries.get(nodeCascade)?.get(variable);
  }

  add(nodeCascade: NodeCascade, variable: string): SCCRecordEntry {
    const existing = this.get(nodeCascade, variable);
    if (existing) {
      return existing;
    }
    const entry = new SCCRecordEntry(nodeCascade, variable, this.#time++);
    this.#stack.push(entry);
    let map = this.#entries.get(nodeCascade);
    if (!map) {
      map = new Map();
      this.#entries.set(nodeCascade, map);
    }
    map.set(variable, entry);
    return entry;
  }

  isInInProgressSCC(childRecord: SCCRecordEntry): boolean {
    return this.#stack.includes(childRecord);
  }

  finishSCC(root: SCCRecordEntry): SCCRecordEntry[] {
    const startIndex = this.#stack.lastIndexOf(root);
    console.assert(startIndex >= 0, 'Root is not an in-progress scc');
    return this.#stack.splice(startIndex);
  }
}

function* forEach<T>(array: T[], startAfter?: T): Generator<T> {
  const startIdx = startAfter !== undefined ? array.indexOf(startAfter) + 1 : 0;
  for (let i = startIdx; i < array.length; ++i) {
    yield array[i];
  }
}

class DOMInheritanceCascade {
  readonly #propertiesState = new Map<CSSProperty, PropertyState>();
  readonly #availableCSSVariables = new Map<NodeCascade, Map<string, CSSVariableValue|null>>();
  readonly #computedCSSVariables = new Map<NodeCascade, Map<string, CSSVariableValue|null>>();
  readonly #styleToNodeCascade = new Map<CSSStyleDeclaration, NodeCascade>();
  #initialized = false;
  readonly #nodeCascades: NodeCascade[];
  #registeredProperties: CSSRegisteredProperty[];
  readonly #matchedStyles: CSSMatchedStyles;
  constructor(
      matchedStyles: CSSMatchedStyles, nodeCascades: NodeCascade[], registeredProperties: CSSRegisteredProperty[]) {
    this.#nodeCascades = nodeCascades;
    this.#matchedStyles = matchedStyles;
    this.#registeredProperties = registeredProperties;

    for (const nodeCascade of nodeCascades) {
      for (const style of nodeCascade.styles) {
        this.#styleToNodeCascade.set(style, nodeCascade);
      }
    }
  }

  findAvailableCSSVariables(style: CSSStyleDeclaration): string[] {
    const nodeCascade = this.#styleToNodeCascade.get(style);
    if (!nodeCascade) {
      return [];
    }
    this.ensureInitialized();
    const availableCSSVariables = this.#availableCSSVariables.get(nodeCascade);
    if (!availableCSSVariables) {
      return [];
    }
    return Array.from(availableCSSVariables.keys());
  }

  #findPropertyInPreviousStyle(property: CSSProperty, filter: (property: CSSProperty) => boolean): CSSProperty|null {
    const cascade = this.#styleToNodeCascade.get(property.ownerStyle);
    if (!cascade) {
      return null;
    }

    for (const style of forEach(cascade.styles, property.ownerStyle)) {
      const candidate =
          style.allProperties().findLast(candidate => candidate.name === property.name && filter(candidate));
      if (candidate) {
        return candidate;
      }
    }
    return null;
  }

  resolveProperty(name: string, ownerStyle: CSSStyleDeclaration): CSSProperty|null {
    const cascade = this.#styleToNodeCascade.get(ownerStyle);
    if (!cascade) {
      return null;
    }

    for (const style of cascade.styles) {
      const candidate = style.allProperties().findLast(candidate => candidate.name === name);
      if (candidate) {
        return candidate;
      }
    }

    return this.#findPropertyInParentCascadeIfInherited({name, ownerStyle});
  }

  #findPropertyInParentCascade(property: {name: string, ownerStyle: CSSStyleDeclaration}): CSSProperty|null {
    const nodeCascade = this.#styleToNodeCascade.get(property.ownerStyle);
    if (!nodeCascade) {
      return null;
    }
    for (const cascade of forEach(this.#nodeCascades, nodeCascade)) {
      for (const style of cascade.styles) {
        const inheritedProperty =
            style.allProperties().findLast(inheritedProperty => inheritedProperty.name === property.name);
        if (inheritedProperty) {
          return inheritedProperty;
        }
      }
    }
    return null;
  }

  #findPropertyInParentCascadeIfInherited(property: {name: string, ownerStyle: CSSStyleDeclaration}): CSSProperty|null {
    if (!cssMetadata().isPropertyInherited(property.name) ||
        !(this.#findCustomPropertyRegistration(property.name)?.inherits() ?? true)) {
      return null;
    }
    return this.#findPropertyInParentCascade(property);
  }

  #findCustomPropertyRegistration(property: string): CSSRegisteredProperty|null {
    const registration = this.#registeredProperties.find(registration => registration.propertyName() === property);
    return registration ? registration : null;
  }

  resolveGlobalKeyword(property: CSSProperty, keyword: CSSWideKeyword): null|CSSProperty|CSSRegisteredProperty {
    const isPreviousLayer = (other: CSSProperty): boolean => {
      // If there's no parent rule on then it isn't layered and is thus not in a previous one.
      if (!(other.ownerStyle.parentRule instanceof CSSStyleRule)) {
        return false;
      }
      // Element-attached style -> author origin counts as a previous layer transition for revert-layer.
      if (property.ownerStyle.type === Type.Inline) {
        return true;
      }
      // Compare layers
      if (property.ownerStyle.parentRule instanceof CSSStyleRule &&
          other.ownerStyle.parentRule?.origin === Protocol.CSS.StyleSheetOrigin.Regular) {
        return JSON.stringify(other.ownerStyle.parentRule.layers) !==
            JSON.stringify(property.ownerStyle.parentRule.layers);
      }
      return false;
    };

    switch (keyword) {
      case CSSWideKeyword.INITIAL:
        return this.#findCustomPropertyRegistration(property.name);
      case CSSWideKeyword.INHERIT:
        return this.#findPropertyInParentCascade(property) ?? this.#findCustomPropertyRegistration(property.name);
      case CSSWideKeyword.REVERT:
        return this.#findPropertyInPreviousStyle(
                   property,
                   other => other.ownerStyle.parentRule !== null &&
                       other.ownerStyle.parentRule.origin !==
                           (property.ownerStyle.parentRule?.origin ?? Protocol.CSS.StyleSheetOrigin.Regular)) ??
            this.resolveGlobalKeyword(property, CSSWideKeyword.UNSET);
      case CSSWideKeyword.REVERT_LAYER:
        return this.#findPropertyInPreviousStyle(property, isPreviousLayer) ??
            this.resolveGlobalKeyword(property, CSSWideKeyword.REVERT);
      case CSSWideKeyword.UNSET:
        return this.#findPropertyInParentCascadeIfInherited(property) ??
            this.#findCustomPropertyRegistration(property.name);
    }
  }

  computeCSSVariable(style: CSSStyleDeclaration, variableName: string): CSSVariableValue|null {
    const nodeCascade = this.#styleToNodeCascade.get(style);
    if (!nodeCascade) {
      return null;
    }
    this.ensureInitialized();
    return this.innerComputeCSSVariable(nodeCascade, variableName);
  }

  private innerComputeCSSVariable(nodeCascade: NodeCascade, variableName: string, sccRecord = new SCCRecord()):
      CSSVariableValue|null {
    const availableCSSVariables = this.#availableCSSVariables.get(nodeCascade);
    const computedCSSVariables = this.#computedCSSVariables.get(nodeCascade);
    if (!computedCSSVariables || !availableCSSVariables?.has(variableName)) {
      return null;
    }

    if (computedCSSVariables?.has(variableName)) {
      return computedCSSVariables.get(variableName) || null;
    }

    let definedValue = availableCSSVariables.get(variableName);
    if (definedValue === undefined || definedValue === null) {
      return null;
    }

    if (definedValue.declaration.declaration instanceof CSSProperty && definedValue.declaration.value &&
        CSSMetadata.isCSSWideKeyword(definedValue.declaration.value)) {
      const resolvedProperty =
          this.resolveGlobalKeyword(definedValue.declaration.declaration, definedValue.declaration.value);
      if (!resolvedProperty) {
        return definedValue;
      }
      const declaration = new CSSValueSource(resolvedProperty);
      const {value} = declaration;
      if (!value) {
        return definedValue;
      }
      definedValue = {declaration, value};
    }

    const ast = PropertyParser.tokenizeDeclaration(`--${variableName}`, definedValue.value);
    if (!ast) {
      return null;
    }

    // While computing CSS variable values we need to detect declaration cycles. Every declaration on the cycle is
    // invalid. However, var()s outside of the cycle that reference a property on the cycle are not automatically
    // invalid, but rather use the fallback value. We use a version of Tarjan's algorithm to detect cycles, which are
    // SCCs on the custom property dependency graph. Computing variable values is DFS. When encountering a previously
    // unseen variable, we record its discovery time. We keep a stack of visited variables and detect cycles when we
    // find a reference to a variable already on the stack. For each node we also keep track of the "root" of the
    // corresponding SCC, which is the node in that component with the smallest discovery time. This is determined by
    // bubbling up the minimum discovery time whenever we close a cycle.
    const record = sccRecord.add(nodeCascade, variableName);

    const matching = PropertyParser.BottomUpTreeMatching.walk(ast, [
      new BaseVariableMatcher(match => {
        const parentStyle = definedValue.declaration.style;
        const nodeCascade = this.#styleToNodeCascade.get(parentStyle);
        if (!nodeCascade) {
          return null;
        }
        const childRecord = sccRecord.get(nodeCascade, match.name);
        if (childRecord) {
          if (sccRecord.isInInProgressSCC(childRecord)) {
            // Cycle detected, update the root.
            record.updateRoot(childRecord);
            return null;
          }

          // We've seen the variable before, so we can look up the text directly.
          return this.#computedCSSVariables.get(nodeCascade)?.get(match.name)?.value ?? null;
        }

        const cssVariableValue = this.innerComputeCSSVariable(nodeCascade, match.name, sccRecord);
        // Variable reference is resolved, so return it.
        const newChildRecord = sccRecord.get(nodeCascade, match.name);
        // The SCC record for the referenced variable may not exist if the var was already computed in a previous
        // iteration. That means it's in a different SCC.
        newChildRecord && record.updateRoot(newChildRecord);
        if (cssVariableValue?.value !== undefined) {
          return cssVariableValue.value;
        }

        // Variable reference is not resolved, use the fallback.
        if (!match.fallback) {
          return null;
        }
        if (match.fallback.length === 0) {
          return '';
        }
        if (match.matching.hasUnresolvedVarsRange(match.fallback[0], match.fallback[match.fallback.length - 1])) {
          return null;
        }
        return match.matching.getComputedTextRange(match.fallback[0], match.fallback[match.fallback.length - 1]);
      }),
      new EnvFunctionMatcher(this.#matchedStyles)
    ]);

    const decl = PropertyParser.ASTUtils.siblings(PropertyParser.ASTUtils.declValue(matching.ast.tree));
    const computedText = decl.length > 0 ? matching.getComputedTextRange(decl[0], decl[decl.length - 1]) : '';

    if (record.isRootEntry) {
      // Variables are kept on the stack until all descendents in the same SCC have been visited. That's the case when
      // completing the recursion on the root of the SCC.
      const scc = sccRecord.finishSCC(record);
      if (scc.length > 1) {
        for (const entry of scc) {
          console.assert(entry.nodeCascade === nodeCascade, 'Circles should be within the cascade');
          computedCSSVariables.set(entry.name, null);
        }
        return null;
      }
    }
    if (decl.length > 0 && matching.hasUnresolvedVarsRange(decl[0], decl[decl.length - 1])) {
      computedCSSVariables.set(variableName, null);
      return null;
    }

    const cssVariableValue = {value: computedText, declaration: definedValue.declaration};
    computedCSSVariables.set(variableName, cssVariableValue);
    return cssVariableValue;
  }

  styles(): CSSStyleDeclaration[] {
    return Array.from(this.#styleToNodeCascade.keys());
  }

  propertyState(property: CSSProperty): PropertyState|null {
    this.ensureInitialized();
    return this.#propertiesState.get(property) || null;
  }

  reset(): void {
    this.#initialized = false;
    this.#propertiesState.clear();
    this.#availableCSSVariables.clear();
    this.#computedCSSVariables.clear();
  }

  private ensureInitialized(): void {
    if (this.#initialized) {
      return;
    }
    this.#initialized = true;

    const activeProperties = new Map<string, CSSProperty>();
    for (const nodeCascade of this.#nodeCascades) {
      nodeCascade.computeActiveProperties();
      for (const [property, state] of nodeCascade.propertiesState) {
        if (state === PropertyState.OVERLOADED) {
          this.#propertiesState.set(property, PropertyState.OVERLOADED);
          continue;
        }
        const canonicalName = cssMetadata().canonicalPropertyName(property.name);
        if (activeProperties.has(canonicalName)) {
          this.#propertiesState.set(property, PropertyState.OVERLOADED);
          continue;
        }
        activeProperties.set(canonicalName, property);
        this.#propertiesState.set(property, PropertyState.ACTIVE);
      }
    }
    // If every longhand of the shorthand is not active, then the shorthand is not active too.
    for (const [canonicalName, shorthandProperty] of activeProperties) {
      const shorthandStyle = shorthandProperty.ownerStyle;
      const longhands = shorthandProperty.getLonghandProperties();
      if (!longhands.length) {
        continue;
      }
      let hasActiveLonghands = false;
      for (const longhand of longhands) {
        const longhandCanonicalName = cssMetadata().canonicalPropertyName(longhand.name);
        const longhandActiveProperty = activeProperties.get(longhandCanonicalName);
        if (!longhandActiveProperty) {
          continue;
        }
        if (longhandActiveProperty.ownerStyle === shorthandStyle) {
          hasActiveLonghands = true;
          break;
        }
      }
      if (hasActiveLonghands) {
        continue;
      }
      activeProperties.delete(canonicalName);
      this.#propertiesState.set(shorthandProperty, PropertyState.OVERLOADED);
    }

    // Work inheritance chain backwards to compute visible CSS Variables.
    const accumulatedCSSVariables = new Map<string, CSSVariableValue|null>();
    for (const rule of this.#registeredProperties) {
      const initialValue = rule.initialValue();
      accumulatedCSSVariables.set(
          rule.propertyName(),
          initialValue !== null ? {value: initialValue, declaration: new CSSValueSource(rule)} : null);
    }
    for (let i = this.#nodeCascades.length - 1; i >= 0; --i) {
      const nodeCascade = this.#nodeCascades[i];
      const variableNames = [];
      for (const entry of nodeCascade.activeProperties.entries()) {
        const propertyName = entry[0];
        const property = entry[1];
        if (propertyName.startsWith('--')) {
          accumulatedCSSVariables.set(propertyName, {value: property.value, declaration: new CSSValueSource(property)});
          variableNames.push(propertyName);
        }
      }
      const availableCSSVariablesMap = new Map(accumulatedCSSVariables);
      const computedVariablesMap = new Map();
      this.#availableCSSVariables.set(nodeCascade, availableCSSVariablesMap);
      this.#computedCSSVariables.set(nodeCascade, computedVariablesMap);
      for (const variableName of variableNames) {
        const prevValue = accumulatedCSSVariables.get(variableName);
        accumulatedCSSVariables.delete(variableName);
        const computedValue = this.innerComputeCSSVariable(nodeCascade, variableName);
        if (prevValue && computedValue?.value === prevValue.value) {
          computedValue.declaration = prevValue.declaration;
        }
        accumulatedCSSVariables.set(variableName, computedValue);
      }
    }
  }
}

export const enum PropertyState {
  ACTIVE = 'Active',
  OVERLOADED = 'Overloaded',
}
