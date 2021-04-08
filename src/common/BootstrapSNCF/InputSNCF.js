/* eslint-disable max-classes-per-file */
import React from 'react';
import PropTypes from 'prop-types';

/**
 * The InputSNCF component can be used for basic inputs as well as for advanced search inputs
 *
 * @component
 * @example
 * const id = 'custom-id'
 * const type = 'text'
 * const onChange = (e) => console.log(e.target.value)
 * const value = 'Some input'
 * const readonly = false
 * return (
 *  <InputSNCF
 *    id={id}
 *    type={type}
 *    onChange={onChange}
 *    value={value}
 *    readonly={readonly}
 *  />
 * )
 */

class InputSNCF extends React.Component {
  static propTypes = {
    // Basic input props
    id: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    label: PropTypes.string,
    placeholder: PropTypes.string,
    onChange: PropTypes.func,
    value: PropTypes.string,
    readonly: PropTypes.bool,
    inputProps: PropTypes.object,
    // Error handling
    isInvalid: PropTypes.bool,
    errorMsg: PropTypes.string,
    // Clear button
    /** If a clear button must be displayed or not */
    clearButton: PropTypes.bool,
    /** The function called by the clear button */
    onClear: PropTypes.func,
    // Options for the appened icon
    appendOptions: PropTypes.shape({
      iconName: PropTypes.string.isRequired,
      onClick: PropTypes.func.isRequired,
      name: PropTypes.string.isRequired,
    }),
    // Styling props
    seconds: PropTypes.bool,
    sm: PropTypes.bool,
    whiteBG: PropTypes.bool,
    noMargin: PropTypes.bool,
  }

  static defaultProps = {
    // Basic input props
    label: undefined,
    placeholder: undefined,
    onChange: undefined,
    value: undefined,
    readonly: false,
    inputProps: {},
    // Error handling
    isInvalid: false,
    errorMsg: undefined,
    // Clear button
    clearButton: false,
    onClear: undefined,
    // Options for the appened icon
    appendOptions: undefined,
    // Styling props
    seconds: false,
    sm: false,
    whiteBG: false,
    noMargin: false,
  }

  // Appends a icon button right next to the input field
  renderAppendButton = () => {
    const { appendOptions } = this.props;
    if (appendOptions) {
      return (
        <div className="input-group-append input-group-last">
          <button type="button" className="btn btn-primary btn-only-icon active" onClick={appendOptions.onClick}>
            <i className={appendOptions.iconName} aria-hidden="true" />
            <span className="sr-only">{appendOptions.name}</span>
          </button>
        </div>
      );
    }

    return null;
  }

  // Displays a button at the end of the input field to clear the input
  renderClearButton = () => {
    const { value, clearButton, onClear } = this.props;

    const displayClearButton = clearButton && value && value.length !== 0;

    // Returns null if the clear button is not used
    if (!displayClearButton) return null;

    // Else renders the button
    return (
      <button type="button" className="btn-clear btn-primary" onClick={onClear}>
        <span className="sr-only">Supprimer le texte</span>
        <i className="icons-close" aria-hidden="true" />
      </button>
    );
  }

  // Renders a basic input field without any underlying list
  renderBasicInput = () => {
    const {
      isInvalid, errorMsg, label, id, type, onChange, seconds, sm,
      readonly, whiteBG, clearButton, value, placeholder, inputProps,
    } = this.props;

    // Build custom classes
    const formSize = sm ? 'form-control-sm' : '';
    const readOnlyFlag = readonly ? 'readonly' : '';
    const backgroundColor = whiteBG ? 'bg-white' : '';
    const clearOption = clearButton ? 'clear-option' : '';

    // Test and adapt display if entry is invalid
    let invalidClass = '';
    let invalidMsg = null;
    if (isInvalid) {
      invalidClass = 'is-invalid';
      invalidMsg = (
        <div className="invalid-feedback d-block" id="inputGroupPrepend">
          {errorMsg}
        </div>
      );
    }

    return (
      <>
        {label && (
        <label className="font-weight-medium mb-2" htmlFor={id}>{label}</label>
        )}
        <div className="input-group">
          <div className={`form-control-container ${invalidClass}`}>
            <input
              type={type}
              onChange={onChange}
              className={`form-control ${backgroundColor} ${formSize} ${readOnlyFlag} ${clearOption}`}
              id={id}
              value={value}
              placeholder={placeholder}
              step={seconds ? 1 : 60}
              {...inputProps}
            />
            <span className="form-control-state" />
            {this.renderClearButton()}
          </div>
          {this.renderAppendButton()}
          {invalidMsg}
        </div>
      </>
    );
  }

  render() {
    const { noMargin } = this.props;

    // Build conditional classes
    const containerMargin = noMargin ? '' : 'mb-4';

    return (
      <div className={`w-100 ${containerMargin}`}>
        {this.renderBasicInput()}
      </div>
    );
  }
}

export default InputSNCF;
