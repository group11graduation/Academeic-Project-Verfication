FROM php:8.2-apache

ENV APP_SUBDIR=.
ENV FRONTEND_SUBDIR=

# Laravel + Vite/React preview: PHP extensions, Composer, and Node for asset builds.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    unzip \
    libpng-dev \
    libjpeg62-turbo-dev \
    libfreetype6-dev \
    libzip-dev \
    libicu-dev \
    libonig-dev \
    libxml2-dev \
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
    bcmath \
    exif \
    pcntl \
  && a2enmod rewrite headers \
  && curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer \
  && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html

COPY preview-bootstrap.php /preview-bootstrap.php
COPY preview-seed-admin.php /preview-seed-admin.php
COPY preview-seed-laravel.php /preview-seed-laravel.php
COPY entrypoint.sh /preview-entrypoint.sh
RUN sed -i 's/\r$//' /preview-entrypoint.sh && chmod +x /preview-entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/preview-entrypoint.sh"]
