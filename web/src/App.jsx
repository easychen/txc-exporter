import React, { useState } from 'react';
import md5 from 'js-md5';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';

function App() {
  const [privateKey, setPrivateKey] = useState('');
  const [productId, setProductId] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedbackData, setFeedbackData] = useState([]);
  const [replyData, setReplyData] = useState([]);
  const [jsonData, setJsonData] = useState([]);
  const [error, setError] = useState(null);
  const [downloadedCount, setDownloadedCount] = useState(0);

  const MAX_COUNT = 100;
  const REQUEST_INTERVAL = 600;

  const generateSignature = (timestamp, privateKey) => {
    return md5(`${timestamp}${privateKey}`);
  };

  const getCurrentTimestamp = () => {
    return Math.floor(Date.now() / 1000).toString();
  };

  const deduplicateById = (dataArray) => {
    const ids = new Set();
    const uniqueData = [];

    dataArray.forEach((item) => {
      if (!ids.has(item.id)) {
        ids.add(item.id);
        uniqueData.push(item);
      }
    });

    return uniqueData;
  };

  const fetchFeedbackData = async (url) => {
    try {
      const timestamp = getCurrentTimestamp();
      const signature = generateSignature(timestamp, privateKey);

      const headers = {
        Timestamp: timestamp,
        Signature: signature,
      };

      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`请求失败：${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      throw new Error(`请求失败：${err.message}`);
    }
  };

  const fetchAllFeedback = async () => {
    const BASE_ORIGIN = `http://localhost:3001`;
    const BASE_URL = `${BASE_ORIGIN}/api/v1/${productId}/posts`;
    let url = `${BASE_URL}?count=${MAX_COUNT}`;
    let allFeedback = [];
    let allReplies = [];
    let allJsonData = [];
    let hasNextPage = true;
    let totalDownloaded = 0;

    while (hasNextPage) {
      const data = await fetchFeedbackData(url);

      if (data.data && Array.isArray(data.data)) {
        const formattedFeedback = data.data.map((item) => {
          const flattenedItem = { ...item };

          Object.keys(flattenedItem).forEach((key) => {
            if (key === 'replies_all') {
              const replies = Object.values(flattenedItem[key]).map((reply) => {
                const flatReply = { ...reply.self };

                Object.keys(flatReply).forEach((attr) => {
                  if (Array.isArray(flatReply[attr]) && attr === 'images') {
                    flatReply[attr] = flatReply[attr].join('\n');
                  } else {
                    flatReply[attr] = String(flatReply[attr] ?? '');
                  }
                });

                return flatReply;
              });

              allReplies = allReplies.concat(replies);
              delete flattenedItem[key];
            } else if (typeof flattenedItem[key] === 'object' && flattenedItem[key] !== null) {
              flattenedItem[key] = JSON.stringify(flattenedItem[key]);
            }
          });

          return flattenedItem;
        });

        allFeedback = allFeedback.concat(formattedFeedback);
        allJsonData = allJsonData.concat(data.data);
      }

      totalDownloaded += data.data.length;
      setDownloadedCount(totalDownloaded);

      const nextPageUrl = data.pagination?.next_page_url;
      if (nextPageUrl) {
        url = `${BASE_ORIGIN}${nextPageUrl}`;
        await new Promise((resolve) => setTimeout(resolve, REQUEST_INTERVAL));
      } else {
        hasNextPage = false;
      }
    }

    allFeedback = deduplicateById(allFeedback);
    allReplies = deduplicateById(allReplies);

    setFeedbackData(allFeedback);
    setReplyData(allReplies);
    setJsonData(allJsonData);

    // console.log(allFeedback, allReplies);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFeedbackData([]);
    setReplyData([]);
    setJsonData([]);
    setDownloadedCount(0);
    try {
      await fetchAllFeedback();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleDownload = async () => {
    const workbook = XLSX.utils.book_new();

    const feedbackWorksheet = XLSX.utils.json_to_sheet(feedbackData);
    XLSX.utils.book_append_sheet(workbook, feedbackWorksheet, '反馈');

    const replyWorksheet = XLSX.utils.json_to_sheet(replyData);
    XLSX.utils.book_append_sheet(workbook, replyWorksheet, '回复');

    const excelArrayBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    });

    const excelBlob = new Blob([excelArrayBuffer], { type: 'application/octet-stream' });

    const zip = new JSZip();
    zip.file('feedback.xlsx', excelBlob);
    zip.file('feedback_raw.json', JSON.stringify(jsonData, null, 2));

    zip.generateAsync({ type: 'blob' }).then((blob) => {
      saveAs(blob, 'feedback_data.zip');
    });
  };

  return (
    <div className="container mx-auto p-4 max-w-md bg-white rounded-lg shadow-lg border border-slate-200 mt-[100px]">
      <h1 className="text-xl font-semibold mb-4 text-center">腾讯兔小巢数据导出工具</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
      <div>
          <label className="block text-sm font-medium">
            产品ID（PRODUCT_ID）:
            <input
              type="number"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
              placeholder="输入产品 ID，产品设置→基础信息"
            />
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium">
          产品密钥（PRIVATE_KEY）:
            <input
              type="password"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
              placeholder="输入私钥，产品设置→高级设置"
            />
          </label>
        </div>
        
        <button
          type="submit"
          disabled={loading || !privateKey || !productId}
          className="w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg"
        >
          {loading ? '传输中...' : '导出全部反馈和回复'}
        </button>
      </form>
      {loading && (
        <div className="mt-4 text-center">
          <p>正在传输数据，请稍候...</p>
          <p>已下载数据条数：{downloadedCount}</p>
        </div>
      )}
      {error && <p className="text-red-500 mt-4 text-center">错误：{error}</p>}
      {!loading && feedbackData.length > 0 && (
        <button
          onClick={handleDownload}
          className="mt-4 w-full py-2 px-4 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg"
        >
          下载 ZIP 文件
        </button>
      )}
    </div>
  );
}

export default App;
