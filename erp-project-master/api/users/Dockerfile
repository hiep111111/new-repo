FROM node:16.20.0-alpine
MAINTAINER Vu N. Duc Khoi <vunduckhoi@gmail.com>

WORKDIR /service

COPY jest.config.js /service/
COPY package.json /service/
COPY server.js /service/
RUN mkdir -p /service/services
COPY services /service/services/
COPY start.sh /service/

EXPOSE 3000
CMD ["npm", "start"]
HEALTHCHECK --interval=30s CMD wget -qO- localhost:3000/v1/users/healthcheck
