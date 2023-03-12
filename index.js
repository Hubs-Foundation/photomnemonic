const { urlAllowed, GetBrowser } = require("./utils");

function sleep(miliseconds = 100) {
  return new Promise(resolve => setTimeout(resolve, miliseconds));
}

async function screenshot(url) {
  let data, meta;
  let loaded = false;

  t0 = new Date().getTime()
  const loading = async (startTime = Date.now()) => {
    if (!loaded && Date.now() - startTime < 12 * 1000) {
      await sleep(100);
      await loading(startTime);
    }
  };

  const browser = await GetBrowser()

  const page = await browser.newPage();

  await page.goto(url);
  const pageTitle = await page.title();
  console.log( "pageTitle: ",pageTitle, ", took: ", new Date().getTime()-t0, "ms")

  for (let i = 0; i < 20; i++) {
    try{
      data = await page.screenshot({ encoding: "base64" });
      console.log( "screenshot took: ", new Date().getTime()-t0, "ms")
      return {data,meta};
    }
    catch (e){
      console.log(e)
    } 
    await sleep(500)   
    }

  console.log("fffffffffffffffffffffffffffffff")
  return
}

module.exports.handler = async function handler(event, context, callback) {
  const queryStringParameters = event.queryStringParameters || {};
  const { url = "https://www.mozilla.org"} =
    queryStringParameters;

  if (!(await urlAllowed(url))) {
    return callback(null, { statusCode: 403, body: "forbidden" });
  }

  let data;

  const headers = {
    "Content-Type": "image/png"
  };

  try {
    const result = await screenshot(url);
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
