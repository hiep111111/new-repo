import mongoose from 'mongoose';

const UNAUTHORIZED_ERROR = 'Unauthorized';

export const clientRequestParser = async (req, res, next) => {
  try {
    const AutobotModel = mongoose.model('autobots');
    const { headers, path } = req;

    if (String(path).endsWith("/healthcheck")) {
      next();
      return;
    }

    const authHeader = headers.authorization || '';
    const splittedAuthHeader = authHeader ? authHeader.split(' ') : [];
    const serviceCode = path.split('/')[2]; // "/supporting/ocr/" => "ocr"

    if (String(splittedAuthHeader[0]).toLowerCase() !== 'basic' || !splittedAuthHeader[1] || !serviceCode) {
      next(UNAUTHORIZED_ERROR);
      return;
    }

    const decodedAuthHeader = Buffer.from(splittedAuthHeader[1], 'base64').toString('ascii').split(':'); // decode base64
    const autobotCode = decodedAuthHeader[0];
    const autobotSecret = decodedAuthHeader[1];

    if (!autobotCode || !autobotSecret) {
      next(new Error(UNAUTHORIZED_ERROR));
      return;
    }

    // TODO validate autobot wakeUpBy with serviceCode

    const autobot = await AutobotModel.findOne(
      {
        // serviceCode,
        autobotCode,
        autobotSecret,
      },
      {
        _id: 1,
        autobotName: 1,
      }
    ).lean();

    if (!autobot) {
      console.log('!autobot');
  
      next(new Error(UNAUTHORIZED_ERROR));
      return;
    }

    // TODO: get caller Public IP

    const {
      _id: autobotId,
      autobotName
    } = autobot

    req.context = {
      autobotId, autobotCode, autobotName
    }

    next();
  }
  catch (error) {
    next(error);
  }
}
