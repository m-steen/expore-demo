import React from 'react';
import { Container, Row, Col, ButtonGroup, Tabs, Tab } from 'react-bootstrap';
import "bootstrap/dist/css/bootstrap.min.css";
import { observer } from 'mobx-react';
import { transaction } from 'mobx';
import { ValueType, ActionMeta } from 'react-select';
import './App.css';
import Application from './model/application';
import Canvas from './graphics/ui/Canvas';
import { ViewNode } from './graphics/model/view-model';
import { TitleBar } from './components/TitleBar';
import { CommandButton, Command } from './components/CommandButton';
import { SearchForm } from './components/SearchForm';
import { ExpandForm } from './components/ExpandMenu';
import { FilterForm } from './components/FilterForm';
import { DataTable } from './components/PropertyTable';


@observer
class App extends React.Component {
  appState = new Application('Explore demo');

  constructor(props: any) {
    super(props);
    // Load the model on startup...
    this.appState.api.loadModel(this.appState.view);
  }

  render() {
    const { title, view, grid } = this.appState;

    return (
      <Container fluid>
        <Row style={{ marginTop: 5, marginBottom: 5 }}>
          <TitleBar title={title} menuItems={[
            { label: 'Share', command: this.onLayout },
            { label: 'Save', command: this.onLayout },
          ]} />
        </Row>
        <Row style={{ marginTop: 5, marginBottom: 5 }}>
          <Col md={4} style={{ borderColor: 'lightgray', borderWidth: 'thin', borderStyle: 'solid' }}>
            <Tabs defaultActiveKey="profile" id="uncontrolled-tab-example">
              <Tab eventKey="search" title="Search">
                <SearchForm appState={this.appState} onSubmit={this.onQuerySubmit} onClear={this.onClear} />
              </Tab>
              <Tab eventKey="expand" title="Expand">
                <ExpandForm appState={this.appState} onSubmit={this.onExpandSubmit} />
              </Tab>
              <Tab eventKey="filter" title="Filter">
                <FilterForm appState={this.appState} onSubmit={this.onApplyFilter} />
              </Tab>
              <Tab eventKey='more' title='More'>
                <ButtonGroup vertical>
                  <CommandButton label={'Clear'} command={this.onClear} />
                  <CommandButton label={'Load All'} command={this.onLoad} />
                  <CommandButton label={'Layout'} command={this.onLayout} />
                </ButtonGroup>
              </Tab>
            </Tabs>
          </Col>
          <Col md={8}>
            <Tabs id="content-views">
              <Tab eventKey="graph" title="Graph">
                <Canvas view={view} />
              </Tab>
              <Tab eventKey="table" title="Table">
                <DataTable columns={grid.columns} rows={grid.rows} />
              </Tab>
            </Tabs>
          </Col>
        </Row>
      </Container>
    );
  }

  onClear: Command = () => new Promise((resolve) => {
    this.appState.view.clear();
    resolve();
  });

  onLoad: Command = () => {
    return this.appState.api.loadAll(this.appState.view)
      .then(() => this.appState.view.layout.apply());
  }

  onLayout: Command = () => this.appState.view.layout.apply();

  onQuerySubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const query = this.appState.query;
    const filter = this.appState.filter;
    const view = this.appState.view;
    transaction(() => {
      this.appState.api.getObjects(query, filter, view)
      .then(() => this.appState.filter.layers = [])
      .then(() => this.appState.view.layout.apply());
    })
  }

  onExpandSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const view = this.appState.view;
    const filter = this.appState.filter;
    // reset the layer filter
    filter.layers = [];
    // deselect any relations
    view.selection.filter((element) => !(element instanceof ViewNode)).forEach((rel) => view.toggleSelection(rel));
    // remember the current selection
    const currentSelection: ViewNode[] = [...view.selection].map((e) => e as ViewNode);
    Promise.all(
      currentSelection.map((node) => {
          return this.appState.api.expandRelations(node, filter, view);
        })
    )
    // then deselect the original selection and layout the result
    .then(() => currentSelection.forEach((node) => view.toggleSelection(node)))
    .then(() => this.appState.view.layout.apply());
  }

  filter = (eventKey: any, event: any) => {
    console.log(eventKey)
    this.appState.view.nodes.forEach((n) => {
      if (eventKey.includes(n.layer)) {
        console.log(n);
      }
    })
  }

  handleFilterChange = (options: ValueType<{ value: string, label: string }>, meta: ActionMeta) => {
    console.log(options)
    console.log(meta)
    if (options instanceof Array) {
      this.appState.filter.layers = options.map((option) => option.value);
    }
  }

  onApplyFilter = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const view = this.appState.view;
    const filter = this.appState.filter;
    if (filter.layers.length > 0) {
      view.nodes
        .filter((n) => !filter.layers.includes(n.layer))
        .forEach((n) => n.delete());
    }
    if (filter.types.length > 0) {
      view.nodes
        .filter((n) => !filter.types.includes(n.type))
        .forEach((n) => n.delete());
    }
  }

}

export default App;
