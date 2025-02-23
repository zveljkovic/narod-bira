FROM node:22.14-alpine

COPY package*.json ./
RUN npm ci

COPY . /home/node/app

EXPOSE 3000
WORKDIR /home/node/app
CMD [ "src/index.js" ]