import { DATA_TYPE } from "../../constants/dataTypeConstant";

const refModel = {
  fileId: { type: DATA_TYPE.ID, required: true },
  fileName: { type: DATA_TYPE.STRING },

  originalName: { type: DATA_TYPE.STRING },
  contentType: { type: DATA_TYPE.STRING },
  size: { type: DATA_TYPE.NUMBER },
  bucketName: { type: DATA_TYPE.STRING },
  uploadDate: { type: DATA_TYPE.DATE },
};

export default refModel;
