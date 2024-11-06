import express from 'express';
import http from 'http';
import https from 'https';
import { URL } from 'url';

const app = express();
const targetHost = 'https://txc.qq.com'; // 目标地址

// 处理 CORS 的中间件
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // 允许所有来源
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS'); // 允许的 HTTP 方法
  res.header('Access-Control-Allow-Headers', '*'); // 允许的请求头

  // 对于 OPTIONS 请求，提前返回 200 状态码
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

const proxyRequest = (req, res) => {
  try {
    const targetUrl = new URL(targetHost + req.url);
    const options = {
      method: req.method,
      headers: {
        ...req.headers,
        host: targetUrl.host, // 设置目标主机
      },
    };

    const protocol = targetUrl.protocol === 'https:' ? https : http;

    const proxy = protocol.request(targetUrl, options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    req.pipe(proxy);

    proxy.on('error', (err) => {
      console.error(`请求转发失败: ${err.message}`);
      res.sendStatus(500);
    });
  } catch (error) {
    console.error(`错误: ${error.message}`);
    res.sendStatus(500);
  }
};

// 处理所有请求
app.use(proxyRequest);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`服务器正在监听端口 ${PORT}`);
});
