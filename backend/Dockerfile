FROM node:latest

ENV TZ=Pacific/Honolulu

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["npm", "start"]