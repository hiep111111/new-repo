import winston, { format, transports } from 'winston';
const { combine, timestamp, label, printf, prettyPrint, colorize } = format;
const now = new Date();

const myFormat = printf(({ level, message, label, timestamp }) => {
  const information = label.split("-");
  return `{\n  "timestamp": "${timestamp}",\n  "level": "${level}",\n  "message": "${message}",\n  "model": "${information[0]}",\n  "action": "${information[1]}",\n  "userName": "${information[2]}",\n},`;
});

const myCustomLevels = {
  levels: {
    error: 0,
    success: 1,
    info: 2,
  },
  colors: {
    error: 'red',
    success: 'green',
    info: 'blue',
  }
};

export const createLogger = (modelName, controllerName, userName) => {
  const date = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
  const logger = winston.createLogger({
    levels: myCustomLevels.levels,

    format: combine(
      label({ label: `${modelName}-${controllerName}-${userName}`}),
      timestamp({
        format: "DD/MM/YYYY HH:mm"
      }),
      prettyPrint(),
      // colorize(),
      myFormat
    ),

    transports: [
      // new transports.Console({ level: 'error' }),
      // new transports.Console({ level: 'info' }),
      // new transports.Console({ level: 'success' }),
      new transports.File({ filename: `./logs/${modelName}-${controllerName}-${date}.log` }),
      // new transports.File({ filename: `./logs/${modelName}-${controllerName}-${date}.log`, level: 'error' }),
      // new transports.File({ filename: `./logs/${modelName}-${controllerName}-${date}.log`, level: 'info' }),
      // new transports.File({ filename: `./logs/${modelName}-${controllerName}-${date}.log`, level: 'success' }),
    ]
  });

  winston.addColors(myCustomLevels.colors);

  return logger;
}
