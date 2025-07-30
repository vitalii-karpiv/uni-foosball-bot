FROM node:22-alpine

RUN mkdir -p /uni-foosball-bot/src
WORKDIR /uni-foosball-bot

COPY package.json /uni-foosball-bot
COPY .env /uni-foosball-bot
COPY src /uni-foosball-bot/src

RUN npm install

CMD ["npm", "run", "start"]