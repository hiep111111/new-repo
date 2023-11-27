import { isArray } from "lodash";

// common errors
const UNHANDLED_ERROR = "UNHANDLED_ERROR";
const INVALID_RETURN_VALUE = "INVALID_RETURN_VALUE";
const INVALID_ARG_TYPE = "INVALID_ARG_TYPE";
const INVALID_ARG_VALUE = "INVALID_ARG_VALUE";
const INVALID_CALLBACK = "INVALID_CALLBACK";
const INVALID_RETURN_PROPERTY = "INVALID_RETURN_PROPERTY";
const INVALID_RETURN_PROPERTY_VALUE = "INVALID_RETURN_PROPERTY_VALUE";
const MISSING_ARGS = "MISSING_ARGS";
const MISSING_OPTION = "MISSING_OPTION";
const OUT_OF_RANGE = "OUT_OF_RANGE";
const INDEX_OUT_OF_RANGE = "INDEX_OUT_OF_RANGE";
const VALUE_OUT_OF_RANGE = "VALUE_OUT_OF_RANGE";
const NO_LONGER_SUPPORTED = "NO_LONGER_SUPPORTED";
const STRING_TOO_LARGE = "STRING_TOO_LARGE";
const INVALID_STATE = "INVALID_STATE";
const INVALID_WORK_FLOW_ACTION_CODE = "INVALID_WORK_FLOW_ACTION_CODE";
const INVALID_WORK_FLOW = "INVALID_WORK_FLOW";
const INVALID_CONTEXT = "INVALID_CONTEXT";
const SYSTEM_ERROR = "SYSTEM_ERROR";
const NO_ICU = "NO_ICU";

export const BOS_ERROR = {
  UNHANDLED_ERROR,
  INVALID_RETURN_VALUE,
  INVALID_ARG_TYPE,
  INVALID_ARG_VALUE,
  INVALID_CALLBACK,
  INVALID_RETURN_PROPERTY,
  INVALID_RETURN_PROPERTY_VALUE,
  MISSING_ARGS,
  MISSING_OPTION,
  OUT_OF_RANGE,
  INDEX_OUT_OF_RANGE,
  VALUE_OUT_OF_RANGE,
  NO_LONGER_SUPPORTED,
  STRING_TOO_LARGE,
  INVALID_STATE,
  INVALID_WORK_FLOW_ACTION_CODE,
  INVALID_WORK_FLOW,
  INVALID_CONTEXT,
  SYSTEM_ERROR,
  NO_ICU,
};

class BosError extends Error {
  constructor(message, code = null, stack = null, name = null) {
    super();

    if (stack) {
      this.stack = stack;
    } else if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error().stack;
    }

    this.message = message;
    this.code = code || BOS_ERROR.UNHANDLED_ERROR;
    this.name = name || this.constructor.name;
  }

  static fromObject(error) {
    if (error instanceof BosError) {
      return error;
    } else {
      const { message, code, status, stack } = error;

      return new BosError(message, code, status, stack, error.constructor.name);
    }
  }

  expose() {
    return {
      name: this.name,
      code: this.code,
      status: this.status,
    };
  }
}

export function fieldErrorSelector(fieldName, errorList) {
  if (!errorList) {
    return false;
  }

  if (isArray(errorList)) {
    const field = errorList.find((f) => f.name === fieldName);

    if (field) {
      return true;
    }
  }

  return false;
}

export function apiErrorMessages(apiError) {
  if (!apiError) {
    return "";
  }

  const { status, data } = apiError;

  if (!status) {
    return apiError.toString();
  }

  switch (status) {
    case 401: {
      return [];
    }

    case 422: {
      let errorObject;

      if (data && data.error) {
        errorObject = data.error;

        if (errorObject.errors) {
          errorObject = errorObject.errors;
        } else {
          return errorObject;
        }
      }

      if (errorObject) {
        const messages = [];

        Object.entries(errorObject).forEach(([name, value]) => {
          let message = "";

          switch (value.kind) {
            case "required":
              message = "system:msg.validate.required";
              break;

            default:
              message = "system:msg.validate.failure";
              break;
          }

          messages.push({
            name,
            message,
          });
        });

        return messages;
      }

      return `system:msg.httpResponseCode.${status.toString()}`;
    }

    case 500:
    case 403: {
      const errorObject = data && data.error ? data.error : undefined;

      if (errorObject && errorObject.message) {
        return errorObject.message;
      }

      return `system:msg.httpResponseCode.${status.toString()}`;
    }

    default:
      return `system:msg.httpResponseCode.${status.toString()}`;
  }
}

export default BosError;
