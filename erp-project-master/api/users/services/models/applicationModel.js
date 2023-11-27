import { DATA_TYPE } from "../../constants/dataTypeConstant";
import { API_LIST } from "../../helpers/controllerHelper";

const model = {
  modelName: "applications",

  data: {
    applicationCode: {
      type: DATA_TYPE.STRING,
      required: true,
      index: true,
      unique: true,
    },

    applicationName: {
      type: DATA_TYPE.STRING,
      required: true,
      index: true,
    },
  },

  apiList: API_LIST.CRUD,
};

export default model;
