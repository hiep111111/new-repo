import mongoose from 'mongoose';
const nodemailer = require('nodemailer');

export const TOKEN = {};

TOKEN.YEAR = '{YY}';
TOKEN.MONTH = '{MM}';
TOKEN.DAY = '{DD}';
TOKEN.SEPARATOR = '{SEPARATOR}';
TOKEN.SEQUENCE = '{SEQUENCE}';

export const getSequenceCode = async (codePattern, sequenceLength = 3, separator = '-') => {
  const Sequences = mongoose.model('sequences');
  let sequenceModel = codePattern;
  const now = new Date();
  const replacedToken = [];

  const year = now.getFullYear() % 100;

  if (year < 10) {
    replacedToken.push({ key: TOKEN.YEAR, value: `0${year}` });
  } else {
    replacedToken.push({ key: TOKEN.YEAR, value: `${year}` });
  }

  const month = now.getMonth() + 1;

  if (month < 10) {
    replacedToken.push({ key: TOKEN.MONTH, value: `0${month}` });
  } else {
    replacedToken.push({ key: TOKEN.MONTH, value: `${month}` });
  }

  const day = now.getDate();

  if (day < 10) {
    replacedToken.push({ key: TOKEN.DAY, value: `0${day}` });
  } else {
    replacedToken.push({ key: TOKEN.DAY, value: `${day}` });
  }

  replacedToken.push({ key: TOKEN.SEPARATOR, value: separator });

  replacedToken.forEach((token) => { // replace all supported token
    while (sequenceModel.indexOf(token.key) > -1) {
      sequenceModel = sequenceModel.replace(token.key, token.value);
    }
  });

  const codeTemplate = sequenceModel;
  sequenceModel = sequenceModel.replace(TOKEN.SEQUENCE, ''); // get unique key pattern

  let sequenceValue;
  await Sequences.findOne({ model: sequenceModel })
    .select('nextValue')
    .then((sequence) => {
      if (!sequence) {
        sequenceValue = '1';
        const newSequence = new Sequences({ model: sequenceModel, nextValue: 2 });
        newSequence.save();
      } else {
        sequenceValue = sequence.nextValue.toString();
        sequence.nextValue += 1;
        sequence.save();
      }
    });

  while (sequenceValue.length < sequenceLength) {
    sequenceValue = `0${sequenceValue}`;
  }

  return codeTemplate.replace(TOKEN.SEQUENCE, sequenceValue);
};

export const sendEmail = (subject, content, sendTo, CC, res) => {

  let smtpTransport = config.get('smtpTransport');

  if (process.env.RELEASE == 'PRODUCTION') {
    smtpTransport.secure = false;
    smtpTransport.requireTLS = true;
    smtpTransport.tls = { rejectUnauthorized: false }
  }

  const transporter = nodemailer.createTransport(smtpTransport);
  
  const mailOptions = {
    from: smtpTransport.from,
    to: String(sendTo),
    cc: String(CC),
    subject: subject,
    html: content
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return res.status(500).json({ error });
    } else {
      return res.json({ msg: 'Sent to email' });
    }
  });
}