'use strict';

import React, {Component, useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle} from 'react';
import {useTranslation, shortLanguage} from './i18n';
import axios, {HTTPMethod} from './axios';
import Immutable from 'immutable';
import PropTypes from 'prop-types';
import interoperableErrors from '../../../shared/interoperable-errors';
import {TreeSelectMode, TreeTable} from './tree';
import {Table, TableSelectMode} from './table';
import {Button} from "./bootstrap-components";
import {SketchPicker} from 'react-color';
import {useFormStateOwner} from './hooks/useFormStateOwner';
import {useErrorHandling} from './hooks/useErrorHandling';
import {usePageHelpers} from './hooks/usePageHelpers';

import ACEEditorRaw from 'react-ace';
import 'ace-builds/src-noconflict/theme-github';
import 'ace-builds/src-noconflict/ext-searchbox';

import {DayPicker} from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { fr, enUS, es, pt, de } from 'date-fns/locale';
import {
    birthdayYear,
    DateFormat,
    formatBirthday,
    formatDate,
    getBirthdayFormatString,
    getDateFormatString,
    parseBirthday,
    parseDate
} from '../../../shared/date';

import "./styles.scss";
import moment from "moment";
import {getUrl} from "./urls";
import {createComponentMixin} from "./decorator-helpers";


const FormState = {
    Loading: 0,
    LoadingWithNotice: 1,
    Ready: 2
};

const FormSendMethod = HTTPMethod;

export const FormStateOwnerContext = React.createContext(null);

const withFormStateOwner = createComponentMixin({
    contexts: [{context: FormStateOwnerContext, propName: 'formStateOwner'}],
    decoratorFn: (TargetClass, InnerClass) => {
        InnerClass.prototype.getFormStateOwner = function () {
            return this.props.formStateOwner;
        };
        return {};
    }
});

export function withFormErrorHandlers(target, name, descriptor) {
    const asyncFn = descriptor.value;

    descriptor.value = async function(...args) {
        await this.formHandleErrors(async () => await asyncFn.apply(this, args));
    };

    return descriptor;
}

function Form({ stateOwner, onSubmitAsync, format, noStatus, children }) {
    const { t } = useTranslation();
    const { handleError } = useErrorHandling();
    const { registerBeforeUnloadHandlers, deregisterBeforeUnloadHandlers } = usePageHelpers();

    const beforeUnloadHandlersRef = useRef({
        handler: () => stateOwner.isFormChanged(),
        handlerAsync: async () => await stateOwner.isFormChangedAsync()
    });

    useEffect(() => {
        if (!stateOwner.isLeaveConfirmationEnabled?.()) return;
        registerBeforeUnloadHandlers(beforeUnloadHandlersRef.current);
        return () => deregisterBeforeUnloadHandlers(beforeUnloadHandlersRef.current);
    }, []);

    async function onSubmit(evt) {
        evt.preventDefault();
        if (onSubmitAsync) {
            try { await onSubmitAsync(); } catch (e) { handleError(e); }
        }
    }

    const statusMessageText = stateOwner.getFormStatusMessageText();
    const statusMessageSeverity = stateOwner.getFormStatusMessageSeverity();

    let formClass = "form";
    if (format === 'wide') formClass = '';
    else if (format === 'inline') formClass = 'form-inline';

    if (!stateOwner.isFormReady()) {
        if (stateOwner.isFormWithLoadingNotice()) {
            return <p className={`alert alert-info ${"formStatus"}`} role="alert">{t('loading')}</p>;
        } else {
            return <div></div>;
        }
    }

    return (
        <form className={formClass} onSubmit={onSubmit}>
            <FormStateOwnerContext.Provider value={stateOwner}>
                <fieldset disabled={stateOwner.isFormDisabled()}>
                    {children}
                </fieldset>
                {!noStatus && statusMessageText &&
                <AlignedRow format={format} htmlId="form-status-message">
                    <div className={`alert alert-${statusMessageSeverity} ${"formStatus"}`} role="alert">{statusMessageText}</div>
                </AlignedRow>
                }
            </FormStateOwnerContext.Provider>
        </form>
    );
}

Form.propTypes = {
    stateOwner: PropTypes.object.isRequired,
    onSubmitAsync: PropTypes.func,
    format: PropTypes.string,
    noStatus: PropTypes.bool
};

function Fieldset({ id, label, help, flat, className: propClassName, children }) {
    const owner = useFormStateOwner();
    const htmlId = 'form_' + id;

    let className = id ? owner.addFormValidationClass('', id) : null;
    if (propClassName) {
        className = (className || '') + ' ' + propClassName;
    }

    if (flat) {
        return (
            <div>
                {children}
            </div>
        );
    } else {
        return (
            <fieldset className={className}>
                {label && <legend>{label}</legend>}
                {help && <div className="help-block">{help}</div>}
                {children}
            </fieldset>
        );
    }
}

function wrapInput(id, htmlId, owner, format, rightContainerClass, label, help, input) {
    // wrapInput may be used also outside forms to make a kind of fake read-only forms
    let className;
    if (owner) {
        className = 'form-group';
    } else {
        className = "staticFormGroup";
    }

    let colLeft = '';
    let colRight = '';

    switch (format) {
        case 'wide':
            colLeft = '';
            colRight = '';
            break;
        case 'inline':
            colLeft = 'mr-3';
            colRight = '';
            break;
        default:
            className = className + ' row';
            colLeft = 'col-sm-2 col-form-label';
            colRight = 'col-sm-10';
            break;
    }

    let helpBlock = null;
    if (help) {
        helpBlock = <small className={`form-text text-muted`} id={htmlId + '_help'}>{help}</small>;
    }

    let validationBlock = null;
    if (id) {
        const validationMsg = id && owner.getFormValidationMessage(id);
        if (validationMsg) {
            validationBlock = <div className="invalid-feedback" id={htmlId + '_help_validation'}>{validationMsg}</div>;
        }
    }

    let labelBlock = null;
    if (label) {
        labelBlock = <label className={colLeft}>{label}</label>;
    } else {
        labelBlock = <div className={colLeft}/>;
    }

    if (format === 'inline') {
        return (
            <div className={className}>
                {labelBlock}{input}
                {helpBlock}
                {validationBlock}
            </div>
        );
    } else {
        return (
            <div className={className}>
                {labelBlock}
                <div className={`${colRight} ${rightContainerClass}`}>
                    {input}
                    {helpBlock}
                    {validationBlock}
                </div>
            </div>
        );
    }
}

function StaticField({ id, label, help, className: propClassName, format, withValidation, children }) {
    const owner = useFormStateOwner();
    const htmlId = 'form_' + id;

    let className = propClassName || 'form-control-static';

    if (withValidation && owner) {
        className = owner.addFormValidationClass(className, id);
    }

    return wrapInput(id, htmlId, owner, format, '', label, help,
        <div id={htmlId} className={className} aria-describedby={htmlId + '_help'}>{children}</div>
    );
}

function InputField({ id, label, placeholder, type = 'text', help, format, withHints, disabled, children }) {
    const owner = useFormStateOwner();
    const htmlId = 'form_' + id;

    const className = owner.addFormValidationClass('form-control', id);
    const value = owner.getFormValue(id);

    let hints = null;
    if (withHints && withHints.length > 0) {
        const hintItems = withHints.map((hint, idx) => (
            <li key={idx} className="hint-item" onClick={() => owner.updateFormValue(id, hint)}>
                {hint}
            </li>
        ));
        hints = <ul className="hints-list">{hintItems}</ul>;
    }

    return wrapInput(id, htmlId, owner, format, '', label, help,
        <div>
            <input type={type} value={value || ''} placeholder={placeholder} id={htmlId}
                   className={className} aria-describedby={htmlId + '_help'}
                   onChange={evt => owner.updateFormValue(id, evt.target.value)}
                   disabled={disabled}/>
            {children}
            {hints}
        </div>
    );
}

InputField.propTypes = {
    id: PropTypes.string.isRequired,
    label: PropTypes.string,
    placeholder: PropTypes.string,
    type: PropTypes.string,
    help: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    format: PropTypes.string,
    withHints: PropTypes.array,
    disabled: PropTypes.bool,
    children: PropTypes.node
};


function CheckBox({ id, text, label, help, format, className }) {
    const owner = useFormStateOwner();
    const htmlId = 'form_' + id;
    const inputClassName = owner.addFormValidationClass('form-check-input', id);

    return wrapInput(id, htmlId, owner, format, '', label, help,
        <div className={`form-group form-check my-2 ${className || ''}`}>
            <input className={inputClassName} type="checkbox"
                   checked={owner.getFormValue(id)}
                   id={htmlId}
                   aria-describedby={htmlId + '_help'}
                   onChange={() => owner.updateFormValue(id, !owner.getFormValue(id))}/>
            <label className={"checkboxText"} htmlFor={htmlId}>{text}</label>
        </div>
    );
}

CheckBox.propTypes = {
    id: PropTypes.string.isRequired,
    text: PropTypes.string,
    label: PropTypes.string,
    help: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    format: PropTypes.string,
    className: PropTypes.string
};

function CheckBoxGroup({ id, label, help, options, className, format }) {
    const owner = useFormStateOwner();
    const htmlId = 'form_' + id;
    const selection = owner.getFormValue(id);

    function onChange(key) {
        const existingSelection = owner.getFormValue(id);
        let newSelection;
        if (existingSelection.includes(key)) {
            newSelection = existingSelection.filter(x => x !== key);
        } else {
            newSelection = [key, ...existingSelection];
        }
        owner.updateFormValue(id, newSelection.sort());
    }

    const optionEls = [];
    for (const option of options) {
        const optClassName = owner.addFormValidationClass('form-check-input', id);
        const optId = htmlId + '_' + option.key;
        optionEls.push(
            <div key={option.key} className="form-group form-check my-2">
                <input id={optId} type="checkbox" className={optClassName}
                       checked={selection.includes(option.key)}
                       onChange={() => onChange(option.key)}/>
                <label className="form-check-label" htmlFor={optId}>{option.label}</label>
            </div>
        );
    }

    return wrapInput(id, htmlId, owner, format, '', label, help, <div>{optionEls}</div>);
}

CheckBoxGroup.propTypes = {
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    help: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    options: PropTypes.array,
    className: PropTypes.string,
    format: PropTypes.string
};

function RadioGroup({ id, label, help, options, className, format }) {
    const owner = useFormStateOwner();
    const htmlId = 'form_' + id;
    const value = owner.getFormValue(id);

    const optionEls = [];
    for (const option of options) {
        const optClassName = owner.addFormValidationClass('form-check-input', id);
        const optId = htmlId + '_' + option.key;
        optionEls.push(
            <div key={option.key} className="form-group form-check my-2">
                <input id={optId} type="radio" className={optClassName} name={htmlId}
                       checked={value === option.key}
                       onChange={() => owner.updateFormValue(id, option.key)}/>
                <label className="form-check-label" htmlFor={optId}>{option.label}</label>
            </div>
        );
    }

    return wrapInput(id, htmlId, owner, format, '', label, help, <div>{optionEls}</div>);
}

RadioGroup.propTypes = {
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    help: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    options: PropTypes.array,
    className: PropTypes.string,
    format: PropTypes.string
};

function TextArea({ id, label, placeholder, help, format, className }) {
    const owner = useFormStateOwner();
    const htmlId = 'form_' + id;
    const cls = owner.addFormValidationClass('form-control ' + (className || ''), id);

    return wrapInput(id, htmlId, owner, format, '', label, help,
        <textarea id={htmlId} placeholder={placeholder} value={owner.getFormValue(id) || ''}
                  className={cls} aria-describedby={htmlId + '_help'}
                  onChange={evt => owner.updateFormValue(id, evt.target.value)}/>
    );
}

TextArea.propTypes = {
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    placeholder: PropTypes.string,
    help: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    format: PropTypes.string,
    className: PropTypes.string
};

function ColorPicker({ id, label, help, format }) {
    const owner = useFormStateOwner();
    const htmlId = 'form_' + id;
    const [opened, setOpened] = useState(false);
    const color = owner.getFormValue(id);

    return wrapInput(id, htmlId, owner, format, '', label, help,
        <div>
            <div className="input-group">
                <div className={"colorPickerSwatchWrapper"} onClick={() => setOpened(!opened)}>
                    <div className={"colorPickerSwatchColor"}
                         style={{background: `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`}}/>
                </div>
            </div>
            {opened && <>
                <div className={"overlay"} onClick={() => setOpened(false)}/>
                <div className={"colorPickerWrapper"}>
                    <SketchPicker color={color} onChangeComplete={value => {
                        setOpened(false);
                        owner.updateFormValue(id, value.rgb);
                    }} className={"dialog"}/>
                </div>
            </>}
        </div>
    );
}

ColorPicker.propTypes = {
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    help: PropTypes.oneOfType([PropTypes.string, PropTypes.object])
};

function ColumnSelect({ selectedValue, onSelect, header, options }) {
    function onKeyUp(event) {
        if (event.key === 'Enter') event.target.click();
    }

    function onKeyDown(event) {
        const key = event.key;
        if ((key === 'ArrowUp' || key === 'ArrowDown') && event.target === event.currentTarget) {
            event.currentTarget.querySelector(`.columnSelectItem`).focus();
        } else if (key === 'ArrowUp') {
            const previous = event.target.previousSibling;
            if (previous) previous.focus();
        } else if (key === 'ArrowDown') {
            const next = event.target.nextSibling;
            if (next) next.focus();
        }
    }

    function scrollColumnBy(e, y) {
        e.target.parentNode.getElementsByClassName("columnSelect")[0].scrollBy(0, y);
    }

    const optionEls = options.map(option => {
        let cls = "columnSelectItem";
        if (option === selectedValue) cls += ` columnSelectItemSelected`;
        return (
            <li key={option} className={cls} tabIndex='-1' onClick={() => onSelect(option)}>
                {option}
            </li>
        );
    });

    return (
        <div className={"columnSelectWrapper"}>
            {header && <div className={"columnSelectHeader"}>{header}</div>}
            <div className={"columnScroller"} onClick={e => scrollColumnBy(e, -50)}>&uarr;</div>
            <ul className={"columnSelect"} tabIndex='0' onKeyUp={onKeyUp} onKeyDown={onKeyDown}>
                {optionEls}
            </ul>
            <div className={"columnScroller"} onClick={e => scrollColumnBy(e, 50)}>&darr;</div>
        </div>
    );
}

ColumnSelect.propTypes = {
    selectedValue: PropTypes.any,
    onSelect: PropTypes.func,
    header: PropTypes.string,
    options: PropTypes.array
};

function TimePicker({ time, onChange }) {
    const { t } = useTranslation();

    function generateTimeOptions(start, end, step = 1) {
        const arr = [];
        for (let i = start; i <= end; i += step) arr.push(String(i).padStart(2, '0'));
        return arr;
    }

    const hourOpts = generateTimeOptions(0, 23);
    const minOpts = generateTimeOptions(0, 59);

    return (
        <div className={"TimePicker"}>
            <ColumnSelect header={t('h')} selectedValue={time.hour || hourOpts[0]} options={hourOpts}
                          onSelect={hour => onChange({ hour, minute: time.minute, second: time.second })}/>
            <ColumnSelect header={t('min')} selectedValue={time.minute || minOpts[0]} options={minOpts}
                          onSelect={minute => onChange({ hour: time.hour, minute, second: time.second })}/>
            <ColumnSelect header={t('sec')} selectedValue={time.second || minOpts[0]} options={minOpts}
                          onSelect={second => onChange({ hour: time.hour, minute: time.minute, second })}/>
        </div>
    );
}

TimePicker.propTypes = {
    time: PropTypes.object,
    onChange: PropTypes.func
};

function DateTimePicker({ id, label, help, format, birthday, dateFormat = DateFormat.INTL, formatDate: formatDateProp, parseDate: parseDateProp, showTime, disabled }) {
    const { t } = useTranslation();
    const owner = useFormStateOwner();
    const htmlId = 'form_' + id;
    const [dateOpened, setDateOpened] = useState(false);

    const selectedDateStr = owner.getFormValue(id) || '';

    let selectedDate, fromMonth, toMonth, placeholder;
    if (birthday) {
        if (parseDateProp) {
            selectedDate = parseDateProp(selectedDateStr);
            if (selectedDate) {
                selectedDate = moment(selectedDate).set('year', birthdayYear).toDate();
            }
        } else {
            selectedDate = parseBirthday(dateFormat, selectedDateStr);
        }
        if (!selectedDate) selectedDate = moment().set('year', birthdayYear).toDate();
        fromMonth = new Date(birthdayYear, 0, 1);
        toMonth = new Date(birthdayYear, 11, 31);
        placeholder = getBirthdayFormatString(dateFormat);
    } else {
        if (parseDateProp) {
            selectedDate = parseDateProp(selectedDateStr);
        } else {
            selectedDate = parseDate(dateFormat, selectedDateStr);
        }
        if (!selectedDate) selectedDate = moment().toDate();
        placeholder = getDateFormatString(dateFormat);
    }

    function dateTimeChange(date, time) {
        time = { hour: 0, minute: 0, second: 0, ...time };
        if (formatDateProp) {
            owner.updateFormValue(id, formatDateProp(date, time));
        } else {
            owner.updateFormValue(id, birthday ? formatBirthday(dateFormat, date) : formatDate(dateFormat, date));
        }
        if (!showTime) setDateOpened(false);
    }

    const className = owner.addFormValidationClass('form-control', id);

    const time = {
        hour: selectedDate.getHours(),
        minute: selectedDate.getMinutes(),
        second: selectedDate.getSeconds()
    };

    let lang = enUS;
    switch (shortLanguage()) {
        case 'fr': lang = fr; break;
        case 'es': lang = es; break;
        case 'pt': lang = pt; break;
        case 'de': lang = de; break;
        case 'en': default: lang = enUS;
    }

    const currentYear = new Date().getFullYear();

    return wrapInput(id, htmlId, owner, format, '', label, help,
        <>
            <div className={disabled ? '' : "input-group"}>
                <input type="text" value={selectedDateStr} placeholder={placeholder} id={htmlId}
                       className={className} aria-describedby={htmlId + '_help'}
                       onChange={evt => owner.updateFormValue(id, evt.target.value)}
                       disabled={disabled}/>
                {!disabled &&
                <div className="input-group-append">
                    <Button iconTitle={t('openCalendar')} className="btn-secondary" icon="calendar-alt"
                            onClickAsync={() => setDateOpened(!dateOpened)}/>
                </div>
                }
            </div>
            {dateOpened &&
            <div className={"dayPickerWrapper"}>
                <DayPicker
                    captionLayout="dropdown"
                    fromYear={1900} toYear={currentYear}
                    locale={lang}
                    onDayClick={date => dateTimeChange(date, time)}
                    selectedDays={selectedDate}
                    defaultMonth={selectedDate}
                    fromMonth={fromMonth}
                    toMonth={toMonth}
                    className={"dayPicker"}
                />
                {showTime &&
                <TimePicker time={time} onChange={t => dateTimeChange(selectedDate, t)}/>
                }
            </div>
            }
        </>
    );
}

DateTimePicker.propTypes = {
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    help: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    format: PropTypes.string,
    birthday: PropTypes.bool,
    dateFormat: PropTypes.string,
    formatDate: PropTypes.func,
    parseDate: PropTypes.func,
    showTime: PropTypes.bool,
    disabled: PropTypes.bool
};

function Dropdown({ id, label, help, options, className, format, disabled }) {
    const owner = useFormStateOwner();
    const htmlId = 'form_' + id;
    const optionEls = [];

    if (options) {
        for (const optOrGrp of options) {
            if (optOrGrp.options) {
                optionEls.push(
                    <optgroup key={optOrGrp.key} label={optOrGrp.label}>
                        {optOrGrp.options.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
                    </optgroup>
                );
            } else {
                optionEls.push(<option key={optOrGrp.key} value={optOrGrp.key}>{optOrGrp.label}</option>);
            }
        }
    }

    const cls = owner.addFormValidationClass('form-control ' + (className || ''), id);

    return wrapInput(id, htmlId, owner, format, '', label, help,
        <select id={htmlId} className={cls} aria-describedby={htmlId + '_help'}
                value={owner.getFormValue(id)}
                onChange={evt => owner.updateFormValue(id, evt.target.value)}
                disabled={disabled}>
            {optionEls}
        </select>
    );
}

Dropdown.propTypes = {
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    help: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    options: PropTypes.array,
    className: PropTypes.string,
    format: PropTypes.string,
    disabled: PropTypes.bool
};

function AlignedRow({ className, label, htmlId, format, children }) {
    const owner = useFormStateOwner();
    return wrapInput(null, htmlId, owner, format, className || '', label, null, children);
}

AlignedRow.propTypes = {
    className: PropTypes.string,
    label: PropTypes.string,
    htmlId: PropTypes.string,
    format: PropTypes.string
};

function ButtonRow({ className, format, children }) {
    let cls = "buttonRow";
    if (className) cls += ' ' + className;
    return <AlignedRow className={cls} format={format}>{children}</AlignedRow>;
}

ButtonRow.propTypes = {
    className: PropTypes.string,
    format: PropTypes.string
};

function TreeTableSelect({ id, label, dataUrl, data, help, format }) {
    const owner = useFormStateOwner();
    const htmlId = 'form_' + id;
    const className = owner.addFormValidationClass('', id);

    return wrapInput(id, htmlId, owner, format, '', label, help,
        <TreeTable className={className} data={data} dataUrl={dataUrl}
                   selectMode={TreeSelectMode.SINGLE} selection={owner.getFormValue(id)}
                   onSelectionChangedAsync={sel => owner.updateFormValue(id, sel)}/>
    );
}

TreeTableSelect.propTypes = {
    id: PropTypes.string.isRequired,
    label: PropTypes.string,
    dataUrl: PropTypes.string,
    data: PropTypes.array,
    help: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    format: PropTypes.string
};

const TableSelect = forwardRef(function TableSelect({
    dataUrl, data, search, searchCols, columns, order, selectionKeyIndex,
    selectionLabelIndex = 0, selectionAsArray, selectMode = TableSelectMode.SINGLE,
    withHeader, dropdown, id, label, help, format, disabled, withClear, extraButtons,
    pageLength = 10
}, ref) {
    const { t } = useTranslation();
    const owner = useFormStateOwner();
    const htmlId = 'form_' + id;
    const tableRef = useRef(null);
    const [selectedLabel, setSelectedLabel] = useState('');
    const [open, setOpen] = useState(false);

    useImperativeHandle(ref, () => ({
        refresh() { if (tableRef.current) tableRef.current.refresh(); }
    }), []);

    const selection = owner.getFormValue(id);

    async function onSelectionChangedAsync(sel) {
        if (selectMode === TableSelectMode.SINGLE && dropdown) setOpen(false);
        owner.updateFormValue(id, sel);
    }

    async function onSelectionDataAsync(sel, selData) {
        if (dropdown) {
            let lbl;
            if (!selData) {
                lbl = '';
            } else if (selectMode === TableSelectMode.SINGLE && !selectionAsArray) {
                lbl = selData[selectionLabelIndex];
            } else {
                lbl = selData.map(entry => entry[selectionLabelIndex]).join('; ');
            }
            setSelectedLabel(lbl);
        }
    }

    async function clear() {
        if (selectMode === TableSelectMode.SINGLE && !selectionAsArray) {
            owner.updateFormValue(id, null);
        } else {
            owner.updateFormValue(id, []);
        }
    }

    if (dropdown) {
        const className = owner.addFormValidationClass('form-control', id);
        let groupAppend = null;
        if (!disabled) {
            groupAppend = (
                <div className="input-group-append">
                    <Button label={t('select')} className="btn-secondary" onClickAsync={() => setOpen(!open)}/>
                    {withClear && selection && <Button icon="times" title={t('clear')} className="btn-secondary" onClickAsync={clear}/>}
                    {extraButtons}
                </div>
            );
        } else if (extraButtons) {
            groupAppend = <div className="input-group-append">{extraButtons}</div>;
        }

        return wrapInput(id, htmlId, owner, format, '', label, help,
            <div>
                <div className={(groupAppend ? 'input-group ' : '') + "tableSelectDropdown"}>
                    <input type="text" className={className} value={selectedLabel}
                           onClick={() => setOpen(!open)}
                           readOnly={!disabled} disabled={disabled}/>
                    {groupAppend}
                </div>
                <div className={"tableSelectTable" + (open ? '' : ' ' + "tableSelectTableHidden")}>
                    <Table ref={tableRef} data={data} dataUrl={dataUrl} search={search}
                           searchCols={searchCols} columns={columns} order={order}
                           selectMode={selectMode} selectionAsArray={selectionAsArray}
                           withHeader={withHeader} selectionKeyIndex={selectionKeyIndex}
                           selection={selection}
                           onSelectionDataAsync={onSelectionDataAsync}
                           onSelectionChangedAsync={onSelectionChangedAsync}/>
                </div>
            </div>
        );
    } else {
        return wrapInput(id, htmlId, owner, format, '', label, help,
            <div>
                <Table ref={tableRef} data={data} dataUrl={dataUrl} search={search}
                       searchCols={searchCols} columns={columns} order={order}
                       pageLength={pageLength} selectMode={selectMode}
                       selectionAsArray={selectionAsArray} withHeader={withHeader}
                       selectionKeyIndex={selectionKeyIndex} selection={selection}
                       onSelectionChangedAsync={onSelectionChangedAsync}/>
            </div>
        );
    }
});

TableSelect.propTypes = {
    dataUrl: PropTypes.string,
    data: PropTypes.array,
    search: PropTypes.func,
    searchCols: PropTypes.arrayOf(PropTypes.string),
    columns: PropTypes.array,
    order: PropTypes.array,
    selectionKeyIndex: PropTypes.number,
    selectionLabelIndex: PropTypes.number,
    selectionAsArray: PropTypes.bool,
    selectMode: PropTypes.number,
    withHeader: PropTypes.bool,
    dropdown: PropTypes.bool,
    id: PropTypes.string.isRequired,
    label: PropTypes.string,
    help: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    format: PropTypes.string,
    disabled: PropTypes.bool,
    withClear: PropTypes.bool,
    extraButtons: PropTypes.array,
    pageLength: PropTypes.number
};

function ACEEditor({ id, label, help, height, mode, format }) {
    const owner = useFormStateOwner();
    const htmlId = 'form_' + id;

    return wrapInput(id, htmlId, owner, format, '', label, help,
        <ACEEditorRaw id={htmlId} mode={mode} theme="github"
                      onChange={data => owner.updateFormValue(id, data)}
                      fontSize={12} width="100%" height={height}
                      showPrintMargin={false} value={owner.getFormValue(id)}
                      tabSize={2} setOptions={{useWorker: false}}/>
    );
}

ACEEditor.propTypes = {
    id: PropTypes.string.isRequired,
    label: PropTypes.string,
    help: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    height: PropTypes.string,
    mode: PropTypes.string,
    format: PropTypes.string
};


const withForm = createComponentMixin({
    decoratorFn: (TargetClass, InnerClass) => {
        const proto = InnerClass.prototype;

        const cleanFormState = Immutable.Map({
            state: FormState.Loading,
            isValidationShown: false,
            isDisabled: false,
            statusMessageText: '',
            data: Immutable.Map(),
            savedData: Immutable.Map(),
            isServerValidationRunning: false
        });

        const getSaveData = (self, formStateData) => {
            let data = formStateData.map(attr => attr.get('value')).toJS();

            if (self.submitFormValuesMutator) {
                const newData = self.submitFormValuesMutator(data, false);
                if (newData !== undefined) {
                    data = newData;
                }
            }

            return data;
        };

        // formValidateResolve is called by "validateForm" once client receives validation response from server that does not
        // trigger another server validation
        let formValidateResolve = null;

        function scheduleValidateForm(self) {
            setTimeout(() => {
                self.setState(previousState => ({
                    formState: previousState.formState.withMutations(mutState => {
                        validateFormState(self, mutState);
                    })
                }));
            }, 0);
        }

        function validateFormState(self, mutState) {
            const settings = self.state.formSettings;

            if (!mutState.get('isServerValidationRunning') && settings.serverValidation) {
                const payload = {};
                let payloadNotEmpty = false;

                for (const attr of settings.serverValidation.extra || []) {
                    if (typeof attr === 'string') {
                        payload[attr] = mutState.getIn(['data', attr, 'value']);
                    } else {
                        const data = mutState.get('data').map(attr => attr.get('value')).toJS();
                        payload[attr.key] = attr.data(data);
                    }
                }

                for (const attr of settings.serverValidation.changed) {
                    const currValue = mutState.getIn(['data', attr, 'value']);
                    const serverValue = mutState.getIn(['data', attr, 'serverValue']);

                    if (currValue !== serverValue) {
                        mutState.setIn(['data', attr, 'serverValidated'], false);
                        payload[attr] = currValue;
                        payloadNotEmpty = true;
                    }
                }

                if (payloadNotEmpty) {
                    mutState.set('isServerValidationRunning', true);

                    axios.post(getUrl(settings.serverValidation.url), payload)
                        .then(response => {
                            if (self.isComponentMounted()) {
                                self.setState(previousState => ({
                                    formState: previousState.formState.withMutations(mutState => {
                                        mutState.set('isServerValidationRunning', false);

                                        mutState.update('data', stateData => stateData.withMutations(mutStateData => {
                                            for (const attr in payload) {
                                                mutStateData.setIn([attr, 'serverValue'], payload[attr]);

                                                if (payload[attr] === mutState.getIn(['data', attr, 'value'])) {
                                                    mutStateData.setIn([attr, 'serverValidated'], true);
                                                    mutStateData.setIn([attr, 'serverValidation'], response.data[attr] || true);
                                                }
                                            }
                                        }));
                                    })
                                }));

                                scheduleValidateForm(self);
                            }
                        })
                        .catch(error => {
                            if (self.isComponentMounted()) {
                                console.log('Error in "validateFormState": ' + error);

                                self.setState(previousState => ({
                                    formState: previousState.formState.set('isServerValidationRunning', false)
                                }));
                            }
                        });
                } else {
                    if (formValidateResolve) {
                        const resolve = formValidateResolve;
                        formValidateResolve = null;
                        resolve();
                    }
                }
            }

            if (self.localValidateFormValues) {
                mutState.update('data', stateData => stateData.withMutations(mutStateData => {
                    self.localValidateFormValues(mutStateData);
                }));
            }
        }

        const previousComponentDidMount = proto.componentDidMount;
        proto.componentDidMount = function () {
            this._isComponentMounted = true;
            if (previousComponentDidMount) {
                previousComponentDidMount.apply(this);
            }
        };

        const previousComponentWillUnmount = proto.componentWillUnmount;
        proto.componentWillUnmount = function () {
            this._isComponentMounted = false;
            if (previousComponentWillUnmount) {
                previousComponentWillUnmount.apply(this);
            }
        };

        proto.isComponentMounted = function () {
            return !!this._isComponentMounted;
        };

        proto.initForm = function (settings) {
            const state = this.state || {};
            state.formState = cleanFormState;
            state.formSettings = {
                leaveConfirmation: true,
                ...(settings || {})
            };
            this.state = state;
        };

        proto.resetFormState = function () {
            this.setState({
                formState: cleanFormState
            });
        };

        proto.getFormValuesFromEntity = function (entity) {
            const data = Object.assign({}, entity);

            data.originalHash = data.hash;
            delete data.hash;

            if (this.getFormValuesMutator) {
                this.getFormValuesMutator(data, this.getFormValues());
            }

            this.populateFormValues(data);
        };

        proto.getFormValuesFromURL = async function (url) {
            setTimeout(() => {
                this.setState(previousState => {
                    if (previousState.formState.get('state') === FormState.Loading) {
                        return {
                            formState: previousState.formState.set('state', FormState.LoadingWithNotice)
                        };
                    }
                });
            }, 500);

            const response = await axios.get(getUrl(url));

            let data = response.data;

            data.originalHash = data.hash;
            delete data.hash;

            if (this.getFormValuesMutator) {
                const newData = this.getFormValuesMutator(data, this.getFormValues());

                if (newData !== undefined) {
                    data = newData;
                }
            }

            this.populateFormValues(data);
        };

        proto.validateAndSendFormValuesToURL = async function (method, url) {
            const settings = this.state.formSettings;
            await this.waitForFormServerValidated();

            if (this.isFormWithoutErrors()) {
                if (settings.getPreSubmitUpdater) {
                    const preSubmitUpdater = await settings.getPreSubmitUpdater();

                    await new Promise((resolve, reject) => {
                        this.setState(previousState => ({
                            formState: previousState.formState.withMutations(mutState => {
                                mutState.update('data', stateData => stateData.withMutations(preSubmitUpdater));
                            })
                        }), resolve);
                    });
                }

                let data = this.getFormValues();

                if (this.submitFormValuesMutator) {
                    const newData = this.submitFormValuesMutator(data, true);
                    if (newData !== undefined) {
                        data = newData;
                    }
                }

                const response = await axios.method(method, getUrl(url), data);

                if (settings.leaveConfirmation) {
                    await new Promise((resolve, reject) => {
                        this.setState(previousState => ({
                            formState: previousState.formState.set('savedData', getSaveData(this, previousState.formState.get('data')))
                        }), resolve);
                    });
                }

                return response.data || true;

            } else {
                this.showFormValidation();
                return false;
            }
        };


        proto.populateFormValues = function (data) {
            const settings = this.state.formSettings;

            this.setState(previousState => ({
                formState: previousState.formState.withMutations(mutState => {
                    mutState.set('state', FormState.Ready);

                    mutState.update('data', stateData => stateData.withMutations(mutStateData => {
                        for (const key in data) {
                            mutStateData.set(key, Immutable.Map({
                                value: data[key]
                            }));
                        }
                    }));

                    if (settings.leaveConfirmation) {
                        mutState.set('savedData', getSaveData(this, mutState.get('data')));
                    }

                    validateFormState(this, mutState);
                })
            }));
        };

        proto.waitForFormServerValidated = async function () {
            if (!this.isFormServerValidated()) {
                await new Promise(resolve => {
                    formValidateResolve = resolve;
                });
            }
        };

        proto.scheduleFormRevalidate = function () {
            scheduleValidateForm(this);
        };

        proto.updateForm = function (mutator) {
            this.setState(previousState => {
                const onChangeBeforeValidationCallback = this.state.formSettings.onChangeBeforeValidation || {};

                const formState = previousState.formState.withMutations(mutState => {
                    mutState.update('data', stateData => stateData.withMutations(mutStateData => {
                        mutator(mutStateData);

                        if (typeof onChangeBeforeValidationCallback === 'object') {
                            for (const key in onChangeBeforeValidationCallback) {
                                const oldValue = previousState.formState.getIn(['data', key, 'value']);
                                const newValue = mutStateData.getIn([key, 'value']);
                                onChangeBeforeValidationCallback[key](mutStateData, key, oldValue, newValue);
                            }
                        } else {
                            onChangeBeforeValidationCallback(mutStateData);
                        }
                    }));

                    validateFormState(this, mutState);
                });

                let newState = {
                    formState
                };

                const onChangeCallback = this.state.formSettings.onChange || {};

                if (typeof onChangeCallback === 'object') {
                    for (const key in onChangeCallback) {
                        const oldValue = previousState.formState.getIn(['data', key, 'value']);
                        const newValue = formState.getIn(['data', key, 'value']);
                        onChangeCallback[key](newState, key, oldValue, newValue);
                    }
                } else {
                    onChangeCallback(newState);
                }

                return newState;
            });
        };

        proto.updateFormValue = function (key, value) {
            this.setState(previousState => {
                const oldValue = previousState.formState.getIn(['data', key, 'value']);

                const onChangeBeforeValidationCallback = this.state.formSettings.onChangeBeforeValidation || {};

                const formState = previousState.formState.withMutations(mutState => {
                    mutState.update('data', stateData => stateData.withMutations(mutStateData => {
                        mutStateData.setIn([key, 'value'], value);

                        if (typeof onChangeBeforeValidationCallback === 'object') {
                            if (onChangeBeforeValidationCallback[key]) {
                                onChangeBeforeValidationCallback[key](mutStateData, key, oldValue, value);
                            }
                        } else {
                            onChangeBeforeValidationCallback(mutStateData, key, oldValue, value);
                        }
                    }));

                    validateFormState(this, mutState);
                });

                let newState = {
                    formState
                };

                const onChangeCallback = this.state.formSettings.onChange || {};

                if (typeof onChangeCallback === 'object') {
                    if (onChangeCallback[key]) {
                        onChangeCallback[key](newState, key, oldValue, value);
                    }
                } else {
                    onChangeCallback(newState, key, oldValue, value);
                }

                return newState;
            });
        };

        proto.getFormValue = function (name) {
            return this.state.formState.getIn(['data', name, 'value']);
        };

        proto.getFormValues = function (name) {
            if (!this.state || !this.state.formState) return undefined;
            return this.state.formState.get('data').map(attr => attr.get('value')).toJS();
        };

        proto.getFormError = function (name) {
            return this.state.formState.getIn(['data', name, 'error']);
        };

        proto.isFormWithLoadingNotice = function () {
            return this.state.formState.get('state') === FormState.LoadingWithNotice;
        };

        proto.isFormLoading = function () {
            return this.state.formState.get('state') === FormState.Loading || this.state.formState.get('state') === FormState.LoadingWithNotice;
        };

        proto.isFormReady = function () {
            return this.state.formState.get('state') === FormState.Ready;
        };

        const _isFormChanged = self => {
            const currentData = getSaveData(self, self.state.formState.get('data'));
            const savedData = self.state.formState.get('savedData');

            function isDifferent(data1, data2, prefix) {
                if (typeof data1 === 'object' && typeof data2 === 'object' && data1 && data2) {
                    const keys = new Set([...Object.keys(data1), ...Object.keys(data2)]);
                    for (const key of keys) {
                        if (isDifferent(data1[key], data2[key], `${prefix}/${key}`)) {
                            return true;
                        }
                    }
                } else if (data1 !== data2) {
                    return true;
                }
                return false;
            }

            return isDifferent(currentData, savedData, '');
        };

        proto.isFormChanged = function () {
            const settings = this.state.formSettings;

            if (!settings.leaveConfirmation) return false;

            if (settings.getPreSubmitUpdater) {
                return true;
            }

            return _isFormChanged(this);
        };

        proto.isFormChangedAsync = async function () {
            const settings = this.state.formSettings;

            if (!settings.leaveConfirmation) return false;

            if (settings.getPreSubmitUpdater) {
                const preSubmitUpdater = await settings.getPreSubmitUpdater();

                await new Promise((resolve, reject) => {
                    this.setState(previousState => ({
                        formState: previousState.formState.withMutations(mutState => {
                            mutState.update('data', stateData => stateData.withMutations(preSubmitUpdater));
                        })
                    }), resolve);
                });
            }

            return _isFormChanged(this);
        };

        proto.isFormValidationShown = function () {
            return this.state.formState.get('isValidationShown');
        };

        proto.addFormValidationClass = function (className, name) {
            if (this.isFormValidationShown()) {
                const error = this.getFormError(name);
                if (error) {
                    return className + ' is-invalid';
                } else {
                    return className + ' is-valid';
                }
            } else {
                return className;
            }
        };

        proto.getFormValidationMessage = function (name) {
            if (this.isFormValidationShown()) {
                return this.getFormError(name);
            } else {
                return '';
            }
        };

        proto.showFormValidation = function () {
            this.setState(previousState => ({formState: previousState.formState.set('isValidationShown', true)}));
        };

        proto.hideFormValidation = function () {
            this.setState(previousState => ({formState: previousState.formState.set('isValidationShown', false)}));
        };

        proto.isFormWithoutErrors = function () {
            return !this.state.formState.get('data').find(attr => attr.get('error'));
        };

        proto.isFormServerValidated = function () {
            return !this.state.formSettings.serverValidation || this.state.formSettings.serverValidation.changed.every(attr => this.state.formState.getIn(['data', attr, 'serverValidated']));
        };

        proto.getFormStatusMessageText = function () {
            return this.state.formState.get('statusMessageText');
        };

        proto.getFormStatusMessageSeverity = function () {
            return this.state.formState.get('statusMessageSeverity');
        };

        proto.setFormStatusMessage = function (severity, text) {
            this.setState(previousState => ({
                formState: previousState.formState.withMutations(map => {
                    map.set('statusMessageText', text);
                    map.set('statusMessageSeverity', severity);
                })
            }));
        };

        proto.clearFormStatusMessage = function () {
            this.setState(previousState => ({
                formState: previousState.formState.withMutations(map => {
                    map.set('statusMessageText', '');
                })
            }));
        };

        proto.enableForm = function () {
            this.setState(previousState => ({formState: previousState.formState.set('isDisabled', false)}));
        };

        proto.disableForm = function () {
            this.setState(previousState => ({formState: previousState.formState.set('isDisabled', true)}));
        };

        proto.isFormDisabled = function () {
            return this.state.formState.get('isDisabled');
        };

        proto.formHandleErrors = async function (fn) {
            const t = this.props.t;
            try {
                await fn();
            } catch (error) {
                if (error instanceof interoperableErrors.ChangedError) {
                    this.disableForm();
                    this.setFormStatusMessage('danger',
                        <span>
                            <strong>{t('yourUpdatesCannotBeSaved')}</strong>{' '}
                            {t('someoneElseHasIntroducedModificationIn')}
                        </span>
                    );
                    return;
                }

                if (error instanceof interoperableErrors.NamespaceNotFoundError) {
                    this.disableForm();
                    this.setFormStatusMessage('danger',
                        <span>
                            <strong>{t('yourUpdatesCannotBeSaved')}</strong>{' '}
                            {t('itSeemsThatSomeoneElseHasDeletedThe')}
                        </span>
                    );
                    return;
                }

                if (error instanceof interoperableErrors.NotFoundError) {
                    this.disableForm();
                    this.setFormStatusMessage('danger',
                        <span>
                            <strong>{t('yourUpdatesCannotBeSaved')}</strong>{' '}
                            {t('itSeemsThatSomeoneElseHasDeletedThe-1')}
                        </span>
                    );
                    return;
                }

                throw error;
            }
        };

        return {};
    }
});

function filterData(obj, allowedKeys) {
    const result = {};
    for (const key in obj) {
        if (allowedKeys.includes(key)) {
            result[key] = obj[key];
        }
    }
    return result;
}

export {
    withForm,
    Form,
    Fieldset,
    StaticField,
    InputField,
    CheckBox,
    CheckBoxGroup,
    RadioGroup,
    TextArea,
    ColorPicker,
    DateTimePicker,
    Dropdown,
    AlignedRow,
    ButtonRow,
    Button,
    TreeTableSelect,
    TableSelect,
    TableSelectMode,
    ACEEditor,
    FormSendMethod,
    filterData
}
