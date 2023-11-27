FROM rabbitmq:3.11-management-alpine
MAINTAINER Vu N. Duc Khoi <vunduckhoi@gmail.com>

COPY rabbitmq-healthcheck /usr/local/bin/

HEALTHCHECK --interval=10s CMD ["rabbitmq-healthcheck"]
