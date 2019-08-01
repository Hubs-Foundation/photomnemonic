const launchChrome = require("@serverless-chrome/lambda");
const Cdp = require("chrome-remote-interface");
const request = require("request");
const sharp = require("sharp");

function sleep(miliseconds = 100) {
  return new Promise(resolve => setTimeout(() => resolve(), miliseconds));
}

// Returns true if the given URL is permitted to be crawled (based upon the host filter)
function isCrawlable(url, hostFilter) {
  if (!hostFilter) return true;

  // host filter is space separated list of hosts
  const hosts = hostFilter.split(" ");
  return hosts.includes(new URL(url).host);
}

async function screenshot(url, fullscreen) {
  let data, meta;
  let loaded = false;

  const loading = async (startTime = Date.now()) => {
    if (!loaded && Date.now() - startTime < 12 * 1000) {
      await sleep(100);
      await loading(startTime);
    }
  };
  await launchChrome({
    flags: [`--window-size=1280x720`, "--hide-scrollbars"]
  });

  const [tab] = await Cdp.List();
  const client = await Cdp({ host: "127.0.0.1", target: tab });

  const { Network, Page, Runtime, Emulation } = client;

  try {
    await Promise.all([Network.enable(), Page.enable()]);

    await Emulation.setDeviceMetricsOverride({
      mobile: false,
      deviceScaleFactor: 0,
      scale: 1,
      width: 1280,
      height: 0
    });

    await Page.loadEventFired(() => {
      loaded = true;
    });
    await Page.navigate({ url });
    await loading();

    let height = 720;

    if (fullscreen) {
      const result = await Runtime.evaluate({
        expression: `(
          () => ({ height: document.body.scrollHeight })
        )();
        `,
        returnByValue: true
      });

      height = result.result.value.height;
    }

    await Emulation.setDeviceMetricsOverride({
      mobile: false,
      deviceScaleFactor: 0,
      scale: 1,
      width: 1280,
      height: height
    });

    // Look for a global function _photomnemonicReady and if it exists, wait until it returns true.
    await Runtime.evaluate({
      expression: `new Promise(resolve => {
        if (window._photomnemonicReady) {
          if (window._photomnemonicReady()) {
            resolve();
          } else {
            const interval = setInterval(() => {
              if (window._photomnemonicReady()) {
                clearInterval(interval);
                resolve();
              }
            }, 250)
          }
        } else {
          resolve();
        }
      })`,
      awaitPromise: true
    });

    const metaResult = await Runtime.evaluate({
      expression: `window._photomnemonicGetMeta ? window._photomnemonicGetMeta() : null`,
      returnByValue: true
    });

    if (metaResult.result.value) {
      meta = metaResult.result.value;
    }

    await Emulation.setVisibleSize({
      width: meta && meta.width ? meta.width : 1280,
      height: meta && meta.height ? meta.height : height
    });

    const screenshot = await Page.captureScreenshot({ format: "png" });
    data = screenshot.data;
  } catch (error) {
    console.error(error);
  }

  await client.close();

  return { data, meta };
}

module.exports.screenshot = async function handler(event, context, callback) {
  const queryStringParameters = event.queryStringParameters || {};
  const { fullscreen = "false" } = queryStringParameters;

  const base64url = event.pathParameters.url;
  const url = new Buffer(base64url, "base64").toString();

  if (!isCrawlable(url, process.env.screenshotHostFilter)) {
    return callback(null, {
      statusCode: 401,
      body: "Invalid URL"
    });
  }

  let data;

  const headers = {
    "Content-Type": "image/png"
  };

  try {
    const result = await screenshot(url, fullscreen === "true");
    data = result.data;

    if (result.meta) {
      headers["X-Photomnemonic-Meta"] = JSON.stringify(result.meta);
    }
  } catch (error) {
    console.error("Error capturing screenshot for", url, error);
    return callback(error);
  }

  return callback(null, {
    statusCode: 200,
    body: data,
    isBase64Encoded: true,
    headers
  });
};

module.exports.thumbnail = function handler(event, context, callback) {
  const queryStringParameters = event.queryStringParameters || {};
  const {
    width,
    height,
    fit,
    position,
    gravity,
    strategy,
    background,
    withoutEnlargement
  } = queryStringParameters;

  const base64url = event.pathParameters.url;
  const url = new Buffer.from(base64url, "base64").toString();

  if (!isCrawlable(url, process.env.thumbnailHostFilter)) {
    callback(null, {
      statusCode: 401,
      body: "Invalid URL"
    });
  }

  const sharpFit = fit || "cover";

  let sharpPosition = sharp.position.centre;

  if (position) {
    sharpPosition = sharp.position[position];
  } else if (gravity) {
    sharpPosition = sharp.gravity[gravity];
  } else if (strategy) {
    sharpPosition = sharp.strategy[strategy];
  }

  const sharpBackground = background || { r: 0, g: 0, b: 0, alpha: 1 };

  request.get({ url, encoding: null }, (_, __, body) => {
    sharp(body)
      .resize({
        width: parseInt(width),
        height: parseInt(height),
        fit: sharpFit,
        position: sharpPosition,
        background: sharpBackground,
        withoutEnlargement: withoutEnlargement === "true"
      })
      .withMetadata()
      .toBuffer({ resolveWithObject: true })
      .then(({ data, info }) => {
        const headers = {
          "Content-Type": `image/${info.format}`,
          "Cache-Control": "max-age=86400"
        };

        callback(null, {
          statusCode: 200,
          body: data.toString("base64"),
          isBase64Encoded: true,
          headers
        });
      });
  });
};
