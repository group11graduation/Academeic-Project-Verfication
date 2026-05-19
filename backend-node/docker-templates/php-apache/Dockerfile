FROM php:8.2-apache

ARG APP_SUBDIR=.
ENV APP_SUBDIR=${APP_SUBDIR}

RUN docker-php-ext-install pdo pdo_mysql \
  && a2enmod rewrite

WORKDIR /var/www/html
COPY . /var/www/html/
COPY entrypoint.sh /preview-entrypoint.sh
RUN chmod +x /preview-entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/preview-entrypoint.sh"]
