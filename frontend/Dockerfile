FROM nginx:1.27-alpine

# Свой конфиг nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Статика
COPY . /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]