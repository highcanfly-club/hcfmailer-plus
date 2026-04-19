'use strict';

import { useReducer, useRef, useCallback, useEffect } from 'react';
import * as Immutable from 'immutable';
import axios from '../axios';
import { getUrl } from '../urls';
import interoperableErrors from '../../../../shared/interoperable-errors';

const FormState = { Loading: 0, LoadingWithNotice: 1, Ready: 2 };
const FormSendMethod = { GET: 'GET', POST: 'POST', PUT: 'PUT', DELETE: 'DELETE', PATCH: 'PATCH' };

const cleanFormState = Immutable.Map({
  state: FormState.Loading,
  isValidationShown: false,
  isDisabled: false,
  statusMessageText: '',
  statusMessageSeverity: '',
  data: Immutable.Map(),
  savedData: Immutable.Map(),
  isServerValidationRunning: false
});

function formReducer(state, action) {
  switch (action.type) {
    case 'SET':
      return action.updater(state);
    case 'MUTATE':
      return state.withMutations(action.mutator);
    default:
      return state;
  }
}

export function useForm(settings = {}) {
  const [formState, dispatch] = useReducer(formReducer, cleanFormState);
  const formStateRef = useRef(formState);
  formStateRef.current = formState;

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const mountedRef = useRef(true);
  const formValidateResolveRef = useRef(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const getSaveData = useCallback((formStateData) => {
    let data = formStateData.map(attr => attr.get('value')).toJS();
    const originalHash = data.originalHash;
    if (settingsRef.current.submitFormValuesMutator) {
      const newData = settingsRef.current.submitFormValuesMutator(data, false);
      if (newData !== undefined) {
        data = newData;
      }
    }
    if (originalHash !== undefined && data.originalHash === undefined) {
      data.originalHash = originalHash;
    }
    return data;
  }, []);

  const scheduleValidateForm = useCallback(() => {
    setTimeout(() => {
      dispatch({
        type: 'MUTATE',
        mutator: (mutState) => {
          validateFormState(mutState);
        }
      });
    }, 0);
  }, []);

  const validateFormState = useCallback((mutState) => {
    const settings = settingsRef.current;

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
            if (mountedRef.current) {
              dispatch({
                type: 'MUTATE',
                mutator: (mutState) => {
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
                }
              });
              scheduleValidateForm();
            }
          })
          .catch(error => {
            if (mountedRef.current) {
              console.log('Error in validateFormState: ' + error);
              dispatch({
                type: 'SET',
                updater: (state) => state.set('isServerValidationRunning', false)
              });
            }
          });
      } else {
        if (formValidateResolveRef.current) {
          const resolve = formValidateResolveRef.current;
          formValidateResolveRef.current = null;
          resolve();
        }
      }
    }

    if (settingsRef.current.localValidateFormValues) {
      mutState.update('data', stateData => stateData.withMutations(mutStateData => {
        settingsRef.current.localValidateFormValues(mutStateData);
      }));
    }
  }, [scheduleValidateForm]);

  // Public API methods

  const initForm = useCallback((newSettings) => {
    settingsRef.current = { leaveConfirmation: true, ...newSettings };
    dispatch({ type: 'SET', updater: () => cleanFormState });
  }, []);

  const populateFormValues = useCallback((data) => {
    dispatch({
      type: 'MUTATE',
      mutator: (mutState) => {
        mutState.set('state', FormState.Ready);
        mutState.update('data', stateData =>
          stateData.withMutations(mutStateData => {
            for (const key in data) {
              mutStateData.set(key, Immutable.Map({ value: data[key] }));
            }
          })
        );
        mutState.update('data', stateData =>
          stateData.withMutations(mutStateData => {
            mutStateData.forEach((attr, key) => {
              if (!mutStateData.get(key).get('serverValue')) {
                mutStateData.setIn([key, 'serverValue'], attr.get('value'));
              }
            });
          })
        );
        validateFormState(mutState);
      }
    });
  }, [validateFormState]);

  const getFormValue = useCallback((name) => {
    const val = formStateRef.current.getIn(['data', name, 'value']);
    return val !== undefined ? val : '';
  }, []);

  const getFormValues = useCallback(() => {
    return formStateRef.current.get('data').map(attr => attr.get('value')).toJS();
  }, []);

  const updateFormValue = useCallback((key, value) => {
    dispatch({
      type: 'MUTATE',
      mutator: (mutState) => {
        const settings = settingsRef.current;
        const ocbv = settings.onChangeBeforeValidation;
        const handler = ocbv && (typeof ocbv === 'function' ? ocbv : ocbv[key]);
        if (handler) {
          const oldValue = mutState.getIn(['data', key, 'value']);
          mutState.setIn(['data', key, 'value'], value);
          mutState.update('data', stateData =>
            stateData.withMutations(mutStateData => {
              handler(mutStateData, key, oldValue, value);
            })
          );
        } else {
          mutState.setIn(['data', key, 'value'], value);
        }
        scheduleValidateForm();
      }
    });
  }, [scheduleValidateForm]);

  const updateForm = useCallback((data) => {
    dispatch({
      type: 'MUTATE',
      mutator: (mutState) => {
        mutState.update('data', stateData =>
          stateData.withMutations(mutStateData => {
            for (const key in data) {
              mutStateData.setIn([key, 'value'], data[key]);
            }
          })
        );
        scheduleValidateForm();
      }
    });
  }, [scheduleValidateForm]);

  const showFormValidation = useCallback(() => {
    dispatch({
      type: 'SET',
      updater: (state) => state.set('isValidationShown', true)
    });
  }, []);

  const hideFormValidation = useCallback(() => {
    dispatch({
      type: 'SET',
      updater: (state) => state.set('isValidationShown', false)
    });
  }, []);

  const isFormReady = useCallback(() => formStateRef.current.get('state') === FormState.Ready, []);
  const isFormLoading = useCallback(() => formStateRef.current.get('state') === FormState.Loading, []);
  const isFormWithLoadingNotice = useCallback(() => formStateRef.current.get('state') === FormState.LoadingWithNotice, []);
  const isFormDisabled = useCallback(() => formStateRef.current.get('isDisabled'), []);
  const isFormValidationShown = useCallback(() => formStateRef.current.get('isValidationShown'), []);

  const isFormChanged = useCallback(() => {
    const data = formStateRef.current.get('data');
    const saved = formStateRef.current.get('savedData');
    return !Immutable.is(data, saved);
  }, []);

  const isFormChangedAsync = useCallback(async () => {
    return isFormChanged();
  }, [isFormChanged]);

  const isFormWithoutErrors = useCallback(() => {
    const data = formStateRef.current.get('data');
    return !data.some(attr => attr.get('error'));
  }, []);

  const isFormServerValidated = useCallback(() => {
    const data = formStateRef.current.get('data');
    return !data.some(attr => attr.get('serverValidated') === false);
  }, []);

  const addFormValidationClass = useCallback((className, id) => {
    if (!isFormValidationShown()) return className;
    const attr = formStateRef.current.getIn(['data', id]);
    if (!attr) return className;
    if (attr.get('error') || attr.get('serverValidation') === false) {
      return className + ' is-invalid';
    }
    return className + ' is-valid';
  }, [isFormValidationShown]);

  const getFormValidationMessage = useCallback((id) => {
    if (!isFormValidationShown()) return null;
    const attr = formStateRef.current.getIn(['data', id]);
    if (!attr) return null;
    return attr.get('error') || (attr.get('serverValidation') === false ? 'Invalid' : null);
  }, [isFormValidationShown]);

  const getFormError = useCallback((id) => {
    const attr = formStateRef.current.getIn(['data', id]);
    return attr ? attr.get('error') : null;
  }, []);

  const getFormStatusMessageText = useCallback(() => formStateRef.current.get('statusMessageText'), []);
  const getFormStatusMessageSeverity = useCallback(() => formStateRef.current.get('statusMessageSeverity') || 'info', []);

  const setFormStatusMessage = useCallback((severity, text) => {
    dispatch({
      type: 'SET',
      updater: (state) => state
        .set('statusMessageText', text)
        .set('statusMessageSeverity', severity)
    });
  }, []);

  const clearFormStatusMessage = useCallback(() => {
    dispatch({
      type: 'SET',
      updater: (state) => state
        .set('statusMessageText', '')
        .set('statusMessageSeverity', '')
    });
  }, []);

  const enableForm = useCallback(() => {
    dispatch({
      type: 'SET',
      updater: (state) => state.set('isDisabled', false)
    });
  }, []);

  const disableForm = useCallback(() => {
    dispatch({
      type: 'SET',
      updater: (state) => state.set('isDisabled', true)
    });
  }, []);

  const formHandleErrors = useCallback(async (fn) => {
    try {
      showFormValidation();
      await fn();
    } catch (error) {
      if (error instanceof interoperableErrors.InteroperableError && error.data && typeof error.data === 'object') {
        const mutState = formStateRef.current.withMutations(mutState => {
          mutState.update('data', stateData =>
            stateData.withMutations(mutStateData => {
              for (const field in error.data) {
                mutStateData.setIn([field, 'error'], error.data[field]);
              }
            })
          );
        });
        formStateRef.current = mutState;
        dispatch({ type: 'SET', updater: () => mutState });
      }
      throw error;
    }
  }, [showFormValidation]);

  const getFormValuesFromURL = useCallback(async (url) => {
    disableForm();
    try {
      const response = await axios.get(getUrl(url));
      if (mountedRef.current) {
        let data = response.data;
        if (data.hash !== undefined) {
          data.originalHash = data.hash;
          delete data.hash;
        }
        if (settingsRef.current.getFormValuesMutator) {
          const mutated = settingsRef.current.getFormValuesMutator(data);
          if (mutated !== undefined) data = mutated;
        }
        populateFormValues(data);
        dispatch({
          type: 'SET',
          updater: (state) => state.set('savedData', state.get('data'))
        });
      }
    } catch (error) {
      if (mountedRef.current) {
        enableForm();
      }
      throw error;
    }
  }, [disableForm, enableForm, populateFormValues]);

  const getFormValuesFromEntity = useCallback((entity) => {
    let data = Object.assign({}, entity);
    if (data.hash !== undefined) {
      data.originalHash = data.hash;
      delete data.hash;
    }
    if (settingsRef.current.getFormValuesMutator) {
      const mutated = settingsRef.current.getFormValuesMutator(data);
      if (mutated !== undefined) data = mutated;
    }
    populateFormValues(data);
    dispatch({
      type: 'SET',
      updater: (state) => state.set('savedData', state.get('data'))
    });
  }, [populateFormValues]);

  const validateAndSendFormValuesToURL = useCallback(async (method, url, data) => {
    if (!isFormWithoutErrors()) {
      showFormValidation();
      return false;
    }

    disableForm();
    setFormStatusMessage('info', 'Saving...');

    try {
      const formData = getSaveData(formStateRef.current.get('data'));
      const payload = data ? { ...formData, ...data } : formData;

      let response;
      if (method === FormSendMethod.GET || method === axios.get) {
        response = await axios.get(getUrl(url), { params: payload });
      } else if (method === FormSendMethod.POST || method === axios.post) {
        response = await axios.post(getUrl(url), payload);
      } else if (method === FormSendMethod.PUT || method === axios.put) {
        response = await axios.put(getUrl(url), payload);
      } else if (method === FormSendMethod.DELETE || method === axios.delete) {
        response = await axios.delete(getUrl(url), { data: payload });
      } else if (method === FormSendMethod.PATCH) {
        response = await axios.patch(getUrl(url), payload);
      }

      if (mountedRef.current) {
        enableForm();
        const savedState = formStateRef.current.set('savedData', formStateRef.current.get('data'));
        formStateRef.current = savedState;
        dispatch({ type: 'SET', updater: () => savedState });
        clearFormStatusMessage();
        return response.data || true;
      }
    } catch (error) {
      if (mountedRef.current) {
        enableForm();
        if (error instanceof interoperableErrors.InteroperableError && error.data && typeof error.data === 'object') {
          dispatch({
            type: 'MUTATE',
            mutator: (mutState) => {
              mutState.update('data', stateData =>
                stateData.withMutations(mutStateData => {
                  for (const field in error.data) {
                    mutStateData.setIn([field, 'error'], error.data[field]);
                  }
                })
              );
            }
          });
          showFormValidation();
          setFormStatusMessage('danger', 'Form validation failed');
        } else {
          setFormStatusMessage('danger', error.message || 'Error saving form');
        }
      }
      throw error;
    }
    return false;
  }, [isFormWithoutErrors, showFormValidation, disableForm, enableForm, getSaveData, clearFormStatusMessage, setFormStatusMessage]);

  const waitForFormServerValidated = useCallback(() => {
    return new Promise((resolve) => {
      if (isFormServerValidated()) {
        resolve();
      } else {
        formValidateResolveRef.current = resolve;
        scheduleValidateForm();
      }
    });
  }, [isFormServerValidated, scheduleValidateForm]);

  const scheduleFormRevalidate = useCallback(() => {
    scheduleValidateForm();
  }, [scheduleValidateForm]);

  const resetFormState = useCallback(() => {
    initForm(settingsRef.current);
  }, [initForm]);

  const isLeaveConfirmationEnabled = useCallback(
    () => settingsRef.current.leaveConfirmation !== false,
    []
  );

  // Return the stateOwner object with all methods
  return useRef({
    initForm, populateFormValues, getFormValue, getFormValues, updateFormValue, updateForm,
    showFormValidation, hideFormValidation, isFormReady, isFormLoading, isFormWithLoadingNotice,
    isFormDisabled, isFormValidationShown, isFormChanged, isFormChangedAsync, isFormWithoutErrors,
    isFormServerValidated, addFormValidationClass, getFormValidationMessage, getFormError,
    getFormStatusMessageText, getFormStatusMessageSeverity, setFormStatusMessage, clearFormStatusMessage,
    enableForm, disableForm, formHandleErrors, getFormValuesFromURL, getFormValuesFromEntity,
    validateAndSendFormValuesToURL, waitForFormServerValidated, scheduleFormRevalidate, resetFormState,
    isLeaveConfirmationEnabled
  }).current;
}

export const FormSendMethodHTTP = FormSendMethod;
