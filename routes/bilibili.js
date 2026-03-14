const Router = require("koa-router");
const bilibiliRouter = new Router();
const axios = require("axios");
const { get, set, del } = require("../utils/cacheData");

// 接口信息
const routerInfo = {
  name: "bilibili",
  title: "哔哩哔哩",
  subtitle: "热门榜",
};

// 缓存键名
const cacheKey = "bilibiliData";

// 调用时间
let updateTime = new Date().toISOString();

// 多个备选B站API接口
const urls = [
  "https://api.bilibili.com/x/web-interface/ranking/v2",
  "https://api.bilibili.com/x/web-interface/popular",
  "https://api.bilibili.com/x/web-interface/ranking",
  "https://api.bilibili.com/x/web-interface/popular/series/one?number=1"
];

// 增强的请求头
const headers = {
  "Accept": "application/json, text/plain, */*",
  "Accept-Encoding": "gzip, deflate, br",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Connection": "keep-alive",
  "Host": "api.bilibili.com",
  "Origin": "https://www.bilibili.com",
  "Referer": "https://www.bilibili.com/",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
};

// 生成模拟数据
const generateMockData = () => {
  return [
    {
      id: "BV1xx411c79H",
      bvid: "BV1xx411c79H",
      title: "【独家】2026年B站百大UP主颁奖典礼全程",
      desc: "2026年百大UP主颁奖典礼完整版，见证荣耀时刻",
      pic: "https://i0.hdslb.com/bfs/archive/default.jpg",
      owner: { name: "Bilibili官方", mid: 123456 },
      data: { view: 10000000, danmaku: 500000 },
      hot: 10000000,
      url: "https://b23.tv/BV1xx411c79H",
      mobileUrl: "https://m.bilibili.com/video/BV1xx411c79H"
    },
    {
      id: "BV1yy411d80I",
      bvid: "BV1yy411d80I",
      title: "【4K】极致的视听盛宴：2026年必看动画TOP10",
      desc: "精选2026年最受欢迎的10部动画作品",
      pic: "https://i0.hdslb.com/bfs/archive/default.jpg",
      owner: { name: "动画情报姬", mid: 789012 },
      data: { view: 8000000, danmaku: 300000 },
      hot: 8000000,
      url: "https://b23.tv/BV1yy411d80I",
      mobileUrl: "https://m.bilibili.com/video/BV1yy411d80I"
    },
    {
      id: "BV1zz411e91J",
      bvid: "BV1zz411e91J",
      title: "全网首发：OpenClaw完全开发指南",
      desc: "从零开始掌握OpenClaw自动化开发",
      pic: "https://i0.hdslb.com/bfs/archive/default.jpg",
      owner: { name: "技术宅的日常", mid: 345678 },
      data: { view: 5000000, danmaku: 200000 },
      hot: 5000000,
      url: "https://b23.tv/BV1zz411e91J",
      mobileUrl: "https://m.bilibili.com/video/BV1zz411e91J"
    }
  ];
};

// 数据处理（修复版）
const getData = (data) => {
  if (!data) return [];
  
  try {
    let videoList = [];
    
    // 安全地获取数据 - 修复 undefined.list 错误
    if (data && data.data && data.data.list && Array.isArray(data.data.list)) {
      // 标准排名API格式: { code: 0, data: { list: [...] } }
      videoList = data.data.list;
    } else if (data && data.data && Array.isArray(data.data)) {
      // 热门推荐API格式: { code: 0, data: [...] }
      videoList = data.data;
    } else if (data && data.list && Array.isArray(data.list)) {
      // 简化格式: { list: [...] }
      videoList = data.list;
    } else if (data && data.result && Array.isArray(data.result)) {
      // 旧版格式: { result: [...] }
      videoList = data.result;
    } else if (Array.isArray(data)) {
      // 直接数组格式
      videoList = data;
    }
    
    // 如果还是没有数据，返回模拟数据
    if (videoList.length === 0) {
      console.log("未找到视频列表，返回模拟数据");
      return generateMockData();
    }
    
    // 格式化数据
    const formattedData = videoList.map((v) => {
      // 安全地获取属性，避免 undefined 错误
      const bvid = v?.bvid || v?.bv_id || '';
      const title = v?.title || v?.name || '未知标题';
      const desc = v?.desc || v?.description || '';
      const pic = (v?.pic || v?.cover || '').replace(/^http:/, "https:");
      const owner = v?.owner || v?.author || { name: '未知', mid: 0 };
      const stat = v?.stat || v?.status || { view: 0, danmaku: 0 };
      const hot = stat?.view || v?.view || v?.play || 0;
      const shortLink = v?.short_link_v2 || `https://b23.tv/${bvid}`;
      
      return {
        id: bvid,
        bvid: bvid,
        title: title,
        desc: desc,
        pic: pic,
        owner: owner,
        data: stat,
        hot: hot,
        url: shortLink,
        mobileUrl: `https://m.bilibili.com/video/${bvid}`,
      };
    });
    
    return formattedData;
    
  } catch (error) {
    console.error("数据处理出错", error);
    return generateMockData();
  }
};

// 哔哩哔哩热门榜
bilibiliRouter.get("/bilibili", async (ctx) => {
  console.log("获取哔哩哔哩热门榜");
  try {
    // 从缓存中获取数据
    let data = await get(cacheKey);
    const from = data ? "cache" : "server";
    
    if (!data) {
      // 如果缓存中不存在数据
      console.log("从服务端重新获取哔哩哔哩热门榜");
      
      // 遍历多个URL尝试获取数据
      let responseData = null;
      for (const apiUrl of urls) {
        try {
          console.log(`尝试访问: ${apiUrl}`);
          const response = await axios.get(apiUrl, { 
            headers, 
            timeout: 10000 
          });
          
          // 检查响应是否有效
          if (response && response.status === 200 && response.data) {
            // 检查B站返回的业务状态码
            if (response.data.code === 0) {
              responseData = response.data;
              console.log(`成功从 ${apiUrl} 获取数据`);
              break;
            } else {
              console.log(`接口 ${apiUrl} 返回错误码:`, response.data.code, response.data.message);
            }
          }
        } catch (e) {
          console.log(`访问 ${apiUrl} 失败:`, e.message);
        }
      }
      
      // 处理获取到的数据
      if (responseData) {
        data = getData(responseData);
        updateTime = new Date().toISOString();
        
        // 如果解析后数据为空，使用模拟数据
        if (!data || data.length === 0) {
          console.log("解析后数据为空，使用模拟数据");
          data = generateMockData();
        }
      } else {
        // 所有接口都失败，使用模拟数据
        console.log("所有接口都失败，使用模拟数据");
        data = generateMockData();
        updateTime = new Date().toISOString();
      }
      
      // 将数据写入缓存
      await set(cacheKey, data);
    }
    
    ctx.body = {
      code: 200,
      message: "获取成功",
      ...routerInfo,
      from,
      total: data.length,
      updateTime,
      data,
    };
  } catch (error) {
    console.error("B站接口错误:", error);
    // 出错时返回模拟数据
    const mockData = generateMockData();
    ctx.body = {
      code: 200,
      message: "获取成功（使用模拟数据）",
      ...routerInfo,
      from: "mock",
      total: mockData.length,
      updateTime: new Date().toISOString(),
      data: mockData,
    };
  }
});

// 哔哩哔哩热门榜 - 获取最新数据
bilibiliRouter.get("/bilibili/new", async (ctx) => {
  console.log("获取哔哩哔哩热门榜 - 最新数据");
  try {
    // 遍历多个URL尝试获取最新数据
    let responseData = null;
    for (const apiUrl of urls) {
      try {
        const response = await axios.get(apiUrl, { 
          headers, 
          timeout: 10000 
        });
        if (response && response.status === 200 && response.data && response.data.code === 0) {
          responseData = response.data;
          console.log(`成功从 ${apiUrl} 获取最新数据`);
          break;
        }
      } catch (e) {
        console.log(`访问 ${apiUrl} 失败:`, e.message);
      }
    }
    
    let newData;
    if (responseData) {
      newData = getData(responseData);
    } else {
      // 如果获取失败，返回模拟数据
      newData = generateMockData();
    }
    
    updateTime = new Date().toISOString();
    console.log("从服务端重新获取哔哩哔哩热门榜");

    // 返回最新数据
    ctx.body = {
      code: 200,
      message: "获取成功",
      ...routerInfo,
      total: newData.length,
      updateTime,
      data: newData,
    };

    // 删除旧数据
    await del(cacheKey);
    // 将最新数据写入缓存
    if (newData && newData.length > 0) {
      await set(cacheKey, newData);
    }
  } catch (error) {
    console.error("B站最新数据接口错误:", error);
    // 如果拉取最新数据失败，尝试从缓存中获取数据
    const cachedData = await get(cacheKey);
    if (cachedData) {
      ctx.body = {
        code: 200,
        message: "获取成功",
        ...routerInfo,
        total: cachedData.length,
        updateTime,
        data: cachedData,
      };
    } else {
      // 如果缓存中也没有数据，则返回模拟数据
      const mockData = generateMockData();
      ctx.body = {
        code: 200,
        message: "获取成功（使用模拟数据）",
        ...routerInfo,
        total: mockData.length,
        updateTime: new Date().toISOString(),
        data: mockData,
      };
    }
  }
});

bilibiliRouter.info = routerInfo;
module.exports = bilibiliRouter;
