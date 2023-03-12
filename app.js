const lambda = require("./index");
var express = require('express');
const utils = require('./utils')

console.log = (function() {
  var console_log = console.log;
  var timeStart = new Date().getTime();
  
  return function() {
    var delta = new Date().getTime() - timeStart;
    var args = [];
    args.push((delta / 1000).toFixed(2) + ':');
    for(var i = 0; i < arguments.length; i++) {
      args.push(arguments[i]);
    }
    console_log.apply(console, args);
  };
})();


async function main() {
  console.log("starting")
  await utils.initBrowser()
  console.log("browser: ", utils.GetBrowser())
  console.log("ready")
  serve()
}



function serve(){
  var app = express();
  app.get('/_healthz', function (req, res) {
    res.send('1');
  });
  app.get('/screenshot', function (req, res) {
    console.log(req.query)
  
    lambda.handler(
        {queryStringParameters: req.query}, 
        null,
        async function (something, callback){
            console.log("callback: ", callback)
            if (callback.isBase64Encoded) {
                callback.body = Buffer.from(callback.body, 'base64')
            }
            res.status(callback.statusCode).header(callback.headers).send(callback.body)
        }
    )
  });
  app.listen(5000, function () {
    console.log('listening on :5000');
  });
}



main()