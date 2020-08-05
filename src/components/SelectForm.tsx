import React from 'react';
import { observer } from 'mobx-react';
import { Form, InputGroup, Button, FormProps, ButtonGroup } from 'react-bootstrap';
import Application from '../model/application';
import Select, { ValueType, ActionMeta } from 'react-select';
import { CommandButton, Command } from '../wmf/components/CommandButton';
import { transaction } from 'mobx';

export interface ISelectForm extends FormProps {
  editor: Application;
  onSubmit?: React.FormEventHandler<any>;
  onClear: Command;
}

@observer
export class SelectForm extends React.Component<ISelectForm> {

  onQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.props.editor.query = e.target.value;
  }

  handleLayerFilterChange = (options: ValueType<{ value: string, label: string }>, meta: ActionMeta) => {
    console.log(options)
    console.log(meta)
    if (options instanceof Array) {
      this.props.editor.filter.layers = options.map((option) => option.value);
    }
  }

  handleTypeFilterChange = (options: ValueType<{ value: string, label: string }>, meta: ActionMeta) => {
    if (options instanceof Array) {
      this.props.editor.filter.types = options.map((option) => option.value);
    }
  }

  removeSelected = () => {
    const nodes = [...this.props.editor.view.nodes];
    transaction(() =>
      nodes.forEach((node) => {
        if (node.isSelected) {
          node.delete();
        }
      }))
  }

  removeUnselected = () => {
    const nodes = [...this.props.editor.view.nodes];
    transaction(() =>
      nodes.forEach((node) => {
        if (!node.isSelected) {
          node.delete();
        }
      }))
  }

  render() {
    const { query, filter, layers, objectTypes } = this.props.editor;
    const layerFilterOptions = layers.map((layer) => ({ value: layer, label: layer }));
    const activeLayerFilter = filter.layers.map((layer) => ({ value: layer, label: layer }));
    const typeFilterOptions =
      objectTypes
        .filter((type) => filter.layers.length === 0 || filter.layers.some((layer) => type.includes(layer)))
        .map((type) => ({ value: type, label: type }));
    const activeTypeFilter = filter.types.map((type) => ({ value: type, label: type }));

    return (
      <>
        <Form onSubmit={this.props.onSubmit}>
          <p>Current selection:{' '}
            {this.props.editor.selection.length}{' objects.'} </p>
          <Form.Group controlId="searchField">
            <Form.Label>Select by name</Form.Label>
            <InputGroup>
              <InputGroup.Prepend><InputGroup.Text>?</InputGroup.Text></InputGroup.Prepend>
              <Form.Control type="searchbar" placeholder="Select..." value={query} onChange={this.onQueryChange} />
            </InputGroup>
          </Form.Group>

          <Form.Group controlId="searchFilters">
            <Form.Label>Select by layer</Form.Label>
            <Select key='layerSelect' styles={{ container: (provided) => ({ ...provided, width: '100%' }) }}
              placeholder={'Select layers...'}
              options={layerFilterOptions}
              onChange={this.handleLayerFilterChange}
              value={activeLayerFilter}
              isMulti
              closeMenuOnSelect={true} />
            <Form.Label>Select by type</Form.Label>
            <Select key='typeSelect' styles={{ container: (provided) => ({ ...provided, width: '100%' }) }}
              placeholder={'Select types...'}
              options={typeFilterOptions}
              onChange={this.handleTypeFilterChange}
              value={activeTypeFilter}
              isMulti
              closeMenuOnSelect={false} />
          </Form.Group>
          <CommandButton label={'Clear Selection'} command={this.props.onClear} />
          <Button variant="primary" type="submit">Select</Button>
        </Form>
        <ButtonGroup>
          <Button type="button" onClick={this.removeSelected}>Remove Selected Objects</Button>{' '}
          <Button type="button" onClick={this.removeUnselected}>Remove Unselected Objects</Button>
        </ButtonGroup>
      </>
    )
  }
}
