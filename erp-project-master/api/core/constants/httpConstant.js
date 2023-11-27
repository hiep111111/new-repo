const GET = "get";
const POST = "post";
const PUT = "put";
const DELETE = "delete";
const PATCH = "patch";

export const HTTP_METHOD = {
  GET,
  POST,
  PUT,
  DELETE,
  PATCH,
};

export const HTTP_METHOD_LIST = {
  values: [GET, POST, PUT, DELETE, PATCH],
  message: "enum validator failed for path `{PATH}` with value `{VALUE}`",
};

export const HTTP_RESPONSE_CODE = {
  OK: "200",
  CREATED: "201",
  MOVED_PERMANENTLY: "301",
  BAD_REQUEST: "400",
  UNAUTHORIZED: "401",
  FORBIDDEN: "403",
  NOT_FOUND: "404",
  METHOD_NOT_ALLOWED: "405",
  UNPROCESSABLE_ENTITY: "422",
  INTERNAL_SERVER_ERROR: "500",
  BAD_GATEWAY: "500",
  SERVICE_UNAVAILABLE: "503",
};
