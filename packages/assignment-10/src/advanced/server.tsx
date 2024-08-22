import React from "react";
import express from "express";
import ReactDOMServer from "react-dom/server";
import { App } from "./App.tsx";

const app = express();
const port = 3333;

// 캐시를 저장할 객체
const cache: { [key: string]: string } = {};

app.get("*", (req, res) => {
  const url = req.url;

  // 캐시에 해당 URL의 렌더링 결과가 있는지 확인
  if (cache[url]) {
    console.log(`Serving from cache for ${url}`);
    return res.send(cache[url]);
  }

  // 캐시에 없으면 새로 렌더링
  console.log(`Rendering for ${url}`);
  const reactApp = ReactDOMServer.renderToString(<App url={url} />);

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Simple SSR</title>
    </head>
    <body>
      <div id="root">${reactApp}</div>
    </body>
    </html>
  `;

  // 렌더링 결과를 캐시에 저장
  cache[url] = html;

  res.send(html);
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
