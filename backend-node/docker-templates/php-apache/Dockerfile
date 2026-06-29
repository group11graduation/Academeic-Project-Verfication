FROM php:8.2-apache

ENV APP_SUBDIR=.

RUN docker-php-ext-install pdo pdo_mysql \
  && a2enmod rewrite

WORKDIR /var/www/html

# Student project is bind-mounted at /var/www/html at container start.
COPY entrypoint.sh /preview-entrypoint.sh
RUN chmod +x /preview-entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/preview-entrypoint.sh"]
