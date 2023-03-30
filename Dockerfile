# FROM node:lts-alpine
FROM node:lts-buster
WORKDIR /app

RUN apt-get update && apt-get -y install libnss3 libexpat1

COPY package.json package-lock.json /app/
run npm i @sparticuz/chromium
RUN npm install
RUN npm install express

COPY app.js index.js utils.js /app/
RUN mkdir -p /etc/chromium/policies && echo $' \n\
{ \n\
  "URLBlocklist": [ \n\
    "tanfarming.com", \n\
    "https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Fonts*", \n\
    "127.*", \n\
    "192.168.*", \n\
    "10.*", \n\
    "172.16.*", \n\
    "172.31.*", \n\
    "169.254.*" \n\
  ] \n\
} ' >> /etc/chromium/policies/p1.json

CMD AWS_LAMBDA_FUNCTION_NAME="something" node app.js