import { Database, aql } from 'arangojs';
import { v4 as uuid } from 'uuid';
import { GraphicalView, ViewNode, ViewEdge } from '../graphics/model/view-model';
import { Filter } from '../model/application';

class Api {
  url: string = 'http://localhost:8529';
  username: string = 'root';
  password: string = 'openSesame';
  db: Database;

  constructor() {
    this.db = new Database({
      url: this.url,
    });
    this.db.useBasicAuth(this.username, this.password);
  }

  getObjects: (query: string, filter: Filter, view: GraphicalView) => Promise<void> =
    (query, filter, view) => {
      view.layout.stop();
      const iteratorPart = query.length === 0 ? aql`FOR obj IN Objects` : aql`FOR obj IN FULLTEXT("Objects", "name", ${query})`;
      const layerFilter = filter.layers.length > 0 ? aql`FILTER obj.meta.category IN ${filter.layers}` : aql``;
      const typeFilter = filter.types.length > 0 ? aql`FILTER obj.meta.types[0] IN ${filter.types}` : aql``;
      const aquery = aql`
        ${iteratorPart}
        ${layerFilter}
        ${typeFilter}
        RETURN obj`;
      console.log(aquery)
      return this.db.query(aquery)
        .then((array) => {
          array.each((obj) => {
            console.log(obj)
            let node = view.nodes.find((x) => obj.id === x.id);
            if (node === undefined) {
              node = new ViewNode(view);
              node.id = obj.id;
              node.label = obj.name;
              node.layer = obj.meta.category;
              node.type = obj.meta.types[0];
              node.shape = obj.meta.types[0];
              node.width = 40;
              node.height = 30;
              view.nodes.push(node);
              view.selection.push(node);
            }
          })
        });
    }

  getRelationsFrom: (node: ViewNode, filter: Filter, view: GraphicalView) => Promise<void> =
    (source, filter, view) => {
      const relationFilter = filter.relations.length > 0 ? aql`FILTER e.meta.types[1] IN ${filter.relations}` : aql``;
      const typeFilter = filter.types.length > 0 ? aql`FILTER v.meta.types[0] IN ${filter.types}` : aql``;
      const aquery = aql`
        FOR v, e, p IN 1..1 OUTBOUND ${'Objects/' + source.id}
        GRAPH "objectRelations"
        ${relationFilter}
        ${typeFilter}
        RETURN {source: DOCUMENT(${'Objects/' + source.id}), relation: e, target: v}
      `
      console.log(aquery)
      return this.db.query(aquery)
        .then((array) => {
          array.each((result) => {
            console.log(result)
            const { relation: r, target: t } = result;
            let target = view.nodes.find((x) => t.id === x.id);
            if (target === undefined) {
              target = new ViewNode(view);
              target.id = t.id;
              target.label = t.name;
              target.layer = t.meta.category;
              target.type = t.meta.types[0]
              target.shape = t.meta.types[0];
              target.width = 40;
              target.height = 30;
              view.nodes.push(target);
              view.selection.push(target);
            }
            let edge = view.edges.find((x) => r.id === x.id);
            if (edge === undefined) {
              edge = new ViewEdge(view, source, target);
              edge.id = r.id;
              edge.label = r.meta.types[1].replace('Relation', '');
              edge.type = r.meta.types[1];
              view.edges.push(edge);
            }
          })
        });
    }

  getRelationsTo: (node: ViewNode, filter: Filter, view: GraphicalView) => Promise<void> =
    (target, filter, view) => {
      const relationFilter = filter.relations.length > 0 ? aql`FILTER e.meta.types[1] IN ${filter.relations}` : aql``;
      const typeFilter = filter.types.length > 0 ? aql`FILTER v.meta.types[0] IN ${filter.types}` : aql``;
      const aquery = aql`
        FOR v, e, p IN 1..1 INBOUND ${'Objects/' + target.id}
        GRAPH "objectRelations"
        ${relationFilter}
        ${typeFilter}
        RETURN {source: v, relation: e, target: DOCUMENT(${'Objects/' + target.id})}
      `
      return this.db.query(aquery)
        .then((array) => {
          array.each((result) => {
            console.log(result)
            const { source: s, relation: r } = result;
            let source = view.nodes.find((x) => s.id === x.id);
            if (source === undefined) {
              source = new ViewNode(view);
              source.id = s.id;
              source.label = s.name;
              source.layer = s.meta.category;
              source.type = s.meta.types[0];
              source.shape = s.meta.types[0];
              source.width = 40;
              source.height = 30;
              view.nodes.push(source);
              view.selection.push(source);
            }
            let edge = view.edges.find((x) => r.id === x.id);
            if (edge === undefined) {
              edge = new ViewEdge(view, source, target);
              edge.id = r.id;
              edge.label = r.meta.types[1].replace('Relation', '');
              edge.type = r.meta.types[1];
              view.edges.push(edge);
            }
          })
        });
    }

    expandRelations: (node: ViewNode, filter: Filter, view: GraphicalView) => Promise<void> =
    (node, filter, view) => {
      let promise: Promise<void> = Promise.resolve();
      if (filter.outgoing) {
        promise = this.getRelationsFrom(node, filter, view);
      }
      if (filter.incoming) {
        promise = promise.then(() => this.getRelationsTo(node, filter, view));
      }
      return promise;
    }

    loadAll: (view: GraphicalView) => Promise<void> =
    (view) => {
      const aquery = aql`
      FOR v IN Objects
        FOR v1, e, p IN 1..1 OUTBOUND v
        GRAPH 'objectRelations'
          RETURN {source: v, relation: e, target: v1}
      `
      console.log(aquery)
      return this.db.query(aquery)
        .then((array) => {
          array.each((result) => {
            const { source: s, relation: r, target: t } = result;
            let source = view.nodes.find((x) => s.id === x.id);
            if (source === undefined) {
              source = new ViewNode(view);
              source.id = s.id;
              source.label = s.name;
              source.layer = s.meta.category;
              source.type = s.meta.types[0];
              source.shape = s.meta.types[0];
              source.width = 40;
              source.height = 30;
              view.nodes.push(source);
            }
            let target = view.nodes.find((x) => t.id === x.id);
            if (target === undefined) {
              target = new ViewNode(view);
              target.id = t.id;
              target.label = t.name;
              target.layer = t.meta.category;
              target.type = t.meta.types[0];
              target.shape = t.meta.types[0];
              target.width = 40;
              target.height = 30;
              view.nodes.push(target);
            }
            let edge = view.edges.find((x) => r.id === x.id);
            if (edge === undefined) {
              edge = new ViewEdge(view, source, target);
              edge.id = r.id;
              edge.label = r.meta.types[1].replace('Relation', '');
              edge.type = r.meta.types[1];
              view.edges.push(edge);
            }
          })
        });
    }

  loadModel: (view: GraphicalView) => Promise<void> = (view: GraphicalView) => {
    view.clear();
    return new Promise((resolve) => {

      const n1 = new ViewNode(view);
      n1.label = 'First Element';
      n1.id = uuid();
      n1.x = 300;
      n1.y = 200;
      n1.width = 40;
      n1.height = 30;
      view.nodes.push(n1);

      const n2 = new ViewNode(view);
      n2.label = 'Second Element';
      n2.id = uuid();
      n2.x = 600;
      n2.y = 400;
      n2.width = 40;
      n2.height = 30;
      view.nodes.push(n2);

      const n3 = new ViewNode(view);
      n3.label = 'Third Element';
      n3.id = uuid();
      n3.x = 500;
      n3.y = 300;
      n3.width = 40;
      n3.height = 30;
      view.nodes.push(n3);

      const e1 = new ViewEdge(view, n1, n2);
      e1.label = 'relation';
      e1.id = uuid();
      view.edges.push(e1);

      const e2 = new ViewEdge(view, n1, n3);
      e2.label = 'relation';
      e2.id = uuid();
      view.edges.push(e2);

      resolve();
    });
  }
}

export default Api;