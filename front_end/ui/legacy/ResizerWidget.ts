// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Common from '../../core/common/common.js';

import {elementDragStart} from './UIUtils.js';

export class ResizerWidget extends Common.ObjectWrapper.ObjectWrapper<EventTypes> {
  private isEnabledInternal = true;
  private elementsInternal = new Set<HTMLElement>();
  private readonly installDragOnMouseDownBound: (event: Event) => false | undefined;
  private cursorInternal: string;
  private startX?: number;
  private startY?: number;

  constructor() {
    super();

    this.installDragOnMouseDownBound = this.installDragOnMouseDown.bind(this);
    this.cursorInternal = 'nwse-resize';
  }

  isEnabled(): boolean {
    return this.isEnabledInternal;
  }

  setEnabled(enabled: boolean): void {
    this.isEnabledInternal = enabled;
    this.updateElementCursors();
  }

  elements(): Element[] {
    return [...this.elementsInternal];
  }

  addElement(element: HTMLElement): void {
    if (!this.elementsInternal.has(element)) {
      this.elementsInternal.add(element);
      element.addEventListener('pointerdown', this.installDragOnMouseDownBound, false);
      this.updateElementCursor(element);
    }
  }

  removeElement(element: HTMLElement): void {
    if (this.elementsInternal.has(element)) {
      this.elementsInternal.delete(element);
      element.removeEventListener('pointerdown', this.installDragOnMouseDownBound, false);
      element.style.removeProperty('cursor');
    }
  }

  updateElementCursors(): void {
    this.elementsInternal.forEach(this.updateElementCursor.bind(this));
  }

  private updateElementCursor(element: HTMLElement): void {
    if (this.isEnabledInternal) {
      element.style.setProperty('cursor', this.cursor());
      element.style.setProperty('touch-action', 'none');
    } else {
      element.style.removeProperty('cursor');
      element.style.removeProperty('touch-action');
    }
  }

  cursor(): string {
    return this.cursorInternal;
  }

  setCursor(cursor: string): void {
    this.cursorInternal = cursor;
    this.updateElementCursors();
  }

  private installDragOnMouseDown(event: Event): false|undefined {
    const element = (event.target as HTMLElement);
    // Only handle drags of the nodes specified.
    if (!this.elementsInternal.has(element)) {
      return false;
    }
    elementDragStart(element, this.dragStart.bind(this), event => {
      this.drag(event);
    }, this.dragEnd.bind(this), this.cursor(), event);
    return undefined;
  }

  private dragStart(event: MouseEvent): boolean {
    if (!this.isEnabledInternal) {
      return false;
    }
    this.startX = event.pageX;
    this.startY = event.pageY;
    this.sendDragStart(this.startX, this.startY);
    return true;
  }

  sendDragStart(x: number, y: number): void {
    this.dispatchEventToListeners(Events.RESIZE_START, {startX: x, currentX: x, startY: y, currentY: y});
  }

  private drag(event: MouseEvent): boolean {
    if (!this.isEnabledInternal) {
      this.dragEnd(event);
      return true;  // Cancel drag.
    }
    this.sendDragMove((this.startX as number), event.pageX, (this.startY as number), event.pageY, event.shiftKey);
    event.preventDefault();
    return false;  // Continue drag.
  }

  sendDragMove(startX: number, currentX: number, startY: number, currentY: number, shiftKey: boolean): void {
    this.dispatchEventToListeners(Events.RESIZE_UPDATE_XY, {startX, currentX, startY, currentY, shiftKey});
  }

  private dragEnd(_event: MouseEvent): void {
    this.dispatchEventToListeners(Events.RESIZE_END);
    delete this.startX;
    delete this.startY;
  }
}

export const enum Events {
  RESIZE_START = 'ResizeStart',
  RESIZE_UPDATE_XY = 'ResizeUpdateXY',
  RESIZE_UPDATE_POSITION = 'ResizeUpdatePosition',
  RESIZE_END = 'ResizeEnd',
}

export interface ResizeStartXYEvent {
  startX: number;
  currentX: number;
  startY: number;
  currentY: number;
}

export interface ResizeStartPositionEvent {
  startPosition: number;
  currentPosition: number;
}

export interface ResizeUpdateXYEvent {
  startX: number;
  currentX: number;
  startY: number;
  currentY: number;
  shiftKey: boolean;
}

export interface ResizeUpdatePositionEvent {
  startPosition: number;
  currentPosition: number;
  shiftKey: boolean;
}

export interface EventTypes {
  [Events.RESIZE_START]: ResizeStartXYEvent|ResizeStartPositionEvent;
  [Events.RESIZE_UPDATE_XY]: ResizeUpdateXYEvent;
  [Events.RESIZE_UPDATE_POSITION]: ResizeUpdatePositionEvent;
  [Events.RESIZE_END]: void;
}

export class SimpleResizerWidget extends ResizerWidget {
  private isVerticalInternal: boolean;
  constructor() {
    super();
    this.isVerticalInternal = true;
  }

  isVertical(): boolean {
    return this.isVerticalInternal;
  }

  /**
   * Vertical widget resizes height (along y-axis).
   */
  setVertical(vertical: boolean): void {
    this.isVerticalInternal = vertical;
    this.updateElementCursors();
  }

  override cursor(): string {
    return this.isVerticalInternal ? 'ns-resize' : 'ew-resize';
  }

  override sendDragStart(x: number, y: number): void {
    const position = this.isVerticalInternal ? y : x;
    this.dispatchEventToListeners(Events.RESIZE_START, {startPosition: position, currentPosition: position});
  }

  override sendDragMove(startX: number, currentX: number, startY: number, currentY: number, shiftKey: boolean): void {
    if (this.isVerticalInternal) {
      this.dispatchEventToListeners(
          Events.RESIZE_UPDATE_POSITION, {startPosition: startY, currentPosition: currentY, shiftKey});
    } else {
      this.dispatchEventToListeners(
          Events.RESIZE_UPDATE_POSITION, {startPosition: startX, currentPosition: currentX, shiftKey});
    }
  }
}
