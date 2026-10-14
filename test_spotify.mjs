import axios from 'axios';

async function testInspect() {
  const url = 'https://open.spotify.com/embed/track/0VjIjW4GlUZAMYd2vXSi3b';
  const res = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    }
  });
  const match = res.data.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (match) {
    const data = JSON.parse(match[1]);
    console.log(JSON.stringify(data.props?.pageProps, null, 2).slice(0, 1500));
  }
}

testInspect();
