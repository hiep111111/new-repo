FROM nginx
MAINTAINER vunduckhoi@gmail.com

COPY ./config.nginx /etc/nginx/conf.d/
ADD static /usr/share/nginx/html/

RUN sed -i 's/sendfile        on;/sendfile        on;limit_req_zone $binary_remote_addr zone=mylimit:10m rate=10r\/s;/g' /etc/nginx/nginx.conf
RUN sed -i 's/#gzip/client_max_body_size 100M;#gzip/g' /etc/nginx/nginx.conf

EXPOSE 80

CMD envsubst < /etc/nginx/conf.d/config.nginx > /etc/nginx/conf.d/default.conf && exec nginx -g "daemon off;"

RUN service nginx start
