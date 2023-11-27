FROM node:16.20.0-alpine
MAINTAINER Vu N. Duc Khoi <vunduckhoi@gmail.com>

ENV LOG_LEVEL 1
ENV LOG_LEVEL_GATEWAY 1

RUN mkdir /gateway
WORKDIR /gateway

RUN mkdir ./certs
RUN mkdir ./config

COPY ./server.js /gateway/
COPY ./package.json /gateway/
COPY ./certs /gateway/certs/
COPY ./config /gateway/config/

RUN apk add --no-cache bash

RUN npm install

# make express-gateway global
RUN ln -s /gateway/node_modules/express-gateway/bin/index.js /usr/local/bin/eg

EXPOSE 80
CMD ["npm", "start"]
HEALTHCHECK --interval=10s CMD wget -qO- localhost:80/healthcheck
