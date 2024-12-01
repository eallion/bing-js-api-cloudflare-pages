// Bing Daily Wallpaper Cloudflare Worker

const BING = 'https://www.bing.com';
const REGIONS = ['zh-CN', 'en-US', 'ja-JP', 'en-AU', 'en-UK', 'de-DE', 'en-NZ', 'en-CA'];

const DPI_MAPPINGS = {
    '720': '1280x720',
    '1080': '1920x1080',
    '720p': '1280x720',
    '1080p': '1920x1080',
    '1080i': '1920x1080',
    'hd': '1920x1080',
    'uhd': '1920x1080',
    '2k': '1920x1080',
    '2.5k': '1920x1200',
    '2.8k': '1920x1200',
    '4k': '1920x1080',
    'm': '720x1280',
    'small': '1280x720',
    'thumbnail': '320x240',
    'mobile': '720x1280',
    'original': '1920x1200',
    '1920x1200': '1920x1200',
    '1920x1080': '1920x1080',
    '1366x768': '1366x768',
    '1280x768': '1280x768',
    '1280x720': '1280x720',
    '1024x768': '1024x768',
    '800x600': '800x600',
    '800x480': '800x480',
    '768x1280': '768x1280',
    '720x1280': '720x1280',
    '640x480': '640x480',
    '480x800': '480x800',
    '400x240': '400x240',
    '320x240': '320x240',
    '240x320': '240x320'
};

function formatDate(date) {
    return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}`;
}

async function fetchBingWallpaper(params) {
    const { region = 'en-US', date = null, dpi = null, type = null } = params;
    
    // 计算日期差
    const day = date ? Math.floor(Math.abs((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))) : 0;
    
    // 验证地区
    const mkt = REGIONS.includes(region) ? region : 'en-US';
    
    // 构建 Bing API URL
    const url = `${BING}/HPImageArchive.aspx?idx=${day}&n=1&mkt=${mkt}&format=js`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        const image = data.images[0];
        
        const info = {
            startdate: formatDate(image.startdate),
            enddate: formatDate(image.enddate),
            title: image.title,
            copyright: image.copyright,
            cover: []
        };
        
        // 生成不同分辨率的图片 URL
        const dpiEntries = Object.entries(DPI_MAPPINGS);
        const defaultDpi = '1920x1080';
        
        // 将 1920x1080 放在第一个位置
        dpiEntries.sort((a, b) => {
            if (a[1] === defaultDpi) return -1;
            if (b[1] === defaultDpi) return 1;
            return 0;
        });
        
        dpiEntries.forEach(([key, value]) => {
            const coverUrl = `${BING}${image.urlbase}_${value}.jpg`;
            info.cover.push({
                dpi: key,
                url: coverUrl
            });
        });
        
        // 根据 dpi 返回特定分辨率的图片
        let imageUrl = info.cover[0].url; // 默认第一个分辨率
        if (dpi && DPI_MAPPINGS[dpi]) {
            const selectedCover = info.cover.find(cover => cover.dpi === dpi);
            if (selectedCover) {
                imageUrl = selectedCover.url;
                info.selected_cover = selectedCover;
            }
        }
        
        // 返回处理结果
        return { info, imageUrl };
    } catch (error) {
        return { error: error.message };
    }
}

export default {
    async fetch(request, env, ctx) {
        // 解析 URL 参数
        const url = new URL(request.url);
        const params = {
            region: url.searchParams.get('region') || 'en-US',
            date: url.searchParams.get('date') || null,
            dpi: url.searchParams.get('dpi') || null,
            type: url.searchParams.get('type') || null
        };
        
        try {
            const { info, imageUrl, error } = await fetchBingWallpaper(params);
            
            // 如果有错误，返回 JSON
            if (error) {
                return new Response(JSON.stringify({ error }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            
            // 如果 type 是 image，直接返回图片
            if (params.type === 'image') {
                const imageResponse = await fetch(imageUrl);
                return new Response(imageResponse.body, {
                    headers: { 
                        'Content-Type': 'image/jpeg',
                        'Cache-Control': 'public, max-age=86400' // 24 小时缓存
                    }
                });
            }
            
            // 其他情况返回 JSON
            return new Response(JSON.stringify(info), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
};