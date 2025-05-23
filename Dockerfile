# FROM node:lts-alpine
FROM node:18
WORKDIR /app

RUN apt-get update && apt-get -y install libnss3 libexpat1 chromium

COPY package.json package-lock.json /app/
run npm i @sparticuz/chromium
RUN npm install
RUN npm install express

COPY run.sh app.js index.js utils.js /app/
# user nobody
CMD ln -sf /usr/bin/chromium /tmp/chromium && AWS_LAMBDA_FUNCTION_NAME="turkey" node app.js
