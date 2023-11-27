import { DATA_TYPE } from "../../constants/dataTypeConstant";
import { API_LIST } from "../../helpers/controllerHelper";

import functionWithParentRefModel from "../refModels/functionWithParentRefModel";

const model = {
  modelName: "roles",

  data: {
    roleCode: {
      type: DATA_TYPE.STRING,
      required: true,
      index: true,
    },

    roleName: {
      type: DATA_TYPE.STRING,
      required: true,
      index: true,
    },

    functionList: [
      {
        ...functionWithParentRefModel,
      },
    ],
  },

  apiList: API_LIST.CRUD,
};

export default model;
