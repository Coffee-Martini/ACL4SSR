async function operator(proxies, targetPlatform, context) {
  // 1. 城市/别名/缩写正则映射，统一提取标准的中文地区名称
  const cityToRegionMap = {
    '香港': /(深|沪|呼|京|广|杭)港|Hongkong|Hong Kong|HK|香港/i,
    '台湾': /(台|Tai\s?wan|TW).*?🇨🇳|🇨🇳.*?(台|Tai\s?wan|TW)|Taipei|新台|新北|台湾|台灣/i,
    '日本': /(深|沪|呼|京|广|杭|中|辽)日|Tokyo|Osaka|东京|大阪|大坂|日本|JP/i,
    '新加坡': /狮城|(深|沪|呼|京|广|杭)新|Singapore|SG|新加坡/i,
    '美国': /(深|沪|呼|京|广|杭)美|USA|Los Angeles|San Jose|Silicon Valley|Michigan|波特兰|芝加哥|哥伦布|纽约|硅谷|俄勒冈|西雅图|美国|US/i,
    '韩国': /春川|首尔|Korea|KR|韩国|韩/i,
    '英国': /London|Great Britain|英国|UK|GB/i,
    '德国': /(深|沪|呼|京|广|杭)德|Frankfurt|法兰克福|德国|DE/i,
    '法国': /巴黎|France|FR|法国/i,
    '澳大利亚': /澳洲|墨尔本|悉尼|土澳|(深|沪|呼|京|广|杭)澳|Australia|AU|澳大利亚/i,
    '俄罗斯': /Moscow|莫斯科|Russia|RU|俄罗斯/i,
    '土耳其': /伊斯坦布尔|Istanbul|Turkey|TR|土耳其/i,
    '印度': /Mumbai|孟买|India|IN|印度/i,
    '阿根廷': /Argentina|AR|阿根廷/i,
    '加拿大': /Canada|CA|加拿大/i,
    '乌克兰': /Ukraine|UA|乌克兰/i
  };

  // 2. 移除垃圾/提示性节点的正则
  const garbageRegex = /(套餐|到期|有效|剩余|已用|过期|失联|测试|官方|网址|备用|群|TEST|客服|网站|获取|订阅|流量|机场|下次|官址|联系|邮箱|工单|学术|USE|USED|TOTAL|EXPIRE|EMAIL)/i;

  // 过滤提示节点
  const validProxies = proxies.filter(proxy => !garbageRegex.test(proxy.name));

  // 用于记录各个分组的计数器（如 "日本_normal"、"日本_free"）
  const groupCounters = {};

  return validProxies.map(proxy => {
    const rawName = proxy.name;
    const subName = proxy._subDisplayName || proxy._subName || 'Default';

    // --- A. 识别中文地区名称及对应的 Flag ---
    let region = '';
    for (const [regionName, regex] of Object.entries(cityToRegionMap)) {
      if (regex.test(rawName)) {
        region = regionName;
        break;
      }
    }

    // 获取 Flag (优先使用 ProxyUtils)
    let flag = '';
    if (typeof ProxyUtils !== 'undefined') {
      flag = ProxyUtils.getFlag(rawName) || (region ? ProxyUtils.getFlag(region) : '');
    }

    // 未能匹配到地区时的兜底处理
    if (!region) {
      region = '其他';
    }

    // --- B. 识别是否为免费节点 ---
    const isFree = /免费|Free/i.test(rawName);

    // --- C. 提取保留关键属性 (倍率、专线、版本等) ---
    const extraTags = [];

    // 1. 如果是免费节点，加到后缀标签里
    if (isFree) {
      extraTags.push('免费');
    }

    // 2. 提取倍率 (如 x0.01, x0.8, x2, x1.5, 2x, 0.5倍)
    const rateMatch = rawName.match(/x\d+(\.\d+)?|\d+(\.\d+)?(x|倍|×)/i);
    const rate = rateMatch ? rateMatch[0].toLowerCase() : '';

    // 3. 提取关键线路/服务特征
    const lineFeatures = rawName.match(/(IEPL|IPLC|BGP|IPV6|下载专用|联通电信推荐|游戏|专线|家宽|软银)/gi);
    if (lineFeatures) {
      lineFeatures.forEach(tag => {
        if (!extraTags.includes(tag)) extraTags.push(tag);
      });
    }

    // 4. 提取版本号 (如 Ver.8, Ver.7)
    const verMatch = rawName.match(/Ver\.\d+/i);
    if (verMatch && !extraTags.includes(verMatch[0])) {
      extraTags.push(verMatch[0]);
    }

    // --- D. 生成防重名递增序数 (免费节点单独分组计数) ---
    const groupKey = `${region}_${isFree ? 'free' : 'normal'}`;
    groupCounters[groupKey] = (groupCounters[groupKey] || 0) + 1;
    const indexStr = String(groupCounters[groupKey]).padStart(2, '0');

    // --- E. 组装最终命名格式 ---
    // 基础格式：[订阅名] Emoji 中文地区名 序数
    let formattedName = `[${subName}] ${flag} ${region} ${indexStr}`.replace(/\s+/g, ' ').trim();

    // 拼接关键属性标签与倍率
    const infoParts = [];
    if (extraTags.length > 0) infoParts.push(extraTags.join(' '));
    if (rate) infoParts.push(rate);

    if (infoParts.length > 0) {
      formattedName += ` | ${infoParts.join(' | ')}`;
    }

    proxy.name = formattedName;
    return proxy;
  });
}
