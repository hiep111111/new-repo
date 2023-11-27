import mongoose from 'mongoose';

const UNAUTHORIZED_ERROR = 'Unauthorized';

export const clientRequestParser = async (req, res, next) => {
  try {
    const SupportingServiceModel = mongoose.model('supportingServices');
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
    const apiKey = decodedAuthHeader[0];
    const apiSecret = decodedAuthHeader[1];

    if (!apiKey || !apiSecret) {
      next(new Error(UNAUTHORIZED_ERROR));
      return;
    }

    const supportingService = await SupportingServiceModel.findOne(
      {
        supportingServiceCode: serviceCode,
        apiKey,
        apiSecret,

        // TODO: check related serviceCode
      },
      {
        _id: 1,
        supportingServiceName: 1,
      }
    ).lean();

    if (!supportingService) {
      console.log('!supportingService');
  
      next(new Error(UNAUTHORIZED_ERROR));
      return;
    }

    // TODO: update last API call to billing
    const {
      _id: supportingServiceId,
      supportingServiceName,
    } = supportingService;

    req.context = {
      supportingServiceId, supportingServiceCode: serviceCode, supportingServiceName
    }

    next();
  }
  catch (error) {
    next(error);
  }
}
