FROM node:18


WORKDIR /scooterapp


COPY package*.json ./


RUN npm install

COPY . .


EXPOSE 3000


ENTRYPOINT ["npm", "start"]
