import { HTTP_RESPONSE_CODE } from "../constants/httpConstant";

export const BOS_ERROR = {
  // common errors
  UNHANDLED_ERROR: "UNHANDLED_ERROR",
  INVALID_RETURN_VALUE: "INVALID_RETURN_VALUE",
  INVALID_ARG_TYPE: "INVALID_ARG_TYPE",
  INVALID_ARG_VALUE: "INVALID_ARG_VALUE",
  INVALID_CALLBACK: "INVALID_CALLBACK",
  INVALID_RETURN_PROPERTY: "INVALID_RETURN_PROPERTY",
  INVALID_RETURN_PROPERTY_VALUE: "INVALID_RETURN_PROPERTY_VALUE",
  MISSING_ARGS: "MISSING_ARGS",
  MISSING_OPTION: "MISSING_OPTION",
  OUT_OF_RANGE: "OUT_OF_RANGE",
  INDEX_OUT_OF_RANGE: "INDEX_OUT_OF_RANGE",
  VALUE_OUT_OF_RANGE: "VALUE_OUT_OF_RANGE",
  NO_LONGER_SUPPORTED: "NO_LONGER_SUPPORTED",
  STRING_TOO_LARGE: "STRING_TOO_LARGE",
  INVALID_STATE: "INVALID_STATE",
  INVALID_WORK_FLOW_ACTION_CODE: "INVALID_WORK_FLOW_ACTION_CODE",
  INVALID_WORK_FLOW: "INVALID_WORK_FLOW",
  INVALID_CONTEXT: "INVALID_CONTEXT",
  SYSTEM_ERROR: "SYSTEM_ERROR",
  NO_ICU: "NO_ICU",

  // api errors
  INVALID_URL: "INVALID_URL",
  INVALID_PROTOCOL: "INVALID_PROTOCOL",
  NOT_FOUND: "NOT_FOUND",
  FORBIDDEN: "FORBIDDEN",

  // service bus errors
  SB_CAN_NOT_INIT: "SB_CAN_NOT_INIT",
  SB_CAN_NOT_PUBLISH: "SB_CAN_NOT_PUBLISH",
  SB_CAN_NOT_CONSUME: "SB_CAN_NOT_CONSUME",

  // database
  MONGO_CAN_NOT_CREATE: "MONGO_CAN_NOT_CREATE",
  MONGO_CAN_NOT_READ: "MONGO_CAN_NOT_READ",
  MONGO_CAN_NOT_UPDATE: "MONGO_CAN_NOT_UPDATE",
  MONGO_CAN_NOT_DELETE: "MONGO_CAN_NOT_DELETE",
};

class BosError extends Error {
  constructor(message, code = null, status = 500, stack = null, name = null) {
    super();

    this.stack = stack || new Error().stack;
    this.message = message;
    this.code = code || BOS_ERROR.UNHANDLED_ERROR;
    this.status = status;
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

export const errorHandler = (err, req, res, next) => {
  if (err) {
    const error = process.env !== "production" ? { message: err.message, stack: err.stack } : { message: err.message, stack: "Only shown in debug mode." };

    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(error.status || HTTP_RESPONSE_CODE.INTERNAL_SERVER_ERROR).json({ error });
  } else {
    next();
  }
};

export default BosError;
