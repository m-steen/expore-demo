import { observable, transaction, computed, action } from 'mobx';
import { Color } from 'csstype';
import { MModel, MObject, MRelation } from "./model";
import { Position, Size } from '../graphics/graphics';
import Editor from '../editor/editor';
import { ForceLayout } from '../graphics/layout/force-layout';
import { Menu } from '../editor/menu';

export class ViewModel extends MModel {

  @computed get nodes(): ViewNode[] { return this.objects as ViewNode[]; }
  @computed get edges(): ViewEdge[] { return this.relations as ViewEdge[]; }

  origin = new Position(0, 0);
  size = new Size(1140, 1140 / 4 * 3);

  @observable x = this.origin.x;
  @observable y = this.origin.y;
  @observable w = this.size.width;
  @computed get h() { return this.w / 4 * 3; }

  @computed get viewport() { return [ this.x, this.y, this.w, this.h ]; }
  @computed get zoomFactor() { return this.size.width / this.w }

  @computed get minX() { return this.nodes.reduce((min, n) => Math.min(min, n.x), this.w/2)}
  @computed get maxX() { return this.nodes.reduce((max, n) => Math.max(max, n.x + n.width), 0)}
  @computed get minY() { return this.nodes.reduce((min, n) => Math.min(min, n.y), this.h/2)}
  @computed get maxY() { return this.nodes.reduce((max, n) => Math.max(max, n.y + n.height), 0)}

  layout = new ForceLayout(this);

  @observable contextMenuActiveFor: string | null = null;

  getEditor(): Editor {
    return this.editor;
  }

  addNode(type: string, name: string, id?: string): ViewNode {
    const newNode = new ViewNode(this, type, name, id);
    this.nodes.push(newNode);
    return newNode;
  }

  addEdge(type: string, source: ViewNode, target: ViewNode, name?: string, id?: string): ViewEdge {
    return transaction(() => {
      if (source instanceof ViewEdge) {
        // source is an edge itself: introduce a dummy node
        const dummyNode = new DummyNode(this, source);
        this.nodes.push(dummyNode);
        // replace the original edge with two segments to and from the dummy node
        const segment1 = new EdgeSegment(this, source, source.source, dummyNode);
        const segment2 = new EdgeSegment(this, source, dummyNode, source.target);
        this.edges.push(segment1);
        this.edges.push(segment2);
        this.edges.splice(this.edges.indexOf(source), 1);
        source = dummyNode;
      }
      if (target instanceof ViewEdge) {
        // target is an edge itself: introduce a dummy node
        const dummyNode = new DummyNode(this, target);
        this.nodes.push(dummyNode);
        // replace the original edge with two segments to and from the dummy node
        const segment1 = new EdgeSegment(this, target, target.source, dummyNode);
        const segment2 = new EdgeSegment(this, target, dummyNode, target.target);
        this.edges.push(segment1);
        this.edges.push(segment2);
        this.edges.splice(this.edges.indexOf(target), 1);
        target = dummyNode;
      }
      const newEdge = new ViewEdge(this, type, source, target, name, id);
      this.edges.push(newEdge);
      return newEdge;
    })
  }

  pan = (deltaX: number, deltaY: number) => {
    transaction(() => {
      this.x += deltaX;
      this.y += deltaY;
    })
  }

  zoom = (zoomBy: number) => {
    transaction(() => {
      this.x += zoomBy / this.zoomFactor;
      this.w -= zoomBy / this.zoomFactor * 2;
      this.y += zoomBy / this.zoomFactor * 4 / 3;
    })
  }

  zoomToFit() {
    if (this.maxX - this.minX > 0) {
      transaction(() => {
        this.x = this.minX - 20;
        this.y = this.minY - 20;
        this.w = Math.max(this.maxX - this.minX, (this.maxY - this.minY) * 4 / 3) + 40;
      })
    }
  }

  nodeColor: (node: ViewNode) => Color = (node: ViewNode) => 'lightgrey';

  nodeMenu: () => Menu<ViewNode> = () => new Menu();

}

export class ViewNode extends MObject {

  @observable x: number = Math.random() * 800;
  @observable y: number = Math.random() * 600;
  width: number = 40;
  height: number = 30;
  shape: string = '';

  @computed get label(): string { return this.name; };

  @computed get isPrimarySelection() {
    const selection = this.getView().getEditor().selection;
    return selection.length > 0 && selection[0] === this.id;
  }

  @computed get isSelected() {
    return this.getView().getEditor().selection.includes(this.id);
  }

  constructor(public parent: ViewModel, type: string, name?: string, id?: string) {
    super(type, name, id);
    this.shape = this.type;
  }

  delete = () => {
    if (this.parent.nodes.includes(this)) {
      this.parent.edges.filter((edge) => edge.source === this || edge.target === this)
        .forEach((edge) => edge.delete());
      if (this.isSelected) {
        this.parent.getEditor().toggleSelection(this);
      }
      this.parent.nodes.splice(this.parent.nodes.indexOf(this), 1);
    }
  }

  getView(): ViewModel {
    return this.parent;
  }

  @action
  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  @action
  setSize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

}

export class ViewEdge extends ViewNode {

  source: ViewNode;
  target: ViewNode;

  @computed get label(): string { return this.name; };

  @computed get isPrimarySelection() {
    const selection = this.getView().getEditor().selection;
    return selection.length > 0 && selection[0] === this.id;
  }

  @computed get isSelected() {
    return this.getView().getEditor().selection.includes(this.id);
  }

  constructor(parent: ViewModel, type: string, source: ViewNode, target: ViewNode, name?: string, id?: string) {
    super(parent, type, name, id);
    this.source = source;
    this.target = target;
  }

  delete = () => {
    if (this.parent.edges.includes(this)) {
      if (this.isSelected) {
        this.parent.getEditor().toggleSelection(this);
      }
      this.parent.edges.splice(this.parent.edges.indexOf(this), 1);
    }
  }
}

export class DummyNode extends ViewNode {

  constructor(parent: ViewModel, edge: ViewEdge) {
    super(parent, edge.type, edge.name, edge.id);
    this.shape = 'circle';
    this.setSize(20, 20);
  }
}

export class EdgeSegment extends ViewEdge {

  constructor(parent: ViewModel, protected edge: MRelation, source: ViewNode, target: ViewNode) {
    super(parent, edge.type, source, target, edge.name, edge.id);
    this.name = '';
  }
}
