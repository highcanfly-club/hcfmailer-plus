'use strict';

import React from "react";
import {createComponentMixin} from "./decorator-helpers";

function handleError(that, error) {
    let errorHandled;
    if (that.errorHandler) {
        errorHandled = that.errorHandler(error);
    }

    if (!errorHandled && that.props?.parentErrorHandler) {
        errorHandled = handleError(that.props.parentErrorHandler, error);
    }

    if (!errorHandled) {
        throw error;
    }

    return errorHandled;
}

export const ParentErrorHandlerContext = React.createContext(null);
export const withErrorHandling = createComponentMixin({
    contexts: [{context: ParentErrorHandlerContext, propName: 'parentErrorHandler'}],
    decoratorFn: (TargetClass, InnerClass) => {
        /* Example of use:
           this.getFormValuesFromURL(....).catch(error => this.handleError(error));

           It's equivalent to the legacy decorator form:

           @withAsyncErrorHandler
           async loadFormValues() {
             await this.getFormValuesFromURL(...);
           }

           In current code, we prefer the explicit wrapper pattern:

           constructor(props) {
               super(props);
               this.loadFormValues = wrapWithAsyncErrorHandler(this, this.loadFormValues);
           }
        */

        const originalRender = InnerClass.prototype.render;

        InnerClass.prototype.render = function () {
            return (
                <ParentErrorHandlerContext.Provider value={this}>
                    {originalRender.apply(this)}
                </ParentErrorHandlerContext.Provider>
            );
        }

        InnerClass.prototype.handleError = function (error) {
            handleError(this, error);
        };

        return {};
    }
});

export function withAsyncErrorHandler(target, name, descriptor) {
    let fn = descriptor.value;

    descriptor.value = async function () {
        try {
            await fn.apply(this, arguments)
        } catch (error) {
            handleError(this, error);
        }
    };

    return descriptor;
}

// Preferred non-decorator usage for classes that avoid legacy decorators.
// Use in constructors as:
//   this.someMethod = wrapWithAsyncErrorHandler(this, this.someMethod);
export function wrapWithAsyncErrorHandler(self, fn) {
    return async function () {
        try {
            await fn.apply(this, arguments)
        } catch (error) {
            handleError(self, error);
        }
    };
}
