FROM node:22-alpine

WORKDIR /app

# Kopiowanie package*.json i instalacja zaleznosci przed skopiowaniem kodu (cache warstw)
COPY package*.json ./

RUN npm ci --omit=dev

# Kopiowanie kodu aplikacji
COPY . .

RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
