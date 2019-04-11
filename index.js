const launchChrome = require("@serverless-chrome/lambda");
const Cdp = require("chrome-remote-interface");

function sleep(miliseconds = 100) {
  return new Promise(resolve => setTimeout(() => resolve(), miliseconds));
}

async function screenshot(url) {
  const LOAD_TIMEOUT = process.env.PAGE_LOAD_TIMEOUT || 1000 * 60;

  let result;
  let loaded = false;

  const loading = async (startTime = Date.now()) => {
    if (!loaded && Date.now() - startTime < LOAD_TIMEOUT) {
      await sleep(100);
      await loading(startTime);
    }
  };
  await launchChrome({ flags: [`--window-size=1024x768`, "--hide-scrollbars"] });

  const [tab] = await Cdp.List();
  const client = await Cdp({ host: "127.0.0.1", target: tab });

  const { Network, Page, Runtime, Emulation } = client;

  Page.loadEventFired(() => {
    loaded = true;
  });

  try {
    await Promise.all([Network.enable(), Page.enable()]);

    await Emulation.setDeviceMetricsOverride({
      mobile: false,
      deviceScaleFactor: 0,
      scale: 1,
      width: 1280,
      height: 0
    });

    await Page.navigate({ url });
    await Page.loadEventFired();
    await loading();

    const {
      result: {
        value: { height }
      }
    } = await Runtime.evaluate({
      expression: `(
        () => ({ height: document.body.scrollHeight })
      )();
      `,
      returnByValue: true
    });

    await Emulation.setDeviceMetricsOverride({
      mobile: false,
      deviceScaleFactor: 0,
      scale: 1,
      width: 1280,
      height
    });

    const screenshot = await Page.captureScreenshot({ format: "png" });

    result = screenshot.data;
  } catch (error) {
    console.error(error);
  }

  await client.close();

  return result;
}

module.exports.handler = async function handler(event, context, callback) {
  const queryStringParameters = event.queryStringParameters || {};
  const { url = "https://google.com" } = queryStringParameters;

  let data;

  try {
    data = await screenshot(url);
  } catch (error) {
    console.error("Error capturing screenshot for", url, error);
    return callback(error);
  }

  return callback(null, {
    statusCode: 200,
    body: data,
    isBase64Encoded: true,
    headers: {
      "Content-Type": "image/png"
    }
  });
};
