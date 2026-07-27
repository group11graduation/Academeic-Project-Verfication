FROM php:8.2-apache

ENV APP_SUBDIR=.

# Student ZIPs commonly use mysqli (not only PDO). Install the usual MySQL + web stack
# extensions so new PHP previews work without per-project image tweaks.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpng-dev \
    libjpeg62-turbo-dev \
    libfreetype6-dev \
    libzip-dev \
    libicu-dev \
    libonig-dev \
  && docker-php-ext-configure gd --with-freetype --with-jpeg \
  && docker-php-ext-install -j"$(nproc)" \
    mysqli \
    pdo \
    pdo_mysql \
    mbstring \
    gd \
    zip \
    intl \
    opcache \
  && a2enmod rewrite headers \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html

# Student project is bind-mounted at /var/www/html at container start.
COPY preview-bootstrap.php /preview-bootstrap.php
COPY preview-seed-admin.php /preview-seed-admin.php
COPY entrypoint.sh /preview-entrypoint.sh
RUN sed -i 's/\r$//' /preview-entrypoint.sh && chmod +x /preview-entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/preview-entrypoint.sh"]
