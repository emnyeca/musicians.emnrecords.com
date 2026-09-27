FROM php:8.3-cli
RUN apt-get update && apt-get install -y --no-install-recommends libonig-dev libpng-dev libjpeg62-turbo-dev libwebp-dev \
    && docker-php-ext-configure gd --with-jpeg --with-webp \
    && docker-php-ext-install pdo_mysql mbstring gd \
    && rm -rf /var/lib/apt/lists/*
