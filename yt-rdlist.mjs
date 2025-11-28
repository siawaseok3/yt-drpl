import express from "express";
import fetch from "node-fetch";
import vm from "vm";

const app = express();
const port = 3000;

app.get("/api/rdlist", async (req, res) => {
  const { vid, list } = req.query;

  if (!vid || !list) {
    return res.status(400).json({ error: "videoid と list が必要です" });
  }

  const url = `https://www.youtube.com/watch?v=${vid}&list=${list}`;

  try {
    // 1️⃣ HTML を取得
    const html = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "accept-language": "ja,en;q=0.9",
        "accept-encoding": "gzip, deflate, br, zstd",

        // cache control
        "cache-control": "no-cache",
        pragma: "no-cache",
        "upgrade-insecure-requests": "1",
        "sec-ch-ua":
          '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Chrome OS"',
        "sec-ch-ua-arch": '"x86"',
        "sec-ch-ua-bitness": '"64"',
        "sec-ch-ua-model": '""',
        "sec-ch-ua-full-version": '"142.0.7444.181"',
        "sec-ch-ua-full-version-list":
          '"Chromium";v="142.0.7444.181", "Google Chrome";v="142.0.7444.181", "Not_A Brand";v="99.0.0.0"',
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "navigate",
        "sec-fetch-user": "?1",
        "sec-fetch-dest": "document",
        "x-browser-channel": "stable",
        "x-browser-year": "2025",
        "x-browser-copyright":
          "Copyright 2025 Google LLC. All Rights reserved.",
        "x-browser-validation": "qyuB5zIOEsgBn+ljAditJtHDe04=",
        "x-client-data":
          "CJO2yQEIo7bJAQipncoBCNqPywEIlqHLAQiIoM0BCOnkzgEIl4zPAQi8kc8BCJqTzwEI85jPAQi+mc8BCNOZzwEIpprPAQjEns8BCNWezwE=",
      },
    }).then((r) => r.text());

    // 2️⃣ ytInitialData を抽出
    const idx = html.indexOf("var ytInitialData =");
    if (idx === -1) throw new Error("HTML 内に ytInitialData が見つかりません");

    const start = html.indexOf("{", idx);
    const end = html.indexOf("};", start) + 1;
    if (start === -1 || end === -1)
      throw new Error("ytInitialData のオブジェクト部分を抽出できません");

    const code = "ytInitialData=" + html.slice(start, end);
    const context = {};
    vm.createContext(context);
    vm.runInContext(code, context);
    const ytInitialData = context.ytInitialData;

    // 3️⃣ プレイリスト情報を抽出
    const playlistData =
      ytInitialData.contents?.twoColumnWatchNextResults?.playlist?.playlist;
    if (!playlistData) throw new Error("プレイリスト情報が見つかりません");

    const playlistTitle = playlistData.title;
    const videos = playlistData.contents
      .map((item) => {
        const vid = item.playlistPanelVideoRenderer;
        if (!vid) return null;
        return {
          title: vid.title.simpleText,
          videoId: vid.videoId,
          author: vid.longBylineText?.runs?.[0]?.text || null,
          length: vid.lengthText?.simpleText || null,
        };
      })
      .filter(Boolean);

    res.json({ playlistTitle, videos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
