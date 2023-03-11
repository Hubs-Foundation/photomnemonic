# FROM node:lts-alpine
FROM node:lts-buster
WORKDIR /app

RUN apt-get update && apt-get -y install libnss3 libexpat1

COPY package.json package-lock.json /app/
run npm i @sparticuz/chromium
RUN npm install
RUN npm install express

COPY app.js index.js url-utils.js /app/
# user nobody
CMD AWS_LAMBDA_FUNCTION_NAME="something" node app.js