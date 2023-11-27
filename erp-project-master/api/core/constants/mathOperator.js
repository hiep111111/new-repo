const EQ = "$eq";
const NE = "$ne";

const GT = "$gt";
const GTE = "$gte";

const LT = "$lt";
const LTE = "$lte";

const IN = "$in";
const NOT_IN = "$nin";
const EXISTS = "$exists";

const AND = "$and";
const OR = "$or";

export const OPERATOR = {
  EQ,
  NE,
  GT,
  GTE,
  LT,
  LTE,
  IN,
  NOT_IN,
  EXISTS,
  AND,
  OR,
};

export const OPERATOR_LIST = Object.values(OPERATOR);
