FROM node:16.20.0-alpine
MAINTAINER Vu N. Duc Khoi <vunduckhoi@gmail.com>

RUN mkdir /service
WORKDIR /service

# COPY ./ /service/

RUN mkdir -p /service/certs
COPY certs /service/certs/
RUN mkdir -p /service/config
COPY config /service/config/
RUN mkdir -p /service/constants
COPY constants /service/constants/
RUN mkdir -p /service/helpers
COPY helpers /service/helpers/
RUN mkdir -p /service/i18n
COPY i18n /service/i18n/
RUN mkdir -p /service/startup
COPY startup /service/startup/
COPY babel.config.js /service/
COPY package.json /service/
COPY softlink.sh /service/
COPY wait-for-it.sh /service/

RUN apk add --no-cache bash
