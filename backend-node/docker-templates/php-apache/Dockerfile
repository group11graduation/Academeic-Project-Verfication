FROM php:8.2-apache

ENV APP_SUBDIR=.

RUN docker-php-ext-install pdo pdo_mysql \
  && a2enmod rewrite

WORKDIR /var/www/html

# Student project is bind-mounted at /var/www/html at container start.
COPY preview-bootstrap.php /preview-bootstrap.php
COPY entrypoint.sh /preview-entrypoint.sh
RUN sed -i 's/\r$//' /preview-entrypoint.sh && chmod +x /preview-entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/preview-entrypoint.sh"]
