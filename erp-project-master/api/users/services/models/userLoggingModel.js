import { DATA_TYPE } from "../../constants/dataTypeConstant";
import { API_LIST } from "../../helpers/controllerHelper";

const model = {
  modelName: "userLoggings",

  data: {
    userId: { type: DATA_TYPE.ID },
    userName: { type: DATA_TYPE.STRING },
    userFullName: { type: DATA_TYPE.STRING },

    failedCount: { type: DATA_TYPE.NUMBER },
    expiredLockedAt: { type: DATA_TYPE.DATE_TIME },
  },

  apiList: API_LIST.R,
};

export default model;
