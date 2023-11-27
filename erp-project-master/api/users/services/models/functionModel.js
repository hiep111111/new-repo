import { DATA_TYPE } from "../../constants/dataTypeConstant";
import { API_LIST } from "../../helpers/controllerHelper";

import moduleRefModel from "../refModels/moduleRefModel";

const model = {
  modelName: "functions",

  data: {
    functionUrl: { type: DATA_TYPE.STRING },

    functionName: {
      type: DATA_TYPE.STRING,
      required: true,
      index: true,
    },

    functionOrder: { type: DATA_TYPE.NUMBER, required: true },

    parentId: {
      type: DATA_TYPE.ID,
      refModelName: "functions",
      refKeyField: "_id",
      relatedFields: [
        { fromField: "functionUrl", toField: "parentUrl" },
        { fromField: "functionName", toField: "parentName" },
        "moduleId",
        "moduleCode",
        "moduleName",
        "moduleOrder", // follow parent module config
      ],
    },

    parentUrl: { type: DATA_TYPE.STRING },
    parentName: { type: DATA_TYPE.STRING },

    articleCategoryName: { type: DATA_TYPE.STRING },
    title: { type: DATA_TYPE.STRING },
    refArticleId: { type: DATA_TYPE.ID },
    isRefCategory: { type: DATA_TYPE.BOOLEAN },

    ...moduleRefModel,

    functionActionList: { type: DATA_TYPE.STRING },
    note: { type: DATA_TYPE.STRING },
  },

  apiList: API_LIST.CRUD,
};

export default model;
